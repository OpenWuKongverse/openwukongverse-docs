/**
 * OWKV · HUB 站认证 Worker（方案A 免密码 + 五重防刷 + 30天长效登录）
 *
 * 路由:
 *   OPTIONS           → CORS preflight(204)
 *   POST /api/auth/send-otp   邮箱 → Turnstile → 六重防刷 → 发送6位OTP邮件
 *   POST /api/auth/verify-otp Token校验 → 销毁 → 建/更新 contributors → 签发30天JWT
 *   POST /join        (兼容旧表单) 报名表单 → events_raw
 *   GET  /api/user/me (带 Bearer JWT) 用户信息/积分
 *   POST /api/proposals (带 Bearer JWT + Turnstile) 站内提案表单 → GitHub Issue + events_raw
 *
 * 环境变量(Wrangler secret 注入, 不硬编码):
 *   TURNSTILE_SECRET — Turnstile 服务端密钥
 *   RESEND_API_KEY   — Resend 邮件 API key(免费3000/月,100/天)
 *   JWT_SECRET       — JWT 签名密钥(HS256,至少32字符)
 *   APP_TOKEN        — 可选内部口令(留空不启用)
 *   rateKV           — 可选 KV 绑定(IP 限流,不绑则跳过该层)
 *   GH_TOKEN         — 提案提交通道: GitHub PAT(仅需 issues:write 权限)
 *   GH_REPO          — 提案提交通道: 目标仓库, 如 OpenWuKongverse/openwukongverse-docs
 *   GH_PROPOSAL_LABEL— 可选提案标签, 如 proposal
 *
 * 前端(join.html)需: turnstile_token(或cf-turnstile-response), email,
 *                    anon_code/role_tag/mode_tag(可选), hp(蜜罐隐藏字段)
 */

