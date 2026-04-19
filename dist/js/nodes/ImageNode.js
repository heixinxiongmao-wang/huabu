// ============================================================
// ImageNode.js — 图片节点（上传/预览/涂鸦/下载）
// ============================================================
class ImageNode extends BaseNode {
  constructor(x, y, id, data = {}) {
    super('image', x, y, id);
    this._src     = data.src || null;
    this._filename = data.filename || '';
    this._build();
  }

  _build() {
    const el = this._createWrapper('🖼️', '图片节点');
    const body = el.querySelector('.node-body');
    const inputId = 'img_input_' + this.id;

    body.innerHTML = `
      <input type="file" id="${inputId}" accept="image/*" style="display:none">
      <div class="image-upload-zone" id="imgZone_${this.id}">
        <div class="upload-icon">🖼️</div>
        <div class="upload-text">点击上传图片</div>
        <div class="image-upload-overlay">
          <button class="img-action-btn" data-act="change">更换图片</button>
          <button class="img-action-btn" data-act="doodle">涂鸦</button>
          <button class="img-action-btn" data-act="download">下载</button>
        </div>
      </div>
      <div class="image-meta" style="margin-top:8px">
        <span class="image-info" id="imgInfo_${this.id}">未上传</span>
        <div class="image-actions">
          <button class="node-btn" title="复制图片路径" data-act="copyPath">📋</button>
          <button class="node-btn" title="串线到视频节点" data-act="linkVideo">🎬</button>
        </div>
      </div>
    `;

    this._zone    = body.querySelector(`#imgZone_${this.id}`);
    this._infoEl  = body.querySelector(`#imgInfo_${this.id}`);
    this._fileInput = body.querySelector(`#${inputId}`);

    // 点击上传
    this._zone.addEventListener('click', e => {
      if (e.target.dataset.act) return;
      this._fileInput.click();
    });

    this._fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) this._loadFile(file);
    });

    // 覆盖层操作
    this._zone.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const act = btn.dataset.act;
        if (act === 'change')   this._fileInput.click();
        if (act === 'doodle')   this._openDoodleOnImage();
        if (act === 'download') this._downloadImage();
      });
    });

    body.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', e => {
        const act = btn.dataset.act;
        if (act === 'copyPath' && this._src) Utils.copy(this._src);
        if (act === 'linkVideo') Utils.toast('请在画布上将连接点拖拽至视频节点', 'info');
      });
    });

    // 拖放图片
    this._zone.addEventListener('dragover', e => { e.preventDefault(); this._zone.style.borderColor = 'var(--accent)'; });
    this._zone.addEventListener('dragleave', () => { this._zone.style.borderColor = ''; });
    this._zone.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      this._zone.style.borderColor = '';
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) this._loadFile(file);
    });

    // 恢复已有图片
    if (this._src) this._renderImage(this._src, this._filename);
  }

  async _loadFile(file) {
    this._filename = file.name;
    const src = await Utils.readFileAsDataURL(file);
    this._src = src;
    this._renderImage(src, file.name);
    this._infoEl.textContent = `${file.name} (${Utils.formatFileSize(file.size)})`;
    Canvas._saveState();
  }

  _renderImage(src, name) {
    // 清除旧内容但保留覆盖层
    const overlay = this._zone.querySelector('.image-upload-overlay');
    this._zone.querySelectorAll('.upload-icon,.upload-text,img').forEach(e => e.remove());
    const img = document.createElement('img');
    img.src = src;
    this._zone.insertBefore(img, overlay);
    this._infoEl.textContent = name || '已上传';
  }

  _downloadImage() {
    if (!this._src) { Utils.toast('请先上传图片', 'warning'); return; }
    Utils.download(this._src, this._filename || 'image.png');
  }

  _openDoodleOnImage() {
    if (!this._src) { Utils.toast('请先上传图片', 'warning'); return; }
    // 在模态框中打开涂鸦画板（叠加在图片上）
    const modalHtml = `
      <div style="position:relative;display:inline-block;width:100%">
        <img id="doodleBaseImg" src="${this._src}" style="width:100%;display:block;border-radius:8px">
        <canvas id="imgDoodleCanvas" style="position:absolute;top:0;left:0;width:100%;height:100%;cursor:crosshair"></canvas>
      </div>
      <div class="doodle-toolbar" style="margin-top:10px">
        <div class="doodle-tool-group">
          <button class="doodle-btn active" id="doodle_pencil" title="铅笔">✏️</button>
          <button class="doodle-btn" id="doodle_eraser" title="橡皮擦">🧹</button>
        </div>
        <div class="color-palette">
          ${['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ffffff','#000000']
            .map(c => `<div class="color-swatch" style="background:${c}" data-color="${c}" onclick="window._doodleSetColor('${c}')"></div>`)
            .join('')}
          <input type="color" class="color-picker" id="doodleColorPicker" value="#ef4444">
        </div>
        <input type="range" class="size-slider" id="doodleSizeSlider" min="1" max="40" value="4">
        <button class="doodle-btn" id="doodle_undo" title="撤销">↩️</button>
        <button class="doodle-btn" id="doodle_clear" title="清除">🗑️</button>
      </div>
    `;

    Utils.modal('图片涂鸦', modalHtml, [
      { label: '下载涂鸦图', type: 'primary', action: 'window._saveDoodleOnImage()' }
    ]);

    setTimeout(() => {
      const baseImg = document.getElementById('doodleBaseImg');
      const canvas  = document.getElementById('imgDoodleCanvas');
      const ctx     = canvas.getContext('2d');
      const history = [];

      const resizeCanvas = () => {
        canvas.width  = baseImg.naturalWidth  || baseImg.offsetWidth;
        canvas.height = baseImg.naturalHeight || baseImg.offsetHeight;
      };

      baseImg.onload = resizeCanvas;
      if (baseImg.complete) resizeCanvas();

      let painting = false, lastX = 0, lastY = 0;
      let color = '#ef4444', size = 4, isEraser = false;

      const getPos = e => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top)  * scaleY
        };
      };

      canvas.addEventListener('mousedown', e => {
        painting = true;
        const pos = getPos(e);
        lastX = pos.x; lastY = pos.y;
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      });
      canvas.addEventListener('mousemove', e => {
        if (!painting) return;
        const pos = getPos(e);
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastX = pos.x; lastY = pos.y;
      });
      canvas.addEventListener('mouseup',   () => { painting = false; });
      canvas.addEventListener('mouseleave',() => { painting = false; });

      document.getElementById('doodle_pencil').addEventListener('click', () => {
        isEraser = false;
        document.getElementById('doodle_pencil').classList.add('active');
        document.getElementById('doodle_eraser').classList.remove('active');
      });
      document.getElementById('doodle_eraser').addEventListener('click', () => {
        isEraser = true;
        document.getElementById('doodle_eraser').classList.add('active');
        document.getElementById('doodle_pencil').classList.remove('active');
      });
      document.getElementById('doodle_undo').addEventListener('click', () => {
        if (history.length > 0) ctx.putImageData(history.pop(), 0, 0);
      });
      document.getElementById('doodle_clear').addEventListener('click', () => {
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
      document.getElementById('doodleSizeSlider').addEventListener('input', e => { size = e.target.value; });
      document.getElementById('doodleColorPicker').addEventListener('input', e => { color = e.target.value; });

      window._doodleSetColor = (c) => {
        color = c; isEraser = false;
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === c));
      };

      window._saveDoodleOnImage = () => {
        // 合并图片和涂鸦
        const merged = document.createElement('canvas');
        merged.width  = canvas.width;
        merged.height = canvas.height;
        const mCtx = merged.getContext('2d');
        mCtx.drawImage(baseImg, 0, 0, merged.width, merged.height);
        mCtx.drawImage(canvas, 0, 0);
        Utils.downloadCanvas(merged, 'doodle_' + (this._filename || 'image.png'));
        Utils.toast('涂鸦图已下载', 'success');
      };
    }, 100);
  }

  serialize() {
    return { src: this._src, filename: this._filename };
  }
}
