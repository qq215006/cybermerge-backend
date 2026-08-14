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
  timer_rate:       { zh:'本期鱼池',         en:'Current Pool',          ru:'Текущий пул' },
  // 等级横排
  level_coins_suf: { zh:'金',               en:'coins',                 ru:'монет' },
  level_reward_t:  { zh:'本期收益',          en:'Current Earnings',       ru:'Текущий заработок' },
  level_reward_s:  { zh:'鱼池瓜分',          en:'Pool Share',             ru:'Доля пула' },
  level_max:       { zh:'40级',              en:'LV.40',                  ru:'Ур.40' },
  // 标签行
  wallet_connect:  { zh:'链接钱包 Connect',  en:'Connect Wallet',         ru:'Подключить кошелек' },
  invite_text:     { zh:'邀请好友',          en:'Invite Friends',         ru:'Пригласить друзей' },
  invite_en:       { zh:'Invite / Friends',  en:'Invite / Friends',       ru:'Invite / Friends' },
  // 顶部全球等级榜按钮
  leaderboard:     { zh:'全球等级榜',        en:'Global Rank',            ru:'Мировой рейтинг' },
  lb_my_rank:      { zh:'我的排名',          en:'My Rank',                ru:'Мой рейтинг' },
  lb_tab_global:   { zh:'🌍 全球排行',       en:'🌍 Global',              ru:'🌍 Мировой' },
  lb_tab_invite:   { zh:'👥 邀请榜',          en:'👥 Invites',            ru:'👥 Приглашения' },
  lb_empty:        { zh:'🏆 暂无上榜数据，快去合成升级吧！', en:'🏆 No ranking yet. Merge cats to rank up!', ru:'🏆 Пока нет рейтинга. Объединяйте котов!' },
  lb_empty_invite: { zh:'👥 今日暂无邀请，快去邀请好友冲榜吧！', en:'👥 No invites today. Invite friends to rank!', ru:'👥 Пока нет приглашений сегодня. Пригласите друзей!' },
  lb_loading:      { zh:'⏳ 排行榜加载中...', en:'⏳ Loading leaderboard...', ru:'⏳ Загрузка рейтинга...' },
  lb_invite_unit:  { zh:'邀请', en:'invites', ru:'пригл.' },
  // 底部按钮
  ad_text:         { zh:'广告加速',           en:'Ad Boost',              ru:'Реклама-буст' },
  task_title:      { zh:'每日任务',           en:'Task',                    ru:'Задания' },
  task_sub:        { zh:'Task / Earn',        en:'Task / Earn',            ru:'Задания / Доход' },
  buy_label:       { zh:'买 LV.',             en:'Buy LV.',               ru:'Купить LV.' },
  pokedex_btn:     { zh:'猫咪图鉴',           en:'Pedia',                   ru:'Сбор' },
  pokedex_count:   { zh:'已收集',             en:'Collected',              ru:'Собрано' },
  pokedex_unit:    { zh:'只猫咪',             en:'cats',                   ru:'котов' },
  // 签到合成按钮（每日免费签到开启智能合成 + 离线产出，0点重置）
  ai_on:           { zh:'⚡ 合成中',          en:'⚡ Merging',           ru:'⚡ Слияние' },
  ai_off:          { zh:'⚡ 合成关',          en:'⚡ Merge OFF',         ru:'⚡ Слияние ВЫКЛ' },
  ai_locked:       { zh:'⚡ 签到合成',        en:'⚡ Check-in & Merge',  ru:'⚡ Чек-ин и слияние' },
  // 离线收益弹窗
  offline_title:   { zh:'🎁 离线收益',        en:'🎁 Offline Earnings',  ru:'🎁 Офлайн-доход' },
  offline_desc:    { zh:'你离开期间累计产出', en:'Earned while you were away', ru:'Заработано за время офлайн' },
  offline_tip:     { zh:'记得每天签到，离线也会继续产出哦', en:'Check in daily to keep earning offline', ru:'Заходите ежедневно, чтобы зарабатывать офлайн' },
  offline_claim:   { zh:'领取',              en:'Claim',                ru:'Получить' },
  // 设置面板
  settings_title:  { zh:'⚙️ 系统设置 Settings', en:'⚙️ Settings',         ru:'⚙️ Настройки' },
  music_label:     { zh:'🎵 背景音乐',         en:'🎵 Background Music',    ru:'🎵 Фоновая музыка' },
  sfx_label:       { zh:'🔔 游戏音效',         en:'🔔 Sound Effects',       ru:'🔔 Звуковые эффекты' },
  lang_label:      { zh:'🌍 语言 Language',    en:'🌍 Language',            ru:'🌍 Язык' },
  rules_label:     { zh:'📖 游戏规则',         en:'📖 Game Rules',          ru:'📖 Правила игры' },
  rules_text: {
    zh: '• 拖动相同等级的猫咪可合成更高一级<br>• 商店购买猫咪消耗金币，每次购买全场物价+7%<br>• 看广告可加速产出并免费领猫咪<br>• 签到合成后自动运行并离线产出（每日免费开启）<br>• 邀请好友 + 完成任务墙赚额外金币<br>• 链接 TON 钱包后可提现鱼池收益',
    en: '• Drag same-level cats to merge into a higher level<br>• Buying cats costs coins; each purchase raises all prices by 7%<br>• Watch ads to boost output and get free cats<br>• Auto Merge + offline earnings run after daily check-in<br>• Invite friends + complete tasks to earn extra coins<br>• Connect TON wallet to withdraw pool earnings',
    ru: '• Перетаскивайте котов одного уровня, чтобы объединить их<br>• Покупка котов стоит монеты; каждая покупка повышает все цены на 7%<br>• Смотрите рекламу для ускорения и бесплатных котов<br>• Автослияние и офлайн-доход после ежедневного чек-ина<br>• Приглашайте друзей + выполняйте задания для бонусов<br>• Подключите TON-кошелек для вывода из пула'
  },
  version:         { zh:'v1.0.0 · CyberMerge', en:'v1.0.0 · CyberMerge',  ru:'v1.0.0 · CyberMerge' },
  // 提现进度 / 创世分红弹窗
  withdraw_title:  { zh:'提现进度 / 创世分红', en:'Withdraw / Genesis Dividend', ru:'Вывод / Генезис-дивиденд' },
  withdraw_btn:    { zh:'分红进度',          en:'Dividend',               ru:'Дивиденды' },
  withdraw_sub:    { zh:'再开7级，提现比例提升', en:'Open 7 more levels to boost withdrawal', ru:'Откройте ещё 7 уровней' },
  wd_pool_label:   { zh:'💰 本期鱼池（可提现）', en:'💰 Current Pool (Withdrawable)', ru:'💰 Текущий пул (к выводу)' },
  wd_rate_prefix:  { zh:'当前可提现比例：',   en:'Current withdrawal rate: ', ru:'Текущая ставка вывода: ' },
  wd_ad_text:      { zh:'看广告领 20% 特权', en:'Watch ad for 20% boost', ru:'Смотрите рекламу — вывод 20%' },
  wd_invite_text:  { zh:'邀请 3 名好友，直接跃升下一级比例！', en:'Invite 3 friends to jump to next tier!', ru:'Пригласите 3 друзей и перейдите на следующий уровень!' },
  wd_rate_label:   { zh:'提现',               en:'Withdraw',               ru:'Вывод' },
  wd_ms_dividend:  { zh:'每日分红',            en:'Daily Dividend',         ru:'Дневной дивиденд' },
  wd_ms_reached:   { zh:'已达成',              en:'Reached',                ru:'Достигнуто' },
  wd_ms_current:   { zh:'当前阶段',            en:'Current',                ru:'Текущий' },
  wd_ms_locked:    { zh:'未解锁',              en:'Locked',                 ru:'Заблокировано' },
  // 个人中心
  profile_title:   { zh:'👤 个人中心',         en:'👤 Profile',             ru:'👤 Профиль' },
  profile_coins:   { zh:'总金币',              en:'Total Coins',           ru:'Всего монет' },
  profile_earn:    { zh:'每秒产出',            en:'Earn / sec',            ru:'Доход / сек' },
  profile_invite:  { zh:'邀请人数',            en:'Invites',               ru:'Приглашения' },
  profile_weekad:  { zh:'本周看广告',          en:'Ads this week',         ru:'Реклама за неделю' },
  profile_divcats: { zh:'40级猫分红',          en:'LV.40 Dividends',       ru:'Дивиденды LV.40' },
  profile_rate:    { zh:'提现比例',            en:'Withdraw Rate',         ru:'Ставка вывода' },
  profile_ref:     { zh:'邀请码',              en:'Invite Code',           ru:'Код приглашения' },
  profile_copy:    { zh:'复制邀请码',          en:'Copy Invite Code',      ru:'Копировать код' },
  profile_copied:  { zh:'✅ 邀请码已复制',     en:'✅ Invite code copied', ru:'✅ Код скопирован' },
  // toast
  t_music_on:      { zh:'🎵 背景音乐已开启',   en:'🎵 Background music ON',  ru:'🎵 Фоновая музыка ВКЛ' },
  t_music_off:     { zh:'🎵 背景音乐已关闭',   en:'🎵 Background music OFF', ru:'🎵 Фоновая музыка ВЫКЛ' },
  t_sfx_on:        { zh:'🔔 游戏音效已开启',   en:'🔔 Sound effects ON',    ru:'🔊 Звуковые эффекты ВКЛ' },
  t_sfx_off:       { zh:'🔔 游戏音效已关闭',   en:'🔔 Sound effects OFF',   ru:'🔊 Звуковые эффекты ВЫКЛ' },
  // 已连接/未连接钱包 toast
  t_wallet_linked:  { zh:'钱包已链接：',       en:'Wallet linked: ',        ru:'Кошелек подключен: ' },
  t_detecting:      { zh:'🔍 正在识别 TON 钱包...', en:'🔍 Detecting TON wallet...', ru:'🔍 Поиск TON-кошелька...' },
  t_wallet_ok:      { zh:'✅ 钱包已链接：',     en:'✅ Wallet linked: ',     ru:'✅ Кошелек подключен: ' },
  t_no_wallet:      { zh:'⚠️ 未检测到 TON 钱包，请安装 Tonkeeper 后重试', en:'⚠️ No TON wallet detected. Install Tonkeeper and retry.', ru:'⚠️ TON-кошелек не найден. Установите Tonkeeper и повторите.' },
  // 提现弹窗 toast
  wd_ad_ok:         { zh:'✅ 20% 提现特权已激活（临时）', en:'✅ 20% withdrawal boost activated (temporary)', ru:'✅ Временный вывод 20% активирован' },
  wd_ad_done:       { zh:'⚠️ 今日特权次数已用完 (3/3)', en:'⚠️ Daily boost used up (3/3)', ru:'⚠️ Дневной лимит исчерпан (3/3)' },
  // 通用/广告/合成/购买/任务/邀请 toast（补齐三语，替换原硬编码中文）
  t_ai_daily_reset: { zh:'⏰ 新的一天到啦~签到合成已关闭', en:'⏰ New day! Auto merge turned off', ru:'⏰ Новый день! Автослияние выключено' },
  t_ai_checkin_ok:  { zh:'✅ 签到成功！智能合成已开启', en:'✅ Checked in! Auto merge ON', ru:'✅ Чек-ин выполнен! Автослияние ВКЛ' },
  t_ad_limit:       { zh:'今日广告次数已用完，明天再来~', en:'Daily ad limit reached, come back tomorrow~', ru:'Дневной лимит рекламы исчерпан, завтра~' },
  t_ad_limit_accel: { zh:'今日加速次数已用完，明日再来~', en:'Daily boost limit reached, come back tomorrow~', ru:'Дневной лимит буста исчерпан, завтра~' },
  t_grid_full:      { zh:'猫窝满啦！先合一下腾位~', en:'Nest is full! Merge first to make room~', ru:'Гнездо заполнено! Сначала объедините~' },
  t_grid_full_buy:  { zh:'猫窝满啦！合一下腾位~', en:'Nest is full! Merge to make room~', ru:'Гнездо заполнено! Объедините~' },
  t_ad_not_loaded:  { zh:'广告系统未加载，请稍后再试', en:'Ad system not loaded, try again later', ru:'Рекламная система не загружена, повторите позже' },
  t_ad_load_failed: { zh:'广告加载失败，请稍后再试', en:'Ad failed to load, try again later', ru:'Не удалось загрузить рекламу, повторите позже' },
  t_ad_not_finished:{ zh:'广告未看完，无法获得奖励', en:'Ad not finished, no reward', ru:'Реклама не досмотрена, награды нет' },
  t_no_coins:       { zh:'❤ 金币不足！需 {price} 金（看广告免费领）', en:'❤ Not enough coins! Need {price} coins (watch ad for free)', ru:'❤ Не хватает монет! Нужно {price} монет (смотрите рекламу)' },
  t_got_cat:        { zh:'获得 {name} LV.{lv}（下次涨价 7%）', en:'Got {name} LV.{lv} (next price +7%)', ru:'Получен {name} LV.{lv} (следующая цена +7%)' },
  t_accel_success:  { zh:'⚡ 加速成功！获得 {name} LV.{lv}', en:'⚡ Boost success! Got {name} LV.{lv}', ru:'⚡ Буст успешен! Получен {name} LV.{lv}' },
  t_task_done:      { zh:'{icon} 任务完成！获得 {coins} 金币', en:'{icon} Task done! Got {coins} coins', ru:'{icon} Задание выполнено! Получено {coins} монет' },
  t_wrong_type:     { zh:'品种不同，不能合体哦', en:'Different breeds cannot merge', ru:'Разные породы нельзя объединять' },
  t_merge_success:  { zh:'🎉 合体！{name} LV.{lv}', en:'🎉 Merged! {name} LV.{lv}', ru:'🎉 Объединение! {name} LV.{lv}' },
  t_invite_copied:  { zh:'📋 邀请链接已复制！去 Telegram 粘贴给好友吧~', en:'📋 Invite link copied! Paste it to friends on Telegram~', ru:'📋 Ссылка скопирована! Отправьте друзьям в Telegram~' },
  t_invite_link:    { zh:'🔗 邀请链接：', en:'🔗 Invite link: ', ru:'🔗 Ссылка: ' },
  t_coin_soon:      { zh:'暗币系统即将开放！', en:'Dark coin system coming soon!', ru:'Система тёмных монет скоро!' },
  t_task_done_label:{ zh:'✅ 已完成', en:'✅ Done', ru:'✅ Готово' },
  t_task_claim:     { zh:'▶ 领取', en:'▶ Claim', ru:'▶ Получить' },
  t_locked:         { zh:'未解锁', en:'Locked', ru:'Заблокировано' },
  t_share_text:     { zh:'快来 CyberMerge 合成猫咪，瓜分大奖池！🐱💰', en:'Come to CyberMerge, merge cats and win the big pool! 🐱💰', ru:'Заходи в CyberMerge, объединяй котов и выигрывай призы! 🐱💰' },
  // 每日任务描述
  task_desc_1:      { zh:'接任务领 10000 金币', en:'Take task for 10000 coins', ru:'Задание на 10000 монет' },
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
  // 钱包按钮：已连接态显示地址缩写、未连接态显示当前语言文案
  // （覆盖 data-i18n 是因为已连接时不应被「Connect Wallet」盖掉地址）
  if (typeof refreshWalletUI === 'function') refreshWalletUI();
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

