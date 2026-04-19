// ============================================================
// canvas.js — 无限画布引擎 v2（左键长按空白区域平移 + 中键平移）
// ============================================================

class InfiniteCanvas {
  constructor() {
    this.wrapper    = document.getElementById('canvasWrapper');
    this.nodesEl    = document.getElementById('canvasNodes');
    this.svgLayer   = document.getElementById('connectionsLayer');

    this.scale      = 1;
    this.minScale   = 0.08;
    this.maxScale   = 4;
    this.panX       = 0;
    this.panY       = 0;

    this.isPanning  = false;
    this.panStart   = { x: 0, y: 0 };
    this.currentTool= 'select';

    // 长按平移支持
    this._panPending   = false;   // 正在等待长按触发
    this._panTimer     = null;    // 长按定时器
    this._LONG_PRESS_MS = 180;    // 长按阈值(ms) — 低于此值视为普通点击

    this.selectedNodes = new Set();
    this.nodes         = new Map(); // id => NodeInstance

    this._initEvents();
  }

  // ---- 坐标变换 ----
  _applyTransform() {
    const t = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    this.nodesEl.style.transform  = t;
    this.svgLayer.style.transform = t;
    const label = document.getElementById('zoomLabel');
    if (label) label.textContent = Math.round(this.scale * 100) + '%';
  }

  screenToCanvas(sx, sy) {
    const rect = this.wrapper.getBoundingClientRect();
    return {
      x: (sx - rect.left - this.panX) / this.scale,
      y: (sy - rect.top  - this.panY) / this.scale
    };
  }

  canvasToScreen(cx, cy) {
    const rect = this.wrapper.getBoundingClientRect();
    return {
      x: cx * this.scale + this.panX + rect.left,
      y: cy * this.scale + this.panY + rect.top
    };
  }

