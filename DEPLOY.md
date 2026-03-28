# 部署说明

这个项目是纯静态网页，不需要打包。把仓库推到 GitHub 后，可以直接部署到 GitHub Pages 或 Cloudflare Pages。

## 文件结构

需要一起部署的核心文件：

- `index.html`
- `styles.css`
- `script.js`
- `site.webmanifest`
- `sw.js`
- `icon.svg`

## 方式一：部署到 GitHub Pages

### 1. 创建仓库并推送代码

如果你还没有远程仓库，可以先在 GitHub 上新建一个仓库，例如 `breath-trainer`。

然后在本地仓库目录执行：

```bash
git add .
git commit -m "feat: add breathing trainer web app"
git branch -M main
git remote add origin https://github.com/你的用户名/breath-trainer.git
git push -u origin main
```

如果你已经配置过远程仓库，只需要：

```bash
git add .
git commit -m "update breathing trainer"
git push
```

### 2. 开启 GitHub Pages

1. 打开 GitHub 仓库页面
2. 进入 `Settings`
3. 找到左侧 `Pages`
4. 在 `Build and deployment` 中选择：
   `Source` -> `Deploy from a branch`
5. 选择：
   `Branch` -> `main`
   `Folder` -> `/ (root)`
6. 保存

几分钟后，GitHub 会生成一个公开地址，通常类似：

`https://你的用户名.github.io/breath-trainer/`

### 3. GitHub Pages 注意事项

- 这是静态站点，直接可用
- `site.webmanifest` 和 `sw.js` 也会随站点一起生效
- 如果你更新了缓存文件但手机还是旧版本，可以在 Safari 里下拉刷新一次

## 方式二：部署到 Cloudflare Pages

Cloudflare Pages 更适合手机端长期使用，速度通常也更稳定。

### 1. 先把代码推到 GitHub

先按上面的步骤把仓库推到 GitHub。

### 2. 在 Cloudflare Pages 中导入项目

1. 登录 Cloudflare
2. 进入 `Workers & Pages`
3. 点击 `Create application`
4. 选择 `Pages`
5. 选择 `Connect to Git`
6. 授权并选择你的 GitHub 仓库

### 3. 配置构建参数

这个项目是纯静态网页，推荐这样填：

- `Framework preset`: `None`
- `Build command`: 留空
- `Build output directory`: 留空，或者填 `.`
- `Root directory`: 留空

然后点击部署。

### 4. 自定义域名

如果你后面想用自己的域名：

1. 打开 Cloudflare Pages 项目
2. 进入 `Custom domains`
3. 添加你的域名
4. 按提示完成 DNS 配置

## iPhone 安装方式

部署完成后，在 iPhone 的 Safari 中打开网址：

1. 点击底部“分享”
2. 选择“添加到主屏幕”
3. 从主屏幕启动这个网页

这样会获得更接近 App 的体验：

- 独立启动
- 更贴合状态栏的显示
- 更稳定的全屏使用
- 离线缓存支持

## 更新后的刷新建议

因为项目启用了 `sw.js` 缓存，更新代码后如果你发现手机仍显示旧版本，可以这样处理：

1. 先关闭主屏幕中的网页
2. 重新打开
3. 如果还是旧版本，在页面内下拉刷新一次

如果你做了较大改动，也可以把 `sw.js` 里的缓存名从 `breath-loop-v1` 改成 `breath-loop-v2`，这样浏览器会更明确地拿新缓存。

## 锁屏提醒的现实限制

这个网页已经做了：

- 常亮保护按钮
- 主屏幕安装支持
- 离线缓存

但在 iPhone 上，真正锁屏黑屏后，Safari 或主屏网页仍可能被系统暂停。  
所以它适合“放在桌面/床头/冥想时保持页面常亮使用”，不适合要求完全系统级后台定时音频的场景。
