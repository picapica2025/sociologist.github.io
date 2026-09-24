# Wang Guanxin — academic profile

轻量静态学术主页，公开内容来自已确认的履历。主域名为 [ghwsocio.social](https://ghwsocio.social/)，现有仓库为 `picapica2025/sociologist.github.io`。

## 本地维护

本次升级工作副本：`C:\Users\GHSoc\Documents\Codex\2026-07-31\wo\work\sociologist-site-upgrade`。

分支 `upgrade/maintenance-20260913` 从远端 `main` 的 `61abdf1` 建立。相邻的旧 `sociologist-site` 目录保留了原页面及未提交状态，后续编辑请使用本升级副本。两者共用 Git 对象库，不要手工删除或搬移 `.git` 文件。

使用 Node 24.8+；CI 使用 Node 24。首次安装：

```powershell
npm ci --ignore-scripts
npx --no-install playwright install chromium
npm run dev
```

打开 `http://127.0.0.1:4173` 预览。预览仅绑定本机回环地址，并且只提供公开文件清单中的内容。

## 验收

```powershell
npm run check:html
npm run build
$env:SITE_TEST_DIST = '1'
npm test
```

Windows 已安装 Edge 或 Chrome 时，可先设 `$env:PLAYWRIGHT_CHANNEL = 'msedge'` 或 `'chrome'`，无需额外下载 Chromium。若 4173 被其他应用占用，使用 `$env:SITE_TEST_PORT = '4188'` 为测试另选端口，不要停止无关应用。Linux CI 使用 `SITE_TEST_DIST=1 npm test`。测试包括七个屏宽、七栏展开互斥、快速反向动画、键盘与导航、无 JS、减少动画、实际打印文字以及公开资源。

测试报告位于 `playwright-report/index.html` 与 `test-results/results.json`；这些目录已被 Git 忽略。可用 `npx --no-install playwright show-report` 浏览报告。

`npm run build` 将 `scripts/public-files.mjs` 中列出的公开文件复制到 `dist/`。当前公开文件清单为八个文件（原六个文件加字体和授权文本）。构建会拒绝存在额外文件的旧构建目录；遇到该情况应使用干净工作副本，先检查额外文件，不要盲目递归删除。

### 复古字体与动画（2026-09-25）

- 标题使用自托管 EB Garamond 拉丁字符可变字体，正文保留系统无衬线字体；字体加载失败时回退至系统衬线字体。
- `assets/fonts/eb-garamond-latin.woff2` 来自 Google Fonts 官方 v33，44,336 字节，SHA-256 为 `88603384163d301aebd5bd769832a8bfe3c9004ec24178417b9817f0ad32c63b`。SIL OFL 1.1 原文随 `assets/fonts/OFL.txt` 一起分发；访客加载页面时不向 Google 请求字体。
- 字体来源：https://fonts.gstatic.com/s/ebgaramond/v33/SlGUmQSNjdsmc35JDF1K5GR1SDk.woff2；授权来源：https://github.com/google/fonts/blob/main/ofl/ebgaramond/OFL.txt。
- 动画包括一次性首屏进场、栏目展开/收起、正文短间隔淡入、导航下划线和编号标记；不使用无限循环动画。折叠包装层避免列表边框和内边距造成收起残高。减少动态、打印、无 JavaScript 回退仍须通过验收。
- 页面文字和履历事实未作修改。发布时须依照八文件公开清单，将字体与授权文本一并纳入；不得上传测试报告或完整维护源码。

## 内容与分享资源

- `index.html`：页面、样式、动画、Person 结构化数据和分享元数据。
- `assets/favicon.svg`：无姓名缩写的书页图标。
- `assets/social-card.svg`：可编辑的分享图源文件；`npm run assets` 将其渲染为 1200 × 630 PNG。修改姓名、机构或研究兴趣时需同步 SVG 并重新生成 PNG。
- `robots.txt`、`sitemap.xml` 与 `CNAME`：保持同一个主域名。
- 校验器仅豁免 `heading` role 的原生标题偏好规则；当前用于 summary 内标题。ARIA、结构和链接相关检查仍然启用。

## 发布流程

### 当前实际状态（2026-09-25）

最新公开发布提交为 `baed596`。`main` 仅保存八个公开文件，仍通过原有分支式 Pages 发布。完整维护源码位于远端 `upgrade/editorial-20260914`，本地跟踪分支为 `source/editorial-20260914`；不要将完整维护源码合并到 `main`。

本次发布从 `scripts/public-files.mjs` 生成八个公开文件，再以非强制推送更新 `main`。上线核对确认正式域名首页与 `baed596:index.html` 字节一致，GitHub Pages 备用地址跳转到正式域名，字体和授权文件均可读取。后续发布仍需先验收源码，再用公开文件清单生成发布提交、等待 Pages 完成，并检查两个域名入口。

下列手动 Actions 部署方案尚未启用；只有完成 Pages 设置迁移后才能按此运行。

1. 在干净分支上修改，先运行上述完整验收。使用常规 Git 提交与合并，避免再出现远端更新而本地引用长期落后的情况。
2. 首次启用本工作流前，确认 GitHub 仓库 **Settings → Pages → Build and deployment → Source** 已设为 **GitHub Actions**。若仍为旧的分支发布模式，推送 `main` 仍可能由旧流程直接上线，因此需要先核对设置。
3. `.github/workflows/site.yml` 在 PR 与 `main` 推送时执行质量检查。通过检查本身不会触发此工作流的部署。
4. 需要发布时，在 `main` 上手动运行 **Site quality and release**，将 `publish` 设为 true。部署依赖同一轮质量检查成功，且只上传已验收的 `dist/`。
5. 等待远端工作流成功后，对比源码、部署产物和线上内容；检查 HTTPS、`CNAME` 及 [GitHub Pages 备用地址](https://picapica2025.github.io/sociologist.github.io/) 的跳转。

本地准备好工作流不等于远端已经启用。启用、实际运行和线上验证需要在发布时分别确认。

参考：[Playwright CI](https://playwright.dev/docs/ci-intro)、[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[HTML-validate](https://html-validate.org/usage/)。
