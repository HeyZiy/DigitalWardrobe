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
      const stats = {
        inventory: inv.length,
        storage: store.length,
        discard: disc.length,
        totalPurchases: purch.length,
        totalCost: purch.reduce((sum, r) => sum + parseFloat(String(r['价格'] || '0').replace(/,/g, '') || 0), 0).toFixed(2)
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

      // 5. Render Dashboard
      contentEl.innerHTML = `
        <section class="dashboard">
          <div class="dash-section">
            <h2 class="section-title">财务账本 (Buying Behavior)</h2>
            <div class="stats-grid">
              <div class="stat-card highlight" data-jump="purchases">
                <div class="stat-val">¥${stats.totalCost}</div>
                <div class="stat-label">累计支出 (${stats.totalPurchases}笔记录)</div>
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
              <h3>最近使用 / 活跃</h3>
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

let currentRows = []; // Filtered rows for display
let fullRowsOfFile = []; // Full rows for saving
let currentColumns = [];
let currentFilename = '';
let currentViewType = ''; // e.g. 'inventory'
let editingRowIndex = -1;

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
  drawTable(columns, filteredRows);
  $('#local-search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = q ? filteredRows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q))) : filteredRows;
    drawTable(columns, filtered);
  });
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
    '衣服名稱':'名称','衣服分类':'分类','衣服分類':'分类','品牌':'品牌','價格':'价格','价格':'价格','購買日期':'购买日期','購買途徑':'购买途径','目前狀態':'状态','目前状态':'状态','季节':'季节','入庫日期':'入库日期','入库日期':'入库日期','存放地點':'存放地点','存放地点':'存放地点','衣服类型':'类型','换季日期':'换季日期','換季日期':'换季日期','處理日期':'处理日期','处理日期':'处理日期'
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
    actions.push({ label: '入库', class: 'move-btn inventory', target: 'inventory' });
  }

  const head = columns.map(c => `<th data-col="${escapeHtml(c)}">${escapeHtml(c)}</th>`).join('') + '<th>操作</th>';
  const body = rows.map((r, idx) => {
    const tds = columns.map(c => {
      const val = r[c] ?? '';
      return `<td>${formatCell(c, val)}</td>`;
    }).join('');
    
    const actionBtns = actions.map(a => `<button class="${a.class}" data-idx="${idx}" data-target="${a.target}">${a.label}</button>`).join('');
    return `<tr>${tds}<td><div class="row-actions"><button class="edit-btn" data-idx="${idx}">编辑</button>${actionBtns}</div></td></tr>`;
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
  $$('table thead th', wrap).forEach((th, idx) => {
    if (idx < columns.length) {
      th.addEventListener('click', () => sortBy(columns[idx]));
    }
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
  if (!confirm(`确定要彻底丢弃 "${item['名称'] || item['衣服名稱']}" 吗？此操作不可撤销，且会将其从预淘汰区永久删除。`)) return;

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

async function openEditModal(idx) {
  editingRowIndex = idx;
  const row = currentRows[idx];
  const form = $('#edit-form');
  
  const existingLocs = await getExistingLocations();
  
  form.innerHTML = Object.entries(row).map(([k, v]) => {
    const isLocation = k === '存放地点' || k === '存放地點';
    if (isLocation) {
      const options = existingLocs.map(l => `<option value="${escapeHtml(l)}" ${l === v ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('');
      return `
        <div class="form-group">
          <label>${escapeHtml(k)}</label>
          <div style="display:flex;gap:4px">
            <select name="${escapeHtml(k)}" class="input" style="flex:1">
              <option value="">-- 请选择 --</option>
              ${options}
              <option value="__new__">+ 新增地点...</option>
            </select>
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

  // Handle "+ 新增地点..."
  const locSelect = $('select[name="存放地点"]') || $('select[name="存放地點"]');
  if (locSelect) {
    locSelect.addEventListener('change', (e) => {
      if (e.target.value === '__new__') {
        const newVal = prompt('请输入新地点名称：');
        if (newVal) {
          const opt = document.createElement('option');
          opt.value = opt.textContent = newVal;
          opt.selected = true;
          e.target.insertBefore(opt, e.target.lastElementChild);
        } else {
          e.target.value = "";
        }
      }
    });
  }

  $('#modal-overlay').hidden = false;
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
  const itemToUpdate = currentRows[editingRowIndex];
  Object.assign(itemToUpdate, updatedRow);
  
  // Save to server
  const csvContent = Papa.unparse(fullRowsOfFile);
  try {
    const res = await fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify({ filename: currentFilename, content: csvContent })
    });
    if (res.ok) {
      $('#modal-overlay').hidden = true;
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
