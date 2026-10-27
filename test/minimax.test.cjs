const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const script=fs.readFileSync(path.join(__dirname,'..','websites-zh-CN.user.js'),'utf8');
const fixture=`<!doctype html><meta charset="utf-8"><header><button id="home">Home</button><button>Sign In</button></header><main>
<nav><a href="/audio/voices-cloning">Voice Clone</a><a href="/audio/voice-design">Voice Design</a></nav>
<h1 id="title">Text to Speech</h1><button id="generate">Generate</button><p id="count">1,250 / 3,000 characters</p><p id="slots">Voice slots remaining: 2/10</p>
<form><label for="prompt">Prompt</label><textarea id="prompt" placeholder="Enter your prompt">Generate Music</textarea><input id="song" placeholder="Song Name (Optional)" value="Home"><input id="secret" type="password" value="Secret password"><input id="file" type="file"><input id="agree" type="checkbox" value="agreed"><label for="agree"><span>I have read and agree to the </span><a id="terms" href="/audio/doc/terms-of-service.html">Term of Service</a><span> and </span><a href="/audio/doc/privacy.html">Privacy Policy</a></label></form>
<div id="editor" contenteditable="true"><p>Home</p><span>Happy</span></div><div class="ProseMirror" id="rich">Generate</div>
<div data-generated-content id="output">Happy</div><span data-voice-name id="voice">Calm</span><span class="file-name" id="filename">Generate</span><span id="model">speech-2.8-hd</span>
<select id="language"><option id="implicit">English</option><option id="explicit" value="ja">Japanese</option></select>
<p id="inline">I have read and agree to the <a id="inline-terms" href="/audio/doc/terms.html">Term of Service</a> and <a href="/audio/doc/privacy.html">Privacy Policy</a></p><p id="split"><span>Generated voice </span><span>results will appear here</span></p><p id="instruction">Clone a voice using as little as a 10-second clean voice clip.</p>
<p id="drop">Add or drop an audio or video file, up to 500MB and 300 seconds.</p><p id="error">Request failed with status code 501</p>
<input id="range" type="range" min="0.5" max="2" step="0.1" value="1.2"><span id="rate">1.2x</span><pre id="code">Generate</pre><p translate="no" id="no">Music</p></main><script>
window.__frames=[];requestAnimationFrame(function sample(){const el=document.querySelector('#title');if(el)__frames.push({text:el.textContent,visible:getComputedStyle(el).visibility!=='hidden'});if(__frames.length<4)requestAnimationFrame(sample);});
</script>`;
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:fixture}));
await page.context().addInitScript({content:`window.__requests=[];window.__menus=[];window.__store={};window.__clicks=0;window.GM_getValue=(k,d)=>__store[k]??d;window.GM_setValue=(k,v)=>__store[k]=v;window.GM_registerMenuCommand=(name,fn)=>__menus.push({name,fn});window.GM_xmlhttpRequest=o=>__requests.push(o);${script}`});
await page.goto('https://www.minimax.io/audio/text-to-speech');const host=page.locator('[data-minimax-zh="panel"]');await host.waitFor({state:'attached'});
const text=id=>page.locator('#'+id).textContent();const waitText=(id,value)=>page.waitForFunction(([id,value])=>document.getElementById(id).textContent===value,[id,value]);
await waitText('title','文本转语音');await page.waitForFunction(()=>__frames.length>=4);assert.equal(await page.evaluate(()=>__frames.filter(f=>f.visible&&f.text==='Text to Speech').length),0);
assert.equal(await text('inline'),'我已阅读并同意服务条款和隐私政策');assert.equal(await page.locator('#inline-terms').getAttribute('href'),'/audio/doc/terms.html');assert.equal(await text('split'),'生成的音色结果将显示在这里');assert.equal(await text('home'),'首页');assert.equal(await text('count'),'1,250 / 3,000 个字符');assert.equal(await text('slots'),'剩余音色名额：2/10');
assert.equal(await page.locator('#prompt').inputValue(),'Generate Music');assert.equal(await page.locator('#prompt').getAttribute('placeholder'),'输入提示词');assert.equal(await page.locator('#song').inputValue(),'Home');assert.equal(await page.locator('#song').getAttribute('placeholder'),'歌曲名称（可选）');
assert.equal(await text('editor'),'HomeHappy');assert.equal(await text('rich'),'Generate');assert.equal(await text('output'),'Happy');assert.equal(await text('voice'),'Calm');assert.equal(await text('filename'),'Generate');assert.equal(await text('model'),'speech-2.8-hd');assert.equal(await text('code'),'Generate');assert.equal(await text('no'),'Music');
assert.equal(await page.locator('#implicit').getAttribute('label'),'英语');assert.equal(await page.locator('#implicit').textContent(),'English');assert.equal(await page.locator('#implicit').getAttribute('value'),null);assert.equal(await page.locator('#language').inputValue(),'English');assert.equal(await page.locator('#explicit').getAttribute('label'),'日语');assert.equal(await page.locator('#explicit').getAttribute('value'),'ja');
await page.evaluate(()=>document.querySelector('#implicit').firstChild.nodeValue='Japanese');await page.waitForFunction(()=>document.querySelector('#implicit').label==='日语');assert.equal(await page.locator('#language').inputValue(),'Japanese');
await page.evaluate(()=>document.querySelector('#implicit').firstChild.nodeValue='English');await page.waitForFunction(()=>document.querySelector('#implicit').label==='英语');
assert.equal(await page.locator('#secret').inputValue(),'Secret password');assert.equal(await page.locator('#range').inputValue(),'1.2');assert.equal(await text('rate'),'1.2x');assert.equal(await page.locator('#agree').isChecked(),false);assert.equal(await page.locator('#terms').getAttribute('href'),'/audio/doc/terms-of-service.html');assert.equal(await text('error'),'请求失败，状态码 501');assert.equal(await page.evaluate(()=>__requests.length),0);
// Real DOM nodes and event handlers remain intact, including checkbox consent and submit payload.
await page.evaluate(()=>{window.__generate=document.querySelector('#generate');__generate.onclick=()=>{window.__payload={prompt:document.querySelector('#prompt').value,song:document.querySelector('#song').value,language:document.querySelector('#language').value,rate:document.querySelector('#range').value};__clicks++;};document.querySelector('#terms').onclick=e=>{e.preventDefault();__clicks++;};});
await page.locator('#generate').click();assert.deepEqual(await page.evaluate(()=>__payload),{prompt:'Generate Music',song:'Home',language:'English',rate:'1.2'});await page.locator('#terms').click();assert.equal(await page.evaluate(()=>__clicks),2);
await page.evaluate(()=>__menus.find(m=>m.name==='中文 / 英文界面切换').fn());assert.equal(await text('title'),'Text to Speech');assert.equal(await page.locator('#implicit').getAttribute('label'),null);assert.equal(await page.locator('#prompt').getAttribute('placeholder'),'Enter your prompt');
await page.evaluate(()=>__menus.find(m=>m.name==='中文 / 英文界面切换').fn());await waitText('title','文本转语音');assert.equal(await page.evaluate(()=>document.querySelector('#generate')===__generate),true);
for(const [route,title,zh] of [['music','Lyrics','歌词'],['voice-design','Text to Preview','试听文本'],['voices-cloning','Import your Voice','导入声音'],['voice-isolator','Voice Isolator','人声分离']]) {
await page.evaluate(({route,title})=>{history.pushState({},'','/audio/'+route);document.querySelector('#title').textContent=title;dispatchEvent(new PopStateEvent('popstate'));},{route,title});await waitText('title',zh);
}
// Portals, reused text nodes and displayed attributes are translated as they change.
await page.evaluate(()=>{const d=document.createElement('div');d.id='modal';d.setAttribute('role','dialog');d.innerHTML='<h2>Advanced Settings (Optional)</h2><button>Remove Background Noise</button><p>Generated voice results will appear here</p>';document.body.append(d);});await page.waitForFunction(()=>document.querySelector('#modal h2').textContent==='高级设置（可选）');
await page.evaluate(()=>document.querySelector('#modal h2').firstChild.nodeValue='Cookie Consent');await page.waitForFunction(()=>document.querySelector('#modal h2').textContent==='Cookie 使用同意');
await page.evaluate(()=>document.querySelector('#song').setAttribute('placeholder','Search voices'));await page.waitForFunction(()=>document.querySelector('#song').placeholder==='搜索音色');
// Leaving /audio restores the original page and hides the helper; returning resumes it.
await page.evaluate(()=>{history.pushState({},'','/news');dispatchEvent(new PopStateEvent('popstate'));});assert.equal(await text('home'),'Home');assert.equal(await host.getAttribute('hidden'),'');
await page.evaluate(()=>{history.pushState({},'','/audio');dispatchEvent(new PopStateEvent('popstate'));});await waitText('home','首页');assert.equal(await host.getAttribute('hidden'),null);assert.equal(await page.evaluate(()=>__requests.length),0);
for(const id of ['selection','update-download','update-repo'])assert.equal(await host.locator('#'+id).count(),0);
assert.deepEqual(errors,[]);
console.log('PASS: MiniMax initial frames, five routes, dialogs/descriptions, implicit option values, consent/actions, editable/generated content, restoration and no page-data requests');
for(const pathname of ['/','/news','/audiobook']) {const p=await page.context().newPage();await p.goto('https://www.minimax.io'+pathname);assert.equal(await p.locator('[data-minimax-zh]').count(),0);await p.close();}
console.log('PASS: MiniMax adapter excludes other MiniMax pages');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
