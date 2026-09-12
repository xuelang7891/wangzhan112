'use strict';

/* =========================================================
   薛朗的资源仓库 - 脚本
   纯原生 JS，无任何外部依赖；数据保存在浏览器 localStorage。
   ========================================================= */

/* =========================================================
   1. 配置（站长请修改这里）
   ========================================================= */
const CONFIG = {
  siteName: '薛朗的资源仓库',
  /* 站长账号：使用这些邮箱 / 手机号登录后即可编辑本站内容。
     站长账号已按站长要求预置（薛朗 / 3902041497@qq.com），
     由下方 DEFAULT_OWNER_ACCOUNT 在首次加载时自动写入，无需注册。 */
  ownerAccounts: ['3902041497@qq.com'],
  /* 站长邮箱 */
  ownerEmail: '3902041497@qq.com',
  /* 邮箱验证码服务地址（Cloudflare Pages Function，见 functions/api/code/）。
     留空 = 演示模式（验证码直接显示在页面上，不真实发邮件）；
     填上地址后 = 验证码真实发送到邮箱，并在服务端校验。
     注意：不要用 *.workers.dev 地址（国内网络无法访问），
     要用网站自己的域名（pages.dev 或自定义域名）。 */
  emailWorkerUrl: 'https://wangzhan112.pages.dev/api/code'
};

/* 预置站长账号：密码以「盐 + SHA-256（FNV-1a 兜底）」哈希保存，不存明文。
   如需更换站长账号，请同步修改本常量与 CONFIG.ownerAccounts。 */
const DEFAULT_OWNER_ACCOUNT = {
  name: '薛朗',
  account: '3902041497@qq.com',
  salt: 'j55x9nfxmtxut2nz',
  passHash: '7785e0cc3b253ea8b315d765e7786ccd414b9fdc57406283a3e9ee7270088140',
  passHashFnv: 'fee27e29'
};

/* =========================================================
   2. 常量与默认数据
   ========================================================= */
const STORAGE_KEY = 'xl-resource-hub-v1';
const SESSION_KEY = 'xl-resource-hub-session-v1';
const ACCOUNTS_KEY = 'xl-resource-hub-accounts-v1';
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
let accounts = [];

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

/* 预置站长账号：首次加载自动写入，已存在则跳过（密码为加盐哈希，不存明文） */
function seedOwnerAccount() {
  if (!findAccount(DEFAULT_OWNER_ACCOUNT.account)) {
    accounts.push({
      name: DEFAULT_OWNER_ACCOUNT.name,
      account: DEFAULT_OWNER_ACCOUNT.account,
      salt: DEFAULT_OWNER_ACCOUNT.salt,
      passHash: DEFAULT_OWNER_ACCOUNT.passHash,
      passHashFnv: DEFAULT_OWNER_ACCOUNT.passHashFnv,
      createdAt: 0
    });
    saveAccounts(accounts);
  }
}

function isOwner() {
  return !!(session && session.isOwner);
}

/* =========================================================
   账号存储与密码哈希
   ========================================================= */
function loadAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    return [];
  }
}

function saveAccounts(list) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  } catch (err) {
    /* 存储不可用时仅保留内存数据 */
  }
}

/* 按账号（邮箱）查找用户，忽略大小写 */
function findAccount(account) {
  const acc = (account || '').trim().toLowerCase();
  return accounts.find(function (a) {
    return a.account.toLowerCase() === acc;
  }) || null;
}

function randomSalt() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/* FNV-1a 哈希（简单环境兜底用，仅演示用途） */
function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/* 加盐哈希对：SHA-256（Web Crypto 可用时）+ FNV-1a（兜底），兼容不同运行环境 */
async function makeHashPair(salt, password) {
  const text = salt + ':' + password;
  const fnv = fnv1a(text);
  let sha = null;
  try {
    if (window.crypto && window.crypto.subtle) {
      const data = new TextEncoder().encode(text);
      const buf = await window.crypto.subtle.digest('SHA-256', data);
      sha = Array.from(new Uint8Array(buf))
        .map(function (b) {
          return b.toString(16).padStart(2, '0');
        })
        .join('');
    }
  } catch (err) {
    /* 仅使用 FNV */
  }
  return { sha: sha, fnv: fnv };
}

