# 部署到 Cloudflare Pages

## 方法1: 通过 GitHub 部署（推荐）

### 步骤1: 推送到 GitHub
```bash
# 1. 在 GitHub 上创建新仓库 (https://github.com/new)
# 2. 仓库名建议: text-formatter
# 3. 添加远程仓库
git remote add origin https://github.com/YOUR_USERNAME/text-formatter.git

# 4. 推送代码
git branch -M main
git push -u origin main
```

### 步骤2: 连接 Cloudflare Pages
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 点击左侧菜单 "Pages"
3. 点击 "Create a project"
4. 选择 "Connect to Git"
5. 授权 GitHub 访问
6. 选择你的 text-formatter 仓库
7. 配置设置：
   - **Project name**: text-formatter
   - **Production branch**: main
   - **Build settings**:
     - Framework preset: None
     - Build command: (留空)
     - Build output directory: /
   - **Environment variables**: (无需设置)

8. 点击 "Save and Deploy"

### 步骤3: 自定义域名（可选）
1. 部署完成后，在 Pages 项目中点击 "Custom domains"
2. 添加你的域名 text-formatter.com
3. 按照提示配置 DNS 记录

## 方法2: 直接上传文件

### 使用 Wrangler CLI
```bash
# 1. 安装 Wrangler
npm install -g wrangler

# 2. 登录 Cloudflare
wrangler login

# 3. 创建 Pages 项目
wrangler pages project create text-formatter

# 4. 部署文件
wrangler pages deploy ./ --project-name=text-formatter
```

### 使用拖拽上传
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 点击 "Pages" → "Create a project"
3. 选择 "Upload assets"
4. 将所有项目文件拖拽到上传区域
5. 点击 "Deploy site"

## 方法3: 使用 GitHub Actions 自动部署

我已经为你准备了自动化部署配置文件。

## 验证部署

部署完成后，你的网站将可以通过以下地址访问：
- https://text-formatter.pages.dev
- 或你的自定义域名

## 更新网站

如果使用 GitHub 部署，只需要：
```bash
git add .
git commit -m "Update website"
git push
```

Cloudflare Pages 会自动重新部署你的网站。

## 域名配置

如果你有 text-formatter.com 域名：
1. 在 Cloudflare Pages 中添加自定义域名
2. 更新域名的 DNS 记录指向 Cloudflare
3. 启用 HTTPS（自动）

## 性能优化

Cloudflare Pages 会自动提供：
- 全球 CDN 加速
- 自动 HTTPS
- 自动图片优化
- 缓存优化

你的网站将在全球范围内快速加载！