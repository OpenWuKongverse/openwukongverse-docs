# OpenWuKongVerse ·《社区角色权责与贡献积分规程》v1

> 文档代号：`OWKV-ROLES-POINTS-SPEC-v1`  
> 文件路径：`02-co-creation/ROLES-AND-POINTS-SPEC.md`  
> 层级定位：**机制治理与数据规范层**（承接白皮书卷3《共创协议》，指导 D1 数据库、中枢 Worker、门面站与 GitHub 协同）  
> 编者：Echo-Architect-0  
> 许可协议：CC BY-NC-SA 4.0  
> 状态：**正典机制规程（正式施行）**  
> 关联文档：`00-core/volume-3-co-creation-protocol.md` / `02-co-creation/contribution-data-spec.md` / `02-co-creation/creator-management-system.md` / `01-canon/assets/README.md`

---

## 0. 规程总则与基本哲学

### 0.1 双轨分立原则
OWKV 建立**声誉（Karma）**与**贡献积分（Points）**严格分离的双轨治理架构：
1. **维度声誉值（Karma）**：不可转让、只增不减。代表创作者在 OWKV 宇宙中的历史功勋、可信度与治理权重。
2. **贡献积分（Points / Cred）**：量化累计、按劳获取。作为底层唯一贡献度凭证，记录创作者在 C1~C4 各维度的具体产出，作为未来权益映射的唯一事实依据。

### 0.2 核心执行原则
- **事实源唯一**：所有积分变动必须追溯至结构化事件日志（`events_raw`）与不可篡改的流水账本（`point_logs`）。
- **贡献驱动，杜绝空转**：严禁无实质内容产出的纯投机刷分；普通互动仅限门槛激励，核心分值必须绑定正典资产、有效代码或实质性生态维护。
- **解耦与预留**：积分系统在业务层与技术层保持独立运转。下游 Web3 通证化、IP 衍生授权分润或商业权益对接，均通过标准接口读取积分快照，不在社区冷启动阶段引入复杂的先期金融化逻辑。

---

## 1. 社区角色定义与四层阶梯模型

OWKV 社区参与者划分为四个明确阶梯，形成由浅入深、权责对等的治理闭环：

```
[Level 4: 架构师 (Architect)] ────── 终极守护者：正典最终合流权、规则仲裁与系统级裁决
             ▲
[Level 3: 评审团 (Reviewer)]  ────── 维度质检员：提案深度初审、冲突核验、质量打分
             ▲
[Level 2: 共创者 (Creator)]   ────── 宇宙拓荒者：提交正典设定、故事创作、脚本与视觉资产
             ▲
[Level 1: 观察者 (Observer)]  ────── 基础观测者：注册建档、参与投票、反馈漏洞、生态传播
```

### 1.1 观察者（Observer）
- **定义**：完成基础注册并通过人机验证（Turnstile）的社区成员。
- **定位**：宇宙的基础观测基底，负责消费内容、提供初始反馈、参与大众投票并监督系统漏洞。
- **获取门槛**：通过 `openwkv.xyz/join.html` 注册成功即可获得。

### 1.2 共创者（Creator）
- **定义**：具有实质性内容创作能力的拓荒者，向 OWKV 提供世界观设定、故事文本、动漫脚本或视觉资产。
- **定位**：宇宙内容的主要生产者，开辟沙盒支线与推进主线正典。
- **获取门槛**：累计 Karma 达到 $100$，且至少有 1 个提案通过评审进入沙盒，或有 1 项正典资产被合并。

### 1.3 评审团（Reviewer）
- **定义**：对 OWKV 世界观圣经（卷2）、物理法则及正典地图有深刻理解的资深建设者。
- **定位**：宇宙的“单元测试执行员”，负责提案初审、世界观一致性审计、防冲突核验与质量分初评。
- **获取门槛**：累计 Karma 达到 $1000$，且至少有 2 项以上正典合并贡献；经架构师邀请或社区提名选举产生。

### 1.4 架构师（Architect）
- **定义**：OWKV 核心系统的维护者与终极观测者（代号 Echo-Architect-0 及核心工程组）。
- **定位**：负责主干代码维护、正典最终 Merge 合流、系统级设定裁决与一票否决权（Veto）。

### 1.5 角色权责对照矩阵

