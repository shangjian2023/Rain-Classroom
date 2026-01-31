const BASE_URL = 'https://changjiang.yuketang.cn';
const API_BASE = BASE_URL;

const REFRESH_INTERVAL_MINUTES = 30;
const ALARM_NAME = 'yuketang-refresh';

let currentUser = null;

chrome.runtime.onInstalled.addListener(() => {
  setupAlarm();
  refreshHomeworksInBackground(false);
});

chrome.runtime.onStartup.addListener(() => {
  setupAlarm();
  refreshHomeworksInBackground(true);
});

function setupAlarm() {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: REFRESH_INTERVAL_MINUTES,
    periodInMinutes: REFRESH_INTERVAL_MINUTES
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    refreshHomeworksInBackground(false);
  }
});

async function checkAndNotifyUrgentHomeworks(homeworks) {
  const now = new Date();
  const urgentThreshold = 36 * 60 * 60 * 1000;
  
  const urgentHomeworks = homeworks.filter(hw => {
    if (hw.status !== 'pending' && hw.status !== 'late') return false;
    if (!hw.deadline) return false;
    
    const deadline = new Date(hw.deadline);
    const timeLeft = deadline - now;
    return timeLeft > 0 && timeLeft < urgentThreshold;
  });
  
  if (urgentHomeworks.length === 0) {
    return;
  }
  
  urgentHomeworks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  
  let message = '';
  const maxShow = 3;
  
  for (let i = 0; i < Math.min(urgentHomeworks.length, maxShow); i++) {
    const hw = urgentHomeworks[i];
    const deadline = new Date(hw.deadline);
    const hoursLeft = Math.ceil((deadline - now) / (60 * 60 * 1000));
    message += `• ${hw.title} (${hoursLeft}小时后截止)\n`;
  }
  
  if (urgentHomeworks.length > maxShow) {
    message += `...还有 ${urgentHomeworks.length - maxShow} 个作业即将截止`;
  }
  
  try {
    chrome.notifications.create('yuketang-urgent-' + Date.now(), {
      type: 'basic',
      iconUrl: 'icons/icon128.svg',
      title: `⚠️ ${urgentHomeworks.length} 个作业即将截止！`,
      message: message.trim(),
      priority: 2
    });
  } catch (error) {
    console.error('发送通知失败:', error);
  }
}

async function testNotification() {
  const result = await chrome.storage.local.get(['homeworks']);
  if (result.homeworks && result.homeworks.length > 0) {
    await checkAndNotifyUrgentHomeworks(result.homeworks);
  } else {
    chrome.notifications.create('test-' + Date.now(), {
      type: 'basic',
      iconUrl: 'icons/icon128.svg',
      title: '测试通知',
      message: '这是一条测试通知，说明通知功能正常工作',
      priority: 2
    });
  }
}

async function refreshHomeworksInBackground(checkNotification = false) {
  try {
    const credentialsResult = await chrome.storage.local.get(['credentials']);
    const credentials = credentialsResult.credentials;
    
    if (!credentials || !credentials.csrftoken || !credentials.sessionid) {
      return;
    }
    
    if (!currentUser) {
      currentUser = await loadUserFromStorage();
    }
    
    if (!currentUser) {
      const loadResult = await loadCredentialsFromWebpage();
      if (!loadResult.success) return;
    }
    
    const result = await getAllHomeworks();
    
    if (result.success) {
      await chrome.storage.local.set({
        homeworks: result.homeworks,
        courses: result.courses,
        lastUpdate: new Date().toISOString()
      });
      
      if (checkNotification) {
        await checkAndNotifyUrgentHomeworks(result.homeworks);
      }
    }
  } catch (error) {
    console.error('后台刷新异常:', error);
  }
}

async function saveUserToStorage(user) {
  if (user) {
    await chrome.storage.local.set({ currentUser: user });
  }
}

async function loadUserFromStorage() {
  const result = await chrome.storage.local.get(['currentUser']);
  return result.currentUser || null;
}

