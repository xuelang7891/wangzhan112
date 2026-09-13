'use strict';

/* =========================================================
   薛朗的资源仓库 - 脚本
   账号系统：Supabase Auth（邮箱注册 → 平台代发验证邮件 → 激活后登录）。
   页面内容（资源 / 联系方式 / 资料 / 头像）保存在浏览器 localStorage。
   ========================================================= */

/* =========================================================
   1. 配置（站长请修改这里）
   ========================================================= */
const CONFIG = {
  siteName: '薛朗的资源仓库',
  /* 站长账号：使用这些邮箱登录后即可编辑本站内容 */
  ownerAccounts: ['3902041497@qq.com'],
  /* 站长邮箱 */
  ownerEmail: '3902041497@qq.com',
  /* Supabase 项目配置（浏览器安全密钥，可公开）：
     在 Supabase 控制台「Project Settings → API Keys」获取 */
  supabaseUrl: 'https://ojiueppupuhctqbvjagk.supabase.co',
  supabaseAnonKey: 'sb_publishable_WQbN7g7WZYT--YHcoNi4rg_wTfLvE6P'
};

/* =========================================================
   2. 常量与默认数据
   ========================================================= */
const STORAGE_KEY = 'xl-resource-hub-v1';
const SESSION_KEY = 'xl-resource-hub-session-v1';
const WELCOME_KEY = 'xl-resource-hub-welcome-v1';

/* 默认头像（内联 SVG，不依赖任何外部图片） */
const DEFAULT_AVATAR =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">' +
      '<rect width="128" height="128" fill="#E7EBEF"/>' +
      '<circle cx="64" cy="47" r="21" fill="#A9B2BE"/>' +
      '<path d="M31 114c0-19 15-31 33-31s33 12 33 31z" fill="#A9B2BE"/>' +
    '</svg>'
  );

/* 内联图标（stroke 风格，随文字颜色变化） */
const SVG = {
  arrow:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path></svg>',
  edit:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>',
  trash:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>',
  link:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"></path><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"></path></svg>'
};

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* 首次打开时的默认内容：资源与联系方式（站长登录后可在页面上直接增删改） */
function defaultState() {
  return {
    profile: {
      nickname: '薛朗',
      intro: '你好，这里是薛朗，这个网站的所有者，你可以加入我们，一起玩耍~',
      about:
        '我是薛朗，这个资源仓库的创建者与维护者。这里收录了我认为值得分享的网站与链接，包含工具、内容与项目等。\n\n如果你有好的资源想要分享，欢迎加入，一起把这里变得更好。',
      avatar: ''
    },
    resources: [
      {
        id: createId(),
        title: '薛朗的博客（示例）',
        url: 'https://example.com/blog',
        desc: '记录技术与生活的地方，示例资源，站长登录后可在编辑模式下删除或修改。'
      },
      {
        id: createId(),
        title: '薛朗的 GitHub（示例）',
        url: 'https://example.com/github',
        desc: '开源项目与代码仓库，示例资源，站长登录后可在编辑模式下删除或修改。'
      },
      {
        id: createId(),
        title: '薛朗的哔哩哔哩（示例）',
        url: 'https://example.com/bilibili',
        desc: '视频与分享，示例资源，站长登录后可在编辑模式下删除或修改。'
      }
    ],
    contacts: [
      { id: createId(), label: '邮箱', url: 'mailto:3902041497@qq.com' },
      { id: createId(), label: 'GitHub', url: 'https://example.com/github' }
    ]
  };
}

/* =========================================================
   3. 状态与存储（localStorage 不可用时自动降级为内存）
   ========================================================= */
let state;
let session = null;

/* --- Supabase 客户端（CDN 加载失败时降级，登录/注册会提示刷新） --- */
let supabaseClient = null;

function initSupabase() {
  try {
    if (typeof window.supabase === 'undefined') return false;
    supabaseClient = window.supabase.createClient(
      CONFIG.supabaseUrl,
      CONFIG.supabaseAnonKey
    );
    return true;
  } catch (err) {
    return false;
  }
}

