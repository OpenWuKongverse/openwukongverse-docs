/* =========================================================
   OpenWuKongVerse · HUB · 共创展示索引墙（gallery.html）
   - 数据源：assets/data/gallery.json（手工维护起步）
   - 按 piece.section 归入四个区块（sparks / stories / comics / art）
   - 卡片 → reader.html?piece=<id>（沉浸式阅读器）
   - 空区块保留 .gd-empty 占位（原「暂空」文案）
   - 双语沿用 .zhonly / .enonly
   - 红线：只展示 + 外链，站内不建讨论区 / 投票
   ========================================================= */
(function () {
  'use strict';

  var CATALOG = 'assets/data/gallery.json';
  var mounts = document.querySelectorAll('.gd-mount[data-section]');
  if (!mounts.length) return;                 // 非展示页，静默退出

  var STATUS_TXT = {
    canon:   { zh: '已入正典', en: 'Canon',     cls: 'ok'   },
    sandbox: { zh: '已入沙盒', en: 'Sandbox',   cls: 'info' },
    review:  { zh: '评议中',   en: 'In review', cls: 'warn' }
  };
  var FORMAT_TXT = {
    prose:     { zh: '小说',     en: 'Novel'      },
    script:    { zh: '脚本',     en: 'Script'     },
    single:    { zh: '单张美术', en: 'Artwork'    },
    longstrip: { zh: '长条漫',   en: 'Long strip' }
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function bi(obj) {
    if (!obj) return '';
    return '<span class="zhonly">' + esc(obj.zh || '') + '</span>' +
           '<span class="enonly">' + esc(obj.en || obj.zh || '') + '</span>';
  }

  function thumb(p) {
    var src = (p.media && (p.media.thumb || p.media.display)) || '';
    if (!src) return '<div class="gd-thumb gd-thumb-text"><span>' +
      (p.format === 'script' ? '脚本' : '文本') + '</span></div>';
    return '<div class="gd-thumb"><img src="' + esc(src) + '" alt="" loading="lazy"></div>';
  }

  function card(p) {
    var st = STATUS_TXT[p.status] || { zh: p.status, en: p.status, cls: '' };
    var fmt = FORMAT_TXT[p.format] || { zh: p.format, en: p.format };
    var anchor = p.anchor && p.anchor.node
      ? '<span class="gd-anchor">' + esc(p.anchor.node) +
        (p.anchor.seams && p.anchor.seams.length ? ' · ' + esc(p.anchor.seams.join('/')) : '') + '</span>'
      : '';
    var modes = (p.modes && p.modes.length)
      ? '<span class="gd-modes">' + esc(p.modes.join(' / ')) + '</span>' : '';
    return '' +
      '<a class="gd-card" href="reader.html?piece=' + encodeURIComponent(p.id) + '">' +
        thumb(p) +
        '<div class="gd-info">' +
          '<div class="gd-title">' + bi(p.title) + '</div>' +
          '<div class="gd-chips">' +
            '<span class="gd-status ' + esc(st.cls) + '"><i></i>' + bi(st) + '</span>' +
            '<span class="gd-fmt">' + bi(fmt) + '</span>' +
            anchor + modes +
          '</div>' +
        '</div>' +
      '</a>';
  }

  fetch(CATALOG, { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (cat) {
      var bySection = {};
      (cat.pieces || []).forEach(function (p) {
        var s = p.section || 'stories';
        (bySection[s] = bySection[s] || []).push(p);
      });
      mounts.forEach(function (m) {
        var list = bySection[m.getAttribute('data-section')] || [];
        if (!list.length) return;                // 保留原「暂空」占位
        var empty = m.querySelector('.gd-empty');
        if (empty) empty.remove();
        var grid = document.createElement('div');
        grid.className = 'gd-grid';
        list.forEach(function (p) { grid.insertAdjacentHTML('beforeend', card(p)); });
        m.appendChild(grid);
      });
    })
    .catch(function () { /* 静默：保留占位，不影响页面 */ });
})();
