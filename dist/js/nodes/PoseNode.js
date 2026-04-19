// ============================================================
// PoseNode.js v2 — 姿势节点（单人调整 + 火柴人矩阵）
// ≤5人：显示骨骼画布，可单独拖拽调整肢体
// 6~9人：普通网格排列，展示矩阵
// ≥10人：军阵排列，支持快速批量复制
// ============================================================

const SKELETON_JOINTS = {
  head:       { x: 0.5,  y: 0.08 },
  neck:       { x: 0.5,  y: 0.18 },
  lshoulder:  { x: 0.35, y: 0.28 },
  rshoulder:  { x: 0.65, y: 0.28 },
  lelbow:     { x: 0.25, y: 0.42 },
  relbow:     { x: 0.75, y: 0.42 },
  lwrist:     { x: 0.18, y: 0.55 },
  rwrist:     { x: 0.82, y: 0.55 },
  lhip:       { x: 0.42, y: 0.52 },
  rhip:       { x: 0.58, y: 0.52 },
  lknee:      { x: 0.38, y: 0.70 },
  rknee:      { x: 0.62, y: 0.70 },
  lankle:     { x: 0.37, y: 0.88 },
  rankle:     { x: 0.63, y: 0.88 },
};

const SKELETON_BONES = [
  ['head','neck'],
  ['neck','lshoulder'],['neck','rshoulder'],
  ['lshoulder','lelbow'],['lelbow','lwrist'],
  ['rshoulder','relbow'],['relbow','rwrist'],
  ['neck','lhip'],['neck','rhip'],
  ['lhip','rhip'],
  ['lhip','lknee'],['lknee','lankle'],
  ['rhip','rknee'],['rknee','rankle'],
];

const POSE_PRESETS = {
  stand: null, // reset
  walk: {
    head:{x:.5,y:.08},neck:{x:.5,y:.18},lshoulder:{x:.35,y:.28},rshoulder:{x:.65,y:.28},
    lelbow:{x:.22,y:.38},relbow:{x:.72,y:.42},lwrist:{x:.15,y:.50},rwrist:{x:.85,y:.52},
    lhip:{x:.42,y:.52},rhip:{x:.58,y:.52},lknee:{x:.35,y:.70},rknee:{x:.62,y:.68},
    lankle:{x:.30,y:.88},rankle:{x:.65,y:.88}
  },
  run: {
    head:{x:.52,y:.07},neck:{x:.52,y:.17},lshoulder:{x:.38,y:.26},rshoulder:{x:.65,y:.26},
    lelbow:{x:.20,y:.35},relbow:{x:.75,y:.38},lwrist:{x:.12,y:.45},rwrist:{x:.88,y:.48},
    lhip:{x:.42,y:.50},rhip:{x:.60,y:.50},lknee:{x:.28,y:.63},rknee:{x:.72,y:.65},
    lankle:{x:.20,y:.82},rankle:{x:.78,y:.80}
  },
  sit: {
    head:{x:.5,y:.08},neck:{x:.5,y:.18},lshoulder:{x:.35,y:.28},rshoulder:{x:.65,y:.28},
    lelbow:{x:.28,y:.44},relbow:{x:.72,y:.44},lwrist:{x:.30,y:.58},rwrist:{x:.70,y:.58},
    lhip:{x:.40,y:.55},rhip:{x:.60,y:.55},lknee:{x:.28,y:.62},rknee:{x:.72,y:.62},
    lankle:{x:.25,y:.88},rankle:{x:.75,y:.88}
  },
  fight: {
    head:{x:.48,y:.07},neck:{x:.48,y:.17},lshoulder:{x:.30,y:.25},rshoulder:{x:.62,y:.25},
    lelbow:{x:.18,y:.20},relbow:{x:.78,y:.20},lwrist:{x:.10,y:.15},rwrist:{x:.88,y:.15},
    lhip:{x:.40,y:.52},rhip:{x:.58,y:.52},lknee:{x:.30,y:.68},rknee:{x:.65,y:.70},
    lankle:{x:.25,y:.88},rankle:{x:.68,y:.88}
  },
  march: { // 军姿 — 适合矩阵
    head:{x:.5,y:.06},neck:{x:.5,y:.15},lshoulder:{x:.36,y:.26},rshoulder:{x:.64,y:.26},
    lelbow:{x:.28,y:.40},relbow:{x:.72,y:.40},lwrist:{x:.24,y:.54},rwrist:{x:.76,y:.54},
    lhip:{x:.43,y:.53},rhip:{x:.57,y:.53},lknee:{x:.40,y:.70},rknee:{x:.60,y:.70},
    lankle:{x:.39,y:.88},rankle:{x:.61,y:.88}
  }
};

