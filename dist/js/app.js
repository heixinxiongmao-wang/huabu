// ============================================================
// app.js — 应用入口 v4（彻底重构，最可靠实现）
// ============================================================
(function() {
  'use strict';

  // ---- 节点构造函数映射 ----
  const NODE_CLASSES = {
    text:    TextNode,
    image:   ImageNode,
    video:   VideoNode,
    pose:    PoseNode,
    gallery: GalleryNode,
    doodle:  DoodleNode
  };

  // ---- 全局 App 对象 ----
  window.App = {
    _contextPos: { x: 0, y: 0 },
    _lastCtxX: window.innerWidth / 2,
    _lastCtxY: window.innerHeight / 2,

    // 初始化
    init: function() {
      console.log('[App] 初始化...');
      this._initPalette();
      this._initContextMenu();
      this._initDragDrop();
      this._initButtons();
      this._initKeyboard();
      this._loadDemo();
      console.log('[App] 初始化完成, 节点数:', Canvas.nodes.size);
    },

    // ---- 创建节点 ----
    createNode: function(type, x, y, id, data) {
      console.log('[App] createNode:', type, x, y);
      var NodeClass = NODE_CLASSES[type];
      if (!NodeClass) { console.error('[App] 未知类型:', type); return null; }

      var node;
      try {
        node = new NodeClass(x, y, id || null, data || {});
      } catch(e) {
        console.error('[App] 节点创建失败:', e);
        return null;
      }

      if (!node || !node.el) { console.error('[App] 节点DOM无效'); return null; }

      // 挂载
      document.getElementById('canvasNodes').appendChild(node.el);
      Canvas.nodes.set(node.id, node);
      Canvas.selectNode(node.id, false);
      Canvas._saveState();
      if (window.Connections) Connections.redrawAll();

      // 自动适应视图，确保新节点可见
      Canvas.fitView();

      console.log('[App] 节点已创建:', node.id, '| DOM子节点:', document.getElementById('canvasNodes').children.length);
      return node;
    },

    // ---- 侧边栏 ----
    _initPalette: function() {
      var items = document.querySelectorAll('.palette-item');
      console.log('[App] 侧边栏项目:', items.length);
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var type = item.dataset.type;

        // 点击添加
        item.addEventListener('click', (function(t, el) {
          return function(e) {
            console.log('[App] 侧边栏点击:', t);
            var pos = Canvas.screenToCanvas(App._lastCtxX, App._lastCtxY);
            var node = App.createNode(t, pos.x - 140, pos.y - 80);
            if (node) {
              var label = el.querySelector('span') ? el.querySelector('span').textContent : t;
              Utils.toast('已添加 ' + label, 'success');
            }
          };
        })(type, item));

        // 拖拽
        item.addEventListener('dragstart', function(e) {
          e.dataTransfer.setData('node-type', type);
        });
      }
    },

    // ---- 右键菜单 ----
    _initContextMenu: function() {
      var cm = document.getElementById('contextMenu');
      if (!cm) { console.warn('[App] 未找到contextMenu'); return; }

      var items = cm.querySelectorAll('.ctx-item');
      console.log('[App] 右键菜单项:', items.length);

      for (var i = 0; i < items.length; i++) {
        items[i].addEventListener('click', (function(el) {
          return function(e) {
            e.stopPropagation();
            var act = el.dataset.action;
            console.log('[App] 右键动作:', act);
            App._doAction(act);
            cm.classList.remove('visible');
          };
        })(items[i]));
      }
    },

    _doAction: function(act) {
      var pos = this._contextPos;
      var map = {
        addText: 'text', addImage: 'image', addGallery: 'gallery',
        addVideo: 'video', addPose: 'pose', addDoodle: 'doodle'
      };

      if (map[act]) {
        this.createNode(map[act], pos.x, pos.y);
        return;
      }

      switch (act) {
        case 'addMatrix':
          this._showMatrix();
          break;
        case 'openLibrary':
          document.getElementById('libraryPanel').classList.add('open');
          break;
        case 'fitView':
          Canvas.fitView();
          break;
        case 'zoomReset':
          Canvas.scale = 1; Canvas.panX = 0; Canvas.panY = 0;
          Canvas._applyTransform();
          window.Connections && Connections.redrawAll();
          Utils.toast('缩放已重置', 'info');
          break;
        case 'saveState':
          Canvas.saveState();
          break;
        case 'clearCanvas':
          Canvas.clearCanvas();
          break;
      }
    },

    _showMatrix: function() {
      Utils.modal('姿势矩阵', [
        '<div style="display:flex;flex-direction:column;gap:12px;min-width:280px">',
        '<div><label>火柴人数量</label><input type="number" id="matrixCount" value="10" min="2" max="50" style="width:100%"></div>',
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">',
        '<button class="btn-secondary" onclick="App._doMatrix()">生成矩阵</button>',
        '<button class="btn-secondary" onclick="App._doMatrix(true)">生成副本</button>',
        '</div>',
        '<div class="hint-text">≥10人自动军阵，≤5人可调整肢体</div>',
        '</div>'
      ].join(''));
    },

    _doMatrix: function(copies) {
      var count = parseInt(document.getElementById('matrixCount').value) || 10;
      var pos = this._contextPos;
      if (copies) {
        for (var i = 0; i < count; i++) {
          this.createNode('pose', pos.x + i * 320, pos.y);
        }
        Utils.toast('已生成 ' + count + ' 个姿势副本', 'success');
      } else {
        this.createNode('pose', pos.x, pos.y);
        Utils.toast('姿势矩阵已添加', 'success');
      }
    },

    // ---- 拖拽到画布 ----
    _initDragDrop: function() {
      var wrapper = document.getElementById('canvasWrapper');
      wrapper.addEventListener('drop', function(e) {
        e.preventDefault();
        var type = e.dataTransfer.getData('node-type');
        if (type) {
          var pos = Canvas.screenToCanvas(e.clientX, e.clientY);
          App.createNode(type, pos.x, pos.y);
        }

        // 素材库拖入
        var libId = e.dataTransfer.getData('library-item-id');
        if (libId && window.Library) {
          var item = Library._items.find(function(it) { return it.id === libId; });
          if (item) {
            var pos2 = Canvas.screenToCanvas(e.clientX, e.clientY);
            var node = App.createNode(item.type === 'video' ? 'video' : 'image', pos2.x - 140, pos2.y - 100);
            if (node && item.type === 'image') {
              node._src = item.src;
              node._filename = item.name;
              node._renderImage(item.src, item.name);
            }
          }
        }
      });

      wrapper.addEventListener('dragover', function(e) { e.preventDefault(); });
    },

    // ---- 按钮 ----
    _initButtons: function() {
      var b;
      b = document.getElementById('saveCanvas');   if (b) b.addEventListener('click', function() { Canvas.saveState(); });
      b = document.getElementById('loadCanvas');   if (b) b.addEventListener('click', function() { Canvas.loadState(); });
      b = document.getElementById('clearCanvas');  if (b) b.addEventListener('click', function() { Canvas.clearCanvas(); });
      b = document.getElementById('exportBtn');    if (b) b.addEventListener('click', function() { App._showExport(); });
      b = document.getElementById('toggleLibrary'); if (b) b.addEventListener('click', function() {
        document.getElementById('libraryPanel').classList.toggle('open');
      });
      b = document.getElementById('closeLibrary'); if (b) b.addEventListener('click', function() {
        document.getElementById('libraryPanel').classList.remove('open');
      });
    },

    _showExport: function() {
      Utils.modal('导出选项', [
        '<div style="display:grid;gap:10px">',
        '<button class="btn-secondary" onclick="App._exportJSON()" style="padding:12px;text-align:left">📄 导出 JSON</button>',
        '<button class="btn-secondary" onclick="App._exportScreenshot()" style="padding:12px;text-align:left">🖼️ 截图画布</button>',
        '</div>'
      ].join(''));
    },

    _exportJSON: function() {
      var saved = Utils.loadFromStorage('canvas');
      if (!saved) { Utils.toast('请先保存画布', 'warning'); return; }
      var blob = new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' });
      Utils.download(URL.createObjectURL(blob), 'canvas_' + Date.now() + '.json');
      Utils.toast('JSON 已导出', 'success');
    },

    _exportScreenshot: function() {
      Utils.toast('截图功能开发中，请使用浏览器截图', 'info');
    },

    // ---- 键盘快捷键 ----
    _initKeyboard: function() {
      var self = this;
      document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        var shortcuts = {
          't': 'text', 'i': 'image', 'g': 'gallery',
          'v': 'video', 'p': 'pose', 'd': 'doodle', 'm': 'pose'
        };
        if (shortcuts[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey && !e.altKey) {
          var pos = Canvas.screenToCanvas(self._lastCtxX, self._lastCtxY);
          App.createNode(shortcuts[e.key.toLowerCase()], pos.x - 140, pos.y - 80);
          Utils.toast('已添加节点', 'success');
        }
        // F 键适应视图
        if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          Canvas.fitView();
        }
      });

      document.addEventListener('mousemove', function(e) {
        self._lastCtxX = e.clientX;
        self._lastCtxY = e.clientY;
      }, { passive: true });
    },

    // ---- 演示节点 ----
    _loadDemo: function() {
      var saved = Utils.loadFromStorage('canvas');
      if (saved && saved.nodes && saved.nodes.length > 0) {
        console.log('[App] 已有保存状态，跳过演示');
        return;
      }

      console.log('[App] 加载演示节点...');
      var textNode = this.createNode('text', 60, 60);
      if (textNode && textNode._textarea) {
        textNode._textarea.value = [
          '欢迎使用无限画布！',
          '',
          '操作方式：',
          '• 右键画布 → 快速添加节点',
          '• 侧边栏点击 → 添加节点到画布',
          '• T/I/G/V/P/D/M → 键盘快捷键',
          '• 滚轮缩放 / 空格键平移'
        ].join('\n');
        textNode._text = textNode._textarea.value;
      }
      this.createNode('image', 440, 60);
      this.createNode('pose', 780, 60);
      this.createNode('doodle', 60, 440);

      var self = this;
      setTimeout(function() { Canvas.fitView(); console.log('[App] 演示加载完成'); }, 100);
    }
  };

  // ---- 右键菜单位置记录 ----
  document.getElementById('canvasWrapper').addEventListener('contextmenu', function(e) {
    e.preventDefault();
    var cm = document.getElementById('contextMenu');
    var pos = Canvas.screenToCanvas(e.clientX, e.clientY);
    App._contextPos = pos;
    App._lastCtxX = e.clientX;
    App._lastCtxY = e.clientY;

    var menuW = 220, menuH = cm.scrollHeight || 400;
    cm.style.left = Math.max(0, Math.min(e.clientX, window.innerWidth - menuW)) + 'px';
    cm.style.top  = Math.max(0, Math.min(e.clientY, window.innerHeight - menuH)) + 'px';
    cm.classList.add('visible');
  }, true);

  // ---- 隐藏右键菜单 ----
  document.addEventListener('mousedown', function(e) {
    var cm = document.getElementById('contextMenu');
    if (cm && !cm.contains(e.target)) {
      cm.classList.remove('visible');
    }
    // 清除长按状态
    Canvas._panPending = false;
    if (Canvas._panTimer) { clearTimeout(Canvas._panTimer); Canvas._panTimer = null; }
  });

  // ---- DOMContentLoaded 后启动 ----
  document.addEventListener('DOMContentLoaded', function() {
    console.log('[App] DOMContentLoaded');
    window.App.init();
  });

})();
