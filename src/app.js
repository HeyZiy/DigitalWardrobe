const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const contentEl = $('#content');
const loadingEl = $('#loading');
const searchEl = $('#global-search');

const files = {
  purchases: 'data/purchases.csv',
  inventory: 'data/inventory.csv',
  storage: 'data/storage.csv',
  discard: 'data/discard.csv',
};

const views = {
  home: async () => {
    loadingEl.hidden = false;
    try {
      // 1. Load all data for stats
      const [invRaw, storeRaw, discRaw, purchRaw] = await Promise.all([
        loadCsv(encodeURI(files.inventory)),
        loadCsv(encodeURI(files.storage)),
        loadCsv(encodeURI(files.discard)),
        loadCsv(encodeURI(files.purchases))
      ]);

      const inv = normalize(invRaw).normalized.filter(r => r['状态'] === '正在使用');
      const store = normalize(storeRaw).normalized.filter(r => r['状态'] && (r['状态'].includes('收纳') || r['状态'].includes('换季')));
      const disc = normalize(discRaw).normalized.filter(r => r['状态'] && (r['状态'].includes('待处理') || r['状态'].includes('淘汰')));
      const purch = normalize(purchRaw).normalized;

      // 2. Calculate Stats
      const now = new Date();
      const currentYear = now.getFullYear();
      let thisYearCost = 0;
      let thisYearCount = 0;
      const monthlySpending = new Array(12).fill(0);
      const quarterSpending = [0, 0, 0, 0];

      purch.forEach(r => {
        const price = parseFloat(String(r['价格'] || '0').replace(/,/g, '') || 0);
        const dateStr = r['购买日期'];
        if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime()) && d.getFullYear() === currentYear) {
            thisYearCost += price;
            thisYearCount++;
            const month = d.getMonth(); // 0-11
            monthlySpending[month] += price;
            quarterSpending[Math.floor(month / 3)] += price;
          }
        }
      });

      const stats = {
        inventory: inv.length,
        storage: store.length,
        discard: disc.length,
        totalPurchases: purch.length,
        totalCost: purch.reduce((sum, r) => sum + parseFloat(String(r['价格'] || '0').replace(/,/g, '') || 0), 0).toFixed(2),
        thisYearCost: thisYearCost.toFixed(2),
        thisYearCount: thisYearCount
      };

      // 3. Get Category Distribution
      const catMap = {};
      inv.concat(store).forEach(r => {
        const cat = r['分类'] || r['类型'] || '其他';
        catMap[cat] = (catMap[cat] || 0) + 1;
      });
      const topCats = Object.entries(catMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
      const totalItems = inv.length + store.length;

      // 4. Get Recent items (last 5 from inventory)
      const recent = [...inv].reverse().slice(0, 5);

      // Helper for bar chart
      const maxMonth = Math.max(...monthlySpending) || 1;

      // 5. Render Dashboard
      contentEl.innerHTML = `
        <section class="dashboard">
          <div class="dash-section">
            <h2 class="section-title">财务账本 (Buying Behavior)</h2>
            <div class="stats-grid">
              <div class="stat-card highlight" data-jump="purchases">
                <div class="stat-val">¥${stats.totalCost}</div>
                <div class="stat-label">历史累计支出 (${stats.totalPurchases}件)</div>
              </div>
              <div class="stat-card" style="border-color:rgba(45,212,191,0.3);background:linear-gradient(145deg,var(--panel),rgba(45,212,191,0.05))" data-jump="purchases">
                <div class="stat-val" style="color:var(--accent)">¥${stats.thisYearCost}</div>
                <div class="stat-label">${currentYear}年支出 (${stats.thisYearCount}件)</div>
              </div>
            </div>
          </div>

          <div class="dash-section">
            <h2 class="section-title">实物管理 (Usage Behavior)</h2>
            <div class="stats-grid">
              <div class="stat-card" data-jump="inventory">
                <div class="stat-val">${stats.inventory}</div>
                <div class="stat-label">正在使用 (衣柜)</div>
              </div>
              <div class="stat-card" data-jump="storage">
                <div class="stat-val">${stats.storage}</div>
                <div class="stat-label">已收纳 (换季)</div>
              </div>
              <div class="stat-card" data-jump="discard">
                <div class="stat-val">${stats.discard}</div>
                <div class="stat-label">预淘汰 (待处理)</div>
              </div>
            </div>
          </div>

          <div class="dashboard-grid">
            <div class="dash-panel">
              <h3>${currentYear}年 消费趋势 (月度)</h3>
              <div class="chart-container" style="display:flex;align-items:flex-end;height:150px;gap:8px;padding-top:20px">
                ${monthlySpending.map((val, i) => {
                  const height = (val / maxMonth * 100).toFixed(0);
                  const isZero = val === 0;
                  return `
                    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%">
                      <div style="flex:1;width:100%;display:flex;align-items:flex-end;position:relative">
                        <div style="width:100%;background:${isZero ? 'rgba(255,255,255,0.05)' : 'var(--brand)'};height:${isZero ? '4px' : height + '%'};border-radius:4px 4px 0 0;transition:height 0.5s;opacity:${isZero?0.5:1}"></div>
                        ${!isZero ? `<span style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);font-size:10px;color:var(--muted)">${val >= 1000 ? (val/1000).toFixed(1)+'k' : val}</span>` : ''}
                      </div>
                      <span style="font-size:10px;color:var(--muted)">${i+1}月</span>
                    </div>
                  `;
                }).join('')}
              </div>
              <div style="margin-top:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
                ${quarterSpending.map((val, i) => `
                  <div style="background:rgba(255,255,255,0.03);padding:10px;border-radius:8px;text-align:center">
                    <div style="font-size:12px;color:var(--muted)">Q${i+1}</div>
                    <div style="font-size:14px;font-weight:bold;color:${val>0?'var(--text)':'var(--muted)'}">¥${val}</div>
                  </div>
                `).join('')}
              </div>
            </div>
            
            <div class="dash-panel">
              <h3>实物分类概览 (Top 5)</h3>
              <div class="recent-list">
                ${recent.length ? recent.map(r => `
                  <div class="recent-item">
                    <span class="pill">${escapeHtml(r['分类'] || r['类型'] || '衣物')}</span>
                    <span class="name">${escapeHtml(r['名称'])}</span>
                    <span class="muted">${escapeHtml(r['入库日期'] || '')}</span>
                  </div>
                `).join('') : '<div class="muted">暂无记录</div>'}
              </div>
              <button class="nav-btn" style="width:100%;margin-top:12px" data-jump="inventory">查看全部衣柜</button>
            </div>
            
            <div class="dash-panel">
              <h3>实物分类概览 (Top 5)</h3>
              <div class="cat-list">
                ${topCats.map(([cat, count]) => {
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
                }).join('')}
              </div>
              <hr style="border:0;border-top:1px solid var(--border);margin:16px 0">
              <h3>快速跳转</h3>
              <div class="quick-actions">
                <button class="action-btn" data-jump="purchases">🛒 记录新购入</button>
                <button class="action-btn" data-jump="inventory">🧥 整理衣柜</button>
                <button class="action-btn" data-jump="storage">📦 换季收纳</button>
              </div>
            </div>
          </div>
        </section>
      `;

      // 5. Add events
      $$('[data-jump]', contentEl).forEach(el => el.addEventListener('click', e => {
        const v = e.currentTarget.getAttribute('data-jump');
        navigate(v);
      }));

    } catch (e) {
      contentEl.innerHTML = `<div class="muted">Dashboard 加载失败：${escapeHtml(e.message)}</div>`;
    } finally {
      loadingEl.hidden = true;
    }
  },
  purchases: () => renderCsvView('财务账本 (购买记录)', 'purchases'),
  inventory: () => renderCsvView('实物看板 (衣柜区域)', 'inventory', r => r['状态'] === '正在使用'),
  storage: () => renderCsvView('实物看板 (收纳区域)', 'storage', r => r['状态'] && (r['状态'].includes('收纳') || r['状态'].includes('换季'))),
  discard: () => renderCsvView('实物看板 (预淘汰区)', 'discard', r => r['状态'] && (r['状态'].includes('待处理') || r['状态'].includes('淘汰'))),
};

