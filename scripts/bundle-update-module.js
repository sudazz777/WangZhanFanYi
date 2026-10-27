// Commands stay in Tampermonkey; this module never mounts UI into a website.
function createScriptUpdater() {
  let checking = false;
  function parseVersion(text) {
    if (typeof text !== 'string' || text.length > 16384) throw new Error('format');
    const trimmed=text.trim();
    if (!trimmed.startsWith('// ==UserScript==') || !trimmed.endsWith('// ==/UserScript==')) throw new Error('format');
    function field(name) {
      const values=[...trimmed.matchAll(new RegExp('^//\\s*@'+name+'\\s+([^\\r\\n]+)','gm'))];
      if(values.length!==1)throw new Error('format');
      return values[0][1].trim();
    }
    if(field('name')!==SCRIPT_UPDATE.name || field('namespace')!==SCRIPT_UPDATE.namespace)throw new Error('identity');
    const version=field('version');
    if(!/^\d{1,6}(?:\.\d{1,6}){1,3}$/.test(version))throw new Error('format');
    return version;
  }
  function compare(a,b) {
    const left=a.split('.').map(Number),right=b.split('.').map(Number);
    for(let i=0;i<Math.max(left.length,right.length);i++) {
      const delta=(left[i]||0)-(right[i]||0);if(delta)return Math.sign(delta);
    }
    return 0;
  }
  function checkScriptUpdate() {
    if(checking)return;
    checking=true;let settled=false;
    function finish(message,version='') {
      if(settled)return;settled=true;checking=false;
      if(!version){window.alert(message);return;}
      if(!window.confirm(message+'\n\n现在打开篡改猴安装页更新吗？'))return;
      const url=SCRIPT_UPDATE.installUrl+'?version='+encodeURIComponent(version);
      try {
        if(typeof GM_openInTab==='function') {GM_openInTab(url,{active:true,insert:true,setParent:true});return;}
        if(window.open(url,'_blank','noopener,noreferrer'))return;
      } catch { /* Let the user copy the trusted install URL if tab creation is unavailable. */ }
      window.prompt('请复制以下在线更新地址，在新标签页打开并确认安装：',url);
    }
    try {
      GM_xmlhttpRequest({method:'GET',url:SCRIPT_UPDATE.metaUrl+'?check='+Date.now(),headers:{Accept:'text/plain'},timeout:12000,anonymous:true,
        onload(response) {
          if(response.status!==200){finish('检查更新失败（HTTP '+response.status+'），请检查网络或稍后重试。');return;}
          let latest;
          try {latest=parseVersion(response.responseText);} catch {finish('更新信息格式不正确，请稍后重试。');return;}
          const comparison=compare(latest,SCRIPT_UPDATE.version);
          if(comparison>0)finish('发现新版 v'+latest+'（当前 v'+SCRIPT_UPDATE.version+'）。确认安装后刷新网页。',latest);
          else if(comparison===0)finish('已是最新版本 v'+SCRIPT_UPDATE.version+'。');
          else finish('当前 v'+SCRIPT_UPDATE.version+' 高于仓库版本 v'+latest+'，无需降级。');
        },
        onerror:()=>finish('无法连接更新地址，请检查网络和篡改猴访问权限。'),
        ontimeout:()=>finish('检查更新超时，请稍后重试。'),onabort:()=>finish('已取消检查更新。'),
      });
    }catch{finish('无法发起更新检查，请检查篡改猴访问权限。');}
  }
  return {checkScriptUpdate};
}
