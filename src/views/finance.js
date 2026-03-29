import { $, $$, escapeHtml, formatPrice, formatDate, getStoredYear, setStoredYear, getBudgets } from '../utils.js';
import { DEFAULT_BUDGETS } from '../config.js';
import { fetchData, normalize, renderCsvTable, setupTableEvents } from '../components/table.js';
// Removed purchaseForm.js import since items modal is used for manual add

let currentTab = 'overview';

export async function renderFinanceView(contentEl, loadingEl, navigate) {
  loadingEl.hidden = false;
  currentTab = 'overview';
  
  try {
    const purch = await fetchFinanceData();
    renderFinanceLayout(contentEl, purch, navigate);
    setupFinanceEvents(contentEl, navigate);
  } catch (e) {
    contentEl.innerHTML = `<div class="muted">财务管理加载失败：${escapeHtml(e.message)}</div>`;
  } finally {
    loadingEl.hidden = true;
  }
}

async function fetchFinanceData() {
  const rawData = await fetchData('/api/items');
  const mappedPurchases = rawData
    .filter(row => row.price > 0 || row.buy_date) 
    .map(row => ({
      id: row.id,
      图片: row.image || '',
      名称: row.name || '',
      品牌: row.brand || '',
      分类: row.category || '',
      购买日期: row.buy_date || '',
      购买途径: row.source || '',
      价格: row.price || 0,
      当前下落: (row.location === 'inventory' ? '正在使用' : row.location === 'storage' ? '已收纳' : row.location === 'discard' ? '已淘汰' : row.location || '未知'),
      状态: row.status || '',
      购买链接: row.url || '',
      备注: row.season || ''
    }));
  mappedPurchases.sort((a, b) => new Date(b.购买日期 || 0).getTime() - new Date(a.购买日期 || 0).getTime());
  return normalize(mappedPurchases).normalized;
}

function renderFinanceLayout(contentEl, purch, navigate) {
  contentEl.innerHTML = `
    <section class="finance-view">
      <div class="view-tabs">
        <button class="tab-btn ${currentTab === 'overview' ? 'active' : ''}" data-tab="overview">📊 概览</button>
        <button class="tab-btn ${currentTab === 'history' ? 'active' : ''}" data-tab="history">📜 历史购买</button>
      </div>
      <div id="tab-content"></div>
    </section>
  `;
  
  renderTabContent($('#tab-content', contentEl), purch, navigate);
}

function renderTabContent(tabEl, purch, navigate) {
  if (currentTab === 'overview') {
    renderOverviewTab(tabEl, purch, navigate);
  } else {
    renderHistoryTab(tabEl, purch, navigate);
  }
}

