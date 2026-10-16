function createScriptUpdater(getHost) {
// Shared update UI for the bundled userscript. Installation is handled by Tampermonkey.
// No page text is sent and no downloaded JavaScript is executed.
  let updateUI;
  let updateChecking = false;
  let updateMessage = '当前版本 v' + SCRIPT_UPDATE.version;
  let updateInstall = '';
  function renderScriptUpdate() {
    if (!updateUI) return;
    updateUI.button.disabled = updateChecking;
    updateUI.button.textContent = updateChecking ? '正在检查更新…' : '检查脚本更新';
    updateUI.status.textContent = updateMessage;
    updateUI.links.hidden = !updateInstall;
    updateUI.install.hidden = !updateInstall;
    if (updateInstall) updateUI.install.href = updateInstall;
    else updateUI.install.removeAttribute('href');
  }
  function mountScriptUpdate() {
    const body = getHost()?.shadowRoot?.querySelector('.body');
    if (!body || body.querySelector('#script-update')) return;
    const section = document.createElement('div');
    section.id = 'script-update';
    section.style.cssText = 'border-top:1px solid #62656b;margin-top:10px;padding-top:4px';
    const button = document.createElement('button');
    button.type = 'button'; button.id = 'check-update'; button.onclick = checkScriptUpdate;
    const status = document.createElement('p');
    status.id = 'update-status'; status.setAttribute('role', 'status');
    const links = document.createElement('p');
    const install = document.createElement('a');
    install.id = 'update-install'; install.textContent = '在线更新（篡改猴确认）';
    install.style.color = '#a7c5ff';
    install.target = '_blank'; install.rel = 'noopener noreferrer';
    links.append(install);
    section.append(button, status, links); body.append(section);
    updateUI = {button, status, install, links}; renderScriptUpdate();
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
    if (getHost()?.shadowRoot) getHost().shadowRoot.querySelector('details').open = true;
    updateChecking = true; updateInstall = '';
    updateMessage = '正在读取仓库版本信息…'; renderScriptUpdate();
    let settled = false;
    function finish(message, install = '') {
      if (settled) return;
      settled = true; updateChecking = false;
      updateMessage = message; updateInstall = install; renderScriptUpdate();
    }
    const denied = '无法读取更新信息，仓库可能暂不可用、已转为私有，或网络/篡改猴权限受限。可在 GitHub 仓库主页手动下载。';
    try {
      GM_xmlhttpRequest({
        method: 'GET', url: SCRIPT_UPDATE.metaUrl + '?check=' + Date.now(),
        headers: {'Accept':'text/plain'}, timeout:12000, anonymous:true,
        onload(response) {
          if (response.status === 401 || response.status === 403 || response.status === 404) { finish(denied); return; }
          if (response.status !== 200) { finish('检查更新失败（HTTP ' + response.status + '），请稍后重试或前往 GitHub 仓库主页。'); return; }
          let latest;
          try { latest = parseUpdateVersion(response.responseText); }
          catch { finish('更新信息格式不正确或被网络登录页面替换。请稍后重试，也可前往 GitHub 仓库主页。'); return; }
          const comparison = compareScriptVersions(latest, SCRIPT_UPDATE.version);
          if (comparison > 0) finish('发现新版 v' + latest + '（当前 v' + SCRIPT_UPDATE.version + '）。点击“在线更新”并在篡改猴中确认，完成后刷新页面。', SCRIPT_UPDATE.installUrl + '?version=' + encodeURIComponent(latest));
          else if (comparison === 0) finish('已是最新版本 v' + SCRIPT_UPDATE.version + '。');
          else finish('当前 v' + SCRIPT_UPDATE.version + ' 高于仓库版本 v' + latest + '，无需降级。');
        },
        onerror: () => finish('无法连接更新地址。请检查网络和篡改猴的 GitHub 访问权限，或前往 GitHub 仓库主页。'),
        ontimeout: () => finish('检查更新超时，请稍后重试或前往 GitHub 仓库主页。'),
        onabort: () => finish('已取消检查更新。'),
      });
    } catch { finish('无法发起更新检查，请检查篡改猴访问权限或前往 GitHub 仓库主页。'); }
  }
  return {mountScriptUpdate, checkScriptUpdate};
}
