// ============================================================
// GalleryNode.js — 图集节点（最多12宫格）
// ============================================================
class GalleryNode extends BaseNode {
  constructor(x, y, id, data = {}) {
    super('gallery', x, y, id);
    this._cols   = data.cols || 3;
    this._images = data.images || [];
    this._maxCount = 12;
    this._build();
  }

  _build() {
    const el = this._createWrapper('📷', '图集节点');
    const body = el.querySelector('.node-body');

    body.innerHTML = `
      <div class="gallery-header-ctrl">
        <span style="font-size:11px;color:var(--text-muted)">宫格数：</span>
        <div class="gallery-grid-ctrl">
          <button class="grid-opt ${this._cols===2?'active':''}" data-cols="2">4格</button>
          <button class="grid-opt ${this._cols===3?'active':''}" data-cols="3">9格</button>
          <button class="grid-opt ${this._cols===4?'active':''}" data-cols="4">12格</button>
        </div>
        <button class="node-btn" id="galleryLinkVideo_${this.id}" title="串线到视频节点" style="margin-left:auto">🎬串线</button>
      </div>
      <div class="gallery-grid-wrap g${this._cols}" id="galleryGrid_${this.id}"></div>
    `;

    this._gridEl = body.querySelector(`#galleryGrid_${this.id}`);

    body.querySelectorAll('.grid-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        body.querySelectorAll('.grid-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._cols = parseInt(btn.dataset.cols);
        this._gridEl.className = `gallery-grid-wrap g${this._cols}`;
        this._renderGrid();
        Canvas._saveState();
      });
    });

    body.querySelector(`#galleryLinkVideo_${this.id}`).addEventListener('click', () => {
      Utils.toast('请将右侧连接点拖拽至视频节点入口', 'info');
    });

    this._renderGrid();
  }

  _renderGrid() {
    this._gridEl.innerHTML = '';
    const total = this._cols * this._cols;
    for (let i = 0; i < total; i++) {
      const cell = document.createElement('div');
      cell.className = 'gallery-cell';
      cell.dataset.index = i;

      if (this._images[i]) {
        cell.innerHTML = `
          <img src="${this._images[i].src}" alt="">
          <button class="cell-remove" data-index="${i}">✕</button>
        `;
        cell.querySelector('.cell-remove').addEventListener('click', e => {
          e.stopPropagation();
          this._images[parseInt(e.currentTarget.dataset.index)] = null;
          this._renderGrid();
          Canvas._saveState();
        });
      } else if (i === this._images.filter(Boolean).length) {
        cell.innerHTML = `<div class="cell-add">+</div>`;
        cell.addEventListener('click', () => this._uploadCell(i));
        cell.addEventListener('dragover', e => { e.preventDefault(); cell.style.borderColor = 'var(--accent)'; });
        cell.addEventListener('dragleave', () => { cell.style.borderColor = ''; });
        cell.addEventListener('drop', e => {
          e.preventDefault(); e.stopPropagation();
          cell.style.borderColor = '';
          const file = e.dataTransfer.files[0];
          if (file && file.type.startsWith('image/')) this._loadFileToCell(file, i);
        });
      } else {
        cell.innerHTML = `<div class="cell-add" style="opacity:0.2">·</div>`;
      }

      this._gridEl.appendChild(cell);
    }
  }

  _uploadCell(index) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => {
      const file = e.target.files[0];
      if (file) this._loadFileToCell(file, index);
    };
    input.click();
  }

  async _loadFileToCell(file, index) {
    const src = await Utils.readFileAsDataURL(file);
    if (!this._images[index]) {
      this._images[index] = { src, name: file.name };
    } else {
      this._images[index] = { src, name: file.name };
    }
    this._renderGrid();
    Canvas._saveState();
  }

  serialize() {
    return { cols: this._cols, images: this._images };
  }
}
