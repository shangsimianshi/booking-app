const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    bookings: [],
    loading: false,
    util: util
  },

  onShow() {
    this.loadBookings();
  },

  async loadBookings() {
    this.setData({ loading: true });
    try {
      const res = await api.getMyBookings();
      if (res.code === 0) {
        this.setData({ bookings: res.data || [] });
      } else {
        util.showToast(res.message || '加载失败');
      }
    } catch (e) {
      util.showToast('网络错误');
    } finally {
      this.setData({ loading: false });
    }
  },

  async cancelBooking(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消预约',
      content: '确定取消该预约吗？',
      success: async (res) => {
        if (res.confirm) {
          util.showLoading(true);
          try {
            const result = await api.cancelBooking(id);
            if (result.code === 0) {
              util.showToast('已取消');
              this.loadBookings();
            } else {
              util.showToast(result.message || '取消失败');
            }
          } catch (e) {
            util.showToast('网络错误');
          } finally {
            util.showLoading(false);
          }
        }
      }
    });
  }
});
