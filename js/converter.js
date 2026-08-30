/* ============================================================
 * Pico 图片查看器 · converter.js
 * 另存为与格式转换：单张另存或将当前筛选/全部图库批量转换为新副本。
 * ============================================================ */
(function () {
  'use strict';
  const Pico = (window.Pico = window.Pico || {});
  const $ = function (id) { return document.getElementById(id); };

  Pico.initConverter = function (hooks) {
    hooks = hooks || {};
    const dlg = $('convertDlg');
    const summary = $('convertSummary');
    const subsummary = $('convertSubsummary');
    const format = $('convertFormat');
    const quality = $('convertQuality');
    const qualityVal = $('convertQualityVal');
    const qualityWrap = document.querySelector('.convert-quality');
    const scopeRoot = $('convertScopes');
    const addBtn = $('convertAdd');
    const saveBtn = $('convertSave');

    let current = null;
    let scope = 'current';
    let busy = false;
    let targetFormat = 'png';
    let targetQuality = 100;

    function safeList(fn) {
      try { return Array.from((fn && fn()) || []).filter(Boolean); } catch (e) { return []; }
    }

    function unique(list) {
      const seen = new Set();
      return list.filter(function (it) {
        const key = it.id != null ? it.id : it;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function listForScope() {
      if (scope === 'current') return current ? [current] : [];
      if (scope === 'visible') return unique(safeList(hooks.getVisible));
      if (scope === 'selected') return unique(safeList(hooks.getSelected));
      return unique(safeList(hooks.getAll));
    }

    function preferredFormat(it) {
      const ext = Pico.extOf(it && it.name);
      if (ext === 'jpg' || ext === 'jpeg') return 'jpeg';
      if (ext === 'png' || ext === 'webp') return ext;
      return 'png';
    }

    function formatName(value) {
      return value === 'jpeg' ? 'JPEG' : value.toUpperCase();
    }

    function stemOf(name) {
      return (name || 'pico-image').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_');
    }

    function outputName(it) {
      const ext = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
      return stemOf(it.name) + '-converted.' + ext;
    }

    function loadImage(it) {
      const ready = typeof Pico.ensurePreview === 'function' ? Pico.ensurePreview(it) : Promise.resolve(it.url);
      return ready.then(function (url) {
        return new Promise(function (resolve, reject) {
          const im = new Image();
          im.onload = function () { resolve(im); };
          im.onerror = reject;
          im.src = url;
        });
      });
    }

    async function convertItem(it) {
      const im = await loadImage(it);
      const w = Math.max(1, im.naturalWidth || im.width || it.w || 1);
      const h = Math.max(1, im.naturalHeight || im.height || it.h || 1);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      const mime = targetFormat === 'jpeg' ? 'image/jpeg' : (targetFormat === 'webp' ? 'image/webp' : 'image/png');
      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(im, 0, 0, w, h);
      const blob = await new Promise(function (resolve, reject) {
        canvas.toBlob(function (value) { value ? resolve(value) : reject(new Error('图片编码失败')); }, mime, targetQuality / 100);
      });
      const name = outputName(it);
      return { item: it, blob: blob, file: new File([blob], name, { type: mime, lastModified: Date.now() }), name: name, mime: mime };
    }

    function update() {
      const visible = safeList(hooks.getVisible);
      const selected = safeList(hooks.getSelected);
      const all = safeList(hooks.getAll);
      const list = listForScope();
      scopeRoot.querySelectorAll('[data-scope]').forEach(function (button) {
        const key = button.dataset.scope;
        button.classList.toggle('on', key === scope);
        button.disabled = busy || (key === 'current' && !current) || (key === 'visible' && !visible.length) || (key === 'selected' && !selected.length) || (key === 'all' && !all.length);
        if (key === 'visible') button.textContent = '当前筛选 ' + visible.length;
        if (key === 'selected') button.textContent = '已选图片 ' + selected.length;
        if (key === 'all') button.textContent = '全部图库 ' + all.length;
        if (key === 'current') button.textContent = '当前图片';
      });
      format.value = targetFormat;
      quality.value = targetQuality;
      qualityVal.textContent = targetQuality;
      qualityWrap.hidden = targetFormat === 'png';
      if (!list.length) {
        summary.textContent = '暂无可转换的图片';
        subsummary.textContent = '请先打开图片或导入图库。';
      } else if (scope === 'current') {
        summary.textContent = current.name;
        subsummary.textContent = '将转换为 ' + formatName(targetFormat) + '，生成新的副本。';
      } else {
        summary.textContent = '准备转换 ' + list.length + ' 张图片';
        const sourceName = scope === 'visible' ? '当前筛选结果' : (scope === 'selected' ? '已选图片' : '全部图库');
        subsummary.textContent = sourceName + ' → ' + formatName(targetFormat) + '，原图不会被覆盖。';
      }
      addBtn.disabled = busy || !list.length;
      saveBtn.disabled = busy || !current || scope !== 'current';
      addBtn.innerHTML = Pico.icon('plus') + (busy ? '正在转换…' : '转换并加入图库');
      saveBtn.innerHTML = Pico.icon('save') + (scope === 'current' ? '另存当前图片' : '另存当前不可用');
    }

    function setBusy(value) {
      busy = value;
      update();
    }

    async function saveCurrent() {
      if (!current || busy) return;
      setBusy(true);
      try {
        const result = await convertItem(current);
        const ok = hooks.onSave ? await hooks.onSave(result) : await Pico.saveBlob(result.blob, result.name, result.mime);
        if (ok) {
          Pico.toast('已另存为：' + result.name, { type: 'ok' });
          dlg.close();
        }
      } catch (e) {
        Pico.toast('格式转换失败：' + (e && e.message ? e.message : '无法编码图片'), { type: 'warn' });
      } finally { setBusy(false); }
    }

    async function addConverted() {
      const list = listForScope();
      if (!list.length || busy) {
        if (!list.length) Pico.toast('暂无可转换的图片', { type: 'warn' });
        return;
      }
      setBusy(true);
      let done = 0, failed = 0;
      try {
        for (let i = 0; i < list.length; i++) {
          summary.textContent = '正在转换 ' + (i + 1) + ' / ' + list.length + '…';
          subsummary.textContent = list[i].name;
          try {
            const result = await convertItem(list[i]);
            const ok = hooks.onAdd ? await hooks.onAdd(result) : false;
            if (ok) done++; else failed++;
          } catch (e) { failed++; }
        }
        if (done) Pico.toast('已转换并加入图库 ' + done + ' 张' + (failed ? '，失败 ' + failed + ' 张' : ''), { type: 'ok' });
        else Pico.toast('转换失败，请重试', { type: 'warn' });
        if (done) dlg.close();
      } finally {
        setBusy(false);
      }
    }

    scopeRoot.querySelectorAll('[data-scope]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (busy || button.disabled) return;
        scope = button.dataset.scope;
        update();
      });
    });
    format.addEventListener('change', function () { targetFormat = format.value; update(); });
    quality.addEventListener('input', function () { targetQuality = +quality.value; qualityVal.textContent = targetQuality; });
    addBtn.addEventListener('click', addConverted);
    saveBtn.addEventListener('click', saveCurrent);
    $('convertClose').addEventListener('click', function () { if (!busy) dlg.close(); });
    $('convertCancel').addEventListener('click', function () { if (!busy) dlg.close(); });

    return {
      open: function (it, requestedScope) {
        current = it || (hooks.getCurrent ? hooks.getCurrent() : null);
        const visible = safeList(hooks.getVisible);
        const selected = safeList(hooks.getSelected);
        const wanted = ['current', 'visible', 'selected', 'all'].indexOf(requestedScope) >= 0 ? requestedScope : '';
        scope = wanted && (wanted !== 'current' || current) && (wanted !== 'visible' || visible.length) && (wanted !== 'selected' || selected.length)
          ? wanted : (current ? 'current' : (selected.length ? 'selected' : (visible.length ? 'visible' : 'all')));
        targetFormat = preferredFormat(current || selected[0]);
        targetQuality = 100;
        update();
        if (!dlg.open) dlg.showModal();
      },
      close: function () { if (!busy && dlg.open) dlg.close(); },
    };
  };
})();
