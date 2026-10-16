# 更新功能维护

## 合并版发布

当前主下载为“网站翻译”合并版，统一版本记录在 `scripts/bundle-config.json`。修改版本后运行 `python scripts/sync-update-metadata.py`，再运行 `python scripts/build-bundle.py`，生成 `websites-zh-CN.user.js` 与 `updates/websites.meta.js`。

`scripts/render-core.js` 是合并版唯一的防闪现核心，接收各网站的扫描、翻译与保护规则。共用微任务扫描、分批预算和局部等待超时；网站词库、在线候选识别、正文与输入保护保持在各网站模块。构建时去除旧独立模块内的渲染实现与独立更新身份，所有网站使用合并版的版本和 ZIP。

先同步更新 README、下载页面和安装说明中的统一版本，以及 README 与首页的支持网站列表，再运行 `python scripts/package-bundle.py`。发布包命名为 `downloads/websites-translation-v<版本>.zip`，只包含一个用户脚本、`安装说明.txt` 与 `GPL-3.0.txt`。需要验证：

- `node test/bundle.test.cjs` 与 `node test/update.test.cjs --bundle`。
- 三站原有功能测试均支持传入 `websites-zh-CN.user.js`；音乐站绘制测试通过 `--musicbed` 选择 Musicbed。
- 三站防闪现回归及性能测试；性能测试可使用 `--github`、`--musicbed` 选择网站。
- ZIP 中脚本与根目录逐字节一致，公开版本文件、脚本和 ZIP 均可读取。

旧独立版保留用于兼容与维护词库。安装合并版前应停用独立版；篡改猴按脚本隔离存储，因此旧设置与缓存不会自动转移。

## 旧独立版维护

三个脚本通过公开仓库的 Raw 文件提供更新；手动检查不发送页面内容，不携带 Cookie，也不执行远程代码。脚本面板只提供 ZIP 安装包下载，篡改猴原生更新使用 `@updateURL` 与 `@downloadURL`。

发布新版本时：

1. 修改对应 `.user.js` 的 `@version`，使用 2–4 段数字版本号。
2. 运行 `python scripts/sync-update-metadata.py`。它会同步三个脚本的原生更新地址、内嵌版本配置、公共更新模块，以及 `updates/*.meta.js`。更新模块源文件为 `scripts/script-update-module.js`。
3. 更新下载目录、使用说明和安装说明；创建 `downloads/<网站>-translation-v<版本>.zip`。ZIP 内的脚本必须与根目录脚本逐字节一致，GitHub 安装包同时包含 GPL 许可证。
4. 运行 `node test/update.test.cjs` 及相应翻译回归检查，确保版本信息、包名、下载地址一致。
5. 将脚本、元数据、ZIP 和下载目录放在同一个提交中发布到 `main`，保留旧版安装包。发布后检查未登录访问三个 Raw 端点（元数据、脚本、ZIP）均成功。

新版本比较使用数字段，例如 `1.10.0` 大于 `1.9.9`。手动检查验证名称、命名空间与版本格式，忽略远程元数据的下载链接，按本地固定的仓库地址构造 ZIP 链接。网络或校验失败会显示错误，不会误报“已是最新版本”。

旧版没有更新配置，用户需要先手动导入一次带有本功能的新版。篡改猴的检查周期、更新权限和安装确认由用户的扩展设置控制。