async function clearUserFromStorage() {
  await chrome.storage.local.remove(['currentUser']);
  await chrome.storage.local.remove(['credentials']);
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function getCookies() {
  try {
    const cookies = await chrome.cookies.getAll({ domain: 'yuketang.cn' });
    return cookies;
  } catch (e) {
    return [];
  }
}

async function getCommonHeaders() {
  const cookies = await getCookies();
  const csrftoken = cookies.find(c => c.name.includes('csrftoken') || c.name.includes('csrf'))?.value || '';
  const sessionid = cookies.find(c => 
    c.name.includes('session') || 
    c.name.includes('sessionid') ||
    c.name === 'connect.sid'
  )?.value || '';
  
  const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  
  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Content-Type': 'application/json;charset=UTF-8',
    'Origin': 'https://changjiang.yuketang.cn',
    'Referer': 'https://changjiang.yuketang.cn/v2/web/index',
    'X-Requested-With': 'XMLHttpRequest'
  };
  
  if (csrftoken) {
    headers['X-CSRFToken'] = csrftoken;
  }
  
  return { headers, cookieString, csrftoken, sessionid };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  return true;
});

async function handleMessage(request, sender, sendResponse) {
  try {
    switch (request.action) {
      case 'login':
        const loginResult = await loadCredentialsFromWebpage();
        sendResponse(loginResult);
        break;
      
      case 'logout':
        const logoutResult = await logout();
        sendResponse(logoutResult);
        break;
      
      case 'testNotification':
        await testNotification();
        sendResponse({ success: true });
        break;
      
      case 'checkLogin':
        const checkResult = await checkLoginStatus();
        sendResponse(checkResult);
        break;
      
      case 'getHomeworks':
        const homeworks = await getAllHomeworks();
        sendResponse(homeworks);
        break;
      
      case 'getCourses':
        const courses = await getCourses();
        sendResponse(courses);
        break;
      
      case 'openLoginPage':
        const openResult = await openLoginPage();
        sendResponse(openResult);
        break;
      
      default:
        sendResponse({ success: false, error: '未知操作' });
    }
  } catch (error) {
    console.error('Background error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function openLoginPage() {
  try {
    await chrome.tabs.create({ 
      url: 'https://changjiang.yuketang.cn/v2/web/index',
      active: true 
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function loadCredentialsFromWebpage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url || !tab.url.includes('yuketang.cn')) {
      return { 
        success: false, 
        error: '请先打开雨课堂网页版页面',
        needOpenPage: true 
      };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const credentials = {
          cookies: document.cookie,
          localStorage: {},
          userInfo: null,
          url: window.location.href
        };

        const cookieCount = credentials.cookies ? credentials.cookies.split(';').filter(c => c.trim()).length : 0;
        console.log('[Content] Cookie数量:', cookieCount);

        if (window.localStorage) {
          const storageData = {};
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              try {
                storageData[key] = localStorage.getItem(key);
              } catch (e) {}
            }
          }
          credentials.localStorage = storageData;
          console.log('[Content] LocalStorage项目数:', Object.keys(storageData).length);
        }

        const userDataEl = document.querySelector('#__NEXT_DATA__');
        if (userDataEl) {
          try {
            const nextData = JSON.parse(userDataEl.textContent);
            if (nextData.props && nextData.props.pageProps) {
              const userInfo = nextData.props.pageProps.userInfo || nextData.props.pageProps.user;
              if (userInfo) {
                credentials.userInfo = {
                  name: userInfo.name || userInfo.real_name || userInfo.nickname,
                  id: userInfo.id || userInfo.user_id
                };
                console.log('[Content] 找到用户信息:', credentials.userInfo);
              }
              
              const globalData = nextData.props.pageProps.globalData;
              if (globalData) {
                credentials.csrftoken = globalData.csrftoken || globalData.csrf_token || globalData.token;
                console.log('[Content] 找到csrftoken:', credentials.csrftoken);
              }
            }
          } catch (e) {
            console.log('[Content] 解析__NEXT_DATA__失败:', e.message);
          }
        }

        return credentials;
      }
    });

    if (results && results[0] && results[0].result !== undefined) {
      const credentials = results[0].result;
      
      const cookieCount = credentials.cookies ? credentials.cookies.split(';').filter(c => c.trim()).length : 0;
      console.log('[DEBUG] 获取到Cookie数量:', cookieCount);
      
      if (credentials && cookieCount > 0) {
        await saveCredentials(credentials);
        
        currentUser = credentials.userInfo || { loggedIn: true };
        await saveUserToStorage(currentUser);
        
        console.log('[DEBUG] 凭证保存成功');
        return { success: true, user: currentUser };
      } else {
        console.log('[DEBUG] 未检测到Cookie');
      }
    } else {
      console.log('[DEBUG] 脚本执行失败');
    }

    return { 
      success: false, 
      error: '未检测到登录状态，请确保已在雨课堂网页版登录并刷新页面(F5)后重试',
      needOpenPage: !tab.url.includes('changjiang.yuketang.cn/v2/web/index')
    };
  } catch (error) {
    console.error('[DEBUG] 加载凭证失败:', error);
    return { success: false, error: '获取登录凭证失败: ' + error.message };
  }
}

