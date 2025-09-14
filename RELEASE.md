# 发布说明

## 如何安装扩展

1. 下载最新的 `.zip` 文件
2. 解压缩到一个文件夹
3. 打开 Edge 或 Chrome 浏览器
4. 导航到 `edge://extensions` 或 `chrome://extensions`
5. 启用"开发者模式"
6. 点击"加载解压缩的扩展"
7. 选择解压缩后的文件夹

## 自动打包流程

每次推送到 `main` 分支时，GitHub Actions 会自动：

1. 构建扩展
2. 创建一个包含所有必要文件的 ZIP 包
3. 创建一个新的 GitHub Release
4. 将 ZIP 文件附加到 Release

## 手动打包

您也可以手动打包扩展：

```bash
# 克隆仓库
git clone https://github.com/Detritalw/bing-ai-assistant.git

# 进入项目目录
cd bing-ai-assistant

# 创建 ZIP 文件（排除不必要的文件）
zip -r bing-ai-assistant-extension.zip . -x "*.git*" "*github/workflows*" "*DS_Store*" "README.md"
```

生成的 ZIP 文件可以直接用于浏览器扩展的安装。