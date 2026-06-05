const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    streak: 0,
    checkedInToday: false,
    checkinYear: 0,
    checkinMonth: 0,
    checkinDates: [],
    recentCheckins: [],
    weekHeaders: ['日', '一', '二', '三', '四', '五', '六'],
    util: util
  },

  onLoad() {
    const now = new Date();
    this.setData({
      checkinYear: now.getFullYear(),
      checkinMonth: now.getMonth() + 1
    });
    this.loadCheckins();
  },

  onShow() {
    this.loadCheckins();
  },

  async loadCheckins() {
    try {
      const res = await api.getMyCheckins();
      if (res.code === 0) {
        const data = res.data || {};
        const records = data.records || [];
        this.setData({
          streak: data.streak || 0,
          checkedInToday: data.checkedInToday || false,
          recentCheckins: records.slice(0, 10)
        });
        this.buildCheckinCalendar(records.map(r => r.date).filter(Boolean));
      }
    } catch (e) {
      console.error('Load checkins failed:', e);
    }
  },

  buildCheckinCalendar(checkedDates) {
    const { checkinYear, checkinMonth } = this.data;
    const firstDay = new Date(checkinYear, checkinMonth - 1, 1).getDay();
    const daysInMonth = util.dim(checkinYear, checkinMonth);
    const todayStr = util.fmtDate(new Date());
    const checkedSet = new Set(checkedDates);

    const dates = [];
    for (let i = 0; i < firstDay; i++) {
      dates.push({ day: '', date: '', isToday: false, checked: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = checkinYear + '-' + String(checkinMonth).padStart(2, '0') + '-' + String(i).padStart(2, '0');
      dates.push({
        day: i,
        date: dateStr,
        isToday: dateStr === todayStr,
        checked: checkedSet.has(dateStr)
      });
    }

    this.setData({ checkinDates: dates });
  },

  changeMonth(delta) {
    let { checkinYear, checkinMonth } = this.data;
    checkinMonth += delta;
    if (checkinMonth > 12) {
      checkinMonth = 1;
      checkinYear++;
    } else if (checkinMonth < 1) {
      checkinMonth = 12;
      checkinYear--;
    }
    this.setData({ checkinYear, checkinMonth });
    this.loadCheckins();
  },

  prevMonth() {
    this.changeMonth(-1);
  },

  nextMonth() {
    this.changeMonth(1);
  },

  async doCheckin() {
    util.showLoading(true);
    try {
      const res = await api.checkIn();
      if (res.code === 0) {
        util.showToast('打卡成功 🎉');
        this.loadCheckins();
      } else {
        util.showToast(res.message || '打卡失败');
      }
    } catch (e) {
      util.showToast('网络错误');
    } finally {
      util.showLoading(false);
    }
  }
});
