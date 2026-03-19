# 膳智 DietWise - 生产环境部署指南

## 快速检查清单

### 1. 服务器准备
- [ ] 云服务器（推荐阿里云/腾讯云 2核4G以上）
- [ ] 域名备案（国内服务器必需）
- [ ] SSL 证书（Let's Encrypt 免费或购买）

### 2. 后端部署

#### 环境变量配置
```bash
# 复制生产环境配置
cp .env.production .env

# 编辑 .env，填写以下必填项：
# - DB_HOST, DB_PASSWORD（数据库）
# - REDIS_HOST, REDIS_PASSWORD（Redis）
# - JWT_SECRET（密钥，至少32位随机字符串）
# - MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY（对象存储）
# - DASHSCOPE_API_KEY, MOONSHOT_API_KEY（AI服务）
```

#### Docker 部署（推荐）
```bash
# 构建镜像
docker build -t dietwise-backend .

# 运行容器
docker run -d \
  --name dietwise-api \
  -p 3000:3000 \
  --env-file .env \
  -v /data/uploads:/app/uploads \
  dietwise-backend
```

#### 手动部署
```bash
# 安装依赖
npm ci --production

# 构建
npm run build

# 运行
npm run start:prod
```

### 3. 数据库迁移
```bash
# 生产环境不使用自动同步，手动执行迁移
npm run migration:run
```

### 4. MinIO 配置

#### 方式1: 自有 MinIO 服务器
```bash
# 使用 Docker 运行 MinIO
docker run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -v /data/minio:/data \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=your-strong-password \
  minio/minio server /data --console-address ":9001"
```

#### 方式2: 阿里云 OSS / 腾讯云 COS
需要修改 `src/shared/minio/minio.service.ts` 使用对应 SDK。

### 5. Nginx 配置
```nginx
server {
    listen 80;
    server_name api.dietwise.cn;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.dietwise.cn;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# MinIO 静态资源（头像、图片等）
server {
    listen 443 ssl http2;
    server_name assets.dietwise.cn;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:9000;
        proxy_set_header Host $host;
    }
}
```

### 6. 前端发布

#### 修改前端生产环境 API 地址
```typescript
// src/services/api/client.ts
const PROD_API_URL = 'https://api.dietwise.cn/v1';
```

#### 构建发布
```bash
cd DietWise
npx expo prebuild --platform android
# 或 iOS: npx expo prebuild --platform ios

# 打包 APK/IPA
npx expo run:android --variant release
npx expo run:ios --configuration Release
```

### 7. 监控与日志

#### 推荐工具
- **日志**: PM2 + Logrotate
- **监控**: Prometheus + Grafana
- **告警**: 阿里云/腾讯云监控

```bash
# PM2 配置示例
pm2 start dist/main.js --name dietwise-api
pm2 startup
pm2 save
```

## 常见问题

### Q: 头像上传失败？
A: 检查 MinIO 配置：
1. 确保 MINIO_ENDPOINT 是公网可访问的域名或IP
2. 确保防火墙开放 9000 端口
3. 确保存储桶策略允许公共读取

### Q: 数据库连接失败？
A: 检查：
1. DB_HOST 是否为正确的数据库地址
2. 安全组/防火墙是否开放 5432 端口
3. 用户名密码是否正确

### Q: 如何热更新代码？
A: 使用 PM2：
```bash
pm2 reload dietwise-api
```

## 安全建议

1. **数据库**: 使用强密码，限制访问IP
2. **JWT Secret**: 至少32位随机字符串，定期更换
3. **MinIO**: 使用 HTTPS，设置强密码
4. **服务器**: 定期更新系统补丁，开启防火墙
5. **API**: 启用 rate limit，防止暴力破解
