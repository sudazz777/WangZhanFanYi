// 用大列表和反复展开筛选模拟交互；通过遍历次数衡量重复工作，避免依赖机器速度。
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const baseline = process.argv.includes('--baseline');
const scriptPath = process.argv.find(arg => arg.endsWith('.user.js')) || path.join(__dirname, '..', 'artlist-zh-CN.user.js');
const musicbed = /musicbed/i.test(path.basename(scriptPath));
const github = /github/i.test(path.basename(scriptPath));
const origin = github ? 'https://github.com' : musicbed ? 'https://www.musicbed.com' : 'https://artlist.io';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const rows = Array.from({ length: 1800 }, (_, i) => `<div><span>Track ${i}</span><span>Artist ${i}</span><button>${github ? 'Code' : 'Play'}</button></div>`).join('');
    await page.route(origin + '/**', route => route.fulfill({ contentType: 'text/html', body: `<header><button id="open">Filters</button></header><main>${rows}</main>` }));
    await page.goto(origin + (github ? '/owner/repo' + (process.argv.includes('--settings') ? '/settings' : '') : musicbed ? '/songs' : '/royalty-free-music'));
    await page.evaluate(() => {
      window.GM_getValue = (_, fallback) => fallback;
      window.GM_setValue = () => {};
      window.GM_registerMenuCommand = () => {};
      window.GM_xmlhttpRequest = () => { throw Error('性能测试不应请求网络'); };
      window.__visits = { nodes: 0, walks: 0, bodyWalks: 0 };
      window.__longTasks = [];
      new PerformanceObserver(list => __longTasks.push(...list.getEntries().map(e => e.duration))).observe({ type: 'longtask', buffered: false });
      const original = Document.prototype.createTreeWalker;
      Document.prototype.createTreeWalker = function (root, ...args) {
        __visits.walks++;
        if (root === document.body || root === document.querySelector('main')) __visits.bodyWalks++;
        const walker = original.call(this, root, ...args);
        const next = walker.nextNode.bind(walker);
        walker.nextNode = () => { const node = next(); if (node) __visits.nodes++; return node; };
        return walker;
      };
      document.querySelector('#open').onclick = () => {
        document.querySelector('main').classList.toggle('active');
        document.querySelector('main').setAttribute('aria-label', 'Music');
        document.querySelector('#popup')?.remove();
        const popup = document.createElement('div'); popup.id = 'popup';
        popup.innerHTML = '<button>Filters</button>';
        document.body.append(popup);
      };
    });
    await page.addScriptTag({ content: fs.readFileSync(scriptPath, 'utf8') });
    await page.waitForFunction(expected => document.querySelector('main > div:last-child button').textContent === expected, github ? '代码' : '播放');
    await page.waitForTimeout(500);
    const initial = await page.evaluate(() => ({ ...__visits, maxLongTaskMs: Math.round(Math.max(0, ...__longTasks)) }));
    await page.evaluate(() => { __visits = { nodes: 0, walks: 0, bodyWalks: 0 }; __longTasks = []; });
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => document.querySelector('#open').click());
      await page.waitForTimeout(35);
    }
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#popup button').textContent(), '筛选');
    const clicks = await page.evaluate(() => ({ ...__visits, maxLongTaskMs: Math.round(Math.max(0, ...__longTasks)) }));
    await page.evaluate(() => {
      __visits = { nodes: 0, walks: 0, bodyWalks: 0 };
      for (let i = 0; i < 30; i++) document.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(700);
    const scrolling = await page.evaluate(() => ({ ...__visits }));
    let anchors;
    if (github) {
      await page.evaluate(() => { __visits = { nodes:0,walks:0,bodyWalks:0 }; location.hash='L20'; });
      await page.waitForTimeout(1700);
      anchors = await page.evaluate(() => ({ ...__visits }));
      assert.equal(anchors.bodyWalks,0,'代码行锚点变化不应重扫整页');
    }
    if (!baseline) {
      assert.equal(clicks.bodyWalks, 0, '展开筛选和切换 class 不应重扫主列表');
      assert(clicks.nodes < 1000, '仅处理新弹窗，应与列表长度无关');
      assert.equal(scrolling.nodes, 0, '离线翻译不应在滚动时重扫整页');
    }
    console.log(JSON.stringify({ site: github ? 'GitHub' : musicbed ? 'Musicbed' : 'Artlist', mode: baseline ? 'baseline' : 'optimized', rows: 1800, initial, clicks, scrolling, anchors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