async function saveCredentials(credentials) {
  const cookies = credentials.cookies.split(';').map(c => c.trim());
  const csrftoken = cookies.find(c => c.startsWith('csrftoken') || c.startsWith('csrf'))?.split('=')[1] || '';
  const sessionid = cookies.find(c => 
    c.startsWith('session') || 
    c.startsWith('sessionid') ||
    c.startsWith('connect.sid')
  )?.split('=')[1] || '';
  
  await chrome.storage.local.set({ 
    credentials: {
      cookies: credentials.cookies,
      csrftoken: csrftoken,
      sessionid: sessionid,
      localStorage: credentials.localStorage,
      userInfo: credentials.userInfo,
      savedAt: new Date().toISOString()
    }
  });
  
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name && value) {
      try {
        await chrome.cookies.set({
          url: 'https://changjiang.yuketang.cn',
          name: name.trim(),
          value: value.trim(),
          domain: '.yuketang.cn',
          path: '/',
          secure: true
        });
      } catch (e) {}
    }
  }
}

async function checkWebpageLoginStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url || !tab.url.includes('yuketang.cn')) {
      return { success: true, loggedIn: false, message: '不在雨课堂页面' };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const cookies = document.cookie;
        const isLoggedIn = cookies && (
          cookies.includes('session') ||
          cookies.includes('csrftoken') ||
          cookies.includes('connect.sid')
        );
        return { isLoggedIn, cookies };
      }
    });

    if (results && results[0] && results[0].result) {
      return { 
        success: true, 
        loggedIn: results[0].result.isLoggedIn,
        cookies: results[0].result.cookies
      };
    }

    return { success: true, loggedIn: false };
  } catch (error) {
    return { success: true, loggedIn: false };
  }
}

