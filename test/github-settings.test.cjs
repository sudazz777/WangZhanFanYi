const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const script = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'websites-zh-CN.user.js'), 'utf8');
const cases = require('./fixtures/github-settings.cases.json');
const technicalNames = /GitHub(?: Actions| Apps| Pages| Team| Enterprise)?|Git LFS|Copilot(?: Pro\+?| Business| Enterprise)?|Dependabot|DCO|Webhook|Web|POST|URLs?|API|SSH/gi;
const html = '<!doctype html><meta charset="utf-8"><main></main>';
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().resourceType()==='document' ? route.fulfill({contentType:'text/html; charset=utf-8',body:html}) : route.abort());
    await page.addInitScript(() => {
      window.GM_getValue = (_, fallback) => fallback;
      window.GM_setValue = () => {};
      window.__menus=[];window.GM_registerMenuCommand = (name,action) => __menus.push({name,action});
      window.GM_xmlhttpRequest = () => { throw Error('设置界面不应请求翻译服务'); };
    });
    let translated = 0;
    const missing = [];
    for (const scenario of cases) {
      await page.goto('https://github.com'+scenario.path);
      await page.evaluate(texts => {
        const main = document.querySelector('main');
        for (const text of texts) { const p=document.createElement('p');p.className='description';p.textContent=text;main.append(p); }
        const last=document.createElement('button');last.id='end';last.textContent='Save changes';main.append(last);
      },scenario.texts);
      await page.addScriptTag({content:script});
      await page.waitForFunction(()=>document.querySelector('#end').textContent==='保存更改');
      const outputs = await page.locator('.description').allTextContents();
      outputs.forEach((text,i)=> {
        if (!/[\u3400-\u9fff]/.test(text)) missing.push(scenario.path+' missing: '+scenario.texts[i]);
        else if (/[a-z]/i.test(text.replace(technicalNames,''))) missing.push(scenario.path+' residual: '+text);
      });
      translated += outputs.length;
    }
    assert.deepEqual(missing,[]);
    console.log('PASS:',cases.length,'种设置路径、',translated,'段菜单/选项/描述均中文化（仅保留品牌和技术名称）');

    await page.goto('https://github.com/owner/repo/settings');
    await page.evaluate(()=> {
      document.querySelector('main').innerHTML=`
      <p id="inline">When creating <span>source code archives, you can choose to include files stored using </span><a href="https://docs.github.com/lfs">Git LFS</a> in the archive.</p>
      <button id="split"><span>Allow comments on</span><span> individual commits</span></button>
      <p id="sentence">Pull requests allow others to suggest changes to your repository. Sponsorships help your community know how to financially support this repository.</p>
      <p id="sign-off">Enabling this setting will require contributors to sign off on commits made through GitHub’s web interface. Signing off is a way for contributors to affirm that their commit complies with the repository's terms, commonly the <a href="https://developercertificate.org/">Developer Certificate of Origin (DCO)</a>. <a href="https://docs.github.com/sign-off">Learn more about signing off on commits</a>.</p>
      <p id="comment-description">Enabling this setting will allow anyone who can view this repository to add <a href="https://docs.github.com/comments">commit comments</a>. Existing commit comments are not affected by this setting and will remain viewable, editable, and deletable.</p>
      <p id="protected"><span>Unrecognized documentation prefix </span><code>Delete this repository</code><strong itemprop="name">General</strong></p>
      <div class="markdown-body" id="readme"><p>Allow comments on individual commits</p></div>
      <span class="branch-name" id="branch">Allow comments on individual commits</span>
      <input id="repo-name" value="MiXeD/Repo"><textarea id="draft">Upgrade or make this repository public to enable Wikis</textarea>
      <select id="native"><optgroup label="Issue permissions"><option id="implicit">All users</option><option id="explicit" value="collaborators" label="Collaborators">Original backend text</option></optgroup></select>
      <button id="accessible" aria-description="Once you delete a repository, there is no going back. Please be certain.">Delete this repository</button>
      <p id="unknown">Unrecognized prose must remain intact.</p>
      <p id="cache-miss">Classic Pages experience</p><button id="end">Save changes</button>`;
      window.__clicks=0;window.__anchor=document.querySelector('#inline a');window.__span=document.querySelector('#split span');
      __anchor.addEventListener('click',e=>{e.preventDefault();__clicks++;});
      document.querySelector('#split').addEventListener('click',()=>__clicks++);
      window.__originals=Object.fromEntries(['inline','split','sign-off','comment-description','protected','readme','branch','unknown'].map(id=>[id,document.getElementById(id).innerHTML]));
    });
    await page.addScriptTag({content:script});
    await page.waitForFunction(()=>document.querySelector('#end').textContent==='保存更改');
    for(const id of ['inline','split','sentence','sign-off','comment-description']) {
      const text=await page.locator('#'+id).textContent();assert(!/[a-z]/i.test(text.replace(technicalNames,'')),id+': '+text);
    }
    assert(await page.evaluate(()=>__anchor===document.querySelector('#inline a')&&__span===document.querySelector('#split span')));
    assert.equal(await page.locator('#inline a').getAttribute('href'),'https://docs.github.com/lfs');
    await page.locator('#inline a').click();await page.locator('#split').click();assert.equal(await page.evaluate(()=>__clicks),2);
    for(const id of ['protected','readme','branch','unknown']) assert.equal(await page.locator('#'+id).innerHTML(),await page.evaluate(id=>__originals[id],id));
    assert.equal(await page.locator('#repo-name').inputValue(),'MiXeD/Repo');
    assert.equal(await page.locator('#draft').inputValue(),'Upgrade or make this repository public to enable Wikis');
    assert.equal(await page.locator('#implicit').getAttribute('label'),'所有用户');
    assert.equal(await page.locator('#native').inputValue(),'All users');
    assert.equal(await page.locator('#explicit').getAttribute('value'),'collaborators');
    assert.equal(await page.locator('#explicit').textContent(),'Original backend text');
    assert.equal(await page.locator('#explicit').getAttribute('label'),'协作者');
    assert.equal(await page.locator('#native optgroup').getAttribute('label'),'议题权限');
    assert.equal(await page.locator('#accessible').getAttribute('aria-description'),'删除仓库后将无法恢复，请务必确认。');
    assert.equal(await page.locator('#cache-miss').textContent(),'Classic Pages experience');
    const toggle=()=>page.evaluate(()=>__menus.find(m=>m.name==='中文 / 英文界面切换').action());
    await toggle();
    assert.equal(await page.locator('#implicit').getAttribute('label'),null);
    assert.equal(await page.locator('#explicit').getAttribute('label'),'Collaborators');
    for(const id of ['inline','split','sign-off','comment-description']) assert.equal(await page.locator('#'+id).innerHTML(),await page.evaluate(id=>__originals[id],id));
    await toggle();
    await page.waitForFunction(()=>document.querySelector('#split').textContent.includes('允许对单个提交'));
    await page.evaluate(()=>document.querySelector('#implicit').textContent='Collaborators');
    await page.waitForFunction(()=>document.querySelector('#implicit').label==='协作者');
    assert.equal(await page.locator('#native').inputValue(),'Collaborators');
    await page.evaluate(()=>{
      const dialog=document.createElement('dialog');dialog.open=true;dialog.id='confirmation';
      const p=document.createElement('p');p.textContent='To confirm, type "MiXeD/Repo" in the box below';
      const input=document.createElement('input');input.value='MiXeD/Repo';const button=document.createElement('button');button.textContent='Change visibility';dialog.append(p,input,button);document.body.append(dialog);
    });
    await page.waitForFunction(()=>document.querySelector('#confirmation p').textContent==='要确认，请在下面的输入框中键入“MiXeD/Repo”。');
    assert.equal(await page.locator('#confirmation input').inputValue(),'MiXeD/Repo');
    assert.equal(await page.locator('#confirmation button').textContent(),'更改可见性');
    await page.evaluate(()=>{
      history.pushState({},'','/owner/repo/settings/pages');
      document.querySelector('main').innerHTML='<p id="new-route">Classic Pages experience</p><button id="end">Save changes</button>';
      document.dispatchEvent(new Event('turbo:load'));
    });
    await page.waitForFunction(()=>document.querySelector('#new-route').textContent==='经典页面体验');
    await page.evaluate(()=>{
      history.pushState({},'','/owner/repo');
      document.querySelector('main').innerHTML='<p id="outside">Classic Pages experience</p><button id="end">Save changes</button>';
      document.dispatchEvent(new Event('turbo:load'));
    });
    await page.waitForFunction(()=>document.querySelector('#end').textContent==='保存更改');
    assert.equal(await page.locator('#outside').textContent(),'Classic Pages experience');assert.deepEqual(errors,[]);
    console.log('PASS: 跨标签句子、链接和事件、标点/多句组合、恢复原文、动态确认框、标识大小写、路径切换与词库隔离');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
