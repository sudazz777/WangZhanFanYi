const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const script = fs.readFileSync(path.join(__dirname, '..', 'github-zh-CN.user.js'), 'utf8');
const fixture = `<!doctype html><header><nav>
  <a data-tab-item="code" href="/Code/Settings">Code</a><a href="/Code/Settings/issues">Issues</a><a href="/Code/Settings/pulls">Pull requests</a>
  <a href="/Code/Settings/actions">Actions</a><a href="/Code/Settings/settings">Settings</a></nav>
  <a id="owner" data-hovercard-type="user" href="/Code">Code</a><strong itemprop="name"><a id="repo" href="/Code/Settings">Settings</a></strong>
  <nav data-component="Breadcrumbs"><a id="breadcrumb" href="/Code/Settings">Settings</a></nav></header>
  <main><button id="code-menu" data-action="clone">Code</button><button id="issue-button">New issue</button>
  <input id="search" placeholder="Search or jump to..." value="repo:Code/Settings is:open">
  <textarea id="draft">Code Open Actions</textarea><input id="secret" type="password" value="secret-token">
  <div class="react-directory-filename-cell"><a id="file" href="/Code/Settings/blob/main/Code" title="Code">Code</a></div>
  <a id="file2" href="/Code/Settings/blob/main/Open">Open</a><span class="branch-name" id="branch">Open</span>
  <a id="repo2" href="/Other/Code">Code</a><a id="user2" href="/Open">Open</a>
  <pre id="source">const Code = "Open"; // Save changes</pre><div data-testid="code-viewer" id="viewer">Code Open Settings</div>
  <table class="diff-table" id="diff"><tr><td>Update</td></tr></table><div class="cm-editor" id="editor">Save</div>
  <div class="js-check-log-line" id="log">Run workflow</div>
  <div class="markdown-body" id="readme"><h2>Settings</h2><p id="prose">Review the changes before merging this pull request.</p><a href="https://example.test">Download</a></div>
  <div class="comment-body" id="comment">Open</div><h1 data-testid="issue-title" id="issue-title">Closed</h1>
  <a data-testid="issue-listitem-title-link" id="issue-link" href="/Code/Settings/issues/1">Settings</a>
  <div class="commit-message" id="commit">Update</div><span class="IssueLabel" id="label">Open</span>
  <button data-testid="author-filter-link" id="author"><span>Filter by author </span>Open</button>
  <span data-testid="workflow-name" id="workflow-name">Actions</span><a href="/Code/Settings/releases/tag/Code" id="version">Code</a>
  <a href="/orgs/Code/projects/1" id="project">Open</a><a href="/Code/Settings/blob/main/Code" class="btn" id="raw">Raw</a>
  <section id="settings"><label>Repository secrets</label><button>New repository secret</button><button>Save changes</button></section>
  <script type="application/json" id="json">{"Code":"Open"}</script></main>`;
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let accept = true;
    page.on('dialog', dialog => accept ? dialog.accept() : dialog.dismiss());
    await page.route('https://github.com/**', route => route.fulfill({contentType:'text/html',body:fixture}));
    await page.goto('https://github.com/Code/Settings');
    await page.evaluate(() => {
      window.__store = {}; window.__requests = []; window.__menus = []; window.__delay = 20; window.__fail = false; window.__clicks = 0;
      window.GM_getValue = (k, d) => __store[k] ?? d;
      window.GM_setValue = (k, v) => { __store[k] = v; };
      window.GM_registerMenuCommand = (name, action) => __menus.push({name, action});
      window.GM_xmlhttpRequest = options => {
        const url = new URL(options.url); __requests.push({text:url.searchParams.get('q'),anonymous:options.anonymous});
        setTimeout(() => __fail ? options.onerror() : options.onload({status:200,responseText:JSON.stringify([[['合并此拉取请求前，请审查更改。']]])}), __delay);
      };
      document.querySelector('#issue-button').onclick = () => __clicks++;
    });
    const protectedIds = ['owner','repo','breadcrumb','file','file2','branch','repo2','user2','source','viewer','diff','editor','log','readme','comment','issue-title','issue-link','commit','label','author','workflow-name','version','project','json'];
    const protectedBefore = await page.evaluate(ids => Object.fromEntries(ids.map(id => [id,document.getElementById(id).innerHTML])), protectedIds);
    await page.addScriptTag({content:script});
    await page.waitForFunction(() => document.querySelector('#code-menu').textContent === '代码');
    assert.deepEqual(await page.locator('header > nav:first-child a').allTextContents(), ['代码','议题','拉取请求','自动化','设置']);
    assert.equal(await page.locator('#raw').textContent(),'原始文件');
    assert.equal(await page.locator('#search').getAttribute('placeholder'),'搜索或跳转…');
    assert.equal(await page.locator('#search').inputValue(),'repo:Code/Settings is:open');
    assert.equal(await page.locator('#secret').inputValue(),'secret-token');
    assert.equal(await page.locator('#draft').inputValue(),'Code Open Actions');
    const protectedAfter = await page.evaluate(ids => Object.fromEntries(ids.map(id => [id,document.getElementById(id).innerHTML])), protectedIds);
    assert.deepEqual(protectedAfter, protectedBefore);
    assert.equal(await page.locator('#file').getAttribute('title'),'Code');
    await page.locator('#issue-button').click(); assert.equal(await page.evaluate(() => __clicks),1);
    assert.equal(await page.evaluate(() => __requests.length),0);
    console.log('PASS: GitHub 导航、文件操作、设置与搜索提示；代码/差异/日志/文件名/分支/用户名/仓库名/正文保持原样，按钮与输入值不变');

    const labels = [['Download ZIP','下载 ZIP'],['Create a new release','创建新版本'],['Merge pull request','合并拉取请求'],['Security and quality','安全与质量'],['Run workflow','运行工作流'],['Re-run failed jobs','重新运行失败作业'],['Build and deployment','构建与部署'],['Deploy from a branch','从分支部署'],['Secrets and variables','机密与变量'],['Danger Zone','危险操作区'],['3 commits','3 提交记录'],['Issues 12','议题 12'],['1.3k Open','1.3k 未关闭']];
    await page.evaluate(labels => {
      const popup = document.createElement('div'); popup.id = 'popup';
      for(const [en] of labels){const b=document.createElement('button');b.textContent=en;b.setAttribute('aria-label',en);popup.append(b);}
      document.body.append(popup);
    },labels);
    await page.waitForFunction(labels => [...document.querySelectorAll('#popup button')].every((el,i) => el.textContent === labels[i][1] && el.getAttribute('aria-label') === labels[i][1]),labels);
    await page.evaluate(() => document.querySelector('#popup button').firstChild.nodeValue='Copy link');
    await page.waitForFunction(() => document.querySelector('#popup button').textContent==='复制链接');
    const host = page.locator('[data-github-zh]');
    await page.evaluate(() => document.querySelector('[data-github-zh]').shadowRoot.querySelector('details').open=true);
    await host.getByRole('button',{name:'显示英文原文',exact:true}).click();
    assert.equal(await page.locator('#code-menu').textContent(),'Code');
    assert.equal(await page.locator('#search').getAttribute('placeholder'),'Search or jump to...');
    await host.getByRole('button',{name:'恢复中文界面',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('#code-menu').textContent==='代码');
    console.log('PASS: 动态弹窗、节点复用、计数标签、原文恢复与重新启用');

    async function select(id) { await page.evaluate(id => { const range=document.createRange();range.selectNodeContents(document.getElementById(id));const selection=getSelection();selection.removeAllRanges();selection.addRange(range); }, id); }
    const result = () => host.locator('#result').textContent();
    const selectionButton = () => host.getByRole('button',{name:'翻译选中文字（在线）',exact:true});
    await select('source'); await selectionButton().click();
    assert((await result()).includes('代码区')); assert.equal(await page.evaluate(() => __requests.length),0);
    await page.evaluate(() => {
      const p=document.createElement('p');p.id='too-long';p.textContent='A'.repeat(1501);document.querySelector('#readme').append(p);
      const mixed=document.createElement('p');mixed.id='mixed';mixed.append('Review ');
      const code=document.createElement('code');code.textContent='Code';mixed.append(code,' before merging.');document.querySelector('#readme').append(mixed);
    });
    await select('too-long'); await selectionButton().click(); assert((await result()).includes('1500'));
    await select('mixed'); await selectionButton().click(); assert((await result()).includes('包含代码'));
    assert.equal(await page.evaluate(() => __requests.length),0);
    accept = false; await select('prose'); await selectionButton().click();
    assert.equal(await page.evaluate(() => __requests.length),0);
    accept = true; await select('prose'); await selectionButton().click();
    await page.waitForFunction(() => document.querySelector('[data-github-zh]').shadowRoot.getElementById('result').textContent === '合并此拉取请求前，请审查更改。');
    assert.equal(await page.locator('#prose').textContent(),'Review the changes before merging this pull request.');
    assert.deepEqual(await page.evaluate(() => __requests),[{text:'Review the changes before merging this pull request.',anonymous:true}]);
    assert(!JSON.stringify(await page.evaluate(() => __store)).includes('Review the changes'));
    await host.getByRole('button',{name:'清空翻译结果',exact:true}).click(); assert.equal(await result(),'');
    await page.evaluate(() => { __delay=250; }); await select('prose'); await selectionButton().click();
    await host.getByRole('button',{name:'清空翻译结果',exact:true}).click(); await page.waitForTimeout(350); assert.equal(await result(),'');
    await page.evaluate(() => { __delay=20;__fail=true; }); await select('prose'); await selectionButton().click();
    await page.waitForFunction(() => document.querySelector('[data-github-zh]').shadowRoot.getElementById('result').textContent.includes('在线翻译失败'));
    assert.equal(await page.locator('#code-menu').textContent(),'代码');
    console.log('PASS: 只在选中并确认后在线翻译、拒绝代码区、结果不改写正文/不缓存、取消确认/清空在途结果和网络失败处理');
    await page.evaluate(() => {
      history.pushState({},'', '/Code/Settings/actions');
      document.querySelector('main').innerHTML='<button id="new">Run workflow</button><pre id="still-code">Open</pre>';
      document.dispatchEvent(new Event('turbo:load'));
    });
    await page.waitForFunction(() => document.querySelector('#new').textContent==='运行工作流');
    assert.equal(await page.locator('#still-code').textContent(),'Open');
    assert.deepEqual(errors,[]);
    assert((await page.evaluate(() => Object.keys(__store))).every(key=>key.startsWith('github-zh-v1-')));
    console.log('PASS: Turbo 站内导航和独立设置');
  } finally { await browser.close(); }
})().catch(error => { console.error(error);process.exitCode=1; });
