/**
 * CyberMerge — 萌猫合成大作战
 * 防刷经济模型：成本绝对压制收益
 *   - 算力公式：P_n = 1 × 1.8^(n-1)  （跨级倍率 1.8 < 2，强制不能"1+1>2"）
 *   - 购买成本：Cost = 100 × 2.2^(targetLevel-1) × 1.03^inflateCount
 *       · 跨级倍率 2.2 > 1.8（成本涨得比算力快 → 永远无法靠商店追赶）
 *       · 每天前5次购买不涨物价，之后每次 +3%
 *   - 商店最高可买 36 级（36级以上全靠合成）
 *   - 金币不够 → 商店按钮变灰 + 高亮绿色「看广告免费领」按钮
 */
(function(){
'use strict';

// ═══════ 国际化字典 i18n（zh / en / ru）═══════
const I18N = {
  // 心心胶囊
  timer_rate:       { zh:'本期鱼池',         en:'Pool',                 ru:'Пул' },
  // 等级横排
  level_coins_suf: { zh:'金',               en:'c',                    ru:'м' },
  level_reward_t:  { zh:'本期收益',          en:'Earnings',             ru:'Доход' },
  level_reward_s:  { zh:'鱼池瓜分',          en:'Share',                ru:'Доля' },
  level_max:       { zh:'40级',              en:'LV.40',                ru:'Ур.40' },
  // 标签行
  wallet_connect:  { zh:'链接钱包',          en:'Wallet',               ru:'Кошелек' },
  invite_text:     { zh:'邀请好友',          en:'Invite',               ru:'Инвайт' },
  community:       { zh:'社区',              en:'Community',            ru:'Сообщество' },
  invite_en:       { zh:'Invite',            en:'Invite',               ru:'Invite' },
  // 顶部全球等级榜按钮
  leaderboard:     { zh:'全球等级榜',        en:'Rank',                 ru:'Рейтинг' },
  lb_my_rank:      { zh:'我的排名',          en:'My Rank',                ru:'Рейтинг' },
  lb_tab_invite:   { zh:'👥 邀请榜',          en:'👥 Invite',             ru:'👥 Инвайт' },
  lb_empty_invite: { zh:'👥 本周暂无邀请，快去邀请好友冲榜吧！', en:'👥 No invites this week. Invite friends to rank!', ru:'👥 Пока нет приглашений на этой неделе. Пригласите друзей!' },
  lb_loading:      { zh:'⏳ 排行榜加载中...', en:'⏳ Loading leaderboard...', ru:'⏳ Загрузка рейтинга...' },
  lb_invite_unit:  { zh:'邀请', en:'invites', ru:'пригл.' },
  // 赛季天梯
  season_ladder:    { zh:'赛季天梯',      en:'Season',           ru:'Сезон' },
  season_title:     { zh:'赛季',          en:'Season',           ru:'Сезон' },
  season_tab:        { zh:'🏆 赛季榜',     en:'🏆 Season',        ru:'🏆 Сезон' },
  season_countdown:  { zh:'赛季倒计时',    en:'Countdown',        ru:'Отсчёт' },
  season_rule:       { zh:'赛季瓜分规则',  en:'Rules',            ru:'Правила' },
  season_rule_text:  { zh:'赛季倒计时结束后统计，锁定满40级的用户，按本周看广告数量占比瓜分红利池所有资金。', en:'At season end, LV.40 holders split the entire pool in proportion to ads watched this week.', ru:'По окончании сезона держатели LV.40 делят весь пул пропорционально просмотренной рекламе за неделю.' },
  season_shares_unit:{ zh:'份',            en:'shares',          ru:'долей' },
  season_empty:     { zh:'🏆 本场暂无40级招财猫，快去合成升级抢占份额吧！', en:'🏆 No LV.40 cats this season yet. Merge to grab a share!', ru:'🏆 Пока нет котов LV.40 в этом сезоне. Объединяйте, чтобы получить долю!' },
  // 快捷功能小圆标
  quick_leaderboard: { zh:'全球天梯',        en:'Rank',                ru:'Топ' },
  quick_community:   { zh:'官方社区',        en:'Group',               ru:'Группа' },
  quick_invite:      { zh:'邀请赚U',         en:'Invite U',            ru:'Инвайт U' },
  quick_settings:    { zh:'设置',            en:'Settings',            ru:'Настр.' },
  // 底部 Dock：每日签到 + 推特赚金
  twitter_btn:       { zh:'推特赚金',        en:'X Earn',               ru:'X Доход' },
  twitter_sub:       { zh:'X / Share',       en:'X / Share',            ru:'X / Share' },
  daily_checkin:     { zh:'🎯 每日签到',     en:'🎯 Check-in',          ru:'🎯 Чек-ин' },
  // 个人中心操作按钮
  profile_wallet:    { zh:'连接 TON 钱包',   en:'Connect TON',          ru:'TON-кошелек' },
  profile_claim:     { zh:'Claim / 提现',    en:'Claim',                ru:'Вывод' },
  profile_settings:  { zh:'游戏设置',        en:'Settings',             ru:'Настройки' },
  // 合规广告二次确认弹窗
  confirm_cancel:    { zh:'取消',            en:'Cancel',               ru:'Отмена' },
  confirm_ok:        { zh:'▶ 观看视频',      en:'▶ Watch',              ru:'▶ Смотреть' },
  confirm_newbie_t:  { zh:'📺 观看 1 次赞助广告即可解锁', en:'📺 Watch 1 ad to unlock', ru:'📺 1 реклама → разблокировка' },
  confirm_newbie_d:  { zh:'解锁 35 级皇冠猫', en:'Unlock LV.35 crown cat', ru:'Кот LV.35' },
  confirm_airdrop_t: { zh:'📺 观看视频立即开启大量金币', en:'📺 Watch video for coins', ru:'📺 Видео → монеты' },
  confirm_airdrop_d: { zh:'开启补给箱，获得金币奖励', en:'Open crate for coins', ru:'Откройте ящик → монеты' },
  poster_title:      { zh:'生成海报',         en:'Poster',               ru:'Постер' },
  poster_share:      { zh:'分享 X',           en:'Share X',              ru:'Поделиться X' },
  style_cyberpunk:   { zh:'赛博朋克',        en:'Cyber',                ru:'Кибер' },
  style_dreamland:   { zh:'梦幻乐园',        en:'Dream',                ru:'Мечта' },
  style_cute:        { zh:'超萌',            en:'Cute',                 ru:'Милота' },
  t_need_wallet:    { zh:'请先连接 TON 钱包', en:'Connect TON wallet first', ru:'Сначала подключите TON-кошелек' },
  t_need_10usdt:    { zh:'USD₮ 余额需达到 10 才可提现', en:'Need ≥10 USD₮ to withdraw', ru:'Нужно ≥10 USD₮' },
  // 倒计时单位
  time_day:        { zh:'天', en:'d', ru:'д' },
  time_hour:       { zh:'时', en:'h', ru:'ч' },
  time_minute:     { zh:'分', en:'m', ru:'м' },
  time_second:     { zh:'秒', en:'s', ru:'с' },
  // 底部按钮
  ad_text:         { zh:'广告加速',           en:'Ad Boost',              ru:'Реклама-буст' },
  task_title:      { zh:'每日任务',           en:'Task',                    ru:'Задания' },
  task_sub:        { zh:'Task / Earn',        en:'Task / Earn',            ru:'Задания / Доход' },
  buy_label:       { zh:'买 LV.',             en:'Buy LV.',               ru:'Купить LV.' },
  shop_locked:     { zh:'🛑 35级封顶',        en:'🛑 35 cap',             ru:'🛑 35 макс.' },
  btn_ai:          { zh:'合成',               en:'AI',                    ru:'AI' },
  btn_twitter:     { zh:'X赚',                en:'X',                     ru:'X' },
  btn_buy:         { zh:'买猫',               en:'Buy',                   ru:'Купить' },
  btn_pokedex:     { zh:'图鉴',               en:'Pedia',                 ru:'Сбор' },
  btn_profile:     { zh:'我的',               en:'Me',                    ru:'Я' },
  pokedex_btn:     { zh:'猫咪图鉴',           en:'Pedia',                   ru:'Сбор' },
  pokedex_count:   { zh:'已收集',             en:'Collected',              ru:'Собрано' },
  pokedex_unit:    { zh:'只猫咪',             en:'cats',                   ru:'котов' },
  // 离线收益弹窗
  offline_title:   { zh:'🎁 离线收益',        en:'🎁 Offline Earnings',  ru:'🎁 Офлайн-доход' },
  offline_desc:    { zh:'你离开期间累计产出', en:'Earned while you were away', ru:'Заработано за время офлайн' },
  offline_tip:     { zh:'记得每天签到，离线也会继续产出哦', en:'Check in daily to keep earning offline', ru:'Заходите ежедневно, чтобы зарабатывать офлайн' },
  offline_claim:   { zh:'领取',              en:'Claim',                ru:'Получить' },
  // 设置面板
  settings_title:  { zh:'⚙️ 系统设置 Settings', en:'⚙️ Settings',         ru:'⚙️ Настройки' },
  music_label:     { zh:'🎵 背景音乐',         en:'🎵 Music',              ru:'🎵 Музыка' },
  sfx_label:       { zh:'🔔 游戏音效',         en:'🔔 SFX',                ru:'🔔 Звук' },
  lang_label:      { zh:'🌍 语言 Language',    en:'🌍 Language',            ru:'🌍 Язык' },
  rules_label:     { zh:'📖 游戏规则',         en:'📖 Rules',              ru:'📖 Правила' },
  rules_text: {
    zh: '• 拖动相同等级的猫咪可合成更高一级<br>• 商店购买猫咪消耗金币，每次购买全场物价+7%<br>• 看广告可加速产出并免费领猫咪<br>• 签到合成后自动运行并离线产出（每日免费开启）<br>• 邀请好友 + 完成任务墙赚额外金币<br>• 链接 TON 钱包后可提现鱼池收益',
    en: '• Drag same-level cats to merge into a higher level<br>• Buying cats costs coins; each purchase raises all prices by 7%<br>• Watch ads to boost output and get free cats<br>• Auto Merge + offline earnings run after daily check-in<br>• Invite friends + complete tasks to earn extra coins<br>• Connect TON wallet to withdraw pool earnings',
    ru: '• Перетаскивайте котов одного уровня, чтобы объединить их<br>• Покупка котов стоит монеты; каждая покупка повышает все цены на 7%<br>• Смотрите рекламу для ускорения и бесплатных котов<br>• Автослияние и офлайн-доход после ежедневного чек-ина<br>• Приглашайте друзей + выполняйте задания для бонусов<br>• Подключите TON-кошелек для вывода из пула'
  },
  version:         { zh:'v1.0.0 · CyberMerge', en:'v1.0.0 · CyberMerge',  ru:'v1.0.0 · CyberMerge' },
  // 个人中心
  profile_title:   { zh:'👤 个人中心',         en:'👤 Profile',             ru:'👤 Профиль' },
  profile_coins:   { zh:'总金币',              en:'Coins',                 ru:'Монеты' },
  profile_earn:    { zh:'每秒产出',            en:'Earn / sec',            ru:'Доход / сек' },
  profile_invite:  { zh:'邀请人数',            en:'Invites',               ru:'Инвайты' },
  profile_weekad:  { zh:'本周贡献',            en:'Contrib / wk',          ru:'Вклад / нед.' },
  profile_divcats: { zh:'40级猫分红',          en:'LV.40 Div.',            ru:'Див. LV.40' },
  profile_ref:     { zh:'邀请码',              en:'Code',                  ru:'Код' },
  profile_copy:    { zh:'复制邀请码',          en:'Copy',                  ru:'Копировать' },
  profile_copied:  { zh:'✅ 邀请码已复制',     en:'✅ Copied',             ru:'✅ Скопировано' },
  // toast
  t_music_on:      { zh:'🎵 背景音乐已开启',   en:'🎵 Background music ON',  ru:'🎵 Фоновая музыка ВКЛ' },
  t_music_off:     { zh:'🎵 背景音乐已关闭',   en:'🎵 Background music OFF', ru:'🎵 Фоновая музыка ВЫКЛ' },
  t_sfx_on:        { zh:'🔔 游戏音效已开启',   en:'🔔 Sound effects ON',    ru:'🔊 Звуковые эффекты ВКЛ' },
  t_sfx_off:       { zh:'🔔 游戏音效已关闭',   en:'🔔 Sound effects OFF',   ru:'🔊 Звуковые эффекты ВЫКЛ' },
  // 已连接/未连接钱包 toast
  t_wallet_linked:  { zh:'钱包已链接：',       en:'Wallet linked: ',        ru:'Кошелек подключен: ' },
  t_detecting:      { zh:'🔍 正在识别 TON 钱包...', en:'🔍 Detecting TON wallet...', ru:'🔍 Поиск TON-кошелька...' },
  t_wallet_ok:      { zh:'✅ 钱包已链接：',     en:'✅ Wallet linked: ',     ru:'✅ Кошелек подключен: ' },
  t_no_wallet:      { zh:'⚠️ 未检测到 TON 钱包，请安装 Tonkeeper 后重试', en:'⚠️ No TON wallet. Install Tonkeeper.', ru:'⚠️ Нет TON-кошелька. Установите Tonkeeper.' },
  // 通用/广告/合成/购买/任务/邀请 toast（补齐三语，替换原硬编码中文）
  t_ai_daily_reset: { zh:'⏰ 新的一天到啦~签到合成已关闭', en:'⏰ New day! Auto merge turned off', ru:'⏰ Новый день! Автослияние выключено' },
  t_ai_checkin_ok:  { zh:'✅ 签到成功！智能合成已开启', en:'✅ Checked in! Auto merge ON', ru:'✅ Чек-ин выполнен! Автослияние ВКЛ' },
  t_ad_limit:       { zh:'今日广告次数已用完，明天再来~', en:'Daily ad limit reached~', ru:'Дневной лимит рекламы~' },
  t_ad_limit_accel: { zh:'今日加速次数已用完，明日再来~', en:'Daily boost limit reached~', ru:'Дневной лимит буста~' },
  t_grid_full:      { zh:'猫窝满啦！先合一下腾位~', en:'Nest is full! Merge first to make room~', ru:'Гнездо заполнено! Сначала объедините~' },
  t_grid_full_buy:  { zh:'猫窝满啦！合一下腾位~', en:'Nest is full! Merge to make room~', ru:'Гнездо заполнено! Объедините~' },
  t_recycle_fail:   { zh:'回收失败，请重试', en:'Recycle failed, retry', ru:'Переработка не удалась' },
  t_newbie_done:    { zh:'新人猫已领取', en:'Newbie cat claimed', ru:'Кот новичка получен' },
  t_ad_not_loaded:  { zh:'广告系统未加载，请稍后再试', en:'Ad not ready, retry later', ru:'Реклама не готова' },
  t_ad_load_failed: { zh:'广告加载失败，请稍后再试', en:'Ad failed, retry later', ru:'Реклама не загрузилась' },
  t_ad_not_finished:{ zh:'广告未看完，无法获得奖励', en:'Ad not finished, no reward', ru:'Реклама не досмотрена, награды нет' },
  t_no_coins:       { zh:'❤ 金币不足！还需 {price} 金', en:'❤ Need {price} coins', ru:'❤ Нужно {price} монет' },
  t_buy_fail:       { zh:'购买失败，请重试', en:'Purchase failed, try again', ru:'Покупка не удалась, попробуйте снова' },
  t_got_cat:        { zh:'获得 {name} LV.{lv}（下次涨价 7%）', en:'Got {name} LV.{lv} (next price +7%)', ru:'Получен {name} LV.{lv} (следующая цена +7%)' },
  t_accel_success:  { zh:'⚡ 加速成功！获得 {name} LV.{lv}', en:'⚡ Boost success! Got {name} LV.{lv}', ru:'⚡ Буст успешен! Получен {name} LV.{lv}' },
  t_task_done:      { zh:'{icon} 任务完成！获得 {coins} 金币', en:'{icon} Task done! Got {coins} coins', ru:'{icon} Задание выполнено! Получено {coins} монет' },
  t_wrong_type:     { zh:'品种不同，不能合体哦', en:'Different breeds cannot merge', ru:'Разные породы нельзя объединять' },
  t_max_level:      { zh:'满级猫咪无法继续合成', en:'Max level cat cannot merge', ru:'Кот макс. уровня не объединяется' },
  t_merge_success:  { zh:'🎉 合体！{name} LV.{lv}', en:'🎉 Merged! {name} LV.{lv}', ru:'🎉 Объединение! {name} LV.{lv}' },
  t_merge_crit:     { zh:'💥 暴击！直接升级 {name} LV.{lv}', en:'💥 Crit! Upgraded to {name} LV.{lv}', ru:'💥 Крит! {name} LV.{lv}' },
  t_merge_coin:     { zh:'💰 合成奖励 +{coins} 金币', en:'💰 Merge bonus +{coins} coins', ru:'💰 Бонус +{coins} монет' },
  broadcast_msg:    { zh:'🎉 {name} 合成暴击！额外 +{extra} 级 → LV.{lv}', en:'🎉 {name} CRIT! +{extra} → LV.{lv}', ru:'🎉 {name} крит! +{extra} → LV.{lv}' },
  t_invite_copied:  { zh:'📋 邀请链接已复制！去 Telegram 粘贴给好友吧~', en:'📋 Link copied! Share to friends~', ru:'📋 Ссылка скопирована!' },
  t_invite_link:    { zh:'🔗 邀请链接：', en:'🔗 Invite link: ', ru:'🔗 Ссылка: ' },
  t_coin_soon:      { zh:'暗币系统即将开放！', en:'Dark coin soon!', ru:'Тёмные монеты скоро!' },
  t_task_done_label:{ zh:'✅ 已完成', en:'✅ Done', ru:'✅ Готово' },
  t_task_claim:     { zh:'▶ 领取', en:'▶ Claim', ru:'▶ Получить' },
  t_locked:         { zh:'未解锁', en:'Locked', ru:'Заблокировано' },
  t_share_text:     { zh:'快来 CyberMerge 合成猫咪，瓜分大奖池！🐱💰', en:'Come to CyberMerge, merge cats and win the big pool! 🐱💰', ru:'Заходи в CyberMerge, объединяй котов и выигрывай призы! 🐱💰' },
  // 每日任务描述
  task_desc_1:      { zh:'接任务领 10000 金币', en:'Task +10000 coins', ru:'Задание +10000' },
};

// 当前语言（默认中文，可被 localStorage 覆盖）
let _lang = 'zh';
try { _lang = localStorage.getItem('cybermerge_lang') || 'zh'; } catch(_) {}

// 翻译函数：t('invite_text') → 返回当前语言对应字符串
function t(key) {
  const e = I18N[key];
  if (!e) return key;
  return e[_lang] || e.zh || key;
}

// 应用 i18n：遍历所有 [data-i18n] 元素替换 textContent / innerHTML
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (el.hasAttribute('data-i18n-html')) el.innerHTML = val;
    else el.textContent = val;
  });
  // 智能合成按钮文案（JS 动态设的）
  if (typeof updateAiBtn === 'function') updateAiBtn();
  // 赛季天梯文案（JS 动态设的：赛季编号 / 标题 / 倒计时）
  if (typeof updateSeasonUI === 'function') updateSeasonUI();
}

// ═══════ 常量 ═══════
const GRID_SIZE = 4;
const TOTAL = 16;
const MAX_LV = 40;
const MERGE_NEED = 2;            // 2 只同级合 1 只（经典合成）
const AD_BASE_LIMIT = 15;         // 每人每天基础广告次数
const AD_INVITE_BONUS_MAX = 5;    // 邀请加成上限（每邀请1人+1，最多+5 → 封顶20）

