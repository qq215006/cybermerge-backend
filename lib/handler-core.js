import { createClient } from '@supabase/supabase-js';
import { SIGN_WINDOW_MS, verifySaveSignature } from './sign.js';

// 安全：敏感配置一律从环境变量读取
const BOT_TOKEN = process.env.BOT_TOKEN || '你的BotToken';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const TOTAL = 16;
const MAX_LV = 40;
const EARN_RATIO = 1.8;   // 算力跨级倍率（与前端 main.js 一致）

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

// 计算场上猫咪的每秒产出总和（P_n = 1 × 1.8^(n-1)，与前端 totalEarnPerSec 一致）
function gridEarnPerSec(grid) {
  if (!Array.isArray(grid)) return 0;
  let sum = 0;
  for (const lv of grid) {
    if (typeof lv === 'number' && lv >= 1 && lv <= MAX_LV) {
      sum += Math.pow(EARN_RATIO, lv - 1);
    }
  }
  return sum;
}

// 「早上8点重置」的日期字符串：8点(上海)=UTC 0点，直接用 UTC 日期
function shanghaiTodayStr() {
  return new Date(Date.now()).toISOString().slice(0, 10);
}

// 「早上8点重置」的当天起点 = UTC 0点（= 上海 8点）对应的毫秒
function shanghaiDayStart() {
  const d = new Date(Date.now());
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// 生成随机邀请码（8 位，去掉易混淆字符），用于隐藏 TG ID
function genRefCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < 8; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
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
    coins: (Number(row.coins) || 0) + (Number(row.bonus_coins) || 0),
    bonusCoins: Number(row.bonus_coins) || 0,
    grid: parseJson(row.grid, new Array(TOTAL).fill(null)),
    buyCount: Number(row.buy_count) || 0,
    adUsedToday: Number(row.ad_used_today) || 0,
    wdAdUsed: Number(row.wd_ad_used) || 0,
    pokedex: parseJson(row.pokedex, []),
    settings: parseJson(row.settings, { lang: 'zh', music: '1', sfx: '1', wallet: null }),
    aiUnlockDay: row.ai_unlock_day || '',
    inviteCount: Number(row.invite_count) || 0,
    refCode: row.ref_code || '',
    divCats: parseJson(row.div_cats, {}),
    weekAdCount: Number(row.week_ad_count) || 0,
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
      // 自动开户（送 1000 金币 + 空投 2 只 LV.1 猫咪）
      const { data: inserted, error: insertErr } = await db.from('users').insert({
        tg_id: tgId,
        username: authUser.username || authUser.first_name || 'unknown',
        coins: 1000,
        grid: [1, 1, ...new Array(TOTAL - 2).fill(null)],  // 新用户首次登录空投 2 只 LV.1 猫咪
        buy_count: 0,
        ad_used_today: 0,
        wd_ad_used: 0,
        pokedex: [1],
        max_level: 1,
        settings: { lang: 'zh', music: '1', sfx: '1', wallet: null },
        ai_unlock_day: '',
        invite_count: 0,
        ref_code: genRefCode(),
        created_at: Date.now(),
      }).select().single();
      if (insertErr) throw insertErr;
      row = inserted;

      // 邀请裂变：inviterId 现在是随机邀请码 ref_code，需要反查邀请者 tg_id
      if (inviterId) {
        const refCode = String(inviterId);
        const { data: inviterRow } = await db.from('users').select('tg_id').eq('ref_code', refCode).maybeSingle();
        if (inviterRow?.tg_id && inviterRow.tg_id !== tgId) {
          await db.rpc('insert_invite', {
            p_inviter_tg_id: inviterRow.tg_id,
            p_invited_tg_id: tgId,
            p_ts: Date.now(),
          });
        }
      }

      const { data: refreshed } = await db.from('users').select('*').eq('tg_id', tgId).maybeSingle();
      row = refreshed || row;
    }

    // 老用户没有 ref_code 时，登录时补发一个（邀请链接需要）
    if (row && !row.ref_code) {
      const code = genRefCode();
      const { data: backfilled } = await db.from('users').update({ ref_code: code }).eq('tg_id', tgId).select().single();
      if (backfilled) row = backfilled;
    }

    // 离线产出结算（login 时，签到当天有效，0点后失效）
    let offlineReward = 0;
    if (action === 'login' && row) {
      const now = Date.now();
      if (row.ai_unlock_day === shanghaiTodayStr()) {
        const lastEarnAt = Number(row.last_earn_at) || Number(row.created_at) || shanghaiDayStart();
        const start = Math.max(lastEarnAt, shanghaiDayStart());
        const offlineSec = Math.max(0, (now - start) / 1000);
        if (offlineSec > 0) {
          offlineReward = Math.floor(gridEarnPerSec(row.grid) * offlineSec);
          if (offlineReward > 0) {
            const newBonus = (Number(row.bonus_coins) || 0) + offlineReward;
            await db.from('users').update({ bonus_coins: newBonus, last_earn_at: now }).eq('tg_id', tgId);
            row = { ...row, bonus_coins: newBonus };
          }
        }
      }
      // 无论是否结算，都推进 last_earn_at，避免重复结算
      await db.from('users').update({ last_earn_at: now }).eq('tg_id', tgId);
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

      // ③ 广告次数交叉校验（可选风控，需配置 AD_CROSS_CHECK=true）
      // 前端上报的 adUsedToday 不应超过 Adsgram 服务端回调次数 + 容差，否则视为刷广告
      if (process.env.AD_CROSS_CHECK === 'true' && typeof data.adUsedToday === 'number' && data.adUsedToday > 0) {
        const now = new Date();
        const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 8 * 3600 * 1000;
        const { count, error: cbErr } = await db.from('ad_callbacks').select('id', { count: 'exact', head: true })
          .eq('tg_id', tgId)
          .gte('created_at', dayStart);
        if (!cbErr) {
          const cbCount = count || 0;
          if (data.adUsedToday > cbCount + 3) {
            return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'ad count mismatch' }) };
          }
        }
      }

      // ④ 邀请奖励发放：被邀请者达到质量门槛（等级>10 且看过广告）时给邀请者发奖
      if (typeof data.adUsedToday === 'number' && Array.isArray(data.pokedex)) {
        const myLv = data.pokedex.length ? Math.max(...data.pokedex) : 0;
        if (myLv > 10 && data.adUsedToday > 0) {
          const now2 = new Date();
          const dayStart2 = Date.UTC(now2.getUTCFullYear(), now2.getUTCMonth(), now2.getUTCDate()) - 8 * 3600 * 1000;
          await db.rpc('try_reward_inviter', {
            p_invited_tg_id: tgId,
            p_lv: myLv,
            p_watched_ad: true,
            p_ts: Date.now(),
            p_day_start: dayStart2,
          });
        }
      }

      // ⑤ 金币增量校验（可选风控，需配置 COIN_CHECK=true）
      // data.coins 为前端自有金币（产出/购买/广告/任务）；邀请奖励与离线奖励走 bonus_coins，不参与此校验
      if (process.env.COIN_CHECK === 'true' && typeof data.coins === 'number') {
        const lastBase = Number(row.coins) || 0;
        const lastTime = Number(row.updated_at) || Number(row.created_at) || ts;
        const lastGrid = Array.isArray(row.grid) ? row.grid : [];
        const curGrid = Array.isArray(data.grid) ? data.grid : [];
        // 用完整时间间隔（不封顶）：产出上限 = 每秒产出 × 时间，本身就是安全上限
        const dtSec = Math.max(0, (ts - lastTime) / 1000);
        const earnPerSec = Math.max(gridEarnPerSec(lastGrid), gridEarnPerSec(curGrid));
        const prodMax = earnPerSec * dtSec * 1.5;

        const lastAd = Number(row.ad_used_today) || 0;
        const curAd = Number(data.adUsedToday) || 0;
        const adMax = Math.max(0, curAd - lastAd) * 8000;

        const maxCoins = lastBase + prodMax + adMax + 1000;

        if (data.coins > maxCoins) {
          return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'coins mismatch' }) };
        }
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

      // 本周看广告次数累加：delta = 本次 - 上次（跨天重置时 delta 为负则忽略）
      if (typeof data.adUsedToday === 'number') {
        const lastAd = Number(row.ad_used_today) || 0;
        const curAd = Number(data.adUsedToday) || 0;
        const delta = Math.max(0, curAd - lastAd);
        if (delta > 0) {
          updateObj.week_ad_count = (Number(row.week_ad_count) || 0) + delta;
        }
      }

      // 40级猫分红状态 { slot: count }（前端维护，满4次由结算 RPC 回收）
      if (data.divCats && typeof data.divCats === 'object' && !Array.isArray(data.divCats)) {
        updateObj.div_cats = data.divCats;
      }

      if (typeof data.wdAdUsed === 'number') updateObj.wd_ad_used = data.wdAdUsed;
      if (Array.isArray(data.pokedex)) {
        const px = data.pokedex.filter(x => typeof x === 'number');
        updateObj.pokedex = px;
        // 同步更新冗余最高等级字段（空间换时间，供排行榜直接排序）
        updateObj.max_level = px.length ? px.reduce((a, b) => Math.max(a, b), 0) : 0;
      }
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
      updateObj.last_earn_at = Date.now();
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
      const dayStart = shanghaiDayStart();
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
      body: JSON.stringify({ success: true, user, offlineReward })
    };

  } catch (err) {
    console.error('Auth handler error:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: err.message }) };
  }
}
