const api = require('../../utils/api');
const util = require('../../utils/util');
const app = getApp();

Page({
  data: {
    stats: {},
    loading: false
  },

  onShow() {
    const user = app.globalData.user;
    if (!user) {
      // Auth not loaded yet, check storage directly
      try {
        const stored = wx.getStorageSync('user');
        if (stored && stored.role === 'teacher') {
          // OK, will load stats below
        } else {
          wx.showToast({ title: '请先登录', icon: 'none' });
          wx.reLaunch({ url: '/pages/index/index' });
          return;
        }
      } catch(e) {
        wx.reLaunch({ url: '/pages/index/index' });
        return;
      }
    } else if (user.role !== 'teacher') {
      wx.showToast({ title: '仅教师可访问', icon: 'none' });
      wx.navigateBack({ delta: 1 });
      return;
    }
    this.loadStats();
  },

  async loadStats() {
    this.setData({ loading: true });
    try {
      const res = await api.getStats();
      if (res.code === 0) {
        this.setData({ stats: res.data || {} });
      }
    } catch (e) {
      console.error('Load stats failed:', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  goToBookings() {
    wx.navigateTo({ url: '/pages/adminBookings/adminBookings' });
  },

  goToSchedule() {
    wx.navigateTo({ url: '/pages/adminSchedule/adminSchedule' });
  },

  goToConfig() {
    wx.navigateTo({ url: '/pages/adminConfig/adminConfig' });
  },

  goToCheckins() {
    wx.navigateTo({ url: '/pages/adminCheckins/adminCheckins' });
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