// ═══════ 数值模型（防刷铁律）═══════
const EARN_BASE = 1;              // LV.1 基础算力 1/秒
const EARN_RATIO = 1.8;          // 算力跨级倍率（严格 < 2，确保 1+1 < 2）
const PRICE_BASE = 100;          // 商店底价 100 金币
const PRICE_LV_RATIO = 2.2;      // 跨级成本倍率（> 1.8，成本永远跑赢收益）
const PRICE_INFLATE = 1.03;      // 每次购买全场物价通胀 3%
const BUY_LV_GAP = 4;            // 可购最高等级 = maxUnlocked - 4
const AD_LV_GAP = 5;             // 广告领取等级 = maxUnlocked - 5
const SHOP_MAX_LV = 36;          // 商店最高可买等级（36级以上全靠合成）
const DAILY_FREE_BUYS = 5;       // 每天前5次购买不涨物价

// 第 n 级猫的每秒产出算力 P_n = 1 × 1.8^(n-1)
function lvEarnPerSec(lv) {
  return EARN_BASE * Math.pow(EARN_RATIO, lv - 1);
}

// 商店购买成本 Cost = 100 × 2.2^(lv-1) × 1.03^inflateCount
function lvPrice(lv) {
  return Math.floor(PRICE_BASE * Math.pow(PRICE_LV_RATIO, lv - 1) * Math.pow(PRICE_INFLATE, S.inflateCount));
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
    if (typeof lv === 'number' && lv >= 1 && lv <= MAX_LV) s += lvEarnPerSec(lv);
  }
  return s;
}