// Global Options
const OPTIONS_SEASONS = ['春', '夏', '秋', '冬', '春秋', '秋冬', '四季通用'];
const OPTIONS_STATUSES = ['已下单', '正在使用', '已收纳', '已入库', '待处理', '已淘汰', '预售', '咸鱼在售', '已售出'];

let currentRows = []; // Filtered rows for display
let fullRowsOfFile = []; // Full rows for saving
let currentColumns = [];
let currentFilename = '';
let currentViewType = ''; // e.g. 'inventory'
let editingRowIndex = -1;
let visibleColumns = new Set(); // Tracks which columns are visible

async function renderCsvView(title, viewType, filterFn = null) {
  const url = files[viewType];
  currentFilename = url;
  currentViewType = viewType;
  const isPurchase = viewType === 'purchases';
  
  const niceUrl = encodeURI(url);
  contentEl.innerHTML = `
    <section>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h2 style="margin:0">${title}</h2>
        <div class="muted" style="font-size:13px">
          ${isPurchase ? '📌 记录所有购买行为，作为资产原始账本' : '👕 记录当前实物的使用状态与位置'}
        </div>
      </div>
      <div class="controls">
        <input id="local-search" class="input" type="search" placeholder="筛选（输入关键词）">
        <div class="dropdown">
          <button id="col-toggle-btn" class="nav-btn" style="padding:6px 12px;display:flex;align-items:center;gap:4px">
            👁️ 显示列 <span style="font-size:10px">▼</span>
          </button>
          <div id="col-menu" class="dropdown-menu"></div>
        </div>
        <div id="batch-actions" class="batch-actions">
          <span style="font-size:12px;color:var(--brand);font-weight:bold">已选 <span id="selected-count">0</span> 项:</span>
          ${getBatchButtons(viewType)}
        </div>
        <div style="flex:1"></div>
        <button id="add-item-btn" class="nav-btn active" style="padding:6px 12px">+ 新增记录</button>
        <a class="nav-btn" href="${niceUrl}" target="_blank" rel="noopener">下载 CSV</a>
      </div>
      <div id="table-wrap"></div>
    </section>
  `;
  const rawRows = await loadCsv(niceUrl);
  const { columns, normalized } = normalize(rawRows);
  
  // Keep full list for saving correctly
  fullRowsOfFile = normalized;
  
  // Apply view-specific filtering
  const filteredRows = filterFn ? normalized.filter(filterFn) : normalized;
  
  currentRows = filteredRows;
  currentColumns = columns;
  
  // Default visible columns logic
  if (visibleColumns.size === 0) {
    const hiddenByDefault = ['购买链接', '备注', '购买途径', '入库日期', '换季日期', '处理日期'];
    columns.forEach(c => {
      if (!hiddenByDefault.includes(c)) visibleColumns.add(c);
    });
  }

  const colsToShow = columns.filter(c => visibleColumns.has(c));
  drawTable(colsToShow, filteredRows);
  renderColumnMenu(columns);

  $('#local-search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = q ? filteredRows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q))) : filteredRows;
    currentRows = filtered; // Update currentRows for batch actions
    const currentColsToShow = currentColumns.filter(c => visibleColumns.has(c));
    drawTable(currentColsToShow, filtered);
  });
  $('#add-item-btn').addEventListener('click', () => openEditModal(-1));
  
  // Column Toggle Events
  const colBtn = $('#col-toggle-btn');
  const colMenu = $('#col-menu');
  colBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    colMenu.classList.toggle('active');
  });
  document.addEventListener('click', () => colMenu.classList.remove('active'));
  colMenu.addEventListener('click', e => e.stopPropagation());

  // Bind batch events
  bindBatchEvents();
}

