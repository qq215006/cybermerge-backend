import { handleAuth } from '../lib/handler-core.js';

// Vercel Serverless Function（api/ 目录）
// 部署：`vercel` 会自动把 api/*.js 识别为 Serverless Functions
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Vercel Node runtime 通常已解析 JSON body；未解析时手动读流兜底
  let body = req.body;
  if (!body) {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch(_) {
      body = {};
    }
  }

  const result = await handleAuth(body);
  let json = result.body;
  if (typeof json === 'string') {
    try { json = JSON.parse(json); } catch(_) { json = { success: false, message: 'bad response' }; }
  }
  return res.status(result.statusCode || 500).json(json);
}
