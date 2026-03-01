import { $, $$, escapeHtml } from '../utils.js';
import { FILES } from '../config.js';
import { loadCsv, normalize, renderCsvTable } from '../components/table.js';

let currentTab = 'inventory';

export async function renderWardrobeView(contentEl, loadingEl, navigate) {
  loadingEl.hidden = false;
  currentTab = 'inventory';
  
  try {
    const [invRaw, storeRaw, discRaw] = await Promise.all([
      loadCsv(encodeURI(FILES.inventory)),
      loadCsv(encodeURI(FILES.storage)),
      loadCsv(encodeURI(FILES.discard))
    ]);
    
    const inv = normalize(invRaw).normalized.filter(r => r['状态'] === '正在使用');
    const store = normalize(storeRaw).normalized.filter(r => r['状态'] && (r['状态'].includes('收纳') || r['状态'].includes('换季')));
    const disc = normalize(discRaw).normalized.filter(r => r['状态'] && (r['状态'].includes('待处理') || r['状态'].includes('淘汰')));
    
    renderWardrobeLayout(contentEl, { inv, store, disc }, navigate);
    setupWardrobeEvents(contentEl, navigate);
  } catch (e) {
    contentEl.innerHTML = `<div class="muted">衣柜管理加载失败：${escapeHtml(e.message)}</div>`;
  } finally {
    loadingEl.hidden = true;
  }
}

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
  
  const catMap = {};
  currentData.forEach(r => {
    const cat = r['分类'] || r['类型'] || '其他';
    catMap[cat] = (catMap[cat] || 0) + 1;
  });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totalItems = currentData.length;
  
  const recent = [...currentData].reverse().slice(0, 5);
  
  tabEl.innerHTML = `
    <div class="dashboard-grid" style="margin-bottom:24px">
      <div class="dash-panel">
        <h3>最近入库</h3>
        <div class="recent-list">
          ${recent.length ? recent.map(r => `
            <div class="recent-item">
              <span class="pill">${escapeHtml(r['分类'] || r['类型'] || '衣物')}</span>
              <span class="name">${escapeHtml(r['名称'])}</span>
              <span class="muted">${escapeHtml(r['入库日期'] || '')}</span>
            </div>
          `).join('') : '<div class="muted">暂无记录</div>'}
        </div>
      </div>
      
      <div class="dash-panel">
        <h3>分类概览 (Top 5)</h3>
        <div class="cat-list">
          ${topCats.length ? topCats.map(([cat, count]) => {
            const pct = ((count / totalItems) * 100).toFixed(0);
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
    </div>
    
    <div class="dash-section">
      <div id="wardrobe-table-container"></div>
    </div>
  `;
  
  const container = $('#wardrobe-table-container', tabEl);
  renderCsvTable(container, title, fileType, currentData, null, true);
}

function setupWardrobeEvents(contentEl, navigate) {
  $$('.tab-btn', contentEl).forEach(btn => {
    btn.addEventListener('click', async (e) => {
      currentTab = e.target.dataset.tab;
      $$('.tab-btn', contentEl).forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      const [invRaw, storeRaw, discRaw] = await Promise.all([
        loadCsv(encodeURI(FILES.inventory)),
        loadCsv(encodeURI(FILES.storage)),
        loadCsv(encodeURI(FILES.discard))
      ]);
      
      const inv = normalize(invRaw).normalized.filter(r => r['状态'] === '正在使用');
      const store = normalize(storeRaw).normalized.filter(r => r['状态'] && (r['状态'].includes('收纳') || r['状态'].includes('换季')));
      const disc = normalize(discRaw).normalized.filter(r => r['状态'] && (r['状态'].includes('待处理') || r['状态'].includes('淘汰')));
      
      renderTabContent($('#tab-content', contentEl), { inv, store, disc }, navigate);
      setupWardrobeEvents(contentEl, navigate);
    });
  });
}