// ═══════ 云存档 / 防作弊常量 ═══════
const SECRET_SALT = 'CYBER_CAT_SECRET_2026';      // 前后端共同约定的签名盐
const CLOUD_SYNC_MS = 2 * 60 * 1000;              // 距上次云同步超过 2 分钟才同步
const LOCAL_SAVE_KEY = 'cybermerge_local_save';   // 本地实时存档 key
const AUTH_ENDPOINT = '/auth';                    // 后端端点：Cloudflare Pages Functions 用 /auth；Netlify 用 /.netlify/functions/auth

// ═══════ 自付 Gas 提现常量 ═══════
const TREASURY_WALLET = 'UQBUMHoFdQ_PIGY_aart2kYeutngALLxxiwr14yrrM1S7uDZ';  // 项目方金库地址
const WITHDRAW_GAS_FEE_MIN = 0.13;              // 手续费下限 0.13 GRAM
const WITHDRAW_GAS_FEE_MAX = 0.15;              // 手续费上限 0.15 GRAM
// 随机手续费 0.13~0.15 GRAM → nanoTON（1 GRAM = 1e9 nanoTON）
function randomGasFeeNano() {
  const fee = WITHDRAW_GAS_FEE_MIN + Math.random() * (WITHDRAW_GAS_FEE_MAX - WITHDRAW_GAS_FEE_MIN);
  return String(Math.round(fee * 1e9));
}
const WITHDRAW_MIN_USDT = 10;                  // 最低可提现 internal_usdt

// ═══════ 数值模型（防刷铁律：价格由后端 buy_cat RPC 定价，前端不算价）═══════
const EARN_BASE = 1;              // LV.1 基础算力 1/秒
const EARN_RATIO = 1.8;          // 算力跨级倍率（严格 < 2，确保 1+1 < 2）
const BUY_LV_GAP = 1;            // 可购最高等级 = maxUnlocked - 1
const AD_LV_GAP = 5;             // 广告领取等级 = maxUnlocked - 5
const SHOP_MAX_LV = 34;          // 商店最高可买 34 级（35级以上全靠合成/回收站变现）

// 第 n 级猫的每秒产出算力 P_n = 1 × 1.8^(n-1)；40级满级猫不再产币（只等分红/回收）
function lvEarnPerSec(lv) {
  if (lv >= MAX_LV) return 0;
  return EARN_BASE * Math.pow(EARN_RATIO, lv - 1);
}

// 场上猫咪每秒总产出（不含堆叠）
function totalEarnPerSec() {
  let sum = 0;
  for (let i = 0; i < TOTAL; i++) {
    const lv = S.grid[i];
    if (lv) sum += lvEarnPerSec(lv);
  }
  return sum;
}

// 计算一个 grid 数组的总算力分值（云端/本地存档合并时，选分值更高的一方，避免丢猫）
function gridScore(grid) {
  if (!Array.isArray(grid)) return 0;
  let s = 0;
  for (let i = 0; i < TOTAL; i++) {
    const lv = grid[i];
    if (typeof lv === 'number' && lv >= 1 && lv <= MAX_LV) {
      // 40级虽不产币，但作为最终资产分值最高，避免合并存档时丢猫
      s += (lv === MAX_LV) ? (EARN_BASE * Math.pow(EARN_RATIO, MAX_LV - 1)) : lvEarnPerSec(lv);
    }
  }
  return s;
}

// 历史最高解锁等级（基于已收集图鉴）
function maxUnlockedLv() {
  let max = 1;
  collected.forEach(l => { if (l > max) max = l; });
  return max;
}

// 商店可购买最高等级 = min(maxUnlocked - 1, 34)，最低 1
function shopMaxLv() {
  return Math.max(1, Math.min(maxUnlockedLv() - BUY_LV_GAP, SHOP_MAX_LV));
}

// 广告可领取等级 = maxUnlocked - 5，最低 2
function adRewardLv() {
  return Math.max(2, maxUnlockedLv() - AD_LV_GAP);
}

// 商店出售等级：先补买场上最低等级（低于目标时）往上合，打平后再买目标级
function buyLevel() {
  const targetLv = shopMaxLv();
  let minLv = null;
  for (let i = 0; i < TOTAL; i++) {
    const lv = S.grid[i];
    if (lv && (minLv === null || lv < minLv)) minLv = lv;
  }
  if (minLv !== null && minLv < targetLv) return minLv;
  return targetLv;
}

// 商店永不锁死：始终可按 shopMaxLv() 购买，保证 35 级后仍能买 32/33/34 级继续合成升级
function shopLocked() {
  return false;
}
// 16 格是否全满（无空格）
function isGridFull() {
  for (let i = 0; i < TOTAL; i++) {
    if (S.grid[i] === null) return false;
  }
  return true;
}

// ═══════ 大数字格式化：K / M / B / T / Qa / Qi ═══════
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
function fmtNum(n) {
  if (n === 0) return '0';
  if (n < 0) return '-' + fmtNum(-n);
  if (n < 1) return n.toFixed(2);
  if (n < 1000) return Math.floor(n).toString();
  let tier = Math.floor(Math.log10(n) / 3);  // 1=K 2=M 3=B ...
  if (tier >= SUFFIXES.length) tier = SUFFIXES.length - 1;
  const scaled = n / Math.pow(1000, tier);
  const suf = SUFFIXES[tier];
  // 1.23K / 12.3K / 123K
  if (scaled >= 100) return scaled.toFixed(0) + suf;
  if (scaled >= 10) return scaled.toFixed(1) + suf;
  return scaled.toFixed(2) + suf;
}

// ═══════ 美金固定位：整数9位前导零 + 小数3位（000000000.000）
function fmtUsdFixed(amount) {
  const val = Math.max(0, Math.min(999999999.999, Number(amount) || 0));
  const intPart = Math.floor(val);
  const decPart = val - intPart;
  const intStr = String(intPart).padStart(9, '0');
  const decStr = decPart.toFixed(3).slice(-3);
  return intStr + '.' + decStr;
}

// ═══════ 老虎机滚轮渲染：9位整数前导零半透明，非零高亮发光
//   输出 HTML：<span class="digit zero">0</span>...<span class="digit bright">5</span>...<span class="dot">.</span>...<span class="sym">$</span>
//   - 前导零（第一个非零数字之前的所有 0）→ .zero 半透明
//   - 非零数字 → .bright 高亮发光
//   - 小数部分 3 位 → 始终 .bright 高亮（有效数字）
let _lastTimerHtml = '';
function renderTimerNum(amount) {
  const raw = fmtUsdFixed(amount);           // "000005012.790"
  const intPart = raw.slice(0, 9);           // "000005012"
  const decPart = raw.slice(10, 13);         // "790"
  // 找第一个非零位置（前导零截止点）
  let firstNonZero = intPart.length;
  for (let i = 0; i < intPart.length; i++) {
    if (intPart[i] !== '0') { firstNonZero = i; break; }
  }
  // 整数部分每位拆 span
  let html = '';
  for (let i = 0; i < intPart.length; i++) {
    const ch = intPart[i];
    const isLeadingZero = i < firstNonZero;
    html += '<span class="digit ' + (isLeadingZero ? 'zero' : 'bright') + '">' + ch + '</span>';
  }
  // 小数点 + 小数部分（始终高亮）
  html += '<span class="dot">.</span>';
  for (let i = 0; i < decPart.length; i++) {
    html += '<span class="digit bright">' + decPart[i] + '</span>';
  }
  // 美金符号
  html += '<span class="sym"> $</span>';
  return html;
}

// ═══════ 外接显示接口：外部调用 setTimerNum(amount) 更新心心数字（老虎机滚轮翻页）
//   用法：window.setTimerNum(501.279) 或 console 调用
//   只有数值变化才会触发翻页动画，不动则不闪
function setTimerNum(amount) {
  const numEl = document.getElementById('timer-num');
  if (!numEl) return;
  const newHtml = renderTimerNum(amount);
  if (newHtml !== _lastTimerHtml) {
    numEl.innerHTML = newHtml;
    _lastTimerHtml = newHtml;
  }
}
// 暴露到 window，方便外接/控制台调用
window.setTimerNum = setTimerNum;

// ═══════ 40 级真实猫咪图鉴 ═══════
const CATS = [
  null,
  { img:'/cats_new/LV.1.png',  name:'小奶猫' },
  { img:'/cats_new/LV.2.png',  name:'狸花猫' },
  { img:'/cats_new/LV.3.png',  name:'橘猫' },
  { img:'/cats_new/LV.4.png',  name:'三花猫' },
  { img:'/cats_new/LV.5.png',  name:'奶牛猫' },
  { img:'/cats_new/LV.6.png',  name:'黑猫' },
  { img:'/cats_new/LV.7.png',  name:'白猫' },
  { img:'/cats_new/LV.8.png',  name:'暹罗猫' },
  { img:'/cats_new/LV.9.png',  name:'波斯猫' },
  { img:'/cats_new/LV.10.png', name:'英短猫' },
  { img:'/cats_new/LV.11.png', name:'美短猫' },
  { img:'/cats_new/LV.12.png', name:'布偶猫' },
  { img:'/cats_new/LV.13.png', name:'金吉拉' },
  { img:'/cats_new/LV.14.png', name:'蓝猫' },
  { img:'/cats_new/LV.15.png', name:'银渐层' },
  { img:'/cats_new/LV.16.png', name:'金渐层' },
  { img:'/cats_new/LV.17.png', name:'起司猫' },
  { img:'/cats_new/LV.18.png', name:'矮脚猫' },
  { img:'/cats_new/LV.19.png', name:'卷耳猫' },
  { img:'/cats_new/LV.20.png', name:'折耳猫' },
  { img:'/cats_new/LV.21.png', name:'缅因猫' },
  { img:'/cats_new/LV.22.png', name:'挪威森林' },
  { img:'/cats_new/LV.23.png', name:'西伯利亚' },
  { img:'/cats_new/LV.24.png', name:'阿比猫' },
  { img:'/cats_new/LV.25.png', name:'索马里' },
  { img:'/cats_new/LV.26.png', name:'东方短毛' },
  { img:'/cats_new/LV.27.png', name:'柯尼斯' },
  { img:'/cats_new/LV.28.png', name:'德文卷' },
  { img:'/cats_new/LV.29.png', name:'塞尔凯克' },
  { img:'/cats_new/LV.30.png', name:'孟买豹猫' },
  { img:'/cats_new/LV.31.png', name:'埃及猫' },
  { img:'/cats_new/LV.32.png', name:'新加坡猫' },
  { img:'/cats_new/LV.33.png', name:'日本短尾' },
  { img:'/cats_new/LV.34.png', name:'巴厘猫' },
  { img:'/cats_new/LV.35.png', name:'爪哇猫' },
  { img:'/cats_new/LV.36.png', name:'拉邦猫' },
  { img:'/cats_new/LV.37.png', name:'波米拉' },
  { img:'/cats_new/LV.38.png', name:'曼基康' },
  { img:'/cats_new/LV.39.png', name:'拿破仑' },
  { img:'/cats_new/LV.40.png', name:'招财神猫' },
];

// ═══════ 猫咪名称三语（catName() 按当前语言返回，缺省回退中文）═══════
const CAT_NAMES = {
  1:  { zh:'小奶猫',   en:'Kitten',            ru:'Котёнок' },
  2:  { zh:'狸花猫',   en:'Tabby Cat',         ru:'Табби' },
  3:  { zh:'橘猫',     en:'Orange Cat',        ru:'Рыжий кот' },
  4:  { zh:'三花猫',   en:'Calico Cat',        ru:'Трёхцветная' },
  5:  { zh:'奶牛猫',   en:'Cow Cat',           ru:'Коровка' },
  6:  { zh:'黑猫',     en:'Black Cat',         ru:'Чёрный кот' },
  7:  { zh:'白猫',     en:'White Cat',         ru:'Белый кот' },
  8:  { zh:'暹罗猫',   en:'Siamese',           ru:'Сиамская' },
  9:  { zh:'波斯猫',   en:'Persian',           ru:'Персидская' },
  10: { zh:'英短猫',   en:'British Shorthair', ru:'Британская' },
  11: { zh:'美短猫',   en:'American Shorthair',ru:'Американская' },
  12: { zh:'布偶猫',   en:'Ragdoll',           ru:'Рэгдолл' },
  13: { zh:'金吉拉',   en:'Chinchilla',        ru:'Шиншилла' },
  14: { zh:'蓝猫',     en:'Blue Cat',          ru:'Русская голубая' },
  15: { zh:'银渐层',   en:'Silver Shaded',     ru:'Серебристый' },
  16: { zh:'金渐层',   en:'Golden Shaded',     ru:'Золотистый' },
  17: { zh:'起司猫',   en:'Cheese Cat',        ru:'Сырный кот' },
  18: { zh:'矮脚猫',   en:'Munchkin',          ru:'Манчкин' },
  19: { zh:'卷耳猫',   en:'American Curl',     ru:'Американский кёрл' },
  20: { zh:'折耳猫',   en:'Scottish Fold',     ru:'Шотландская' },
  21: { zh:'缅因猫',   en:'Maine Coon',        ru:'Мейн-кун' },
  22: { zh:'挪威森林', en:'Norwegian Forest',  ru:'Норвежская лесная' },
  23: { zh:'西伯利亚', en:'Siberian',          ru:'Сибирская' },
  24: { zh:'阿比猫',   en:'Abyssinian',        ru:'Абиссинская' },
  25: { zh:'索马里',   en:'Somali',            ru:'Сомали' },
  26: { zh:'东方短毛', en:'Oriental Shorthair',ru:'Ориентальная' },
  27: { zh:'柯尼斯',   en:'Cornish Rex',       ru:'Корниш-рекс' },
  28: { zh:'德文卷',   en:'Devon Rex',         ru:'Девон-рекс' },
  29: { zh:'塞尔凯克', en:'Selkirk Rex',       ru:'Селкирк-рекс' },
  30: { zh:'孟买豹猫', en:'Bombay',            ru:'Бомбейская' },
  31: { zh:'埃及猫',   en:'Egyptian Mau',      ru:'Египетский мау' },
  32: { zh:'新加坡猫', en:'Singapura',         ru:'Сингапура' },
  33: { zh:'日本短尾', en:'Japanese Bobtail',  ru:'Японский бобтейл' },
  34: { zh:'巴厘猫',   en:'Balinese',          ru:'Балинезийская' },
  35: { zh:'爪哇猫',   en:'Javanese',          ru:'Яванская' },
  36: { zh:'拉邦猫',   en:'LaPerm',            ru:'Ла-перм' },
  37: { zh:'波米拉',   en:'Burmilla',          ru:'Бурмилла' },
  38: { zh:'曼基康',   en:'Munchkin',          ru:'Манчкин' },
  39: { zh:'拿破仑',   en:'Napoleon',          ru:'Наполеон' },
  40: { zh:'招财神猫', en:'Lucky Cat',         ru:'Кот удачи' },
};
function catName(lv) {
  const e = CAT_NAMES[lv];
  if (!e) return 'LV.' + lv;
  return e[_lang] || e.zh;
}

// ═══════ 状态 ═══════
const S = {
  grid: new Array(TOTAL).fill(null),  // grid[i] = null 或 lv 整数
  usdt: 1000,                         // 总金币（= 自有金币 + 服务端 bonusCoins）
  username: '',                       // 玩家昵称（后端返回）
  bonusCoins: 0,                      // 服务端发放的奖励（邀请奖励 + 离线产出），前端不直接修改
  buyCount: 0,                        // 历史总购买次数
  inflateCount: 0,                    // 累计通胀次数（每天前5次免费，之后每次+3%）
  adUsedToday: 0,                     // 今日已用广告次数
  aiRunning: false,                   // 智能合成是否运行中
  aiTimer: null,                      // 智能合成循环定时器
  aiLock: false,                      // 互斥锁：防本次 tick 未跑完就重入
  inviteCount: 0,                     // 邀请好友次数（云存档）
  refCode: '',                        // 我的随机邀请码（后端生成，用于邀请链接，隐藏 TG ID）
  divCats: [],                        // 场上40级猫的剩余分红次数数组 [4,3,2]
  weekAdCount: 0,                     // 本周看广告次数（后端统计，用于分红贡献）
  internalUsdt: 0,                    // 内部美金余额（后端 RPC 结算）
  adContribution: 0,                  // 广告贡献度（后端累计看广告数，HUD 展示）
  newbieCatClaimed: false,            // 新人35级猫是否已领取
  newbieAdStage: 0,                   // 新人解锁广告进度：0=99% / 1=99.5% / 2=99.7%
  boostAdUsed: 0,                     // 加速收益广告今日已用次数
  boostAdDay: '',                     // 加速收益广告所属日期
};
const AI_KEY = 'cybermerge_ai_unlock_day';  // 存最后一次签到解锁智能合成的日期 "YYYY-MM-DD"
const AI_EXPIRE_KEY = 'cybermerge_ai_expire';  // 存本次 AI 解锁的到期时间戳（毫秒）
const AI_LIMIT_MS = 15 * 60 * 1000;            // 单次智能合成限时 15 分钟
const AD_DAY_KEY = 'cybermerge_ad_day';     // 存最后一天广告计数所属日期 "YYYY-MM-DD"（跨天归零）
const AI_TICK_MS = 800;                     // AI 循环周期（毫秒）：进一步降频，缓解 TG 移动端主线程过载
// ═══════ Monetag 激励弹窗广告（统一 zone：11583087，通过 show_11583087('pop') 触发）═══════

// ═══════ 每日任务：1 个任务 + 金币奖励（看 Monetag 弹窗广告）═══════
const DAILY_TASKS = [
  { key: 'task-watch-ad', icon: '📺', descKey: 'task_desc_1', coins: 10000 },
];
const TASK_DONE_KEY = 'cybermerge_daily_tasks';  // 存 { date, done: [taskKey] }，每日重置

// ═══════ TON 钱包状态：自动识别已绑定钱包地址 ═══════
const WALLET_KEY = 'cybermerge_ton_wallet';   // localStorage 缓存绑定地址
const wallet = { address: null, provider: null };

function loadWallet() {
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && obj.address) {
        wallet.address = obj.address;
        wallet.provider = obj.provider || 'unknown';
      }
    }
  } catch(_) {}
}
function saveWallet(addr, provider) {
  wallet.address = addr;
  wallet.provider = provider || 'unknown';
  try { localStorage.setItem(WALLET_KEY, JSON.stringify({ address: addr, provider })); } catch(_) {}
}
function clearWallet() {
  wallet.address = null;
  wallet.provider = null;
  try { localStorage.removeItem(WALLET_KEY); } catch(_) {}
}
// TON 钱包地址缩写：EQAB...XYZ4 格式（前4 + ... + 后4）
function shortAddr(addr) {
  if (!addr || addr.length < 10) return addr || '';
  return addr.slice(0, 4) + '...' + addr.slice(-4);
}
// ═══════ TON Connect 钱包连接 ═══════
let tonConnectUI = null;
let _walletRestoring = true;
let _toFriendly = null;

