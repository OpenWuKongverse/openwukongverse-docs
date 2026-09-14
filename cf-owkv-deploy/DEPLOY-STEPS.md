# OWKV 报名表单 Worker · 部署步骤（控制台逐屏路径）

> 目标：把 `worker.js` 部署为一个 Cloudflare Worker，绑定你已建好的 D1 库 `owkv-events`，接 Turnstile，接收 openwkv.xyz 站内报名表单。
> 你已具备：CF 账号 `Ava0630ava@gmail.com's Account`、D1 `owkv-events`（空库）、Turnstile 站点 `openwkv.xyz (Spin)`、sitekey / secret。

---

## 方式一：控制台在线编辑器（推荐，无需本地命令行、无需写 token）

### 第 1 步：进入 Workers 创建页
1. 浏览器打开 **dash.cloudflare.com** → 登录
2. 左侧栏点 **Workers & Pages**
3. 点右上 **Create application**（创建应用）
4. 选 **Worker** → **Create Worker**（不是"上传资源"那个）
5. 给名字填 **`owkv-enroll`** → 点 **Deploy**（默认会生成一个 hello world Worker 并部署成功）

### 第 2 步：贴入 worker.js 代码
6. 部署成功后会自动进到 Worker 详情页，点 **Edit code**（右上）
7. 全选在线编辑器里的默认代码，**全部删掉**
8. 打开本机的 `worker.js`（我给你的），**全选复制**，粘进在线编辑器
9. 右上点 **Deploy**（或 Save and Deploy）——Worker 现在就是我们的逻辑了

### 第 3 步：绑定 D1 数据库
10. 回到 Worker 详情页，点上方 **Settings**（齿轮）
11. 左侧点 **Bindings**（绑定）
12. 点 **Add binding** → 选 **D1 database**
13. **Variable name** 填 **`DB`**（必须，Worker 里用 `env.DB`）
14. **Select D1 database** → 选 **`owkv-events`**
15. 点 **Save**

### 第 4 步：注入 Turnstile Secret（不进前端、只进后端）
16. 仍在 Settings → 左侧点 **Variables**（变量）
17. 往下找 **Environmental variables / Secrets** 区
18. 加一个 **Secret**：Name 填 **`TURNSTILE_SECRET`**，Value 填你的 **secret key**：`(你的Turnstile-Server-secret，控制台查看，勿入库)`
19. 点 **Save / Deploy**（生效）

### 第 5 步：拿 Worker 域名
20. 回到 Worker 详情 → 顶部 URL 区，会显示 **`https://owkv-enroll.<你的子域>.workers.dev`**（记下这个地址，表单前端要 POST 到它）

### 第 6 步：测试
21. 先别上线前端。用 curl 或浏览器 POST 一个测试数据到该 Worker URL，确认返回 `ok:true`、D1 里 events_raw 多了一行（可到 D1 → owkv-events → Console 查 `SELECT * FROM events_raw;`）

---

## 方式二：本地 wrangler CLI（可选，需写 token 或本地登录）

> 适合你熟悉命令行、且愿意在**自己机器**上部署（不用给 token 我）。wrangler 已在本 VPS 装好，但你用方式一更省事。

```bash
cd /root/.openclaw/workspace/cf-owkv-deploy
# 登录(会要求浏览器验证,你机器上跑)
wrangler login
# 部署
wrangler deploy
# 注入 secret(交互式输入,不落文件)
wrangler secret put TURNSTILE_SECRET
```

---

## 关键注意（别踩坑）

