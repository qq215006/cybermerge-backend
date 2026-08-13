import { handleAuth } from '../lib/handler-core.js';

// Cloudflare Pages Function：functions/auth.js → /auth 路由
// 注意：Cloudflare Pages Functions 运行在 Workers 环境，连接 Supabase 需要
// 启用 nodejs_compat + Cloudflare Hyperdrive（或改用 serverless 驱动），否则 pg 驱动无法直连。
export async function onRequestPost(context) {
  const { request } = context;

  let body;
  try {
    body = await request.json();
  } catch(_) {
    return new Response(JSON.stringify({ success: false, message: 'bad request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await handleAuth(body);
  return new Response(result.body, {
    status: result.statusCode || 500,
    headers: { 'Content-Type': 'application/json', ...(result.headers || {}) },
  });
}
