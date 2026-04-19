// ============================================================
// BaseNode.js (内联于各节点文件) — 节点基类
// ============================================================
class BaseNode {
  constructor(type, x, y, id, options = {}) {
    this.id   = id || Utils.uid();
    this.type = type;
    this.x    = x;
    this.y    = y;
    this.el   = null;
    this._dragOffsetX = 0;
    this._dragOffsetY = 0;
    this._isDragging  = false;
  }

  _createWrapper(iconEmoji, title, extraClass = '') {
    const el = document.createElement('div');
    el.className = `canvas-node ${this.type}-node ${extraClass}`;
    el.dataset.id = this.id;
    el.style.left = this.x + 'px';
    el.style.top  = this.y + 'px';

    const titleInput = `<input type="text" value="${title}" spellcheck="false" />`;

    el.innerHTML = `
      <div class="node-header">
        <span class="node-icon">${iconEmoji}</span>
        <div class="node-title">${titleInput}</div>
        <div class="node-controls">
          <button class="node-btn" title="连接" data-action="connect">⊕</button>
          <button class="node-btn danger" title="删除" data-action="delete">✕</button>
        </div>
      </div>
      <div class="node-body"></div>
      <div class="node-port port-in"  data-node="${this.id}" data-side="in"></div>
      <div class="node-port port-out" data-node="${this.id}" data-side="out"></div>
    `;

    this.el = el;
    this._bindBaseEvents();
    return el;
  }

  _bindBaseEvents() {
    const header = this.el.querySelector('.node-header');

    // 节点拖拽
    header.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      e.stopPropagation();
      Canvas.selectNode(this.id, e.shiftKey);
      this._isDragging = true;
      const pos = Canvas.screenToCanvas(e.clientX, e.clientY);
      this._dragOffsetX = pos.x - parseFloat(this.el.style.left);
      this._dragOffsetY = pos.y - parseFloat(this.el.style.top);
      document.body.style.cursor = 'grabbing';

      const onMove = (e2) => {
        if (!this._isDragging) return;
        const p = Canvas.screenToCanvas(e2.clientX, e2.clientY);
        this.el.style.left = (p.x - this._dragOffsetX) + 'px';
        this.el.style.top  = (p.y - this._dragOffsetY) + 'px';
        Connections.redrawAll();
      };
      const onUp = () => {
        this._isDragging = false;
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        Canvas._saveState();
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    // 点击选中
    this.el.addEventListener('mousedown', e => {
      if (e.button === 0 && !this._isDragging) {
        Canvas.selectNode(this.id, e.shiftKey);
      }
    });

    // 删除按钮
    this.el.querySelector('[data-action="delete"]').addEventListener('click', () => {
      Connections.removeNodeConnections(this.id);
      this.el.remove();
      Canvas.nodes.delete(this.id);
      Canvas._saveState();
    });

    // 连接点 - 出口
    const portOut = this.el.querySelector('.port-out');
    portOut.addEventListener('mousedown', e => {
      e.stopPropagation();
      Connections.startDrawing(this.id, 'out', e.clientX, e.clientY);
    });
  }

  mount() {
    document.getElementById('canvasNodes').appendChild(this.el);
    Canvas.registerNode(this.id, this);
  }

  serialize() { return {}; }
}