function renderColumnMenu(columns) {
  const menu = $('#col-menu');
  menu.innerHTML = columns.map(c => {
    const checked = visibleColumns.has(c) ? 'checked' : '';
    return `
      <label class="dropdown-item">
        <input type="checkbox" class="col-check-item" value="${escapeHtml(c)}" ${checked}>
        ${escapeHtml(c)}
      </label>
    `;
  }).join('');
  
  $$('.col-check-item', menu).forEach(cb => {
    cb.addEventListener('change', (e) => {
      const col = e.target.value;
      if (e.target.checked) visibleColumns.add(col);
      else visibleColumns.delete(col);
      const colsToShow = currentColumns.filter(c => visibleColumns.has(c));
      drawTable(colsToShow, currentRows);
    });
  });
}

function getBatchButtons(viewType) {
  if (viewType === 'inventory') {
    return `
      <button class="batch-btn" data-action="storage">📦 批量收纳</button>
      <button class="batch-btn danger" data-action="discard">🗑️ 批量淘汰</button>
    `;
  }
  if (viewType === 'storage') {
    return `
      <button class="batch-btn" data-action="inventory">🧥 批量取出</button>
      <button class="batch-btn danger" data-action="discard">🗑️ 批量淘汰</button>
    `;
  }
  if (viewType === 'discard') {
    return `
      <button class="batch-btn" data-action="inventory">🧥 批量回衣柜</button>
      <button class="batch-btn" data-action="storage">📦 批量回收纳</button>
      <button class="batch-btn danger" data-action="delete">❌ 批量彻底删除</button>
    `;
  }
  if (viewType === 'purchases') {
    return `
      <button class="batch-btn" data-action="inventory">📥 批量收货入柜</button>
      <button class="batch-btn danger" data-action="delete">❌ 批量删除</button>
    `;
  }
  return '';
}

function bindBatchEvents() {
  $$('.batch-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const selectedIdxs = Array.from($$('input.row-check:checked')).map(el => parseInt(el.dataset.idx));
      if (!selectedIdxs.length) return;
      
      if (action === 'delete') {
        if (!confirm(`确定要批量删除选中的 ${selectedIdxs.length} 项吗？此操作不可撤销。`)) return;
        await batchDelete(selectedIdxs);
      } else {
        if (!confirm(`确定要批量操作选中的 ${selectedIdxs.length} 项吗？`)) return;
        await batchMove(selectedIdxs, action);
      }
    });
  });
}

async function batchDelete(idxs) {
  loadingEl.hidden = false;
  try {
    // Sort desc to delete from end without shifting issues, but here we splice by object reference or filter
    // Better strategy: create a Set of items to remove
    const itemsToRemove = new Set(idxs.map(i => currentRows[i]));
    
    // Remove from fullRowsOfFile
    fullRowsOfFile = fullRowsOfFile.filter(r => !itemsToRemove.has(r));
    // Remove from currentRows (view)
    currentRows = currentRows.filter(r => !itemsToRemove.has(r));
    
    // Save source
    await fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify({ filename: currentFilename, content: Papa.unparse(fullRowsOfFile) })
    });
    
    drawTable(currentColumns, currentRows);
    updateBatchUI();
  } catch (e) {
    alert('批量操作失败: ' + e.message);
  } finally {
    loadingEl.hidden = true;
  }
}