| 权限维度 | 观察者 (Observer) | 共创者 (Creator) | 评审团 (Reviewer) | 架构师 (Architect) |
| :--- | :---: | :---: | :---: | :---: |
| **基础提案发起权** | ✅（需合规初筛） | ✅（优先通道） | ✅ | ✅ |
| **沙盒支线开辟权** | ❌ | ✅ | ✅ | ✅ |
| **正典资产署名权** | ❌ | ✅ | ✅ | ✅ |
| **大众投票表决权** | ✅（基准 1 票） | ✅（基准 1 票） | ✅（加权投票） | ✅ |
| **提案同行评审权** | ❌ | ❌ | ✅（签署 Review 意见） | ✅ |
| **PR 审查与合并标记** | ❌ | ❌ | ✅（Approve 标记） | ✅（最终 Merge 权） |
| **系统级设定一票否决**| ❌ | ❌ | ❌ | ✅ |

---

## 2. 维度声誉值（Karma）：演化与治理加权

### 2.1 Karma 的本质属性
1. **只增不减**：Karma 是创作者在社区的永久信用资产，任何合规贡献均转化为不可磨灭的声誉记录。
2. **防女巫攻击屏障**：治理权重与高级权限严格依赖 Karma 门槛，抬高恶意刷小号的攻击成本。

### 2.2 Karma 累计途径与赋值标准

| 贡献行为 | 触发事件 | Karma 增加量 | 审计要求 |
| :--- | :--- | :---: | :--- |
| **初始注册建档** | 完成有效注册与邮箱校验 | $+10$ | 自动发放（限 1 次） |
| **提交有效提案** | 提案通过格式初筛与介入点匹配 | $+15$ | 评审团确认 |
| **沙盒立项成功** | 提案进入沙盒试验区 | $+50$ | 评审团 Approve |
| **正典资产合并** | 故事/设定/美术正式 Merge 入库 | $+200 \sim 500$ | 架构师最终 Merge |
| **重大冲突排查** | 发现并论证世界观/物理矛盾并被采纳 | $+100$ | 架构师确认 |
| **完成同行评审** | 评审团成员出具详实审查报告 | $+30$ | 架构师复核 |
| **翻译与化** | 完整翻译单篇正典或核心文档 | $+80$ | PR 合并 |

### 2.3 二次方治理加权模型（Quadratic Weighting）
在社区对争议提案、模态演化权重进行表决时，采用二次方加权算法计算个人投票权重 $W$：

$$W = \lfloor \sqrt{\text{Karma}} \rfloor$$

- 示例：
  - 观察者（Karma = 10）：$W = 3$ 票权重
  - 新晋共创者（Karma = 100）：$W = 10$ 票权重
  - 资深评审员（Karma = 1000）：$W = 31$ 票权重
- **设计目的**：既充分尊重长期高贡献者的专业判断，又有效避免中心化巨鲸垄断投票结果。

---

## 3. 贡献积分（Points）：C1~C4 量化计算细则

贡献积分严格按照白皮书卷3既定的四大维度进行量化。基线权重配比为：**C1 30% / C2 30% / C3 20% / C4 20%**。

### 3.1 C1 创作基建分（Creation & Content，占比 30%）
衡量创作者对 OWKV 世界观与故事内容的实质性拓荒产出。

| 产出类型 | 验收标准与交付物 | C1 分值 |
| :--- | :--- | :---: |
| **主线事件节点故事** | 围绕 MAINMAP 20 节点撰写，正典采纳（$\ge 3000$ 字） | $300 \sim 800$ 分/篇 |
| **介入缝支线故事** | 针对 INDEX 26 处介入缝创作，沙盒/正典采纳 | $150 \sim 400$ 分/篇 |
| **设定资产录入** | 按规范提交人物/法宝/神通/通道单项资产文件 | $100 \sim 300$ 分/条 |
| **视觉原画与分镜** | 完整角色设定图/场景概念图/分镜脚本 | $200 \sim 600$ 分/套 |
| **世界观模态适配** | 将主线节点成功转译为 A/B/C 模态呈现 | $150 \sim 350$ 分/篇 |

### 3.2 C2 质量评审分（Quality & Review，占比 30%）
衡量作品的专业度、艺术水准以及评审团把关的深度。

| 行为类型 | 计分规则与考核标准 | C2 分值 |
| :--- | :--- | :---: |
| **评审团综合质量评级** | 提案入库时，评审团打分（S/A/B 三档加权）：<br>• S 级（卓越）：基准分 $\times 1.5$<br>• A 级（优秀）：基准分 $\times 1.2$<br>• B 级（合格）：基准分 $\times 1.0$ | 浮动计入对应提案 |
| **详尽同行审查报告** | 评审员出具包含一致性检查、修辞建议的 Review 意见 | $20 \sim 50$ 分/次 |
| **世界观逻辑纠错** | 成功提出针对《物理法则》《权限矩阵》的有效勘误 | $30 \sim 100$ 分/次 |

