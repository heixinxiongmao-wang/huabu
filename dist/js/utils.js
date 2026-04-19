// ============================================================
// utils.js — 工具函数
// ============================================================

const Utils = {
  // 生成唯一ID
  uid() {
    return 'n_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  },

  // Toast通知
  toast(msg, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 300);
    }, duration);
  },

  // 显示模态框
  modal(title, html, buttons = []) {
    const overlay = document.getElementById('modalOverlay');
    const box = document.getElementById('modalBox');
    const btns = buttons.length
      ? `<div class="modal-footer">${buttons.map(b =>
          `<button class="btn-${b.type || 'secondary'}" onclick="${b.action}">${b.label}</button>`
        ).join('')}<button class="btn-secondary" onclick="Utils.closeModal()">关闭</button></div>`
      : `<div class="modal-footer"><button class="btn-secondary" onclick="Utils.closeModal()">关闭</button></div>`;
    box.innerHTML = `<div class="modal-title">${title}</div><div>${html}</div>${btns}`;
    overlay.style.display = 'flex';
  },

  closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
  },

  // 复制到剪贴板
  async copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      Utils.toast('已复制到剪贴板', 'success', 1500);
    } catch (e) {
      Utils.toast('复制失败', 'error');
    }
  },

  // 下载文件
  download(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  },

  // 下载 Canvas 为图片
  downloadCanvas(canvas, filename = 'canvas.png') {
    const url = canvas.toDataURL('image/png');
    Utils.download(url, filename);
  },

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  },

  // 读取文件为 DataURL
  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // 截图节点区域（导出）
  async exportCanvas(canvasEl) {
    const dataUrl = canvasEl.toDataURL('image/png');
    return dataUrl;
  },

  // 深拷贝
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  // 防抖
  debounce(fn, delay = 200) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  },

  // 节流
  throttle(fn, interval = 16) {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last >= interval) { last = now; fn(...args); }
    };
  },

  // ============================================================
  // 文本分析：拆分场景/人物/道具/情绪 + 生成提示词
  // ============================================================
  analyzeText(text) {
    // 人物相关关键词
    const characterKw = ['人物','角色','主角','配角','老人','女人','男人','孩子','少女','男孩','女孩',
      '武士','将军','骑士','魔法师','勇者','英雄','反派','boss','npc','人','她','他',
      '侦探','医生','护士','学生','老师','警察','士兵','忍者','海盗'];
    // 场景/地点关键词
    const sceneKw = ['场景','背景','环境','森林','城市','山地','海边','沙漠','草原','室内','房间',
      '夜晚','白天','黄昏','雪地','战场','学校','医院','城堡','废墟','宇宙','天空','村庄',
      '街道','庭院','地下城','洞穴','大厅'];
    // 道具/物品关键词
    const propKw = ['道具','物品','武器','剑','枪','盾','法杖','弓','书','地图','钥匙','花',
      '灯','车','飞机','船','马','宝箱','项链','戒指','衣服','铠甲','面具','帽子'];
    // 情绪/氛围关键词
    const moodKw = ['快乐','悲伤','愤怒','恐惧','紧张','轻松','神秘','史诗','温馨','黑暗',
      '明亮','阴暗','浪漫','战斗','冒险','静谧','激烈','梦幻','赛博朋克','写实','动漫','油画'];

    const found = { characters: [], scenes: [], props: [], moods: [] };
    const words = text.replace(/[，。！？,.!?]/g, ' ').split(/\s+/);
    const fullText = text.toLowerCase();

    characterKw.forEach(kw => { if (fullText.includes(kw)) found.characters.push(kw); });
    sceneKw.forEach(kw => { if (fullText.includes(kw)) found.scenes.push(kw); });
    propKw.forEach(kw => { if (fullText.includes(kw)) found.props.push(kw); });
    moodKw.forEach(kw => { if (fullText.includes(kw)) found.moods.push(kw); });

    // 去重
    Object.keys(found).forEach(k => { found[k] = [...new Set(found[k])]; });

    // 生成英文提示词（本地映射表，可扩展）
    const cnToEn = {
      '人物':'character','角色':'character','主角':'main character','老人':'elderly person',
      '女人':'woman','男人':'man','孩子':'child','少女':'young girl','男孩':'boy','女孩':'girl',
      '武士':'warrior','将军':'general','骑士':'knight','魔法师':'mage','勇者':'hero',
      '英雄':'hero','反派':'villain','忍者':'ninja','海盗':'pirate','侦探':'detective',
      '森林':'forest','城市':'city','山地':'mountain','海边':'beach','沙漠':'desert',
      '草原':'grassland','室内':'indoor','房间':'room','夜晚':'night','白天':'daytime',
      '黄昏':'dusk','雪地':'snow field','战场':'battlefield','学校':'school','城堡':'castle',
      '废墟':'ruins','宇宙':'cosmos','天空':'sky','村庄':'village','街道':'street',
      '庭院':'courtyard','地下城':'dungeon','洞穴':'cave',
      '剑':'sword','枪':'gun','盾':'shield','法杖':'magic staff','弓':'bow',
      '书':'book','地图':'map','钥匙':'key','花':'flower','灯':'lantern',
      '车':'vehicle','飞机':'aircraft','船':'ship','马':'horse','宝箱':'treasure chest',
      '项链':'necklace','戒指':'ring','铠甲':'armor','面具':'mask','帽子':'hat',
      '快乐':'joyful','悲伤':'sorrowful','愤怒':'angry','恐惧':'fearful',
      '紧张':'tense','轻松':'relaxed','神秘':'mysterious','史诗':'epic',
      '温馨':'warm','黑暗':'dark','明亮':'bright','阴暗':'gloomy','浪漫':'romantic',
      '战斗':'action scene','冒险':'adventure','静谧':'serene','激烈':'intense',
      '梦幻':'fantasy','赛博朋克':'cyberpunk','写实':'photorealistic','动漫':'anime style','油画':'oil painting'
    };

    const toEn = arr => arr.map(c => cnToEn[c] || c).filter(Boolean);
    const chars = toEn(found.characters);
    const scenes = toEn(found.scenes);
    const props = toEn(found.props);
    const moods = toEn(found.moods);

    // 组合提示词
    const parts = [];
    if (moods.length) parts.push(moods.join(', '));
    if (chars.length) parts.push(chars.join(', '));
    if (scenes.length) parts.push('in ' + scenes.join(' and '));
    if (props.length) parts.push('with ' + props.join(', '));
    parts.push('highly detailed, cinematic lighting, masterpiece, best quality');

    return {
      ...found,
      prompt: parts.join(', ')
    };
  },

  // ============================================================
  // localStorage 持久化
  // ============================================================
  saveToStorage(key, data) {
    try {
      localStorage.setItem('ic_' + key, JSON.stringify(data));
    } catch (e) { console.warn('Storage save failed', e); }
  },
  loadFromStorage(key) {
    try {
      const v = localStorage.getItem('ic_' + key);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }
};

// 全局关闭模态框
window.Utils = Utils;
