import { $, $$, escapeHtml } from '../utils.js';
import { OPTIONS_SEASONS, OPTIONS_STATUSES, OPTIONS_CATEGORIES, OPTIONS_BRANDS, OPTIONS_SOURCES } from '../config.js';

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
  const uniqueId = Date.now();

  return `
    <div class="form-group">
      <label>名称 *</label>
      <input type="text" name="名称" placeholder="例如：优衣库T恤" required>
    </div>

    <div class="form-group">
      <label>分类</label>
      <input type="text" name="分类" placeholder="例如：短袖" list="purchase-categories-${uniqueId}" class="combobox-input" autocomplete="off">
      <datalist id="purchase-categories-${uniqueId}">
        ${OPTIONS_CATEGORIES.map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('')}
      </datalist>
    </div>

    <div class="form-group">
      <label>品牌</label>
      <input type="text" name="品牌" placeholder="例如：优衣库" list="purchase-brands-${uniqueId}" class="combobox-input" autocomplete="off">
      <datalist id="purchase-brands-${uniqueId}">
        ${OPTIONS_BRANDS.map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('')}
      </datalist>
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
      <input type="text" name="购买途径" placeholder="例如：淘宝" list="purchase-sources-${uniqueId}" class="combobox-input" autocomplete="off">
      <datalist id="purchase-sources-${uniqueId}">
        ${OPTIONS_SOURCES.map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('')}
      </datalist>
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
            <button type="button" id="recognize-img" style="background:var(--brand);border:1px solid var(--brand);color:white;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;margin-left:8px">识别商品信息</button>
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

  // Automatic metadata fetching for links
  const linkInput = $('input[name="购买链接"]');
  if (linkInput) {
    const handleUrlInput = async (url) => {
      if (!url || !url.startsWith('http')) return;
      
      const nameInput = $('input[name="名称"]');
      const priceInput = $('input[name="价格"]');
      const brandInput = $('input[name="品牌"]');
      const imgDataInput = $('#img-data');

      // Show some loading indicator if possible
      linkInput.style.borderColor = 'var(--brand)';
      linkInput.classList.add('loading-pulse');

      try {
        console.log('Fetching metadata for:', url);
        const response = await fetch('/api/fetch-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUrl: url })
        });
        
        const data = await response.json();
        if (data.success) {
          if (data.title && (!nameInput.value || nameInput.value.length < 5)) nameInput.value = data.title;
          if (data.price && !priceInput.value) priceInput.value = data.price;
          // Heuristic for brand (extract from title if common brands found)
          if (!brandInput.value && data.title) {
            const brands = ['优衣库', 'UNIQLO', 'ZARA', 'H&M', '耐克', 'NIKE', '阿迪达斯', 'ADIDAS', '李宁', '安踏'];
            const foundBrand = brands.find(b => data.title.toUpperCase().includes(b));
            if (foundBrand) brandInput.value = foundBrand;
          }

          if (data.image && !uploadedImageData) {
            uploadedImageData = data.image;
            if (previewImg) previewImg.src = data.image;
            if (imgDataInput) imgDataInput.value = data.image;
            if (placeholder) placeholder.style.display = 'none';
            if (preview) preview.style.display = 'block';
          }
        }
      } catch (err) {
        console.error('Failed to fetch metadata:', err);
      } finally {
        linkInput.style.borderColor = '';
        linkInput.classList.remove('loading-pulse');
      }
    };

    linkInput.addEventListener('paste', (e) => {
      const pasted = e.clipboardData.getData('text');
      handleUrlInput(pasted);
    });

    linkInput.addEventListener('change', (e) => {
      handleUrlInput(e.target.value);
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
  
  const recognizeBtn = $('#recognize-img');
  if (recognizeBtn) {
    recognizeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!uploadedImageData) {
        alert('请先上传图片');
        return;
      }
      
      recognizeBtn.textContent = '识别中...';
      recognizeBtn.disabled = true;
      
      try {
        const response = await fetch('/api/recognize-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: uploadedImageData })
        });
        
        const data = await response.json();
        if (data.success) {
          if (data.name) $('input[name="名称"]').value = data.name;
          if (data.price) $('input[name="价格"]').value = data.price;
          if (data.brand) $('input[name="品牌"]').value = data.brand;
          if (data.category) $('input[name="分类"]').value = data.category;
          if (data.source) $('input[name="购买途径"]').value = data.source;
          
          alert('商品信息识别成功！');
        } else {
          alert('识别失败：' + (data.error || '请尝试上传更清晰的图片'));
        }
      } catch (err) {
        console.error('识别错误:', err);
        alert('识别失败：网络错误');
      } finally {
        recognizeBtn.textContent = '识别商品信息';
        recognizeBtn.disabled = false;
      }
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