// 历史最高解锁等级（基于已收集图鉴）
function maxUnlockedLv() {
  let max = 1;
  collected.forEach(l => { if (l > max) max = l; });
  return max;
}

// 商店可购买最高等级 = min(maxUnlocked - 4, 36)，最低 1
function shopMaxLv() {
  return Math.max(1, Math.min(maxUnlockedLv() - BUY_LV_GAP, SHOP_MAX_LV));
}

// 广告可领取等级 = maxUnlocked - 5，最低 2
function adRewardLv() {
  return Math.max(2, maxUnlockedLv() - AD_LV_GAP);
}

// 商店出售等级：先补买场上最低等级（低于 -4 目标时）往上合，打平后再买目标级
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
  { img:'/cats/LV.1.png',  name:'小奶猫' },
  { img:'/cats/LV.2.png',  name:'狸花猫' },
  { img:'/cats/LV.3.png',  name:'橘猫' },
  { img:'/cats/LV.4.png',  name:'三花猫' },
  { img:'/cats/LV.5.png',  name:'奶牛猫' },
  { img:'/cats/LV.6.png',  name:'黑猫' },
  { img:'/cats/LV.7.png',  name:'白猫' },
  { img:'/cats/LV.8.png',  name:'暹罗猫' },
  { img:'/cats/LV.9.png',  name:'波斯猫' },
  { img:'/cats/LV.10.png', name:'英短猫' },
  { img:'/cats/LV.11.png', name:'美短猫' },
  { img:'/cats/LV.12.png', name:'布偶猫' },
  { img:'/cats/LV.13.png', name:'金吉拉' },
  { img:'/cats/LV.14.png', name:'蓝猫' },
  { img:'/cats/LV.15.png', name:'银渐层' },
  { img:'/cats/LV.16.png', name:'金渐层' },
  { img:'/cats/LV.17.png', name:'起司猫' },
  { img:'/cats/LV.18.png', name:'矮脚猫' },
  { img:'/cats/LV.19.png', name:'卷耳猫' },
  { img:'/cats/LV.20.png', name:'折耳猫' },
  { img:'/cats/LV.21.png', name:'缅因猫' },
  { img:'/cats/LV.22.png', name:'挪威森林' },
  { img:'/cats/LV.23.png', name:'西伯利亚' },
  { img:'/cats/LV.24.png', name:'阿比猫' },
  { img:'/cats/LV.25.png', name:'索马里' },
  { img:'/cats/LV.26.png', name:'东方短毛' },
  { img:'/cats/LV.27.png', name:'柯尼斯' },
  { img:'/cats/LV.28.png', name:'德文卷' },
  { img:'/cats/LV.29.png', name:'塞尔凯克' },
  { img:'/cats/LV.30.png', name:'孟买豹猫' },
  { img:'/cats/LV.31.png', name:'埃及猫' },
  { img:'/cats/LV.32.png', name:'新加坡猫' },
  { img:'/cats/LV.33.png', name:'日本短尾' },
  { img:'/cats/LV.34.png', name:'巴厘猫' },
  { img:'/cats/LV.35.png', name:'爪哇猫' },
  { img:'/cats/LV.36.png', name:'拉邦猫' },
  { img:'/cats/LV.37.png', name:'波米拉' },
  { img:'/cats/LV.38.png', name:'曼基康' },
  { img:'/cats/LV.39.png', name:'拿破仑' },
  { img:'/cats/LV.40.png', name:'招财神猫' },
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
  bonusCoins: 0,                      // 服务端发放的奖励（邀请奖励 + 离线产出），前端不直接修改
  buyCount: 0,                        // 历史总购买次数
  inflateCount: 0,                    // 累计通胀次数（每天前5次免费，之后每次+3%）
  adUsedToday: 0,                     // 今日已用广告次数
  aiRunning: false,                   // 智能合成是否运行中
  aiTimer: null,                      // 智能合成循环定时器
  aiLock: false,                      // 互斥锁：防本次 tick 未跑完就重入
  wdAdUsed: 0,                        // 提现弹窗「看视频临时特权」今日已用次数（上限 3）
  inviteCount: 0,                     // 邀请好友次数（云存档）
  refCode: '',                        // 我的随机邀请码（后端生成，用于邀请链接，隐藏 TG ID）
  divCats: [],                        // 场上40级猫的剩余分红次数数组 [4,3,2]
  weekAdCount: 0,                     // 本周看广告次数（后端统计，用于分红贡献）
};
const BUY_DAY_KEY = 'cybermerge_buy_day';  // 今日购买次数（每日重置）

