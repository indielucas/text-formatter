#!/bin/bash

# 一键部署到 Cloudflare Pages
echo "🚀 Text Formatter 一键部署脚本"
echo "================================"

# 选择部署方式
echo "请选择部署方式:"
echo "1) 通过 GitHub (推荐)"
echo "2) 直接上传到 Cloudflare Pages"
echo "3) 查看详细部署指南"

read -p "请输入选择 (1-3): " choice

case $choice in
    1)
        echo ""
        echo "📋 GitHub 部署步骤:"
        echo "1. 在 GitHub 创建新仓库: https://github.com/new"
        echo "2. 仓库名建议: text-formatter"
        echo "3. 运行以下命令:"
        echo ""
        echo "   git remote add origin https://github.com/YOUR_USERNAME/text-formatter.git"
        echo "   git branch -M main"
        echo "   git push -u origin main"
        echo ""
        echo "4. 登录 Cloudflare Dashboard: https://dash.cloudflare.com/"
        echo "5. Pages → Create a project → Connect to Git"
        echo "6. 选择你的仓库并部署"
        echo ""
        read -p "是否现在添加 GitHub 远程仓库? (y/n): " add_remote
        if [[ $add_remote == "y" || $add_remote == "Y" ]]; then
            read -p "请输入你的 GitHub 用户名: " username
            git remote add origin https://github.com/$username/text-formatter.git
            echo "✅ 远程仓库已添加"
            echo "现在可以运行: git push -u origin main"
        fi
        ;;
    2)
        echo ""
        echo "🔧 正在尝试直接部署..."
        if command -v wrangler &> /dev/null; then
            ./deploy.sh
        else
            echo "📦 需要安装 Wrangler CLI"
            echo "运行以下命令安装并部署:"
            echo "  npm install -g wrangler"
            echo "  ./deploy.sh"
        fi
        ;;
    3)
        echo ""
        echo "📖 打开详细部署指南..."
        if command -v open &> /dev/null; then
            open DEPLOYMENT.md
        elif command -v xdg-open &> /dev/null; then
            xdg-open DEPLOYMENT.md
        else
            echo "请查看 DEPLOYMENT.md 文件获取详细指南"
        fi
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac