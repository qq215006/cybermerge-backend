import { createClient } from '@supabase/supabase-js';
import { SIGN_WINDOW_MS, verifySaveSignature } from './sign.js';

// 安全：敏感配置一律从环境变量读取
const BOT_TOKEN = process.env.BOT_TOKEN || '你的BotToken';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const TOTAL = 16;
const MAX_LV = 40;

// 复用 Supabase client（warm instance 内共享）
let supabase = null;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 未配置');
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase;
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

// Web Crypto HMAC 辅助（Cloudflare Workers / Node 18+ 兼容）
const te = new TextEncoder();

async function hmacSign(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, dataBytes);
  return new Uint8Array(sig);
}

function bufToHex(buf) {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Telegram initData 验真（HMAC-SHA256，Web Crypto 实现）
async function verifyInitData(initData) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  if (!hash) return { ok: false, error: 'missing hash' };
  urlParams.delete('hash');

  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${key}=${val}`)
    .join('\n');

  // secret_key = HMAC_SHA256(key="WebAppData", message=bot_token)
  const secretKey = await hmacSign(te.encode('WebAppData'), te.encode(BOT_TOKEN));
  // hash = HMAC_SHA256(key=secret_key, message=data_check_string)
  const calculatedHash = bufToHex(await hmacSign(secretKey, te.encode(dataCheckString)));

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

// 核心处理：接收已解析的 JSON body，返回 { statusCode, headers, body }
export async function handleAuth(body) {
  const { initData, action, data, inviterId, signature, timestamp } = (body && typeof body === 'object') ? body : {};

  try {
    const allowTest = process.env.ALLOW_TEST_AUTH === 'true';
    const TEST_USER = { id: 12345678, first_name: 'TG_Test_User' };

    let authUser = null;

    if (!initData) {
      if (allowTest) {
        authUser = TEST_USER;
      } else {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: '无授权信息' }) };
      }
    } else {
      const v = await verifyInitData(initData);
      if (v.ok && v.user?.id) {
        authUser = v.user;
      } else {
        if (allowTest) {
          console.error('Auth verification failed, fallback to test user:', v.error, 'initData:', initData);
          authUser = TEST_USER;
        } else {
          console.error('Auth verification failed:', v.error, 'initData:', initData);
          return { statusCode: 403, body: JSON.stringify({ success: false, message: '验真失败' }) };
        }
      }
    }

    const tgId = String(authUser.id);
    const db = getSupabase();

    // 查找已有用户
    let { data: row } = await db.from('users').select('*').eq('tg_id', tgId).maybeSingle();

    if (!row) {
      // 自动开户（送 1000 金币 + 空 grid）
      const { data: inserted, error: insertErr } = await db.from('users').insert({
        tg_id: tgId,
        username: authUser.username || authUser.first_name || 'unknown',
        coins: 1000,
        grid: new Array(TOTAL).fill(null),
        buy_count: 0,
        ad_used_today: 0,
        wd_ad_used: 0,
        pokedex: [],
        settings: { lang: 'zh', music: '1', sfx: '1', wallet: null },
        ai_unlock_day: '',
        invite_count: 0,
        created_at: Date.now(),
      }).select().single();
      if (insertErr) throw insertErr;
      row = inserted;

      // 邀请裂变：给邀请者 +5000 金币 + invite_count++，并记录邀请事件（RPC 原子操作）
      if (inviterId) {
        const inviterTgId = String(inviterId);
        if (inviterTgId !== tgId) {
          await db.rpc('apply_invite_reward', {
            p_inviter_tg_id: inviterTgId,
            p_invited_tg_id: tgId,
            p_ts: Date.now(),
          });
        }
      }

      const { data: refreshed } = await db.from('users').select('*').eq('tg_id', tgId).maybeSingle();
      row = refreshed || row;
    }

    // save 动作：校验签名 + 时间戳后，把前端最新存档写回
    if (action === 'save' && data && typeof data === 'object') {
      // ① 时间戳校验：超过容差视为重放，拒绝
      const ts = Number(timestamp);
      if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > SIGN_WINDOW_MS) {
        return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'timestamp expired' }) };
      }
      // ② 签名校验：不匹配说明被抓包篡改，直接丢弃
      if (!(await verifySaveSignature(tgId, data, ts, signature))) {
        return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'invalid signature' }) };
      }

      const updateObj = {};

      if (typeof data.coins === 'number') updateObj.coins = data.coins;

      // grid 规范化：补齐 16 格，非法等级置 null
      if (Array.isArray(data.grid)) {
        const g = [];
        for (let k = 0; k < TOTAL; k++) {
          const x = data.grid[k];
          g.push((typeof x === 'number' && x >= 1 && x <= MAX_LV) ? x : null);
        }
        updateObj.grid = g;
      }

      if (typeof data.buyCount === 'number') updateObj.buy_count = data.buyCount;
      if (typeof data.adUsedToday === 'number') updateObj.ad_used_today = data.adUsedToday;
      if (typeof data.wdAdUsed === 'number') updateObj.wd_ad_used = data.wdAdUsed;
      if (Array.isArray(data.pokedex)) updateObj.pokedex = data.pokedex.filter(x => typeof x === 'number');
      if (typeof data.aiUnlockDay === 'string') updateObj.ai_unlock_day = data.aiUnlockDay;

      if (data.settings && typeof data.settings === 'object') {
        updateObj.settings = {
          lang: data.settings.lang || 'zh',
          music: data.settings.music || '1',
          sfx: data.settings.sfx || '1',
          wallet: data.settings.wallet || null,
        };
      }

      updateObj.updated_at = Date.now();
      const { error: updateErr } = await db.from('users').update(updateObj).eq('tg_id', tgId);
      if (updateErr) throw updateErr;

      const { data: refreshed } = await db.from('users').select('*').eq('tg_id', tgId).maybeSingle();
      row = refreshed || row;
    }

    // leaderboard 动作：按等级降序返回全球排行榜（RPC）
    if (action === 'leaderboard') {
      const { data: lb, error: lbErr } = await db.rpc('get_leaderboard', { p_tg_id: tgId });
      if (lbErr) throw lbErr;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, leaderboard: lb })
      };
    }

    // inviteboard 动作：当日邀请榜（RPC，Asia/Shanghai 时区）
    if (action === 'inviteboard') {
      const now = new Date();
      const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 8 * 3600 * 1000;
      const { data: ib, error: ibErr } = await db.rpc('get_invite_board', { p_tg_id: tgId, p_day_start: dayStart });
      if (ibErr) throw ibErr;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, inviteboard: ib })
      };
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
}