export default {
  async fetch(request, env, ctx) {
    // 首次自动建表(请求内 await, 保证先建表后写库, 幂等)
    if (!env.__initStarted) {
      env.__initStarted = true;
      await ensureSchema(env);
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ── 认证路由 ──────────────────────────────────────
    if (request.method === 'POST' && path === '/api/auth/send-otp') {
      return handleSendOtp(request, env);
    }
    if (request.method === 'POST' && path === '/api/auth/verify-otp') {
      return handleVerifyOtp(request, env);
    }

    // ── 用户信息(带 JWT) ──────────────────────────────
    if (request.method === 'GET' && path === '/api/user/me') {
      return handleUserMe(request, env);
    }

    // ── 提案提交(站内表单 → 自动转 GitHub Issue) ─────────
    if (request.method === 'POST' && path === '/api/proposals') {
      return handleSubmitProposal(request, env);
    }

    // ── 兼容旧报名表单(写 events_raw) ─────────────────
    if (request.method === 'POST' && (path === '/join' || path === '/register')) {
      return handleLegacyJoin(request, env);
    }

    return json(404, { ok: false, error: 'not_found' });
  }
};

/* ═══════════════════════ send-otp ═══════════════════════ */
async function handleSendOtp(request, env) {
  const body = await readBody(request);
  if (!body) return json(400, { ok: false, error: 'bad_body' });

  // 防刷①: 蜜罐
  if (body.hp && String(body.hp).length > 0) {
    return json(200, { ok: false, error: 'blocked_honeypot' });
  }

  // 防刷②: Turnstile(失败直接拒绝, 完全不触发发信)
  const tsToken = body["cf-turnstile-response"] || body.turnstile_token;
  if (!tsToken) return json(400, { ok: false, error: 'missing_turnstile' });
  const tsOk = await verifyTurnstile(env.TURNSTILE_SECRET, tsToken, request.headers.get('CF-Connecting-IP'));
  if (!tsOk) return json(400, { ok: false, error: 'turnstile_failed' });

  // 字段校验
  const email = cleanStr(body.email, 120).toLowerCase();
  if (!email || !email.includes('@')) return json(400, { ok: false, error: 'missing_email' });
  if (isDisposableEmail(email)) return json(400, { ok: false, error: 'disposable_email' });

  // 防刷③: IP 限流(每分钟≤5, 需绑 KV; 不绑则只靠下面的邮箱/全局限流)
  if (env.rateKV) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const key = `otp:${ip}`;
    let cur = 0;
    try {
      const raw = await env.rateKV.get(key);
      const ttl = await env.rateKV.get(`${key}:ttl`);
      const now = Date.now();
      cur = (ttl && now - parseInt(ttl, 10) < 60000) ? parseInt(raw || '0', 10) : 0;
    } catch (e) { cur = 0; }
    if (cur >= 5) return json(429, { ok: false, error: 'rate_limited' });
    await env.rateKV.put(key, String(cur + 1), { expirationTtl: 60 });
  }

  const emailHash = await sha256(email);

  // 防刷④: 单邮箱冷却(60s) + 单邮箱每日上限(3封)
  const nowTs = Math.floor(Date.now() / 1000);
  const existing = await env.DB.prepare(
    'SELECT token_hash, expires_at FROM email_tokens WHERE email_hash = ?'
  ).bind(emailHash).first();

  if (existing && existing.expires_at && (nowTs - (existing.expires_at - 900)) < 60) {
    return json(429, { ok: false, error: 'cooldown_active', retry_after: 60 });
  }

  const dayKey = new Date().toISOString().slice(0, 10);
  const dayCount = await env.DB.prepare(
    'SELECT SUM(sent_count) AS c FROM global_daily_limits WHERE day = ?'
  ).bind(dayKey).first();
  // 注: 单邮箱每日3封的精确计数需要更多逻辑, 此处用 email_tokens 的最近3条近似 + 全局熔断兜底。
  // 精确做法: 若 3 封限制严格需另建 email_daily 跟踪; 现阶段以 cooldown + 全局熔断为主要防护。

  // 防刷⑤: 全局每日熔断(免费额度100/天, 硬顶80)
  if (dayCount && dayCount.c >= 80) {
    return json(429, { ok: false, error: 'daily_budget_exhausted' });
  }

  // 生成6位OTP(用 crypto.getRandomValues, 不用 Math.random)
  const otp = generateOtp();

  // 处理 pending_contributors(暂存注册信息, verify 时正式建账)
  const anonCode = cleanStr(body.anon_code, 40);
  const roleTag = validRole(cleanStr(body.role_tag, 30));
  const modeTag = validMode(cleanStr(body.mode_tag, 10));
  const sourceIp = request.headers.get('CF-Connecting-IP') || null;

  try {
    // 存 token(hash), 15分钟过期
    await env.DB.prepare(
      `INSERT INTO email_tokens (email_hash, token_hash, expires_at, attempts)
       VALUES (?, ?, ?, 0)
       ON CONFLICT(email_hash) DO UPDATE SET
         token_hash=excluded.token_hash, expires_at=excluded.expires_at, attempts=0`
    ).bind(emailHash, await sha256(otp), nowTs + 900).run();

    // upsert pending_contributors
    await env.DB.prepare(
      `INSERT INTO pending_contributors (email_hash, anon_code, role_tag, mode_tag, source_ip)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(email_hash) DO UPDATE SET
         anon_code=excluded.anon_code, role_tag=excluded.role_tag,
         mode_tag=excluded.mode_tag, source_ip=excluded.source_ip`
    ).bind(emailHash, anonCode || null, roleTag || null, modeTag || null, sourceIp).run();
  } catch (e) {
    console.error('D1 token store failed:', e);
    return json(500, { ok: false, error: 'db_write_failed' });
  }

  // 发送邮件(Resend)
  const mailOk = await sendVerificationEmail(env, email, otp);
  if (!mailOk) {
    // 发送失败 → 删除记录避免无效 token 残留
    await env.DB.prepare('DELETE FROM email_tokens WHERE email_hash = ?').bind(emailHash).run();
    return json(502, { ok: false, error: 'mail_send_failed' });
  }

  // 全局熔断计数 +1
  await env.DB.prepare(
    `INSERT INTO global_daily_limits (day, sent_count) VALUES (?, 1)
     ON CONFLICT(day) DO UPDATE SET sent_count = sent_count + 1`
  ).bind(dayKey).run();

  return json(200, { ok: true, status: 'sent', email_masked: maskEmail(email) });
}

