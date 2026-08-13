import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;

// 安全：敏感配置一律从环境变量读取，代码里不出现任何明文密码
const BOT_TOKEN = process.env.BOT_TOKEN || '你的BotToken';
const DATABASE_URL = process.env.DATABASE_URL || '';

const TOTAL = 16;
const MAX_LV = 40;

/*
 * Supabase (PostgreSQL) 表结构 —— 请在 Supabase SQL Editor 执行一次：
 *
 * CREATE TABLE IF NOT EXISTS users (
 *   tg_id         TEXT PRIMARY KEY,
 *   username      TEXT,
 *   coins         DOUBLE PRECISION DEFAULT 1000,
 *   grid          JSONB DEFAULT '[]'::jsonb,
 *   buy_count     INTEGER DEFAULT 0,
 *   ad_used_today INTEGER DEFAULT 0,
 *   wd_ad_used    INTEGER DEFAULT 0,
 *   pokedex       JSONB DEFAULT '[]'::jsonb,
 *   settings      JSONB DEFAULT '{}'::jsonb,
 *   ai_unlock_day TEXT DEFAULT '',
 *   invite_count  INTEGER DEFAULT 0,
 *   created_at    BIGINT DEFAULT 0,
 *   updated_at    BIGINT DEFAULT 0
 * );
 */

// 复用连接池（Netlify warm instance 内共享，避免每次冷启动都重连）
let pool = null;

function getPool() {
  if (!DATABASE_URL) throw new Error('DATABASE_URL 未配置');
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },   // Supabase Transaction Pooler 需要 SSL
    });
  }
  return pool;
}

// 将数据库行（snake_case）转换为前端用户对象（camelCase）
function rowToUser(row) {
  if (!row) return null;
  const parseJson = (v, d) => {
    if (v == null) return d;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch(_) { return d; } }
    return v;
  };
  return {
    tgId: row.tg_id,
    username: row.username,
    coins: Number(row.coins) || 0,
    grid: parseJson(row.grid, new Array(TOTAL).fill(null)),
    buyCount: Number(row.buy_count) || 0,
    adUsedToday: Number(row.ad_used_today) || 0,
    wdAdUsed: Number(row.wd_ad_used) || 0,
    pokedex: parseJson(row.pokedex, []),
    settings: parseJson(row.settings, { lang: 'zh', music: '1', sfx: '1', wallet: null }),
    aiUnlockDay: row.ai_unlock_day || '',
    inviteCount: Number(row.invite_count) || 0,
  };
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

    const allowTest = process.env.ALLOW_TEST_AUTH === 'true';
    const TEST_USER = { id: 12345678, first_name: 'TG_Test_User' };

    let authUser = null;

    if (!initData) {
      // initData 为空
      if (allowTest) {
        authUser = TEST_USER;                          // 测试模式：降级放行
      } else {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: '无授权信息' }) };
      }
    } else {
      const v = verifyInitData(initData);
      if (v.ok && v.user?.id) {
        authUser = v.user;                             // 验真通过：使用真实用户
      } else {
        if (allowTest) {
          // 测试模式：验真失败也降级放行，使用默认测试用户
          console.error('Auth verification failed, fallback to test user:', v.error, 'initData:', initData);
          authUser = TEST_USER;
        } else {
          console.error('Auth verification failed:', v.error, 'initData:', initData);
          return { statusCode: 403, body: JSON.stringify({ success: false, message: '验真失败' }) };
        }
      }
    }

    const tgId = String(authUser.id);
    const db = getPool();

    // 查找已有用户
    let res = await db.query('SELECT * FROM users WHERE tg_id = $1', [tgId]);
    let row = res.rows[0];

    if (!row) {
      // 自动开户（送 1000 金币 + 空 grid）
      await db.query(
        `INSERT INTO users
           (tg_id, username, coins, grid, buy_count, ad_used_today, wd_ad_used, pokedex, settings, ai_unlock_day, invite_count, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          tgId,
          authUser.username || authUser.first_name || 'unknown',
          1000,
          JSON.stringify(new Array(TOTAL).fill(null)),
          0,
          0,
          0,
          JSON.stringify([]),
          JSON.stringify({ lang: 'zh', music: '1', sfx: '1', wallet: null }),
          '',
          0,
          Date.now(),
        ]
      );

      // 邀请裂变：新用户带 inviterId 时，给邀请者发金币奖励 + inviteCount++
      if (inviterId) {
        const inviterTgId = String(inviterId);
        if (inviterTgId !== tgId) {                   // 防止自己邀请自己
          const invRes = await db.query('SELECT 1 FROM users WHERE tg_id = $1', [inviterTgId]);
          if (invRes.rows.length) {
            await db.query(
              'UPDATE users SET coins = coins + 5000, invite_count = invite_count + 1, updated_at = $1 WHERE tg_id = $2',
              [Date.now(), inviterTgId]
            );
          }
        }
      }

      res = await db.query('SELECT * FROM users WHERE tg_id = $1', [tgId]);
      row = res.rows[0];
    }

    // save 动作：把前端最新存档写回 PostgreSQL
    if (action === 'save' && data && typeof data === 'object') {
      const sets = [];
      const params = [];
      let i = 1;

      if (typeof data.coins === 'number') { sets.push(`coins = $${i++}`); params.push(data.coins); }

      // grid 规范化：补齐 16 格，非法等级置 null
      if (Array.isArray(data.grid)) {
        const g = [];
        for (let k = 0; k < TOTAL; k++) {
          const x = data.grid[k];
          g.push((typeof x === 'number' && x >= 1 && x <= MAX_LV) ? x : null);
        }
        sets.push(`grid = $${i++}`); params.push(JSON.stringify(g));
      }

      if (typeof data.buyCount === 'number') { sets.push(`buy_count = $${i++}`); params.push(data.buyCount); }
      if (typeof data.adUsedToday === 'number') { sets.push(`ad_used_today = $${i++}`); params.push(data.adUsedToday); }
      if (typeof data.wdAdUsed === 'number') { sets.push(`wd_ad_used = $${i++}`); params.push(data.wdAdUsed); }
      if (Array.isArray(data.pokedex)) { sets.push(`pokedex = $${i++}`); params.push(JSON.stringify(data.pokedex.filter(x => typeof x === 'number'))); }
      if (typeof data.aiUnlockDay === 'string') { sets.push(`ai_unlock_day = $${i++}`); params.push(data.aiUnlockDay); }

      if (data.settings && typeof data.settings === 'object') {
        sets.push(`settings = $${i++}`);
        params.push(JSON.stringify({
          lang: data.settings.lang || 'zh',
          music: data.settings.music || '1',
          sfx: data.settings.sfx || '1',
          wallet: data.settings.wallet || null,
        }));
      }

      if (sets.length) {
        sets.push(`updated_at = $${i++}`); params.push(Date.now());
        params.push(tgId);
        await db.query(`UPDATE users SET ${sets.join(', ')} WHERE tg_id = $${i}`, params);
      }

      res = await db.query('SELECT * FROM users WHERE tg_id = $1', [tgId]);
      row = res.rows[0];
    }

    const user = rowToUser(row);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, user })
    };

  } catch (err) {
    console.error('Auth handler error:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: err.message }) };
  }
};
