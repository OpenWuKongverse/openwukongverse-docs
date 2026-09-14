# OWKV · 提案审批与分流 · 后端接口契约

> 目的：让「创作者站内提交提案 → 自动开 GitHub Issue + 推 Discord 评议区 → 首席架构师一键核准（正典/沙盒）/驳回 → HUB 站活跃提案看板外导评议与投票」的闭环落地。
> 状态：**交互路径已定（Discord Webhook + HMAC 两步式签名链接 + 外导评议投票）**；本文档供后端（join.openwkv.xyz 的 CF Worker）对接实现。
> 关联：创作者身份审批见 `api-contract_creator-review.md`（同一套 HMAC 签名 + 两步式模型，本文档复用其机制）；提案提交现有实现在 `cf-owkv-deploy/worker.js` 的 `handleSubmitProposal`。
> 术语一律用正典既有词（核准 / 正典 / 沙盒 / 评议 / 介入缝 / 模态 / 三层红线），不自造词。

---

## 1. 链路总览

```
[创作者]                [CF Worker]                  [GitHub]            [Discord 评议区]        [外部平台]
   |                        |                            |                      |                    |
   |-- POST /api/proposals ->|                            |                      |                    |
   |                        |-- 开 Issue(标签 proposal) ->|                      |                    |
   |                        |-- 写 D1 proposals 表        |                      |                    |
   |                        |-- 推 Discord Embed(含签名审批链接) ---------------->|                    |
   |                        |                            |                      |                    |
   |                        |<-- 架构师点链接: GET 确认页 -> POST 执行 -----------|                    |
   |                        |-- 写 D1 状态(approved_canon/sandbox/rejected)       |                    |
   |                        |-- GitHub API: 贴标签 status/* + 关闭 Issue -------->|                    |
   |                        |-- 发通知邮件给提案者         |                      |                    |
   |                        |                            |                      |                    |
[观察者/游客]                 |                            |                      |                    |
   |-- GET /api/proposals -->|                            |                      |                    |
   |   (看板: 列表+外导链接)  |                            |                      |                    |
   |-- 点「去评议」------------------------------------------------------------------>| (Discord)          |
   |-- 点「去投票」-------------------------------------------------------------------------------->| (Reddit)|
```

---

## 2. 新增数据表 `proposals`（D1）

独立 DDL 文件 `schema-proposals.sql`（不改原 `schema.sql` 表定义）。

```sql
CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES contributors(id),   -- 提案者（登录贡献者 id）
  anon_code TEXT,                                -- 署名代号（冗余便于展示，避免每次 JOIN）
  title TEXT NOT NULL,                           -- 提案标题
  category TEXT,                                 -- 脑洞 | 剧情 | 角色 | 设定延伸 | 模态延伸
  seam_id TEXT,                                  -- 介入缝编号（可空=待定）
  node TEXT,                                     -- 所属节点（可空=待定）
  mode_tag TEXT,                                 -- 适用模态 A/B/C/cross
  track TEXT DEFAULT 'sandbox',                  -- 目标轨道 canon | sandbox
  content TEXT,                                  -- 提案正文
  github_issue_number INTEGER,                   -- 对应 GitHub Issue 编号
  github_issue_url TEXT,                         -- Issue 链接（供看板外导）
  status TEXT DEFAULT 'pending',                 -- pending | approved_canon | approved_sandbox | rejected
  -- 外导链接（评议/投票；由架构师或社区运营手动回填，可空）
  discord_thread_url TEXT,                       -- 关联 Discord 讨论贴
  reddit_poll_url TEXT,                          -- 关联 Reddit 投票贴
  apply_note TEXT,                               -- 审批意见/驳回理由
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
```

**状态机**：`pending` ──核准──> `approved_canon` / `approved_sandbox`；`pending` ──驳回──> `rejected`。写库保证不变量：`status='approved_canon'` 时轨道必为 `canon`。

---

## 3. 后端环境变量（不提交公开仓库）

| 环境变量 | 说明 |
|---|---|
| `PROPOSAL_REVIEW_WEBHOOK_URL` | 提案评议频道 Discord Webhook URL。**只存在 CF 环境变量，不进仓库、不进前端** |
| `PROPOSAL_SIG_SECRET` | 提案审批链接 HMAC-SHA256 密钥（≥32 字符）。**秘密，绝不入库** |
| `REVIEW_COOLDOWN_MS` | 复用（本流程不涉冷却，冲突时可忽略）|
| `GH_TOKEN` / `GH_REPO` / `GH_PROPOSAL_LABEL` | 复用现有（提案 Issue 开通与后续打标/关闭）|

