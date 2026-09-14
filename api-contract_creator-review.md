# OWKV · 创作者申请审批闭环 · 后端接口契约（Discord Webhook 路径）

> 目的：让「观察者提交创作者申请 → 首席架构师在 Discord 一键审批（核准/驳回）→ 申请人收到通知并可无缝以创作者身份进入创作中心提交提案」的闭环落地。
> 状态：**交互路径已定（方案甲-Lite：Discord Webhook + HMAC 签名链接）**；本文档供后端（join.openwkv.xyz 的 CF Worker）对接实现。
> 关联：申请提交侧契约见 `api-contract_creator-apply.md`；本文档只覆盖**审批与通知闭环**，字段与既有契约共用同一状态模型。

---

## 1. 链路总览

```
[观察者]            [CF Worker]                    [Discord 审核频道]          [申请人邮箱]
   |                     |                                |                        |
   |-- POST /api/creators/apply -->|                        |                        |
   |                     |-- 写 D1：creator_apply=pending   |                        |
   |                     |-- 推 Discord Embed（Webhook） -->|                        |
   |                     |                                 |-- 架构师点[核准/驳回]链接 |
   |                     |<-- GET /api/creators/review?sig --|                        |
   |                     |-- 校验 HMAC sig → 更新 D1        |                        |
   |                     |-- 发通知邮件 -------------------->----------------------->|
   |                     |                                                    |  审批通过：见邮件指引
   |<-- 重新登录/刷新：me 返回 creator=true ------------------------------------|
   |-- 导航变「创作中心」→ personal.html 提交提案 -->
```

---

## 2. 后端环境变量（不提交公开仓库）

| 环境变量 | 说明 |
|---|---|
| `CREATOR_REVIEW_WEBHOOK_URL` | Discord 频道 Webhook URL（架构师审核频道）。**只存在 CF 环境变量，不进公开仓库、不进前端** |
| `REVIEW_SIG_SECRET` | HMAC-SHA256 密钥，用于给审批链接签名、并校验审批请求真伪。**同样只存环境变量** |

> ⚠️ 两个值都是**秘密**。Webhook URL 即使泄漏也只影响「收到通知的频道」；签名密钥泄漏则任何人可伪造审批——**密钥绝对不可提交仓库、不可进前端 JS**。

---

## 3. Discord 通知（Embed 推送）

观察者提交申请成功后，CF Worker 向 `CREATOR_REVIEW_WEBHOOK_URL` 推一条 Embed：

```
# 创作者申请待审批
申请人代号： 悟空001（邮箱已脱敏 wu**@**.com）
申请时间：   2026-09-14T03:38:00Z
创作意向：   想参与 A 支线缝合，补完被逐期间的细节…
作品样本：   https://…（或「未附」）
主攻模态：   A
目标轨道：   sandbox

[ 🟢 核准申请 ]  [ 🔴 驳回申请 ]
```

- 两个「按钮」实为**链接**（Discord Webhook 的原生消息组件不支持，故用带签名的 URL），格式见第 4 节。
- 链接文字可含 emoji 便于区分；后端自行拼 HTML 或用富文本字段均可，Discord 会渲染成可点击链接。

---

## 4. 审批签名链接（HMAC）

架构师点击链接即进入审批（无需 Discord API、无需机器人、无需跳复杂后台——由 Discord Webhook 推送，点链接打开一个极简结果页）。

**链接格式**（GET，浏览器可直接打开）：

```
https://join.openwkv.xyz/api/creators/review
    ?user_id=<观察者用户ID>
    &decision=approve|reject
    &sig=<HMAC-SHA256 十六进制>
```

**HMAC 计算**（后端生成链接时）：

```
sig = hex( HMAC-SHA256( key = REVIEW_SIG_SECRET,
                        msg = "user_id=<id>&decision=<approve|reject>" ) )
```

- `msg` 只含 `user_id` 与 `decision` 两个参数（**不含 sig 本身**），防止签名自相包含。
- 校验时后端用同一密钥对收到的 `user_id&decision` 重新计算 HMAC，`timingSafeEqual` 比对，一致才放行。
- 每封审批消息的链接有效期内可用；是否设过期（如按 `apply_at` + N 小时）由后端定，建议加。

---

## 5. 审批接口 `GET /api/creators/review`

**不是登录态 API**（架构师通过签名链接访问，无需 JWT），鉴权靠 `sig`。

**请求**（Query）：

| 参数 | 必填 | 说明 |
|---|---|---|
| `user_id` | 是 | 被审批的观察者用户 ID |
| `decision` | 是 | `approve` 或 `reject` |
| `sig` | 是 | HMAC 签名，见第 4 节 |

**处理流程**：
1. **验签**：`sig` 不合法 → `401`，页面显示「审批链接无效或已过期」。
2. **查用户**：`user_id` 不存在，或当前 `creator_apply !== 'pending'`（已审过/已创）→ `409`，页面提示「该申请已处理或不存在」。
3. **写 D1**（与 `api-contract_creator-apply.md` 的 `POST /api/creators/review` 动作一致）：
   - `approve`：置 `creator=true`、`creator_apply=approved`、`reviewed_at=now`（`apply_note` 可留架构师寄语）。
   - `reject`：置 `creator_apply=rejected`、`reviewed_at=now`（`creator` 保持 false）。**驳回理由如何提交见下**。
