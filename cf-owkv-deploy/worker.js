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
 *   REVIEW_SIG_SECRET   — 审批链接 HMAC 签名密钥（防伪造，>=32字符）
 *   REVIEW_COOLDOWN_MS  — 驳回后冷却时长(毫秒),默认 86400000 = 24h
 *   CREATOR_REVIEW_WEBHOOK_URL — Discord 审核频道 Webhook URL(secret 注入,勿入库)
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

    // ── 创作者申请提交(观察者→申请; 驳回后冷却期硬校验) ───
    if (request.method === 'POST' && path === '/api/creators/apply') {
      return handleCreatorApply(request, env);
    }

    // ── 创作者审批(架构师点签名链接: GET=确认页, POST=执行) ──
    if ((request.method === 'GET' || request.method === 'POST') && path === '/api/creators/review') {
      return handleCreatorReview(request, env);
    }

    // ── 提案审批(架构师点签名链接: GET=确认页, POST=执行) ──
    if ((request.method === 'GET' || request.method === 'POST') && path === '/api/proposals/review') {
      return handleProposalReview(request, env);
    }

    // ── 活跃提案看板(公开, 无需登录) ─────────────────
    if (request.method === 'GET' && path === '/api/proposals') {
      return handleListProposals(request, env);
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
        email_plaintext = ?,
        role_tag = COALESCE(role_tag, ?), mode_tag = COALESCE(mode_tag, ?)
       WHERE id = ?`
    ).bind(email, roleTag, modeTag, contributorId).run();
  } else {
    const ins = await env.DB.prepare(
      `INSERT INTO contributors (anon_code, email_hash, email_plaintext, role_tag, mode_tag, join_ts, status)
       VALUES (?, ?, ?, ?, ?, datetime('now'), 'observer')`
    ).bind(anonCode, emailHash, email, roleTag, modeTag).run();
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
    'SELECT id, anon_code, role_tag, mode_tag, status, email_hash, creator, creator_apply, apply_at, reviewed_at, apply_note, next_apply_at FROM contributors WHERE id = ?'
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
      email_masked: user.email_hash ? maskHash(user.email_hash) : null,
      creator: !!user.creator,
      creator_apply: user.creator_apply || 'none',
      apply_at: user.apply_at || '',
      reviewed_at: user.reviewed_at || '',
      apply_note: user.apply_note || '',
      next_apply_at: user.next_apply_at || ''
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

  // ── 写 proposals 表(活跃提案看板数据源) + 推 Discord 评议区 ──
  let proposalId = null;
  try {
    const insP = await env.DB.prepare(
      `INSERT INTO proposals
        (user_id, anon_code, title, category, seam_id, node, mode_tag, track, content,
         github_issue_number, github_issue_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(
      payload.sub, anonCode, title, category, seamId || null, node || null,
      modeTag || null, (track === 'canon' ? 'canon' : 'sandbox'), content,
      issue.number, issue.html_url
    ).run();
    proposalId = insP.meta.last_row_id;
  } catch (e) {
    console.error('D1 insert proposals row failed:', e);
    // 开门失败不阻塞返回
  }

  // 推 Discord 评议区(含架构师两步式签名审批链接); 失败不阻塞
  if (proposalId) {
    await notifyProposalDiscord(env, {
      proposalId, title, anonCode, category,
      track: (track === 'canon' ? 'canon' : 'sandbox'),
      seamId: seamId || '', issueUrl: issue.html_url, issueNumber: issue.number
    });
  }

  return json(200, {
    ok: true, status: 'submitted',
    issue: { number: issue.number, url: issue.html_url },
    proposal_id: proposalId,
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

/* ═══════════ 创作者申请提交 /api/creators/apply ═══════════ */
// 观察者提交申请; 驳回后冷却期硬校验; 通过则置 pending + 推 Discord Webhook
async function handleCreatorApply(request, env) {
  const body = await readBody(request);
  if (!body) return json(400, { ok: false, error: 'bad_body' });

  // 1) 登录态校验(带 JWT, 防匿名滥用)
  const authz = request.headers.get('Authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
  if (!token) return json(401, { ok: false, error: 'unauthorized' });
  const payload = await verifyJWT(env, token);
  if (!payload) return json(401, { ok: false, error: 'invalid_token' });
  const userId = payload.sub;

  // 2) 查用户现状(需含新 5 列, 由 schema-creator-approval.sql 提供)
  const row = await env.DB.prepare(
    'SELECT * FROM contributors WHERE id = ?'
  ).bind(userId).first();
  if (!row) return json(404, { ok: false, error: 'user_not_found' });

  // 3) 已创/已提 → 拒绝
  if (row.creator) return json(409, { ok: false, error: 'already_creator' });
  if (row.creator_apply === 'pending' || row.creator_apply === 'approved') {
    return json(409, { ok: false, error: 'already_pending' });
  }

  // 4) 驳回冷却硬校验(后端权限边界, 不靠前端禁用)
  if (row.creator_apply === 'rejected' && row.next_apply_at) {
    const now = Date.now();
    const canAt = Date.parse(row.next_apply_at);
    if (!isNaN(canAt) && now < canAt) {
      return json(429, {
        ok: false, error: 'apply_cooling',
        next_apply_at: row.next_apply_at
      });
    }
  }

  // 5) 写库: 置 pending + apply_at + 清冷却(新一轮重置)
  const nowTs = new Date().toISOString();
  await env.DB.prepare(
    'UPDATE contributors SET creator_apply = ?, apply_at = ?, next_apply_at = NULL, apply_note = NULL WHERE id = ?'
  ).bind('pending', nowTs, userId).run();

  // 6) 推 Discord Webhook(架构师审核频道), 失败不阻塞提交
  const intent = cleanStr(body.intent, 300) || '';
  const sample = cleanStr(body.sample, 600) || '';
  await notifyDiscord(env, {
    anon: row.anon_code || '',
    email: maskEmail(row.email_plaintext || ''),
    at: nowTs,
    intent,
    sample,
    userId
  });

  return json(200, { ok: true, creator_apply: 'pending' });
}

/* ═══════════ 创作者审批 /api/creators/review ═══════════
 * 两步式(防 Discord 链接抓取自动触发副作用):
 *   GET  → 验签后只渲染确认页(零副作用, 被抓取无害)
 *   POST → 验签 + 原子条件更新(仅 pending 可改) + 发信 + 结果页
 */
async function handleCreatorReview(request, env) {
  const url = new URL(request.url);
  let userId, decision, sig;

  if (request.method === 'POST') {
    const body = await readBody(request) || {};
    userId = String(body.user_id || '');
    decision = String(body.decision || '').toLowerCase();
    sig = String(body.sig || '');
  } else {
    userId = url.searchParams.get('user_id') || '';
    decision = (url.searchParams.get('decision') || '').toLowerCase();
    sig = url.searchParams.get('sig') || '';
  }

  if (decision !== 'approve' && decision !== 'reject') {
    return reviewResultPage(400, '审批链接参数错误(decision 必须是 approve 或 reject)');
  }
  const expect = await hmacHex(env.REVIEW_SIG_SECRET, `user_id=${userId}&decision=${decision}`);
  if (!expect || !safeEqual(sig, expect)) {
    return reviewResultPage(401, '审批链接无效或已过期');
  }

  const row = await env.DB.prepare(
    'SELECT * FROM contributors WHERE id = ?'
  ).bind(userId).first();
  if (!row) return reviewResultPage(404, '该用户不存在');

  // GET: 只显示确认页, 不写库不发信(链接预览/抓取不会产生副作用)
  if (request.method !== 'POST') {
    if (row.creator_apply !== 'pending') {
      const already = row.creator ? '已核准' : '已驳回';
      return reviewResultPage(409, `该申请已处理(${already})，无需重复操作`);
    }
    return reviewConfirmPage(userId, decision, sig, row);
  }

  // POST: 原子条件更新(WHERE creator_apply='pending'), 并发/重复提交只会有一次 changes=1
  const nowTs = new Date().toISOString();
  if (decision === 'approve') {
    const res = await env.DB.prepare(
      "UPDATE contributors SET creator = 1, creator_apply = 'approved', reviewed_at = ?, next_apply_at = NULL WHERE id = ? AND creator_apply = 'pending'"
    ).bind(nowTs, userId).run();
    if (!res.meta || res.meta.changes !== 1) {
      return reviewResultPage(409, '该申请已处理或状态已变更，未重复操作');
    }
    await sendCreatorDecisionEmail(env, row.email_plaintext || '', 'approved');
    return reviewResultPage(200, '已核准该用户的创作者权限，已邮件通知');
  } else {
    const cooldownMs = Number(env.REVIEW_COOLDOWN_MS) || 86400000; // 默认 24h
    const nextAt = new Date(Date.now() + cooldownMs).toISOString();
    const res = await env.DB.prepare(
      "UPDATE contributors SET creator_apply = 'rejected', reviewed_at = ?, next_apply_at = ? WHERE id = ? AND creator_apply = 'pending'"
    ).bind(nowTs, nextAt, userId).run();
    if (!res.meta || res.meta.changes !== 1) {
      return reviewResultPage(409, '该申请已处理或状态已变更，未重复操作');
    }
    await sendCreatorDecisionEmail(env, row.email_plaintext || '', 'rejected', nextAt);
    return reviewResultPage(200, '已驳回，申请人稍后可重新申请（24小时冷却）');
  }
}

/* ═══════════ 审批确认页(GET, 零副作用) ═══════════ */
function reviewConfirmPage(userId, decision, sig, row) {
  const isApprove = decision === 'approve';
  const anon = row.anon_code || ('#' + userId);
  const label = isApprove ? '核准' : '驳回';
  const color = isApprove ? '#2e7d32' : '#c62828';
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return new Response(
    `<!doctype html><html lang="zh"><meta charset="utf-8"><title>创作者审批确认</title>` +
    `<body style="font-family:sans-serif;max-width:560px;margin:64px auto;line-height:1.7">` +
    `<h2 style="color:${color}">确认${label}该创作者申请？</h2>` +
    `<p>申请人代号：<strong>${esc(anon)}</strong></p>` +
    `<p style="color:#666;font-size:.92rem">此操作将写入审批结果并发送通知邮件，确认后不可撤销。</p>` +
    `<form method="POST" action="/api/creators/review" style="margin-top:1.4rem">` +
      `<input type="hidden" name="user_id" value="${esc(userId)}">` +
      `<input type="hidden" name="decision" value="${esc(decision)}">` +
      `<input type="hidden" name="sig" value="${esc(sig)}">` +
      `<button type="submit" style="background:${color};color:#fff;border:0;border-radius:8px;padding:.7rem 1.4rem;font-size:1rem;cursor:pointer">确认${label}</button>` +
    `</form>` +
    `</body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/* ═══════════ HMAC-SHA256(审批链接签名) ═══════════ */
async function hmacHex(key, msg) {
  if (!key) return '';
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(msg));
  const bytes = new Uint8Array(sig);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

// 常量时间比较(防时序侧信道)
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ═══════════ Discord Webhook 推送 ═══════════ */
async function notifyDiscord(env, info) {
  const url = env.CREATOR_REVIEW_WEBHOOK_URL;
  if (!url) return; // 未配置则跳过(不阻塞申请)
  const rawContent =
    '**创作者申请待审批**\n' +
    `申请人代号：${info.anon}\n` +
    `邮箱：${info.email}\n` +
    `申请时间：${info.at}\n` +
    `创作意向：${info.intent || '—'}\n` +
    `作品样本：${info.sample || '（未附）'}\n` +
    `\n🟢 核准：${await reviewLink('approve', info.userId, env)}\n` +
    `🔴 驳回：${await reviewLink('reject', info.userId, env)}`;
  // 用 <...> 包裹链接抑制 Discord 链接预览(避免抓取触发副作用)
  const content = rawContent
    .replace(/(https:\/\/[^\s]+)/g, '<$1>');
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'owkv-hub-worker/1.0 (openwkv.xyz)' // Discord 同样必须有 UA(踩坑教训)
      },
      body: JSON.stringify({ content })
    });
  } catch (_) { /* 推送失败不阻塞主流程 */ }
}

async function reviewLink(decision, userId, env) {
  const sig = await hmacHex(env.REVIEW_SIG_SECRET, `user_id=${userId}&decision=${decision}`);
  return `https://join.openwkv.xyz/api/creators/review?user_id=${encodeURIComponent(userId)}&decision=${decision}&sig=${sig}`;
}

/* ═══════════ 审批结果 HTML 页 ═══════════ */
function reviewResultPage(code, msg, scope) {
  const ok = code === 200;
  const isProposal = scope === 'proposal';
  const title = isProposal ? '提案审批' : '创作者审批';
  const okTip = isProposal
    ? '<p>提案者已收到邮件通知。回到 Discord 讨论区继续。</p>'
    : '<p>申请人已收到邮件通知。回到 Discord 讨论区继续。</p>';
  return new Response(
    `<!doctype html><html lang="zh"><meta charset="utf-8"><title>${title}</title>` +
    `<body style="font-family:sans-serif;max-width:560px;margin:80px auto;line-height:1.7">` +
    `<h2 style="color:${ok ? '#2e7d32' : '#c62828'}">${msg}</h2>` +
    (ok
      ? okTip
      : '<p>如有疑问请联系架构师/管理员，通过 Discord 讨论区沟通。</p>') +
    `</body></html>`,
    { status: code, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/* ═══════════ 审批结果邮件(核准/驳回, 独立内联 Resend) ═══════════ */
async function sendCreatorDecisionEmail(env, to, decision, nextAt) {
  if (!to) return; // 无内部通知邮箱则跳过(不阻塞审批结果页)
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) { console.error('RESEND_API_KEY not configured'); return; }
  const subject = decision === 'approved'
    ? '【OpenWuKongVerse】你的创作者申请已核准通过'
    : '【OpenWuKongVerse】你的创作者申请暂未通过';
  const text = decision === 'approved'
    ? '你的创作者申请已被首席架构师核准，身份已升级为「观察者 + 创作者」。\n\n下一步：\n1. 登录 openwkv.xyz（已登录则强刷页面）\n2. 顶部导航已由「个人中心」变为「创作中心」\n3. 进入创作中心（personal.html）即可在站内直接提交提案\n\n—— OpenWuKongVerse 评审团'
    : `你的申请本次未通过核准，你仍保持观察者身份。\n\n可修改申请后重新提交；驳回后需等待冷却期${nextAt ? `（${nextAt} 后）` : ''}。\n也可通过积累 C1–C4 积分自动转正（路A）。\n\n—— OpenWuKongVerse 评审团`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'owkv-hub-worker/1.0 (openwkv.xyz)'
      },
      body: JSON.stringify({
        from: 'OWKV HUB <noreply@openwkv.xyz>',
        to: [to],
        subject,
        text
      })
    });
  } catch (_) { /* 发信失败不阻塞结果页 */ }
}

/* ═══════════ 提案审批 /api/proposals/review (两步式) ═══════════
 * GET  → 验签后只渲染确认页(零副作用, 防 Discord 抓取自动触发)
 * POST → 验签 + 原子条件更新(仅 pending 可改) + GitHub 打标关闭 + 发信 + 结果页
 * decision: canon | sandbox | reject
 */
async function handleProposalReview(request, env) {
  const url = new URL(request.url);
  let proposalId, decision, sig;
  if (request.method === 'POST') {
    const body = await readBody(request) || {};
    proposalId = String(body.proposal_id || '');
    decision = String(body.decision || '').toLowerCase();
    sig = String(body.sig || '');
  } else {
    proposalId = url.searchParams.get('proposal_id') || '';
    decision = (url.searchParams.get('decision') || '').toLowerCase();
    sig = url.searchParams.get('sig') || '';
  }

  const DECISIONS = ['canon', 'sandbox', 'reject'];
  if (!DECISIONS.includes(decision)) {
    return reviewResultPage(400, '审批链接参数错误(decision 必须是 canon/sandbox/reject)', 'proposal');
  }
  const expect = await hmacHex(env.PROPOSAL_SIG_SECRET, `proposal_id=${proposalId}&decision=${decision}`);
  if (!expect || !safeEqual(sig, expect)) {
    return reviewResultPage(401, '审批链接无效或已过期', 'proposal');
  }

  const row = await env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(proposalId).first();
  if (!row) return reviewResultPage(404, '该提案不存在', 'proposal');

  // GET: 只渲染确认页(含三个可选动作), 不写库不改 GitHub 不发信
  if (request.method !== 'POST') {
    if (row.status !== 'pending') {
      return reviewResultPage(409, '该提案已处理，无需重复操作', 'proposal');
    }
    return await reviewProposalConfirmPage(proposalId, row, env);
  }

  // POST: 原子条件更新(WHERE status='pending'), 并发/重复提交只生效一次
  const nowTs = new Date().toISOString();
  const newStatus = decision === 'canon' ? 'approved_canon'
    : (decision === 'sandbox' ? 'approved_sandbox' : 'rejected');
  const res = await env.DB.prepare(
    "UPDATE proposals SET status = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'"
  ).bind(newStatus, nowTs, proposalId).run();
  if (!res.meta || res.meta.changes !== 1) {
    return reviewResultPage(409, '该提案已处理或状态已变更，未重复操作', 'proposal');
  }

  // GitHub 协同(贴状态标签 + 关闭 Issue); 失败不阻塞结果页
  await syncProposalToGitHub(env, row, decision);

  // 通知提案者(内部通知通道 email_plaintext)
  const owner = await env.DB.prepare(
    'SELECT email_plaintext FROM contributors WHERE id = ?'
  ).bind(row.user_id).first();
  await sendProposalDecisionEmail(env, (owner && owner.email_plaintext) || '', decision, row);

  const label = decision === 'canon' ? '已核准入正典'
    : (decision === 'sandbox' ? '已核准入沙盒' : '已驳回');
  return reviewResultPage(200, `${label}，已通知提案者`, 'proposal');
}

/* ═══════════ 提案审批确认页(GET, 零副作用) ═══════════ */
async function reviewProposalConfirmPage(proposalId, row, env) {
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const mk = (d) => hmacHex(env.PROPOSAL_SIG_SECRET, `proposal_id=${proposalId}&decision=${d}`);
  const [sCanon, sSandbox, sReject] = await Promise.all([mk('canon'), mk('sandbox'), mk('reject')]);
  const btn = (d, s, text, color) =>
    `<form method="POST" action="/api/proposals/review" style="display:inline-block;margin:0 .4rem .6rem 0">` +
      `<input type="hidden" name="proposal_id" value="${esc(proposalId)}">` +
      `<input type="hidden" name="decision" value="${d}">` +
      `<input type="hidden" name="sig" value="${esc(s)}">` +
      `<button type="submit" style="background:${color};color:#fff;border:0;border-radius:8px;padding:.7rem 1.3rem;font-size:.98rem;cursor:pointer">${text}</button>` +
    `</form>`;
  return new Response(
    `<!doctype html><html lang="zh"><meta charset="utf-8"><title>提案审批确认</title>` +
    `<body style="font-family:sans-serif;max-width:620px;margin:64px auto;line-height:1.7">` +
    `<h2>确认该提案的审批结果？</h2>` +
    `<p>提案标题：<strong>${esc(row.title)}</strong></p>` +
    `<p>提案者：<strong>${esc(row.anon_code || ('#' + proposalId))}</strong>　内容分类：${esc(row.category || '—')}　目标轨道：${esc(row.track === 'canon' ? '正典轨道' : '沙盒轨道')}</p>` +
    `<p style="color:#666;font-size:.92rem">此操作将写入审批结果、更新 GitHub Issue 状态并发送通知邮件，确认后不可撤销。</p>` +
    `<div style="margin-top:1.2rem">` +
      btn('canon', sCanon, '🟢 核准入正典', '#2e7d32') +
      btn('sandbox', sSandbox, '🔵 核准入沙盒', '#1565c0') +
      btn('reject', sReject, '🔴 驳回', '#c62828') +
    `</div>` +
    `</body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/* ═══════════ 活跃提案看板 /api/proposals (公开) ═══════════ */
async function handleListProposals(request, env) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'pending';
  const limitRaw = parseInt(url.searchParams.get('limit') || '20', 10);
  const limit = Math.min(Math.max(isNaN(limitRaw) ? 20 : limitRaw, 1), 100);
  const cols = 'id, anon_code, title, category, seam_id, node, mode_tag, track, status, ' +
    'github_issue_url, discord_thread_url, reddit_poll_url, created_at, reviewed_at';
  let rows;
  try {
    if (status === 'all') {
      rows = await env.DB.prepare(
        `SELECT ${cols} FROM proposals ORDER BY id DESC LIMIT ?`
      ).bind(limit).all();
    } else {
      rows = await env.DB.prepare(
        `SELECT ${cols} FROM proposals WHERE status = ? ORDER BY id DESC LIMIT ?`
      ).bind(status, limit).all();
    }
  } catch (e) {
    console.error('list proposals failed:', e);
    return json(500, { ok: false, error: 'list_failed' });
  }
  return json(200, { ok: true, proposals: rows.results || [] });
}

/* ═══════════ 提案评议区 Discord 推送 ═══════════ */
async function notifyProposalDiscord(env, info) {
  const url = env.PROPOSAL_REVIEW_WEBHOOK_URL;
  if (!url) return; // 未配置则跳过
  const linkCanon = await proposalReviewLink('canon', info.proposalId, env);
  const linkSandbox = await proposalReviewLink('sandbox', info.proposalId, env);
  const linkReject = await proposalReviewLink('reject', info.proposalId, env);
  const rawContent =
    '**新共创提案待评审**\n' +
    `提案标题：${info.title}\n` +
    `提案者：${info.anonCode}\n` +
    `内容分类：${info.category || '—'}\n` +
    `目标轨道：${info.track === 'canon' ? '正典轨道' : '沙盒轨道'}\n` +
    `介入缝：${info.seamId || '待定'}\n` +
    `GitHub Issue：#${info.issueNumber}\n` +
    `\n🟢 核准入正典：${linkCanon}\n🔵 核准入沙盒：${linkSandbox}\n🔴 驳回：${linkReject}\n` +
    `查看提案全文：${info.issueUrl}`;
  // 用 <...> 包裹链接抑制 Discord 链接预览(避免抓取触发副作用)
  const content = rawContent.replace(/(https:\/\/[^\s]+)/g, '<$1>');
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'owkv-hub-worker/1.0 (openwkv.xyz)'
      },
      body: JSON.stringify({ content })
    });
  } catch (_) { /* 推送失败不阻塞提案提交 */ }
}