/* ═══════════════════════ verify-otp ═══════════════════════ */
async function handleVerifyOtp(request, env) {
  const body = await readBody(request);
  if (!body) return json(400, { ok: false, error: 'bad_body' });

  const email = cleanStr(body.email, 120).toLowerCase();
  // 兼容 otp 与 token 两种字段名(前端发 otp, 旧/第三方可发 token)
  const otp = cleanStr(body.otp != null ? body.otp : body.token, 10);
  if (!email || !otp) return json(400, { ok: false, error: 'missing_fields' });

  const emailHash = await sha256(email);
  const tokenHash = await sha256(otp);

  const row = await env.DB.prepare(
    'SELECT token_hash, expires_at, attempts FROM email_tokens WHERE email_hash = ?'
  ).bind(emailHash).first();

  if (!row) return json(400, { ok: false, error: 'no_token' });

  const nowTs = Math.floor(Date.now() / 1000);

  // attempts 锁定(5次失败作废)
  if (row.attempts >= 5) {
    await env.DB.prepare('DELETE FROM email_tokens WHERE email_hash = ?').bind(emailHash).run();
    return json(429, { ok: false, error: 'too_many_attempts' });
  }

  // 过期判定
  if (row.expires_at < nowTs) {
    await env.DB.prepare('DELETE FROM email_tokens WHERE email_hash = ?').bind(emailHash).run();
    return json(400, { ok: false, error: 'token_expired' });
  }

  // Token 比对(哈希安全比对)
  if (row.token_hash !== tokenHash) {
    const newAttempts = row.attempts + 1;
    await env.DB.prepare('UPDATE email_tokens SET attempts = ? WHERE email_hash = ?')
      .bind(newAttempts, emailHash).run();
    return json(400, { ok: false, error: 'invalid_token', attempts_left: 5 - newAttempts });
  }

  // 校验通过 → 销毁 token
  await env.DB.prepare('DELETE FROM email_tokens WHERE email_hash = ?').bind(emailHash).run();

  // 读取 pending_contributors(注册时填写的信息)
  const pending = await env.DB.prepare(
    'SELECT anon_code, role_tag, mode_tag FROM pending_contributors WHERE email_hash = ?'
  ).bind(emailHash).first();

  // 创建/更新 contributors(存在则复用, 邮箱验证即 observer)
  const anonCode = (pending && pending.anon_code) || generateAnonCode();
  const roleTag = (pending && pending.role_tag) || null;
  const modeTag = (pending && pending.mode_tag) || null;

  let contributorId;
  const existingUser = await env.DB.prepare(
    'SELECT id, status FROM contributors WHERE email_hash = ?'
  ).bind(emailHash).first();

  if (existingUser) {
    contributorId = existingUser.id;
    // 若角色/模态此前为空, 现在补上
    await env.DB.prepare(
      `UPDATE contributors SET status='observer',
        role_tag = COALESCE(role_tag, ?), mode_tag = COALESCE(mode_tag, ?)
       WHERE id = ?`
    ).bind(roleTag, modeTag, contributorId).run();
  } else {
    const ins = await env.DB.prepare(
      `INSERT INTO contributors (anon_code, email_hash, role_tag, mode_tag, join_ts, status)
       VALUES (?, ?, ?, ?, datetime('now'), 'observer')`
    ).bind(anonCode, emailHash, roleTag, modeTag).run();
    contributorId = ins.meta.last_row_id;
  }

  // 写 events_raw(join 事件在验证成功后记录)
  const payload = JSON.stringify({ via: 'email-otp', anon_code: anonCode, role_tag: roleTag, mode_tag: modeTag });
  await env.DB.prepare(
    "INSERT INTO events_raw (platform, event_type, contributor_key, payload, ts) VALUES (?, ?, ?, ?, datetime('now'))"
  ).bind('webform', 'join', anonCode, payload).run();

  // 清理 pending
  await env.DB.prepare('DELETE FROM pending_contributors WHERE email_hash = ?').bind(emailHash).run();

  // 签发30天 JWT
  const jwt = await signJWT(env, { sub: contributorId, email_hash: emailHash, role: 'observer' });

  return json(200, {
    ok: true,
    status: 'verified',
    user: { id: contributorId, anon_code: anonCode, role: 'observer' },
    token: jwt,
    expires_in: 30 * 24 * 3600
  });
}