4. **写冷却期**（防刷，驳回时）：置 `next_apply_at = now + REVIEW_COOLDOWN`（冷却时长后端配置，见第 8 节）。`approve` 时清空 `next_apply_at`。
5. **通知申请人**：发邮件（见第 6 节）。
6. **返回结果页**：一个极简 HTML 页「已核准 悟空001 的创作者权限，已发信通知」/「已驳回，申请人稍后可重新申请」。

**驳回理由（note）的输入**：签名链接是 `GET`，不便带长文本。两种后端做法（后端自选）：
- **只点在 Discord 里附带「驳回原因」占位**：驳回邮件里注明「架构师未附书面意见，请通过 Discord 讨论区了解原因」。
- **后续升级**（可选）：链接指向一个极简表单页，架构师在页面上填驳回意见后再 POST 提交（属于后端自定页，非契约硬性要求）。

> 推荐：**首版驳回可先不带意见**（邮件引导回 Discord），保持「一键审批」零负担；意见字段 (`apply_note`) 契约里保留，等升级版表单页接入。

---

## 6. 通知申请人（邮件）

后端在审批动作后，通过现有邮件渠道（与 OTP 验证邮件同一 provider）向 `user.email` 发通知。

**核准邮件（示意）**：

```
主题：【OpenWuKongVerse】恭喜！你的创作者身份已核准通过
你的创作者申请已被首席架构师核准。身份已升级为「观察者 + 创作者」。

下一步：
1. 登录 openwkv.xyz（已登录则强刷一次页面）
2. 顶部导航已由「个人中心」变为「创作中心」
3. 进入创作中心（personal.html）即可在站内直接提交提案

—— OpenWuKongVerse 评审团
```

**驳回邮件（示意）**：

```
主题：【OpenWuKongVerse】你的创作者申请暂未通过
你的申请本次未通过核准。你仍保持观察者身份。

参考意见：<apply_note 或留空>
你的申请支持修改后重新提交；驳回后需等待冷却期（<冷却时长>）方可再次申请。
也可通过积累 C1–C4 积分自动转正（路A）。

—— OpenWuKongVerse 评审团
```

---

## 7. 状态模型扩展（并入既有 `user` 对象）

在 `api-contract_creator-apply.md` 第 1 节现有四个新字段基础上，增加一个：

```jsonc
"creator_apply": "pending",   // none | pending | approved | rejected（既有）
"next_apply_at": "",          // 新增：驳回后允许再次申请的冷却截止时间 ISO 字符串
                              //       approve/pending/none 时为空字符串
```

**前端读 `next_apply_at` 的语义**（需小改前端，见下）：
- `creator_apply === 'rejected'` 且当前时间 **早于** `next_apply_at` → 显示「驳回后可再次申请，冷却至 <时间>」，`/apply` 按钮**禁用**（或点击被后端拒绝）。
- 当前时间 ≥ `next_apply_at` → 恢复「重新申请」按钮可用。

**后端防线（不可只靠前端）**：`POST /api/creators/apply` 必须硬校验——若 `next_apply_at` 存在且未到，拒绝并返回冷却中错误（见下新增错误码）。前端禁用仅体验层，后端拦截才是权限边界。

---

## 8. 待后端确认的开放问题

1. **冷却时长（`REVIEW_COOLDOWN`）设多久**：建议首次 `7 天`（防止驳回后立刻重刷），后端用一个环境变量即可随时调。
2. **驳回是否必须附意见**：首版契约允许不带（引导回 Discord），如产品要求「驳回必带意见」则需第 5 节升级版表单页，另行确认。
3. **审批链接是否设过期**：建议按 `apply_at` 起 24h 内有效，防链接残留被滥用。
4. **重复点击**：同一 `sig` 链接反复提交——后端应幂等（已处理则直接显示结果，不再重复发邮件；`creator_apply !== 'pending'` 即视为已处理）。

> 注：`POST /api/creators/review`（登录态管理接口）仍保留在 `api-contract_creator-apply.md` 第 2.2 节，作为可能的架构师管理侧入口；本条 Webhook 签名链接路径是其一键化落地。二者共享同一审批写库逻辑。

---

## 9. 前端联动（冷期提示小改动）

| 文件 | 改动 |
|---|---|
| `join.html` | `rejected` 分叉文案读取 `next_apply_at`：冷却中显示「可重申请时间」，冷却结束恢复「重新申请」按钮 |
| `apply.html` | 若后端返回 `cooling` 错误（见下），展示冷却提示而非法表单错误 |
| `assets/js/auth.js` | 抽屉「创作申请」状态行在 `rejected` 且冷却中时，附加「冷却至 <时间>」 |

**新增错误码**（前端应预置文案）：

| error | 含义 |
|---|---|
| `apply_cooling` | 驳回后仍在冷却期，禁止重复申请（含 `next_apply_at`） |

**后端动作补充**：`POST /api/creators/apply` 校验通过后，写入 `creator_apply=pending`、`apply_at=now`，**同时清空** `next_apply_at`（新一轮申请重置冷却）。