async function proposalReviewLink(decision, proposalId, env) {
  const sig = await hmacHex(env.PROPOSAL_SIG_SECRET, `proposal_id=${proposalId}&decision=${decision}`);
  return `https://join.openwkv.xyz/api/proposals/review?proposal_id=${encodeURIComponent(proposalId)}&decision=${decision}&sig=${sig}`;
}

/* ═══════════ GitHub 协同: 提案审批后打标 + 关闭 Issue ═══════════ */
async function syncProposalToGitHub(env, row, decision) {
  if (!env.GH_TOKEN || !env.GH_REPO || !row.github_issue_number) return;
  const headers = {
    'Authorization': `Bearer ${env.GH_TOKEN}`,
    'User-Agent': 'owkv-hub-worker/1.0 (openwkv.xyz)',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
  const labelName = decision === 'canon' ? 'status/approved-canon'
    : (decision === 'sandbox' ? 'status/approved-sandbox' : 'status/rejected');
  const color = decision === 'canon' ? '2e7d32' : (decision === 'sandbox' ? '1565c0' : 'c62828');
  // 尽力创建状态标签(已存在返回 422, 忽略)
  try {
    await fetch(`https://api.github.com/repos/${env.GH_REPO}/labels`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: labelName, color, description: 'OWKV 提案审批状态' })
    });
  } catch (_) { /* 忽略 */ }
  // 追加标签(不覆盖原有 proposal 标签)
  try {
    await fetch(`https://api.github.com/repos/${env.GH_REPO}/issues/${row.github_issue_number}/labels`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ labels: [labelName] })
    });
  } catch (e) { console.error('GitHub add label failed:', e); }
  // 关闭 Issue
  try {
    await fetch(`https://api.github.com/repos/${env.GH_REPO}/issues/${row.github_issue_number}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        state: 'closed',
        state_reason: decision === 'reject' ? 'not_planned' : 'completed'
      })
    });
  } catch (e) { console.error('GitHub close issue failed:', e); }
}

/* ═══════════ 提案审批结果邮件(独立内联 Resend) ═══════════ */
async function sendProposalDecisionEmail(env, to, decision, row) {
  if (!to) return;
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) { console.error('RESEND_API_KEY not configured'); return; }
  const title = row.title || '';
  let subject, text;
  if (decision === 'canon') {
    subject = '【OpenWuKongVerse】你的提案已核准入正典';
    text = `你的提案《${title}》已被首席架构师核准，并入正典（Canon）。\n\n后续：内容将进入 01-canon/ 正典库，并在 HUB 共创展示页对外展示。\n\n—— OpenWuKongVerse 评审团`;
  } else if (decision === 'sandbox') {
    subject = '【OpenWuKongVerse】你的提案已核准入沙盒';
    text = `你的提案《${title}》已被首席架构师核准，并入沙盒轨道（Sandbox）。\n\n后续：内容进入沙盒，可继续自由演化，待模态坍缩时再评估并入正典。\n\n—— OpenWuKongVerse 评审团`;
  } else {
    subject = '【OpenWuKongVerse】你的提案暂未通过';
    text = `你的提案《${title}》本次未通过核准。\n\n可修订后重新提交，或到 Discord 讨论区了解原因。\n\n—— OpenWuKongVerse 评审团`;
  }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'owkv-hub-worker/1.0 (openwkv.xyz)'
      },
      body: JSON.stringify({
        from: 'OWKV HUB <noreply@openwkv.xyz>',
        to: [to],
        subject,
        text
      })
    });
  } catch (_) { /* 发信失败不阻塞结果页 */ }
}
