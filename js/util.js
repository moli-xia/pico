/* ============================================================
 * Pico 图片查看器 · util.js
 * 图标库、通用工具函数、Toast 通知
 * ============================================================ */
(function () {
  'use strict';
  const Pico = (window.Pico = window.Pico || {});

  /* ---------- SVG 图标（feather/lucide 风格描边图标） ---------- */
  const I = {
    'image': '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.8" cy="8.9" r="1.7"/><path d="M21 15.5 16 10.5 5.5 21"/>',
    'folder': '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    'search': '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.7-4.7"/>',
    'x': '<path d="M18 6 6 18M6 6l12 12"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'zoom-in': '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.7-4.7M11 8v6M8 11h6"/>',
    'zoom-out': '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.7-4.7M8 11h6"/>',
    'maximize': '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
    'minimize': '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>',
    'rotate-cw': '<path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    'rotate-ccw': '<path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    'play': '<path d="M6 4.5 19 12 6 19.5v-15z" fill="currentColor" stroke="none"/>',
    'pause': '<rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/>',
    'info': '<circle cx="12" cy="12" r="9.5"/><path d="M12 16v-5"/><path d="M12 8h.01"/>',
    'save': '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    'copy': '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>',
    'clipboard': '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 12h6M9 16h4"/>',
    'trash': '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    'sort': '<path d="M11 5h9M11 9h7M11 13h5M11 17h3"/><path d="M5 5v14m0 0-2.5-2.5M5 19l2.5-2.5"/>',
    'sort-asc': '<path d="M5 19V5m0 0L2.5 7.5M5 5l2.5 2.5"/>',
    'sort-desc': '<path d="M5 5v14m0 0-2.5-2.5M5 19l2.5-2.5"/>',
    'shuffle': '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/>',
    'repeat': '<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 23-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    'monitor': '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    'sun': '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/>',
    'moon': '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    'sliders': '<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
    'keyboard': '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 13h6"/>',
    'film': '<rect x="2.5" y="3" width="19" height="18" rx="2.5"/><path d="M7 3v18M17 3v18M2.5 8h4.5M2.5 12h4.5M2.5 16h4.5M17 8h4.5M17 12h4.5M17 16h4.5"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'image-broken': '<path d="M21 15.5 16 10.5 12 14.5"/><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z"/><path d="m9 3 1.5 2.5L9 8l1.5 2.5"/>',
    'alert': '<path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z"/><path d="M12 9v4m0 4h.01"/>',
    'grid': '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
    'layers': '<path d="m12 2 10 5.5L12 13 2 7.5 12 2z"/><path d="m2 12.5 10 5.5 10-5.5"/>',
    'camera': '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    'edit': '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    'undo': '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-1"/>',
    'redo': '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h1"/>',
    'refresh': '<path d="M20 11a8.1 8.1 0 1 0 1.7 5"/><path d="M21 4v7h-7"/>',
    'shield-check': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    'mouse-pointer': '<path d="m4 4 7.5 16.8 2.1-7.2 7.2-2.1L4 4z"/><path d="m13.6 13.6 5 5"/>',
    'pen': '<path d="m4 20 4.5-1 10.7-10.7a2.1 2.1 0 0 0-3-3L5.5 16 4 20z"/><path d="m14.8 6.2 3 3"/>',
    'minus': '<path d="M5 12h14"/>',
    'square': '<rect x="4" y="4" width="16" height="16" rx="2"/>',
    'circle': '<circle cx="12" cy="12" r="8.5"/>',
    'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
    'type': '<path d="M4 6V4h16v2M12 4v16M8 20h8"/>',
  };

  /** 渲染一个图标 */
  Pico.icon = function (name, size) {
    size = size || 18;
    return '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[name] || '') + '</svg>';
  };

  /** 将容器内所有 [data-icon] 占位替换为图标 */
  Pico.hydrateIcons = function (root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
      el.innerHTML = Pico.icon(el.getAttribute('data-icon'), el.dataset.iconSize ? +el.dataset.iconSize : undefined);
    });
  };

  /* ---------- 品牌图标 ---------- */
  Pico.logoSVG = function (size) {
    size = size || 40;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 64 64" aria-hidden="true">' +
      '<defs><linearGradient id="picoLogoGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6A8DFF"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs>' +
      '<rect x="3" y="3" width="58" height="58" rx="13" fill="url(#picoLogoGradient)"/>' +
      '<rect x="15" y="15" width="34" height="34" rx="4" fill="#F4F7FF"/>' +
      '<circle cx="24" cy="24" r="3.2" fill="#6A8DFF"/>' +
      '<path d="M18 45 27 34 34 41 39 36 46 45Z" fill="#4660B7"/>' +
      '<path d="M18 45h28" fill="none" stroke="#263873" stroke-width="2.5" stroke-linecap="round"/></svg>';
  };

  /* ---------- 通用工具 ---------- */
  const clamp = function (v, min, max) { return Math.min(max, Math.max(min, v)); };
  Pico.clamp = clamp;

  Pico.formatBytes = function (bytes) {
    if (bytes === 0) return '0 B';
    if (!bytes && bytes !== 0) return '—';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const v = bytes / Math.pow(1024, i);
    return (i === 0 ? v : v.toFixed(v >= 100 ? 0 : 1)) + ' ' + u[i];
  };

  Pico.formatDate = function (ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };

  Pico.extOf = function (name) {
    const m = /\.([a-z0-9]+)$/i.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  };

  Pico.mimeForName = function (name) {
    const ext = Pico.extOf(name);
    return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp',
      ico: 'image/x-icon', svg: 'image/svg+xml', psd: 'image/vnd.adobe.photoshop',
      psb: 'image/vnd.adobe.photoshop', ai: 'application/postscript', dwg: 'image/vnd.dwg' })[ext] || 'application/octet-stream';
  };

  Pico.isImageFile = function (file) {
    if (file.type && file.type.startsWith('image/')) return true;
    const ext = Pico.extOf(file.name);
    return ['jpg', 'jpeg', 'jfif', 'png', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg', 'psd', 'psb', 'ai', 'dwg'].indexOf(ext) >= 0;
  };

  Pico.uid = (function () { let n = 0; return function () { return ++n; }; })();

  Pico.escapeHTML = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  Pico.debounce = function (fn, ms) {
    let t;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t); t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };

  Pico.nextFrame = function (fn) { return requestAnimationFrame(function () { requestAnimationFrame(fn); }); };

  /** 将图片 Blob/File 写入 Windows 剪贴板。 */
  Pico.copyImageBlob = async function (blob) {
    if (!blob || !navigator.clipboard || !window.ClipboardItem) throw new Error('clipboard');
    const type = blob.type || 'image/png';
    await navigator.clipboard.write([new window.ClipboardItem({ [type]: blob })]);
    return true;
  };

  /** 将 Blob 保存到用户选择的位置；不支持 File System Access API 时回退为下载。 */
  Pico.saveBlob = async function (blob, name, mime) {
    if (!blob) return false;
    const type = mime || blob.type || 'application/octet-stream';
    if (window.showSaveFilePicker && window.isSecureContext) {
      const ext = (String(name).match(/\.([a-z0-9]+)$/i) || [])[1] || 'bin';
      const descriptions = { png: 'PNG 图片', jpg: 'JPEG 图片', jpeg: 'JPEG 图片', webp: 'WebP 图片' };
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: descriptions[ext.toLowerCase()] || '图片文件', accept: { [type]: ['.' + ext] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch (e) {
        if (e && e.name === 'AbortError') return false;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name || 'pico-image';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    return true;
  };

  /* ---------- Toast 通知 ---------- */
  const toastRoot = function () { return document.getElementById('toasts'); };

  /**
   * Pico.toast('已导入 12 张图片')
   * Pico.toast('已移除 x.jpg', {type:'warn', action:{label:'撤销', fn}, duration: 5000})
   */
  Pico.toast = function (msg, opts) {
    opts = opts || {};
    let root = toastRoot();
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast' + (opts.type ? ' toast-' + opts.type : '');
    const icName = opts.type === 'warn' ? 'alert' : (opts.type === 'ok' ? 'check' : 'info');
    el.innerHTML = Pico.icon(icName, 16) + '<div class="toast-msg">' + Pico.escapeHTML(msg) + '</div>';
    if (opts.action) {
      const btn = document.createElement('button');
      btn.className = 'toast-act';
      btn.textContent = opts.action.label;
      btn.addEventListener('click', function () { opts.action.fn(); dismiss(); });
      el.appendChild(btn);
    }
    root.appendChild(el);
    let closed = false;
    const dismiss = function () {
      if (closed) return; closed = true;
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 260);
    };
    requestAnimationFrame(function () { el.classList.add('in'); });
    const dur = opts.duration != null ? opts.duration : 3200;
    if (dur > 0) setTimeout(dismiss, dur);
    return dismiss;
  };
})();
