# 创作配套层一致性审查 · 发现清单

审查范围：MAINMAP / INDEX / MODETABLE / PROPOSAL-TPL / README（+ 卷4 5.4/6.x、marketing/main_recruit 作交叉引用）
审查日期：2026-08-24

---

## 一、【intervention-index_v1.md（INDEX）】核心问题

### 1.I-1 【严重】"全量抽取 / 27 缝"与 MAINMAP 内嵌介入缝集不符
- 位置：INDEX 第 0 节"性质"（"抽取全部介入缝"）+ "状态"节（"[x] A/B/C 三类介入缝全量抽取（13 A + 6 B + 8 C = 27 缝）"）
- 问题：INDEX 自称"全量/全部抽取"，但 MAINMAP 内嵌的 A/B/C 缝按节点计为 **A:15 / B:9 / C:10 = 34 处标签**，INDEX 仅 13/6/8=27。以下 MAINMAP 已有缝未入 INDEX：
  - **N5-C**（水帘洞的物理秘密）→ INDEX 无对应 C 条
  - **N7-A**（大闹天宫中未被记录的局部冲突）→ INDEX 无对应 A 条
  - **N10-C**（六字真言=什么锁的密钥）→ 仅被 C2(N8) 部分覆盖，未单列
  - **N13-B**（风类异常在三模态的呈现）→ INDEX B 无此节点
  - **N15-B**（人参果资源本质的模态维度）→ INDEX B 无此节点
  - **N17-A**（牛魔王/铁扇公主高权限洞府）→ INDEX A 无此节点
- 此外 B 类"对照 MODETABLE 10 节点"却只抽 6 条（漏 N6/N8/N9/N19 的模态节点）。
- 建议：① 把"全量/全部"措辞改为"精选/按类汇总"，或 ② 补全缺失缝使 MAINMAP 内嵌缝集与 INDEX 完全对应（并把 27 改为与 MAINMAP 一致的总数，或明确 27=INDEX 自身精选集）。

### 1.I-2 【中】版本号头部未与版本记录同步
- 位置：INDEX 头部"版本：v1.0（初稿）" vs 页底版本记录最新 "v1.1 (2026-08-23)…缝总数 26→27"
- 问题：头部仍写 v1.0，与正文已并入悟空多态模型的最新 v1.1 记录不符。

---

## 二、【mainline_event-map_v1.md（MAINMAP）】

### 2.M-1 【中】钩子节点留白纪律总体合格，但 B 类高价值区列举与 INDEX B 不相
- 位置：§3 B 类高价值区（列 5 节点：4/7/16/18/20）vs INDEX B 共 6 条（多出 N17 火焰山）
- 问题：MAINMAP §3 的"B 类高价值区"列举（5 节点）与 INDEX B 类实际收录（6 条，含火焰山 N17）数量不一致，未同步。
- 建议：统一"哪个节点的 B 缝进索引/进入高价值区"清单。

### 2.M-2 【中】版本号头部未与版本记录同步
- 位置：HEAD "版本：v1.0（主干版）" vs 页底版本记录 "v1.1 (2026-08-23) 悟空多态演化模型并入"
- 注：本文件 N6/N18/N20 三个钩子节点均以"提问/留白"形式呈现，未挑明 → 合规。

---

## 三、【mode-collapse-table_v1.md（MODETABLE）】

### 3.t-1 【中偏高】N20 取经后留白纪律轻微越线（C 行把"新循环"写死）
- 位置：N20 节点 C 废土克苏鲁行 + 坍缩关联行
- 问题：MAINMAP N20 与 INDEX C7、PROPOSAL C7 都把"取经后=稳态 or 熵增再抬头"作为**开放问题/提案级讨论**保留；但 MODETABLE N20 C 行直接断言"C 模态取经后=低熵暂缓、废土深处熵增再度抬头、新循环已在酝酿"，等于把该 C 钩子的走向**写定**，违反"钩子节点留白不挑明"纪律（同节点在 INDEX/PROPOSAL 均保持开放）。
- 建议：把 N20 C 行的"熵增再度抬头/新循环酝酿"改为"C 模态的展望可开放：暂缓非终结，新循环是否抬头留待后传创作"。

### 3.t-2 【低】N6 菩提三模态描述偏具体，但坍缩关联行已补留白说明 → 合规（仅提示）
- 位置：N6 节点 A/C 行（"授完即自焚痕迹不可追溯"/"那低语不可以说"）
- 问题：两行已点到"如何解释授艺后的消失"，略接近解释菩提行为；但"坍缩关联"行明确"不挑明菩提本体…建议留白不写死"，整体仍合规。仅作边界提示，不必改。

### 3.t-3 【中】版本号头部未与版本记录同步
- 位置：HEAD "版本：v1.0（初稿）" vs 页底 "v1.1 (2026-08-23) 悟空多态演化模型并入"

---

