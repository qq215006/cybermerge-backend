-- =====================================================================
-- CyberMerge Supabase 数据库脚本
-- 请在 Supabase SQL Editor 中完整执行一次（建表 + RPC 函数）
-- =====================================================================

-- ── 用户表 ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  tg_id         TEXT PRIMARY KEY,
  ref_code      TEXT UNIQUE,   -- 随机邀请码（隐藏 TG ID，用于邀请链接反查）
  username      TEXT,
  coins         DOUBLE PRECISION DEFAULT 1000,
  bonus_coins   DOUBLE PRECISION DEFAULT 0,
  grid          JSONB DEFAULT '[]'::jsonb,
  buy_count     INTEGER DEFAULT 0,
  inflate_count INTEGER DEFAULT 0,
  ad_used_today INTEGER DEFAULT 0,
  wd_ad_used    INTEGER DEFAULT 0,
  pokedex       JSONB DEFAULT '[]'::jsonb,
  max_level     INTEGER DEFAULT 0,  -- 冗余最高等级字段，用于提升排行榜查询性能
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
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_level INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS inflate_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ref_code TEXT UNIQUE;
-- 回填已有用户的 max_level（避免老用户暂时显示 0 级）
UPDATE users SET max_level = COALESCE((SELECT max(elem::int) FROM jsonb_array_elements_text(pokedex) elem), 0);
-- 排行榜排序索引（空间换时间）
CREATE INDEX IF NOT EXISTS idx_users_max_level ON users (max_level DESC);

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

-- ── RPC 2：全球等级榜（按 max_level 降序，金币为 coins + bonus_coins 总额）──
CREATE OR REPLACE FUNCTION get_leaderboard(p_tg_id text)
RETURNS json AS $$
DECLARE
  my_lv int := 0;
  my_coins double precision := 0;
  my_rank int := 0;
  lb_list json;
BEGIN
  -- 查询自己的数据（直接读冗余 max_level，不再解析 pokedex）
  SELECT COALESCE(max_level, 0),
         COALESCE(coins, 0) + COALESCE(bonus_coins, 0)
  INTO my_lv, my_coins
  FROM users WHERE tg_id = p_tg_id;

  -- 计算自己的排名
  SELECT COUNT(*) + 1 INTO my_rank FROM users
  WHERE COALESCE(max_level, 0) > my_lv
     OR (COALESCE(max_level, 0) = my_lv
         AND COALESCE(coins, 0) + COALESCE(bonus_coins, 0) > my_coins);

  -- 前 100 名 + 自己（即使掉出前 100，也固定把自己显示在列表里）
  SELECT COALESCE(json_agg(json_build_object(
    'rank', rn, 'username', username, 'lv', lv, 'coins', coins, 'isMe', is_me
  ) ORDER BY rn), '[]'::json)
  INTO lb_list
  FROM (
    SELECT
      tg_id,
      username,
      COALESCE(max_level, 0) AS lv,
      COALESCE(coins, 0) + COALESCE(bonus_coins, 0) AS coins,
      ROW_NUMBER() OVER (
        ORDER BY
          COALESCE(max_level, 0) DESC,
          COALESCE(coins, 0) + COALESCE(bonus_coins, 0) DESC
      ) AS rn,
      (tg_id = p_tg_id) AS is_me
    FROM users
  ) t
  WHERE rn <= 100 OR tg_id = p_tg_id;

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
    SELECT
      inviter_tg_id,
      username,
      cnt,
      ROW_NUMBER() OVER (ORDER BY cnt DESC) AS rn,
      (inviter_tg_id = p_tg_id) AS is_me
    FROM (
      SELECT i.inviter_tg_id, u.username, COUNT(*) AS cnt
      FROM invites i
      LEFT JOIN users u ON u.tg_id = i.inviter_tg_id
      WHERE i.rewarded = true AND i.rewarded_at >= p_day_start
      GROUP BY i.inviter_tg_id, u.username
    ) s
  ) t
  WHERE rn <= 100;

  RETURN json_build_object(
    'list', ib_list,
    'myRank', my_rank,
    'myCount', my_count
  );
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- 每周分红系统（广告收益 50% 注入 → 40级用户按贡献瓜分）
-- ═══════════════════════════════════════════════════════════

-- 奖池表
CREATE TABLE IF NOT EXISTS pools (
  id           SERIAL PRIMARY KEY,
  week_key     TEXT UNIQUE,                 -- 周标识，如 "2026-W33"
  amount_usdt  DOUBLE PRECISION DEFAULT 0,  -- 本期注入的 USD₮
  status       TEXT DEFAULT 'open',         -- open / settled
  created_at   BIGINT DEFAULT 0,
  settled_at   BIGINT DEFAULT 0
);