async function initTonConnect() {
  try {
    // 动态引入 @tonconnect/ui：只在需要时加载，避免拖慢首屏（减小初始 bundle）
    const { TonConnectUI, toUserFriendlyAddress } = await import('@tonconnect/ui');
    _toFriendly = toUserFriendlyAddress;
    tonConnectUI = new TonConnectUI({
      manifestUrl: window.location.origin + '/tonconnect-manifest.json',
      restoreConnection: true,
    });
    // 锁定 TON 主网（chain id -239），避免误连测试网
    tonConnectUI.setConnectionNetwork('-239');
    tonConnectUI.connectionRestored.then(() => { _walletRestoring = false; }).catch(() => { _walletRestoring = false; });
    tonConnectUI.onStatusChange(w => {
      if (w && w.account) {
        const friendly = _toFriendly(w.account.address);
        saveWallet(friendly, w.device?.appName || 'tonconnect');
        if (!_walletRestoring) {
          toast(t('t_wallet_ok') + shortAddr(friendly), 'success');
        }
      } else {
        clearWallet();
      }
    });
  } catch(e) {
    console.error('TonConnect init failed:', e);
  }
}

// 链接钱包：打开 TON Connect 弹窗（用户选钱包授权后，onStatusChange 自动保存地址）
async function connectWallet() {
  // 只有真实连接（tonConnectUI.connected）且有地址才提示已连接；否则拉钱包弹窗
  if (tonConnectUI && tonConnectUI.connected && wallet.address) {
    toast(t('t_wallet_linked') + shortAddr(wallet.address), 'info');
    return;
  }
  if (!tonConnectUI) {
    toast('钱包加载中，请稍后再试', 'warn');
    return;
  }
  try {
    await tonConnectUI.openModal();
  } catch(_) {
    toast(t('t_no_wallet'), 'info');
  }
}

// ═══════ 自付 Gas 提现 ═══════
// 构造 TON 文本备注 payload（Comment Cell），后端据此核对 user_id
async function buildCommentPayload(comment) {
  const { beginCell } = await import('@ton/core');
  const cell = beginCell().storeUint(0, 32).storeStringTail(comment).endCell();
  return cell.toBoc().toString('base64');
}

// 将 BOC 转为真实交易 hash（TonAPI 按 hash 查链，不能用 BOC 直接查）
async function bocToHash(boc) {
  try {
    const { Cell } = await import('@ton/core');
    const bytes = Uint8Array.from(atob(boc), c => c.charCodeAt(0));
    const cell = Cell.fromBoc(bytes)[0];
    const h = cell.hash();
    return Array.from(h).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (_) {
    return boc;   // 解析失败兜底返回原值
  }
}

function showWithdrawLoading() {
  document.getElementById('withdraw-loading')?.classList.add('show');
}
function hideWithdrawLoading() {
  document.getElementById('withdraw-loading')?.classList.remove('show');
}
function startMoneyRain() {
  const layer = document.getElementById('money-rain');
  if (!layer) return;
  layer.innerHTML = '';
  const bills = ['💵', '💸', '💰'];
  for (let i = 0; i < 24; i++) {
    const b = document.createElement('span');
    b.className = 'money-bill';
    b.textContent = bills[Math.floor(Math.random() * bills.length)];
    b.style.left = (Math.random() * 100) + '%';
    b.style.animationDuration = (1.6 + Math.random() * 2) + 's';
    b.style.animationDelay = (Math.random() * 0.8) + 's';
    b.style.fontSize = (20 + Math.random() * 18) + 'px';
    layer.appendChild(b);
  }
  setTimeout(() => { layer.innerHTML = ''; }, 4000);
}

async function doWithdraw() {
  if (!tonConnectUI) { toast('钱包加载中，请稍后再试', 'warn'); return; }
  // 钱包连接还在恢复中，先等一会儿（否则 sendTransaction 会直接失败）
  if (_walletRestoring) { toast('钱包连接恢复中，请稍候再试', 'info'); return; }
  // 用 tonConnectUI.connected 判断真实连接状态（wallet.address 只是本地缓存，可能和实际不同步）
  if (!tonConnectUI.connected || !wallet.address) { connectWallet(); return; }
  // 再检查 USD 余额门槛
  const usdtAmount = Number(S.internalUsdt) || 0;
  if (usdtAmount < WITHDRAW_MIN_USDT) { toast(t('t_need_10usdt'), 'warn'); return; }

  try {
    const payload = await buildCommentPayload(String(getTgId()));
    const tx = {
      validUntil: Date.now() + 5 * 60 * 1000,
      messages: [{
        address: TREASURY_WALLET,
        amount: randomGasFeeNano(),
        payload,
      }],
    };
    const result = await tonConnectUI.sendTransaction(tx);
    const boc = result?.boc || '';
    if (!boc) { toast('未获取到交易凭证，请重试', 'warn'); return; }
    const hash = await bocToHash(boc);

    // 等待状态：链上确认中，USDT 自动打款准备中...
    showWithdrawLoading();
    const r = await callRpc('request_withdraw', {
      usdt_amount: usdtAmount,
      boc_or_hash: hash,
      receive_address: wallet.address,
    });
    hideWithdrawLoading();

    if (r && r.ok) {
      S.internalUsdt = 0;   // 前端先归零，最终以数据库为准
      ui();
      renderProfile();
      startMoneyRain();
      toast('提现成功，USDT 已发送至您的钱包！', 'success');
      saveLocal();
    } else {
      toast(r?.reason || t('t_buy_fail'), 'warn');
    }
  } catch (e) {
    hideWithdrawLoading();
    const msg = e && e.message ? String(e.message) : '';
    if (/cancel|reject|denied/i.test(msg)) {
      // 用户主动取消签名/支付
      toast('支付取消', 'info');
    } else {
      // 技术失败（钱包 session 失效 / 未连接 / 跳转失败）：断开重连，让用户重新授权
      try { tonConnectUI?.disconnect(); } catch(_) {}
      clearWallet();
      toast('钱包连接已失效，请重新连接钱包', 'warn');
      setTimeout(() => connectWallet(), 300);
    }
  }
}

function todayStr() {
  // 每日重置改到「早上8点」：8点(上海)=UTC 0点，所以直接用 UTC 日期
  return new Date(Date.now()).toISOString().slice(0, 10);
}

// 跨天归零每日广告计数（adUsedToday / boostAdUsed），保证上报给后端的始终是「今天」的数量
function resetDailyCountersIfNewDay() {
  const today = todayStr();
  try {
    if (localStorage.getItem(AD_DAY_KEY) === today) return;
    localStorage.setItem(AD_DAY_KEY, today);
  } catch(_) {}
  S.adUsedToday = 0;
  S.boostAdUsed = 0;
  S.inflateCount = 0;   // 通胀每日重置
}

// ═══════ 赛季（7天一个赛季，每周一 08:00 北京时间重置，从第0赛季开始）═══════
const SEASON_WEEK_MS = 7 * 24 * 3600 * 1000;
const SEASON_EPOCH_MS = Date.UTC(2026, 7, 10, 0, 0, 0); // 赛季0起点：2026-08-10 周一 08:00 北京时间（UTC 0点）

function getSeasonInfo() {
  const now = Date.now();
  const season = Math.floor((now - SEASON_EPOCH_MS) / SEASON_WEEK_MS);
  const nextReset = SEASON_EPOCH_MS + (season + 1) * SEASON_WEEK_MS;
  return { season, countdownMs: Math.max(0, nextReset - now) };
}
function formatCountdown(ms) {
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return d + t('time_day') + ' ' + h + t('time_hour') + ' ' + m + t('time_minute') + ' ' + s + t('time_second');
}
function updateSeasonUI() {
  const info = getSeasonInfo();
  const title = document.getElementById('season-title');
  if (title) title.textContent = 'S' + info.season + t('season_title');
  // S1 横幅标题：动态显示当前赛季编号
  const bannerTitle = document.getElementById('season-banner-title');
  if (bannerTitle) bannerTitle.textContent = '🏆 S' + info.season + ' ' + t('season_title') + '瓜分';
  // 弹窗倒计时
  const cd = document.getElementById('season-countdown');
  if (cd) cd.textContent = formatCountdown(info.countdownMs);
  // 横幅倒计时
  const cdBanner = document.getElementById('season-countdown-banner');
  if (cdBanner) cdBanner.textContent = formatCountdown(info.countdownMs);
}
// 当前玩家每日广告上限 = 基础 15 + 邀请加成（每邀请1人+1，封顶+5，总封顶20）
function adDailyLimit() {
  return AD_BASE_LIMIT + Math.min(S.inviteCount || 0, AD_INVITE_BONUS_MAX);
}
function isAiUnlockedToday() {
  try { return localStorage.getItem(AI_KEY) === todayStr(); } catch(_) { return false; }
}
function setAiUnlockedToday() {
  try { localStorage.setItem(AI_KEY, todayStr()); } catch(_) {}
}
function setAiExpire() {
  try { localStorage.setItem(AI_EXPIRE_KEY, String(Date.now() + AI_LIMIT_MS)); } catch(_) {}
}
function isAiExpired() {
  try {
    const exp = Number(localStorage.getItem(AI_EXPIRE_KEY)) || 0;
    return Date.now() > exp;
  } catch(_) { return true; }
}
function startAiLoop() {
  stopAiLoop();
  S.aiRunning = true;
  S.aiTimer = setInterval(aiTick, AI_TICK_MS);
  document.body.classList.add('ai-active');   // 智能合成运行时暂停背景光效，降低移动端 GPU 负担
  updateAiBtn();
}
function stopAiLoop() {
  S.aiRunning = false;
  if (S.aiTimer) { clearInterval(S.aiTimer); S.aiTimer = null; }
  document.body.classList.remove('ai-active');
  sortGrid();   // 停止智能合成时统一排序一次，恢复「最高等级排第一」的整齐布局
  updateAiBtn();
}
function checkDailyReset() {
  if (!S.aiRunning) return;
  // 跨 0 点 或 单次 15 分钟到期 → 自动关闭智能合成
  if (!isAiUnlockedToday()) {
    stopAiLoop();
    toast(t('t_ai_daily_reset'),'info');
  } else if (isAiExpired()) {
    stopAiLoop();
    toast('本次智能合成已结束，重新签到继续', 'info');
  }
}
function updateAiBtn() {
  const el = document.querySelector('.ai-merge-btn');
  if (!el) return;
  const emoji = el.querySelector('.bubble-emoji');
  const setEmoji = (c) => { if (emoji) emoji.textContent = c; };
  if (S.aiRunning) {
    setEmoji('⚡');
    el.classList.add('ai-running');
    el.classList.remove('ai-locked');
  } else if (isAiUnlockedToday() && !isAiExpired()) {
    setEmoji('⚡');
    el.classList.remove('ai-running', 'ai-locked');
  } else {
    setEmoji('🎯');
    el.classList.remove('ai-running');
    el.classList.add('ai-locked');
  }
}

// ═══════ 交互让道：用户操作时暂停 AI 合成，避免抢主线程导致卡顿 ═══════
let _userInteracting = false;
let _interactTimer = null;
function markInteracting() {
  _userInteracting = true;
  if (_interactTimer) clearTimeout(_interactTimer);
  _interactTimer = setTimeout(() => { _userInteracting = false; }, 800);
}
// 弹窗打开期间 AI 完全暂停（弹窗渲染需要主线程，AI 让道）
function _anyModalOpen() {
  return !!document.querySelector('.pokedex-modal.show, .profile-modal.show, .settings-modal.show, .leaderboard-modal.show, .task-modal.show, .poster-modal.show, .confirm-modal.show, .offline-modal.show');
}

// AI 单次动作：先尽量合成（从高到低）→ 再尽量买（钱够才买）
function aiTick() {
  if (S.aiLock || D.on || _userInteracting || _anyModalOpen()) return;   // 锁 / 拖拽 / 交互 / 弹窗打开时让道
  S.aiLock = true;
  try {
    // ① 从高等级到低等级扫一遍：找到有 2 只同级就合成
    // 40 级是满级，不能再合成（否则会把两只 40 级猫“合”成一只，白亏一只）
    let merged = false;
    for (let lv = MAX_LV - 1; lv >= 1; lv--) {
      let idx1 = -1, idx2 = -1;
      for (let i = 0; i < TOTAL; i++) {
        if (S.grid[i] !== lv) continue;
        if (idx1 < 0) idx1 = i;
        else { idx2 = i; break; }
      }
      if (idx2 >= 0) {
        // 合并 idx1 + idx2 → 暴击判定生成新等级
        const mr = mergeResultLv(lv);
        const newLv = mr.nl;
        S.grid[idx1] = null;
        S.grid[idx2] = newLv;
        if (newLv === MAX_LV) S.divCats.push(4);  // 合成出40级猫：记分红资格
        sortGrid();                        // 合成后自动降序排序（与手动合成一致）
        const ni = S.grid.indexOf(newLv);  // 找新等级排序后的位置
        if (ni >= 0) boom(ni, { shake: false });  // 智能合成高频：只闪光不整屏震动
        collect(newLv);
        if (mr.coins > 0) S.usdt = parseFloat((S.usdt + mr.coins).toFixed(4));  // 合成金币奖励
        audio.sfxMerge();                 // 🔔 智能合成成功音效
        if (mr.crit) { audio.play('merge_combo'); reportMergeCritBroadcast(newLv, mr.extra, mr.coins); }  // 💥 暴击
        saveLocal();
        merged = true;
        break;  // 每次 tick 只做一次合并，防止卡顿
      }
    }
    if (merged) return;
    // 满格且无同级可合成 → 死局（买猫也 grid full），自动关闭避免每 tick 空转 + 打网络
    if (isGridFull()) {
      stopAiLoop();
      toast('场上已满且无同级猫可合成，智能合成已自动关闭', 'info');
      return;
    }
    // ② 没有可合成 → 异步走 buy_cat RPC 买一只（前端不算价，防重入）
    aiBuyCat();
  } finally {
    S.aiLock = false;
  }
}

// 智能合成自动买猫：异步调 RPC，防止高频循环里重复触发
let _aiBuying = false;
async function aiBuyCat() {
  if (_aiBuying || shopLocked()) return;
  _aiBuying = true;
  try {
    const lv = buyLevel();
    await saveCloudNow();   // 买猫前先同步本地合成结果到后端，避免撤回刚合成的猫
    const r = await callRpc('buy_cat', { level: lv });
    if (r && r.ok) {
      if (typeof r.price === 'number') S.usdt = parseFloat((Math.max(0, S.usdt - r.price)).toFixed(4));
      if (typeof r.inflate_count === 'number') S.inflateCount = r.inflate_count;
      if (typeof r.buy_count === 'number') S.buyCount = r.buy_count;
      // 只重绘买猫后新增的那一格，避免每次买猫全量重绘 16 只猫导致卡顿
      if (Array.isArray(r.grid)) {
        for (let i = 0; i < TOTAL; i++) {
          const x = r.grid[i];
          const nx = (typeof x === 'number' && x >= 1 && x <= MAX_LV) ? x : null;
          if (S.grid[i] !== nx) {
            S.grid[i] = nx;
            draw(i);
          }
        }
      }
      collect(lv);
      uiFast();   // 买猫后只刷金币，等级/按钮状态由 1s uiSlow 兜底，避免高频全量刷新
      saveLocal();
    }
  } finally {
    _aiBuying = false;
  }
}

// 点击签到合成按钮：免费签到开启/关闭智能合成（不看广告）
function toggleAiMerge(e) {
  if (e) { e.preventDefault?.(); e.stopPropagation?.(); }
  // 未签到 或 已到期 → 签到/续时，解锁 15 分钟
  if (!isAiUnlockedToday() || isAiExpired()) {
    setAiUnlockedToday();
    setAiExpire();
    startAiLoop();
    toast(t('t_ai_checkin_ok'),'success');
    saveLocal();
    return;
  }
  // 有效期内 → 切换开关
  if (S.aiRunning) stopAiLoop();
  else startAiLoop();
}


// ═══════ 图鉴：已收集等级集合（持久化到 localStorage） ═══════
const POKEDEX_KEY = 'cybermerge_pokedex';
let collected = new Set();
function loadPokedex() {
  try {
    const raw = localStorage.getItem(POKEDEX_KEY);
    if (raw) collected = new Set(JSON.parse(raw));
  } catch(_) {}
  if (collected.size === 0) collected.add(1);
}
function savePokedex() {
  try { localStorage.setItem(POKEDEX_KEY, JSON.stringify([...collected])); } catch(_) {}
}
function collect(lv) {
  if (lv < 1 || lv > MAX_LV) return;
  if (!collected.has(lv)) { collected.add(lv); savePokedex(); }
}

// ═══════ 拖拽 ═══════
let D = { on: false, i: -1, lv: 0, cl: null, gh: null, sx: 0, sy: 0, ox: 0, oy: 0 };
let _dTimer = 0;

// ═══════ 缓存 ═══════
let g, tg;
let timerSec = 364.02;
let timerInterval = null;
let _slowUiTimer = null;   // 低频状态刷新定时器（1s，等级/头像/昵称/邀请/广告贡献/买猫按钮/跨天检测）

function pos(e) {
  if (e.touches?.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches?.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function d(tag,cls) { let e=document.createElement(tag); e.className=cls||''; return e; }

// ═══════ 强制清理所有拖拽残留 ═══════
function cleanDrag() {
  clearTimeout(_dTimer);
  if (D.cl && D.cl.parentNode) { D.cl.style.transition = 'none'; D.cl.remove(); }
  const strays = document.querySelectorAll('.pet-dragging');
  strays.forEach(el => { el.style.transition = 'none'; el.remove(); });
  if (D.gh) D.gh.classList.remove('pet-ghost');
  D.on = false; D.cl = null; D.gh = null;
  D.i = -1; D.lv = 0; D.ox = 0; D.oy = 0;
  document.body.style.overflow = '';
  setRecycleMode(false);   // 拖拽被 touchcancel / Esc 打断时，也要把中央按钮从回收站恢复成买猫
}

// ═══════ TWA ═══════
function twa() {
  try {
    if (window.Telegram?.WebApp) {
      tg = window.Telegram.WebApp;
      tg.ready(); tg.expand();
      tg.lockOrientation?.('portrait');
      // 不调用 enableClosingConfirmation()：它会触发「确认离开」弹窗，强退时导致存档丢失
      tg.setHeaderColor('#f5e6d3');
      tg.setBackgroundColor('#f5e6d3');
      // Telegram 原生关闭事件兜底：静默保存，不弹窗
      try { tg.onEvent?.('web_app_close', () => saveCloudNow()); } catch(_) {}
    }
  } catch(_){}
}

// ═══════ 邀请裂变：生成带随机邀请码 refCode 的短链 ═══════
const INVITE_BASE_URL = 'https://t.me/CyberCatMergeBot/app?startapp=';  // 邀请短链前缀（startapp 后接随机邀请码 refCode）

function buildInviteLink() {
  return INVITE_BASE_URL + (S.refCode || '');
}

// 普通浏览器调试：initData 为空时填充伪造测试数据（配合后端 ALLOW_TEST_AUTH=true 测试模式）
const TEST_INIT_DATA = 'query_id=test&user=%7B%22id%22%3A12345678%2C%22first_name%22%3A%22TestUser%22%7D';

function getInitData() {
  // 判断是否在 Telegram 环境（WebApp 对象存在）
  if (window.Telegram?.WebApp) {
    // TG 环境：严格使用真实 initData（即使为空也返回真实值，绝不用测试数据）
    return window.Telegram.WebApp.initData || '';
  }
  // 纯网页环境（无 Telegram.WebApp）：使用测试数据
  return TEST_INIT_DATA;
}

// ═══════ 云存档：本地实时持久化 + 签名防篡改云端同步 ═══════

// 收集需要保存的完整存档
function collectCloudData() {
  const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch(_) { return d; } };
  return {
    coins: S.usdt - S.bonusCoins,   // 只存前端自有金币（服务端 bonusCoins 单独保存，不参与覆盖）
    bonusCoins: S.bonusCoins,
    grid: S.grid,
    buyCount: S.buyCount,
    inflateCount: S.inflateCount,
    adUsedToday: S.adUsedToday,
    divCats: S.divCats,
    pokedex: [...collected],
    aiUnlockDay: lsGet(AI_KEY, ''),
    settings: {
      lang: _lang,
      music: lsGet('cybermerge_music', '1'),
      sfx: lsGet('cybermerge_sfx', '1'),
      wallet: wallet.address,
    }
  };
}

// 获取当前玩家 tg_id（签名用；非 TG 环境回退测试 id）
function getTgId() {
  return window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 12345678;
}

// ═══════ 本地实时存档：所有常规操作立即写 localStorage，不碰网络 ═══════
function saveLocal() {
  try {
    localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify({ ...collectCloudData(), savedAt: Date.now() }));
  } catch(_) {}
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(_) { return null; }
}

// ═══════ Hash 签名（与后端 lib/sign.js 的 buildSignString 保持完全一致）═══════
function buildSignString(tgId, data, timestamp) {
  const grid = Array.isArray(data.grid) ? data.grid.map(x => (x === null || x === undefined) ? '' : x).join(',') : '';
  const pokedex = Array.isArray(data.pokedex) ? data.pokedex.join(',') : '';
  const divCats = Array.isArray(data.divCats) ? JSON.stringify(data.divCats) : '[]';
  return [
    tgId,
    data.coins ?? 0,
    data.bonusCoins ?? 0,
    grid,
    data.buyCount ?? 0,
    data.inflateCount ?? 0,
    data.adUsedToday ?? 0,
    pokedex,
    data.aiUnlockDay ?? '',
    divCats,
    timestamp,
    SECRET_SALT,
  ].join('|');
}

async function computeSignature(tgId, data, timestamp) {
  const str = buildSignString(tgId, data, timestamp);
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch(_) {
    return '';
  }
}

// ═══════ 云端同步：仅广告奖励 / 2 分钟定时 / 关闭后台时触发 ═══════
let _lastCloudSync = 0;

// 通用 RPC 调用：走 /auth 后端验真 tg_id 后转发 Supabase RPC，前端不算价/不计资产
async function callRpc(action, payload) {
  try {
    const initData = getInitData();
    const resp = await fetch(AUTH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, initData, data: payload || {} })
    });
    const data = await resp.json();
    if (!data.success) return { ok: false, reason: data.message || 'error' };
    return data.result || { ok: false, reason: 'empty' };
  } catch(_) {
    return { ok: false, reason: 'network' };
  }
}

