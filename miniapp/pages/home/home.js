const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    currentYear: 0,
    currentMonth: 0,
    currentDate: '',
    selectedDate: '',
    selectedSlots: [],
    slots: [],
    slotsLoading: false,
    calendarDates: [],
    weekHeaders: ['日', '一', '二', '三', '四', '五', '六'],
    teacherInfo: null,
    teacherWechat: 'shangsimianshi',
    wechatConfirmed: false,
    note: '',
    util: util,
    totalDeposit: 0
  },

  onLoad() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      currentDate: util.fmtDate(now)
    });
    this.loadTeacherInfo();
    this.buildCalendar();
  },

  onShow() {
    this.loadTeacherInfo();
    if (this.data.selectedDate) {
      this.loadSlots();
    }
  },

  async loadTeacherInfo() {
    try {
      const res = await api.getTeacherInfo();
      if (res.code === 0 && res.data) {
        this.setData({ 
          teacherInfo: res.data,
          teacherWechat: res.data.wechat || 'shangsimianshi'
        });
      }
    } catch (e) {
      console.error('Load teacher info failed:', e);
    }
  },

  buildCalendar() {
    const { currentYear, currentMonth } = this.data;
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = util.dim(currentYear, currentMonth);
    const daysInPrev = util.dim(currentMonth === 1 ? currentYear - 1 : currentYear, currentMonth === 1 ? 12 : currentMonth - 1);
    const todayStr = this.data.currentDate;
    const selectedStr = this.data.selectedDate;

    const dates = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrev - i;
      const m = currentMonth === 1 ? 12 : currentMonth - 1;
      const y = currentMonth === 1 ? currentYear - 1 : currentYear;
      const dateStr = y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      dates.push({
        day, date: dateStr,
        isToday: dateStr === todayStr, isSelected: dateStr === selectedStr,
        isCurrentMonth: false, hasSlots: false
      });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = currentYear + '-' + String(currentMonth).padStart(2, '0') + '-' + String(i).padStart(2, '0');
      dates.push({
        day: i, date: dateStr,
        isToday: dateStr === todayStr, isSelected: dateStr === selectedStr,
        isCurrentMonth: true, hasSlots: false
      });
    }
    const totalCells = Math.ceil(dates.length / 7) * 7;
    for (let i = 1; dates.length < totalCells; i++) {
      const m = currentMonth === 12 ? 1 : currentMonth + 1;
      const y = currentMonth === 12 ? currentYear + 1 : currentYear;
      const dateStr = y + '-' + String(m).padStart(2, '0') + '-' + String(i).padStart(2, '0');
      dates.push({
        day: i, date: dateStr,
        isToday: dateStr === todayStr, isSelected: dateStr === selectedStr,
        isCurrentMonth: false, hasSlots: false
      });
    }

    this.setData({ calendarDates: dates });
    this.loadCalendarDots();
  },

  async loadCalendarDots() {
    const { currentYear, currentMonth } = this.data;
    try {
      const res = await api.getCalendar(currentYear, currentMonth);
      if (res.code === 0 && res.data) {
        const dotDates = new Set(res.data);
        const dates = this.data.calendarDates.map(d => ({ ...d, hasSlots: dotDates.has(d.date) }));
        this.setData({ calendarDates: dates });
      }
    } catch (e) {
      console.error('Load calendar dots failed:', e);
    }
  },

  changeMonth(delta) {
    let { currentYear, currentMonth } = this.data;
    currentMonth += delta;
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    else if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    this.setData({ currentYear, currentMonth, selectedDate: '', selectedSlots: [], slots: [], note: '' });
    this.buildCalendar();
  },

  prevMonth() { this.changeMonth(-1); },
  nextMonth() { this.changeMonth(1); },

  selectDate(e) {
    const date = e.currentTarget.dataset.date;
    this.setData({ selectedDate: date, selectedSlots: [], totalDeposit: 0, note: '' });
    this.buildCalendar();
    this.loadSlots();
  },

  async loadSlots() {
    const { selectedDate } = this.data;
    if (!selectedDate) return;
    this.setData({ slotsLoading: true });
    try {
      const res = await api.getAvailableSlots(selectedDate);
      if (res.code === 0) {
        this.setData({ slots: res.data || [] });
      } else {
        this.setData({ slots: [] });
      }
    } catch (e) {
      this.setData({ slots: [] });
      util.showToast('加载时段失败');
    } finally {
      this.setData({ slotsLoading: false });
    }
  },

  // 点击时段（统一入口，内部判断是否可选中）
  onSlotTap(e) {
    const slotTime = e.currentTarget.dataset.slot;
    const slots = this.data.slots;
    const slot = slots.find(s => s.start_time === slotTime);
    if (!slot || !slot.can_book) return;
    this.toggleSlot(slotTime);
  },

  // 多选：切换选中状态
  toggleSlot(slotTime) {
    const slots = this.data.slots.map(s => {
      if (s.start_time === slotTime) {
        const newSel = !s.selected;
        return { ...s, selected: newSel };
      }
      return s;
    });
    const selectedSlots = slots.filter(s => s.selected);
    this.setData({
      slots,
      selectedSlots: selectedSlots || [],
      totalDeposit: selectedSlots.length * 50 // default deposit ¥50/slot
    });
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  confirmWechat() {
    this.setData({ wechatConfirmed: true });
    util.showToast('已确认');
  },

  async confirmBooking() {
    const that = this;
    const { selectedDate, selectedSlots, note, wechatConfirmed, teacherInfo } = this.data;

    if (!selectedDate || selectedSlots.length === 0) {
      util.showToast('请选择上课时段');
      return;
    }

    if (teacherInfo && teacherInfo.wechat && !wechatConfirmed) {
      wx.showModal({
        title: '添加教师微信',
        content: '请先添加教师微信：' + teacherInfo.wechat + '，确认后再预约',
        confirmText: '已添加',
        success(res) {
          if (res.confirm) {
            that.setData({ wechatConfirmed: true });
            that.confirmBooking();
          }
        }
      });
      return;
    }

    const slotList = selectedSlots.map(s => s.start_time).join('、');
    const totalDeposit = selectedSlots.length * 50;

    wx.showModal({
      title: '确认预约',
      content: '确定预约 ' + selectedDate + ' ' + slotList + ' 共' + selectedSlots.length + '节吗？',
      success: async (res) => {
        if (res.confirm) {
          util.showLoading(true);
          try {
            let successCount = 0;
            for (const slot of selectedSlots) {
              const result = await api.createBooking(selectedDate, slot.start_time, note);
              if (result.code === 0) successCount++;
            }
            if (successCount > 0) {
              wx.showModal({
                title: '✅ 预约成功',
                content: '已成功预约 ' + successCount + ' 节课程！\n\n请添加老师微信：shangsimianshi\n课时费请于课后直接发给老师。',
                showCancel: false
              });
              that.setData({ selectedSlots: [], totalDeposit: 0, note: '' });
              that.loadSlots();
              that.loadCalendarDots();
            } else {
              util.showToast('预约失败，请重试');
            }
          } catch (e) {
            util.showToast('网络错误，请稍后重试');
          } finally {
            util.showLoading(false);
          }
        }
      }
    });
  }
});