function loadState() {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    return {
      profile: Object.assign({}, base.profile, saved.profile || {}),
      resources: Array.isArray(saved.resources) ? saved.resources : base.resources,
      contacts: Array.isArray(saved.contacts) ? saved.contacts : base.contacts
    };
  } catch (err) {
    return base;
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    /* 存储不可用（如隐私模式）时仅保留内存数据 */
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s &&
      typeof s.account === 'string' &&
      typeof s.name === 'string'
      ? s
      : null;
  } catch (err) {
    return null;
  }
}

function saveSession() {
  try {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch (err) {
    /* 同上 */
  }
}

function isOwner() {
  return !!(session && session.isOwner);
}

/* 从 Supabase 会话恢复本站登录态（刷新页面后保持登录） */
async function restoreSupabaseSession() {
  if (!supabaseClient) return;
  try {
    const { data } = await supabaseClient.auth.getSession();
    const sbUser = data && data.session && data.session.user;
    if (!sbUser || !sbUser.email) {
      if (session) {
        session = null;
        saveSession();
        renderAll();
      }
      return;
    }
    const email = sbUser.email.trim().toLowerCase();
    const metaName =
      (sbUser.user_metadata && sbUser.user_metadata.name) || '';
    const isOwnerAccount =
      CONFIG.ownerAccounts
        .map(function (a) {
          return a.trim().toLowerCase();
        })
        .indexOf(email) !== -1;
    session = {
      account: email,
      name: metaName || email.split('@')[0],
      isOwner: isOwnerAccount
    };
    saveSession();
    renderAll();
  } catch (err) {
    /* Supabase 不可达时保持本地会话 */
  }
}

/* =========================================================
   4. 工具函数
   ========================================================= */
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(function () {
    toast.hidden = true;
  }, 2600);
}

/* 链接规范化：自动补 https://，仅允许 http/https/mailto/tel */
function normalizeUrl(raw) {
  const v = (raw || '').trim();
  if (!v) return { ok: false, msg: '链接不能为空' };
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) {
    if (/^(https?|mailto|tel):/i.test(v)) return { ok: true, url: v };
    return { ok: false, msg: '仅支持 http / https / mailto / tel 链接' };
  }
  return { ok: true, url: 'https://' + v };
}

/* 账号校验：仅支持邮箱（已移除手机号选项） */
function validateAccount(raw) {
  const v = (raw || '').trim().toLowerCase();
  if (!v) return { ok: false, msg: '请输入邮箱地址' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { ok: false, msg: '邮箱格式不正确' };
  return { ok: true, account: v };
}

function avatarSrc() {
  return state.profile.avatar || DEFAULT_AVATAR;
}

/* 外链属性：http/https 新窗口打开，mailto/tel 当前窗口 */
function linkAttrs(url) {
  return /^(https?):/i.test(url)
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};
}

/* 平滑滚动到指定元素（避开吸顶导航） */
function scrollToEl(el) {
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 92;
  window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
}

/* =========================================================
   5. DOM 引用
   ========================================================= */
let dom = {};

