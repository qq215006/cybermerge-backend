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
ALTER TABLE users ADD COLUMN IF NOT EXISTS buy_day TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS buy_count_today INTEGER DEFAULT 0;
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

-- ── 广告服务端回调表（Monetag postback 回调记录，用于交叉校验风控）──
CREATE TABLE IF NOT EXISTS ad_callbacks (
  id         SERIAL PRIMARY KEY,
  tg_id      TEXT,
  created_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_ad_callbacks_tg_day ON ad_callbacks (tg_id, created_at);

-- ── 广告财务流水表（Monetag 每次回调的预估收益，用于与 Monetag 后台对账）──
CREATE TABLE IF NOT EXISTS ad_revenue (
  id         BIGSERIAL PRIMARY KEY,
  tg_id      TEXT,
  event      TEXT DEFAULT '',
  price      DOUBLE PRECISION DEFAULT 0,
  created_at BIGINT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ad_revenue_tg_day ON ad_revenue (tg_id, created_at);

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

-- ── RPC 3：本周邀请榜（按本周邀请数降序，每周一 08:00 北京时间重置）────
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

-- ── RPC 4：赛季榜（按持有40级猫数量 = 份额数降序，份额最大16）────────
CREATE OR REPLACE FUNCTION get_season_board(p_tg_id text)
RETURNS json AS $$
DECLARE
  my_shares int := 0;
  my_rank int := 0;
  sb_list json;
BEGIN
  SELECT LEAST(COALESCE(jsonb_array_length(div_cats), 0), 16)
  INTO my_shares
  FROM users WHERE tg_id = p_tg_id;

  IF my_shares > 0 THEN
    SELECT COUNT(*) + 1 INTO my_rank FROM users
    WHERE LEAST(COALESCE(jsonb_array_length(div_cats), 0), 16) > my_shares;
  END IF;

  SELECT COALESCE(json_agg(json_build_object(
    'rank', rn, 'username', username, 'shares', shares, 'isMe', is_me
  ) ORDER BY rn), '[]'::json)
  INTO sb_list
  FROM (
    SELECT
      tg_id,
      username,
      shares,
      ROW_NUMBER() OVER (ORDER BY shares DESC) AS rn,
      (tg_id = p_tg_id) AS is_me
    FROM (
      SELECT tg_id, username, LEAST(COALESCE(jsonb_array_length(div_cats), 0), 16) AS shares
      FROM users
      WHERE div_cats IS NOT NULL AND jsonb_array_length(div_cats) > 0
    ) s
  ) t
  WHERE rn <= 100;

  RETURN json_build_object(
    'list', sb_list,
    'myRank', my_rank,
    'myShares', my_shares
  );
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- 每周分红系统（广告收益 50% 注入 → 40级用户按本周看广告次数瓜分）
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

-- 每日广告计数表：记录每个用户每天看广告条数（day_key 用 UTC 日期 = 北京时间8点边界）
CREATE TABLE IF NOT EXISTS ad_daily_counts (
  id         SERIAL PRIMARY KEY,
  tg_id      TEXT,
  day_key    TEXT,                 -- "YYYY-MM-DD"
  count      INTEGER DEFAULT 0,
  updated_at BIGINT DEFAULT 0,
  UNIQUE (tg_id, day_key)
);
CREATE INDEX IF NOT EXISTS idx_ad_daily_tg_day ON ad_daily_counts (tg_id, day_key);

-- 每周广告快照表：每周一 8 点快照后重置，用于核对赛季榜快照（确认分红依据）
CREATE TABLE IF NOT EXISTS ad_week_snapshots (
  id         SERIAL PRIMARY KEY,
  week_key   TEXT,                 -- 与赛季榜快照/奖池共用同一周期标识，如 "S0"
  tg_id      TEXT,
  username   TEXT,
  ad_count   INTEGER DEFAULT 0,    -- 本周看广告总数
  created_at BIGINT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ad_week_snapshots_key ON ad_week_snapshots (week_key);

-- 分红账本
CREATE TABLE IF NOT EXISTS dividend_records (
  id           SERIAL PRIMARY KEY,
  week_key     TEXT,
  tg_id        TEXT,
  contribution DOUBLE PRECISION DEFAULT 0,  -- 贡献值（本周看广告次数）
  share        DOUBLE PRECISION DEFAULT 0,  -- 占比
  amount_usdt  DOUBLE PRECISION DEFAULT 0,  -- 分到的 USD₮
  created_at   BIGINT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_dividend_week ON dividend_records (week_key);
CREATE INDEX IF NOT EXISTS idx_dividend_user ON dividend_records (tg_id);

-- 每周广告快照 RPC：聚合本周每日广告数 → 写入 ad_week_snapshots → 清空每日计数（重置）
-- 只快照/清空「今天之前」的每日计数，避免把新一周当天的数据误并进上一周
CREATE OR REPLACE FUNCTION snapshot_week_ads(p_week_key text)
RETURNS json AS $$
DECLARE
  inserted int := 0;
  today_key text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
BEGIN
  INSERT INTO ad_week_snapshots (week_key, tg_id, username, ad_count, created_at)
  SELECT p_week_key, d.tg_id, COALESCE(u.username, ''), SUM(d.count), (extract(epoch from now())*1000)::bigint
  FROM ad_daily_counts d
  LEFT JOIN users u ON u.tg_id = d.tg_id
  WHERE d.count > 0 AND d.day_key < today_key
  GROUP BY d.tg_id, u.username;

  GET DIAGNOSTICS inserted = ROW_COUNT;

  -- 重置：清空「今天之前」的每日计数，同时把 users.week_ad_count 归零
  DELETE FROM ad_daily_counts WHERE day_key < today_key;
  UPDATE users SET week_ad_count = 0 WHERE week_ad_count IS NULL OR week_ad_count <> 0;

  RETURN json_build_object('ok', true, 'weekKey', p_week_key, 'snapshotCount', inserted);
END;
$$ LANGUAGE plpgsql;

-- 赛季 key 计算：与前端 main.js 的 SEASON_EPOCH_MS 保持一致（2026-08-10 周一 00:00 UTC）
-- p_offset：0 = 当前赛季；-1 = 上一赛季（用于快照）
CREATE OR REPLACE FUNCTION get_season_key(p_offset int DEFAULT 0)
RETURNS text AS $$
DECLARE
  season_epoch timestamptz := '2026-08-10 00:00:00+00';
  season int;
BEGIN
  season := floor(extract(epoch from (now() - season_epoch)) / (7 * 24 * 3600))::int + p_offset;
  RETURN 'S' || season::text;
END;
$$ LANGUAGE plpgsql;

-- 每周一自动执行：快照上一赛季的赛季榜 + 广告数，然后重置
CREATE OR REPLACE FUNCTION run_weekly_season()
RETURNS json AS $$
DECLARE
  prev_key text := get_season_key(-1);
BEGIN
  PERFORM snapshot_season(prev_key);   -- 快照40级用户 + 份额
  PERFORM snapshot_week_ads(prev_key); -- 快照广告数 + 重置每日计数
  RETURN json_build_object('ok', true, 'seasonKey', prev_key);
END;
$$ LANGUAGE plpgsql;

-- 结算 RPC：算占比 → 记账 → 40级猫分红次数-1 → 剩余0次的猫回收
-- div_cats 为数组 [4,3,2]，与场上40级猫数量对齐（每只猫剩余分红次数）
-- 广告贡献按 ad_week_snapshots 里的本周广告总数（需先执行 snapshot_week_ads）
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

  -- 2. 总贡献 = Σ(本周广告快照)，只统计有40级猫的用户
  SELECT COALESCE(SUM(a.ad_count), 0)
  INTO total_contrib
  FROM users u
  JOIN ad_week_snapshots a ON a.tg_id = u.tg_id AND a.week_key = p_week_key
  WHERE u.div_cats IS NOT NULL AND jsonb_array_length(u.div_cats) > 0;

  IF total_contrib <= 0 THEN
    RETURN json_build_object('ok', false, 'reason', 'no contributors', 'count', 0);
  END IF;

  -- 3. 遍历每个有40级猫的用户，取其本周广告快照
  FOR rec IN
    SELECT u.tg_id, u.grid, u.div_cats,
           COALESCE(a.ad_count, 0) AS week_ad_count
    FROM users u
    LEFT JOIN ad_week_snapshots a ON a.tg_id = u.tg_id AND a.week_key = p_week_key
    WHERE u.div_cats IS NOT NULL AND jsonb_array_length(u.div_cats) > 0
  LOOP
    contrib := rec.week_ad_count;
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

      UPDATE users SET grid = grid_new, div_cats = div_new
      WHERE tg_id = rec.tg_id;
    END IF;

    cnt := cnt + 1;
  END LOOP;

  RETURN json_build_object('ok', true, 'count', cnt, 'totalContrib', total_contrib);
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- 赛季天梯（7天一个赛季，每周一 08:00 北京时间重置）
-- ═══════════════════════════════════════════════════════════

-- 赛季快照表：赛季结算前，快照所有持有40级猫的用户及份额数（历史留档）
CREATE TABLE IF NOT EXISTS season_snapshots (
  id          SERIAL PRIMARY KEY,
  season_key  TEXT,                     -- 赛季标识，如 "S0" / "2026-W33"
  tg_id       TEXT,
  username    TEXT,
  shares      INTEGER DEFAULT 0,        -- 40级猫数量（份额），最大16
  created_at  BIGINT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_season_snapshots_key ON season_snapshots (season_key);

-- 赛季结算前快照 RPC：锁定所有持有40级猫的用户及份额数量
-- 建议在每周一 08:00 重置前手动/定时执行，执行后再进行新赛季重置
CREATE OR REPLACE FUNCTION snapshot_season(p_season_key text)
RETURNS json AS $$
DECLARE
  inserted int := 0;
BEGIN
  INSERT INTO season_snapshots (season_key, tg_id, username, shares, created_at)
  SELECT
    p_season_key,
    tg_id,
    username,
    LEAST(COALESCE(jsonb_array_length(div_cats), 0), 16),
    (extract(epoch from now())*1000)::bigint
  FROM users
  WHERE div_cats IS NOT NULL AND jsonb_array_length(div_cats) > 0;

  GET DIAGNOSTICS inserted = ROW_COUNT;

  RETURN json_build_object('ok', true, 'seasonKey', p_season_key, 'snapshotCount', inserted);
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- 自动定时：每周一 08:00（北京时间）= 每周一 00:00 UTC 自动快照 + 重置
-- 使用 Supabase pg_cron（需先在 Dashboard → Database → Extensions 启用 pg_cron）
-- ═══════════════════════════════════════════════════════════

-- 1) 开启 pg_cron（若 Dashboard 已手动开启可跳过）
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2) 注册定时任务（cron 表达式为 UTC：每周一 00:00）
-- SELECT cron.schedule(
--   'cybermerge-weekly-season',
--   '0 0 * * 1',
--   $$ SELECT run_weekly_season(); $$
-- );

-- 3) 查看 / 删除定时任务
-- SELECT * FROM cron.job WHERE jobname = 'cybermerge-weekly-season';
-- SELECT cron.unschedule('cybermerge-weekly-season');

-- 注：
--   · 快照（run_weekly_season）会自动执行，快照上一赛季的赛季榜 + 广告数，然后重置。
--   · 分红结算 settle_dividend(赛季key, USD₮金额) 仍需人工执行，因为金额来自广告收益注入，
--     无法在数据库里自动获取；注入后手动跑：
--     SELECT settle_dividend(get_season_key(-1), 123.45);  -- 结算刚结束的赛季

-- ═══════════════════════════════════════════════════════════
-- 6 大核心模式补充（增量更新，银行级安全：后端定价 + 行锁 + 幂等）
-- ═══════════════════════════════════════════════════════════

-- ── 1. 用户表字段扩充 ───────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS internal_usdt DOUBLE PRECISION DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS newbie_cat_claimed BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS newbie_ad_stage INTEGER DEFAULT 0;   -- 新人解锁广告进度：0=99% / 1=99.5% / 2=99.7%
ALTER TABLE users ADD COLUMN IF NOT EXISTS boost_ad_used INTEGER DEFAULT 0;     -- 加速收益广告今日已用次数
ALTER TABLE users ADD COLUMN IF NOT EXISTS boost_ad_day TEXT DEFAULT '';        -- 加速收益广告所属日期（UTC 跨天重置）
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_share_at BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ad_contribution BIGINT DEFAULT 0;  -- 累计广告贡献（=份额）

-- ── 2. 广告回调表加入唯一 tx_id（幂等物理防线）──────────────────────
ALTER TABLE ad_callbacks ADD COLUMN IF NOT EXISTS tx_id TEXT UNIQUE;

-- ── 3. 全服全局统计表（仅 1 行：总广告数 + 实时奖池 + 赛季期数）──────
CREATE TABLE IF NOT EXISTS global_stats (
  id                 SERIAL PRIMARY KEY,
  total_ads_watched  BIGINT DEFAULT 0,
  current_prize_pool DOUBLE PRECISION DEFAULT 0,
  season_id          INT DEFAULT 0,
  updated_at         BIGINT DEFAULT 0
);
INSERT INTO global_stats (id, total_ads_watched, current_prize_pool, season_id, updated_at)
VALUES (1, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- ── 4. 广告回调记账（Monetag postback 回调调用，广告计数唯一权威来源）──
-- 第三方不提供唯一 tx_id → 改用「用户级 15 秒防抖锁」（PostgreSQL 咨询锁实现）保证幂等
DROP FUNCTION IF EXISTS record_ad_callback(text);
CREATE OR REPLACE FUNCTION record_ad_callback(p_tg_id text, p_event text, p_price double precision)
RETURNS json AS $$
DECLARE
  v_day text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_now bigint := (extract(epoch from now())*1000)::bigint;
  v_last bigint;
  v_user_exists boolean;
BEGIN
  -- 用户级咨询锁：同一 userid 串行，避免并发请求绕过防抖
  PERFORM pg_advisory_xact_lock(1, hashtext(p_tg_id));

  -- 用户存在性校验：无效 user_id 直接拒绝（不记账、不发奖）
  SELECT EXISTS(SELECT 1 FROM users WHERE tg_id = p_tg_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RETURN json_build_object('ok', false, 'reason', 'user not found');
  END IF;

  -- 15 秒防抖：同一 userid 15 秒内只允许成功记账一次（幂等）
  SELECT MAX(created_at) INTO v_last FROM ad_callbacks
  WHERE tg_id = p_tg_id AND created_at >= v_now - 15000;
  IF v_last IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'duplicate callback within 15s');
  END IF;

  INSERT INTO ad_callbacks (tg_id, created_at) VALUES (p_tg_id, v_now);

  -- 财务流水：记录本次广告预估收益（event + price，供对账）
  INSERT INTO ad_revenue (tg_id, event, price, created_at)
  VALUES (p_tg_id, COALESCE(p_event, ''), COALESCE(p_price, 0), v_now);

  -- 全服奖池：每 1 次广告 +0.001U（保持原经济模型不变）
  UPDATE global_stats
  SET total_ads_watched = total_ads_watched + 1,
      current_prize_pool = current_prize_pool + 0.001,
      updated_at = v_now
  WHERE id = 1;

  -- 用户份额（份额 = 广告数量）
  UPDATE users
  SET ad_contribution = COALESCE(ad_contribution, 0) + 1,
      week_ad_count    = COALESCE(week_ad_count, 0) + 1
  WHERE tg_id = p_tg_id;

  -- 每日广告明细 +1
  INSERT INTO ad_daily_counts (tg_id, day_key, count, updated_at)
  VALUES (p_tg_id, v_day, 1, v_now)
  ON CONFLICT (tg_id, day_key)
  DO UPDATE SET count = ad_daily_counts.count + 1, updated_at = EXCLUDED.updated_at;

  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql;

-- ── 5. 模式1：新人领取 35 级猫（广告计数由回调统一记录，这里只发猫）──
CREATE OR REPLACE FUNCTION claim_newbie_cat(p_tg_id text)
RETURNS json AS $$
DECLARE
  v_claimed boolean;
  v_stage int;
  v_invites int;
  v_grid jsonb;
  v_idx int;
BEGIN
  SELECT newbie_cat_claimed, COALESCE(newbie_ad_stage, 0), COALESCE(invite_count, 0), grid
    INTO v_claimed, v_stage, v_invites, v_grid
  FROM users WHERE tg_id = p_tg_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'user not found');
  END IF;

  IF v_claimed THEN
    RETURN json_build_object('ok', false, 'reason', 'already claimed');
  END IF;

  IF v_stage < 2 THEN
    RETURN json_build_object('ok', false, 'reason', 'ads not completed', 'stage', v_stage);
  END IF;

  IF v_invites < 2 THEN
    RETURN json_build_object('ok', false, 'reason', 'invites not enough', 'invites', v_invites);
  END IF;

  SELECT i INTO v_idx FROM generate_series(0, 15) AS i
  WHERE (v_grid->>i) IS NULL
  ORDER BY i LIMIT 1;

  IF v_idx IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'grid full');
  END IF;

  v_grid := jsonb_set(v_grid, ARRAY[v_idx::text], '35'::jsonb);

  UPDATE users
  SET grid = v_grid,
      newbie_cat_claimed = true,
      max_level = GREATEST(COALESCE(max_level, 0), 35)
  WHERE tg_id = p_tg_id;

  RETURN json_build_object('ok', true, 'level', 35, 'grid', v_grid);
END;
$$ LANGUAGE plpgsql;

-- ── 5.1 新人解锁广告进度推进（看一次广告 +1 阶段，封顶 2）──
CREATE OR REPLACE FUNCTION advance_newbie_ad(p_tg_id text)
RETURNS json AS $$
DECLARE
  v_stage int;
BEGIN
  UPDATE users
  SET newbie_ad_stage = LEAST(COALESCE(newbie_ad_stage, 0) + 1, 2)
  WHERE tg_id = p_tg_id
  RETURNING newbie_ad_stage INTO v_stage;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'user not found');
  END IF;

  RETURN json_build_object('ok', true, 'stage', v_stage);
