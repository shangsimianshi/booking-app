const api = require('../../utils/api');
const util = require('../../utils/util');
const app = getApp();

Page({
  data: {
    todayStats: {},
    students: []
  },

  onShow() {
    const user = app.globalData.user;
    if (!user || user.role !== 'teacher') {
      wx.showToast({ title: '仅教师可访问', icon: 'none' });
      wx.navigateBack({ delta: 1 });
      return;
    }
    this.loadData();
  },

  async loadData() {
    try {
      const [statsRes, checkinsRes] = await Promise.all([
        api.getTodayStats(),
        api.getAllCheckins()
      ]);

      if (statsRes.code === 0) {
        this.setData({ todayStats: statsRes.data || {} });
      }
      if (checkinsRes.code === 0) {
        const data = checkinsRes.data || [];
        const students = data.map((s, i) => ({
          ...s,
          rank: i + 1
        }));
        this.setData({ students });
      }
    } catch (e) {
      util.showToast('加载数据失败');
    }
  }
});
