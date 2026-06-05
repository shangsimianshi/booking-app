const api = require('./utils/api');

App({
  globalData: {
    user: null,
    token: '',
    unreadCount: 0,
    config: null,
    teacherInfo: null,
    wechatConfirmed: false
  },

  onLaunch() {
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
      this.initAuth();
    }
  },

  async initAuth() {
    try {
      const res = await api.getMe();
      if (res.code === 0) {
        this.globalData.user = res.data;
        this.globalData.teacherInfo = res.data;
        this.startPolling();
      } else {
        this.logout();
      }
    } catch (e) {
      console.error('Auth init failed:', e);
    }
  },

  login(user, token) {
    this.globalData.user = user;
    this.globalData.token = token;
    wx.setStorageSync('token', token);
    wx.setStorageSync('user', user);
    this.startPolling();
  },

  logout() {
    this.globalData.user = null;
    this.globalData.token = '';
    this.globalData.teacherInfo = null;
    this.globalData.wechatConfirmed = false;
    this.globalData.unreadCount = 0;
    wx.removeStorageSync('token');
    wx.removeStorageSync('user');
    this.stopPolling();
    wx.reLaunch({ url: '/pages/index/index' });
  },

  async getUnreadCount() {
    try {
      const res = await api.getUnreadCount();
      if (res.code === 0 && res.data) {
        this.globalData.unreadCount = res.data.count || 0;
        this.updateTabBadge();
      }
    } catch (e) {
      console.error('Get unread count failed:', e);
    }
  },

  startPolling() {
    this.stopPolling();
    this.getUnreadCount();
    this._pollTimer = setInterval(() => {
      this.getUnreadCount();
    }, 30000);
  },

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  updateTabBadge() {
    const count = this.globalData.unreadCount;
    if (count > 0) {
      wx.setTabBarBadge({
        index: 3,
        text: count > 99 ? '99+' : String(count)
      });
    } else {
      wx.removeTabBarBadge({ index: 3 });
    }
  }
});