END;
$$ LANGUAGE plpgsql;

-- ── 5.2 加速收益广告：每日 15 次，奖励 = 3×当前秒收益（金额由后端入账）──
CREATE OR REPLACE FUNCTION boost_ad_reward(p_tg_id text, p_amount double precision)
RETURNS json AS $$
DECLARE
  v_used int;
  v_day text;
  v_today text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_amount double precision;
BEGIN
  SELECT COALESCE(boost_ad_used, 0), boost_ad_day INTO v_used, v_day
  FROM users WHERE tg_id = p_tg_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'user not found');
  END IF;

  -- 跨天重置
  IF v_day IS DISTINCT FROM v_today THEN
    v_used := 0;
  END IF;

  IF v_used >= 15 THEN
    RETURN json_build_object('ok', false, 'reason', 'daily limit reached', 'used', v_used);
  END IF;

  v_amount := GREATEST(0, COALESCE(p_amount, 0));

  UPDATE users
  SET coins = coins + v_amount,
      boost_ad_used = v_used + 1,
      boost_ad_day = v_today
  WHERE tg_id = p_tg_id;

  RETURN json_build_object('ok', true, 'reward', v_amount, 'used', v_used + 1);
END;
$$ LANGUAGE plpgsql;

-- ── 6. 模式2：每日海报分享（按自然日限 1 次，奖励后端固定 50000）───
CREATE OR REPLACE FUNCTION daily_share_reward(p_tg_id text)
RETURNS json AS $$
DECLARE
  v_last_share bigint;
  v_now bigint := (extract(epoch from now())*1000)::bigint;
  v_day_start bigint := (extract(epoch from date_trunc('day', now() AT TIME ZONE 'UTC'))*1000)::bigint;
  v_reward double precision := 50000;