function cacheDom() {
  dom.navAvatar = document.getElementById('navAvatar');
  dom.accountName = document.getElementById('accountName');
  dom.accountBtn = document.getElementById('accountBtn');
  dom.accountMenu = document.getElementById('accountMenu');
  dom.menuEditProfile = document.getElementById('menuEditProfile');
  dom.menuLogout = document.getElementById('menuLogout');
  dom.menuBtn = document.getElementById('menuBtn');
  dom.navLinks = document.getElementById('navLinks');
  dom.brandName = document.getElementById('brandName');
  dom.footerSite = document.getElementById('footerSite');
  dom.year = document.getElementById('year');

  dom.avatarWrap = document.getElementById('avatarWrap');
  dom.heroAvatar = document.getElementById('heroAvatar');
  dom.nickname = document.getElementById('nickname');
  dom.intro = document.getElementById('intro');
  dom.avatarInput = document.getElementById('avatarInput');

  dom.aboutText = document.getElementById('aboutText');
  dom.aboutEditBtn = document.getElementById('aboutEditBtn');

  dom.resourceGrid = document.getElementById('resourceGrid');
  dom.resourceEmpty = document.getElementById('resourceEmpty');
  dom.resourceForm = document.getElementById('resourceForm');
  dom.resourceEditorTitle = document.getElementById('resourceEditorTitle');
  dom.resourceSubmitBtn = document.getElementById('resourceSubmitBtn');
  dom.resTitle = document.getElementById('resTitle');
  dom.resUrl = document.getElementById('resUrl');
  dom.resDesc = document.getElementById('resDesc');
  dom.addResourceBtn = document.getElementById('addResourceBtn');

  dom.joinBtn = document.getElementById('joinBtn');

  dom.contactList = document.getElementById('contactList');
  dom.contactForm = document.getElementById('contactForm');
  dom.contactEditorTitle = document.getElementById('contactEditorTitle');
  dom.contactSubmitBtn = document.getElementById('contactSubmitBtn');
  dom.conLabel = document.getElementById('conLabel');
  dom.conUrl = document.getElementById('conUrl');

  dom.loginForm = document.getElementById('loginForm');
  dom.loginName = document.getElementById('loginName');
  dom.loginAccount = document.getElementById('loginAccount');
  dom.loginPassword = document.getElementById('loginPassword');

  dom.registerForm = document.getElementById('registerForm');
  dom.regName = document.getElementById('regName');
  dom.regAccount = document.getElementById('regAccount');
  dom.regPassword = document.getElementById('regPassword');
  dom.regSuccess = document.getElementById('regSuccess');
  dom.regSuccessText = document.getElementById('regSuccessText');
  dom.regSuccessBack = document.getElementById('regSuccessBack');

  dom.tabLogin = document.getElementById('tabLogin');
  dom.tabRegister = document.getElementById('tabRegister');
  dom.loginHint = document.getElementById('loginHint');
  dom.registerHint = document.getElementById('registerHint');
  dom.goLogin = document.getElementById('goLogin');
  dom.goRegister = document.getElementById('goRegister');

  dom.profileForm = document.getElementById('profileForm');
  dom.profileAvatar = document.getElementById('profileAvatar');
  dom.profileAvatarBtn = document.getElementById('profileAvatarBtn');
  dom.profileNickname = document.getElementById('profileNickname');
  dom.profileIntro = document.getElementById('profileIntro');
  dom.profileAbout = document.getElementById('profileAbout');

  dom.confirmText = document.getElementById('confirmText');
  dom.confirmOkBtn = document.getElementById('confirmOkBtn');

  dom.sections = Array.prototype.slice.call(
    document.querySelectorAll('section[id]')
  );
}

/* =========================================================
   6. 渲染
   ========================================================= */
function renderAll() {
  const owner = isOwner();

  document.body.classList.toggle('owner-mode', owner);
  document.querySelectorAll('.owner-only').forEach(function (el) {
    el.hidden = !owner;
  });

  renderNav();
  renderHero();
  renderAbout();
  renderResources();
  renderContacts();
}

function renderNav() {
  dom.navAvatar.src = avatarSrc();
  if (session) {
    dom.accountName.textContent = session.name;
    dom.accountBtn.title = '已登录，点击打开菜单';
  } else {
    dom.accountName.textContent = '登录';
    dom.accountBtn.title = '登录';
  }
}

function renderHero() {
  dom.heroAvatar.src = avatarSrc();
  dom.heroAvatar.alt = state.profile.nickname + ' 的头像';
  dom.nickname.textContent = state.profile.nickname;
  dom.intro.textContent = state.profile.intro;
  dom.avatarWrap.title = isOwner() ? '点击更换头像' : '';
}

function renderAbout() {
  dom.aboutText.textContent = state.profile.about;
}

function renderResources() {
  dom.resourceGrid.textContent = '';
  dom.resourceEmpty.hidden = state.resources.length > 0;

  state.resources.forEach(function (item) {
    dom.resourceGrid.appendChild(buildResourceCard(item));
  });
}

