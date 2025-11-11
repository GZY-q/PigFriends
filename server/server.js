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
        // geo.region 通常为省/州代码，geo.city 为城市名（取决于 MaxMind 数据覆盖）
        const region = geo.region || '';
        const city = geo.city || '';
        
        // 常见中国省级代码到中文名（geoip-lite 可能返回简码或代码，按常见简码覆盖）
        const cnRegionMap = {
            'BJ': '北京', 'SH': '上海', 'TJ': '天津', 'CQ': '重庆',
            'HE': '河北', 'SX': '山西', 'NM': '内蒙古', 'LN': '辽宁',
            'JL': '吉林', 'HL': '黑龙江', 'JS': '江苏', 'ZJ': '浙江',
            'AH': '安徽', 'FJ': '福建', 'JX': '江西', 'SD': '山东',
            'HA': '河南', 'HB': '湖北', 'HN': '湖南', 'GD': '广东',
            'GX': '广西', 'HI': '海南', 'SC': '四川', 'GZ': '贵州',
            'YN': '云南', 'XZ': '西藏', 'SN': '陕西', 'GS': '甘肃',
            'QH': '青海', 'NX': '宁夏', 'XJ': '新疆', 'TW': '中国台湾',
            'HK': '中国香港', 'MO': '中国澳门'
        };
        
        let regionName = region;
        if (geo.country === 'CN' && region) {
            regionName = cnRegionMap[region] || region;
        }
        
        const parts = [countryName];
        if (regionName) parts.push(regionName);
        if (city) parts.push(city);
        
        return parts.join(' ');
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

// 管理员校验中间件
function requireAdmin(req, res, next) {
    // 支持多种来源：自定义头、Authorization Bearer、查询参数、简易 Cookie
    let token = req.headers['x-admin-token'] || req.query.admin_token;
    if (!token && req.headers['authorization']) {
        const auth = String(req.headers['authorization']);
        const m = auth.match(/^Bearer\s+(.+)$/i);
        if (m) token = m[1];
    }
    if (!token && req.headers['cookie']) {
        const cookieStr = String(req.headers['cookie']);
        const m = cookieStr.split(';').map(s => s.trim()).find(s => s.startsWith('x-admin-token='));
        if (m) token = decodeURIComponent(m.split('=').slice(1).join('=') || '');
    }
    if (!process.env.ADMIN_TOKEN) {
        return res.status(503).json({ error: '未配置管理密钥（ADMIN_TOKEN）' });
    }
    if (!token || token !== process.env.ADMIN_TOKEN) {
        return res.status(401).json({ error: '未授权' });
    }
    next();
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

// 6. 删除猪（后台）
app.delete('/api/pigs/:id', requireAdmin, (req, res) => {
    try {
        const pigId = parseInt(req.params.id);
        
        if (!pigId) {
            return res.status(400).json({ error: '无效的ID' });
        }
        
        const exists = db.prepare('SELECT id FROM pigs WHERE id = ?').get(pigId);
        if (!exists) {
            return res.status(404).json({ error: '猪不存在' });
        }
        
        db.prepare('DELETE FROM pigs WHERE id = ?').run(pigId);
        
        res.json({
            success: true,
            message: '删除成功'
        });
    } catch (error) {
        console.error('删除错误:', error);
        res.status(500).json({ error: '服务器错误' });
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

