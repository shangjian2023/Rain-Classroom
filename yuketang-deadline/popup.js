const loginPanel = document.getElementById('loginPanel');
const homeworkPanel = document.getElementById('homeworkPanel');
const statusIndicator = document.getElementById('statusIndicator');
const openLoginBtn = document.getElementById('openLoginBtn');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const refreshBtn = document.getElementById('refreshBtn');
const logoutBtn = document.getElementById('logoutBtn');
const courseFilter = document.getElementById('courseFilter');
const homeworkList = document.getElementById('homeworkList');
const updateTime = document.getElementById('updateTime');

const totalCount = document.getElementById('totalCount');
const urgentCount = document.getElementById('urgentCount');
const pendingCount = document.getElementById('pendingCount');
const doneCount = document.getElementById('doneCount');

const statAll = document.getElementById('statAll');
const statUrgent = document.getElementById('statUrgent');
const statPending = document.getElementById('statPending');
const statDone = document.getElementById('statDone');

let allHomeworks = [];
let allCourses = [];
let currentFilter = 'pending';

document.addEventListener('DOMContentLoaded', async () => {
  await checkLoginStatus();
  bindEvents();
});

function bindEvents() {
  openLoginBtn.addEventListener('click', handleOpenLogin);
  loginBtn.addEventListener('click', handleLogin);
  refreshBtn.addEventListener('click', handleRefresh);
  logoutBtn.addEventListener('click', handleLogout);
  courseFilter.addEventListener('change', filterHomeworks);
  
  [statAll, statUrgent, statPending, statDone].forEach(item => {
    item.addEventListener('click', () => {
      const filter = item.dataset.filter;
      setActiveFilter(filter);
    });
  });
}

function setActiveFilter(filter) {
  currentFilter = filter;
  
  [statAll, statUrgent, statPending, statDone].forEach(item => {
    item.classList.remove('active');
  });
  
  const activeItem = document.querySelector(`[data-filter="${filter}"]`);
  if (activeItem) {
    activeItem.classList.add('active');
  }
  
  renderHomeworks();
}

async function handleOpenLogin() {
  try {
    await chrome.tabs.create({ 
      url: 'https://changjiang.yuketang.cn/v2/web/index',
      active: true 
    });
  } catch (error) {
    console.error('打开登录页面失败:', error);
    showError('无法打开登录页面，请手动访问雨课堂');
  }
}

async function checkLoginStatus() {
  try {
    const response = await sendMessage({ action: 'checkLogin' });
    if (response.success && response.loggedIn) {
      showHomeworkPanel();
      loadHomeworks();
    } else {
      showLoginPanel();
    }
  } catch (error) {
    showLoginPanel();
  }
}

async function handleLogin() {
  setLoading(true);
  hideError();
  
  try {
    console.log('[POPUP DEBUG] 尝试同步登录状态');
    const response = await sendMessage({ action: 'login' });
    
    console.log('[POPUP DEBUG] 登录响应:', response);
    
    if (response.success) {
      showHomeworkPanel();
      loadHomeworks();
    } else {
      if (response.needOpenPage) {
        showError('请先打开雨课堂登录页面并完成微信扫码登录');
      } else {
        const tip = response.error.includes('刷新页面') 
          ? '请在雨课堂页面刷新后再试(F5刷新页面)'
          : '';
        showError(response.error + (tip ? '\n' + tip : ''));
      }
      console.error('[POPUP DEBUG] 同步失败:', response.error);
    }
  } catch (error) {
    showError('同步出错: ' + error.message);
    console.error('[POPUP DEBUG] 同步异常:', error);
  } finally {
    setLoading(false);
  }
}

