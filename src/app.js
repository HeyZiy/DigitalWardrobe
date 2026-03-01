import { $, $$, escapeHtml, getBudgets, setBudgets } from './utils.js';
import { FILES, DEFAULT_BUDGETS } from './config.js';
import { renderFinanceView } from './views/finance.js';
import { renderWardrobeView } from './views/wardrobe.js';
import { showModal, hideModal } from './components/modal.js';

const contentEl = $('#content');
const loadingEl = $('#loading');
const searchEl = $('#global-search');

let currentView = 'finance';

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

initNavigation();
navigate('finance');
