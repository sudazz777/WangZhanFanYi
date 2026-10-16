// One scheduler and reveal policy for every website; translation remains in site adapters.
function createRenderCore({site, enabled, skip, scan, translate}) {
  const roots = new Set(), scanTasks = [], attributeJobs = new Map();
  let scanTimer = 0, scanQueued = false, scanGeneration = 0;
  let maskableRoots = new WeakSet();
  const pendingMasks = new Map();
  let revealStyle;
  const MASK_LIMIT = 180;
  const styleAttribute = 'data-' + site + '-zh-style';
  const pendingAttribute = 'data-' + site + '-zh-pending';
  function installRevealStyle() {
    if (revealStyle?.isConnected || !document.documentElement) return;
    if (!revealStyle) {
      revealStyle = document.createElement('style');
      revealStyle.setAttribute(styleAttribute, 'reveal');
      revealStyle.textContent = `[${pendingAttribute}],[${pendingAttribute}] *{visibility:hidden!important}`;
    }
    (document.head || document.documentElement).append(revealStyle);
  }
  function reveal(root) {
    const state = pendingMasks.get(root);
    if (!state) return;
    clearTimeout(state.timer);
    pendingMasks.delete(root);
    root.removeAttribute(pendingAttribute);
  }
  function conceal(task) {
    const root = task.root;
    if (!task.conceal || task.masked || !root.isConnected || root.nodeType !== Node.ELEMENT_NODE || root === document.body || root === document.documentElement) return;
    installRevealStyle();
    if (!revealStyle?.isConnected) return;
    let state = pendingMasks.get(root);
    if (!state) {
      state = {count:0, timer:setTimeout(() => reveal(root), MASK_LIMIT)};
      pendingMasks.set(root, state);
      root.setAttribute(pendingAttribute, '');
    }
    state.count++;
    task.masked = state;
  }
  function finishTask(task) {
    if (!task.masked) return;
    const state = pendingMasks.get(task.root);
    if (state === task.masked && --state.count === 0) reveal(task.root);
  }
  function schedule(root, conceal = false) {
    if (!enabled() || !root?.isConnected) return;
    if (root === document.body || root === document.documentElement) {
      for (const child of root.children) schedule(child, conceal);
      return;
    }
    if (root.nodeType === Node.ELEMENT_NODE && (root.tagName === 'HEAD' || root.closest(skip))) return;
    if (root.nodeType === Node.TEXT_NODE && !/[a-zA-Z]/.test(root.nodeValue || '')) return;
    if (conceal && root.nodeType === Node.ELEMENT_NODE) maskableRoots.add(root);
    roots.add(root);
    requestScan();
  }
  function requestScan() {
    if (scanQueued) return;
    clearTimeout(scanTimer); scanTimer = 0;
    scanQueued = true;
    const generation = scanGeneration;
    queueMicrotask(() => {
      if (generation !== scanGeneration) return;
      scanQueued = false;
      flushScans();
    });
  }
  function scheduleAttribute(el, name) {
    if (!enabled() || !el.isConnected) return;
    let names = attributeJobs.get(el);
    if (!names) { names = new Set(); attributeJobs.set(el, names); }
    names.add(name);
    requestScan();
  }
  function* scanAttributes(el, names) {
    for (const name of names) { translate(el, name); yield; }
  }
  function flushScans() {
    scanTimer = 0;
    if (!enabled()) return;
    const batch = new Set(roots); roots.clear();
    for (const root of batch) {
      // 沿祖先链查重，避免变动数量增加时出现两两比较。
      let parent = root.parentNode;
      while (parent && !batch.has(parent)) parent = parent.parentNode;
      if (!parent && root.isConnected) scanTasks.push({ root, iterator: scan(root), conceal:maskableRoots.has(root) });
      maskableRoots.delete(root);
    }
    for (const [el, names] of attributeJobs) {
      scanTasks.push({ root: el, iterator: scanAttributes(el, names) });
    }
    attributeJobs.clear();
    const end = performance.now() + 4;
    let steps = 0;
    while (scanTasks.length && steps++ < 320 && performance.now() < end) {
      const task = scanTasks[scanTasks.length - 1];
      let done = !task.root?.isConnected;
      try { if (!done) done = task.iterator.next().done; } catch { done = true; }
      if (done) { scanTasks.pop(); finishTask(task); }
    }
    // 小菜单在当前微任务中完成；大块新增内容分批处理，局部遮罩有超时兜底。
    for (const task of scanTasks) conceal(task);
    if (roots.size || attributeJobs.size || scanTasks.length) scanTimer = setTimeout(flushScans, 0);
  }
  function reset() {
    clearTimeout(scanTimer); scanTimer = 0;
    scanGeneration++; scanQueued = false;
    for (const root of [...pendingMasks.keys()]) reveal(root);
    roots.clear(); attributeJobs.clear(); scanTasks.length = 0;
    maskableRoots = new WeakSet();
  }
  return {schedule, scheduleAttribute, installRevealStyle, requestScan, scanTasks, reset};
}