BEGIN
  SELECT last_share_at INTO v_last_share FROM users WHERE tg_id = p_tg_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'user not found');
  END IF;

  IF v_last_share >= v_day_start THEN
    RETURN json_build_object('ok', false, 'reason', 'already shared today');
  END IF;

  UPDATE users
  SET coins = coins + v_reward, last_share_at = v_now
  WHERE tg_id = p_tg_id;

  RETURN json_build_object('ok', true, 'reward', v_reward);
END;
$$ LANGUAGE plpgsql;

-- ── 7. 模式3&4：购买猫咪（后端算价 + 35 级天花板 + 行锁）────────────
CREATE OR REPLACE FUNCTION buy_cat(p_tg_id text, p_level int)
RETURNS json AS $$
DECLARE
  v_coins double precision;
  v_grid jsonb;
  v_price double precision;
  v_idx int;
  v_inflate_count int;
  v_buy_count int;
  v_buy_day text;
  v_buy_count_today int;
  v_today text;
BEGIN
  IF p_level < 1 OR p_level > 35 THEN
    RETURN json_build_object('ok', false, 'reason', 'level out of range');
  END IF;

  v_today := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');

  SELECT coins, grid, COALESCE(inflate_count, 0), COALESCE(buy_count, 0), buy_day, COALESCE(buy_count_today, 0)
    INTO v_coins, v_grid, v_inflate_count, v_buy_count, v_buy_day, v_buy_count_today
  FROM users WHERE tg_id = p_tg_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'user not found');
  END IF;

  -- 每日购买计数（UTC 0点 = 上海 8点 跨天重置）
  IF v_buy_day IS DISTINCT FROM v_today THEN
    v_buy_day := v_today;
    v_buy_count_today := 0;
  END IF;

  -- 通胀：每天前 5 次免费，第 6 次起每次 +10%（×1.1）
  IF v_buy_count_today >= 5 THEN
    v_inflate_count := v_inflate_count + 1;
  END IF;

  -- 购买成本：100 × 2.2^(level-1) × 1.1^inflate_count（跨级倍率 2.2 > 算力倍率 1.8，成本压过收益）
  v_price := 100 * power(2.2, p_level - 1) * power(1.1, v_inflate_count);

  IF v_coins < v_price THEN
    RETURN json_build_object('ok', false, 'reason', 'insufficient coins', 'price', v_price);
  END IF;

  SELECT i INTO v_idx FROM generate_series(0, 15) AS i
  WHERE (v_grid->>i) IS NULL
  ORDER BY i LIMIT 1;

  IF v_idx IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'grid full');
  END IF;

  v_grid := jsonb_set(v_grid, ARRAY[v_idx::text], to_jsonb(p_level));
  v_buy_count := v_buy_count + 1;
  v_buy_count_today := v_buy_count_today + 1;

  UPDATE users
  SET coins = coins - v_price,
      grid = v_grid,
      buy_count = v_buy_count,
      inflate_count = v_inflate_count,
      buy_day = v_buy_day,
      buy_count_today = v_buy_count_today,
      max_level = GREATEST(COALESCE(max_level, 0), p_level)
  WHERE tg_id = p_tg_id;

  RETURN json_build_object('ok', true, 'level', p_level, 'price', v_price, 'grid', v_grid, 'inflate_count', v_inflate_count, 'buy_count', v_buy_count);
