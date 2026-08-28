# OpenWuKongVerse（开源悟空多维宇宙）· 文档集

> 项目代号：OWKV / Project Multiverse-X
> 首席架构师 / 发起人：Echo-Architect-0
> 文档开源许可：CC BY-NC-SA 4.0（署名-非商业-相同方式共享）
> 仓库可见性：当前为私有，将按项目路线转为公开

---

## 公开状态（公示）

- **转公开时间**：`2026-08-24 17:00`（Echo-Architect-0 定）
- **状态标注**：**试运行（Beta）**——内容处试运行定稿、非终稿承诺；改系统级设定走提案流程；主干不可改、钩子留白、术语红线不变
- **完整留档**：详见 [`PUBLIC-LAUNCH.md`](PUBLIC-LAUNCH.md)（公开启动记录：全文件清单 + 试运行边界 + 转公开时点公示）
- **前端站**：仓库根目录 HTML（Hub 门面站，S1+S2 已就绪）随公开一并启用，域名 `openwkv.xyz` 接入

---

## 这是什么

OpenWuKongVerse（OWKV）是一个 Web3 社区共创的硬核科幻动漫 IP 项目，将古典名著《西游记》重构为一套以多维物理学、量子力学与信息计算论为支撑的庞大数字宇宙，并以去中心化式社区共创（共筹共创 + 投票定剧情 + 衍生收益分润 + 贡献度通证化）驱动其演化。

一句话定位：

> 可扩展世界观 × 共创平台协议 ： 既是可无限延伸的科幻世界观宇宙，也是一套配套的社区共创与分润机制协议。

---

## 仓库目录结构（分层）

```
├── codex/            社区法典：四卷 + 修订补丁（唯一"律法"，改动需提案级流程）
├── canon/            故事正典：主线事件地图（IP 内容本体）
├── setting/          设定库：人物/法宝/支线介入点/模态坍缩/演化模型
├── co-creation/      共创机制：运营体系/分润/提案模板/协议草案/社区架构
├── archive/          归档：已定稿的过程文档（审视/审计/前端规划）
├── marketing/        对外招募素材
└── *.html + assets/  门面站（GitHub Pages 发布源，仓库根）
```

---

## 四卷分层文档架构（`codex/`）

| 卷 | 文档 | 层级 | 回答的问题 |
|---|---|---|---|
| **卷1** | [`codex/volume1_concept-protocol.md`](codex/volume1_concept-protocol.md) | **元层**（Meta） | 宇宙是什么、凭什么存在、为何我们看到的《西游记》只是投影镜像 |
| **卷2** | [`codex/volume2_worldview-bible.md`](codex/volume2_worldview-bible.md) | **物理层**（Physics） | 宇宙内部如何运作：五层膜拓扑、五重物理法则、主线叙事 |
| **卷3** | [`codex/volume3_co-creation-protocol.md`](codex/volume3_co-creation-protocol.md) | **机制层**（Mechanism） | 如何共创、如何分润、如何定权重、如何保障正典兼容 |
| **卷4** | [`codex/volume4_content-directory.md`](codex/volume4_content-directory.md) | **内容层**（Content） | 创作者手上有什么素材：底层协议手册、角色档案、维度地图、入门指南、主线事件地图、三模态呈现对照（6 板块） |
| **补丁** | [`codex/patch_v1_three-contradictions.md`](codex/patch_v1_three-contradictions.md) | 修订补丁 | 白皮书三处逻辑矛盾修订（权限受限 / 序态自稳 / 观象域改名） |
| **增补** | [`codex/volume2_supplement.md`](codex/volume2_supplement.md) | 卷2 增补 | 序态自稳闭环 / 卷1↔卷2 衔接声明的细节展开 |

阅读建议：新读者按 卷1→卷2→卷3→卷4 顺序；创作者直接看 卷4 + 卷3；想先感受宇宙氛围看 卷2。

---

## 故事正典与设定（`canon/` + `setting/`）

| 分类 | 文档 | 说明 |
|---|---|---|
| **正典·主线** | [`canon/mainline_event-map_v1.md`](canon/mainline_event-map_v1.md) | **主线事件地图**（OWKV-MAINMAP）：三幕骨架 + 20 节点 + A/B/C 介入缝内嵌：主线的坐标底图，指明"哪里能共创、怎么共创" |
| **设定·介入** | [`setting/intervention-index_v1.md`](setting/intervention-index_v1.md) | **介入点索引**（OWKV-INDEX）：A/B/C 三类介入缝检索速查：共创者按类找活干 |
| **设定·模态** | [`setting/mode-collapse-table_v1.md`](setting/mode-collapse-table_v1.md) | **三模态呈现对照表**（OWKV-MODETABLE）：10 关键节点 × A赛博/B高维玄幻/C废土克苏鲁 对照：模态介入参考 |
| **设定·演化** | [`setting/wukong-process-evolution_v1.md`](setting/wukong-process-evolution_v1.md) | **悟空多态演化模型**（OWKV-WUKONG-EVOL）：可分裂异常体 → 多形态演化设定讨论稿（已并入正典） |

---

## 共创机制（`co-creation/`）

