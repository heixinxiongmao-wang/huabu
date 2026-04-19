// ============================================================
// TextNode.js — 文本节点（分析场景/人物/道具 + 生成提示词）
// ============================================================
class TextNode extends BaseNode {
  constructor(x, y, id, data = {}) {
    super('text', x, y, id);
    this._text    = data.text || '';
    this._analysis = data.analysis || null;
    this._build();
  }

  _build() {
    const el = this._createWrapper('📝', '文本节点');
    const body = el.querySelector('.node-body');

    body.innerHTML = `
      <textarea class="text-area" placeholder="在此输入文本内容...&#10;支持场景描述、人物设定、故事情节等">${this._text}</textarea>
      <div class="text-actions">
        <button class="analyze-btn primary" title="自动分析文本，拆分元素并生成提示词">🔍 智能分析</button>
        <button class="clear-analysis-btn" title="清除分析结果">清除</button>
        <button class="copy-text-btn" title="复制全部文字">复制文本</button>
      </div>
      <div class="analysis-result" style="display:none"></div>
    `;

    this._textarea = body.querySelector('.text-area');
    this._resultEl = body.querySelector('.analysis-result');

    this._textarea.addEventListener('input', () => {
      this._text = this._textarea.value;
      Canvas._saveState();
    });

    body.querySelector('.analyze-btn').addEventListener('click', () => this._analyze());
    body.querySelector('.clear-analysis-btn').addEventListener('click', () => {
      this._analysis = null;
      this._resultEl.style.display = 'none';
    });
    body.querySelector('.copy-text-btn').addEventListener('click', () => Utils.copy(this._text));

    // 如果有已保存的分析结果，恢复显示
    if (this._analysis) this._renderAnalysis(this._analysis);
  }

  _analyze() {
    const text = this._textarea.value.trim();
    if (!text) { Utils.toast('请先输入文本内容', 'warning'); return; }

    const btn = this.el.querySelector('.analyze-btn');
    btn.innerHTML = '<span class="spinner"></span> 分析中...';
    btn.disabled = true;

    // 模拟分析（本地处理）
    setTimeout(() => {
      this._analysis = Utils.analyzeText(text);
      this._renderAnalysis(this._analysis);
      btn.innerHTML = '🔍 智能分析';
      btn.disabled = false;
      Canvas._saveState();
      Utils.toast('文本分析完成', 'success');
    }, 600);
  }

  _renderAnalysis(analysis) {
    const el = this._resultEl;
    el.style.display = 'block';

    const renderTags = (arr, cls) => arr.length
      ? arr.map(t => `<span class="analysis-tag ${cls}">${t}</span>`).join('')
      : '<span class="analysis-tag">未检测到</span>';

    el.innerHTML = `
      <div class="analysis-section">
        <div class="analysis-section-title">
          👤 人物  <span class="copy-btn" onclick="Utils.copy('${analysis.characters.join(', ')}')">复制</span>
        </div>
        <div class="analysis-tags">${renderTags(analysis.characters, 'character')}</div>
      </div>
      <div class="analysis-section">
        <div class="analysis-section-title">
          🌄 场景  <span class="copy-btn" onclick="Utils.copy('${analysis.scenes.join(', ')}')">复制</span>
        </div>
        <div class="analysis-tags">${renderTags(analysis.scenes, 'scene')}</div>
      </div>
      <div class="analysis-section">
        <div class="analysis-section-title">
          🗡️ 道具  <span class="copy-btn" onclick="Utils.copy('${analysis.props.join(', ')}')">复制</span>
        </div>
        <div class="analysis-tags">${renderTags(analysis.props, 'prop')}</div>
      </div>
      <div class="analysis-section">
        <div class="analysis-section-title">
          🎨 情绪/风格  <span class="copy-btn" onclick="Utils.copy('${analysis.moods.join(', ')}')">复制</span>
        </div>
        <div class="analysis-tags">${renderTags(analysis.moods, 'mood')}</div>
      </div>
      <div class="analysis-section">
        <div class="analysis-section-title">
          ✨ 文生图提示词
          <span class="copy-btn" onclick="Utils.copy(\`${analysis.prompt.replace(/`/g, "'")}\`)">复制</span>
        </div>
        <div class="prompt-box">${analysis.prompt}</div>
      </div>
    `;
  }

  serialize() {
    return { text: this._text, analysis: this._analysis };
  }
}
