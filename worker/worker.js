/* =========================================================
   薛朗的资源仓库 · 邮箱验证码服务（Cloudflare Worker）
   ---------------------------------------------------------
   部署步骤（Cloudflare 免费计划即可）：
   1. 登录 dash.cloudflare.com →「Workers 和 Pages」→「创建应用程序」
      →「创建 Worker」（名称随意，例如 email-code）
   2. 把本文件全部内容粘贴进编辑器（替换默认模板），点「部署」
   3. 「设置」→「变量和机密」→「添加」两个机密：
        SMTP_USER = 你的 QQ 邮箱完整地址（如 123456@qq.com）
        SMTP_AUTH = QQ 邮箱「SMTP 服务授权码」（不是 QQ 密码）
   4. 复制部署后生成的地址 https://email-code.xxxx.workers.dev，
      填入前端 script.js 的 CONFIG.emailWorkerUrl 即可生效
   ========================================================= */

import { connect } from 'cloudflare:sockets';

/* 验证码临时存储（Worker 内存，重启会清空，个人站点足够用；
   如需重启不丢，可改用 Cloudflare KV 后替换本实现） */
const codeStore = new Map();

const SENDER_NAME = '薛朗的资源仓库';
const CODE_TTL_MS = 5 * 60 * 1000; /* 验证码 5 分钟有效 */
const RESEND_LIMIT_MS = 60 * 1000; /* 同一邮箱 60 秒内限发一次 */

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    if (request.method === 'GET') {
      return json({ ok: true, name: SENDER_NAME, endpoints: ['/send', '/verify'] }, 200, cors);
    }
    if (request.method !== 'POST') {
      return json({ ok: false, msg: '仅支持 POST' }, 405, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ ok: false, msg: '请求格式错误' }, 400, cors);
    }

    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, msg: '邮箱格式不正确' }, 400, cors);
    }

    if (url.pathname === '/send') {
      return handleSend(env, email, cors);
    }
    if (url.pathname === '/verify') {
      return handleVerify(email, String(body.code || '').trim(), cors);
    }
    return json({ ok: false, msg: '未知接口' }, 404, cors);
  }
};

async function handleSend(env, email, cors) {
  if (!env.SMTP_USER || !env.SMTP_AUTH) {
    return json({ ok: false, msg: '服务端未配置 SMTP，请联系站长' }, 500, cors);
  }

  const last = codeStore.get(email);
  if (last && Date.now() - last.sentAt < RESEND_LIMIT_MS) {
    return json({ ok: false, msg: '发送太频繁，请 60 秒后再试' }, 429, cors);
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const ok = await sendMail(env, email, code);
  if (!ok) {
    return json({ ok: false, msg: '邮件发送失败，请稍后重试' }, 502, cors);
  }

  codeStore.set(email, {
    code: code,
    sentAt: Date.now(),
    expiresAt: Date.now() + CODE_TTL_MS
  });
  return json({ ok: true, msg: '验证码已发送' }, 200, cors);
}

async function handleVerify(email, code, cors) {
  const rec = codeStore.get(email);
  if (!rec || Date.now() > rec.expiresAt) {
    codeStore.delete(email);
    return json({ ok: false, msg: '验证码已过期，请重新获取' }, 200, cors);
  }
  if (rec.code !== code) {
    return json({ ok: false, msg: '验证码不正确' }, 200, cors);
  }
  codeStore.delete(email);
  return json({ ok: true, msg: '验证通过' }, 200, cors);
}

/* ---------------- SMTP 发送（QQ 邮箱：smtp.qq.com:465） ---------------- */
async function sendMail(env, to, code) {
  const socket = connect({
    hostname: 'smtp.qq.com',
    port: 465,
    secureTransport: 'on'
  });

  const s = new SmtpSession(socket);
  try {
    const subject = '【' + SENDER_NAME + '】注册验证码';
    const text =
      '你好！\n\n' +
      '你在「' + SENDER_NAME + '」注册时使用的验证码是：\n\n' +
      '    ' + code + '\n\n' +
      '验证码 5 分钟内有效，请勿泄露给他人。\n' +
      '如果这不是你的操作，请忽略本邮件。\n' +
      '\n—— ' + SENDER_NAME + '';

    await s.expect(220, '连接 SMTP 服务器失败');
    await s.send('EHLO wangzhan112.pages.dev');
    await s.expect(250, 'EHLO 失败');
    await s.send('AUTH LOGIN');
    await s.expect(334, 'AUTH 失败');
    await s.send(btoa(env.SMTP_USER));
    await s.expect(334, '用户名认证失败');
    await s.send(btoa(env.SMTP_AUTH));
    await s.expect(235, '授权码认证失败（请检查 SMTP_AUTH 是否正确）');
    await s.send('MAIL FROM:<' + env.SMTP_USER + '>');
    await s.expect(250, '发件人地址被拒绝');
    await s.send('RCPT TO:<' + to + '>');
    await s.expect(250, '收件人地址被拒绝');
    await s.send('DATA');
    await s.expect(354, 'DATA 阶段失败');
    const data =
      'From: ' + env.SMTP_USER + '\r\n' +
      'To: ' + to + '\r\n' +
      'Subject: ' + subject + '\r\n' +
      'MIME-Version: 1.0\r\n' +
      'Content-Type: text/plain; charset=utf-8\r\n' +
      '\r\n' +
      text + '\r\n.';
    await s.sendRaw(data);
    await s.expect(250, '邮件内容发送失败');
    await s.send('QUIT');
    return true;
  } catch (e) {
    console.error('sendMail error:', e && e.message);
    return false;
  } finally {
    try {
      socket.close();
    } catch (e) { /* ignore */ }
  }
}

class SmtpSession {
  constructor(socket) {
    this.socket = socket;
    this.writer = socket.writable.getWriter();
    this.reader = socket.readable.getReader();
    this.acc = '';
    this.decoder = new TextDecoder();
  }

  async send(line) {
    await this.writer.write(new TextEncoder().encode(line + '\r\n'));
  }

  async sendRaw(raw) {
    await this.writer.write(new TextEncoder().encode(raw + '\r\n'));
  }

  async readLine(timeoutMs) {
    const deadline = Date.now() + (timeoutMs || 15000);
    while (true) {
      const idx = this.acc.indexOf('\n');
      if (idx !== -1) {
        const line = this.acc.slice(0, idx).replace(/\r$/, '');
        this.acc = this.acc.slice(idx + 1);
        return line;
      }
      if (Date.now() > deadline) {
        throw new Error('SMTP 读取超时');
      }
      const { value, done } = await this.reader.read();
      if (done) throw new Error('SMTP 连接被关闭');
      this.acc += this.decoder.decode(value, { stream: true });
    }
  }

  /* 等待以期望状态码开头的一行；支持多行响应（250-xxx ... 250 ok） */
  async expect(code, errMsg) {
    const line = await this.readLine();
    const got = parseInt(line.slice(0, 3), 10);
    if (got !== code) {
      throw new Error((errMsg || 'SMTP 响应异常') + '：' + line);
    }
    let last = line;
    while (last.length > 3 && last.charAt(3) === '-') {
      last = await this.readLine();
    }
  }
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: Object.assign(
      { 'Content-Type': 'application/json; charset=utf-8' },
      cors
    )
  });
}
