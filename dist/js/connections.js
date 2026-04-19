// ============================================================
// connections.js — 节点串线系统 v2（精准坐标 + 方向感知贝塞尔）
// ============================================================

class ConnectionManager {
  constructor() {
    this.svg      = document.getElementById('connectionsLayer');
    this.lines    = new Map();  // id => { from, to, fromSide, toSide, el, color }
    this._nextId  = 1;

    // 临时连线状态
    this._drawing   = false;
    this._fromNode  = null;
    this._fromSide  = 'out';
    this._fromPos   = { x: 0, y: 0 }; // 画布坐标
    this._tempLine  = null;
    this._mouseCanvas = { x: 0, y: 0 };

    this._hoveredPort = null; // 当前悬停的目标端口

    this._initGlobalEvents();
  }

  // ---- 连线颜色 ----
  _getLineColor(fromType) {
    const palette = {
      text:    '#7c6af7',
      image:   '#60a5fa',
      video:   '#f472b6',
      pose:    '#4ade80',
      gallery: '#fbbf24',
      doodle:  '#fb923c',
    };
    return palette[fromType] || '#a78bfa';
  }

  // ---- 获取端口的精准画布坐标 ----
  _getPortCanvasPos(nodeId, side) {
    const node = Canvas.nodes.get(nodeId);
    if (!node) return null;
    
    // 直接获取端口元素位置，而不是使用节点边界
    const portClass = side === 'out' ? '.port-out' : '.port-in';
    const port = node.el.querySelector(portClass);
    if (!port) return null;
    
    const portRect = port.getBoundingClientRect();
    const wRect = Canvas.wrapper.getBoundingClientRect();
    
    return {
      x: (portRect.left + portRect.width / 2 - wRect.left - Canvas.panX) / Canvas.scale,
      y: (portRect.top + portRect.height / 2 - wRect.top - Canvas.panY) / Canvas.scale
    };
  }

  // ---- 添加连线 ----
  addConnection(fromNodeId, toNodeId, fromSide = 'out', toSide = 'in') {
    if (fromNodeId === toNodeId) return null;
    // 允许同方向多条线（不再去重同 from→to）
    const id = 'c_' + (this._nextId++);
    const fromNode = Canvas.nodes.get(fromNodeId);
    if (!fromNode) return null;

    const color = this._getLineColor(fromNode.type);
    const el = this._createPathEl(id, color);
    // el 是 { g, path, hitPath }，g 已在 _createPathEl 内 appendChild 到 svg

    const conn = { id, from: fromNodeId, to: toNodeId, fromSide, toSide, el, color };
    this.lines.set(id, conn);
    this._updatePath(conn);
    return id;
  }

  _createPathEl(id, color) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', id + '_g');

    // 宽透明描边用于点击命中
    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('id', id + '_hit');
    hitPath.setAttribute('stroke', 'transparent');
    hitPath.setAttribute('stroke-width', '18');
    hitPath.setAttribute('fill', 'none');
    hitPath.style.cursor = 'pointer';

