const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { generateToken } = require('../middleware/auth');

// 学生登录/注册
router.post('/login', (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: '请填写姓名和手机号' });
  }
  if (!/^1\d{10}$/.test(phone)) {
    return res.status(400).json({ error: '请输入正确的手机号' });
  }

  let user = db.find('users', { phone });
  if (user) {
    db.update('users', { phone }, { name });
    user.name = name;
  } else {
    user = db.insert('users', { name, phone, role: 'student', openid: null, password: null });
  }

  const token = generateToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, phone: user.phone, role: user.role }
  });
});

// 教师登录
router.post('/teacher-login', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: '请填写手机号和密码' });
  }

  const user = db.find('users', { phone, role: 'teacher' });
  if (!user) {
    return res.status(401).json({ error: '账号或密码错误' });
  }

  const bcrypt = require('bcryptjs');
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '账号或密码错误' });
  }

  const token = generateToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, phone: user.phone, role: user.role }
  });
});

// 获取当前用户信息
const { verifyToken } = require('../middleware/auth');
router.get('/me', verifyToken, (req, res) => {
  const user = db.findById('users', req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ id: user.id, name: user.name, phone: user.phone, role: user.role });
});

module.exports = router;
