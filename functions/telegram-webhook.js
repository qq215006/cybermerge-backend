/**
 * Cloudflare Pages Function：functions/telegram-webhook.js → /telegram-webhook
 * Telegram Bot /start 回复（webhook 模式，适配 Cloudflare Pages Functions）
 *
 * 部署前两步：
 *   1. 在 Cloudflare Pages 控制台 → Settings → Environment variables
 *      新增 BOT_TOKEN（选 Secret，加密存储）
 *   2. 设置 webhook（一次性，把 <你的Pages域名> 换成实际域名）：
 *      curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<你的Pages域名>/telegram-webhook"
 */

const GAME_URL = 'https://lcz8.com';          // web_app 按钮必须用直连 HTTPS 域名，不能用 t.me 跳转
const COMMUNITY_URL = 'https://t.me/lcz8com';

// HTML 转义：防止用户昵称里的 & < > 破坏 parse_mode=HTML
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 欢迎文案（HTML 解析模式，避免 Markdown 转义坑）
function welcomeText(firstName) {
  const name = escapeHtml(firstName);
  return [
    `Hey ${name}, welcome to the <b>CyberCat</b> universe! 🌌🐾`,
    '',
    'Your empty factory is waiting for its first feline worker. Are you ready to merge, upgrade, and claim your share of the massive $USDT pool?',
    '',
    '<b>🎮 How to play:</b>',
    '1️⃣ Tap the <b>Play Now</b> button below.',
    '2️⃣ Drag and merge cats of the same level.',
    '3️⃣ Build your high-level cat army and earn crypto!',
    '',
    '🚀 Let\'s get wealthy together!',
  ].join('\n');
}

async function replyStart(token, chatId, firstName) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: welcomeText(firstName),
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 Play Now', web_app: { url: GAME_URL } }],
        [{ text: '📢 Join Community', url: COMMUNITY_URL }],
      ],
    },
  };
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function onRequestPost(context) {
  const rawToken = context.env?.BOT_TOKEN || process.env.BOT_TOKEN || '';
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';
  if (!token) {
    return new Response(JSON.stringify({ ok: false, message: 'BOT_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let update;
  try {
    update = await context.request.json();
  } catch (_) {
    return new Response('bad request', { status: 400 });
  }

  // 只处理 /start（text.startsWith 兼容 /start <payload> 深链参数）
  const msg = update?.message;
  const text = msg?.text;
  if (msg && typeof text === 'string' && text.startsWith('/start')) {
    const firstName = msg?.from?.first_name || 'Player';
    try {
      await replyStart(token, msg.chat.id, firstName);
    } catch (err) {
      console.error('sendMessage failed:', err);
    }
  }

  // 始终返回 200，避免 Telegram 因非 2xx 重复投递
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