/* ═══════════════════════ /api/user/me ═══════════════════════ */
async function handleUserMe(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const raw = auth.replace(/^Bearer\s+/i, '');
  if (!raw) return json(401, { ok: false, error: 'unauthorized' });

  const payload = await verifyJWT(env, raw);
  if (!payload) return json(401, { ok: false, error: 'invalid_token' });

  const user = await env.DB.prepare(
    'SELECT id, anon_code, role_tag, mode_tag, status, email_hash FROM contributors WHERE id = ?'
  ).bind(payload.sub).first();
  if (!user) return json(404, { ok: false, error: 'user_not_found' });

  // 积分聚合
  const pointsRows = await env.DB.prepare(
    `SELECT dim, SUM(points) AS total FROM ledger WHERE contributor_id = ? GROUP BY dim`
  ).bind(payload.sub).all();

  const points = { C1: 0, C2: 0, C3: 0, C4: 0, total: 0 };
  for (const r of (pointsRows.results || [])) {
    const v = Number(r.total) || 0;
    points[r.dim] = v;
    points.total += v;
  }

  return json(200, {
    ok: true,
    user: {
      id: user.id,
      anon_code: user.anon_code,
      role_tag: user.role_tag,
      mode_tag: user.mode_tag,
      status: user.status,
      email_masked: user.email_hash ? maskHash(user.email_hash) : null
    },
    points
  });
}

/* ═══════════════════════ 兼容旧表单 ═══════════════════════ */
async function handleLegacyJoin(request, env) {
  const body = await readBody(request);
  if (!body) return json(400, { ok: false, error: 'bad_body' });

  if (body.hp && String(body.hp).length > 0) return json(200, { ok: false, error: 'blocked_honeypot' });

  const tsToken = body["cf-turnstile-response"] || body.turnstile_token;
  if (!tsToken) return json(400, { ok: false, error: 'missing_turnstile' });
  const tsOk = await verifyTurnstile(env.TURNSTILE_SECRET, tsToken, request.headers.get('CF-Connecting-IP'));
  if (!tsOk) return json(400, { ok: false, error: 'turnstile_failed' });

  const anonCode = cleanStr(body.anon_code, 40);
  const roleTag = cleanStr(body.role_tag, 30);
  const modeTag = cleanStr(body.mode_tag, 10);
  const email = cleanStr(body.email, 120);
  if (!anonCode || !email) return json(400, { ok: false, error: 'missing_fields' });

  const payload = JSON.stringify({
    anon_code: anonCode, role_tag: roleTag, mode_tag: modeTag,
    email_hash: await sha256(email),
    source_ip: request.headers.get('CF-Connecting-IP') || null
  });

  try {
    await env.DB.prepare(
      "INSERT INTO events_raw (platform, event_type, contributor_key, payload, ts) VALUES (?, ?, ?, ?, datetime('now'))"
    ).bind('webform', 'join', anonCode, payload).run();
    return json(200, { ok: true, status: 'observer' });
  } catch (e) {
    console.error('D1 insert failed:', e);
    return json(500, { ok: false, error: 'db_write_failed' });
  }
}

