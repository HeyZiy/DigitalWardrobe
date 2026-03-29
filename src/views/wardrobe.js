import { $, $$, escapeHtml } from '../utils.js';
import { fetchData, normalize, renderCsvTable } from '../components/table.js';

let currentTab = 'inventory';
let activeCategory = '全部';

export async function renderWardrobeView(contentEl, loadingEl, navigate) {
  loadingEl.hidden = false;
  currentTab = 'inventory';
  
  try {
    const rawData = await fetchData('/api/items');
    const items = normalize(rawData).normalized;
    
    // SQLite records have 'location' column: 'inventory', 'storage', 'discard'
    const inv = items.filter(r => r.location === 'inventory');
    const store = items.filter(r => r.location === 'storage');
    const disc = items.filter(r => r.location === 'discard');
    
    renderWardrobeLayout(contentEl, { inv, store, disc }, navigate);
    setupWardrobeEvents(contentEl, navigate);
  } catch (e) {
    contentEl.innerHTML = `<div class="muted">衣柜管理加载失败：${escapeHtml(e.message)}</div>`;
  } finally {
    loadingEl.hidden = true;
  }
}

// Removed static CATEGORY_GROUPS and getCategoryGroup mapping
// Categories will now be dynamically extracted from the data.

function renderWardrobeLayout(contentEl, data, navigate) {
  const { inv, store, disc } = data;
  
  contentEl.innerHTML = `
    <section class="wardrobe-view">
      <div class="view-tabs">
        <button class="tab-btn ${currentTab === 'inventory' ? 'active' : ''}" data-tab="inventory">🧥 衣柜区域 (${inv.length})</button>
        <button class="tab-btn ${currentTab === 'storage' ? 'active' : ''}" data-tab="storage">📦 收纳区域 (${store.length})</button>
        <button class="tab-btn ${currentTab === 'discard' ? 'active' : ''}" data-tab="discard">🗑️ 预淘汰区 (${disc.length})</button>
      </div>
      <div id="tab-content"></div>
    </section>
  `;
  
  renderTabContent($('#tab-content', contentEl), data, navigate);
}