function buildResourceCard(item) {
  const card = document.createElement('article');
  card.className = 'resource-card';

  const top = document.createElement('div');
  top.className = 'resource-top';

  const title = document.createElement('h3');
  title.className = 'resource-title';
  title.textContent = item.title;
  top.appendChild(title);

  if (isOwner()) {
    top.appendChild(buildCardActions(item.id, 'resource'));
  }
  card.appendChild(top);

  if (item.desc) {
    const desc = document.createElement('p');
    desc.className = 'resource-desc';
    desc.textContent = item.desc;
    card.appendChild(desc);
  }

  const foot = document.createElement('div');
  foot.className = 'resource-foot';

  const link = document.createElement('a');
  link.className = 'resource-link';
  link.href = item.url;
  link.textContent = '访问';
  const attrs = linkAttrs(item.url);
  if (attrs.target) link.target = attrs.target;
  if (attrs.rel) link.rel = attrs.rel;
  link.appendChild(createIcon(SVG.arrow));
  foot.appendChild(link);
  card.appendChild(foot);

  return card;
}

function buildCardActions(id, type) {
  const wrap = document.createElement('div');
  wrap.className = 'card-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'card-action';
  editBtn.dataset.action = 'edit';
  editBtn.dataset.type = type;
  editBtn.dataset.id = id;
  editBtn.setAttribute('aria-label', '编辑');
  editBtn.title = '编辑';
  editBtn.innerHTML = SVG.edit;

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'card-action';
  delBtn.dataset.action = 'delete';
  delBtn.dataset.type = type;
  delBtn.dataset.id = id;
  delBtn.setAttribute('aria-label', '删除');
  delBtn.title = '删除';
  delBtn.innerHTML = SVG.trash;

  wrap.appendChild(editBtn);
  wrap.appendChild(delBtn);
  return wrap;
}

function createIcon(svgString) {
  const span = document.createElement('span');
  span.innerHTML = svgString;
  return span.firstChild;
}

function renderContacts() {
  dom.contactList.textContent = '';

  state.contacts.forEach(function (item) {
    dom.contactList.appendChild(buildContactItem(item));
  });
}

function buildContactItem(item) {
  const li = document.createElement('li');
  li.className = 'contact-item';

  const main = document.createElement('a');
  main.className = 'contact-main';
  main.href = item.url;
  const attrs = linkAttrs(item.url);
  if (attrs.target) main.target = attrs.target;
  if (attrs.rel) main.rel = attrs.rel;

  const icon = document.createElement('span');
  icon.className = 'contact-icon';
  icon.innerHTML = SVG.link;
  main.appendChild(icon);

  const info = document.createElement('span');
  info.className = 'contact-info';

  const label = document.createElement('span');
  label.className = 'contact-label';
  label.textContent = item.label;
  info.appendChild(label);

  const url = document.createElement('span');
  url.className = 'contact-url';
  url.textContent = item.url;
  info.appendChild(url);

  main.appendChild(info);

  const arrow = document.createElement('span');
  arrow.className = 'contact-arrow';
  arrow.innerHTML = SVG.arrow;
  main.appendChild(arrow);

  li.appendChild(main);

  if (isOwner()) {
    li.appendChild(buildCardActions(item.id, 'contact'));
  }

  return li;
}

/* =========================================================
   7. 事件绑定
   ========================================================= */
