require('dotenv').config(); // 加载环境变量
const express = require('express');
const path = require('path');
const db = require('./db'); // 引入数据库模块
const pigsRouter = require('./routes/pigs');
const commentsRouter = require('./routes/comments');
const aiRouter = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json({ limit: '10mb' })); // 增加限制以支持图片上传base64图片
app.use(express.static('public'));

// 注册路由
app.use('/api/pigs', pigsRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/ai', aiRouter);

// 统计信息路由 (单独处理或放在 pigRoutes 中，这里放在 server.js 或者 pigRoutes 都可以，为了整洁放在 pigRoutes 更合适，但需要调整路径)
// 为了保持原API路径 /api/stats，我们单独定义或者在 pigRoutes 中处理
// 让我们在 server.js 中保留 stats 路由，或者将其移至 pigRoutes 并挂载在 /api/stats
// 简单起见，我们把 stats 路由加到 pigRoutes 中，但路径需要匹配。
// 实际上，最好单独一个 stats 路由文件，或者直接在这里写。
// 鉴于 stats 很简单，我们直接在这里写，或者为了纯粹性，创建一个 routes/stats.js
// 让我们直接在这里写 stats 路由，因为它不属于 /api/pigs (虽然逻辑上相关)

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