### 3.3 C3 衍生采用分（Derivation & Adoption，占比 20%）
衡量资产的生态流动性与网络效应（类似版税引用机制）。

| 触发机制 | 结算规则 | C3 分值 |
| :--- | :--- | :---: |
| **正典资产被二次引用** | 其他创作者在后续正典故事中显式引用该资产（Asset ID） | 原作者 $+20$ 分/次 |
| **沙盒支线晋升正典** | 孵化出的沙盒支线因高热度与高质量被提拔并入主正典 | 原作者 $+200$ 分/案 |
| **二创跨模态改编** | 基于某文本正典改编为漫画分镜、广播剧脚本 | 原作者与改编者各 $+50$ 分 |

### 3.4 C4 生态共建分（Ecosystem & Operations，占比 20%）
衡量基础设施建设、技术开发、翻译、文档治理与社区运营贡献。

| 贡献范畴 | 工作内容与验收 | C4 分值 |
| :--- | :--- | :---: |
| **代码与中枢开发** | 提交 CF Worker、门面站前端、自动化脚本有效 PR | $50 \sim 300$ 分/PR |
| **文档治理与维护** | 修复全库文档格式、超链接、中英术语对齐 | $10 \sim 50$ 分/次 |
| **多语言本地化** | 官方文档或正典故事英译（人工精校） | $100 \sim 250$ 分/千字 |
| **社区例行轮值治理** | 担任 Discord 官方频道轮值主持、答疑（按周考评） | $50$ 分/周 |

### 3.5 参与互动激励（E-Track / 辅助轨道）
为激励广大观察者的活跃度，设置独立的 **E-Track（Engagement）参与积分**：
- **获取途径**：Discord 活跃发言、官方动态转帖互动、有效活动参与（$+1 \sim 5$ 分/次）。
- **硬性红线**：E-Track 积分**不直接进入核心 C1~C4 分润账本**，仅用于社区内部周边兑换、测试资格门槛或按比例兑换基础 Karma（兑换上限严格受控），防止刷赞行为稀释核心创作者权益。

---

## 4. 提案评审与积分发放流水线

所有积分的产出必须依托白皮书卷3规定的标准流水线，严禁任何形式的人工暗箱加分：

```
[步骤 1: 提案注入] ──► 提交 PR 或站内表单 ──► 记录 events_raw (状态: submitted)
         │
[步骤 2: 维度质检] ──► 评审团世界观核验 ──► 签署 Review (状态: approved / rejected)
         │
[步骤 3: 终审合流] ──► 架构师执行 Merge ──► 触发 GitHub Actions Webhook
         │
[步骤 4: 账本入账] ──► 中枢 Worker 写入 point_logs ──► 更新 users 总分与 Karma ──► 看板公示
```

### 4.1 核心操作流程
1. **注入验证**：提案人提交规范 Markdown 提案至 `02-co-creation/proposals/` 目录或通过表单提交，系统生成唯一 `proposal_id`。
2. **质检评审**：至少 2 名评审团成员对提案进行合规性核查，在 GitHub PR 中留下 Review 意见并标记评级（S/A/B）。
3. **正典合流**：架构师完成终审并执行 `git merge`。
4. **自动化清算**：CI/CD 触发结算 Worker，从 commit 载荷中解析作者 ID、资产类别与评级，自动向 `point_logs` 写入 C1/C2 积分，同时累加对应 Karma。

### 4.2 严格防刷与风控机制
1. **同源聚类限额**：单用户每日提交提案上限为 2 篇，超出部分自动进入排队队列，不计即时积分。
2. **格式与字数熔断**：正典类投稿低于 1500 字或不符合《设定资产库规范》者，系统直接拒收，不计入 C1。
3. **恶意作弊罚没**：严禁使用未经清洗的纯 AI 垃圾文本刷量。经评审团与架构师判定为恶意注水、抄袭或破坏世界观一致性的，扣除违规所得 200% 的 Karma，严重者直接封禁 Member ID。

---

## 5. 技术实现与数据契约规范（CF Worker + D1）

本规程直接指导 Cloudflare D1 边缘数据库的表结构设计与 API 实现。

### 5.1 数据表结构定义（SQLite / D1）