function renderTabContent(tabEl, data, navigate) {
  const { inv, store, disc } = data;
  
  let currentData, title, fileType;
  switch (currentTab) {
    case 'inventory':
      currentData = inv;
      title = '衣柜区域';
      fileType = 'inventory';
      break;
    case 'storage':
      currentData = store;
      title = '收纳区域';
      fileType = 'storage';
      break;
    case 'discard':
      currentData = disc;
      title = '预淘汰区';
      fileType = 'discard';
      break;
  }
  
  const allActiveItems = [...inv, ...store]; // Consider both inventory and storage as assets

  const catMap = {};
  const colorMap = {};
  let totalAssetValue = 0;
  
  allActiveItems.forEach(r => {
    // Categorization
    const cat = r.category || '其他';
    catMap[cat] = (catMap[cat] || 0) + 1;
    
    // Color
    const color = r.color || '其他';
    colorMap[color] = (colorMap[color] || 0) + 1;
    
    // Valuation
    const price = parseFloat(r.price);
    if (!isNaN(price)) {
      totalAssetValue += price;
    }
  });

  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  // Extract all unique categories for the filters
  const allCategories = ['全部', ...Object.keys(catMap).sort()];
  
  const topColors = Object.entries(colorMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const totalItems = allActiveItems.length;
  
  const recent = [...allActiveItems].sort((a, b) => b.id - a.id).slice(0, 3);
  
  tabEl.innerHTML = `
    <div class="dash-section" style="margin-bottom:24px">
      <div class="stats-grid">
        <div class="stat-card highlight">
          <div class="stat-val">${totalItems} 件</div>
          <div class="stat-label">在库衣物总数</div>
        </div>
        <div class="stat-card" style="border-color:rgba(16,185,129,0.3);background:linear-gradient(145deg,var(--panel),rgba(16,185,129,0.05))">
          <div class="stat-val" style="color:#34d399">¥${totalAssetValue.toFixed(2)}</div>
          <div class="stat-label">衣橱资产估值</div>
        </div>
        <div class="stat-card" style="border-color:rgba(45,212,191,0.3);background:linear-gradient(145deg,var(--panel),rgba(45,212,191,0.05))">
          <div class="stat-val" style="color:var(--accent)">${inv.length} 件</div>
          <div class="stat-label">当前季节 (外挂区)</div>
        </div>
      </div>
    </div>

    <div class="dashboard-grid" style="margin-bottom:24px">
      <div class="dash-panel">
        <h3>最近入库</h3>
        <div class="recent-list">
          ${recent.length ? recent.map(r => `
            <div class="recent-item">
              <span class="pill pill-category">${escapeHtml(r.category || '衣物')}</span>
              <span class="name">${escapeHtml(r.name)}</span>
              <span class="muted">${escapeHtml(r.buy_date || '')}</span>
            </div>
          `).join('') : '<div class="muted">暂无记录</div>'}
        </div>
      </div>
      
      <div class="dash-panel">
        <h3>分类概览 (Top 5)</h3>
        <div class="cat-list">
          ${topCats.length ? topCats.map(([cat, count]) => {
            const pct = totalItems ? ((count / totalItems) * 100).toFixed(0) : 0;
            return `
              <div class="cat-row">
                <div class="cat-info">
                  <span>${escapeHtml(cat)}</span>
                  <span>${count}件 (${pct}%)</span>
                </div>
                <div class="progress-bg"><div class="progress-fill" style="width:${pct}%"></div></div>
              </div>
            `;
          }).join('') : '<div class="muted">暂无数据</div>'}
        </div>
      </div>

      <div class="dash-panel">
        <h3>色彩分布</h3>
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px">
          ${topColors.length ? topColors.map(([color, count]) => {
            let colorCode = '#5a6270'; // fallback
            if (color.includes('白')) colorCode = '#f1f5f9';
            if (color.includes('黑')) colorCode = '#1e293b';
            if (color.includes('灰')) colorCode = '#94a3b8';
            if (color.includes('蓝')) colorCode = '#3b82f6';
            if (color.includes('红')) colorCode = '#ef4444';
            if (color.includes('绿')) colorCode = '#22c55e';
            if (color.includes('黄')) colorCode = '#eab308';
            if (color.includes('粉')) colorCode = '#f472b6';
            if (color.includes('紫')) colorCode = '#a855f7';
            if (color.includes('褐') || color.includes('咖') || color.includes('卡其') || color.includes('棕')) colorCode = '#8b5cf6';
            
            const isLight = colorCode === '#f1f5f9';
            
            return `
              <div style="display:flex; align-items:center; gap:6px; background:var(--bg); padding:4px 8px; border-radius:6px; font-size:12px; border:1px solid var(--border)">
                <span style="width:12px; height:12px; border-radius:50%; background:${colorCode}; ${isLight ? 'border:1px solid #ccc;' : ''} display:inline-block"></span>
                <span>${escapeHtml(color)}</span>
                <span class="muted">${count}</span>
              </div>
            `;
          }).join('') : '<div class="muted">暂无颜色数据</div>'}
        </div>
      </div>
    </div>
    
    <div class="dash-section">
      <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:16px;">
        <h3 style="margin:0; font-size:16px;">
          ${title}明细 
          <span class="muted" style="font-size:13px;font-weight:normal">(${title === '预淘汰区' ? '待处理' : '按品类查看'})</span>
        </h3>
        <div class="category-filters" style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end">
          ${allCategories.map(g => `
            <button class="cat-filter-btn ${activeCategory === g ? 'active' : ''}" data-cat="${g}" style="background:${activeCategory === g ? 'var(--brand)' : 'transparent'}; color:${activeCategory === g ? '#fff' : 'var(--muted)'}; border:1px solid ${activeCategory === g ? 'var(--brand)' : 'var(--border)'}; padding:4px 10px; border-radius:14px; cursor:pointer; font-size:12px; transition:all 0.2s;">
              ${escapeHtml(g)}
            </button>
          `).join('')}
          <button id="add-wardrobe-btn" style="background:var(--accent); color:#161a22; border:none; padding:4px 12px; border-radius:14px; cursor:pointer; font-size:12px; font-weight:bold; transition:all 0.2s; margin-left:8px;">
            + 新增记录
          </button>
        </div>
      </div>
      <div id="wardrobe-table-container"></div>
    </div>
  `;
  
  const filteredData = activeCategory === '全部' 
    ? currentData 
    : currentData.filter(r => (r.category || '其他') === activeCategory);

  const container = $('#wardrobe-table-container', tabEl);
  renderCsvTable(container, title, fileType, filteredData, null, true);
}

function setupWardrobeEvents(contentEl, navigate) {
  $$('.tab-btn', contentEl).forEach(btn => {
    btn.addEventListener('click', async (e) => {
      currentTab = e.target.dataset.tab;
      activeCategory = '全部'; // Reset category filter on location change
      $$('.tab-btn', contentEl).forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      refreshWardrobeData(contentEl, navigate);
    });
  });

  // Category Filter Events
  $$('.cat-filter-btn', contentEl).forEach(btn => {
    btn.addEventListener('click', async (e) => {
      activeCategory = e.target.dataset.cat;
      refreshWardrobeData(contentEl, navigate);
    });
  });

  const addBtn = $('#add-wardrobe-btn', contentEl);
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const { showModal } = await import('../components/modal.js');
      const emptyData = {
        name: '', category: '', brand: '', color: '', price: '',
        buy_date: '', source: '', url: '', image: '',
        season: '', status: '已入库', remarks: '',
        location: currentTab // default to current tab
      };
      
      showModal('添加新物品', emptyData, async (newData) => {
        try {
          // 1. 先添加衣柜物品
          const res = await fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newData)
          });
          if (!res.ok) {
            alert('添加失败，请重试');
            return;
          }
          // Removed synchronous creation in /api/purchases (Single Source of Truth)
          alert('添加成功！');
          refreshWardrobeData(contentEl, navigate);
        } catch(e) {
          alert('操作失败：' + e.message);
        }
      });
    });
  }
}

async function refreshWardrobeData(contentEl, navigate) {
  const rawData = await fetchData('/api/items');
  const items = normalize(rawData).normalized;
  
  const inv = items.filter(r => r.location === 'inventory');
  const store = items.filter(r => r.location === 'storage');
  const disc = items.filter(r => r.location === 'discard');
  
  renderTabContent($('#tab-content', contentEl), { inv, store, disc }, navigate);
  setupWardrobeEvents(contentEl, navigate);
}