END;
$$ LANGUAGE plpgsql;

-- ── 8. 模式6：官方回收站（后端算奖励 + 行锁防双花 + 奖池防击穿）────
CREATE OR REPLACE FUNCTION recycle_cat(p_tg_id text, p_grid_index int, p_cat_level int)
RETURNS json AS $$
DECLARE
  v_grid jsonb;
  v_actual_level int;
  v_reward_coins double precision := 0;
  v_reward_usdt double precision := 0;
BEGIN
  IF p_grid_index < 0 OR p_grid_index > 15 THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid index');
  END IF;

  SELECT grid INTO v_grid FROM users WHERE tg_id = p_tg_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'user not found');
  END IF;

  v_actual_level := (v_grid->>p_grid_index)::int;

  IF v_actual_level IS NULL OR v_actual_level != p_cat_level THEN
    RETURN json_build_object('ok', false, 'reason', 'cat mismatch or empty');
  END IF;

  v_grid := jsonb_set(v_grid, ARRAY[p_grid_index::text], 'null'::jsonb);

  IF p_cat_level < 35 THEN
    -- 34级及以下：金币 = 购买价 50% = 100 * 2.2^(level-1) * 0.5
    v_reward_coins := 100 * power(2.2, p_cat_level - 1) * 0.5;
    UPDATE users SET grid = v_grid, coins = coins + v_reward_coins
    WHERE tg_id = p_tg_id;
    RETURN json_build_object('ok', true, 'type', 'coins', 'reward', v_reward_coins, 'grid', v_grid);
  ELSE
    -- 35级及以上：给 internal_usdt（阶梯可配置）
    v_reward_usdt := CASE p_cat_level
      WHEN 35 THEN 0.1
      WHEN 36 THEN 0.5
      WHEN 37 THEN 1.0
      WHEN 38 THEN 2.0
      WHEN 39 THEN 4.0
      WHEN 40 THEN 8.0
      ELSE 0
    END;

    -- 防击穿：奖池余额必须足够托底
    IF (SELECT COALESCE(current_prize_pool, 0) FROM global_stats WHERE id = 1) < v_reward_usdt THEN
      RETURN json_build_object('ok', false, 'reason', 'prize pool exhausted');
    END IF;

    UPDATE users SET grid = v_grid, internal_usdt = COALESCE(internal_usdt, 0) + v_reward_usdt
    WHERE tg_id = p_tg_id;

    UPDATE global_stats SET current_prize_pool = current_prize_pool - v_reward_usdt WHERE id = 1;

    RETURN json_build_object('ok', true, 'type', 'usdt', 'reward', v_reward_usdt, 'grid', v_grid);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ── 9. S1 赛季结算：按份额（=广告数）均分奖池 → 发 internal_usdt ─────
