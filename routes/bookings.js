const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { verifyToken, requireTeacher } = require('../middleware/auth');
const schedule = require('../utils/schedule');

// ===== 工具函数 =====
function getConfig(key) {
  const entry = db.find('configs', { key });
  return entry ? entry.value : null;
}
function getPrice() { return parseFloat(getConfig('price_per_session') || '100'); }
function getDepositPerSession() { return parseFloat(getConfig('deposit_per_session') || '30'); }

function addN(userId, fromUserId, type, title, message, bookingId) {
  db.insert('notifications', { user_id: userId, from_user_id: fromUserId || 0, type, title, message, booking_id: bookingId || null, is_read: false, read_at: null });
}

// ===== 学生端 =====

// 我的预约列表
router.get('/my', verifyToken, (req, res) => {
  const ub = db.where('bookings', { user_id: req.user.id });
  const slots = db.all('time_slots');
  const result = ub.map(b => {
    const slot = slots.find(s => s.id === b.time_slot_id);
    if (!slot) return null;
    return {
      id: b.id, user_name: b.user_name, user_phone: b.user_phone,
      status: b.status, payment_status: b.payment_status || 'unpaid',
      payment_amount: b.payment_amount, deposit_amount: b.deposit_amount || 0,
      remaining_amount: (b.payment_amount || 0) - (b.deposit_amount || 0),
      session_count: b.session_count || 1, created_at: b._created_at,
      date: slot.date, start_time: slot.start_time, end_time: slot.end_time,
      price_per_session: b.price_per_session || getPrice(),
      deposit_per_session: b.deposit_per_session || getDepositPerSession(),
      note: b.note || ''
    };
  }).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time));
  res.json(result);
});

// 创建预约
router.post('/create', verifyToken, (req, res) => {
  const { date, start_time, note } = req.body;
  if (!date || !start_time) return res.status(400).json({ error: '请选择预约时间' });

  let slot = db.find('time_slots', { date, start_time });
  if (!slot) { schedule.ensureFutureSlots(30); slot = db.find('time_slots', { date, start_time }); }
  if (!slot || slot.status !== 'available') return res.status(400).json({ error: '该时间段已被预约' });

  const pps = getPrice();
  const dps = getDepositPerSession();
  const total = pps;
  const deposit = dps;

  const user = db.findById('users', req.user.id);
  if (!user) return res.status(400).json({ error: '用户不存在' });

  db.update('time_slots', { id: slot.id }, { status: 'booked' });
  const booking = db.insert('bookings', {
    time_slot_id: slot.id, user_id: req.user.id, user_name: user.name, user_phone: user.phone,
    session_count: 1, status: 'confirmed',
    payment_id: null, payment_amount: 0, deposit_amount: 0,
    payment_status: 'none', payment_time: null,
    price_per_session: 0, deposit_per_session: 0,
    deposit_paid: false, remaining_paid: false, note: req.body.note || ''
  });
  db.insert('booking_slots', { booking_id: booking.id, time_slot_id: slot.id });

  // 通知教师
  const teachers = db.where('users', { role: 'teacher' });
  const teacherWechat = getConfig('teacher_wechat') || 'shangsimianshi';
  for (const t of teachers) {
    addN(t.id, user.id, 'booking_created', '📩 新预约提醒',
      `${user.name}（${user.phone}）预约了 ${date} ${start_time}`, booking.id);
  }
  addN(req.user.id, 0, 'booking_confirmed', '✅ 预约成功',
    `已预约 ${date} ${start_time}。课时费课后直接发给老师。老师微信：${teacherWechat}`, booking.id);

  res.json({ success: true, booking: { ...booking, teacher_wechat: teacherWechat } });
});

// 支付定金
router.post('/pay-deposit/:id', verifyToken, (req, res) => {
  const booking = db.find('bookings', { id: parseInt(req.params.id), user_id: req.user.id });
  if (!booking) return res.status(404).json({ error: '预约不存在' });
  if (booking.status !== 'pending_deposit') return res.status(400).json({ error: '当前状态无需支付定金' });

  const dps = booking.deposit_per_session || getDepositPerSession();
  const sc = booking.session_count || 1;
  const depositAmount = sc * dps;

  const { v4: uuid } = require('uuid');
  const pid = 'DEPT_' + uuid().slice(0, 8).toUpperCase();

  db.update('bookings', { id: booking.id }, {
    status: 'confirmed', deposit_amount: depositAmount, deposit_paid: true,
    payment_status: 'partial', payment_id: pid, payment_time: new Date().toISOString()
  });

  const user = db.findById('users', req.user.id);
  const teachers = db.where('users', { role: 'teacher' });
  for (const t of teachers) {
    addN(t.id, req.user.id, 'deposit_paid', '💰 定金已付',
      `${user.name}（${user.phone}）已支付定金 ¥${depositAmount}。课时费课后直接发给老师。`, booking.id);
  }
  addN(req.user.id, 0, 'booking_confirmed', '✅ 预约成功',
    `定金 ¥${depositAmount} 已付。课时费课后直接发给老师，联系电话：${(teachers[0] && db.findById('users', teachers[0].id)?.phone) || ''}`, booking.id);

  res.json({ success: true, message: `定金 ¥${depositAmount} 已支付`, deposit_amount: depositAmount, remaining: (booking.payment_amount || sc * getPrice()) - depositAmount });
});