| 文档 | 说明 |
|---|---|
| [`co-creation/creator-management-system_v1.md`](co-creation/creator-management-system_v1.md) | **运营体系主档**（OWKV-CREATOR-SYS v2.0）：一个 Hub + 六平台入口、地理双轨·同一事实源、决策表（D1-D7）、共创流水线、积分看板、公示四档 |
| [`co-creation/contribution-pool-design_v1.md`](co-creation/contribution-pool-design_v1.md) | **多池分润机制设计**（已拍板并入正典，当前基线=创作40%/运维20%/资产池20%挂起/回流20%） |
| [`co-creation/proposal-template_v1.md`](co-creation/proposal-template_v1.md) | **共创提案模板**（OWKV-PROPOSAL-TPL）：一页可填、直接可报名提交的提案模板 + A12/B3/C7 三则示范填充 |
| [`co-creation/community-structure_v1.md`](co-creation/community-structure_v1.md) | **社区基础架构**（OWKV-COMM-STRUCT）：四角色（首席架构师/评审团/共创者/观察者）+ 进入/退出机制 + 三阶段演进 |
| [`co-creation/draft_co-creation-agreement_v1.md`](co-creation/draft_co-creation-agreement_v1.md) | **《共创协议完整草案》**（对外可签署条款成品，十章） |

---

## 归档与过程文档（`archive/`）

| 文档 | 说明 |
|---|---|
| [`archive/review_v1_doc-architecture.md`](archive/review_v1_doc-architecture.md) | 项目审视报告 v1：四卷架构的提出依据 |
| [`archive/cross-consistency-audit_v1.md`](archive/cross-consistency-audit_v1.md) | 四卷交叉一致性核对报告（含 Level 双义术语红线等处理记录） |
| [`archive/hub-frontend-plan_v1.md`](archive/hub-frontend-plan_v1.md) | Hub 前端（门面站）规划 v2 版（已落地，文档归档） |

---

## 前端入口（Hub 门面站，仓库根）

> 国际国内共用一套 URL，只做展示与入口，不建第二套系统、不建自建 DB。讨论区归平台矩阵（Discord / 微信群 / Reddit）。正典库本体就在本仓库。

| 入口 | 说明 |
|---|---|
| `index.html` | Hub 统一门面站首页（公告 / 世界观速览 / 报名 / 提案投票 / 积分看板展示） |
| `join.html` / `proposals.html` / `points.html` / `worldview.html` | 报名 / 提案 / 积分 / 世界观 分页 |

- 域名：`openwkv.xyz`（已接入 GitHub Pages 自定义域名）
- 发布源：仓库根目录 `main:/`（HTML 与文档同根，Pages 直接渲染）

---

## 核心世界观速览（30 秒版）

- **五层膜（真实宇宙）**：灵山（5D 全息奇点）→ 天庭（4.5D 观测站）→ 凡间（3D 基底）→ 地府（4D 负熵回溯场）→ 局部真空泡（妖怪洞府/秘境）。
- **五重物理法则**：**界**（维度）· **境**（边界/真空泡）· **道**（代码/阴阳五行）· **法**（权限调用）· **心**（终极观测者）。
- **主线**：**序态自稳系统**：宇宙默认滑向熵增（乱世），靠周期性纠错维持低熵；**取经 = 系统的一次纠错心跳**，八十一难 = 单元测试。
- **权限逻辑（修订1）**：管理员（如来/玉帝）**权限受限**，不能直接改高维规则，只能借低维进程（悟空=可分裂多态进程，现行杀毒形态）触发纠错。
- **悟空多态演化（2026-08-23）**：悟空=可分裂异常体（Quantum-Anomaly-01），演化链=守护形态（花果山）→ 破维度形态（逆维度能量，大闹天宫）→ 隔离（五行山）→ 多态共存（现行杀毒形态）；异常体来源=起源钩子（最早的缝）。
- **元层（卷1）**：我们看到的《西游记》发生在投影幕布层 / 观象域，是高维世界经**神话滤镜**降维投下的镜像，而非宇宙本身。
- **三模态分支**：A 赛博 / B 高维玄幻 / C 废土克苏鲁：三条平行演化模态，供不同创作者接入。

---

## 社区共创机制速览

- **共创流水线**：提案 → 评议 → 架构师审查 → 入正典（另有沙盒轨道）。
- **三大沙盒定律**：正典兼容 / 局部自由 / 版权分润。
- **贡献力（维度积分）**：C1 创作量 30% + C2 质量 30% + C3 采用率 20% + C4 生态 20%。
- **分润**：多池分润：创作池 40% / 运维 20% / 资产池 20%（挂起） / 回流 20%，按积分分配。
- **模态坍缩权重**：三模态按观察者创作/投票动态调权，保留多样性底线。

---

## 术语红线（防混淆速记）

- **五层膜** = 真实宇宙维度结构（物理层）；观象域/投影幕布层 = 人类所见神话镜像（元层）。两者是"本尊 vs 投影"，禁止混用。
- 维度层级 Level（卷2 拓扑，5D→1D）≠ 权限级别 Level（卷3 矩阵，Root→Rogue）。数字代号相同，概念不同，禁止当同一尺子。

---

## 近期路线

1. ✅ 四卷分层文档集确立并全量一致
2. ✅ 三处逻辑矛盾修订并入（权限受限 / 序态自稳 / 观象域）
3. ✅ 白皮书第七节"贡献力计算体系"空标题补全
4. ✅ 《共创协议完整草案》（对外条款成品）：见 `co-creation/draft_co-creation-agreement_v1.md`
5. ✅ 主线事件地图（MAINMAP v1：三幕骨架 + 20 节点 + A/B/C 介入缝）
6. ✅ 三模态呈现对照表（MODETABLE v1：10 关键节点 × 三模态）
7. ✅ 卷4 并入第五/第六板块（主线坐标底图 + 模态参考，卷4 v1.1）
8. ✅ 悟空多态演化模型并入正典（异常体=起源钩子最早的缝 / 逆维度能量 / 多态共存）
9. ✅ **仓库目录分层整理**（codex/canon/setting/co-creation/archive/marketing 六大分区）

---

*End of README · OpenWuKongVerse Docs*