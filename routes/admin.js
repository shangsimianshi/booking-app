const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { verifyToken, requireTeacher } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// 获取统计数据
router.get('/stats', verifyToken, requireTeacher, (req, res) => {
  const bookings = db.all('bookings');
  const active = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
  const ts = new Date().toISOString().split('T')[0];
  const slots = db.all('time_slots');
  res.json({
    totalStudents: new Set(active.map(b => b.user_id)).size,
    totalBookings: active.length,
    todayBookings: active.filter(b => { const s = slots.find(x => x.id === b.time_slot_id); return s && s.date === ts; }).length,
    pendingPayments: bookings.filter(b => b.status === 'pending_deposit').length,
    totalRevenue: active.reduce((s, b) => s + (b.deposit_amount || 0), 0)
  });
});

// 获取配置
router.get('/config', verifyToken, requireTeacher, (req, res) => {
  const c = {}; for (const e of db.all('configs')) c[e.key] = e.value;
  res.json(c);
});

// 更新配置
router.post('/config', verifyToken, requireTeacher, (req, res) => {
  const upsert = (k, v) => {
    const e = db.find('configs', { key: k });
    if (e) db.update('configs', { key: k }, { value: String(v) });
    else db.insert('configs', { key: k, value: String(v) });
  };
  if (req.body.price_per_session !== undefined) {
    const p = parseFloat(req.body.price_per_session);
    if (isNaN(p) || p <= 0) return res.status(400).json({ error: '价格无效' });
    upsert('price_per_session', p);
  }
  if (req.body.deposit_per_session !== undefined) {
    const d = parseFloat(req.body.deposit_per_session);
    if (isNaN(d) || d < 0) return res.status(400).json({ error: '定金金额无效' });
    upsert('deposit_per_session', d);
  }
  if (req.body.teacher_wechat !== undefined) upsert('teacher_wechat', req.body.teacher_wechat);
  if (req.body.teacher_name !== undefined) upsert('teacher_name', req.body.teacher_name);
  res.json({ success: true, message: '配置已更新' });
});

// 获取教师公开信息
router.get('/teacher-info', (req, res) => {
  const c = {}; for (const e of db.all('configs')) c[e.key] = e.value;
  const t = db.find('users', { role: 'teacher' });
  res.json({ name: c.teacher_name || (t ? t.name : '老师'), wechat: c.teacher_wechat || '' });
});

// 初始化教师账号
router.post('/init-teacher', (req, res) => {
  const { name, phone, password } = req.body;
  if (!name || !phone || !password) return res.status(400).json({ error: '请填写完整信息' });
  if (db.where('users', { role: 'teacher' }).length > 0) return res.status(400).json({ error: '教师账号已存在，请登录' });
  db.insert('users', { name, phone, password: bcrypt.hashSync(password, 10), role: 'teacher', openid: null });
  res.json({ success: true, message: '教师账号创建成功，请登录' });
});

module.exports = router;
