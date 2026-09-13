# OWKV · 观察者→创作者 双身份流转 · 后端接口契约

> 目的：让前端「观察者可申请成为创作者、待首席架构师手动审批、通过后升级为观察者+创作者」的逻辑落地。
> 状态：**前端已实现**（apply.html / join.html / auth.js / personal.html）；本文档供后端（join.openwkv.xyz 的 CF Worker）对接实现，字段与语义以本文为准。

---

## 1. 身份状态模型（user 对象）

`/api/user/me` 返回的 `user` 对象在现有字段基础上**新增**四个字段，前端据此渲染四种登录态。

```jsonc
// user 对象（me 响应中的字段）
{
  "id": "u_xxx",
  "anon_code": "悟空001",
  "email_masked": "wu**@**.com",
  "status": "observer",            // 保留：observer | creator（兼容旧逻辑）
  "role_tag": "",                  // 保留
  "mode_tag": "",                  // 保留
  // ↓↓↓ 新增（双身份 + 申请状态）↓↓↓
  "creator": false,                // true = 已获创作者权限（架构师审批通过）
  "creator_apply": "none",         // none | pending | approved | rejected
  "apply_note": "",                // 架构师审批意见（rejected 时一定有；approved 可空）
  "apply_at": "",                  // 申请提交时间 ISO 字符串
  "reviewed_at": ""                // 审批时间 ISO 字符串
}
```

### 前端按 `creator` + `creator_apply` 判定四种登录态

| creator | creator_apply | 语义 | 前端表现 |
|---|---|---|---|
| false | `none` | 纯观察者 | join 页显示「申请成为创作者」按钮；personal 页锁定提案表单（可申请） |
| false | `pending` | 申请审核中 | join 页显示「申请审核中 ⏳」禁按钮；personal 页锁定提案表单（提示审批中） |
| false | `rejected` | 申请被驳回 | join 页显示「重新申请」；personal 页锁定（附驳回意见），可重申请 |
| true  | `approved` | **观察者+创作者** | 导航 chip 变「观察者+创作者」；join 页显示「进入个人创作中心」；personal 页解锁提案表单 |

> 兼容规则：`creator === true` 时 `creator_apply` 应恒为 `approved`（二者一致）。后端写入时保证这一不变量。

---

## 2. 新增接口

### 2.1 `POST /api/creators/apply` — 观察者提交创作者申请

**鉴权**：`Authorization: Bearer <JWT>`（必须是已登录观察者）。

**请求体**：

```jsonc
{
  "intent": "想参与 A 支线缝合，补完被逐期间的细节…",   // 必填（创作意向）
  "portfolio": "https://…",                          // 选填（代表作品/样本链接或简述）
  "mode_tag": "A",                                    // 选填（主攻模态 A/B/C/cross）
  "track": "sandbox",                                 // 选填（目标轨道 sandbox|canon）
  "hp": "",                                           // 蜜罐（空字符串）
  "cf-turnstile-response": "0.xxx"                    // Turnstile token，必填
}
```

**成功响应** `200`：

```jsonc
{ "ok": true, "user": { /* 刷新后的完整 user（creator_apply=pending）*/ } }
```

**失败响应** `4xx`（`error` 字段取值，前端已预置文案）：

| error | 含义 |
|---|---|
| `unauthorized` / `invalid_token` | 登录失效 |
| `not_observer` | 当前身份不是观察者（如已是创作者） |
| `already_pending` | 已有申请在审批中，禁止重复提交 |
| `already_creator` | 已是创作者，无需再申请 |
| `missing_turnstile` / `turnstile_failed` | 人机验证问题 |
| `missing_intent` | 未填创作意向 |
| `apply_disabled` | 申请通道维护中 |

**后端动作**：校验 → 写入 `creator_apply=pending`、`apply_at=now` → **通知首席架构师**（走现有 Discord/邮件渠道）→ 返回最新 user。

### 2.2 `POST /api/creators/review` — 首席架构师审批（后端/管理侧）

**鉴权**：必须是**首席架构师**身份（token 内含架构师角色，或独立的管理 token；实现细节后端自定，前端不调用此接口）。

**请求体**：

```jsonc
{
  "target_user_id": "u_xxx",   // 被审批的观察者
  "decision": "approve",       // approve | reject
  "note": "样本质量达标，同意。", // 必填于 reject；approve 可空
  "review_sig": "…"            // 架构师签名/操作凭据（后端自定）
}
```

**成功响应**：

```jsonc
{ "ok": true, "user": { /* approve: creator=true,creator_apply=approved,reviewed_at */ } }
```

**后端动作**：
- `approve`：置 `creator=true`、`creator_apply=approved`、`reviewed_at=now`（`apply_note` 可留架构师意见）。
- `reject`：置 `creator_apply=rejected`、`apply_note=note`、`reviewed_at=now`（`creator` 保持 false）。
- 通知申请人（邮件/Discord）。

---

## 3. 修改现有接口

### 3.1 `GET /api/user/me`

响应 `user` 补四个新字段（见第 1 节）。无其他改动。

### 3.2 `POST /api/proposals` — 提案提交加创作者门槛（硬校验）

**后端必须校验**：请求 token 对应的用户 `creator === true`（或 `creator_apply === approved`），否则拒绝并返回：

```jsonc
{ "ok": false, "error": "not_creator" }
```

> 前端 `personal.html` 已做同步拦截（体验层），但**后端须做硬校验**才是真正的权限边界。这是安全关键，不可只靠前端。

新增错误码（前端已预置文案）：

| error | 含义 |
|---|---|
| `not_creator` | 当前仅观察者，无提案权限 |

---

## 4. 前端已实现清单（对接参考）

| 文件 | 改动 |
|---|---|
| `apply.html`（新增） | 申请表单页：登录门槛 + 申请表单（intent/portfolio/mode/track）+ 状态展示（approved/pending/rejected），调 `POST /api/creators/apply`；**仅 approved/creator 引导「进入个人创作中心」** |
| `join.html` | 观察者驻地页：已登录区 `#joinLoggedIn` 按 `creator_apply` 分叉渲染（申请/审核中/进中心）+ **常驻「加入联盟平台」引导卡**（Discord/Reddit/Bluesky，站内不承接讨论投票）；调 `renderJli(usr)` |
| `assets/js/auth.js` | **导航按身份分叉**：未登录→「报名/Join」→join.html；观察者→「个人中心/Profile」→join.html；创作者→「创作中心/Center」→personal.html；抽屉加「创作申请」状态行（`refreshJoinNav` 三态） |
| `personal.html` | 创作者专属页：提案表单默认隐藏、仅创作者可见；**观察者直达访问显示门禁卡**（「创作中心是创作者专属页，请回报名页」+ 返回 join 按钮），不展示观察者内容 |

---

## 5. 待后端确认的开放问题

1. **架构师身份怎么判**：`/api/creators/review` 的鉴权方式（token 角色字段 vs 独立管理 token vs 外部签名）——后端定，前端不涉及。
2. **驳回后能否重申请**：本契约允许 `rejected → 再提交 → pending`（前端已支持「重新申请」）。若产品上要求驳回后需冷却期，加一个 `next_apply_at` 字段并在后端拦截，前端读它显示「可重申请时间」，需再补一个前端小改动。
3. **自动转正（路A，C1–C4 达标）**是否也走同一套 `creator=true` 字段：建议是——达标时后端直接置 `creator=true,creator_apply=approved,apply_note='C1-C4 auto-promotion'`，前端无需另改逻辑（已按 `creator=true` 判定创作者）。