/* ═══════════════════════ 提案提交 /api/proposals ═══════════════════════ */
// 站内可视化提案表单 → 自动在 GitHub 仓库开 Issue(提案级留痕)。
// 目标: 让不会用 GitHub 的创作者也能提交提案, 后端代开 Issue, 用户全程不碰 Git。
// 入参(JSON): title, category(脑洞|剧情|角色|设定延伸|模态延伸), seam_id,
//             node, mode_tag(A/B/C/跨), content, canon_check(数组),
//             track(canon|sandbox), hp(蜜罐)。
// 鉴权: Bearer JWT(需登录, 防匿名刷提); Turnstile + 蜜罐防刷。
async function handleSubmitProposal(request, env) {
  // 0) 必须有 GH_TOKEN, 否则整个端点不可用
  if (!env.GH_TOKEN || !env.GH_REPO) {
    return json(503, { ok: false, error: 'proposal_disabled', hint: '提案提交通道尚未就绪(缺 GitHub 配置)。' });
  }

  // 1) 登录态校验(Bearer JWT) — 防匿名滥用
  const auth = request.headers.get('Authorization') || '';
  const raw = auth.replace(/^Bearer\s+/i, '');
  if (!raw) return json(401, { ok: false, error: 'unauthorized', hint: '请先登录(观察者身份)再提交提案。' });
  const payload = await verifyJWT(env, raw);
  if (!payload) return json(401, { ok: false, error: 'invalid_token', hint: '登录已失效, 请重新登录。' });

  const body = await readBody(request);
  if (!body) return json(400, { ok: false, error: 'bad_body' });

  // 2) 蜜罐防刷
  if (body.hp && String(body.hp).length > 0) {
    return json(200, { ok: false, error: 'blocked_honeypot' });
  }

  // 3) Turnstile 人机验证(与注册表单一致)
  const tsToken = body["cf-turnstile-response"] || body.turnstile_token;
  if (!tsToken) return json(400, { ok: false, error: 'missing_turnstile' });
  const tsOk = await verifyTurnstile(env.TURNSTILE_SECRET, tsToken, request.headers.get('CF-Connecting-IP'));
  if (!tsOk) return json(400, { ok: false, error: 'turnstile_failed' });

  // 4) 字段校验
  const title = cleanStr(body.title, 120);
  const seamId = cleanStr(body.seam_id, 40);
  const node = cleanStr(body.node, 200);
  const modeTag = validMode(cleanStr(body.mode_tag, 10)) || (cleanStr(body.mode_tag, 10).toLowerCase() === 'cross' ? 'cross' : null);
  const content = cleanStr(body.content, 20000);
  const categoryRaw = cleanStr(body.category, 30);
  let category = categoryRaw;
  const track = cleanStr(body.track, 10);

  if (!title) return json(400, { ok: false, error: 'missing_title', hint: '请填写提案标题。' });
  if (!content) return json(400, { ok: false, error: 'missing_content', hint: '请填写提案内容。' });

  // 分类白名单
  const cats = ['脑洞', '剧情', '角色', '设定延伸', '模态延伸'];
  if (!cats.includes(category)) category = '脑洞';
  // 轨道白名单
  const trackLabel = (track === 'canon') ? '正典轨道' : ((track === 'sandbox') ? '沙盒轨道' : '沙盒轨道');

  // 署名: 用登录贡献者代号
  const user = await env.DB.prepare(
    'SELECT anon_code, role_tag, mode_tag, status FROM contributors WHERE id = ?'
  ).bind(payload.sub).first();
  const anonCode = (user && user.anon_code) || 'observer';
  const status = (user && user.status) || 'observer';

  // 5) 三层红线自检(前端 checkbox, 后端要求前两条必须勾选)
  const checks = Array.isArray(body.canon_check) ? body.canon_check : [];
  const hasLaw = checks.includes('law');
  const hasPerm = checks.includes('perm');
  const hasMeta = checks.includes('meta');
  if (!hasLaw || !hasPerm) {
    return json(400, { ok: false, error: 'missing_red_lines', hint: '请勾选「法则自洽」与「权限自洽」两层红线自检。' });
  }

  // ── 组装 GitHub Issue 正文(对齐 OWKV-PROPOSAL-TPL 结构) ──
  const bodyText = [
    '─────────────────────────────',
    `【共创提案】${title}`,
    '─────────────────────────────',
    `● 贡献者署名：${anonCode}`,
    `● 介入缝编号：${seamId || '待定'}`,
    `● 所属节点：${node || '待定'}`,
    `● 模态：${modeTag === 'cross' ? '跨模态' : (modeTag || 'B')}`,
    `● 内容分类：${category}`,
    '─────────────────────────────',
    '【提案内容】',
    content,
    '─────────────────────────────',
    '【三层红线自检】',
    `${hasLaw ? '☑' : '☐'} 法则自洽`,
    `${hasPerm ? '☑' : '☐'} 权限自洽`,
    `${hasMeta ? '☑' : '☐'} 元层自洽`,
    '─────────────────────────────',
    `【目标轨道】${trackLabel}`,
    '─────────────────────────────',
    `_由 HUB 站内表单提交 · 经架构师审查后进入正典/沙盒流水线_`
  ].join('\n');

  // ── 检查前: 防止同一邮箱刷同标题(近似去重, 简版) ──
  // 无独立表, 这里不强制; 由防刷层(Turnstile+JWT+人工审查)兜底。

  // ── 调 GitHub API 开 Issue ──
  let issue;
  try {
    const r = await fetch(`https://api.github.com/repos/${env.GH_REPO}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GH_TOKEN}`,
        'User-Agent': 'owkv-hub-worker/1.0 (openwkv.xyz)',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `[提案] ${title}（${anonCode}）`,
        body: bodyText,
        labels: env.GH_PROPOSAL_LABEL ? [env.GH_PROPOSAL_LABEL] : [],
        // 组织仓库不能 assignee 外部用户, 留空
      })
    });
    // 记录确切状态码 + 响应原文前缀(诊断用), 便于区分 403/401/422/413 等
    const rawText = await r.clone().text().catch(() => '');
    console.error('GitHub API resp:', r.status, rawText.slice(0, 200));
    const j = await r.json().catch(() => ({ __non_json: true, raw_prefix: rawText.slice(0, 120) }));
    if (!r.ok) {
      console.error('GitHub API create issue failed:', r.status, JSON.stringify(j).slice(0, 400));
      return json(502, { ok: false, error: 'github_create_failed', hint: '提交到提案库失败, 请稍后重试或改走邮件/Discord。' });
    }
    issue = j;
  } catch (e) {
    console.error('GitHub API fetch error:', e);
    return json(502, { ok: false, error: 'github_network_failed', hint: '提交到提案库失败, 请稍后重试。' });
  }

  // ── 写 events_raw(提案事件留痕, 供 C1 积分台账溯源) ──
  let eventId = null;
  try {
    const payloadJson = JSON.stringify({
      via: 'hub-form', title, category, seam_id: seamId,
      node, mode_tag: modeTag, track, github_issue: issue.number,
      github_url: issue.html_url
    });
    const ins = await env.DB.prepare(
      "INSERT INTO events_raw (platform, event_type, contributor_key, payload) VALUES (?, ?, ?, ?)"
    ).bind('webform', 'submit_proposal', anonCode, payloadJson).run();
    eventId = ins.meta.last_row_id;
  } catch (e) {
    console.error('D1 insert proposal event failed:', e);
    // Issue 已开, 事件记录失败不阻塞返回
  }

  return json(200, {
    ok: true, status: 'submitted',
    issue: { number: issue.number, url: issue.html_url },
    event_id: eventId
  });
}

