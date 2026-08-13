-- =====================================================================
-- CyberMerge Supabase 数据库脚本
-- 请在 Supabase SQL Editor 中完整执行一次（建表 + RPC 函数）
-- =====================================================================

-- ── 用户表 ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  tg_id         TEXT PRIMARY KEY,
  username      TEXT,
  coins         DOUBLE PRECISION DEFAULT 1000,
  bonus_coins   DOUBLE PRECISION DEFAULT 0,
  grid          JSONB DEFAULT '[]'::jsonb,
  buy_count     INTEGER DEFAULT 0,
  ad_used_today INTEGER DEFAULT 0,
  wd_ad_used    INTEGER DEFAULT 0,
  pokedex       JSONB DEFAULT '[]'::jsonb,
  settings      JSONB DEFAULT '{}'::jsonb,
  ai_unlock_day TEXT DEFAULT '',
  invite_count  INTEGER DEFAULT 0,
  created_at    BIGINT DEFAULT 0,
  updated_at    BIGINT DEFAULT 0,
  last_earn_at  BIGINT DEFAULT 0
);
-- 兼容已存在的旧 users 表（补充新字段）
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_earn_at BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_coins DOUBLE PRECISION DEFAULT 0;

-- ── 邀请事件表 ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invites (
  id             SERIAL PRIMARY KEY,
  inviter_tg_id  TEXT,
  invited_tg_id  TEXT,
  created_at     BIGINT,
  rewarded       BOOLEAN DEFAULT false,
  rewarded_at    BIGINT
);
CREATE INDEX IF NOT EXISTS idx_invites_inviter_day ON invites (inviter_tg_id, created_at);
-- 兼容已存在的旧 invites 表（补充新字段）
ALTER TABLE invites ADD COLUMN IF NOT EXISTS rewarded BOOLEAN DEFAULT false;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS rewarded_at BIGINT;

