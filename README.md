# 网站翻译

一个 Tampermonkey（篡改猴）脚本，翻译 **Artlist、Musicbed、GitHub 和 MiniMax Audio**。打开网站后自动启用对应翻译；防闪现优化共用，各网站分别保留自己的词库、页面规则和设置。

## 下载目录

### [网站翻译 · v1.1.0](https://github.com/sudazz777/WangZhanFanYi/raw/refs/heads/main/downloads/websites-translation-v1.1.0.zip)

安装包包含一个 `websites-zh-CN.user.js`、安装说明和开源许可证。只需导入这一个脚本。

**从独立版切换：** 请先停用原来的 Artlist 翻译、Musicbed 翻译、GitHub 翻译，以及更早的 Artlist 简体中文助手，再安装合并版，避免重复处理。合并版属于新的油猴脚本，旧版设置和缓存不会自动迁移；在线翻译默认关闭，可按网站重新开启。

## 支持的网站

| 网站 | 适用网址 | 翻译内容 | 使用说明 |
| --- | --- | --- | --- |
| **Artlist** | [artlist.io](https://artlist.io/royalty-free-music)（含 www） | 导航、音乐筛选、播放器；可选歌曲名双语和描述翻译 | [Artlist 翻译说明](./docs/artlist.md) |
| **Musicbed** | [musicbed.com](https://www.musicbed.com/)（含 www） | 歌曲与音效筛选、播放器和授权入口；可选名称双语与公开正文补译 | [Musicbed 翻译说明](./docs/musicbed.md) |
| **GitHub** | [github.com](https://github.com/) | 仓库、二级设置菜单、选项与描述；保护代码，正文可选中后手动补译 | [GitHub 翻译说明](./docs/github.md) |
| **MiniMax Audio** | [minimax.io/audio](https://www.minimax.io/audio)（含 www，仅 Audio 区域） | 文本转语音、音乐、音色库、音色设计、声音克隆、人声分离及提示说明；保护歌词和提示词 | [MiniMax Audio 翻译说明](./docs/minimax.md) |

后续新增网站会继续在这个列表中显示，通过同一个脚本更新。

## 安装方法

1. 在桌面版 Chrome、Edge 或 Firefox 中安装 [Tampermonkey（篡改猴）](https://www.tampermonkey.net/)。
2. 下载上面的 ZIP，解压。
3. 停用旧的三个独立翻译脚本。在篡改猴 **管理面板 → 实用工具 → 从文件导入** 中选择 `websites-zh-CN.user.js`，确认安装。
4. 刷新支持的网站。右下角助手会显示当前网站名称；设置、缓存和在线补译按网站独立保存。

[查看合并版完整使用说明](./docs/使用说明.md)。

## 检查更新

点击网站右下角助手或篡改猴菜单的 **检查脚本更新**，发现新版后点击 **在线更新（篡改猴确认）**，在打开的篡改猴安装页确认更新，再刷新网页；无需解压或导入。助手不再提供 ZIP 下载入口。也支持篡改猴原生更新检查，检查频率和安装确认由扩展设置控制。

更新检查只读取公开版本信息，不发送页面文字。默认界面翻译使用本地词库；在线补译需单独开启。旧独立版文件和安装包保留用于兼容，首页统一提供合并版下载。

合并版采用 GPL-3.0-or-later，随包附带完整许可证；GitHub 设置词条来源与署名见 [GitHub 翻译说明](./docs/github.md)。