// 用 RPC 返回的 grid 数组刷新本地网格（一切以服务端为准）
function applyGridFromRpc(grid) {
  if (!Array.isArray(grid)) return;
  for (let i = 0; i < TOTAL; i++) {
    const x = grid[i];
    S.grid[i] = (typeof x === 'number' && x >= 1 && x <= MAX_LV) ? x : null;
  }
  for (let i = 0; i < TOTAL; i++) draw(i);
}

async function saveCloudNow() {
  const initData = getInitData();
  const data = collectCloudData();
  const tgId = getTgId();
  const timestamp = Date.now();
  const signature = await computeSignature(tgId, data, timestamp);
  try {
    const resp = await fetch(AUTH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', initData, data, signature, timestamp })
    });
    _lastCloudSync = Date.now();
    console.log('Syncing backend save resp:', resp.status, resp.statusText);
  } catch(_) {}
}

// 节流云同步：距上次超过 2 分钟才真正发送，避免高频请求
function saveCloud() {
  if (Date.now() - _lastCloudSync < CLOUD_SYNC_MS) return;
  saveCloudNow();
}

// 平缓定时器：每 2 分钟同步一次（覆盖离线金币产出）
function startCloudSyncTimer() {
  setInterval(() => { saveCloudNow(); }, CLOUD_SYNC_MS);
}

// 把存档对象恢复到运行状态（金币 / grid / 图鉴 / 进度）
function applyStateToS(obj) {
  if (!obj) return;
  if (typeof obj.bonusCoins === 'number') S.bonusCoins = obj.bonusCoins;
  if (typeof obj.coins === 'number') S.usdt = obj.coins + S.bonusCoins;
  if (Array.isArray(obj.grid)) {
    for (let i = 0; i < TOTAL; i++) {
      const x = obj.grid[i];
      S.grid[i] = (typeof x === 'number' && x >= 1 && x <= MAX_LV) ? x : null;
    }
    for (let i = 0; i < TOTAL; i++) draw(i);
  }
  if (typeof obj.buyCount === 'number') S.buyCount = obj.buyCount;
  if (typeof obj.inflateCount === 'number') S.inflateCount = obj.inflateCount;
  if (typeof obj.adUsedToday === 'number') S.adUsedToday = obj.adUsedToday;
  if (Array.isArray(obj.divCats)) S.divCats = obj.divCats.map(x => Number(x) || 0);
  if (Array.isArray(obj.pokedex)) {
    collected.clear();
    obj.pokedex.forEach(lv => { if (typeof lv === 'number' && lv >= 1 && lv <= MAX_LV) collected.add(lv); });
    savePokedex();
  }
  if (typeof obj.aiUnlockDay === 'string' && obj.aiUnlockDay) {
    try { localStorage.setItem(AI_KEY, obj.aiUnlockDay); } catch(_) {}
  }
}

// 初始化：拉取云端，与本地 localStorage 对比合并（等级/金币/图鉴以较高者为准）
async function syncBackend() {
  const local = loadLocal();                          // 本地实时存档（可能为 null）

  try {
    const initData = getInitData();                   // Telegram 环境用真实 initData，普通浏览器用测试数据
    const inviterId = window.Telegram?.WebApp?.initDataUnsafe?.start_param || '';
    console.log('Syncing backend:', 'login', { inviterId }, initData);
    const resp = await fetch(AUTH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', initData, inviterId })
    });
    console.log('Syncing backend login resp:', resp.status, resp.statusText);
    const data = await resp.json();
    if (!data.success || !data.user) { applyStateToS(local); resetDailyCountersIfNewDay(); ui(); return; }
    const u = data.user;

    // 金币：总金币 = 云端总额 与 本地总额 取较大者；服务端 bonusCoins 单独记录
    const localCoins = (local && typeof local.coins === 'number' ? local.coins : 0)
      + (local && typeof local.bonusCoins === 'number' ? local.bonusCoins : 0);
    S.bonusCoins = Number(u.bonusCoins) || 0;
    S.usdt = Math.max(Number(u.coins) || 0, localCoins);

    // 离线收益弹窗：后端在 login 时已结算当日签到后的离线产出
    const offlineReward = Number(data.offlineReward) || 0;
    if (offlineReward > 0) showOfflineReward(offlineReward);

    // grid：按总算力分值取更优的一方（避免最大等级相同但猫数量不同时覆盖丢猫，伤到大户）
    const cloudGrid = Array.isArray(u.grid) ? u.grid : null;
    const localGrid = (local && Array.isArray(local.grid)) ? local.grid : null;
    const gridSrc = gridScore(cloudGrid) >= gridScore(localGrid) ? cloudGrid : localGrid;
    if (Array.isArray(gridSrc)) {
      for (let i = 0; i < TOTAL; i++) {
        const x = gridSrc[i];
        S.grid[i] = (typeof x === 'number' && x >= 1 && x <= MAX_LV) ? x : null;
      }
      for (let i = 0; i < TOTAL; i++) draw(i);
    }

    // 进度计数：取较大者（每日/累计计数只增不减）
    S.buyCount = Math.max(S.buyCount, Number(u.buyCount) || 0, (local && typeof local.buyCount === 'number') ? local.buyCount : 0);
    S.inflateCount = Math.max(S.inflateCount, Number(u.inflateCount) || 0, (local && typeof local.inflateCount === 'number') ? local.inflateCount : 0);
    S.adUsedToday = Math.max(S.adUsedToday, Number(u.adUsedToday) || 0, (local && typeof local.adUsedToday === 'number') ? local.adUsedToday : 0);
    if (typeof u.inviteCount === 'number') S.inviteCount = u.inviteCount;
    if (typeof u.refCode === 'string' && u.refCode) S.refCode = u.refCode;
    if (Array.isArray(u.divCats)) S.divCats = u.divCats.map(x => Number(x) || 0);
    if (typeof u.weekAdCount === 'number') S.weekAdCount = u.weekAdCount;
    if (typeof u.adContribution === 'number') S.adContribution = u.adContribution;
    if (typeof u.internalUsdt === 'number') S.internalUsdt = u.internalUsdt;
    if (typeof u.newbieCatClaimed === 'boolean') S.newbieCatClaimed = u.newbieCatClaimed;
    if (typeof u.newbieAdStage === 'number') S.newbieAdStage = u.newbieAdStage;
    if (typeof u.boostAdUsed === 'number') S.boostAdUsed = u.boostAdUsed;
    if (typeof u.boostAdDay === 'string') S.boostAdDay = u.boostAdDay;
    if (typeof u.username === 'string' && u.username) S.username = u.username;

    // 合并完成后跨天归零每日广告计数（避免把昨日 adUsedToday 混入今天）
    resetDailyCountersIfNewDay();

    // aiUnlockDay：取较新日期
    const localDay = (local && typeof local.aiUnlockDay === 'string') ? local.aiUnlockDay : '';
    const cloudDay = (typeof u.aiUnlockDay === 'string') ? u.aiUnlockDay : '';
    const bestDay = (localDay > cloudDay) ? localDay : cloudDay;
    if (bestDay) { try { localStorage.setItem(AI_KEY, bestDay); } catch(_) {} }

    // pokedex：取并集（图鉴只增不减）
    const merged = new Set(Array.isArray(local?.pokedex) ? local.pokedex : []);
    if (Array.isArray(u.pokedex)) u.pokedex.forEach(lv => { if (typeof lv === 'number' && lv >= 1 && lv <= MAX_LV) merged.add(lv); });
    if (merged.size === 0) merged.add(1);
    collected = merged;
    savePokedex();

    // settings：本地优先，云端仅在本地缺失时兜底
    if (u.settings && typeof u.settings === 'object') {
      const st = u.settings;
      if (!localStorage.getItem('cybermerge_lang')) {
        if (st.lang === 'zh' || st.lang === 'en' || st.lang === 'ru') {
          _lang = st.lang;
          try { localStorage.setItem('cybermerge_lang', st.lang); } catch(_) {}
        }
      }
      if (!localStorage.getItem('cybermerge_music') && st.music) { try { localStorage.setItem('cybermerge_music', st.music); } catch(_) {} }
      if (!localStorage.getItem('cybermerge_sfx') && st.sfx) { try { localStorage.setItem('cybermerge_sfx', st.sfx); } catch(_) {} }
      if (!wallet.address && st.wallet) saveWallet(st.wallet, 'cloud');
      audio.sfxEnabled = (() => { try { return localStorage.getItem('cybermerge_sfx') === '1'; } catch(_) { return true; } })();
    }

    // 刷新界面（金币 + 钱包 + 语言）
    ui();
    applyI18n();
    saveLocal();   // 合并结果写回本地
  } catch(_) {
    // 后端不可用（本地/未部署）时回退本地存档，不打断游戏
    applyStateToS(local);
    resetDailyCountersIfNewDay();
    ui();
    applyI18n();
  }

  autoScrollCatTree();   // 云端/本地存档加载后自动滚动到猫的位置
}

// ═══════ Toast ═══════
function toast(m, t) {
  let c = document.getElementById('toast-container');
  if (!c) { c = d('div','toast-container'); document.body.appendChild(c); }
  let el = d('div','toast toast-'+(t||'info')); el.textContent = m; c.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast-enter'));
  setTimeout(() => { el.classList.add('toast-leave'); el.addEventListener('transitionend',()=>el.remove(),{once:true}); }, 1500);
}

// ═══════ 合规广告二次确认弹窗：所有广告触发前必须先弹出确认 ═══════
let _confirmCb = null;
function confirmAd(opts) {
  const modal = document.getElementById('confirm-modal');
  if (!modal) return;
  const icon = document.getElementById('confirm-icon');
  const title = document.getElementById('confirm-title');
  const desc = document.getElementById('confirm-desc');
  const ok = document.getElementById('confirm-ok');
  if (icon) icon.textContent = opts.icon || '📺';
  if (title) title.textContent = opts.title || t('confirm_ok');
  if (desc) desc.textContent = opts.desc || '';
  if (ok) ok.textContent = '▶ ' + (opts.okText || t('confirm_ok').replace('▶ ', ''));
  _confirmCb = opts.onOk || null;
  modal.classList.add('show');
}
function closeConfirm() {
  document.getElementById('confirm-modal')?.classList.remove('show');
  _confirmCb = null;
}
function bindConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  if (!modal) return;
  document.getElementById('confirm-cancel')?.addEventListener('click', closeConfirm);
  document.getElementById('confirm-ok')?.addEventListener('click', () => {
    const cb = _confirmCb;
    closeConfirm();
    if (typeof cb === 'function') cb();
  });
  modal.addEventListener('click', (e) => { if (e.target.id === 'confirm-modal') closeConfirm(); });
}

// ═══════ 离线收益弹窗：展示当日签到后的离线产出 ═══════
function showOfflineReward(amount) {
  const modal = document.getElementById('offline-modal');
  if (!modal) return;
  const amtEl = document.getElementById('offline-amount');
  if (amtEl) amtEl.textContent = fmtNum(amount) + ' ' + t('level_coins_suf');
  modal.classList.add('show');
}
function closeOfflineReward() {
  document.getElementById('offline-modal')?.classList.remove('show');
}

// ═══════ 音频系统：仅 BGM + 合成音（默认开启，用户可手动关闭）═══════
// 使用用户下载的真实《开心消消乐》音效素材（public/sounds/）
//   · bgm.mp3         背景音乐（循环播放，与合成音同时运行）
//   · merge.mp3       一次合成 ≤2 只（普通合成音）
//   · merge_combo.mp3 连续合成 ≥3 只（连击音，含 yes/awesome 语音）
// 简化策略：用户一进来就能听到 BGM + 合成时的合成音，无其他干扰音
const audio = {
  bgmEl: null,            // BGM <audio> 元素
  sfxPool: {},            // SFX 音频池 { key: [Audio, Audio, ...] }
  sfxIdx: {},             // 轮询索引
  bgmPlaying: false,
  sfxEnabled: true,
  comboCount: 0,          // 连击计数（1.5s 无合成归零）
  comboLastTime: 0,
  _inited: false,
  // 初始化：创建 BGM 元素 + 合成音池（预加载）
  init() {
    if (this._inited) return;
    this._inited = true;
    // BGM（独立 <audio>，循环播放）
    this.bgmEl = new Audio('/sounds/bgm.mp3');
    this.bgmEl.loop = true;
    this.bgmEl.volume = 0.40;
    this.bgmEl.preload = 'auto';
    this.bgmEl.load();                          // 显式触发加载
    // 合成音池（仅 merge + merge_combo）
    const SFX_FILES = {
      merge:       { src: '/sounds/merge.mp3',       vol: 0.80 },  // 普通合成
      merge_combo: { src: '/sounds/merge_combo.mp3', vol: 0.85 }   // 连击合成（≥3）
    };
    const POOL = 4;                              // 每个音效 4 个实例（连击不中断）
    Object.entries(SFX_FILES).forEach(([key, { src, vol }]) => {
      this.sfxPool[key] = [];
      this.sfxIdx[key] = 0;
      for (let i = 0; i < POOL; i++) {
        const a = new Audio(src);
        a.preload = 'auto';
        a.volume = vol;
        a.load();
        this.sfxPool[key].push(a);
      }
    });
  },
  // 播放 SFX（池轮询，支持快速连击重叠播放）
  play(key) {
    if (!this.sfxEnabled) return;
    if (!this._inited) this.init();
    const pool = this.sfxPool[key];
    if (!pool || !pool.length) return;
    const i = this.sfxIdx[key];
    const a = pool[i];
    this.sfxIdx[key] = (i + 1) % pool.length;    // 轮询下一个
    try {
      a.currentTime = 0;                          // 从头播
      const p = a.play();
      if (p && p.catch) p.catch(() => {});        // 自动播放被拒时静默忽略
    } catch(e) {}
  },
  // ═══════ BGM 控制（独立通道，与合成音同时运行）═══════
  startBgm() {
    if (!this._inited) this.init();
    if (!this.bgmEl || this.bgmPlaying) return;
    const p = this.bgmEl.play();
    if (p && p.then) {
      p.then(() => { this.bgmPlaying = true; })   // 播放成功才标记
       .catch(() => { this.bgmPlaying = false; }); // 失败不标记，允许重试
    } else {
      this.bgmPlaying = true;
    }
  },
  stopBgm() {
    if (!this.bgmEl) return;
    this.bgmEl.pause();
    try { this.bgmEl.currentTime = 0; } catch(e) {}
    this.bgmPlaying = false;
  },
  // ═══════ 合成音：≤2 只用 merge.mp3，≥3 只连击用 merge_combo.mp3 ═══════
  sfxMerge() {
    if (!this.sfxEnabled) return;
    if (!this._inited) this.init();
    const now = performance.now() / 1000;
    if (now - this.comboLastTime > 1.5) this.comboCount = 0;
    this.comboCount++;
    this.comboLastTime = now;
    // 连击 ≥3 用 merge_combo（含 yes/awesome 语音），否则用 merge
    if (this.comboCount >= 3) {
      this.play('merge_combo');
    } else {
      this.play('merge');
    }
  }
};

// ═══════ 全局产金定时器（每 100ms 累加算力产出；低频状态走独立 1s 定时器）═══════
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  if (_slowUiTimer) clearInterval(_slowUiTimer);
  let earnAccum = 0;
  let floatTick = 0;                    // 100ms tick 计数，每 10 tick = 1 秒飘一次+产出
  timerInterval = setInterval(() => {
    timerSec -= 0.1;
    if (timerSec < 0) timerSec = 999;
    // 心心数字不在此处刷新 —— 这是外接显示位，由 window.setTimerNum(amount) 外部调用更新

    // 算力：每 100ms 加 1/10 总产出，顺滑累积
    const earn = totalEarnPerSec();
    earnAccum += earn * 0.1;
    if (earnAccum >= 0.01) {
      S.usdt = parseFloat((S.usdt + earnAccum).toFixed(4));
      earnAccum = 0;
    }
    // timer-rate 不再每 tick 覆盖 —— 它的文案由 data-i18n 持久管理，applyI18n() 时切换
    uiFast();   // 高频只刷金币，避免每 100ms 全量写 DOM

    // 每 1 秒（10 个 100ms tick）：飘数字 + 本地存档（降频减少移动端 DOM 创建/销毁）
    floatTick++;
    if (floatTick >= 10) {
      if (earn > 0) {
        floatIncome(earn);
        floatIncomeTop(earn);
      }
      floatTick = 0;
      saveLocal();
    }
  }, 100);

  // 低频状态刷新：1 秒一次（等级/头像/昵称/邀请/广告贡献/买猫按钮/跨天检测/AI 按钮状态）
  _slowUiTimer = setInterval(uiSlow, 1000);
}

