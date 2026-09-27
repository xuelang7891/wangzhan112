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
  /* 站长账号：使用这些邮箱登录后即可编辑本站内容。
     数据库里建了 site_admins 表后，以 Supabase 云端名单为准（推荐），
     这里的列表作为兜底（云端查不到时才生效）。
     云端名单可以在 Supabase 控制台 → Table Editor → site_admins 里点鼠标增删，
     不需要改代码、也不需要重新部署。 */
  ownerAccounts: ['3902041497@qq.com'],
  /* 站长邮箱（站长字段的默认归属，如联系邮箱等） */
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

/* Supabase 云端同步：站点内容统一存到 site_data 表（id=1 单行），
   站长保存后自动推送公网，访客打开自动拉取最新。
   建表 SQL 见 README 或下方注释，需在 Supabase SQL Editor 执行一次。 */
const SITE_DATA_TABLE = 'site_data';
const SITE_DATA_ID = 1;

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
    ],
    qqGroup: {
      number: '',
      name: '',
      note: ''
    }
  };
}

/* =========================================================
   3. 状态与存储（localStorage 不可用时自动降级为内存）
   ========================================================= */
let state;
let session = null;
/* 站长身份的运行时标记：只有在 Supabase 真实验证过邮箱后才会置 true，
   不随 localStorage 持久化 —— 防止手改本地数据伪造站长编辑界面 */
let ownerVerified = false;

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
      contacts: Array.isArray(saved.contacts) ? saved.contacts : base.contacts,
      qqGroup: Object.assign({}, base.qqGroup, saved.qqGroup || {})
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
  /* 云端同步：站长登录后每次保存都会自动推送公网（失败不打扰当前操作） */
  pushRemoteState();
}

/* 校验远端数据结构，防止脏数据破坏页面 */
function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    profile: Object.assign({}, base.profile, raw.profile || {}),
    resources: Array.isArray(raw.resources) ? raw.resources : base.resources,
    contacts: Array.isArray(raw.contacts) ? raw.contacts : base.contacts,
    qqGroup: Object.assign({}, base.qqGroup, raw.qqGroup || {})
  };
}

/* 页面打开时从公网拉取最新内容（访客与站长都执行，实现"修改后自动更新"） */
async function fetchRemoteState() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from(SITE_DATA_TABLE)
      .select('data')
      .eq('id', SITE_DATA_ID)
      .maybeSingle();
    if (error || !data) return;
    /* 公网还没有内容：站长登录则把本地数据推上去（首次迁移），
       访客沿用默认/本地内容；不覆盖本地已有数据 */
    if (typeof data.data !== 'object' || Object.keys(data.data || {}).length === 0) {
      if (isOwner()) pushRemoteState();
      return;
    }
    state = normalizeState(data.data);
    saveState();
    renderAll();
  } catch (err) {
    /* 离线或表未创建时静默，沿用本地内容 */
  }
}

/* 把当前内容推送到公网（仅站长登录后 RLS 放行）。
   用 upsert 而非 update：即使 site_data 表还没有 id=1 那行种子数据，
   也会自动插入新行，避免"update 匹配 0 行、静默不生效"的坑。 */
