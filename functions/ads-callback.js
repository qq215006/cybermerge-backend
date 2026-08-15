import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
// Monetag 回调基础鉴权密钥（在 Monetag 后台 postback URL 中静态配置为 secret=CyberCat2026Secure）
const MONETAG_SECRET = process.env.MONETAG_CALLBACK_SECRET || 'CyberCat2026Secure';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handle(context) {
  const url = new URL(context.request.url);
  const source = url.searchParams.get('source') || '';
  const secret = url.searchParams.get('secret') || '';
  const userId = url.searchParams.get('user_id') || '';
  const event = url.searchParams.get('event') || '';
  const priceRaw = url.searchParams.get('price') || '';

  // ① 来源校验：非 Monetag 直接拦截
  if (source !== 'monetag') {
    return json(403, { ok: false, message: 'invalid source' });
  }

  // ② 密钥校验：不匹配直接 403
  if (secret !== MONETAG_SECRET) {
    return json(403, { ok: false, message: 'invalid secret' });
  }

  // ③ 用户 ID 校验：必须是纯数字 Telegram ID
  if (!userId || !/^\d+$/.test(userId)) {
    return json(400, { ok: false, message: 'invalid user_id' });
  }

  // ④ 事件校验：只有 impression 才算有效观看；click 等直接 200 跳过（停止重试）
  if (event !== 'impression') {
    return json(200, { ok: true, skipped: true, event });
  }

  // ⑤ price：本次广告预估美金收益，非法/负数按 0 处理
  const price = Number(priceRaw);
  const safePrice = Number.isFinite(price) && price >= 0 ? price : 0;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc('record_ad_callback', {
      p_tg_id: String(userId),
      p_event: event,
      p_price: safePrice,
    });
    if (error) throw error;

    // 防抖拒绝（15 秒内重复）也返回 200，让 Monetag 停止重试
    return json(200, data || { ok: true });
  } catch (err) {
    console.error('monetag ads-callback error:', err);
    return json(500, { ok: false, message: err.message });
  }
}

// Monetag 通常以 GET 发送 postback；同时兼容 POST 以防平台切换
export async function onRequestGet(context) {
  return handle(context);
}
export async function onRequestPost(context) {
  return handle(context);
}
