/**
 * CyberMerge — 萌猫合成大作战
 * 防刷经济模型：成本绝对压制收益
 *   - 算力公式：P_n = 1 × 1.8^(n-1)  （跨级倍率 1.8 < 2，强制不能"1+1>2"）
 *   - 购买成本：Cost = 100 × 2.2^(targetLevel-1) × 1.07^buyCount
 *       · 跨级倍率 2.2 > 1.8（成本涨得比算力快 → 永远无法靠商店追赶）
 *       · 每次购买全场物价 ×1.07（买得越多越贵）
 *   - 可购买最高等级：maxUnlocked - 4（最低 1）
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
  lb_tab_friends:  { zh:'👥 好友排行',       en:'👥 Friends',             ru:'👥 Друзья' },
  lb_empty:        { zh:'🏆 排行榜数据接入中，敬请期待', en:'🏆 Leaderboard data loading...', ru:'🏆 Данные рейтинга загружаются...' },
  lb_empty_friends:{ zh:'👥 暂无好友，快去邀请好友一起冲榜吧！', en:'👥 No friends yet. Invite friends to compete!', ru:'👥 Пока нет друзей. Пригласите друзей!' },
  // 底部按钮
  ad_text:         { zh:'加速可产出',         en:'Boost',                  ru:'Буст' },
  task_title:      { zh:'每日任务',           en:'Task',                    ru:'Задания' },
  task_sub:        { zh:'Task / Earn',        en:'Task / Earn',            ru:'Задания / Доход' },
  buy_label:       { zh:'买 LV.',             en:'Buy LV.',               ru:'Купить LV.' },
  pokedex_btn:     { zh:'猫咪图鉴',           en:'Pedia',                   ru:'Сбор' },
  pokedex_count:   { zh:'已收集',             en:'Collected',              ru:'Собрано' },
  pokedex_unit:    { zh:'只猫咪',             en:'cats',                   ru:'котов' },
  // 智能合成按钮（中文用「智能合成」，其他语言简写为「挂机」对应词：英文 Idle / 俄文 Авто）
  ai_on:           { zh:'⚡ 智能合成 ON',     en:'⚡ Idle ON',           ru:'⚡ Авто ВКЛ' },
  ai_off:          { zh:'⚡ 智能合成 OFF',    en:'⚡ Idle OFF',          ru:'⚡ Авто ВЫКЛ' },
  ai_locked:       { zh:'⚡ 开启智能合成',    en:'⚡ Enable Idle',       ru:'⚡ Включить авто' },
  // 设置面板
  settings_title:  { zh:'⚙️ 系统设置 Settings', en:'⚙️ Settings',         ru:'⚙️ Настройки' },
  music_label:     { zh:'🎵 背景音乐',         en:'🎵 Background Music',    ru:'🎵 Фоновая музыка' },
  sfx_label:       { zh:'🔔 游戏音效',         en:'🔔 Sound Effects',       ru:'🔔 Звуковые эффекты' },
  lang_label:      { zh:'🌍 语言 Language',    en:'🌍 Language',            ru:'🌍 Язык' },
  rules_label:     { zh:'📖 游戏规则',         en:'📖 Game Rules',          ru:'📖 Правила игры' },
  rules_text: {
    zh: '• 拖动相同等级的猫咪可合成更高一级<br>• 商店购买猫咪消耗金币，每次购买全场物价+7%<br>• 看广告可加速产出并免费领猫咪<br>• 智能合成签到后自动运行（每日解锁）<br>• 邀请好友 + 完成任务墙赚额外金币<br>• 链接 TON 钱包后可提现鱼池收益',
    en: '• Drag same-level cats to merge into a higher level<br>• Buying cats costs coins; each purchase raises all prices by 7%<br>• Watch ads to boost output and get free cats<br>• Auto Merge runs after daily check-in (unlocks daily)<br>• Invite friends + complete tasks to earn extra coins<br>• Connect TON wallet to withdraw pool earnings',
    ru: '• Перетаскивайте котов одного уровня, чтобы объединить их<br>• Покупка котов стоит монеты; каждая покупка повышает все цены на 7%<br>• Смотрите рекламу для ускорения и бесплатных котов<br>• Автослияние запускается после ежедневной регистрации<br>• Приглашайте друзей + выполняйте задания для бонусов<br>• Подключите TON-кошелек для вывода из пула'
  },
  version:         { zh:'v1.0.0 · CyberMerge', en:'v1.0.0 · CyberMerge',  ru:'v1.0.0 · CyberMerge' },
  // 提现进度 / 创世分红弹窗
  withdraw_title:  { zh:'提现进度 / 创世分红', en:'Withdraw / Genesis Dividend', ru:'Вывод / Генезис-дивиденд' },
  withdraw_btn:    { zh:'分红进度',          en:'Dividend',               ru:'Дивиденды' },
  withdraw_sub:    { zh:'再开7级，提现比例提升', en:'Open 7 more levels to boost withdrawal', ru:'Откройте ещё 7 уровней' },
  wd_pool_label:   { zh:'💰 本期鱼池（可提现）', en:'💰 Current Pool (Withdrawable)', ru:'💰 Текущий пул (к выводу)' },
  wd_rate_prefix:  { zh:'当前可提现比例：',   en:'Current withdrawal rate: ', ru:'Текущая ставка вывода: ' },
  wd_ad_text:      { zh:'看视频，临时体验 20% 提现特权', en:'Watch ads for temporary 20% withdrawal', ru:'Смотрите видео — временный вывод 20%' },
  wd_invite_text:  { zh:'邀请 3 名好友，直接跃升下一级比例！', en:'Invite 3 friends to jump to next tier!', ru:'Пригласите 3 друзей и перейдите на следующий уровень!' },
  wd_rate_label:   { zh:'提现',               en:'Withdraw',               ru:'Вывод' },
  wd_ms_dividend:  { zh:'每日分红',            en:'Daily Dividend',         ru:'Дневной дивиденд' },
  wd_ms_reached:   { zh:'已达成',              en:'Reached',                ru:'Достигнуто' },
  wd_ms_current:   { zh:'当前阶段',            en:'Current',                ru:'Текущий' },
  wd_ms_locked:    { zh:'未解锁',              en:'Locked',                 ru:'Заблокировано' },
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

// ═══════ 数值模型（防刷铁律）═══════
const EARN_BASE = 1;              // LV.1 基础算力 1/秒
const EARN_RATIO = 1.8;          // 算力跨级倍率（严格 < 2，确保 1+1 < 2）
const PRICE_BASE = 100;          // 商店底价 100 金币
const PRICE_LV_RATIO = 2.2;      // 跨级成本倍率（> 1.8，成本永远跑赢收益）
const PRICE_INFLATE = 1.07;      // 每次购买全场物价通胀 7%
const BUY_LV_GAP = 4;            // 可购最高等级 = maxUnlocked - 4
const AD_LV_GAP = 2;             // 广告领取等级 = maxUnlocked - 2

// 第 n 级猫的每秒产出算力 P_n = 1 × 1.8^(n-1)
function lvEarnPerSec(lv) {
  return EARN_BASE * Math.pow(EARN_RATIO, lv - 1);
}

// 商店购买成本 Cost = 100 × 2.2^(lv-1) × 1.07^buyCount
function lvPrice(lv) {
  return Math.floor(PRICE_BASE * Math.pow(PRICE_LV_RATIO, lv - 1) * Math.pow(PRICE_INFLATE, S.buyCount));
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

// 历史最高解锁等级（基于已收集图鉴）
function maxUnlockedLv() {
  let max = 1;
  collected.forEach(l => { if (l > max) max = l; });
  return max;
}

// 商店可购买最高等级 = maxUnlocked - 4，最低 1
function shopMaxLv() {
  return Math.max(1, maxUnlockedLv() - BUY_LV_GAP);
}

// 广告可领取等级 = maxUnlocked - 2，最低 2
function adRewardLv() {
  return Math.max(2, maxUnlockedLv() - AD_LV_GAP);
}

// 商店默认出售等级：始终卖能买到的最高级（让玩家直观看到目标）
function buyLevel() {
  return shopMaxLv();
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

// ═══════ 状态 ═══════
const S = {
  grid: new Array(TOTAL).fill(null),  // grid[i] = null 或 lv 整数
  usdt: 1000,                         // 初始金币（够买 1 只 LV.1）
  buyCount: 0,                        // 历史总购买次数（驱动 7% 通胀）
  adUsedToday: 0,                     // 今日已用广告次数
  aiRunning: false,                   // 智能合成是否运行中
  aiTimer: null,                      // 智能合成循环定时器
  aiLock: false,                      // 互斥锁：防本次 tick 未跑完就重入
  wdAdUsed: 0,                        // 提现弹窗「看视频临时特权」今日已用次数（上限 3）
  inviteCount: 0,                     // 邀请好友次数（云存档）
};
const AI_KEY = 'cybermerge_ai_unlock_day';  // 存最后一次看广告解锁智能合成的日期 "YYYY-MM-DD"
const AI_TICK_MS = 180;                     // AI 循环周期（毫秒）：不要太快避免卡顿
const ADSGRAM_BLOCK_ID = '42649';          // Adsgram 激励视频广告单元 ID
const AI_AD_BLOCK_ID = '42657';            // 智能合成解锁激励视频广告单元 ID

// ═══════ 每日任务：3 个 Adsgram 任务广告单元 + 金币奖励 ═══════
const DAILY_TASKS = [
  { key: 'task-42653', blockId: 'task-42653', icon: '📺', name: '看视频领金币', desc: '观看广告领取 500 金币', coins: 500 },
  { key: 'task-42654', blockId: 'task-42654', icon: '🎁', name: '看视频领金币', desc: '观看广告领取 800 金币', coins: 800 },
  { key: 'task-42655', blockId: 'task-42655', icon: '💰', name: '看视频领金币', desc: '观看广告领取 1200 金币', coins: 1200 },
];
const TASK_DONE_KEY = 'cybermerge_daily_tasks';  // 存 { date, done: [taskKey] }，每日重置

// ═══════ 提现进度/创世分红：阶梯提现比例 + 里程碑 ═══════
const WD_AD_LIMIT = 3;                      // 看视频临时特权每日上限 3 次
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
// 尝试自动识别 TON 钱包（依次：Tonkeeper / TON Connect / Telegram Wallet / OpenMask）
async function autoDetectTonWallet() {
  // 1. Tonkeeper 注入
  if (window.tonkeeper && typeof window.tonkeeper.sendTransaction === 'function') {
    try {
      const acct = await window.tonkeeper.getAccount();
      if (acct && acct.address) return { address: acct.address, provider: 'tonkeeper' };
    } catch(_) {}
  }
  // 2. TON Connect (window.tonconnect)
  if (window.tonconnect && typeof window.tonconnect.connect === 'function') {
    try {
      const r = await window.tonconnect.connect();
      if (r && r.account && r.account.address) return { address: r.account.address, provider: 'tonconnect' };
    } catch(_) {}
  }
  // 3. Telegram 内置钱包（Telegram WebApp 用户 initData 能拿到 sender，但拿不到链上地址）
  //    走后端 /api/wallet/auto?tg_id=xxx 解析 Telegram Stars / TON Pay 等绑定状态
  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
    try {
      const tgId = tg.initDataUnsafe.user.id;
      const resp = await fetch('/api/wallet/auto?tg_id=' + tgId);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.address) return { address: data.address, provider: data.provider || 'telegram' };
      }
    } catch(_) {}
  }
  // 4. OpenMask / MyTonWallet 注入（同样 window.ton 协议）
  if (window.ton && typeof window.ton.sendTransaction === 'function') {
    try {
      const acct = await window.ton.getAccount();
      if (acct && acct.address) return { address: acct.address, provider: 'openmask' };
    } catch(_) {}
  }
  return null;
}
// 链接钱包流程：自动识别 → 缓存 → UI 刷新
async function connectWallet() {
  if (wallet.address) {
    // 已连接：toast 提示当前地址
    toast(t('t_wallet_linked') + shortAddr(wallet.address), 'info');
    return;
  }
  toast(t('t_detecting'), 'info');
  const r = await autoDetectTonWallet();
  if (r) {
    saveWallet(r.address, r.provider);
    refreshWalletUI();
    toast(t('t_wallet_ok') + shortAddr(r.address) + '（' + r.provider + '）', 'success');
  } else {
    // 没识别到 → 跳转 Tonkeeper 安装页 + 提示
    const installUrl = 'https://tonkeeper.com/';
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(installUrl));
    } else {
      try { navigator.clipboard?.writeText(installUrl); } catch(_) {}
      toast(t('t_no_wallet'), 'info');
    }
  }
}

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
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
    toast('⏰ 新的一天到啦~智能合成已关闭','info');
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
        sortGrid();                       // 合成后自动降序：最高等级排第一位
        const ni = S.grid.indexOf(newLv); // 找到新等级在排序后的位置
        if (ni >= 0) boom(ni);
        collect(newLv);
        saveCloud();
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
        S.buyCount++;
        S.grid[emptyIdx] = lv;
        draw(emptyIdx);
        const pet = g?.children[emptyIdx]?.querySelector('.pet-card');
        if (pet) { pet.classList.add('pet-spawn'); pet.addEventListener('animationend',()=>pet.classList.remove('pet-spawn'),{once:true}); }
        collect(lv);
        saveCloud();
      }
    }
  } finally {
    S.aiLock = false;
  }
}

// 点击智能合成按钮：未解锁→看激励视频广告解锁→开；已解锁→开关切换
function toggleAiMerge(e) {
  if (e) { e.preventDefault?.(); e.stopPropagation?.(); }
  if (!isAiUnlockedToday()) {
    // 未解锁今日：看一次激励视频广告（Adsgram 42657）才能开启智能合成
    if (S.adUsedToday >= adDailyLimit()) {
      toast('今日广告次数已用完，明天再来~','warn');
      return;
    }
    const lv = adRewardLv();
    let idx = -1; for (let i = 0; i < TOTAL; i++) if (S.grid[i] === null) { idx = i; break; }
    if (idx === -1) {
      toast('猫窝满啦！先合一下腾位~','warn');
      return;
    }

    const unlockAfterAd = () => {
      S.adUsedToday++;
      setAiUnlockedToday();
      // 解锁奖励（1只 LV.X 猫）+ 开启智能合成
      S.grid[idx] = lv;
      draw(idx);
      const pet = g?.children[idx]?.querySelector('.pet-card');
      if (pet) { pet.classList.add('pet-spawn'); pet.addEventListener('animationend',()=>pet.classList.remove('pet-spawn'),{once:true}); }
      collect(lv);
      startAiLoop();
      toast('🎬 看广告成功！智能合成已开启，获得 '+CATS[lv].name+' LV.'+lv,'success');
      ui();
      saveCloudNow();
    };

    try {
      if (!window.Adsgram) { toast('广告系统未加载，请稍后再试','warn'); return; }
      const AdController = window.Adsgram.init({ blockId: AI_AD_BLOCK_ID });
      AdController.show()
        .then(() => unlockAfterAd())                                  // 看完广告 → 解锁 + 发奖励 + 存档
        .catch(() => toast('广告未看完，无法开启智能合成','warn'));   // 中途关闭 / 失败
    } catch(_) {
      toast('广告加载失败，请稍后再试','warn');
    }
    return;
  }
  // 已解锁 → 切换开关
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

// ═══════ 邀请裂变：生成带邀请者 TG ID 的短链 ═══════
const INVITE_BASE_URL = 'https://t.me/CyberCatMergeBot/app?startapp=';  // 邀请短链前缀（startapp 后接邀请者 tgId）

function buildInviteLink() {
  const myId = tg?.initDataUnsafe?.user?.id;
  return INVITE_BASE_URL + (myId ? myId : '');
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

// ═══════ 云存档：Telegram 鉴权 + 拉取/写回 MongoDB（Netlify Functions）═══════

// 收集需要云端保存的完整存档
function collectCloudData() {
  const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch(_) { return d; } };
  return {
    coins: S.usdt,
    grid: S.grid,
    buyCount: S.buyCount,
    adUsedToday: S.adUsedToday,
    wdAdUsed: S.wdAdUsed,
    pokedex: [...collected],
    inviteCount: S.inviteCount,
    aiUnlockDay: lsGet(AI_KEY, ''),
    settings: {
      lang: _lang,
      music: lsGet('cybermerge_music', '1'),
      sfx: lsGet('cybermerge_sfx', '1'),
      wallet: wallet.address,
    }
  };
}

// 立即写回云端（不防抖）
async function saveCloudNow() {
  const initData = getInitData();
  const data = collectCloudData();
  console.log('Syncing backend:', 'save', data, initData);
  try {
    const resp = await fetch('/.netlify/functions/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', initData, data })
    });
    console.log('Syncing backend save resp:', resp.status, resp.statusText);
  } catch(_) {}
}

// 防抖写回：1 秒内的多次变动合并成一次请求（更快落库，减少强退丢档）
let _cloudTimer = null;
function saveCloud() {
  if (_cloudTimer) clearTimeout(_cloudTimer);
  _cloudTimer = setTimeout(() => { saveCloudNow(); }, 1000);
}

// 初始化：向后端鉴权并恢复完整云存档（金币 / grid / 图鉴 / 设置等）
async function syncBackend() {
  try {
    const initData = getInitData();                     // Telegram 环境用真实 initData，普通浏览器用测试数据
    // 提取邀请者 ID（通过 startapp 参数传入，被邀请的新用户才会有）
    const inviterId = window.Telegram?.WebApp?.initDataUnsafe?.start_param || '';
    console.log('Syncing backend:', 'login', { inviterId }, initData);
    const resp = await fetch('/.netlify/functions/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', initData, inviterId })
    });
    console.log('Syncing backend login resp:', resp.status, resp.statusText);
    const data = await resp.json();
    if (!data.success || !data.user) return;
    const u = data.user;

    // 恢复金币
    if (typeof u.coins === 'number') S.usdt = u.coins;

    // 恢复 grid（16 格，null 或 lv）
    if (Array.isArray(u.grid)) {
      for (let i = 0; i < TOTAL; i++) {
        const x = u.grid[i];
        S.grid[i] = (typeof x === 'number' && x >= 1 && x <= MAX_LV) ? x : null;
      }
      for (let i = 0; i < TOTAL; i++) draw(i);
    }

    // 恢复经济 / 进度字段
    if (typeof u.buyCount === 'number') S.buyCount = u.buyCount;
    if (typeof u.adUsedToday === 'number') S.adUsedToday = u.adUsedToday;
    if (typeof u.wdAdUsed === 'number') S.wdAdUsed = u.wdAdUsed;
    if (typeof u.inviteCount === 'number') S.inviteCount = u.inviteCount;
    // 恢复智能合成签到解锁日期
    if (typeof u.aiUnlockDay === 'string' && u.aiUnlockDay) {
      try { localStorage.setItem(AI_KEY, u.aiUnlockDay); } catch(_) {}
    }

    // 恢复图鉴
    if (Array.isArray(u.pokedex)) {
      collected.clear();
      u.pokedex.forEach(lv => { if (typeof lv === 'number' && lv >= 1 && lv <= MAX_LV) collected.add(lv); });
      savePokedex();
      updatePokedexBadge();
    }

    // 恢复设置到 localStorage（语言 / 音乐 / 音效 / 钱包）
    if (u.settings && typeof u.settings === 'object') {
      const st = u.settings;
      if (st.lang === 'zh' || st.lang === 'en' || st.lang === 'ru') {
        _lang = st.lang;
        try { localStorage.setItem('cybermerge_lang', st.lang); } catch(_) {}
      }
      try { if (st.music) localStorage.setItem('cybermerge_music', st.music); } catch(_) {}
      try { if (st.sfx) localStorage.setItem('cybermerge_sfx', st.sfx); } catch(_) {}
      if (st.wallet) saveWallet(st.wallet, 'cloud');
      audio.sfxEnabled = (() => { try { return localStorage.getItem('cybermerge_sfx') === '1'; } catch(_) { return true; } })();
    }

    // 刷新界面（金币 + 钱包 + 语言）
    ui();
    refreshWalletUI();
    applyI18n();
  } catch(_) {
    // 后端不可用（本地/未部署）时保持本地数据，不打断游戏
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
  let saveTick = 0;                     // 每 100 tick（10 秒）触发一次云存档
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

    // 每 1 秒（10 个 100ms tick）飘一次「+ 多少金」红色浮动数字（中间按钮 + 顶部金币）
    floatTick++;
    if (floatTick >= 10 && earn > 0) {
      floatIncome(earn);
      floatIncomeTop(earn);
      floatTick = 0;
    }

    // 每 10 秒自动写回一次云存档（覆盖金币持续产出）
    saveTick++;
    if (saveTick >= 100) {
      saveTick = 0;
      saveCloud();
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

// ═══════ UI：顶栏余额 + 中间按钮（金币 / 拟买等级 / 灰禁 / 广告按钮）═══════
function ui() {
  // 等级横排：LV40招财猫头像 + 当前等级 + 当前金币 + 进度条（按 40 级满级算比例）
  const userLv = Math.max(1, maxUnlockedLv());
  const levelLvEl = document.getElementById('level-lv');
  const levelCoinsEl = document.getElementById('level-coins');
  const progBarFill = document.getElementById('prog-bar-fill');
  const progCurLv = document.getElementById('prog-cur-lv');
  if (levelLvEl) levelLvEl.textContent = 'Lv.' + userLv;
  if (levelCoinsEl) levelCoinsEl.textContent = fmtNum(S.usdt) + ' ' + t('level_coins_suf');
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
        '<img class="pet-img" data-lv="'+lv+'" src="'+c.img+'" alt="'+c.name+'" draggable="false" style="--lv-scale:'+lvScale+'" />' +
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
    toast('❤ 金币不足！需 ' + fmtNum(price) + ' 金（看广告免费领）','error');
    return;
  }
  let idx = -1; for (let i = 0; i < TOTAL; i++) if (S.grid[i] === null) { idx = i; break; }
  if (idx === -1) { toast('猫窝满啦！合一下腾位~','warn'); return; }
  S.usdt = parseFloat((S.usdt - price).toFixed(4));
  S.buyCount++;                  // 购买次数 +1，全场物价 +7%
  S.grid[idx] = lv;
  draw(idx);
  ui();
  let pet = g.children[idx].querySelector('.pet-card');
  if (pet) { pet.classList.add('pet-spawn'); pet.addEventListener('animationend',()=>pet.classList.remove('pet-spawn'),{once:true}); }
  collect(lv);
  toast('获得 '+CATS[lv].name+' LV.'+lv+'（下次涨价 7%）','success');
  saveCloudNow();   // 买猫是核心动作，立即落库防丢档
}

// ═══════ 加速可产出（看 Adsgram 广告，成功看完才给猫）═══════
function watchAd() {
  if (S.adUsedToday >= adDailyLimit()) {
    toast('今日加速次数已用完，明日再来~','warn');
    return;
  }
  let idx = -1; for (let i = 0; i < TOTAL; i++) if (S.grid[i] === null) { idx = i; break; }
  if (idx === -1) { toast('猫窝满啦！先合一下腾位~','warn'); return; }

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
    toast('⚡ 加速成功！获得 '+CATS[lv].name+' LV.'+lv,'success');
    saveCloudNow();   // 加速得猫也是核心动作，立即落库
  };

  // 接入 Adsgram 广告
  try {
    if (!window.Adsgram) {
      toast('广告系统未加载，请稍后再试','warn');
      return;
    }
    const AdController = window.Adsgram.init({ blockId: ADSGRAM_BLOCK_ID });
    AdController.show()
      .then(() => grantReward())                                 // 成功看完 → 发奖励 + 存档
      .catch(() => toast('广告未看完，无法获得奖励','warn'));    // 中途关闭 / 拉取失败
  } catch(_) {
    toast('广告加载失败，请稍后再试','warn');
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
    const done = isTaskDone(task.key);
    const item = d('button', 'task-item' + (done ? ' task-done' : ''));
    item.type = 'button';
    item.innerHTML =
      '<span class="task-icon">' + task.icon + '</span>' +
      '<span class="task-info">' +
        '<span class="task-name">' + task.name + '</span>' +
        '<span class="task-desc">' + task.desc + '</span>' +
      '</span>' +
      '<span class="task-reward">' + (done ? '✅ 已完成' : '领取 +' + task.coins) + '</span>';
    if (!done) item.addEventListener('click', () => doTask(task));
    list.appendChild(item);
  });
}
function doTask(task) {
  if (S.adUsedToday >= adDailyLimit()) {
    toast('今日广告次数已用完，明天再来~','warn');
    return;
  }
  try {
    if (!window.Adsgram) { toast('广告系统未加载，请稍后再试','warn'); return; }
    const AdController = window.Adsgram.init({ blockId: task.blockId });
    AdController.show()
      .then(() => {
        // 发金币奖励 + 标记完成 + 立即云存档
        S.usdt = parseFloat((S.usdt + task.coins).toFixed(4));
        S.adUsedToday++;                     // 任务广告计入每日总次数
        markTaskDone(task.key);
        ui();
        toast(task.icon + ' 任务完成！获得 ' + task.coins + ' 金币','success');
        saveCloudNow();
        renderTasks();                     // 刷新任务列表（标记已完成）
      })
      .catch(() => toast('广告未看完，无法获得奖励','warn'));
  } catch(_) {
    toast('广告加载失败，请稍后再试','warn');
  }
}
function openTasks() {
  renderTasks();
  document.getElementById('task-modal')?.classList.add('show');
}
function closeTasks() {
  document.getElementById('task-modal')?.classList.remove('show');
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
      saveCloudNow();   // 移动猫改变 grid，立即落库
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
    toast('品种不同，不能合体哦','warn');
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
    sortGrid();                                // 自动排序：最高等级排第一个
    const ni = S.grid.indexOf(nl);             // 找新等级排序后的位置
    if (ni >= 0) boom(ni);                     // 在正确位置触发合成闪光
    collect(nl);
    // 防刷铁律：合成无金币奖励（仅解锁图鉴 + 等级提升）
    audio.sfxMerge();                          // 🔔 合成成功音效
    toast('🎉 合体！'+CATS[nl].name+' LV.'+nl,'success');
    ui();
    saveCloudNow();   // 合成是核心动作，立即落库防丢档
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

// ═══════ 按钮 ═══════
function btn(){
  // 全球等级榜按钮：打开排行榜弹窗（后续接通所有玩家实时排名）
  const lbModal = document.getElementById('leaderboard-modal');
  const openLeaderboard = () => lbModal?.classList.add('show');
  const closeLeaderboard = () => lbModal?.classList.remove('show');
  document.getElementById('btn-leaderboard')?.addEventListener('click', openLeaderboard);
  document.getElementById('leaderboard-close')?.addEventListener('click', closeLeaderboard);
  lbModal?.addEventListener('click', (e) => { if (e.target.id === 'leaderboard-modal') closeLeaderboard(); });

  // 排行榜 Tab 切换（全球排行 / 好友排行）
  const lbTabs = document.querySelectorAll('.lb-tab');
  const lbEmpty = document.getElementById('lb-empty');
  const lbMyRank = document.getElementById('lb-my-rank');
  lbTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      lbTabs.forEach(t => t.classList.remove('lb-tab-active'));
      tab.classList.add('lb-tab-active');
      const isGlobal = tab.dataset.tab === 'global';
      // 切换空态文案（后续接真实数据后改为渲染对应榜单）
      if (lbEmpty) {
        const key = isGlobal ? 'lb_empty' : 'lb_empty_friends';
        lbEmpty.setAttribute('data-i18n', key);
        lbEmpty.textContent = t(key);
      }
      // 我的排名徽章：全球 #1 / 好友暂无
      if (lbMyRank) lbMyRank.textContent = isGlobal ? '#1' : '—';
    });
  });

  // 提现进度/创世分红弹窗
  const wdModal = document.getElementById('withdraw-modal');
  const openWithdraw = () => { renderWithdrawPanel(); wdModal?.classList.add('show'); };
  const closeWithdraw = () => wdModal?.classList.remove('show');
  document.getElementById('btn-withdraw')?.addEventListener('click', openWithdraw);
  document.getElementById('withdraw-close')?.addEventListener('click', closeWithdraw);
  wdModal?.addEventListener('click', (e) => { if (e.target.id === 'withdraw-modal') closeWithdraw(); });
  // 看视频临时体验 20% 提现特权（每日 3 次）
  document.getElementById('wd-ad-btn')?.addEventListener('click', () => {
    if (S.wdAdUsed >= WD_AD_LIMIT) { toast(t('wd_ad_done'), 'warn'); return; }
    S.wdAdUsed++;
    const c = document.getElementById('wd-ad-count');
    if (c) c.textContent = '(' + S.wdAdUsed + '/' + WD_AD_LIMIT + ')';
    toast(t('wd_ad_ok'), 'success');
  });
  // 邀请 3 名好友跃升下一级比例（复用邀请分享）
  document.getElementById('wd-invite-btn')?.addEventListener('click', () => {
    const inviteUrl = buildInviteLink();
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(inviteUrl) + '&text=' + encodeURIComponent('快来 CyberMerge 合成猫咪，瓜分大奖池！🐱💰'));
    } else {
      try { navigator.clipboard?.writeText(inviteUrl); toast('📋 邀请链接已复制！去 Telegram 粘贴给好友吧~', 'success'); }
      catch (_) { toast('🔗 邀请链接：' + inviteUrl, 'info'); }
    }
    S.inviteCount++;
    saveCloudNow();   // 邀请是核心动作，立即落库
  });

  document.getElementById('btn-merge')?.addEventListener('click',buy);
  document.getElementById('btn-ad-reward')?.addEventListener('click',watchAd);
  document.getElementById('btn-invite')?.addEventListener('click', () => {
    // 邀请链接带上当前用户 tgId，被邀请者点进来后 start_param 会带上这个 ID
    const inviteUrl = buildInviteLink();
    // Telegram 内：走原生分享，弹出好友选择
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(inviteUrl) + '&text=' + encodeURIComponent('快来 CyberMerge 合成猫咪，瓜分大奖池！🐱💰'));
    } else {
      // 外部浏览器 fallback：复制链接 + toast 提示
      try {
        navigator.clipboard?.writeText(inviteUrl);
        toast('📋 邀请链接已复制！去 Telegram 粘贴给好友吧~', 'success');
      } catch (_) {
        toast('🔗 邀请链接：' + inviteUrl, 'info');
      }
    }
    S.inviteCount++;
    saveCloudNow();   // 邀请是核心动作，立即落库
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
  const aiBtn = document.querySelector('.ai-merge-btn');
  if (aiBtn) {
    aiBtn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleAiMerge(e); });
  }
  document.querySelector('.coin-btn')?.addEventListener('click',()=>toast('暗币系统即将开放！','info'));
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
  // 浏览器自动播放策略：首次用户交互时预初始化音频池
  // （首次交互上下文内 play() 不会被 autoplay 策略拦截，后续音效都能立即发声）
  const unlockAudio = () => {
    audio.init();                              // 预创建所有 <audio> 元素并触发加载
    // 如果用户之前开过 BGM，现在交互后启动
    if (localStorage.getItem(MUSIC_KEY) === '1') audio.startBgm();
    document.removeEventListener('pointerdown', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  };
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });
  musicToggle?.addEventListener('click', () => {
    const on = musicToggle.dataset.on === 'true';
    musicToggle.dataset.on = (!on).toString();
    try { localStorage.setItem(MUSIC_KEY, (!on) ? '1' : '0'); } catch(_) {}
    if (!on) audio.startBgm(); else audio.stopBgm();   // 开→播 BGM；关→停 BGM
    toast(on ? t('t_music_off') : t('t_music_on'), 'info');
    saveCloudNow();   // 更改设置立即落库
  });
  sfxToggle?.addEventListener('click', () => {
    const on = sfxToggle.dataset.on === 'true';
    sfxToggle.dataset.on = (!on).toString();
    try { localStorage.setItem(SFX_KEY, (!on) ? '1' : '0'); } catch(_) {}
    audio.sfxEnabled = !on;                             // 同步音效开关
    if (audio.sfxEnabled) audio.sfxMerge();             // 立即试听一下合成音
    toast(on ? t('t_sfx_off') : t('t_sfx_on'), 'info');
    saveCloudNow();   // 更改设置立即落库
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
      saveCloudNow();   // 更改语言立即落库
    }
  };
  const savedLang = (() => { try { return localStorage.getItem(LANG_KEY) || 'zh'; } catch(_) { return 'zh'; } })();
  applyLang(savedLang, true);                      // 初始化静默恢复，不弹 toast
  langBtns.forEach(b => b?.addEventListener('click', () => applyLang(b.dataset.lang)));
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
      '<img src="' + c.img + '" alt="' + c.name + '" draggable="false" />' +
      '<span class="pd-name">' + (unlocked ? c.name : '未解锁') + '</span>';
    grid.appendChild(item);
  }
  document.getElementById('ps-collected').textContent = collected.size;
  document.getElementById('ps-progress').style.width = (collected.size / MAX_LV * 100) + '%';
  modal.classList.add('show');
}

function closePokedex() {
  document.getElementById('pokedex-modal')?.classList.remove('show');
}

// ═══════ 启动 ═══════
function init(){
  loadPokedex(); updatePokedexBadge();
  twa(); grid(); btn(); ev(); updateAiBtn(); ui(); startTimer();
  // 心心老虎机位：初始占位 0（外接显示位，由 window.setTimerNum(amount) 外部调用更新）
  setTimerNum(0);
  // TON 钱包：从 localStorage 恢复绑定状态，刷新按钮 UI
  loadWallet();
  refreshWalletUI();
  // 应用当前保存的语言（覆盖 HTML 默认中文文案）
  applyI18n();
  // 初始化完成后，向后端鉴权并同步金币/用户信息（Telegram 环境下才会真正请求）
  syncBackend();
  // 关闭/切后台兜底保存：完全静默（不 preventDefault、不设 returnValue），避免弹「确认离开」框
  const beaconSave = () => {
    const initData = getInitData();
    try {
      const payload = JSON.stringify({ action: 'save', initData, data: collectCloudData() });
      navigator.sendBeacon('/.netlify/functions/auth', new Blob([payload], { type: 'application/json' }));
    } catch(_) {}
  };
  window.addEventListener('beforeunload', beaconSave);
  window.addEventListener('pagehide', beaconSave);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