// ═══════ 每秒+产出浮动数字：红色上飘渐隐，附着在中间买猫按钮上面
function floatIncome(amount) {
  const app = document.getElementById('app');
  if (!app) return;
  const el = document.createElement('span');
  el.className = 'float-income';
  el.textContent = fmtNum(amount);
  // 横向随机偏移 ±12px，避免每次都在同一条线堆积
  const rndX = (Math.random() * 24 - 12).toFixed(1);
  el.style.setProperty('--rnd-x', rndX + 'px');
  el.style.marginLeft = rndX + 'px';
  app.appendChild(el);
  let done = false;
  const rm = () => { if (!done) { done = true; el.remove(); } };
  el.addEventListener('animationend', rm, { once: true });
  setTimeout(rm, 1600);   // 兜底清理：切后台时动画暂停、animationend 不触发，防止元素累积卡顿
}

// ═══════ 顶部金币浮动：+X 附着在金币 HUD 上方 ═══════
function floatIncomeTop(amount) {
  const info = document.querySelector('.hud-coins');
  if (!info) return;
  const el = document.createElement('span');
  el.className = 'float-income-top';
  el.textContent = fmtNum(amount);
  info.appendChild(el);
  let done = false;
  const rm = () => { if (!done) { done = true; el.remove(); } };
  el.addEventListener('animationend', rm, { once: true });
  setTimeout(rm, 1600);   // 兜底清理：切后台时动画暂停、animationend 不触发，防止元素累积卡顿
}

// 金币数字「呼吸」pop 节流状态（避免每 100ms 高频动画）
let _lastCoinPop = 0;
let _lastCoinVal = null;

// ═══════ UI 渲染拆分：uiFast 高频金币线（100ms），uiSlow 低频状态线（脏标记 + 1s 兜底）═══════

// 高频：只刷持续变化的金币余额（每 100ms 由 startTimer 调用）
function uiFast() {
  const levelCoinsEl = document.getElementById('level-coins');
  if (levelCoinsEl) {
    levelCoinsEl.textContent = fmtNum(S.usdt) + ' ' + t('level_coins_suf');
    // 金币增加时做一次「呼吸」scale pop（节流 100ms，用 Web Animations 不额外建图层）
    const now = Date.now();
    if (_lastCoinVal !== null && S.usdt > _lastCoinVal && now - _lastCoinPop >= 100) {
      try {
        levelCoinsEl.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }],
          { duration: 150, easing: 'ease-out' }
        );
      } catch(_) {}
      _lastCoinPop = now;
    }
    _lastCoinVal = S.usdt;
  }
  // HUD USDT 余额（低频变化，但一次 textContent 写开销极小，随金币线一起刷）
  const usdtEl = document.getElementById('hud-usdt');
  if (usdtEl) usdtEl.textContent = '$' + (Number(S.internalUsdt) || 0).toFixed(2);
}

// 低频状态缓存（脏标记：值没变就不碰 DOM）
let _lastUserLv = null;
let _lastUsername = null;
let _lastInvite = null;
let _lastAdCont = null;

// 低频：等级/头像/昵称/邀请数/广告贡献/买猫按钮 —— 只在值变化时写 DOM（1s 兜底 + 操作后即时）
function uiSlow() {
  const userLv = Math.max(1, maxUnlockedLv());
  if (userLv !== _lastUserLv) {
    _lastUserLv = userLv;
    const levelLvEl = document.getElementById('level-lv');
    if (levelLvEl) levelLvEl.textContent = 'Lv.' + userLv;
    const avatarEl = document.getElementById('hud-avatar');
    if (avatarEl) avatarEl.src = '/cats_new/LV.' + userLv + '.png';
    const profileCatEl = document.getElementById('profile-cat');
    if (profileCatEl) profileCatEl.src = '/cats_new/LV.' + userLv + '.png';
  }

  const name = [...(S.username || 'Player')].slice(0, 6).join('');
  if (name !== _lastUsername) {
    _lastUsername = name;
    const nameEl = document.getElementById('hud-name');
    if (nameEl) nameEl.textContent = name;
  }
  if (S.inviteCount !== _lastInvite) {
    _lastInvite = S.inviteCount;
    const inviteEl = document.getElementById('hud-invite');
    if (inviteEl) inviteEl.textContent = String(S.inviteCount || 0);
  }
  if (S.adContribution !== _lastAdCont) {
    _lastAdCont = S.adContribution;
    const adcontEl = document.getElementById('hud-adcont');
    if (adcontEl) adcontEl.textContent = String(S.adContribution || 0);
  }

  // 中间买猫按钮：锁定态 + 悬浮猫素材（等级变了才换图）
  const mergeBtn = document.getElementById('btn-merge');
  const locked = shopLocked();
  const buyCatImg = document.getElementById('buy-cat-float');
  if (buyCatImg) {
    const catLv = locked ? 35 : buyLevel();
    if (buyCatImg.dataset.lv !== String(catLv)) {
      buyCatImg.src = (CATS[catLv] || CATS[1]).img;
      buyCatImg.dataset.lv = String(catLv);
    }
  }
  if (mergeBtn) {
    if (locked) {
      mergeBtn.classList.add('shop-locked');
      mergeBtn.classList.remove('btn-disabled');
    } else {
      mergeBtn.classList.remove('shop-locked', 'btn-disabled');
    }
  }

  // 跨 0 点检测 + 智能合成按钮状态：1s 一次即可，无需 100ms
  checkDailyReset();
  updateAiBtn();
}

// 完整刷新：操作后（合成/买猫/登录合并等）即时调用；内部走脏标记，不会重复写
function ui() {
  uiFast();
  uiSlow();
}

function makePet(lv) {
  let c = CATS[lv] || { img:'/cats_new/LV.40.png', name:'神秘喵·'+lv };
  let card = d('div','pet-card');
  card.dataset.level = lv;
  let d1 = (Math.random()*2).toFixed(2)+'s';
  let d2 = (Math.random()*3+0.5).toFixed(2)+'s';
  let d3 = (Math.random()*4+0.8).toFixed(2)+'s';
  card.style.setProperty('--breathe-delay', d1);
  card.style.setProperty('--head-delay',   d2);
  card.style.setProperty('--tail-delay',  d3);
  // 身体轻微摇摆：随机节奏，让猫更自然
  card.style.setProperty('--sway-dur', (3.5 + Math.random() * 3).toFixed(2) + 's');
  card.style.setProperty('--sway-delay', (Math.random() * 2).toFixed(2) + 's');
  let lvScale = 1.0;   // 猫咪统一大小，等级用 LV 标签区分
  card.innerHTML =
    '<div class="pet-mover">' +
      '<span class="pet-lv-badge">'+lv+'</span>' +
      '<div class="pet-tail-wag">' +
        '<div class="pet-head">' +
          '<img class="pet-img" data-lv="'+lv+'" src="'+c.img+'" alt="'+catName(lv)+'" draggable="false" style="--lv-scale:'+lvScale+'" />' +
        '</div>' +
      '</div>' +
    '</div>';
  return card;
}

function draw(i) {
  let s = g.children[i]; if(!s) return;
  let lv = S.grid[i];
  s.classList.remove('stack-2','stack-3');

  // 新人福利：[0] 号位未领取时固定显示 99% 锁猫
  if (i === 0 && !S.newbieCatClaimed && lv === null) {
    s.classList.add('filled', 'newbie-slot');
    s.dataset.empty = 'false';
    let lock = s.querySelector('.newbie-lock');
    if (!lock) {
      s.innerHTML = '';
      s.appendChild(makeNewbieLock());
    } else {
      // 复用锁 DOM，只刷新进度百分比
      const prog = lock.querySelector('.newbie-progress');
      if (prog) prog.textContent = newbieProgress() + '%';
    }
    return;
  }

  // 空格子
  if (lv === null) {
    s.classList.remove('filled');
    s.dataset.empty = 'true';
    if (s.firstChild) s.innerHTML = '';   // 从有猫/锁 → 空，才清空
    return;
  }

  // 有猫：优先复用已有 DOM，避免 innerHTML 重建（合成瞬间主线程卡顿的根因）
  s.classList.add('filled'); s.dataset.empty = 'false';
  let card = s.querySelector('.pet-card');
  if (!card || card.classList.contains('newbie-lock')) {
    // 无猫 或 之前是新人锁 → 创建
    s.innerHTML = '';
    card = makePet(lv);
    s.appendChild(card);
    card.addEventListener('touchstart', down, {passive:false});
    card.addEventListener('mousedown', down);
    card.addEventListener('click', tap);
  } else if (Number(card.dataset.level) !== lv) {
    // 复用：只更新等级标签 + 图片，不销毁 DOM、不重启动画、不重复绑事件
    updatePet(card, lv);
  }
  // 等级没变 → 完全复用，零 DOM 操作
}

// DOM 复用更新：替换等级与图片，保留动画节奏与已绑定事件
function updatePet(card, lv) {
  const c = CATS[lv] || { img:'/cats_new/LV.40.png', name:'神秘喵·'+lv };
  card.dataset.level = lv;
  const badge = card.querySelector('.pet-lv-badge');
  if (badge) badge.textContent = lv;
  const img = card.querySelector('.pet-img');
  if (img) {
    img.dataset.lv = lv;
    img.src = c.img;
    img.alt = catName(lv);
  }
}

// 新人多阶段解锁：99% →（看广告）99.5% →（看广告）99.7% →（邀请2好友）100% 领取
function newbieProgress() {
  return [99, 99.5, 99.7][Math.min(S.newbieAdStage || 0, 2)];
}
function makeNewbieLock() {
  const card = d('div', 'pet-card newbie-lock');
  card.innerHTML =
    '<span class="pet-lv-badge">35</span>' +
    '<div class="newbie-lock-inner">' +
      '<img class="pet-img newbie-lock-img" src="/cats_new/LV.35.png" alt="锁定的35级猫" draggable="false" />' +
      '<span class="newbie-crown">👑</span>' +
      '<span class="newbie-lock-icon">🔒</span>' +
      '<span class="newbie-progress">' + newbieProgress() + '%</span>' +
    '</div>';
  card.addEventListener('click', (e) => {
    e.stopPropagation();
    newbieClick();
  });
  return card;
}
function newbieClick() {
  const stage = Math.min(S.newbieAdStage || 0, 2);
  if (stage < 2) {
    confirmAd({
      icon: '👑',
      title: '观看广告后解锁...',
      desc: '解锁 35 级皇冠猫（当前进度 ' + newbieProgress() + '%）',
      onOk: () => showMonetagAd(() => advanceNewbieAd())
    });
  } else {
    // 广告已完成，直接尝试领取；邀请数由后端 claim_newbie_cat 校验
    claimNewbieCat();
  }
}
async function advanceNewbieAd() {
  const r = await callRpc('advance_newbie_ad', {});
  if (!r || r.ok === false) { toast(t('t_ad_load_failed'), 'warn'); return; }
  S.newbieAdStage = Number(r.stage) || 0;
  if (S.newbieAdStage === 1) {
    toast('当前解锁进度 99.5%，请再看一次广告解锁进度...', 'info');
  } else if (S.newbieAdStage === 2) {
    toast('当前进度 99.7%，请邀请两位好友或群立马解锁进度 100%', 'info');
  }
  if (g) draw(0);
  ui();
  saveLocal();
}
function inviteForNewbie() {
  const inviteUrl = buildInviteLink();
  if (tg && tg.openTelegramLink) {
    tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(inviteUrl) + '&text=' + encodeURIComponent(t('t_share_text')));
  } else {
    try { navigator.clipboard?.writeText(inviteUrl); toast(t('t_invite_copied'), 'success'); }
    catch(_) { toast(t('t_invite_link') + inviteUrl, 'info'); }
  }
}
// ═══════ Monetag 激励弹窗广告统一封装 ═══════
// 所有广告位都走同一个 zone：show_11583087({ ymid: 玩家 Telegram ID })
function showMonetagAd(onReward) {
  try {
    if (typeof window.show_11583087 !== 'function') {
      toast(t('t_ad_not_loaded'), 'warn');
      return;
    }
    // 注入玩家 Telegram ID 到 Monetag 的 {ymid} 宏，供后端 postback 定位用户
    window.show_11583087({ ymid: String(getTgId()) })
      .then(() => {
        // 广告观看完毕，执行原有发奖励逻辑
        if (typeof onReward === 'function') onReward();
      })
      .catch(() => {
        // 广告拉取失败或用户提前关闭
        toast(t('t_ad_not_finished'), 'warn');
      });
  } catch(_) {
    toast(t('t_ad_load_failed'), 'warn');
  }
}

function tap(e) {
  if(D.on) return;
  let card = e.currentTarget;
  let lv = parseInt(card.dataset.level);
  if(!lv) return;
  card.classList.add('pet-bounce');
  card.addEventListener('animationend', ()=>card.classList.remove('pet-bounce'), {once:true});
  let heart = d('div','float-heart'); heart.textContent = '❤️';
  let r = card.getBoundingClientRect();
  heart.style.left = (r.left+r.width/2-10)+'px';
  heart.style.top = (r.top-10)+'px';
  document.body.appendChild(heart);
  heart.addEventListener('animationend', ()=>heart.remove(), {once:true});
}

function all() {
  if(!g) return;
  for(let i=0;i<TOTAL;i++){ if(!g.children[i]){ let s=d('div','matrix-slot'); s.dataset.index=i; g.appendChild(s); } draw(i); }
}

// ═══════ 合成暴击 + 金币奖励 ═══════
// 基础：必定升 1 级（2 只同级 → 1 只高 1 级，封顶 40）
// 额外跳级：0.1% 额外 +1 级，0.005% 额外 +2 级，0.00001% 额外 +3 级
// 金币奖励：10% +1500 金币，5% +2500 金币
function mergeResultLv(baseLv) {
  const newBase = Math.min(baseLv + 1, MAX_LV);

  const r1 = Math.random();
  let extra = 0;
  if (r1 < 0.0000001) extra = 3;       // 0.00001% 大暴击 +3
  else if (r1 < 0.00005) extra = 2;    // 0.005% 暴击 +2
  else if (r1 < 0.001) extra = 1;      // 0.1% 小暴击 +1

  const nl = Math.min(newBase + extra, MAX_LV);

  const r2 = Math.random();
  let coins = 0;
  if (r2 < 0.05) coins = 2500;         // 5% 大奖
  else if (r2 < 0.15) coins = 1500;    // 10% 小奖

  return { nl, coins, crit: extra > 0, extra };
}

// ═══════ 合成后自动排序：最高等级排第一个（索引0），空格(null)排最后 ═══════
function sortGrid() {
  const before = S.grid.slice();   // 快照排序前状态，用于 diff
  // 取出所有非空格，按等级降序（高在前）
  const cats = S.grid.filter(x => x !== null).sort((a, b) => b - a);
  // 尾部补 null 到 16 格
  while (cats.length < TOTAL) cats.push(null);
  S.grid = cats;
  // diff 局部重绘：只重绘排序前后内容变化的那几格，避免每次全量重建 16 格
  for (let i = 0; i < TOTAL; i++) {
    if (before[i] !== S.grid[i]) draw(i);
  }
  autoScrollCatTree();   // 合成排序后自动滚动
}

function grid() {
  g = document.getElementById('matrix-grid'); if(!g) return;
  g.innerHTML='';
  for(let i=0;i<TOTAL;i++){ let s=d('div','matrix-slot'); s.dataset.index=i; g.appendChild(s); }
  requestAnimationFrame(() => { placeCats(); all(); });
}

// ═══════ 16 只猫站在 4 根横杆上（每根 4 个猫盘，向下滚动）═══════
const CAT_BAR_TOPS = [90, 220, 350, 480];     // 4 根杆的 slot 顶部 y（间距 130）
const CAT_SLOT_XS = [15, 38.33, 61.67, 85];   // 每根杆上 4 个猫盘中心 x（百分比，自适应屏宽）
const CAT_SLOT_SIZE = 80;

function placeCats() {
  if(!g) return;
  // 先定位 4 根横杆：木棍中心对齐猫盘椭圆中心（slot 顶部 + 猫盘椭圆中心 - 木棍半高 6）
  const bars = document.querySelectorAll('.cattree-bar');
  for (let b = 0; b < bars.length; b++) {
    bars[b].style.top = (CAT_BAR_TOPS[b] + CAT_SLOT_SIZE - 29) + 'px';
  }
  for (let i = 0; i < TOTAL; i++) {
    const s = g.children[i];
    if (!s) continue;
    const bar = Math.floor(i / 4);
    const pos = i % 4;
    s.style.left = 'calc(' + CAT_SLOT_XS[pos] + '% - ' + (CAT_SLOT_SIZE / 2) + 'px)';
    s.style.top = CAT_BAR_TOPS[bar] + 'px';
  }

  // 默认自动滚动到合适位置
  autoScrollCatTree();
}

// ═══════ 猫爬架自动滚动：≤8 只显示前 2 根；>8 只向下滚出第 3 根（及第 4 根）═══════
let _scrollResetTimer = null;
let _scrollResetBound = false;
let _programmaticScroll = false;
function autoScrollCatTree() {
  const ga = document.getElementById('game-area');
  if (!ga || !g) return;
  // 统计猫数量 + 最下面有猫的杆（0-3）
  let count = 0;
  let lastBar = 0;
  for (let i = 0; i < TOTAL; i++) {
    if (S.grid[i] !== null) {
      count++;
      lastBar = Math.floor(i / 4);
    }
  }
  let target;
  if (count <= 8) {
    // 前 2 根就够放，不滚动（固定显示顶部两根横杆）
    target = 0;
  } else {
    // 超过 8 只 → 向下滚动，让最下面有猫的那根杆露出来
    const bf = document.getElementById('board-frame');
    const offset = bf ? bf.offsetTop : 0;   // board-frame 在广播条之下，滚动需补上该偏移
    target = Math.max(0, offset + CAT_BAR_TOPS[lastBar] - 40);
  }
  // 位置没变就跳过，避免每次合成都触发一次 scrollTop 重排（智能合成时尤其频繁）
  if (Math.abs(ga.scrollTop - target) < 1) return;
  _programmaticScroll = true;
  ga.scrollTop = target;
  setTimeout(() => { _programmaticScroll = false; }, 50);
}

// 用户手动滚动游戏区后，停止滚动 1.2 秒自动复位，避免猫爬架滚出视野看不到
function setupCatTreeAutoReset() {
  if (_scrollResetBound) return;
  const ga = document.getElementById('game-area');
  if (!ga) return;
  _scrollResetBound = true;
  ga.addEventListener('scroll', () => {
    if (_programmaticScroll) return;
    if (_scrollResetTimer) clearTimeout(_scrollResetTimer);
    _scrollResetTimer = setTimeout(() => {
      _scrollResetTimer = null;
      autoScrollCatTree();
    }, 1200);
  }, { passive: true });
}

// ═══════ 购买（后端定价：含 2.2 成本 + 通胀，前端同步返回的计数）═══════
async function buy() {
  if (shopLocked()) { toast(t('shop_locked'), 'warn'); return; }
  const lv = buyLevel();
  await saveCloudNow();   // 买猫前先同步本地合成结果到后端，避免后端旧 grid 覆盖撤回刚合成的猫
  const r = await callRpc('buy_cat', { level: lv });

  if (!r || r.ok === false) {
    if (r && r.reason === 'insufficient coins') {
      if (S.boostAdUsed >= BOOST_AD_LIMIT) {
        toast('今日权益已用完', 'warn');
      } else {
        confirmAd({
          icon: '⚡',
          title: '观看广告后领取加速收益立马到账',
          desc: '当前加速收益：' + fmtNum(totalEarnPerSec() * 3) + ' ' + t('level_coins_suf') + '（今日剩余 ' + (BOOST_AD_LIMIT - S.boostAdUsed) + ' 次）',
          onOk: boostAd
        });
      }
    } else if (r && r.reason === 'grid full') {
      toast(t('t_grid_full_buy'), 'warn');
    } else {
      toast(t('t_buy_fail'), 'warn');
    }
    return;
  }

  // 一切以 RPC 返回为准：price 来自后端，grid 来自后端，前端不算价
  if (typeof r.price === 'number') S.usdt = parseFloat((Math.max(0, S.usdt - r.price)).toFixed(4));
  if (typeof r.inflate_count === 'number') S.inflateCount = r.inflate_count;
  if (typeof r.buy_count === 'number') S.buyCount = r.buy_count;
  applyGridFromRpc(r.grid);
  collect(lv);
  ui();
  toast(t('t_got_cat').replace('{name}', catName(lv)).replace('{lv}', lv), 'success');
  saveLocal();
  autoScrollCatTree();   // 买猫后自动滚动到新猫位置
}