async function pushRemoteState() {
  if (!supabaseClient || !isOwner()) return;
  try {
    const { error } = await supabaseClient
      .from(SITE_DATA_TABLE)
      .upsert(
        { id: SITE_DATA_ID, data: state, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
    if (error) {
      showToast('同步公网失败：' + (error.message || '请稍后重试'));
    }
  } catch (err) {
    showToast('网络错误，同步公网失败');
  }
}

/* 首次迁移：公网还没有内容时，把站长本地的数据推上去 */
async function maybeMigrateRemote() {
  if (!supabaseClient || !isOwner()) return;
  try {
    const { data, error } = await supabaseClient
      .from(SITE_DATA_TABLE)
      .select('data')
      .eq('id', SITE_DATA_ID)
      .maybeSingle();
    if (error) return;
    const empty =
      !data || typeof data.data !== 'object' ||
      Object.keys(data.data || {}).length === 0;
    if (empty) {
      await supabaseClient
        .from(SITE_DATA_TABLE)
        .upsert(
          { id: SITE_DATA_ID, data: state, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
    }
  } catch (err) {
    /* 忽略：首次迁移失败不阻塞，之后任一保存操作会自动补齐 */
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
      /* 只持久化账号与昵称；站长标记是运行时状态，不落盘 */
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ account: session.account, name: session.name })
      );
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch (err) {
    /* 同上 */
  }
}

function isOwner() {
  return !!(session && ownerVerified);
}

/* 站长邮箱白名单校验（本地兜底：云端名单不可用时生效） */
function emailIsOwner(email) {
  if (!email) return false;
  return (
    CONFIG.ownerAccounts
      .map(function (a) {
        return a.trim().toLowerCase();
      })
      .indexOf(String(email).trim().toLowerCase()) !== -1
  );
}

/* 站长身份判定：优先查 Supabase 云端的 site_admins 名单（Rpc: is_site_admin），
   失败/未配置时回退到代码里的 CONFIG.ownerAccounts。
   加人只需往 Supabase 的 site_admins 表插一行，不用改代码也不用重新部署。 */
async function verifyOwnerRemote() {
  if (!supabaseClient) return false;
  try {
    const { data, error } = await supabaseClient.rpc('is_site_admin');
    if (error) {
      /* 未建表/未建函数：回退到本地名单 */
      return emailIsOwner(session && session.account);
    }
    return data === true;
  } catch (err) {
    return emailIsOwner(session && session.account);
  }
}

/* ===== 管理员管理：导航栏「＋」入口，仅站长可见 =====
   名单存在 Supabase 的 site_admins 表（需先执行 supabase_admin_setup.sql），
   添加后对方用该邮箱注册激活、登录即自动获得编辑权限。 */
const ADMINS_TABLE = 'site_admins';

async function openAdminModal() {
  if (!supabaseClient) {
    showToast('未连接云端，暂时无法管理管理员');
    return;
  }
  dom.adminEmail.value = '';
  openModal('adminModal');
  loadAdminList();
}

async function loadAdminList() {
  dom.adminList.textContent = '';
  const { data, error } = await supabaseClient
    .from(ADMINS_TABLE)
    .select('email')
    .order('added_at', { ascending: true });

  if (error) {
    const li = document.createElement('li');
    li.className = 'admin-empty';
    li.textContent =
      '多管理员还没开启：请先在 Supabase 的 SQL Editor 执行 supabase_admin_setup.sql';
    dom.adminList.appendChild(li);
    return;
  }

  (data || []).forEach(function (row) {
    const li = document.createElement('li');
    li.className = 'admin-item';

    const mail = document.createElement('span');
    mail.className = 'admin-mail';
    mail.textContent = row.email;
    li.appendChild(mail);

    const del = document.createElement('button');
    del.className = 'admin-del';
    del.type = 'button';
    del.setAttribute('data-remove-admin', row.email);
    del.setAttribute('aria-label', '移除管理员：' + row.email);
    del.textContent = '移除';
    li.appendChild(del);

    dom.adminList.appendChild(li);
  });
}

async function submitAddAdmin() {
  const check = validateAccount(dom.adminEmail.value);
  if (!check.ok) {
    showToast(check.msg);
    return;
  }
  if (!supabaseClient) {
    showToast('未连接云端，暂时无法添加管理员');
    return;
  }

  const { error } = await supabaseClient
    .from(ADMINS_TABLE)
    .insert({ email: check.account });

  if (error) {
    if (/duplicate|23505|unique/i.test(error.message || '')) {
      showToast('这个邮箱已经是管理员了');
    } else {
      showToast('添加失败：' + (error.message || '请稍后再试'));
    }
    return;
  }

  dom.adminEmail.value = '';
  showToast('已添加，对方注册激活后登录即可共同维护');
  loadAdminList();
}

async function removeAdmin(email) {
  if (!supabaseClient) return;
  if (session && session.account && session.account.toLowerCase() === email) {
    showToast('不能移除自己');
    return;
  }

  const { error } = await supabaseClient
    .from(ADMINS_TABLE)
    .delete()
    .eq('email', email);

  if (error) {
    showToast('移除失败：' + (error.message || '请稍后再试'));
    return;
  }

  showToast('已移除管理员：' + email);
  loadAdminList();
}

/* 从 Supabase 会话恢复本站登录态（刷新页面后保持登录） */
async function restoreSupabaseSession() {
  if (!supabaseClient) return;
  try {
    const { data } = await supabaseClient.auth.getSession();
    const sbUser = data && data.session && data.session.user;
    if (!sbUser || !sbUser.email) {
      /* Supabase 无会话（本地/离线打开）时保留本地登录态，不覆盖 */
      return;
    }
    const email = sbUser.email.trim().toLowerCase();
    const metaName =
      (sbUser.user_metadata && sbUser.user_metadata.name) || '';
    const isOwnerAccount = await verifyOwnerRemote();
    session = {
      account: email,
      name: metaName || email.split('@')[0],
      isOwner: isOwnerAccount
    };
    ownerVerified = isOwnerAccount;
    saveSession();
    renderAll();
    /* 站长登录态恢复后，若公网还没有内容则把本地数据迁移上去 */
    maybeMigrateRemote();
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
  dom.editQunBtn = document.getElementById('editQunBtn');

  dom.joinModal = document.getElementById('joinModal');
  dom.qunView = document.getElementById('qunView');
  dom.qunNumber = document.getElementById('qunNumber');
  dom.qunName = document.getElementById('qunName');
  dom.qunNote = document.getElementById('qunNote');
  dom.qunCopyBtn = document.getElementById('qunCopyBtn');
  dom.qunEditBtn = document.getElementById('qunEditBtn');
  dom.qunForm = document.getElementById('qunForm');
  dom.qunNumberInput = document.getElementById('qunNumberInput');
  dom.qunNameInput = document.getElementById('qunNameInput');
  dom.qunNoteInput = document.getElementById('qunNoteInput');
  dom.qunCancelBtn = document.getElementById('qunCancelBtn');

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

  dom.forgotLink = document.getElementById('forgotLink');
  dom.forgotPanel = document.getElementById('forgotPanel');
  dom.forgotForm = document.getElementById('forgotForm');
  dom.forgotAccount = document.getElementById('forgotAccount');
  dom.forgotBackBtn = document.getElementById('forgotBackBtn');
  dom.resetPanel = document.getElementById('resetPanel');
  dom.resetForm = document.getElementById('resetForm');
  dom.resetPassword = document.getElementById('resetPassword');
  dom.resetPassword2 = document.getElementById('resetPassword2');

  dom.profileForm = document.getElementById('profileForm');
  dom.profileAvatar = document.getElementById('profileAvatar');
  dom.profileAvatarBtn = document.getElementById('profileAvatarBtn');
  dom.profileNickname = document.getElementById('profileNickname');
  dom.profileIntro = document.getElementById('profileIntro');
  dom.profileAbout = document.getElementById('profileAbout');

  dom.confirmText = document.getElementById('confirmText');
  dom.confirmOkBtn = document.getElementById('confirmOkBtn');

  dom.mailModal = document.getElementById('mailModal');
  dom.mailAddress = document.getElementById('mailAddress');
  dom.mailCopyBtn = document.getElementById('mailCopyBtn');
  dom.mailWebBtn = document.getElementById('mailWebBtn');

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
    /* 站长显示资料里改好的昵称；普通用户显示登录名 */
    dom.accountName.textContent =
      isOwner() && state.profile.nickname ? state.profile.nickname : session.name;
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
/* 标记：从「加入」按钮进入登录流程，登录成功后自动弹出 QQ 群号 */
let joinFlowPending = false;

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
    ownerVerified = false;
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
    if (btn && btn.dataset.type === 'contact') {
      if (btn.dataset.action === 'delete') {
        deleteItem('contacts', btn.dataset.id, '联系方式');
      } else if (btn.dataset.action === 'edit') {
        startEditContact(btn.dataset.id);
      }
      return;
    }
    /* 点击邮箱联系方式：打开发邮件面板（mailto 依赖系统邮件客户端，多数环境静默失败） */
    const mailLink = e.target.closest('a[href^="mailto:"]');
    if (mailLink) {
      e.preventDefault();
      openMailPanel(mailLink.getAttribute('href'));
    }
  });

  /* --- 加入资源仓库：未登录先登录，登录后自动弹 QQ 群；已登录直接看群号 --- */
  dom.joinBtn.addEventListener('click', function () {
    if (session) {
      openJoinModal();
    } else {
      joinFlowPending = true;
      openLoginModal('login');
    }
  });

  /* --- 标题旁加号：站长直接编辑 QQ 群信息 --- */
  dom.editQunBtn.addEventListener('click', openQunEditor);

  /* --- QQ 群弹窗：复制群号 / 编辑群信息 --- */
  dom.qunCopyBtn.addEventListener('click', copyQunNumber);
  dom.qunEditBtn.addEventListener('click', function () {
    dom.qunNumberInput.value = state.qqGroup.number || '';
    dom.qunNameInput.value = state.qqGroup.name || '';
    dom.qunNoteInput.value = state.qqGroup.note || '';
    dom.qunView.hidden = true;
    dom.qunForm.hidden = false;
    dom.qunNumberInput.focus();
  });
  dom.qunCancelBtn.addEventListener('click', function () {
    dom.qunForm.hidden = true;
    dom.qunView.hidden = false;
  });
  dom.qunForm.addEventListener('submit', function (e) {
    e.preventDefault();
    submitQunForm();
  });

  /* --- 登录：邮箱 + 密码 --- */
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

  /* --- 忘记密码：打开面板 / 发送重置邮件 / 返回登录 --- */
  dom.forgotLink.addEventListener('click', openForgotPanel);
  dom.forgotForm.addEventListener('submit', function (e) {
    e.preventDefault();
    submitResetPassword();
  });
  dom.forgotBackBtn.addEventListener('click', function () {
    switchLoginTab('login');
  });

  /* --- 设置新密码：邮件链接跳回网站后提交 --- */
  dom.resetForm.addEventListener('submit', function (e) {
    e.preventDefault();
    submitNewPassword();
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

  /* --- 管理员管理（站长专属） --- */
  dom.addAdminBtn = document.getElementById('addAdminBtn');
  dom.adminModal = document.getElementById('adminModal');
  dom.adminForm = document.getElementById('adminForm');
  dom.adminEmail = document.getElementById('adminEmail');
  dom.adminList = document.getElementById('adminList');
  dom.addAdminBtn.addEventListener('click', openAdminModal);
  dom.adminForm.addEventListener('submit', function (e) {
    e.preventDefault();
    submitAddAdmin();
  });
  dom.adminList.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-remove-admin]');
    if (!btn) return;
    const email = btn.getAttribute('data-remove-admin');
    askConfirm(
      '确定移除管理员「' + email + '」吗？移除后对方立即失去编辑权限。',
      function () {
        removeAdmin(email);
      }
    );
  });

  /* --- 联系邮箱弹窗：复制邮箱地址 --- */
  dom.mailCopyBtn.addEventListener('click', copyMailAddress);
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
  dom.forgotPanel.hidden = true;
  dom.resetPanel.hidden = true;
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
    const isOwnerAccount = await verifyOwnerRemote();
    session = {
      account: accCheck.account,
      name: metaName || name || accCheck.account.split('@')[0],
      isOwner: isOwnerAccount
    };
    ownerVerified = isOwnerAccount;
    saveSession();
    dom.loginForm.reset();
    closeModal('loginModal');
    renderAll();
    /* 从「加入」进入登录的，登录成功后直接弹出 QQ 群号 */
    if (joinFlowPending) {
      joinFlowPending = false;
      openJoinModal();
    }
    showToast(
      isOwnerAccount
        ? '站长登录成功，现在可以编辑内容了'
        : '欢迎回来，' + (metaName || name)
    );
    /* 站长登录后：若公网还没有内容则把本地数据迁移上去 */
    maybeMigrateRemote();
  } catch (err) {
    showToast('网络错误，请稍后重试');
  } finally {
    btn.disabled = false;
  }
}

