/* =========================================================
   OpenWuKongVerse · HUB · 认证控制器（方案A 免密码 OTP + 30天长效登录）
   - 统一封装: send-otp / verify-otp / resend / /api/user/me / 登出
   - JWT 存 localStorage: owkv-token
   - 登录态渲染: 导航栏「观察者:邮箱前缀 | 积分」+ 个人中心抽屉
   - 双语: 遵循 .zhonly / .enonly 模式, 由 i18n.js 控制显示
   - 依赖: join.html 内表单元素 (见 joinAuth 挂载点)
   ========================================================= */
(function () {
  'use strict';

  var API = 'https://join.openwkv.xyz';
  var TOKEN_KEY = 'owkv-token';
  var ME_KEY = 'owkv-me';
  var TOKEN_TTL = 30 * 24 * 3600; // 30天, 与后端一致

  /* ---- Token 读写 ---- */
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try {
      if (t) { localStorage.setItem(TOKEN_KEY, t); }
      else { localStorage.removeItem(TOKEN_KEY); }
    } catch (e) {}
  }
  function getMe() {
    try { return JSON.parse(localStorage.getItem(ME_KEY) || 'null'); } catch (e) { return null; }
  }
  function setMe(m) {
    try { localStorage.setItem(ME_KEY, JSON.stringify(m)); } catch (e) {}
  }

  /* ---- 请求封装 ---- */
  function api(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) { return r.json(); });
  }

  /* ---- send-otp: 邮箱 + Turnstile + 选填资料 → 触发验证邮件 ---- */
  function sendOtp(payload) {
    return api('/api/auth/send-otp', { method: 'POST', body: payload });
  }

  /* ---- verify-otp: Token 回填 → 校验 → 签发/存 30天JWT ---- */
  function verifyOtp(payload) {
    return api('/api/auth/verify-otp', { method: 'POST', body: payload });
  }

  /* ---- /api/user/me: 带 JWT 拉取身份 + 积分 ---- */
  function fetchMe() {
    var t = getToken();
    if (!t) return Promise.reject(new Error('no_token'));
    return api('/api/user/me', { headers: { Authorization: 'Bearer ' + t } })
      .then(function (j) {
        if (j && j.ok) {
          // 缓存 user + points（points 用于导航 chip 积分显示）
          setMe(Object.assign({}, j.user, { points: j.points || { C1:0,C2:0,C3:0,C4:0,total:0 } }));
          return j;
        }
        return Promise.reject(new Error((j && j.error) || 'me_failed'));
      });
  }

  /* ---- 登出 ---- */
  function logout() {
    setToken('');
    setMe(null);
    renderNavAuth();
    onLogout && onLogout();
  }
  var onLogout = null;

  /* ---- 60秒重发倒计时 ---- */
  function startCountdown(btn, secs, onDone) {
    var remaining = secs;
    btn.disabled = true;
    btn.setAttribute('data-counting', '1');
    var tick = function () {
      if (remaining <= 0) {
        btn.disabled = false;
        btn.removeAttribute('data-counting');
        btn.textContent = btn.getAttribute('data-label') || '重新发送';
        btn.classList.remove('dimmed');
        onDone && onDone();
        return;
      }
      btn.textContent = (btn.getAttribute('data-label') || '重新发送') + ' (' + remaining + 's)';
      btn.classList.add('dimmed');
      remaining--;
      setTimeout(tick, 1000);
    };
    tick();
  }

  /* ---- 导航栏登录态渲染（所有页面共用） ---- */
  // 约定: 页面导航内放一个 <span id="navAuth"></span>; 无则跳过
  function renderNavAuth() {
    var mount = document.getElementById('navAuth');
    if (!mount) return;
    var me = getMe();
    var t = getToken();
    if (!t || !me) {
      mount.innerHTML = '';
      return;
    }
    var prefix = (me.email_masked || me.anon_code || 'user');
    var points = (me.points && me.points.total != null) ? me.points.total : 0;
    var uid = String(me.id || '');
    mount.innerHTML =
      '<button class="auth-chip" data-auth-open>' +
        '<span class="zhonly">观察者: ' + esc(prefix) + '</span>' +
        '<span class="enonly">Observer: ' + esc(prefix) + '</span>' +
        '<span class="auth-pts">' + ' ' + esc(points) + '</span>' +
      '</button>' +
      '<button class="auth-logout" data-auth-logout>' +
        '<span class="zhonly">登出</span><span class="enonly">Logout</span>' +
      '</button>';
    var chip = mount.querySelector('[data-auth-open]');
    if (chip) chip.addEventListener('click', openDrawer);
    var lo = mount.querySelector('[data-auth-logout]');
    if (lo) lo.addEventListener('click', function (e) { e.stopPropagation(); logout(); });
  }

  /* ---- 个人中心抽屉 ---- */
  var drawer = null;
  function ensureDrawer() {
    if (drawer) return drawer;
    drawer = document.createElement('div');
    drawer.className = 'auth-drawer';
    drawer.id = 'authDrawer';
    drawer.innerHTML =
      '<div class="auth-drawer-backdrop" data-auth-close></div>' +
      '<aside class="auth-drawer-panel">' +
        '<div class="auth-drawer-head">' +
          '<strong class="zhonly">个人中心</strong><strong class="enonly">Account</strong>' +
          '<button class="auth-drawer-close" data-auth-close>×</button>' +
        '</div>' +
        '<div id="authDrawerBody" class="auth-drawer-body"><p class="dim">加载中…</p></div>' +
      '</aside>';
    document.body.appendChild(drawer);
    drawer.addEventListener('click', function (e) {
      if (e.target.getAttribute && e.target.getAttribute('data-auth-close') != null) closeDrawer();
    });
    return drawer;
  }
  function openDrawer() {
    var d = ensureDrawer();
    d.classList.add('open');
    var body = document.getElementById('authDrawerBody');
    body.innerHTML = '<p class="dim">加载中…</p>';
    fetchMe().then(function (j) {
      renderDrawerBody(body, j.user, j.points);
    }).catch(function () {
      body.innerHTML = '<p class="dim">无法读取账户(会话可能已失效)。</p>';
    });
  }
  function closeDrawer() {
    if (drawer) drawer.classList.remove('open');
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function renderDrawerBody(body, user, points) {
    points = points || { total: 0 };
    var role = user.role_tag || '—';
    var mode = user.mode_tag || '—';
    var status = user.status || 'observer';
    body.innerHTML =
      '<div class="auth-row"><span class="zhonly dim">身份</span><span class="enonly dim">Status</span><strong>' + esc(status) + '</strong></div>' +
      '<div class="auth-row"><span class="zhonly dim">匿名代号</span><span class="enonly dim">Anon code</span><strong>' + esc(user.anon_code || '—') + '</strong></div>' +
      '<div class="auth-row"><span class="zhonly dim">邮箱</span><span class="enonly dim">Email</span><strong>' + esc(user.email_masked || '—') + '</strong></div>' +
      '<div class="auth-row"><span class="zhonly dim">主攻角色</span><span class="enonly dim">Role</span><strong>' + esc(role) + '</strong></div>' +
      '<div class="auth-row"><span class="zhonly dim">主攻模态</span><span class="enonly dim">Mode</span><strong>' + esc(mode) + '</strong></div>' +
      '<div class="auth-row"><span class="zhonly dim">累积积分</span><span class="enonly dim">Points</span><strong>' + esc(points.total) + '</strong></div>' +
      '<p class="dim" style="margin-top:.8rem;font-size:.78rem">' +
        '<span class="zhonly">C1 创作 ' + esc(points.C1 || 0) + ' · C2 质量 ' + esc(points.C2 || 0) + ' · C3 采用 ' + esc(points.C3 || 0) + ' · C4 生态 ' + esc(points.C4 || 0) + '</span>' +
        '<span class="enonly">C1 creation ' + esc(points.C1 || 0) + ' · C2 quality ' + esc(points.C2 || 0) + ' · C3 adoption ' + esc(points.C3 || 0) + ' · C4 ecosystem ' + esc(points.C4 || 0) + '</span>' +
      '</p>';
  }

  /* ---- 暴露给 join.html 的接口 ---- */
  window.owkvAuth = {
    API: API,
    getToken: getToken,
    setToken: setToken,
    getMe: getMe,
    sendOtp: sendOtp,
    verifyOtp: verifyOtp,
    fetchMe: fetchMe,
    logout: logout,
    startCountdown: startCountdown,
    renderNavAuth: renderNavAuth,
    onLogout: function (fn) { onLogout = fn; }
  };

  /* ---- 页面加载即渲染导航登录态 ---- */
  document.addEventListener('DOMContentLoaded', function () {
    renderNavAuth();
    // 监听 storage 跨标签同步(可选)
    if (window.addEventListener) {
      window.addEventListener('storage', function (e) {
        if (e.key === TOKEN_KEY || e.key === ME_KEY || e.key === null) renderNavAuth();
      });
    }
  });
})();