// ═══════ 加速可产出（看 Adsgram 广告，成功看完才给猫）═══════
function watchAd() {
  if (S.adUsedToday >= adDailyLimit()) {
    toast(t('t_ad_limit_accel'),'warn');
    return;
  }
  let idx = -1; for (let i = 0; i < TOTAL; i++) if (S.grid[i] === null) { idx = i; break; }
  if (idx === -1) { toast(t('t_grid_full'),'warn'); return; }

  // 成功看完广告后发放加速奖励并立即落库
  const grantReward = () => {
    const lv = adRewardLv();
    S.adUsedToday++;
    S.grid[idx] = lv;
    draw(idx);
    ui();
    let pet = g?.children[idx]?.querySelector('.pet-card');
    if (pet) { pet.classList.add('pet-spawn'); pet.addEventListener('animationend',()=>pet.classList.remove('pet-spawn'),{once:true}); }
    collect(lv);
    toast(t('t_accel_success').replace('{name}', catName(lv)).replace('{lv}', lv),'success');
    saveCloudNow();   // 广告奖励后立即云同步
    autoScrollCatTree();   // 广告得猫后自动滚动
  };

  // 接入 Monetag 广告（看完后发奖励 + 存档）
  showMonetagAd(grantReward);
}

// ═══════ 每日任务：弹窗 + Monetag 激励广告 ═══════
function getDoneTasks() {
  const today = todayStr();
  try {
    const raw = localStorage.getItem(TASK_DONE_KEY);
    const obj = raw ? JSON.parse(raw) : { date: today, done: [] };
    if (obj.date !== today) return { date: today, done: [] };  // 每日重置
    return obj;
  } catch(_) { return { date: today, done: [] }; }
}
function isTaskDone(key) {
  return getDoneTasks().done.includes(key);
}
function markTaskDone(key) {
  const t = getDoneTasks();
  if (!t.done.includes(key)) t.done.push(key);
  try { localStorage.setItem(TASK_DONE_KEY, JSON.stringify(t)); } catch(_) {}
}
function renderTasks() {
  const list = document.getElementById('task-list');
  if (!list) return;
  list.innerHTML = '';
  DAILY_TASKS.forEach(task => {
    // 已完成的任务：渲染为静态「已完成」条目
    if (isTaskDone(task.key)) {
      const item = d('div', 'task-item task-done');
      item.innerHTML =
        '<span class="task-icon">' + task.icon + '</span>' +
        '<span class="task-info">' +
          '<span class="task-desc">' + t(task.descKey) + '</span>' +
        '</span>' +
        '<span class="task-reward">' + t('t_task_done_label') + '</span>';
      list.appendChild(item);
      return;
    }
    // 未完成：渲染为可点击任务条目，点击触发 Monetag 弹窗广告
    const item = d('div', 'task-item');
    item.innerHTML =
      '<span class="task-icon">' + task.icon + '</span>' +
      '<span class="task-info"><span class="task-desc">' + t(task.descKey) + '</span></span>' +
      '<span class="task-reward">+ ' + task.coins + ' ' + t('level_coins_suf') + '</span>' +
      '<button class="task-go-btn" type="button">' + t('t_task_claim') + '</button>';
    item.querySelector('.task-go-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      showMonetagAd(() => grantTaskReward(task));
    });
    list.appendChild(item);
  });
}
// 任务广告看完后发金币奖励（Monetag 弹窗）
function grantTaskReward(task) {
  S.usdt = parseFloat((S.usdt + task.coins).toFixed(4));
  S.adUsedToday++;                     // 任务广告计入每日总次数
  markTaskDone(task.key);
  ui();
  toast(t('t_task_done').replace('{icon}', task.icon).replace('{coins}', task.coins),'success');
  saveCloudNow();   // 广告奖励后立即云同步
  renderTasks();                     // 刷新任务列表（标记已完成）
}
function openTasks() {
  renderTasks();
  document.getElementById('task-modal')?.classList.add('show');
}
function closeTasks() {
  document.getElementById('task-modal')?.classList.remove('show');
  // 关闭时清空任务列表，释放 DOM
  const list = document.getElementById('task-list');
  if (list) list.innerHTML = '';
}

// ═══════ 拖拽（2 只同等级合成升级）+ 拖到中央按钮回收 ═══════
// 松手位置是否落在中央买猫按钮（回收站）区域
function isOverRecycleZone(x, y) {
  const btn = document.getElementById('btn-merge');
  if (!btn) return false;
  const r = btn.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}
// 拖拽时中央按钮切换为「回收站」发光态
function setRecycleMode(on) {
  const btn = document.getElementById('btn-merge');
  if (!btn) return;
  btn.classList.toggle('recycle-mode', on);
  const icon = document.getElementById('bb-coin-icon');
  if (on) {
    if (icon) icon.textContent = '🔥';
  } else {
    if (icon) icon.textContent = '❤️';
  }
}
// 回收一只猫：走 recycle_cat RPC，后端算奖励 + 行锁防双花
async function doRecycle(index, level) {
  // 关键：合成/移动后前端 sortGrid 会重排 index，而后端 grid 只在云同步时更新。
  // 若先回收、后同步，index/level 会与后端错位 → 后端判定「cat mismatch」而失败。
  // 因此回收前先把本地 grid 同步到后端，保证 index/level 与后端一致。
  await saveCloudNow();
  const r = await callRpc('recycle_cat', { index, level });
  if (!r || r.ok === false) {
    console.error('recycle_cat failed:', r && r.reason);
    toast(t('t_recycle_fail'), 'warn');
    return;
  }
  applyGridFromRpc(r.grid);
  // 回收 40 级猫：同步移除一个分红资格（个人中心分红只数 = 场上实际 40 级猫数）
  if (level >= MAX_LV && S.divCats.length > 0) {
    S.divCats.pop();
  }
  if (r.type === 'coins') {
    if (typeof r.reward === 'number') S.usdt = parseFloat((S.usdt + r.reward).toFixed(4));
    floatIncomeTop(r.reward);                       // 金币飞向 HUD
  } else if (r.type === 'usdt') {
    if (typeof r.reward === 'number') S.internalUsdt = parseFloat(((S.internalUsdt || 0) + r.reward).toFixed(6));
    toast('+$' + r.reward + ' USD₮', 'success');    // 美金到账提示（特效后续补）
  }
  ui();
  saveLocal();
  autoScrollCatTree();   // 回收后自动滚动
}

// ═══════ 新人 35 级猫（看广告2次 + 邀请2好友后领取）═══════
async function claimNewbieCat() {
  if (S.newbieCatClaimed) { toast(t('t_newbie_done'), 'warn'); return; }
  await saveCloudNow();   // 领取前先同步本地合成结果，避免后端旧 grid 覆盖撤回刚合成的猫
  const r = await callRpc('claim_newbie_cat', {});
  if (!r || r.ok === false) {
    if (r && r.reason === 'invites not enough') {
      // 邀请数不足：引导分享邀请
      confirmAd({
        icon: '👑',
        title: '邀请好友解锁',
        desc: '邀请两位好友即可解锁 35 级皇冠猫',
        okText: '邀请好友',
        onOk: inviteForNewbie
      });
    } else if (r && r.reason === 'ads not completed') {
      toast('广告还没看完，请先看广告解锁', 'warn');
    } else {
      toast(t('t_recycle_fail'), 'warn');
    }
    return;
  }
  S.newbieCatClaimed = true;
  applyGridFromRpc(r.grid);
  collect(35);
  ui();
  saveLocal();
  autoScrollCatTree();   // 新人猫后自动滚动
}

// ═══════ S1 奖池横幅：轮询 global_stats + CountUp 平滑滚动 ═══════
let _prizePoolVal = 0;
let _poolRaf = null;
function animatePrizePool(target) {
  const el = document.getElementById('prize-pool-amount');
  if (!el) { _prizePoolVal = target; return; }
  if (_poolRaf) cancelAnimationFrame(_poolRaf);
  const from = _prizePoolVal;
  const dur = 900;
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    const v = from + (target - from) * eased;
    el.textContent = '$' + v.toFixed(3);
    if (k < 1) _poolRaf = requestAnimationFrame(step);
    else { _prizePoolVal = target; _poolRaf = null; }
  };
  _poolRaf = requestAnimationFrame(step);
}
async function fetchPrizePool() {
  try {
    const initData = getInitData();
    const resp = await fetch(AUTH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_global_stats', initData })
    });
    const data = await resp.json();
    if (data.success && data.globalStats) {
      animatePrizePool(Number(data.globalStats.current_prize_pool) || 0);
    }
  } catch(_) {}
}
function startPrizePoolPolling() {
  fetchPrizePool();
  setInterval(fetchPrizePool, 15 * 60 * 1000);   // 15 分钟同步一次真实奖池（前端 900ms 平滑过渡）
}

// ═══════ 全服喜讯广播：猫抓板上方悬浮小喇叭（排队滚动播报）═══════
let _broadcastQueue = [];
let _broadcastPlaying = false;

async function reportMergeCritBroadcast(level, extra, coins) {
  try { await callRpc('report_merge_crit', { level, extra, coins }); } catch(_) {}
}

async function fetchBroadcasts() {
  try {
    const initData = getInitData();
    const resp = await fetch(AUTH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_broadcasts', initData })
    });
    const data = await resp.json();
    if (data.success && Array.isArray(data.broadcasts)) {
      // 一次拉满 50 条，直接替换本地队列（真实数据，本地轮播，不再高频增量拉取）
      _broadcastQueue = data.broadcasts.slice();
      if (!_broadcastPlaying) playNextBroadcast();
    }
  } catch(_) {}
}

function playNextBroadcast() {
  if (!_broadcastQueue.length) { _broadcastPlaying = false; return; }
  _broadcastPlaying = true;
  const b = _broadcastQueue.shift();
  showBroadcastText(b, () => { setTimeout(playNextBroadcast, 15000); });   // 每 15 秒轮播一条
}

function showBroadcastText(b, onDone) {
  const el = document.getElementById('broadcast-text');
  const track = document.querySelector('.broadcast-track');
  if (!el || !track) { if (onDone) onDone(); return; }
  const name = shortName(b.username || '???', 12);
  el.textContent = t('broadcast_msg')
    .replace('{name}', name)
    .replace('{extra}', b.extra || 0)
    .replace('{lv}', b.level || 0);
  // 先重置测宽度，再从右向左快速穿过
  el.style.transform = 'none';
  const textW = el.scrollWidth;
  const trackW = track.clientWidth;
  el.style.transform = 'translateX(' + trackW + 'px)';
  try {
    const anim = el.animate(
      [{ transform: 'translateX(' + trackW + 'px)' }, { transform: 'translateX(' + (-textW - 4) + 'px)' }],
      { duration: Math.max(1600, textW * 10), easing: 'linear' }
    );
    anim.onfinish = () => { if (onDone) onDone(); };
  } catch(_) {
    if (onDone) setTimeout(onDone, 1800);
  }
}

function startBroadcastPolling() {
  fetchBroadcasts();
  setInterval(fetchBroadcasts, 15 * 60 * 1000);   // 15 分钟拉一次 50 条，本地轮播
}

// ═══════ 动态空投：3-5 分钟随机生成补给箱（沿边缘游走 + 呼吸灯），点击弹合规确认窗 ═══════
function spawnAirdrop() {
  const layer = document.getElementById('airdrop-layer');
  if (!layer) return;
  layer.innerHTML = '';
  const box = d('div', 'airdrop-box');
  box.textContent = '📦';
  box.style.left = (Math.random() * 82 + 4) + '%';                 // 横向随机分布（覆盖左中右，避开最边缘被裁剪）
  box.style.top = (Math.random() * 45 + 12) + '%';                 // 视口中上部 12%-57%，确保可见且不遮底部按钮
  box.addEventListener('click', () => {
    confirmAd({ icon: '📦', title: t('confirm_airdrop_t'), desc: t('confirm_airdrop_d'), onOk: () => watchAirdropAd(box) });
  });
  layer.appendChild(box);
  setTimeout(() => { if (box.parentNode) box.remove(); }, 15000);   // 15 秒后消失
}
function watchAirdropAd(box) {
  showMonetagAd(() => {
    const reward = 5000;   // 空投金币补给（前端即时反馈 + 云同步）
    S.usdt = parseFloat((S.usdt + reward).toFixed(4));
    ui();
    toast('+5000 ' + t('level_coins_suf'), 'success');
    if (box && box.parentNode) box.remove();
    saveCloudNow();
  });
}
function startAirdrop() {
  const loop = () => {
    spawnAirdrop();
    setTimeout(loop, 60 * 1000);   // 每分钟掉一次
  };
  loop();
}

// ═══════ 加速收益广告：看广告领 3×当前秒收益（每日 15 次）═══════
const BOOST_AD_LIMIT = 15;
function boostAd() {
  if (S.boostAdUsed >= BOOST_AD_LIMIT) {
    toast('今日权益已用完', 'warn');
    return;
  }
  showMonetagAd(async () => {
    const amount = totalEarnPerSec() * 3;
    if (amount <= 0) {
      toast('当前还没有产出，先去合成猫咪吧', 'warn');
      return;
    }
    const r = await callRpc('boost_ad_reward', { amount });
    if (!r || r.ok === false) {
      if (r && r.reason === 'daily limit reached') {
        toast('今日权益已用完', 'warn');
      } else {
        toast(t('t_buy_fail'), 'warn');
      }
      return;
    }
    S.boostAdUsed = Number(r.used) || 0;
    S.usdt = parseFloat((S.usdt + (Number(r.reward) || 0)).toFixed(4));
    toast('加速收益 +' + fmtNum(Number(r.reward) || 0) + ' ' + t('level_coins_suf'), 'success');
    ui();
    saveLocal();
    saveCloudNow();
  });
}

function down(e) {
  if(e.button!==undefined&&e.button!==0) return;
  e.preventDefault(); e.stopPropagation();
  cleanDrag();
  let pe=e.currentTarget, s=pe.parentElement, i=parseInt(s.dataset.index), lv=S.grid[i];
  if(lv===null) return;
  setRecycleMode(true);   // 拖拽开始 → 中央按钮变身回收站
  let p=pos(e), cl=pe.cloneNode(true);
  cl.classList.add('pet-dragging');
  let r=s.getBoundingClientRect();
  cl.style.width=r.width+'px'; cl.style.height=r.height+'px';
  cl.style.left=p.x-r.width/2+'px'; cl.style.top=p.y-r.height/2+'px';
  document.body.appendChild(cl);
  pe.classList.add('pet-ghost');
  document.body.style.overflow='hidden';
  D = { on:true, i, lv, cl, gh:pe, sx:p.x, sy:p.y, ox:0, oy:0 };
}

function move(e) {
  if(!D.on) return;
  e.preventDefault();
  let p=pos(e); D.ox=p.x-D.sx; D.oy=p.y-D.sy;
  if(D.cl) D.cl.style.transform = 'translate('+D.ox+'px,'+D.oy+'px)';
}

function up(e) {
  if(!D.on) return;
  D.on = false;
  let cl = D.cl, gh = D.gh, sr = D.i, sl = D.lv, sx = D.sx, sy = D.sy;
  let ox = D.ox, oy = D.oy;
  D.cl = null; D.gh = null; D.i = -1; D.lv = 0; D.ox = 0; D.oy = 0;
  document.body.style.overflow = '';
  setRecycleMode(false);
  if(gh) gh.classList.remove('pet-ghost');
  let safeKill = setTimeout(() => {
    if(cl && cl.parentNode) { cl.style.transition = 'none'; cl.remove(); }
  }, 600);
  let p = pos(e), ex = p.x, ey = p.y;
  if(ex===undefined||ex===0){ ex=sx+ox; ey=sy+oy; }
  // 拖到中央按钮 → 回收站（走 recycle_cat RPC）
  if (isOverRecycleZone(ex, ey)) {
    if (cl) { cl.remove(); }
    clearTimeout(safeKill);
    doRecycle(sr, sl);
    return;
  }
  let tgt = at(ex, ey);
  if(tgt===-1||tgt===sr) {
    if(!cl) { clearTimeout(safeKill); return; }
    cl.classList.add('pet-snap-back');
    cl.addEventListener('animationend', ()=>{
      if(cl.parentNode) cl.remove();
      clearTimeout(safeKill);
    }, {once:true});
    return;
  }
  let tl = S.grid[tgt];
  if(tl===null) {
    if(!cl) { clearTimeout(safeKill); return; }
    let tr = g.children[tgt].getBoundingClientRect(), cr = cl.getBoundingClientRect();
    cl.style.transition = 'transform .2s cubic-bezier(.25,.8,.25,1.2)';
    cl.style.transform = 'translate('+(tr.left-cr.left+(tr.width-cr.width)/2)+'px,'+(tr.top-cr.top+(tr.height-cr.height)/2)+'px)';
    cl.addEventListener('transitionend', ()=>{
      if(cl.parentNode) cl.remove();
      clearTimeout(safeKill);
      S.grid[sr]=null; S.grid[tgt]=sl; draw(sr); draw(tgt);
      saveLocal();   // 移动猫后本地存档（云端由定时器/关闭兜底）
    }, {once:true});
    return;
  }
  if(tl!==sl) {
    if(!cl) { clearTimeout(safeKill); return; }
    cl.classList.add('pet-snap-back');
    cl.addEventListener('animationend', ()=>{
      if(cl.parentNode) cl.remove();
      clearTimeout(safeKill);
    }, {once:true});
    toast(t('t_wrong_type'),'warn');
    return;
  }
  // 满级猫不能再合成（否则 40+40 会白亏一只猫，还会重复记分红资格）
  if (sl >= MAX_LV) {
    if(!cl) { clearTimeout(safeKill); return; }
    cl.classList.add('pet-snap-back');
    cl.addEventListener('animationend', ()=>{
      if(cl.parentNode) cl.remove();
      clearTimeout(safeKill);
    }, {once:true});
    toast(t('t_max_level'),'warn');
    return;
  }
  const mr = mergeResultLv(sl);
  const nl = mr.nl;
  if(!cl) { clearTimeout(safeKill); return; }
  let tr2 = g.children[tgt].getBoundingClientRect(), cr2 = cl.getBoundingClientRect();
  cl.style.transition = 'transform .2s cubic-bezier(.25,.8,.25,1.2)';
  cl.style.transform = 'translate('+(tr2.left-cr2.left+(tr2.width-cr2.width)/2)+'px,'+(tr2.top-cr2.top+(tr2.height-cr2.height)/2)+'px)';
  cl.addEventListener('transitionend', ()=>{
    if(cl.parentNode) cl.remove();
    clearTimeout(safeKill);
    S.grid[sr]=null; S.grid[tgt]=nl;          // 完成合成
    if (nl === MAX_LV) S.divCats.push(4);     // 合成出40级猫：记一次分红资格（剩余4次）
    sortGrid();                                // 自动排序：最高等级排第一个
    const ni = S.grid.indexOf(nl);             // 找新等级排序后的位置
    if (ni >= 0) boom(ni);                     // 在正确位置触发合成闪光
    collect(nl);
    // 合成金币奖励（10% +1500，5% +2500）
    if (mr.coins > 0) {
      S.usdt = parseFloat((S.usdt + mr.coins).toFixed(4));
      toast(t('t_merge_coin').replace('{coins}', mr.coins),'success');
    }
    if (mr.crit) {
      audio.play('merge_combo');               // 💥 暴击连击音
      reportMergeCritBroadcast(nl, mr.extra, mr.coins);  // 全服喜讯广播
      toast(t('t_merge_crit').replace('{name}', catName(nl)).replace('{lv}', nl),'success');
    } else {
      audio.sfxMerge();                        // 🔔 合成成功音效
      toast(t('t_merge_success').replace('{name}', catName(nl)).replace('{lv}', nl),'success');
    }
    ui();
    saveLocal();   // 合成后本地存档（云端由定时器/关闭兜底）
  }, {once:true});
}

