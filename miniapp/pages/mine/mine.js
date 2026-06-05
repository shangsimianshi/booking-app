const api = require('../../utils/api');
const util = require('../../utils/util');
const app = getApp();

Page({
  data: {
    user: null,
    isTeacher: false,
    teacherInfo: null,
    checkinStats: null,
    bookingCount: 0,
    showTeacherMenu: false
  },

  onShow() {
    const user = app.globalData.user || wx.getStorageSync('user') || null;
    if (!user) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    const isTeacher = user.role === 'teacher';
    this.setData({ user, isTeacher });
    if (isTeacher) {
      this.loadTeacherInfo();
    } else {
      this.loadStudentStats();
    }
  },

  async loadTeacherInfo() {
    try {
      const res = await api.getTeacherInfo();
      if (res.code === 0) {
        this.setData({ teacherInfo: res.data });
      }
    } catch (e) {
      console.error('Load teacher info failed:', e);
    }
  },

  async loadStudentStats() {
    try {
      const [chkRes, bookRes] = await Promise.all([
        api.getCheckinStats(),
        api.getMyBookings()
      ]);
      if (chkRes.code === 0) {
        this.setData({ checkinStats: chkRes.data });
      }
      if (bookRes.code === 0 && Array.isArray(bookRes.data)) {
        this.setData({ bookingCount: bookRes.data.length });
      }
    } catch (e) {
      console.error('Load student stats failed:', e);
    }
  },

  goToAdminDashboard() {
    wx.navigateTo({ url: '/pages/admin/admin' });
  },

  goToAdminBookings() {
    wx.navigateTo({ url: '/pages/adminBookings/adminBookings' });
  },

  goToAdminSchedule() {
    wx.navigateTo({ url: '/pages/adminSchedule/adminSchedule' });
  },

  goToAdminCheckins() {
    wx.navigateTo({ url: '/pages/adminCheckins/adminCheckins' });
  },

  goToAdminConfig() {
    wx.navigateTo({ url: '/pages/adminConfig/adminConfig' });
  },

  goToMyBookings() {
    wx.switchTab({ url: '/pages/bookings/bookings' });
  },

  doLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定退出当前账号吗？',
      success(res) {
        if (res.confirm) {
          app.logout();
        }
      }
    });
  }
});
