const api = require('../../utils/api');
const util = require('../../utils/util');
const app = getApp();

Page({
  data: {
    bookings: [],
    loading: false,
    lockDate: '',
    lockSlots: [],
    util: util
  },

  onShow() {
    const user = app.globalData.user;
    if (!user || user.role !== 'teacher') {
      wx.showToast({ title: '仅教师可访问', icon: 'none' });
      wx.navigateBack({ delta: 1 });
      return;
    }
    this.loadBookings();
  },

  async loadBookings() {
    this.setData({ loading: true });
    try {
      const res = await api.getAllBookings();
      if (res.code === 0) {
        this.setData({ bookings: res.data || [] });
      }
    } catch (e) {
      console.error('Load bookings failed:', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  onLockDate(e) {
    this.setData({ lockDate: e.detail.value });
  },

  async loadLockSlots() {
    const { lockDate } = this.data;
    if (!lockDate) return util.showToast('请输入日期');
    try {
      const res = await api.getAllSlots(lockDate);
      if (res.code === 0) {
        this.setData({ lockSlots: res.data || [] });
      }
    } catch (e) {
      util.showToast('加载失败');
    }
  },

  async lockSlot(e) {
    const start_time = e.currentTarget.dataset.time;
    const { lockDate } = this.data;
    try {
      const res = await api.lockSlot(lockDate, start_time);
      if (res.code === 0) {
        util.showToast('已锁定');
        this.loadLockSlots();
      } else {
        util.showToast(res.message || '锁定失败');
      }
    } catch (e) {
      util.showToast('操作失败');
    }
  },

  async unlockSlot(e) {
    const start_time = e.currentTarget.dataset.time;
    const { lockDate } = this.data;
    try {
      const res = await api.unlockSlot(lockDate, start_time);
      if (res.code === 0) {
        util.showToast('已解锁');
        this.loadLockSlots();
      }
    } catch (e) {
      util.showToast('操作失败');
    }
  },

  callStudent(e) {
    const phone = e.currentTarget.dataset.phone;
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    }
  },

  async confirmBooking(e) {
    const id = e.currentTarget.dataset.id;
    try {
      const res = await api.confirmBooking(id);
      if (res.code === 0) {
        util.showToast('已确认');
        this.loadBookings();
      }
    } catch (e) {
      util.showToast('操作失败');
    }
  },

  async completeBooking(e) {
    const id = e.currentTarget.dataset.id;
    try {
      const res = await api.completeBooking(id);
      if (res.code === 0) {
        util.showToast('已完成');
        this.loadBookings();
      }
    } catch (e) {
      util.showToast('操作失败');
    }
  },

  async adminCancel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消预约',
      content: '确定取消该预约吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const r = await api.adminCancelBooking(id);
            if (r.code === 0) {
              util.showToast('已取消');
              this.loadBookings();
            }
          } catch (e) {
            util.showToast('操作失败');
          }
        }
      }
    });
  }
});
