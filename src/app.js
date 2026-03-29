import { $, $$, escapeHtml, getBudgets, setBudgets } from './utils.js';
import { FILES, DEFAULT_BUDGETS } from './config.js';
import { renderFinanceView } from './views/finance.js';
import { renderWardrobeView } from './views/wardrobe.js';
import { showModal, hideModal } from './components/modal.js';

const contentEl = $('#content');
const loadingEl = $('#loading');
const searchEl = $('#global-search');

let currentView = 'wardrobe';

const views = {
  finance: () => renderFinanceView(contentEl, loadingEl, navigate),
  wardrobe: () => renderWardrobeView(contentEl, loadingEl, navigate),
};

function navigate(view) {
  currentView = view;
  contentEl.hidden = false;
  
  $$('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  
  if (views[view]) {
    views[view]();
  }
}

function initNavigation() {
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) navigate(view);
    });
  });
  
  if (searchEl) {
    searchEl.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      $$('tbody tr', contentEl).forEach(tr => {
        const text = tr.textContent.toLowerCase();
        tr.style.display = text.includes(query) ? '' : 'none';
      });
    });
  }

  const fastImportBtn = $('#global-fast-import-btn');
  if (fastImportBtn) {
    fastImportBtn.addEventListener('click', async () => {
      const { showImageImportModal } = await import('./components/purchaseForm.js');
      showImageImportModal(async (record) => {
        try {
          // 1. 同步写入衣柜 (Single Source of Truth)
          await fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({...record, location: 'inventory', add_date: record.buy_date})
          });
          
          // Global event to force views to refresh
          window.dispatchEvent(new Event('data-refreshed'));
          navigate(currentView); // re-render the current view
        } catch (e) {
          alert('入库发生错误: ' + e.message);
        }
      });
    });
  }
}

window.setBudget = function() {
  const budgets = getBudgets();
  const yearly = prompt('设置年度预算:', budgets.yearly || DEFAULT_BUDGETS.yearly);
  if (yearly !== null) {
    const monthly = prompt('设置月度预算:', budgets.monthly || DEFAULT_BUDGETS.monthly);
    if (monthly !== null) {
      setBudgets({ yearly: parseFloat(yearly), monthly: parseFloat(monthly) });
      navigate(currentView);
    }
  }
};

window.exportFinancialReport = function() {
  alert('导出功能开发中...');
};

window.addEventListener('data-refreshed', () => {
  navigate(currentView);
});

initNavigation();
navigate('wardrobe');
