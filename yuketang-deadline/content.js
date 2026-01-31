// 雨课堂内容脚本 - 从登录页面提取凭证
(function() {
  'use strict';

  const YUKETANG_DOMAINS = ['yuketang.cn', 'changjiang.yuketang.cn'];

  function isYuketangDomain(url) {
    return YUKETANG_DOMAINS.some(domain => url.includes(domain));
  }

  function getLoginCredentials() {
    const credentials = {
      cookies: null,
      localStorage: null,
      userInfo: null
    };

    try {
      credentials.cookies = document.cookie;

      if (window.localStorage) {
        const storageData = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('token') || key.includes('auth') || key.includes('user') || key.includes('session'))) {
            storageData[key] = localStorage.getItem(key);
          }
        }
        if (Object.keys(storageData).length > 0) {
          credentials.localStorage = storageData;
        }
      }

      const userInfoEl = document.querySelector('[class*="user"] [class*="name"]');
      if (userInfoEl) {
        credentials.userInfo = userInfoEl.textContent.trim();
      }

      const userDataEl = document.querySelector('#__NEXT_DATA__');
      if (userDataEl) {
        try {
          const nextData = JSON.parse(userDataEl.textContent);
          if (nextData.props && nextData.props.pageProps) {
            credentials.userInfo = nextData.props.pageProps.userInfo || nextData.props.pageProps.user || credentials.userInfo;
          }
        } catch (e) {}
      }

    } catch (error) {
      console.error('[Yuketang] 获取凭证失败:', error);
    }

    return credentials;
  }

  function checkLoginStatus() {
    const cookies = document.cookie;
    const isLoggedIn = cookies && (
      cookies.includes('session') ||
      cookies.includes('token') ||
      cookies.includes('auth_token') ||
      cookies.includes('access_token')
    );

    return {
      isLoggedIn,
      cookies: cookies,
      timestamp: new Date().toISOString()
    };
  }

  if (isYuketangDomain(window.location.href)) {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;

      if (event.data.type === 'YUKETANG_GET_CREDENTIALS') {
        const credentials = getLoginCredentials();
        window.postMessage({
          type: 'YUKETANG_CREDENTIALS',
          credentials: credentials
        }, '*');
      }

      if (event.data.type === 'YUKETANG_CHECK_STATUS') {
        const status = checkLoginStatus();
        window.postMessage({
          type: 'YUKETANG_STATUS',
          status: status
        }, '*');
      }
    });

    window.addEventListener('load', () => {
      setTimeout(() => {
        const status = checkLoginStatus();
        if (status.isLoggedIn) {
          window.postMessage({
            type: 'YUKETANG_LOGIN_DETECTED',
            status: status
          }, '*');
        }
      }, 1000);
    });

    console.log('[Yuketang] 内容脚本已加载');
  }
})();
