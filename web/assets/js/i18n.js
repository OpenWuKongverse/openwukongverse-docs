/* =========================================================
   OpenWuKongVerse · Hub 门面站 · 多语言控制器
   - 手动语言切换（zh/en）：逐词人工把控，术语口径受控
   - 机器翻译预览开关：仅预览，非正式术语口径
   ========================================================= */
(function () {
  'use strict';

  var STORAGE_KEY = 'owkv-lang';

  function setLang(lang) {
    document.documentElement.setAttribute('data-lang', lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.querySelectorAll('.langbtn').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-lang') === lang);
    });
  }

  function initLang() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    var lang = (saved === 'en') ? 'en' : 'zh'; // 默认中文（发起方主语言）
    setLang(lang);
  }

  /* ---- 机器翻译预览（仅预览）---- */
  function initPreview() {
    var btn = document.querySelector('[data-preview]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var html = document.documentElement;
      html.classList.toggle('previewing');
      btn.textContent = html.classList.contains('previewing')
        ? (btn.getAttribute('data-on') || '预览中 · 关闭')
        : (btn.getAttribute('data-off') || '机器预览');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initLang();
    initPreview();

    // 语言切换按钮（zh / en 切换）
    document.querySelectorAll('.langbtn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lang = btn.getAttribute('data-lang');
        if (lang === 'zh' || lang === 'en') { setLang(lang); }
      });
    });
  });
})();