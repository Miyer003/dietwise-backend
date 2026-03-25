-- badge_definitions 表创建和初始化
-- 用法: psql -d dietwise -f scripts/init-badge-table.sql

-- 创建表
CREATE TABLE IF NOT EXISTS badge_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_code VARCHAR(50) UNIQUE NOT NULL,
    badge_name VARCHAR(100) NOT NULL,
    badge_desc VARCHAR(200),
    icon_emoji VARCHAR(10) DEFAULT '🏆',
    icon_color VARCHAR(7) DEFAULT '#F59E0B',
    category VARCHAR(20) NOT NULL,
    condition_type VARCHAR(30) NOT NULL,
    condition_value INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order SMALLINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_badge_category_active ON badge_definitions(category, is_active);

-- 插入默认徽章数据
INSERT INTO badge_definitions (badge_code, badge_name, badge_desc, icon_emoji, icon_color, category, condition_type, condition_value, sort_order) VALUES
('first_record', '初次记录', '完成首次饮食记录', '📝', '#6366F1', 'habit', 'record_count', 1, 1),
('streak_3', '连续3天', '坚持记录3天', '🔥', '#F59E0B', 'continuous', 'streak_days', 3, 2),
('streak_7', '连续7天', '坚持记录7天', '🔥', '#F97316', 'continuous', 'streak_days', 7, 3),
('streak_30', '连续30天', '坚持记录30天', '🔥', '#EF4444', 'continuous', 'streak_days', 30, 4),
('balanced_diet', '营养均衡', '连续3天营养均衡', '⚖️', '#10B981', 'balanced', 'balanced_days', 3, 5),
('sugar_control', '控糖达人', '连续7天控糖', '🍬', '#3B82F6', 'balanced', 'sugar_control_days', 7, 6),
('calorie_perfect', '热量达标', '连续5天热量达标', '🎯', '#8B5CF6', 'balanced', 'calorie_perfect_days', 5, 7),
('photo_master', '拍照大师', '拍照识别20次', '📸', '#EC4899', 'habit', 'photo_count', 20, 8),
('chat_enthusiast', '咨询达人', 'AI咨询10次', '💬', '#14B8A6', 'habit', 'chat_count', 10, 9)
ON CONFLICT (badge_code) DO NOTHING;

-- 查看结果
SELECT * FROM badge_definitions ORDER BY sort_order;
