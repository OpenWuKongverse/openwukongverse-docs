# OpenWuKongVerse（OWKV）· 公开启动记录

> 文档代号：`OWKV-PUBLIC-LAUNCH`
> 性质：**公开启动声明与文件清单留档**（记录转公开的动作与时间）
> 编者：Echo-Architect-0
> 状态：**试运行**（见下方说明）

---

## 一、公开时间（公示）

- **转公开时间**：`2026-08-24 17:00`（Europe/Berlin, CEST, UTC+2）
- **标注**：**试运行**（LAUNCH 状态=试运行）
- 本记录在转公开动作发生前即已入库并随仓库推送；仓库由私有转为公开后，本记录随之一并公之于众，作为公开时间的留证。

---

## 二、试运行说明

仓库转为公开，但项目处于**试运行（Beta）**阶段，特此公示，避免误解：

1. **内容非终稿**：正典文档集（卷1–卷4）与运营文档目前是 **试运行定稿**，仍在随共创节奏修订；"试运行"不代表内容已冻结为不变量承诺。
2. **钩子留白**：节点（菩提 N6 / 真假美猴王 N18 / 取经后 N20）留白不挑明，属有意设计非缺失。
3. **改动机制**：改系统级设定须先提案级讨论、经架构师确认后才入正典（衔接卷3）；试运行期间尤其鼓励观察者提出修正意见。
4. **决策状态**：D1/D2/D3/D5/D6/D7 已定；**D4（分润发放通道·合规）仍待议**——分润细则生效前，不构成任何既得分润承诺。
5. **前端站**：Hub 门面站（前端 HTML 位于**仓库根**，经 GitHub Pages 根发布）为**试运行起站**，报名入口/平台链接待矩阵启动后填入；站点被下线/换址不丢任何正典与积分（唯一事实源始终是 Hub 仓库本身）。

---

## 三、完整文件清单（转公开时点留档）

> 本清单为仓库**六块全景重排后的现行结构**（`00-core`/`01-canon`/`02-co-creation`/`03-community`/`04-commercial`/`05-marketing`/`06-hub`）。版本号以各文件头部为准，此表为索引速览；个别文件版本行用 `###` / `######` / `>` 多种样式，以实际文件为准。

### A · 仓库根（入口 + 前端门面站）

| 文件 | 定位 |
|---|---|
| `README.md` | 仓库总导航（六块全景 / 四卷架构 / 前端入口 / 支撑文档） |
| `PUBLIC-LAUNCH.md` | **本记录**：公开时间公示 + 试运行声明 + 全文件清单 |
| `index.html` | 首页 / 公告（前端门面站入口） |
| `worldview.html` | 世界观速览 |
| `join.html` | 报名（D2 站内注册表单 CF 主入口→观察者；GitHub 熟手 / Discord 补充；微信已移除沟通职能） |
| `proposals.html` | 提案 / 投票入口 |
| `points.html` | 积分看板（只读展示） |
| `assets/css/` 、 `assets/js/` | 前端共用样式与脚本 |
| `CNAME` | 自定义域名指示（openwkv.xyz） |

> ⚠️ GitHub Pages 为**根发布**（source.path=/，branch main，域名 openwkv.xyz）：`index.html` 与前端资产必须位于**仓库根**，站点才能正常访问。

### B · 四卷正典（法典全集 · `00-core/`）

| 文件 | 定位 |
|---|---|
| `00-core/concept-protocol.md` | 卷1 · 概念协议（元层）v1.1 |
| `00-core/worldview-bible.md` | 卷2 · 世界观圣经（物理层）v1.2 |
| `00-core/worldview-supplement.md` | 卷2 增补 v1.0 |
| `00-core/co-creation-protocol.md` | 卷3 · 共创协议（机制层）v1.3 |
| `00-core/content-directory.md` | 卷4 · 内容目录 v1.2 |
| `00-core/patch-three-contradictions.md` | 白皮书三处逻辑矛盾修订补丁 v1.0 |

### C · 创作正典与设定资产库（`01-canon/`）

| 文件 | 定位 |
|---|---|
| `01-canon/mainline-event-map.md` | 主线事件地图（三幕+20节点）v1.1 |
| `01-canon/intervention-index.md` | 介入点索引（A/B/C 按类精选）v1.1 |
| `01-canon/mode-collapse-table.md` | 三模态呈现对照表 v1.1 |
| `01-canon/wukong-process-evolution.md` | 悟空多态演化模型 v1.0 |
| `01-canon/assets/README.md` | 设定资产库规范（铁律 / 三条铁律待对齐） |

### D · 共创管理（`02-co-creation/` · 卷3 配套）

