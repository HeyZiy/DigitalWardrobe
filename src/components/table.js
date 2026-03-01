import { $, $$, escapeHtml } from '../utils.js';
import { OPTIONS_SEASONS, OPTIONS_STATUSES } from '../config.js';

export async function loadCsv(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`加载失败: ${url}`);
  const text = await res.text();
  return text;
}

export function normalize(csvText) {
  const lines = csvText.trim().split('\n');
  if (!lines.length) return { headers: [], normalized: [] };
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const normalized = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    normalized.push(row);
  }
  
  return { headers, normalized };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

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
  
  const headers = Object.keys(filteredRows[0]);
  const displayHeaders = headers.filter(h => !['id', 'ID', '_id'].includes(h.toLowerCase()));
  
  container.innerHTML = `
    <div class="controls">
      <input type="text" class="search" placeholder="搜索..." data-table-search>
      <div class="batch-actions" data-batch-actions>
        <span class="muted">已选 <span data-selected-count>0</span> 项</span>
        <button class="batch-btn" data-batch-action="move">移动到...</button>
        <button class="batch-btn danger" data-batch-action="delete">删除</button>
      </div>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th><input type="checkbox" data-select-all></th>
          ${displayHeaders.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
          ${showActions ? '<th>操作</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${filteredRows.map((row, idx) => renderTableRow(row, idx, displayHeaders, fileType, showActions)).join('')}
      </tbody>
    </table>
  `;
  
  setupTableEvents(container, fileType, filteredRows);
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
    actions.push(`<button class="edit-btn" data-action="edit">编辑</button>`);
  }
  
  actions.push(`<button class="edit-btn" data-action="edit">编辑</button>`);
  
  return `<div class="row-actions">${actions.join('')}</div>`;
}

export function setupTableEvents(container, fileType, rows) {
  const selectAll = $('[data-select-all]', container);
  const batchActions = $('[data-batch-actions]', container);
  const selectedCount = $('[data-selected-count]', container);
  
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