// 记录一次购买：每天前5次不涨物价，之后每次 inflateCount+1
function recordBuy() {
  S.buyCount++;
  const today = todayStr();
  let count = 0;
  try {
    const raw = localStorage.getItem(BUY_DAY_KEY);
    const obj = raw ? JSON.parse(raw) : null;
    if (obj && obj.date === today) count = obj.count;
  } catch(_) {}
  count++;
  try { localStorage.setItem(BUY_DAY_KEY, JSON.stringify({ date: today, count })); } catch(_) {}
  if (count > DAILY_FREE_BUYS) S.inflateCount++;
}
const AI_KEY = 'cybermerge_ai_unlock_day';  // 存最后一次签到解锁智能合成的日期 "YYYY-MM-DD"
const AI_TICK_MS = 180;                     // AI 循环周期（毫秒）：不要太快避免卡顿
const ADSGRAM_BLOCK_ID = '42861';          // Adsgram 激励视频广告（加速可产出）
const AI_AD_BLOCK_ID = '42821';            // 预留：激励视频广告2（签到已改免费，暂不占用此广告位）

// ═══════ 每日任务：1 个 Adsgram 任务广告单元 + 金币奖励 ═══════
const DAILY_TASKS = [
  { key: 'task-42862', blockId: 'task-42862', icon: '📺', descKey: 'task_desc_1', coins: 10000 },
];
const TASK_DONE_KEY = 'cybermerge_daily_tasks';  // 存 { date, done: [taskKey] }，每日重置

// ═══════ 提现进度/创世分红：阶梯提现比例 + 里程碑 ═══════
const WD_AD_LIMIT = 3;                      // 看广告临时特权每日上限 3 次
const WD_AD_BLOCK_ID = '42864';             // 提现 20% 特权激励视频广告位
const WD_MILESTONES = [
  { lv: 10, rate: 1,   icon: null,               noteKey: null },
  { lv: 20, rate: 5,   icon: null,               noteKey: null },
  { lv: 27, rate: 20,  icon: null,               noteKey: null },
  { lv: 40, rate: 100, icon: '/cats/LV.40.png',  noteKey: 'wd_ms_dividend' },  // 终极信仰：财神猫
];
// 根据当前等级返回提现比例（%）
function withdrawRate(lv) {
  if (lv >= 40) return 100;
  if (lv >= 27) return 20;
  if (lv >= 20) return 5;
  if (lv >= 10) return 1;
  return 0;
}

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
// 刷新钱包按钮 UI
function refreshWalletUI() {
  const btn = document.getElementById('btn-connect-wallet');
  const txt = document.getElementById('wallet-text');
  if (!btn || !txt) return;
  if (wallet.address) {
    btn.classList.add('wallet-connected');
    txt.textContent = shortAddr(wallet.address);  // 已连接：显示地址缩写
  } else {
    btn.classList.remove('wallet-connected');
    txt.textContent = t('wallet_connect');        // 未连接：显示当前语言的"链接钱包"
  }
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
        refreshWalletUI();
        if (!_walletRestoring) {
          toast(t('t_wallet_ok') + shortAddr(friendly), 'success');
        }
      } else {
        clearWallet();
        refreshWalletUI();
      }
    });
  } catch(_) {}
}

// 链接钱包：打开 TON Connect 弹窗（用户选钱包授权后，onStatusChange 自动保存地址）
async function connectWallet() {
  if (wallet.address) {
    // 已连接：toast 提示当前地址
    toast(t('t_wallet_linked') + shortAddr(wallet.address), 'info');
    return;
  }
  if (!tonConnectUI) {
    toast(t('t_ad_not_loaded'), 'warn');
    return;
  }
  try {
    await tonConnectUI.openModal();
  } catch(_) {
    toast(t('t_no_wallet'), 'info');
  }
}

