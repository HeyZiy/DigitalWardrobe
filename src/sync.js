/**
 * 多端数据同步管理器
 * 支持离线操作、冲突处理和自动同步
 */

export class SyncManager {
  constructor(apiBaseUrl) {
    this.apiBaseUrl = apiBaseUrl || this.detectApiBaseUrl();
    this.pendingOperations = [];
    this.lastSyncTime = parseInt(localStorage.getItem('lastSyncTime')) || 0;
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.listeners = new Set();
    
    this.setupNetworkListeners();
    this.loadPendingOperations();
    
    window.syncManager = this;
  }

  detectApiBaseUrl() {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '';
    }
    return `https://${hostname}`;
  }

  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[Sync] 网络已连接，开始处理待同步操作...');
      this.processPendingOperations();
      this.performSync();
      this.notifyListeners('online');
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[Sync] 网络已断开，进入离线模式');
      this.notifyListeners('offline');
    });
  }

  loadPendingOperations() {
    try {
      const stored = localStorage.getItem('pendingSyncOperations');
      if (stored) {
        this.pendingOperations = JSON.parse(stored);
        console.log(`[Sync] 加载了 ${this.pendingOperations.length} 个待同步操作`);
      }
    } catch (e) {
      console.error('[Sync] 加载待同步操作失败:', e);
      this.pendingOperations = [];
    }
  }

  savePendingOperations() {
    try {
      localStorage.setItem('pendingSyncOperations', JSON.stringify(this.pendingOperations));
    } catch (e) {
      console.error('[Sync] 保存待同步操作失败:', e);
    }
  }

  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (e) {
        console.error('[Sync] 通知监听器失败:', e);
      }
    });
  }

  async queueOperation(operation) {
    const op = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      type: operation.type,
      endpoint: operation.endpoint,
      data: operation.data,
      retryCount: 0
    };
    
    this.pendingOperations.push(op);
    this.savePendingOperations();
    
    console.log(`[Sync] 操作已加入队列: ${operation.type} ${operation.endpoint}`);
    
    if (this.isOnline) {
      await this.processPendingOperations();
    }
    
    return op.id;
  }

  async processPendingOperations() {
    if (this.syncInProgress || this.pendingOperations.length === 0) {
      return;
    }
    
    this.syncInProgress = true;
    this.notifyListeners('sync-start');
    
    while (this.pendingOperations.length > 0) {
      const operation = this.pendingOperations[0];
      
      try {
        await this.executeOperation(operation);
        this.pendingOperations.shift();
        this.savePendingOperations();
        console.log(`[Sync] 操作执行成功: ${operation.type} ${operation.endpoint}`);
      } catch (error) {
        console.error(`[Sync] 操作执行失败:`, error);
        operation.retryCount++;
        
        if (operation.retryCount >= 3) {
          console.warn(`[Sync] 操作重试次数过多，移至失败队列: ${operation.type}`);
          this.pendingOperations.shift();
          this.savePendingOperations();
          this.notifyUser('同步失败', `操作未能同步，请检查网络后重试`);
        } else {
          await this.delay(3000);
        }
      }
    }
    
    this.syncInProgress = false;
    this.lastSyncTime = Date.now();
    localStorage.setItem('lastSyncTime', this.lastSyncTime);
    this.notifyListeners('sync-complete');
  }

  async executeOperation(operation) {
    const token = localStorage.getItem('wardrobe_token');
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['x-auth-token'] = token;
    }
    
    const url = operation.endpoint.startsWith('http') 
      ? operation.endpoint 
      : `${this.apiBaseUrl}${operation.endpoint}`;
    
    let response;
    
    switch (operation.type) {
      case 'create':
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(operation.data)
        });
        break;
        
      case 'update':
        response = await fetch(`${url}/${operation.data.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(operation.data)
        });
        break;
        
      case 'delete':
        response = await fetch(`${url}/${operation.data.id}`, {
          method: 'DELETE',
          headers
        });
        break;
        
      default:
        throw new Error(`未知操作类型: ${operation.type}`);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  }

  async performSync() {
    if (!this.isOnline || this.syncInProgress) {
      return;
    }
    
    this.syncInProgress = true;
    this.notifyListeners('sync-start');
    
    try {
      await this.processPendingOperations();
      
      const token = localStorage.getItem('wardrobe_token');
      const headers = {};
      if (token) {
        headers['x-auth-token'] = token;
      }
      
      const response = await fetch(`${this.apiBaseUrl}/api/items`, { headers });
      
      if (response.ok) {
        const items = await response.json();
        localStorage.setItem('cachedItems', JSON.stringify(items));
        localStorage.setItem('lastSyncTime', Date.now().toString());
        this.lastSyncTime = Date.now();
        window.dispatchEvent(new CustomEvent('data-synced', { detail: items }));
        console.log(`[Sync] 数据同步完成，共 ${items.length} 条记录`);
      }
    } catch (error) {
      console.error('[Sync] 同步失败:', error);
      this.notifyListeners('sync-error', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  getCachedItems() {
    try {
      const cached = localStorage.getItem('cachedItems');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.error('[Sync] 获取缓存数据失败:', e);
      return [];
    }
  }

  clearCache() {
    localStorage.removeItem('cachedItems');
    localStorage.removeItem('pendingSyncOperations');
    localStorage.removeItem('lastSyncTime');
    this.pendingOperations = [];
    this.lastSyncTime = 0;
    console.log('[Sync] 缓存已清除');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  notifyUser(title, message) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }
  }

  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      pendingCount: this.pendingOperations.length,
      lastSyncTime: this.lastSyncTime,
      syncInProgress: this.syncInProgress,
      lastSyncDate: this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString() : null
    };
  }

  formatLastSyncTime() {
    if (!this.lastSyncTime) {
      return '从未同步';
    }
    
    const diff = Date.now() - this.lastSyncTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    return `${days}天前`;
  }
}

export function createSyncManager(apiBaseUrl) {
  return new SyncManager(apiBaseUrl);
}

export function getSyncManager() {
  return window.syncManager || createSyncManager();
}
