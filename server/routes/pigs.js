const express = require('express');
const router = express.Router();
const db = require('../db');
const geoip = require('geoip-lite');

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
            'CN': '中国', 'US': '美国', 'GB': '英国', 'JP': '日本', 'KR': '韩国',
            'FR': '法国', 'DE': '德国', 'CA': '加拿大', 'AU': '澳大利亚', 'IN': '印度',
            'BR': '巴西', 'RU': '俄罗斯', 'IT': '意大利', 'ES': '西班牙', 'MX': '墨西哥',
            'ID': '印度尼西亚', 'NL': '荷兰', 'SA': '沙特阿拉伯', 'TR': '土耳其', 'CH': '瑞士',
            'TW': '中国台湾', 'HK': '中国香港', 'SG': '新加坡', 'MY': '马来西亚', 'TH': '泰国',
            'VN': '越南', 'PH': '菲律宾'
        };
        const countryName = countryMap[geo.country] || geo.country;
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

// 1. 提交新猪
router.post('/', (req, res) => {
    try {
        const { name, image } = req.body;

        if (!name || !image) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        if (name.length > 20) {
            return res.status(400).json({ error: '名字最多20个字' });
        }

        if (!image.startsWith('data:image/')) {
            return res.status(400).json({ error: '无效的图片格式' });
        }

        const ip = getClientIP(req);

        if (!checkSubmissionLimit(ip)) {
            return res.status(429).json({ error: '提交太频繁啦，请10分钟后再试（每10分钟最多提交3只猪）' });
        }

        const location = getLocation(ip);
        const timestamp = Date.now();

        const stmt = db.prepare(
            'INSERT INTO pigs (name, image, location, ip, likes, created_at) VALUES (?, ?, ?, ?, 0, ?)'
        );
        const result = stmt.run(name, image, location, ip, timestamp);

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
router.get('/', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 20;
        const offset = page * limit;
        const search = req.query.search ? req.query.search.trim() : '';
        const sortParam = (req.query.sort || '').trim();
        const sortKey = sortParam === 'likes' ? 'likes' : (sortParam === 'comments' ? 'comment_count' : 'created_at');

        let countStmt, stmt, total, pigs;

        if (search) {
            const searchPattern = `%${search}%`;
            countStmt = db.prepare('SELECT COUNT(*) as total FROM pigs WHERE name LIKE ?');
            ({ total } = countStmt.get(searchPattern));

            stmt = db.prepare(`
                SELECT id, name, image, location, likes, created_at,
                       (SELECT COUNT(*) FROM comments WHERE comments.pig_id = pigs.id) AS comment_count
                FROM pigs 
                WHERE name LIKE ?
                ORDER BY ${sortKey} DESC 
                LIMIT ? OFFSET ?
            `);
            pigs = stmt.all(searchPattern, limit, offset);
        } else {
            countStmt = db.prepare('SELECT COUNT(*) as total FROM pigs');
            ({ total } = countStmt.get());

            stmt = db.prepare(`
                SELECT id, name, image, location, likes, created_at,
                       (SELECT COUNT(*) FROM comments WHERE comments.pig_id = pigs.id) AS comment_count
                FROM pigs 
                ORDER BY ${sortKey} DESC 
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
router.post('/:id/like', (req, res) => {
    try {
        const pigId = parseInt(req.params.id);

        if (!pigId) {
            return res.status(400).json({ error: '无效的ID' });
        }

        const stmt = db.prepare('UPDATE pigs SET likes = likes + 1 WHERE id = ?');
        stmt.run(pigId);

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
router.get('/:id', (req, res) => {
    try {
        const pigId = parseInt(req.params.id);

        const stmt = db.prepare('SELECT * FROM pigs WHERE id = ?');
        const pig = stmt.get(pigId);

        if (!pig) {
            return res.status(404).json({ error: '猪不存在' });
        }

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

module.exports = router;
