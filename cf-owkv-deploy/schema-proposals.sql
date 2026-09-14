-- OpenWuKongVerse · 提案审批与分流 · D1 Schema 增量
-- 独立文件：不改动原 schema.sql 的表定义，新增 proposals 提案状态主表。
-- 部署：wrangler d1 execute owkv-events --remote --file=schema-proposals.sql
--       （或 CF 控制台 D1 → owkv-events → Console 粘贴执行）
--
-- 用途：跟踪站内提案的评议/核准状态，供「活跃提案看板」展示与外导互动。
--       提案全文仍在 GitHub Issue 留痕，本表只存索引级元数据（不复制正文用于公开展示）。
-- 状态机：pending → approved_canon | approved_sandbox | rejected
-- 不变量：status='approved_canon' 时 track 必为 'canon'（后端写入时保证）。

CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES contributors(id),   -- 提案者（登录贡献者 id）
  anon_code TEXT,                                -- 署名代号（冗余，便于看板展示，避免每次 JOIN）
  title TEXT NOT NULL,                           -- 提案标题
  category TEXT,                                 -- 脑洞 | 剧情 | 角色 | 设定延伸 | 模态延伸
  seam_id TEXT,                                  -- 介入缝编号（可空=待定）
  node TEXT,                                     -- 所属节点（可空=待定）
  mode_tag TEXT,                                 -- 适用模态 A/B/C/cross
  track TEXT DEFAULT 'sandbox',                  -- 目标轨道 canon | sandbox
  content TEXT,                                  -- 提案正文（后端留存，公开接口不下发）
  github_issue_number INTEGER,                   -- 对应 GitHub Issue 编号
  github_issue_url TEXT,                         -- Issue 链接（供看板外导）
  status TEXT DEFAULT 'pending',                 -- pending | approved_canon | approved_sandbox | rejected
  discord_thread_url TEXT,                       -- 关联 Discord 讨论贴（人工回填，可空）
  reddit_poll_url TEXT,                          -- 关联 Reddit 投票贴（人工回填，可空）
  apply_note TEXT,                               -- 审批意见/驳回理由
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