## 四、【proposal-template_v1.md（PROPOSAL-TPL）】

### 4.p-1 【低】示范命中真实缝：A12(N16)/B3(N16)/C7(N20) 均在 INDEX 存在 ✅ 合规
- 结论：三点示范对应 INDEX A12/B3/C7 均真实存在，节点归属正确（A12→N16、B3→N16、C7→N20）。无编号错位。

### 4.p-2 【中】版本号头部未与版本记录同步
- 位置：HEAD "版本：v1.0（初稿）" vs 页底 "v1.1 (2026-08-23) 补 B3+C7 两则示范填充"
- 注：本文件已含三则示范（A12/B3/C7），头部仍标 v1.0（仅 A 示范时代）。

---

## 五、【README.md（全导航）】

### 5.r-1 【严重】仓库实际存在的 creator-management-system_v1.md（OWKV-CREATOR-SYS）未进入 README 任何文档表
- 位置：README 四卷架构表 + 支撑/过程文档表 + 创作配套文档表，均无 OWKV-CREATOR-SYS。
- 问题：`creator-management-system_v1.md`（机制/运营层，最新改动 2026-08-24 04:19，且 hub-frontend v2 直接承接其"D7 路线2=统一门面站"）在仓库中是一等公民文档，却完全未列入 README 导航；README 却被 hub-frontend v2 那一条提到"创建者…"，导航断层明显。
- 建议：在"支撑与过程"或新增"机制/运营层"表补一行，指向 creator-management-system_v1.md；并核对该文件头部版本（v1.6）与 git 提交记录的 v2.0 是否一致。

### 5.r-2 【中】proposal-template 行描述过期（只写"A 类示范"）
- 位置：README 创作配套文档表 → "proposal-template_v1.md | … + A 类示范填充"
- 问题：文件已升级为三则示范（A12/B3/C7），README 描述仍只提"A 类示范填充"。
- 建议：改为"A/B/C 三类各一则示范填充"。

### 5.r-3 【低】README 内部版本引用核对
- MAINMAP(OWKV-MAINMAP)/INDEX(OWKV-INDEX)/MODETABLE(OWKV-MODETABLE) 行描述与正文一致，未写错版本号 → 合规。
- hub-frontend 行已同步 v2（"OWKV-HUB-FRONTEND-v2…v2 重写替代原备案站大规划"）→ 与 hub-frontend-plan_v1.md 的 v2.0 正文一致 ✅（2026-08-24 d3d4193 同步到位）。
- 引用文件路径在本仓库全部存在（卷1-4、patch、supplement、pool、wukong-evolution、marketing/ 等）→ 无死链。

---

## 六、交叉引用一致性（卷4 5.4 与 marketing/main_recruit）

- **介入缝总数 27**：README、main_recruit、INDEX 三处均为 27；卷4 5.4 未给总数（仅逐节点标注缝类）。→ "27"表面一致，但见 1.I-1：该 27 非 MAINMAP 内嵌缝的全量。main_recruit 也沿用"27 个介入缝分类汇总"（沿用了不完整口径）。
- **三模态代号/命名**（A赛博/B高维玄幻/C废土克苏鲁）：MAINMAP/INDEX/MODETABLE/PROPOSAL/卷4/README/main_recruit 全文统一，无混写 → ✅ 合规。
- **节点编号**（N1-N20）：INDEX、PROPOSAL 示范、卷4 5.4 全部与 MAINMAP 编号对位无误；A12→N16、B3→N16、C7→N20 等引用均命中真实节点 → ✅ 无错位/遗漏。
- **钩子节点**：N6（菩提）、N18（真假）在 MAINMAP/INDEX/MODETABLE 均保持"悬而未决/列方向不列答案"，纪律合格；唯一越线见 3.t-1（MODETABLE N20 C 行）。

---

## 最需要修的前 5 处

1. **INDEX"全量 27 缝"不实**（1.I-1）：与 MAINMAP 内嵌 15A/9B/10C 不符，漏 N5-C、N7-A、N10-C、N13-B、N15-B、N17-A 六缝；改措辞或补全并统一总数。
2. **README 缺 creator-management-system_v1.md**（5.r-1）：全库导航漏掉机制/运营层一等文档，并核对文件头部 v1.6 vs git v2.0。
3. **MODETABLE N20 C 行写死"熵增再抬头/新循环"**（3.t-1）：违反钩子节点留白纪律，与 INDEX C7 / PROPOSAL C7 的开放定位冲突。
4. **四文件版本头部滞后**（1.I-2 / 2.M-2 / 3.t-3 / 4.p-2）：MAINMAP/INDEX/MODETABLE/PROPOSAL 头部均仍 v1.0，版本记录最新均为 v1.1，头部未随正文升级。
5. **README 的 proposal-template 描述过期**（5.r-2）：只写"A 类示范"，实际已含 A12/B3/C7 三则。