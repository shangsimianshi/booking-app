const api = require('../../utils/api');
const util = require('../../utils/util');
const app = getApp();

const DAY_NM = ['周日','周一','周二','周三','周四','周五','周六'];

Page({
  data: {
    DAY_NM: DAY_NM, weekConfig: [], weekDisplays: [], calDates: [],
    schedYear: 0, schedMonth: 0, dateSchedules: [],
    specialDates: [], specDate: '', specOff: '1', specNote: '',
    // 时段编辑状态
    editing: false,          // 是否在编辑中
    editTitle: '',           // 编辑标题
    editDay: -1,             // 周几(0-6), 按日排课用-1
    editDate: '',            // 按日排课时的日期
    editRanges: [],          // 当前编辑的时间段 [{start_time, end_time}, ...]
    editStart: '09:00',      // 新增起始时间
    editEnd: '10:00',        // 新增结束时间
    util: util
  },

  onLoad() {
    const user = app.globalData.user;
    if (!user || user.role !== 'teacher') {
      wx.showToast({ title: '仅教师可访问', icon: 'none' });
      wx.navigateBack({ delta: 1 });
      return;
    }
    const n = new Date();
    this.setData({ schedYear: n.getFullYear(), schedMonth: n.getMonth() });
    this.buildCal();
    this.loadAll();
  },

  buildCal() {
    const { schedYear, schedMonth, dateSchedules } = this.data;
    const dim = util.dim(schedYear, schedMonth + 1);
    const fd = new Date(schedYear, schedMonth, 1).getDay();
    const today = util.fmtDate(new Date());
    const ds = (dateSchedules || []).map(d => d.date);
    const dates = [];
    for (let i = 0; i < fd; i++) dates.push({ day: '', date: '', cls: 'day-cell' });
    for (let d = 1; d <= dim; d++) {
      const dateStr = schedYear + '-' + String(schedMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      let cls = 'day-cell';
      if (ds.includes(dateStr)) cls += ' has-slot';
      if (dateStr < today) cls += ' disabled';
      dates.push({ day: d, date: dateStr, cls });
    }
    this.setData({ calDates: dates });
  },

  async loadAll() {
    try {
      const [c, sd] = await Promise.all([
        api.getScheduleConfig(),
        api.getSpecialDates()
      ]);
      const wc = (c.code === 0 && c.data) ? c.data : [];
      this.setData({
        weekConfig: wc,
        specialDates: (sd.code === 0 && sd.data) ? sd.data : []
      });
      this.updateWeekDisplays(wc);
    } catch(e) { console.error(e); }
    this.loadDateSched();
  },

  updateWeekDisplays(wc) {
    const displays = DAY_NM.map((name, day) => {
      const items = wc.filter(s => s.day_of_week === day);
      return { day, name, text: items.map(s => s.start_time + '-' + s.end_time).join('、'), hasVal: items.length > 0 };
    });
    this.setData({ weekDisplays: displays });
  },

  async loadDateSched() {
    try {
      const r = await api.getDateSchedules(this.data.schedYear, this.data.schedMonth + 1);
      this.setData({ dateSchedules: r.code === 0 && r.data ? r.data : [] });
    } catch(e) { console.error(e); }
    this.buildCal();
  },

  chMonth(d) {
    let m = this.data.schedMonth + d, y = this.data.schedYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    this.setData({ schedMonth: m, schedYear: y });
    this.buildCal();
    this.loadDateSched();
  },

  // ---- 时段编辑器 ----

  // 点击周模板一行
  editWeekDay(e) {
    const day = parseInt(e.currentTarget.dataset.day);
    const cur = this.data.weekConfig.filter(s => s.day_of_week === day);
    const ranges = cur.map(s => ({ start_time: s.start_time, end_time: s.end_time }));
    this.setData({
      editing: true, editTitle: DAY_NM[day] + ' 排课',
      editDay: day, editDate: '', editRanges: ranges,
      editStart: '09:00', editEnd: '10:00'
    });
  },

  // 点击日历某天
  editDate(e) {
    const date = e.currentTarget.dataset.date;
    if (!date) return;
    const cur = this.data.dateSchedules.find(d => d.date === date);
    const ranges = cur ? (cur.schedules || []).map(s => ({ start_time: s.start_time, end_time: s.end_time })) : [];
    this.setData({
      editing: true, editTitle: util.fmtDisplay(date) + ' 单独排课',
      editDay: -1, editDate: date, editRanges: ranges,
      editStart: '09:00', editEnd: '10:00'
    });
  },

  // 添加时段
  addRange() {
    const { editRanges, editStart, editEnd } = this.data;
    if (editStart >= editEnd) {
      util.showToast('开始时间必须早于结束时间');
      return;
    }
    // 检查重叠
    const overlap = editRanges.some(r => editStart < r.end_time && editEnd > r.start_time);
    if (overlap) {
      util.showToast('时段与已有时段重叠');
      return;
    }
    editRanges.push({ start_time: editStart, end_time: editEnd });
    editRanges.sort((a, b) => a.start_time.localeCompare(b.start_time));
    this.setData({ editRanges });
  },

  // 删除一个时段
  removeRange(e) {
    const idx = parseInt(e.currentTarget.dataset.idx);
    const editRanges = this.data.editRanges.filter((_, i) => i !== idx);
    this.setData({ editRanges });
  },

  // 选择起始时间
  onEditStartChange(e) {
    const time = e.detail.value;
    this.setData({ editStart: time });
  },

  onEditEndChange(e) {
    const time = e.detail.value;
    if (time <= this.data.editStart) {
      util.showToast('结束时间必须晚于开始时间');
      return;
    }
    this.setData({ editEnd: time });
  },

  // 保存
  async saveEdit() {
    const { editDay, editDate, editRanges } = this.data;
    if (editDay >= 0) {
      // 保存周模板
      const others = this.data.weekConfig.filter(s => s.day_of_week !== editDay);
      const schedules = editRanges.map(r => ({ day_of_week: editDay, start_time: r.start_time, end_time: r.end_time }));
      const newWc = [...others, ...schedules];
      this.setData({ weekConfig: newWc });
      this.updateWeekDisplays(newWc);
    } else if (editDate) {
      // 保存按日排课
      try {
        const schedules = editRanges.map(r => ({ start_time: r.start_time, end_time: r.end_time }));
        await api.setDateSchedule(editDate, schedules);
        util.showToast('✅ 已保存');
        this.loadDateSched();
      } catch(e) { util.showToast('保存失败'); return; }
    }
    this.cancelEdit();
  },

  cancelEdit() {
    this.setData({ editing: false, editDay: -1, editDate: '', editRanges: [] });
  },

  async saveWeekConfig() {
    // 保存所有周模板
    try {
      await api.saveScheduleConfig(this.data.weekConfig);
      util.showToast('✅ 周模板已保存');
    } catch(e) { util.showToast('保存失败'); }
  },

  // ---- 特殊日期 ----
  onSpecDate(e) { this.setData({ specDate: e.detail.value }); },
  onSpecType(e) { this.setData({ specOff: e.detail.value }); },
  onSpecNote(e) { this.setData({ specNote: e.detail.value }); },

  async addSpec() {
    if (!this.data.specDate) return util.showToast('请选择日期');
    try {
      await api.addSpecialDate(this.data.specDate, parseInt(this.data.specOff), this.data.specNote);
      util.showToast('已添加');
      this.setData({ specDate: '', specNote: '' });
      this.loadAll();
    } catch(e) { util.showToast('添加失败'); }
  },

  async delSpec(e) {
    const date = e.currentTarget.dataset.date;
    wx.showModal({
      title: '删除',
      content: '确定删除？',
      success: async (r) => {
        if (!r.confirm) return;
        try { await api.deleteSpecialDate(date); this.loadAll(); } catch(e) {}
      }
    });
  }
});