function bindEvents() {
  /* --- 移动端菜单 --- */
  dom.menuBtn.addEventListener('click', function () {
    const open = dom.navLinks.classList.toggle('open');
    dom.menuBtn.setAttribute('aria-expanded', String(open));
  });

  dom.navLinks.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      dom.navLinks.classList.remove('open');
      dom.menuBtn.setAttribute('aria-expanded', 'false');
    }
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 768) {
      dom.navLinks.classList.remove('open');
      dom.menuBtn.setAttribute('aria-expanded', 'false');
    }
  });

  /* --- 账号按钮与菜单 --- */
  dom.accountBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!session) {
      openLoginModal('login');
      return;
    }
    const open = dom.accountMenu.hidden;
    dom.accountMenu.hidden = !open;
    dom.accountBtn.setAttribute('aria-expanded', String(!open));
  });

  dom.menuEditProfile.addEventListener('click', function () {
    dom.accountMenu.hidden = true;
    dom.accountBtn.setAttribute('aria-expanded', 'false');
    openProfileModal();
  });

  dom.menuLogout.addEventListener('click', function () {
    if (supabaseClient) {
      supabaseClient.auth.signOut().catch(function () {
        /* 网络失败也继续退出本地会话 */
      });
    }
    session = null;
    saveSession();
    dom.accountMenu.hidden = true;
    dom.accountBtn.setAttribute('aria-expanded', 'false');
    renderAll();
    showToast('已退出登录');
  });

  document.addEventListener('click', function (e) {
    if (!dom.accountMenu.hidden && !e.target.closest('.account-wrap')) {
      dom.accountMenu.hidden = true;
      dom.accountBtn.setAttribute('aria-expanded', 'false');
    }
  });

  /* --- 导航高亮 --- */
  window.addEventListener(
    'scroll',
    throttle(function () {
      highlightNav();
    }, 100),
    { passive: true }
  );

  /* --- 头像 --- */
  dom.avatarWrap.addEventListener('click', function () {
    if (isOwner()) dom.avatarInput.click();
  });

  dom.avatarInput.addEventListener('change', function () {
    if (dom.avatarInput.files && dom.avatarInput.files[0]) {
      handleAvatarFile(dom.avatarInput.files[0]);
    }
    dom.avatarInput.value = '';
  });

  /* --- 编辑资料 --- */
  dom.aboutEditBtn.addEventListener('click', openProfileModal);
  dom.profileAvatarBtn.addEventListener('click', function () {
    dom.avatarInput.click();
  });

  dom.profileForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!isOwner()) {
      showToast('仅站长可修改资料');
      return;
    }
    const nickname = dom.profileNickname.value.trim();
    if (!nickname) {
      showToast('昵称不能为空');
      return;
    }
    state.profile.nickname = nickname;
    state.profile.intro = dom.profileIntro.value.trim();
    state.profile.about = dom.profileAbout.value;
    saveState();
    closeModal('profileModal');
    renderAll();
    showToast('资料已保存');
  });

  /* --- 资源：新增 / 编辑 / 删除 --- */
  dom.addResourceBtn.addEventListener('click', function () {
    addNewResource();
  });

  dom.resourceForm.addEventListener('submit', function (e) {
    e.preventDefault();
    submitResource();
  });

  dom.resourceGrid.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.dataset.type !== 'resource') return;
    if (btn.dataset.action === 'delete') {
      deleteItem('resources', btn.dataset.id, '资源');
    } else if (btn.dataset.action === 'edit') {
      startEditResource(btn.dataset.id);
    }
  });

  /* --- 联系方式：新增 / 编辑 / 删除 --- */
  dom.contactForm.addEventListener('submit', function (e) {
    e.preventDefault();
    submitContact();
  });

  dom.contactList.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.dataset.type !== 'contact') return;
    if (btn.dataset.action === 'delete') {
      deleteItem('contacts', btn.dataset.id, '联系方式');
    } else if (btn.dataset.action === 'edit') {
      startEditContact(btn.dataset.id);
    }
  });

  /* --- 加入资源仓库：打开注册 --- */
  dom.joinBtn.addEventListener('click', function () {
    openLoginModal('register');
  });

  /* --- 登录：名字 + 邮箱/手机号 + 密码 --- */
  dom.loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    submitLogin();
  });

  /* --- 注册：名字 + 邮箱 + 密码 --- */
  dom.registerForm.addEventListener('submit', function (e) {
    e.preventDefault();
    submitRegister();
  });

  /* --- 登录 / 注册 Tab 切换 --- */
  dom.tabLogin.addEventListener('click', function () {
    switchLoginTab('login');
  });
  dom.tabRegister.addEventListener('click', function () {
    switchLoginTab('register');
  });
  dom.goLogin.addEventListener('click', function () {
    switchLoginTab('login');
  });
  dom.goRegister.addEventListener('click', function () {
    switchLoginTab('register');
  });
  dom.regSuccessBack.addEventListener('click', function () {
    switchLoginTab('login');
  });

  /* --- 弹窗通用 --- */
  document.querySelectorAll('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      closeModal(btn.getAttribute('data-close'));
    });
  });

  document.querySelectorAll('[data-close-welcome]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      closeModal('welcomeModal');
    });
  });

  document.querySelectorAll('.modal-mask').forEach(function (mask) {
    mask.addEventListener('click', function (e) {
      if (e.target === mask) closeModal(mask.id);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document
        .querySelectorAll('.modal-mask:not([hidden])')
        .forEach(function (m) {
          closeModal(m.id);
        });
      dom.accountMenu.hidden = true;
      dom.accountBtn.setAttribute('aria-expanded', 'false');
    }
  });

  /* --- 确认弹窗 --- */
  dom.confirmOkBtn.addEventListener('click', function () {
    const cb = dom.confirmOkBtn._cb;
    dom.confirmOkBtn._cb = null;
    closeModal('confirmModal');
    if (cb) cb();
  });
}