  // ---- 缩放 ----
  zoomAt(cx, cy, delta) {
    const factor = delta > 0 ? 1.1 : 0.91;
    const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor));
    if (newScale === this.scale) return;
    const rect = this.wrapper.getBoundingClientRect();
    const ox = cx - rect.left;
    const oy = cy - rect.top;
    this.panX = ox - (ox - this.panX) * (newScale / this.scale);
    this.panY = oy - (oy - this.panY) * (newScale / this.scale);
    this.scale = newScale;
    this._applyTransform();
    window.Connections && Connections.redrawAll();
  }

  zoomIn()  { this.zoomAt(this.wrapper.clientWidth/2, this.wrapper.clientHeight/2, 1); }
  zoomOut() { this.zoomAt(this.wrapper.clientWidth/2, this.wrapper.clientHeight/2, -1); }

  fitView() {
    if (this.nodes.size === 0) {
      this.scale = 1; this.panX = 0; this.panY = 0;
      this._applyTransform(); return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.nodes.forEach(n => {
      const el = n.el;
      const x = parseFloat(el.style.left || 0);
      const y = parseFloat(el.style.top  || 0);
      const w = el.offsetWidth  || 280;
      const h = el.offsetHeight || 200;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
    });
    const padding = 80;
    const vw = this.wrapper.clientWidth  - padding * 2;
    const vh = this.wrapper.clientHeight - padding * 2;
    const cw = maxX - minX, ch = maxY - minY;
    this.scale = Math.max(0.2, Math.min(1.5, Math.min(vw / (cw || 1), vh / (ch || 1))));
    this.panX = padding - minX * this.scale;
    this.panY = padding - minY * this.scale;
    this._applyTransform();
    window.Connections && Connections.redrawAll();
  }

  // ---- 判断点击目标是否为"空白画布区域" ----
  _isCanvasBg(target) {
    return target === this.wrapper ||
           target === this.nodesEl ||
           target === this.svgLayer;
  }

  // ---- 开始平移 ----
  _startPan(clientX, clientY) {
    this.isPanning = true;
    this.panStart  = { x: clientX - this.panX, y: clientY - this.panY };
    this.wrapper.classList.add('grabbing');
    this.wrapper.style.cursor = 'grabbing';
  }

  _stopPan() {
    if (!this.isPanning) return;
    this.isPanning = false;
    this.wrapper.classList.remove('grabbing');
    this.wrapper.style.cursor = this.currentTool === 'hand' ? 'grab' : 'default';
  }

  // ---- 事件绑定 ----
  _initEvents() {
    const w = this.wrapper;

    // ── 滚轮缩放 ──
    w.addEventListener('wheel', e => {
      e.preventDefault();
      this.zoomAt(e.clientX, e.clientY, -e.deltaY);
    }, { passive: false });

    // ── 鼠标按下 ──
    w.addEventListener('mousedown', e => {
      // 中键：直接平移
      if (e.button === 1) {
        e.preventDefault();
        this._startPan(e.clientX, e.clientY);
        return;
      }

      // 手型工具：左键直接平移
      if (e.button === 0 && this.currentTool === 'hand') {
        e.preventDefault();
        this._startPan(e.clientX, e.clientY);
        return;
      }

      // 左键 + 点击空白画布区域：长按延迟触发平移
      if (e.button === 0 && this._isCanvasBg(e.target)) {
        this.clearSelection();

        this._panPending = true;
        const downX = e.clientX, downY = e.clientY;

        // 清除旧定时器
        if (this._panTimer) clearTimeout(this._panTimer);

        this._panTimer = setTimeout(() => {
          if (this._panPending) {
            this._panPending = false;
            this._startPan(downX, downY);
            // 补偿：mousedown 到现在光标可能已移动，重新对齐 panStart
            // panStart 将在下一个 mousemove 中自然更新（因为 panStart 基于当前位置）
          }
        }, this._LONG_PRESS_MS);
      }
    });

    // ── 鼠标移动 ──
    window.addEventListener('mousemove', e => {
      if (this.isPanning) {
        this.panX = e.clientX - this.panStart.x;
        this.panY = e.clientY - this.panStart.y;
        this._applyTransform();
        window.Connections && Connections.redrawAll();
        return;
      }

      // 如果正在等待长按，鼠标大幅移动则取消（说明是误触）
      if (this._panPending) {
        // 允许 5px 内的抖动
        const dx = e.clientX - (this.panStart.x || e.clientX);
        const dy = e.clientY - (this.panStart.y || e.clientY);
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          this._panPending = false;
          if (this._panTimer) { clearTimeout(this._panTimer); this._panTimer = null; }
        }
      }
    });

    // ── 鼠标抬起 ──
    window.addEventListener('mouseup', () => {
      // 清除长按计时
      this._panPending = false;
      if (this._panTimer) { clearTimeout(this._panTimer); this._panTimer = null; }
      this._stopPan();
    });

    // 右键菜单（画布空白区域 + 节点上都能触发）
    w.addEventListener('contextmenu', e => {
      e.preventDefault();
      // 记录鼠标位置
      if (window.App) {
        window.App._lastCtxX = e.clientX;
        window.App._lastCtxY = e.clientY;
      }
      window.App && App.showContextMenu(e.clientX, e.clientY);
    }, true); // 捕获阶段，确保子元素也能触发

    // 防止侧边栏触发浏览器右键菜单
    document.getElementById('sidebar')?.addEventListener('contextmenu', e => e.preventDefault());

    // 拖放节点类型到画布
    w.addEventListener('dragover', e => e.preventDefault());
    w.addEventListener('drop', e => {
      e.preventDefault();
      const type = e.dataTransfer.getData('node-type');
      if (type) {
        const pos = this.screenToCanvas(e.clientX, e.clientY);
        window.App && App.createNode(type, pos.x, pos.y);
      }
    });

    // 工具栏按钮
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTool = btn.dataset.tool;
        this.wrapper.style.cursor = this.currentTool === 'hand' ? 'grab' : 'default';
      });
    });

    // 缩放按钮
    document.getElementById('zoomIn')?.addEventListener('click',  () => this.zoomIn());
    document.getElementById('zoomOut')?.addEventListener('click', () => this.zoomOut());
    document.getElementById('zoomFit')?.addEventListener('click', () => this.fitView());

    // 键盘快捷键
    window.addEventListener('keydown', e => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement.tagName !== 'INPUT' &&
            document.activeElement.tagName !== 'TEXTAREA') {
          this.deleteSelected();
        }
      }
      if (e.key === 'h') document.querySelector('[data-tool="hand"]')?.click();
      if (e.key === 'v' || e.key === 'Escape') document.querySelector('[data-tool="select"]')?.click();
      // 空格键按下临时切换手型
      if (e.key === ' ' && !e.repeat) {
        this._spaceHeld = true;
        if (this.currentTool !== 'hand') {
          this.wrapper.style.cursor = 'grab';
          this._spacePrevTool = this.currentTool;
        }
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', e => {
      if (e.key === ' ') {
        this._spaceHeld = false;
        if (this._spacePrevTool) {
          this.wrapper.style.cursor = 'default';
          this._spacePrevTool = null;
        }
      }
    });

    // 空格键临时平移
    w.addEventListener('mousedown', e => {
      if (e.button === 0 && this._spaceHeld) {
        e.preventDefault();
        this._startPan(e.clientX, e.clientY);
      }
    });

    // 隐藏右键菜单
    window.addEventListener('mousedown', e => {
      const cm = document.getElementById('contextMenu');
      if (cm && !cm.contains(e.target)) cm.classList.remove('visible');
      // 清除长按平移状态，防止右键菜单关闭后卡住
      this._panPending = false;
      if (this._panTimer) { clearTimeout(this._panTimer); this._panTimer = null; }
    });
  }

  // ---- 选择管理 ----
  selectNode(id, multi = false) {
    if (!multi) this.clearSelection();
    this.selectedNodes.add(id);
    const n = this.nodes.get(id);
    if (n) n.el.classList.add('selected');
  }

  clearSelection() {
    this.selectedNodes.forEach(id => {
      const n = this.nodes.get(id);
      if (n) n.el.classList.remove('selected');
    });
    this.selectedNodes.clear();
  }

  deleteSelected() {
    this.selectedNodes.forEach(id => {
      window.Connections && Connections.removeNodeConnections(id);
      const n = this.nodes.get(id);
      if (n) { n.el.remove(); this.nodes.delete(id); }
    });
    this.selectedNodes.clear();
    this._saveState();
  }

  // ---- 节点注册 ----
  registerNode(id, instance) {
    this.nodes.set(id, instance);
  }

  // ---- 持久化 ----
  _saveState() {
    const state = [];
    this.nodes.forEach((n, id) => {
      state.push({
        id,
        type: n.type,
        x: parseFloat(n.el.style.left),
        y: parseFloat(n.el.style.top),
        data: n.serialize ? n.serialize() : {}
      });
    });
    Utils.saveToStorage('canvas', { nodes: state, panX: this.panX, panY: this.panY, scale: this.scale });
  }

  saveState() { this._saveState(); Utils.toast('画布状态已保存', 'success'); }

  loadState() {
    const saved = Utils.loadFromStorage('canvas');
    if (!saved) { Utils.toast('没有找到已保存的状态', 'warning'); return; }
    this.nodes.forEach(n => n.el.remove());
    this.nodes.clear();
    window.Connections && Connections.clear();
    this.panX = saved.panX || 0;
    this.panY = saved.panY || 0;
    this.scale = saved.scale || 1;
    this._applyTransform();
    saved.nodes.forEach(s => {
      window.App && App.createNode(s.type, s.x, s.y, s.id, s.data);
    });
    Utils.toast('画布状态已载入', 'success');
  }

  clearCanvas() {
    if (!confirm('确定要清空画布吗？此操作无法撤销。')) return;
    this.nodes.forEach(n => n.el.remove());
    this.nodes.clear();
    window.Connections && Connections.clear();
    Utils.toast('画布已清空', 'info');
  }
}

window.Canvas = new InfiniteCanvas();
