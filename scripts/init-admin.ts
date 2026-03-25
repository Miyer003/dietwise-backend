/**
 * 管理员账号初始化脚本
 * 
 * 用法:
 * 1. cd dietwise-backend
 * 2. npx ts-node scripts/init-admin.ts <手机号>
 * 
 * 示例:
 * npx ts-node scripts/init-admin.ts 15617612681
 */

import { DataSource } from 'typeorm';
import { User, UserRole } from '../src/modules/user/entities/user.entity';

const initAdmin = async () => {
  const phone = process.argv[2];
  
  if (!phone) {
    console.error('❌ 请提供手机号');
    console.log('用法: npx ts-node scripts/init-admin.ts <手机号>');
    process.exit(1);
  }

  // 创建数据库连接
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '333777',
    database: process.env.DB_DATABASE || 'dietwise',
    entities: [User],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ 数据库连接成功');

    const userRepo = dataSource.getRepository(User);
    
    // 查找用户
    const user = await userRepo.findOne({ where: { phone } });
    
    if (!user) {
      console.error(`❌ 用户 ${phone} 不存在`);
      process.exit(1);
    }

    // 更新为管理员
    user.role = UserRole.ADMIN;
    await userRepo.save(user);
    
    console.log(`✅ 用户 ${phone} 已成功设置为管理员`);
    console.log(`   用户ID: ${user.id}`);
    console.log(`   昵称: ${user.nickname}`);
    console.log(`   角色: ${user.role}`);
    
  } catch (error: any) {
    console.error('❌ 操作失败:', error.message);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
};

initAdmin();