    // 可见线
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('id', id);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrowhead)');
    path.setAttribute('opacity', '0.85');
    path.style.pointerEvents = 'none';
    path.style.transition = 'stroke 0.15s, stroke-width 0.15s';

    g.appendChild(hitPath);
    g.appendChild(path);

    // 悬停高亮
    hitPath.addEventListener('mouseenter', () => {
      path.setAttribute('stroke-width', '3.5');
      path.setAttribute('opacity', '1');
    });
    hitPath.addEventListener('mouseleave', () => {
      path.setAttribute('stroke-width', '2');
      path.setAttribute('opacity', '0.85');
    });

    // 点击删除
    hitPath.addEventListener('click', (e) => {
      e.stopPropagation();
      this._removeLine(id);
    });

    this.svg.appendChild(g);
    return { g, path, hitPath }; // 返回对象
  }

  _removeLine(id) {
    const c = this.lines.get(id);
    if (c) {
      c.el.g.remove();
      this.lines.delete(id);
    }
  }

  // ---- 方向感知贝塞尔路径 ----
  _buildPath(fx, fy, tx, ty) {
    const dx = tx - fx;
    const dy = ty - fy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // 控制点强度：随距离变化，最小60，最大距离的55%
    const tension = Math.max(60, Math.min(dist * 0.55, 280));

    // 出口向右展开，入口向左接入
    const c1x = fx + tension;
    const c1y = fy;
    const c2x = tx - tension;
    const c2y = ty;

    return `M ${fx.toFixed(1)} ${fy.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)}`;
  }

  // ---- 更新单条连线路径 ----
  _updatePath(conn) {
    const from = this._getPortCanvasPos(conn.from, conn.fromSide || 'out');
    const to   = this._getPortCanvasPos(conn.to,   conn.toSide   || 'in');
    if (!from || !to) return;

    const d = this._buildPath(from.x, from.y, to.x, to.y);
    conn.el.path.setAttribute('d', d);
    conn.el.hitPath.setAttribute('d', d);
  }

  // ---- 重绘所有连线 ----
  redrawAll() {
    this.lines.forEach(conn => this._updatePath(conn));
    if (this._drawing && this._tempLine) {
      this._updateTempLine(this._mouseCanvas);
    }
  }

  removeNodeConnections(nodeId) {
    const toRemove = [];
    this.lines.forEach((c, id) => {
      if (c.from === nodeId || c.to === nodeId) toRemove.push(id);
    });
    toRemove.forEach(id => this._removeLine(id));
  }

  clear() {
    this.lines.forEach(c => c.el.g.remove());
    this.lines.clear();
    if (this._tempLine) { this._tempLine.remove(); this._tempLine = null; }
  }

  // ---- 临时连线绘制 ----
  startDrawing(nodeId, side, startClientX, startClientY) {
    this._drawing  = true;
    this._fromNode = nodeId;
    this._fromSide = side;

    // 精准获取出口画布坐标
    this._fromPos = this._getPortCanvasPos(nodeId, side) ||
                    Canvas.screenToCanvas(startClientX, startClientY);

    this._tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this._tempLine.setAttribute('class', 'connection-temp');
    this._tempLine.setAttribute('stroke', '#a78bfa');
    this._tempLine.setAttribute('stroke-width', '2');
    this._tempLine.setAttribute('fill', 'none');
    this._tempLine.setAttribute('stroke-dasharray', '7 4');
    this._tempLine.setAttribute('opacity', '0.9');
    this.svg.appendChild(this._tempLine);

    this._mouseCanvas = Canvas.screenToCanvas(startClientX, startClientY);
    this._updateTempLine(this._mouseCanvas);
  }

  _updateTempLine(canvasPos) {
    if (!this._tempLine) return;
    const fp = this._fromPos;
    const d = this._buildPath(fp.x, fp.y, canvasPos.x, canvasPos.y);
    this._tempLine.setAttribute('d', d);
  }

  endDrawing(clientX, clientY) {
    if (!this._drawing) return;
    this._drawing = false;
    if (this._tempLine) { this._tempLine.remove(); this._tempLine = null; }

    // ---- 精准命中检测：扩大搜索范围 ----
    const HIT_RADIUS = 28; // px，屏幕坐标
    let bestNode = null;
    let bestDist = HIT_RADIUS;

    // 遍历所有节点，找最近的 port-in
    Canvas.nodes.forEach((node, nodeId) => {
      if (nodeId === this._fromNode) return;
      const ports = node.el.querySelectorAll('.node-port.port-in');
      ports.forEach(port => {
        const rect = port.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top  + rect.height / 2;
        const dist = Math.sqrt((clientX - cx) ** 2 + (clientY - cy) ** 2);
        if (dist < bestDist) {
          bestDist = dist;
          bestNode = nodeId;
        }
      });
    });

    // 若没有精准命中，fallback: elementsFromPoint
    if (!bestNode) {
      const els = document.elementsFromPoint(clientX, clientY);
      for (const el of els) {
        if (el.classList.contains('node-port') && el.classList.contains('port-in')) {
          const targetNodeEl = el.closest('.canvas-node');
          if (targetNodeEl && targetNodeEl.dataset.id !== this._fromNode) {
            bestNode = targetNodeEl.dataset.id;
            break;
          }
        }
        // 落在节点 body 上也可连接
        if (el.classList.contains('canvas-node') && el.dataset.id !== this._fromNode) {
          bestNode = el.dataset.id;
          break;
        }
      }
    }

    if (bestNode) {
      this.addConnection(this._fromNode, bestNode, this._fromSide, 'in');
    }

    this._fromNode = null;
  }

  _initGlobalEvents() {
    window.addEventListener('mousemove', e => {
      if (this._drawing) {
        this._mouseCanvas = Canvas.screenToCanvas(e.clientX, e.clientY);
        this._updateTempLine(this._mouseCanvas);

        // 高亮可连接的端口
        const els = document.elementsFromPoint(e.clientX, e.clientY);
        let found = null;
        for (const el of els) {
          if (el.classList.contains('node-port') && el.classList.contains('port-in')) {
            found = el;
            break;
          }
        }
        if (this._hoveredPort && this._hoveredPort !== found) {
          this._hoveredPort.classList.remove('port-hover');
        }
        if (found) {
          found.classList.add('port-hover');
          this._hoveredPort = found;
        } else {
          this._hoveredPort = null;
        }
      }
    });

    window.addEventListener('mouseup', e => {
      if (this._drawing) {
        if (this._hoveredPort) {
          this._hoveredPort.classList.remove('port-hover');
          this._hoveredPort = null;
        }
        this.endDrawing(e.clientX, e.clientY);
      }
    });
  }
}

window.Connections = new ConnectionManager();