// 取消预约
router.post('/cancel/:id', verifyToken, (req, res) => {
  const booking = db.find('bookings', { id: parseInt(req.params.id), user_id: req.user.id });
  if (!booking) return res.status(404).json({ error: '预约不存在' });
  if (booking.status === 'cancelled') return res.status(400).json({ error: '已取消' });

  const rs = db.where('booking_slots', { booking_id: booking.id });
  for (const r of rs) db.update('time_slots', { id: r.time_slot_id }, { status: 'available' });
  db.update('bookings', { id: booking.id }, { status: 'cancelled' });

  const user = db.findById('users', req.user.id);
  const teachers = db.where('users', { role: 'teacher' });
  const slot = db.findById('time_slots', booking.time_slot_id);
  const ds = slot ? slot.date : '', ts = slot ? slot.start_time : '';
  for (const t of teachers) {
    addN(t.id, req.user.id, 'booking_cancelled', '❌ 预约已取消',
      `${user.name}（${user.phone}）取消了 ${ds} ${ts} 的预约`, booking.id);
  }
  addN(req.user.id, 0, 'booking_cancelled', '❌ 预约已取消',
    `已取消 ${ds} ${ts} 的预约`, booking.id);
  res.json({ success: true, message: '已取消' });
});

// ===== 教师端 =====

// 所有预约列表
router.get('/all', verifyToken, requireTeacher, (req, res) => {
  const { date, status } = req.query;
  let bookings = db.all('bookings');
  const slots = db.all('time_slots');
  if (date) { const ds = slots.filter(s => s.date === date).map(s => s.id); bookings = bookings.filter(b => ds.includes(b.time_slot_id)); }
  if (status) bookings = bookings.filter(b => b.status === status);
  const result = bookings.map(b => {
    const slot = slots.find(s => s.id === b.time_slot_id);
    if (!slot) return null;
    const pps = b.price_per_session || getPrice();
    const total = (b.session_count || 1) * pps;
    return {
      id: b.id, user_name: b.user_name, user_phone: b.user_phone,
      status: b.status, payment_status: b.payment_status || 'unpaid',
      payment_amount: total, deposit_amount: b.deposit_amount || 0,
      remaining_amount: total - (b.deposit_amount || 0),
      deposit_paid: !!b.deposit_paid, remaining_paid: !!b.remaining_paid,
      session_count: b.session_count || 1, date: slot.date,
      start_time: slot.start_time, end_time: slot.end_time,
      note: b.note || ''
    };
  }).filter(Boolean).sort((a,b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time));
  res.json(result);
});

// 确认定金
router.post('/confirm/:id', verifyToken, requireTeacher, (req, res) => {
  const booking = db.findById('bookings', parseInt(req.params.id));
  if (!booking) return res.status(404).json({ error: '预约不存在' });
  const dps = booking.deposit_per_session || getDepositPerSession();
  const sc = booking.session_count || 1;
  const depAmt = sc * dps;
  db.update('bookings', { id: booking.id }, { status: 'confirmed', deposit_amount: depAmt, deposit_paid: true, payment_status: 'partial', payment_time: new Date().toISOString() });
  addN(booking.user_id, req.user.id, 'booking_confirmed', '✅ 预约已确认',
    `定金 ¥${depAmt} 已到账。上课后课时费直接发给老师即可。`, booking.id);
  res.json({ success: true, message: '已确认' });
});

// 完成课程
router.post('/complete/:id', verifyToken, requireTeacher, (req, res) => {
  const booking = db.findById('bookings', parseInt(req.params.id));
  if (!booking) return res.status(404).json({ error: '预约不存在' });
  db.update('bookings', { id: booking.id }, { status: 'completed' });
  addN(booking.user_id, req.user.id, 'booking_completed', '🎉 课程完成', `课程已顺利完成！请将课时费直接发给老师。`, booking.id);
  res.json({ success: true, message: '课程已完成' });
});

// 教师取消预约
router.post('/admin-cancel/:id', verifyToken, requireTeacher, (req, res) => {
  const booking = db.findById('bookings', parseInt(req.params.id));
  if (!booking) return res.status(404).json({ error: '预约不存在' });
  if (booking.status === 'cancelled') return res.status(400).json({ error: '已取消' });

  const rs = db.where('booking_slots', { booking_id: booking.id });
  for (const r of rs) db.update('time_slots', { id: r.time_slot_id }, { status: 'available' });
  db.update('bookings', { id: booking.id }, { status: 'cancelled' });

  const slot = db.findById('time_slots', booking.time_slot_id);
  const ds = slot ? slot.date : '', ts = slot ? slot.start_time : '';
  const teacher = db.findById('users', req.user.id);
  const refundMsg = booking.deposit_paid
    ? `⚠️ 如需退定金，请直接联系老师微信处理退款。`
    : '';
  addN(booking.user_id, req.user.id, 'booking_cancelled', '❌ 老师取消了预约',
    `老师取消了 ${ds} ${ts} 的预约（${booking.session_count}节）。${refundMsg}`, booking.id);
  res.json({ success: true, message: '预约已取消' });
});

module.exports = router;