/* =========================================================
   7.6 忘记密码 / 重置密码（Supabase resetPasswordForEmail）
   ========================================================= */
function openForgotPanel() {
  dom.loginForm.hidden = true;
  dom.registerForm.hidden = true;
  dom.loginHint.hidden = true;
  dom.registerHint.hidden = true;
  dom.regSuccess.hidden = true;
  dom.resetPanel.hidden = true;
  dom.forgotPanel.hidden = false;
  dom.forgotForm.reset();
  setTimeout(function () {
    dom.forgotAccount.focus();
  }, 50);
}

async function submitResetPassword() {
  const account = dom.forgotAccount.value.trim();
  const accCheck = validateAccount(account);
  if (!accCheck.ok) {
    showToast(accCheck.msg);
    return;
  }
  if (!supabaseClient) {
    showToast('账号系统未加载，请刷新页面重试');
    return;
  }
  const btn = dom.forgotForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    /* 重置链接跳回本站首页，再由页面识别 token 进入「设置新密码」面板 */
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(
      accCheck.account,
      { redirectTo: redirectTo }
    );
    if (error) {
      const msg = error.message || '';
      if (/rate limit|too many|over_request_rate_limit/i.test(msg)) {
        showToast('发送太频繁，请等几分钟再试');
      } else {
        showToast('发送失败：' + msg);
      }
      return;
    }
    showToast('重置邮件已发送，请前往邮箱查看');
    switchLoginTab('login');
  } catch (err) {
    showToast('网络错误，请稍后重试');
  } finally {
    btn.disabled = false;
  }
}