async function getUserInfo() {
  try {
    const credentialsResult = await chrome.storage.local.get(['credentials']);
    const credentials = credentialsResult.credentials;
    
    if (!credentials || !credentials.csrftoken) {
      return { success: false, error: '请先登录', needLogin: true };
    }

    const { headers, cookieString } = await getCommonHeaders();
    
    const response = await fetch(`${API_BASE}/v2/api/web/user/info`, {
      method: 'GET',
      headers: headers,
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      if (data.data) {
        currentUser = data.data;
        await saveUserToStorage(currentUser);
        return { success: true, user: currentUser };
      }
    }
    
    return { success: false, error: '获取用户信息失败' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function checkLoginStatus() {
  try {
    if (!currentUser) {
      currentUser = await loadUserFromStorage();
    }
    
    if (currentUser) {
      return { success: true, loggedIn: true, user: currentUser };
    }

    const webpageStatus = await checkWebpageLoginStatus();
    
    if (webpageStatus.loggedIn) {
      const loadResult = await loadCredentialsFromWebpage();
      if (loadResult.success) {
        return { success: true, loggedIn: true, user: currentUser };
      }
    }
    
    return { success: true, loggedIn: false };
  } catch (error) {
    return { success: true, loggedIn: false };
  }
}

async function logout() {
  try {
    const domains = ['yuketang.cn', '.yuketang.cn', 'changjiang.yuketang.cn'];
    for (const domain of domains) {
      const cookies = await chrome.cookies.getAll({ domain });
      for (const cookie of cookies) {
        try {
          const url = `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
          await chrome.cookies.remove({ url, name: cookie.name });
        } catch (e) {}
      }
    }
    
    currentUser = null;
    await clearUserFromStorage();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getCourses() {
  try {
    const { headers, cookieString } = await getCommonHeaders();
    
    const response = await fetch(`${API_BASE}/v2/api/web/courses/list?identity=2`, {
      method: 'GET',
      headers: {
        ...headers,
        'Cookie': cookieString
      },
      credentials: 'include'
    });

    console.log('[DEBUG] 获取课程响应状态:', response.status);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: '登录已过期', needLogin: true };
      }
      throw new Error('获取课程列表失败');
    }

    const data = await response.json();
    console.log('[DEBUG] 课程数据:', data);
    
    const allCourses = data.data?.list || data.courses || data.data || [];
    const courses = allCourses.filter(c => !c.is_end && !c.is_ended);
    
    return { success: true, courses };
  } catch (error) {
    console.error('[DEBUG] 获取课程失败:', error);
    return { success: false, error: error.message };
  }
}

async function getCourseHomeworks(courseId, courseName) {
  try {
    const { headers, cookieString } = await getCommonHeaders();
    
    const response = await fetch(`${API_BASE}/v2/api/web/homeworks/list?course_id=${courseId}`, {
      method: 'GET',
      headers: {
        ...headers,
        'Cookie': cookieString
      },
      credentials: 'include'
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.data?.list || data.homeworks || data.data || [];
  } catch (error) {
    console.error('[DEBUG] 获取作业失败:', error);
    return [];
  }
}

async function getAllHomeworks() {
  try {
    let coursesResult = await getCourses();
    
    if (!coursesResult.success) {
      return { ...coursesResult, needLogin: true };
    }

    const courses = coursesResult.courses;
    
    if (!courses || courses.length === 0) {
      return { success: true, homeworks: [], courses: [] };
    }

    const allHomeworks = [];

    const homeworkPromises = courses.map(async (course) => {
      const courseId = course.id || course.course_id;
      const courseName = course.name || course.course_name;
      
      const homeworks = await getCourseHomeworks(courseId, courseName);
      
      const processedHomeworks = homeworks.map(hw => {
        const status = getHomeworkStatus(hw);
        const now = new Date();
        let deadline = hw.deadline || hw.end_time || hw.submit_deadline || hw.deadline_time;
        
        return {
          id: hw.id || hw.homework_id,
          title: hw.title || hw.name || hw.homework_name,
          courseId: courseId,
          courseName: courseName,
          deadline: deadline,
          startTime: hw.start_time || hw.publish_time || hw.start_time,
          status: status,
          score: hw.score || hw.student_score,
          type: 'homework',
          url: `${BASE_URL}/v2/web/homework/${hw.id || hw.homework_id}`
        };
      });

      return processedHomeworks;
    });

    const results = await Promise.all(homeworkPromises);
    results.forEach(homeworks => {
      allHomeworks.push(...homeworks);
    });

    allHomeworks.sort((a, b) => {
      const now = new Date();
      const deadlineA = a.deadline ? new Date(a.deadline) : new Date('2099-12-31');
      const deadlineB = b.deadline ? new Date(b.deadline) : new Date('2099-12-31');
      
      const expiredA = deadlineA < now;
      const expiredB = deadlineB < now;
      
      if (expiredA !== expiredB) {
        return expiredA ? 1 : -1;
      }
      
      return deadlineA - deadlineB;
    });

    return { 
      success: true, 
      homeworks: allHomeworks,
      courses: courses.map(c => ({ id: c.id || c.course_id, name: c.name || c.course_name }))
    };
  } catch (error) {
    console.error('Get all homeworks error:', error);
    return { success: false, error: error.message };
  }
}

function getHomeworkStatus(homework) {
  const now = new Date();
  const deadline = homework.deadline || homework.end_time || homework.submit_deadline || homework.deadline_time;
  const deadlineDate = deadline ? new Date(deadline) : null;

  if (homework.is_submitted === true || homework.submitted === true || homework.done === true) {
    return 'submitted';
  }
  
  if (homework.status === 'submitted' || homework.status === 'done') {
    return 'submitted';
  }

  if (homework.status === 'expired' || homework.status === 'ended' || homework.status === 'closed') {
    return 'expired';
  }

  if (deadlineDate && deadlineDate < now) {
    if (homework.allow_late === true || homework.late_submission === true) {
      return 'late';
    }
    return 'expired';
  }

  return 'pending';
}
