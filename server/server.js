const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const geoip = require('geoip-lite');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json({ limit: '10mb' })); // 支持base64图片
app.use(express.static('public'));

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

// 获取客户端IP
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           '127.0.0.1';
}

// 获取IP属地（仅国家/地区）
function getLocation(ip) {
    // 如果是本地IP，返回默认值
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
        return '本地';
    }
    
    const geo = geoip.lookup(ip);
    if (geo && geo.country) {
        // 将国家代码转换为中文
        const countryMap = {
            'CN': '中国',
            'US': '美国',
            'GB': '英国',
            'JP': '日本',
            'KR': '韩国',
            'FR': '法国',
            'DE': '德国',
            'CA': '加拿大',
            'AU': '澳大利亚',
            'IN': '印度',
            'BR': '巴西',
            'RU': '俄罗斯',
            'IT': '意大利',
            'ES': '西班牙',
            'MX': '墨西哥',
            'ID': '印度尼西亚',
            'NL': '荷兰',
            'SA': '沙特阿拉伯',
            'TR': '土耳其',
            'CH': '瑞士',
            'TW': '中国台湾',
            'HK': '中国香港',
            'SG': '新加坡',
            'MY': '马来西亚',
            'TH': '泰国',
            'VN': '越南',
            'PH': '菲律宾'
        };
        const countryName = countryMap[geo.country] || geo.country;
        // 优先使用城市；没有城市则回退到国家名
        // geoip-lite 可能返回 city，如 "Beijing"/"Shanghai" 等（英文），此处直接使用以避免不准确的本地化
        if (geo.city && typeof geo.city === 'string' && geo.city.trim()) {
            return geo.city.trim();
        }
        return countryName;
    }
    return '未知地区';
}

// 检查提交频率（防刷）
function checkSubmissionLimit(ip) {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    
    // 清理旧记录
    const cleanStmt = db.prepare('DELETE FROM submissions WHERE timestamp < ?');
    cleanStmt.run(tenMinutesAgo);
    
    // 检查最近10分钟的提交次数
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM submissions WHERE ip = ? AND timestamp > ?');
    const result = countStmt.get(ip, tenMinutesAgo);
    
    return result.count < 3;
}

// 记录提交
function recordSubmission(ip) {
    const stmt = db.prepare('INSERT INTO submissions (ip, timestamp) VALUES (?, ?)');
    stmt.run(ip, Date.now());
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

// API路由

// 1. 提交新猪
app.post('/api/pigs', (req, res) => {
    try {
        const { name, image } = req.body;
        
        // 验证输入
        if (!name || !image) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        
        if (name.length > 20) {
            return res.status(400).json({ error: '名字最多20个字' });
        }
        
        // 验证base64图片格式
        if (!image.startsWith('data:image/')) {
            return res.status(400).json({ error: '无效的图片格式' });
        }
        
        // 获取IP和属地
        const ip = getClientIP(req);
        
        // 检查提交频率
        if (!checkSubmissionLimit(ip)) {
            return res.status(429).json({ error: '提交太频繁啦，请10分钟后再试（每10分钟最多提交3只猪）' });
        }
        
        const location = getLocation(ip);
        const timestamp = Date.now();
        
        // 插入数据库
        const stmt = db.prepare(
            'INSERT INTO pigs (name, image, location, ip, likes, created_at) VALUES (?, ?, ?, ?, 0, ?)'
        );
        const result = stmt.run(name, image, location, ip, timestamp);
        
        // 记录提交
        recordSubmission(ip);
        
        res.json({
            success: true,
            id: result.lastInsertRowid,
            message: '提交成功！'
        });
        
        console.log(`新猪加入：${name}（来自${location}）`);
        
    } catch (error) {
        console.error('提交错误:', error);
        res.status(500).json({ error: '服务器错误，请稍后重试' });
    }
});

// 2. 获取猪列表（分页 + 搜索）
app.get('/api/pigs', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 20;
        const offset = page * limit;
        const search = req.query.search ? req.query.search.trim() : '';
        
        let countStmt, stmt, total, pigs;
        
        if (search) {
            // 有搜索关键字，模糊匹配名字
            const searchPattern = `%${search}%`;
            
            // 获取搜索结果总数
            countStmt = db.prepare('SELECT COUNT(*) as total FROM pigs WHERE name LIKE ?');
            ({ total } = countStmt.get(searchPattern));
            
            // 获取搜索结果列表
            stmt = db.prepare(`
                SELECT id, name, image, location, likes, created_at 
                FROM pigs 
                WHERE name LIKE ?
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            `);
            pigs = stmt.all(searchPattern, limit, offset);
        } else {
            // 无搜索关键字，返回全部
            // 获取总数
            countStmt = db.prepare('SELECT COUNT(*) as total FROM pigs');
            ({ total } = countStmt.get());
            
            // 获取列表（按创建时间倒序）
            stmt = db.prepare(`
                SELECT id, name, image, location, likes, created_at 
                FROM pigs 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            `);
            pigs = stmt.all(limit, offset);
        }
        
        res.json({
            success: true,
            total,
            page,
            search: search || null,
            pigs
        });
        
    } catch (error) {
        console.error('获取列表错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 3. 点赞
app.post('/api/pigs/:id/like', (req, res) => {
    try {
        const pigId = parseInt(req.params.id);
        
        if (!pigId) {
            return res.status(400).json({ error: '无效的ID' });
        }
        
        // 更新点赞数
        const stmt = db.prepare('UPDATE pigs SET likes = likes + 1 WHERE id = ?');
        stmt.run(pigId);
        
        // 获取最新点赞数
        const getStmt = db.prepare('SELECT likes FROM pigs WHERE id = ?');
        const result = getStmt.get(pigId);
        
        if (!result) {
            return res.status(404).json({ error: '猪不存在' });
        }
        
        res.json({
            success: true,
            likes: result.likes
        });
        
    } catch (error) {
        console.error('点赞错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 4. 获取单个猪的详情
app.get('/api/pigs/:id', (req, res) => {
    try {
        const pigId = parseInt(req.params.id);
        
        const stmt = db.prepare('SELECT * FROM pigs WHERE id = ?');
        const pig = stmt.get(pigId);
        
        if (!pig) {
            return res.status(404).json({ error: '猪不存在' });
        }
        
        // 不返回IP地址
        delete pig.ip;
        
        res.json({
            success: true,
            pig
        });
        
    } catch (error) {
        console.error('获取详情错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 5. 统计信息
app.get('/api/stats', (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(likes) as totalLikes,
                COUNT(DISTINCT location) as countries
            FROM pigs
        `);
        const stats = stmt.get();
        
        res.json({
            success: true,
            stats
        });
        
    } catch (error) {
        console.error('获取统计错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 6. 获取某只猪的评论（分页）
app.get('/api/pigs/:id/comments', (req, res) => {
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

// 7. 为某只猪新增评论
app.post('/api/pigs/:id/comments', (req, res) => {
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

// 启动服务器
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║     🐷 猪朋友服务器已启动 🐷        ║
║                                      ║
║  访问地址: http://localhost:${PORT}    ║
║                                      ║
║  快来画一只属于你的猪吧！            ║
╚══════════════════════════════════════╝
    `);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    db.close();
    process.exit(0);
});