/* 从重置邮件链接跳回网站时，Supabase 触发 PASSWORD_RECOVERY 事件 */
function openResetPanel() {
  switchLoginTab('login');
  dom.loginForm.hidden = true;
  dom.registerForm.hidden = true;
  dom.loginHint.hidden = true;
  dom.registerHint.hidden = true;
  dom.regSuccess.hidden = true;
  dom.forgotPanel.hidden = true;
  dom.resetPanel.hidden = false;
  openModal('loginModal');
  setTimeout(function () {
    dom.resetPassword.focus();
  }, 60);
}

async function submitNewPassword() {
  const p1 = dom.resetPassword.value;
  const p2 = dom.resetPassword2.value;
  if (p1.length < 6) {
    showToast('密码至少 6 位');
    return;
  }
  if (p1 !== p2) {
    showToast('两次输入的密码不一致');
    return;
  }
  if (!supabaseClient) {
    showToast('账号系统未加载，请刷新页面重试');
    return;
  }
  const btn = dom.resetForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const { error } = await supabaseClient.auth.updateUser({ password: p1 });
    if (error) {
      showToast('修改失败：' + (error.message || ''));
      return;
    }
    dom.resetForm.reset();
    switchLoginTab('login');
    showToast('密码已更新，请用新密码登录');
  } catch (err) {
    showToast('网络错误，请稍后重试');
  } finally {
    btn.disabled = false;
  }
}

