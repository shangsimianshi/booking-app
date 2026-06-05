/**
 * 排课工具函数
 * 支持：每周模板 + 按日单独排课（覆盖周模板）
 */
const db = require('../db/init');

function parseTime(t) { const [h,m] = t.split(':').map(Number); return h*60+m; }
function fmtTime(m) { return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; }

/**
 * 获取某日的时间段（优先按日排课，其次周模板）
 */
function getDaySchedules(date) {
  const dayOfWeek = new Date(date).getDay();
  // 1. 检查按日排课
  const dateScheds = db.where('date_schedules', { date });
  if (dateScheds.length > 0) return dateScheds;
  // 2. 检查特殊日期（停课/补课）
  const special = db.find('special_dates', { date });
  if (special && special.is_off === 1) return [];
  // 3. 退回周模板
  return db.where('teacher_schedule', { day_of_week: dayOfWeek, is_active: 1 });
}

/**
 * 生成某日所有可用时间片
 */
function generateSlotsForDate(date) {
  const schedules = getDaySchedules(date);
  if (schedules.length === 0) return [];

  const slots = [];
  for (const sched of schedules) {
    const startMin = parseTime(sched.start_time);
    const endMin = parseTime(sched.end_time);
    let cursor = startMin;
    while (cursor + 60 <= endMin) {
      slots.push({
        date,
        start_time: fmtTime(cursor),
        end_time: fmtTime(cursor + 60)
      });
      cursor += 75; // 60分钟 + 15分钟休息
    }
  }
  return slots;
}

function batchInsertSlots(slots) {
  if (slots.length === 0) return [];
  const inserted = [];
  for (const slot of slots) {
    if (!db.find('time_slots', { date: slot.date, start_time: slot.start_time })) {
      inserted.push(db.insert('time_slots', { ...slot, status: 'available' }));
    }
  }
  return inserted;
}

/**
 * 获取某日可预约时间段
 */
function getAvailableSlots(date, excludeUserId) {
  const schedules = getDaySchedules(date);
  if (schedules.length === 0) return [];

  const allBookings = db.all('bookings').filter(b => b.status === 'confirmed' || b.status === 'pending_deposit');
  const allSlots = db.all('time_slots');

  // 计算已占用的区间
  const occupied = [];
  for (const booking of allBookings) {
    const slot = allSlots.find(s => s.id === booking.time_slot_id);
    if (!slot || slot.date !== date) continue;
    const s = parseTime(slot.start_time);
    let e = parseTime(slot.end_time);
    const related = db.where('booking_slots', { booking_id: booking.id });
    for (const rs of related) {
      const s2 = allSlots.find(x => x.id === rs.time_slot_id && x.date === date);
      if (s2) { const ee = parseTime(s2.end_time); if (ee > e) e = ee; }
    }
    occupied.push({ start: s, end: e, userId: booking.user_id });
  }

  const availableSlots = [];
  for (const sched of schedules) {
    const schedStart = parseTime(sched.start_time);
    const schedEnd = parseTime(sched.end_time);
    let cursor = schedStart;
    while (cursor + 60 <= schedEnd) {
      const slotStart = cursor;
      const slotEnd = cursor + 60;
      let canBook = true;
      for (const occ of occupied) {
        if (slotStart < occ.end && slotEnd > occ.start) {
          if (!excludeUserId || occ.userId !== excludeUserId) { canBook = false; break; }
        }
        if (occ.end <= slotStart && slotStart - occ.end < 15) {
          if (!excludeUserId || occ.userId !== excludeUserId) { canBook = false; break; }
        }
        if (occ.start >= slotEnd && occ.start - slotEnd < 15) {
          if (!excludeUserId || occ.userId !== excludeUserId) { canBook = false; break; }
        }
      }
      if (!canBook) { cursor += 75; continue; }

      const startStr = fmtTime(slotStart);
      const existing = db.find('time_slots', { date, start_time: startStr });
      if (existing && existing.status === 'booked') { cursor += 75; continue; }

      availableSlots.push({ start_time: startStr, end_time: fmtTime(slotEnd) });
      cursor += 75;
    }
  }
  return availableSlots;
}

/**
 * 确保未来N天的时间片已生成
 */
function ensureFutureSlots(days = 30) {
  const today = new Date();
  let count = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    if (db.where('time_slots', { date: ds }).length === 0) {
      count += batchInsertSlots(generateSlotsForDate(ds)).length;
    }
  }
  return count;
}

module.exports = { generateSlotsForDate, batchInsertSlots, getAvailableSlots, ensureFutureSlots, getDaySchedules };
