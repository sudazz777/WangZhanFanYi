// Mock network and tab APIs: update checks never execute remote code or mount page UI.
const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),script=fs.readFileSync(path.join(root,'websites-zh-CN.user.js'),'utf8'),meta=fs.readFileSync(path.join(root,'updates/websites.meta.js'),'utf8');
const config=JSON.parse(script.match(/const SCRIPT_UPDATE = (.*);/)[1]);
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
assert.equal(meta.trim(),script.slice(0,script.indexOf('// ==/UserScript==')+18).trim());assert.match(meta,/@grant\s+GM_openInTab/);assert.equal(meta.match(/@updateURL\s+(\S+)/)[1],config.metaUrl);
for(const url of ['https://artlist.io/royalty-free-music','https://www.musicbed.com/songs','https://github.com/example/repo','https://www.minimax.io/audio']){
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<html><body><button>Play</button><input value="private input"></body></html>'}));await page.goto(url);
await page.evaluate(()=>{window.__calls=[];window.__menus=[];window.__messages=[];window.__tabs=[];window.__prompts=[];window.__accept=true;window.GM_getValue=(k,d)=>d;window.GM_setValue=()=>{};window.GM_registerMenuCommand=(name,fn)=>__menus.push({name,fn});window.GM_xmlhttpRequest=o=>__calls.push(o);window.GM_openInTab=(url,options)=>__tabs.push({url,options});window.alert=m=>__messages.push(m);window.confirm=m=>{__messages.push(m);return __accept;};window.prompt=(m,value)=>__prompts.push({m,value});window.open=()=>null;});
await page.addScriptTag({content:script});assert.equal(await page.evaluate(()=>__calls.length),0);
const start=()=>page.evaluate(()=>__menus.find(m=>m.name==='检查脚本更新').fn());const message=()=>page.evaluate(()=>__messages.at(-1)||'');const version=v=>meta.replace(/(@version\s+)\S+/,'$1'+v);
const respond=(text=meta,status=200,event='onload')=>page.evaluate(({text,status,event})=>__calls.at(-1)[event]({status,responseText:text}),{text,status,event});
await start();await start();assert.equal(await page.evaluate(()=>__calls.length),1);
const request=await page.evaluate(()=>({url:__calls[0].url,method:__calls[0].method,anonymous:__calls[0].anonymous,data:__calls[0].data,timeout:__calls[0].timeout}));assert.equal(request.method,'GET');assert.equal(request.anonymous,true);assert.equal(request.data,undefined);assert.equal(request.timeout,12000);assert.equal(request.url.split('?')[0],config.metaUrl);assert.deepEqual([...new URL(request.url).searchParams.keys()],['check']);
await respond();assert.match(await message(),/已是最新/);assert.equal(await page.evaluate(()=>__tabs.length),0);
await start();await respond(version('1.10.0'));assert.match(await message(),/发现新版 v1.10.0/);assert.equal(await page.evaluate(()=>__tabs.at(-1).url),config.installUrl+'?version=1.10.0');assert.equal(await page.evaluate(()=>__tabs.at(-1).options.active),true);
await page.evaluate(()=>__accept=false);await start();await respond(version('1.11.0'));assert.equal(await page.evaluate(()=>__tabs.length),1);await page.evaluate(()=>__accept=true);
await start();await respond(version('0.9'));assert.match(await message(),/无需降级/);
for(const code of [401,403,404,500]){await start();await respond('',code);assert.match(await message(),new RegExp('HTTP '+code));}
for(const bad of ['<html>login</html>',meta.replace(config.namespace,'other'),version('2.0/evil'),meta.replace('// ==/UserScript==','// @version 9.0\n// ==/UserScript=='),meta+' '.repeat(17000)]){await start();await respond(bad);assert.match(await message(),/格式不正确/);}
await start();await respond(version('9.0').replace(/(@downloadURL\s+)\S+/,'$1https://attacker.example/evil.js'));assert.equal(await page.evaluate(()=>__tabs.at(-1).url),config.installUrl+'?version=9.0');
for(const [event,pattern] of [['onerror',/无法连接/],['ontimeout',/超时/],['onabort',/已取消/]]){await start();await respond('',0,event);assert.match(await message(),pattern);const count=await page.evaluate(()=>__tabs.length);await respond(version('99.0'));assert.match(await message(),pattern);assert.equal(await page.evaluate(()=>__tabs.length),count);}
await page.evaluate(()=>__menus.find(m=>m.name.includes('界面切换')||m.name==='中文 / 英文切换').fn());await start();await respond();assert.match(await message(),/已是最新/);
await page.evaluate(()=>{delete window.GM_openInTab;});await start();await respond(version('9.1'));assert.equal(await page.evaluate(()=>__prompts.at(-1).value),config.installUrl+'?version=9.1');
await page.evaluate(()=>{GM_xmlhttpRequest=()=>{throw Error('permission denied');};});await start();assert.match(await message(),/无法发起/);
assert.equal(await page.locator('[data-artlist-zh],[data-musicbed-zh],[data-github-zh],[data-minimax-zh]').count(),0);assert.deepEqual(errors,[]);console.log('PASS: '+new URL(url).hostname+' menu update validation, numeric versions, confirmation, native tabs, failure cleanup and no page UI');await page.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
