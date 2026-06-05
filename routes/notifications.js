const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { verifyToken } = require('../middleware/auth');

// 获取我的通知
router.get('/', verifyToken, (req, res) => {
  const notifs = db.where('notifications', { user_id: req.user.id })
    .sort((a, b) => b._created_at.localeCompare(a._created_at))
    .map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      booking_id: n.booking_id,
      is_read: !!n.is_read,
      created_at: n._created_at
    }));

  res.json(notifs);
});

// 未读通知数量
router.get('/unread-count', verifyToken, (req, res) => {
  const count = db.where('notifications', { user_id: req.user.id, is_read: false }).length;
  res.json({ count });
});

// 标记为已读
router.post('/read/:id', verifyToken, (req, res) => {
  db.update('notifications', { id: parseInt(req.params.id), user_id: req.user.id }, { is_read: true, read_at: new Date().toISOString() });
  res.json({ success: true });
});

// 全部标记已读
router.post('/read-all', verifyToken, (req, res) => {
  const notifs = db.where('notifications', { user_id: req.user.id, is_read: false });
  for (const n of notifs) {
    db.update('notifications', { id: n.id }, { is_read: true, read_at: new Date().toISOString() });
  }
  res.json({ success: true, count: notifs.length });
});

// 删除通知
router.delete('/:id', verifyToken, (req, res) => {
  db.remove('notifications', { id: parseInt(req.params.id), user_id: req.user.id });
  res.json({ success: true });
});

// 删除所有通知
router.delete('/all', verifyToken, (req, res) => {
  db.remove('notifications', { user_id: req.user.id });
  res.json({ success: true });
});

module.exports = router;