function todayStr() {
  // 每日重置改到「早上8点」：8点(上海)=UTC 0点，所以直接用 UTC 日期
  return new Date(Date.now()).toISOString().slice(0, 10);
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
function startAiLoop() {
  stopAiLoop();
  S.aiRunning = true;
  S.aiTimer = setInterval(aiTick, AI_TICK_MS);
  updateAiBtn();
}
function stopAiLoop() {
  S.aiRunning = false;
  if (S.aiTimer) { clearInterval(S.aiTimer); S.aiTimer = null; }
  updateAiBtn();
}
function checkDailyReset() {
  // 跨 0 点自动关闭智能合成（今日不是解锁日 → 关）
  if (S.aiRunning && !isAiUnlockedToday()) {
    stopAiLoop();
    toast(t('t_ai_daily_reset'),'info');
  }
}
function updateAiBtn() {
  const el = document.querySelector('.ai-merge-btn');
  if (!el) return;
  if (S.aiRunning) {
    el.textContent = t('ai_on');
    el.classList.add('ai-running');
    el.classList.remove('ai-locked');
  } else if (isAiUnlockedToday()) {
    el.textContent = t('ai_off');
    el.classList.remove('ai-running', 'ai-locked');
  } else {
    el.textContent = t('ai_locked');
    el.classList.remove('ai-running');
    el.classList.add('ai-locked');
  }
}

// AI 单次动作：先尽量合成（从高到低）→ 再尽量买（钱够才买）
function aiTick() {
  if (S.aiLock) return;            // 锁：避免重入
  S.aiLock = true;
  try {
    // ① 从高等级到低等级扫一遍：找到有 2 只同级就合成
    let merged = false;
    for (let lv = MAX_LV; lv >= 1; lv--) {
      let idx1 = -1, idx2 = -1;
      for (let i = 0; i < TOTAL; i++) {
        if (S.grid[i] !== lv) continue;
        if (idx1 < 0) idx1 = i;
        else { idx2 = i; break; }
      }
      if (idx2 >= 0) {
        // 直接合并 idx1 + idx2 → 生成新等级
        const newLv = Math.min(lv + 1, MAX_LV);
        S.grid[idx1] = null;
        S.grid[idx2] = newLv;
        if (newLv === MAX_LV) S.divCats.push(4);  // 合成出40级猫：记分红资格
        sortGrid();                       // 合成后自动降序：最高等级排第一位
        const ni = S.grid.indexOf(newLv); // 找到新等级在排序后的位置
        if (ni >= 0) boom(ni);
        collect(newLv);
        audio.sfxMerge();                 // 🔔 智能合成成功音效
        saveLocal();
        merged = true;
        break;  // 每次 tick 只做一次合并，防止卡顿
      }
    }
    if (merged) return;
    // ② 没有可合成 → 有钱的话买一只 buyLevel
    const lv = buyLevel();
    const price = lvPrice(lv);
    if (S.usdt >= price) {
      const emptyIdx = S.grid.findIndex(x => x === null);
      if (emptyIdx >= 0) {
        S.usdt = parseFloat((S.usdt - price).toFixed(4));
        recordBuy();
        S.grid[emptyIdx] = lv;
        draw(emptyIdx);
        const pet = g?.children[emptyIdx]?.querySelector('.pet-card');
        if (pet) { pet.classList.add('pet-spawn'); pet.addEventListener('animationend',()=>pet.classList.remove('pet-spawn'),{once:true}); }
        collect(lv);
        saveLocal();
      }
    }
  } finally {
    S.aiLock = false;
  }
}

// 点击签到合成按钮：免费签到开启/关闭智能合成（不看广告）
function toggleAiMerge(e) {
  if (e) { e.preventDefault?.(); e.stopPropagation?.(); }
  if (!isAiUnlockedToday()) {
    // 免费签到：直接解锁今天的智能合成
    setAiUnlockedToday();
    startAiLoop();
    toast(t('t_ai_checkin_ok'),'success');
    saveLocal();
    return;
  }
  // 已签到 → 切换开关
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
  if (!collected.has(lv)) { collected.add(lv); savePokedex(); updatePokedexBadge(); }
}

// ═══════ 拖拽 ═══════
let D = { on: false, i: -1, lv: 0, cl: null, gh: null, sx: 0, sy: 0, ox: 0, oy: 0 };
let _dTimer = 0;

// ═══════ 缓存 ═══════
let g, tg;
let timerSec = 364.02;
let timerInterval = null;

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
    wdAdUsed: S.wdAdUsed,
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
    data.wdAdUsed ?? 0,
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
  if (typeof obj.wdAdUsed === 'number') S.wdAdUsed = obj.wdAdUsed;
  if (Array.isArray(obj.divCats)) S.divCats = obj.divCats.map(x => Number(x) || 0);
  if (Array.isArray(obj.pokedex)) {
    collected.clear();
    obj.pokedex.forEach(lv => { if (typeof lv === 'number' && lv >= 1 && lv <= MAX_LV) collected.add(lv); });
    savePokedex();
    updatePokedexBadge();
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
    if (!data.success || !data.user) { applyStateToS(local); return; }
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
    S.wdAdUsed = Math.max(S.wdAdUsed, Number(u.wdAdUsed) || 0, (local && typeof local.wdAdUsed === 'number') ? local.wdAdUsed : 0);
    if (typeof u.inviteCount === 'number') S.inviteCount = u.inviteCount;
    if (typeof u.refCode === 'string' && u.refCode) S.refCode = u.refCode;
    if (Array.isArray(u.divCats)) S.divCats = u.divCats.map(x => Number(x) || 0);
    if (typeof u.weekAdCount === 'number') S.weekAdCount = u.weekAdCount;

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
    updatePokedexBadge();

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
    refreshWalletUI();
    applyI18n();
    saveLocal();   // 合并结果写回本地
  } catch(_) {
    // 后端不可用（本地/未部署）时回退本地存档，不打断游戏
    applyStateToS(local);
    ui();
    refreshWalletUI();
    applyI18n();
  }
}

// ═══════ Toast ═══════
function toast(m, t) {
  let c = document.getElementById('toast-container');
  if (!c) { c = d('div','toast-container'); document.getElementById('app').appendChild(c); }
  let el = d('div','toast toast-'+(t||'info')); el.textContent = m; c.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast-enter'));
  setTimeout(() => { el.classList.add('toast-leave'); el.addEventListener('transitionend',()=>el.remove(),{once:true}); }, 1500);
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

// ═══════ 全局产金定时器（每秒遍历网格算力累加）═══════
function startTimer() {
  const numEl = document.getElementById('timer-num');
  if (!numEl) return;
  if (timerInterval) clearInterval(timerInterval);
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
    ui();

    // 每 500ms（5 个 100ms tick）：飘数字 + 本地存档（金币产出实时写 localStorage，不碰网络）
    floatTick++;
    if (floatTick >= 5) {
      if (earn > 0) {
        floatIncome(earn);
        floatIncomeTop(earn);
      }
      floatTick = 0;
      saveLocal();
    }
  }, 100);
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
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