| 文件 | 定位 |
|---|---|
| `02-co-creation/creator-management-system.md` | 创作管理体系主档（运营体系） |
| `02-co-creation/contribution-data-spec.md` | 贡献数据规范（C1–C4 数据契约） |
| `02-co-creation/contribution-pool-design.md` | 多池分润机制设计 v1.2 |
| `02-co-creation/proposal-template.md` | 共创提案模板（含 A12/B3/C7 示范） |
| `02-co-creation/draft-co-creation-agreement.md` | 共创协议完整草案 |

### E · 社区 / 商业化（`03-community/` `04-commercial/`）

| 文件 | 定位 |
|---|---|
| `03-community/community-structure.md` | 社区结构设计（四角色） |
| `04-commercial/README.md` | 商业化规划（占位：IP授权 / 衍生 / 通证化待规划） |

### F · 招募素材与扩展目录（`05-marketing/` `06-hub/`）

| 文件 | 定位 |
|---|---|
| `05-marketing/faq.md` | 招募 FAQ |
| `05-marketing/main-recruit.md` | 招募主文案 |
| `05-marketing/recruit-by-role.md` | 分角色招募 |
| `06-hub/README.md` | HUB 站扩展目录说明（后期非根前端文件） |

### G · 过程留档（`archive/` · 历史存档，不改动）

| 文件 | 定位 |
|---|---|
| `archive/cross-consistency-audit_v1.md` | 四卷交叉一致性核对报告 v1.0 |
| `archive/review_v1_doc-architecture.md` | 项目审视报告 v1.0 |
| `archive/hub-frontend-plan_v1.md` | Hub 前端（门面站）规划 v1（旧分层，v2 定稿） |

> 说明：`05-marketing/` 素材**随公开一并启用**（原挂起项②）；招募素材发布节奏见各自文件状态行。`archive/` 为历史留档，仅供参考，不随重排改动。

---

## 四、试运行期边界（对外承诺红线）

- **不构成既得分润承诺**（D4 未定，分润细则生效前无兑现义务）。
- **不构成正典冻结承诺**（试运行内容可修订，改系统级设定走提案流程）。
- **主干不可改**（主线历史不可更改，可丰富支线/补完局部）。
- **术语红线**：五层膜=真实结构 vs 观象域=神话镜像；Level 双义必标语境。
- **匿名**：发起人匿名代号 Echo-Architect-0。

---

## 五、域名与部署方案（GitHub Pages 根发布）

> 决策（2026-08-24 11:38，发起人定）：**GitHub Pages 为主站（根发布，域名 openwkv.xyz）**。国际国内统一一套 URL；国内加速不靠境外代理，留给后续阶段备案+国内 CDN（唯一正解）。

### 5.1 发布方式（仓库根发布）

| 平台 | 角色 | 发布源 | 触发 | 域名 |
|---|---|---|---|---|
| **GitHub Pages** | **主站**（留档/同源/兜底） | **仓库根**（`/`，branch `main`） | push 自动 | `openwkv.xyz`（根域，A 记录） |

> Pages 配置：Settings → Pages → Source = **Deploy from a branch** → Branch = `main`，**directory = `/`（根）**。因是组织/根发布，`index.html` 必须位于仓库根；前端其余文件（worldview/join/proposals/points.html + assets/）同置根。`06-hub/` 仅存放后期不必须在根的前端文件。

### 5.2 域名归属（Dynadot 侧 DNS，到点后执行）

| 想用的域名 | 记录类型 | 指向 | 备注 |
|---|---|---|---|
| `openwkv.xyz`（根域，主） | **A 记录** ×4 | `185.199.108.153` / `185.199.109.153` / `185.199.110.153` / `185.199.111.153` | GitHub Pages 四个专用 IP；根域不用 CNAME |
| `www.openwkv.xyz`（可选） | **CNAME 记录** | `OpenWuKongverse.github.io` | 建议指向 Pages 优先 |

> ⚠️ GitHub 官方：**根域（apex）用 A 记录**，不能用 CNAME。子域（www）用 CNAME。若用 `www` 指向 GitHub，GitHub 会自动关联根域。

### 5.3 Dynadot 操作步骤
1. 登录 Dynadot → **我的域名（My Domains）** → 点 `openwkv.xyz` → **管理（Manage）**。
2. 进入 **DNS 设置 / 自定义 DNS（DNS Settings）**。
3. 添加记录：
   - **A 记录** ×4，主机 `@`：`185.199.108.153` / `185.199.109.153` / `185.199.110.153` / `185.199.111.153`
   - （可选）**CNAME**，主机 `www` → `OpenWuKongverse.github.io`
4. **删除**先前默认/占位解析（`@ → 旧 IP` 等冲突项）。
5. 保存。DNS 生效最长 24 小时（通常更快）。
> HTTPS：GitHub Pages 侧勾 **Enforce HTTPS**（根发布自动免费证书）。

---

*End of PUBLIC-LAUNCH · OWKV-PUBLIC-LAUNCH · 公开时间 2026-08-24 17:00 · 状态：试运行*