# 网站翻译

收集不同网站的中文翻译脚本，使用 Tampermonkey（篡改猴）安装。每个网站单独提供 ZIP 安装包和使用说明，后续网站会继续加入此目录。

## 下载目录

| 名称 | 功能 | 版本 | 下载 |
| --- | --- | --- | --- |
| **Artlist 翻译** | 导航、音乐筛选和播放器中文化；可选歌曲名双语显示 | v1.0.6 | [⬇ 下载 ZIP 安装包](https://github.com/sudazz777/WangZhanFanYi/raw/refs/heads/main/downloads/artlist-translation-v1.0.6.zip) |
| **Musicbed 翻译** | 歌曲与音效筛选、播放器和授权入口中文化；可选名称双语及公开正文补译 | v1.0.2 | [⬇ 下载 ZIP 安装包](https://github.com/sudazz777/WangZhanFanYi/raw/refs/heads/main/downloads/musicbed-translation-v1.0.2.zip) |
| **GitHub 翻译** | 仓库与二级设置菜单、选项和描述中文化；保护代码，正文可选中后手动补译 | v1.1.2 | [⬇ 下载 ZIP 安装包](https://github.com/sudazz777/WangZhanFanYi/raw/refs/heads/main/downloads/github-translation-v1.1.2.zip) |

[Artlist 翻译使用说明](./docs/artlist.md) · [Musicbed 翻译使用说明](./docs/musicbed.md) · [GitHub 翻译使用说明](./docs/github.md)

## 安装方法

1. 在桌面版 Chrome、Edge 或 Firefox 中安装 [Tampermonkey（篡改猴）](https://www.tampermonkey.net/)。
2. 从上方目录下载对应网站的 ZIP 安装包，解压。
3. 打开篡改猴 **管理面板 → 实用工具 → 从文件导入**，选择解压得到的 `.user.js` 文件，并确认安装。
4. 打开或刷新对应网站。

**Artlist 旧版更新：** 如果已安装“Artlist 简体中文助手（含歌曲界面）”，请先停用旧名称脚本，再导入“Artlist 翻译”，避免两个脚本同时运行。

各网站的覆盖范围和可选在线翻译设置，请查看对应使用说明。

## 检查更新

首次请下载上方最新版 ZIP 并导入一次。之后在网站右下角助手或篡改猴扩展菜单点击 **检查脚本更新**；发现新版后可下载 ZIP 安装包。

三个脚本均已配置篡改猴原生更新地址，可在管理面板检查更新或按扩展设置定期检查。仓库公开，无需登录；更新检查只读取版本信息，不发送网页内容。安装确认由篡改猴控制。
