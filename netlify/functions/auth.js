import crypto from 'crypto';

const BOT_TOKEN = process.env.BOT_TOKEN || '你的BotToken'; // 可以直接在这里填，或者在Netlify后台配环境变量

// 模拟数据库（如果想持久化后面可以接MongoDB或Supabase，现在测试用内存）
const dbUsers = {};

export const handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body);
        const { initData } = body;

        if (!initData) {
            return { statusCode: 401, body: JSON.stringify({ success: false, message: '无授权信息' }) };
        }

        // Telegram 验真逻辑
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');

        const paramsCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, val]) => `${key}=${val}`)
            .join('\n');

        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
        const calculatedHash = crypto.createHmac('sha256', secretKey).update(paramsCheckString).digest('hex');

        if (calculatedHash !== hash) {
            return { statusCode: 403, body: JSON.stringify({ success: false, message: '验真失败' }) };
        }

        const userStr = urlParams.get('user');
        const userData = JSON.parse(userStr);
        const tgId = userData.id;

        if (!dbUsers[tgId]) {
            dbUsers[tgId] = {
                tgId: tgId,
                username: userData.username || 'unknown',
                coins: 1000,
                level: 1,
                grid: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, user: dbUsers[tgId] })
        };

    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, message: err.message }) };
    }
};