| 事项 | 说明 |
|---|---|
| **Secret 不进前端** | TURNSTILE_SECRET 只放后端 Secret（第 18 步）。前端 join.html 只放 **sitekey**（`0x4AAAAAAEfHyydWm8nvQ_zJ`）渲染验证码 |
| **两个 key 别混** | sitekey=`0x4AAAAAAEfHyydWm8nvQ_zJ`（前端用）；secret=`(你的Turnstile-Server-secret，控制台查看，勿入库)`（后端用） |
| **D1 先建表** | 部署前先把 `schema.sql` 在 D1 Console 里跑一遍（见下方"初始化表结构"），否则 Worker 写 events_raw 会报表不存在 |
| **CORS** | worker.js 已带 `Access-Control-Allow-Origin:*`，前端跨域 POST 没问题 |
| **绑定要 Save 后重新 Deploy** | 改绑定/变量后点 Save 并重新部署一次才生效 |

---

## 初始化 D1 表结构（第 0 步，必做）

1. 左侧栏 **D1** → 点 **`owkv-events`** 数据库
2. 点 **Console**（控制台）
3. 打开本机 `schema.sql`，把全部内容粘进去，回车执行（表带 IF NOT EXISTS，可重复执行）
4. 验证：跑 `SELECT name FROM sqlite_master WHERE type='table';` 应看到 events_raw / contributors / ledger / tasks（+ 视图 v_dashboard）

---

## 全程依赖清单（你已就绪的部分）

| 项 | 值 | 状态 |
|---|---|---|
| CF 账号 | Ava0630ava@gmail.com's Account | ✅ |
| D1 库 | owkv-events（id=b091221b…） | ✅ 待建表 |
| Turnstile sitekey | 0x4AAAAAAEfHyydWm8nvQ_zJ | ✅ |
| Turnstile secret | (你的Turnstile-Server-secret，控制台查看，勿入库) | ✅ |
| Worker | 建一个（owkv-enroll） | ⬜ 你待做 |
| 表结构 | schema.sql | ⬜ 你待建 |

---

## 下一步（等你部署完成后告诉我）

- 你说"部署好了 / Worker URL 给我" → 我把 **join.html 改成站内注册表单**（Turnstile 渲染 + POST 到你的 Worker URL + 邀请码/蜜罐），并把《贡献力数据规范》注入源同步加"站内表单(CF)"，然后走「周导出快照 → GitHub → points.html」链路。
- join.html 表单版现在可以先做（不需要等 Worker 部署完，只是表单的 POST 地址先留占位，你给 URL 后我填上）。**要我先做吗？**
---

## 2026-09-09 认证版部署（含 OTP 免密码登录）

**已部署**（新账户 join.openwkv.xyz，Version 53cfc547）：
- worker.js 升级为含 `/api/auth/send-otp` + `/api/auth/verify-otp` + `/api/user/me` 的认证版
- schema.sql 新增三表：`email_tokens` / `global_daily_limits` / `pending_contributors`（部署时 ensureSchema 自动建）
- 用 wrangler CLI 部署成功（非控制台）

**新增环境变量（secret）待配置**：
| 变量 | 用途 | 状态 |
|---|---|---|
| `TURNSTILE_SECRET` | Turnstile 服务端密钥 | ✅ 已有 |
| `RESEND_API_KEY` | Resend 邮件 API key（发 OTP 邮件） | ⬜ 待设 |
| `JWT_SECRET` | JWT 签名密钥（HS256，≥32字符） | ⬜ 待设 |

注入命令（wrangler CLI，交互式输入值）：
```bash
cd /root/.openclaw/workspace/cf-owkv-deploy
export CLOUDFLARE_API_TOKEN='<token>'
export CLOUDFLARE_ACCOUNT_ID='<accid>'
/usr/bin/wrangler secret put RESEND_API_KEY
/usr/bin/wrangler secret put JWT_SECRET
```

**⚠️ bashrc 读取注意**：`grep -oP 'export CLOUDFLARE_ACCOUNT_ID=\K.*' /root/.bashrc | tr -d '"'`（bashrc 的值带引号，需 tr 去掉，否则 wrangler 报 Invalid account ID）

**send-otp 端点实测**：OPTIONS→204、未知GET→404、缺Turnstile→400 missing_turnstile，路由正常。

## 2026-09-12 提案通道（/api/proposals → GitHub Issue）

