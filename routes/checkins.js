const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { verifyToken } = require('../middleware/auth');

// 打卡
router.post('/', verifyToken, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  // 检查今日是否已打卡
  const existing = db.find('check_ins', { user_id: req.user.id, date: today });
  if (existing) return res.status(400).json({ error: '今日已打卡' });

  db.insert('check_ins', { user_id: req.user.id, date: today });
  // 计算连续打卡天数
  const streak = calcStreak(req.user.id);
  res.json({ success: true, date: today, streak });
});

// 获取我的打卡记录
router.get('/my', verifyToken, (req, res) => {
  const records = db.where('check_ins', { user_id: req.user.id })
    .sort((a, b) => b.date.localeCompare(a.date));
  const streak = calcStreak(req.user.id);
  const today = new Date().toISOString().split('T')[0];
  const checkedInToday = !!records.find(r => r.date === today);
  res.json({ records, streak, checkedInToday, totalDays: records.length });
});

// 获取所有学生打卡（教师用）
router.get('/all', verifyToken, (req, res) => {
  // 只允许教师查看
  const user = db.findById('users', req.user.id);
  if (!user || user.role !== 'teacher') return res.status(403).json({ error: '仅教师可查看' });

  const allCheckins = db.all('check_ins');
  const allUsers = db.all('users').filter(u => u.role === 'student');
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);

  const result = allUsers.map(u => {
    const userCheckins = allCheckins.filter(c => c.user_id === u.id);
    const monthCheckins = userCheckins.filter(c => c.date.startsWith(thisMonth));
    return {
      user_id: u.id,
      name: u.name,
      phone: u.phone,
      totalDays: userCheckins.length,
      monthDays: monthCheckins.length,
      streak: calcStreakForUser(u.id, allCheckins),
      checkedInToday: !!userCheckins.find(c => c.date === today),
      dates: userCheckins.map(c => c.date)
    };
  }).sort((a, b) => b.streak - a.streak || b.totalDays - a.totalDays);

  res.json(result);
});

// 获取今日打卡统计（教师用）
router.get('/today-stats', verifyToken, (req, res) => {
  const user = db.findById('users', req.user.id);
  if (!user || user.role !== 'teacher') return res.status(403).json({ error: '仅教师可查看' });
  const today = new Date().toISOString().split('T')[0];
  const todayCheckins = db.where('check_ins', { date: today });
  const allStudents = db.all('users').filter(u => u.role === 'student');
  res.json({ checkedIn: todayCheckins.length, totalStudents: allStudents.length, students: todayCheckins.map(c => {
    const u = db.findById('users', c.user_id);
    return u ? { id: u.id, name: u.name } : null;
  }).filter(Boolean) });
});

function calcStreak(userId) {
  const records = db.where('check_ins', { user_id: userId })
    .sort((a, b) => b.date.localeCompare(a.date));
  return calcStreakForUser(userId, records);
}

function calcStreakForUser(userId, allRecords) {
  const userRecords = allRecords.filter(r => r.user_id === userId)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (userRecords.length === 0) return 0;

  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  let checkDate = new Date(today);

  // 如果今天没打卡，从昨天开始算
  if (userRecords[0].date !== today) {
    // 只算连续
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // 算连续天数
  const dates = userRecords.map(r => r.date);
  let current = new Date(checkDate);
  for (let i = 0; i < 365; i++) {
    const ds = current.toISOString().split('T')[0];
    if (dates.includes(ds)) { streak++; current.setDate(current.getDate() - 1); }
    else break;
  }
  return streak;
}

module.exports = router;
