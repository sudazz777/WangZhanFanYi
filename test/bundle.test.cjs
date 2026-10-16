const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const release = JSON.parse(fs.readFileSync(path.join(root,'scripts/bundle-config.json')));
const script = fs.readFileSync(path.join(root,release.filename),'utf8');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const matches=[...script.matchAll(/^\/\/ @match\s+(\S+)/gm)].map(x=>x[1]);
    assert.deepEqual(matches,release.sites.flatMap(s=>s.hosts.map(h=>'https://'+h+'/*')));
    assert.equal((script.match(/^\/\/ ==UserScript==$/gm)||[]).length,1);
    assert.equal((script.match(/function createRenderCore\(/g)||[]).length,1);
    assert.equal((script.match(/function flushScans\(/g)||[]).length,1);
    assert.match(script,/\/\/ @license\s+GPL-3.0-or-later/);
    for(const host of [...release.sites.flatMap(s=>s.hosts),'github.com.evil.example','artlist.io.evil.example','example.com']) {
      const site=release.sites.find(s=>s.hosts.includes(host));
      const page=await browser.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<html><body><button>Play</button></body></html>'}));
      await page.goto('https://'+host+'/');
      await page.evaluate(()=>{
        window.__keys=[];window.__menus=[];window.__requests=[];
        window.GM_getValue=(k,v)=>{__keys.push(k);return v;};
        window.GM_setValue=()=>{};
        window.GM_registerMenuCommand=(name,fn)=>__menus.push({name,fn});
        window.GM_xmlhttpRequest=o=>__requests.push(o);
      });
      await page.addScriptTag({content:script});
      if(site) {
        await page.locator(`[data-${site.id}-zh="panel"]`).waitFor({state:'attached'});
        assert.equal(await page.locator(`[data-${site.id}-zh] #update-repo`).count(),0);
        assert.equal(await page.locator(`[data-${site.id}-zh] #update-download`).count(),0);
        if(site.id==='github') assert.equal(await page.locator('[data-github-zh] #selection').count(),0);
        const keys=await page.evaluate(()=>__keys);
        assert(keys.length>0);
        assert(keys.every(k=>k.startsWith(site.id+'-zh-v1')),JSON.stringify(keys));
        assert.equal(await page.locator('[data-artlist-zh="panel"],[data-musicbed-zh="panel"],[data-github-zh="panel"]').count(),1);
        assert.equal(await page.evaluate(()=>__menus.filter(m=>m.name==='检查脚本更新').length),1);
        assert.match(await page.locator(`[data-${site.id}-zh] summary`).textContent(),new RegExp('网站翻译（'+site.name+'）'));
        await page.evaluate(()=>__menus.find(m=>m.name==='检查脚本更新').fn());
        assert.equal(await page.evaluate(()=>__requests.at(-1).url.split('?')[0]),'https://raw.githubusercontent.com/sudazz777/WangZhanFanYi/refs/heads/main/updates/websites.meta.js');
      } else {
        assert.deepEqual(await page.evaluate(()=>[__keys.length,__menus.length,__requests.length]),[0,0,0]);
        assert.equal(await page.locator('[data-artlist-zh],[data-musicbed-zh],[data-github-zh]').count(),0);
      }
      assert.deepEqual(errors,[]);
      await page.close();
    }
    console.log('PASS: five supported hosts initialize exactly one engine; unified update identity; independent storage; unrelated hosts do nothing');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
