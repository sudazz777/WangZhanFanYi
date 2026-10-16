const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const baseline = process.argv.includes('--baseline');
const scriptPath = process.argv.find(arg=>arg.endsWith('.user.js')) || path.join(__dirname,'..','artlist-zh-CN.user.js');
const site = process.argv.includes('--musicbed') || /musicbed/i.test(path.basename(scriptPath)) ? 'musicbed' : 'artlist';
const origin = site==='musicbed' ? 'https://www.musicbed.com' : 'https://artlist.io';
const routePath = site==='musicbed' ? '/songs' : '/royalty-free-music';
const songPath = site==='musicbed' ? '/songs/' : '/royalty-free-music/song/';
const marker = 'data-'+site+'-zh';
const key = site+'-zh-v1';
const script = fs.readFileSync(scriptPath,'utf8');
const fixture = `<!doctype html><meta charset="utf-8"><header><button id="stable">Filters</button></header>
<main><button id="initial">Play</button><button>Clear All Filters</button><span>Cinematic</span></main>
<aside data-testid="music-player"><a id="cached" href="${songPath}morning-light/124">Morning Light</a></aside>
<input id="private" value="Never send my search"><script>
window.__startup=[];
function sample(){const el=document.querySelector('#initial');const song=document.querySelector('#cached');if(el&&song)__startup.push({text:el.textContent,song:song.textContent,visible:getComputedStyle(el).visibility!=='hidden',songVisible:getComputedStyle(song).visibility!=='hidden'});if(__startup.length<4)requestAnimationFrame(sample);}
requestAnimationFrame(sample);
</script>`;
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route(origin+'/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:fixture}));
    await page.addInitScript({content:`
      window.__menus=[];window.__requests=[];window.__store={};
      __store[${JSON.stringify(key+'-settings')}]={enabled:true,online:true,bilingual:true};
      __store[${JSON.stringify(key+'-cache')}]={'Morning Light':'晨光'};
      window.GM_getValue=(k,v)=>__store[k]??v;window.GM_setValue=(k,v)=>__store[k]=v;
      window.GM_registerMenuCommand=(name,fn)=>__menus.push({name,fn});
      window.GM_xmlhttpRequest=options=>{const text=new URL(options.url).searchParams.get('q');__requests.push(text);setTimeout(()=>options.onload({status:200,responseText:JSON.stringify([[['新曲']]])}),800);};
      ${script}`});
    await page.goto(origin+routePath);
    await page.waitForFunction(()=>__startup.length>=4&&document.querySelector('#initial').textContent==='播放'&&document.querySelector('#cached').textContent==='晨光（Morning Light）');
    const startup=await page.evaluate(()=>__startup);
    assert.equal(await page.evaluate(()=>__requests.length),0,'缓存命中不应请求网络');
    const changes=[];
    for(let i=0;i<12;i++) changes.push(await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
      document.querySelector('#popup')?.remove();const popup=document.createElement('div');popup.id='popup';
      popup.innerHTML='<button>Filters</button><button>Clear All Filters</button><span>Cinematic</span>';document.body.append(popup);
      queueMicrotask(()=>queueMicrotask(()=>resolve({text:popup.textContent,visible:getComputedStyle(popup).visibility!=='hidden'})));
    }))));
    await page.evaluate(()=>{
      window.__navEnglishWrites=0;new MutationObserver(()=>{if(document.querySelector('#stable').textContent==='Filters')__navEnglishWrites++;}).observe(document.querySelector('#stable'),{subtree:true,characterData:true,childList:true});
    });
    const navigation=[];
    for(let i=0;i<4;i++) navigation.push(await page.evaluate(({i,routePath})=>new Promise(resolve=>requestAnimationFrame(()=>{
      history.pushState({},'',routePath+'?mood='+i);document.querySelector('main').innerHTML='<button id="next">Download</button>';
      dispatchEvent(new PopStateEvent('popstate'));
      queueMicrotask(()=>queueMicrotask(()=>resolve({stable:document.querySelector('#stable').textContent,next:document.querySelector('#next').textContent})));
    })),{i,routePath}));
    await page.waitForTimeout(1700);
    const metrics={site,mode:baseline?'baseline':'optimized',startupEnglishFrames:startup.filter(s=>s.visible&&s.text==='Play').length,cachedTitleOriginalFrames:startup.filter(s=>s.songVisible&&s.song==='Morning Light').length,dynamicEnglishBeforePaint:changes.filter(s=>s.visible&&/[a-z]/i.test(s.text)).length,navigationEnglishBeforePaint:navigation.filter(s=>s.stable==='Filters'||s.next==='Download').length,persistentNavigationEnglishWrites:await page.evaluate(()=>__navEnglishWrites)};
    console.log(JSON.stringify(metrics));
    if(baseline)return;
    for(const [name,value] of Object.entries(metrics))if(typeof value==='number')assert.equal(value,0,name);
    assert.match(script,/@run-at\s+document-start/);
    assert.equal(await page.locator('#private').inputValue(),'Never send my search');
    // 未缓存的在线名称保持可读，导航后仍有效的请求继续完成，不反复提交。
    await page.evaluate(songPath=>{const a=document.createElement('a');a.id='fresh';a.href=songPath+'fresh/125';a.textContent='Fresh Song';document.querySelector('aside').append(a);},songPath);
    await page.waitForFunction(()=>__requests.includes('Fresh Song'));
    assert.equal(await page.locator('#fresh').textContent(),'Fresh Song');
    assert.equal(await page.locator('#fresh').evaluate(el=>getComputedStyle(el).visibility),'visible');
    await page.evaluate(routePath=>{history.pushState({},'',routePath+'?mood=next');dispatchEvent(new PopStateEvent('popstate'));},routePath);
    await page.waitForFunction(()=>document.querySelector('#fresh').textContent==='新曲（Fresh Song）');
    assert.deepEqual(await page.evaluate(()=>__requests),['Fresh Song']);
    async function addStalled(id) {
      return page.evaluate(({id,marker})=>new Promise(resolve=>{
        window.__realTimer=window.setTimeout.bind(window);window.__blocked=[];
        window.setTimeout=(fn,delay,...args)=>delay===0?(__blocked.push(()=>fn(...args)),999999):__realTimer(fn,delay,...args);
        const root=document.createElement('section');root.id=id;
        for(let i=0;i<1000;i++){const p=document.createElement('p');p.textContent='Clear All Filters';root.append(p);}document.body.append(root);
        queueMicrotask(()=>queueMicrotask(()=>resolve({masked:root.hasAttribute(marker+'-pending'),visible:getComputedStyle(root.lastElementChild).visibility!=='hidden',bodyVisible:getComputedStyle(document.body).visibility!=='hidden'})));
      }),{id,marker});
    }
    const stalled=await addStalled('stalled');assert.equal(stalled.masked,true);assert.equal(stalled.visible,false);assert.equal(stalled.bodyVisible,true);
    await page.waitForTimeout(240);assert.equal(await page.locator('#stalled').getAttribute(marker+'-pending'),null);
    assert.equal(await page.locator('#stalled p:last-child').evaluate(el=>getComputedStyle(el).visibility),'visible');
    await page.evaluate(()=>{window.setTimeout=__realTimer;for(const run of __blocked.splice(0))run();});
    await page.waitForFunction(()=>document.querySelector('#stalled p:last-child').textContent==='清除全部筛选');
    await page.evaluate(marker=>document.querySelector('['+marker+'-style]').remove(),marker);
    const cancelled=await addStalled('cancelled');assert.equal(cancelled.masked,true);assert.equal(cancelled.visible,false);
    await page.evaluate(()=>__menus.find(m=>m.name==='中文 / 英文切换').fn());
    assert.equal(await page.locator('['+marker+'-pending]').count(),0);assert.equal(await page.locator('#stable').textContent(),'Filters');
    assert.equal(await page.locator('#cancelled p:last-child').evaluate(el=>getComputedStyle(el).visibility),'visible');
    assert.deepEqual(errors,[]);
    console.log('PASS:',site,'提前启动、绘制前菜单/缓存名称、导航保留中文与在途在线结果、局部遮罩超时/关闭/样式恢复');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