function throttle(fn, wait) {
  let last = 0;
  return function () {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn();
    }
  };
}

function highlightNav() {
  const pos = window.scrollY + 120;
  let current = 'home';
  dom.sections.forEach(function (s) {
    if (s.offsetTop <= pos) current = s.id;
  });
  if (current === 'about') current = 'home'; /* 关于我归属「首页」高亮 */
  dom.navLinks.querySelectorAll('a').forEach(function (a) {
    a.classList.toggle('active', a.getAttribute('href') === '#' + current);
  });
}

/* =========================================================
   7.5 登录 / 注册
   ========================================================= */
function switchLoginTab(tab) {
  const isLogin = tab === 'login';
  dom.loginForm.hidden = !isLogin;
  dom.registerForm.hidden = isLogin;
  dom.loginHint.hidden = !isLogin;
  dom.registerHint.hidden = isLogin;
  dom.regSuccess.hidden = true;
  dom.tabLogin.classList.toggle('active', isLogin);
  dom.tabRegister.classList.toggle('active', !isLogin);
  dom.tabLogin.setAttribute('aria-selected', String(isLogin));
  dom.tabRegister.setAttribute('aria-selected', String(!isLogin));
  if (isLogin) {
    dom.regPassword.value = '';
  } else {
    dom.loginPassword.value = '';
  }
}

/* =========================================================
   7.5 登录 / 注册（Supabase 邮箱账号系统）
   ========================================================= */
function openLoginModal(tab) {
  switchLoginTab(tab || 'login');
  openModal('loginModal');
  const firstInput =
    tab === 'register' ? dom.regName : dom.loginName;
  setTimeout(function () {
    firstInput.focus();
  }, 50);
}

async function submitRegister() {
  const name = dom.regName.value.trim();
  const account = dom.regAccount.value.trim();
  const password = dom.regPassword.value;

  if (!name) {
    showToast('请填写名字');
    return;
  }
  const accCheck = validateAccount(account);
  if (!accCheck.ok) {
    showToast(accCheck.msg);
    return;
  }
  if (password.length < 6) {
    showToast('密码至少 6 位');
    return;
  }
  if (!supabaseClient) {
    showToast('账号系统未加载，请刷新页面重试');
    return;
  }

  const btn = dom.registerForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const { error } = await supabaseClient.auth.signUp({
      email: accCheck.account,
      password: password,
      options: { data: { name: name } }
    });
    if (error) {
      const msg = error.message || '';
      if (/already registered|already been registered/i.test(msg)) {
        showToast('该邮箱已注册，请直接登录');
      } else {
        showToast('注册失败：' + msg);
      }
      return;
    }
    /* 注册成功：平台已向邮箱发送验证邮件 */
    dom.registerForm.reset();
    dom.regSuccessText.textContent =
      '验证邮件已发送到 ' + accCheck.account + '，请前往邮箱点击确认链接激活账号，激活后即可登录。';
    dom.registerForm.hidden = true;
    dom.regSuccess.hidden = false;
  } catch (err) {
    showToast('网络错误，请稍后重试');
  } finally {
    btn.disabled = false;
  }
}