// ---- 工具函数：生成一套默认关节绝对坐标 ----
function makeDefaultJoints(W, H, preset = null) {
  const src = preset ? POSE_PRESETS[preset] : null;
  const j = {};
  for (const [key, def] of Object.entries(SKELETON_JOINTS)) {
    const base = (src && src[key]) ? src[key] : def;
    j[key] = { x: base.x * W, y: base.y * H };
  }
  return j;
}

// ---- 绘制单个火柴人（给定 ctx、joints、颜色配置）----
function drawStickFigure(ctx, joints, W, H, opts = {}) {
  const {
    boneColor  = '#ef4444',
    jointColor = '#ef4444',
    dotRadius  = 4,
    lineWidth  = 2,
    headRadius = null,
    glow       = true,
    label      = null,
    labelColor = '#888'
  } = opts;

  ctx.save();
  if (glow) { ctx.shadowColor = boneColor; ctx.shadowBlur = 5; }
  ctx.strokeStyle = boneColor;
  ctx.lineWidth   = lineWidth;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // 骨骼连线
  for (const [a, b] of SKELETON_BONES) {
    if (joints[a] && joints[b]) {
      ctx.beginPath();
      ctx.moveTo(joints[a].x, joints[a].y);
      ctx.lineTo(joints[b].x, joints[b].y);
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;

  // 关节点
  for (const [key, j] of Object.entries(joints)) {
    if (key === 'head') {
      const r = headRadius || Math.max(8, W * 0.045);
      ctx.beginPath();
      ctx.arc(j.x, j.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = boneColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      ctx.fillStyle = '#0d0d1a';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(j.x, j.y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = jointColor;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // 编号标签
  if (label !== null) {
    ctx.font = `${Math.max(9, W * 0.08)}px monospace`;
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'center';
    ctx.fillText(label, joints.head ? joints.head.x : W / 2, H - 2);
  }

  ctx.restore();
}

// ===========================================================
class PoseNode extends BaseNode {
  constructor(x, y, id, data = {}) {
    super('pose', x, y, id);
    this._count    = data.count    || 1;
    this._preset   = data.preset   || 'stand';
    this._joints   = data.joints   || null; // 单人模式使用
    this._dragJoint = null;
    this._build();
  }

  // ---- 构建节点 UI ----
  _build() {
    const el = this._createWrapper('🕺', '姿势节点');
    const body = el.querySelector('.node-body');
    body.innerHTML = this._renderHTML();
    this._bindPoseEvents(body);
    // mount 由外部 app.js 统一调用，此处仅初始化 canvas
    // _renderCanvas 在 mount 后调用（见 mount 重写）
    this._needInitCanvas = true;
  }

  _renderHTML() {
    const isEditable = this._count < 8;
    const isMatrix   = this._count >= 10;

    const modeTag = isEditable
      ? `<span style="color:#4ade80;font-size:10px">● 肢体调整模式（${this._count}人）</span>`
      : isMatrix
        ? `<span style="color:#fbbf24;font-size:10px">★ 军阵模式</span>`
        : `<span style="color:#60a5fa;font-size:10px">◆ 网格模式</span>`;

    return `
      <div class="pose-controls" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
        <label style="font-size:11px;color:#aaa;white-space:nowrap;">人数</label>
        <input id="poseCount_${this.id}" type="number" min="1" max="200"
          value="${this._count}"
          style="width:54px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:4px;padding:2px 6px;font-size:12px;" />
        <button id="applyCount_${this.id}"
          style="background:#4c3a8f;color:#fff;border:none;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;">应用</button>
        ${modeTag}
      </div>

      <div class="pose-preset-row" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">
        ${Object.keys(POSE_PRESETS).map(p =>
          `<button data-pose="${p}" style="font-size:10px;padding:2px 7px;background:#1e1e3a;color:#ccc;border:1px solid #333;border-radius:4px;cursor:pointer;">${this._presetLabel(p)}</button>`
        ).join('')}
        <button data-pose="reset" style="font-size:10px;padding:2px 7px;background:#2a1a1a;color:#f87171;border:1px solid #5a2a2a;border-radius:4px;cursor:pointer;">重置</button>
      </div>

      <div id="poseCanvasWrap_${this.id}" style="position:relative;border-radius:6px;overflow:hidden;background:#0d0d1a;"></div>

      ${this._count >= 10 ? `
      <div style="display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap;">
        <label style="font-size:11px;color:#aaa;">复制矩阵</label>
        <input id="matrixCopy_${this.id}" type="number" min="1" max="20" value="2"
          style="width:46px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:4px;padding:2px 6px;font-size:12px;"/>
        <button id="doCopy_${this.id}" style="background:#7c3aed;color:#fff;border:none;border-radius:4px;padding:3px 10px;font-size:11px;cursor:pointer;">生成副本</button>
      </div>` : ''}

      <div class="pose-prompt-area" style="margin-top:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <label style="margin:0;font-size:11px;color:#aaa;">姿势提示词</label>
          <span id="copyPosePrompt_${this.id}" style="color:#7c6af7;font-size:11px;cursor:pointer;">复制</span>
        </div>
        <div id="posePrompt_${this.id}" style="font-size:10px;color:#888;line-height:1.5;word-break:break-all;min-height:28px;"></div>
      </div>

      <div style="display:flex;gap:6px;margin-top:8px;">
        <button id="downloadPose_${this.id}" style="flex:1;background:#1e3a2a;color:#4ade80;border:1px solid #2a5a3a;border-radius:4px;padding:5px;font-size:11px;cursor:pointer;">⬇ 下载姿势图</button>
      </div>
    `;
  }

  _presetLabel(p) {
    const map = { stand:'站立', walk:'行走', run:'奔跑', sit:'坐姿', fight:'战斗', march:'军姿' };
    return map[p] || p;
  }

  // ---- 获取画布尺寸 ----
  _getCanvasSize() {
    const n = this._count;
    if (n < 8) {
      // 单人/少人：固定单格大小，可调整姿势
      const W = 260, H = 300;
      return { W, H, cols: 1, rows: 1, cellW: W, cellH: H };
    }
    if (n < 10) {
      // 普通网格
      const cols = Math.min(3, n);
      const rows = Math.ceil(n / cols);
      const cellW = 90, cellH = 110;
      return { W: cols * cellW, H: rows * cellH, cols, rows, cellW, cellH };
    }
    // 军阵模式
    const cols = Math.ceil(Math.sqrt(n * 1.5)); // 横向稍宽
    const rows = Math.ceil(n / cols);
    const cellW = 72, cellH = 88;
    return { W: cols * cellW, H: rows * cellH, cols, rows, cellW, cellH };
  }

  // ---- 渲染主画布 ----
  _renderCanvas() {
    const wrap = this.el.querySelector(`#poseCanvasWrap_${this.id}`);
    if (!wrap) return;
    wrap.innerHTML = '';

    const { W, H, cols, rows, cellW, cellH } = this._getCanvasSize();
    const n = this._count;

    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    canvas.style.width  = Math.min(W, 360) + 'px';
    canvas.style.height = (Math.min(W, 360) / W * H) + 'px';
    canvas.id = `poseCanvas_${this.id}`;
    wrap.appendChild(canvas);
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');

    this._drawMatrix(cols, rows, cellW, cellH, n);
    this._updatePrompt();

    // 可调整模式：绑定拖拽事件（8人以下）
    if (n < 8) this._bindSingleDrag(canvas, cellW, cellH);
  }

  _drawMatrix(cols, rows, cellW, cellH, n) {
    const ctx = this._ctx;
    const W = cols * cellW, H = rows * cellH;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, W, H);

    const isMatrix = n >= 10;
    // 军阵：绘制网格线
    if (isMatrix) {
      ctx.strokeStyle = '#1e1e3a';
      ctx.lineWidth = 0.5;
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath(); ctx.moveTo(c * cellW, 0); ctx.lineTo(c * cellW, H); ctx.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * cellH); ctx.lineTo(W, r * cellH); ctx.stroke();
      }
    }

    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const offX = col * cellW;
      const offY = row * cellH;

      // 获取该位置的关节（可调整模式用独立的 _jointsArr，矩阵模式用 preset）
      let joints;
      if (n < 8 && this._jointsArr && this._jointsArr[i]) {
        // 可调整模式 — 每个人独立 joints
        joints = this._jointsArr[i];
      } else {
        joints = makeDefaultJoints(cellW, cellH, this._preset === 'stand' ? null : this._preset);
      }

      // 偏移绘制
      ctx.save();
      ctx.translate(offX, offY);

      // 军阵：彩色区分列（模拟兵种）
      let boneColor = '#ef4444';
      if (isMatrix) {
        const palette = ['#ef4444','#60a5fa','#4ade80','#fbbf24','#f472b6','#a78bfa','#fb923c','#34d399'];
        boneColor = palette[col % palette.length];
      }

      const dotR = isMatrix ? 2.5 : 5;
      const lw   = isMatrix ? 1.5 : 2.5;
      const hr   = isMatrix ? cellW * 0.08 : cellW * 0.08;

      drawStickFigure(ctx, joints, cellW, cellH, {
        boneColor,
        jointColor: boneColor,
        dotRadius: dotR,
        lineWidth: lw,
        headRadius: hr,
        glow: !isMatrix,
        label: n > 1 ? (i + 1) : null,
        labelColor: '#555'
      });

      ctx.restore();
    }

    // 人数水印
    if (isMatrix) {
      ctx.font = '10px monospace';
      ctx.fillStyle = '#333';
      ctx.textAlign = 'right';
      ctx.fillText(`${n}人 ${cols}×${rows}`, W - 4, H - 3);
    }
  }

  // ---- 单人模式拖拽 ----
  _bindSingleDrag(canvas, cellW, cellH) {
    const RADIUS = 9;
    // 初始化 joints（独立的关节数据）
    if (!this._joints) {
      this._joints = makeDefaultJoints(cellW, cellH,
        this._preset !== 'stand' ? this._preset : null);
    }
    // 初始化或扩展 _jointsArr，确保每个人都有独立的关节数据
    if (!this._jointsArr || this._jointsArr.length < this._count) {
      const existingArr = this._jointsArr || [];
      this._jointsArr = Array.from({ length: this._count }, (_, i) => {
        // 复用已有数据或创建新的独立关节
        if (existingArr[i]) return existingArr[i];
        if (i === 0) return this._joints;
        return makeDefaultJoints(cellW, cellH,
          this._preset !== 'stand' ? this._preset : null);
      });
    }

    let activeIdx = 0; // 当前操作的第几个人（单/少人模式）

    const getJointAt = (mx, my, idx) => {
      const j = this._jointsArr[idx];
      if (!j) return null;
      for (const [key, pt] of Object.entries(j)) {
        const dx = mx - pt.x, dy = my - pt.y;
        if (Math.sqrt(dx*dx + dy*dy) < RADIUS + 3) return key;
      }
      return null;
    };

    canvas.addEventListener('mousedown', e => {
      e.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top)  * scaleY;

      // 确定点击的是哪个人（多人情况）
      if (this._count > 1) {
        const { cols, cellW: cw, cellH: ch } = this._getCanvasSize();
        activeIdx = Math.floor(mx / cw) + Math.floor(my / ch) * cols;
        activeIdx = Math.max(0, Math.min(this._count - 1, activeIdx));
      }

      // 转换为 cell 内坐标
      const { cols, cellW: cw, cellH: ch } = this._getCanvasSize();
      const cellLocalX = mx - (activeIdx % cols) * cw;
      const cellLocalY = my - Math.floor(activeIdx / cols) * ch;

      this._dragJoint = getJointAt(cellLocalX, cellLocalY, activeIdx);
      this._activeIdx = activeIdx;
    });

    const onMove = e => {
      if (!this._dragJoint) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top)  * scaleY;

      const { cols, cellW: cw, cellH: ch } = this._getCanvasSize();
      const idx = this._activeIdx;
      const offX = (idx % cols) * cw;
      const offY = Math.floor(idx / cols) * ch;

      const lx = Math.max(0, Math.min(cw, mx - offX));
      const ly = Math.max(0, Math.min(ch, my - offY));

      if (!this._jointsArr[idx]) {
        this._jointsArr[idx] = makeDefaultJoints(cw, ch, null);
      }
      this._jointsArr[idx][this._dragJoint] = { x: lx, y: ly };
      this._joints = this._jointsArr[0]; // sync 主关节

      const { cols: c, rows: r } = this._getCanvasSize();
      this._drawMatrix(c, r, cw, ch, this._count);
    };

    const onUp = () => {
      if (this._dragJoint) {
        this._dragJoint = null;
        this._updatePrompt();
        Canvas._saveState();
      }
    };

    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top)  * scaleY;
      const { cols, cellW: cw, cellH: ch } = this._getCanvasSize();
      const idx = Math.floor(mx / cw) + Math.floor(my / ch) * cols;
      const lx = mx - (idx % cols) * cw;
      const ly = my - Math.floor(idx / cols) * ch;
      canvas.style.cursor = getJointAt(lx, ly, Math.min(idx, this._count-1)) ? 'grab' : 'default';
    });

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    // 记录清理函数（节点删除时可用）
    this._cleanupDrag = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }

  // ---- 事件绑定 ----
  _bindPoseEvents(body) {
    // 应用人数
    setTimeout(() => {
      const applyBtn = document.getElementById(`applyCount_${this.id}`);
      if (applyBtn) {
        applyBtn.addEventListener('click', () => {
          const inp = document.getElementById(`poseCount_${this.id}`);
          const n = Math.max(1, Math.min(200, parseInt(inp.value) || 1));
          this._count = n;
          this._joints = null;
          this._jointsArr = null;
          // 重新渲染整个 body
          const b = this.el.querySelector('.node-body');
          b.innerHTML = this._renderHTML();
          this._bindPoseEvents(b);
          this._renderCanvas();
          Canvas._saveState();
          Utils.toast(`已生成 ${n} 个火柴人`, 'success');
        });
      }

      // 预设姿势
      body.querySelectorAll('[data-pose]').forEach(btn => {
        btn.addEventListener('click', () => {
          const pose = btn.dataset.pose;
          if (pose === 'reset') {
            this._preset = 'stand';
            this._joints = null;
            this._jointsArr = null;
          } else {
            this._preset = pose;
            this._joints = null;
            this._jointsArr = null;
          }
          const { cols, rows, cellW, cellH } = this._getCanvasSize();
          this._drawMatrix(cols, rows, cellW, cellH, this._count);
          this._renderCanvas();
          this._updatePrompt();
          Canvas._saveState();
        });
      });

      // 复制矩阵
      const doCopyBtn = document.getElementById(`doCopy_${this.id}`);
      if (doCopyBtn) {
        doCopyBtn.addEventListener('click', () => {
          const times = parseInt(document.getElementById(`matrixCopy_${this.id}`)?.value) || 2;
          const { cols, cellW, cellH } = this._getCanvasSize();
          const baseX = parseFloat(this.el.style.left) || 0;
          const baseY = parseFloat(this.el.style.top)  || 0;
          const nodeW = this.el.offsetWidth || 300;
          const nodeH = this.el.offsetHeight || 400;
          for (let i = 1; i <= times; i++) {
            const nx = baseX + (nodeW + 30) * i;
            const ny = baseY;
            window.App && App.createNode('pose', nx, ny, null, {
              count: this._count,
              preset: this._preset,
              joints: null,
              jointsArr: null
            });
          }
          Utils.toast(`已复制 ${times} 个矩阵`, 'success');
        });
      }

      // 复制提示词
      const copyBtn = document.getElementById(`copyPosePrompt_${this.id}`);
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const el = document.getElementById(`posePrompt_${this.id}`);
          if (el) Utils.copy(el.textContent);
        });
      }

      // 下载
      const dlBtn = document.getElementById(`downloadPose_${this.id}`);
      if (dlBtn) {
        dlBtn.addEventListener('click', () => {
          const c = document.getElementById(`poseCanvas_${this.id}`);
          if (c) {
            Utils.downloadCanvas(c, `pose_${this._count}p_${this.id}.png`);
            Utils.toast('姿势图已下载', 'success');
          }
        });
      }
    }, 0);
  }

  // ---- 姿势提示词生成 ----
  _updatePrompt() {
    const el = document.getElementById(`posePrompt_${this.id}`);
    if (!el) return;

    const n = this._count;
    const preset = this._preset;
    const presetDesc = {
      stand:'standing pose, neutral stance',
      walk:'walking pose, one leg forward',
      run:'running pose, dynamic movement',
      sit:'sitting pose, bent knees',
      fight:'fighting stance, arms raised',
      march:'military march pose, upright'
    };

    let desc = presetDesc[preset] || 'standing pose';

    if (n < 8 && this._joints) {
      // 分析第一个人的关节特征
      const j = this._jointsArr && this._jointsArr[0] || this._joints;
      const parts = [];
      if (j.lwrist && j.lshoulder && j.lwrist.y < j.lshoulder.y) parts.push('left arm raised');
      if (j.rwrist && j.rshoulder && j.rwrist.y < j.rshoulder.y) parts.push('right arm raised');
      if (j.lankle && j.rankle && Math.abs(j.lankle.x - j.rankle.x) > 60) parts.push('wide stance');
      if (parts.length) desc += ', ' + parts.join(', ');
    }

    const countDesc = n === 1 ? 'single figure' : `${n} figures`;
    const arrangement = n >= 10
      ? ', military formation, grid arrangement, army squad'
      : n > 1 ? ', group pose' : '';

    el.textContent = `${countDesc}, ${desc}, stick figure reference, full body${arrangement}, concept art pose`;
  }

  // 重写 mount：挂载后再初始化 canvas
  mount() {
    document.getElementById('canvasNodes').appendChild(this.el);
    Canvas.registerNode(this.id, this);
    if (this._needInitCanvas) {
      this._needInitCanvas = false;
      setTimeout(() => this._renderCanvas(), 0);
    }
  }

  serialize() {
    return {
      count: this._count,
      preset: this._preset,
      joints: this._joints,
      jointsArr: this._jointsArr
    };
  }
}