CREATE OR REPLACE FUNCTION settle_season(p_season_id int)
RETURNS json AS $$
DECLARE
  v_pool double precision;
  v_total_shares double precision;
  v_unit_value double precision;
  v_cnt int := 0;
  rec RECORD;
  v_now bigint := (extract(epoch from now())*1000)::bigint;
BEGIN
  SELECT current_prize_pool INTO v_pool FROM global_stats WHERE id = 1;

  SELECT COALESCE(SUM(week_ad_count), 0) INTO v_total_shares FROM users;

  IF v_pool <= 0 OR v_total_shares <= 0 THEN
    RETURN json_build_object('ok', false, 'reason', 'no pool or no shares');
  END IF;

  v_unit_value := v_pool / v_total_shares;

  FOR rec IN
    SELECT tg_id, week_ad_count FROM users WHERE week_ad_count > 0
  LOOP
    UPDATE users
    SET internal_usdt = COALESCE(internal_usdt, 0) + (rec.week_ad_count * v_unit_value)
    WHERE tg_id = rec.tg_id;
    v_cnt := v_cnt + 1;
  END LOOP;

  UPDATE users SET week_ad_count = 0 WHERE week_ad_count <> 0;
  UPDATE global_stats
  SET current_prize_pool = 0, season_id = p_season_id, updated_at = v_now
  WHERE id = 1;

  RETURN json_build_object(
    'ok', true, 'pool', v_pool, 'totalShares', v_total_shares,
    'unitValue', v_unit_value, 'paidUsers', v_cnt
  );