async function submitLogin() {
  const name = dom.loginName.value.trim();
  const account = dom.loginAccount.value.trim();
  const password = dom.loginPassword.value;

  const accCheck = validateAccount(account);
  if (!accCheck.ok) {
    showToast(accCheck.msg);
    return;
  }
  if (!password) {
    showToast('请输入密码');
    return;
  }
  if (!supabaseClient) {
    showToast('账号系统未加载，请刷新页面重试');
    return;
  }

  const btn = dom.loginForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: accCheck.account,
      password: password
    });
    if (error) {
      const msg = error.message || '';
      if (/not confirmed/i.test(msg)) {
        showToast('该邮箱尚未激活，请先点击邮件里的验证链接');
      } else if (/invalid login credentials/i.test(msg)) {
        showToast('邮箱或密码错误');
      } else {
        showToast('登录失败：' + msg);
      }
      return;
    }
    const user = data.user;
    const metaName =
      (user && user.user_metadata && user.user_metadata.name) || '';
    const isOwnerAccount =
      CONFIG.ownerAccounts
        .map(function (a) {
          return a.trim().toLowerCase();
        })
        .indexOf(accCheck.account) !== -1;

    session = {
      account: accCheck.account,
      name: metaName || name || accCheck.account.split('@')[0],
      isOwner: isOwnerAccount
    };
    saveSession();
    dom.loginForm.reset();
    closeModal('loginModal');
    renderAll();
    showToast(
      isOwnerAccount
        ? '站长登录成功，现在可以编辑内容了'
        : '欢迎回来，' + (metaName || name)
    );
  } catch (err) {
    showToast('网络错误，请稍后重试');
  } finally {
    btn.disabled = false;
  }
}

/* =========================================================
   8. 业务操作
   ========================================================= */
let editingResourceId = null;
let editingContactId = null;

function resetResourceForm() {
  editingResourceId = null;
  dom.resourceForm.reset();
  dom.resourceEditorTitle.textContent = '添加资源';
  dom.resourceSubmitBtn.textContent = '添加资源';
}

/* 点击「＋」新增资源：清空表单并定位到编辑器 */
function addNewResource() {
  if (!isOwner()) return;
  resetResourceForm();
  scrollToEl(document.getElementById('resourceEditor'));
  dom.resTitle.focus();
}

function resetContactForm() {
  editingContactId = null;
  dom.contactForm.reset();
  dom.contactEditorTitle.textContent = '添加联系方式';
  dom.contactSubmitBtn.textContent = '添加';
}

function submitResource() {
  if (!isOwner()) {
    showToast('仅站长可添加或修改资源');
    return;
  }
  const title = dom.resTitle.value.trim();
  const desc = dom.resDesc.value.trim();
  if (!title) {
    showToast('请填写资源名称');
    return;
  }
  const norm = normalizeUrl(dom.resUrl.value);
  if (!norm.ok) {
    showToast(norm.msg);
    return;
  }

  if (editingResourceId) {
    const item = state.resources.find(function (r) {
      return r.id === editingResourceId;
    });
    if (item) {
      item.title = title;
      item.url = norm.url;
      item.desc = desc;
      saveState();
      resetResourceForm();
      renderAll();
      showToast('修改已保存');
    }
    return;
  }

  state.resources.push({ id: createId(), title: title, url: norm.url, desc: desc });
  saveState();
  resetResourceForm();
  renderAll();
  showToast('资源已添加');
}

function startEditResource(id) {
  const item = state.resources.find(function (r) {
    return r.id === id;
  });
  if (!item) return;
  editingResourceId = id;
  dom.resTitle.value = item.title;
  dom.resUrl.value = item.url;
  dom.resDesc.value = item.desc || '';
  dom.resourceEditorTitle.textContent = '编辑资源';
  dom.resourceSubmitBtn.textContent = '保存修改';
  scrollToEl(document.getElementById('resourceEditor'));
}

function submitContact() {
  if (!isOwner()) {
    showToast('仅站长可添加或修改联系方式');
    return;
  }
  const label = dom.conLabel.value.trim();
  if (!label) {
    showToast('请填写名称');
    return;
  }
  const norm = normalizeUrl(dom.conUrl.value);
  if (!norm.ok) {
    showToast(norm.msg);
    return;
  }

  if (editingContactId) {
    const item = state.contacts.find(function (c) {
      return c.id === editingContactId;
    });
    if (item) {
      item.label = label;
      item.url = norm.url;
      saveState();
      resetContactForm();
      renderAll();
      showToast('修改已保存');
    }
    return;
  }

  state.contacts.push({ id: createId(), label: label, url: norm.url });
  saveState();
  resetContactForm();
  renderAll();
  showToast('联系方式已添加');
}

