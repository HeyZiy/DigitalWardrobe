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
          if (data.season) {
            const seasonSelect = $('select[name="季节"]');
            if (seasonSelect) {
              const matchedOption = Array.from(seasonSelect.options).find(opt => data.season.includes(opt.value) || opt.value.includes(data.season));
              if (matchedOption) seasonSelect.value = matchedOption.value;
            }
          }
          
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
  
  const mappedData = {
    name: data['名称'],
    price: data['价格'],
    brand: data['品牌'] || '',
    category: data['分类'] || '',
    source: data['购买途径'] || '',
    buy_date: data['购买日期'] || '',
    image: data['图片'] || '',
    status: data['状态'] || '已入库',
    url: data['购买链接'] || '',
    remarks: data['季节'] || ''
  };
  
  onSaveCallback(mappedData);
  hidePurchaseForm();
}

function handlePaste(e) {
  // 这个函数会被setupFormEvents中的同名函数覆盖
}

// ----------------------------------------------------
// One-click Pure Image Import UI (Fast track)
// ----------------------------------------------------

let onFastSaveCallback = null;

export function showImageImportModal(onSave) {
  onFastSaveCallback = onSave;
  
  const modal = $('#modal-overlay');
  const modalTitle = $('#modal-title');
  const modalBody = $('#modal-body');
  const modalFooter = $('.modal-footer');
  
  modalTitle.textContent = '📸 极速从图片导入';
  modalFooter.style.display = 'none'; // Hide save/cancel for fast track
  
  modalBody.innerHTML = `
    <div id="fast-import-area" style="
      border: 3px dashed var(--brand);
      border-radius: 12px;
      padding: 40px;
      text-align: center;
      background: rgba(79,124,255,0.05);
      cursor: pointer;
      transition: all 0.2s;
      margin: 20px 0;
    ">
      <div id="import-state-idle">
        <div style="font-size:40px;margin-bottom:12px">📥</div>
        <h3 style="margin:0 0 8px 0;color:var(--text)">直接粘贴 (Ctrl+V) 或点击上传</h3>
        <p style="color:var(--muted);font-size:13px;margin:0">
          截图包含完整的商品名和价格即可实现「无感入库」
        </p>
      </div>
      <div id="import-state-loading" style="display:none;">
        <div style="font-size:40px;margin-bottom:12px;animation: pulse 1.5s infinite;">🤖</div>
        <h3 style="margin:0 0 8px 0;color:var(--brand)">AI 全速解析中...</h3>
        <p style="color:var(--muted);font-size:13px;margin:0">这可能是魔法，请稍候片刻</p>
      </div>
    </div>
    <input type="file" id="fast-img-input" accept="image/*" style="display:none">
  `;
  
  modal.hidden = false;
  
  const uploadArea = $('#fast-import-area');
  const fileInput = $('#fast-img-input');
  const stateIdle = $('#import-state-idle');
  const stateLoading = $('#import-state-loading');
  const closeBtn = $('#modal-close');
  
  const closeFastModal = () => {
    modal.hidden = true;
    modalFooter.style.display = 'flex'; // Restore for standard form
    document.removeEventListener('paste', handleFastPaste);
  };

  closeBtn.addEventListener('click', closeFastModal, { once: true });
  
  // Handlers
  const handleFastImage = async (file) => {
    if (!file.type.startsWith('image/')) {
      alert('请提供图片文件！');
      return;
    }
    
    // UI state change
    stateIdle.style.display = 'none';
    stateLoading.style.display = 'block';
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Img = e.target.result;
      try {
        const response = await fetch('/api/recognize-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Img })
        });
        
        const data = await response.json();
        
        if (data.success && data.name && data.price) {
          // Construct the record object silently
          const today = new Date().toISOString().split('T')[0];
          const record = {
            name: data.name,
            price: parseFloat(data.price) || 0,
            brand: data.brand || '',
            category: data.category || '',
            source: data.source || '',
            season: data.season || '',
            status: '已入库',
            buy_date: today,
            image: base64Img,
            url: '',
            remarks: data.season || ''
          };
          
          if (onFastSaveCallback) {
            await onFastSaveCallback(record);
          }
          closeFastModal();
        } else {
          // Fallback to manual if critical info missing
          alert('AI 提取失败或未发现金额/名称，请手动完善表单。');
          closeFastModal();
          // Pre-fill standard form as much as possible
          showPurchaseForm(onFastSaveCallback);
          setTimeout(() => {
            if (data.name) $('input[name="名称"]').value = data.name;
            if (data.price) $('input[name="价格"]').value = data.price;
            if (data.brand) $('input[name="品牌"]').value = data.brand;
            if (data.category) $('input[name="分类"]').value = data.category;
            if (data.source) $('input[name="购买途径"]').value = data.source;
            const imgInput = $('#img-data');
            const previewImg = $('#preview-img');
            const preview = $('#upload-preview');
            const placeholder = $('#upload-placeholder');
            if (imgInput) imgInput.value = base64Img;
            if (previewImg) previewImg.src = base64Img;
            if (preview) preview.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
          }, 300);
        }
      } catch (err) {
        console.error(err);
        alert('网络错误或配置异常，识别失败');
        closeFastModal();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFastPaste = (evt) => {
    const items = evt.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) handleFastImage(file);
        break;
      }
    }
  };

  document.addEventListener('paste', handleFastPaste);
  
  uploadArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFastImage(e.target.files[0]);
  });
  
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.opacity = '0.7';
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.opacity = '1';
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.opacity = '1';
    if (e.dataTransfer.files.length) handleFastImage(e.dataTransfer.files[0]);
  });
}
