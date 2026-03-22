# Digital Wardrobe (数字化衣橱)

一个基于 Node.js 的个人衣橱管理系统，支持全流程的衣物生命周期管理（购买 -> 收货 -> 入柜 -> 换季收纳 -> 淘汰）。使用 PostgreSQL 数据库存储数据，支持商品信息自动提取和图像识别功能。

## ✨ 主要功能

### 1. 📊 财务管理
- **消费概览**：年度消费统计、月均支出、购买件数
- **历史购买**：完整的购买记录列表，支持编辑和删除

### 2. 🧥 衣柜管理
- **物品管理**：添加、更新、删除衣柜物品
- **状态跟踪**：记录物品状态（活跃、收纳、淘汰等）
- **位置管理**：记录物品存放位置
- **图片管理**：支持上传商品图片

### 3. 🛒 购买记录管理
- **手动添加**：填写表单添加购买记录
- **图片上传**：支持上传商品图片

### 4. 🤖 智能功能
- **商品信息自动提取**：从电商网站 URL 自动提取商品信息（标题、图片、价格）
- **图像识别**：从商品图片中提取文字和产品信息

## 🚀 快速开始

### 前置要求
- 安装 [Node.js](https://nodejs.org/) (v14+ 推荐)
- 安装并配置 [PostgreSQL](https://www.postgresql.org/) 数据库

### 安装与运行

1. **克隆项目**
   ```bash
   git clone https://github.com/yourusername/digital-wardrobe.git
   cd digital-wardrobe
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **初始化数据库**
   ```bash
   npm run init-db
   ```

4. **启动服务**
   ```bash
   npm start
   # 或
   node server.js
   ```

5. **访问应用**
   打开浏览器访问：[http://localhost:8080](http://localhost:8080)

### 📱 局域网访问（手机端）
确保手机和电脑在同一 WiFi 下，查找电脑的局域网 IP，手机浏览器访问：
`http://<电脑IP>:8080`

## 📂 文件结构

```
DigitalWardrobe/
├── src/                    # 前端源码
│   ├── app.js              # 应用入口
│   ├── utils.js            # 工具函数
│   ├── config.js           # 配置常量
│   ├── styles.css          # 样式文件
│   ├── views/              # 页面视图
│   │   ├── finance.js      # 财务管理
│   │   └── wardrobe.js     # 衣柜管理
│   └── components/         # 组件
│       ├── table.js        # 表格组件
│       ├── modal.js        # 编辑弹窗
│       └── purchaseForm.js # 购买记录表单
├── index.html              # 入口文件
├── server.js               # Node.js 后端服务
├── db.js                   # 数据库配置
├── init-db.js              # 数据库初始化脚本
├── package.json            # 项目配置和依赖
└── README.md               # 说明文档
```

## 📝 数据说明

### 数据库表结构
- **items**：存储衣柜物品信息
- **purchases**：存储购买记录信息

## 🛠 技术栈

- **前端**：原生 JavaScript (ES Modules)
- **后端**：Node.js (原生 http 模块)
- **样式**：CSS 变量 + Flexbox 布局
- **数据**：PostgreSQL 数据库
- **工具库**：
  - Puppeteer：用于网页数据抓取
  - Tesseract.js：用于图像识别
  - Sharp：用于图像处理

## 📡 API 端点

### 衣柜物品
- `GET /api/items` - 获取所有衣柜物品
- `POST /api/items` - 添加新衣柜物品
- `PUT /api/items/:id` - 更新现有衣柜物品
- `DELETE /api/items/:id` - 删除衣柜物品

### 购买记录
- `GET /api/purchases` - 获取所有购买记录
- `POST /api/purchases` - 添加新购买记录
- `PUT /api/purchases/:id` - 更新购买记录
- `DELETE /api/purchases/:id` - 删除购买记录

### 工具功能
- `POST /api/fetch-metadata` - 从 URL 获取商品元数据
- `POST /api/recognize-image` - 从图片识别商品信息

## 📝 常见问题

**Q: 数据会丢失吗？**
A: 所有操作都会存储到 PostgreSQL 数据库中。建议定期备份数据库。

**Q: 如何添加购买记录？**
A: 进入"财务管理" -> "历史购买"，点击"添加购买记录"按钮。

**Q: 支持图片上传吗？**
A: 支持。可以点击图片上传区域选择文件，或直接粘贴截图。

**Q: 如何使用商品信息自动提取功能？**
A: 在添加购买记录或衣柜物品时，输入商品 URL，系统会自动提取商品信息。

**Q: 如何使用图像识别功能？**
A: 在添加购买记录或衣柜物品时，上传商品图片，系统会尝试从图片中提取信息。

**Q: 如何在外网访问？**
A: 需要部署到云服务器，或使用内网穿透工具（如 ngrok、frp）。

## 📄 许可证
MIT License
