export const auth = {
  token: localStorage.getItem('wardrobe_token'),

  isLoggedIn() {
    return !!this.token;
  },

  setToken(token) {
    this.token = token;
    localStorage.setItem('wardrobe_token', token);
  },

  clearToken() {
    this.token = null;
    localStorage.removeItem('wardrobe_token');
  },

  async login(password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await res.json();
      if (data.success) {
        this.setToken(data.token);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (e) {
      return { success: false, error: '网络错误' };
    }
  },

  logout() {
    this.clearToken();
    location.reload();
  },

  /**
   * Internal wrapper for fetch that includes auth header and handles 401
   */
  async _fetch(url, options = {}) {
    // Include token in header if present
    if (this.token) {
      options.headers = {
        ...options.headers,
        'x-auth-token': this.token
      };
    }

    const response = await window._originalFetch(url, options);
    
    if (response.status === 401 && !url.includes('/api/auth/login')) {
      this.clearToken();
      this.showLoginOverlay();
      throw new Error('Unauthorized');
    }

    return response;
  },

  interceptFetch() {
    if (window._originalFetch) return; // Already intercepted
    window._originalFetch = window.fetch;
    window.fetch = (url, options) => this._fetch(url, options);
  },

  showLoginOverlay() {
    const overlay = document.getElementById('login-overlay');
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.add('visible');
    }
    const appContent = document.getElementById('app-container');
    if (appContent) appContent.style.filter = 'blur(10px) grayscale(50%)';
  },

  hideLoginOverlay() {
    const overlay = document.getElementById('login-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => { overlay.hidden = true; }, 300);
    }
    const appContent = document.getElementById('app-container');
    if (appContent) appContent.style.filter = 'none';
  },

  init() {
    this.interceptFetch();
    if (!this.isLoggedIn()) {
      this.showLoginOverlay();
    }
    
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const passwordInput = document.getElementById('login-password');
        const submitBtn = loginForm.querySelector('button');
        const errorMsg = document.getElementById('login-error');
        
        submitBtn.disabled = true;
        submitBtn.innerText = '验证中...';
        errorMsg.innerText = '';

        const result = await this.login(passwordInput.value);
        if (result.success) {
          this.hideLoginOverlay();
          window.dispatchEvent(new Event('auth-success'));
          // Reload to ensure all fresh data is loaded with the new token
          setTimeout(() => location.reload(), 500); 
        } else {
          errorMsg.innerText = result.error;
          passwordInput.classList.add('shake');
          setTimeout(() => passwordInput.classList.remove('shake'), 400);
        }
        
        submitBtn.disabled = false;
        submitBtn.innerText = '进入衣橱';
      });
    }
  }
};
