import { handleAuth } from '../../lib/handler-core.js';

/*
 * Supabase (PostgreSQL) 表结构 —— 请在 Supabase SQL Editor 执行一次：
 *
 * CREATE TABLE IF NOT EXISTS users (
 *   tg_id         TEXT PRIMARY KEY,
 *   username      TEXT,
 *   coins         DOUBLE PRECISION DEFAULT 1000,
 *   grid          JSONB DEFAULT '[]'::jsonb,
 *   buy_count     INTEGER DEFAULT 0,
 *   ad_used_today INTEGER DEFAULT 0,
 *   wd_ad_used    INTEGER DEFAULT 0,
 *   pokedex       JSONB DEFAULT '[]'::jsonb,
 *   settings      JSONB DEFAULT '{}'::jsonb,
 *   ai_unlock_day TEXT DEFAULT '',
 *   invite_count  INTEGER DEFAULT 0,
 *   created_at    BIGINT DEFAULT 0,
 *   updated_at    BIGINT DEFAULT 0
 * );
 *
 * CREATE TABLE IF NOT EXISTS invites (
 *   id             SERIAL PRIMARY KEY,
 *   inviter_tg_id  TEXT,
 *   invited_tg_id  TEXT,
 *   created_at     BIGINT
 * );
 * CREATE INDEX IF NOT EXISTS idx_invites_inviter_day ON invites (inviter_tg_id, created_at);
 */

export const handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  let body;
  try {
    body = JSON.parse(event.body);
  } catch(_) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'bad request' }) };
  }
  return handleAuth(body);
};
