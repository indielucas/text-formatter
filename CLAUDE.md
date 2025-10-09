# Claude Code 项目配置

## 部署偏好设置

### Cloudflare Pages 部署
当用户说"提交到 cloudflare pages"或"部署到 cloudflare"时，默认使用 **wrangler CLI** 进行直接部署，而不是通过 GitHub 连接。

**部署命令：**
```bash
# 直接运行部署脚本
./deploy.sh

# 或者手动运行 wrangler 命令
wrangler pages deploy ./ --project-name=text-formatter
```

**项目配置：**
- 项目名称：`text-formatter`
- 部署脚本：`deploy.sh`
- 快速部署：`quick-deploy.sh`
- 详细指南：`DEPLOYMENT.md`

**重要提醒：**
- 优先使用 wrangler CLI 直接部署
- 项目中已配置好相关脚本
- 不需要 GitHub 集成，除非用户明确要求

## 主域名配置

### 生产域名设置
**主域名：** `https://text-formatter.com/`

**重要提醒：**
- 所有配置文件（sitemap.xml、robots.txt、llm.txt）都必须使用主域名 `https://text-formatter.com/`
- 不使用 `text-formatter.pages.dev` 作为主域名
- 确保所有内部链接和引用都使用主域名
- sitemap.xml 中的所有 URL 都以 `https://text-formatter.com/` 开头

## 项目特性

### 查找替换功能
- 支持普通文本查找替换
- 支持正则表达式模式
- 提供语法提示和错误处理
- 防止无限循环的保护机制

### 编辑器功能
- Monaco 代码编辑器
- WYSIWYG 所见即所得编辑器
- 支持 Markdown 格式
- 历史记录（撤销/重做）

### 文本格式化工具
- 添加行号
- 删除空行
- 合并行
- 大小写转换
- 去除表情符号
- 添加日期等

## 开发提醒

- 当进行 Cloudflare Pages 部署时，使用项目中的 wrangler 配置
- 修复功能后记得测试查找替换的各种场景
- 保持代码的简洁性和用户友好性