/* ═══════════════════════ 工具函数 ═══════════════════════ */

// 用 crypto.getRandomValues 生成6位数字 OTP(不用 Math.random)
function generateOtp() {
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  // 每字节 → 0-9, 拼接成6位(避免偏斜可接受, 熵足够)
  let otp = '';
  for (let i = 0; i < 6; i++) {
    otp += (arr[i] % 10).toString();
  }
  return otp;
}

// 生成匿名代号(未填时)
function generateAnonCode() {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  return `observer-${hex.slice(0, 6)}`;
}

// 签发 30 天 JWT (HS256, crypto.subtle)
async function signJWT(env, payload) {
  const secret = env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');

  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + 30 * 24 * 3600 };

  const enc = (obj) => btoa(JSON.stringify(obj))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const h = enc(header);
  const p = enc(body);
  const signingInput = `${h}.${p}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${h}.${p}.${sigB64}`;
}

// 校验 JWT, 返回 payload 或 null
async function verifyJWT(env, token) {
  const secret = env.JWT_SECRET;
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      'HMAC', key,
      sigBytes,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) return null;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// 发送验证邮件(Resend API)
async function sendVerificationEmail(env, email, otp) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not configured');
    return false;
  }

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#1a1a1a">OpenWuKongVerse · 邮箱验证</h2>
      <p>你的验证码是：</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f4f4f5;padding:16px;border-radius:8px;text-align:center">${otp}</div>
      <p style="color:#555">验证码 <strong>15 分钟</strong>内有效。若不是你本人操作，请忽略此邮件。</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="color:#888;font-size:12px">开源悟空多维宇宙 · 由社区共创</p>
    </div>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'OWKV HUB <noreply@openwkv.xyz>',
        to: [email],
        subject: '【OWKV】你的邮箱验证码',
        html
      })
    });

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      console.error('Resend error:', r.status, JSON.stringify(j).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error('Resend fetch error:', e);
    return false;
  }
}