END;
$$ LANGUAGE plpgsql;

-- ── 合成暴击喜讯广播表（排队滚动播报，只播报额外跳级）──
CREATE TABLE IF NOT EXISTS broadcasts (
  id         BIGSERIAL PRIMARY KEY,
  username   TEXT,
  extra      INT DEFAULT 0,
  level      INT DEFAULT 0,
  coins      INT DEFAULT 0,
  created_at BIGINT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON broadcasts (created_at DESC);

-- ── 全自动自付 Gas 提现流水表（Auto-Payout，秒打款成功才记账）──────
CREATE TABLE IF NOT EXISTS withdraw_orders (
  id              SERIAL PRIMARY KEY,
  tg_id           TEXT,
  receive_address TEXT,
  usdt_amount     DOUBLE PRECISION,
  gas_ton_hash    TEXT UNIQUE,
  payout_hash     TEXT,
  status          TEXT DEFAULT 'success',
  created_at      BIGINT
);

-- ── 提现前置风控校验（用户级锁 + 余额 + 当日全服熔断）──────────────
CREATE OR REPLACE FUNCTION check_withdraw_eligibility(p_tg_id text, p_usdt_amount double precision, p_daily_max double precision)
RETURNS json AS $$
DECLARE
  v_balance double precision;
  v_today_total double precision;
  v_day_start bigint := (extract(epoch from date_trunc('day', now() AT TIME ZONE 'UTC'))*1000)::bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(1, hashtext(p_tg_id));

  SELECT COALESCE(internal_usdt, 0) INTO v_balance FROM users WHERE tg_id = p_tg_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'user not found');
  END IF;

  IF v_balance < p_usdt_amount THEN
    RETURN json_build_object('ok', false, 'reason', 'insufficient usdt');
  END IF;

  -- 熔断：当日全服提现总额不得超过 p_daily_max（0 表示未配置则不熔断）
  SELECT COALESCE(SUM(usdt_amount), 0) INTO v_today_total FROM withdraw_orders WHERE created_at >= v_day_start;
  IF p_daily_max > 0 AND v_today_total + p_usdt_amount > p_daily_max THEN
    RETURN json_build_object('ok', false, 'reason', 'daily limit reached');
  END IF;

  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql;

