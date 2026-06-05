const api = require('../../utils/api');
const util = require('../../utils/util');
const app = getApp();

Page({
  data: {
    mode: 'student',
    name: '',
    phone: '',
    password: ''
  },

  onLoad() {
    // If already logged in, go to home
    const token = wx.getStorageSync('token');
    if (token && app.globalData.user) {
      wx.switchTab({ url: '/pages/home/home' });
    }
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  switchMode() {
    this.setData({
      mode: 'teacher',
      name: '',
      phone: '',
      password: ''
    });
  },

  switchToRegister() {
    this.setData({
      mode: 'register',
      name: '',
      phone: '',
      password: ''
    });
  },

  switchToStudent() {
    this.setData({
      mode: 'student',
      name: '',
      phone: '',
      password: ''
    });
  },

  switchToTeacher() {
    this.setData({
      mode: 'teacher',
      name: '',
      phone: '',
      password: ''
    });
  },

  async doLogin() {
    const { name, phone } = this.data;
    if (!name.trim()) {
      util.showToast('请输入姓名');
      return;
    }
    if (!phone.trim() || phone.length !== 11) {
      util.showToast('请输入正确的手机号');
      return;
    }

    util.showLoading(true);
    try {
      const res = await api.login(name.trim(), phone.trim());
      if (res.code === 0 && res.data) {
        app.login(res.data.user, res.data.token);
        util.showToast('登录成功');
        wx.switchTab({ url: '/pages/home/home' });
      } else {
        util.showToast(res.message || '登录失败');
      }
    } catch (e) {
      util.showToast(e.message || '网络错误，请稍后重试');
    } finally {
      util.showLoading(false);
    }
  },

  async doTeacherLogin() {
    const { phone, password } = this.data;
    if (!phone.trim() || phone.length !== 11) {
      util.showToast('请输入正确的手机号');
      return;
    }
    if (!password.trim()) {
      util.showToast('请输入密码');
      return;
    }

    util.showLoading(true);
    try {
      const res = await api.teacherLogin(phone.trim(), password.trim());
      if (res.code === 0 && res.data) {
        app.login(res.data.user, res.data.token);
        util.showToast('登录成功');
        wx.switchTab({ url: '/pages/home/home' });
      } else {
        util.showToast(res.message || '登录失败');
      }
    } catch (e) {
      util.showToast(e.message || '网络错误，请稍后重试');
    } finally {
      util.showLoading(false);
    }
  },

  async doRegister() {
    const { name, phone, password } = this.data;
    if (!name.trim()) {
      util.showToast('请输入姓名');
      return;
    }
    if (!phone.trim() || phone.length !== 11) {
      util.showToast('请输入正确的手机号');
      return;
    }
    if (!password.trim() || password.length < 6) {
      util.showToast('密码至少6位');
      return;
    }

    util.showLoading(true);
    try {
      const res = await api.teacherRegister(name.trim(), phone.trim(), password.trim());
      if (res.code === 0) {
        util.showToast('注册成功，请登录');
        this.setData({ mode: 'teacher', name: '', phone: '', password: '' });
      } else {
        util.showToast(res.message || '注册失败');
      }
    } catch (e) {
      util.showToast(e.message || '注册失败');
    } finally {
      util.showLoading(false);
    }
  }
});
