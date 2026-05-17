/**
 * 移动端应用启动器
 * Capacitor 移动应用入口点
 */

import { createSyncManager } from '../src/sync.js';

const API_BASE_URL = window.CAPACITOR_API_URL || 
  import.meta.env.VITE_API_BASE_URL ||
  'https://your-api.railway.app';

export async function initializeMobileApp() {
  console.log('[Mobile] 初始化移动应用...');
  console.log('[Mobile] API 地址:', API_BASE_URL);

  window.MOBILE_API_URL = API_BASE_URL;
  window.API_BASE_URL = API_BASE_URL;

  const syncManager = createSyncManager(API_BASE_URL);
  
  await syncManager.performSync();
  
  setupSyncStatusListener(syncManager);
  
  setupBackgroundSync(syncManager);
  
  return syncManager;
}

function setupSyncStatusListener(syncManager) {
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');
  
  if (statusDot && statusText) {
    const updateStatus = () => {
      const status = syncManager.getSyncStatus();
      
      statusDot.classList.remove('online', 'offline', 'syncing');
      statusDot.classList.add(status.isOnline ? 'online' : 'offline');
      
      statusText.textContent = status.isOnline 
        ? (status.syncInProgress ? '同步中...' : '已连接')
        : '离线模式';
      
      if (status.syncInProgress) {
        statusDot.classList.add('syncing');
      }
    };
    
    syncManager.addListener((event, data) => {
      console.log('[Mobile] 同步事件:', event);
      updateStatus();
      
      if (event === 'sync-complete') {
        showToast('数据已同步', 'success');
      } else if (event === 'sync-error') {
        showToast('同步失败，请检查网络', 'error');
      }
    });
    
    updateStatus();
  }
}

function setupBackgroundSync(syncManager) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('[Mobile] Service Worker 已注册:', registration.scope);
    }).catch(error => {
      console.log('[Mobile] Service Worker 注册失败:', error);
    });
  }
  
  setInterval(() => {
    if (syncManager.isOnline && !syncManager.syncInProgress) {
      const pendingCount = syncManager.pendingOperations.length;
      if (pendingCount > 0) {
        console.log(`[Mobile] 自动同步待处理操作 (${pendingCount})`);
        syncManager.performSync();
      }
    }
  }, 60000);
}

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export async function checkForUpdates() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/version`);
    if (response.ok) {
      const data = await response.json();
      const currentVersion = '0.1.0';
      
      if (data.version !== currentVersion) {
        showToast(`发现新版本: ${data.version}`, 'info');
        return true;
      }
    }
  } catch (e) {
    console.log('[Mobile] 检查更新失败:', e);
  }
  return false;
}

if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeMobileApp().catch(console.error);
  });
}
