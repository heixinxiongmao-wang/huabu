// ============================================================
// DoodleNode.js — 涂鸦节点（类Windows画图，支持多工具）
// ============================================================
class DoodleNode extends BaseNode {
  constructor(x, y, id, data = {}) {
    super('doodle', x, y, id);
    this._savedImage = data.savedImage || null;
    this._build();
  }

  _build() {
    const el = this._createWrapper('✏️', '涂鸦节点');
    const body = el.querySelector('.node-body');

    body.innerHTML = `
      <div class="doodle-toolbar">
        <div class="doodle-tool-group">
          <button class="doodle-btn active" data-tool="pencil" title="铅笔 (P)">✏️</button>
          <button class="doodle-btn" data-tool="brush" title="画刷 (B)">🖌️</button>
          <button class="doodle-btn" data-tool="line" title="直线 (L)">╲</button>
          <button class="doodle-btn" data-tool="rect" title="矩形 (R)">□</button>
          <button class="doodle-btn" data-tool="circle" title="圆形 (C)">○</button>
          <button class="doodle-btn" data-tool="text" title="文字 (T)">T</button>
          <button class="doodle-btn" data-tool="eraser" title="橡皮 (E)">🧹</button>
          <button class="doodle-btn" data-tool="fill" title="填充 (F)">🪣</button>
        </div>
        <div class="color-palette">
          ${['#000000','#ffffff','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899']
            .map((c,i) => `<div class="color-swatch${i===0?' active':''}" style="background:${c}" data-color="${c}"></div>`)
            .join('')}
          <input type="color" class="color-picker" value="#000000" title="自定义颜色">
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <span style="font-size:10px;color:var(--text-muted)">粗细</span>
          <input type="range" class="size-slider" min="1" max="40" value="3">
          <span class="size-label" style="font-size:10px;color:var(--text-muted);min-width:20px">3</span>
        </div>
      </div>
      <div class="doodle-canvas-wrap" style="width:100%">
        <canvas class="doodle-canvas" id="doodleCanvas_${this.id}" width="320" height="240"></canvas>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="doodle-btn" id="doodle_undo_${this.id}" title="撤销">↩</button>
        <button class="doodle-btn" id="doodle_redo_${this.id}" title="重做">↪</button>
        <button class="doodle-btn" id="doodle_clear_${this.id}" title="清空">🗑️</button>
        <button class="doodle-btn" id="doodle_bg_${this.id}" title="切换背景" style="font-size:10px;width:auto;padding:0 8px">背景</button>
        <button class="doodle-btn" id="doodle_dl_${this.id}" title="下载" style="margin-left:auto">⬇️</button>
      </div>
    `;

    const canvas = body.querySelector(`#doodleCanvas_${this.id}`);
    const ctx    = canvas.getContext('2d');
    this._canvas = canvas;
    this._ctx    = ctx;

    // 状态
    let tool = 'pencil', color = '#000000', size = 3;
    let bgColor = '#ffffff';
    let painting = false, lastX = 0, lastY = 0;
    let startX = 0, startY = 0;
    let history = [], redoStack = [];
    let snapshot = null;

    // 初始化背景
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (this._savedImage) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = this._savedImage;
    }

    const pushHistory = () => {
      history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (history.length > 50) history.shift();
      redoStack = [];
    };

    const getPos = e => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top)  * scaleY
      };
    };

    // 绘制函数
    const drawShape = (ex, ey) => {
      if (['line','rect','circle'].includes(tool) && snapshot) {
        ctx.putImageData(snapshot, 0, 0);
      }
      ctx.strokeStyle = color;
      ctx.fillStyle   = color;
      ctx.lineWidth   = size;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';

      if (tool === 'pencil' || tool === 'brush') {
        ctx.globalAlpha = tool === 'brush' ? 0.6 : 1;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.globalAlpha = 1;
        lastX = ex; lastY = ey;
      } else if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(ex, ey);
        ctx.lineWidth = size * 2;
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        lastX = ex; lastY = ey;
      } else if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      } else if (tool === 'rect') {
        ctx.beginPath();
        ctx.strokeRect(startX, startY, ex - startX, ey - startY);
      } else if (tool === 'circle') {
        ctx.beginPath();
        const rx = (ex - startX) / 2, ry = (ey - startY) / 2;
        ctx.ellipse(startX + rx, startY + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    canvas.addEventListener('mousedown', e => {
      if (tool === 'text') {
        const pos = getPos(e);
        const text = prompt('输入文字：');
        if (text) {
          pushHistory();
          ctx.fillStyle = color;
          ctx.font = `${size * 4 + 8}px PingFang SC, sans-serif`;
          ctx.fillText(text, pos.x, pos.y);
          this._savedImage = canvas.toDataURL();
          Canvas._saveState();
        }
        return;
      }
      if (tool === 'fill') {
        const pos = getPos(e);
        pushHistory();
        // 简单桶填充（填满整个画布为指定颜色，近似实现）
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
      }

      e.stopPropagation();
      painting = true;
      const pos = getPos(e);
      lastX = startX = pos.x;
      lastY = startY = pos.y;
      pushHistory();
      if (['line','rect','circle'].includes(tool)) {
        snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
    });

    canvas.addEventListener('mousemove', e => {
      if (!painting) return;
      const pos = getPos(e);
      drawShape(pos.x, pos.y);
    });

    const stopPainting = () => {
      if (painting) {
        painting = false;
        this._savedImage = canvas.toDataURL();
        Canvas._saveState();
      }
    };
    canvas.addEventListener('mouseup',    stopPainting);
    canvas.addEventListener('mouseleave', stopPainting);

    // 工具切换
    body.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        body.querySelectorAll('.doodle-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        tool = btn.dataset.tool;
        canvas.style.cursor = tool === 'eraser' ? 'cell' : tool === 'fill' ? 'crosshair' : 'crosshair';
      });
    });

    // 颜色选择
    body.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        body.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        color = sw.dataset.color;
      });
    });
    body.querySelector('.color-picker').addEventListener('input', e => { color = e.target.value; });

    // 大小滑块
    const sizeSlider = body.querySelector('.size-slider');
    const sizeLabel  = body.querySelector('.size-label');
    sizeSlider.addEventListener('input', e => {
      size = parseInt(e.target.value);
      sizeLabel.textContent = size;
    });

    // 撤销/重做/清空/下载/背景
    body.querySelector(`#doodle_undo_${this.id}`).addEventListener('click', () => {
      if (history.length > 0) {
        redoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        ctx.putImageData(history.pop(), 0, 0);
        this._savedImage = canvas.toDataURL();
      }
    });
    body.querySelector(`#doodle_redo_${this.id}`).addEventListener('click', () => {
      if (redoStack.length > 0) {
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        ctx.putImageData(redoStack.pop(), 0, 0);
        this._savedImage = canvas.toDataURL();
      }
    });
    body.querySelector(`#doodle_clear_${this.id}`).addEventListener('click', () => {
      pushHistory();
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      this._savedImage = canvas.toDataURL();
      Canvas._saveState();
    });
    body.querySelector(`#doodle_bg_${this.id}`).addEventListener('click', () => {
      bgColor = bgColor === '#ffffff' ? '#000000' : bgColor === '#000000' ? '#1e1e2a' : '#ffffff';
      pushHistory();
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
    body.querySelector(`#doodle_dl_${this.id}`).addEventListener('click', () => {
      Utils.downloadCanvas(canvas, 'doodle_' + this.id + '.png');
      Utils.toast('涂鸦已下载', 'success');
    });
  }

  serialize() {
    return { savedImage: this._savedImage };
  }
}
