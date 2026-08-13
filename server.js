/**
 * CyberMerge — 后端服务（Express）
 *
 * 功能：
 *   1. Telegram 身份鉴权（HMAC-SHA256 验真 initData）
 *   2. 自动开户并赠送 1000 金币
 *
 * 运行：
 *   node server.js          （监听 4000 端口）
 *   或 npm start
 */

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════ 配置 ═══════
// Bot Token 从环境变量读取，本地开发可在此临时写死（务必不要提交到仓库）
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const PORT = process.env.PORT || 4000;
const INITIAL_GOLD = 1000;                       // 新用户开户赠送金币

const app = express();
app.use(cors());                                  // 允许跨域
app.use(bodyParser.json());                       // 解析 JSON 请求体

// ═══════ 用户存储（内存 + JSON 文件持久化，方便本地调试）═══════
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');

/** @type {Map<string, object>} key = Telegram user id */
const users = new Map();

function loadUsers() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const obj = JSON.parse(raw);
    for (const [id, u] of Object.entries(obj)) users.set(id, u);
  } catch (_) { /* 忽略读取失败，从空库开始 */ }
}

function saveUsers() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(users), null, 2), 'utf-8');
  } catch (_) { /* 忽略写入失败，仅内存态 */ }
}

// ═══════ Telegram initData 验真（HMAC-SHA256）═══════
function verifyInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, error: 'missing hash' };

  // 1) data-check-string：剔除 hash 后，按 key 字母序拼接 "key=value\n"
  const dataCheckString = [...params.entries()]
    .filter(([k]) => k !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  // 2) secret_key = HMAC_SHA256(key="WebAppData", data=bot_token)
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();

  // 3) computed = HMAC_SHA256(key=secret_key, data=data_check_string) → hex
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computed !== hash) return { ok: false, error: 'invalid hash' };

  let user = null;
  try {
    const userRaw = params.get('user');
    if (userRaw) user = JSON.parse(userRaw);
  } catch (_) { /* user 字段非法则忽略 */ }

  return { ok: true, user };
}

// ═══════ 路由 ═══════
// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'cybermerge-backend' });
});

// Telegram 身份鉴权 + 自动开户送金币
app.post('/api/auth', (req, res) => {
  const initData = req.body?.initData;
  if (!initData) {
    return res.status(400).json({ ok: false, error: 'initData required' });
  }

  const v = verifyInitData(initData);
  if (!v.ok) {
    return res.status(401).json({ ok: false, error: v.error });
  }
  if (!v.user?.id) {
    return res.status(400).json({ ok: false, error: 'invalid user' });
  }

  const id = String(v.user.id);
  let account = users.get(id);
  let isNew = false;

  if (!account) {
    account = {
      id,
      username: v.user.username || null,
      firstName: v.user.first_name || null,
      gold: INITIAL_GOLD,
      createdAt: Date.now(),
    };
    users.set(id, account);
    isNew = true;
    saveUsers();
  }

  res.json({ ok: true, isNew, user: account });
});

// 查询用户金币（调试用）
app.get('/api/user/:id', (req, res) => {
  const account = users.get(String(req.params.id));
  if (!account) return res.status(404).json({ ok: false, error: 'user not found' });
  res.json({ ok: true, user: account });
});

// ═══════ 启动 ═══════
loadUsers();
app.listen(PORT, () => {
  console.log(`✅ CyberMerge backend listening on http://localhost:${PORT}`);
  if (BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.warn('⚠️  请设置环境变量 BOT_TOKEN（或修改 server.js 顶部），否则 Telegram 验真会失败');
  }
});
