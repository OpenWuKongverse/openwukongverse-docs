/* =========================================================
   OpenWuKongVerse · HUB · 沉浸式阅读器（reader.html）
   - 路由：reader.html?piece=<id>  （清单：assets/data/gallery.json，手工维护）
   - 外壳：元信息栏 / 三模态切换（A/B/C）/ 出站链接 / 上下篇 / 键盘翻页
   - 渲染器（按 piece.format 分发）：
       prose     → 小说（连续段落）
       script    → 脚本（场次 / 对白排版）
       single    → 单张美术（点开放大档）
       longstrip → 长条漫（纵向连滚 + 连载切集）
   - 正文来源：body.type=markdown 时抓 body.path 的原始 md，按 body.anchor 抽小节
   - 双语：沿用 .zhonly / .enonly（i18n.js 控制 html[data-lang]）
   - 红线：本站只展示 + 外链，不建站内讨论区 / 投票（讨论→Discord，投票→三平台）
   - 不存原图：美术一律走 WebP 展示档 / 放大档
   ========================================================= */
(function () {
  'use strict';

  var CATALOG = 'assets/data/gallery.json';

  var elMain   = document.getElementById('readerMain');
  var elMiss   = document.getElementById('readerMissing');
  var elTitle  = document.getElementById('readerTitle');
  var elMeta   = document.getElementById('readerMeta');
  var elBody   = document.getElementById('readerBody');
  var elLinks  = document.getElementById('readerLinks');
  var elPager  = document.getElementById('readerPager');
  var elModes  = document.getElementById('readerModes');
  if (!elMain) return;                       // 非阅读器页面，静默退出

  var STATUS_TXT = {
    canon:   { zh: '已入正典', en: 'Canon',      cls: 'ok'   },
    sandbox: { zh: '已入沙盒', en: 'Sandbox',    cls: 'info' },
    review:  { zh: '评议中',   en: 'In review',  cls: 'warn' }
  };
  var KIND_TXT = {
    text:  { zh: '文字', en: 'Text'  },
    image: { zh: '图像', en: 'Image' }
  };
  var FORMAT_TXT = {
    prose:     { zh: '小说',    en: 'Novel'      },
    script:    { zh: '脚本',    en: 'Script'     },
    single:    { zh: '单张美术', en: 'Artwork'    },
    longstrip: { zh: '长条漫',  en: 'Long strip' }
  };
  var MODE_TXT = {
    A: { zh: 'A · 赛博',       en: 'A · Cyber'       },
    B: { zh: 'B · 高维玄幻',   en: 'B · High-Fantasy' },
    C: { zh: 'C · 废土克苏鲁', en: 'C · Wasteland-Cthulhu' }
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }
  function bi(obj) {
    if (!obj) return '';
    return '<span class="zhonly">' + esc(obj.zh || '') + '</span>' +
           '<span class="enonly">' + esc(obj.en || obj.zh || '') + '</span>';
  }
  function lang() {
    return document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'zh';
  }

  /* ---------- 极简 markdown → HTML（只覆盖正典文档实际用到的子集） ---------- */
  function inline(md) {
    var s = esc(md);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }
  function mdToHtml(md) {
    var lines = String(md).replace(/\r\n/g, '\n').split('\n');
    var out = [], i = 0;
    function flushP(buf) {
      if (buf.length) { out.push('<p>' + inline(buf.join(' ')) + '</p>'); buf.length = 0; }
    }
    var pbuf = [];
    while (i < lines.length) {
      var ln = lines[i];
      if (/^\s*$/.test(ln)) { flushP(pbuf); i++; continue; }
      // 表格
      if (/^\s*\|/.test(ln) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        flushP(pbuf);
        var head = splitRow(ln); i += 2;
        var rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
        out.push('<div class="rd-tablewrap"><table class="rd-table"><thead><tr>' +
          head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr data-rdrow="' + esc(r[0] || '') + '">' +
              r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table></div>');
        continue;
      }
      var h = /^(#{1,4})\s+(.*)$/.exec(ln);
      if (h) { flushP(pbuf); out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'); i++; continue; }
      if (/^\s*>\s?/.test(ln)) {
        flushP(pbuf);
        var q = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        out.push('<blockquote>' + inline(q.join(' ')) + '</blockquote>');
        continue;
      }
      if (/^\s*---+\s*$/.test(ln)) { flushP(pbuf); out.push('<hr class="rd-hr">'); i++; continue; }
      var li = /^\s*[-*]\s+(.*)$/.exec(ln), ol = /^\s*\d+\.\s+(.*)$/.exec(ln);
      if (li || ol) {
        flushP(pbuf);
        var ordered = !!ol, items = [];
        while (i < lines.length) {
          var m2 = ordered ? /^\s*\d+\.\s+(.*)$/.exec(lines[i]) : /^\s*[-*]\s+(.*)$/.exec(lines[i]);
          if (!m2) break;
          items.push('<li>' + inline(m2[1]) + '</li>'); i++;
        }
        out.push((ordered ? '<ol>' : '<ul>') + items.join('') + (ordered ? '</ol>' : '</ul>'));
        continue;
      }
      pbuf.push(ln.trim()); i++;
    }
    flushP(pbuf);
    return out.join('\n');
  }
  function splitRow(ln) {
    return ln.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
  }

  /* ---------- 从源 md 抽小节（按 body.anchor 匹配 ### 标题） ---------- */
  function extractSection(md, anchor) {
    if (!anchor) return md;
    var lines = md.split('\n');
    var start = -1, level = 0;
    for (var i = 0; i < lines.length; i++) {
      var m = /^(#{1,4})\s+(.*)$/.exec(lines[i]);
      if (m && m[2].indexOf(anchor) === 0) { start = i + 1; level = m[1].length; break; }
      if (m && new RegExp('^' + anchor + '\\b').test(m[2])) { start = i + 1; level = m[1].length; break; }
    }
    if (start < 0) return md;                       // 找不到就整篇返回
    var end = lines.length;
    for (var j = start; j < lines.length; j++) {
      var m3 = /^(#{1,4})\s+/.exec(lines[j]);
      if (m3 && m3[1].length <= level) { end = j; break; }
    }
    return lines.slice(start, end).join('\n').trim();
  }

  /* ---------- 元信息栏 ---------- */
  function renderMeta(p) {
    var st = STATUS_TXT[p.status] || { zh: p.status, en: p.status, cls: '' };
    var kind = KIND_TXT[p.kind] || { zh: p.kind, en: p.kind };
    var fmt = FORMAT_TXT[p.format] || { zh: p.format, en: p.format };
    var chips = [];
    chips.push('<span class="rd-chip rd-status ' + esc(st.cls) + '"><i></i>' + bi(st) + '</span>');
    chips.push('<span class="rd-chip">' + bi(kind) + ' · ' + bi(fmt) + '</span>');
    if (p.anchor && p.anchor.node) {
      chips.push('<span class="rd-chip rd-anchor">' +
        esc(p.anchor.node) + (p.anchor.seams && p.anchor.seams.length ? ' · ' + esc(p.anchor.seams.join('/')) : '') +
        '</span>');
    }
    if (p.modes && p.modes.length) {
      chips.push('<span class="rd-chip">' + esc(p.modes.join(' / ')) + '</span>');
    }
    elMeta.innerHTML = chips.join('');
  }

  /* ---------- 三模态切换 ---------- */
  function renderModes(p, state) {
    if (!elModes) return;
    if (!p.modes || p.modes.length < 2) { elModes.innerHTML = ''; return; }
    var html = '<span class="rd-modes-label"><span class="zhonly">模态</span><span class="enonly">Mode</span></span>';
    html += '<button class="rd-mode' + (!state.mode ? ' on' : '') + '" data-mode="">' +
      '<span class="zhonly">全部</span><span class="enonly">All</span></button>';
    p.modes.forEach(function (m) {
      var t = MODE_TXT[m] || { zh: m, en: m };
      html += '<button class="rd-mode' + (state.mode === m ? ' on' : '') + '" data-mode="' + esc(m) + '">' + bi(t) + '</button>';
    });
    elModes.innerHTML = html;
    elModes.querySelectorAll('.rd-mode').forEach(function (b) {
      b.addEventListener('click', function () {
        state.mode = b.getAttribute('data-mode');
        renderModes(p, state);
        applyMode(p, state);
      });
    });
  }
  // 若正文是「模态对照表」形态的行，按选中模态过滤行
  function applyMode(p, state) {
    var rows = elBody.querySelectorAll('tr[data-rdrow]');
    if (!rows.length) return;
    rows.forEach(function (tr) {
      var key = tr.getAttribute('data-rdrow') || '';
      if (!state.mode) { tr.hidden = false; return; }
      var letter = (state.mode + ' ').slice(0, 1);
      var hit = new RegExp('^\\*{0,2}' + letter + '\\b').test(key.replace(/\*/g, ''));
      var keep = hit || /坍缩|关联|Collapse/i.test(key);
      tr.hidden = !keep;
    });
  }

  /* ---------- 出站链接（红线：只外链，站内不建讨论/投票） ---------- */
  function renderLinks(p) {
    var L = p.links || {}, out = [];
    if (L.discord) out.push('<a class="rd-out rd-discord" href="' + esc(L.discord) + '" target="_blank" rel="noopener noreferrer"><span class="zhonly">去 Discord 讨论</span><span class="enonly">Discuss on Discord</span></a>');
    (L.vote || []).forEach(function (v) {
      if (!v || !v.url) return;
      out.push('<a class="rd-out" href="' + esc(v.url) + '" target="_blank" rel="noopener noreferrer"><span class="zhonly">去 ' + esc(v.platform || '平台') + ' 投票</span><span class="enonly">Vote on ' + esc(v.platform || 'platform') + '</span></a>');
    });
    if (L.github) out.push('<a class="rd-out" href="' + esc(L.github) + '" target="_blank" rel="noopener noreferrer"><span class="zhonly">来源 / 留痕</span><span class="enonly">Source</span></a>');
    if (!out.length) {
      out.push('<span class="rd-out rd-none"><span class="zhonly">暂无外链（讨论入口待挂）</span><span class="enonly">No external links yet</span></span>');
    }
    elLinks.innerHTML = out.join('');
  }

  /* ---------- 上下篇 ---------- */
  function renderPager(list, idx) {
    if (!elPager) return;
    var prev = list[idx - 1], next = list[idx + 1];
    var html = '';
    html += prev
      ? '<a class="rd-pg rd-pg-prev" href="reader.html?piece=' + esc(prev.id) + '">← ' + bi(prev.title) + '</a>'
      : '<span class="rd-pg rd-pg-off">←</span>';
    html += next
      ? '<a class="rd-pg rd-pg-next" href="reader.html?piece=' + esc(next.id) + '">' + bi(next.title) + ' →</a>'
      : '<span class="rd-pg rd-pg-off">→</span>';
    elPager.innerHTML = html;
  }

  /* ---------- 渲染器分发 ---------- */
  function renderBody(p, section) {
    elBody.className = 'reader-body rd-' + p.format;
    var html = '';
    switch (p.format) {
      case 'script':    html = mdToHtml(section); break;                 // 脚本：场次/对白沿用 md 结构
      case 'single':    html = renderSingle(p, section); break;
      case 'longstrip': html = renderLongstrip(p); break;
      default:          html = mdToHtml(section);                        // prose
    }
    elBody.innerHTML = html;
    if (p.format === 'single' || p.format === 'longstrip') bindZoom(elBody);
  }

  function renderSingle(p, section) {
    var src = (p.media && p.media.display) || '';
    var zoom = (p.media && p.media.zoom) || src;
    var out = '';
    if (src) {
      out += '<figure class="rd-art"><img class="rd-art-img" src="' + esc(src) + '" alt="' + esc(p.title && p.title.zh || '') + '" loading="lazy" data-zoom="' + esc(zoom) + '"></figure>';
    } else {
      out += '<div class="panel dim"><span class="zhonly">暂无展示图（作品本体待上传至 B2 / 缩略入库）</span><span class="enonly">No display image yet</span></div>';
    }
    if (section) out += '<div class="rd-note">' + mdToHtml(section) + '</div>';
    return out;
  }

  function renderLongstrip(p) {
    var eps = (p.media && p.media.episodes) || [];
    if (!eps.length) {
      return '<div class="panel dim"><span class="zhonly">暂无连载内容（待首件连续动漫展示版上线）</span><span class="enonly">No episodes yet</span></div>';
    }
    var out = '<div class="rd-eps" id="rdEps">';
    eps.forEach(function (e, i) {
      out += '<button class="rd-ep' + (i === 0 ? ' on' : '') + '" data-ep="' + i + '"><span class="zhonly">第 ' + esc(e.no != null ? e.no : i + 1) + ' 话</span><span class="enonly">Ep ' + esc(e.no != null ? e.no : i + 1) + '</span></button>';
    });
    out += '</div><div class="rd-strip" id="rdStrip"></div>';
    // 延迟填充（等 DOM 挂载后绑定）
    setTimeout(function () {
      var strip = document.getElementById('rdStrip');
      var btns = document.querySelectorAll('.rd-ep');
      function show(i) {
        var e = eps[i];
        strip.innerHTML = (e.images || []).map(function (src) {
          return '<img class="rd-art-img" src="' + esc(src) + '" loading="lazy" data-zoom="' + esc(src) + '">';
        }).join('') || '<div class="panel dim">—</div>';
        btns.forEach(function (b, k) { b.classList.toggle('on', k === i); });
        bindZoom(strip);
      }
      btns.forEach(function (b) {
        b.addEventListener('click', function () { show(parseInt(b.getAttribute('data-ep'), 10) || 0); });
      });
      if (btns.length) show(0);
    }, 0);
    return out;
  }

  /* ---------- 点击放大 ---------- */
  function bindZoom(scope) {
    scope.querySelectorAll('img[data-zoom]').forEach(function (img) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () {
        var box = document.createElement('div');
        box.className = 'rd-lightbox';
        box.innerHTML = '<img src="' + esc(img.getAttribute('data-zoom') || img.src) + '">';
        box.addEventListener('click', function () { box.remove(); });
        document.body.appendChild(box);
      });
    });
  }

  /* ---------- 抓取正文 ---------- */
  function loadBody(p) {
    var b = p.body || {};
    if (b.type === 'markdown' && b.path) {
      return fetch(b.path, { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (md) { return extractSection(md, b.anchor || ''); })
        .catch(function () {
          return '> ' + (lang() === 'en' ? 'Body source unavailable.' : '正文来源暂时不可用。');
        });
    }
    if (b.type === 'html' && b.html) return Promise.resolve(b.html);
    return Promise.resolve(b.text || '');
  }

  /* ---------- 主流程 ---------- */
  fetch(CATALOG, { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (cat) {
      var list = cat.pieces || [];
      var id = qs('piece');
      var idx = -1;
      for (var i = 0; i < list.length; i++) { if (list[i].id === id) { idx = i; break; } }
      if (idx < 0) {
        if (!id && list.length) { idx = 0; }        // 无参数：给第一件
      }
      if (idx < 0) { elMiss.hidden = false; return; }

      var p = list[idx];
      var state = { mode: '' };
      elMiss.hidden = true;
      elMain.hidden = false;

      elTitle.innerHTML = bi(p.title);
      document.title = (p.title && (p.title.zh || p.title.en) || 'Reader') + ' · OpenWuKongVerse';
      renderMeta(p);
      renderModes(p, state);
      renderLinks(p);
      renderPager(list, idx);

      loadBody(p).then(function (section) {
        renderBody(p, section);
        applyMode(p, state);
      });

      // 键盘翻页：← / →
      document.addEventListener('keydown', function (e) {
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        if (e.key === 'ArrowLeft' && list[idx - 1]) location.href = 'reader.html?piece=' + encodeURIComponent(list[idx - 1].id);
        if (e.key === 'ArrowRight' && list[idx + 1]) location.href = 'reader.html?piece=' + encodeURIComponent(list[idx + 1].id);
      });
    })
    .catch(function () { elMiss.hidden = false; });
})();
