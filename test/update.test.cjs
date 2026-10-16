// Exercise the real standalone scripts with a mocked userscript transport.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:'/usr/bin/chromium', args:['--no-sandbox']});
  try {
    for (const site of ['artlist','musicbed','github']) {
      const bundled = process.argv.includes('--bundle');
      const script = fs.readFileSync(path.join(root, (bundled?'websites':site)+'-zh-CN.user.js'), 'utf8');
      const meta = fs.readFileSync(path.join(root, 'updates', (bundled?'websites':site)+'.meta.js'), 'utf8');
      const config = JSON.parse(script.match(/const SCRIPT_UPDATE = (.*);/)[1]);
      assert.equal(meta.trim(), script.slice(0,script.indexOf('// ==/UserScript==')+18).trim());
      assert.equal(meta.match(/@updateURL\s+(\S+)/)[1], config.metaUrl);
      assert.match(meta, /@run-at\s+document-start/);
      assert.equal(new URL(config.metaUrl).hostname, 'raw.githubusercontent.com');
      assert.match(meta, /@downloadURL\s+https:\/\/raw\.githubusercontent\.com\//);
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', route => route.fulfill({contentType:'text/html',body:'<html><body><button>Settings</button><input value="private input"><p>Private page contents</p></body></html>'}));
      await page.goto(site==='github'?'https://github.com/example/repo/settings':site==='artlist'?'https://artlist.io/royalty-free-music':'https://www.musicbed.com/');
      await page.evaluate(() => {
        window.__menus = []; window.__calls = []; window.__store = {};
        window.GM_getValue = (k,d) => __store[k] ?? d;
        window.GM_setValue = (k,v) => { __store[k]=v; };
        window.GM_registerMenuCommand = (name,fn) => __menus.push({name,fn});
        window.GM_xmlhttpRequest = options => __calls.push(options);
      });
      await page.addScriptTag({content:script});
      const panel = page.locator(`[data-${site}-zh="panel"]`);
      await panel.locator('#check-update').waitFor({state:'attached'});
      assert.equal(await page.evaluate(() => __calls.length),0);
      await page.evaluate(() => __menus.find(x=>x.name==='检查脚本更新').fn());
      const status = () => panel.locator('#update-status').textContent();
      assert.equal(await page.evaluate(() => __calls.length),1);
      assert.equal(await panel.locator('#check-update').isDisabled(),true);
      await page.evaluate(() => __menus.find(x=>x.name==='检查脚本更新').fn());
      assert.equal(await page.evaluate(() => __calls.length),1);
      const request = await page.evaluate(() => ({url:__calls[0].url, method:__calls[0].method, anonymous:__calls[0].anonymous, data:__calls[0].data, timeout:__calls[0].timeout}));
      assert.equal(request.method,'GET'); assert.equal(request.anonymous,true); assert.equal(request.data,undefined);
      assert.equal(request.url.split('?')[0],config.metaUrl);
      assert.deepEqual([...new URL(request.url).searchParams.keys()],['check']);
      assert.equal(request.timeout,12000);
      const respond = async (text,code=200,event='onload') => page.evaluate(({text,code,event}) => __calls.at(-1)[event]({status:code,responseText:text}), {text,code,event});
      const start = () => panel.locator('#check-update').click();
      const versionMeta = v => meta.replace(/(@version\s+)\S+/, '$1'+v);
      await respond(meta); assert.match(await status(),/已是最新/);
      await start(); await respond(versionMeta('1.10.0'));
      assert.match(await status(),/发现新版 v1.10.0/);
      const download = panel.locator(bundled?'#update-install':'#update-download');
      const expectedLink = version => bundled ? config.installUrl+'?version='+version : config.downloadBase+config.id+'-translation-v'+version+'.zip';
      assert.equal(await download.getAttribute('href'),expectedLink('1.10.0'));
      const install = panel.locator('#update-install');
      if (bundled) {
        assert.equal(await install.getAttribute('href'),config.installUrl+'?version=1.10.0');
        assert.equal(await install.getAttribute('target'),'_blank');
        assert.match(await status(),/篡改猴中确认/);
      }
      await start(); assert.equal(await download.getAttribute('href'),null);
      if (bundled) assert.equal(await install.getAttribute('href'),null);
      await respond(versionMeta('0.9')); assert.match(await status(),/无需降级/);
      for (const code of [401,403,404,500]) {
        await start(); await respond('',code);
        assert.match(await status(),code===500?/HTTP 500/:/无法读取/);
        assert.equal(await download.getAttribute('href'),null);
      }
      for (const bad of ['<html>login</html>',meta.replace(config.namespace,'other-namespace'),meta.replace(config.name,'other-name'),versionMeta('2.0/evil'),meta.replace('// ==/UserScript==','// @version 9.0\n// ==/UserScript=='),meta+' '.repeat(17000)]) {
        await start(); await respond(bad); assert.match(await status(),/格式不正确/);
      }
      // Remote download URLs are ignored; only trusted locally constructed update links are offered.
      await start(); await respond(versionMeta('9.0').replace(/(@downloadURL\s+)\S+/, '$1https://attacker.example/evil.js'));
      assert.equal(await download.getAttribute('href'),expectedLink('9.0'));
      if (bundled) assert.equal(await install.getAttribute('href'),config.installUrl+'?version=9.0');
      for (const [event,message] of [['onerror',/无法连接/],['ontimeout',/超时/],['onabort',/已取消/]]) {
        await start(); await respond('',0,event); assert.match(await status(),message);
        await respond(versionMeta('99.0')); assert.match(await status(),message);
        assert.equal(await panel.locator('#check-update').isDisabled(),false);
        if (bundled) assert.equal(await install.getAttribute('href'),null);
      }
      // Checking remains available while translation is disabled.
      await page.evaluate(() => __menus.find(x=>x.name.includes('界面切换')||x.name==='中文 / 英文切换').fn());
      await start(); await respond(meta); assert.match(await status(),/已是最新/);
      await page.evaluate(() => { window.GM_xmlhttpRequest=()=>{throw Error('permission denied');}; });
      await start(); assert.match(await status(),/无法发起/);
      assert.deepEqual(errors,[]);
      console.log('PASS: '+site+' update metadata, controls, numeric versions, privacy, failed requests, validation and disabled mode');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
