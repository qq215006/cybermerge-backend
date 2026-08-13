import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Cloudflare Pages Function：functions/ads-callback.js → /ads-callback 路由
// Adsgram 服务端奖励回调：用户看完激励视频后，Adsgram 会 GET 此 URL，带 userid（Telegram ID）
// 用途：记录服务端确认的广告完成，供 save 时做交叉校验风控
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const userId = url.searchParams.get('userid');

  if (!userId) {
    return new Response(JSON.stringify({ ok: false, message: 'missing userid' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.from('ad_callbacks').insert({
      tg_id: String(userId),
      created_at: Date.now(),
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('ads-callback error:', err);
    return new Response(JSON.stringify({ ok: false, message: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