/* 监听 Supabase 认证事件：重置邮件链接回站时打开「设置新密码」面板 */
function listenAuthState() {
  if (!supabaseClient) return;
  try {
    supabaseClient.auth.onAuthStateChange(function (event) {
      if (event === 'PASSWORD_RECOVERY') openResetPanel();
      /* 任意登录成功（含注册后自动登录）都触发公网数据迁移检查 */
      if (event === 'SIGNED_IN') maybeMigrateRemote();
    });
  } catch (err) {
    /* 忽略：监听失败仅失去自动弹出改密面板的能力 */
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

/* =========================================================
   9.6 管理员管理（站长专属：多人共同维护）
   名单存在 Supabase 的 site_admins 表，由 is_site_admin() + RLS 保护：
   只有已是站长的账号才能查看、添加、移除管理员。
   ========================================================= */
const ADMIN_TABLE = 'site_admins';

function openAdminModal() {
  if (!isOwner()) return;
  openModal('adminModal');
  dom.adminEmail.value = '';
  loadAdminList();
  setTimeout(function () {
    dom.adminEmail.focus();
  }, 60);
}

async function loadAdminList() {
  dom.adminList.textContent = '';
  if (!supabaseClient) {
    dom.adminList.appendChild(adminEmptyRow('账号系统未加载，请刷新页面'));
    return;
  }
  try {
    const { data, error } = await supabaseClient
      .from(ADMIN_TABLE)
      .select('email')
      .order('added_at', { ascending: true });
    if (error) {
      dom.adminList.appendChild(
        adminEmptyRow('未开启多管理员：请先按 supabase_admin_setup.sql 配置数据库')
      );
      return;
    }
    if (!data || !data.length) {
      dom.adminList.appendChild(adminEmptyRow('暂无管理员'));
      return;
    }
    data.forEach(function (row) {
      if (row && row.email) dom.adminList.appendChild(buildAdminRow(row.email));
    });
  } catch (err) {
    dom.adminList.appendChild(adminEmptyRow('读取管理员名单失败'));
  }
}

function adminEmptyRow(text) {
  const li = document.createElement('li');
  li.className = 'admin-empty';
  li.textContent = text;
  return li;
}

function buildAdminRow(email) {
  const li = document.createElement('li');
  li.className = 'admin-row';

  const name = document.createElement('span');
  name.className = 'admin-email';
  name.textContent = email;
  li.appendChild(name);

  const btn = document.createElement('button');
  btn.className = 'btn btn-danger btn-sm';
  btn.type = 'button';
  btn.textContent = '移除';
  btn.setAttribute('data-remove-admin', email);
  li.appendChild(btn);

  return li;
}

async function submitAddAdmin() {
  const check = validateAccount(dom.adminEmail.value);
  if (!check.ok) {
    showToast(check.msg);
    return;
  }
  if (!supabaseClient) {
    showToast('账号系统未加载，请刷新页面重试');
    return;
  }
  const btn = dom.adminForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const { error } = await supabaseClient
      .from(ADMIN_TABLE)
      .insert({ email: check.account });
    if (error) {
      const msg = error.message || '';
      if (/duplicate|unique/i.test(msg)) {
        showToast('该邮箱已经是管理员了');
      } else if (/policy|row-level|permission|denied/i.test(msg)) {
        showToast('没有权限：请先在 Supabase 执行 supabase_admin_setup.sql');
      } else if (/relation .* does not exist|not found/i.test(msg)) {
        showToast('缺少 site_admins 表：请先执行 supabase_admin_setup.sql');
      } else {
        showToast('添加失败：' + msg);
      }
      return;
    }
    dom.adminEmail.value = '';
    showToast('已添加管理员：' + check.account);
    loadAdminList();
  } catch (err) {
    showToast('网络错误，添加失败');
  } finally {
    btn.disabled = false;
  }
}

async function removeAdmin(email) {
  if (!supabaseClient || !email) return;
  try {
    const { error } = await supabaseClient
      .from(ADMIN_TABLE)
      .delete()
      .eq('email', email);
    if (error) {
      showToast('移除失败：' + (error.message || '请稍后重试'));
      return;
    }
    showToast('已移除管理员：' + email);
    loadAdminList();
  } catch (err) {
    showToast('网络错误，移除失败');
  }
}

/* =========================================================
   9.5 联系邮箱弹窗（mailto 依赖系统邮件客户端，改为复制 / 网页版写信）
   ========================================================= */
function openMailPanel(href) {
  const email = String(href || '').replace(/^mailto:/i, '').split('?')[0];
  if (!email) return;
  dom.mailAddress.textContent = email;
  /* QQ 邮箱 / Foxmail 提供「网页版写信」直达链接，其他邮箱隐藏该按钮 */
  const isQQMail = /@(qq\.com|foxmail\.com)$/i.test(email);
  dom.mailWebBtn.hidden = !isQQMail;
  if (isQQMail) {
    dom.mailWebBtn.href =
      'https://mail.qq.com/cgi-bin/qm_share?t=qm_mailme&email=' +
      encodeURIComponent(email);
  }
  openModal('mailModal');
}

function copyMailAddress() {
  const text = dom.mailAddress.textContent;
  if (!text) return;
  const done = function () {
    closeModal('mailModal');
    showToast('邮箱地址已复制');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(function () {
      fallbackCopy(text);
      done();
    });
  } else {
    fallbackCopy(text);
    done();
  }
}

/* 剪贴板 API 不可用时降级为临时输入框复制 */
function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (err) {
    /* 忽略 */
  }
}

