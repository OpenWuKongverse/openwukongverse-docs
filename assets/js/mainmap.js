/* =========================================================
   OpenWuKongVerse · HUB · 悟空宇宙主线地图（地铁星图）
   - 静态内置 20 节点（N1–N20）+ 27 介入缝（A1–A13 / B1–B6 / C1–C8）
     数据源：01-canon/mainline-event-map.md、01-canon/intervention-index.md
   - 实时状态：GET /api/proposals（公开看板接口，已有，无需后端改动）
   - 节点点击 → 抽屉：正典概要 / 介入缝（含状态色）/ 接续点
   - 空闲缝「一键创作」→ personal.html?...预填（第 3 步接收端）
   - 双语遵循 .zhonly / .enonly 模式（i18n.js 控制）
   - 挂载点：<div id="mainmap"> + <div id="mainmapDrawer">
   ========================================================= */
(function () {
  'use strict';
  var API = 'https://join.openwkv.xyz';
  var mount = document.getElementById('mainmap');
  if (!mount) return;
  var drawer = document.getElementById('mainmapDrawer');

  /* ---------- 1) 静态正典数据（不编造，来自正典文档） ---------- */

  // 三幕
  var ACTS = [
    { id: 1, zh: '第一幕 · 熵增预警', en: 'Act I · Entropy Warning' },
    { id: 2, zh: '第二幕 · 纠错授权', en: 'Act II · Correction Mandate' },
    { id: 3, zh: '第三幕 · 纠错执行', en: 'Act III · Correction Run' }
  ];

  // 20 节点：act / 名称 / 系统定位 / 概要（观象域呈现）/ 关联介入缝编号
  var NODES = [
    { n: 1, act: 1, zh: '真空泡泄漏', en: 'Vacuum-Bubble Leak', sys: '局部真空泡（Level 1）被非法改写',
      brief_zh: '真空泡边界出现常数篡改 / 能量泄漏（Memory-Leak 初现）；观象域：妖气四起、乱世萌芽。', brief_en: 'Bubble boundary constants tampered; a Memory-Leak begins. In the observed domain: turmoil stirs.',
      seams: ['A1', 'C4'] },
    { n: 2, act: 1, zh: '天条失序', en: 'Order Decrees Fail', sys: '天庭（Level 4）注入的秩序常数衰减',
      brief_zh: 'Admin 子系统的天条迭代失灵，观测异常增多；观象域：天庭朝议不安、玉帝观测到妖魔蔓延。', brief_en: 'The Admin subsystem\'s decree iteration fails; anomalies multiply. In the observed domain: unease in the celestial court.',
      seams: ['A2', 'B_n2'] },
    { n: 3, act: 1, zh: '熵增警报复核', en: 'Entropy Alarm Review', sys: '系统全局熵监测（贯穿五层膜）',
      brief_zh: '序态自稳系统监测到熵增超阈值，进入「需纠错」状态；观象域：灵山开始酝酿西行之事。', brief_en: 'Entropy exceeds threshold; the self-stabilizing system enters a "correction needed" state.',
      seams: ['C3'] },
    { n: 4, act: 2, zh: '悟空出世', en: 'Wukong Appears', sys: '异常体（Quantum-Anomaly-01）具现，未定型',
      brief_zh: '高维异常量子态在凡间（Level 3）具现为低维进程；来源不明＝起源钩子，具先天分裂属性。观象域：石猴出世、目运金光、惊动天庭。', brief_en: 'A high-dimensional anomalous quantum state materializes as a low-dimensional process; origin unknown = origin hook.',
      seams: ['B1', 'C8'] },
    { n: 5, act: 2, zh: '水帘洞称王', en: 'King of Water-Curtain Cave', sys: '进程自检 / 自组织（守护形态·自主初始化）',
      brief_zh: '悟空初始化自身进程，自主选择守护职责，建立局部运行环境（花果山＝局部真空泡）。观象域：探水帘洞、称美猴王。', brief_en: 'Wukong initializes himself, choosing a guardian role and building a local runtime (Flower-Fruit Mountain = a local vacuum bubble).',
      seams: ['A3'] },
    { n: 6, act: 2, zh: '拜师菩提', en: 'Bodhi Initiation', sys: '隐秘 Root（Level 4.5）越权授艺（能力注入）',
      brief_zh: '菩提祖师（隐秘 Root）对悟空注入越权能力参数；越权释放时引动逆维度能量（不可言说）。观象域：灵台方寸山学艺。', brief_en: 'Bodhi (a hidden Root) injects unauthorized capability params; the release stirs reverse-dimensional energy.',
      seams: ['C1'] },
    { n: 7, act: 2, zh: '大闹天宫', en: 'Havoc in Heaven', sys: '权限越界（破维度形态·逆维度能量冲击）',
      brief_zh: '悟空以破维度形态冲击 Admin 子系统，被系统视为破坏性威胁。观象域：闹龙宫地府、齐天大圣、大闹天宫。', brief_en: 'Wukong strikes the Admin subsystem in a dimension-breaking form, seen by the system as a destructive threat.',
      seams: ['B2'] },
    { n: 8, act: 2, zh: '五行山', en: 'Five-Element Mountain', sys: '维度奇点 / 权限锁（桥·时空锚点奇点）',
      brief_zh: 'Root 借低维进程将悟空压入维度奇点（权限锁），隔离冻结其破维度形态（不删除：异常资源有价值）。观象域：如来压五行山、贴六字真言。', brief_en: 'Root seals Wukong into a dimensional singularity (permission lock), isolating his dimension-breaking form without deleting it.',
      seams: ['C2', 'A4'] },
    { n: 9, act: 2, zh: '组队装配', en: 'Team Assembly', sys: '纠错小队进程装配',
      brief_zh: '唐僧（熵减稳定器＝纠错触发载体）为队长，装配悟空（多态进程）、八戒（数据缓冲）、沙僧（日志归档）、白龙马（传输信道）。观象域：观音点化、收徒。', brief_en: 'Tang Monk leads; Wukong (multi-form process), Bajie (buffer), Wujing (log archive), White Dragon Horse (transmission channel) are assembled.',
      seams: ['A5'] },
    { n: 10, act: 2, zh: '紧箍咒授锁', en: 'Headband Lock', sys: '维度锁（授权边界锁 + 破维度形态限制）',
      brief_zh: 'Root 级授权给唐僧「维度锁」（紧箍咒），约束多态进程执行范围。观象域：观音给悟空戴紧箍。', brief_en: 'Root authorizes Tang Monk a "dimensional lock" (the headband) to constrain the multi-form process\'s execution scope.',
      seams: ['A6'] },
    { n: 11, act: 3, zh: '鹰愁涧·白龙马', en: 'Eagle-Sorrow Stream', sys: '传输信道装配测试',
      brief_zh: '测试跨维度传输介质（白龙马）接入链路。观象域：小白龙吞马、观音收为坐骑。', brief_en: 'Testing the cross-dimensional transmission medium (the White Dragon Horse).',
      seams: ['A7'] },
    { n: 12, act: 3, zh: '黑风山·战熊罴', en: 'Black-Wind Mountain', sys: '局部真空泡治理测试①',
      brief_zh: '处置一个局部真空泡（洞府）内的 Memory-Leak。观象域：黑风怪盗袈裟、悟空斗熊罴。', brief_en: 'Handling a Memory-Leak inside a local vacuum bubble (a cave-dwelling).',
      seams: ['A8'] },
    { n: 13, act: 3, zh: '黄风岭·黄风怪', en: 'Yellow-Wind Ridge', sys: '风类异常进程测试',
      brief_zh: '测试高维能量异常（风类进程）在授权范围内的处置。观象域：黄风怪摄唐僧、灵吉菩萨收风。', brief_en: 'Testing how a wind-class high-dimensional anomaly is handled within authorization scope.',
      seams: ['A9', 'B13'] },
    { n: 14, act: 3, zh: '流沙河·沙僧入队', en: 'Quicksand River', sys: '日志归档进程装配测试',
      brief_zh: '装配日志归档（沙僧）并恢复被吞没的历史日志。观象域：流沙河怪阻路、收为徒。', brief_en: 'Assembling the log-archive process (Wujing) and recovering swallowed history logs.',
      seams: ['A10'] },
    { n: 15, act: 3, zh: '五庄观·人参果', en: 'Five-Villa Temple', sys: '高维资源（权限）测试',
      brief_zh: '测试对高维珍稀资源（人参果＝高价值信息聚合体）的处置权限。观象域：偷果、推倒树、观音救树。', brief_en: 'Testing the handling rights over a high-value information aggregate (the ginseng fruit).',
      seams: ['A11'] },
    { n: 16, act: 3, zh: '三打白骨精', en: 'Three Strikes on White-Bone', sys: '伪装型 Memory-Leak 测试',
      brief_zh: '处置一个伪装 / 诱骗型异常进程（多次局部改写）。观象域：白骨精三次变化、唐僧误解、悟空被逐。', brief_en: 'Handling a disguise/deception-type anomalous process; in the observed domain Wukong is exiled.',
      seams: ['B3', 'A12'] },
    { n: 17, act: 3, zh: '火焰山·芭蕉扇', en: 'Flaming Mountain', sys: '维度奇点（火焰）治理测试',
      brief_zh: '处置一个维度奇点级别的火焰异常（局部时间 / 能量异常）。观象域：借芭蕉扇、三调、熄火焰山。', brief_en: 'Handling a singularity-class fire anomaly (local time/energy anomaly).',
      seams: ['B4'] },
    { n: 18, act: 3, zh: '真假美猴王', en: 'True and False Wukong', sys: '纠错进程自检 / 双进程测试',
      brief_zh: '多态进程遇到「镜像进程」（二心 / 假悟空），校验进程自身一致性；分裂属性具现化钩子。观象域：六耳猕猴、真假猴王、如来辨明。', brief_en: 'The multi-form process meets a "mirror process"; a hook for the splitting attribute.',
      seams: ['C5', 'B5'] },
    { n: 19, act: 3, zh: '通天河·落水', en: 'Heaven-Reaching River', sys: '传输链路末端测试',
      brief_zh: '测试传输信道在完成后段的可靠性。观象域：老鼋驮渡、因失信落水、经书受损。', brief_en: 'Testing transmission-channel reliability in the final stretch; the scriptures are damaged.',
      seams: ['A13', 'C6'] },
    { n: 20, act: 3, zh: '取经完成·封赏', en: 'Completion & Investiture', sys: '官方收敛线（心跳成功）',
      brief_zh: '纠错链路完成，系统完成一次自稳心跳（低熵恢复），各方受限权限兑现。观象域：灵山取经、师徒受封。', brief_en: 'The correction chain completes; the system finishes a self-stabilizing heartbeat.',
      seams: ['C7', 'B6'] }
  ];

  // 27 介入缝（A/B/C）——含所属节点、可写方向、上手难度
  var SEAMS = {
    A1:  { node: 1,  cls: 'A', zh: '真空泡泄漏前传细节', en: 'Bubble-leak prequel detail', dir_zh: '某个洞府泄漏的开始 / 来历', dir_en: 'How one cave-dwelling leak began' },
    A2:  { node: 2,  cls: 'A', zh: '天庭内部失序支线', en: 'Celestial-court disorder branch', dir_zh: '天条衰减期间天庭朝议 / 观测异常', dir_en: 'Court debates amid decree decay' },
    A3:  { node: 5,  cls: 'A', zh: '花果山生态群猴支线', en: 'Flower-Fruit Mountain ecology', dir_zh: '花果山（局部真空泡）生态、群猴故事', dir_en: 'Ecology and monkey-tribe tales' },
    A4:  { node: 8,  cls: 'A', zh: '五行山五百年·看守过客', en: '500 years under the mountain', dir_zh: '被囚者视角、五百年间未记录的看守 / 过客', dir_en: 'Prisoner\'s view; unrecorded guards and passers-by' },
    A5:  { node: 9,  cls: 'A', zh: '各成员装配前个人前史', en: 'Members\' pre-assembly histories', dir_zh: '唐僧 / 八戒 / 沙僧 / 白龙马被装配前的往事', dir_en: 'Backstories of the team members' },
    A6:  { node: 10, cls: 'A', zh: '紧箍咒运作细节支线', en: 'Headband mechanics', dir_zh: '「受限授权」如何实际约束杀毒进程', dir_en: 'How restricted authorization constrains the process' },
    A7:  { node: 11, cls: 'A', zh: '白龙马受罚前史', en: 'White Dragon Horse\'s backstory', dir_zh: '西海三太子（传输信道）的受罚由来', dir_en: 'Origin of the dragon prince\'s punishment' },
    A8:  { node: 12, cls: 'A', zh: '黑风山洞府物理设定', en: 'Black-Wind cave physics', dir_zh: '黑风山（局部真空泡）的奇异规则', dir_en: 'Strange rules inside the bubble' },
    A9:  { node: 13, cls: 'A', zh: '妖怪异常类别·为何借外援', en: 'Anomaly class & outside help', dir_zh: '黄风怪的风类异常为何无法单靠悟空处置', dir_en: 'Why outside aid was needed' },
    A10: { node: 14, cls: 'A', zh: '沙僧卷帘失手 / 流沙河日志残片', en: 'Wujing\'s fall & log fragments', dir_zh: '沙僧（日志归档）失手历史、被吞没的日志残片', dir_en: 'His failure history and swallowed log fragments' },
    A11: { node: 15, cls: 'A', zh: '人参果资源本质', en: 'Ginseng-fruit resource nature', dir_zh: '人参果（高维信息聚合体）的处置权限边界', dir_en: 'Handling-rights boundary of a high-value aggregate' },
    A12: { node: 16, cls: 'A', zh: '被逐期间悟空支线', en: 'Wukong during exile', dir_zh: '三打白骨精后被逐期间，悟空在哪 / 做了什么（卷4 点名空白区）', dir_en: 'Where Wukong went and what he did after exile (a named blank)' },
    A13: { node: 19, cls: 'A', zh: '老鼋之约契约支线', en: 'Old-turtle pact', dir_zh: '通天河老鼋的契约承诺、违约的代价', dir_en: 'The pact\'s promise and the cost of breaking it' },

    B1:  { node: 4,  cls: 'B', zh: '悟空出世的三模态开端', en: 'Appearance in three modes', dir_zh: 'A 异常程序自举 / B 天地灵胎 / C 裂隙异物', dir_en: 'A program bootstrap / B heaven-earth embryo / C rift anomaly' },
    B2:  { node: 7,  cls: 'B', zh: '大闹天宫三模态', en: 'Havoc in three modes', dir_zh: 'A 越权攻击云端 / B 神魔大战 / C 撕扯残存秩序', dir_en: 'A cloud breach / B divine war / C rending old order' },
    B3:  { node: 16, cls: 'B', zh: '三打白骨精·「伪装」本质', en: 'Disguise in three modes', dir_zh: 'A 程序伪装 / B 幻化 / C 窃取形态（差异最大节点）', dir_en: 'A program disguise / B illusion / C stolen form (max difference)' },
    B4:  { node: 17, cls: 'B', zh: '火焰山三模态', en: 'Flaming Mountain in three modes', dir_zh: 'A 损坏数据扇区 / B 天地火劫 / C 永燃废土', dir_en: 'A corrupted sector / B heaven-earth fire / C ever-burning wasteland' },
    B5:  { node: 18, cls: 'B', zh: '真假美猴王·「辨明」三模态', en: 'Discernment in three modes', dir_zh: 'A 镜像进程权威判定 / B 二心之争 / C 复制变异体判定', dir_en: 'A authoritative ruling / B two-minds quarrel / C variant identification' },
    B6:  { node: 20, cls: 'B', zh: '取经完成·「成功是否等值」', en: '"Success" across modes', dir_zh: 'A/B 稳态达成 / C 暂缓而非终结', dir_en: 'A/B steady state / C deferred, not ended' },

    C1:  { node: 6,  cls: 'C', zh: '菩提越权授艺因果', en: 'Bodhi\'s overreach causality', dir_zh: '菩提（隐秘 Root 钩子）为何越权授艺（建议保持神秘，只挖边界）', dir_en: 'Why Bodhi overreached (keep it mysterious)',
           hook: true },
    C2:  { node: 8,  cls: 'C', zh: '五行山＝维度奇点内部', en: 'Inside the singularity', dir_zh: '奇点内的时间 / 物理如何（须过架构师审查）', dir_en: 'Time and physics inside (architect review required)' },
    C3:  { node: 3,  cls: 'C', zh: '熵增阈值是谁定的', en: 'Who set the entropy threshold', dir_zh: '序态自稳系统如何「决定」触发纠错、阈值设定', dir_en: 'How the system "decides" to trigger correction' },
    C4:  { node: 1,  cls: 'C', zh: '真空泡从何而来', en: 'Where bubbles came from', dir_zh: '五层膜之外、局部真空泡的成因', dir_en: 'The origin of local vacuum bubbles' },
    C5:  { node: 18, cls: 'C', zh: '真假美猴王本体', en: 'The false Wukong\'s identity', dir_zh: '假悟空＝自我 / 旧我分裂的具现（来源开放，建议悬而不决）', dir_en: 'The false Wukong as a self/old-self split (left open)',
           hook: true },
    C6:  { node: 19, cls: 'C', zh: '经书受损后续影响', en: 'Damaged scriptures aftermath', dir_zh: '通天河落水经书信息缺损的系统后果', dir_en: 'Systemic fallout of the damaged scriptures' },
    C7:  { node: 20, cls: 'C', zh: '取经后的新循环', en: 'The cycle after pilgrimage', dir_zh: '系统进入稳态 or 熵增再度抬头（后传接缝）', dir_en: 'Steady state or renewed entropy (sequel seam)',
           hook: true },
    C8:  { node: 4,  cls: 'C', zh: '悟空异常体来源（起源钩子）', en: 'Origin of the anomaly', dir_zh: '异常体从何而来、分裂属性的起点（最早的缝，写边界不写答案）', dir_en: 'Where the anomaly came from (the earliest seam)',
           hook: true }
  };

  /* ---------- 2) 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // 归一化缝编号：DB 里可能写 "A08"，索引是 "A8"
  function normSeam(s) {
    if (!s) return '';
    var m = String(s).toUpperCase().match(/^([ABC])0*(\d{1,2})$/);
    return m ? (m[1] + m[2]) : String(s).toUpperCase();
  }
  // 归一化节点：DB 里可能写 "N12 三打白骨精" 或 "N12" 或 "12"
  function normNode(s) {
    if (s == null) return null;
    var m = String(s).toUpperCase().match(/N?\s*0*(\d{1,2})/);
    return m ? parseInt(m[1], 10) : null;
  }
  function lz(n) { return (n < 10 ? '0' : '') + n; }

  // 状态 → 颜色类（与 live-proposals.js 的 STATUS 口径一致）
  var STATUS_CLS = {
    pending:          'pending',
    approved_canon:   'canon',
    approved_sandbox: 'sandbox',
    rejected:         'rejected'
  };
  var STATUS_TXT = {
    pending:          { zh: '评议中', en: 'In Deliberation' },
    approved_canon:   { zh: '已入正典', en: 'In Canon' },
    approved_sandbox: { zh: '已入沙盒', en: 'In Sandbox' },
    rejected:         { zh: '已驳回', en: 'Declined' }
  };

  /* ---------- 3) 状态索引（来自实时提案） ---------- */
  // seatKey → {status, title, anon, issue}  （seatKey = "N12:A8" 等）
  var seatStatus = {};   // 精确到「节点+缝」
  var nodeStatus = {};   // 精确到「节点」（有任一相关提案即标记）
  var proposals  = [];

  function buildIndex(list) {
    proposals = list || [];
    seatStatus = {}; nodeStatus = {};
    proposals.forEach(function (p) {
      var nm = normNode(p.node);
      var seam = normSeam(p.seam_id);
      var st = p.status;
      var rec = { status: st, title: p.title, anon: p.anon_code, issue: p.github_issue_url };
      if (nm != null && seam) {
        var k = 'N' + nm + ':' + seam;
        // 同一缝多条：优先保留「进行中/已核准」（pending > approved > rejected）
        if (!seatStatus[k] || rank(st) > rank(seatStatus[k].status)) seatStatus[k] = rec;
      }
      if (nm != null) {
        var nk = 'N' + nm;
        if (!nodeStatus[nk] || rank(st) > rank(nodeStatus[nk].status)) nodeStatus[nk] = rec;
      }
    });
  }
  function rank(s) {
    return (s === 'approved_canon') ? 3 : (s === 'approved_sandbox') ? 3 : (s === 'pending') ? 2 : 1;
  }
  // 某缝的实时状态：仅认「节点+缝」精确匹配；节点级标记不外推到具体缝
  function seamState(nodeN, seamId) {
    return seatStatus['N' + nodeN + ':' + seamId] || null;
  }
  function dotCls(state) { return state ? ('dot-' + (STATUS_CLS[state.status] || 'pending')) : 'dot-free'; }
  function seatStateLabel(state) {
    if (!state) return { zh: '空闲 · 待认领', en: 'Open' };
    var t = STATUS_TXT[state.status] || { zh: state.status, en: state.status };
    return t;
  }

  // 「一键创作」目标按登录身份分流：创作者 → personal.html；观察者/未登录 → apply.html
  // 只预填 seam + node + nname（模态由创作者自己在表单里选，不瞎猜）
  function claimHref(sid, n, nameZh) {
    var q = '?seam=' + encodeURIComponent(sid) + '&node=N' + n +
            (nameZh ? '&nname=' + encodeURIComponent(nameZh) : '');
    var me = null;
    try { me = window.owkvAuth && window.owkvAuth.getMe(); } catch (e) {}
    var isCreator = !!(me && (me.creator || me.creator_apply === 'approved'));
    return (isCreator ? 'personal.html' : 'apply.html') + q;
  }

  /* ---------- 4) 渲染：横向地铁线 ---------- */
  function render() {
    var html = '';
    ACTS.forEach(function (act) {
      var nodes = NODES.filter(function (x) { return x.act === act.id; });
      html += '<div class="mm-act">' +
        '<div class="mm-actlabel zhonly">' + esc(act.zh) + '</div>' +
        '<div class="mm-actlabel enonly">' + esc(act.en) + '</div>' +
        '<div class="mm-line">';
      nodes.forEach(function (nd) {
        var nk = 'N' + nd.n;
        var st = nodeStatus[nk];
        var cls = st ? ('dot-' + (STATUS_CLS[st.status] || 'pending')) : 'dot-free';
        var cnt = nd.seams.length;
        html += '<button type="button" class="mm-station ' + cls + '" data-node="' + nd.n + '" ' +
          'aria-label="N' + nd.n + ' ' + esc(nd.zh) + '">' +
          '<span class="mm-dot"></span>' +
          '<span class="mm-idx">N' + nd.n + '</span>' +
          '<span class="mm-name zhonly">' + esc(nd.zh) + '</span>' +
          '<span class="mm-name enonly">' + esc(nd.en) + '</span>' +
          '<span class="mm-seams">' + cnt + ' <span class="zhonly">缝</span><span class="enonly">slots</span></span>' +
          '</button>';
      });
      html += '</div></div>';
    });
    mount.innerHTML = html;
    mount.querySelectorAll('.mm-station').forEach(function (btn) {
      btn.addEventListener('click', function () { openNode(parseInt(btn.getAttribute('data-node'), 10)); });
    });
  }

  /* ---------- 5) 抽屉：节点详情 ---------- */
  function openNode(n) {
    var nd = null;
    for (var i = 0; i < NODES.length; i++) { if (NODES[i].n === n) { nd = NODES[i]; break; } }
    if (!nd) return;
    var nk = 'N' + n;
    var nst = nodeStatus[nk];
    var rows = nd.seams.map(function (sid) {
      var sd = SEAMS[sid];
      if (!sd) return '';
      var st = seamState(n, sid);
      var label = seatStateLabel(st);
      var open = !st;
      var link = open
        ? '<a class="mm-claim btn small" href="' + esc(claimHref(sid, n, nd.zh)) + '">' +
            '<span class="zhonly">一键创作 →</span><span class="enonly">Create →</span></a>'
        : (st && st.issue
            ? '<a class="btn-link" href="' + esc(st.issue) + '" target="_blank" rel="noopener noreferrer"><span class="zhonly">GitHub 留痕 →</span><span class="enonly">Record →</span></a>'
            : '');
      return '<div class="mm-seamrow">' +
          '<span class="mm-seamcls cls-' + sd.cls + '">' + sd.cls + '</span>' +
          '<span class="mm-seamtxt"><strong>' + esc(sid) + ' · ' + esc(sd.zh) + '</strong>' +
            '<span class="dim zhonly"> — ' + esc(sd.dir_zh) + '</span>' +
            '<span class="dim enonly"> — ' + esc(sd.dir_en) + '</span>' +
            (sd.hook ? ' <span class="mm-hook zhonly">钩子·建议留白</span><span class="mm-hook enonly">hook · keep blank</span>' : '') +
          '</span>' +
          '<span class="mm-seamst dot ' + dotCls(st) + '"><i></i><span class="zhonly">' + esc(label.zh) + '</span><span class="enonly">' + esc(label.en) + '</span></span>' +
          link +
        '</div>';
    }).join('');

    // 接续点：该节点下所有相关提案（含精确缝匹配与节点级）
    var conts = proposals.filter(function (p) { return normNode(p.node) === n; });
    var contHtml = conts.length ? conts.map(function (p) {
      var stx = STATUS_TXT[p.status] || { zh: p.status, en: p.status };
      var links = [];
      if (p.discord_thread_url) links.push('<a class="btn-link" href="' + esc(p.discord_thread_url) + '" target="_blank" rel="noopener noreferrer"><span class="zhonly">去 Discord 评议 →</span><span class="enonly">Discuss →</span></a>');
      if (p.reddit_poll_url) links.push('<a class="btn-link" href="' + esc(p.reddit_poll_url) + '" target="_blank" rel="noopener noreferrer"><span class="zhonly">去 Reddit 投票 →</span><span class="enonly">Vote →</span></a>');
      if (p.github_issue_url) links.push('<a class="btn-link" href="' + esc(p.github_issue_url) + '" target="_blank" rel="noopener noreferrer"><span class="zhonly">GitHub 留痕 →</span><span class="enonly">Record →</span></a>');
      return '<div class="mm-controw">' +
          '<div class="mm-conttitle">' + esc(p.title || '—') + '</div>' +
          '<div class="dim mm-contmeta">' + esc(p.anon_code || '—') +
            ' · <span class="zhonly">' + esc(stx.zh) + '</span><span class="enonly">' + esc(stx.en) + '</span>' +
            (p.seam_id ? ' · ' + esc(p.seam_id) : '') + '</div>' +
          (links.length ? '<div>' + links.join(' ') + '</div>' : '') +
        '</div>';
    }).join('') : '<p class="dim"><span class="zhonly">该节点暂无已提交提案 —— 第一个来认领吧。</span><span class="enonly">No proposals on this node yet — claim the first.</span></p>';

    drawer.innerHTML =
      '<div class="mm-drawer-backdrop" data-mm-close></div>' +
      '<aside class="mm-drawer-panel" role="dialog" aria-modal="true">' +
        '<div class="mm-drawer-head">' +
          '<div>' +
            '<div class="mm-drawer-idx">N' + n + (nst ? ' · <span class="dot ' + dotCls(nst) + '"><i></i>' + (STATUS_TXT[nst.status] ? '<span class="zhonly">' + STATUS_TXT[nst.status].zh + '</span><span class="enonly">' + STATUS_TXT[nst.status].en + '</span>' : '') + '</span>' : '') + '</div>' +
            '<h3 class="zhonly">' + esc(nd.zh) + '</h3><h3 class="enonly">' + esc(nd.en) + '</h3>' +
            '<p class="dim mm-drawer-sys zhonly">系统定位：' + esc(nd.sys) + '</p>' +
          '</div>' +
          '<button class="mm-drawer-close" data-mm-close aria-label="close">×</button>' +
        '</div>' +
        '<div class="mm-sec">' +
          '<h4><span class="zhonly">正典概要</span><span class="enonly">Canon brief</span></h4>' +
          '<p class="zhonly">' + esc(nd.brief_zh) + '</p>' +
          '<p class="enonly dim">' + esc(nd.brief_en) + '</p>' +
        '</div>' +
        '<div class="mm-sec">' +
          '<h4><span class="zhonly">介入缝（可认领）</span><span class="enonly">Intervention slots</span></h4>' +
          (rows || '<p class="dim">—</p>') +
        '</div>' +
        '<div class="mm-sec">' +
          '<h4><span class="zhonly">接续点（该节点提案）</span><span class="enonly">Continuation (proposals here)</span></h4>' +
          contHtml +
        '</div>' +
      '</aside>';

    drawer.hidden = false;
    drawer.classList.add('open');
    drawer.querySelectorAll('[data-mm-close]').forEach(function (el) {
      el.addEventListener('click', closeDrawer);
    });
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.hidden = true;
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

  /* ---------- 6) 启动 ---------- */
  render(); // 先渲染静态骨架（离线也可看主线）
  fetch(API + '/api/proposals?status=all&limit=100')
    .then(function (r) { return r.json(); })
    .then(function (j) { buildIndex((j && j.proposals) || []); render(); })
    .catch(function () { /* 拉取失败：保留静态主线，不打扰 */ });
})();
