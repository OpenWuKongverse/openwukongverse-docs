/* =========================================================
   OpenWuKongVerse · HUB · 社区活跃提案看板（共享组件）
   - 读公开接口 GET /api/proposals，只展示索引级元数据
   - 评议/投票一律外导（Discord / Reddit），站内不建评论与投票
   - 挂载点：页面上任意 <div id="liveProposals" class="grid">
   ========================================================= */
(function () {
  'use strict';
  var API = 'https://join.openwkv.xyz';
  var mount = document.getElementById('liveProposals');
  if (!mount) return;

  var STATUS = {
    pending:          { zh: '评议中', en: 'In Deliberation' },
    approved_canon:   { zh: '已入正典', en: 'In Canon' },
    approved_sandbox: { zh: '已入沙盒', en: 'In Sandbox' },
    rejected:         { zh: '已驳回', en: 'Declined' }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function card(p) {
    var st = STATUS[p.status] || { zh: p.status, en: p.status };
    var links = [];
    if (p.discord_thread_url) {
      links.push('<a class="btn-link" href="' + esc(p.discord_thread_url) + '" target="_blank" rel="noopener noreferrer"><span class="zhonly">去 Discord 评议 →</span><span class="enonly">Discuss on Discord →</span></a>');
    }
    if (p.reddit_poll_url) {
      links.push('<a class="btn-link" href="' + esc(p.reddit_poll_url) + '" target="_blank" rel="noopener noreferrer"><span class="zhonly">去 Reddit 投票 →</span><span class="enonly">Vote on Reddit →</span></a>');
    }
    if (p.github_issue_url) {
      links.push('<a class="btn-link" href="' + esc(p.github_issue_url) + '" target="_blank" rel="noopener noreferrer"><span class="zhonly">GitHub 留痕 →</span><span class="enonly">GitHub record →</span></a>');
    }
    return '<div class="card">' +
      '<div class="tag">' + esc(st.zh) + ' · ' + esc(p.category || '—') + '</div>' +
      '<h3>' + esc(p.title || '—') + '</h3>' +
      '<p class="dim"><span class="zhonly">提案者</span><span class="enonly">By</span>: ' + esc(p.anon_code || '—') +
        (p.seam_id ? ' · <span class="zhonly">介入缝</span><span class="enonly">slot</span> ' + esc(p.seam_id) : '') + '</p>' +
      (links.length ? '<p>' + links.join(' ') + '</p>' : '') +
      '</div>';
  }

  fetch(API + '/api/proposals?status=all&limit=50')
    .then(function (r) { return r.json(); })
    .then(function (j) {
      var list = (j && j.proposals) || [];
      if (!list.length) {
        mount.innerHTML = '<p class="dim" style="grid-column:1/-1"><span class="zhonly">暂无活跃提案。登录后在个人创作中心提交第一个提案吧。</span><span class="enonly">No live proposals yet. Log in and be the first to submit one in the Creation Center.</span></p>';
        return;
      }
      mount.innerHTML = list.map(card).join('');
    })
    .catch(function () {
      mount.innerHTML = '<p class="dim" style="grid-column:1/-1"><span class="zhonly">加载失败，请稍后重试。</span><span class="enonly">Failed to load. Please retry later.</span></p>';
    });
})();