async function batchMove(idxs, targetType) {
  loadingEl.hidden = false;
  try {
    const itemsToMove = idxs.map(i => currentRows[i]);
    const targetFile = files[targetType];
    const sourceFile = currentFilename;
    const now = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

    // 1. Load target data
    const rawTarget = await loadCsv(encodeURI(targetFile));
    const { normalized: targetRows } = normalize(rawTarget);

    // 2. Process items
    // If moving to storage, we might need location. For batch, we'll ask once or default to '批量收纳'
    let batchLoc = '';
    if (targetType === 'storage') {
      const existingLocs = await getExistingLocations();
      let promptMsg = '请选择或输入存放地点（将应用于所有选中项）：\n\n' + (existingLocs.length ? '已有地点：\n' + existingLocs.join(', ') + '\n\n' : '');
      batchLoc = prompt(promptMsg);
      if (!batchLoc) { loadingEl.hidden = true; return; }
    }

    const itemsToAddToTarget = [];

    itemsToMove.forEach(item => {
      // Clone item
      const newItem = { ...item };
      
      if (targetType === 'storage') {
        newItem['状态'] = '已收纳换季';
        newItem['换季日期'] = now;
        newItem['存放地点'] = batchLoc;
      } else if (targetType === 'inventory') {
        newItem['状态'] = '正在使用';
        newItem['入库日期'] = now;
        delete newItem['存放地点'];
      } else if (targetType === 'discard') {
        newItem['状态'] = '待处理';
        newItem['处理日期'] = now;
      }
      itemsToAddToTarget.push(newItem);
      
      // Update Source Logic
      if (currentViewType === 'purchases' && targetType === 'inventory') {
         // Purchases: Update status only
         const itemInFull = fullRowsOfFile.find(r => r === item);
         if (itemInFull) itemInFull['状态'] = '已入库';
      } else {
         // Others: Remove from source
         // We will filter them out later
      }
    });

    // 3. Update Source File
    if (currentViewType !== 'purchases') {
      const itemsSet = new Set(itemsToMove);
      fullRowsOfFile = fullRowsOfFile.filter(r => !itemsSet.has(r));
      currentRows = currentRows.filter(r => !itemsSet.has(r));
    }

    // 4. Update Target File
    // Prepend new items
    itemsToAddToTarget.reverse().forEach(i => targetRows.unshift(i));

    // 5. Save Both
    await Promise.all([
      fetch('/api/save', {
        method: 'POST',
        body: JSON.stringify({ filename: sourceFile, content: Papa.unparse(fullRowsOfFile) })
      }),
      fetch('/api/save', {
        method: 'POST',
        body: JSON.stringify({ filename: targetFile, content: Papa.unparse(targetRows) })
      })
    ]);

    drawTable(currentColumns, currentRows);
    updateBatchUI();

  } catch (e) {
    alert('批量操作失败: ' + e.message);
  } finally {
    loadingEl.hidden = true;
  }
}

function updateBatchUI() {
  const checkedCount = $$('input.row-check:checked').length;
  const batchDiv = $('#batch-actions');
  const countSpan = $('#selected-count');
  if (checkedCount > 0) {
    batchDiv.classList.add('active');
    countSpan.textContent = checkedCount;
  } else {
    batchDiv.classList.remove('active');
  }
}

async function loadCsv(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: reject,
    });
  });
}

function normalize(rows) {
  const renameMap = {
    '衣服名稱':'名称','衣服分类':'分类','衣服分類':'分类','品牌':'品牌','價格':'价格','价格':'价格','購買日期':'购买日期','購買途徑':'购买途径','目前狀態':'状态','目前状态':'状态','季节':'季节','入庫日期':'入库日期','入库日期':'入库日期','存放地點':'存放地点','存放地点':'存放地点','衣服类型':'类型','换季日期':'换季日期','換季日期':'换季日期','處理日期':'处理日期','处理日期':'处理日期','图片':'图片','主图':'图片','Image':'图片'
  };
  const skipKeys = ['一鍵換季', '一键换季', '一鍵處理', '一键處理', '一键处理', '一鍵丟棄', '一键丢弃', '一鍵入庫', '一键入库', 'Place', '恢复状态', '恢復狀態'];
  const columnsSet = new Set();
  const normalized = rows.map(row => {
    const o = {};
    for (const [k,v] of Object.entries(row)) {
      if (k == null || k === '' || skipKeys.includes(k)) continue;
      const key = renameMap[k] || k;
      o[key] = v;
      columnsSet.add(key);
    }
    // Ensure '图片' column exists even if not in CSV
    if (!columnsSet.has('图片')) columnsSet.add('图片');
    return o;
  });
  const columns = Array.from(columnsSet);
  return { columns, normalized };
}