function at(x,y){
  for(let i=0;i<g.children.length;i++){
    let r=g.children[i].getBoundingClientRect();
    if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom) return i;
  }
  return -1;
}

function boom(i, opts){
  opts = opts || {};
  let s=g.children[i]; if(!s)return;
  s.classList.add('has-merge-flash');
  let f=d('div','merge-flash'); s.appendChild(f);
  f.addEventListener('animationend',()=>{f.remove();s.classList.remove('has-merge-flash');},{once:true});
  // 全屏震动只在手动合成时触发；智能合成高频时关闭，避免持续整屏重排导致交互卡顿
  if (opts.shake !== false) {
    let a=document.getElementById('app');
    if(a){a.classList.add('screen-shake');a.addEventListener('animationend',()=>a.classList.remove('screen-shake'),{once:true});}
  }
}

// ═══════ 全局事件 ═══════
function ev(){
  // 交互让道：只在「点击/拖拽开始」时暂停 AI，不监听 move（避免手指滑动页面也触发，导致 AI 停停走走）
  document.addEventListener('touchstart', markInteracting, { passive: true, capture: true });
  document.addEventListener('mousedown',  markInteracting, { capture: true });

  document.addEventListener('touchmove', e=>{ if(D.on) move(e); }, {passive:false});
  document.addEventListener('touchend',  e=>{ if(D.on) up(e); });
  document.addEventListener('touchcancel', e=>{ cleanDrag(); });
  document.addEventListener('mousemove', e=>{ if(D.on) move(e); });
  document.addEventListener('mouseup',   e=>{ if(D.on) up(e); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') cleanDrag(); });
}

// ═══════ 个人中心：渲染玩家全部数据 ═══════
function renderProfile() {
  const userLv = Math.max(1, maxUnlockedLv());
  // 40级分红只数：直接用场上实际 40 级猫数量（grid），避免 divCats 与 grid 不同步
  const divCount = S.grid.filter(lv => lv === MAX_LV).length;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('pf-lv', 'Lv.' + userLv);
  set('pf-coins', fmtNum(S.usdt));
  set('pf-usdt', '$' + (Number(S.internalUsdt) || 0).toFixed(2));
  set('pf-earn', fmtNum(totalEarnPerSec()));
  set('pf-invite', String(S.inviteCount || 0));
  set('pf-weekad', String(S.weekAdCount || 0));
  set('pf-divcats', divCount + ' 只' + (divCount > 0 ? '（剩余 ' + Array(divCount).fill(4).join('/') + ' 次）' : ''));
  set('pf-ref', S.refCode || '-');
  const avatar = document.getElementById('pf-avatar');
  if (avatar) avatar.src = '/cats_new/LV.' + userLv + '.png';
  const walletBtn = document.querySelector('#pf-connect-wallet span');
  if (walletBtn) walletBtn.textContent = wallet.address ? shortAddr(wallet.address) : t('profile_wallet');
}

// ═══════ 推特赚金：9:16 赛博朋克/超梦海报生成 + X 分享 ═══════
const POSTER_QUOTES = {
  zh: [
    '猫咪不问对错，只问罐头。',
    '在这个赛博世界，猫是最后的温柔。',
    '今天也要像猫一样，优雅地躺平。',
    '代码会崩，猫不会。',
    '别急，猫都知道答案。',
    '摸鱼是一种态度，猫是大师。',
    '生活很苦，还好猫很甜。',
    '再忙也要像猫一样伸个懒腰。',
    '猫咪的呼噜声，是最好的白噪音。',
    '有些路要自己走，有些罐头要自己开。',
    '今天不开心？吸一口猫就好了。',
    '猫生赢家：睡到自然醒，吃到自然胖。',
    '世界很大，猫窝最暖。',
    '别慌，猫还没跑，说明还有救。',
    '越努力越幸运，越撸猫越快乐。',
    '猫咪教会我们：享受当下。',
    '有时候，躺平也是一种智慧。',
    '愿你像猫，被世界温柔以待。',
    '猫的瞳孔里，藏着星辰大海。',
    '今天也是猫系打工人。',
    '猫爪踩过的每一步，都算数。',
    '不要焦虑，猫自有安排。',
    '生活的解药：猫、茶、好心情。',
    '猫咪一笑，烦恼全消。',
    '做个像猫一样自由的人。',
    '世界以痛吻我，我以猫治愈。',
    '猫是软软的，日子是暖暖的。',
    '别熬夜了，猫都睡了。',
    '你负责努力，猫负责可爱。',
    '罐头会有的，猫也会有的。',
    '猫尾巴一甩，好运自然来。',
    '今天也要元气满满喵。',
    '有猫在，孤独自动退散。',
    '猫的眼睛会说话。',
    '人间值得，因为猫在。',
    '摸摸猫头，烦恼没有。',
    '猫式哲学：吃饱就睡，睡醒就玩。',
    '你养的不是猫，是治愈系神器。',
    '猫的温柔，胜过千言万语。',
    '一路有你，喵不可言。',
    '猫咪的陪伴，是最好的礼物。',
    '别怕，猫会陪着你。',
    '今天也要做个可爱的人。',
    '猫与星光，皆不可辜负。',
    '生活明朗，猫生可爱。',
    '一起合成，一起发财，一起吸猫。',
    '猫是液态的，快乐也是。',
    '心里有猫，眼里有光。',
    '慢下来，像猫一样生活。',
    '愿每个爱猫的人都被好运眷顾。',
  ],
  en: [
    'Cats don\'t ask questions, only for food.',
    'In a cyber world, cats are the softest glitch.',
    'Stay curious, stay cat.',
    'Code breaks, cats don\'t.',
    'The future is feline.',
    'Purr over profit.',
    'Life is hard, but cats are soft.',
    'Stretch like nobody\'s watching.',
    'A cat\'s purr is the best white noise.',
    'Some doors you open yourself.',
    'Bad day? Pet a cat.',
    'Sleep in, eat well, live like a cat.',
    'The world is big, the cat bed is warm.',
    'Don\'t panic, the cat is still here.',
    'Work hard, pet harder.',
    'Cats teach us to enjoy the moment.',
    'Sometimes, resting is wisdom.',
    'May you be treated gently, like a cat.',
    'A cat\'s eyes hide the stars.',
    'Powered by coffee and cats.',
    'Every paw step counts.',
    'Don\'t worry, the cat has a plan.',
    'The cure: cat, tea, good mood.',
    'A cat\'s smile melts worries.',
    'Be as free as a cat.',
    'The world wounds, cats heal.',
    'Soft cats, warm days.',
    'Stop scrolling, the cat is asleep.',
    'You do the work, the cat does the cute.',
    'There will be cans, there will be cats.',
    'A flick of the tail brings luck.',
    'Full of energy, meow.',
    'With a cat, loneliness fades.',
    'A cat\'s eyes speak.',
    'Life is worth it because of cats.',
    'Pat the cat, lose the stress.',
    'Eat, sleep, play — cat philosophy.',
    'You didn\'t adopt a cat, you adopted therapy.',
    'A cat\'s warmth says more than words.',
    'Along the way, meow forever.',
    'A cat\'s company is the best gift.',
    'Don\'t be afraid, the cat is with you.',
    'Be someone\'s sunshine today.',
    'Cats and starlight, both unmissable.',
    'Life is bright, cats are cute.',
    'Merge, earn, and pet cats.',
    'Cats are liquid, and so is happiness.',
    'A cat in the heart, light in the eyes.',
    'Slow down, live like a cat.',
    'May every cat lover be lucky.',
  ],
  ru: [
    'Кошки не задают вопросов, только просят еду.',
    'В кибер-мире кошки — самый тёплый сбой.',
    'Оставайся любопытным, оставайся котом.',
    'Код ломается, кошки — нет.',
    'Будущее за кошками.',
    'Мурлыканье важнее прибыли.',
    'Жизнь трудна, но кошки мягкие.',
    'Потянись, как будто никто не смотрит.',
    'Мурлыканье кошки — лучший белый шум.',
    'Некоторые двери открываешь сам.',
    'Плохой день? Погладь кота.',
    'Спи дольше, ешь лучше — живи как кот.',
    'Мир большой, а кошачья лежанка тёплая.',
    'Не паникуй, кот ещё здесь.',
    'Работай усердно, гладь ещё усерднее.',
    'Кошки учат наслаждаться моментом.',
    'Иногда отдых — это мудрость.',
    'Пусть с тобой обходятся нежно, как с котом.',
    'В глазах кошки прячутся звёзды.',
    'Работает на кофе и кошках.',
    'Каждый шаг лапки важен.',
    'Не волнуйся, у кота есть план.',
    'Лекарство: кот, чай, хорошее настроение.',
    'Улыбка кота растапливает тревоги.',
    'Будь свободным, как кот.',
    'Мир ранит, кошки лечат.',
    'Мягкие кошки, тёплые дни.',
    'Хватит скроллить, кот уже спит.',
    'Ты работаешь, кот милуется.',
    'Будут и консервы, и кошки.',
    'Взмах хвоста приносит удачу.',
    'Полный энергии, мяу.',
    'С котом одиночество уходит.',
    'Глаза кошки говорят.',
    'Жизнь стоит того из-за кошек.',
    'Погладь кота — забудь стресс.',
    'Ешь, спи, играй — философия кота.',
    'Ты завёл не кота, а терапию.',
    'Тепло кошки говорит больше слов.',
    'По пути — мяу навсегда.',
    'Компания кота — лучший подарок.',
    'Не бойся, кот с тобой.',
    'Будь чьим-то солнцем сегодня.',
    'Кошки и звёзды — нельзя пропустить.',
    'Жизнь светла, кошки милы.',
    'Объединяй, зарабатывай и гладь котов.',
    'Кошки жидкие, и счастье тоже.',
    'Кот в сердце — свет в глазах.',
    'Замедлись, живи как кот.',
    'Пусть всем любителям кошек везёт.',
  ],
};
function randomQuote() {
  const list = POSTER_QUOTES[_lang] || POSTER_QUOTES.zh;
  return list[Math.floor(Math.random() * list.length)];
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
// 生成并绘制游戏链接二维码（白底 + 黑码，保证可扫）
async function drawQrCode(ctx, cx, cy, size, text) {
  try {
    const mod = await import('qrcode');
    const QR = mod.default || mod;
    const dataUrl = await QR.toDataURL(text, {
      width: 256, margin: 1, errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    const img = await loadImage(dataUrl);
    const x = cx - size / 2, y = cy - size / 2;
    const pad = size * 0.07;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - pad, y - pad, size + pad * 2, size + pad * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - pad, y - pad, size + pad * 2, size + pad * 2);
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
  } catch (_) {}
}
function neonText(ctx, text, x, y, font, fill, glow) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = glow;
  ctx.shadowBlur = 18;
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillText(text, x, y);
  ctx.restore();
}
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = String(text).split('');
  const lines = [];
  let line = '';
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = chars[i]; }
    else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((ln, idx) => { ctx.fillText(ln, x, y + idx * lineHeight); });
  return lines.length * lineHeight;
}
let _posterStyle = 'cyberpunk';
const POSTER_STYLES = {
  cyberpunk: {
    titleFill: '#ffd6ff', titleGlow: '#ff00aa',
    sub: 'MERGE CATS · WIN THE POOL', subFill: '#7ff7ff', subGlow: '#00ffff',
    lvFill: '#ffe066', lvGlow: '#ffaa00',
    quoteFill: '#ffffff', quoteGlow: '#ff00aa',
    catGlow: '#00ffff', catBase: 'rgba(255,0,170,0.5)',
    watermark: 'rgba(255,255,255,0.55)',
  },
  dreamland: {
    titleFill: '#d81b8f', titleGlow: '#ff9ecf',
    sub: 'DREAM · SWEET · CUTE', subFill: '#8e24aa', subGlow: '#e1bee7',
    lvFill: '#e91e8c', lvGlow: '#ffb6d9',
    quoteFill: '#5d3a6b', quoteGlow: '#ff9ecf',
    catGlow: '#ff9ecf', catBase: 'rgba(255,158,207,0.45)',
    watermark: 'rgba(120,60,120,0.55)',
  },
  cute: {
    titleFill: '#f4511e', titleGlow: '#ffd54f',
    sub: 'KAWAII · PURR · LOVE', subFill: '#ef6c00', subGlow: '#ffcc80',
    lvFill: '#ff7043', lvGlow: '#ffccbc',
    quoteFill: '#6d4c41', quoteGlow: '#ffab91',
    catGlow: '#ffd54f', catBase: 'rgba(255,213,79,0.45)',
    watermark: 'rgba(120,80,40,0.55)',
  },
};
function fillBg(ctx, W, H, colors) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, colors[0]);
  bg.addColorStop(0.5, colors[1]);
  bg.addColorStop(1, colors[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);   // 实色全覆盖，保证海报不透明
}
function drawCyberBg(ctx, W, H) {
  fillBg(ctx, W, H, ['#2b0a4e', '#12052e', '#041226']);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.22, 0, W * 0.5, H * 0.22, W * 0.7);
  g.addColorStop(0, 'rgba(255,0,170,0.30)');
  g.addColorStop(1, 'rgba(255,0,170,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,255,255,0.16)'; ctx.lineWidth = 1.2;
  for (let i = 0; i <= 18; i++) { const y = H * 0.12 + (H * 0.88 * i / 18); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let i = -9; i <= 9; i++) { const x = W / 2 + i * (W / 16); ctx.beginPath(); ctx.moveTo(x, H * 0.12); ctx.lineTo(W / 2 + (x - W / 2) * 2.6, H); ctx.stroke(); }
}
function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    const a2 = a + Math.PI / 5;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a2) * r * 0.5, y + Math.sin(a2) * r * 0.5);
  }
  ctx.closePath(); ctx.fill();
}
function drawHeart(ctx, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 16, s / 16); ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.bezierCurveTo(0, 0, -8, -6, -8, 2);
  ctx.bezierCurveTo(-8, 8, 0, 12, 0, 14);
  ctx.bezierCurveTo(0, 12, 8, 8, 8, 2);
  ctx.bezierCurveTo(8, -6, 0, 0, 0, 4);
  ctx.fill(); ctx.restore();
}
function drawPaw(ctx, x, y, s) {
  ctx.beginPath(); ctx.ellipse(x, y + s * 0.3, s, s * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  [[-s * 0.6, -s * 0.4], [0, -s * 0.85], [s * 0.6, -s * 0.4]].forEach(([dx, dy]) => {
    ctx.beginPath(); ctx.arc(x + dx, y + dy, s * 0.28, 0, Math.PI * 2); ctx.fill();
  });
}
function drawDreamBg(ctx, W, H) {
  fillBg(ctx, W, H, ['#ffe8f3', '#f6d6ff', '#dcd6ff']);
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = 12 + Math.random() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 40; i++) { drawStar(ctx, Math.random() * W, Math.random() * H * 0.8, 2 + Math.random() * 4); }
}
function drawCuteBg(ctx, W, H) {
  fillBg(ctx, W, H, ['#fff6de', '#ffe6cd', '#ffd7d7']);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * H, 8 + Math.random() * 20, 0, Math.PI * 2); ctx.fill(); }
  for (let i = 0; i < 16; i++) { drawHeart(ctx, Math.random() * W, Math.random() * H * 0.85, 10 + Math.random() * 22, 'rgba(255,138,128,0.4)'); }
  ctx.fillStyle = 'rgba(255,183,77,0.45)';
  for (let i = 0; i < 18; i++) { drawPaw(ctx, Math.random() * W, Math.random() * H, 8 + Math.random() * 14); }
}
async function renderPoster(style) {
  style = style || _posterStyle || 'cyberpunk';
  const conf = POSTER_STYLES[style] || POSTER_STYLES.cyberpunk;
  const canvas = document.getElementById('poster-canvas');
  if (!canvas) return;
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  const lv = Math.max(1, maxUnlockedLv());
  const cat = CATS[lv] || CATS[1];
  const quote = randomQuote();
  const name = catName(lv);
  const username = S.username || 'Player';

  ctx.clearRect(0, 0, W, H);
  if (style === 'dreamland') drawDreamBg(ctx, W, H);
  else if (style === 'cute') drawCuteBg(ctx, W, H);
  else drawCyberBg(ctx, W, H);

  neonText(ctx, 'CYBERMERGE', W / 2, H * 0.085, '900 64px "Segoe UI",sans-serif', conf.titleFill, conf.titleGlow);
  neonText(ctx, conf.sub, W / 2, H * 0.13, '700 26px "Segoe UI",sans-serif', conf.subFill, conf.subGlow);

  // 当前最高等级猫图
  try {
    const img = await loadImage(cat.img);
    const size = Math.min(W * 0.62, H * 0.32);
    const sx = (W - size) / 2, sy = H * 0.19;
    const g2 = ctx.createRadialGradient(W / 2, sy + size * 0.55, size * 0.1, W / 2, sy + size * 0.55, size * 0.75);
    g2.addColorStop(0, conf.catBase);
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.shadowColor = conf.catGlow; ctx.shadowBlur = 40;
    ctx.drawImage(img, sx, sy, size, size);
    ctx.restore();
  } catch (_) {}

  neonText(ctx, 'LV.' + lv + '  ' + name, W / 2, H * 0.565, '900 44px "Segoe UI",sans-serif', conf.lvFill, conf.lvGlow);

  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = conf.quoteGlow; ctx.shadowBlur = 16;
  ctx.fillStyle = conf.quoteFill;
  ctx.font = '700 34px "PingFang SC","Microsoft YaHei",sans-serif';
  wrapText(ctx, '「' + quote + '」', W / 2, H * 0.615, W * 0.8, 50);
  ctx.restore();

  // 游戏链接二维码（白底黑码，保证可扫）
  await drawQrCode(ctx, W / 2, H * 0.79, 170, buildInviteLink());

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = conf.watermark;
  ctx.font = '500 24px "Segoe UI",sans-serif';
  ctx.fillText('@' + username + ' · CyberMerge', W / 2, H * 0.965);

  canvas.dataset.quote = quote;
  canvas.dataset.style = style;
}
function openPoster() {
  const modal = document.getElementById('poster-modal');
  if (!modal) return;
  modal.classList.add('show');
  renderPoster(_posterStyle);
}
function closePoster() {
  document.getElementById('poster-modal')?.classList.remove('show');
}
async function grantShareReward() {
  const r = await callRpc('daily_share_reward', {});
  if (r && r.ok) {
    const reward = Number(r.reward) || 0;   // 后端返回字段是 reward
    if (reward > 0) S.usdt = parseFloat((S.usdt + reward).toFixed(4));
    ui();
    toast(t('t_task_done').replace('{icon}', '🐦').replace('{coins}', reward), 'success');
    saveLocal();
  }
}
async function sharePosterToX() {
  const canvas = document.getElementById('poster-canvas');
  if (!canvas) return;
  const quote = canvas.dataset.quote || randomQuote();
  const text = t('t_share_text') + ' ' + quote;
  try {
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    if (blob) {
      const file = new File([blob], 'cybermerge-poster.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'CyberMerge', text });
        grantShareReward();
        return;
      }
    }
  } catch (e) {
    if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return;  // 用户取消分享
  }
  // 降级：X 文字 intent + 下载海报图（纯前端无法直接把图片发到 X，需 X API 授权）
  const url = encodeURIComponent(buildInviteLink());
  window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + url, '_blank');
  try {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'cybermerge-poster.png';
    a.click();
  } catch (_) {}
  grantShareReward();
}