function startEditContact(id) {
  const item = state.contacts.find(function (c) {
    return c.id === id;
  });
  if (!item) return;
  editingContactId = id;
  dom.conLabel.value = item.label;
  dom.conUrl.value = item.url;
  dom.contactEditorTitle.textContent = '编辑联系方式';
  dom.contactSubmitBtn.textContent = '保存修改';
  scrollToEl(document.getElementById('contactEditor'));
}

function deleteItem(listKey, id, label) {
  const list = state[listKey];
  const item = list.find(function (x) {
    return x.id === id;
  });
  if (!item) return;
  askConfirm('确定删除「' + (item.title || item.label) + '」吗？', function () {
    state[listKey] = list.filter(function (x) {
      return x.id !== id;
    });
    saveState();
    /* 若正在编辑该条，重置编辑表单 */
    if (editingResourceId === id) resetResourceForm();
    if (editingContactId === id) resetContactForm();
    renderAll();
    showToast(label + '已删除');
  });
}

/* --- 头像上传：压缩到 512px 以内再存入 localStorage --- */
function handleAvatarFile(file) {
  if (!isOwner()) {
    showToast('仅站长可更换头像');
    return;
  }
  if (!file.type || file.type.indexOf('image/') !== 0) {
    showToast('请选择图片文件');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('图片不能超过 2MB');
    return;
  }

  const reader = new FileReader();
  reader.onload = function () {
    const img = new Image();
    img.onload = function () {
      const MAX = 512;
      let w = img.width;
      let h = img.height;
      if (w > MAX || h > MAX) {
        const scale = MAX / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        showToast('图片处理失败，请重试');
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const isPng = file.type === 'image/png';
      state.profile.avatar = canvas.toDataURL(
        isPng ? 'image/png' : 'image/jpeg',
        isPng ? undefined : 0.85
      );
      saveState();
      renderAll();
      /* 编辑资料弹窗打开时同步刷新头像预览 */
      if (!document.getElementById('profileModal').hidden) {
        dom.profileAvatar.src = state.profile.avatar;
      }
      showToast('头像已更新');
    };
    img.onerror = function () {
      showToast('图片读取失败，请换一张');
    };
    img.src = reader.result;
  };
  reader.onerror = function () {
    showToast('图片读取失败，请重试');
  };
  reader.readAsDataURL(file);
}

/* =========================================================
   9. 弹窗管理
   ========================================================= */
let lastFocused = null;

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  lastFocused = document.activeElement;
  el.hidden = false;
  const focusable = el.querySelector('input, textarea, button:not([disabled])');
  if (focusable) {
    setTimeout(function () {
      focusable.focus();
    }, 30);
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = true;
  if (id === 'welcomeModal') markWelcomeShown();
  if (lastFocused && lastFocused.focus) {
    try {
      lastFocused.focus();
    } catch (err) {
      /* 忽略焦点恢复失败 */
    }
  }
}

function openProfileModal() {
  dom.profileNickname.value = state.profile.nickname;
  dom.profileIntro.value = state.profile.intro;
  dom.profileAbout.value = state.profile.about;
  dom.profileAvatar.src = avatarSrc();
  openModal('profileModal');
}

function askConfirm(text, callback) {
  dom.confirmText.textContent = text;
  dom.confirmOkBtn._cb = callback;
  openModal('confirmModal');
}

function markWelcomeShown() {
  try {
    localStorage.setItem(WELCOME_KEY, '1');
  } catch (err) {
    /* 忽略 */
  }
}

/* =========================================================
   10. 初始化
   ========================================================= */
function init() {
  state = loadState();
  session = loadSession();
  initSupabase();
  restoreSupabaseSession();

  cacheDom();
  bindEvents();

  dom.brandName.textContent = CONFIG.siteName;
  dom.footerSite.textContent = CONFIG.siteName;
  dom.year.textContent = String(new Date().getFullYear());
  document.title = CONFIG.siteName;

  renderAll();
  resetResourceForm();
  resetContactForm();

  /* 首次进入：弹窗说明头像在哪里修改 */
  let welcomeShown = false;
  try {
    welcomeShown = localStorage.getItem(WELCOME_KEY) === '1';
  } catch (err) {
    /* 忽略 */
  }
  if (!welcomeShown) {
    openModal('welcomeModal');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
