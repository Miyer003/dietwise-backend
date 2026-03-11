# 膳智 DietWise 后端服务

基于 NestJS + TypeScript + PostgreSQL + Redis 的智能膳食管理系统后端。

## 技术栈

- **框架**: NestJS 10
- **语言**: TypeScript 5
- **数据库**: PostgreSQL 15 + TypeORM
- **缓存**: Redis 7
- **对象存储**: MinIO (兼容 S3)
- **AI服务**: 
  - 阿里云 DashScope (qwen-vl-plus / qwen-turbo)
  - Moonshot (kimi-v1)

## 功能模块

| 模块 | 说明 |
|------|------|
| 认证模块 | JWT登录、注册、短信验证码 |
| 用户模块 | 用户信息、用户画像、身体数据 |
| 饮食记录 | 多模态记录(拍照/语音/手动)、营养分析 |
| 食物库 | 标准食物数据、搜索、语义检索 |
| 食谱规划 | AI生成一周食谱、自定义食谱 |
| AI咨询 | 多轮对话、SSE流式响应 |
| 提醒设置 | 餐次提醒、饮水提醒 |
| 自定义提示 | 首页个性化提示管理 |
| 成就徽章 | 打卡成就、营养成就 |
| 用户反馈 | 问题反馈、建议提交 |
| 数据同步 | 离线数据同步 |
| 管理后台 | 用户管理、数据统计 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件配置你的数据库、Redis、AI密钥等
```

### 3. 启动依赖服务

确保 PostgreSQL、Redis、MinIO 已启动。

### 4. 运行开发服务器

```bash
npm run start:dev
```

服务将启动在 http://localhost:3000

API文档: http://localhost:3000/api-docs

### 5. 生产构建

```bash
npm run build
npm run start:prod
```

## 项目结构

```
src/
├── modules/           # 业务模块
│   ├── auth/         # 认证
│   ├── user/         # 用户
│   ├── diet/         # 饮食记录
│   ├── food/         # 食物库
│   ├── meal-plan/    # 食谱规划
│   ├── chat/         # AI咨询
│   ├── notification/ # 提醒设置
│   ├── tips/         # 自定义提示
│   ├── achievement/  # 成就徽章
│   ├── feedback/     # 用户反馈
│   ├── sync/         # 数据同步
│   ├── admin/        # 管理后台
│   └── ai/           # AI服务接口
├── shared/           # 共享服务
│   ├── ai/          # AI服务封装
│   ├── redis/       # Redis服务
│   └── minio/       # MinIO服务
├── common/          # 公共工具
├── config/          # 配置文件
└── main.ts          # 入口文件
```

## API 设计

- 基础路径: `/v1`
- 认证方式: Bearer JWT Token
- 响应格式: 统一包装 `{ code, message, data, timestamp, requestId }`

## 开发规范

1. 使用装饰器进行参数验证 (class-validator)
2. 统一使用 Swagger 注解生成 API 文档
3. 数据库实体使用 TypeORM 装饰器
4. 缓存键遵循规范: `模块:操作:标识`

## License

MIT
