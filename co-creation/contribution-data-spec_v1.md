# OpenWuKongVerse 文档集 · 《贡献力数据规范》v1

> 文档代号：`OWKV-DATA-SPEC-v1`
> 层级：**机制/运营层**（承接共创者管理体系的数据契约层）
> 性质：把「注册 → 建档 → 事件注入 → 统一记账 → 贡献力计算(+任务匹配) → 公示」这条链的**数据结构与计分口径**定为契约，供后续数据库建库（私有中枢 202.61.255.243）与门面站积分看板喂数引用。本文只有规范，不落地实现。
> 版本：v1.0
> 状态：**数据契约（已批）**，落地实现待私有 DB 建库阶段
> 关联：`creator-management-system_v1.md`（运营流程）/ `proposal-template_v1.md`（提案工具）/ `intervention-index_v1.md`（介入缝）/ 卷3 共创协议（机制层 / C1–C4 / 防刷）
> 编者：Echo-Architect-0
> 日期：2026-08-28

---

## 0. 定位与原则

- **私库算账，公开只展示**：积分计算只发生在私有中枢（202.61.255.243），公开门面站零 DB 暴露。
- **单事实源**：所有注入统一进 `events_raw` → ETL 进账本 → 聚合 → 导出只读快照进 GitHub 留痕。
- **匿名优先**：公开只出匿名代号 + 积分，不出邮箱/身份；原始载荷不出公仓。
- **链条到「公示」为止**：分润（D4）不在本规范内（挂起，见运营体系决策记录）。

---

## 1. 信息注入源（已修订，符合 D2 三入口）

| 入口 | 自动/半自动 | 注入方式 | 事件类型示例 |
|---|---|---|---|
| **Hub站邮件**（主，站内双层） | 半自动 | 报名邮箱站内公布 + Discord/主页二次确认发放 → 人工转录/导入 `events_raw` | join / submit_proposal / review |
| **GitHub** | 自动友好 | Repo Issue（报名）+ PR（提案/翻译入库）→ 可 webhook 自动进 `events_raw` | join / submit_proposal / merge / translation |
| **Discord** | 半自动 | 报名频道人工核对 + Bot 抓取评议/提案讨论 → 导入 `events_raw` | join / review / discuss |
| **微信 / 小红书** | **不注入** | 仅人工引导展位，**不入数据流**（个人版微信无表单开口/无数据 API） | —（展示/触达） |

> **注入红线**：所有入口最终统一落 `events_raw` 一张表（唯一写入点），由 ETL 清洗归类；**人工只是兜底**（自动抓取失败才手工填通用 CSV 导入），不是每单都手工记。

---

## 2. 维度积分 C1–C4：单次计分规则（数据契约，B1 简单计数起步）

权重基线（已定）：C1 30% / C2 30% / C3 20% / C4 20%。

| 维度 | 含义 | 触发事件 | 单次计分（建议 B1） | 复核方 |
|---|---|---|---|---|
| **C1 创作量** | 入正典内容量 / 有效提案数 | 提案提交 / 入正典 | 有效提案=1 分；入正典=再 +3 分 | 架构师审查 |
| **C2 质量分** | 社区评议加权 | 每获一条有效评议 | 有效评议=1 分；提案获采纳时附评议均分×0.5 | 评审团加权（观察者+评审团） |
| **C3 采用率** | 采纳/入正典的比例 | 提案被采纳 | 采纳 1 案 = 按案计分（独立档，非按次重复） | 架构师审查 |
| **C4 生态贡献** | 评审/翻译/运维/社群 | 评审 1 案 / 翻译 1 篇 / 运维按周 | 评审 1 案=1 分；翻译 1 篇=2 分；运维按周=基准分 | 评审团 |

> **口径说明**：
> - 所有单次计分**须经 `approved_by` 复核后才写 `ledger`**（对齐卷3 4.2 防刷聚类），未复核不计分。
> - C3 采用率是**比率维度**，最终按"采纳率归一化"参与加权，单次计分记录的是"采纳事件"，归一化在聚合视图完成。
> - 数值档位为 **B1 起步基线**，后续可平滑升级 B2（体量×质量系数）/ B3（全自动公式），只改计分函数不改表结构。

---

## 3. 表结构契约（SQLite 起步，4 表 + 1 视图）

### 3.1 `events_raw` — 入口统一原始事件表（唯一写入点）

```sql
CREATE TABLE events_raw (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,          -- email / github / discord / manual
  event_type TEXT NOT NULL,        -- join / submit_proposal / review / merge / translation / ops
  contributor_key TEXT NOT NULL,   -- 匿名代号（跨平台统一识别键）
  payload TEXT,                    -- 原始载荷 JSON（平台原生，不动）
  ts TEXT DEFAULT (datetime('now'))
);
```

### 3.2 `contributors` — 贡献者账户（建档）