// ═══════ 顶部等级金币浮动：+X 附着在等级横排（level-info）上方 ═══════
function floatIncomeTop(amount) {
  const info = document.querySelector('.level-info');
  if (!info) return;
  const el = document.createElement('span');
  el.className = 'float-income-top';
  el.textContent = fmtNum(amount);
  info.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

// 金币数字「呼吸」pop 节流状态（避免每 100ms 高频动画）
let _lastCoinPop = 0;
let _lastCoinVal = null;

// ═══════ UI：顶栏余额 + 中间按钮（金币 / 拟买等级 / 灰禁 / 广告按钮）═══════
function ui() {
  // 等级横排：LV40招财猫头像 + 当前等级 + 当前金币 + 进度条（按 40 级满级算比例）
  const userLv = Math.max(1, maxUnlockedLv());
  const levelLvEl = document.getElementById('level-lv');
  const levelCoinsEl = document.getElementById('level-coins');
  const progBarFill = document.getElementById('prog-bar-fill');
  const progCurLv = document.getElementById('prog-cur-lv');
  if (levelLvEl) levelLvEl.textContent = 'Lv.' + userLv;
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
  if (progCurLv) progCurLv.textContent = userLv;
  if (progBarFill) {
    const pct = Math.min(100, (userLv / 40) * 100);
    progBarFill.style.width = pct.toFixed(1) + '%';
  }

  // 中间按钮：只显示「买 LV.x」（不再显示金币总数）
  const lvLabelEl = document.getElementById('bb-lv-label');
  const mergeBtn = document.getElementById('btn-merge');
  const lv = buyLevel();
  const price = lvPrice(lv);
  const canAfford = S.usdt >= price;

  // 按钮上只显示「买 LV.x」（文案走 i18n），不显示金币数
  if (lvLabelEl) lvLabelEl.textContent = t('buy_label') + lv;

  // 悬浮猫咪：按即将购买的等级展示素材
  const buyCatImg = document.getElementById('buy-cat-float');
  if (buyCatImg) {
    const catLv = buyLevel();
    const cat = CATS[catLv] || CATS[1];
    if (buyCatImg.dataset.lv !== String(catLv)) {
      buyCatImg.src = cat.img;
      buyCatImg.dataset.lv = String(catLv);
    }
  }

  // 灰禁态：金币不够时按钮变灰
  if (mergeBtn) {
    if (canAfford) {
      mergeBtn.classList.remove('btn-disabled');
      if (lvLabelEl) {
        lvLabelEl.style.background = 'rgba(255, 230, 150, 0.22)';
        lvLabelEl.style.color = '#fff59d';
      }
    } else {
      mergeBtn.classList.add('btn-disabled');
      if (lvLabelEl) {
        lvLabelEl.style.background = 'rgba(0,0,0,0.45)';
        lvLabelEl.style.color = '#ffcdd2';
      }
    }
  }

  // 广告按钮：金币不够时高亮，金币足够时淡化
  const adBtn = document.getElementById('btn-ad-reward');
  if (adBtn) {
    const adLv = adRewardLv();
    const adCountEl = document.getElementById('ad-count');
    if (adCountEl) adCountEl.textContent = (adDailyLimit() - S.adUsedToday) + '/' + adDailyLimit();
    document.getElementById('ad-lv').textContent = adLv;
    if (!canAfford && S.adUsedToday < adDailyLimit()) {
      adBtn.classList.add('ad-highlight');
    } else {
      adBtn.classList.remove('ad-highlight');
    }
    // 今日广告次数用完
    if (S.adUsedToday >= adDailyLimit()) {
      adBtn.classList.add('btn-disabled');
    } else {
      adBtn.classList.remove('btn-disabled');
    }
  }

  // 智能合成按钮：跨 0 点检测 + 文案状态刷新
  checkDailyReset();
  updateAiBtn();
}

function makePet(lv) {
  let c = CATS[lv] || { img:'/cats/LV.40.png', name:'神秘喵·'+lv };
  let card = d('div','pet-card');
  card.dataset.level = lv;
  let d1 = (Math.random()*2).toFixed(2)+'s';
  let d2 = (Math.random()*3+0.5).toFixed(2)+'s';
  let d3 = (Math.random()*4+0.8).toFixed(2)+'s';
  card.style.setProperty('--breathe-delay', d1);
  card.style.setProperty('--head-delay',   d2);
  card.style.setProperty('--tail-delay',  d3);
  let lvScale = Math.min(1.0 + (lv - 1) * 0.04, 1.8).toFixed(3);
  card.innerHTML =
    '<span class="pet-lv-badge">'+lv+'</span>' +
    '<div class="pet-tail-wag">' +
      '<div class="pet-head">' +
        '<img class="pet-img" data-lv="'+lv+'" src="'+c.img+'" alt="'+catName(lv)+'" draggable="false" style="--lv-scale:'+lvScale+'" />' +
      '</div>' +
    '</div>';
  return card;
}

function draw(i) {
  let s = g.children[i]; if(!s) return;
  let lv = S.grid[i];
  s.innerHTML = '';
  s.classList.remove('stack-2','stack-3');
  if(lv===null){ s.classList.remove('filled'); s.dataset.empty='true'; return; }
  s.classList.add('filled'); s.dataset.empty='false';
  let dom = makePet(lv);
  s.appendChild(dom);
  dom.addEventListener('touchstart', down, {passive:false});
  dom.addEventListener('mousedown', down);
  dom.addEventListener('click', tap);
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

// ═══════ 合成后自动排序：最高等级排第一个（索引0），空格(null)排最后 ═══════
function sortGrid() {
  // 取出所有非空格，按等级降序（高在前）
  const cats = S.grid.filter(x => x !== null).sort((a, b) => b - a);
  // 尾部补 null 到 16 格
  while (cats.length < TOTAL) cats.push(null);
  S.grid = cats;
  // 全量重绘（保持视觉与数据一致）
  for (let i = 0; i < TOTAL; i++) draw(i);
}

function grid() {
  g = document.getElementById('matrix-grid'); if(!g) return;
  g.innerHTML=''; for(let i=0;i<TOTAL;i++){ let s=d('div','matrix-slot'); s.dataset.index=i; g.appendChild(s); } all();
}

// ═══════ 购买（扣金币 + buyCount++ 触发通胀）═══════
function buy() {
  const lv = buyLevel();
  const price = lvPrice(lv);
  if (S.usdt < price) {
    toast(t('t_no_coins').replace('{price}', fmtNum(price)),'error');
    return;
  }
  let idx = -1; for (let i = 0; i < TOTAL; i++) if (S.grid[i] === null) { idx = i; break; }
  if (idx === -1) { toast(t('t_grid_full_buy'),'warn'); return; }
  S.usdt = parseFloat((S.usdt - price).toFixed(4));
  recordBuy();                   // 购买计数（前5次免费，之后+3%通胀）
  S.grid[idx] = lv;
  draw(idx);
  ui();
  let pet = g.children[idx].querySelector('.pet-card');
  if (pet) { pet.classList.add('pet-spawn'); pet.addEventListener('animationend',()=>pet.classList.remove('pet-spawn'),{once:true}); }
  collect(lv);
  toast(t('t_got_cat').replace('{name}', catName(lv)).replace('{lv}', lv),'success');
  saveLocal();   // 买猫后本地存档（云端由 2 分钟定时器 / 关闭后台兜底）
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
  };

  // 接入 Adsgram 广告
  try {
    if (!window.Adsgram) {
      toast(t('t_ad_not_loaded'),'warn');
      return;
    }
    const AdController = window.Adsgram.init({ blockId: ADSGRAM_BLOCK_ID });
    AdController.show()
      .then(() => grantReward())                                 // 成功看完 → 发奖励 + 存档
      .catch(() => toast(t('t_ad_not_finished'),'warn'));    // 中途关闭 / 拉取失败
  } catch(_) {
    toast(t('t_ad_load_failed'),'warn');
  }
}

// ═══════ 每日任务：弹窗 + Adsgram 任务广告 ═══════
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
    // 未完成：使用 Adsgram Task Web Component（任务广告不能走 init/show）
    const el = d('adsgram-task', 'task-adsgram');
    el.setAttribute('data-block-id', task.blockId);
    el.innerHTML =
      '<span slot="reward" class="task-reward-slot">+ ' + task.coins + ' ' + t('level_coins_suf') + '</span>' +
      '<span slot="button" class="task-go-btn">' + t('t_task_claim') + '</span>' +
      '<span slot="claim" class="task-claim-btn">' + t('t_task_claim') + '</span>' +
      '<span slot="done" class="task-done-btn">' + t('t_task_done_label') + '</span>';
    bindTaskAd(el, task);
    list.appendChild(el);
  });
}
// 任务广告通过 <adsgram-task> 的「reward」事件发奖（不是 init/show）
function bindTaskAd(el, task) {
  const grant = () => {
    // 发金币奖励 + 标记完成 + 立即云存档
    S.usdt = parseFloat((S.usdt + task.coins).toFixed(4));
    S.adUsedToday++;                     // 任务广告计入每日总次数
    markTaskDone(task.key);
    ui();
    toast(t('t_task_done').replace('{icon}', task.icon).replace('{coins}', task.coins),'success');
    saveCloudNow();   // 广告奖励后立即云同步
    renderTasks();                     // 刷新任务列表（标记已完成）
  };
  el.addEventListener('reward', grant);
  el.addEventListener('onError', () => toast(t('t_ad_load_failed'),'warn'));
  el.addEventListener('onBannerNotFound', () => toast(t('t_ad_not_finished'),'warn'));
  el.addEventListener('onTooLongSession', () => toast(t('t_ad_not_loaded'),'warn'));
}
function openTasks() {
  renderTasks();
  document.getElementById('task-modal')?.classList.add('show');
}
function closeTasks() {
  document.getElementById('task-modal')?.classList.remove('show');
  // 关闭时清空任务列表，移除 <adsgram-task> 组件，避免它留在 DOM 里后台重试弹错误
  const list = document.getElementById('task-list');
  if (list) list.innerHTML = '';
}