// ═══════ 按钮 ═══════
function btn(){
  // 全球等级榜按钮：打开弹窗并拉取真实排行榜（按等级）
  const lbModal = document.getElementById('leaderboard-modal');
  const openLeaderboard = () => { lbModal?.classList.add('show'); updateSeasonUI(); fetchSeasonBoard(); };
  const closeLeaderboard = () => lbModal?.classList.remove('show');
  document.getElementById('btn-leaderboard')?.addEventListener('click', openLeaderboard);
  document.getElementById('leaderboard-close')?.addEventListener('click', closeLeaderboard);
  lbModal?.addEventListener('click', (e) => { if (e.target.id === 'leaderboard-modal') closeLeaderboard(); });

  // 排行榜 Tab 切换（赛季榜 / 本周邀请榜）
  const lbTabs = document.querySelectorAll('.lb-tab');
  lbTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      lbTabs.forEach(t => t.classList.remove('lb-tab-active'));
      tab.classList.add('lb-tab-active');
      if (tab.dataset.tab === 'invite') {
        fetchInviteBoard();      // 邀请榜：本周邀请数（周一 8 点重置）
      } else {
        fetchSeasonBoard();      // 赛季榜：40级份额数
      }
    });
  });

  // 个人中心：点整条 HUD 通栏（全局热区）从右侧滑出
  const pfModal = document.getElementById('profile-modal');
  const openProfile = () => { renderProfile(); pfModal?.classList.add('show'); };
  const closeProfile = () => pfModal?.classList.remove('show');
  document.getElementById('hud-panel')?.addEventListener('click', openProfile);
  document.getElementById('profile-close')?.addEventListener('click', closeProfile);
  pfModal?.addEventListener('click', (e) => { if (e.target.id === 'profile-modal') closeProfile(); });
  // 连接 TON 钱包
  document.getElementById('pf-connect-wallet')?.addEventListener('click', connectWallet);
  // 游戏设置：打开系统设置
  document.getElementById('pf-settings')?.addEventListener('click', () => { closeProfile(); openSettings(); });
  // USDT Claim（自付 Gas 提现，门槛 10 USD₮，走 TonConnect 转账 + 后端工单）
  document.getElementById('pf-withdraw')?.addEventListener('click', () => {
    doWithdraw();
  });
  document.getElementById('pf-copy-ref')?.addEventListener('click', () => {
    if (!S.refCode) { toast('暂无邀请码', 'warn'); return; }
    const link = buildInviteLink();
    try { navigator.clipboard?.writeText(link); toast(t('profile_copied'), 'success'); }
    catch(_) { toast(t('profile_ref') + ': ' + link, 'info'); }
  });

  document.getElementById('btn-merge')?.addEventListener('click',buy);
  // 推特赚金：点击生成 9:16 海报 → 预览 → 分享 X
  document.getElementById('btn-twitter')?.addEventListener('click', openPoster);
  document.getElementById('poster-close')?.addEventListener('click', closePoster);
  document.getElementById('poster-modal')?.addEventListener('click', (e) => { if (e.target.id === 'poster-modal') closePoster(); });
  document.getElementById('poster-share-x')?.addEventListener('click', sharePosterToX);
  // 海报风格切换
  document.querySelectorAll('.poster-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.poster-tab').forEach(t => t.classList.remove('poster-tab-active'));
      tab.classList.add('poster-tab-active');
      _posterStyle = tab.dataset.style;
      renderPoster(_posterStyle);
    });
  });
  document.getElementById('btn-invite')?.addEventListener('click', () => {
    // 邀请链接带上当前用户 tgId，被邀请者点进来后 start_param 会带上这个 ID
    const inviteUrl = buildInviteLink();
    // Telegram 内：走原生分享，弹出好友选择
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(inviteUrl) + '&text=' + encodeURIComponent(t('t_share_text')));
    } else {
      // 外部浏览器 fallback：复制链接 + toast 提示
      try {
        navigator.clipboard?.writeText(inviteUrl);
        toast(t('t_invite_copied'), 'success');
      } catch (_) {
        toast(t('t_invite_link') + inviteUrl, 'info');
      }
    }
  });
  document.getElementById('btn-ads')?.addEventListener('click',openPokedex);
  document.getElementById('btn-profile')?.addEventListener('click', openProfile);
  // 社区：打开 Telegram 群链接
  document.getElementById('btn-community')?.addEventListener('click', () => {
    if (tg && tg.openTelegramLink) tg.openTelegramLink('https://t.me/lcz8com');
    else window.open('https://t.me/lcz8com', '_blank');
  });
  // 快捷设置圆标：打开系统设置（openSettings 在下方定义，用箭头函数延迟求值）
  document.getElementById('btn-quick-settings')?.addEventListener('click', () => openSettings());
  // TON 钱包链接已移入个人中心（pf-connect-wallet）
  document.getElementById('task-close')?.addEventListener('click', closeTasks);
  document.getElementById('task-modal')?.addEventListener('click', (e) => { if (e.target.id === 'task-modal') closeTasks(); });
  document.getElementById('pokedex-close')?.addEventListener('click',closePokedex);
  document.getElementById('pokedex-modal')?.addEventListener('click',(e)=>{ if(e.target.id==='pokedex-modal') closePokedex(); });
  // 离线收益弹窗：领取按钮 / 点击遮罩关闭
  document.getElementById('offline-claim')?.addEventListener('click', closeOfflineReward);
  document.getElementById('offline-modal')?.addEventListener('click', (e) => { if (e.target.id === 'offline-modal') closeOfflineReward(); });
  const aiBtn = document.querySelector('.ai-merge-btn');
  if (aiBtn) {
    aiBtn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleAiMerge(e); });
  }
  document.querySelector('.coin-btn')?.addEventListener('click',()=>toast(t('t_coin_soon'),'info'));
  // ═══════ 系统设置面板 ═══════
  const settingsModal = document.getElementById('settings-modal');
  const openSettings = () => settingsModal?.classList.add('show');
  const closeSettings = () => settingsModal?.classList.remove('show');
  document.getElementById('settings-close')?.addEventListener('click', closeSettings);
  settingsModal?.addEventListener('click', (e) => { if (e.target.id === 'settings-modal') closeSettings(); });

  // 音乐 / 音效开关（持久化到 localStorage）
  const MUSIC_KEY = 'cybermerge_music';
  const SFX_KEY = 'cybermerge_sfx';
  const applyToggleState = (el, key) => {
    if (!el) return;
    const on = localStorage.getItem(key) === '1';
    el.dataset.on = on ? 'true' : 'false';
  };
  const musicToggle = document.getElementById('toggle-music');
  const sfxToggle = document.getElementById('toggle-sfx');
  // 首次访问默认开启音乐和音效（未设置过时默认 '1'）
  if (localStorage.getItem(MUSIC_KEY) === null) localStorage.setItem(MUSIC_KEY, '1');
  if (localStorage.getItem(SFX_KEY) === null) localStorage.setItem(SFX_KEY, '1');
  applyToggleState(musicToggle, MUSIC_KEY);
  applyToggleState(sfxToggle, SFX_KEY);
  // 初始化时同步 audio 状态（音效开关）
  audio.sfxEnabled = localStorage.getItem(SFX_KEY) === '1';
  // 浏览器自动播放策略：首次用户交互时启动 BGM
  // （不 once：若 autoplay 被拦截 / 音频尚未就绪，后续交互会重试）
  const unlockAudio = () => {
    audio.init();
    if (localStorage.getItem(MUSIC_KEY) === '1') audio.startBgm();
  };
  document.addEventListener('pointerdown', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);
  document.addEventListener('keydown', unlockAudio);
  musicToggle?.addEventListener('click', () => {
    const on = musicToggle.dataset.on === 'true';
    musicToggle.dataset.on = (!on).toString();
    try { localStorage.setItem(MUSIC_KEY, (!on) ? '1' : '0'); } catch(_) {}
    if (!on) audio.startBgm(); else audio.stopBgm();   // 开→播 BGM；关→停 BGM
    toast(on ? t('t_music_off') : t('t_music_on'), 'info');
    saveLocal();   // 更改设置本地存档（云端由定时器兜底）
  });
  sfxToggle?.addEventListener('click', () => {
    const on = sfxToggle.dataset.on === 'true';
    sfxToggle.dataset.on = (!on).toString();
    try { localStorage.setItem(SFX_KEY, (!on) ? '1' : '0'); } catch(_) {}
    audio.sfxEnabled = !on;                             // 同步音效开关
    if (audio.sfxEnabled) audio.sfxMerge();             // 立即试听一下合成音
    toast(on ? t('t_sfx_off') : t('t_sfx_on'), 'info');
    saveLocal();   // 更改设置本地存档（云端由定时器兜底）
  });

  // 语言切换：改 _lang → 持久化 → 高亮当前按钮 → 调 applyI18n() 真正切换全站文本
  // silent=true 时不弹 toast（用于初始化恢复上次语言）
  const LANG_KEY = 'cybermerge_lang';
  const langBtns = document.querySelectorAll('.lang-btn');
  const applyLang = (lang, silent) => {
    if (lang !== 'zh' && lang !== 'en' && lang !== 'ru') return;
    _lang = lang;                                  // 切换全局语言变量
    langBtns.forEach(b => b.classList.toggle('lang-active', b.dataset.lang === lang));
    try { localStorage.setItem(LANG_KEY, lang); } catch(_) {}
    applyI18n();                                   // ← 核心：真正替换所有 [data-i18n] 元素文本
    if (!silent) {
      toast('🌍 Language: ' + ({zh:'中文', en:'English', ru:'Русский'})[lang], 'info');
      saveLocal();   // 更改语言本地存档（云端由定时器兜底）
    }
  };
  const savedLang = (() => { try { return localStorage.getItem(LANG_KEY) || 'zh'; } catch(_) { return 'zh'; } })();
  applyLang(savedLang, true);                      // 初始化静默恢复，不弹 toast
  langBtns.forEach(b => b?.addEventListener('click', () => applyLang(b.dataset.lang)));
}

// ═══════ 全球等级榜：拉取 + 渲染真实数据（按等级）═══════
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 榜单用户名过长时截断，避免撑坏布局
function shortName(name, max) {
  const s = String(name == null ? '' : name).trim();
  return s.length > max ? s.slice(0, max) + '…' : s;
}

async function fetchSeasonBoard() {
  const listEl = document.getElementById('leaderboard-list');
  const myRankEl = document.getElementById('lb-my-rank');
  if (!listEl) return;
  listEl.innerHTML = '<div class="lb-empty">' + t('lb_loading') + '</div>';
  try {
    const initData = getInitData();
    const resp = await fetch(AUTH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seasonboard', initData })
    });
    const data = await resp.json();
    if (!data.success || !data.seasonboard) throw new Error('empty');
    renderSeasonBoard(data.seasonboard);
  } catch(_) {
    if (listEl) listEl.innerHTML = '<div class="lb-empty">' + t('season_empty') + '</div>';
    if (myRankEl) myRankEl.textContent = '—';
  }
}

function renderSeasonBoard(sb) {
  const listEl = document.getElementById('leaderboard-list');
  const myRankEl = document.getElementById('lb-my-rank');
  if (!listEl) return;
  const items = Array.isArray(sb.list) ? sb.list : [];
  if (myRankEl) myRankEl.textContent = sb.myRank ? '#' + sb.myRank : '—';
  if (!items.length) {
    listEl.innerHTML = '<div class="lb-empty">' + t('season_empty') + '</div>';
    return;
  }
  listEl.innerHTML = items.map(p => {
    return '<div class="lb-item' + (p.isMe ? ' lb-item-me' : '') + '">' +
      '<span class="lb-rank">' + p.rank + '</span>' +
      '<span class="lb-name">' + escapeHtml(shortName(p.username, 6)) + '</span>' +
      '<span class="lb-lv">40级 × ' + p.shares + ' ' + t('season_shares_unit') + '</span>' +
    '</div>';
  }).join('');
}

// ═══════ 本周邀请榜：拉取 + 渲染（按本周邀请数，周一 8 点重置）═══════
async function fetchInviteBoard() {
  const listEl = document.getElementById('leaderboard-list');
  const myRankEl = document.getElementById('lb-my-rank');
  if (!listEl) return;
  listEl.innerHTML = '<div class="lb-empty">' + t('lb_loading') + '</div>';
  try {
    const initData = getInitData();
    const resp = await fetch(AUTH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'inviteboard', initData })
    });
    const data = await resp.json();
    if (!data.success || !data.inviteboard) throw new Error('empty');
    renderInviteBoard(data.inviteboard);
  } catch(_) {
    if (listEl) listEl.innerHTML = '<div class="lb-empty">' + t('lb_empty_invite') + '</div>';
    if (myRankEl) myRankEl.textContent = '—';
  }
}

function renderInviteBoard(b) {
  const listEl = document.getElementById('leaderboard-list');
  const myRankEl = document.getElementById('lb-my-rank');
  if (!listEl) return;
  const items = Array.isArray(b.list) ? b.list : [];
  if (myRankEl) myRankEl.textContent = b.myRank ? '#' + b.myRank : '—';
  if (!items.length) {
    listEl.innerHTML = '<div class="lb-empty">' + t('lb_empty_invite') + '</div>';
    return;
  }
  listEl.innerHTML = items.map(p => {
    return '<div class="lb-item' + (p.isMe ? ' lb-item-me' : '') + '">' +
      '<span class="lb-rank">' + p.rank + '</span>' +
      '<span class="lb-name">' + escapeHtml(shortName(p.username, 14)) + '</span>' +
      '<span class="lb-lv">' + p.count + ' ' + t('lb_invite_unit') + '</span>' +
    '</div>';
  }).join('');
}

// ═══════ 猫咪图鉴 ═══════
function openPokedex() {
  const modal = document.getElementById('pokedex-modal');
  const grid = document.getElementById('pokedex-grid');
  if (!modal || !grid) return;
  grid.innerHTML = '';
  for (let lv = 1; lv <= MAX_LV; lv++) {
    const c = CATS[lv];
    const unlocked = collected.has(lv);
    const item = d('div', 'pd-item' + (unlocked ? '' : ' locked'));
    item.innerHTML =
      '<span class="pd-lv">LV.' + lv + '</span>' +
      '<img src="' + c.img + '" alt="' + catName(lv) + '" draggable="false" />';
    grid.appendChild(item);
  }
  document.getElementById('ps-collected').textContent = collected.size;
  document.getElementById('ps-progress').style.width = (collected.size / MAX_LV * 100) + '%';
  modal.classList.add('show');
}

function closePokedex() {
  document.getElementById('pokedex-modal')?.classList.remove('show');
}

// ═══════ 启动加载：预加载音乐 + 猫咪图片 ═══════
function collectAssetUrls() {
  const urls = [];
  for (let lv = 1; lv <= MAX_LV; lv++) {
    if (CATS[lv] && CATS[lv].img) urls.push(CATS[lv].img);
  }
  urls.push('/sounds/bgm.mp3', '/sounds/merge.mp3', '/sounds/merge_combo.mp3');
  return urls;
}

function preloadAssets(onProgress, onDone) {
  const urls = collectAssetUrls();
  let done = 0;
  const total = urls.length;
  if (!total) { onProgress(1); onDone(); return; }

  const markDone = () => {
    done++;
    onProgress(Math.min(1, done / total));
    if (done >= total) onDone();
  };

  urls.forEach(url => {
    const isAudio = /\.(mp3|m4a|ogg|wav)$/i.test(url);
    let settled = false;
    const settle = () => { if (!settled) { settled = true; markDone(); } };
    if (isAudio) {
      const a = new Audio();
      a.preload = 'auto';
      a.src = url;
      a.addEventListener('canplay', settle, { once: true });   // canplay 比 canplaythrough 快，避免进度条卡住
      a.addEventListener('error', settle, { once: true });
      setTimeout(settle, 12000);   // 兜底：超时也算完成，避免卡启动页
      a.load();
    } else {
      const img = new Image();
      img.onload = settle;
      img.onerror = settle;
      setTimeout(settle, 12000);
      img.src = url;
    }
  });
}

function updateSplash(pct) {
  const fill = document.getElementById('splash-fill');
  const percent = document.getElementById('splash-percent');
  const p = Math.round(pct * 100);
  if (fill) fill.style.width = p + '%';
  if (percent) percent.textContent = p + '%';
}

function hideSplash(onDone) {
  const splash = document.getElementById('splash');
  if (!splash) { if (onDone) onDone(); return; }
  let called = false;
  const finish = () => { if (called) return; called = true; if (onDone) onDone(); };
  splash.classList.add('splash-hide');
  splash.addEventListener('transitionend', () => { splash.remove(); finish(); }, { once: true });
  setTimeout(() => { splash.remove(); finish(); }, 700);
}

function setupBeaconSave() {
  const beaconSave = async () => {
    try {
      const initData = getInitData();
      const data = collectCloudData();
      const tgId = getTgId();
      const timestamp = Date.now();
      const signature = await computeSignature(tgId, data, timestamp);
      await fetch(AUTH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', initData, data, signature, timestamp }),
        keepalive: true,
      });
    } catch(_) {}
  };
  window.addEventListener('pagehide', beaconSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') beaconSave();
  });
}

// ═══════ 启动 ═══════
function init(){
  loadPokedex();
  twa(); grid(); btn(); ev(); updateAiBtn(); bindConfirmModal();
  setupCatTreeAutoReset();   // 手动滚动游戏区后自动复位猫爬架
  // 先用本地实时存档恢复（秒开显示上次进度），云端稍后异步合并
  applyStateToS(loadLocal());
  ui();
  // 心心老虎机位：初始占位 0（外接显示位，由 window.setTimerNum(amount) 外部调用更新）
  setTimerNum(0);
  // TON 钱包：从 localStorage 恢复绑定状态
  loadWallet();
  // TON Connect：初始化连接器（会自动恢复上次连接的钱包）
  initTonConnect();
  // 应用当前保存的语言（覆盖 HTML 默认中文文案）
  applyI18n();
  // 赛季天梯：立即渲染赛季编号/倒计时，并每秒刷新倒计时
  updateSeasonUI();
  setInterval(updateSeasonUI, 1000);

  // 启动加载页：预加载音乐 + 猫咪图片，进度 100% 才进入（规避刚打开没音乐）
  preloadAssets(
    updateSplash,
    () => {
      audio.init();               // 资源已就绪，音乐可立即播放
      hideSplash(() => {
        startTimer();
        syncBackend();
        startCloudSyncTimer();
        startPrizePoolPolling();   // S1 奖池横幅轮询
        startAirdrop();            // 动态空投
        startBroadcastPolling();   // 全服喜讯小喇叭
        setupBeaconSave();
      });
    }
  );
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
