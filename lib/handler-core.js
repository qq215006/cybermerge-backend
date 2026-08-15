import { createClient } from '@supabase/supabase-js';
import { SIGN_WINDOW_MS, verifySaveSignature } from './sign.js';

// 安全：敏感配置一律从环境变量读取
const BOT_TOKEN = process.env.BOT_TOKEN || '你的BotToken';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
// 自付 Gas 提现：项目方金库地址（环境变量配置，前端转账目标必须与此一致）
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || '';
// 全自动打款引擎配置
const TREASURY_MNEMONIC = process.env.TREASURY_MNEMONIC || '';          // 金库助记词，空格分隔 24 个单词
const WITHDRAW_GAS_FEE = process.env.WITHDRAW_GAS_FEE || '0.1';        // 玩家自付 Gas（TON）
const DAILY_MAX_PAYOUT = Number(process.env.DAILY_MAX_PAYOUT) || 0;    // 当日全服提现熔断上限（USDT）
const JETTON_USDT_MASTER = process.env.JETTON_USDT_MASTER || 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'; // TON 主网官方 Tether USDT
const TON_RPC_URL = process.env.TON_RPC_URL || 'https://toncenter.com/api/v2/jsonRPC';

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

// 「每周一 08:00（北京时间）重置」的本周起点 = 本周一 UTC 0点对应的毫秒
function shanghaiWeekStart() {
  const d = new Date(Date.now());
  const diff = (d.getUTCDay() + 6) % 7; // 距本周一（UTC）的天数：周一=0 ... 周日=6
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff);
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
    inflateCount: Number(row.inflate_count) || 0,
    adUsedToday: Number(row.ad_used_today) || 0,
    wdAdUsed: Number(row.wd_ad_used) || 0,
    pokedex: parseJson(row.pokedex, []),
    settings: parseJson(row.settings, { lang: 'zh', music: '1', sfx: '1', wallet: null }),
    aiUnlockDay: row.ai_unlock_day || '',
    inviteCount: Number(row.invite_count) || 0,
    refCode: row.ref_code || '',
    divCats: parseJson(row.div_cats, []),
    weekAdCount: Number(row.week_ad_count) || 0,
    internalUsdt: Number(row.internal_usdt) || 0,
    adContribution: Number(row.ad_contribution) || 0,
    newbieCatClaimed: Boolean(row.newbie_cat_claimed),
    newbieAdStage: Number(row.newbie_ad_stage) || 0,
    boostAdUsed: Number(row.boost_ad_used) || 0,
    boostAdDay: row.boost_ad_day || '',
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

// 自付 Gas 提现：TonAPI 链上强校验（100% 验真，防止资金被盗）
//   1. 状态：success === true
//   2. 金额：in_msg.value >= WITHDRAW_GAS_FEE_NANO（默认 0.1 TON）
//   3. 收款方：in_msg.dest.address 统一转 Raw 后 == TREASURY_ADDRESS
//   4. 身份：in_msg.decoded_body.text 必须包含 tg_id
let _tonapiKeyWarned = false;

