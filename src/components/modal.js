import { $, $$, escapeHtml } from '../utils.js';
import { OPTIONS_SEASONS, OPTIONS_STATUSES } from '../config.js';

let currentEditData = null;
let onSaveCallback = null;

export function showModal(title, data, onSave) {
  currentEditData = data;
  onSaveCallback = onSave;
  
  const modal = $('#modal-overlay');
  const modalTitle = $('#modal-title');
  const modalBody = $('#modal-body');
  const form = $('#edit-form');
  
  modalTitle.textContent = title;
  form.innerHTML = generateFormFields(data);
  
  modal.hidden = false;
  
  setupModalEvents();
}

export function hideModal() {
  const modal = $('#modal-overlay');
  modal.hidden = true;
  currentEditData = null;
  onSaveCallback = null;
}

function generateFormFields(data) {
  return Object.entries(data).map(([key, value]) => {
    const keyLower = key.toLowerCase();
    
    if (keyLower === 'id' || keyLower === '_id') {
      return `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}">`;
    }
    
    if (keyLower.includes('图片') || keyLower.includes('image')) {
      return `
        <div class="form-group">
          <label>${escapeHtml(key)}</label>
          <div class="img-preview">
            ${value ? `<img src="${escapeHtml(value)}" onerror="this.parentElement.innerHTML='<span class=\\'placeholder\\'>无图片</span>'">` : '<span class="placeholder">无图片</span>'}
          </div>
          <input type="text" name="${escapeHtml(key)}" value="${escapeHtml(value)}" placeholder="图片URL">
        </div>
      `;
    }
    
    if (keyLower.includes('状态')) {
      return `
        <div class="form-group">
          <label>${escapeHtml(key)}</label>
          <select name="${escapeHtml(key)}">
            ${OPTIONS_STATUSES.map(s => `<option value="${s}" ${s === value ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      `;
    }
    
    if (keyLower.includes('季节') || keyLower.includes('适用季节')) {
      return `
        <div class="form-group">
          <label>${escapeHtml(key)}</label>
          <select name="${escapeHtml(key)}">
            ${OPTIONS_SEASONS.map(s => `<option value="${s}" ${s === value ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      `;
    }
    
    if (keyLower.includes('日期')) {
      return `
        <div class="form-group">
          <label>${escapeHtml(key)}</label>
          <input type="date" name="${escapeHtml(key)}" value="${escapeHtml(value)}">
        </div>
      `;
    }
    
    if (keyLower.includes('价格') || keyLower.includes('金额')) {
      return `
        <div class="form-group">
          <label>${escapeHtml(key)}</label>
          <input type="number" step="0.01" name="${escapeHtml(key)}" value="${escapeHtml(value)}" placeholder="0.00">
        </div>
      `;
    }
    
    if (keyLower.includes('备注') || keyLower.includes('说明')) {
      return `
        <div class="form-group">
          <label>${escapeHtml(key)}</label>
          <textarea name="${escapeHtml(key)}" rows="3" style="width:100%;resize:vertical;border:1px solid var(--border);background:var(--bg);color:var(--text);padding:8px;border-radius:6px">${escapeHtml(value)}</textarea>
        </div>
      `;
    }
    
    return `
      <div class="form-group">
        <label>${escapeHtml(key)}</label>
        <input type="text" name="${escapeHtml(key)}" value="${escapeHtml(value)}">
      </div>
    `;
  }).join('');
}

function setupModalEvents() {
  const modal = $('#modal-overlay');
  const closeBtn = $('#modal-close');
  const cancelBtn = $('#modal-cancel');
  const saveBtn = $('#modal-save');
  
  const handleClose = () => hideModal();
  
  closeBtn?.addEventListener('click', handleClose);
  cancelBtn?.addEventListener('click', handleClose);
  
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) handleClose();
  });
  
  saveBtn?.addEventListener('click', handleSave);
}

function handleSave() {
  if (!onSaveCallback || !currentEditData) return;
  
  const form = $('#edit-form');
  const formData = new FormData(form);
  const updatedData = { ...currentEditData };
  
  for (const [key, value] of formData.entries()) {
    updatedData[key] = value;
  }
  
  onSaveCallback(updatedData);
  hideModal();
}