-- ── 结算扣款（自动打款成功后调用：扣 internal_usdt + 记成功账单）──
CREATE OR REPLACE FUNCTION finalize_withdraw(p_tg_id text, p_receive_address text, p_usdt_amount double precision, p_gas_ton_hash text, p_payout_hash text)
RETURNS json AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(1, hashtext(p_tg_id));

  IF (SELECT COALESCE(internal_usdt, 0) FROM users WHERE tg_id = p_tg_id) < p_usdt_amount THEN
    RETURN json_build_object('ok', false, 'reason', 'insufficient usdt');
  END IF;

  BEGIN
    INSERT INTO withdraw_orders (tg_id, receive_address, usdt_amount, gas_ton_hash, payout_hash, status, created_at)
    VALUES (p_tg_id, p_receive_address, p_usdt_amount, p_gas_ton_hash, p_payout_hash, 'success', (extract(epoch from now())*1000)::bigint);
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'reason', 'duplicate gas tx');
  END;

  UPDATE users SET internal_usdt = internal_usdt - p_usdt_amount WHERE tg_id = p_tg_id;

  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- 定时任务：pg_cron 自动结算（北京时间 08:00 = UTC 00:00）
-- 前提：先在 Supabase → Database → Extensions 启用 pg_cron
-- ═══════════════════════════════════════════════════════════

-- 1) 启用扩展（若已手动启用可跳过）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2) 每周一 00:00 UTC 结算上一赛季奖池 → 按广告份额发 internal_usdt
SELECT cron.schedule(
  'cybermerge-settle-season',
  '0 0 * * 1',
  $$ SELECT settle_season(COALESCE((SELECT season_id FROM global_stats WHERE id = 1), 0) + 1); $$
);

-- 3) 每周一 00:05 UTC 快照上一赛季（赛季榜 + 广告数）+ 重置
SELECT cron.schedule(
  'cybermerge-weekly-snapshot',
  '5 0 * * 1',
  $$ SELECT run_weekly_season(); $$
);

-- 查看 / 删除定时任务
-- SELECT * FROM cron.job WHERE jobname LIKE 'cybermerge%';
-- SELECT cron.unschedule('cybermerge-settle-season');
-- SELECT cron.unschedule('cybermerge-weekly-snapshot');