async function verifyTonTransfer(hash, tgId) {
  const gasFeeNano = process.env.WITHDRAW_GAS_FEE_NANO || '100000000';
  const target = String(tgId);

  // TONAPI_KEY 鉴权：未配置则不发送 Header（本地调试用），并高亮警告一次
  const tonapiKey = process.env.TONAPI_KEY || '';
  if (!tonapiKey && !_tonapiKeyWarned) {
    console.warn('[WARN] TONAPI_KEY 未配置，将不带鉴权请求 TonAPI，生产环境请务必配置！');
    _tonapiKeyWarned = true;
  }
  const headers = {};
  if (tonapiKey) headers['Authorization'] = 'Bearer ' + tonapiKey;

  let Address;
  try { ({ Address } = await import('@ton/ton')); } catch (_) {}

  // 统一转 Raw 格式，规避 EQ/UQ/Raw 多种形态造成的比对绕过
  const toRaw = (addr) => {
    if (!addr) return '';
    if (Address) {
      try { return Address.parse(String(addr)).toRawString(); } catch (_) {}
    }
    return String(addr).toUpperCase();
  };
  const treasuryRaw = toRaw(TREASURY_ADDRESS);
  if (!treasuryRaw) return false;

  try {
    const resp = await fetch('https://tonapi.io/v2/blockchain/transactions/' + encodeURIComponent(String(hash)), { headers });
    if (!resp.ok) return false;
    const tx = await resp.json();
    if (!tx || tx.success !== true) return false;

    const inMsg = tx.in_msg;
    if (!inMsg) return false;

    // 金额（nanoTON）
    let value;
    try { value = BigInt(String(inMsg.value ?? '0')); } catch (_) { return false; }
    if (value < BigInt(gasFeeNano)) return false;

    // 收款方（兼容 dest.address / destination.address / destination 字符串 / dest 字符串）
    let destAddr = '';
    if (inMsg.dest && typeof inMsg.dest === 'object') destAddr = inMsg.dest.address || '';
    else if (inMsg.destination && typeof inMsg.destination === 'object') destAddr = inMsg.destination.address || '';
    else if (typeof inMsg.destination === 'string') destAddr = inMsg.destination;
    else if (typeof inMsg.dest === 'string') destAddr = inMsg.dest;

    if (!toRaw(destAddr) || toRaw(destAddr) !== treasuryRaw) return false;

    // Memo / 身份核对（防代付：必须包含本人 tg_id）
    const decoded = inMsg.decoded_body;
    const text = (decoded && (decoded.text || decoded.forward_payload)) || '';
    if (!String(text).includes(target)) return false;

    return true;
  } catch (_) {
    return false;
  }
}

