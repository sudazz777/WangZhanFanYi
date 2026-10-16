const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const baseline = process.argv.includes('--baseline');
const scriptPath = process.argv.find(arg=>arg.endsWith('.user.js')) || path.join(__dirname,'..','github-zh-CN.user.js');
const script = fs.readFileSync(scriptPath,'utf8');
const fixture = `<!doctype html><meta charset="utf-8"><header><button id="stable">Settings</button></header>
<main><button id="initial">Change visibility</button><p>Once you delete a repository, there is no going back. Please be certain.</p></main>
<script>
window.__startup=[];
function sample(){const el=document.querySelector('#initial');if(el)__startup.push({text:el.textContent,visible:getComputedStyle(el).visibility!=='hidden'});if(__startup.length<4)requestAnimationFrame(sample);}
requestAnimationFrame(sample);
</script>`;
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://github.com/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:fixture}));
    // 在页面脚本和 HTML 解析前注入，模拟 Tampermonkey document-start。
    await page.addInitScript({content:`window.__menus=[];window.GM_getValue=(_,v)=>v;window.GM_setValue=()=>{};window.GM_registerMenuCommand=(name,action)=>__menus.push({name,action});window.GM_xmlhttpRequest=()=>{throw Error('unexpected network')};\n${script}`});
    await page.goto('https://github.com/owner/repo/settings');
    await page.waitForFunction(()=>__startup.length>=4&&document.querySelector('#initial').textContent==='更改可见性');
    const startup=await page.evaluate(()=>__startup);
    const changes=[];
    for(let i=0;i<12;i++) {
      // 在动画帧中模拟框架写入，微任务检查发生在该帧绘制前，而非等到下一帧。
      changes.push(await page.evaluate(i=>new Promise(resolve=>requestAnimationFrame(()=>{
        document.querySelector('#popup')?.remove();
        const popup=document.createElement('div');popup.id='popup';popup.innerHTML='<button>Issue permissions</button><p>Pull requests allow others to suggest changes to your repository.</p>';document.body.append(popup);
        if(i%2===0) popup.querySelector('button').firstChild.nodeValue='Change visibility';
        queueMicrotask(()=>queueMicrotask(()=>resolve({text:popup.textContent,visible:getComputedStyle(popup).visibility!=='hidden'})));
      })),i));
    }
    const navigation=[];
    for(let i=0;i<4;i++) navigation.push(await page.evaluate(i=>new Promise(resolve=>requestAnimationFrame(()=>{
      history.pushState({},'',i%2?'/owner/repo/settings':'/owner/repo/settings/branches');
      document.querySelector('main').innerHTML='<button id="next">Save changes</button>';
      document.dispatchEvent(new Event('turbo:load'));
      document.dispatchEvent(new Event('pjax:end'));
      queueMicrotask(()=>queueMicrotask(()=>resolve({stable:document.querySelector('#stable').textContent,next:document.querySelector('#next').textContent})));
    })),i));
    const metrics={
      mode:baseline?'baseline':'optimized',
      startupEnglishFrames:startup.filter(s=>s.visible&&s.text==='Change visibility').length,
      dynamicEnglishBeforePaint:changes.filter(s=>s.visible&&/[a-z]/i.test(s.text)).length,
      navigationEnglishBeforePaint:navigation.filter(s=>s.stable==='Settings'||s.next==='Save changes').length,
    };
    console.log(JSON.stringify(metrics));
    if(baseline) return;
    assert.match(script,/@run-at\s+document-start/);
    assert.equal(metrics.startupEnglishFrames,0);
    assert.equal(metrics.dynamicEnglishBeforePaint,0);
    assert.equal(metrics.navigationEnglishBeforePaint,0);
    await page.waitForFunction(()=>document.querySelector('#next').textContent==='保存更改');
    // 暂停后续批次，验证局部待处理内容在超时后能自动显示，不会永久隐藏。
    async function addStalled(id) {
      return page.evaluate(id=>new Promise(resolve=>{
        window.__realTimer=window.setTimeout.bind(window);window.__blocked=[];
        window.setTimeout=(fn,delay,...args)=>delay===0?(__blocked.push(()=>fn(...args)),999999):__realTimer(fn,delay,...args);
        const root=document.createElement('section');root.id=id;
        for(let i=0;i<1000;i++){const p=document.createElement('p');p.textContent='Once you delete a repository, there is no going back. Please be certain.';root.append(p);}
        document.body.append(root);
        queueMicrotask(()=>queueMicrotask(()=>resolve({masked:root.hasAttribute('data-github-zh-pending'),visible:getComputedStyle(root.lastElementChild).visibility!=='hidden',bodyVisible:getComputedStyle(document.body).visibility!=='hidden'})));
      }),id);
    }
    const stalled=await addStalled('stalled');
    assert.equal(stalled.masked,true);assert.equal(stalled.visible,false);assert.equal(stalled.bodyVisible,true);
    await page.waitForTimeout(240);
    assert.equal(await page.locator('#stalled').getAttribute('data-github-zh-pending'),null);
    assert.equal(await page.locator('#stalled p:last-child').evaluate(el=>getComputedStyle(el).visibility),'visible');
    await page.evaluate(()=>{window.setTimeout=__realTimer;for(const run of __blocked.splice(0))run();});
    await page.waitForFunction(()=>document.querySelector('#stalled p:last-child').textContent==='删除仓库后将无法恢复，请务必确认。');
    await page.evaluate(()=>document.querySelector('[data-github-zh-style]').remove());
    const cancelled=await addStalled('cancelled');
    assert.equal(cancelled.masked,true);assert.equal(cancelled.visible,false);
    await page.evaluate(()=>__menus.find(m=>m.name==='中文 / 英文界面切换').action());
    assert.equal(await page.locator('[data-github-zh-pending]').count(),0);
    assert.equal(await page.locator('#stable').textContent(),'Settings');
    assert.equal(await page.locator('#cancelled p:last-child').evaluate(el=>getComputedStyle(el).visibility),'visible');
    assert.deepEqual(errors,[]);
    console.log('PASS: 解析前启动、首次帧与动态菜单绘制前翻译、导航保留中文；局部遮罩超时/关闭自动释放');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
