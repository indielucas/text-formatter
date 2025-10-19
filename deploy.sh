#!/bin/bash

# Text Formatter - Cloudflare Pages 部署脚本
# 使用方法: ./deploy.sh

echo "🚀 开始部署 Text Formatter 到 Cloudflare Pages..."

# 检查是否安装了 wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI 未安装"
    echo "📦 正在安装 Wrangler..."
    npm install -g wrangler

    if [ $? -ne 0 ]; then
        echo "❌ Wrangler 安装失败，请手动安装:"
        echo "   npm install -g wrangler"
        exit 1
    fi
fi

# 检查是否已登录
echo "🔐 检查 Cloudflare 登录状态..."
if ! wrangler whoami &> /dev/null; then
    echo "🔑 请先登录 Cloudflare:"
    wrangler login

    if [ $? -ne 0 ]; then
        echo "❌ 登录失败，请重试"
        exit 1
    fi
fi

# 创建项目（如果不存在）
echo "📁 检查 Cloudflare Pages 项目..."
wrangler pages project create text-formatter 2>/dev/null || true
echo "✓ 项目准备完成，开始部署..."

# 部署网站
echo "🌐 正在部署网站..."
wrangler pages deploy ./ --project-name=text-formatter

if [ $? -eq 0 ]; then
    echo "✅ 部署成功: https://text-formatter.com"
else
    echo "❌ 部署失败，请检查错误信息"
    exit 1
fi