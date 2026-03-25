-- 将指定用户设置为管理员
-- 用法: psql -d dietwise -f scripts/init-admin.sql

-- 请修改下面的手机号
UPDATE users 
SET role = 'admin' 
WHERE phone = '15617612681';

-- 验证更新结果
SELECT id, phone, nickname, role, status 
FROM users 
WHERE phone = '15617612681';
