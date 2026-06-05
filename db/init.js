/**
 * 迷你 JSON 数据库
 */
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const tables = {};

function getFilePath(name) { return path.join(DB_DIR, `${name}.json`); }

function loadTable(name) {
  const fp = getFilePath(name);
  if (fs.existsSync(fp)) {
    try { tables[name] = JSON.parse(fs.readFileSync(fp, 'utf8')); }
    catch { tables[name] = []; }
  } else { tables[name] = []; }
}

function saveTable(name) {
  fs.writeFileSync(getFilePath(name), JSON.stringify(tables[name], null, 2), 'utf8');
}

const ALL_TABLES = ['users','teacher_schedule','date_schedules','special_dates','time_slots','bookings','booking_slots','notifications','configs','check_ins'];
ALL_TABLES.forEach(loadTable);
if (tables.configs.length === 0) {
  tables.configs.push({ id: 1, key: 'price_per_session', value: '200' },
    { id: 2, key: 'deposit_per_session', value: '50' },
    { id: 3, key: 'teacher_wechat', value: 'shangsimianshi' },
    { id: 4, key: 'teacher_name', value: '老师' });
  saveTable('configs');
}

const MiniDB = {
  all(table) { return tables[table] || []; },
  where(table, conditions) {
    let rows = tables[table] || [];
    for (const [k, v] of Object.entries(conditions)) rows = rows.filter(r => r[k] === v);
    return rows;
  },
  find(table, conditions) { const r = MiniDB.where(table, conditions); return r.length > 0 ? r[0] : null; },
  findById(table, id) { return (tables[table]||[]).find(r => r.id === id) || null; },
  insert(table, data) {
    const rows = tables[table];
    const id = rows.length > 0 ? Math.max(...rows.map(r => r.id)) + 1 : 1;
    const row = { id, ...data, _created_at: new Date().toISOString() };
    rows.push(row); saveTable(table);
    return row;
  },
  update(table, conditions, data) {
    const rows = tables[table] || []; let count = 0;
    for (let i = 0; i < rows.length; i++) {
      let match = true;
      for (const [k, v] of Object.entries(conditions)) if (rows[i][k] !== v) { match = false; break; }
      if (match) { Object.assign(rows[i], data); count++; }
    }
    if (count > 0) saveTable(table);
    return count;
  },
  updateById(table, id, data) { return MiniDB.update(table, { id }, data); },
  remove(table, conditions) {
    const rows = tables[table]; if (!rows) return 0;
    const before = rows.length;
    for (const [k, v] of Object.entries(conditions))
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i][k] === v) rows.splice(i, 1);
    const removed = before - rows.length;
    if (removed > 0) saveTable(table);
    return removed;
  }
};

module.exports = MiniDB;