> 是否新建独立 Webhook/密钥、还是**复用** `CREATOR_REVIEW_WEBHOOK_URL` / `REVIEW_SIG_SECRET`，见第 8 节开放问题（推荐新建独立，隔离审计与泄密面）。

---

## 4. Discord 通知（Embed 推送）

`POST /api/proposals` 成功后，向 `PROPOSAL_REVIEW_WEBHOOK_URL` 推一条 Embed：

```
# 新共创提案待评审
提案标题：  <title>
提案者：    悟空003
内容分类：  剧情
目标轨道：  沙盒轨道
介入缝：    A12（或「待定」）
GitHub Issue：  #12

[ 🟢 核准入正典 ]  [ 🔵 核准入沙盒 ]  [ 🔴 驳回 ]
[ 查看提案全文 ]（链接到 GitHub Issue）
```

- 三个「按钮」实为**带 HMAC 签名的链接**（Discord Webhook 原生组件不支持按钮，故用签名 URL）。
- **链接必须用 `<...>` 包裹**，抑制 Discord 抓取链接预览（否则抓取会触发副作用——创作者审批流程已踩此坑）。
- 推送需带 `User-Agent` 头（Cloudflare 出站 fetch 不自动带 UA）。

---

## 5. 审批接口 `GET/POST /api/proposals/review`

**不是登录态 API**（架构师经签名链接访问，无需 JWT），鉴权靠 `sig`。**两步式**（与创作者审批同一模型）：

### `GET`（只渲染确认页，零副作用）
- 验签不合法 → `401`「审批链接无效或已过期」。
- 提案不存在 → `404`；状态 `!== 'pending'` → `409`「该提案已处理」。
- 否则渲染确认页：显示提案标题 + 提案者 + 「确认核准入正典 / 确认核准入沙盒 / 确认驳回」按钮。**不写库、不开/关 Issue、不发信**。

### `POST`（执行）
Query/表单参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| `proposal_id` | 是 | 提案 id |
| `decision` | 是 | `canon` \| `sandbox` \| `reject` |
| `sig` | 是 | HMAC：`hex(HMAC-SHA256(PROPOSAL_SIG_SECRET, "proposal_id=<id>&decision=<canon|sandbox|reject>"))` |

**处理流程**：
1. 验签（`timingSafeEqual`）→ 查提案。
2. **原子条件更新**：`UPDATE proposals SET status=?, reviewed_at=? WHERE id=? AND status='pending'`，校验 `meta.changes===1`（并发/重复提交只生效一次）。
   - `canon`：`status='approved_canon'`。
   - `sandbox`：`status='approved_sandbox'`。
   - `reject`：`status='rejected'`。
3. **GitHub 协同**（调用 GitHub API，需 `GH_TOKEN`）：
   - 加标签 `status/approved-canon` 或 `status/approved-sandbox` 或 `status/rejected`。
   - `canon`/`sandbox` → 关闭 Issue（`state=closed`，`state_reason=completed`）；`reject` → 关闭 Issue（`state_reason=not_planned`）。
   - 失败不阻塞结果页（记日志，返回结果页注明「Issue 状态更新待补」）。
4. **通知提案者**：邮件（复用 `contributors.email_plaintext` 内部通道，见创作者审批契约第 6 节邮件模型）。
5. **返回结果页**：极简 HTML「已核准入正典 / 已核准入沙盒 / 已驳回」。

> **副作用防护三层**（同创作者审批）：① GET 无副作用（抓取无害）；② POST 原子条件更新；③ Discord 链接用 `<...>` 抑制预览。

---

## 6. 公共接口 `GET /api/proposals`（活跃提案看板）

**无需登录**（游客可看）。供前端看板展示。

**请求**（Query，可选）：

| 参数 | 说明 |
|---|---|
| `status` | 过滤：`pending`（默认，评议中）/ `approved_canon` / `approved_sandbox` / `rejected` / `all` |
| `limit` | 条数上限（默认 20，上限 100）|

