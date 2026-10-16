// ==UserScript==
// @name         Musicbed 翻译
// @namespace    musicbed-zh-cn-local
// @version      1.0.1
// @description  翻译 Musicbed 导航、歌曲/音效筛选、播放器与详情；可选在线翻译名称和公开正文，保留英文原名。
// @match        https://musicbed.com/*
// @match        https://www.musicbed.com/*
// @run-at       document-start
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      translate.googleapis.com
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';

  const KEY = 'musicbed-zh-v1';
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const SKIP = 'script,style,noscript,code,pre,kbd,svg,canvas,iframe,[contenteditable]:not([contenteditable="false"]),[translate="no"],[data-musicbed-zh]';
  const TEXT_SKIP = SKIP + ',textarea,input,select,[role="textbox"]';
  const PRIVATE = '[autocomplete],[type="password"],[data-private],[data-sensitive],form,[class*="account" i],[class*="profile" i],[class*="billing" i],[class*="project" i],[class*="checkout" i],[class*="order-summary" i]';
  const ARTIST = 'a[href*="/artist/"],a[href*="/artists/"],a[href*="/musician/"],a[href*="/musicians/"],[data-testid*="artist" i],[class*="artist-name" i],[class*="artistName"],[class*="artist_name"]';
  const SONG_LINK = 'a[href*="/song/"],a[href*="/songs/"],a[href*="/track/"],a[href*="/tracks/"],a[href*="/sounds/"]';
  const SONG_TITLE = '[data-testid*="song-title" i],[data-testid*="song-name" i],[data-testid*="track-title" i],[data-testid*="track-name" i],[class*="song-title" i],[class*="song-name" i],[class*="songTitle"],[class*="songName"],[class*="track-title" i],[class*="track-name" i],[class*="trackTitle"],[class*="trackName"]';
  const MUSIC_REGION = '[data-testid*="player" i],[data-testid*="track" i],[data-testid*="song" i],[class*="music-player" i],[class*="song-details" i],[class*="track-details" i],[class*="song-row" i],[class*="songRow"],[data-testid*="sound" i]';
  const originals = new Map();
  const roots = new Set();
  const pending = new Map();
  const queue = [];
  const failed = new Set();
  const localCache = new Map();
  const scanTasks = [];
  const attributeJobs = new Map();
  const waitingElements = new Map();
  const inView = new Set();
  let viewportObserver;
  let scanTimer = 0;
  let scanQueued = false;
  let scanGeneration = 0;
  const maskableRoots = new WeakSet();
  const pendingMasks = new Map();
  let revealStyle;
  const MASK_LIMIT = 180;
  let visibleTimer = 0;
  let needsPrune = false;
  let timer = 0;
  let active = 0;
  let lastRequest = 0;
  let failures = 0;
  let pausedUntil = 0;
  let epoch = 0;
  let settings;
  let cache;
  let saveTimer;
  let host;
  let ui;

  function read(key, fallback) {
    try { return GM_getValue(key, fallback); } catch { return fallback; }
  }
  function write(key, value) {
    try { GM_setValue(key, value); } catch { /* 存储受限时仍可翻译当前页面。 */ }
  }
  settings = { enabled: true, online: false, bilingual: true, ...read(KEY + '-settings', {}) };
  cache = read(KEY + '-cache', {});
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) cache = {};
  cache = Object.assign(Object.create(null), cache);

  // 一行可列出多个等价英文；仅匹配完整文本，不在歌曲名中替换单词。
  const WORDS = new Map();
  function normalize(s) { return s.normalize('NFKC').replace(/[’‘]/g, "'").replace(/[‐‑‒–—−]/g, '-').replace(/\s*&\s*/g, ' & ').replace(/\s+/g, ' ').trim().toLowerCase(); }
  const dictionary = `
Sounds|音效
Services|服务
Original Music|原创音乐定制
Rights & Clearances|版权授权与清权
Song Search|找歌服务
Search by Song|以歌搜歌
Search by Song™|以歌搜歌™
Search by Artist|按音乐人搜索
Search songs, artists, and more|搜索歌曲、音乐人等
Search songs, artists and more|搜索歌曲、音乐人等
Search songs, artists, genres and more|搜索歌曲、音乐人、曲风等
Paste a song link|粘贴歌曲链接
Enter an artist or song|输入音乐人或歌曲名称
Create free account|创建免费账户
Create account|创建账户
Login|登录
Get in touch|联系我们
Our Story|关于我们
Our Work|我们的作品
Articles|文章
Curated Playlists|精选播放列表
Help & Support|帮助与支持
License Terms|授权条款
Music Licensing for Film|影视音乐授权
License music from emerging artists|为作品寻找新锐音乐人的授权音乐
Amplify the emotion in every scene.|让每个场景的情感更鲜明。
No credit card required.|无需信用卡。
Attributes|音乐特征
Attribute|音乐特征
Advanced|高级筛选
Advanced Filters|高级筛选
Vocal Type|人声类型
Vocal Types|人声类型
Vocal Style|人声风格
Vocal Styles|人声风格
Lyrics Theme|歌词主题
Lyrical Themes|歌词主题
Has Lyrics|有歌词
No Lyrics|无歌词
Language|语言
Languages|语言
English|英语
Spanish|西班牙语
French|法语
German|德语
Italian|意大利语
Portuguese|葡萄牙语
Japanese|日语
Explicit|露骨歌词
Explicit Content|露骨内容
Exclude Explicit|排除露骨歌词
Exclude Explicit Lyrics|排除露骨歌词
Include|包含
Exclude|排除
Include Filters|包含条件
Exclude Filters|排除条件
Match All|全部匹配
Match Any|任意匹配
Time Signature|拍号
Song Key|歌曲调性
Song Length|歌曲时长
Song Versions|歌曲版本
All Versions|全部版本
Vocal Version|人声版
Alternative Version|其他版本
Remix|混音版
Underscore|背景配乐
Instrumental Only|仅纯音乐
Vocals Only|仅人声
Details|详情
Song Info|歌曲信息
Track Info|音轨信息
View Song|查看歌曲
View Details|查看详情
View Artist|查看音乐人
Sound|音效
Sound Effects Library|音效库
Categories|类别
Category|类别
Subcategory|子类别
One Shot|One-Shot|单次音效
Loop|Loops|循环音效
Loopable|可循环
Audio Format|音频格式
Sample Rate|采样率
Bit Depth|位深度
Channels|声道
Mono|单声道
Stereo|立体声
Download MP3|下载 MP3
Download WAV|下载 WAV
Download Watermarked|下载带水印版本
Unwatermarked Downloads|无水印下载
Get License|获取授权
License Song|授权此歌曲
License Sound|授权此音效
License Type|授权类型
Single Song License|单曲授权
Single Use|单次使用
Subscription|订阅
Subscriptions|订阅
Request a Quote|申请报价
Get a Quote|获取报价
Custom Licensing|定制授权
Custom Licensing Options|定制授权方案
Custom Music|定制音乐
Projects|项目
Project|项目
My Projects|我的项目
New Project|新建项目
Create Project|创建项目
Add to Project|添加到项目
Add to a Project|添加到项目
Project Name|项目名称
Rename Project|重命名项目
Delete Project|删除项目
Collaborators|协作者
Invite|邀请
Licenses|授权记录
My Licenses|我的授权记录
Cart|购物车
Add to Cart|加入购物车
Continue Browsing|继续浏览
Keyboard Shortcuts|键盘快捷键
Hot Keys|快捷键
Queue|播放队列
Add to Queue|添加到播放队列
Remove from Queue|从播放队列移除
Clear Queue|清空播放队列
Minimize Player|收起播放器
Expand Player|展开播放器
Copied|已复制
View Playlist|查看播放列表
Follow Artist|关注音乐人
Following|已关注
Most Licensed|授权最多
Best Selling|最畅销
Newest First|最新优先
Oldest First|最早优先
Date Added|添加日期
Release Date|发行日期
Composer|作曲家
Composers|作曲家
Publisher|音乐出版方
Publishers|音乐出版方
Record Label|唱片公司
Songwriter|词曲作者
Songwriters|词曲作者
Copyright|版权
Copyright Claims|版权申诉
Clear Claims|清除版权申诉
Claim Clearance|版权申诉处理
Featured Artists|精选音乐人
Featured Playlists|精选播放列表
Recently Played|最近播放
Recently Viewed|最近浏览
Recently Licensed|最近授权
Trending Songs|热门歌曲
New Songs|最新歌曲
New Music|最新音乐
New Sounds|最新音效
Collections for Film|影视精选集
Music for Film|影视音乐
Find Your Sound|找到适合你的声音
Music Search|音乐搜索
Search Results|搜索结果
No Songs Found|未找到歌曲
No Sounds Found|未找到音效
No Matches|没有匹配结果
Browse All|浏览全部
All Songs|全部歌曲
All Sounds|全部音效
All Artists|全部音乐人
All Playlists|全部播放列表
Try Removing Filters|试试减少筛选条件
Anthemic|颂歌风格
Beautiful|优美
Bittersweet|苦乐参半
Bouncy|轻快跳跃
Bright|明亮
Building|Build|渐进增强
Claps|拍手
Confident|自信
Driving|推进感
Drop|爆发段落
Gritty|粗粝
Heavy|厚重
Intense|强烈
Minimal|极简
Minimalist|极简
Organic|自然质感
Percussive|打击感
Positive|积极
Reflective|沉思
Relaxed|放松
Rhythmic|富有节奏
Somber|低沉
Sparse|疏朗
Stomps|跺脚
Swells|渐强
Sweeping|宏大
Triumphant|胜利感
Warm|温暖
Melancholy|忧郁
Spiritual|灵性音乐
Gospel|福音音乐
Post Rock|Post-Rock|后摇
Indie Folk|独立民谣
Indie Pop|独立流行
Indie Rock|独立摇滚
Americana|美式根源音乐
Bluegrass|蓝草
Chamber|室内乐
New Age|新世纪音乐
Neo Soul|Neo-Soul|新灵魂乐
Royalty-Free Music|Royalty Free Music|免版税音乐
Music|音乐
Home|首页
AI Tools|AI 工具
Stock Catalog|素材库
Studio|工作室
Flows|工作流
Sound Effects|音效
SFX|音效
Footage|视频素材
Video Templates|视频模板
Templates|模板
LUTs|调色预设
Tools|工具
Spotlight|精选专题
Artboards|创作画板
AI Video|AI 视频
AI Image|AI 图像
AI Voiceover|AI 配音
AI Music|AI 音乐
Start Free Now|立即免费体验
Start Free|免费开始
Start Now|立即开始
Get Started|开始使用
Try for Free|免费试用
Sign In|Log In|登录
Sign Up|注册
Log Out|Sign Out|退出登录
Pricing|价格方案
Business|企业服务
Enterprise|企业版
Subscribe|订阅
Upgrade|升级
My Account|账户
My Library|我的资料库
My Music|我的音乐
My Downloads|我的下载
Downloads|下载记录
Collections|收藏集
Collection|收藏集
Favorites|Favourites|收藏
Playlists|播放列表
Playlist|播放列表
Create Playlist|创建播放列表
Create a Playlist|创建播放列表
New Playlist|新建播放列表
Add to Playlist|添加到播放列表
Add to Collection|添加到收藏集
Add to Favorites|收藏
Remove from Favorites|取消收藏
Filters|Filter|筛选
All Filters|全部筛选
More Filters|更多筛选
Clear Filters|清除筛选
Clear All|全部清除
Clear All Filters|清除全部筛选
Clear|清除
Reset|重置
Apply|应用
Show Results|显示结果
Results|结果
Search|搜索
Search Music|搜索音乐
Search for Music|搜索音乐
Search Songs|搜索歌曲
Search by keyword|按关键词搜索
Search music, artists, and more|搜索音乐、音乐人等
Search music, artists and more|搜索音乐、音乐人等
Search by song, artist or keyword|按歌曲、音乐人或关键词搜索
Search by song, artist, or keyword|按歌曲、音乐人或关键词搜索
Search for songs, artists and more|搜索歌曲、音乐人等
Search for songs, artists, and more|搜索歌曲、音乐人等
No results found|未找到结果
Try a different search|试试其他搜索词
Highlights|精选分类
Genre|Genres|曲风
Mood|Moods|情绪
Video Theme|Video Themes|视频主题
Instrument|Instruments|乐器
Vocals|人声
Vocal|有人声
Instrumental|纯音乐
Instrumentals|纯音乐
With Vocals|有人声
Without Vocals|无人声
Male|男声
Female|女声
Male Vocals|男声
Female Vocals|女声
Choir|合唱
Duet|对唱
Group|多人合唱
Acapella|Acappella|A cappella|A capella|无伴奏人声
Includes Stems|Include Stems|With Stems|包含分轨
Hide Downloaded|隐藏已下载
Hide Downloaded Songs|Hide Downloaded Tracks|隐藏已下载歌曲
Duration|时长
Sec|Secs|Second|Seconds|秒
Min|Mins|Minute|Minutes|分钟
Hr|Hrs|Hour|Hours|小时
Length|长度
Tempo|速度
Slow|慢速
Slow-Med|Slow-Medium|Slow - Med|Slow - Medium|中慢速
Med|中速
Med-Fast|Medium-Fast|Med - Fast|Medium - Fast|中快速
Fast|快速
BPM|每分钟节拍（BPM）
Key|调性
Scale|音阶
Major|大调
Minor|小调
Energy|能量强度
Low|低
Medium|中
High|高
Sort by|排序
Sort by Staff Picks|按编辑推荐排序
Sort by: Staff Picks|按编辑推荐排序
Staff Picks|编辑推荐
Recommended|推荐
Popular|热门
Most Popular|最热门
Trending|流行趋势
Newest|最新
Latest|最新
New Releases|新发布
Recently Added|最近添加
Featured|精选
Best Match|最匹配
Relevance|相关度
All|全部
New|最新
Free|免费
Premium|高级
Exclusive|独家
Browse|浏览
Discover|探索
Explore|探索
View All|See All|查看全部
Show More|Load More|加载更多
Show Less|收起
Play|播放
Pause|暂停
Stop|停止
Next|下一首
Previous|上一首
Next Track|下一首
Previous Track|上一首
Play Song|Play Track|播放歌曲
Pause Song|Pause Track|暂停歌曲
Mute|静音
Unmute|取消静音
Volume|音量
Repeat|循环播放
Shuffle|随机播放
Now Playing|正在播放
Download|下载
Download Song|Download Track|下载歌曲
Download Preview|下载试听版本
Download License|下载授权文件
Download All|全部下载
Add|添加
Remove|移除
Share|分享
Share Song|分享歌曲
Copy Link|复制链接
Link Copied|链接已复制
More|更多
More Options|更多选项
More Actions|更多操作
Similar Songs|Similar Tracks|相似歌曲
Find Similar|查找相似歌曲
More Like This|更多相似内容
Related Music|相关音乐
Related Songs|相关歌曲
Related Artists|相关音乐人
Song|Track|歌曲
Songs|Tracks|歌曲
Title|标题
Song Title|Track Title|歌曲名称
Artist|Artists|音乐人
Album|Albums|专辑
About the Artist|关于音乐人
About This Song|关于这首歌曲
Song Details|Track Details|歌曲详情
Description|描述
Lyrics|歌词
Versions|版本
Other Versions|其他版本
Alternate Versions|备选版本
Stems|分轨
Full Song|完整歌曲
Full Track|完整音轨
Short Version|短版
Instrumental Version|纯音乐版
License|授权
Music License|音乐授权
Licensing|授权说明
Royalty Free|Royalty-Free|免版税
Commercial Use|商业用途
Personal Use|个人用途
Learn More|了解更多
Help|帮助
Help Center|帮助中心
Support|支持
Contact Us|联系我们
FAQ|常见问题
Terms of Use|使用条款
Terms & Conditions|条款与条件
Privacy Policy|隐私政策
Cookie Policy|Cookie 政策
Accept All|全部接受
Reject All|全部拒绝
Cookie Settings|Cookie 设置
Save|保存
Cancel|取消
Close|关闭
Back|返回
Continue|继续
Confirm|确认
Done|完成
Loading|加载中
Loading...|正在加载…
Something went wrong|出现错误
Try Again|重试
Acoustic|原声
Ambient|氛围音乐
Blues|布鲁斯
Children|Children's|儿童音乐
Cinematic|电影配乐
Classical|古典
Corporate|商务配乐
Country|乡村
Electronic|电子
Experimental|实验音乐
Folk|民谣
Fantasy|奇幻
Funk|放克
Hip Hop|Hip-Hop|嘻哈
Holiday|节日
Indie|独立音乐
Jazz|爵士
Latin|拉丁
Lo-Fi|Lofi|低保真
Lofi & Chill Beats|Lo-Fi & Chill Beats|Lo Fi & Chill Beats|Lofi and Chill Beats|低保真与休闲节拍
Lounge|休闲沙龙
Orchestral|管弦乐
Pop|流行
R&B|Rnb|节奏布鲁斯
Reggae|雷鬼
Rock|摇滚
Singer-Songwriter|唱作人
Soul|灵魂乐
Soul & RnB|Soul & R&B|Soul and RnB|灵魂乐与节奏布鲁斯
Retro|复古
Worship|敬拜音乐
World|世界音乐
Dance|舞曲
Disco|迪斯科
EDM|电子舞曲
House|浩室
Techno|科技舞曲
Trap|陷阱音乐
Dubstep|回响贝斯
Metal|金属
Punk|朋克
Alternative|另类
Acoustic Guitar|木吉他
Electric Guitar|电吉他
Guitar|吉他
Piano|钢琴
Electric Piano|电钢琴
Keys|键盘
Keyboard|键盘
Synth|Synthesizer|合成器
Strings|弦乐
Violin|小提琴
Cello|大提琴
Bass|贝斯
Double Bass|低音提琴
Drums|鼓
Acoustic Drums|原声鼓
Electronic Drums|电子鼓
Backing Vocals|和声
Claps & Snaps|Claps and Snaps|拍手与响指
Ethnic|民族乐器
Mandolin & Ukulele|Mandolin and Ukulele|曼陀林与尤克里里
Orchestra|管弦乐队
Pads|铺底音色
Special Wind Instruments|特殊管乐器
Whistle|Whistling|口哨
Percussion|打击乐
Brass|铜管
Trumpet|小号
Trombone|长号
Saxophone|萨克斯
Woodwinds|木管
Flute|长笛
Clarinet|单簧管
Harp|竖琴
Ukulele|尤克里里
Banjo|班卓琴
Mandolin|曼陀林
Accordion|手风琴
Bells|钟铃
Organ|管风琴
Happy|快乐
Sad|悲伤
Uplifting|振奋
Inspiring|Inspirational|鼓舞人心
Hopeful|充满希望
Epic|史诗
Dramatic|戏剧性
Emotional|情感
Romantic|浪漫
Peaceful|平静
Calm|平和
Relaxing|放松
Chill|悠闲
Dreamy|梦幻
Dark|暗黑
Mysterious|神秘
Suspense|Suspenseful|悬疑
Tense|紧张
Scary|恐怖
Angry|愤怒
Aggressive|激烈
Powerful|强劲
Energetic|活力
Exciting|激动人心
Love|爱意
Playful|俏皮
Funny|诙谐
Fun|有趣
Carefree|无忧无虑
Groovy|律动
Sexy|性感
Serious|严肃
Melancholic|忧郁
Nostalgic|怀旧
Sentimental|感伤
Quirky|古灵精怪
Euphoric|欣喜
Laid Back|Laid-Back|轻松
Motivational|励志
Adventure|冒险
Travel|旅行
Nature|自然
Technology|科技
Fashion|时尚
Lifestyle|生活方式
Sport|Sports|运动
Fitness|健身
Sport & Fitness|Sports & Fitness|Sport and Fitness|运动与健身
Food|美食
Wedding|Weddings|婚礼
Documentary|纪录片
Vlog|Vlogs|视频博客
Business & Corporate|商务与企业
Education|教育
Tutorial|Tutorials|教程
Gaming|游戏
Film|电影
Trailer|Trailers|预告片
Commercial|商业广告
Advertising|广告
Social Media|社交媒体
Podcast|Podcasts|播客
Real Estate|房地产
Slow Motion|慢动作
Time Lapse|Time-Lapse|Timelapse|延时摄影
Drone Shots|Drone Shot|航拍
Industry|工业
Intros & Logos|Intros and Logos|片头与标志
Landscape|Landscapes|风景
Medical|医疗
Party|派对
Science|科学
Shorts|短视频
Animation|动画
Urban|都市
Road Trip|公路旅行
Summer|夏日
Christmas|圣诞节
Halloween|万圣节
`;
  for (const line of dictionary.trim().split('\n')) {
    const parts = line.split('|');
    const zh = parts.pop();
    for (const en of parts) WORDS.set(normalize(en), zh);
  }

  function local(text) {
    if (localCache.has(text)) return localCache.get(text);
    const result = lookupLocal(text);
    if (localCache.size >= 3000) localCache.clear();
    localCache.set(text, result);
    return result;
  }
  function lookupLocal(text) {
    const key = normalize(text);
    if (WORDS.has(key)) return WORDS.get(key);
    const colon = key.match(/^(.*?):$/);
    if (colon && WORDS.has(colon[1])) return WORDS.get(colon[1]) + '：';
    // 列表中的曲风链接可能自带逗号，或将多种曲风放在同一个文本节点。
    const commaList = key.split(/\s*,\s*/).filter(Boolean);
    if (key.includes(',') && commaList.length && commaList.every(part => WORDS.has(part))) {
      return commaList.map(part => WORDS.get(part)).join('、') + (key.endsWith(',') ? '，' : '');
    }
    const tempo = key.match(/^(\d+(?:\.\d+)?)\s*bpm$/);
    if (tempo) return tempo[1] + ' 拍/分钟';
    const musicKey = key.match(/^([a-g](?:#|b|♯|♭)?)\s+(major|minor)$/);
    if (musicKey) return musicKey[1][0].toUpperCase() + musicKey[1].slice(1) + (musicKey[2] === 'major' ? ' 大调' : ' 小调');
    const count = key.match(/^([\d,]+)\s+(songs?|tracks?|results?|versions?|sounds?|playlists?)$/);
    if (count) return count[1] + ({ song: ' 首歌曲', track: ' 首歌曲', result: ' 条结果', version: ' 个版本', sound: ' 条音效', playlist: ' 个播放列表' })[count[2].replace(/s$/, '')];
    // 时长筛选按单位解析，覆盖小数、比较符和“3+ min”等写法。
    const duration = key.match(/^([<>]=?|[≤≥])?\s*(\d+(?:\.\d+)?)\s*(\+)?\s*(s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?)\s*(\+)?$/);
    if (duration) {
      const [, comparison, amount, plusBefore, unit, plusAfter] = duration;
      const zhUnit = unit.startsWith('s') ? '秒' : unit.startsWith('m') ? '分钟' : '小时';
      const prefix = { '<': '少于', '>': '多于', '<=': '不超过', '≤': '不超过', '>=': '不少于', '≥': '不少于' }[comparison] || '';
      return prefix + amount + zhUnit + (plusBefore || plusAfter ? '以上' : '');
    }
    const action = text.trim().match(/^(Play|Pause|Download|Share)\s+(.+)$/i);
    if (action) return WORDS.get(normalize(action[1])) + ' ' + action[2];
    return null;
  }

  function songTitle(el) {
    if (el.closest('button')) return false;
    const link = el.closest(SONG_LINK);
    if (link) {
      try {
        const url = new URL(link.getAttribute('href'), location.href);
        if (/^\/(songs|sounds)\/[^/]+\/[^/]+\/?$/.test(url.pathname)) return true;
      } catch { /* 无效链接按普通文字处理。 */ }
    }
    return Boolean(el.closest(SONG_TITLE)) ||
      (/^\/(songs|sounds)\/[^/]+\/[^/]+\/?$/.test(location.pathname) && Boolean(el.closest('h1')));
  }
  function artistName(el) {
    return Boolean(el.closest(ARTIST)) ||
      (/^\/artists\/[^/]+/.test(location.pathname) && Boolean(el.closest('h1')));
  }
  function candidate(el, text, attr) {
    if (!settings.online || text.length > 600 || !/[a-zA-Z]{2}/.test(text) || /[\u3400-\u9fff]/.test(text)) return false;
    if (el.closest(PRIVATE) || artistName(el) || el.closest('nav,header,footer,[role="navigation"]')) return false;
    if (/@|https?:\/\/|www\.|\b[A-Z0-9._%+-]+@/i.test(text)) return false;
    if (attr === 'alt') return false;
    if (/^\/(account|checkout|billing|login|signin|signup|register|projects|licenses|settings|cart|orders|auth)(\/|$)/i.test(location.pathname)) return false;
    if (songTitle(el)) return true;
    if (el.closest(MUSIC_REGION)) return true;
    // 音乐页面的公开正文用于兜底新界面，按钮和筛选弹窗仍先匹配本地词库。
    return (location.pathname === '/' || /^\/(songs|sounds|playlists|genres|moods|attributes|instruments)(\/|$)/.test(location.pathname)) &&
      Boolean(el.closest('main,[role="main"],#root,#__next')) && !el.closest('a[href*="/pricing"],a[href*="/plan"]');
  }
  function current(entry) { return entry.attr ? entry.node.getAttribute(entry.attr) : entry.node.nodeValue; }
  function connected(entry) { return entry.node.isConnected; }
  function put(entry, translated) {
    if (!settings.enabled || !connected(entry) || current(entry) !== entry.source) return;
    const before = entry.source.match(/^\s*/)[0];
    const after = entry.source.match(/\s*$/)[0];
    entry.output = before + translated + after;
    if (entry.attr) entry.node.setAttribute(entry.attr, entry.output);
    else entry.node.nodeValue = entry.output;
  }
  function entryFor(node, attr) {
    let fields = originals.get(node);
    if (!fields) { fields = new Map(); originals.set(node, fields); }
    const key = attr || '';
    const value = attr ? node.getAttribute(attr) : node.nodeValue;
    let entry = fields.get(key);
    // React 等框架复用列表节点后，重新记录新的歌曲原文。
    if (!entry || (value !== entry.output && value !== entry.source)) {
      entry = { node, attr, source: value, output: null };
      fields.set(key, entry);
    }
    return entry;
  }
  function translate(node, attr = null) {
    const value = attr ? node.getAttribute(attr) : node.nodeValue;
    if (!value || !/[a-zA-Z]/.test(value) || value.length > 1200) return;
    const previous = originals.get(node)?.get(attr || '');
    if (previous?.output === value) return;
    const text = value.trim();
    const zh = local(text);
    // 离线模式下不为不需要翻译的歌曲名、人名建立记录或查询祖先选择器。
    if (!zh && !settings.online) return;
    const el = attr ? node : node.parentElement;
    if (!el || el.closest(attr ? SKIP : TEXT_SKIP) || artistName(el)) return;
    const isTitle = !attr && songTitle(el);
    if (zh && !isTitle) { put(entryFor(node, attr), zh); return; }
    if (!candidate(el, text, attr) || el.closest('[hidden],[aria-hidden="true"]')) return;
    const entry = entryFor(node, attr);
    // 缓存可立即在本地显示；没有命中的在线请求仍按可见性排队。
    if (Object.hasOwn(cache, text)) {
      put(entry, isTitle && settings.bilingual ? cache[text] + '（' + text + '）' : cache[text]);
      return;
    }
    if (failed.has(text) || Date.now() < pausedUntil) return;
    if (pending.get(text)?.some(item => item.entry === entry)) return;
    let entries = waitingElements.get(el);
    if (!entries) {
      entries = new Map();
      waitingElements.set(el, entries);
      viewportObserver.observe(el);
    }
    entries.set(entry, { entry, text, isTitle });
    if (inView.has(el)) scheduleVisible();
  }
  function enqueueTranslation({ entry, text, isTitle }) {
    if (!connected(entry) || current(entry) !== entry.source) return true;
    if (failed.has(text) || Date.now() < pausedUntil) return true;
    const apply = result => {
      if (settings.online) put(entry, isTitle && settings.bilingual ? result + '（' + text + '）' : result);
    };
    if (Object.hasOwn(cache, text)) { apply(cache[text]); return true; }
    if (pending.has(text)) {
      const listeners = pending.get(text);
      if (!listeners.some(item => item.entry === entry)) listeners.push({ entry, apply });
      return true;
    }
    if (queue.length >= 160) return false;
    pending.set(text, [{ entry, apply }]);
    queue.push({ text, epoch });
    pump();
    return true;
  }
  function scheduleVisible() {
    if (!visibleTimer && settings.enabled && settings.online) visibleTimer = setTimeout(drainVisible, 16);
  }
  function drainVisible() {
    visibleTimer = 0;
    if (!settings.enabled || !settings.online) return;
    const end = performance.now() + 5;
    let steps = 0;
    let blocked = false;
    outer: for (const el of inView) {
      const entries = waitingElements.get(el);
      if (!el.isConnected || !entries || el.closest('[hidden],[aria-hidden="true"]')) {
        viewportObserver.unobserve(el); waitingElements.delete(el); inView.delete(el);
        continue;
      }
      for (const [entry, item] of entries) {
        if (!enqueueTranslation(item)) { blocked = true; break outer; }
        entries.delete(entry);
        if (++steps >= 100 || performance.now() >= end) break outer;
      }
      viewportObserver.unobserve(el); waitingElements.delete(el); inView.delete(el);
    }
    // 队列满时由请求完成来唤醒，避免持续空转；缓存命中也分批写入。
    if (inView.size && !blocked) scheduleVisible();
  }

  function request(text) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=' + encodeURIComponent(text),
        timeout: 12000,
        anonymous: true,
        onload(response) {
          if (response.status !== 200) { reject(new Error('HTTP ' + response.status)); return; }
          try {
            const data = JSON.parse(response.responseText);
            if (!Array.isArray(data[0])) throw new Error('响应格式不正确');
            const result = data[0].map(part => typeof part?.[0] === 'string' ? part[0] : '').join('').trim();
            if (!result) throw new Error('翻译结果为空');
            resolve(result);
          } catch (error) { reject(error); }
        },
        onerror: () => reject(new Error('网络连接失败')),
        ontimeout: () => reject(new Error('连接超时')),
        onabort: () => reject(new Error('请求已取消')),
      });
    });
  }
  function pump() {
    if (active || !queue.length || !settings.enabled || !settings.online) return;
    if (Date.now() < pausedUntil) return;
    const delay = Math.max(0, 450 - (Date.now() - lastRequest));
    if (delay) { clearTimeout(timer); timer = setTimeout(pump, delay); return; }
    const job = queue.shift();
    const listeners = pending.get(job.text);
    if (job.epoch !== epoch || !listeners?.some(({ entry }) => connected(entry) && current(entry) === entry.source)) {
      pending.delete(job.text); pump(); return;
    }
    active = 1;
    lastRequest = Date.now();
    refreshUI();
    request(job.text).then(result => {
      // 用户关闭翻译或清空缓存后，忽略已经发出的旧请求。
      if (job.epoch !== epoch) return;
      cache[job.text] = result;
      failures = 0;
      for (const { apply } of pending.get(job.text) || []) apply(result);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveCache, 700);
    }).catch(() => {
      if (job.epoch !== epoch) return;
      failed.add(job.text);
      failures++;
      if (failures >= 3) {
        pausedUntil = Date.now() + 60000;
        queue.length = 0;
        pending.clear();
      }
    }).finally(() => {
      if (job.epoch === epoch) pending.delete(job.text);
      active = 0;
      scheduleVisible();
      refreshUI();
      pump();
    });
  }
  function saveCache() {
    const entries = Object.entries(cache).slice(-2500);
    cache = Object.assign(Object.create(null), Object.fromEntries(entries));
    write(KEY + '-cache', cache);
  }
  function* scan(root) {
    if (!settings.enabled || !root?.isConnected) return;
    if (root.nodeType === Node.TEXT_NODE) { translate(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(SKIP)) return;
    function attributes(el) {
      for (const name of ATTRS) if (el.hasAttribute(name)) translate(el, name);
    }
    attributes(root);
    yield;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches(SKIP)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) translate(node);
      else attributes(node);
      yield;
    }
  }
  function installRevealStyle() {
    if (revealStyle?.isConnected || !document.documentElement) return;
    if (!revealStyle) {
      revealStyle = document.createElement('style');
      revealStyle.setAttribute('data-musicbed-zh-style', 'reveal');
      revealStyle.textContent = '[data-musicbed-zh-pending],[data-musicbed-zh-pending] *{visibility:hidden!important}';
    }
    (document.head || document.documentElement).append(revealStyle);
  }
  function reveal(root) {
    const state = pendingMasks.get(root);
    if (!state) return;
    clearTimeout(state.timer);
    pendingMasks.delete(root);
    root.removeAttribute('data-musicbed-zh-pending');
  }
  function conceal(task) {
    const root = task.root;
    if (!task.conceal || task.masked || !root.isConnected || root.nodeType !== Node.ELEMENT_NODE || root === document.body || root === document.documentElement) return;
    installRevealStyle();
    if (!revealStyle?.isConnected) return;
    let state = pendingMasks.get(root);
    if (!state) {
      state = {count:0, timer:setTimeout(() => reveal(root), MASK_LIMIT)};
      pendingMasks.set(root, state);
      root.setAttribute('data-musicbed-zh-pending', '');
    }
    state.count++;
    task.masked = state;
  }
  function finishTask(task) {
    if (!task.masked) return;
    const state = pendingMasks.get(task.root);
    if (state === task.masked && --state.count === 0) reveal(task.root);
  }
  function schedule(root, conceal = false) {
    if (!settings.enabled || !root?.isConnected) return;
    if (root === document.body || root === document.documentElement) {
      for (const child of root.children) schedule(child, conceal);
      return;
    }
    if (root.nodeType === Node.ELEMENT_NODE && (root.tagName === 'HEAD' || root.closest(SKIP))) return;
    if (root.nodeType === Node.TEXT_NODE && !/[a-zA-Z]/.test(root.nodeValue || '')) return;
    if (conceal && root.nodeType === Node.ELEMENT_NODE) maskableRoots.add(root);
    roots.add(root);
    requestScan();
  }
  function requestScan() {
    if (scanQueued) return;
    clearTimeout(scanTimer); scanTimer = 0;
    scanQueued = true;
    const generation = scanGeneration;
    queueMicrotask(() => {
      if (generation !== scanGeneration) return;
      scanQueued = false;
      flushScans();
    });
  }
  function scheduleAttribute(el, name) {
    if (!settings.enabled || !el.isConnected) return;
    let names = attributeJobs.get(el);
    if (!names) { names = new Set(); attributeJobs.set(el, names); }
    names.add(name);
    requestScan();
  }
  function* scanAttributes(el, names) {
    for (const name of names) { translate(el, name); yield; }
  }
  function flushScans() {
    scanTimer = 0;
    if (!settings.enabled) return;
    const batch = new Set(roots); roots.clear();
    for (const root of batch) {
      // 沿祖先链查重，避免变动数量增加时出现两两比较。
      let parent = root.parentNode;
      while (parent && !batch.has(parent)) parent = parent.parentNode;
      if (!parent && root.isConnected) scanTasks.push({ root, iterator: scan(root), conceal:maskableRoots.has(root) });
      maskableRoots.delete(root);
    }
    for (const [el, names] of attributeJobs) {
      scanTasks.push({ root: el, iterator: scanAttributes(el, names) });
    }
    attributeJobs.clear();
    const end = performance.now() + 4;
    let steps = 0;
    while (scanTasks.length && steps++ < 320 && performance.now() < end) {
      const task = scanTasks[scanTasks.length - 1];
      let done = !task.root?.isConnected;
      try { if (!done) done = task.iterator.next().done; } catch { done = true; }
      if (done) { scanTasks.pop(); finishTask(task); }
    }
    // 小菜单在当前微任务中完成；大块新增内容分批处理，局部遮罩有超时兜底。
    for (const task of scanTasks) conceal(task);
    if (roots.size || attributeJobs.size || scanTasks.length) scanTimer = setTimeout(flushScans, 0);
  }
  function* prune() {
    for (const [node, fields] of originals) {
      if (!node.isConnected) { originals.delete(node); yield; continue; }
      for (const [key, entry] of fields) {
        const value = current(entry);
        if (value !== entry.source && value !== entry.output) fields.delete(key);
      }
      yield;
    }
    for (const el of waitingElements.keys()) {
      if (!el.isConnected) {
        viewportObserver.unobserve(el); waitingElements.delete(el); inView.delete(el);
      }
      yield;
    }
  }
  function restore() {
    for (const fields of originals.values()) for (const entry of fields.values()) {
      if (!connected(entry) || current(entry) !== entry.output) continue;
      if (entry.attr) entry.node.setAttribute(entry.attr, entry.source);
      else entry.node.nodeValue = entry.source;
    }
    originals.clear();
  }
  function resetWork() {
    epoch++;
    clearTimeout(timer);
    clearTimeout(scanTimer); scanTimer = 0;
    scanGeneration++; scanQueued = false;
    for (const root of [...pendingMasks.keys()]) reveal(root);
    clearTimeout(visibleTimer); visibleTimer = 0;
    roots.clear(); attributeJobs.clear(); scanTasks.length = 0;
    viewportObserver?.disconnect();
    waitingElements.clear(); inView.clear();
    queue.length = 0;
    pending.clear();
    failed.clear();
    failures = 0;
    pausedUntil = 0;
  }
  function change(patch) {
    resetWork();
    restore();
    Object.assign(settings, patch);
    write(KEY + '-settings', settings);
    refreshUI();
    if (settings.enabled) schedule(document.body, true);
  }
  function enableOnline() {
    if (settings.online) { change({ online: false }); return; }
    const ok = window.confirm('开启后，会将歌曲或音效名称、公开页面描述和未匹配的音乐页面文字发送至 Google 翻译，结果仅作参考。不会发送输入框内容。需要能访问 Google 的网络。是否开启？');
    if (ok) change({ online: true });
  }
  function refreshUI() {
    if (!ui) return;
    ui.toggle.textContent = settings.enabled ? '显示英文原文' : '恢复中文翻译';
    ui.online.textContent = settings.online ? '关闭在线翻译' : '开启名称和正文在线翻译';
    ui.bilingual.textContent = settings.bilingual ? '名称：中英双语 ✓' : '名称：仅中文';
    ui.status.textContent = !settings.enabled ? '已显示原文' : !settings.online ? '本地词库已启用 · 名称保留原文' : Date.now() < pausedUntil ? '在线连接失败 · 请检查网络后重试' : active || queue.length ? '正在补充翻译…' : failed.size ? '部分内容未译 · 可点击重新扫描' : '中文已启用 · 在线翻译已开启';
  }
  function panel() {
    host = document.createElement('div');
    host.setAttribute('data-musicbed-zh', 'panel');
    host.style.cssText = 'position:fixed;right:16px;bottom:92px;z-index:2147483647';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      :host{all:initial;font:13px/1.6 system-ui,"Microsoft YaHei",sans-serif;color:#f5f5f5}
      details{width:245px;background:#202124;border:1px solid #62656b;border-radius:12px;box-shadow:0 4px 20px #0005}
      details:not([open]){width:auto}summary{cursor:pointer;list-style:none;padding:9px 14px;font-weight:600}
      .body{padding:0 12px 12px}button{display:block;width:100%;margin-top:7px;padding:7px;border:1px solid #6c7077;border-radius:6px;background:#303238;color:#fff;cursor:pointer;font:inherit;text-align:left}
      button:hover{background:#44474f}p{margin:4px 0;color:#d1d5db;font-size:12px}a{color:#a7c5ff}
      @media(max-width:480px){details{width:220px}}
    </style><details><summary>中 / EN · Musicbed 翻译</summary><div class="body">
      <p id="status" role="status"></p><button id="toggle"></button><button id="online"></button><button id="bilingual"></button>
      <button id="rescan">重新扫描 / 重试未译内容</button><button id="clear">清空在线翻译缓存</button>
      <p>在线翻译会将公开音乐文字发送至 Google；人名尽量保留原文。翻译结果仅供参考。</p>
    </div></details>`;
    ui = Object.fromEntries(['status', 'toggle', 'online', 'bilingual', 'rescan', 'clear'].map(id => [id, shadow.getElementById(id)]));
    ui.toggle.onclick = () => change({ enabled: !settings.enabled });
    ui.online.onclick = enableOnline;
    ui.bilingual.onclick = () => change({ bilingual: !settings.bilingual });
    ui.rescan.onclick = () => { resetWork(); schedule(document.body); refreshUI(); };
    ui.clear.onclick = () => { resetWork(); clearTimeout(saveTimer); cache = Object.create(null); write(KEY + '-cache', {}); restore(); schedule(document.body, true); refreshUI(); };
    document.body.append(host);
    refreshUI();
  }
  function start() {
    function mount() {
      installRevealStyle();
      if (document.body && document.readyState !== 'loading') {
        if (!host) panel();
        else if (!host.isConnected) document.body.append(host);
      }
    }
    mount();
    document.addEventListener('DOMContentLoaded', mount, {once:true});
    viewportObserver = new IntersectionObserver(records => {
      for (const record of records) {
        if (record.isIntersecting) inView.add(record.target);
        else inView.delete(record.target);
      }
      scheduleVisible();
    });
    const observer = new MutationObserver(records => {
      mount();
      if (!settings.enabled) return;
      for (const record of records) {
        if (record.type === 'characterData' || record.type === 'attributes') {
          const entry = originals.get(record.target)?.get(record.attributeName || '');
          // 忽略本脚本刚写回的译文，避免翻译引发下一轮翻译。
          if (entry && current(entry) === entry.output) continue;
          if (record.type === 'attributes' && ATTRS.includes(record.attributeName)) scheduleAttribute(record.target, record.attributeName);
          else schedule(record.target);
        }
        else {
          for (const node of record.addedNodes) schedule(node, true);
          if (record.removedNodes.length) needsPrune = true;
        }
      }
    });
    observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: [...ATTRS, 'href', 'hidden', 'aria-hidden', 'data-testid'] });
    schedule(document.body || document.documentElement, true);
    // 可见性由浏览器通知，只补译进入视口的文字，滚动不再遍历整页。
    setInterval(() => {
      if (needsPrune && settings.enabled) {
        needsPrune = false;
        scanTasks.push({ root: document.body, iterator: prune() });
        requestScan();
      }
    }, 30000);
    // 保留已有中文和仍有效的在线任务；代码不接管网站的 history 方法。
    let url = location.pathname + location.search;
    function navigation() {
      const next = location.pathname + location.search;
      if (url !== next) {
        url = next;
        schedule(document.querySelector('main,[role="main"]') || document.body);
        scheduleVisible();
      }
    }
    window.addEventListener('popstate', navigation);
    document.addEventListener('turbo:load', navigation);
    document.addEventListener('pjax:end', navigation);
    setInterval(navigation, 1500);
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('中文 / 英文切换', () => change({ enabled: !settings.enabled }));
      GM_registerMenuCommand('开启 / 关闭名称和正文在线翻译', enableOnline);
      GM_registerMenuCommand('重新扫描 / 重试未译内容', () => { resetWork(); schedule(document.body); refreshUI(); });
    }
  }
  start();
})();