// 全自动打款引擎：用金库助记词签名，构建 USDT Jetton 转账并广播
// 依赖 @ton/ton + @ton/crypto；运行在 Cloudflare Worker 需启用 nodejs_compat（@ton/ton 依赖 Node Buffer）
// 返回 payout_hash（已签名外部消息的 cell hash）
async function payoutJetton(receiveAddress, usdtAmount) {
  if (!TREASURY_MNEMONIC) throw new Error('TREASURY_MNEMONIC 未配置');
  const { TonClient, WalletContractV4, Address, toNano, internal, beginCell, SendMode, JettonMaster } = await import('@ton/ton');
  const { mnemonicToPrivateKey } = await import('@ton/crypto');

  const client = new TonClient({ endpoint: TON_RPC_URL });
  const mnemonic = TREASURY_MNEMONIC.split(/\s+/).map(s => s.trim()).filter(Boolean);
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const walletContract = client.open(wallet);
  const seqno = await walletContract.getSeqno();
  const treasuryAddress = wallet.address;

  const jettonMaster = client.open(JettonMaster.create(Address.parse(JETTON_USDT_MASTER)));
  const treasuryJettonWallet = await jettonMaster.getWalletAddress(treasuryAddress);
  const playerJettonWallet = await jettonMaster.getWalletAddress(Address.parse(receiveAddress));

  // Tether USDT 主网精度 6 位
  const jettonAmount = BigInt(Math.round(usdtAmount * 1e6));

  const transferBody = beginCell()
    .storeUint(0xf8a7ea5, 32)                    // jetton transfer op
    .storeUint(0, 64)                            // query_id
    .storeCoins(jettonAmount)                    // jetton 数量
    .storeAddress(playerJettonWallet)            // 目标玩家 jetton wallet
    .storeAddress(treasuryAddress)               // response destination（金库）
    .storeBit(0)                                 // custom payload
    .storeCoins(1)                               // forward amount = 0.001 TON
    .storeBit(0)                                 // forward payload
    .endCell();

  const signed = await walletContract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    messages: [internal({
      to: treasuryJettonWallet,
      value: toNano('0.05'),                     // 附带 0.05 TON 供 jetton 合约转发
      body: transferBody,
    })],
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
  });

  // signed 为已签名外部消息 Cell；取其 hash 作为 payout_hash
  return signed.hash().toString('hex');
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
        inflate_count: 0,
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
      // 前端上报的 adUsedToday 不应超过 Monetag 服务端回调次数 + 容差，否则视为刷广告
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
      if (typeof data.inflateCount === 'number') updateObj.inflate_count = data.inflateCount;
      // adUsedToday 仅用于前端每日次数展示/交叉校验；广告计数(week_ad_count/ad_daily_counts)已改由
      // Monetag 服务端回调 record_ad_callback 驱动，save 里不再累加，避免重复记账
      if (typeof data.adUsedToday === 'number') updateObj.ad_used_today = data.adUsedToday;

      // 40级猫剩余分红次数数组 [4,3,2]（前端维护，满4次由结算 RPC 回收）
      if (Array.isArray(data.divCats)) {
        updateObj.div_cats = data.divCats.filter(x => typeof x === 'number');
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

    // seasonboard 动作：赛季榜（按持有40级猫数量 = 份额数降序）
    if (action === 'seasonboard') {
      const { data: sb, error: sbErr } = await db.rpc('get_season_board', { p_tg_id: tgId });
      if (sbErr) throw sbErr;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, seasonboard: sb })
      };
    }

    // inviteboard 动作：本周邀请榜（每周一 08:00 北京时间重置）
    if (action === 'inviteboard') {
      const weekStart = shanghaiWeekStart();
      const { data: ib, error: ibErr } = await db.rpc('get_invite_board', { p_tg_id: tgId, p_day_start: weekStart });
      if (ibErr) throw ibErr;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, inviteboard: ib })
      };
    }

    // ── 6 大核心模式 RPC 转发（后端验真 tg_id，前端不传价、不本地算资产）──
    const rpcOk = (r) => ({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, result: r }),
    });

    // 买猫：后端定价 + 行锁，前端只传 level
    if (action === 'buy_cat') {
      const level = Number(data?.level);
      if (!Number.isInteger(level) || level < 1 || level > 35) {
        return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'invalid level' }) };
      }
      const { data: r, error } = await db.rpc('buy_cat', { p_tg_id: tgId, p_level: level });
      if (error) throw error;
      return rpcOk(r);
    }

    // 回收站：行锁 + 后端算奖励，前端只传 index + level 二次校验
    if (action === 'recycle_cat') {
      const index = Number(data?.index);
      const level = Number(data?.level);
      if (!Number.isInteger(index) || index < 0 || index > 15 || !Number.isInteger(level)) {
        return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'invalid index or level' }) };
      }
      const { data: r, error } = await db.rpc('recycle_cat', { p_tg_id: tgId, p_grid_index: index, p_cat_level: level });
      if (error) throw error;
      return rpcOk(r);
    }

    // 新人 35 级猫解锁
    if (action === 'claim_newbie_cat') {
      const { data: r, error } = await db.rpc('claim_newbie_cat', { p_tg_id: tgId });
      if (error) throw error;
      return rpcOk(r);
    }

    // 新人解锁广告进度推进（看一次广告 +1 阶段，封顶 2）
    if (action === 'advance_newbie_ad') {
      const { data: r, error } = await db.rpc('advance_newbie_ad', { p_tg_id: tgId });
      if (error) throw error;
      return rpcOk(r);
    }

    // 加速收益广告：每日 15 次，奖励 3×当前秒收益
    if (action === 'boost_ad_reward') {
      const amount = Number(data?.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'invalid amount' }) };
      }
      const { data: r, error } = await db.rpc('boost_ad_reward', { p_tg_id: tgId, p_amount: amount });
      if (error) throw error;
      return rpcOk(r);
    }

    // 每日海报分享奖励
    if (action === 'daily_share_reward') {
      const { data: r, error } = await db.rpc('daily_share_reward', { p_tg_id: tgId });
      if (error) throw error;
      return rpcOk(r);
    }

    // 全服奖池查询（只读，供前端 Banner 轮询）
    if (action === 'get_global_stats') {
      const { data: gs, error } = await db.from('global_stats').select('*').eq('id', 1).maybeSingle();
      if (error) throw error;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, globalStats: gs })
      };
    }

    // 合成暴击喜讯广播：只上报额外跳级（extra > 0），写入 broadcasts 表
    if (action === 'report_merge_crit') {
      const extra = Number(data?.extra) || 0;
      if (extra <= 0) {
        return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'not a crit' }) };
      }
      const level = Number(data?.level) || 0;
      const coins = Number(data?.coins) || 0;
      const { error } = await db.from('broadcasts').insert({
        username: row?.username || authUser?.username || authUser?.first_name || '???',
        extra, level, coins,
        created_at: Date.now(),
      });
      if (error) throw error;
      // 清理：只保留最近 50 条，避免表无限膨胀
      try {
        const { data: oldRows } = await db.from('broadcasts').select('id').order('created_at', { ascending: false }).range(50, 9999);
        if (oldRows && oldRows.length) {
          await db.from('broadcasts').delete().in('id', oldRows.map(r => r.id));
        }
      } catch(_) {}
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
    }

    // 读取广播队列（最近 30 条，正序返回供前端排队播报）
    if (action === 'get_broadcasts') {
      const { data: list, error } = await db.from('broadcasts')
        .select('id, username, extra, level, coins')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      const ordered = (list || []).reverse();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, broadcasts: ordered })
      };
    }

    // 自付 Gas 提现：校验链上转账 → 扣 internal_usdt → 写入工单
    if (action === 'request_withdraw') {
      const usdtAmount = Number(data?.usdt_amount);
      const bocOrHash = String(data?.boc_or_hash || '');
      const receiveAddress = String(data?.receive_address || '');

      if (!(usdtAmount >= 10)) {
        return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'minimum 10 USDT' }) };
      }
      if (!bocOrHash) {
        return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'missing tx proof' }) };
      }
      if (!receiveAddress) {
        return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'missing receive address' }) };
      }

      // ① 验账（TonAPI 强校验：状态/金额/收款方/memo）
      const verified = await verifyTonTransfer(bocOrHash, tgId);
      if (!verified) {
        return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'invalid ton transfer' }) };
      }

      // ② 风控（锁 + 余额 + 当日熔断）
      const { data: chk, error: chkErr } = await db.rpc('check_withdraw_eligibility', {
        p_tg_id: tgId,
        p_usdt_amount: usdtAmount,
        p_daily_max: DAILY_MAX_PAYOUT || 0,
      });
      if (chkErr) throw chkErr;
      if (chk && chk.ok === false) {
        return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: chk.reason || 'withdraw rejected' }) };
      }

      // ③ 自动打款（金库助记词签名 USDT Jetton 转账）
      let payoutHash;
      try {
        payoutHash = await payoutJetton(receiveAddress, usdtAmount);
      } catch (e) {
        console.error('payoutJetton failed:', e);
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'payout failed: ' + (e.message || 'unknown') }) };
      }

      // ④ 记账（扣 internal_usdt + 写成功账单）
      const { data: fin, error: finErr } = await db.rpc('finalize_withdraw', {
        p_tg_id: tgId,
        p_receive_address: receiveAddress,
        p_usdt_amount: usdtAmount,
        p_gas_ton_hash: bocOrHash,
        p_payout_hash: payoutHash,
      });
      if (finErr) throw finErr;
      if (fin && fin.ok === false) {
        return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: fin.reason || 'finalize failed' }) };
      }

      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, result: { ok: true, payout_hash: payoutHash } }) };
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
