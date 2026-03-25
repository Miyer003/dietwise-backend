# 数据库初始化脚本

## 说明

这些脚本仅在首次部署时需要执行，用于：
1. 将现有用户设为管理员
2. 创建徽章定义表并插入默认数据

## 使用方式

```bash
# Docker 环境（推荐）
docker exec -i dietwise-postgres psql -U dietwise -d dietwise < scripts/init-admin.sql
docker exec -i dietwise-postgres psql -U dietwise -d dietwise < scripts/init-badge-table.sql
```
