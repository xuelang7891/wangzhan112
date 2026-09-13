# 薛朗的资源仓库

一个轻量、无依赖的个人资源仓库网页。展示个人收藏的网站与链接，支持站长登录后在线编辑资源、联系方式、个人资料与头像。

- 纯原生 HTML / CSS / JS，页面样式与逻辑分离（style.css / script.js）
- 浅灰背景 + 深灰文字 + 单一青色强调色，简约、干净、现代
- 响应式设计，适配手机与电脑屏幕
- **PWA（路线 A）**：支持「添加到主屏幕」，手机桌面获得 App 图标 + 全屏独立窗口体验，离线可用
- 账号系统：**Supabase Auth（邮箱注册）**，邮箱验证邮件由 Supabase 平台代发，账号数据存云端
- 站点内容（资源 / 联系方式 / 资料 / 头像）保存在浏览器 localStorage

## 文件结构

```
xuelang-resource-hub/
├── index.html      页面结构
├── style.css       全部样式
├── script.js       全部逻辑
├── manifest.json   PWA 清单（添加到主屏幕）
├── sw.js           Service Worker（离线缓存）
├── icons/          应用图标（180 / 192 / 512）
└── README.md       说明文档
```

## 快速开始

直接用浏览器打开 `index.html` 即可使用（无需安装任何东西）。

> PWA 提示：Service Worker 仅在 HTTPS 环境下生效（pages.dev 等线上环境正常）。本地用浏览器直接打开文件时无法注册，属正常现象，不影响浏览。

## 账号系统（Supabase，邮箱单选）

- **注册**：填写名字 + 邮箱 + 密码 → 点击注册 → Supabase 平台自动向邮箱发送**验证邮件** → 点击邮件里的确认链接激活账号 → 即可登录。
- **登录**：邮箱 + 密码（名字选填，注册时填写的名字会自动展示）。
- 未激活的账号无法登录，页面会提示「该邮箱尚未激活」。
- 站长用 `3902041497@qq.com` 注册并登录后，即自动进入编辑模式（按邮箱识别）。

### Supabase 配置

在 `script.js` 顶部 `CONFIG` 中修改：

```js
const CONFIG = {
  siteName: '薛朗的资源仓库',
  ownerAccounts: ['3902041497@qq.com'],       // 站长邮箱（登录后可编辑）
  ownerEmail: '3902041497@qq.com',
  supabaseUrl: 'https://ojiueppupuhctqbvjagk.supabase.co',   // 项目地址
  supabaseAnonKey: 'sb_publishable_...'                       // 可发布密钥（浏览器安全）
};
```

- 在 [Supabase 控制台](https://app.supabase.com) 创建免费项目 → Authentication → Sign In / Providers → Email 开启（默认开启，Confirm email 默认打开）。
- 建议在 Authentication → URL Configuration 中把 Site URL 设为你的站点地址（如 `https://wangzhan112.pages.dev`），这样验证邮件里的链接会直接打开你的网站。
- `supabase-js` 通过 jsdelivr CDN 引入（国内可访问）；若 CDN 被拦截，登录/注册会提示「账号系统未加载」，刷新或更换 CDN 即可。

## 自定义（站长必看）

- **默认内容**：昵称、一句话简介、关于我、示例资源与联系方式都在 `script.js` 的 `defaultState()` 中，也可以登录后在页面上直接修改。
- **站长账号**：在 Supabase 中注册 `3902041497@qq.com` 并激活，登录后自动成为站长（无需在代码中预置密码）。

## 功能说明

- 顶部导航：首页 / 薛朗的资源 / 加入薛朗的资源仓库 / 联系我
- 账号系统：邮箱注册（平台代发验证邮件）→ 激活 → 邮箱 + 密码登录
- 资源管理：在「薛朗的资源」底部输入名称与链接即可发布，访客点击即可跳转
- 联系我：添加邮箱、GitHub 等联系方式，访客点击即可跳转
- 头像：站长登录后点击首页大头像即可更换（自动压缩后保存）
- 首次进入会弹窗提示头像在哪里修改

> **数据说明**：账号数据（邮箱、密码、验证状态）存储在 Supabase 云端；站点内容（资源 / 联系方式 / 资料 / 头像）保存在访问者浏览器的 localStorage 中，换浏览器或清除缓存后会回到默认内容。

## 部署到开源仓库 / 静态托管

本项目的 HTML / CSS / JS 相互独立，直接上传到任意静态托管即可：

- **GitHub Pages**：推送到仓库后，在 Settings → Pages 选择分支即可开启
- **Cloudflare Pages / Vercel / Netlify / Gitee Pages** 等同样直接部署，无需构建

## 技术要点

- 所有用户输入均通过 `textContent` 渲染，链接地址经过白名单校验（仅 http/https/mailto/tel），防止注入
- 头像图片压缩到 512px 以内再存入 localStorage，避免超出存储限额
- localStorage 不可用时自动降级为内存存储，页面不会报错
- 支持键盘焦点、`prefers-reduced-motion`、移动端点击目标不小于 44px
- PWA：`manifest.json` 提供主屏幕安装信息；`sw.js` 实现离线缓存（导航网络优先、静态资源缓存优先 + 后台更新，外部请求不缓存）

## License

MIT

> **更新记录**：
> - 2026-09-13 新增 PWA 支持（manifest + 图标 + Service Worker），可添加到手机主屏幕获得 App 体验。
> - 2026-09-13 接入 Supabase 邮箱账号系统：注册 → 平台代发验证邮件 → 点链接激活 → 邮箱 + 密码登录（Firebase 因国内不可访问未采用）。
> - 2026-09-12 移除邮箱验证码（QQ 邮箱 SMTP 在海外服务器被拦截，导致邮件无法发送）。