-- ── 广告服务端回调表（Adsgram Reward URL 回调记录，用于交叉校验风控）──
CREATE TABLE IF NOT EXISTS ad_callbacks (
  id         SERIAL PRIMARY KEY,
  tg_id      TEXT,
  created_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_ad_callbacks_tg_day ON ad_callbacks (tg_id, created_at);

-- ── RPC 1：记录邀请关系（开户时调用，仅记录，不发奖励）──────────────
CREATE OR REPLACE FUNCTION insert_invite(p_inviter_tg_id text, p_invited_tg_id text, p_ts bigint)
RETURNS void AS $$
BEGIN
  IF p_inviter_tg_id IS NOT NULL
     AND p_inviter_tg_id <> p_invited_tg_id
     AND EXISTS (SELECT 1 FROM users WHERE tg_id = p_inviter_tg_id) THEN
    INSERT INTO invites (inviter_tg_id, invited_tg_id, created_at, rewarded)
    VALUES (p_inviter_tg_id, p_invited_tg_id, p_ts, false);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ── RPC 2：发放邀请奖励（被邀请者达到质量门槛时调用）────────────────
-- 条件：被邀请者等级 > 10 且看过完整广告；邀请者当日有效邀请上限 5000
CREATE OR REPLACE FUNCTION try_reward_inviter(p_invited_tg_id text, p_lv int, p_watched_ad boolean, p_ts bigint, p_day_start bigint)
RETURNS void AS $$
DECLARE
  inv_rec RECORD;
  today_count int;
BEGIN
  IF p_lv <= 10 OR p_watched_ad = false THEN
    RETURN;
  END IF;

  SELECT * INTO inv_rec FROM invites
  WHERE invited_tg_id = p_invited_tg_id AND rewarded = false
  ORDER BY id ASC LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO today_count FROM invites
  WHERE inviter_tg_id = inv_rec.inviter_tg_id AND rewarded = true AND rewarded_at >= p_day_start;

  IF today_count >= 5000 THEN
    RETURN;
  END IF;

  UPDATE users
  SET bonus_coins = COALESCE(bonus_coins, 0) + 5000,
      invite_count = invite_count + 1
  WHERE tg_id = inv_rec.inviter_tg_id;

  UPDATE invites SET rewarded = true, rewarded_at = p_ts WHERE id = inv_rec.id;
END;
$$ LANGUAGE plpgsql;

-- ── RPC 2：全球等级榜（按图鉴最高解锁等级降序，金币为 coins + bonus_coins 总额）──
CREATE OR REPLACE FUNCTION get_leaderboard(p_tg_id text)
RETURNS json AS $$
DECLARE
  my_lv int := 0;
  my_coins double precision := 0;
  my_rank int := 0;
  lb_list json;
BEGIN
  SELECT COALESCE((SELECT max(elem::int) FROM jsonb_array_elements_text(pokedex) elem), 0),
         COALESCE(coins, 0) + COALESCE(bonus_coins, 0)
  INTO my_lv, my_coins
  FROM users WHERE tg_id = p_tg_id;

  SELECT COUNT(*) + 1 INTO my_rank FROM users
  WHERE COALESCE((SELECT max(elem::int) FROM jsonb_array_elements_text(pokedex) elem), 0) > my_lv
     OR (COALESCE((SELECT max(elem::int) FROM jsonb_array_elements_text(pokedex) elem), 0) = my_lv
         AND COALESCE(coins, 0) + COALESCE(bonus_coins, 0) > my_coins);

  SELECT COALESCE(json_agg(json_build_object(
    'rank', rn, 'username', username, 'lv', lv, 'coins', coins, 'isMe', is_me
  ) ORDER BY rn), '[]'::json)
  INTO lb_list
  FROM (
    SELECT row_number() OVER (ORDER BY max_lv DESC, total_coins DESC) AS rn,
           username, max_lv AS lv, total_coins AS coins, (tg_id = p_tg_id) AS is_me
    FROM (
      SELECT tg_id, username,
             COALESCE(coins, 0) + COALESCE(bonus_coins, 0) AS total_coins,
             COALESCE((SELECT max(elem::int) FROM jsonb_array_elements_text(pokedex) elem), 0) AS max_lv
      FROM users
      ORDER BY max_lv DESC, total_coins DESC
      LIMIT 100
    ) s
  ) t;

  RETURN json_build_object(
    'list', lb_list,
    'myRank', my_rank,
    'myLv', my_lv,
    'myCoins', my_coins
  );
END;
$$ LANGUAGE plpgsql;

-- ── RPC 3：当日邀请榜（按今日邀请数降序）────────────────────────────
CREATE OR REPLACE FUNCTION get_invite_board(p_tg_id text, p_day_start bigint)
RETURNS json AS $$
DECLARE
  my_count int := 0;
  my_rank int := 0;
  ib_list json;
BEGIN
  SELECT COUNT(*) INTO my_count FROM invites WHERE inviter_tg_id = p_tg_id AND rewarded = true AND rewarded_at >= p_day_start;

  IF my_count > 0 THEN
    SELECT COUNT(*) + 1 INTO my_rank FROM (
      SELECT inviter_tg_id FROM invites WHERE rewarded = true AND rewarded_at >= p_day_start
      GROUP BY inviter_tg_id HAVING COUNT(*) > my_count
    ) t;
  END IF;

  SELECT COALESCE(json_agg(json_build_object(
    'rank', rn, 'username', username, 'count', cnt, 'isMe', is_me
  ) ORDER BY rn), '[]'::json)
  INTO ib_list
  FROM (
    SELECT row_number() OVER (ORDER BY cnt DESC) AS rn,
           username, cnt, (inviter_tg_id = p_tg_id) AS is_me
    FROM (
      SELECT i.inviter_tg_id, u.username, COUNT(*) AS cnt
      FROM invites i
      LEFT JOIN users u ON u.tg_id = i.inviter_tg_id
      WHERE i.rewarded = true AND i.rewarded_at >= p_day_start
      GROUP BY i.inviter_tg_id, u.username
      ORDER BY cnt DESC
      LIMIT 100
    ) s
  ) t;

  RETURN json_build_object(
    'list', ib_list,
    'myRank', my_rank,
    'myCount', my_count
  );
END;
$$ LANGUAGE plpgsql;
