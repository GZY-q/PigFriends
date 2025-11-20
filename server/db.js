const Database = require('better-sqlite3');
const path = require('path');

// 初始化数据库
const db = new Database('pigs.db');

// 创建数据表
db.exec(`
  CREATE TABLE IF NOT EXISTS pigs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    image TEXT NOT NULL,
    location TEXT NOT NULL,
    ip TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`);

// 创建提交记录表（用于防刷）
db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    ip TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )
`);

// 创建索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_created_at ON pigs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_submissions_ip ON submissions(ip, timestamp);
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pig_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    ip TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (pig_id) REFERENCES pigs(id)
  );
  CREATE INDEX IF NOT EXISTS idx_comments_pig ON comments(pig_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS comment_submissions (
    ip TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_comment_submissions_ip ON comment_submissions(ip, timestamp);
`);

module.exports = db;