function renderOverviewTab(tabEl, purch, navigate) {
  const availableYears = new Set();
  purch.forEach(r => {
    const d = formatDate(r['购买日期']);
    if (d) availableYears.add(d.getFullYear());
  });
  const years = Array.from(availableYears).sort((a, b) => b - a);
  
  const now = new Date();
  const currentYear = now.getFullYear();
  let selectedYear = getStoredYear();
  if (!selectedYear || !years.includes(selectedYear)) {
    selectedYear = currentYear;
  }
  
  const { yearCost, yearCount, monthly, monthlyLabels } = calculateRollingMonthly(purch, selectedYear);
  const lastYear = selectedYear - 1;
  const { yearCost: lastYearCost } = calculateStatsForYear(purch, lastYear);
  
  const currentMonth = now.getMonth();
  const currentMonthSpending = monthly[monthly.length - 1] || 0;
  const lastMonthSpending = monthly[monthly.length - 2] || 0;
  const yoyGrowthRate = lastYearCost > 0 ? ((yearCost - lastYearCost) / lastYearCost) * 100 : 0;
  const momGrowthRate = lastMonthSpending > 0 ? ((currentMonthSpending - lastMonthSpending) / lastMonthSpending) * 100 : 0;
  
  const budgets = getBudgets();
  const yearlyBudget = parseFloat(budgets.yearly) || DEFAULT_BUDGETS.yearly;
  const monthlyBudget = parseFloat(budgets.monthly) || DEFAULT_BUDGETS.monthly;
  const remainingYearlyBudget = Math.max(0, yearlyBudget - yearCost);
  const remainingMonthlyBudget = Math.max(0, monthlyBudget - currentMonthSpending);
  const yearlyBudgetUsage = (yearCost / yearlyBudget) * 100;
  const monthlyBudgetUsage = (currentMonthSpending / monthlyBudget) * 100;
  
  const totalCost = purch.reduce((sum, r) => sum + formatPrice(r['价格']), 0);
  
  const categorySpending = {};
  const brandSpending = {};
  purch.forEach(r => {
    const price = formatPrice(r['价格']);
    const category = r['分类'] || r['类型'] || '其他';
    const brand = r['品牌'] || '无品牌';
    categorySpending[category] = (categorySpending[category] || 0) + price;
    brandSpending[brand] = (brandSpending[brand] || 0) + price;
  });
  
  const topCategorySpending = Object.entries(categorySpending).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topBrandSpending = Object.entries(brandSpending).sort((a, b) => b[1] - a[1]).slice(0, 5);
  
  const maxMonth = Math.max(...monthly) || 1;
  
  tabEl.innerHTML = `
    <div class="dash-section">
      <h3 class="section-title">财务概览</h3>
      <div class="stats-grid">
        <div class="stat-card highlight">
          <div class="stat-val">¥${totalCost.toFixed(2)}</div>
          <div class="stat-label">历史累计支出 (${purch.length}件)</div>
        </div>
        <div class="stat-card" style="border-color:rgba(45,212,191,0.3);background:linear-gradient(145deg,var(--panel),rgba(45,212,191,0.05))">
          <div class="stat-val" style="color:var(--accent)">¥${yearCost.toFixed(2)}</div>
          <div class="stat-label">${selectedYear}年支出 (${yearCount}件)</div>
          <div style="font-size:12px;margin-top:4px;color:${yoyGrowthRate >= 0 ? '#34d399' : '#f87171'}">同比 ${yoyGrowthRate >= 0 ? '+' : ''}${yoyGrowthRate.toFixed(1)}%</div>
        </div>
        <div class="stat-card" style="border-color:rgba(16,185,129,0.3);background:linear-gradient(145deg,var(--panel),rgba(16,185,129,0.05))">
          <div class="stat-val" style="color:#34d399">¥${currentMonthSpending.toFixed(2)}</div>
          <div class="stat-label">本月支出</div>
          <div style="font-size:12px;margin-top:4px;color:${momGrowthRate >= 0 ? '#34d399' : '#f87171'}">环比 ${momGrowthRate >= 0 ? '+' : ''}${momGrowthRate.toFixed(1)}%</div>
        </div>
      </div>
    </div>

    <div class="dash-section">
      <h3 class="section-title">预算管理</h3>
      <div class="stats-grid">
        <div class="stat-card" style="border-color:rgba(250,204,21,0.3);background:linear-gradient(145deg,var(--panel),rgba(250,204,21,0.05))">
          <div class="stat-val" style="color:#facc15">¥${remainingMonthlyBudget.toFixed(2)}</div>
          <div class="stat-label">本月剩余预算</div>
        </div>
        <div class="stat-card" style="border-color:rgba(16,185,129,0.3);background:linear-gradient(145deg,var(--panel),rgba(16,185,129,0.05))">
          <div class="stat-val" style="color:#34d399">¥${remainingYearlyBudget.toFixed(2)}</div>
          <div class="stat-label">本年剩余预算</div>
        </div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="dash-panel">
        <h3 style="display:flex;align-items:center;gap:12px">
          <span>消费趋势（近12个月）</span>
          <select id="year-selector" class="year-selector" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:6px;font-size:13px;cursor:pointer">
            <option value="${currentYear}" ${selectedYear === currentYear ? 'selected' : ''}>当前</option>
            ${years.filter(y => y !== currentYear).map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}年</option>`).join('')}
          </select>
        </h3>
        ${renderMonthlyChart(monthly, monthlyLabels, maxMonth)}
      </div>
      
      <div class="dash-panel">
        <h3>预算使用情况</h3>
        ${renderBudgetProgress('月度预算', currentMonthSpending, monthlyBudget, monthlyBudgetUsage)}
        ${renderBudgetProgress('年度预算', yearCost, yearlyBudget, yearlyBudgetUsage)}
        <hr style="border:0;border-top:1px solid var(--border);margin:16px 0">
        <div class="quick-actions">
          <button class="action-btn" onclick="setBudget()">💰 设置预算</button>
          <button class="action-btn" onclick="exportFinancialReport()">📊 导出财务报告</button>
          <button class="action-btn" data-action="switch-to-history">🛒 记录新购入</button>
        </div>
      </div>
      
      <div class="dash-panel">
        <h3>消费类别分析 (Top 5)</h3>
        ${renderSpendingList(topCategorySpending, categorySpending)}
      </div>
      
      <div class="dash-panel">
        <h3>品牌消费分析 (Top 5)</h3>
        ${renderSpendingList(topBrandSpending, brandSpending)}
      </div>
    </div>
  `;
}

function renderHistoryTab(tabEl, purch, navigate) {
  tabEl.innerHTML = `
    <div class="dash-section">
      <div class="controls" style="margin-bottom:16px; display:flex; gap:12px">
        <button class="action-btn" id="add-purchase-btn" style="background:var(--brand);color:white;border-color:var(--brand)">
          📝 手动添加记录
        </button>
      </div>
      <div id="purchases-table-container"></div>
    </div>
  `;
  
  const container = $('#purchases-table-container', tabEl);
  renderCsvTable(container, '历史购买记录', 'purchases', purch, null, true);
  
  const addBtn = $('#add-purchase-btn', tabEl);
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const { showModal } = await import('../components/modal.js');
      const emptyData = {
        name: '', category: '', brand: '', color: '', price: '',
        buy_date: '', source: '', url: '', image: '',
        season: '', status: '已入库', remarks: '',
        location: 'inventory'
      };
      
      showModal('通过财务单据添加物品', emptyData, async (newData) => {
        try {
          const res = await fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newData)
          });
          if (!res.ok) throw new Error('保存失败');
          
          alert('入库成功！');
          // Refresh the view
          const newPurch = await fetchFinanceData();
          renderTabContent($('#tab-content', tabEl.parentElement), newPurch, navigate);
        } catch (e) {
          alert('操作失败：' + e.message);
        }
      });
    });
  }
}

// Removed savePurchase as we now POST directly to /api/items

function calculateStatsForYear(purch, year) {
  let yearCost = 0;
  let yearCount = 0;
  
  purch.forEach(r => {
    const price = formatPrice(r['价格']);
    const d = formatDate(r['购买日期']);
    if (d && d.getFullYear() === year) {
      yearCost += price;
      yearCount++;
    }
  });
  
  return { yearCost, yearCount };
}

function calculateRollingMonthly(purch, selectedYear) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  const monthly = [];
  const monthlyLabels = [];
  let yearCost = 0;
  let yearCount = 0;
  
  for (let i = 11; i >= 0; i--) {
    let targetYear, targetMonth;
    
    if (selectedYear === currentYear) {
      const targetDate = new Date(currentYear, currentMonth - i, 1);
      targetYear = targetDate.getFullYear();
      targetMonth = targetDate.getMonth();
    } else {
      targetYear = selectedYear;
      targetMonth = 11 - i;
    }
    
    monthlyLabels.push(`${targetYear % 100}/${String(targetMonth + 1).padStart(2, '0')}`);
    
    let monthTotal = 0;
    purch.forEach(r => {
      const price = formatPrice(r['价格']);
      const d = formatDate(r['购买日期']);
      if (d && d.getFullYear() === targetYear && d.getMonth() === targetMonth) {
        monthTotal += price;
        if (d.getFullYear() === selectedYear) {
          yearCost += price;
          yearCount++;
        }
      }
    });
    monthly.push(monthTotal);
  }
  
  return { yearCost, yearCount, monthly, monthlyLabels };
}

function renderMonthlyChart(monthly, monthlyLabels, maxMonth) {
  return `
    <div class="chart-container" style="display:flex;align-items:flex-end;height:150px;gap:6px;padding-top:24px;overflow:hidden">
      ${monthly.map((val, i) => {
        const height = Math.min(100, (val / maxMonth * 100).toFixed(0));
        const isZero = val === 0;
        return `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;position:relative;min-width:0">
            <div style="flex:1;width:100%;display:flex;align-items:flex-end;position:relative">
              <div style="width:100%;background:${isZero ? 'rgba(255,255,255,0.05)' : 'linear-gradient(180deg, var(--brand), var(--accent))'};height:${isZero ? '4px' : height + '%'};border-radius:4px 4px 0 0;transition:all 0.8s ease-out;opacity:${isZero?0.5:1};box-shadow:0 2px 8px rgba(79,124,255,0.3);transform-origin:bottom;transform:scaleY(0);animation:growBar 1s ease-out ${i * 0.05}s forwards;max-height:calc(100% - 24px)"></div>
              ${!isZero ? `<span style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);font-size:9px;color:var(--muted);opacity:0;animation:fadeIn 0.5s ease-out ${i * 0.05 + 0.6}s forwards;white-space:nowrap">${val >= 1000 ? (val/1000).toFixed(1)+'k' : val.toFixed(0)}</span>` : ''}
            </div>
            <span style="font-size:9px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;text-align:center">${monthlyLabels[i]}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderBudgetProgress(label, used, total, usage) {
  return `
    <div style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span>${label}</span>
        <span>¥${used.toFixed(2)}/${total.toFixed(2)}</span>
      </div>
      <div class="progress-bg">
        <div class="progress-fill" style="width:${Math.min(100, usage)}%;background:${usage > 80 ? '#f87171' : usage > 60 ? '#facc15' : 'var(--brand)'}"></div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">${usage.toFixed(0)}% 使用</div>
    </div>
  `;
}

function renderSpendingList(items, allItems) {
  const totalSpending = Object.values(allItems).reduce((sum, val) => sum + val, 0);
  return `
    <div class="cat-list">
      ${items.map(([name, amount]) => {
        const pct = totalSpending > 0 ? ((amount / totalSpending) * 100).toFixed(0) : 0;
        return `
          <div class="cat-row">
            <div class="cat-info">
              <span>${escapeHtml(name)}</span>
              <span>¥${amount.toFixed(2)} (${pct}%)</span>
            </div>
            <div class="progress-bg"><div class="progress-fill" style="width:${pct}%"></div></div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function setupFinanceEvents(contentEl, navigate) {
  $$('.tab-btn', contentEl).forEach(btn => {
    btn.addEventListener('click', async (e) => {
      currentTab = e.target.dataset.tab;
      $$('.tab-btn', contentEl).forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      const purch = await fetchFinanceData();
      renderTabContent($('#tab-content', contentEl), purch, navigate);
      setupFinanceEvents(contentEl, navigate);
    });
  });
  
  const yearSelector = $('#year-selector', contentEl);
  if (yearSelector) {
    yearSelector.addEventListener('change', async (e) => {
      setStoredYear(parseInt(e.target.value));
      const rawData = await fetchData('/api/purchases');
      const purch = normalize(rawData).normalized;
      renderTabContent($('#tab-content', contentEl), purch, navigate);
      setupFinanceEvents(contentEl, navigate);
    });
  }
  
  const switchBtn = $('[data-action="switch-to-history"]', contentEl);
  if (switchBtn) {
    switchBtn.addEventListener('click', async () => {
      currentTab = 'history';
      $$('.tab-btn', contentEl).forEach(b => b.classList.remove('active'));
      $$('[data-tab="history"]', contentEl).forEach(b => b.classList.add('active'));
      
      const rawData = await fetchData('/api/purchases');
      const purch = normalize(rawData).normalized;
      renderTabContent($('#tab-content', contentEl), purch, navigate);
      setupFinanceEvents(contentEl, navigate);
    });
  }
}
