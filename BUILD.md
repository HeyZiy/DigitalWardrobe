# 电子衣橱 - 多端应用构建指南

## 📋 概述

本文档介绍如何构建电子衣橱的桌面端和移动端应用，支持 Windows、macOS、Linux、iOS 和 Android 平台。

## 🚀 快速开始

### 环境要求

- Node.js 18+
- Rust 1.70+（仅用于桌面应用）
- Xcode 15+（仅用于 iOS）
- Android Studio（仅用于 Android）

### 安装依赖

```bash
npm install
```

## 🖥️ 构建桌面应用

### 前置条件

安装 Rust 和 Tauri CLI：

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Tauri CLI
npm install -D @tauri-apps/cli
```

### 构建步骤

```bash
# 开发模式（热重载）
npm run tauri:dev

# 生产构建
npm run tauri:build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录。

### 配置 API 地址

创建 `.env` 文件或设置环境变量：

```env
VITE_API_BASE_URL=https://your-api.railway.app
```

## 📱 构建移动应用

### 前置条件

安装 Capacitor CLI：

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "电子衣橱" "com.wardrobe.digital" --web-dir=dist
```

### iOS 构建

```bash
# 构建 Web 应用
npm run build

# 同步到 iOS
npx cap sync ios

# 打开 Xcode
npx cap open ios

# 在 Xcode 中打包
# Product > Archive > Distribute App Store
```

### Android 构建

```bash
# 构建 Web 应用
npm run build

# 同步到 Android
npx cap sync android

# 打开 Android Studio
npx cap open android

# 在 Android Studio 中打包
# Build > Generate Signed Bundle / APK
```

## ⚙️ 配置说明

### 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `VITE_API_BASE_URL` | API 服务器地址 | `https://api.example.com` |
| `NEON_DATABASE_URL` | Neon 数据库连接字符串 | `postgresql://user:pass@host/db` |
| `GEMINI_API_KEY` | Google Gemini API 密钥 | `AIzaSy...` |
| `WARDROBE_PASSWORD` | 应用访问密码 | `your_password` |

### Capacitor 配置

编辑 `capacitor.config.json` 修改移动应用设置：

```json
{
  "appId": "com.wardrobe.digital",
  "appName": "电子衣橱",
  "webDir": "dist",
  "server": {
    "url": "https://your-api.railway.app"
  }
}
```

### Tauri 配置

编辑 `src-tauri/tauri.conf.json` 修改桌面应用设置：

```json
{
  "tauri": {
    "windows": [{
      "title": "电子衣橱",
      "width": 1200,
      "height": 800
    }]
  }
}
```

## 🗄️ 数据库迁移

### 导出数据

如果需要从旧数据库导出数据：

```bash
# 确保设置了 DATABASE_URL 或 NEON_DATABASE_URL
node export-data.js
```

数据将导出到 `exports/` 目录。

### 迁移到 Neon

```bash
# 设置 NEON_DATABASE_URL
export NEON_DATABASE_URL="postgresql://user:pass@host/database"

# 运行迁移
node migrate-to-neon.js
```

## 🔧 常用命令

| 命令 | 说明 |
|------|------|
| `npm start` | 启动开发服务器 |
| `npm run build` | 构建 Web 应用 |
| `npm run tauri:dev` | Tauri 开发模式 |
| `npm run tauri:build` | 构建 Tauri 应用 |
| `npm run cap:sync` | 同步到 Capacitor |
| `npm run cap:open:ios` | 打开 iOS 项目 |
| `npm run cap:open:android` | 打开 Android 项目 |
| `npm run export` | 导出数据 |
| `npm run migrate` | 迁移数据到 Neon |

## 📦 发布说明

### macOS App Store

1. 在 Xcode 中创建分发证书和配置文件
2. 配置 `App Store Connect` 应用信息
3. 使用 Xcode 或命令行打包上传

### Windows

构建 NSIS 安装包后分发：

```bash
npm run tauri:build -- --bundles nsis
```

### Linux

```bash
npm run tauri:build -- --targets deb,AppImage
```

### iOS App Store

1. 配置签名证书
2. 在 Xcode 中 Archive
3. 上传到 App Store Connect

### Google Play Store

1. 生成签名密钥
2. 配置 `android/app/build.gradle`
3. 构建 AAB 并上传到 Play Console

## 🐛 故障排除

### 常见问题

**Q: Tauri 构建失败**
```bash
# 更新 Rust
rustup update

# 清理缓存
cd src-tauri && cargo clean
```

**Q: Capacitor 同步失败**
```bash
# 清理并重新同步
rm -rf ios android
npx cap add ios android
npx cap sync
```

**Q: API 连接失败**
- 检查 `VITE_API_BASE_URL` 是否正确
- 确认后端服务已部署并运行
- 检查浏览器控制台的网络请求

## 📚 相关资源

- [Tauri 文档](https://tauri.app/)
- [Capacitor 文档](https://capacitorjs.com/)
- [Neon 数据库](https://neon.tech/)
- [Railway 部署](https://railway.app/)
