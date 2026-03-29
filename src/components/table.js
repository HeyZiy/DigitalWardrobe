import { $, $$, escapeHtml } from '../utils.js';
import { OPTIONS_SEASONS, OPTIONS_STATUSES } from '../config.js';

export async function fetchData(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`加载失败: ${url}`);
  const data = await res.json();
  return data;
}

export function normalize(data) {
  // Maintaining compatibility with existing code where it expects { headers, normalized }
  if (!data || !data.length) return { headers: [], normalized: [] };
  
  const headers = Object.keys(data[0]);
  return { headers, normalized: data };
}

let currentSort = { key: null, asc: true };

export function renderCsvTable(container, title, fileType, rows, filterFn, showActions = true) {
  if (!rows || rows.length === 0) {
    container.innerHTML = `<div class="muted">暂无数据</div>`;
    return;
  }
  
  const filteredRows = filterFn ? rows.filter(filterFn) : rows;
  if (filteredRows.length === 0) {
    container.innerHTML = `<div class="muted">没有符合条件的记录</div>`;
    return;
  }
  
  // Apply sorting if active
  let displayRows = [...filteredRows];
  if (currentSort.key) {
    displayRows.sort((a, b) => {
      let valA = a[currentSort.key] || '';
      let valB = b[currentSort.key] || '';
      
      // Numeric or Date parsing for specific fields
      if (currentSort.key.includes('价格') || currentSort.key.includes('金额')) {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      } else if (currentSort.key.includes('日期')) {
        valA = new Date(valA).getTime() || 0;
        valB = new Date(valB).getTime() || 0;
      }
      
      if (valA < valB) return currentSort.asc ? -1 : 1;
      if (valA > valB) return currentSort.asc ? 1 : -1;
      return 0;
    });
  }
  
  const headers = Object.keys(filteredRows[0]);
  const displayHeaders = headers.filter(h => {
    const hl = h.toLowerCase();
    return !['id', '_id', 'location', 'status', '状态'].includes(hl);
  });
  
  container.innerHTML = `
    <div class="controls">
      <input type="text" class="search" placeholder="搜索..." data-table-search>
      <div class="batch-actions" data-batch-actions>
        <span class="muted">已选 <span data-selected-count>0</span> 项</span>
        <button class="batch-btn" data-batch-action="move">移动到...</button>
        <button class="batch-btn danger" data-batch-action="delete">删除</button>
      </div>
    </div>
    <div class="table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th style="width:40px"><input type="checkbox" data-select-all></th>
            ${displayHeaders.map(h => {
              const isActive = currentSort.key === h;
              const dirIcon = isActive ? (currentSort.asc ? ' ↑' : ' ↓') : '';
              return `<th class="sortable-header" data-sort-key="${escapeHtml(h)}" style="cursor:pointer; user-select:none;">
                ${escapeHtml(h)}<span class="muted" style="font-size:12px">${dirIcon}</span>
              </th>`;
            }).join('')}
            ${showActions ? '<th>操作</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${displayRows.map((row, idx) => renderTableRow(row, idx, displayHeaders, fileType, showActions)).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  setupTableEvents(container, fileType, filteredRows, title, filterFn, showActions);
}

function renderTableRow(row, idx, headers, fileType, showActions) {
  return `
    <tr data-row-idx="${idx}">
      <td class="col-check"><input type="checkbox" data-row-select></td>
      ${headers.map(h => renderTableCell(row[h], h)).join('')}
      ${showActions ? `<td class="col-actions">${renderRowActions(fileType)}</td>` : ''}
    </tr>
  `;
}

function renderTableCell(value, header) {
  const headerLower = header.toLowerCase();
  
  if (headerLower.includes('图片') || headerLower.includes('image')) {
    return `<td class="col-img" data-label="${escapeHtml(header)}">${value ? `<img src="${escapeHtml(value)}" class="table-img" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%23262b36%22 width=%2240%22 height=%2240%22/><text x=%2220%22 y=%2225%22 text-anchor=%22middle%22 fill=%22%23a3acc2%22 font-size=%2212%22>无图</text></svg>'">` : ''}</td>`;
  }
  
  if (headerLower.includes('价格') || headerLower.includes('金额')) {
    return `<td data-label="${escapeHtml(header)}">¥${escapeHtml(value || '0')}</td>`;
  }
  
  if (headerLower.includes('状态')) {
    const statusClass = getStatusClass(value);
    return `<td data-label="${escapeHtml(header)}"><span class="pill ${statusClass}">${escapeHtml(value)}</span></td>`;
  }
  
  if (headerLower.includes('季节') || headerLower.includes('适用季节')) {
    const seasonClass = getSeasonClass(value);
    return `<td data-label="${escapeHtml(header)}"><span class="pill ${seasonClass}">${escapeHtml(value)}</span></td>`;
  }
  
  if (headerLower.includes('分类') || headerLower.includes('类型')) {
    return `<td data-label="${escapeHtml(header)}"><span class="pill pill-category">${escapeHtml(value)}</span></td>`;
  }
  
  return `<td data-label="${escapeHtml(header)}">${escapeHtml(value)}</td>`;
}

function getStatusClass(status) {
  if (!status) return '';
  if (status.includes('正在使用')) return 'pill-active';
  if (status.includes('收纳') || status.includes('换季')) return 'pill-storage';
  if (status.includes('待处理') || status.includes('淘汰')) return 'pill-discarded';
  if (status.includes('已下单')) return 'pill-ordered';
  if (status.includes('预售') || status.includes('咸鱼')) return 'pill-pending';
  return '';
}

function getSeasonClass(season) {
  if (!season) return '';
  if (season.includes('冬')) return 'pill-winter';
  if (season.includes('夏')) return 'pill-summer';
  if (season.includes('春') && season.includes('秋')) return 'pill-spring-fall';
  if (season.includes('春')) return 'pill-spring';
  if (season.includes('秋')) return 'pill-fall';
  return '';
}

function renderRowActions(fileType) {
  const actions = [];
  
  if (fileType === 'inventory') {
    actions.push(`<button class="move-btn storage" data-action="move" data-target="storage">收纳</button>`);
    actions.push(`<button class="move-btn discard" data-action="move" data-target="discard">淘汰</button>`);
  } else if (fileType === 'storage') {
    actions.push(`<button class="move-btn inventory" data-action="move" data-target="inventory">取出</button>`);
    actions.push(`<button class="move-btn discard" data-action="move" data-target="discard">淘汰</button>`);
  } else if (fileType === 'discard') {
    actions.push(`<button class="move-btn inventory" data-action="move" data-target="inventory">恢复</button>`);
    actions.push(`<button class="move-btn delete" data-action="delete">删除</button>`);
  } else if (fileType === 'purchases') {
    actions.push(`<button class="move-btn delete" data-action="delete">删除</button>`);
  }
  
  actions.push(`<button class="edit-btn" data-action="edit">编辑</button>`);
  
  return `<div class="row-actions">${actions.join('')}</div>`;
}

export function setupTableEvents(container, fileType, rows, title, filterFn, showActions) {
  const selectAll = $('[data-select-all]', container);
  const batchActions = $('[data-batch-actions]', container);
  const selectedCount = $('[data-selected-count]', container);
  
  // Setup sorting header clicks
  $$('.sortable-header', container).forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sortKey;
      if (currentSort.key === key) {
        currentSort.asc = !currentSort.asc;
      } else {
        currentSort.key = key;
        currentSort.asc = true;
      }
      // Re-trigger render
      renderCsvTable(container, title, fileType, rows, filterFn, showActions);
    });
  });
  
  if (selectAll) {
    selectAll.addEventListener('change', (e) => {
      const checked = e.target.checked;
      $$('[data-row-select]', container).forEach(cb => cb.checked = checked);
      updateBatchActions();
    });
  }
  
  $$('[data-row-select]', container).forEach(cb => {
    cb.addEventListener('change', updateBatchActions);
  });
  
  function updateBatchActions() {
    const selected = $$('[data-row-select]:checked', container).length;
    if (selectedCount) selectedCount.textContent = selected;
    if (batchActions) batchActions.classList.toggle('active', selected > 0);
  }
  
  // Handle row actions (Edit, Move, Delete)
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    
    const action = btn.dataset.action;
    const rowIdx = btn.closest('tr').dataset.rowIdx;
    const rowData = rows[rowIdx];
    
    console.log(`Action: ${action} on row ${rowIdx}`, rowData);
    
    if (action === 'edit') {
      const { showModal } = await import('./modal.js');
      
      let editData = rowData;
      // If the row comes from the finance mapped view, translate it back to the English schema
      if (fileType === 'purchases') {
         editData = {
           id: rowData.id,
           image: rowData['图片'] || '',
           name: rowData['名称'] || '',
           brand: rowData['品牌'] || '',
           category: rowData['分类'] || '',
           buy_date: rowData['购买日期'] || '',
           source: rowData['购买途径'] || '',
           price: rowData['价格'] || '',
           status: rowData['状态'] || '',
           url: rowData['购买链接'] || '',
           season: rowData['备注'] || '',
           location: (rowData['当前下落'] === '正在使用' ? 'inventory' : (rowData['当前下落'] === '已收纳' ? 'storage' : (rowData['当前下落'] === '已淘汰' ? 'discard' : 'inventory')))
         };
      }
      
      showModal('编辑物品属性', editData, async (updatedData) => {
        try {
          const res = await fetch(`/api/items/${rowData.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
          });
          if (res.ok) {
            alert('编辑成功！');
            window.dispatchEvent(new Event('data-refreshed'));
          } else {
            alert('编辑失败，请重试');
          }
        } catch(e) {
          alert('保存失败：' + e.message);
        }
      });
    } else if (action === 'move') {
      const target = btn.dataset.target;
      if (confirm(`确定要将该物品移动到 ${target} 吗？`)) {
        try {
          const res = await fetch(`/api/items/${rowData.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location: target })
          });
          if (res.ok) alert('移动成功，请刷新页面即可！');
        } catch(e) {
          alert('操作失败：' + e.message);
        }
      }
    } else if (action === 'delete') {
      if (confirm('确定要删除这项吗？')) {
        const endpoint = `/api/items/${rowData.id}`;
        try {
          const res = await fetch(endpoint, { method: 'DELETE' });
          if (res.ok) {
            alert('删除成功！');
            window.dispatchEvent(new Event('data-refreshed'));
          }
        } catch(e) {
          alert('删除失败：' + e.message);
        }
      }
    }
  });

  // Handle batch actions (Move, Delete)
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-batch-action]');
    if (!btn) return;

    const action = btn.dataset.batchAction;
    const selectedRows = $$('[data-row-select]:checked', container).map(cb => {
      const rowIdx = cb.closest('tr').dataset.rowIdx;
      return rows[rowIdx];
    }).filter(row => row);

    if (selectedRows.length === 0) {
      alert('请先选择要操作的项');
      return;
    }

    if (action === 'delete') {
      if (confirm(`确定要删除选中的 ${selectedRows.length} 项吗？`)) {
        let successCount = 0;
        let failCount = 0;
        for (const row of selectedRows) {
          try {
            const endpoint = `/api/items/${row.id}`;
            const res = await fetch(endpoint, { method: 'DELETE' });
            if (res.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } catch(e) {
            failCount++;
          }
        }
        if (failCount === 0) {
          alert(`批量删除成功 (${successCount} 项)，请刷新页面！`);
        } else {
          alert(`删除完成：成功 ${successCount} 项，失败 ${failCount} 项`);
        }
      }
    } else if (action === 'move') {
      const targets = ['inventory', 'storage', 'discard'];
      const targetLabels = { inventory: '正在使用', storage: '已收纳', discard: '已淘汰' };
      const target = prompt(`选择目标位置：\n${targets.map(t => `${t} - ${targetLabels[t]}`).join('\n')}`);
      if (target && targets.includes(target)) {
        let successCount = 0;
        let failCount = 0;
        for (const row of selectedRows) {
          try {
            const res = await fetch(`/api/items/${row.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ location: target })
            });
            if (res.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } catch(e) {
            failCount++;
          }
        }
        if (failCount === 0) {
          alert(`批量移动到 ${targetLabels[target]} 成功 (${successCount} 项)，请刷新页面！`);
        } else {
          alert(`移动完成：成功 ${successCount} 项，失败 ${failCount} 项`);
        }
      }
    }
  });

  const searchInput = $('[data-table-search]', container);
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      $$('tbody tr', container).forEach(tr => {
        const text = tr.textContent.toLowerCase();
        tr.style.display = text.includes(query) ? '' : 'none';
      });
    });
  }
}
