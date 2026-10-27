// MiniMax Audio adapter. All translations stay local; user content and requests are untouched.
(() => {
  'use strict';
  const KEY = 'minimax-zh-v1';
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'data-placeholder', 'label'];
  const SKIP = 'script,style,noscript,code,pre,kbd,svg,canvas,iframe,textarea,input,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],.ProseMirror,.tiptap,.cm-editor,.monaco-editor,[data-slate-editor],[data-lexical-editor],[translate="no"],[data-private],[data-sensitive],[data-minimax-zh]';
  // Attributes such as placeholder can be translated without touching editable text or values.
  const ATTR_SKIP = 'script,style,noscript,svg,canvas,iframe,code,pre,[translate="no"],[data-private],[data-sensitive],[data-minimax-zh]';
  const CONTENT = '[data-user-content],[data-generated-content],[data-voice-name],[data-song-name],[data-testid="voice-name"],[data-testid="work-title"],[data-testid="generated-text"],[data-testid="lyrics-content"],.voice-name,.song-name,.file-name,.filename,.generated-content,.generated-text,.lyrics-content,.prompt-content,.user-content';
  const INLINE_BLOCK = 'p,label,h1,h2,h3,[role="alert"],.ant-form-item-explain,.ant-form-item-extra';
  const originals = new Map();
  const localCache = new Map();
  let settings;
  try { settings = {enabled:true, ...GM_getValue(KEY+'-settings', {})}; }
  catch { settings = {enabled:true}; }
  let host, ui, lastUrl = location.pathname + location.search, needsPrune = false;
  const isAudio = () => location.pathname === '/audio' || location.pathname.startsWith('/audio/');
  const enabled = () => settings.enabled && isAudio();
  const words = new Map();
  const normalize = text => text.normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/[’‘]/g,"'").replace(/[–—‑]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();
  for (const line of `
MiniMax Audio&Music|MiniMax 音频与音乐
Audio|音频
Home|首页
Voice Library|音色库
Voices|音色
My Voices|我的音色
My Voice|我的音色
My Clones|我的克隆音色
Official Voices|官方音色
Community Voices|社区音色
Add Voice|添加音色
New Voice|新建音色
All Voices|全部音色
AI Generation|AI 生成
AI Tools|AI 工具
Text to Speech|文本转语音
Text-to-Speech|文本转语音
Music|音乐
Music Creation|音乐创作
Voice Design|音色设计
Voice Clone|声音克隆
Voice Cloning|声音克隆
Voice Isolator|人声分离
Subscribe|订阅
Subscription|订阅
Manage Subscription|管理订阅
Access API|访问 API
About MiniMax|关于 MiniMax
Sign In|登录
Sign Up|注册
Log In|登录
Log Out|退出登录
Continue with Google|使用 Google 继续
Continue with Apple|使用 Apple 继续
Continue with email|使用邮箱继续
Email|邮箱
Email address|邮箱地址
Password|密码
Enter your email|输入邮箱地址
Enter your password|输入密码
Verification code|验证码
Send code|发送验证码
Resend code|重新发送验证码
Terms of Service|服务条款
Term of Service|服务条款
Terms of Use|使用条款
Privacy Policy|隐私政策
Music Creation Terms of Use|音乐创作使用条款
I have read and agree to the|我已阅读并同意
I have read and agree to the Term of Service and Privacy Policy|我已阅读并同意服务条款和隐私政策
clean voice recording|清晰人声
and|与
Agree|同意
Cancel|取消
Confirm|确认
Continue|继续
Back|返回
Next|下一步
Close|关闭
New|新
Create|创建
Generate|生成
Generate Voice|生成语音
Generate Music|生成音乐
Generating|正在生成
Generating...|正在生成…
Loading|正在加载
Loading...|正在加载…
Processing|正在处理
Processing...|正在处理…
Uploading|正在上传
Uploading...|正在上传…
Upload failed|上传失败
Upload successful|上传成功
Completed|已完成
Failed|失败
Success|成功
Pending|等待中
Upload|上传
Upload Audio|上传音频
Upload file|上传文件
Upload File|上传文件
Record Audio|录制音频
Record audio|录制音频
Start Recording|开始录音
Stop Recording|停止录音
Stop|停止
Pause|暂停
Play|播放
Preview|试听
Download|下载
Download Audio|下载音频
Download All|全部下载
Export|导出
Share|分享
Copy Link|复制链接
Copy|复制
Copied|已复制
Delete|删除
Delete Voice|删除音色
Rename|重命名
Edit|编辑
Save|保存
Save Changes|保存更改
Reset|重置
Retry|重试
Try Again|重试
Try Now|立即体验
Try Now Free|立即免费体验
Try for Free|免费体验
Free Trial|免费试用
Try All Features Free|免费体验全部功能
View All|查看全部
Show More|显示更多
More|更多
Less|收起
Explore more|探索更多
Search|搜索
Search voices|搜索音色
Search for voices|搜索音色
Search music|搜索音乐
Search by name|按名称搜索
Filters|筛选
Filter|筛选
Clear|清除
Clear All|全部清除
Apply|应用
All|全部
Default|默认
Recommended|推荐
Popular|热门
Latest|最新
Newest|最新
Favorites|收藏
Collection|收藏
My Work|我的作品
My Works|我的作品
History|历史记录
Recent|最近
Settings|设置
Voice Settings|音色设置
Audio Settings|音频设置
Advanced Settings|高级设置
Advanced Settings (Optional)|高级设置（可选）
Model|模型
Select Model|选择模型
Select a model|选择模型
Language|语言
Select Language|选择语言
Auto|自动
Auto-detect|自动识别
Auto-generate|自动生成
Text to Preview|试听文本
Text to Preview Auto-generate|试听文本 · 自动生成
Prompt|提示词
Enter your prompt|输入提示词
Describe the voice you want|描述你想要的声音
Create Lifelike Audio|创作逼真语音
Tell a Story|讲故事
Create a Commercial|制作广告
Build an AI Tutor|创建 AI 导师
Explore voices to match your need|探索适合你的音色
Discover music to match your project|发现适合项目的音乐
Audio Tools|音频工具
Original Audio|原始音频
Cloned Result|克隆效果
Clone Your Voice|克隆你的声音
Clone Voice|克隆声音
Browse Voices|浏览音色
Isolate Voice|分离人声
Create Any Voice You Can Imagine - From Simple Text Description|通过简单的文字描述，创造你想象中的声音
Experience instant voice magic with just 10 seconds of audio input!|只需输入 10 秒音频，即可体验声音克隆！
Start typing here to create lifelike audio in multiple languages, voices and emotions with Minimax AI.|在此输入文字，使用 MiniMax AI 创作包含多种语言、音色和情绪的逼真语音。
Speed|语速
Pitch|音调
Volume|音量
Emotion|情绪
Emotions|情绪
Voice Effects|声音效果
Voice Parameter|音色参数
Voice Parameters|音色参数
Voice Modification|音色调整
Voice Changer|变声
Loudness|响度
Intensity|强度
Sound Effects|音效
Pronunciation|发音
Pronunciation Dictionary|发音词典
Audio Format|音频格式
Output Format|输出格式
Sample Rate|采样率
Bitrate|比特率
Quality|质量
High Quality|高质量
Standard|标准
HD|高清
Turbo|快速
Stability|稳定性
Similarity|相似度
Style|风格
Styles|风格
Lyrics|歌词
Song Name (Optional)|歌曲名称（可选）
Song Name|歌曲名称
Quantity|数量
characters|个字符
character|个字符
Voice slots remaining|剩余音色名额
Instrumental|纯音乐
Instrumental Only|仅生成纯音乐
No vocals|无人声
Vocal|人声
Vocals|人声
Genre|曲风
Mood|情绪
Duration|时长
Intro|前奏
Verse|主歌
Chorus|副歌
Bridge|过渡段
Outro|尾奏
Pre-Chorus|预副歌
Interlude|间奏
Start creating music in MiniMax Audio|开始在 MiniMax Audio 创作音乐
Nothing here. Type anything into the textbox on the left to create your music.|暂无内容。在左侧文本框中输入内容，开始创作音乐。
Add your lyrics here, or type "/" to view or insert structure tags. You can add arrangement, vocal, and mood notes after tags like [Intro], [Verse], and [Chorus]. If left blank, we’ll auto-generate lyrics based on your style.|在此添加歌词，或输入“/”查看并插入结构标签。可在 [Intro]、[Verse]、[Chorus] 等标签后添加编曲、人声和情绪说明。留空时，将根据你的风格自动生成歌词。
By using this feature, you confirm that you have the necessary rights to any content that you input. Do not generate content that infringes on others intellectual property or privacy rights. Your use of this generative Al service is subject to|使用此功能即表示你确认对输入内容拥有必要权利。请勿生成侵犯他人知识产权或隐私权的内容。使用此生成式 AI 服务须遵守
Import your Voice|导入声音
Uploaded Samples|已上传的样本
Add or drop a file|添加文件或拖放到此处
Release it and the file will be uploaded|松开即可上传文件
Up to 20MB each|每个文件不超过 20 MB
10-60 seconds long|时长为 10–60 秒
or|或
Clone a voice using as little as a 10-second clean voice clip.|使用短至 10 秒的清晰录音，即可克隆声音。
Remove Background Noise|去除背景噪声
Enable Accent Optimization|启用口音优化
Noise Reduction|降噪
Voice Name|音色名称
Enter voice name|输入音色名称
Voice Description|音色描述
Generated voice results will appear here|生成的音色结果将显示在这里
Please upload a clean voice recording in a quiet environment. Reverb, multiple speakers, background noise, etc., will affect the voice cloning quality.|请上传在安静环境中录制的清晰人声。混响、多人说话和背景噪声等会影响声音克隆质量。
You can use the noise separation feature to reduce audio noise, but this may also impact the detail of the voice. Therefore, it is recommended to choose the best-quality segment when selecting the material for cloning.|可使用噪声分离功能减少音频噪声，但这也可能影响声音细节。因此，选择克隆素材时，建议使用质量最好的片段。
I confirm that I have all necessary rights and authorization to upload these voice samples to generate AI content, and I reaffirm that I will abide by the Terms of Service and refrain from using any generated content for illegal or harmful purposes.|我确认拥有上传这些声音样本并生成 AI 内容所需的一切权利和授权，并再次承诺遵守服务条款，不将生成内容用于非法或有害用途。
Isolate background noise to get pure speech audio for better quality.|分离背景噪声，获得更纯净、质量更好的语音。
Add or drop an audio or video file, up to 500MB and 300 seconds.|添加或拖放音频或视频文件，大小不超过 500 MB，时长不超过 300 秒。
Gender|性别
Age|年龄
Accent|口音
Accents|口音
Use Case|使用场景
Use Cases|使用场景
Male|男声
Female|女声
Young|青年
Middle-aged|中年
Old|老年
Child|儿童
Happy|快乐
Sad|悲伤
Angry|愤怒
Surprised|惊讶
Fearful|恐惧
Disgusted|厌恶
Neutral|自然
Calm|平静
Excited|兴奋
Whisper|耳语
Whispering|耳语
English|英语
Chinese|中文
Mandarin|普通话
Cantonese|粤语
Japanese|日语
Korean|韩语
French|法语
German|德语
Spanish|西班牙语
Portuguese|葡萄牙语
Russian|俄语
Ukrainian|乌克兰语
Arabic|阿拉伯语
Italian|意大利语
Hindi|印地语
Vietnamese|越南语
Thai|泰语
Indonesian|印度尼西亚语
Turkish|土耳其语
Dutch|荷兰语
Polish|波兰语
American|美式
British|英式
Australian|澳大利亚
Indian|印度
Documentary|纪录片
Education|教育
Presentation|演示
Games & RPG|游戏与角色扮演
Audiobooks & Novels|有声书与小说
Anime & Animation|动漫与动画
Character Dubbing|角色配音
Commercials & Trailers|广告与预告片
Corporate & Narration|企业与解说
E-Learning|在线教学
Podcasts & Social|播客与社交媒体
Audio Drama|广播剧
Electronic|电子
R&B|节奏布鲁斯
POP|流行
Jazz|爵士
Country|乡村
Blues|布鲁斯
Rock|摇滚
Classical|古典
Hip Hop|嘻哈
Ambient|氛围音乐
Credits|点数
Remaining Credits|剩余点数
Upgrade|升级
Upgrade Plan|升级套餐
Current Plan|当前套餐
Free Plan|免费套餐
Pro Plan|专业版套餐
Basic Plan|基础版套餐
Buy Credits|购买点数
Usage|用量
Usage History|用量记录
Free|免费
Monthly|按月
Yearly|按年
Billing|账单
Payment|付款
Payment Method|支付方式
Cancel Subscription|取消订阅
Cookie Consent|Cookie 使用同意
Accept All Cookies|接受全部 Cookie
Reject All|全部拒绝
Customize|自定义
Read our Cookies Policy|阅读 Cookie 政策
We use cookies to analyze website usage to improve your experience.|我们使用 Cookie 分析网站使用情况，以改善体验。
By clicking "Accept All Cookies", you agree to the storing of cookies on your device to enhance site navigation, analyze site usage, and assist in our marketing efforts. You may click Customize to reject non-essential cookies or personalize the types of cookies you would like to allow.|点击“接受全部 Cookie”，即表示你同意在设备上存储 Cookie，用于改善网站导航、分析使用情况和协助营销。也可点击“自定义”拒绝非必要 Cookie，或选择允许的类型。
Something went wrong|发生错误
Please try again|请重试
Generation failed|生成失败
Insufficient credits|点数不足
No results found|未找到结果
No data|暂无数据
No results|暂无结果
`.trim().split('\n')) {
    const split = line.indexOf('|');
    if (split > 0) words.set(normalize(line.slice(0,split)), line.slice(split+1));
  }
  function local(value) {
    const key = normalize(value);
    if (localCache.has(key)) return localCache.get(key);
    let translated = words.get(key) || null;
    if (!translated && /:$/.test(key) && words.has(key.slice(0,-1).trim())) translated=words.get(key.slice(0,-1).trim())+'：';
    const rules = [
      [/^(\d[\d,]*)\s*\/\s*([\d,]+)\s*characters?$/i, m=>m[1]+' / '+m[2]+' 个字符'],
      [/^voice slots remaining:\s*([\d,]+)\s*\/\s*([\d,]+)$/i, m=>'剩余音色名额：'+m[1]+'/'+m[2]],
      [/^quantity:\s*(\d+)$/i, m=>'数量：'+m[1]],
      [/^(\d[\d,]*)\s+create$/i, m=>m[1]+' 创建'],
      [/^(\d[\d,]*)\s+credits?$/i, m=>m[1]+' 点数'],
      [/^you have (\d+) free trials? remaining\.?$/i, m=>'你还有 '+m[1]+' 次免费试用'],
      [/^up to\s*([\d.]+)\s*(KB|MB|GB)\s*(each)?$/i, m=>'不超过 '+m[1]+' '+m[2].toUpperCase()+(m[3]?' / 个':'')],
      [/^(\d+(?:\.\d+)?)\s*seconds?$/i, m=>m[1]+' 秒'],
      [/^(\d+(?:\.\d+)?)\s*minutes?$/i, m=>m[1]+' 分钟'],
      [/^request failed with status code (\d{3})$/i, m=>'请求失败，状态码 '+m[1]],
      [/^(?:speech-)?([\d.]+)\s+new$/i, m=>value.trim().replace(/new$/i,'新')],
    ];
    if (!translated) for (const [pattern, format] of rules) { const match = key.match(pattern); if (match) { translated = format(match); break; } }
    if (localCache.size >= 3000) localCache.clear();
    localCache.set(key,translated);
    return translated;
  }
  function current(entry) { return entry.attr ? entry.node.getAttribute(entry.attr) : entry.node.nodeValue; }
  function entryFor(node, attr) {
    let fields = originals.get(node);
    if (!fields) originals.set(node,fields=new Map());
    const key=attr||'', value=attr?node.getAttribute(attr):node.nodeValue;
    let entry=fields.get(key);
    if (!entry || (value!==entry.source && value!==entry.output)) {
      entry={node,attr,source:value,output:null}; fields.set(key,entry);
    }
    return entry;
  }
  function put(entry, translated) {
    if (!enabled() || !entry.node.isConnected || current(entry)!==entry.source) return;
    const source=entry.source||'';
    entry.output=source.match(/^\s*/)[0]+translated+source.match(/\s*$/)[0];
    if(entry.attr) entry.node.setAttribute(entry.attr,entry.output);
    else entry.node.nodeValue=entry.output;
  }
  function translateOption(option) {
    if (!enabled() || option.closest(ATTR_SKIP+','+CONTENT)) return;
    const label=option.getAttribute('label');
    const previous=originals.get(option)?.get('label');
    const ownLabel=previous && previous.output===label;
    const text=option.textContent;
    if(ownLabel && (previous.source!==null || previous.optionText===text)) return;
    const zh=local(ownLabel?text:(label===null?text:label));
    // Keep native option text and implicit/explicit values intact; localize only its label.
    if(ownLabel) {
      previous.optionText=text;
      if(zh) {previous.output=zh;option.setAttribute('label',zh);}
      else {option.removeAttribute('label');originals.get(option).delete('label');}
    } else if(zh) {
      const entry=entryFor(option,'label');entry.optionText=text;put(entry,zh);
    }
  }
  function translateInline(el) {
    if(!el || !el.isConnected || el.closest(SKIP+','+CONTENT) || el.childElementCount===0) return false;
    if(el.querySelector('input,textarea,select,button,[role="button"],[tabindex],[contenteditable],'+ATTR_SKIP+','+CONTENT)) return false;
    const source=el.textContent;
    if(source.length>2000 || !/[a-z]/i.test(source)) return false;
    const target=local(source);
    if(!target) return false;
    const items=[], anchors=[];
    function collect(node,anchor=null) {
      if(node.nodeType===Node.TEXT_NODE) {items.push({node,anchor});return;}
      if(node.nodeType!==Node.ELEMENT_NODE) return;
      if(!anchor && /^(A|STRONG|B|EM)$/.test(node.tagName)) {anchor=node;anchors.push(anchor);}
      for(const child of node.childNodes) collect(child,anchor);
    }
    collect(el);
    const positions=new Map();let cursor=0;
    for(const anchor of anchors) {
      const value=local(anchor.textContent)||anchor.textContent.trim();
      const start=target.indexOf(value,cursor);
      if(!value || start<0) return false;
      positions.set(anchor,{start,value});cursor=start+value.length;
    }
    const runs=[];
    for(const item of items) {
      let run=runs[runs.length-1];
      if(!run || run.anchor!==item.anchor) {run={anchor:item.anchor,nodes:[]};runs.push(run);}
      run.nodes.push(item.node);
    }
    const updates=[];cursor=0;
    for(let i=0;i<runs.length;i++) {
      const run=runs[i];let output;
      if(run.anchor) {
        const position=positions.get(run.anchor);
        if(cursor!==position.start)return false;
        output=position.value;cursor=position.start+output.length;
      } else {
        const next=runs[i+1]?.anchor;
        const end=next?positions.get(next).start:target.length;
        output=target.slice(cursor,end);cursor=end;
      }
      run.nodes.forEach((node,index)=>updates.push({node,output:index===0?output:''}));
    }
    if(cursor!==target.length)return false;
    // Keep links, emphasis elements, handlers and whitespace positions; never replace innerHTML.
    for(const {node,output} of updates) {
      const entry=entryFor(node,null);
      if(!enabled() || !node.isConnected || current(entry)!==entry.source)continue;
      entry.output=output;node.nodeValue=output;
    }
    return true;
  }
  function translate(node, attr=null) {
    if (!enabled()) return;
    const el=attr?node:node.parentElement;
    if(!attr && el?.closest('option')) {translateOption(el.closest('option'));return;}
    if (!el || el.closest((attr?ATTR_SKIP:SKIP)+','+CONTENT)) return;
    if (attr==='label' && el.tagName!=='OPTION') return;
    const value=attr?node.getAttribute(attr):node.nodeValue;
    if (!value || value.length>2000 || !/[a-z]/i.test(value)) return;
    if (originals.get(node)?.get(attr||'')?.output===value) return;
    if(!attr && translateInline(el.closest(INLINE_BLOCK)))return;
    const zh=local(value);
    if (zh) put(entryFor(node,attr),zh);
  }
  function* scan(root) {
    if(!enabled() || !root?.isConnected) return;
    if(root.nodeType===Node.TEXT_NODE) {translate(root);return;}
    if(root.nodeType!==Node.ELEMENT_NODE || root.closest(ATTR_SKIP+','+CONTENT)) return;
    function attributes(el) {
      if(el.tagName==='OPTION') {translateOption(el);return;}
      for(const name of ATTRS) if(el.hasAttribute(name)) translate(el,name);
      if(el.matches(INLINE_BLOCK))translateInline(el);
    }
    attributes(root); yield;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{
      acceptNode(node) {
        if(node.nodeType===Node.ELEMENT_NODE && node.matches(ATTR_SKIP+','+CONTENT)) return NodeFilter.FILTER_REJECT;
        // Editable subtrees are skipped, but their display attributes can still be translated.
        if(node.parentElement?.closest(SKIP) && node.nodeType===Node.TEXT_NODE) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while((node=walker.nextNode())) {if(node.nodeType===Node.TEXT_NODE) translate(node);else attributes(node);yield;}
  }
  const renderCore=createRenderCore({site:'minimax',enabled,skip:ATTR_SKIP+','+CONTENT,scan,translate});
  const {schedule,scheduleAttribute,installRevealStyle}=renderCore;
  const {mountScriptUpdate,checkScriptUpdate}=createScriptUpdater(()=>host);
  function restore() {
    for(const fields of originals.values()) for(const entry of fields.values()) {
      if(!entry.node.isConnected || current(entry)!==entry.output) continue;
      if(entry.attr && entry.source===null) entry.node.removeAttribute(entry.attr);
      else if(entry.attr) entry.node.setAttribute(entry.attr,entry.source);
      else entry.node.nodeValue=entry.source;
    }
    originals.clear();
  }
  function refreshUI() {if(ui) ui.toggle.textContent=settings.enabled?'显示英文原文':'恢复中文翻译';}
  function toggle() {
    renderCore.reset(); restore(); settings.enabled=!settings.enabled;
    try {GM_setValue(KEY+'-settings',settings);} catch { /* Keep this page usable without storage. */ }
    refreshUI(); if(enabled()) schedule(document.body,true);
  }
  function panel() {
    host=document.createElement('div');host.setAttribute('data-minimax-zh','panel');
    host.style.cssText='position:fixed;right:16px;bottom:24px;z-index:2147483647';
    const shadow=host.attachShadow({mode:'open'});
    shadow.innerHTML=`<style>:host{all:initial;font:13px/1.6 system-ui,"Microsoft YaHei",sans-serif;color:#f5f5f5}details{width:270px;max-height:75vh;overflow:auto;background:#202124;border:1px solid #62656b;border-radius:12px;box-shadow:0 4px 20px #0005}details:not([open]){width:auto}summary{cursor:pointer;list-style:none;padding:9px 14px;font-weight:600}.body{padding:0 12px 12px}button{display:block;width:100%;margin-top:7px;padding:7px;border:1px solid #6c7077;border-radius:6px;background:#303238;color:#fff;cursor:pointer;font:inherit;text-align:left}p{font-size:12px;color:#d1d5db;margin:4px 0}button:disabled{opacity:.6;cursor:wait}@media(max-width:480px){details{width:245px}}</style><details><summary>中 / EN · 网站翻译（MiniMax Audio）</summary><div class="body"><p>本地界面翻译 · 输入与生成内容保留原文</p><button id="toggle"></button><button id="rescan">重新扫描界面</button></div></details>`;
    ui={toggle:shadow.getElementById('toggle')};ui.toggle.onclick=toggle;
    shadow.getElementById('rescan').onclick=()=>{renderCore.reset();schedule(document.body,true);};
    mountScriptUpdate();document.body.append(host);refreshUI();
  }
  function mount() {
    installRevealStyle();
    if(document.body && document.readyState!=='loading') {
      if(!host && isAudio()) panel();
      else if(host && !host.isConnected) document.body.append(host);
      if(host) host.hidden=!isAudio();
    }
  }
  function navigation() {
    const next=location.pathname+location.search;
    if(next===lastUrl) return;
    const reentering=!/^\/audio(?:[/?]|$)/.test(lastUrl);
    lastUrl=next;
    if(!isAudio()) {renderCore.reset();restore();if(host)host.hidden=true;return;}
    mount();schedule(reentering?document.body:(document.querySelector('main,[role="main"]')||document.body),true);
  }
  mount();document.addEventListener('DOMContentLoaded',mount,{once:true});
  const observer=new MutationObserver(records=>{
    navigation();mount();if(!enabled()) return;
    for(const record of records) {
      if(record.type==='childList') {
        for(const node of record.addedNodes) schedule(node,true);
        if(record.removedNodes.length) needsPrune=true;
      } else {
        const entry=originals.get(record.target)?.get(record.attributeName||'');
        if(entry && current(entry)===entry.output) continue;
        if(record.type==='attributes') scheduleAttribute(record.target,record.attributeName);
        else schedule(record.target);
      }
    }
  });
  observer.observe(document,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
  schedule(document.body||document.documentElement,true);
  window.addEventListener('popstate',navigation);
  document.addEventListener('turbo:load',navigation);document.addEventListener('pjax:end',navigation);
  setInterval(navigation,1500);
  function* prune() {
    for(const [node,fields] of originals) {
      if(!node.isConnected) {originals.delete(node);yield;continue;}
      for(const [key,entry] of fields) if(current(entry)!==entry.source && current(entry)!==entry.output) fields.delete(key);
      yield;
    }
  }
  setInterval(()=>{
    if(!needsPrune || !enabled())return;needsPrune=false;
    renderCore.scanTasks.push({root:document.body,iterator:prune()});renderCore.requestScan();
  },30000);
  if(typeof GM_registerMenuCommand==='function') {
    GM_registerMenuCommand('检查脚本更新',checkScriptUpdate);
    GM_registerMenuCommand('中文 / 英文界面切换',toggle);
    GM_registerMenuCommand('重新扫描界面',()=>{renderCore.reset();schedule(document.body,true);});
  }
})();
