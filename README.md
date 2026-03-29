# Digital Wardrobe (电子衣橱) 🧥

**Digital Wardrobe** 是一个主打开放性与自动化录入的“次世代”个人实物与消费管理系统。  
它能帮你高效将满屋子的实体衣服数据化，既是你的**穿搭灵感收集册 (Wardrobe)**，也是你的**时装记账流水单 (Finance Ledger)**。系统通过接入 Google Gemini 视觉大模型技术，首创了极速“看图记账”的神奇体验。

## 🎯 核心特性 (Features)

1. **🤖 One-Click AI Import (极速看图入库)** 
   全局置顶“截图入库”入口，支持直接按下 `Ctrl+V`/拖拽商品页截图。无论是衣服款式、淘宝截图还是交易凭证，都能被 AI 瞬间精准萃取为【名称、价格、品牌、季节分类】，告别一切繁杂的手动表单，2秒无感静默入库！
2. **🔄 Single Source of Truth架构 (单源真空数据)**
   彻底打破传统软件中“记账”和“物品管理”分离的老派设计。本系统底层仅拥有一张唯一的数据基座 (`items` 表)。你在查账时能直接看到这件衣服在被你挂着还是吃灰，而在翻看衣柜时，亦能随时修正当初买贵的账目，一次修改，两端报表全服热更新！
3. **📊 数据可视化的财务面板**
   涵盖“年度/月度预算限制”、“12个月消费趋势热力轴”、“Top5 品牌与品类花销占比图”，让你对每一分花在衣服上的钱了如指掌。这并不是冷冰冰的记账表，这直接是基于你物理衣橱现状生成的开销分析大盘。
4. **📦 收纳区 & 淘汰打入冷宫体验**
   衣服不仅能记帐，还能一键从“正在使用”区挪入“已收纳”、“已淘汰”区。

## 🛠 技术栈 (Stack)

本系统的开发贯彻了“奥卡姆剃刀”的极简主义，尽可能减少臃肿的前端框架负担，全靠原生的优雅调度驱动庞大复杂的业务：
- **Frontend**: 完全原生的 `Vanilla JS (ES6 Modules)`, 标准的 `HTML5`, 强大的原生 `CSS Variables`，实现了轻量化毫秒级冷启动与前端路由。
- **Backend**: `Node.js` 原生 HTTP Server（零 Express 环境依赖）。
- **Data Engine**: `PostgreSQL`（配合 `pg` SDK）。
- **AI Core**: `@google/genai` (搭载 Google Gemini 2.5 Flash 视觉引擎)。

## 🚀 部署与运行 (Quick Start)

### 环境要求
1. Node.js (v18+)
2. PostgreSQL 数据库环境
3. 获取一个 [Google AI Studio](https://aistudio.google.com/) 的 API Key。

### 本地编译

1. **安装依赖:**
```bash
npm install
```

2. **环境变量:**
根目录建立 `.env` 文件，内容参考如下：
```env
DATABASE_URL=postgres://用户名:密码@localhost:5432/你的数据库
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxx
```

3. **初始化数据库表:**
```bash
node init-db.js
```

4. **启动服务:**
```bash
npm start
# 服务默认运行于 http://localhost:8080/
```

祝你管理出一派风格干练的人生数字衣橱！（遇到需要后续扩展/改版的问题，请随时参考本仓库附带的 `.agent-instructions.md` 开发者必读规范哦！）
