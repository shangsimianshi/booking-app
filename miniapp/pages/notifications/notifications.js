const api = require('../../utils/api');
const util = require('../../utils/util');
const app = getApp();

Page({
  data: {
    notifications: [],
    loading: false,
    util: util
  },

  onShow() {
    this.loadNotifications();
  },

  async loadNotifications() {
    this.setData({ loading: true });
    try {
      const res = await api.getNotifications();
      if (res.code === 0) {
        this.setData({ notifications: res.data || [] });
        app.getUnreadCount();
      }
    } catch (e) {
      console.error('Load notifications failed:', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  async readNotif(e) {
    const id = e.currentTarget.dataset.id;
    const notif = this.data.notifications.find(n => n.id === id);
    if (!notif || notif.is_read) return;

    try {
      await api.readNotification(id);
      this.loadNotifications();
    } catch (e) {
      console.error('Read notification failed:', e);
    }
  },

  async readAll() {
    try {
      await api.readAllNotifications();
      util.showToast('已全部标记为已读');
      this.loadNotifications();
    } catch (e) {
      util.showToast('操作失败');
    }
  },

  async deleteOne(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await api.deleteNotification(id);
      this.loadNotifications();
    } catch (e) {
      console.error('Delete failed:', e);
    }
  },

  async deleteAll() {
    wx.showModal({
      title: '清除全部消息',
      content: '确定清除所有消息吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.deleteAllNotifications();
            util.showToast('已清除');
            this.loadNotifications();
          } catch (e) {
            util.showToast('操作失败');
          }
        }
      }
    });
  }
});
