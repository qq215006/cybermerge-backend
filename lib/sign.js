// 前后端共同约定的签名盐（与前端 main.js 的 SECRET_SALT 保持一致）
export const SECRET_SALT = 'CYBER_CAT_SECRET_2026';
// 时间戳容差：超过 5 分钟视为重放，拒绝
export const SIGN_WINDOW_MS = 5 * 60 * 1000;

const te = new TextEncoder();

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', te.encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 与前端 main.js 的 buildSignString 保持完全一致（字段顺序、分隔符、空值处理）
export function buildSignString(tgId, data, timestamp) {
  const grid = Array.isArray(data.grid) ? data.grid.map(x => (x === null || x === undefined) ? '' : x).join(',') : '';
  const pokedex = Array.isArray(data.pokedex) ? data.pokedex.join(',') : '';
  return [
    tgId,
    data.coins ?? 0,
    grid,
    data.buyCount ?? 0,
    data.adUsedToday ?? 0,
    data.wdAdUsed ?? 0,
    pokedex,
    data.aiUnlockDay ?? '',
    timestamp,
    SECRET_SALT,
  ].join('|');
}

// 校验签名（常量时间比较，防时序攻击）
export async function verifySaveSignature(tgId, data, timestamp, signature) {
  if (typeof signature !== 'string' || !signature) return false;
  const expect = await sha256Hex(buildSignString(tgId, data, timestamp));
  if (expect.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expect.length; i++) {
    diff |= expect.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