// ═══════ 拖拽（2 只同等级合成升级）═══════
function down(e) {
  if(e.button!==undefined&&e.button!==0) return;
  e.preventDefault(); e.stopPropagation();
  cleanDrag();
  let pe=e.currentTarget, s=pe.parentElement, i=parseInt(s.dataset.index), lv=S.grid[i];
  if(lv===null) return;
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
  if(gh) gh.classList.remove('pet-ghost');
  let safeKill = setTimeout(() => {
    if(cl && cl.parentNode) { cl.style.transition = 'none'; cl.remove(); }
  }, 600);
  let p = pos(e), ex = p.x, ey = p.y;
  if(ex===undefined||ex===0){ ex=sx+ox; ey=sy+oy; }
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
  let nl = Math.min(sl+1, MAX_LV);
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
    // 防刷铁律：合成无金币奖励（仅解锁图鉴 + 等级提升）
    audio.sfxMerge();                          // 🔔 合成成功音效
    toast(t('t_merge_success').replace('{name}', catName(nl)).replace('{lv}', nl),'success');
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

function boom(i){
  let s=g.children[i]; if(!s)return;
  s.classList.add('has-merge-flash');
  let f=d('div','merge-flash'); s.appendChild(f);
  f.addEventListener('animationend',()=>{f.remove();s.classList.remove('has-merge-flash');},{once:true});
  let a=document.getElementById('app');
  if(a){a.classList.add('screen-shake');a.addEventListener('animationend',()=>a.classList.remove('screen-shake'),{once:true});}
}

// ═══════ 全局事件 ═══════
function ev(){
  document.addEventListener('touchmove', e=>{ if(D.on) move(e); }, {passive:false});
  document.addEventListener('touchend',  e=>{ if(D.on) up(e); });
  document.addEventListener('touchcancel', e=>{ cleanDrag(); });
  document.addEventListener('mousemove', e=>{ if(D.on) move(e); });
  document.addEventListener('mouseup',   e=>{ if(D.on) up(e); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') cleanDrag(); });
}

// ═══════ 渲染提现弹窗（核心资产大字报 + 阶梯里程碑）═══════
function renderWithdrawPanel() {
  const userLv = Math.max(1, maxUnlockedLv());
  // 核心资产：本期鱼池 + 当前提现比例（低比例制造落差）
  const poolEl = document.getElementById('wd-pool-amount');
  const rateEl = document.getElementById('wd-rate-value');
  if (poolEl) poolEl.textContent = fmtNum(S.usdt);
  if (rateEl) rateEl.textContent = withdrawRate(userLv) + '%';

  // 阶梯里程碑（垂直列表，4 个节点）
  const msWrap = document.getElementById('wd-milestones');
  if (!msWrap) return;
  // 当前阶段 = 第一个未达成的里程碑（离玩家最近的下一级）
  let currentIdx = -1;
  for (let i = 0; i < WD_MILESTONES.length; i++) {
    if (WD_MILESTONES[i].lv > userLv) { currentIdx = i; break; }
  }
  msWrap.innerHTML = WD_MILESTONES.map((ms, i) => {
    const reached = ms.lv <= userLv;
    const isCurrent = i === currentIdx;
    const state = reached ? 'reached' : (isCurrent ? 'current' : 'locked');
    // 徽章：普通里程碑显示 LV.x；LV.40 显示财神猫头像
    const badgeHtml = ms.icon
      ? '<img src="' + ms.icon + '" alt="LV.40 财神猫">'
      : 'LV.' + ms.lv;
    // 中间：提现比例 + （LV.40 附加每日分红）
    const rateText = t('wd_rate_label') + ' ' + ms.rate + '%' + (ms.noteKey ? ' + ' + t(ms.noteKey) : '');
    const tagText = reached ? t('wd_ms_reached') : (isCurrent ? t('wd_ms_current') : t('wd_ms_locked'));
    return '<div class="wd-ms wd-ms-' + state + '">' +
      '<div class="wd-ms-badge">' + badgeHtml + '</div>' +
      '<div class="wd-ms-info">' +
        '<span class="wd-ms-rate">' + rateText + '</span>' +
      '</div>' +
      '<span class="wd-ms-tag">' + tagText + '</span>' +
    '</div>';
  }).join('');

  // 看视频临时特权计数
  const adCount = document.getElementById('wd-ad-count');
  if (adCount) adCount.textContent = '(' + S.wdAdUsed + '/' + WD_AD_LIMIT + ')';
}

// ═══════ 个人中心：渲染玩家全部数据 ═══════
function renderProfile() {
  const userLv = Math.max(1, maxUnlockedLv());
  const divCount = S.divCats.length;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('pf-lv', 'Lv.' + userLv);
  set('pf-coins', fmtNum(S.usdt));
  set('pf-earn', fmtNum(totalEarnPerSec()));
  set('pf-invite', String(S.inviteCount || 0));
  set('pf-weekad', String(S.weekAdCount || 0));
  set('pf-divcats', divCount + ' 只' + (divCount > 0 ? '（剩余 ' + S.divCats.join('/') + ' 次）' : ''));
  set('pf-rate', withdrawRate(userLv) + '%');
  set('pf-ref', S.refCode || '-');
  const avatar = document.getElementById('pf-avatar');
  if (avatar) avatar.src = '/cats/LV.' + userLv + '.png';
}

// ═══════ 按钮 ═══════
function btn(){
  // 全球等级榜按钮：打开弹窗并拉取真实排行榜（按等级）
  const lbModal = document.getElementById('leaderboard-modal');
  const openLeaderboard = () => { lbModal?.classList.add('show'); fetchLeaderboard(); };
  const closeLeaderboard = () => lbModal?.classList.remove('show');
  document.getElementById('btn-leaderboard')?.addEventListener('click', openLeaderboard);
  document.getElementById('leaderboard-close')?.addEventListener('click', closeLeaderboard);
  lbModal?.addEventListener('click', (e) => { if (e.target.id === 'leaderboard-modal') closeLeaderboard(); });

  // 排行榜 Tab 切换（全球排行 / 当日邀请榜）
  const lbTabs = document.querySelectorAll('.lb-tab');
  lbTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      lbTabs.forEach(t => t.classList.remove('lb-tab-active'));
      tab.classList.add('lb-tab-active');
      if (tab.dataset.tab === 'global') {
        fetchLeaderboard();      // 全球榜：按等级
      } else {
        fetchInviteBoard();      // 当日邀请榜：按今日邀请数
      }
    });
  });

  // 提现进度/创世分红弹窗
  const wdModal = document.getElementById('withdraw-modal');
  const openWithdraw = () => { renderWithdrawPanel(); wdModal?.classList.add('show'); };
  const closeWithdraw = () => wdModal?.classList.remove('show');
  document.getElementById('btn-withdraw')?.addEventListener('click', openWithdraw);
  document.getElementById('withdraw-close')?.addEventListener('click', closeWithdraw);
  wdModal?.addEventListener('click', (e) => { if (e.target.id === 'withdraw-modal') closeWithdraw(); });

  // 个人中心：点顶部等级/头像区域打开
  const pfModal = document.getElementById('profile-modal');
  const openProfile = () => { renderProfile(); pfModal?.classList.add('show'); };
  const closeProfile = () => pfModal?.classList.remove('show');
  document.querySelector('.level-info')?.addEventListener('click', openProfile);
  document.getElementById('profile-close')?.addEventListener('click', closeProfile);
  pfModal?.addEventListener('click', (e) => { if (e.target.id === 'profile-modal') closeProfile(); });
  document.getElementById('pf-copy-ref')?.addEventListener('click', () => {
    if (!S.refCode) { toast('暂无邀请码', 'warn'); return; }
    const link = buildInviteLink();
    try { navigator.clipboard?.writeText(link); toast(t('profile_copied'), 'success'); }
    catch(_) { toast(t('profile_ref') + ': ' + link, 'info'); }
  });

  // 看广告领 20% 提现特权（每日 3 次）
  document.getElementById('wd-ad-btn')?.addEventListener('click', () => {
    if (S.wdAdUsed >= WD_AD_LIMIT) { toast(t('wd_ad_done'), 'warn'); return; }
    try {
      if (!window.Adsgram) { toast(t('t_ad_not_loaded'), 'warn'); return; }
      const AdController = window.Adsgram.init({ blockId: WD_AD_BLOCK_ID });
      AdController.show()
        .then(() => {
          S.wdAdUsed++;
          const c = document.getElementById('wd-ad-count');
          if (c) c.textContent = '(' + S.wdAdUsed + '/' + WD_AD_LIMIT + ')';
          toast(t('wd_ad_ok'), 'success');
          saveCloudNow();
        })
        .catch(() => toast(t('t_ad_not_finished'), 'warn'));
    } catch(_) {
      toast(t('t_ad_load_failed'), 'warn');
    }
  });
  // 邀请 3 名好友跃升下一级比例（复用邀请分享）
  document.getElementById('wd-invite-btn')?.addEventListener('click', () => {
    const inviteUrl = buildInviteLink();
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(inviteUrl) + '&text=' + encodeURIComponent(t('t_share_text')));
    } else {
      try { navigator.clipboard?.writeText(inviteUrl); toast(t('t_invite_copied'), 'success'); }
      catch (_) { toast(t('t_invite_link') + inviteUrl, 'info'); }
    }
  });

  document.getElementById('btn-merge')?.addEventListener('click',buy);
  document.getElementById('btn-ad-reward')?.addEventListener('click',watchAd);
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
  // TON 钱包链接按钮
  document.getElementById('btn-connect-wallet')?.addEventListener('click', connectWallet);
  // 每日任务：打开每日任务弹窗（3 个 Adsgram 任务广告）
  document.getElementById('btn-task-wall')?.addEventListener('click', openTasks);
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
  document.getElementById('btn-settings')?.addEventListener('click', openSettings);
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