```sql
CREATE TABLE contributors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anon_code TEXT UNIQUE NOT NULL,  -- 匿名代号（公开身份，唯一）
  email_hash TEXT UNIQUE,          -- 邮箱哈希（稳定标识，不存明文）
  role_tag TEXT,                   -- 主攻角色：artist / writer / player / programmer / community
  mode_tag TEXT,                   -- 主攻模态：A / B / C
  join_ts TEXT,
  status TEXT DEFAULT 'observer'   -- observer → contributor → reviewer（卷3 4.3 晋升）
);
```

### 3.3 `ledger` — 积分流水（一条贡献一行，算分唯一依据）

```sql
CREATE TABLE ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contributor_id INTEGER REFERENCES contributors(id),
  dim TEXT NOT NULL,               -- C1 / C2 / C3 / C4
  points REAL NOT NULL,            -- 单次计分（按 §2 规则）
  source_event INTEGER REFERENCES events_raw(id),  -- 可倒查来源（对账关键）
  approved_by TEXT,                -- 评审团/架构师确认（防刷）
  ts TEXT DEFAULT (datetime('now'))
);
```

### 3.4 `tasks` — 介入缝任务表（轻量任务推荐）

```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seam_id TEXT NOT NULL,           -- 介入缝编号（A12 / B3 / C7…，对应介入索引）
  mode_tag TEXT,                   -- 适用模态
  role_tag TEXT,                   -- 适合角色
  status TEXT DEFAULT 'open',      -- open / claimed / done
  assignee_id INTEGER,             -- 认领人 = 贡献者（认领即登记）
  claimed_at TEXT
);
```

> 任务推荐 = **事件↔维度自动归类 + 轻量任务表**（按 role/mode 匹配待认领缝）；人岗撮合（二期）在此基础上扩展算法。

### 3.5 `v_dashboard` — 聚合视图（公示喂数）

```sql
CREATE VIEW v_dashboard AS
SELECT c.anon_code, c.role_tag, c.mode_tag, c.status,
       SUM(CASE WHEN l.dim='C1' THEN l.points ELSE 0 END) AS C1,
       SUM(CASE WHEN l.dim='C2' THEN l.points ELSE 0 END) AS C2,
       SUM(CASE WHEN l.dim='C3' THEN l.points ELSE 0 END) AS C3,
       SUM(CASE WHEN l.dim='C4' THEN l.points ELSE 0 END) AS C4,
       SUM(l.points) AS total,
       COUNT(l.id) AS events
FROM contributors c LEFT JOIN ledger l ON l.contributor_id=c.id
GROUP BY c.id;
```

> 归一化加权（C1–C4 → 综合维度积分）与模态坍缩权重 W(A/B/C) 计算在导出层完成（对齐卷3 第六板块公式），不入基础视图。

---

## 4. 导出快照 schema（`ledger-snapshots/`，公开留痕）

- **目的**：私有 DB 算账 → 导出只读快照 → push GitHub → 门面站只读渲染。公开站只读快照，零 DB 暴露。
- **频率**：周快照（JSON）+ 月汇总（MD）+ 重要节点即时（对齐 D3 四档）。

```jsonc
// ledger-snapshots/2026-08-W5.json （示例结构）
{
  "snapshot": "2026-08-W5",
  "generated_at": "2026-08-28T00:00:00Z",
  "period": {"start": "2026-08-24", "end": "2026-08-30"},
  "contributors": [
    {
      "anon_code": "样例-001",
      "role": "artist", "mode": "A", "status": "contributor",
      "points": {"C1": 5, "C2": 3, "C3": 2, "C4": 1},
      "total": 11,
      "events": 9
    }
  ],
  "tasks": [
    {"seam_id": "A12", "mode": "A", "role": "artist", "status": "open"}
  ],
  "checksums": {"sha256": "…"}   // 快照完整性
}
```

- 门面站 points.html 数据区吃此 JSON 渲染；源码在 GitHub 仓库内 `ledger-snapshots/`。

---

## 5. 容量与演进（对齐私有 DB 评估）

- 起步（≤200 共创者，首年）：整库 **≈ 5–20 MB**；单条 events_raw ~300–800B、ledger ~150–250B。SQLite 单文件完全无压力。
- 增长（500–2000）：百 MB 级，SQLite 配 WAL+索引仍可扛；写并发明显或上链后迁 PostgreSQL。
- 触发迁移信号：单日写量持续 > 数百条 / WAL 增长失控 / 多端写锁竞争明显。
- **演进预留**：表结构已按"每条流水可审计"设计，导出层预留链上导出（D1 预留）。

---

## 6. 落地边界（本规范不包含）

- **不建库、不写注入脚本**（本规范是契约；实现归私有 DB 建库阶段，需 SSH 提供后实施）。
- **不碰分润结算**（D4 挂起，链条到「公示」为止）。
- **不存明文邮箱/身份**（只存哈希，公开只出匿名代号）。
- 门面站 points.html 数据区骨架已立，待快照接入后填充（见门面站 J4）。