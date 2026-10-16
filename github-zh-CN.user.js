// ==UserScript==
// @name         GitHub 翻译
// @namespace    github-zh-cn-local
// @version      1.0.0
// @description  本地翻译 GitHub 常用界面，保护代码、文件名和用户正文；可手动选中文字在线翻译。
// @match        https://github.com/*
// @run-at       document-idle
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      translate.googleapis.com
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';
  const KEY = 'github-zh-v1';
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const CODE_ROOT = 'pre,code,kbd,samp,.blob-wrapper,.js-file-content,.js-file-line-container,.react-code-view,.react-code-viewer,[data-testid="code-viewer"],[data-testid="code-editor"],[data-testid="file-content"],[data-testid="diff-view"],.diff-table,.diff-view,.file-diff,.CodeMirror,.cm-editor,.monaco-editor,.ace_editor,.highlight,[data-testid="log-viewer"],.js-check-log-line';
  const CODE_SKIP = CODE_ROOT + ',.blob-code,.blob-code-inner,.react-code-text,.react-code-line,.log-line,[data-testid="log-line"],[data-testid="code-cell"]';
  const CONTENT_SKIP = '.markdown-body,.comment-body,.js-comment-body,.markdown-title,.js-issue-title,.commit-title,.commit-message,.commit-desc,.js-commit-title,.release-title,.milestone-title,[data-testid="issue-title"],[data-testid="issue-pr-title"],[data-testid="issue-listitem-title-link"],[data-testid="discussion-title"],[data-testid="markdown-body"],[data-testid="comment-body"],[data-testid="commit-message"],[data-testid="release-title"]';
  const IDENTITY_SKIP = '.react-directory-filename-cell,.react-directory-row-name-cell-large-screen,.js-navigation-open,.branch-name,.commit-ref,.head-ref,.base-ref,.author,.user-mention,.team-mention,.IssueLabel,[data-testid="author-filter-link"],[data-testid="branch-name"],[data-testid="file-name"],[data-testid="file-name-cell"],[data-testid="repository-name"],[data-testid="user-name"],[data-testid="issue-label"],[data-testid="workflow-name"],[data-testid="job-name"],[data-testid="check-run-name"],[data-testid="release-tag"],[data-testid="project-title"],[data-testid="project-name"],a[href*="/releases/tag/"],[data-component="Breadcrumbs"],[itemprop="name"],[itemprop="author"],a[data-hovercard-type="user"],a[data-hovercard-type="organization"],a[data-hovercard-type="repository"],a[data-hovercard-type="issue"],a[data-hovercard-type="pull_request"]';
  const EDITABLE = 'input,textarea,select,[role="textbox"],[contenteditable]:not([contenteditable="false"])';
  const SKIP = 'script,style,noscript,svg,canvas,iframe,[translate="no"],[data-github-zh],' + CODE_SKIP + ',' + CONTENT_SKIP + ',' + IDENTITY_SKIP + ',[contenteditable]:not([contenteditable="false"])';
  const TEXT_SKIP = SKIP + ',input,textarea,select,[role="textbox"]';
  const RESERVED = new Set('features enterprise pricing solutions resources customer-stories security sponsors settings organizations orgs users login signup logout account new notifications dashboard issues pulls discussions projects marketplace explore topics trending collections search copilot codespaces sessions site about contact apps readme'.split(' '));
  const originals = new Map();
  const roots = new Set();
  const scanTasks = [];
  const attributeJobs = new Map();
  const localCache = new Map();
  let scanTimer = 0;
  let needsPrune = false;
  let host;
  let ui;
  let busy = false;
  let requestId = 0;
  let settings = { enabled: true };
  try { settings = { ...settings, ...GM_getValue(KEY + '-settings', {}) }; } catch { /* 存储受限不影响本地翻译。 */ }

  const WORDS = new Map();
  function normalize(text) {
    return text.normalize('NFKC').replace(/[’‘]/g, "'").replace(/[‐‑‒–—−]/g, '-').replace(/\s*&\s*/g, ' & ').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  const dictionary = `
Home|Homepage|首页
Dashboard|仪表盘
Overview|概览
Code|代码
Issues|议题
Issue|议题
Pull requests|拉取请求
Pull request|拉取请求
Actions|自动化
Projects|项目
Project|项目
Wiki|维基
Security|安全
Security and quality|Security & quality|安全与质量
Insights|统计
Settings|设置
Repositories|仓库
Repository|仓库
Your repositories|你的仓库
Your organizations|你的组织
Organizations|组织
Organization|组织
Your profile|你的个人资料
Profile|个人资料
Your stars|你的星标
Stars|星标
Gists|代码片段
Your gists|你的代码片段
Your projects|你的项目
Followers|关注者
Following|正在关注
Achievements|成就
Activity|动态
Explore|探索
Explore repositories|探索仓库
Trending|趋势
Topics|主题
Collections|专题
Marketplace|应用市场
Notifications|通知
Inbox|收件箱
Unread|未读
Done|完成
Saved|已保存
Subscriptions|订阅
All activity|全部动态
Participating|参与的讨论
Mark as read|标记为已读
Mark all as read|全部标记为已读
Unsubscribe|取消订阅
Subscribe|订阅
Watch|关注
Unwatch|取消关注
Watching|正在关注
Not watching|未关注
Ignoring|已忽略
Custom|自定义
Star|加星
Starred|已加星
Unstar|取消星标
Fork|复刻
Forks|复刻
Forked from|复刻自
Create a new fork|创建新复刻
Sponsor|赞助
Sponsors|赞助者
Sponsoring|正在赞助
Public|公开
Private|私有
Internal|内部
Public repository|公开仓库
Private repository|私有仓库
Archived|已归档
Template|模板
Use this template|使用此模板
Generate a new repository|生成新仓库
Create repository|创建仓库
Create a new repository|创建新仓库
New repository|新建仓库
New organization|新建组织
New project|新建项目
Import repository|导入仓库
Import a repository|导入仓库
Repository name|仓库名称
Owner|所有者
Description|描述
About|关于
Website|网站
Add a description|添加描述
Edit repository details|编辑仓库详情
Visibility|可见性
Choose visibility|选择可见性
Choose an owner|选择所有者
Choose a license|选择许可证
Add a README file|添加 README 文件
Add .gitignore|添加 .gitignore
Copy|复制
Copied!|Copied|已复制
Copy to clipboard|复制到剪贴板
Go to file|转到文件
Add file|添加文件
Create new file|创建新文件
Upload files|上传文件
Upload file|上传文件
Delete file|删除文件
Edit file|编辑文件
Edit this file|编辑此文件
Delete this file|删除此文件
Download|下载
Download ZIP|下载 ZIP
Download raw file|下载原始文件
Download file|下载文件
Raw|原始文件
Blame|逐行追溯
History|历史记录
Permalink|永久链接
Copy permalink|复制永久链接
View file|查看文件
View raw|查看原始文件
View blame|查看逐行追溯
Open in github.dev|在 github.dev 中打开
Open in a codespace|在云端开发空间中打开
Open with GitHub Desktop|使用 GitHub Desktop 打开
Local|本地
Clone|克隆
Clone repository|克隆仓库
Clone using the web URL.|使用网页地址克隆。
Codespaces|云端开发空间
Create codespace|创建云端开发空间
Create codespace on main|在 main 分支创建开发空间
Branches|分支
Branch|分支
Tags|标签
Tag|标签
Switch branches/tags|切换分支或标签
Switch branches or tags|切换分支或标签
Find a branch|查找分支
Find or create a branch|查找或创建分支
Find a tag|查找标签
New branch|新建分支
Create branch|创建分支
View all branches|查看全部分支
View all tags|查看全部标签
Default|默认
Default branch|默认分支
Active branches|活跃分支
Stale branches|不活跃分支
Compare|比较
Compare & pull request|比较并创建拉取请求
Compare changes|比较更改
Comparing changes|正在比较更改
Choose branches|选择分支
Choose a base branch|选择基准分支
Choose a head branch|选择来源分支
base:|基准：
compare:|比较：
Commits|提交记录
Commit|提交
Latest commit|最新提交
Initial commit|初始提交
Commit history|提交历史
Commit changes|提交更改
Commit changes...|提交更改…
Commit message|提交说明
Extended description|补充说明
Propose changes|提议更改
Cancel changes|取消更改
Changes|更改
Changed files|已更改文件
Files changed|文件更改
Files|文件
File|文件
Code review|代码审查
Diff|差异
Unified|合并视图
Split|分栏视图
Show diff|显示差异
Hide diff|隐藏差异
Hide whitespace|忽略空白差异
Show whitespace|显示空白差异
Load diff|加载差异
Load more|加载更多
Show more|显示更多
Show less|收起
View more|查看更多
View all|查看全部
Show all|显示全部
Expand all|全部展开
Collapse all|全部折叠
Expand|展开
Collapse|折叠
Releases|版本发布
Release|发布版本
Latest|最新
Pre-release|预发布
Draft|草稿
Draft a new release|起草新版本
Create a new release|创建新版本
Create release|创建版本
Publish release|发布版本
Save draft|保存草稿
Edit release|编辑版本
Delete release|删除版本
Release title|版本标题
Choose a tag|选择标签
Target|目标
Generate release notes|生成版本说明
Release notes|版本说明
Assets|附件
Source code|源代码
Source code (zip)|源代码（ZIP）
Source code (tar.gz)|源代码（tar.gz）
No releases published|尚未发布版本
Create a new release|创建新版本
Packages|软件包
Package|软件包
No packages published|尚未发布软件包
Publish your first package|发布首个软件包
Deployments|部署
Environments|环境
Environment|环境
Contributors|贡献者
Contribute|参与贡献
Contributing|贡献指南
Languages|语言
License|许可证
Licenses|许可证
Readme|README 说明
Code of conduct|行为准则
New issue|新建议题
Create issue|创建议题
Create an issue|创建议题
Issue templates|议题模板
New pull request|新建拉取请求
Create pull request|创建拉取请求
Create a pull request|创建拉取请求
Open|未关闭
Opened|已创建
Closed|已关闭
Merged|已合并
Open issues|未关闭议题
Closed issues|已关闭议题
Open pull requests|未关闭拉取请求
Closed pull requests|已关闭拉取请求
Close issue|关闭议题
Close as completed|标记为已完成并关闭
Close as not planned|标记为不计划处理并关闭
Reopen issue|重新打开议题
Reopen|重新打开
Close pull request|关闭拉取请求
Reopen pull request|重新打开拉取请求
Comment|评论
Comments|评论
Write|编写
Preview|预览
Write a comment|撰写评论
Leave a comment|发表评论
Add a comment|添加评论
Comment and close|评论并关闭
Close with comment|评论并关闭
Update comment|更新评论
Edit|编辑
Delete|删除
Reply|回复
Quote reply|引用回复
Quote|引用
Copy link|复制链接
Copy link to discussion|复制讨论链接
Add a reaction|添加回应
Edit title|编辑标题
Edit issue title|编辑议题标题
Edit pull request title|编辑拉取请求标题
Title|标题
Add a title|添加标题
Body|正文
Assignees|负责人
Assignee|负责人
Assign yourself|指派给自己
Assign to|指派给
No one assigned|尚未指派
Unassigned|未指派
Labels|标签
Label|标签
Edit labels|编辑标签
New label|新建标签
Milestones|里程碑
Milestone|里程碑
No milestone|无里程碑
No labels|无标签
None yet|暂无
Development|开发关联
Linked pull requests|关联的拉取请求
Participants|参与者
Participant|参与者
Lock conversation|锁定讨论
Unlock conversation|解锁讨论
Pin issue|置顶议题
Unpin issue|取消置顶
Transfer issue|转移议题
Delete issue|删除议题
Mark as duplicate|标记为重复
Convert to discussion|转为讨论
Discussions|讨论
Discussion|讨论
New discussion|新建讨论
Start a discussion|发起讨论
Categories|分类
Category|分类
Answered|已回答
Unanswered|未回答
Mark as answer|标记为答案
Unmark as answer|取消答案标记
Sort by|排序方式
Sort|排序
Filter|筛选
Filters|筛选
Clear|清除
Clear filters|清除筛选
Clear current search query, filters, and sorts|清除当前搜索、筛选和排序
Search issues|搜索议题
Search pull requests|搜索拉取请求
Search all issues|搜索全部议题
Search all pull requests|搜索全部拉取请求
Search discussions|搜索讨论
Search repositories|搜索仓库
Search or jump to...|搜索或跳转…
Search or jump to…|搜索或跳转…
Search or jump to, type / to search|搜索或跳转，按 / 开始搜索
Type / to search|按 / 搜索
Search|搜索
Search GitHub|搜索 GitHub
Saved searches|已保存搜索
Advanced search|高级搜索
Search syntax tips|搜索语法提示
Search code, repositories, users, issues, pull requests...|搜索代码、仓库、用户、议题或拉取请求…
No results found|未找到结果
No results|无结果
Filter by author|按作者筛选
Filter by assignee|按负责人筛选
Filter by label|按标签筛选
Author|作者
Newest|最新
Oldest|最早
Most commented|评论最多
Least commented|评论最少
Recently updated|最近更新
Least recently updated|最久未更新
Best match|最佳匹配
Most stars|星标最多
Fewest stars|星标最少
Most forks|复刻最多
Fewest forks|复刻最少
Best practices|最佳实践
Conversation|讨论记录
Review changes|审查更改
Review requested|已请求审查
Reviews|审查
Reviewers|审查者
Request review|请求审查
Request changes|请求更改
Approve|批准
Approved|已批准
Changes requested|已请求更改
Pending|待处理
Pending review|待提交审查
Start a review|开始审查
Submit review|提交审查
Add single comment|添加单条评论
Finish your review|完成审查
Resolve conversation|解决讨论
Unresolve conversation|重新打开讨论
Resolved|已解决
Unresolved|未解决
Viewed|已查看
Mark as viewed|标记为已查看
Changes since last review|上次审查后的更改
Merge pull request|合并拉取请求
Squash and merge|压缩提交并合并
Rebase and merge|变基并合并
Confirm merge|确认合并
Delete branch|删除分支
Restore branch|恢复分支
Update branch|更新分支
Convert to draft|转为草稿
Ready for review|准备接受审查
Mark as ready for review|标记为可审查
Allow edits by maintainers|允许维护者编辑
Checks|检查
All checks have passed|全部检查已通过
Some checks were not successful|部分检查未通过
No conflicts with base branch|与基准分支无冲突
This branch has conflicts that must be resolved|此分支存在需要解决的冲突
Resolve conflicts|解决冲突
Workflow|工作流
Workflows|工作流
All workflows|全部工作流
Workflow runs|工作流运行
Run workflow|运行工作流
Run details|运行详情
Summary|摘要
Jobs|作业
Job|作业
Steps|步骤
Step|步骤
Logs|日志
View logs|查看日志
Download logs|下载日志
Search logs|搜索日志
Artifacts|构建产物
Artifact|构建产物
Annotations|注释
Usage|用量
Runners|运行器
Runner|运行器
Self-hosted runners|自托管运行器
Hosted runners|托管运行器
Re-run jobs|重新运行作业
Re-run all jobs|重新运行全部作业
Re-run failed jobs|重新运行失败作业
Cancel workflow|取消工作流
Cancel workflow run|取消工作流运行
Delete workflow run|删除工作流运行
Enable workflow|启用工作流
Disable workflow|禁用工作流
Success|成功
Successful|成功
Failure|失败
Failed|失败
In progress|进行中
Queued|已排队
Waiting|等待中
Completed|已完成
Cancelled|已取消
Canceled|已取消
Skipped|已跳过
Timed out|已超时
Status|状态
Conclusion|结果
Triggered by|触发来源
Event|事件
Duration|耗时
Started|开始时间
Finished|结束时间
General|常规
Access|访问权限
Collaborators|协作者
Collaborators and teams|协作者和团队
Manage access|管理访问权限
Manage|管理
Invite a collaborator|邀请协作者
Add people|添加人员
Invite member|邀请成员
Teams|团队
Members|成员
People|人员
Roles|角色
Permissions|权限
Read|读取
Triage|分流
Maintain|维护
Admin|管理员
Rules|规则
Rulesets|规则集
Branch protection rules|分支保护规则
Branch protection|分支保护
Protected branches|受保护分支
Add rule|添加规则
New ruleset|新建规则集
Default permissions|默认权限
Workflow permissions|工作流权限
Actions permissions|自动化权限
Secrets and variables|机密与变量
Secrets|机密
Variables|变量
Repository secrets|仓库机密
Environment secrets|环境机密
Organization secrets|组织机密
New repository secret|新建仓库机密
New repository variable|新建仓库变量
Update secret|更新机密
Secret|机密
Variable|变量
Name|名称
Value|值
Deploy keys|部署密钥
Add deploy key|添加部署密钥
Webhooks|Webhook
Add webhook|添加 Webhook
Pages|网页托管
Build and deployment|构建与部署
Build and deployment source|构建与部署来源
Deploy from a branch|从分支部署
Custom domain|自定义域名
Enforce HTTPS|强制 HTTPS
Code and automation|代码与自动化
Security analysis|安全分析
Code security|代码安全
Code security and analysis|代码安全与分析
Secret scanning|机密扫描
Dependabot alerts|Dependabot 警报
Dependabot security updates|Dependabot 安全更新
Code scanning|代码扫描
Security policy|安全策略
Security advisories|安全公告
Report a vulnerability|报告漏洞
Private vulnerability reporting|私密漏洞报告
Advanced Security|高级安全
Danger Zone|危险操作区
Change repository visibility|更改仓库可见性
Transfer ownership|转移所有权
Archive this repository|归档此仓库
Unarchive this repository|取消归档
Delete this repository|删除此仓库
Rename|重命名
Rename repository|重命名仓库
Features|功能
Merge button|合并按钮
Pull Requests|拉取请求
Automatically delete head branches|自动删除来源分支
Automatically merge pull requests|自动合并拉取请求
Allow auto-merge|允许自动合并
Social preview|社交分享预览
Template repository|模板仓库
Discussions settings|讨论设置
Account|账户
Account settings|账户设置
Public profile|公开资料
Personal settings|个人设置
Appearance|外观
Accessibility|无障碍
Notifications settings|通知设置
Emails|邮箱
Password and authentication|密码与身份验证
Sessions|会话
SSH and GPG keys|SSH 与 GPG 密钥
SSH keys|SSH 密钥
New SSH key|新建 SSH 密钥
GPG keys|GPG 密钥
New GPG key|新建 GPG 密钥
Developer settings|开发者设置
Personal access tokens|个人访问令牌
Fine-grained tokens|细粒度令牌
Tokens (classic)|传统令牌
Generate new token|生成新令牌
OAuth Apps|OAuth 应用
GitHub Apps|GitHub 应用
Authorized OAuth Apps|已授权的 OAuth 应用
Applications|应用
Integrations|集成
Billing and licensing|账单与许可
Billing and plans|账单与方案
Billing|账单
Plans|方案
Upgrade|升级
Upgrade plan|升级方案
Payment information|支付信息
Saved replies|已保存回复
Blocked users|已屏蔽用户
Delete account|删除账户
Sign in|Log in|登录
Sign up|注册
Sign out|Log out|退出登录
Switch account|切换账户
Username|用户名
Email address|电子邮箱
Password|密码
Forgot password?|忘记密码？
Remember me|记住我
Create an account|创建账户
Verify|验证
Verified|已验证
Unverified|未验证
Two-factor authentication|双重身份验证
Passkeys|通行密钥
Recovery codes|恢复代码
Save|保存
Save changes|保存更改
Cancel|取消
Confirm|确认
Continue|继续
Next|下一步
Previous|上一步
Back|返回
Close|关闭
Open menu|打开菜单
More|更多
More options|更多选项
More actions|更多操作
More file actions|更多文件操作
Copy path|复制路径
Copy file path|复制文件路径
Select all|全选
Deselect all|取消全选
Select|选择
Selected|已选择
None|无
All|全部
Yes|是
No|否
Enable|启用
Disable|禁用
Enabled|已启用
Disabled|已禁用
Add|添加
Remove|移除
Update|更新
Create|创建
Apply|应用
Reset|重置
Refresh|刷新
Retry|重试
Try again|重试
Loading|加载中
Loading...|正在加载…
Loading…|正在加载…
Something went wrong|出现错误
There was an error|出现错误
Dismiss|关闭提示
Dismiss this message|关闭此提示
You signed in with another tab or window.|你已在其他标签页或窗口登录。
You signed out in another tab or window.|你已在其他标签页或窗口退出登录。
Reload to refresh your session.|重新加载以刷新会话。
You must be signed in to fork a repository|登录后才能复刻仓库
You must be signed in to star a repository|登录后才能为仓库加星
Navigation Menu|导航菜单
Toggle navigation|切换导航
Close navigation menu|关闭导航菜单
Global navigation menu|全局导航菜单
Repository navigation|仓库导航
Breadcrumbs|面包屑导航
Global|全局
Skip to content|跳转到内容
Toggle theme|切换主题
Switch to dark theme|切换为深色主题
Switch to light theme|切换为浅色主题
Light|浅色
Dark|深色
System|跟随系统
Use system setting|跟随系统设置
Help|帮助
Support|支持
Customer support|客户支持
Contact|联系
Contact GitHub|联系 GitHub
Documentation|文档
Docs|文档
Blog|博客
Changelog|更新日志
Pricing|价格方案
Enterprise|企业版
Solutions|解决方案
Resources|资源
Community|社区
Terms|条款
Privacy|隐私
Terms of Service|服务条款
Privacy Statement|隐私声明
Cookie settings|Cookie 设置
Manage cookies|管理 Cookie
Do not share my personal information|不共享我的个人信息
Status page|服务状态
Join GitHub|加入 GitHub
View organization|查看组织
Create a gist|创建代码片段
New gist|新建代码片段
Discover|发现
Follow|关注
Unfollow|取消关注
Edit profile|编辑资料
Set status|设置状态
Set a status|设置状态
Clear status|清除状态
Contribution activity|贡献动态
Contribution settings|贡献设置
Popular repositories|热门仓库
Pinned|已置顶
Customize your pins|自定义置顶
Show more activity|显示更多动态
Suggested for you|为你推荐
Recent activity|最近动态
README|README 说明
`;
  for (const line of dictionary.trim().split('\n')) {
    const parts = line.split('|'); const zh = parts.pop();
    for (const word of parts) WORDS.set(normalize(word), zh);
  }
  function local(text) {
    if (localCache.has(text)) return localCache.get(text);
    const key = normalize(text);
    let result = WORDS.get(key) || null;
    const colon = key.match(/^(.*?):$/);
    if (!result && colon && WORDS.has(colon[1])) result = WORDS.get(colon[1]) + '：';
    const count = key.match(/^(\d[\d,.]*[km]?\+?)\s+(issues?|pull requests?|commits?|branches|tags?|releases?|files?|comments?|contributors?|forks?|stars?|open|closed|merged)$/);
    if (!result && count && WORDS.has(count[2])) result = count[1] + ' ' + WORDS.get(count[2]);
    const suffix = key.match(/^(.+?)\s+(\d[\d,.]*[km]?\+?)$/);
    if (!result && suffix && WORDS.has(suffix[1])) result = WORDS.get(suffix[1]) + ' ' + suffix[2];
    if (localCache.size >= 3000) localCache.clear();
    localCache.set(text, result);
    return result;
  }

  function identityLink(el) {
    const link = el.closest('a[href]');
    if (!link || link.matches('[data-tab-item],[role="tab"]') || link.closest('.UnderlineNav,.tabnav')) return false;
    let url;
    try { url = new URL(link.getAttribute('href'), location.href); } catch { return false; }
    if (url.hostname !== 'github.com') return false;
    const parts = url.pathname.split('/').filter(Boolean);
    if (/\/projects\/\d+(\/|$)/.test(url.pathname)) return !link.matches('.btn,[role="button"]');
    if (parts.length >= 3 && ['blob', 'tree', 'commit', 'milestone'].includes(parts[2])) {
      // 文件行和代码引用优先保留；明确的文件操作按钮仍可翻译。
      return !link.matches('.btn,[role="button"],[data-testid="raw-button"],[data-testid="edit-button"]');
    }
    if (parts.length >= 4 && ['issues', 'pull', 'discussions'].includes(parts[2]) && /^\d+$/.test(parts[3])) {
      return !link.matches('.btn,[role="button"]');
    }
    if (parts.length === 2 && !RESERVED.has(parts[0].toLowerCase())) return true;
    try {
      return parts.length === 1 && !RESERVED.has(parts[0].toLowerCase()) && normalize(link.textContent) === normalize(decodeURIComponent(parts[0]));
    } catch { return true; }
  }
  function translate(node, attr = null) {
    const value = attr ? node.getAttribute(attr) : node.nodeValue;
    if (!value || value.length > 1000 || !/[a-zA-Z]/.test(value)) return;
    if (originals.get(node)?.get(attr || '')?.output === value) return;
    const zh = local(value.trim());
    if (!zh) return;
    const el = attr ? node : node.parentElement;
    if (!el || el.closest(attr ? SKIP : TEXT_SKIP) || identityLink(el)) return;
    put(entryFor(node, attr), zh);
  }

  function current(entry) { return entry.attr ? entry.node.getAttribute(entry.attr) : entry.node.nodeValue; }
  function connected(entry) { return entry.node.isConnected; }
  function put(entry, translated) {
    if (!settings.enabled || !connected(entry) || current(entry) !== entry.source) return;
    const before = entry.source.match(/^\s*/)[0];
    const after = entry.source.match(/\s*$/)[0];
    entry.output = before + translated + after;
    if (entry.attr) entry.node.setAttribute(entry.attr, entry.output);
    else entry.node.nodeValue = entry.output;
  }
  function entryFor(node, attr) {
    let fields = originals.get(node);
    if (!fields) { fields = new Map(); originals.set(node, fields); }
    const key = attr || '';
    const value = attr ? node.getAttribute(attr) : node.nodeValue;
    let entry = fields.get(key);
    // 框架复用节点后，重新记录新的原文。
    if (!entry || (value !== entry.output && value !== entry.source)) {
      entry = { node, attr, source: value, output: null };
      fields.set(key, entry);
    }
    return entry;
  }
  function* scan(root) {
    if (!settings.enabled || !root?.isConnected) return;
    if (root.nodeType === Node.TEXT_NODE) { translate(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(SKIP)) return;
    function attributes(el) {
      for (const name of ATTRS) if (el.hasAttribute(name)) translate(el, name);
    }
    attributes(root);
    yield;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches(SKIP)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) translate(node);
      else attributes(node);
      yield;
    }
  }
  function schedule(root) {
    if (!settings.enabled || !root?.isConnected) return;
    if (root.nodeType === Node.TEXT_NODE && !/[a-zA-Z]/.test(root.nodeValue || '')) return;
    roots.add(root);
    requestScan();
  }
  function requestScan() {
    if (!scanTimer) scanTimer = setTimeout(flushScans, 16);
  }
  function scheduleAttribute(el, name) {
    if (!settings.enabled || !el.isConnected) return;
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
    if (!settings.enabled) return;
    const batch = new Set(roots); roots.clear();
    for (const root of batch) {
      // 沿祖先链查重，避免变动数量增加时出现两两比较。
      let parent = root.parentNode;
      while (parent && !batch.has(parent)) parent = parent.parentNode;
      if (!parent && root.isConnected) scanTasks.push({ root, iterator: scan(root) });
    }
    for (const [el, names] of attributeJobs) {
      scanTasks.push({ root: el, iterator: scanAttributes(el, names) });
    }
    attributeJobs.clear();
    const end = performance.now() + 5;
    let steps = 0;
    while (scanTasks.length && steps++ < 240 && performance.now() < end) {
      const task = scanTasks[scanTasks.length - 1];
      if (!task.root.isConnected || task.iterator.next().done) scanTasks.pop();
    }
    // 新弹窗优先于尚未完成的大列表；每批让出主线程，留出点击和绘制时间。
    if (roots.size || attributeJobs.size || scanTasks.length) requestScan();
  }
  function* prune() {
    for (const [node, fields] of originals) {
      if (!node.isConnected) { originals.delete(node); yield; continue; }
      for (const [key, entry] of fields) {
        const value = current(entry);
        if (value !== entry.source && value !== entry.output) fields.delete(key);
      }
      yield;
    }
  }

  function restore() {
    for (const fields of originals.values()) for (const entry of fields.values()) {
      if (!connected(entry) || current(entry) !== entry.output) continue;
      if (entry.attr) entry.node.setAttribute(entry.attr, entry.source);
      else entry.node.nodeValue = entry.source;
    }
    originals.clear();
  }
  function request(text) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=' + encodeURIComponent(text),
        timeout: 12000,
        anonymous: true,
        onload(response) {
          if (response.status !== 200) { reject(new Error('HTTP ' + response.status)); return; }
          try {
            const data = JSON.parse(response.responseText);
            if (!Array.isArray(data[0])) throw new Error('响应格式不正确');
            const result = data[0].map(part => typeof part?.[0] === 'string' ? part[0] : '').join('').trim();
            if (!result) throw new Error('翻译结果为空');
            resolve(result);
          } catch (error) { reject(error); }
        },
        onerror: () => reject(new Error('网络连接失败')),
        ontimeout: () => reject(new Error('连接超时')),
        onabort: () => reject(new Error('请求已取消')),
      });
    });
  }

  function resetScans() {
    clearTimeout(scanTimer); scanTimer = 0;
    roots.clear(); attributeJobs.clear(); scanTasks.length = 0;
  }
  function toggle() {
    resetScans(); restore(); settings.enabled = !settings.enabled;
    try { GM_setValue(KEY + '-settings', settings); } catch { /* 当前页面仍可使用。 */ }
    refreshUI();
    if (settings.enabled) schedule(document.body);
  }
  function refreshUI() {
    if (!ui) return;
    ui.toggle.textContent = settings.enabled ? '显示英文原文' : '恢复中文界面';
    ui.status.textContent = settings.enabled ? '界面词库已启用 · 正文与代码保留原文' : '已显示英文原文';
    ui.selection.disabled = busy;
    ui.selection.textContent = busy ? '正在翻译所选文字…' : '翻译选中文字（在线）';
  }
  function selectedText() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return '';
    const range = selection.getRangeAt(0);
    const text = range.toString().trim();
    if (!text) return '';
    if (text.length > 1500) throw new Error('每次请选择不超过 1500 个字符，可分段翻译。');
    const root = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (!root || root.closest(CODE_SKIP + ',' + EDITABLE + ',[data-github-zh]')) throw new Error('请选择 README 或讨论中的说明文字；代码区和输入框保持原文。');
    for (const node of root.querySelectorAll(CODE_ROOT + ',' + EDITABLE)) {
      if (range.intersectsNode(node)) throw new Error('所选范围包含代码或输入区域，请只选择需要翻译的正文。');
    }
    return text;
  }
  async function translateSelection() {
    if (busy) return;
    let text;
    try { text = selectedText(); } catch (error) { ui.result.textContent = error.message; return; }
    if (!text) { ui.result.textContent = '请先在 README 或讨论正文中选中文字，再点击此按钮或使用篡改猴菜单。'; return; }
    const ok = window.confirm('将以下选中文字发送至 Google 翻译，需要能访问 Google 翻译服务。不会自动上传整页，结果仅显示在助手面板中。\n\n原文预览：\n' + text.slice(0, 240) + (text.length > 240 ? '…' : '') + '\n\n是否继续？');
    if (!ok) return;
    host.shadowRoot.querySelector('details').open = true;
    const id = ++requestId;
    busy = true; ui.result.textContent = '正在翻译…'; refreshUI();
    try {
      const result = await request(text);
      if (id === requestId) ui.result.textContent = result;
    } catch {
      if (id === requestId) ui.result.textContent = '在线翻译失败，请检查 Google 翻译连接后重试。本地界面词库仍可使用。';
    } finally {
      if (id === requestId) { busy = false; refreshUI(); }
    }
  }
  function panel() {
    host = document.createElement('div'); host.setAttribute('data-github-zh', 'panel');
    host.style.cssText = 'position:fixed;right:16px;bottom:24px;z-index:2147483647';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      :host{all:initial;font:13px/1.6 system-ui,"Microsoft YaHei",sans-serif;color:#f5f5f5}
      details{width:270px;max-height:75vh;overflow:auto;background:#202124;border:1px solid #62656b;border-radius:12px;box-shadow:0 4px 20px #0005}
      details:not([open]){width:auto}summary{cursor:pointer;list-style:none;padding:9px 14px;font-weight:600}.body{padding:0 12px 12px}
      button{display:block;width:100%;margin-top:7px;padding:7px;border:1px solid #6c7077;border-radius:6px;background:#303238;color:#fff;cursor:pointer;font:inherit;text-align:left}button:hover{background:#44474f}button:disabled{opacity:.6;cursor:wait}
      p{margin:4px 0;color:#d1d5db;font-size:12px}#result{white-space:pre-wrap;overflow-wrap:anywhere;margin-top:10px;user-select:text;font-size:13px;color:#fff}
      @media(max-width:480px){details{width:245px}}
    </style><details><summary>中 / EN · GitHub 翻译</summary><div class="body">
      <p id="status" role="status"></p><button id="toggle"></button><button id="rescan">重新扫描界面</button>
      <button id="selection"></button><button id="clear">清空翻译结果</button><div id="result" role="status"></div>
      <p>界面翻译在本地完成。在线翻译仅发送你确认选中的文字，结果不改写仓库正文、不保存到缓存。</p>
    </div></details>`;
    ui = Object.fromEntries(['status', 'toggle', 'rescan', 'selection', 'clear', 'result'].map(id => [id, shadow.getElementById(id)]));
    ui.toggle.onclick = toggle;
    ui.rescan.onclick = () => { resetScans(); schedule(document.body); };
    ui.selection.onclick = translateSelection;
    ui.clear.onclick = () => { requestId++; busy = false; ui.result.textContent = ''; refreshUI(); };
    document.body.append(host); refreshUI();
  }
  function start() {
    panel();
    const observer = new MutationObserver(records => {
      if (!settings.enabled) return;
      for (const record of records) {
        if (record.type === 'characterData' || record.type === 'attributes') {
          const entry = originals.get(record.target)?.get(record.attributeName || '');
          if (entry && current(entry) === entry.output) continue;
          if (record.type === 'attributes' && ATTRS.includes(record.attributeName)) scheduleAttribute(record.target, record.attributeName);
          else schedule(record.target);
        } else {
          for (const node of record.addedNodes) schedule(node);
          if (record.removedNodes.length) needsPrune = true;
        }
      }
    });
    observer.observe(document.body, { subtree:true,childList:true,characterData:true,attributes:true,
      attributeFilter:[...ATTRS,'href','hidden','data-testid'] });
    schedule(document.body);
    setInterval(() => {
      if (needsPrune && settings.enabled) {
        needsPrune = false; scanTasks.push({ root:document.body,iterator:prune() }); requestScan();
      }
    }, 30000);
    // 代码行选择会改变 #L... 锚点，不应触发整页恢复与翻译。
    let url = location.pathname + location.search;
    function navigation(force = false) {
      const next = location.pathname + location.search;
      if (force || url !== next) {
        url = next; resetScans(); restore(); schedule(document.body);
      }
    }
    document.addEventListener('turbo:load', () => navigation(true));
    document.addEventListener('pjax:end', () => navigation(true));
    setInterval(navigation, 1500);
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('中文 / 英文界面切换', toggle);
      GM_registerMenuCommand('重新扫描界面', () => { resetScans(); schedule(document.body); });
      GM_registerMenuCommand('翻译选中文字（在线）', translateSelection);
    }
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once:true });
})();
