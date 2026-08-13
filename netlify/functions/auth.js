import crypto from 'crypto';
import { MongoClient } from 'mongodb';

// 安全：敏感配置一律从环境变量读取，代码里不出现任何明文密码
const BOT_TOKEN = process.env.BOT_TOKEN || '你的BotToken';
const MONGODB_URI = process.env.MONGODB_URI || '';

const DB_NAME = 'cybermerge';
const COLLECTION = 'users';
const TOTAL = 16;
const MAX_LV = 40;

// 复用 MongoClient 连接（Netlify warm instance 内共享，避免每次冷启动都重连）
let clientPromise = null;

function getClient() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI 未配置');
  if (!clientPromise) {
    clientPromise = MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
  }
  return clientPromise;
}

// Telegram initData 验真（HMAC-SHA256）
function verifyInitData(initData) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  if (!hash) return { ok: false, error: 'missing hash' };
  urlParams.delete('hash');

  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${key}=${val}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (calculatedHash !== hash) return { ok: false, error: 'invalid hash' };

  let user = null;
  try {
    const userRaw = urlParams.get('user');
    if (userRaw) user = JSON.parse(userRaw);
  } catch (err) {
    console.error('Auth verification failed: invalid user JSON:', err.message, 'userRaw:', urlParams.get('user'));
  }

  return { ok: true, user };
}

export const handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { initData, action, data, inviterId } = body;

    if (!initData) {
      return { statusCode: 401, body: JSON.stringify({ success: false, message: '无授权信息' }) };
    }

    // 测试模式（环境变量 ALLOW_TEST_AUTH=true）：测试数据无 hash 时跳过验真，仅用于电脑浏览器本地调试
    let v;
    if (process.env.ALLOW_TEST_AUTH === 'true' && !initData.includes('hash=')) {
      const p = new URLSearchParams(initData);
      let u = null;
      try { const ur = p.get('user'); if (ur) u = JSON.parse(ur); } catch(_) {}
      v = { ok: true, user: u };
    } else {
      v = verifyInitData(initData);
    }
    if (!v.ok) {
      console.error('Auth verification failed:', v.error, 'initData:', initData);
      return { statusCode: 403, body: JSON.stringify({ success: false, message: '验真失败' }) };
    }
    if (!v.user?.id) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'invalid user' }) };
    }

    const tgId = String(v.user.id);
    const client = await getClient();
    const col = client.db(DB_NAME).collection(COLLECTION);

    // 查找已有用户，没有则自动开户（送 1000 金币 + 空 grid）
    let user = await col.findOne({ tgId });
    if (!user) {
      const newUser = {
        tgId,
        username: v.user.username || 'unknown',
        coins: 1000,
        grid: new Array(TOTAL).fill(null),
        buyCount: 0,
        adUsedToday: 0,
        wdAdUsed: 0,
        pokedex: [],
        settings: { lang: 'zh', music: '1', sfx: '1', wallet: null },
        aiUnlockDay: '',
        inviteCount: 0,
        createdAt: Date.now(),
      };
      await col.insertOne(newUser);
      user = newUser;

      // 邀请裂变：新用户带 inviterId 时，给邀请者发金币奖励 + inviteCount++
      if (inviterId) {
        const inviterTgId = String(inviterId);
        if (inviterTgId !== tgId) {                 // 防止自己邀请自己
          const inviter = await col.findOne({ tgId: inviterTgId });
          if (inviter) {
            await col.updateOne(
              { tgId: inviterTgId },
              { $inc: { coins: 5000, inviteCount: 1 }, $set: { updatedAt: Date.now() } }
            );
          }
        }
      }
    }

    // save 动作：把前端最新存档写回 MongoDB
    if (action === 'save' && data && typeof data === 'object') {
      const upd = { updatedAt: Date.now() };

      if (typeof data.coins === 'number') upd.coins = data.coins;

      // grid 规范化：补齐 16 格，非法等级置 null
      if (Array.isArray(data.grid)) {
        const g = [];
        for (let i = 0; i < TOTAL; i++) {
          const x = data.grid[i];
          g.push((typeof x === 'number' && x >= 1 && x <= MAX_LV) ? x : null);
        }
        upd.grid = g;
      }

      if (typeof data.buyCount === 'number') upd.buyCount = data.buyCount;
      if (typeof data.adUsedToday === 'number') upd.adUsedToday = data.adUsedToday;
      if (typeof data.wdAdUsed === 'number') upd.wdAdUsed = data.wdAdUsed;
      if (Array.isArray(data.pokedex)) upd.pokedex = data.pokedex.filter(x => typeof x === 'number');
      if (typeof data.inviteCount === 'number') upd.inviteCount = data.inviteCount;
      if (typeof data.aiUnlockDay === 'string') upd.aiUnlockDay = data.aiUnlockDay;

      if (data.settings && typeof data.settings === 'object') {
        upd.settings = {
          lang: data.settings.lang || 'zh',
          music: data.settings.music || '1',
          sfx: data.settings.sfx || '1',
          wallet: data.settings.wallet || null,
        };
      }

      await col.updateOne({ tgId }, { $set: upd });
      user = await col.findOne({ tgId });
    }

    // 去掉 MongoDB 自动生成的 _id，避免序列化问题
    const { _id, ...safeUser } = user;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, user: safeUser })
    };

  } catch (err) {
    console.error('Auth handler error:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: err.message }) };
  }
};
