#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// IndexNow 配置
const API_KEY = '87ab8d81b9c34cbd8862509689d2b0b6';
const HOST = 'text-formatter.com';
const KEY_LOCATION = `https://${HOST}/${API_KEY}.txt`;

// 支持的搜索引擎 API 端点
const SEARCH_ENGINES = {
    'IndexNow (General)': 'https://api.indexnow.org/indexnow',
    'Microsoft Bing': 'https://www.bing.com/indexnow',
    'Amazon': 'https://indexnow.amazonbot.amazon/indexnow',
    'Naver': 'https://searchadvisor.naver.com/indexnow',
    'Seznam.cz': 'https://search.seznam.cz/indexnow',
    'Yandex': 'https://yandex.com/indexnow',
    'Yep': 'https://indexnow.yep.com/indexnow'
};

// 从 sitemap.xml 提取所有 URLs
function extractUrlsFromSitemap() {
    try {
        const sitemapPath = path.join(__dirname, 'sitemap.xml');
        const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');

        const urlMatches = sitemapContent.match(/<loc>(.*?)<\/loc>/g);
        if (!urlMatches) {
            console.error('No URLs found in sitemap.xml');
            return [];
        }

        const urls = urlMatches.map(match =>
            match.replace('<loc>', '').replace('</loc>', '').trim()
        );

        console.log(`Found ${urls.length} URLs in sitemap.xml`);
        return urls;
    } catch (error) {
        console.error('Error reading sitemap.xml:', error);
        return [];
    }
}

// 提交 URLs 到单个搜索引擎
function submitToSearchEngine(engineName, apiUrl, urls) {
    return new Promise((resolve, reject) => {
        const payload = {
            host: HOST,
            key: API_KEY,
            keyLocation: KEY_LOCATION,
            urlList: urls
        };

        const data = JSON.stringify(payload);
        const parsedUrl = new URL(apiUrl);

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'User-Agent': 'Text-Formatter IndexNow Submitter'
            }
        };

        console.log(`📤 Submitting to ${engineName}...`);

        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                const result = {
                    engine: engineName,
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: responseData,
                    success: res.statusCode >= 200 && res.statusCode < 300
                };

                if (result.success) {
                    console.log(`✅ ${engineName}: SUCCESS (${res.statusCode})`);
                } else {
                    console.log(`❌ ${engineName}: FAILED (${res.statusCode})`);
                    if (responseData) {
                        console.log(`   Response: ${responseData}`);
                    }
                }

                resolve(result);
            });
        });

        req.on('error', (error) => {
            console.error(`❌ ${engineName}: ERROR - ${error.message}`);
            resolve({
                engine: engineName,
                statusCode: 0,
                error: error.message,
                success: false
            });
        });

        req.setTimeout(30000, () => {
            req.destroy();
            console.error(`❌ ${engineName}: TIMEOUT (30s)`);
            resolve({
                engine: engineName,
                statusCode: 0,
                error: 'Request timeout',
                success: false
            });
        });

        req.write(data);
        req.end();
    });
}

// 批量提交到所有搜索引擎
async function submitToAllEngines(urls) {
    console.log('\n🚀 Starting submission to all search engines...\n');

    const results = [];
    const engines = Object.entries(SEARCH_ENGINES);

    // 串行提交，避免同时发送太多请求
    for (const [engineName, apiUrl] of engines) {
        try {
            const result = await submitToSearchEngine(engineName, apiUrl, urls);
            results.push(result);

            // 在每次请求之间添加小延迟
            if (engines.indexOf([engineName, apiUrl]) < engines.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error(`❌ ${engineName}: Unexpected error - ${error.message}`);
            results.push({
                engine: engineName,
                statusCode: 0,
                error: error.message,
                success: false
            });
        }
    }

    return results;
}

// 显示提交摘要
function displaySummary(results, urlCount) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUBMISSION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total URLs submitted: ${urlCount}`);
    console.log(`Search engines contacted: ${results.length}`);
    console.log('');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Successful submissions: ${successful.length}`);
    successful.forEach(result => {
        console.log(`   • ${result.engine} (${result.statusCode})`);
    });

    if (failed.length > 0) {
        console.log(`\n❌ Failed submissions: ${failed.length}`);
        failed.forEach(result => {
            const reason = result.error || `HTTP ${result.statusCode}`;
            console.log(`   • ${result.engine} (${reason})`);
        });
    }

    console.log('\n📝 Notes:');
    console.log('• HTTP 200-299 = Success');
    console.log('• HTTP 202 = Accepted (normal for IndexNow)');
    console.log('• Some engines may not respond immediately');
    console.log('• Check search engine webmaster tools for indexing status');
    console.log('='.repeat(60));
}

// 主函数
async function main() {
    console.log('🌐 Multi-Engine IndexNow URL Submitter');
    console.log('=====================================');
    console.log(`Host: ${HOST}`);
    console.log(`API Key: ${API_KEY}`);
    console.log(`Key Location: ${KEY_LOCATION}`);
    console.log(`Supported engines: ${Object.keys(SEARCH_ENGINES).length}`);

    // 列出支持的搜索引擎
    console.log('\n🔍 Supported Search Engines:');
    Object.entries(SEARCH_ENGINES).forEach(([name, url], index) => {
        console.log(`${index + 1}. ${name}`);
        console.log(`   ${url}`);
    });

    // 提取 URLs
    console.log('\n📋 Extracting URLs from sitemap...');
    const urls = extractUrlsFromSitemap();

    if (urls.length === 0) {
        console.error('❌ No URLs to submit');
        process.exit(1);
    }

    console.log('\n📤 URLs to submit:');
    urls.forEach((url, index) => {
        console.log(`${index + 1}. ${url}`);
    });

    try {
        // 提交到所有搜索引擎
        const results = await submitToAllEngines(urls);

        // 显示摘要
        displaySummary(results, urls.length);

        // 设置退出代码
        const hasFailures = results.some(r => !r.success);
        process.exit(hasFailures ? 1 : 0);

    } catch (error) {
        console.error('❌ Critical error during submission:', error);
        process.exit(1);
    }
}

// 如果是直接运行的脚本，执行主函数
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}

// 导出函数供其他模块使用
module.exports = {
    extractUrlsFromSitemap,
    submitToSearchEngine,
    submitToAllEngines,
    SEARCH_ENGINES,
    API_KEY,
    HOST,
    KEY_LOCATION
};