const express = require('express');
const router = express.Router();
const db = require('../db/init');
const schedule = require('../utils/schedule');
const { verifyToken, requireTeacher } = require('../middleware/auth');

// 获取某天可预约时间段
router.get('/available', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: '请提供日期' });
  schedule.ensureFutureSlots(30);
  const uid = req.user ? req.user.id : null;
  const isTeacher = req.user && req.user.role === 'teacher';
  let slots = schedule.getAvailableSlots(date, uid);
  if (!isTeacher) {
    // 学生端：标记 locked/booked 状态，但不隐藏
    slots = slots.map(s => {
      const slot = db.find('time_slots', { date, start_time: s.start_time });
      const status = slot ? slot.status : 'available';
      return { ...s, slot_status: status, can_book: status === 'available' };
    });
  } else {
    // 教师端：标记 slot_status
    slots = slots.map(s => {
      const slot = db.find('time_slots', { date, start_time: s.start_time });
      return { ...s, slot_status: slot ? slot.status : 'available' };
    });
  }
  res.json(slots);
});

// 教师查看某天所有时段（含锁定、已约）
router.get('/all-slots', verifyToken, requireTeacher, (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: '请提供日期' });
  schedule.ensureFutureSlots(30);
  const uid = req.user ? req.user.id : null;
  let slots = schedule.getAvailableSlots(date, uid);
  // 给每个时段加上在库状态
  slots = slots.map(s => {
    const slot = db.find('time_slots', { date, start_time: s.start_time });
    return { ...s, slot_status: slot ? slot.status : 'available', slot_id: slot ? slot.id : null };
  });
  res.json(slots);
});

// 获取有课的日期
router.get('/calendar', (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: '请提供年月' });
  const prefix = `${year}-${String(Number(month)).padStart(2,'0')}`;
  const isTeacher = req.user && req.user.role === 'teacher';
  const statuses = ['available', 'locked', 'booked'];
  const dates = [...new Set(db.all('time_slots').filter(s => s.date.startsWith(prefix) && statuses.includes(s.status)).map(s => s.date))].sort();
  res.json(dates);
});

// ---- 教师端排课管理 ----

// 获取每周模板
router.get('/config', verifyToken, requireTeacher, (req, res) => {
  res.json(db.all('teacher_schedule').sort((a,b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)));
});

// 更新每周模板
router.post('/config', verifyToken, requireTeacher, (req, res) => {
  const { schedules } = req.body;
  if (!Array.isArray(schedules)) return res.status(400).json({ error: '参数错误' });

  // 清除旧模板（保留按日排课）
  const dateScheds = db.all('date_schedules');
  // 清除所有周模板 + 所有 available 时间片
  const slots = db.all('time_slots');
  for (const s of slots) {
    if (s.status === 'available') {
      // 检查这个时间片是否由周模板生成（且没有被按日排课覆盖）
      const hasDateSched = db.find('date_schedules', { date: s.date });
      if (!hasDateSched) db.remove('time_slots', { id: s.id });
    }
  }
  db.remove('teacher_schedule', {});

  for (const s of schedules) {
    db.insert('teacher_schedule', { day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time, is_active: 1 });
  }
  schedule.ensureFutureSlots(30);
  res.json({ success: true, message: '周模板已更新' });
});

// 获取某月的按日排课数据
router.get('/date-schedules', verifyToken, requireTeacher, (req, res) => {
  const { year, month } = req.query;
  const prefix = `${year}-${String(Number(month)).padStart(2,'0')}`;
  const dates = db.where('date_schedules', {}).filter(d => d.date.startsWith(prefix));
  res.json(dates);
});

// 设置某日的排课（覆盖周模板）
router.post('/date-schedule', verifyToken, requireTeacher, (req, res) => {
  const { date, schedules } = req.body; // schedules: [{start_time, end_time}]
  if (!date) return res.status(400).json({ error: '请提供日期' });

  // 清除该日旧的按日排课
  db.remove('date_schedules', { date });

  // 插入新的
  if (schedules && schedules.length > 0) {
    for (const s of schedules) {
      db.insert('date_schedules', { date, start_time: s.start_time, end_time: s.end_time });
    }
  }

  // 重新生成该日时间片
  db.remove('time_slots', { date });
  schedule.ensureFutureSlots(30);
  res.json({ success: true, message: schedules && schedules.length > 0 ? '已设置该日排课' : '已清除该日排课，使用周模板' });
});

// ---- 特殊日期 ----
router.get('/special-dates', verifyToken, requireTeacher, (req, res) => {
  res.json(db.all('special_dates').sort((a,b) => a.date.localeCompare(b.date)));
});

router.post('/special-dates', verifyToken, requireTeacher, (req, res) => {
  const { date, is_off, note } = req.body;
  if (!date) return res.status(400).json({ error: '请提供日期' });
  const existing = db.find('special_dates', { date });
  if (existing) db.update('special_dates', { date }, { is_off: is_off !== undefined ? is_off : 1, note: note||'' });
  else db.insert('special_dates', { date, is_off: is_off !== undefined ? is_off : 1, note: note||'' });
  db.remove('time_slots', { date });
  schedule.ensureFutureSlots(30);
  res.json({ success: true });
});

router.delete('/special-dates/:date', verifyToken, requireTeacher, (req, res) => {
  db.remove('special_dates', { date: req.params.date });
  db.remove('time_slots', { date: req.params.date });
  schedule.ensureFutureSlots(30);
  res.json({ success: true });
});

// ---- 教师锁定/解锁时段 ----
router.post('/lock', verifyToken, requireTeacher, (req, res) => {
  const { date, start_time } = req.body;
  if (!date || !start_time) return res.status(400).json({ error: '请提供日期和时间' });
  let slot = db.find('time_slots', { date, start_time });
  if (!slot) {
    schedule.ensureFutureSlots(30);
    slot = db.find('time_slots', { date, start_time });
  }
  if (!slot) return res.status(400).json({ error: '该时段不存在' });
  if (slot.status === 'booked') return res.status(400).json({ error: '该时段已被预约，无法锁定' });
  db.update('time_slots', { id: slot.id }, { status: 'locked' });
  res.json({ success: true, message: '已锁定' });
});

router.post('/unlock', verifyToken, requireTeacher, (req, res) => {
  const { date, start_time } = req.body;
  if (!date || !start_time) return res.status(400).json({ error: '请提供日期和时间' });
  const slot = db.find('time_slots', { date, start_time });
  if (!slot) return res.status(400).json({ error: '该时段不存在' });
  if (slot.status !== 'locked') return res.status(400).json({ error: '该时段未锁定' });
  db.update('time_slots', { id: slot.id }, { status: 'available' });
  res.json({ success: true, message: '已解锁' });
});

module.exports = router;