**已跑通**（Worker `owkv-enroll`，本地 wrangler.toml + secret 部署）：
- 站内提案表单 `proposals.html` → POST /api/proposals → 自动开 GitHub Issue（带 `proposal` 标签）+ events_raw 留痕
- GitHub 仓库：`OpenWuKongVerse/openwukongverse-docs`（私有，组织 API 名大写 V）；GH_TOKEN 需 **repo scope**（非仅 issues:write）
- 实测成功：Issue #2 自动落地，标签 `proposal` ✓

**⚠️ 核心坑（本次实锤，别再猜）**：GitHub API **强制要求 `User-Agent` 头**，缺了返回 403 `Request forbidden by administrative rules`。Cloudflare Worker 出站 fetch **不像 curl 自动带 UA**，必须显式设置。
- 症状：每次提交 502「提交到提案库失败」+ tail 日志 `JSON 解析失败 "Request fo..."`（GitHub 返回纯文本 403 非 JSON）
- 排查弯路：一度误判为 GH_TOKEN 权限不足／Turnstile 失败，实际根因就是缺 UA 头
- 修复：GitHub fetch headers 加 `'User-Agent': 'owkv-hub-worker/1.0 (openwkv.xyz)'`
- **诊断技巧**：GitHub 失败先 `r.clone().text()` 读原文 + 记 `r.status`，再尝试 json——能直接看到真实状态码/原文，避免被 JSON 解析错误信息误导（现 worker.js 已内置）
- **前端文案「提交到提案库失败」= 后端 502 github_create_failed / github_network_failed**；「人机验证未通过」= 400 turnstile_failed（两码可区分）

**部署纪律**：本地 wrangler.toml 的 `[vars]`（GH_REPO/GH_PROPOSAL_LABEL）+ `wrangler secret`（GH_TOKEN/JWT_SECRET/RESEND_API_KEY/TURNSTILE_SECRET，不入文件）。`wrangler deploy` 不删远程 secrets（已实测 4 个 secret 部署后仍在）。

## 2026-09-14 创作者审批闭环（/api/creators/apply + /api/creators/review）

**已部署**（Worker `owkv-enroll`，Version `5293899a-e6f9-4b17-943b-715b543b0f18`）：
- 新增 `POST /api/creators/apply` — 观察者提交创作者申请（JWT 校验 + 已创/已提拦截 + 驳回冷却硬校验 + 推 Discord Webhook）
- 新增 `GET /api/creators/review` — 架构师点 Discord 签名链接（HMAC 验签）→ 写 D1 → 发审批通知邮件 → 极简结果页
- schema 增量：`schema-creator-approval.sql`（`contributors` 加 7 列：`email_plaintext` / `creator` / `creator_apply` / `apply_at` / `reviewed_at` / `next_apply_at` / `apply_note`）
- 内部通知通道（方案B）：`verify-otp` 建/更新用户时写入 `email_plaintext`（仅后端发信用，不下发前端、不进公开账本）

**新增环境变量（只在 CF 后台配置，值绝不入库、不入前端）**：

| 变量 | 类型 | 用途 |
|---|---|---|
| `REVIEW_SIG_SECRET` | Secret | 审批链接 HMAC-SHA256 签名密钥（≥32 字符），防伪造审批 |
| `CREATOR_REVIEW_WEBHOOK_URL` | Secret | Discord 审核频道 Webhook URL，接收「申请待审批」Embed |
| `REVIEW_COOLDOWN_MS` | Text（可选） | 驳回后冷却时长（毫秒），默认 `86400000` = 24h |

**schema 增量执行**（一次性；SQLite/D1 无 `ADD COLUMN IF NOT EXISTS`，重复执行报 duplicate column 可忽略）：
```bash
wrangler d1 execute owkv-events --remote --file=schema-creator-approval.sql
```

**⚠️ Discord Webhook 同样需 `User-Agent` 头**（与 GitHub 同坑）：worker.js 推 Webhook 时已显式带 `User-Agent`，否则可能被拒。

