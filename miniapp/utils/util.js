/**
 * Format a Date object to YYYY-MM-DD
 */
function fmtDate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/**
 * Format a date string to a human-friendly display
 * e.g. 今天, 明天, 12月25日 周三
 */
function fmtDisplay(dateStr) {
  const weekNames = ['日', '一', '二', '三', '四', '五', '六'];
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dNorm = new Date(dateStr);
  dNorm.setHours(0, 0, 0, 0);

  const diff = (dNorm - today) / 86400000;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekDay = weekNames[d.getDay()];

  if (diff === 0) {
    return '今天 ' + month + '月' + day + '日 周' + weekDay;
  } else if (diff === 1) {
    return '明天 ' + month + '月' + day + '日 周' + weekDay;
  } else if (diff > 1 && diff < 7) {
    return '周' + weekDay + ' ' + month + '月' + day + '日';
  }
  return month + '月' + day + '日 周' + weekDay;
}

/**
 * Days in month
 */
function dim(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Relative time string
 */
function timeAgo(ts) {
  if (!ts) return '';
  const now = Date.now();
  const t = typeof ts === 'number' ? ts : new Date(ts).getTime();
  const diff = Math.floor((now - t) / 1000);

  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  if (diff < 2592000) return Math.floor(diff / 86400) + '天前';
  if (diff < 31536000) return Math.floor(diff / 2592000) + '个月前';
  return Math.floor(diff / 31536000) + '年前';
}

/**
 * Show toast
 */
function showToast(msg) {
  wx.showToast({
    title: msg,
    icon: 'none',
    duration: 2000
  });
}

/**
 * Show/hide loading
 */
function showLoading(show) {
  if (show) {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
  } else {
    wx.hideLoading();
  }
}

module.exports = {
  fmtDate,
  fmtDisplay,
  dim,
  timeAgo,
  showToast,
  showLoading
};