```sql
-- 1. 用户档案表 (users)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                 -- UUID / Member ID
    username TEXT NOT NULL,              -- 匿名代号 (如 Echo-01)
    email_hash TEXT NOT NULL UNIQUE,     -- 邮箱 SHA-256 哈希 (隐私隔离)
    role TEXT DEFAULT 'observer',        -- 'observer', 'creator', 'reviewer', 'architect'
    karma INTEGER DEFAULT 10,            -- 声誉值 (初始10，只增不减)
    points_c1 INTEGER DEFAULT 0,         -- C1 创作分
    points_c2 INTEGER DEFAULT 0,         -- C2 质量分
    points_c3 INTEGER DEFAULT 0,         -- C3 衍生分
    points_c4 INTEGER DEFAULT 0,         -- C4 生态分
    total_points INTEGER DEFAULT 0,      -- 动态总分 (C1+C2+C3+C4)
    github_handle TEXT,                  -- GitHub 绑定
    discord_id TEXT,                     -- Discord 绑定
    wallet_address TEXT,                 -- 预留 Web3 钱包地址
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 积分与声誉流水账本 (point_logs)
CREATE TABLE IF NOT EXISTS point_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,               -- 关联 users.id
    action_type TEXT NOT NULL,           -- 事件类型 (如 'CANON_MERGE', 'REVIEW_PASS')
    dimension TEXT NOT NULL,             -- 'C1', 'C2', 'C3', 'C4', 'KARMA'
    points_delta INTEGER NOT NULL,       -- 变动分值 (如 +300)
    karma_delta INTEGER DEFAULT 0,       -- 同步变动的 Karma (如 +50)
    ref_type TEXT,                       -- 'github_pr', 'proposal_id', 'asset_id'
    ref_id TEXT,                         -- 具体关联单号或路径
    operator_id TEXT NOT NULL,           -- 操作人 / 执行者 ('system', 'architect')
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 3. 原始事件池 (events_raw) - 唯一写入点
CREATE TABLE IF NOT EXISTS events_raw (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,                -- 'hub_form', 'github_webhook', 'discord_bot'
    event_type TEXT NOT NULL,            -- 'join', 'submit_proposal', 'merge', 'review'
    payload TEXT NOT NULL,               -- JSON 原始载荷
    status TEXT DEFAULT 'pending',       -- 'pending', 'processed', 'failed', 'ignored'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 状态同步与事实源公示
1. **实时计算**：用户每次积分变动，中枢 Worker 自动执行原子事务：写入 `point_logs` $\to$ 更新 `users` 聚合数值。
2. **公开快照导出**：GitHub Actions 每日定时调用私有 Worker 导出接口，生成脱敏的只读快照 `02-co-creation/points-ledger.json` 并 commit 入库，确保公众可随时核验全网贡献排行榜。
3. **门面站呈现**：`openwkv.xyz/points.html` 直接请求公开只读 API，展示最新的角色梯队与积分榜单。

---

## 6. 附录：单项操作积分与声誉速查表

| 操作代码 | 贡献类型 | 涉及维度 | Karma 增量 | 积分增量 (基准) | 审核/归档证明 |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `ACT_REG` | 注册完成并激活 | Karma | $+10$ | $0$ | Turnstile 验证记录 |
| `ACT_PROP_SUB` | 提交有效共创提案 | C1 / Karma | $+15$ | $+20$ (预备分) | GitHub Issue / PR |
| `ACT_SAN_APP` | 提案进入沙盒试验区 | C1 / Karma | $+50$ | $+100$ | 评审团 Approve 标签 |
| `ACT_CAN_MG_S` | 正典故事入库 (S级) | C1, C2 / Karma | $+300$ | $+600 \sim 1200$ | 架构师 Merge Commit |
| `ACT_CAN_MG_A` | 正典故事入库 (A级) | C1, C2 / Karma | $+200$ | $+400 \sim 800$ | 架构师 Merge Commit |
| `ACT_AST_ADD` | 设定资产 (人物/法宝) | C1 / Karma | $+100$ | $+150 \sim 300$ | `01-canon/assets/` 入库 |
| `ACT_REV_REP` | 深度评审报告签署 | C2, C4 / Karma | $+30$ | $+30 \sim 50$ | GitHub PR Review 记录 |
| `ACT_BUG_FIX` | 排查世界观核心冲突 | C2, C4 / Karma | $+100$ | $+100 \sim 200$ | 架构师确认 Issue |
| `ACT_TRN_DOC` | 官方正典文档英译 | C4 / Karma | $+80$ | $+100 \sim 250$ | 化 PR Merge |
| `ACT_REF_HIT` | 正典资产被后续引用 | C3 | $0$ | $+20$ / 次 | 自动化引用计数扫描 |

---

> **结语**：本规程自发布之日起生效，作为 OWKV 社区运转的核心机制法规。所有共创者的历史贡献与声誉均受本法保护，不可随意篡改或剥夺。改动本规程条款须由架构师发起公开提案，经社区充分评议后方可修订。