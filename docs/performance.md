# v1.0.3 性能验证

卡顿相关的重复工作来自：弹窗增删后扫描父容器、样式类变化后扫描整棵子树、滚动后扫描整个 body，以及翻译写回触发的新一轮扫描。

本次改为只处理新增节点、变化的文字或展示属性；忽略自身的翻译写回和 class 变化。大列表按每批约 5ms、最多 240 个处理步骤让出主线程。在线翻译由 IntersectionObserver 跟踪可见内容，不再逐条读取布局或因滚动遍历全页。删除节点后的记录清理也分批执行。

本地 Chromium 中构造 1,800 行列表，间隔约 35ms 展开筛选 20 次，再触发 30 次滚动事件。一次对比结果如下；旧版批处理次数受事件时序影响，数字会略有变化。

| 场景 | v1.0.2 | v1.0.3 |
| --- | ---: | ---: |
| 初始加载遍历节点 | 12,604 | 12,604 |
| 连续展开筛选遍历节点 | 88,242 | 40 |
| 连续展开筛选的整页/主列表遍历 | 7 次 | 0 次 |
| 滚动遍历节点（离线词库模式） | 12,607 | 0 |
| 初始加载观察到的最大长任务 | 114ms | 无超过 50ms 的长任务 |

遍历量是脚本通过 TreeWalker 实际访问的后代节点数；单个展示属性更新单独处理，不计为子树遍历。测试同时断言点击后不扫描主列表、滚动不扫描整页，以免只依赖某一台机器的耗时。

复现需要 Node.js、Playwright 和 `/usr/bin/chromium`：

```sh
git show 7976245:artlist-zh-CN.user.js > /tmp/artlist-v1.0.2.user.js
node test/performance.test.cjs /tmp/artlist-v1.0.2.user.js --baseline
node test/performance.test.cjs
node test/browser.test.cjs
```

功能回归覆盖顶部导航、筛选弹窗、展示属性、歌曲节点复用、原文恢复、缓存、失败重试，以及歌曲滚入视口和仅通过 class 变化显示时的补译。测试使用本地页面和模拟翻译响应，未在登录后的真实 Artlist 页面测量；结果不代表网站本身和网络请求的耗时。

## Musicbed 验证

Musicbed 独立脚本使用相同的增量处理方式，可执行：

```sh
node test/musicbed.test.cjs
node test/performance.test.cjs musicbed-zh-CN.user.js
```

Musicbed 的 1,800 行模拟列表中，连续展开筛选只遍历新增弹窗的 40 个后代节点，主列表重扫为 0 次；离线模式滚动遍历为 0 个节点。功能测试额外验证 Musicbed 的歌曲和音效路径、以歌搜歌、音乐特征、调性、BPM、音乐人保护及独立缓存。