/* =========================================================
   9.6 QQ 群加入弹窗（群号 / 群名称 / 群备注，站长可改）
   ========================================================= */
function openJoinModal() {
  dom.qunForm.hidden = true;
  dom.qunView.hidden = false;
  const q = state.qqGroup || {};
  if (q.number) {
    dom.qunNumber.textContent = 'QQ 群号：' + q.number;
    dom.qunCopyBtn.hidden = false;
  } else {
    dom.qunNumber.textContent = '群信息待站长填写';
    dom.qunCopyBtn.hidden = true;
  }
  dom.qunName.textContent = q.name || '';
  dom.qunName.hidden = !q.name;
  dom.qunNote.textContent = q.note || '';
  dom.qunNote.hidden = !q.note;
  openModal('joinModal');
}

/* 标题旁加号：站长直接打开群信息编辑表单 */
function openQunEditor() {
  if (!isOwner()) return;
  dom.qunNumberInput.value = (state.qqGroup && state.qqGroup.number) || '';
  dom.qunNameInput.value = (state.qqGroup && state.qqGroup.name) || '';
  dom.qunNoteInput.value = (state.qqGroup && state.qqGroup.note) || '';
  dom.qunView.hidden = true;
  dom.qunForm.hidden = false;
  openModal('joinModal');
  setTimeout(function () {
    dom.qunNumberInput.focus();
  }, 80);
}

