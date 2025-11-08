# 🐷 猪朋友 - 部署说明

## 项目简介

猪朋友是一个有趣的画猪互动网页项目，用户可以在线绘制猪的图片，提交到全球共享围栏，查看并点赞其他人的作品。

## 技术栈

- **前端**: HTML5 + CSS3 + JavaScript (原生)
- **后端**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **其他**: Canvas API, GeoIP定位

## 快速开始

### 1. 环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0

### 2. 安装依赖

```bash
# 进入项目目录
cd PigFriends

# 安装所有依赖
npm install
```

### 3. 启动服务器

```bash
# 启动生产环境
npm start

# 或者启动开发环境（自动重启）
npm run dev
```

### 4. 访问项目

打开浏览器访问：http://localhost:3000

## 项目结构

```
PigFriends/
├── public/                 # 前端静态文件
│   ├── index.html         # 首页
│   ├── draw.html          # 绘图页
│   ├── pen.html           # 围栏页
│   ├── css/
│   │   └── style.css      # 样式文件
│   └── js/
│       ├── draw.js        # 绘图逻辑
│       └── pen.js         # 围栏逻辑
├── server/                # 后端服务器
│   └── server.js          # Express服务器
├── package.json           # 项目配置
├── pigs.db               # SQLite数据库（运行后自动生成）
└── 部署说明.md            # 本文件
```

## 核心功能

### 1. 绘图功能
- ✏️ 支持选择画笔颜色（预设9种颜色 + 自定义）
- 🎨 画笔粗细调节（1-50px）
- 🧹 橡皮擦功能
- 🗑️ 清空画布
- 📱 支持触摸屏绘图（移动端兼容）

### 2. 提交功能
- 必须输入猪的名字（1-20字）
- 自动记录IP属地（仅显示国家/地区）
- 防刷机制：同一IP 10分钟内最多提交3只猪
- 图片以base64格式存储

### 3. 围栏展示
- 网格布局展示所有猪
- 显示猪的名字、来源、创建时间
- 无限滚动分页加载
- 点击查看大图和详细信息

### 4. 点赞功能
- 每只猪可无限次点赞
- 使用localStorage记录已点赞（防止重复）
- 实时更新点赞数

## API接口

### POST /api/pigs
提交新猪
```json
请求体：
{
  "name": "小猪佩奇",
  "image": "data:image/png;base64,..."
}

响应：
{
  "success": true,
  "id": 1,
  "message": "提交成功！"
}
```

### GET /api/pigs?page=0&limit=20
获取猪列表（分页）
```json
响应：
{
  "success": true,
  "total": 100,
  "page": 0,
  "pigs": [...]
}
```

### POST /api/pigs/:id/like
给猪点赞
```json
响应：
{
  "success": true,
  "likes": 42
}
```

### GET /api/pigs/:id
获取单只猪的详情

### GET /api/stats
获取统计信息

## 防刷机制

1. **提交频率限制**
   - 同一IP在10分钟内最多提交3只猪
   - 超过限制返回429状态码

2. **数据验证**
   - 名字长度限制：1-20个字
   - 图片格式验证：必须是base64编码的图片

3. **点赞记录**
   - 前端使用localStorage记录已点赞
   - 防止同一用户重复点赞同一只猪

## 数据库设计

### pigs表
```sql
CREATE TABLE pigs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,           -- 猪的名字
  image TEXT NOT NULL,          -- base64图片
  location TEXT NOT NULL,       -- IP属地
  ip TEXT NOT NULL,             -- IP地址（不对外暴露）
  likes INTEGER DEFAULT 0,      -- 点赞数
  created_at INTEGER NOT NULL   -- 创建时间戳
);
```

### submissions表（防刷记录）
```sql
CREATE TABLE submissions (
  ip TEXT NOT NULL,             -- IP地址
  timestamp INTEGER NOT NULL    -- 提交时间戳
);
```

## 部署到生产环境

### 使用PM2部署（推荐）

```bash
# 安装PM2
npm install -g pm2

# 启动服务
pm2 start server/server.js --name "pig-friends"

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status

# 查看日志
pm2 logs pig-friends
```

### 使用Nginx反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 环境变量配置

可以创建 `.env` 文件配置端口：

```bash
PORT=3000
```

然后修改 `server/server.js` 使用环境变量。

## 性能优化建议

1. **图片优化**
   - 前端限制画布大小（500x500px）
   - 可以添加图片压缩功能

2. **数据库优化**
   - 已创建时间索引加速查询
   - 定期清理过期的submissions记录

3. **缓存策略**
   - 静态资源添加浏览器缓存
   - 考虑使用CDN加速

4. **负载均衡**
   - 多实例部署
   - 使用Redis存储session

## 扩展功能建议

### 已实现
- [x] 基础绘图功能
- [x] 提交到围栏
- [x] 查看所有猪
- [x] 点赞功能
- [x] IP属地显示
- [x] 防刷机制
- [x] 移动端适配

### 可扩展
- [ ] 搜索猪的名字
- [ ] 按国家/地区筛选
- [ ] 按点赞数排序
- [ ] 分享到社交媒体
- [ ] 用户注册登录
- [ ] 评论功能
- [ ] 标签分类
- [ ] 举报功能
- [ ] 管理后台

## 常见问题

### Q: 数据库文件在哪里？
A: 项目根目录会自动生成 `pigs.db` 文件。

### Q: 如何清空数据库？
A: 删除 `pigs.db` 文件，重启服务器会自动创建新数据库。

### Q: 如何修改端口？
A: 修改 `server/server.js` 中的 `PORT` 变量，或使用环境变量。

### Q: 如何备份数据？
A: 直接复制 `pigs.db` 文件即可。

### Q: 本地测试IP属地显示"本地"？
A: 这是正常的，部署到公网后会显示真实属地。

## 联系方式

如有问题或建议，欢迎提Issue或PR！

## 许可证

MIT License

---

🎉 祝你玩得开心！快来画一只属于你的猪吧！

