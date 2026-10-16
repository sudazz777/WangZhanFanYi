// Embedded in each standalone userscript by the release preparation step.
// No page text is sent and no downloaded JavaScript is executed.
  let updateUI;
  let updateChecking = false;
  let updateMessage = '当前版本 v' + SCRIPT_UPDATE.version;
  let updateDownload = '';
  function renderScriptUpdate() {
    if (!updateUI) return;
    updateUI.button.disabled = updateChecking;
    updateUI.button.textContent = updateChecking ? '正在检查更新…' : '检查脚本更新';
    updateUI.status.textContent = updateMessage;
    updateUI.download.hidden = !updateDownload;
    if (updateDownload) updateUI.download.href = updateDownload;
    else updateUI.download.removeAttribute('href');
  }
  function mountScriptUpdate() {
    const body = host?.shadowRoot?.querySelector('.body');
    if (!body || body.querySelector('#script-update')) return;
    const section = document.createElement('div');
    section.id = 'script-update';
    section.style.cssText = 'border-top:1px solid #62656b;margin-top:10px;padding-top:4px';
    const button = document.createElement('button');
    button.type = 'button'; button.id = 'check-update'; button.onclick = checkScriptUpdate;
    const status = document.createElement('p');
    status.id = 'update-status'; status.setAttribute('role', 'status');
    const links = document.createElement('p');
    const download = document.createElement('a');
    download.style.color = '#a7c5ff';
    download.id = 'update-download'; download.textContent = '下载新版 ZIP 安装包';
    download.target = '_blank'; download.rel = 'noopener noreferrer';
    const repo = document.createElement('a');
    repo.style.color = '#a7c5ff';
    repo.id = 'update-repo'; repo.textContent = '打开仓库下载目录';
    repo.href = SCRIPT_UPDATE.repoUrl; repo.target = '_blank'; repo.rel = 'noopener noreferrer';
    links.append(download, document.createElement('br'), repo);
    section.append(button, status, links); body.append(section);
    updateUI = {button, status, download}; renderScriptUpdate();
  }
  function parseUpdateVersion(text) {
    if (typeof text !== 'string' || text.length > 16384) throw new Error('format');
    const trimmed = text.trim();
    if (!trimmed.startsWith('// ==UserScript==') || !trimmed.endsWith('// ==/UserScript==')) throw new Error('format');
    function field(name) {
      const values = [...trimmed.matchAll(new RegExp('^//\\s*@' + name + '\\s+([^\\r\\n]+)', 'gm'))];
      if (values.length !== 1) throw new Error('format');
      return values[0][1].trim();
    }
    if (field('name') !== SCRIPT_UPDATE.name || field('namespace') !== SCRIPT_UPDATE.namespace) throw new Error('identity');
    const version = field('version');
    if (!/^\d{1,6}(?:\.\d{1,6}){1,3}$/.test(version)) throw new Error('format');
    return version;
  }
  function compareScriptVersions(a, b) {
    const left = a.split('.').map(Number), right = b.split('.').map(Number);
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      const difference = (left[i] || 0) - (right[i] || 0);
      if (difference) return Math.sign(difference);
    }
    return 0;
  }
  function checkScriptUpdate() {
    if (updateChecking) return;
    if (host?.shadowRoot) host.shadowRoot.querySelector('details').open = true;
    updateChecking = true; updateDownload = '';
    updateMessage = '正在读取仓库版本信息…'; renderScriptUpdate();
    let settled = false;
    function finish(message, download = '') {
      if (settled) return;
      settled = true; updateChecking = false;
      updateMessage = message; updateDownload = download; renderScriptUpdate();
    }
    const denied = '无法读取更新信息，仓库可能暂不可用、已转为私有，或网络/篡改猴权限受限。可打开仓库目录手动下载。';
    try {
      GM_xmlhttpRequest({
        method: 'GET', url: SCRIPT_UPDATE.metaUrl + '?check=' + Date.now(),
        headers: {'Accept':'text/plain'}, timeout:12000, anonymous:true,
        onload(response) {
          if (response.status === 401 || response.status === 403 || response.status === 404) { finish(denied); return; }
          if (response.status !== 200) { finish('检查更新失败（HTTP ' + response.status + '），请稍后重试或打开仓库目录。'); return; }
          let latest;
          try { latest = parseUpdateVersion(response.responseText); }
          catch { finish('更新信息格式不正确或被网络登录页面替换。请稍后重试，也可打开仓库目录。'); return; }
          const comparison = compareScriptVersions(latest, SCRIPT_UPDATE.version);
          if (comparison > 0) finish('发现新版 v' + latest + '（当前 v' + SCRIPT_UPDATE.version + '）。下载 ZIP，解压导入篡改猴确认更新后刷新页面。', SCRIPT_UPDATE.downloadBase + SCRIPT_UPDATE.id + '-translation-v' + latest + '.zip');
          else if (comparison === 0) finish('已是最新版本 v' + SCRIPT_UPDATE.version + '。');
          else finish('当前 v' + SCRIPT_UPDATE.version + ' 高于仓库版本 v' + latest + '，无需降级。');
        },
        onerror: () => finish('无法连接更新地址。请检查网络和篡改猴的 GitHub 访问权限，或打开仓库目录。'),
        ontimeout: () => finish('检查更新超时，请稍后重试或打开仓库目录。'),
        onabort: () => finish('已取消检查更新。'),
      });
    } catch { finish('无法发起更新检查，请检查篡改猴访问权限或打开仓库目录。'); }
  }
