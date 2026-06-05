const BASE_URL = 'http://localhost:3000/api';

function getToken() {
  return wx.getStorageSync('token') || '';
}

function request(method, path, data = {}) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    const header = { 'Content-Type': 'application/json' };
    if (token) {
      header['Authorization'] = 'Bearer ' + token;
    }

    let url = BASE_URL + path;
    let requestData = data;

    // For GET/DELETE requests, pass data as query params
    if (method === 'GET' || method === 'DELETE') {
      const query = Object.keys(data).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(data[k])).join('&');
      if (query) {
        url += (url.includes('?') ? '&' : '?') + query;
      }
      requestData = undefined;
    }

    wx.request({
      url: url,
      method: method,
      data: requestData,
      header: header,
      timeout: 15000,
      success(res) {
        if (res.statusCode === 401) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('user');
          wx.reLaunch({ url: '/pages/index/index' });
          reject(new Error('未登录或登录已过期'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ code: 0, data: res.data });
        } else {
          resolve({ code: -1, message: (res.data && res.data.error) || '请求失败' });
        }
      },
      fail(err) {
        resolve({ code: -1, message: '网络错误' });
      }
    });
  });
}

module.exports = {
  // ========== Base ==========
  request,

  // ========== Auth ==========
  login(name, phone) {
    return request('POST', '/auth/login', { name, phone });
  },

  teacherLogin(phone, password) {
    return request('POST', '/auth/teacher-login', { phone, password });
  },

  teacherRegister(name, phone, password) {
    return request('POST', '/admin/init-teacher', { name, phone, password });
  },

  getMe() {
    return request('GET', '/auth/me');
  },

  getTeacherInfo() {
    return request('GET', '/auth/teacher-info');
  },

  // ========== Slots ==========
  getAvailableSlots(date) {
    return request('GET', '/slots/available', { date });
  },

  getAllSlots(date) {
    return request('GET', '/slots/all-slots', { date });
  },

  lockSlot(date, start_time) {
    return request('POST', '/slots/lock', { date, start_time });
  },

  unlockSlot(date, start_time) {
    return request('POST', '/slots/unlock', { date, start_time });
  },

  getCalendar(year, month) {
    return request('GET', '/slots/calendar', { year, month });
  },

  getScheduleConfig() {
    return request('GET', '/slots/config');
  },

  saveScheduleConfig(schedules) {
    return request('POST', '/slots/config', { schedules });
  },

  getDateSchedules(year, month) {
    return request('GET', '/slots/date-schedules', { year, month });
  },

  setDateSchedule(date, schedules) {
    return request('POST', '/slots/date-schedule', { date, schedules });
  },

  getSpecialDates() {
    return request('GET', '/slots/special-dates');
  },

  addSpecialDate(date, is_off, note) {
    return request('POST', '/slots/special-dates', { date, is_off, note });
  },

  deleteSpecialDate(date) {
    return request('DELETE', '/slots/special-dates/' + date);
  },

  // ========== Bookings ==========
  createBooking(date, start_time, note) {
    return request('POST', '/bookings/create', { date, start_time, note });
  },

  getMyBookings() {
    return request('GET', '/bookings/my');
  },

  getAllBookings(params = {}) {
    return request('GET', '/bookings/all', params);
  },

  confirmBooking(id) {
    return request('POST', '/bookings/confirm/' + id);
  },

  completeBooking(id) {
    return request('POST', '/bookings/complete/' + id);
  },

  adminCancelBooking(id) {
    return request('POST', '/bookings/admin-cancel/' + id);
  },

  cancelBooking(id) {
    return request('POST', '/bookings/cancel/' + id);
  },

  payDeposit(id) {
    return request('POST', '/bookings/pay-deposit/' + id);
  },

  // ========== Notifications ==========
  getNotifications() {
    return request('GET', '/notifications');
  },

  getUnreadCount() {
    return request('GET', '/notifications/unread-count');
  },

  readNotification(id) {
    return request('POST', '/notifications/read/' + id);
  },

  readAllNotifications() {
    return request('POST', '/notifications/read-all');
  },

  deleteNotification(id) {
    return request('DELETE', '/notifications/' + id);
  },

  deleteAllNotifications() {
    return request('DELETE', '/notifications/all');
  },

  // ========== Checkins ==========
  getMyCheckins() {
    return request('GET', '/checkins/my');
  },

  checkIn() {
    return request('POST', '/checkins/');
  },

  getAllCheckins() {
    return request('GET', '/checkins/all');
  },

  getTodayStats() {
    return request('GET', '/checkins/today-stats');
  },

  // ========== Admin ==========
  getStats() {
    return request('GET', '/admin/stats');
  },

  getConfig() {
    return request('GET', '/admin/config');
  },

  saveConfig(config) {
    return request('POST', '/admin/config', config);
  }
};