/* 校验密码：FNV 或 SHA-256 任一匹配即通过 */
async function checkPassword(rec, password) {
  const text = rec.salt + ':' + password;
  if (rec.passHashFnv === fnv1a(text)) return true;
  try {
    if (window.crypto && window.crypto.subtle) {
      const data = new TextEncoder().encode(text);
      const buf = await window.crypto.subtle.digest('SHA-256', data);
      const sha = Array.from(new Uint8Array(buf))
        .map(function (b) {
          return b.toString(16).padStart(2, '0');
        })
        .join('');
      return sha === rec.passHash;
    }
  } catch (err) {
    /* 继续返回 false */
  }
  return false;
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
  dom.regCode = document.getElementById('regCode');
  dom.regPassword = document.getElementById('regPassword');
  dom.sendCodeBtn = document.getElementById('sendCodeBtn');
  dom.codeNotice = document.getElementById('codeNotice');

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

  /* --- 注册：名字 + 邮箱/手机号 + 验证码 + 密码 --- */
  dom.registerForm.addEventListener('submit', function (e) {
    e.preventDefault();
    submitRegister();
  });

  dom.sendCodeBtn.addEventListener('click', handleSendCode);

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
   7.5 登录 / 注册（验证码）
   ========================================================= */
let pendingCode = null; /* { code, account, expiresAt } */
let sendCooldown = 0;
let sendTimer = null;

function switchLoginTab(tab) {
  const isLogin = tab === 'login';
  dom.loginForm.hidden = !isLogin;
  dom.registerForm.hidden = isLogin;
  dom.loginHint.hidden = !isLogin;
  dom.registerHint.hidden = isLogin;
  dom.tabLogin.classList.toggle('active', isLogin);
  dom.tabRegister.classList.toggle('active', !isLogin);
  dom.tabLogin.setAttribute('aria-selected', String(isLogin));
  dom.tabRegister.setAttribute('aria-selected', String(!isLogin));
  /* 切换 Tab 时作废验证码并清空密码残留 */
  pendingCode = null;
  dom.codeNotice.hidden = true;
  if (isLogin) {
    dom.regPassword.value = '';
  } else {
    dom.loginPassword.value = '';
  }
}

function openLoginModal(tab) {
  switchLoginTab(tab || 'login');
  openModal('loginModal');
  const firstInput =
    tab === 'register' ? dom.regName : dom.loginName;
  setTimeout(function () {
    firstInput.focus();
  }, 50);
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function updateSendBtn() {
  if (sendCooldown > 0) {
    dom.sendCodeBtn.disabled = true;
    dom.sendCodeBtn.textContent = '重新发送(' + sendCooldown + 's)';
  } else {
    dom.sendCodeBtn.disabled = false;
    dom.sendCodeBtn.textContent = '发送验证码';
  }
}

function startSendCountdown() {
  sendCooldown = 60;
  updateSendBtn();
  clearInterval(sendTimer);
  sendTimer = setInterval(function () {
    sendCooldown -= 1;
    updateSendBtn();
    if (sendCooldown <= 0) clearInterval(sendTimer);
  }, 1000);
}

/* 发送验证码。
   已配置 CONFIG.emailWorkerUrl 时：调用 Cloudflare Worker 真实发送邮件，
   验证码由服务端生成并校验（前端拿不到，更安全）。
   未配置时：演示模式，验证码直接显示在页面下方。 */
function handleSendCode() {
  const check = validateAccount(dom.regAccount.value);
  if (!check.ok) {
    showToast(check.msg);
    return;
  }
  if (findAccount(check.account)) {
    showToast('该账号已注册，请直接登录');
    return;
  }
  if (CONFIG.emailWorkerUrl) {
    sendCodeViaWorker(check.account);
  } else {
    demoSendCode(check.account);
  }
}

function demoSendCode(account) {
  const code = generateCode();
  pendingCode = {
    code: code,
    account: account,
    server: false,
    expiresAt: Date.now() + 5 * 60 * 1000
  };
  dom.codeNotice.hidden = false;
  dom.codeNotice.textContent =
    '验证码已发送（演示环境，未真实发送邮件）：' +
    code +
    '，5 分钟内有效';
  showToast('验证码已发送');
  startSendCountdown();
}

function sendCodeViaWorker(account) {
  dom.sendCodeBtn.disabled = true;
  dom.sendCodeBtn.textContent = '发送中…';
  fetch(CONFIG.emailWorkerUrl + '/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account })
  })
    .then(function (r) {
      return r
        .json()
        .catch(function () {
          return { ok: false, msg: '服务响应异常' };
        });
    })
    .then(function (res) {
      if (res && res.ok) {
        pendingCode = {
          code: null,
          account: account,
          server: true,
          expiresAt: Date.now() + 5 * 60 * 1000
        };
        dom.codeNotice.hidden = false;
        dom.codeNotice.textContent =
          '验证码已发送到 ' + account + '，请查收邮件（5 分钟内有效）';
        showToast('验证码已发送');
        startSendCountdown();
      } else {
        showToast((res && res.msg) || '发送失败，请稍后重试');
        updateSendBtn();
      }
    })
    .catch(function () {
      showToast('网络错误，发送失败');
      updateSendBtn();
    });
}

function submitRegister() {
  const name = dom.regName.value.trim();
  const account = dom.regAccount.value.trim();
  const password = dom.regPassword.value;
  const code = dom.regCode.value.trim();

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
  if (!pendingCode) {
    showToast('请先获取验证码');
    return;
  }
  if (pendingCode.account !== accCheck.account) {
    showToast('账号已变更，请重新获取验证码');
    return;
  }
  if (Date.now() > pendingCode.expiresAt) {
    pendingCode = null;
    dom.codeNotice.hidden = true;
    showToast('验证码已过期，请重新获取');
    return;
  }
  if (findAccount(accCheck.account)) {
    showToast('该账号已注册，请直接登录');
    return;
  }

  /* 真实邮件模式：验证码在服务端校验 */
  if (pendingCode.server) {
    verifyCodeViaWorker(accCheck.account, code, function (res) {
      if (!(res && res.ok)) {
        showToast((res && res.msg) || '验证码不正确');
        return;
      }
      finishRegister(name, accCheck.account, password);
    });
    return;
  }

  if (code !== pendingCode.code) {
    showToast('验证码不正确');
    return;
  }
  finishRegister(name, accCheck.account, password);
}

function verifyCodeViaWorker(account, code, cb) {
  fetch(CONFIG.emailWorkerUrl + '/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account, code: code })
  })
    .then(function (r) {
      return r
        .json()
        .catch(function () {
          return { ok: false, msg: '服务响应异常' };
        });
    })
    .then(cb)
    .catch(function () {
      cb({ ok: false, msg: '网络错误，请稍后重试' });
    });
}

