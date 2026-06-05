const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 初始化数据库（同步，因为 MiniDB 是同步的）
require('./db/init');

// 自动生成未来时间片
const schedule = require('./utils/schedule');
schedule.ensureFutureSlots(30);

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/slots', require('./routes/slots'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/checkins', require('./routes/checkins'));

// SPA 前端路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎯 约课系统已启动`);
  console.log(`📍 本地访问: http://localhost:${PORT}`);
  console.log(`📱 局域网访问: http://你的IP:${PORT}`);
  console.log(`👨‍🏫 首次使用请先注册教师账号`);
});
