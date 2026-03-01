import { $, $$, escapeHtml } from '../utils.js';
import { OPTIONS_SEASONS, OPTIONS_STATUSES } from '../config.js';

let onSaveCallback = null;
let uploadedImageData = null;

export function showPurchaseForm(onSave) {
  onSaveCallback = onSave;
  uploadedImageData = null;
  
  const modal = $('#modal-overlay');
  const modalTitle = $('#modal-title');
  const form = $('#edit-form');
  
  modalTitle.textContent = '添加购买记录';
  form.innerHTML = generatePurchaseForm();
  
  modal.hidden = false;
  
  setupFormEvents();
  setupModalEvents();
}

export function hidePurchaseForm() {
  const modal = $('#modal-overlay');
  modal.hidden = true;
  onSaveCallback = null;
  uploadedImageData = null;
}

function generatePurchaseForm() {
  const today = new Date().toISOString().split('T')[0];
  
  return `
    <div class="form-group">
      <label>名称 *</label>
      <input type="text" name="名称" placeholder="例如：优衣库T恤" required>
    </div>
    
    <div class="form-group">
      <label>分类</label>
      <select name="分类">
        <option value="">请选择</option>
        <option value="短袖">短袖</option>
        <option value="长袖">长袖</option>
        <option value="外套">外套</option>
        <option value="裤子">裤子</option>
        <option value="短裤">短裤</option>
        <option value="羽绒服">羽绒服</option>
        <option value="秋衣">秋衣</option>
        <option value="特殊">特殊</option>
      </select>
    </div>
    
    <div class="form-group">
      <label>品牌</label>
      <input type="text" name="品牌" placeholder="例如：优衣库">
    </div>
    
    <div class="form-group">
      <label>季节</label>
      <select name="季节">
        ${OPTIONS_SEASONS.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>
    
    <div class="form-group">
      <label>状态</label>
      <select name="状态">
        ${OPTIONS_STATUSES.map(s => `<option value="${s}" ${s === '已入库' ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
    
    <div class="form-group">
      <label>价格 *</label>
      <input type="number" step="0.01" name="价格" placeholder="0.00" required>
    </div>
    
    <div class="form-group">
      <label>购买链接</label>
      <input type="text" name="购买链接" placeholder="https://...">
    </div>
    
    <div class="form-group">
      <label>购买日期</label>
      <input type="date" name="购买日期" value="${today}">
    </div>
    
    <div class="form-group">
      <label>购买途径</label>
      <select name="购买途径">
        <option value="">请选择</option>
        <option value="淘宝">淘宝</option>
        <option value="京东">京东</option>
        <option value="拼多多">拼多多</option>
        <option value="1688">1688</option>
        <option value="小红书">小红书</option>
        <option value="线下">线下</option>
        <option value="其他">其他</option>
      </select>
    </div>
    
    <div class="form-group">
      <label>商品图片</label>
      <div class="img-upload-area" id="img-upload-area" style="border:2px dashed var(--border);border-radius:8px;padding:20px;text-align:center;cursor:pointer;transition:all 0.2s">
        <div id="upload-placeholder">
          <div style="font-size:24px;margin-bottom:8px">📷</div>
          <div style="color:var(--muted);font-size:13px">点击上传图片或粘贴截图</div>
          <div style="color:var(--muted);font-size:11px;margin-top:4px">支持 JPG、PNG、WebP</div>
        </div>
        <div id="upload-preview" style="display:none">
          <img id="preview-img" style="max-width:100%;max-height:200px;border-radius:8px">
          <div style="margin-top:8px">
            <button type="button" id="remove-img" style="background:none;border:1px solid var(--border);color:var(--muted);padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px">移除图片</button>
          </div>
        </div>
        <input type="file" id="img-input" accept="image/*" style="display:none">
        <input type="hidden" name="图片" id="img-data">
      </div>
    </div>
  `;
}

function setupFormEvents() {
  const uploadArea = $('#img-upload-area');
  const imgInput = $('#img-input');
  const preview = $('#upload-preview');
  const placeholder = $('#upload-placeholder');
  const previewImg = $('#preview-img');
  const removeBtn = $('#remove-img');
  const imgDataInput = $('#img-data');
  
  if (uploadArea) {
    uploadArea.addEventListener('click', () => imgInput?.click());
    
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = 'var(--brand)';
      uploadArea.style.background = 'rgba(79,124,255,0.05)';
    });
    
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.style.borderColor = 'var(--border)';
      uploadArea.style.background = 'transparent';
    });
    
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = 'var(--border)';
      uploadArea.style.background = 'transparent';
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleImageFile(files[0]);
      }
    });
  }
  
  if (imgInput) {
    imgInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleImageFile(e.target.files[0]);
      }
    });
  }
  
  document.addEventListener('paste', handlePaste);
  
  function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const imgData = e.target.result;
      uploadedImageData = imgData;
      
      if (previewImg) previewImg.src = imgData;
      if (imgDataInput) imgDataInput.value = imgData;
      if (placeholder) placeholder.style.display = 'none';
      if (preview) preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
  
  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) handleImageFile(file);
        break;
      }
    }
  }
  
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      uploadedImageData = null;
      if (imgDataInput) imgDataInput.value = '';
      if (placeholder) placeholder.style.display = 'block';
      if (preview) preview.style.display = 'none';
      if (imgInput) imgInput.value = '';
    });
  }
}

function setupModalEvents() {
  const modal = $('#modal-overlay');
  const closeBtn = $('#modal-close');
  const cancelBtn = $('#modal-cancel');
  const saveBtn = $('#modal-save');
  
  const handleClose = () => {
    document.removeEventListener('paste', handlePaste);
    hidePurchaseForm();
  };
  
  closeBtn?.addEventListener('click', handleClose);
  cancelBtn?.addEventListener('click', handleClose);
  
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) handleClose();
  });
  
  saveBtn?.addEventListener('click', handleSave);
}

function handleSave() {
  if (!onSaveCallback) return;
  
  const form = $('#edit-form');
  const formData = new FormData(form);
  const data = {};
  
  for (const [key, value] of formData.entries()) {
    data[key] = value;
  }
  
  if (!data['名称'] || !data['价格']) {
    alert('请填写名称和价格');
    return;
  }
  
  onSaveCallback(data);
  hidePurchaseForm();
}

function handlePaste(e) {
  // 这个函数会被setupFormEvents中的同名函数覆盖
}