async function fetchLeaderboard() {
  const listEl = document.getElementById('leaderboard-list');
  const myRankEl = document.getElementById('lb-my-rank');
  if (!listEl) return;
  listEl.innerHTML = '<div class="lb-empty">' + t('lb_loading') + '</div>';
  try {
    const initData = getInitData();
    const resp = await fetch(AUTH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'leaderboard', initData })
    });
    const data = await resp.json();
    if (!data.success || !data.leaderboard) throw new Error('empty');
    renderLeaderboard(data.leaderboard);
  } catch(_) {
    if (listEl) listEl.innerHTML = '<div class="lb-empty">' + t('lb_empty') + '</div>';
    if (myRankEl) myRankEl.textContent = '—';
  }
}

function renderLeaderboard(lb) {
  const listEl = document.getElementById('leaderboard-list');
  const myRankEl = document.getElementById('lb-my-rank');
  if (!listEl) return;
  const items = Array.isArray(lb.list) ? lb.list : [];
  if (myRankEl) myRankEl.textContent = lb.myRank ? '#' + lb.myRank : '—';
  if (!items.length) {
    listEl.innerHTML = '<div class="lb-empty">' + t('lb_empty') + '</div>';
    return;
  }
  listEl.innerHTML = items.map(p => {
    return '<div class="lb-item' + (p.isMe ? ' lb-item-me' : '') + '">' +
      '<span class="lb-rank">' + p.rank + '</span>' +
      '<span class="lb-name">' + escapeHtml(shortName(p.username, 14)) + '</span>' +
      '<span class="lb-lv">Lv.' + p.lv + '</span>' +
      '<span class="lb-coins">' + fmtNum(p.coins) + '</span>' +
    '</div>';
  }).join('');
}

// ═══════ 当日邀请榜：拉取 + 渲染（按今日邀请数）═══════
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
function updatePokedexBadge() {
  const el = document.getElementById('pokedex-count');
  if (el) el.textContent = collected.size + '/40';
}

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
  loadPokedex(); updatePokedexBadge();
  twa(); grid(); btn(); ev(); updateAiBtn();
  // 先用本地实时存档恢复（秒开显示上次进度），云端稍后异步合并
  applyStateToS(loadLocal());
  ui();
  // 心心老虎机位：初始占位 0（外接显示位，由 window.setTimerNum(amount) 外部调用更新）
  setTimerNum(0);
  // TON 钱包：从 localStorage 恢复绑定状态，刷新按钮 UI
  loadWallet();
  refreshWalletUI();
  // TON Connect：初始化连接器（会自动恢复上次连接的钱包）
  initTonConnect();
  // 应用当前保存的语言（覆盖 HTML 默认中文文案）
  applyI18n();

  // 启动加载页：预加载音乐 + 猫咪图片，进度 100% 才进入（规避刚打开没音乐）
  preloadAssets(
    updateSplash,
    () => {
      audio.init();               // 资源已就绪，音乐可立即播放
      hideSplash(() => {
        startTimer();
        syncBackend();
        startCloudSyncTimer();
        setupBeaconSave();
      });
    }
  );
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