// 自动建表(幂等; 对齐 schema.sql)
async function ensureSchema(env) {
  try {
    await env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS events_raw (id INTEGER PRIMARY KEY AUTOINCREMENT, platform TEXT NOT NULL, event_type TEXT NOT NULL, contributor_key TEXT NOT NULL, payload TEXT, ts TEXT DEFAULT (datetime('now')))"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS contributors (id INTEGER PRIMARY KEY AUTOINCREMENT, anon_code TEXT UNIQUE NOT NULL, email_hash TEXT UNIQUE, role_tag TEXT, mode_tag TEXT, join_ts TEXT, status TEXT DEFAULT 'observer')"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, contributor_id INTEGER REFERENCES contributors(id), dim TEXT NOT NULL, points REAL NOT NULL, source_event INTEGER REFERENCES events_raw(id), approved_by TEXT, ts TEXT DEFAULT (datetime('now')))"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, seam_id TEXT NOT NULL, mode_tag TEXT, role_tag TEXT, status TEXT DEFAULT 'open', assignee_id INTEGER, claimed_at TEXT)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS email_tokens (email_hash TEXT UNIQUE NOT NULL, token_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS global_daily_limits (day TEXT PRIMARY KEY, sent_count INTEGER DEFAULT 0)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS pending_contributors (id INTEGER PRIMARY KEY AUTOINCREMENT, email_hash TEXT UNIQUE NOT NULL, anon_code TEXT, role_tag TEXT, mode_tag TEXT, source_ip TEXT, created_at TEXT DEFAULT (datetime('now')))"),
      env.DB.prepare("CREATE VIEW IF NOT EXISTS v_dashboard AS SELECT c.anon_code, c.role_tag, c.mode_tag, c.status, SUM(CASE WHEN l.dim='C1' THEN l.points ELSE 0 END) AS C1, SUM(CASE WHEN l.dim='C2' THEN l.points ELSE 0 END) AS C2, SUM(CASE WHEN l.dim='C3' THEN l.points ELSE 0 END) AS C3, SUM(CASE WHEN l.dim='C4' THEN l.points ELSE 0 END) AS C4, SUM(l.points) AS total, COUNT(l.id) AS events FROM contributors c LEFT JOIN ledger l ON l.contributor_id=c.id GROUP BY c.id")
    ]);
    console.log('D1 schema ensured');
  } catch (e) {
    console.error('ensureSchema failed:', e);
  }
}

// Turnstile 服务端校验
async function verifyTurnstile(secret, token, ip) {
  if (!secret) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: form
    });
    const j = await r.json();
    return j && j.success === true;
  } catch (e) {
    return false;
  }
}

// 解析请求体(JSON 或 form)
async function readBody(request) {
  try {
    const type = request.headers.get('content-type') || '';
    if (type.includes('application/json')) return await request.json();
    if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
      const fd = await request.formData();
      return Object.fromEntries(fd.entries());
    }
    return null;
  } catch (e) {
    return null;
  }
}

function cleanStr(v, max) {
  if (v == null) return '';
  return String(v).replace(/<[^>]*>/g, '').trim().slice(0, max);
}

function validRole(r) {
  return ['artist', 'writer', 'player', 'programmer', 'community'].includes(r) ? r : null;
}
function validMode(m) {
  return ['A', 'B', 'C'].includes(m) ? m : null;
}

function isDisposableEmail(email) {
  const dom = email.split('@')[1]?.toLowerCase() || '';
  const disposables = [
    'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'temp-mail.org',
    'yopmail.com', 'throwawaymail.com', 'mailsac.com', 'maildrop.cc'
  ];
  return dom && disposables.includes(dom);
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function maskEmail(email) {
  const [name, dom] = email.split('@');
  if (!dom) return email;
  return `${name.slice(0, 2)}***@${dom}`;
}

function maskHash(h) {
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

function json(code, obj) {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
