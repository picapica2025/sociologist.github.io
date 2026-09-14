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

Windows 已安装 Edge 时，可先设 `$env:PLAYWRIGHT_CHANNEL = 'msedge'`，无需额外下载 Chromium。Linux CI 使用 `SITE_TEST_DIST=1 npm test`。测试包括四个屏宽、七栏展开互斥、快速反向动画、键盘与导航、无 JS、减少动画、实际打印文字以及公开资源。

测试报告位于 `playwright-report/index.html` 与 `test-results/results.json`；这些目录已被 Git 忽略。可用 `npx --no-install playwright show-report` 浏览报告。

`npm run build` 将 `scripts/public-files.mjs` 中列出的六个公开文件复制到 `dist/`。它会拒绝存在额外文件的旧构建目录；遇到该情况应使用干净工作副本，先检查额外文件，不要盲目递归删除。

## 内容与分享资源

- `index.html`：页面、样式、动画、Person 结构化数据和分享元数据。
- `assets/favicon.svg`：无姓名缩写的书页图标。
- `assets/social-card.svg`：可编辑的分享图源文件；`npm run assets` 将其渲染为 1200 × 630 PNG。修改姓名、机构或研究兴趣时需同步 SVG 并重新生成 PNG。
- `robots.txt`、`sitemap.xml` 与 `CNAME`：保持同一个主域名。
- 校验器仅豁免 `heading` role 的原生标题偏好规则；当前用于 summary 内标题。ARIA、结构和链接相关检查仍然启用。

## 发布流程

1. 在干净分支上修改，先运行上述完整验收。使用常规 Git 提交与合并，避免再出现远端更新而本地引用长期落后的情况。
2. 首次启用本工作流前，确认 GitHub 仓库 **Settings → Pages → Build and deployment → Source** 已设为 **GitHub Actions**。若仍为旧的分支发布模式，推送 `main` 仍可能由旧流程直接上线，因此需要先核对设置。
3. `.github/workflows/site.yml` 在 PR 与 `main` 推送时执行质量检查。通过检查本身不会触发此工作流的部署。
4. 需要发布时，在 `main` 上手动运行 **Site quality and release**，将 `publish` 设为 true。部署依赖同一轮质量检查成功，且只上传已验收的 `dist/`。
5. 等待远端工作流成功后，对比源码、部署产物和线上内容；检查 HTTPS、`CNAME` 及 [GitHub Pages 备用地址](https://picapica2025.github.io/sociologist.github.io/) 的跳转。

本地准备好工作流不等于远端已经启用。启用、实际运行和线上验证需要在发布时分别确认。

参考：[Playwright CI](https://playwright.dev/docs/ci-intro)、[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[HTML-validate](https://html-validate.org/usage/)。