function finishRegister(name, account, password) {
  const salt = randomSalt();
  makeHashPair(salt, password).then(function (pair) {
    accounts.push({
      name: name,
      account: account,
      salt: salt,
      passHash: pair.sha || pair.fnv,
      passHashFnv: pair.fnv,
      createdAt: Date.now()
    });
    saveAccounts(accounts);
    pendingCode = null;
    dom.codeNotice.hidden = true;
    dom.registerForm.reset();
    updateSendBtn();

    /* 注册成功，跳转到登录并预填名字与账号 */
    switchLoginTab('login');
    dom.loginName.value = name;
    dom.loginAccount.value = account;
    showToast('注册成功，请登录');
  });
}

function submitLogin() {
  const name = dom.loginName.value.trim();
  const account = dom.loginAccount.value.trim();
  const password = dom.loginPassword.value;

  if (!name) {
    showToast('请填写名字');
    return;
  }
  const accCheck = validateAccount(account);
  if (!accCheck.ok) {
    showToast(accCheck.msg);
    return;
  }
  if (!password) {
    showToast('请输入密码');
    return;
  }

  const rec = findAccount(accCheck.account);
  if (!rec) {
    showToast('该账号尚未注册，请先注册');
    return;
  }
  if (rec.name.toLowerCase() !== name.toLowerCase()) {
    showToast('名字与账号不匹配');
    return;
  }

  checkPassword(rec, password).then(function (ok) {
    if (!ok) {
      showToast('密码不正确');
      return;
    }
    const isOwnerAccount =
      CONFIG.ownerAccounts
        .map(function (a) {
          return a.trim().toLowerCase();
        })
        .indexOf(accCheck.account) !== -1;

    session = { account: accCheck.account, name: rec.name, isOwner: isOwnerAccount };
    saveSession();
    closeModal('loginModal');
    renderAll();
    showToast(
      isOwnerAccount ? '站长登录成功，现在可以编辑内容了' : '欢迎回来，' + rec.name
    );
  });
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
  accounts = loadAccounts();
  seedOwnerAccount();

  cacheDom();
  bindEvents();

  dom.brandName.textContent = CONFIG.siteName;
  dom.footerSite.textContent = CONFIG.siteName;
  dom.year.textContent = String(new Date().getFullYear());
  document.title = CONFIG.siteName;

  updateSendBtn();
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
