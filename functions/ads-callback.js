import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
// Adsgram 回调签名校验密钥（在 Cloudflare 环境变量配置；Adsgram 不提供签名参数时走防抖锁兜底）
const ADSGRAM_CALLBACK_SECRET = process.env.ADSGRAM_CALLBACK_SECRET || '';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// HMAC-SHA256 校验（具体算法/参数待 Adsgram 后台确认；当前按 userid 做 HMAC）
async function verifySignature(userId, sign) {
  // 平台不提供 sign → 降级，仅靠 Supabase 里的 15 秒防抖锁
  if (!sign) return true;
  // 平台给了 sign 但服务端没配密钥 → 直接拒绝，防止伪造
  if (!ADSGRAM_CALLBACK_SECRET) return false;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(ADSGRAM_CALLBACK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(userId));
    const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex.toLowerCase() === String(sign).toLowerCase();
  } catch (_) {
    return false;
  }
}

async function handle(context) {
  const url = new URL(context.request.url);
  const userId = url.searchParams.get('userid') || url.searchParams.get('user_id');
  const sign =
    url.searchParams.get('sign') || url.searchParams.get('key') || url.searchParams.get('signature');

  if (!userId) return json(400, { ok: false, message: 'missing userid' });

  if (!(await verifySignature(userId, sign))) {
    return json(401, { ok: false, message: 'invalid signature' });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc('record_ad_callback', {
      p_tg_id: String(userId),
    });
    if (error) throw error;

    // 防抖拒绝（15秒内重复）也返回 200，让 Adsgram 停止重试
    return json(200, data || { ok: true });
  } catch (err) {
    console.error('ads-callback error:', err);
    return json(500, { ok: false, message: err.message });
  }
}

// Adsgram 通常以 GET 回调 Reward URL；同时兼容 POST 以防平台切换
export async function onRequestGet(context) {
  return handle(context);
}
export async function onRequestPost(context) {
  return handle(context);
}