function copyQunNumber() {
  const num = (state.qqGroup && state.qqGroup.number) || '';
  if (!num) return;
  const done = function () {
    showToast('群号已复制，去 QQ 搜索加入吧');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(num).then(done).catch(function () {
      fallbackCopy(num);
      done();
    });
  } else {
    fallbackCopy(num);
    done();
  }
}

function submitQunForm() {
  if (!isOwner()) {
    showToast('仅站长可修改群信息');
    return;
  }
  const number = dom.qunNumberInput.value.trim();
  if (!number) {
    showToast('请填写群号');
    return;
  }
  state.qqGroup.number = number;
  state.qqGroup.name = dom.qunNameInput.value.trim();
  state.qqGroup.note = dom.qunNoteInput.value.trim();
  saveState();
  dom.qunForm.hidden = true;
  dom.qunView.hidden = false;
  openJoinModal();
  showToast('群信息已保存');
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
  listenAuthState();

  dom.brandName.textContent = CONFIG.siteName;
  dom.footerSite.textContent = CONFIG.siteName;
  dom.year.textContent = String(new Date().getFullYear());
  document.title = CONFIG.siteName;

  renderAll();
  resetResourceForm();
  resetContactForm();

  /* 云端同步：打开页面时拉取公网最新内容（实现"修改后自动更新"） */
  fetchRemoteState();

  /* PWA：注册 Service Worker（失败不影响页面正常使用） */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {
        /* 忽略：不支持或注册失败时仅失去离线能力 */
      });
    });
  }

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