-- 用户新增字段：本周看广告次数 + 40级猫剩余分红次数数组 [4,3,2]（与场上40级猫数量对齐）
ALTER TABLE users ADD COLUMN IF NOT EXISTS week_ad_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS div_cats JSONB DEFAULT '[]'::jsonb;

-- 分红账本
CREATE TABLE IF NOT EXISTS dividend_records (
  id           SERIAL PRIMARY KEY,
  week_key     TEXT,
  tg_id        TEXT,
  contribution DOUBLE PRECISION DEFAULT 0,  -- 贡献值（邀请 + 本周看广告）
  share        DOUBLE PRECISION DEFAULT 0,  -- 占比
  amount_usdt  DOUBLE PRECISION DEFAULT 0,  -- 分到的 USD₮
  created_at   BIGINT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_dividend_week ON dividend_records (week_key);
CREATE INDEX IF NOT EXISTS idx_dividend_user ON dividend_records (tg_id);

-- 结算 RPC：算占比 → 记账 → 40级猫分红次数-1 → 剩余0次的猫回收
-- div_cats 为数组 [4,3,2]，与场上40级猫数量对齐（每只猫剩余分红次数）
CREATE OR REPLACE FUNCTION settle_dividend(p_week_key text, p_amount_usdt double precision)
RETURNS json AS $$
DECLARE
  total_contrib double precision := 0;
  rec  RECORD;
  cat  RECORD;
  contrib double precision;
  share double precision;
  amt double precision;
  new_cnt int;
  grid_new jsonb;
  div_new jsonb;
  recycle_count int;
  found_pos bigint;
  i int;
  cnt int := 0;
BEGIN
  -- 1. 记录本期奖池
  INSERT INTO pools (week_key, amount_usdt, status, created_at, settled_at)
  VALUES (p_week_key, p_amount_usdt, 'settled', (extract(epoch from now())*1000)::bigint, (extract(epoch from now())*1000)::bigint)
  ON CONFLICT (week_key) DO UPDATE
    SET amount_usdt = EXCLUDED.amount_usdt,
        status = 'settled',
        settled_at = (extract(epoch from now())*1000)::bigint;

  -- 2. 总贡献 = Σ(邀请人数 + 本周看广告次数)，只统计有40级猫的用户
  SELECT COALESCE(SUM(COALESCE(invite_count,0) + COALESCE(week_ad_count,0)), 0)
  INTO total_contrib
  FROM users
  WHERE div_cats IS NOT NULL AND jsonb_array_length(div_cats) > 0;

  IF total_contrib <= 0 THEN
    RETURN json_build_object('ok', false, 'reason', 'no contributors', 'count', 0);
  END IF;

  -- 3. 遍历每个有40级猫的用户
  FOR rec IN
    SELECT tg_id, grid, div_cats,
           COALESCE(invite_count,0) AS invite_count,
           COALESCE(week_ad_count,0) AS week_ad_count
    FROM users
    WHERE div_cats IS NOT NULL AND jsonb_array_length(div_cats) > 0
  LOOP
    contrib := rec.invite_count + rec.week_ad_count;
    share := contrib / total_contrib;
    amt := round((p_amount_usdt * share)::numeric, 6);

    -- 记账
    INSERT INTO dividend_records (week_key, tg_id, contribution, share, amount_usdt, created_at)
    VALUES (p_week_key, rec.tg_id, contrib, share, amt, (extract(epoch from now())*1000)::bigint);

    -- 只有分到钱（share>0）才扣分红次数（拿到钱才扣）
    IF share > 0 THEN
      grid_new := rec.grid;
      div_new := '[]'::jsonb;
      recycle_count := 0;

      -- 每只猫剩余分红次数 -1；<=0 的回收
      FOR cat IN SELECT (value)::int AS c FROM jsonb_array_elements(rec.div_cats) LOOP
        new_cnt := cat.c - 1;
        IF new_cnt <= 0 THEN
          recycle_count := recycle_count + 1;
        ELSE
          div_new := div_new || to_jsonb(new_cnt);
        END IF;
      END LOOP;

      -- 回收：把 grid 里前 recycle_count 个 40 级猫置空
      FOR i IN 1..recycle_count LOOP
        SELECT ord::bigint INTO found_pos
        FROM jsonb_array_elements_text(grid_new) WITH ORDINALITY AS arr(val, ord)
        WHERE val = '40'
        ORDER BY ord ASC
        LIMIT 1;
        IF found_pos IS NOT NULL THEN
          grid_new := jsonb_set(grid_new, ARRAY[(found_pos - 1)::text], 'null'::jsonb);
        END IF;
      END LOOP;

      UPDATE users SET grid = grid_new, div_cats = div_new, week_ad_count = 0
      WHERE tg_id = rec.tg_id;
    END IF;

    cnt := cnt + 1;
  END LOOP;

  RETURN json_build_object('ok', true, 'count', cnt, 'totalContrib', total_contrib);
END;
$$ LANGUAGE plpgsql;
