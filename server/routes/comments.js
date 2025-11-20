const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams 允许访问父路由的参数 (pigId)
const db = require('../db');

// 获取客户端IP
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
        req.headers['x-real-ip'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        '127.0.0.1';
}

// 检查评论提交频率（防刷）
function checkCommentLimit(ip) {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    // 清理旧记录
    const cleanStmt = db.prepare('DELETE FROM comment_submissions WHERE timestamp < ?');
    cleanStmt.run(tenMinutesAgo);
    // 检查最近10分钟的提交次数（最多5条）
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM comment_submissions WHERE ip = ? AND timestamp > ?');
    const result = countStmt.get(ip, tenMinutesAgo);
    return result.count < 5;
}

// 记录评论提交
function recordCommentSubmission(ip) {
    const stmt = db.prepare('INSERT INTO comment_submissions (ip, timestamp) VALUES (?, ?)');
    stmt.run(ip, Date.now());
}

// 1. 获取某只猪的评论（分页）
router.get('/', (req, res) => {
    try {
        const pigId = parseInt(req.params.id);
        if (!pigId) {
            return res.status(400).json({ error: '无效的ID' });
        }
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 20;
        const offset = page * limit;
        const countStmt = db.prepare('SELECT COUNT(*) as total FROM comments WHERE pig_id = ?');
        const { total } = countStmt.get(pigId);
        const stmt = db.prepare(`
            SELECT id, content, created_at 
            FROM comments 
            WHERE pig_id = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `);
        const comments = stmt.all(pigId, limit, offset);
        res.json({
            success: true,
            total,
            page,
            comments
        });
    } catch (error) {
        console.error('获取评论错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 2. 为某只猪新增评论
router.post('/', (req, res) => {
    try {
        const pigId = parseInt(req.params.id);
        if (!pigId) {
            return res.status(400).json({ error: '无效的ID' });
        }
        const { content } = req.body || {};
        if (!content || typeof content !== 'string' || !content.trim()) {
            return res.status(400).json({ error: '评论内容不能为空' });
        }
        const trimmed = content.trim();
        if (trimmed.length > 200) {
            return res.status(400).json({ error: '评论最多200字' });
        }
        // 检查目标猪是否存在
        const existsStmt = db.prepare('SELECT id FROM pigs WHERE id = ?');
        const exists = existsStmt.get(pigId);
        if (!exists) {
            return res.status(404).json({ error: '猪不存在' });
        }
        const ip = getClientIP(req);
        if (!checkCommentLimit(ip)) {
            return res.status(429).json({ error: '评论太频繁啦，请稍后再试（每10分钟最多5条）' });
        }
        const timestamp = Date.now();
        const insertStmt = db.prepare(`
            INSERT INTO comments (pig_id, content, ip, created_at)
            VALUES (?, ?, ?, ?)
        `);
        const result = insertStmt.run(pigId, trimmed, ip, timestamp);
        recordCommentSubmission(ip);
        res.json({
            success: true,
            id: result.lastInsertRowid,
            message: '评论成功！',
            comment: { id: result.lastInsertRowid, content: trimmed, created_at: timestamp }
        });
    } catch (error) {
        console.error('新增评论错误:', error);
        res.status(500).json({ error: '服务器错误，请稍后重试' });
    }
});

module.exports = router;
