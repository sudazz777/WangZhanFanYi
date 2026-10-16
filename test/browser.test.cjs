/* 本地模拟 Artlist 的动态 DOM。在线服务使用桩响应，测试不访问 Artlist 或 Google。 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const script = fs.readFileSync(path.join(__dirname, '..', 'artlist-zh-CN.user.js'), 'utf8');
const fixture = `<!doctype html><html><body>
  <header><button id="login">Sign In</button></header>
  <main>
    <h1 id="hero">Get royalty-free music for your videos</h1>
    <button id="filter">Filters</button><span id="genre">Cinematic</span>
    <span id="count">128 songs</span><button id="play" aria-label="Play Song">Play</button>
    <input id="search" placeholder="Search Music" value="Never send my search">
    <textarea id="textarea">Never send my textarea</textarea>
    <div contenteditable="true" id="editor">Never send my editor</div>
    <form><p id="private">Private billing data</p><input type="password" value="secret"></form>
    <a id="artist" href="/royalty-free-music/artist/happy/1">Happy</a>
    <a id="song" href="/royalty-free-music/song/happy/123">Happy</a>
    <a id="song2" href="/royalty-free-music/song/morning-light/124">Morning Light</a>
    <p id="description">A gentle melody for a new day.</p>
    <p id="unsafe">&lt;img src=x onerror=alert(1)&gt;</p>
    <script type="application/json" id="data">{"name":"Filters"}</script>
    <div translate="no" id="no">Filters</div>
    <div hidden id="hidden">Invisible Secret</div>
  </main></body></html>`;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://artlist.io/**', route => route.fulfill({ contentType: 'text/html', body: fixture }));
    await page.goto('https://artlist.io/royalty-free-music');
    await page.evaluate(() => {
      window.__store = {};
      window.__requests = [];
      window.__menus = [];
      window.__fail = false;
      window.__delay = 30;
      window.GM_getValue = (k, d) => window.__store[k] ?? d;
      window.GM_setValue = (k, v) => { window.__store[k] = v; };
      window.GM_registerMenuCommand = (name, fn) => window.__menus.push({ name, fn });
      window.GM_xmlhttpRequest = options => {
        const text = new URL(options.url).searchParams.get('q');
        window.__requests.push(text);
        const translations = { 'Happy': '快乐', 'Morning Light': '晨光', 'Evening Sky': '暮色天空', 'A gentle melody for a new day.': '迎接新一天的轻柔旋律。' };
        setTimeout(() => {
          if (window.__fail) options.onerror();
          else options.onload({ status: 200, responseText: JSON.stringify([[[translations[text] || '译文：' + text, text]]]) });
        }, window.__delay);
      };
    });
    page.on('dialog', dialog => dialog.accept());
    await page.addScriptTag({ content: script });
    const text = id => page.locator('#' + id).textContent();
    const waitText = (id, value) => page.waitForFunction(([i, v]) => document.getElementById(i).textContent === v, [id, value]);
    const click = id => page.evaluate(id => document.querySelector('[data-artlist-zh]').shadowRoot.getElementById(id).click(), id);
    await waitText('filter', '筛选');
    assert.equal(await text('genre'), '电影配乐');
    assert.equal(await text('login'), '登录');
    assert.equal(await text('count'), '128 首歌曲');
    assert.equal(await page.locator('#play').getAttribute('aria-label'), '播放歌曲');
    assert.equal(await page.locator('#search').getAttribute('placeholder'), '搜索音乐');
    assert.equal(await page.locator('#search').inputValue(), 'Never send my search');
    assert.equal(await text('song'), 'Happy');
    assert.equal(await text('artist'), 'Happy');
    assert.equal(await text('data'), '{"name":"Filters"}');
    assert.equal(await text('no'), 'Filters');
    assert.equal(await page.evaluate(() => __requests.length), 0);
    console.log('PASS: 本地词库、输入框占位符、输入值保护和歌曲名保留');

    // 根据用户提供的四张筛选截图重现漏译项，模拟展开后才挂载的弹窗。
    const filterLabels = [
      ['Drone Shots', '航拍'], ['Industry', '工业'], ['Intros & Logos', '片头与标志'],
      ['Landscape', '风景'], ['Medical', '医疗'], ['Party', '派对'], ['Science', '科学'],
      ['Sport & Fitness', '运动与健身'], ['Time-Lapse', '延时摄影'], ['Weddings', '婚礼'], ['Shorts', '短视频'],
      ['Acoustic Drums', '原声鼓'], ['Backing Vocals', '和声'], ['Claps & Snaps', '拍手与响指'],
      ['Electronic Drums', '电子鼓'], ['Ethnic', '民族乐器'], ['Mandolin & Ukulele', '曼陀林与尤克里里'],
      ['Orchestra', '管弦乐队'], ['Pads', '铺底音色'], ['Special Wind Instruments', '特殊管乐器'], ['Whistle', '口哨'],
      ['Exciting', '激动人心'], ['Love', '爱意'], ['Fantasy', '奇幻'], ['Lofi & Chill Beats', '低保真与休闲节拍'],
      ['Retro', '复古'], ['Soul & RnB', '灵魂乐与节奏布鲁斯'], ['Worship', '敬拜音乐'],
      ['Time‑Lapse', '延时摄影'], ['  Soul\u00a0＆\u00a0RnB  ', '  灵魂乐与节奏布鲁斯  '],
      ['Claps&Snaps', '拍手与响指'], ['Lo‑Fi & Chill Beats', '低保真与休闲节拍'],
    ];
    await page.evaluate(labels => {
      const popup = document.createElement('div');
      popup.id = 'filter-popup'; popup.setAttribute('role', 'dialog');
      for (const [en] of labels) {
        const chip = document.createElement('button');
        chip.textContent = en; chip.setAttribute('aria-label', en); popup.append(chip);
      }
      // 网站的弹出层可以在 main 之外，本地词库也应覆盖。
      document.body.append(popup);
    }, filterLabels);
    await page.waitForFunction(labels => {
      const chips = [...document.querySelectorAll('#filter-popup button')];
      return chips.every((chip, i) => chip.textContent === labels[i][1] && chip.getAttribute('aria-label') === labels[i][1]);
    }, filterLabels);
    assert.equal(await page.evaluate(() => __requests.length), 0);
    await click('toggle');
    assert.deepEqual(await page.locator('#filter-popup button').allTextContents(), filterLabels.map(([en]) => en));
    await click('toggle');
    await page.waitForFunction(() => document.querySelector('#filter-popup button').textContent === '航拍');
    // 复用同一按钮来展示另一个筛选项，也应重新翻译。
    await page.evaluate(() => { document.querySelector('#filter-popup button').firstChild.nodeValue = 'Worship'; });
    await page.waitForFunction(() => document.querySelector('#filter-popup button').textContent === '敬拜音乐');
    await page.evaluate(() => document.querySelector('#filter-popup').remove());
    console.log('PASS: 截图中 28 个漏译项、连字符及空格变体、弹窗动态挂载、原文恢复和筛选节点复用');

    await page.evaluate(() => {
      const row = document.createElement('button'); row.id = 'dynamic'; row.textContent = 'Download'; document.querySelector('main').append(row);
      document.querySelector('#play').firstChild.nodeValue = 'Pause';
      document.querySelector('#play').setAttribute('aria-label', 'Pause Song');
    });
    await waitText('dynamic', '下载');
    await waitText('play', '暂停');
    assert.equal(await page.locator('#play').getAttribute('aria-label'), '暂停歌曲');
    await click('toggle');
    await waitText('filter', 'Filters');
    assert.equal(await text('play'), 'Pause');
    assert.equal(await page.locator('#search').getAttribute('placeholder'), 'Search Music');
    await click('toggle');
    await waitText('filter', '筛选');
    console.log('PASS: 动态添加、播放器更新、原文恢复及重新启用');

    await click('online');
    await waitText('song', '快乐（Happy）');
    await waitText('song2', '晨光（Morning Light）');
    await waitText('description', '迎接新一天的轻柔旋律。');
    assert.equal(await text('artist'), 'Happy');
    assert.equal(await page.locator('#unsafe img').count(), 0);
    const sent = await page.evaluate(() => __requests);
    for (const secret of ['Never send my search', 'Never send my textarea', 'Never send my editor', 'Private billing data', 'secret', 'Invisible Secret']) assert(!sent.includes(secret), secret);
    console.log('PASS: 歌曲双语、描述翻译、保留人名、跳过私密字段、HTML 安全');

    await page.evaluate(() => {
      const song = document.querySelector('#song');
      song.firstChild.nodeValue = 'Evening Sky'; song.href = '/royalty-free-music/song/evening-sky/200';
    });
    await waitText('song', '暮色天空（Evening Sky）');
    await click('bilingual');
    await waitText('song', '暮色天空');
    await click('bilingual');
    await waitText('song', '暮色天空（Evening Sky）');
    assert.equal((await page.evaluate(() => __requests)).filter(t => t === 'Evening Sky').length, 1);
    await click('online');
    await waitText('song', 'Evening Sky');
    await waitText('filter', '筛选');
    console.log('PASS: 虚拟列表节点复用、双语切换、命中缓存、关闭在线翻译');

    await page.evaluate(() => {
      window.__delay = 800;
      document.querySelector('#song').firstChild.nodeValue = 'Delayed Song';
    });
    await click('online');
    await page.waitForFunction(() => __requests.includes('Delayed Song'));
    await click('toggle');
    await page.waitForTimeout(1000);
    assert.equal(await text('song'), 'Delayed Song');
    assert.equal(await text('filter'), 'Filters');
    console.log('PASS: 关闭翻译后丢弃在途响应');

    await page.evaluate(() => {
      window.__fail = true; window.__delay = 20;
      for (let i = 0; i < 3; i++) {
        const p = document.createElement('p'); p.textContent = 'Network failure example ' + i; document.querySelector('main').append(p);
      }
    });
    await click('toggle');
    await page.waitForFunction(() => document.querySelector('[data-artlist-zh]').shadowRoot.getElementById('status').textContent.includes('在线连接失败'));
    assert.equal(await text('filter'), '筛选');
    const before = await page.evaluate(() => __requests.length);
    await page.waitForTimeout(1600);
    assert.equal(await page.evaluate(() => __requests.length), before);
    await page.evaluate(() => { window.__fail = false; });
    await click('rescan');
    await waitText('song', '译文：Delayed Song（Delayed Song）');
    console.log('PASS: 网络连续失败后暂停、保留本地翻译及手动重试');

    await page.evaluate(() => {
      history.pushState({}, '', '/royalty-free-music/song/new/300');
      document.querySelector('main').innerHTML = '<h1 id="detail">Morning Light</h1><button id="detailButton">Download</button>';
    });
    await waitText('detail', '晨光（Morning Light）');
    await waitText('detailButton', '下载');
    assert.equal(errors.length, 0);
    await page.waitForTimeout(900);
    console.log('PASS: SPA 路由切换及歌曲详情标题翻译');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
