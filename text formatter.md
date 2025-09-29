## 任务
我想做一个文本编辑器，左边是编辑区域，右边是预览区域，支持格式化，加粗，斜体，换行等操作。

## 基本信息
网站名称：Text Formatter
网站域名：text-formatter.com
关键字：Text Formatter, Facebook Text Formatter, Linkedin Text Formatter, Discord Text Formatter, Online Text Formatter 等
网站语言：英文

## 技术栈
纯前端项目，可以部署在 cloudflare pages。使用 Monaco Editor 作为编辑器实现主要功能
辅助 tailwind 4 样式。

## 界面布局
1. 整体采用常见的 landing page 布局，顶部有 header，底部有 footer，中间是主体部分
2. header 要包含一个 logo，你可以用 python 脚本或者其他方式，生成 logo.png 和 favicon.png
3. footer 要包含 Privacy policy 和 Terms of service 链接。并用同样的布局，为这两个链接生成子页面。

## 页面主体部分

### 第一个模块
主体部分第一个模块就是工具本身，左侧为编辑器，右侧为预览区域（只需要一个大的预览区域），可以直接预览和复制文本，参考 screenshot1.png

#### 编辑器功能

1. 左侧使用 Monaco Editor 作为主编辑器，只显示给初级用户的常见功能，让界面看起来简单好用。
2. 要额外支持以下功能：
	1. 自动为每行添加序号
	2. 删除空行
	3. 合并成一行
	4. 删除空白字符
	5. 删除 emoji
	6. 添加当前日期
	7. 全部大写
	8. 全部小写
	9. 首字母大写
	10. 每个单词首字母大写
2. 请为以上功能命名，并增加额外的按钮或图标。

#### 预览功能
1. 任何对文本的改动，在右侧都有对应的预览，可以随时 copy ，右侧只需要一个大的预览区域即可。
2. 每一步改动都有 undo，历史记录最多保存 50 个改动步骤，记在 localStorage，并提供 回退，重做 按钮。隐私协议页面里会写上用户数据只保存在本地，没有网络传输。

### 第二个模块
关于工具功能的介绍，如何使用等，不少于 200 字，要尽量包含前面提到的关键字，有利于 SEO。

### 第三个模块
关于工具的 10 个 faq，在网上搜索用户有关 text formatter 的相关问题，根据这些实际问题结合本工具功能，回答用户的疑问。注意，一定是上网搜索的真实问题。



