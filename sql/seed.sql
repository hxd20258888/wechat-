-- =============================================================
-- 种子数据
-- =============================================================

-- 服务分类
INSERT INTO categories (id, key, label, icon, sort_order, is_active) VALUES
  ('cat_tuning',       'tuning',       '调音', '🎵', 1, TRUE),
  ('cat_modification', 'modification', '改装', '🔧', 2, TRUE),
  ('cat_maintenance',  'maintenance',  '保养', '🛡️', 3, TRUE),
  ('cat_diagnosis',    'diagnosis',    '诊断', '🩺', 4, TRUE)
ON CONFLICT (key) DO NOTHING;

-- 每周固定营业配置（默认：仅周六营业 09:00-18:00，其余关闭）
INSERT INTO weekly_configs (day_of_week, is_active, start_time, end_time, max_count) VALUES
  (0, FALSE, '09:00', '18:00', 1),
  (1, FALSE, '09:00', '18:00', 1),
  (2, FALSE, '09:00', '18:00', 1),
  (3, FALSE, '09:00', '18:00', 1),
  (4, FALSE, '09:00', '18:00', 1),
  (5, FALSE, '09:00', '18:00', 1),
  (6, TRUE,  '09:00', '18:00', 1)
ON CONFLICT (day_of_week) DO NOTHING;

-- 示例服务（可选，正式启用前可在管理后台增删改）
INSERT INTO services (id, name, category_id, category, category_name, price_min, duration, description, sort_order) VALUES
  ('svc_audio_tuning', '音响调音', 'tuning', 'tuning', '调音', 380, 60, '专业音响系统调音，还原真实声场', 1),
  ('svc_audio_install', '音响安装', 'modification', 'modification', '改装', 800, 120, '整套音响器材安装与布线', 2)
ON CONFLICT (id) DO NOTHING;
