-- OpenWuKongVerse · D1 初始化 Schema
-- 对齐《贡献力数据规范》contribution-data-spec_v1.md 的表结构契约
-- 在 CF 控制台: Workers & Pages → D1 → owkv-events → Console 粘贴执行
-- 幂等: 全表带 IF NOT EXISTS,可重复执行

PRAGMA foreign_keys = ON;

-- 3.1 入口统一原始事件表(唯一写入点)
CREATE TABLE IF NOT EXISTS events_raw (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,          -- email / github / discord / webform / manual
  event_type TEXT NOT NULL,        -- join / submit_proposal / review / merge / translation / ops
  contributor_key TEXT NOT NULL,   -- 匿名代号(跨平台统一识别键)
  payload TEXT,                    -- 原始载荷 JSON(平台原生/表单字段,不动原样存)
  ts TEXT DEFAULT (datetime('now'))
);

-- 3.2 贡献者账户(建档)
CREATE TABLE IF NOT EXISTS contributors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anon_code TEXT UNIQUE NOT NULL,  -- 匿名代号(公开身份,唯一)
  email_hash TEXT UNIQUE,          -- 邮箱哈希(稳定标识,不存明文)
  role_tag TEXT,                   -- 主攻角色: artist / writer / player / programmer / community
  mode_tag TEXT,                   -- 主攻模态: A / B / C
  join_ts TEXT,
  status TEXT DEFAULT 'observer'   -- observer → contributor → reviewer(卷3 4.3 晋升)
);

-- 3.3 积分流水(一条贡献一行,算分唯一依据)
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contributor_id INTEGER REFERENCES contributors(id),
  dim TEXT NOT NULL,               -- C1 / C2 / C3 / C4
  points REAL NOT NULL,            -- 单次计分(按规范 §2 规则)
  source_event INTEGER REFERENCES events_raw(id),  -- 可倒查来源(对账关键)
  approved_by TEXT,                -- 评审团/架构师确认(防刷)
  ts TEXT DEFAULT (datetime('now'))
);

-- 3.4 介入缝任务表(轻量任务推荐)
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seam_id TEXT NOT NULL,           -- 介入缝编号(A12 / B3 / C7…,对应介入索引)
  mode_tag TEXT,                   -- 适用模态
  role_tag TEXT,                   -- 适合角色
  status TEXT DEFAULT 'open',      -- open / claimed / done
  assignee_id INTEGER,             -- 认领人 = 贡献者(认领即登记)
  claimed_at TEXT
);

-- 3.5 聚合视图(公示喂数)
CREATE VIEW IF NOT EXISTS v_dashboard AS
SELECT c.anon_code, c.role_tag, c.mode_tag, c.status,
       SUM(CASE WHEN l.dim='C1' THEN l.points ELSE 0 END) AS C1,
       SUM(CASE WHEN l.dim='C2' THEN l.points ELSE 0 END) AS C2,
       SUM(CASE WHEN l.dim='C3' THEN l.points ELSE 0 END) AS C3,
       SUM(CASE WHEN l.dim='C4' THEN l.points ELSE 0 END) AS C4,
       SUM(l.points) AS total,
       COUNT(l.id) AS events
FROM contributors c LEFT JOIN ledger l ON l.contributor_id=c.id
GROUP BY c.id;

-- 3.6 邮箱验证码令牌表(方案A免密码: OTP + 30天长效登录)
CREATE TABLE IF NOT EXISTS email_tokens (
  email_hash TEXT UNIQUE NOT NULL,   -- 邮箱 SHA256(不存明文)
  token_hash TEXT NOT NULL,          -- 6位OTP的SHA256
  expires_at INTEGER NOT NULL,       -- 过期时间戳(Unix秒)
  attempts INTEGER DEFAULT 0,        -- 已尝试次数(上限5)
  created_at TEXT DEFAULT (datetime('now'))
);

-- 3.7 全局每日发信熔断计数(免费额度保护)
CREATE TABLE IF NOT EXISTS global_daily_limits (
  day TEXT PRIMARY KEY,              -- YYYY-MM-DD
  sent_count INTEGER DEFAULT 0       -- 当日已发OTP邮件数
);

-- 3.8 待建贡献者临时记录(verify-otp 时缺 anon_code 的问题解决)
CREATE TABLE IF NOT EXISTS pending_contributors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_hash TEXT UNIQUE NOT NULL,   -- 邮箱 SHA256
  anon_code TEXT,                    -- 匿名代号(可选,注册时可填)
  role_tag TEXT,                     -- 主攻角色
  mode_tag TEXT,                     -- 主攻模态
  source_ip TEXT,                    -- 注册IP
  created_at TEXT DEFAULT (datetime('now'))
);

-- 索引(增长后启用,起步数据量可省)
-- CREATE INDEX IF NOT EXISTS idx_events_platform ON events_raw(platform);
-- CREATE INDEX IF NOT EXISTS idx_ledger_contributor ON ledger(contributor_id);
-- CREATE INDEX IF NOT EXISTS idx_ledger_dim ON ledger(dim);