// ============================================================
// library.js — 素材库（上传/分类/拖入画布）
// ============================================================
class LibraryManager {
  constructor() {
    this._items    = Utils.loadFromStorage('library') || [];
    this._filter   = 'all';
    this._panel    = document.getElementById('libraryPanel');
    this._grid     = document.getElementById('libraryGrid');
    this._input    = document.getElementById('libraryFileInput');
    this._zone     = document.getElementById('libraryUploadZone');

    this._initEvents();
    this._render();
  }

  _initEvents() {
    // 打开/关闭面板
    document.getElementById('toggleLibrary').addEventListener('click', () => {
      this._panel.classList.toggle('open');
    });
    document.getElementById('closeLibrary').addEventListener('click', () => {
      this._panel.classList.remove('open');
    });

    // 文件上传
    this._input.addEventListener('change', e => {
      const files = Array.from(e.target.files);
      this._addFiles(files);
      e.target.value = '';
    });

    // 拖放上传
    this._zone.addEventListener('dragover',  e => { e.preventDefault(); this._zone.classList.add('dragover'); });
    this._zone.addEventListener('dragleave', () => this._zone.classList.remove('dragover'));
    this._zone.addEventListener('drop', e => {
      e.preventDefault();
      this._zone.classList.remove('dragover');
      this._addFiles(Array.from(e.dataTransfer.files));
    });

    // 分类标签
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._filter = btn.dataset.tab;
        this._render();
      });
    });
  }

  async _addFiles(files) {
    const cats = { character: '人物', scene: '场景', prop: '物品', style: '风格' };
    // 弹出分类选择
    const catChoice = await this._promptCategory();

    for (const file of files) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue;
      const src = await Utils.readFileAsDataURL(file);
      this._items.push({
        id:       Utils.uid(),
        src,
        name:     file.name,
        type:     file.type.startsWith('video/') ? 'video' : 'image',
        category: catChoice,
        size:     file.size,
        date:     Date.now()
      });
    }
    Utils.saveToStorage('library', this._items);
    this._render();
    Utils.toast(`已添加 ${files.length} 个素材`, 'success');
  }

  _promptCategory() {
    return new Promise(resolve => {
      const cats = [
        { val: 'character', label: '👤 人物' },
        { val: 'scene',     label: '🌄 场景' },
        { val: 'prop',      label: '🗡️ 物品' },
        { val: 'style',     label: '🎨 风格' },
      ];
      Utils.modal('选择素材分类', `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${cats.map(c => `
            <button class="qa-btn" onclick="window._libCat='${c.val}';Utils.closeModal()"
              style="padding:12px;font-size:13px">${c.label}</button>
          `).join('')}
        </div>
        <div style="margin-top:8px;text-align:center">
          <button class="btn-secondary" onclick="window._libCat='all';Utils.closeModal()">不分类</button>
        </div>
      `);
      // 监听模态框关闭
      const check = setInterval(() => {
        const overlay = document.getElementById('modalOverlay');
        if (overlay.style.display === 'none') {
          clearInterval(check);
          resolve(window._libCat || 'all');
          window._libCat = null;
        }
      }, 100);
    });
  }

  _render() {
    const items = this._filter === 'all'
      ? this._items
      : this._items.filter(i => i.category === this._filter);

    this._grid.innerHTML = '';

    if (items.length === 0) {
      this._grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text-muted);font-size:12px">暂无素材，点击上方上传</div>`;
      return;
    }

    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'library-item';
      el.draggable = true;

      const catLabel = { character: '人物', scene: '场景', prop: '物品', style: '风格' };

      if (item.type === 'image') {
        el.innerHTML = `
          <img src="${item.src}" alt="${item.name}" loading="lazy">
          <div class="item-label">${item.name}</div>
          ${item.category !== 'all' ? `<div class="item-tag">${catLabel[item.category] || ''}</div>` : ''}
        `;
      } else {
        el.innerHTML = `
          <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px">🎬</div>
          <div class="item-label">${item.name}</div>
        `;
      }

      // 拖拽到画布
      el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('library-item-id', item.id);
        e.dataTransfer.setData('node-type', item.type === 'video' ? 'video' : 'image');
      });

      // 双击添加到画布中心
      el.addEventListener('dblclick', () => {
        const cx = (Canvas.wrapper.clientWidth  / 2 - Canvas.panX) / Canvas.scale;
        const cy = (Canvas.wrapper.clientHeight / 2 - Canvas.panY) / Canvas.scale;
        const node = App.createNode(item.type === 'video' ? 'video' : 'image', cx - 140, cy - 100);
        if (node && item.type === 'image') {
          node._src = item.src;
          node._filename = item.name;
          node._renderImage(item.src, item.name);
          node._infoEl.textContent = item.name;
        }
        Utils.toast('素材已添加到画布', 'success');
      });

      // 长按删除
      let pressTimer;
      el.addEventListener('mousedown', () => {
        pressTimer = setTimeout(() => {
          if (confirm(`删除素材 "${item.name}"？`)) {
            this._items = this._items.filter(i => i.id !== item.id);
            Utils.saveToStorage('library', this._items);
            this._render();
          }
        }, 800);
      });
      el.addEventListener('mouseup',    () => clearTimeout(pressTimer));
      el.addEventListener('mouseleave', () => clearTimeout(pressTimer));

      this._grid.appendChild(el);
    });
  }
}

window.Library = null;
// 延迟初始化（等DOM就绪）
document.addEventListener('DOMContentLoaded', () => {
  window.Library = new LibraryManager();
});
