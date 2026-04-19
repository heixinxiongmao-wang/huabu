// ============================================================
// VideoNode.js — 视频节点（上传/预览/下载 + 外部工具提示）
// ============================================================
class VideoNode extends BaseNode {
  constructor(x, y, id, data = {}) {
    super('video', x, y, id);
    this._src      = data.src || null;
    this._filename = data.filename || '';
    this._build();
  }

  _build() {
    const el = this._createWrapper('🎬', '视频节点');
    const body = el.querySelector('.node-body');
    const inputId = 'vid_input_' + this.id;

    body.innerHTML = `
      <input type="file" id="${inputId}" accept="video/*" style="display:none">
      <div class="video-upload-zone" id="vidZone_${this.id}">
        <div class="video-play-icon">▶</div>
        <div class="upload-text" style="font-size:12px;color:var(--text-muted)">点击上传视频</div>
      </div>
      <div class="video-controls">
        <button class="v-btn" data-act="upload">📂 上传</button>
        <button class="v-btn" data-act="download">⬇️ 下载</button>
        <button class="v-btn" data-act="comfyui">🎨 ComfyUI</button>
        <button class="v-btn" data-act="davinci">🎞️ DaVinci</button>
        <span class="video-quality-badge" id="vidQuality_${this.id}" style="display:none">原始</span>
      </div>
      <div class="node-status" id="vidStatus_${this.id}" style="display:none">
        <div class="status-dot idle"></div><span>待处理</span>
      </div>
    `;

    this._zone   = body.querySelector(`#vidZone_${this.id}`);
    this._fileInput = body.querySelector(`#${inputId}`);
    this._qualityBadge = body.querySelector(`#vidQuality_${this.id}`);
    this._statusEl = body.querySelector(`#vidStatus_${this.id}`);

    // 上传区域点击
    this._zone.addEventListener('click', () => this._fileInput.click());
    this._fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) this._loadFile(file);
    });

    // 拖放
    this._zone.addEventListener('dragover', e => { e.preventDefault(); });
    this._zone.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('video/')) this._loadFile(file);
    });

    // 功能按钮
    body.querySelectorAll('.v-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (act === 'upload')   this._fileInput.click();
        if (act === 'download') this._downloadVideo();
        if (act === 'comfyui') this._openExternalTool('ComfyUI');
        if (act === 'davinci')  this._openExternalTool('DaVinci Resolve');
      });
    });

    // 应用按钮样式
    body.querySelectorAll('.v-btn').forEach(btn => {
      Object.assign(btn.style, {
        padding: '5px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xs)', color: 'var(--text-secondary)',
        cursor: 'pointer', fontSize: '11px', transition: 'var(--transition)'
      });
      btn.addEventListener('mouseover', () => { btn.style.borderColor = 'var(--accent)'; btn.style.color = 'var(--accent)'; });
      btn.addEventListener('mouseout',  () => { btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--text-secondary)'; });
    });

    if (this._src) this._renderVideo(this._src);
  }

  async _loadFile(file) {
    this._filename = file.name;
    const src = URL.createObjectURL(file);
    this._src = src;
    this._renderVideo(src);
    this._qualityBadge.textContent = Utils.formatFileSize(file.size);
    this._qualityBadge.style.display = '';
    this._setStatus('done', '已载入');
    Canvas._saveState();
  }

  _renderVideo(src) {
    this._zone.innerHTML = '';
    const vid = document.createElement('video');
    vid.src = src;
    vid.controls = true;
    vid.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:8px';
    this._zone.appendChild(vid);
  }

  _downloadVideo() {
    if (!this._src) { Utils.toast('请先上传视频文件', 'warning'); return; }
    Utils.download(this._src, this._filename || 'video.mp4');
    Utils.toast('视频下载中...', 'info');
  }

  _openExternalTool(tool) {
    const hints = {
      'ComfyUI': {
        steps: [
          '1. 在本地启动 ComfyUI（默认端口 7860）',
          '2. 下载此视频文件到本地',
          '3. 在 ComfyUI 中加载视频增强工作流',
          '4. 上传视频并配置：画质增强 / 超分辨率 / 光影调整等节点',
          '5. 处理完成后将结果视频上传到此节点'
        ],
        url: 'http://127.0.0.1:7860'
      },
      'DaVinci Resolve': {
        steps: [
          '1. 确保本地已安装 DaVinci Resolve',
          '2. 下载视频文件到本地',
          '3. 在 DaVinci Resolve 中导入视频',
          '4. 使用 Color 页面进行调色、光影处理',
          '5. 使用 Fusion 页面进行特效合成',
          '6. 导出后重新上传到此节点'
        ],
        url: null
      }
    };

    const info = hints[tool] || {};
    const stepsHtml = info.steps
      ? `<ol style="padding-left:16px;line-height:1.8;color:var(--text-secondary);font-size:12px">${info.steps.map(s=>`<li>${s}</li>`).join('')}</ol>`
      : '';

    const urlBtn = info.url
      ? `<button class="btn-primary" onclick="window.open('${info.url}','_blank');Utils.closeModal()">打开 ${tool}</button>`
      : '';

    Utils.modal(`使用 ${tool} 处理视频`, `
      <div class="download-hint">
        <div class="icon">${tool === 'ComfyUI' ? '🎨' : '🎞️'}</div>
        <div class="title">视频处理流程 — ${tool}</div>
        <div class="desc" style="text-align:left;margin-top:12px">${stepsHtml}</div>
        <div class="note">💡 处理完成后，请下载原视频，在 ${tool} 处理后重新上传到视频节点</div>
      </div>
    `, urlBtn ? [{ label: `打开 ${tool}`, type: 'primary', action: `window.open('${info.url}','_blank')` }] : []);

    if (!this._src) return;
    // 自动触发下载
    this._downloadVideo();
  }

  _setStatus(type, msg) {
    const dot = this._statusEl.querySelector('.status-dot');
    const span = this._statusEl.querySelector('span');
    this._statusEl.style.display = 'flex';
    dot.className = `status-dot ${type}`;
    span.textContent = msg;
  }

  serialize() {
    return { filename: this._filename };
    // 注意：视频ObjectURL不持久化，仅保存文件名
  }
}
