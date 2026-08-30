/* ============================================================
 * Pico 图片查看器 · app.js
 * 数据导入（文件/文件夹/拖拽/粘贴/演示）、网格浏览、
 * 分类侧栏、排序搜索、设置与本地图库持久化、全局快捷键
 * ============================================================ */
(function () {
  'use strict';
  const Pico = window.Pico;
  const $ = function (id) { return document.getElementById(id); };
  const clamp = Pico.clamp;

  /* ══════════════ 设置（localStorage 持久化） ══════════════ */
  const SKEY = 'pico.settings.v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch (e) { saved = {}; }
  const settings = Object.assign({
    theme: 'dark',        // auto | dark | light
    thumbSize: 'm',       // s | m | l
    sortBy: 'name',       // name | date | size | type | random
    sortAsc: true,
    wheel: 'zoom',        // zoom | nav
    interval: 3,          // 幻灯片秒数
    loop: true,           // 循环播放
    strip: true,          // 胶片栏
    categoryId: null,     // 当前分类；null=全部
    search: '',           // 关闭应用后恢复搜索条件
  }, saved);
  const saveSettings = function () { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) {} };

  /* ══════════════ 数据 ══════════════ */
  const CATEGORY_KEY = 'pico.categories.v1';
  const LIBRARY_DB = 'pico.library.v1';
  const LIBRARY_STORE = 'images';
  const UNCATEGORIZED_ID = 'uncategorized';
  let categories = [];
  try {
    const raw = JSON.parse(localStorage.getItem(CATEGORY_KEY) || '[]');
    const seen = new Set();
    const savedCategories = Array.isArray(raw) ? raw : [];
    const uncategorized = savedCategories.find(function (c) { return c && c.id === UNCATEGORIZED_ID; });
    categories.push({ id: UNCATEGORIZED_ID, name: String(uncategorized && uncategorized.name || '未分类').trim() || '未分类' });
    seen.add(UNCATEGORIZED_ID);
    savedCategories.forEach(function (c) {
      if (!c || !c.id || seen.has(String(c.id))) return;
      const name = String(c.name || '').trim();
      if (!name) return;
      categories.push({ id: String(c.id), name: name.slice(0, 40) });
      seen.add(String(c.id));
    });
  } catch (e) {
    categories = [{ id: UNCATEGORIZED_ID, name: '未分类' }];
  }
  if (!categories.length) categories = [{ id: UNCATEGORIZED_ID, name: '未分类' }];
  const saveCategories = function () {
    try { localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories)); } catch (e) {}
  };
  saveCategories();
  const categoryExists = function (id) { return categories.some(function (c) { return c.id === id; }); };
  const validCategoryId = function (id) { return categoryExists(id) ? id : UNCATEGORIZED_ID; };
  let categoryId = categoryExists(settings.categoryId) ? settings.categoryId : null;
  let restoring = true;
  let categorySeq = 0;

  const items = new Map();      // id -> item
  const dedupe = new Set();     // 去重键
  let visible = [];             // 过滤+排序后的当前列表
  let search = String(settings.search || '');
  let listVersion = 0;
  const selectedIds = new Set(); // 图库多选状态（只保存图片 id，不复制文件对象）
  let selectionMode = false;
  let libraryOrder = 0;
  let libraryDBPromise = null;
  let libraryPersistence = true;
  let libraryWriteTail = Promise.resolve();
  let contextTarget = null;
  let categoryDialogMode = 'new';
  let categoryDialogTarget = null;
  let screenCropCtl = null;

  const keyOf = function (it) { return it.dir + '\u0000' + it.name + '\u0000' + it.size + '\u0000' + it.mtime; };

  function openLibraryDB() {
    if (!window.indexedDB) return Promise.reject(new Error('当前环境不支持本地图库存储'));
    if (libraryDBPromise) return libraryDBPromise;
    libraryDBPromise = new Promise(function (resolve, reject) {
      const request = window.indexedDB.open(LIBRARY_DB, 1);
      request.onupgradeneeded = function () {
        const db = request.result;
        if (!db.objectStoreNames.contains(LIBRARY_STORE)) db.createObjectStore(LIBRARY_STORE, { keyPath: 'key' });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('无法打开本地图库')); };
    });
    return libraryDBPromise;
  }

  function libraryRequest(mode, operation) {
    return openLibraryDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        let tx;
        try { tx = db.transaction(LIBRARY_STORE, mode); }
        catch (e) { reject(e); return; }
        const store = tx.objectStore(LIBRARY_STORE);
        let request;
        let result;
        let settled = false;
        const fail = function (error) {
          if (settled) return;
          settled = true;
          reject(error || new Error('图库数据操作失败'));
        };
        try { request = operation(store); }
        catch (e) { fail(e); return; }
        if (request) {
          request.onsuccess = function () { result = request.result; };
          request.onerror = function () { fail(request.error || new Error('图库数据操作失败')); };
        }
        tx.oncomplete = function () {
          if (settled) return;
          settled = true;
          resolve(result);
        };
        tx.onerror = function () { fail(tx.error || new Error('图库数据操作失败')); };
        tx.onabort = function () { fail(tx.error || new Error('图库数据操作已取消')); };
      });
    });
  }

  function queueLibraryWrite(work) {
    if (!libraryPersistence) return Promise.resolve();
    libraryWriteTail = libraryWriteTail.then(work).catch(function () {
      libraryPersistence = false;
    });
    return libraryWriteTail;
  }

  function itemRecord(it) {
    return {
      key: it.storageKey || keyOf(it), blob: it.file, name: it.name, dir: it.dir || '',
      // Windows 独立版会把原生选择器返回的绝对路径写入 item；同时从
      // File.path 兜底，避免旧记录在中间流程里丢掉真实文件位置。
      path: it.path || absolutePathOf(it.file) || '', categoryId: validCategoryId(it.categoryId), size: it.size || 0,
      mtime: it.mtime || 0, w: it.w || 0, h: it.h || 0, rot: it.rot || 0,
      rand: it.rand || Math.random(), order: it.order || (++libraryOrder),
    };
  }

  function persistItem(it) {
    if (!it || !it.file) return Promise.resolve();
    return queueLibraryWrite(function () { return libraryRequest('readwrite', function (store) { return store.put(itemRecord(it)); }); });
  }

  function deleteItemRecord(it) {
    if (!it) return Promise.resolve();
    return queueLibraryWrite(function () { return libraryRequest('readwrite', function (store) { return store.delete(it.storageKey || keyOf(it)); }); });
  }

  function loadLibraryRecords() {
    return libraryRequest('readonly', function (store) { return store.getAll(); });
  }

  function absolutePathOf(file) {
    const value = String(file && (file.path || file.webkitPath || '') || '').trim();
    return /^[a-z]:[\\/]/i.test(value) || /^\\\\/.test(value) ? value : '';
  }

  function defaultCategoryId() {
    return categoryId && categoryExists(categoryId) ? categoryId : UNCATEGORIZED_ID;
  }

  const grid = $('grid'), welcome = $('welcome');

  /* ══════════════ 查看器 ══════════════ */
  let editorCtl = null;
  const viewerCtl = Pico.initViewer({
    getList: function () { return visible; },
    getSettings: function () { return settings; },
    onDelete: function (i) { const it = visible[i]; if (it) removeItem(it); },
    onChange: function (it) { persistItem(it); },
    onClose: function () { grid.focus(); },
    onEdit: function (it) { if (editorCtl) editorCtl.open(it); },
    onSaveAs: function (it) { if (converterCtl) converterCtl.open(it); },
    onCapture: function () { captureScreen(); },
  });
  screenCropCtl = Pico.initScreenCrop();

  /* ══════════════ 编辑器 ══════════════ */
  editorCtl = Pico.initEditor({
    onSave: function (result) { return Pico.saveBlob(result.blob, result.name, result.mime); },
    onAdd: async function (result) {
      const original = result.item;
      const file = result.file;
      const added = await addFiles([{ file: file, dir: original.dir || '', categoryId: original.categoryId }], true);
      return !!added;
    },
  });

  /* ══════════════ 另存为 / 格式转换器 ══════════════ */
  let converterCtl = null;
  converterCtl = Pico.initConverter({
    getCurrent: function () { return viewerCtl.current(); },
    getVisible: function () { return visible.slice(); },
    getSelected: function () {
      return Array.from(selectedIds).map(function (id) { return items.get(id); }).filter(Boolean);
    },
    getAll: function () { return Array.from(items.values()); },
    onSave: function (result) { return Pico.saveBlob(result.blob, result.name, result.mime); },
    onAdd: async function (result) {
      const added = await addFiles([{ file: result.file, dir: result.item.dir || '', categoryId: result.item.categoryId }], true);
      return !!added;
    },
  });

  /* ══════════════ 缩略图生成队列 ══════════════ */
  const thumbQueue = [];
  const scheduled = new Set();
  let active = 0;

  function scheduleThumb(item, priority) {
    if (item.thumbURL || item.broken || scheduled.has(item.id)) return;
    scheduled.add(item.id);
    if (priority) thumbQueue.unshift(item); else thumbQueue.push(item);
    pump();
  }
  function pump() {
    while (active < 4 && thumbQueue.length) {
      const it = thumbQueue.shift();
      active++;
      makeThumb(it).catch(function () {}).then(function () { active--; pump(); });
    }
  }
  function decodeViaImage(url) {
    return new Promise(function (res, rej) {
      const im = new Image();
      im.onload = function () { res(im); };
      im.onerror = rej;
      im.src = url;
    });
  }
  async function makeThumb(item) {
    let bmp = null;
    try {
      const previewURL = typeof Pico.ensurePreview === 'function' ? await Pico.ensurePreview(item) : item.url;
      try {
        // 普通图片直接从 File 解码；PSD/AI/DWG 则使用 formats.js 生成的
        // 临时预览 Blob，避免把原始设计文件交给浏览器图片解码器。
        bmp = await createImageBitmap(item.file);
      } catch (e) {
        try {
          const response = await fetch(previewURL);
          bmp = await createImageBitmap(await response.blob());
        } catch (decodeError) {
          bmp = await decodeViaImage(previewURL);
        }
      }
      const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
      if (!w || !h) throw new Error('no size');
      item.w = w; item.h = h;
      // L 档缩略图会显示到数百 CSS 像素，640px 在高 DPI/大窗口下会明显发糊。
      // 保留足够的采样余量，同时避免直接为图库中的每张大图保留原尺寸副本。
      const maxSide = 2048;
      const sc = Math.min(1, maxSide / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * sc));
      c.height = Math.max(1, Math.round(h * sc));
      const thumbCtx = c.getContext('2d');
      thumbCtx.imageSmoothingEnabled = true;
      thumbCtx.imageSmoothingQuality = 'high';
      thumbCtx.drawImage(bmp, 0, 0, c.width, c.height);
      let blob = await new Promise(function (res) { c.toBlob(res, 'image/webp', 0.94); });
      if (!blob) blob = await new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.94); });
      if (blob) {
        item.thumbURL = URL.createObjectURL(blob);
        updateTile(item);
        viewerCtl.notifyThumb(item);
      }
    } catch (e) {
      item.broken = true;
      item.previewError = e;
      updateTile(item);
    } finally {
      if (bmp && bmp.close) { try { bmp.close(); } catch (e) {} }
    }
  }

  const io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        const it = items.get(+en.target.dataset.id);
        if (it) scheduleThumb(it, true);
        io.unobserve(en.target);
      }
    });
  }, { root: grid, rootMargin: '400px' }) : null;

  /** 后台缓慢补齐剩余缩略图 */
  function trickle() {
    setTimeout(function () {
      for (const it of items.values()) {
        if (!it.thumbURL && !it.broken && !scheduled.has(it.id)) {
          scheduleThumb(it, false);
          trickle();
          return;
        }
      }
    }, 350);
  }

  /* ══════════════ 导入 ══════════════ */
  async function addFiles(entries, quiet) {
    // entries: [{file, dir}]
    const t0 = performance.now();
    let added = 0, dup = 0;
    const addedItems = [];
    const pathUpdates = [];
    for (const en of entries) {
      const f = en.file;
      if (!Pico.isImageFile(f)) continue;
      const dir = en.dir || '';
      const key = dir + '\u0000' + f.name + '\u0000' + f.size + '\u0000' + f.lastModified;
      const incomingPath = absolutePathOf(f) || absolutePathOf({ path: en.path });
      if (dedupe.has(key)) {
        // 同一图片如果曾经通过浏览器拖拽/旧版本导入，记录可能没有原始路径。
        // 之后用独立版原生选择器重新导入时，补齐已有记录而不是简单跳过。
        const existing = Array.from(items.values()).find(function (current) {
          return (current.storageKey || keyOf(current)) === key;
        });
        if (existing && incomingPath && existing.path !== incomingPath) {
          existing.path = incomingPath;
          pathUpdates.push(existing);
        }
        dup++;
        continue;
      }
      dedupe.add(key);
      const it = {
        id: Pico.uid(), file: f, name: f.name, dir: dir,
        size: f.size, mtime: f.lastModified,
        url: URL.createObjectURL(f), thumbURL: '',
        w: 0, h: 0, rot: 0, exif: undefined, rand: Math.random(), order: ++libraryOrder,
        storageKey: key, path: incomingPath, categoryId: validCategoryId(en.categoryId || defaultCategoryId()),
      };
      items.set(it.id, it);
      addedItems.push(it);
      added++;
    }
    if (added) {
      listVersion++;
      renderAll();
      viewerCtl.refresh();
      trickle();
      await Promise.all(addedItems.concat(pathUpdates).map(persistItem));
      if (!quiet) {
        const ms = Math.round(performance.now() - t0);
        Pico.toast('已导入 ' + added + ' 张图片' + (dup ? '（跳过重复 ' + dup + ' 张）' : '') + ' · ' + ms + ' ms', { type: 'ok' });
      }
    } else if (pathUpdates.length) {
      await Promise.all(pathUpdates.map(persistItem));
      if (!quiet) Pico.toast('已补全 ' + pathUpdates.length + ' 张图片的本地路径', { type: 'ok' });
    } else if (!quiet) {
      Pico.toast(dup ? '没有新增图片（全部重复）' : '未找到可识别的图片文件', { type: 'warn' });
    }
    return added;
  }

  async function restoreLibrary() {
    let records = [];
    try {
      records = await loadLibraryRecords();
      records.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      for (const record of records) {
        if (!record || !record.blob) continue;
        const name = String(record.name || record.blob.name || 'pico-image');
        const file = typeof File === 'function'
          ? new File([record.blob], name, { type: record.blob.type || Pico.mimeForName(name), lastModified: record.mtime || Date.now() })
          : record.blob;
        const key = String(record.key || ((record.dir || '') + '\u0000' + name + '\u0000' + (record.size || file.size || 0) + '\u0000' + (record.mtime || file.lastModified || 0)));
        if (dedupe.has(key)) continue;
        const order = Number(record.order) || (++libraryOrder);
        libraryOrder = Math.max(libraryOrder, order);
        const it = {
          id: Pico.uid(), file: file, name: name, dir: record.dir || '',
          size: record.size || file.size || 0, mtime: record.mtime || file.lastModified || 0,
          url: URL.createObjectURL(file), thumbURL: '',
          w: record.w || 0, h: record.h || 0, rot: record.rot || 0, exif: undefined,
          rand: record.rand || Math.random(), order: order, storageKey: key, path: record.path || '',
          categoryId: validCategoryId(record.categoryId),
        };
        items.set(it.id, it);
        dedupe.add(key);
      }
    } catch (e) {
      libraryPersistence = false;
      Pico.toast('本地图库恢复失败，后续导入仍可使用', { type: 'warn' });
    } finally {
      restoring = false;
      renderAll();
      viewerCtl.refresh();
      if (items.size) trickle();
    }
  }

  /* 从资源管理器双击/右键“打开方式”启动时，Windows 会把文件路径放进
   * Pico.exe 的命令行参数。独立版原生桥接把它转换成带真实绝对路径的图片，
   * 导入后既能立即查看，也能在图库重启后继续定位原文件。 */
  async function importLaunchFiles() {
    if (typeof window.picoGetLaunchFiles !== 'function') return;
    let entries = [];
    try { entries = await pickNativeFiles('picoGetLaunchFiles'); }
    catch (e) {
      Pico.toast('无法读取从 Windows 打开的图片', { type: 'warn' });
      return;
    }
    if (!entries || !entries.length) return;
    await addFiles(entries, true);
    computeVisible();
    const firstPath = String(entries[0].path || '');
    const first = (firstPath && Array.from(items.values()).find(function (it) { return it.path === firstPath; })) ||
      Array.from(items.values()).find(function (it) { return entries.some(function (en) { return en.file && en.file.name === it.name; }); });
    if (first) {
      computeVisible();
      const index = visible.indexOf(first);
      if (index >= 0) viewerCtl.open(index);
    }
  }

  function filesFromInput(input) {
    const out = [];
    for (const f of input.files) {
      const rel = f.webkitRelativePath || '';
      const parts = rel ? rel.split('/').slice(0, -1) : [];
      out.push({ file: f, dir: parts.join('/') });
    }
    return out;
  }

  function fileFromNativeEntry(entry) {
    if (!entry || !entry.name || typeof entry.data !== 'string') return null;
    try {
      const raw = atob(entry.data);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const name = String(entry.name);
      const path = absolutePathOf({ path: entry.path });
      const file = new File([bytes], name, {
        type: String(entry.type || Pico.mimeForName(name)),
        lastModified: Number(entry.lastModified) || Date.now(),
      });
      // Chromium 不会从 <input type=file> 暴露本地路径；独立版原生选择器
      // 返回的路径同时放入 File 和 entry，兼容所有后续导入/持久化逻辑。
      try { Object.defineProperty(file, 'path', { value: path, configurable: true }); } catch (e) {}
      return { file: file, dir: String(entry.dir || ''), path: path, categoryId: categoryIdForNewItem() };
    } catch (e) {
      return null;
    }
  }

  async function pickNativeFiles(bindingName) {
    if (typeof window[bindingName] !== 'function') return null;
    const entries = await window[bindingName]();
    if (!Array.isArray(entries)) return [];
    return entries.map(fileFromNativeEntry).filter(Boolean);
  }

  function walkEntry(entry, path, out) {
    return new Promise(function (res) {
      if (entry.isFile) {
        entry.file(function (f) { out.push({ file: f, dir: path }); res(); }, function () { res(); });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const collected = [];
        const readBatch = function () {
          reader.readEntries(async function (ents) {
            if (!ents.length) {
              for (const e of collected) await walkEntry(e, path + entry.name + '/', out);
              res();
            } else { collected.push.apply(collected, Array.from(ents)); readBatch(); }
          }, function () { res(); });
        };
        readBatch();
      } else res();
    });
  }
  async function filesFromDrop(dt) {
    const out = [];
    if (dt.items && dt.items.length && dt.items[0].webkitGetAsEntry) {
      const roots = [];
      for (const it of dt.items) { const e = it.webkitGetAsEntry(); if (e) roots.push(e); }
      for (const r of roots) await walkEntry(r, '', out);
    } else if (dt.files) {
      for (const f of dt.files) out.push({ file: f, dir: '' });
    }
    return out;
  }

  async function walkDirHandle(handle, path, out, budget) {
    for await (const entry of handle.values()) {
      if (entry.kind === 'file') {
        if (!budget()) return;
        try {
          const f = await entry.getFile();
          if (Pico.isImageFile(f)) out.push({ file: f, dir: path });
        } catch (e) {}
      } else if (entry.kind === 'directory') {
        await walkDirHandle(entry, path + entry.name + '/', out, budget);
      }
    }
  }
  async function openFolder() {
    if (typeof window.picoPickFolder === 'function') {
      const t = Pico.toast('请选择要导入的图片文件夹…', { duration: 0 });
      try {
        const entries = await pickNativeFiles('picoPickFolder');
        if (entries && entries.length) await addFiles(entries);
      } catch (e) {
        Pico.toast('读取文件夹失败，请重试', { type: 'warn' });
      } finally {
        t();
      }
      return;
    }
    if (window.showDirectoryPicker) {
      let dir = null;
      try { dir = await window.showDirectoryPicker({ mode: 'read' }); }
      catch (e) { if (e && e.name === 'AbortError') return; }
      if (!dir) return;
      const t = Pico.toast('正在扫描「' + dir.name + '」…', { duration: 0 });
      const list = [];
      let n = 0;
      try { await walkDirHandle(dir, '', list, function () { return ++n < 20000; }); } catch (e) {}
      t();
      await addFiles(list);
    } else {
      $('dirInput').click();
    }
  }

  /* ══════════════ 屏幕截图 ══════════════ */
  let captureBusy = false;
  async function captureScreen() {
    if (captureBusy) return;
    captureBusy = true;
    const cropPromise = screenCropCtl.open();
    try {
      const frame = await Pico.captureScreenFrame();
      screenCropCtl.setFrame(frame);
      const file = await cropPromise;
      if (!file) return;
      let copied = false;
      try {
        // Confirm/double-click is a user gesture in the crop layer.  On the
        // native build this puts the finished PNG on the Windows clipboard
        // before opening it in the editor.
        copied = await Pico.copyImageBlob(file);
      } catch (e) {}
      const added = await addFiles([{ file: file, dir: '屏幕截图' }]);
      if (added) {
        computeVisible();
        const it = Array.from(items.values()).find(function (x) { return x.file === file; });
        if (it && editorCtl) editorCtl.open(it);
        Pico.toast(copied ? '截图已复制到剪贴板并进入编辑器' : '截图已进入编辑器（剪贴板复制失败）', {
          type: copied ? 'ok' : 'warn', duration: 2400,
        });
      } else if (copied) {
        Pico.toast('截图已复制到剪贴板', { type: 'ok' });
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      const msg = e && e.code === 'UNSUPPORTED'
        ? '当前环境不支持截图，请使用独立版应用或最新 Chrome / Edge'
        : '截图失败，请重新选择要共享的屏幕或窗口';
      Pico.toast(msg, { type: 'warn' });
    } finally {
      screenCropCtl.close();
      captureBusy = false;
    }
  }

  // 由 Windows RegisterHotKey 调用；保留一个轻量全局入口，避免把 DOM 事件
  // 当成唯一来源。captureBusy 会合并原生热键与窗口聚焦时的 keydown 重复触发。
  window.picoGlobalScreenshot = function () { return captureScreen(); };

  /* ══════════════ 删除与撤销 ══════════════ */
  let lastRemoved = null;
  function removeItems(input) {
    const targets = Array.from(new Set((input || []).filter(function (it) { return it && items.has(it.id); })));
    if (!targets.length) return;
    targets.forEach(function (it) {
      selectedIds.delete(it.id);
      items.delete(it.id);
      dedupe.delete(it.storageKey || keyOf(it));
      deleteItemRecord(it);
      URL.revokeObjectURL(it.url);
      if (it.thumbURL) URL.revokeObjectURL(it.thumbURL);
      it.url = '';
      it.thumbURL = '';
    });
    lastRemoved = targets;
    listVersion++;
    renderAll();
    viewerCtl.refresh();
    if (!items.size) viewerCtl.close();
    const label = targets.length === 1 ? '已从列表移除 ' + targets[0].name : '已从列表移除 ' + targets.length + ' 张图片';
    Pico.toast(label, {
      type: 'warn', duration: 5000,
      action: {
        label: '撤销',
        fn: function () {
          if (lastRemoved !== targets) return;
          targets.forEach(function (it) {
            it.url = URL.createObjectURL(it.file);
            it.thumbURL = '';
            it.broken = false;
            dedupe.add(it.storageKey || keyOf(it));
            items.set(it.id, it);
            persistItem(it);
          });
          lastRemoved = null;
          listVersion++;
          renderAll();
          viewerCtl.refresh();
          trickle();
        },
      },
    });
  }
  function removeItem(it) { removeItems([it]); }
  function removeSelectedItems() {
    const targets = Array.from(selectedIds).map(function (id) { return items.get(id); }).filter(Boolean);
    if (!targets.length) {
      Pico.toast('请先选择要删除的图片', { type: 'warn' });
      return;
    }
    removeItems(targets);
  }

  /* ══════════════ 排序与渲染 ══════════════ */
  const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });
  const SORT_LABEL = { name: '按名称', date: '按时间', size: '按大小', type: '按类型', random: '随机' };

  function sortVisible(arr) {
    const dir = settings.sortAsc ? 1 : -1;
    switch (settings.sortBy) {
      case 'date': arr.sort(function (a, b) { return dir * (a.mtime - b.mtime); }); break;
      case 'size': arr.sort(function (a, b) { return dir * (a.size - b.size); }); break;
      case 'type': arr.sort(function (a, b) {
        const r = (Pico.extOf(a.name) || '').localeCompare(Pico.extOf(b.name) || '');
        return r !== 0 ? dir * r : collator.compare(a.name, b.name);
      }); break;
      case 'random': arr.sort(function (a, b) { return a.rand - b.rand; }); break;
      default: arr.sort(function (a, b) { return dir * collator.compare(a.name, b.name); });
    }
    return arr;
  }

  function computeVisible() {
    const q = search.trim().toLowerCase();
    visible = Array.from(items.values()).filter(function (it) {
      if (categoryId !== null && validCategoryId(it.categoryId) !== categoryId) return false;
      if (q && it.name.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    sortVisible(visible);
  }

  function syncSelectedTile(tile, selected) {
    if (!tile) return;
    tile.classList.toggle('selected', selected);
    tile.setAttribute('aria-pressed', selected ? 'true' : 'false');
    const mark = tile.querySelector('.tile-select');
    if (mark) mark.textContent = selected ? '✓' : '';
  }

  function syncSelectionUI() {
    const bar = $('selectionBar');
    const button = $('btnSelectMode');
    const count = $('selectionCount');
    const allButton = $('btnSelectAll');
    const deleteButton = $('btnSelectionDelete');
    const convertButton = $('btnSelectionConvert');
    if (!bar || !button || !count) return;
    bar.hidden = !selectionMode;
    button.classList.toggle('on', selectionMode);
    button.setAttribute('aria-pressed', selectionMode ? 'true' : 'false');
    grid.classList.toggle('selection-mode', selectionMode);
    count.textContent = String(selectedIds.size);
    if (allButton) {
      const allVisible = visible.length > 0 && visible.every(function (it) { return selectedIds.has(it.id); });
      allButton.textContent = allVisible ? '取消全选当前' : '全选当前' + (visible.length ? '（' + visible.length + '）' : '');
      allButton.disabled = !visible.length;
    }
    if (deleteButton) deleteButton.disabled = !selectedIds.size;
    if (convertButton) convertButton.disabled = !selectedIds.size;
  }

  function setSelectionMode(on) {
    selectionMode = !!on;
    if (!selectionMode) selectedIds.clear();
    renderGrid();
    syncSelectionUI();
  }

  function toggleSelected(id) {
    if (!items.has(id)) return;
    if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
    syncSelectedTile(grid.querySelector('.tile[data-id="' + id + '"]'), selectedIds.has(id));
    syncSelectionUI();
  }

  function toggleVisibleSelection() {
    if (!visible.length) return;
    const allVisible = visible.every(function (it) { return selectedIds.has(it.id); });
    visible.forEach(function (it) {
      if (allVisible) selectedIds.delete(it.id); else selectedIds.add(it.id);
      syncSelectedTile(grid.querySelector('.tile[data-id="' + it.id + '"]'), !allVisible);
    });
    syncSelectionUI();
  }

  function tileHTML(it, i) {
    const esc = Pico.escapeHTML;
    const selected = selectedIds.has(it.id);
    let inner;
    if (it.broken) {
      inner = '<div class="ph broken">' + Pico.icon('image-broken', 26) + '</div>';
    } else if (it.thumbURL) {
      inner = '<img src="' + it.thumbURL + '" alt="" loading="lazy" decoding="async">';
    } else {
      inner = '<div class="ph">' + Pico.icon('image', 26) + '</div>';
    }
    return '<button class="tile' + (selected ? ' selected' : '') + '" type="button" draggable="true" data-id="' + it.id + '" data-i="' + i + '" tabindex="0" aria-pressed="' + (selected ? 'true' : 'false') + '" title="' + esc(it.name) + '">' +
      '<span class="tile-select" aria-hidden="true">' + (selected ? '✓' : '') + '</span>' +
      inner +
      '<span class="ext">' + (Pico.extOf(it.name) || '?') + '</span>' +
      '<span class="cap"><span class="n">' + esc(it.name) + '</span>' +
      '<span class="s">' + (it.w ? it.w + '×' + it.h + ' · ' : '') + Pico.formatBytes(it.size) + '</span></span>' +
      '</button>';
  }

  function renderGrid() {
    computeVisible();
    const scroll = grid.scrollTop;
    const frag = document.createDocumentFragment();
    const holder = document.createElement('div');
    holder.innerHTML = visible.map(tileHTML).join('');
    while (holder.firstChild) { frag.appendChild(holder.firstChild); }
    grid.replaceChildren(frag);
    grid.classList.toggle('selection-mode', selectionMode);
    grid.scrollTop = scroll;
    if (io) {
      grid.querySelectorAll('.tile').forEach(function (t) {
        const it = items.get(+t.dataset.id);
        if (it && it.thumbURL) return;
        io.observe(t);
      });
    }
    syncSelectionUI();
  }

  function updateTile(it) {
    const tile = grid.querySelector('.tile[data-id="' + it.id + '"]');
    if (!tile) return;
    const i = +tile.dataset.i;
    const tmp = document.createElement('div');
    tmp.innerHTML = tileHTML(it, i);
    tile.replaceWith(tmp.firstChild);
    if (io && !it.thumbURL) io.observe(grid.querySelector('.tile[data-id="' + it.id + '"]'));
  }

  function renderCategories() {
    const counts = new Map();
    let totalSize = 0;
    items.forEach(function (it) {
      const k = validCategoryId(it.categoryId);
      counts.set(k, (counts.get(k) || 0) + 1);
      totalSize += it.size;
    });

    const side = $('folderList');
    let html = '';
    const item = function (key, label, icon, count, sel) {
      return '<button class="folder-item' + (sel ? ' sel' : '') + '" data-category-id="' + Pico.escapeHTML(key == null ? '@all' : key) + '" type="button" draggable="false">' +
        '<span class="f-ic">' + Pico.icon(icon, 15) + '</span>' +
        '<span class="f-name">' + Pico.escapeHTML(label) + '</span>' +
        '<span class="f-count">' + count + '</span></button>';
    };
    html += item(null, '全部图片', 'grid', items.size, categoryId === null);
    categories.slice().sort(function (a, b) {
      if (a.id === UNCATEGORIZED_ID) return -1;
      if (b.id === UNCATEGORIZED_ID) return 1;
      return collator.compare(a.name, b.name);
    }).forEach(function (c) {
      html += item(c.id, c.name, 'folder', counts.get(c.id) || 0, categoryId === c.id);
    });
    side.innerHTML = html;
    $('sideStat').innerHTML = restoring ? '正在恢复本地图库…' : ('共 ' + items.size + ' 张图片<br>合计 ' + Pico.formatBytes(totalSize));
    const canManage = categoryId !== null && categoryId !== UNCATEGORIZED_ID && categoryExists(categoryId);
    $('btnRenameCategory').disabled = !canManage;
    const deleteButton = $('btnDeleteCategory');
    if (deleteButton) deleteButton.disabled = !canManage;
  }

  function renderAll() {
    renderCategories();
    renderGrid();
    welcome.hidden = items.size > 0 || restoring;
    $('dropOverlay').classList.remove('on');
  }

  /* ══════════════ 分类 ══════════════ */
  function categoryIdForNewItem() {
    return defaultCategoryId();
  }

  function newCategoryId() {
    categorySeq++;
    return 'category-' + Date.now().toString(36) + '-' + categorySeq.toString(36);
  }

  function setActiveCategory(id) {
    categoryId = id == null || id === '@all' ? null : validCategoryId(id);
    settings.categoryId = categoryId;
    saveSettings();
    renderCategories();
    renderGrid();
  }

  function openCategoryDialog(mode, target) {
    categoryDialogMode = mode;
    categoryDialogTarget = target || null;
    const dlg = $('categoryDlg');
    $('categoryDlgTitle').textContent = mode === 'rename' ? '重命名分类' : '新建分类';
    const input = $('categoryNameInput');
    input.value = mode === 'rename' && target ? target.name : '';
    if (!dlg.open) dlg.showModal();
    window.setTimeout(function () { input.focus(); input.select(); }, 0);
  }

  function saveCategoryDialog() {
    const input = $('categoryNameInput');
    const name = input.value.trim().slice(0, 40);
    if (!name) { Pico.toast('请输入分类名称', { type: 'warn' }); input.focus(); return; }
    const duplicate = categories.some(function (c) {
      return (!categoryDialogTarget || c.id !== categoryDialogTarget.id) && c.name.toLowerCase() === name.toLowerCase();
    });
    if (duplicate) { Pico.toast('已有同名分类', { type: 'warn' }); input.focus(); return; }
    if (categoryDialogMode === 'rename' && categoryDialogTarget) {
      categoryDialogTarget.name = name;
    } else {
      const created = { id: newCategoryId(), name: name };
      categories.push(created);
      categoryId = created.id;
      settings.categoryId = categoryId;
    }
    saveCategories();
    saveSettings();
    $('categoryDlg').close();
    renderAll();
  }

  async function deleteActiveCategory() {
    const target = categories.find(function (c) { return c.id === categoryId; });
    if (!target || target.id === UNCATEGORIZED_ID) {
      Pico.toast('“未分类”不能删除', { type: 'warn' });
      return;
    }
    const count = Array.from(items.values()).filter(function (it) {
      return validCategoryId(it.categoryId) === target.id;
    }).length;
    const suffix = count ? '其中 ' + count + ' 张图片会移回“未分类”，原文件不会删除。' : '分类中的图片不会被删除。';
    if (!window.confirm('确定删除分类“' + target.name + '”吗？\n\n' + suffix)) return;

    categories = categories.filter(function (c) { return c.id !== target.id; });
    const writes = [];
    items.forEach(function (it) {
      if (validCategoryId(it.categoryId) !== target.id) return;
      it.categoryId = UNCATEGORIZED_ID;
      writes.push(persistItem(it));
    });
    categoryId = UNCATEGORIZED_ID;
    settings.categoryId = categoryId;
    saveCategories();
    saveSettings();
    renderAll();
    await Promise.all(writes);
    Pico.toast('已删除分类“' + target.name + '”' + (count ? '，图片已移回未分类' : ''), { type: 'ok' });
  }

  function moveItemsToCategory(ids, targetId) {
    const destination = validCategoryId(targetId);
    const changed = [];
    Array.from(new Set(ids || [])).forEach(function (id) {
      const it = items.get(+id);
      if (!it || validCategoryId(it.categoryId) === destination) return;
      it.categoryId = destination;
      changed.push(it);
      persistItem(it);
    });
    if (!changed.length) return;
    renderAll();
    Pico.toast(changed.length === 1 ? '已移动到分类：' + categories.find(function (c) { return c.id === destination; }).name : '已移动 ' + changed.length + ' 张图片', { type: 'ok' });
  }

  /* ══════════════ 右键菜单 ══════════════ */
  function closeContextMenu() {
    const menu = $('contextMenu');
    if (!menu) return;
    menu.hidden = true;
    contextTarget = null;
  }

  function openContextMenu(target, x, y) {
    const menu = $('contextMenu');
    contextTarget = target || null;
    menu.querySelectorAll('[data-context-action]').forEach(function (button) {
      const needsTarget = ['edit', 'copy', 'delete', 'info', 'save', 'open-dir'].indexOf(button.dataset.contextAction) >= 0;
      button.disabled = needsTarget && !contextTarget;
    });
    menu.hidden = false;
    menu.style.left = Math.max(6, Math.round(x)) + 'px';
    menu.style.top = Math.max(6, Math.round(y)) + 'px';
    requestAnimationFrame(function () {
      if (menu.hidden) return;
      const r = menu.getBoundingClientRect();
      menu.style.left = Math.max(6, Math.min(Math.round(x), window.innerWidth - r.width - 6)) + 'px';
      menu.style.top = Math.max(6, Math.min(Math.round(y), window.innerHeight - r.height - 6)) + 'px';
    });
  }

  async function copyItemImage(it) {
    if (!it) return;
    try {
      const blob = await fetch(it.url).then(function (r) { return r.blob(); });
      await Pico.copyImageBlob(blob);
      Pico.toast('图片已复制到剪贴板', { type: 'ok' });
    } catch (e) {
      Pico.toast('当前环境不支持复制图片，请使用 Ctrl+C 或 Ctrl+V 操作', { type: 'warn' });
    }
  }

  async function pasteClipboard(category) {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read || !window.ClipboardItem) throw new Error('clipboard');
      const clipboardItems = await navigator.clipboard.read();
      const entries = [];
      for (const clipboardItem of clipboardItems) {
        const type = clipboardItem.types.find(function (value) { return value.indexOf('image/') === 0; });
        if (!type) continue;
        const blob = await clipboardItem.getType(type);
        const ext = type.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
        const name = '剪贴板-' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + ext;
        const file = new File([blob], name, { type: type, lastModified: Date.now() });
        entries.push({ file: file, dir: '剪贴板', categoryId: category || categoryIdForNewItem() });
      }
      if (!entries.length) { Pico.toast('剪贴板中没有图片', { type: 'warn' }); return; }
      await addFiles(entries);
    } catch (e) {
      Pico.toast('无法读取剪贴板，请使用 Ctrl+V 粘贴图片', { type: 'warn' });
    }
  }

  async function openItemDirectory(it) {
    if (!it) return;
    let path = it.path || absolutePathOf(it.file) || '';
    // 每次定位前由 Windows 宿主校验并规范化真实路径。这样旧版本
    // 记录中的相对路径不会被误当成本机位置，也能在文件被移动后给出
    // 明确的重新关联入口。
    if (path && typeof window.picoResolvePath === 'function') {
      try {
        const resolved = await window.picoResolvePath(path);
        if (resolved) {
          path = String(resolved);
          if (it.path !== path) {
            it.path = path;
            await persistItem(it);
          }
        }
      } catch (e) {
        path = '';
        it.path = '';
      }
    }
    // 旧版本通过网页 input 导入时无法保存 Windows 路径。独立版在这里
    // 提供一次原生定位，让旧图库也能修复并在之后永久记住该路径。
    if (!path && typeof window.picoPickSinglePath === 'function') {
      const pickingToast = Pico.toast('原文件位置不可用，请选择当前图片以重新关联…', { duration: 0 });
      try {
        path = await window.picoPickSinglePath();
      } catch (e) {
        pickingToast();
        Pico.toast('无法选择图片文件', { type: 'warn' });
        return;
      }
      pickingToast();
      if (!path) return;
      path = absolutePathOf({ path: path });
      if (!path) {
        Pico.toast('Windows 未返回有效的绝对路径', { type: 'warn' });
        return;
      }
      it.path = path;
      await persistItem(it);
    }
    if (!path || typeof window.picoOpenPath !== 'function') {
      Pico.toast('当前图片没有可用的本地路径，请用独立版“打开图片”重新导入', { type: 'warn' });
      return;
    }
    try {
      await Promise.resolve(window.picoOpenPath(path));
      Pico.toast('已在资源管理器中定位原文件', { type: 'ok', duration: 1800 });
    } catch (e) { Pico.toast('无法打开图片目录', { type: 'warn' }); }
  }

  function openItemInViewer(it, showInfo) {
    if (!it) return;
    computeVisible();
    const index = visible.indexOf(it);
    if (index < 0) return;
    viewerCtl.open(index);
    if (showInfo) window.setTimeout(function () { viewerCtl.showInfo(); }, 0);
  }

  function runContextAction(action) {
    const target = contextTarget;
    closeContextMenu();
    if (action === 'paste') { pasteClipboard(target && target.categoryId); return; }
    if (!target) return;
    if (action === 'edit') { if (editorCtl) editorCtl.open(target); }
    else if (action === 'copy') copyItemImage(target);
    else if (action === 'delete') {
      if (selectionMode && selectedIds.has(target.id)) removeSelectedItems(); else removeItem(target);
    } else if (action === 'info') openItemInViewer(target, true);
    else if (action === 'save') { if (converterCtl) converterCtl.open(target); }
    else if (action === 'open-dir') openItemDirectory(target);
  }

  /* ══════════════ 主题 ══════════════ */
  const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const t = settings.theme === 'auto' ? (mqDark.matches ? 'dark' : 'light') : settings.theme;
    document.documentElement.dataset.theme = t;
    if (typeof window.picoSetWindowTheme === 'function') {
      try {
        const result = window.picoSetWindowTheme(t === 'dark');
        if (result && result.catch) result.catch(function () {});
      } catch (e) {}
    }
    $('btnTheme').innerHTML = Pico.icon(t === 'dark' ? 'moon' : 'sun');
    document.querySelectorAll('#themeSeg button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.theme === settings.theme);
    });
  }
  mqDark.addEventListener ? mqDark.addEventListener('change', applyTheme) : mqDark.addListener(applyTheme);

  /* ══════════════ 事件绑定 ══════════════ */
  function bind() {
    Pico.hydrateIcons(document);
    $('brandLogo').innerHTML = Pico.logoSVG(36);
    $('welcomeLogo').innerHTML = Pico.logoSVG(76);
    $('aboutLogo').innerHTML = Pico.logoSVG(56);

    /* 打开文件 / 文件夹 */
    const pickImages = async function () {
      if (typeof window.picoPickImages === 'function') {
        const t = Pico.toast('请选择图片（可多选）…', { duration: 0 });
        try {
          const entries = await pickNativeFiles('picoPickImages');
          if (entries && entries.length) await addFiles(entries);
        } catch (e) {
          Pico.toast('打开图片失败，请重试', { type: 'warn' });
        } finally {
          t();
        }
        return;
      }
      $('fileInput').click();
    };
    $('btnOpenImages').addEventListener('click', pickImages);
    $('btnWelcomeImages').addEventListener('click', pickImages);
    $('btnOpenFolder').addEventListener('click', openFolder);
    $('btnWelcomeFolder').addEventListener('click', openFolder);
    const openSaveAs = function () {
      if (!converterCtl) return;
      converterCtl.open(null, selectionMode && selectedIds.size ? 'selected' : null);
    };
    $('btnSaveAs').addEventListener('click', openSaveAs);
    $('btnWelcomeSaveAs').addEventListener('click', function () { if (converterCtl) converterCtl.open(); });
    $('btnSelectMode').addEventListener('click', function () { setSelectionMode(!selectionMode); });
    $('btnSelectAll').addEventListener('click', toggleVisibleSelection);
    $('btnClearSelection').addEventListener('click', function () {
      selectedIds.clear();
      renderGrid();
    });
    $('btnSelectionDelete').addEventListener('click', removeSelectedItems);
    $('btnSelectionConvert').addEventListener('click', function () {
      if (converterCtl && selectedIds.size) converterCtl.open(null, 'selected');
    });
    $('btnNewCategory').addEventListener('click', function () { openCategoryDialog('new'); });
    $('btnRenameCategory').addEventListener('click', function () {
      const target = categories.find(function (c) { return c.id === categoryId; });
      if (target) openCategoryDialog('rename', target);
    });
    $('btnDeleteCategory').addEventListener('click', deleteActiveCategory);
    $('categoryDlgSave').addEventListener('click', saveCategoryDialog);
    $('categoryNameInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveCategoryDialog(); }
    });

    $('fileInput').addEventListener('change', async function () {
      if (!this.files.length) return;
      await addFiles(filesFromInput(this));
      this.value = '';
    });
    $('dirInput').addEventListener('change', async function () {
      if (!this.files.length) return;
      const t = Pico.toast('正在读取文件夹…', { duration: 0 });
      await addFiles(filesFromInput(this));
      t();
      this.value = '';
    });

    /* 拖拽导入 */
    let dragDepth = 0;
    window.addEventListener('dragenter', function (e) {
      if (!Array.from(e.dataTransfer.types).includes('Files')) return;
      dragDepth++;
      $('dropOverlay').classList.add('on');
    });
    window.addEventListener('dragleave', function () {
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) $('dropOverlay').classList.remove('on');
    });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', async function (e) {
      e.preventDefault();
      dragDepth = 0;
      $('dropOverlay').classList.remove('on');
      const t = Pico.toast('正在读取拖入的内容…', { duration: 0 });
      try { await addFiles(await filesFromDrop(e.dataTransfer)); }
      catch (err) { Pico.toast('读取拖入内容失败', { type: 'warn' }); }
      t();
    });

    /* 粘贴导入 */
    window.addEventListener('paste', function (e) {
      const files = e.clipboardData && e.clipboardData.files;
      if (!files || !files.length) return;
      const imgs = Array.from(files).filter(Pico.isImageFile).map(function (f) { return { file: f, dir: '剪贴板', categoryId: categoryIdForNewItem() }; });
      if (imgs.length) { e.preventDefault(); addFiles(imgs); }
    });

    /* 演示 */
    let demoBusy = false;
    $('btnDemo').addEventListener('click', async function () {
      if (demoBusy) return;
      demoBusy = true;
      const t = Pico.toast('正在生成演示图片…', { duration: 0 });
      try {
        const files = await Pico.generateDemoFiles();
        const n = await addFiles(files.map(function (f) { return { file: f, dir: '演示图库' }; }), true);
        if (n) viewerCtl.open(0);
      } catch (e) { Pico.toast('生成演示图片失败', { type: 'warn' }); }
      t();
      demoBusy = false;
    });

    /* 网格点击 */
    grid.addEventListener('click', function (e) {
      const tile = e.target.closest('.tile');
      if (!tile) return;
      if (selectionMode || e.ctrlKey || e.metaKey) {
        if (!selectionMode) setSelectionMode(true);
        toggleSelected(+tile.dataset.id);
        return;
      }
      viewerCtl.open(+tile.dataset.i);
    });
    grid.addEventListener('dragstart', function (e) {
      const tile = e.target.closest('.tile');
      if (!tile || !e.dataTransfer) return;
      const id = +tile.dataset.id;
      const ids = selectionMode && selectedIds.has(id) ? Array.from(selectedIds) : [id];
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/x-pico-image-ids', ids.join(','));
      e.dataTransfer.setData('text/plain', ids.join(','));
      tile.classList.add('dragging');
    });
    grid.addEventListener('dragend', function (e) {
      const tile = e.target.closest('.tile');
      if (tile) tile.classList.remove('dragging');
    });
    grid.addEventListener('contextmenu', function (e) {
      const tile = e.target.closest('.tile');
      e.preventDefault();
      e.stopPropagation();
      const it = tile ? items.get(+tile.dataset.id) : null;
      if (it && selectionMode && !selectedIds.has(it.id)) {
        selectedIds.clear();
        selectedIds.add(it.id);
        renderGrid();
      }
      openContextMenu(it, e.clientX, e.clientY);
    });
    grid.addEventListener('keydown', function (e) {
      const tiles = Array.prototype.slice.call(grid.querySelectorAll('.tile'));
      const i = tiles.indexOf(document.activeElement);
      if (i < 0) return;
      const rowTop = tiles[i].offsetTop;
      let cols = 0;
      for (const t of tiles) {
        if (t.offsetTop === rowTop) cols++;
        else if (t.offsetTop > rowTop) break;
      }
      cols = Math.max(1, cols);
      let j = -1;
      if (e.key === 'ArrowRight') j = i + 1;
      else if (e.key === 'ArrowLeft') j = i - 1;
      else if (e.key === 'ArrowDown') j = i + cols;
      else if (e.key === 'ArrowUp') j = i - cols;
      if (j >= 0 && j < tiles.length) {
        e.preventDefault();
        tiles[j].focus();
        tiles[j].scrollIntoView({ block: 'nearest' });
      }
    });

    /* 分类侧栏（事件委托 + 拖入归类） */
    $('folderList').addEventListener('click', function (e) {
      const b = e.target.closest('.folder-item');
      if (!b) return;
      setActiveCategory(b.dataset.categoryId);
    });
    $('folderList').addEventListener('dragover', function (e) {
      const b = e.target.closest('.folder-item');
      if (!b || !e.dataTransfer) return;
      const hasInternal = Array.from(e.dataTransfer.types || []).indexOf('application/x-pico-image-ids') >= 0;
      const hasFiles = Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0;
      if (!hasInternal && !hasFiles) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = hasInternal ? 'move' : 'copy';
      b.classList.add('drop-target');
    });
    $('folderList').addEventListener('dragleave', function (e) {
      const b = e.target.closest('.folder-item');
      if (b && !b.contains(e.relatedTarget)) b.classList.remove('drop-target');
    });
    $('folderList').addEventListener('drop', async function (e) {
      const b = e.target.closest('.folder-item');
      if (!b || !e.dataTransfer) return;
      e.preventDefault();
      e.stopPropagation();
      b.classList.remove('drop-target');
      $('dropOverlay').classList.remove('on');
      const targetId = b.dataset.categoryId;
      const rawIds = e.dataTransfer.getData('application/x-pico-image-ids');
      if (rawIds) {
        if (targetId !== '@all') moveItemsToCategory(rawIds.split(',').filter(Boolean), targetId);
        return;
      }
      if (Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0) {
        try {
          const entries = await filesFromDrop(e.dataTransfer);
          entries.forEach(function (entry) { entry.categoryId = targetId === '@all' ? categoryIdForNewItem() : targetId; });
          await addFiles(entries);
        } catch (err) { Pico.toast('读取拖入内容失败', { type: 'warn' }); }
      }
    });

    /* 搜索 */
    const searchInput = $('searchInput');
    const doSearch = Pico.debounce(function () {
      search = searchInput.value;
      settings.search = search;
      saveSettings();
      renderGrid();
    }, 160);
    searchInput.addEventListener('input', function () {
      $('searchClear').hidden = !this.value;
      doSearch();
    });
    $('searchClear').addEventListener('click', function () {
      searchInput.value = '';
      search = '';
      settings.search = '';
      saveSettings();
      $('searchClear').hidden = true;
      renderGrid();
      searchInput.focus();
    });

    /* 排序菜单 */
    const sortDD = $('sortDD');
    $('btnSort').addEventListener('click', function (e) {
      e.stopPropagation();
      sortDD.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (!sortDD.contains(e.target)) sortDD.classList.remove('open');
    });
    sortDD.querySelectorAll('[data-sort]').forEach(function (b) {
      b.addEventListener('click', function () {
        settings.sortBy = b.dataset.sort;
        if (settings.sortBy === 'random') items.forEach(function (it) { it.rand = Math.random(); });
        saveSettings();
        syncSortUI();
        renderGrid();
        sortDD.classList.remove('open');
      });
    });
    $('btnSortDir').addEventListener('click', function () {
      settings.sortAsc = !settings.sortAsc;
      saveSettings();
      syncSortUI();
      renderGrid();
    });
    $('btnShuffle').addEventListener('click', function () {
      settings.sortBy = 'random';
      items.forEach(function (it) { it.rand = Math.random(); });
      saveSettings();
      syncSortUI();
      renderGrid();
      sortDD.classList.remove('open');
    });

    /* 缩略图大小 */
    document.querySelectorAll('#thumbSizeSeg button').forEach(function (b) {
      b.addEventListener('click', function () {
        settings.thumbSize = b.dataset.size;
        saveSettings();
        syncThumbSizeUI();
      });
    });

    /* 主题 */
    $('btnTheme').addEventListener('click', function () {
      const cur = document.documentElement.dataset.theme;
      settings.theme = cur === 'dark' ? 'light' : 'dark';
      saveSettings();
      applyTheme();
    });

    /* 对话框 */
    $('btnHelp').addEventListener('click', function () { $('helpDlg').showModal(); });
    $('btnSettings').addEventListener('click', function () { $('settingsDlg').showModal(); });
    document.querySelectorAll('.dlg-close').forEach(function (b) {
      b.addEventListener('click', function () { b.closest('dialog').close(); });
    });
    document.querySelectorAll('#themeSeg button').forEach(function (b) {
      b.addEventListener('click', function () {
        settings.theme = b.dataset.theme;
        saveSettings();
        applyTheme();
      });
    });
    document.querySelectorAll('#wheelSeg button').forEach(function (b) {
      b.addEventListener('click', function () {
        settings.wheel = b.dataset.wheel;
        saveSettings();
        document.querySelectorAll('#wheelSeg button').forEach(function (x) {
          x.classList.toggle('on', x === b);
        });
      });
    });
    $('intervalRange').addEventListener('input', function () {
      settings.interval = +this.value;
      $('intervalVal').textContent = this.value;
      saveSettings();
    });
    $('loopChk').addEventListener('change', function () { settings.loop = this.checked; saveSettings(); });
    $('stripChk').addEventListener('change', function () { settings.strip = this.checked; saveSettings(); });
    $('btnAbout').addEventListener('click', function () {
      $('settingsDlg').close();
      $('aboutDlg').showModal();
    });

    /* 窄屏折叠侧栏 */
    $('btnSidebar').addEventListener('click', function () {
      $('sidebar').classList.toggle('fold');
    });
    if (window.innerWidth <= 920) $('sidebar').classList.add('fold');

    /* 图片右键菜单 */
    $('contextMenu').addEventListener('click', function (e) {
      const button = e.target.closest('[data-context-action]');
      if (button && !button.disabled) runContextAction(button.dataset.contextAction);
    });
    $('viewer').addEventListener('contextmenu', function (e) {
      const it = viewerCtl.current();
      if (!it) return;
      e.preventDefault();
      e.stopPropagation();
      openContextMenu(it, e.clientX, e.clientY);
    });
    document.addEventListener('click', function (e) {
      if (!$('contextMenu').contains(e.target)) closeContextMenu();
    });
    document.addEventListener('scroll', closeContextMenu, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeContextMenu();
    });

    /* 全局快捷键（网格视图） */
    document.addEventListener('keydown', function (e) {
      // 截图是应用级快捷键，不能因为当前正在查看图片、编辑图片、填写对话框
      // 或焦点位于输入框就失效。captureBusy 会避免查看器自己的兼容监听重复触发。
      if (e.ctrlKey && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        e.stopPropagation();
        captureScreen();
        return;
      }
      if (viewerCtl.isOpen()) return;
      if (document.querySelector('dialog[open]')) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        if (!selectionMode) setSelectionMode(true);
        if (visible.length && !visible.every(function (it) { return selectedIds.has(it.id); })) {
          visible.forEach(function (it) { selectedIds.add(it.id); });
          renderGrid();
        } else {
          syncSelectionUI();
        }
      }
      else if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); openSaveAs(); }
      else if (e.key === '?') { $('helpDlg').showModal(); }
      else if (e.key === 'Escape' && selectionMode) { setSelectionMode(false); }
      else if (e.key === 'Escape' && search) {
        searchInput.value = ''; search = ''; settings.search = ''; saveSettings();
        $('searchClear').hidden = true;
        renderGrid();
      }
    });
  }

  /* ══════════════ UI 状态同步 ══════════════ */
  function syncSortUI() {
    $('sortLabel').textContent = SORT_LABEL[settings.sortBy] || '排序';
    document.querySelectorAll('#sortDD [data-sort]').forEach(function (b) {
      b.classList.toggle('sel', b.dataset.sort === settings.sortBy && settings.sortBy !== 'random');
    });
    $('sortDirLabel').textContent = settings.sortAsc ? '升序' : '降序';
    $('btnSortDir').querySelector('.mi-check').innerHTML = Pico.icon(settings.sortAsc ? 'sort-asc' : 'sort-desc', 16);
  }
  function syncThumbSizeUI() {
    const px = { s: '120px', m: '220px', l: '360px' }[settings.thumbSize] || '220px';
    document.documentElement.style.setProperty('--tile', px);
    document.querySelectorAll('#thumbSizeSeg button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.size === settings.thumbSize);
    });
  }
  function initSettingsUI() {
    applyTheme();
    syncSortUI();
    syncThumbSizeUI();
    $('searchInput').value = search;
    $('searchClear').hidden = !search;
    document.querySelectorAll('#wheelSeg button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.wheel === settings.wheel);
    });
    $('intervalRange').value = settings.interval;
    $('intervalVal').textContent = settings.interval;
    $('loopChk').checked = settings.loop;
    $('stripChk').checked = settings.strip;
  }

  /* ══════════════ 快捷键帮助 ══════════════ */
  function buildHelp() {
    const rows = [
      ['← / →', '上一张 / 下一张'], ['Home / End', '第一张 / 最后一张'],
      ['滚轮', '缩放（可在设置中改为切换）'], ['双击', '放大 / 复位'],
      ['+ / −', '放大 / 缩小'], ['0', '适应窗口'], ['1', '实际大小（100%）'],
      ['R / L', '向右 / 向左旋转'],
      ['空格', '播放 / 暂停幻灯片'], ['I', '图片信息（EXIF）'], ['T', '胶片栏'],
      ['E', '打开图片编辑器'], ['O / Ctrl+S', '另存为（含格式转换）'], ['Ctrl+Shift+C', '截取屏幕或窗口'], ['F', '全屏'],
      ['Delete', '从列表移除'], ['Esc', '返回网格'],
      ['Ctrl+V', '粘贴图片'], ['拖拽', '导入文件或文件夹'], ['?', '本帮助'],
    ];
    $('helpBody').innerHTML = rows.map(function (r) {
      const keys = r[0].split(' / ').map(function (k) { return '<kbd>' + Pico.escapeHTML(k) + '</kbd>'; }).join('<i style="opacity:.4;font-style:normal">/</i>');
      return '<div class="hk-row"><span>' + r[1] + '</span><span class="keys">' + keys + '</span></div>';
    }).join('');
  }

  /* ══════════════ 启动 ══════════════ */
  bind();
  initSettingsUI();
  buildHelp();
  renderAll();
  restoreLibrary().then(importLaunchFiles);
})();