**响应**：
```jsonc
{
  "ok": true,
  "proposals": [
    {
      "id": 12,
      "title": "…",
      "anon_code": "悟空003",
      "category": "剧情",
      "track": "sandbox",
      "status": "pending",
      "github_issue_url": "https://github.com/…/issues/12",
      "discord_thread_url": "",      // 空则前端只给 GitHub 留痕链接
      "reddit_poll_url": "",         // 空则前端不显示「去投票」
      "created_at": "2026-09-14T…"
    }
  ]
}
```

**隐私边界**：**不返回** `content`（提案全文留在 GitHub Issue 留痕，站内不复制正文）与任何加密字段。

---

## 7. 前端展示策略（Gallery 纯净度原则）

| 页面 | 展示 |
|---|---|
| `gallery.html`（共创展示） | **只展示已核准的正典/沙盒作品**（橱窗）。待审提案一律不在此出现 |
| `personal.html` / `proposals.html` | 新增「社区活跃提案看板」：读 `GET /api/proposals`，按 **评议中 💬 / 投票中 🗳️ / 已归档** 分类列表；交互**一律外导**（去 Discord 评议 / 去 Reddit 投票 / 查看 GitHub 留痕），站内不建评论、不建投票 |

**设计理由**：① 游客访问看到的永远是高质量已核准内容，保持正典纯净度；② 站内不建评论/投票设施，复用 Discord/Reddit 现成高可用设施，后端零负担；③ Hub 作入口把流量漏斗式导向联盟平台。

**新增错误码**（前端应预置文案）：

| error | 含义 |
|---|---|
| `proposal_disabled` | 提案通道未就绪（缺 GitHub 配置）|
| `github_create_failed` / `github_network_failed` | 开 Issue 失败（已存在）|
| `missing_red_lines` | 未勾选前两层红线自检（已存在）|
| `already_reviewed` | 该提案已处理（审批并发/重复）|

---

## 8. 待确认的开放问题

1. **Webhook / 密钥是否独立**：新建 `PROPOSAL_REVIEW_WEBHOOK_URL` + `PROPOSAL_SIG_SECRET`（推荐，隔离泄密面与审计），还是复用创作者审批的两个变量？
2. **Discord 评议贴的创建方式**：Webhook 只能发消息，不能建 thread。是否要（a）人工在 Discord 开贴后手动回填 `discord_thread_url`，还是（b）后续接 Discord Bot API 自动建 thread？
3. **Reddit 投票贴**：由谁创建、何时创建（核准后统一发？还是评议达标后发？）——`reddit_poll_url` 的写入者与时机需定。
4. **驳回是否需附意见**：首版确认页只做二值确认（无备注输入）；如要求「驳回必带意见」，需把确认页升级为带备注输入框的极简表单。
5. **`GET /api/proposals` 是否需要防刷/缓存**：公开接口，建议加 D1 查询上限 + 短时缓存（CF cache），避免高频拉取。
6. **提案者改动**：`POST /api/proposals` 现有实现只写 `events_raw`（不落 `proposals` 表）——本契约要求**新增写 `proposals` 表**（含 `github_issue_number`），见第 9 节。

---

## 9. 对现有代码的改动清单（供后端实现）

| 文件/端点 | 改动 |
|---|---|
| `worker.js` `handleSubmitProposal` | 开 Issue 成功后**新增**：写 `proposals` 表一行（title/category/seam_id/node/mode_tag/track/content/issue_number/issue_url/user_id/anon_code/status=pending）+ 推 Discord Webhook（含签名审批链接） |
| `worker.js` 路由 | 新增 `GET/POST /api/proposals/review`（两步式审批）；新增 `GET /api/proposals`（看板） |
| `worker.js` 新函数 | `handleProposalReview`（GET 确认页 / POST 原子更新 + GitHub 打标关闭 + 发信）、`reviewProposalConfirmPage`、`handleListProposals`、`notifyProposalDiscord` |
| `schema-proposals.sql` | **新增**（第 2 节 DDL） |
| `DEPLOY-STEPS.md` | 补新环境变量说明（仅名字+用途，不写值）|
| 前端 `personal.html` / `proposals.html` | 新增「活跃提案看板」组件（外导）|
| 契约 `api-contract_proposal-review.md` | **本文档** |
