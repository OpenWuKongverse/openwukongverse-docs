-- OpenWuKongVerse · 创作者审批闭环 · D1 Schema 增量
-- 独立文件：不改动原 schema.sql 的表定义，仅对 contributors 表追加审批所需列。
-- 部署：在 CF 控制台 D1 → owkv-events → Console 粘贴执行（或 wrangler d1 execute）。
--
-- ⚠️ 幂等说明：SQLite/D1 不支持 ALTER TABLE ... ADD COLUMN IF NOT EXISTS。
--    本文件只能执行一次；若重复执行会报 "duplicate column name" 错误，可忽略。
--    若某列已存在、其余需补，请按需单独执行缺失的那条 ALTER。
--
-- 对齐设计（02-co-creation/creator-management-system.md）：
--   · 公开账本/积分/事件流仅用 email_hash（保护隐私）
--   · 明文邮箱另存 Hub 内部通道，仅用于发通知邮件，不外泄、不进公开账本
--   → 故 email_plaintext 仅存后端、仅供发信服务调用。

-- 1) 内部通知通道：明文邮箱（仅后端发信用，绝不下发前端、绝不进 events_raw/账本）
ALTER TABLE contributors ADD COLUMN email_plaintext TEXT;

-- 2) 双身份标记：是否为创作者（0/1；creator=1 时 creator_apply 必为 'approved'）
ALTER TABLE contributors ADD COLUMN creator INTEGER DEFAULT 0;

-- 3) 申请状态机：none | pending | approved | rejected
ALTER TABLE contributors ADD COLUMN creator_apply TEXT;

-- 4) 申请时间（ISO 字符串）
ALTER TABLE contributors ADD COLUMN apply_at TEXT;

-- 5) 审批时间（ISO 字符串）
ALTER TABLE contributors ADD COLUMN reviewed_at TEXT;

-- 6) 驳回后冷却截止时间（ISO 字符串；仅 rejected 时非空，用于防刷）
ALTER TABLE contributors ADD COLUMN next_apply_at TEXT;

-- 7) 审批/申请备注（架构师寄语或驳回意见，可空）
ALTER TABLE contributors ADD COLUMN apply_note TEXT;