async function handleLogout() {
  try {
    await sendMessage({ action: 'logout' });
    allHomeworks = [];
    allCourses = [];
    showLoginPanel();
    hideError();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

async function handleRefresh() {
  refreshBtn.disabled = true;
  refreshBtn.classList.add('loading');
  
  try {
    await loadHomeworks(true);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.classList.remove('loading');
  }
}

async function loadHomeworks(forceRefresh = false) {
  const cachedHomeworks = await getStorage('homeworks');
  const cachedCourses = await getStorage('courses');
  const lastUpdate = await getStorage('lastUpdate');
  
  if (!forceRefresh && cachedHomeworks && cachedHomeworks.length > 0) {
    allHomeworks = cachedHomeworks;
    allCourses = cachedCourses || [];
    updateCourseFilter();
    updateStats();
    renderHomeworks();
    if (lastUpdate) {
      const updateDate = new Date(lastUpdate);
      const timeStr = updateDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      updateTime.textContent = `缓存 ${timeStr}`;
    }
    return;
  }
  
  showLoading();
  
  try {
    const response = await sendMessage({ action: 'getHomeworks' });
    
    if (response.success) {
      allHomeworks = response.homeworks || [];
      allCourses = response.courses || [];
      
      updateCourseFilter();
      updateStats();
      renderHomeworks();
      updateLastTime();
      
      await setStorage('homeworks', allHomeworks);
      await setStorage('courses', allCourses);
      await setStorage('lastUpdate', new Date().toISOString());
    } else {
      if (response.needLogin || (response.error && response.error.includes('登录'))) {
        showLoginPanel();
        showError('登录已过期，请重新同步登录状态');
      } else {
        if (cachedHomeworks && cachedHomeworks.length > 0) {
          allHomeworks = cachedHomeworks;
          allCourses = cachedCourses || [];
          updateCourseFilter();
          updateStats();
          renderHomeworks();
          updateLastTime(true);
        } else {
          renderEmptyState(response.error || '获取作业列表失败，请稍后重试');
        }
      }
    }
  } catch (error) {
    console.error('Load homeworks error:', error);
    
    if (cachedHomeworks && cachedHomeworks.length > 0) {
      allHomeworks = cachedHomeworks;
      allCourses = cachedCourses || [];
      updateCourseFilter();
      updateStats();
      renderHomeworks();
      updateLastTime(true);
    } else {
      renderEmptyState('加载失败，请检查网络连接');
    }
  }
}

function updateCourseFilter() {
  courseFilter.innerHTML = '<option value="all">全部课程</option>';
  allCourses.forEach(course => {
    const option = document.createElement('option');
    option.value = course.id;
    option.textContent = course.name;
    courseFilter.appendChild(option);
  });
}

function updateStats() {
  const now = new Date();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  
  let total = 0;
  let urgent = 0;
  let pending = 0;
  let done = 0;
  
  allHomeworks.forEach(hw => {
    const isExpired = hw.status === 'expired' || (hw.deadline && new Date(hw.deadline) < now);
    if (isExpired) return;
    
    total++;
    
    if (hw.status === 'submitted') {
      done++;
    } else if (hw.status === 'pending' || hw.status === 'late') {
      pending++;
      if (hw.deadline) {
        const deadline = new Date(hw.deadline);
        if (deadline - now < threeDays && deadline > now) {
          urgent++;
        }
      }
    }
  });
  
  totalCount.textContent = total;
  urgentCount.textContent = urgent;
  pendingCount.textContent = pending;
  doneCount.textContent = done;
}

function filterHomeworks() {
  renderHomeworks();
}

function renderHomeworks() {
  const courseId = courseFilter.value;
  const now = new Date();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  
  let filtered = allHomeworks.filter(hw => {
    if (hw.status === 'expired') return false;
    if (hw.deadline && new Date(hw.deadline) < now) return false;
    return true;
  });
  
  switch (currentFilter) {
    case 'urgent':
      filtered = filtered.filter(hw => {
        if (hw.status !== 'pending' && hw.status !== 'late') return false;
        if (!hw.deadline) return false;
        const deadline = new Date(hw.deadline);
        return deadline - now < threeDays && deadline > now;
      });
      break;
    case 'pending':
      filtered = filtered.filter(hw => hw.status === 'pending' || hw.status === 'late');
      break;
    case 'done':
      filtered = filtered.filter(hw => hw.status === 'submitted');
      break;
    case 'all':
    default:
      break;
  }
  
  if (courseId !== 'all') {
    filtered = filtered.filter(hw => String(hw.courseId) === courseId);
  }
  
  const emptyMessages = {
    'all': '暂无作业',
    'urgent': '暂无紧急作业',
    'pending': '暂无待完成的作业',
    'done': '暂无已完成的作业'
  };
  
  if (filtered.length === 0) {
    renderEmptyState(emptyMessages[currentFilter] || '暂无作业');
    return;
  }
  
  homeworkList.innerHTML = '';
  
  filtered.forEach((hw, index) => {
    const item = createHomeworkItem(hw, index);
    homeworkList.appendChild(item);
  });
}

function createHomeworkItem(homework, index) {
  const item = document.createElement('div');
  item.className = `homework-item ${homework.status}`;
  item.style.animationDelay = `${index * 0.05}s`;
  
  const now = new Date();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  if (homework.status !== 'submitted' && homework.deadline) {
    const deadline = new Date(homework.deadline);
    if (deadline - now < threeDays && deadline > now) {
      item.classList.add('urgent');
    }
  }
  
  const statusText = getStatusText(homework.status);
  const statusClass = homework.status;
  const deadlineDisplay = formatDeadline(homework.deadline);
  const isDeadlineUrgent = homework.status !== 'submitted' && isUrgentDeadline(homework.deadline);
  
  item.innerHTML = `
    <div class="homework-header">
      <span class="homework-title">${escapeHtml(homework.title)}</span>
      <span class="homework-status ${statusClass}">${statusText}</span>
    </div>
    <div class="homework-meta">
      <span class="course-tag">${escapeHtml(homework.courseName)}</span>
      <span class="homework-meta-item ${isDeadlineUrgent ? 'deadline-urgent' : ''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        ${deadlineDisplay}
      </span>
      ${homework.type === 'exam' ? '<span class="homework-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>考试</span>' : ''}
    </div>
  `;
  
  item.addEventListener('click', () => {
    if (homework.url) {
      chrome.tabs.create({ url: homework.url });
    }
  });
  
  return item;
}

function getStatusText(status) {
  const statusMap = {
    'pending': '待完成',
    'late': '补交中',
    'submitted': '已提交',
    'expired': '已过期'
  };
  return statusMap[status] || status;
}

function formatDeadline(deadline) {
  if (!deadline) return '无截止时间';
  
  const date = new Date(deadline);
  const now = new Date();
  const diff = date - now;
  
  if (diff < 0) {
    return '已截止';
  }
  
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  
  if (days > 7) {
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } else if (days > 0) {
    return `${days}天${hours}小时后截止`;
  } else if (hours > 0) {
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}小时${minutes}分钟后截止`;
  } else {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}分钟后截止`;
  }
}

function isUrgentDeadline(deadline) {
  if (!deadline) return false;
  const date = new Date(deadline);
  const now = new Date();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  return date > now && date - now < threeDays;
}

function renderEmptyState(message) {
  homeworkList.innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="2"/>
        <path d="M9 14l2 2 4-4"/>
      </svg>
      <p>${message}</p>
    </div>
  `;
}

function showLoading() {
  homeworkList.innerHTML = `
    <div class="loading-placeholder">
      <svg class="spinner large" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
      </svg>
      <p>加载作业中...</p>
    </div>
  `;
}

function showLoginPanel() {
  loginPanel.style.display = 'flex';
  homeworkPanel.style.display = 'none';
  statusIndicator.classList.remove('online');
  statusIndicator.querySelector('.status-text').textContent = '未登录';
}

function showHomeworkPanel() {
  loginPanel.style.display = 'none';
  homeworkPanel.style.display = 'flex';
  statusIndicator.classList.add('online');
  statusIndicator.querySelector('.status-text').textContent = '已登录';
}

function setLoading(loading) {
  const btnText = loginBtn.querySelector('.btn-text');
  const btnLoading = loginBtn.querySelector('.btn-loading');
  
  if (loading) {
    btnText.style.display = 'none';
    btnLoading.style.display = 'flex';
    loginBtn.disabled = true;
  } else {
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
    loginBtn.disabled = false;
  }
}

function showError(message) {
  loginError.textContent = message;
}

function hideError() {
  loginError.textContent = '';
}

function updateLastTime(fromCache = false) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  updateTime.textContent = fromCache ? `缓存 ${timeStr}` : `更新于 ${timeStr}`;
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response || {});
      }
    });
  });
}

function getStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key]);
    });
  });
}

function setStorage(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

function removeStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.remove([key], resolve);
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