function drawTable(columns, rows) {
  const wrap = $('#table-wrap');
  if (!rows.length) {
    wrap.innerHTML = `<div class="muted">没有数据</div>`;
    return;
  }
  
  // Define quick actions based on view
  const actions = [];
  if (currentViewType === 'inventory') {
    actions.push({ label: '收纳', class: 'move-btn storage', target: 'storage' });
    actions.push({ label: '淘汰', class: 'move-btn discard', target: 'discard' });
  } else if (currentViewType === 'storage') {
    actions.push({ label: '取出', class: 'move-btn inventory', target: 'inventory' });
    actions.push({ label: '淘汰', class: 'move-btn discard', target: 'discard' });
  } else if (currentViewType === 'discard') {
    actions.push({ label: '回衣柜', class: 'move-btn inventory', target: 'inventory' });
    actions.push({ label: '回收纳', class: 'move-btn storage', target: 'storage' });
    actions.push({ label: '彻底丢弃', class: 'move-btn delete', target: 'delete' });
  } else if (currentViewType === 'purchases') {
    actions.push({ label: '收货入柜', class: 'move-btn inventory', target: 'inventory' });
    actions.push({ label: '删除', class: 'move-btn delete', target: 'delete' });
  }

  // Ensure '图片' is at the beginning if it exists
  const displayCols = [...columns];
  const imgIdx = displayCols.indexOf('图片');
  if (imgIdx > -1) {
    displayCols.splice(imgIdx, 1);
    displayCols.unshift('图片');
  }

  const head = `<th style="width:30px"><input type="checkbox" id="check-all"></th>` + displayCols.map(c => `<th data-col="${escapeHtml(c)}">${escapeHtml(c)}</th>`).join('') + '<th style="min-width:140px">操作</th>';
  const body = rows.map((r, idx) => {
    const tds = displayCols.map(c => {
      const val = r[c] ?? '';
      const label = escapeHtml(c);
      let className = '';
      if (c === '名称' || c === '衣服名稱') className = 'col-name';
      
      if (c === '图片') {
        return `<td class="col-img" data-label="${label}">${val ? `<img src="${escapeHtml(val)}" class="table-img">` : '<div class="table-img" style="display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--muted)">无图</div>'}</td>`;
      }
      return `<td class="${className}" data-label="${label}">${formatCell(c, val)}</td>`;
    }).join('');
    
    const actionBtns = actions.map(a => {
      // Prevent duplicate inventory action
      if (currentViewType === 'purchases' && a.target === 'inventory' && r['状态'] === '已入库') {
        return `<button class="${a.class}" disabled style="opacity:0.3;cursor:not-allowed">已入库</button>`;
      }
      return `<button class="${a.class}" data-idx="${idx}" data-target="${a.target}">${a.label}</button>`;
    }).join('');
    return `<tr>
      <td class="col-check" data-label="选择"><input type="checkbox" class="row-check" data-idx="${idx}"></td>
      ${tds}
      <td class="col-actions" data-label="操作"><div class="row-actions"><button class="edit-btn" data-idx="${idx}">编辑</button>${actionBtns}</div></td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="muted" style="margin-bottom:6px">${rows.length} 条记录</div>
    <div style="overflow:auto;border-radius:10px">
      <table class="table">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
  $$('table thead th', wrap).forEach((th) => {
    const col = th.dataset.col;
    if (col && col !== '图片') {
      th.addEventListener('click', () => sortBy(col));
    }
  });

  // Checkbox Logic
  const checkAll = $('#check-all');
  if (checkAll) {
    checkAll.addEventListener('change', (e) => {
      $$('input.row-check').forEach(cb => cb.checked = e.target.checked);
      updateBatchUI();
    });
  }
  $$('input.row-check').forEach(cb => {
    cb.addEventListener('change', updateBatchUI);
  });
  
  $$('.edit-btn', wrap).forEach(btn => {
    btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.idx)));
  });
  $$('.move-btn', wrap).forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const target = btn.dataset.target;
      if (target === 'delete') {
        deleteItem(idx);
      } else {
        moveItem(idx, target);
      }
    });
  });
}

async function deleteItem(idx) {
  const item = currentRows[idx];
  const isPurchase = currentViewType === 'purchases';
  const msg = isPurchase 
    ? `确定要删除这条购买记录 "${item['名称'] || item['衣服名稱']}" 吗？此操作不可撤销。`
    : `确定要彻底丢弃 "${item['名称'] || item['衣服名稱']}" 吗？此操作不可撤销，且会将其从预淘汰区永久删除。`;

  if (!confirm(msg)) return;

  loadingEl.hidden = false;
  try {
    const sourceFile = currentFilename;
    // Remove from both lists
    currentRows.splice(idx, 1);
    const fullIdx = fullRowsOfFile.findIndex(r => r === item);
    if (fullIdx > -1) fullRowsOfFile.splice(fullIdx, 1);
    
    const res = await fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify({ filename: sourceFile, content: Papa.unparse(fullRowsOfFile) })
    });

    if (res.ok) {
      drawTable(currentColumns, currentRows);
    } else {
      alert('删除失败');
    }
  } catch (e) {
    alert('错误: ' + e.message);
  } finally {
    loadingEl.hidden = true;
  }
}

async function getExistingLocations() {
  const url = files.storage;
  const rows = await loadCsv(encodeURI(url));
  const { normalized } = normalize(rows);
  const locs = new Set();
  normalized.forEach(r => {
    const val = r['存放地点'] || r['存放地點'];
    if (val) locs.add(val.trim());
  });
  return Array.from(locs).sort();
}

async function moveItem(idx, targetType) {
  const item = { ...currentRows[idx] };
  const sourceFile = currentFilename;
  const sourceView = currentViewType;
  const targetFile = files[targetType];

  const actionName = targetType === 'storage' ? (sourceView === 'discard' ? '撤回到收纳' : '收纳') : targetType === 'inventory' ? (sourceView === 'purchases' ? '入库' : (sourceView === 'discard' ? '撤回到衣柜' : '取出')) : '移至预淘汰区';
  if (!confirm(`确定要将 "${item['名称'] || item['衣服名稱']}" ${actionName} 吗？`)) return;

  loadingEl.hidden = false;
  try {
    // 1. Load target data
    const rawTarget = await loadCsv(encodeURI(targetFile));
    const { normalized: targetRows } = normalize(rawTarget);
    
    // 2. Update item status/fields based on target
    const now = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    if (targetType === 'storage') {
      item['状态'] = '已收纳换季';
      item['换季日期'] = now;
      if (!item['存放地点']) {
        const existingLocs = await getExistingLocations();
        let promptMsg = '请选择或输入存放地点：\n\n' + (existingLocs.length ? '已有地点：\n' + existingLocs.join(', ') + '\n\n' : '');
        let loc = prompt(promptMsg);
        if (loc) item['存放地点'] = loc;
        else { loadingEl.hidden = true; return; } // User cancelled
      }
    } else if (targetType === 'inventory') {
      item['状态'] = '正在使用';
      item['入库日期'] = now;
      delete item['存放地点']; // Move back to wardrobe, clear storage location
    } else if (targetType === 'discard') {
      item['状态'] = '待处理';
      item['处理日期'] = now;
    }

    // 3. Add to target
    targetRows.unshift(item);

    // 4. Update source (Move vs Update)
    let saveSourcePromise;
    if (sourceView === 'purchases' && targetType === 'inventory') {
      // For purchases, we just update the status, don't remove
      const itemInFull = fullRowsOfFile.find(r => r === currentRows[idx]);
      if (itemInFull) itemInFull['状态'] = '已入库';
      saveSourcePromise = fetch('/api/save', {
        method: 'POST',
        body: JSON.stringify({ filename: sourceFile, content: Papa.unparse(fullRowsOfFile) })
      });
    } else {
      // For others, it's a move
      const itemInFullIdx = fullRowsOfFile.findIndex(r => r === currentRows[idx]);
      if (itemInFullIdx > -1) fullRowsOfFile.splice(itemInFullIdx, 1);
      currentRows.splice(idx, 1);
      saveSourcePromise = fetch('/api/save', {
        method: 'POST',
        body: JSON.stringify({ filename: sourceFile, content: Papa.unparse(fullRowsOfFile) })
      });
    }

    // 5. Save target
    const saveTargetPromise = fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify({ filename: targetFile, content: Papa.unparse(targetRows) })
    });

    const results = await Promise.all([saveSourcePromise, saveTargetPromise]);
    if (results.every(r => r.ok)) {
      drawTable(currentColumns, currentRows);
    } else {
      alert('操作失败，请重试');
    }
  } catch (e) {
    alert('错误: ' + e.message);
  } finally {
    loadingEl.hidden = true;
  }
}

async function getFieldOptions(field) {
  const allFiles = Object.values(files);
  const values = new Set();
  try {
    const results = await Promise.all(allFiles.map(url => loadCsv(encodeURI(url))));
    results.forEach(rows => {
      const { normalized } = normalize(rows);
      normalized.forEach(r => {
        if (r[field]) values.add(r[field].trim());
      });
    });
  } catch (e) { console.error(e); }
  return Array.from(values).sort();
}

async function openEditModal(idx) {
  editingRowIndex = idx;
  const isNew = idx === -1;
  const row = isNew ? {} : currentRows[idx];
  
  // Ensure basic fields for new item
  if (isNew) {
    const defaultFields = ['名称', '分类', '品牌', '价格', '图片', '购买链接'];
    if (currentViewType === 'purchases') {
      defaultFields.push('购买日期', '购买途径', '状态');
      row['状态'] = '已下单';
      row['购买日期'] = new Date().toISOString().split('T')[0];
    } else if (currentViewType === 'inventory') {
      defaultFields.push('状态', '入库日期', '季节');
      row['状态'] = '正在使用';
      row['入库日期'] = new Date().toISOString().split('T')[0];
    }
    
    // Add columns that exist in current view but aren't in defaults
    currentColumns.forEach(c => {
      if (!defaultFields.includes(c) && c !== '操作') row[c] = '';
    });
    
    // Ensure defaults are present
    defaultFields.forEach(f => {
      if (row[f] === undefined) row[f] = '';
    });
  }

  const form = $('#edit-form');
  
  // Pre-fetch options
  const [existingLocs, existingCats, existingBrands] = await Promise.all([
    getExistingLocations(),
    getFieldOptions('分类'),
    getFieldOptions('品牌')
  ]);

  const renderSelectWithAdd = (label, name, value, options) => {
    const optsHtml = options.map(o => `<option value="${escapeHtml(o)}" ${o === value ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
    return `
      <div class="form-group">
        <label>${escapeHtml(label)}</label>
        <div style="display:flex;gap:4px">
          <select name="${escapeHtml(name)}" class="input" style="flex:1" data-addable="true">
            <option value="">-- 请选择 --</option>
            ${optsHtml}
            <option value="__new__">+ 新增...</option>
          </select>
        </div>
      </div>
    `;
  };

  const renderStaticSelect = (label, name, value, options) => {
    const optsHtml = options.map(o => `<option value="${escapeHtml(o)}" ${o === value ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
    return `
      <div class="form-group">
        <label>${escapeHtml(label)}</label>
        <select name="${escapeHtml(name)}" class="input">
          <option value="">-- 请选择 --</option>
          ${optsHtml}
        </select>
      </div>
    `;
  };
  
  const renderFields = (data) => {
    // Sort fields: put important ones first
    const priority = ['图片', '名称', '分类', '品牌', '季节', '状态', '价格', '购买链接'];
    const sortedKeys = Object.keys(data).sort((a,b) => {
      const ia = priority.indexOf(a);
      const ib = priority.indexOf(b);
      if (ia > -1 && ib > -1) return ia - ib;
      if (ia > -1) return -1;
      if (ib > -1) return 1;
      return 0;
    });

    return sortedKeys.map(k => {
      const v = data[k];
      const isLocation = k === '存放地点' || k === '存放地點';
      const isUrl = k.toLowerCase().includes('链接') || k.toLowerCase().includes('途经') || k.toLowerCase().includes('url');
      const isImage = k === '图片';
      const isSeason = k === '季节';
      const isStatus = k === '状态';
      const isCategory = k === '分类' || k === '类型';
      const isBrand = k === '品牌';

      if (isImage) {
        return `
          <div class="form-group">
            <label>${escapeHtml(k)}</label>
            <div class="img-preview" id="preview-container">
              ${v ? `<img src="${escapeHtml(v)}" id="img-preview-tag">` : '<span class="placeholder">暂无图片 (输入URL或抓取)</span>'}
            </div>
            <div style="display:flex;gap:6px">
              <input type="text" name="${escapeHtml(k)}" value="${escapeHtml(v ?? '')}" placeholder="图片 URL" style="flex:1" id="img-input">
              <button type="button" class="fetch-btn" data-url-field="${escapeHtml(k)}">抓取</button>
            </div>
          </div>
        `;
      }
      
      if (isLocation) return renderSelectWithAdd(k, k, v, existingLocs);
      if (isCategory) return renderSelectWithAdd(k, k, v, existingCats);
      if (isBrand) return renderSelectWithAdd(k, k, v, existingBrands);
      if (isSeason) return renderStaticSelect(k, k, v, OPTIONS_SEASONS);
      if (isStatus) return renderStaticSelect(k, k, v, OPTIONS_STATUSES);
      
      if (isUrl) {
        return `
          <div class="form-group">
            <label>${escapeHtml(k)}</label>
            <div style="display:flex;gap:6px">
              <input type="text" name="${escapeHtml(k)}" value="${escapeHtml(v ?? '')}" style="flex:1">
              <button type="button" class="fetch-btn" data-url-field="${escapeHtml(k)}">自动抓取</button>
            </div>
          </div>
        `;
      }

      return `
        <div class="form-group">
          <label>${escapeHtml(k)}</label>
          <input type="text" name="${escapeHtml(k)}" value="${escapeHtml(v ?? '')}">
        </div>
      `;
    }).join('');
  };

  form.innerHTML = `
    <div style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
      <h3 style="margin:0">${isNew ? '新增记录' : '编辑记录'}</h3>
    </div>
    <div id="fields-container">${renderFields(row)}</div>
    <button type="button" class="add-field-btn" id="add-field-btn">+ 添加自定义字段 (如：购买链接)</button>
  `;

  // Image preview sync
  const imgInput = $('#img-input', form);
  if (imgInput) {
    imgInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const container = $('#preview-container');
      if (val) {
        container.innerHTML = `<img src="${escapeHtml(val)}" id="img-preview-tag">`;
      } else {
        container.innerHTML = '<span class="placeholder">暂无图片</span>';
      }
    });
  }

  // Add field logic
  $('#add-field-btn').onclick = () => {
    const key = prompt('请输入新字段名称（如：购买链接、备注等）：');
    if (!key) return;
    if (row[key] !== undefined) {
      alert('字段已存在');
      return;
    }
    row[key] = ''; // Add to local object
    if (!currentColumns.includes(key)) currentColumns.push(key);
    
    // Re-render
    const container = $('#fields-container');
    container.innerHTML = renderFields(row);
    initModalEvents(form, row);
  };

  initModalEvents(form, row);
  $('#modal-overlay').hidden = false;
}

function initModalEvents(form, row) {
  // Handle Fetch Info
  $$('.fetch-btn', form).forEach(btn => {
    btn.onclick = async () => {
      const fieldName = btn.dataset.urlField;
      const urlInput = $(`input[name="${fieldName}"]`, form);
      let rawInput = urlInput.value.trim();
      
      // Smart Parse for Taobao/JD Share Text
      // e.g. "【淘宝】https://m.tb.cn/h.5VlOHjl?tk=xxx CZ0001 「商品标题」点击链接直接打开"
      const tbMatch = rawInput.match(/「([^」]+)」/);
      const urlMatch = rawInput.match(/(https?:\/\/[^\s]+)/);
      
      let extractedTitle = '';
      let url = rawInput;

      if (urlMatch) {
        url = urlMatch[1];
        // If we found a URL in text, update the input to just be the URL
        if (url !== rawInput) {
          urlInput.value = url;
        }
      }
      
      if (tbMatch) {
        extractedTitle = tbMatch[1];
        const titleInput = $('input[name="名称"]') || $('input[name="衣服名稱"]');
        if (titleInput && (!titleInput.value || titleInput.value.includes('Notion'))) {
          titleInput.value = extractedTitle;
          // Flash effect to show it updated
          titleInput.style.transition = 'background 0.3s';
          titleInput.style.background = 'rgba(45,212,191,0.2)';
          setTimeout(() => titleInput.style.background = '', 500);
        }
      }

      if (!url || !url.startsWith('http')) {
        alert('请输入有效的 http/https 链接');
        return;
      }

      btn.disabled = true;
      btn.classList.add('loading');
      try {
        const res = await fetch('/api/fetch-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUrl: url })
        });
        const data = await res.json();
        if (data.success) {
            // Auto-fill fields
            const titleInput = $('input[name="名称"]') || $('input[name="衣服名稱"]');
            // Prefer fetched title if we didn't extract one from text, or if current is default
            if (titleInput && (!titleInput.value || titleInput.value.includes('Notion'))) {
              titleInput.value = data.title || extractedTitle;
            }
            const priceInput = $('input[name="价格"]') || $('input[name="價格"]');
            if (priceInput && !priceInput.value && data.price) {
              priceInput.value = data.price;
            }
            const imgInput = $('#img-input');
            if (imgInput && !imgInput.value && data.image) {
              imgInput.value = data.image;
              imgInput.dispatchEvent(new Event('input'));
            }
            if (data.warning) {
              console.warn(data.warning);
              // Only alert if we didn't get anything useful (like title from text)
              if (!extractedTitle && !data.title && !data.price && !data.image) {
                alert(data.warning);
              }
            }
          } else {
           alert('抓取失败: ' + (data.error || '未知错误'));
         }
      } catch (e) {
        alert('网络错误: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
      }
    };
  });

  // Handle Select with Add Option (delegated)
  $$('select[data-addable="true"]', form).forEach(select => {
    select.onchange = (e) => {
      if (e.target.value === '__new__') {
        const newVal = prompt('请输入新选项名称：');
        if (newVal) {
          const opt = document.createElement('option');
          opt.value = opt.textContent = newVal;
          opt.selected = true;
          e.target.insertBefore(opt, e.target.lastElementChild);
        } else {
          e.target.value = "";
        }
      }
    };
  });
}

$('#modal-close').onclick = $('#modal-cancel').onclick = () => {
  $('#modal-overlay').hidden = true;
};

$('#modal-save').onclick = async () => {
  const form = $('#edit-form');
  const formData = new FormData(form);
  const updatedRow = {};
  for (const [k, v] of formData.entries()) {
    updatedRow[k] = v;
  }
  
  // Update local data
  if (editingRowIndex === -1) {
    // New Item
    currentRows.unshift(updatedRow);
    fullRowsOfFile.unshift(updatedRow);
  } else {
    // Edit Item
    const itemToUpdate = currentRows[editingRowIndex];
    Object.assign(itemToUpdate, updatedRow);
  }
  
  // Sync fullRowsOfFile to include new columns if any
  const allKeys = new Set();
  fullRowsOfFile.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
  Object.keys(updatedRow).forEach(k => allKeys.add(k));
  
  // Ensure all rows have all columns (even if empty) to keep CSV consistent
  const finalizedRows = fullRowsOfFile.map(r => {
    const newR = {};
    Array.from(allKeys).forEach(k => newR[k] = r[k] ?? '');
    return newR;
  });

  // Save to server
  try {
    const res = await fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify({ filename: currentFilename, content: Papa.unparse(finalizedRows) })
    });
    if (res.ok) {
      $('#modal-overlay').hidden = true;
      // Refresh current columns from all keys
      currentColumns = Array.from(allKeys);
      drawTable(currentColumns, currentRows);
    } else {
      alert('保存失败');
    }
  } catch (e) {
    alert('错误: ' + e.message);
  }
};

function sortBy(col) {
  const sorted = [...currentRows].sort((a,b) => String(a[col] ?? '').localeCompare(String(b[col] ?? ''), 'zh-Hans'));
  drawTable(currentColumns, sorted);
}

function formatCell(col, val) {
  const s = String(val ?? '').trim();
  if (!s) return '';

  // Determine pill type based on column and value
  let type = '';
  const lowerS = s.toLowerCase();
  
  if (col === '季节' || col === '季节') {
    if (s.includes('冬')) type = 'winter';
    else if (s.includes('夏')) type = 'summer';
    else if (s.includes('春秋')) type = 'spring-fall';
    else if (s.includes('春')) type = 'spring';
    else if (s.includes('秋')) type = 'fall';
  } else if (col === '状态' || col === '目前状态' || col === '目前狀態') {
    if (s.includes('正在使用')) type = 'active';
    else if (s.includes('收纳') || s.includes('换季')) type = 'storage';
    else if (s.includes('待处理')) type = 'pending';
    else if (s.includes('已处理') || s.includes('已淘汰')) type = 'discarded';
    else if (s.includes('已入库')) type = 'purchased';
    else if (s.includes('已下单')) type = 'ordered';
  } else if (col === '分类' || col === '类型' || col === '衣服类型' || col === '衣服分類') {
    type = 'category';
  }

  // If it's something that should be a pill (either explicit type or keywords)
  if (type || /^(已|待)/.test(s) || /(使用|換季|收纳|收納|淘汰)/.test(s)) {
    const classAttr = type ? `pill pill-${type}` : 'pill';
    return `<span class="${classAttr}">${escapeHtml(s)}</span>`;
  }
  
  return escapeHtml(s);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function setActive(view) {
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
}

async function navigate(view) {
  setActive(view);
  loadingEl.hidden = false;
  contentEl.hidden = true;
  try {
    await views[view]();
  } catch (e) {
    contentEl.innerHTML = `<div class="muted">加载失败：${escapeHtml(e.message || String(e))}</div>`;
  } finally {
    loadingEl.hidden = true;
    contentEl.hidden = false;
  }
}

// Global search routes to current view's input
searchEl.addEventListener('input', () => {
  const box = $('#local-search');
  if (box) {
    box.value = searchEl.value;
    box.dispatchEvent(new Event('input'));
  }
});

// Nav buttons
$$('.nav-btn').forEach(btn => {
  const v = btn.getAttribute('data-view');
  if (v) btn.addEventListener('click', () => navigate(v));
});

// Initial
navigate('home');
