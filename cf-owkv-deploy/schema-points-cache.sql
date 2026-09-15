-- OpenWuKongVerse · 积分预聚合缓存 · D1 Schema 增量
-- 独立文件：不改动原 schema.sql 的表定义，仅对 contributors 表追加积分缓存列。
-- 部署：wrangler d1 execute owkv-events --remote --file=schema-points-cache.sql
--       （或 CF 控制台 D1 → owkv-events → Console 粘贴执行）
--
-- 目的：/api/user/me 原先每次实时 SUM(ledger) GROUP BY dim 聚合，
--       账本累积后读放大明显。改为在积分账本变更时把聚合结果写回本列，
--       读时直接取，把「多表聚合」降为「读单列」。
--
-- 格式：JSON 字符串，形如 {"C1":0,"C2":0,"C3":0,"C4":0,"total":0}
-- 兼容：存量行为 NULL 时，后端回退实时 SUM 并顺手回填本列（平滑迁移）。
--       ledger 表为空时同样回退，保证不返回陈旧数据。
--
-- ⚠️ 幂等说明：SQLite/D1 不支持 ALTER TABLE ... ADD COLUMN IF NOT EXISTS。
--    本文件只能执行一次；若重复执行会报 "duplicate column name" 错误，可忽略。

ALTER TABLE contributors ADD COLUMN points_cache TEXT;
