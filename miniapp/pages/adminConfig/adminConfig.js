const api = require('../../utils/api');
const util = require('../../utils/util');
const app = getApp();

Page({
  data: {
    price: '',
    deposit: '',
    teacherName: '',
    teacherWechat: ''
  },

  onLoad() {
    const user = app.globalData.user;
    if (!user || user.role !== 'teacher') {
      wx.showToast({ title: '仅教师可访问', icon: 'none' });
      wx.navigateBack({ delta: 1 });
      return;
    }
    this.loadConfig();
  },

  async loadConfig() {
    try {
      const res = await api.getConfig();
      if (res.code === 0 && res.data) {
        this.setData({
          price: String(res.data.price || ''),
          deposit: String(res.data.deposit || ''),
          teacherName: res.data.teacher_name || '',
          teacherWechat: res.data.teacher_wechat || ''
        });
      }
    } catch (e) {
      console.error('Load config failed:', e);
    }
  },

  onPriceInput(e) {
    this.setData({ price: e.detail.value });
  },

  onDepositInput(e) {
    this.setData({ deposit: e.detail.value });
  },

  onTeacherNameInput(e) {
    this.setData({ teacherName: e.detail.value });
  },

  onTeacherWechatInput(e) {
    this.setData({ teacherWechat: e.detail.value });
  },

  async saveConfig() {
    const { price, deposit, teacherName, teacherWechat } = this.data;
    if (!price) {
      util.showToast('请输入课程单价');
      return;
    }
    if (!deposit) {
      util.showToast('请输入定金金额');
      return;
    }

    util.showLoading(true);
    try {
      const res = await api.saveConfig({
        price: parseFloat(price),
        deposit: parseFloat(deposit),
        teacher_name: teacherName,
        teacher_wechat: teacherWechat
      });
      if (res.code === 0) {
        util.showToast('保存成功');
      } else {
        util.showToast(res.message || '保存失败');
      }
    } catch (e) {
      util.showToast('网络错误');
    } finally {
      util.showLoading(false);
    }
  }
});
