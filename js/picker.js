/* ============================================================
 * Pico 图片查看器 · picker.js
 * 屏幕取色器：抓取屏幕画面后显示全屏取色层，放大镜跟随指针，
 * 点击任意位置返回该像素的颜色（HEX / RGB）。只在本地完成。
 * ============================================================ */
(function () {
  'use strict';
  const Pico = (window.Pico = window.Pico || {});
  const clamp = function (value, min, max) { return Math.min(max, Math.max(min, value)); };

  const LENS = 15;      // 放大镜取样区域边长（像素）
  const LENS_ZOOM = 8;  // 放大倍数
  const LENS_SIZE = LENS * LENS_ZOOM;

  let pickerCtl = null;

  Pico.initScreenPicker = function () {
    if (pickerCtl) return pickerCtl;
    const $ = function (id) { return document.getElementById(id); };
    const root = $('screenPick');
    const stage = $('screenPickStage');
    const screenCanvas = $('screenPickCanvas');
    const ctx = screenCanvas.getContext('2d', { alpha: false });
    const lens = $('screenPickLens');
    const lensCanvas = $('screenPickLensCanvas');
    const lensCtx = lensCanvas.getContext('2d');
    lensCanvas.width = LENS_SIZE;
    lensCanvas.height = LENS_SIZE;
    const chip = $('screenPickChip');
    const hexEl = $('screenPickHex');
    const rgbEl = $('screenPickRgb');
    const posEl = $('screenPickPos');
    const status = $('screenPickStatus');
    const copyButton = $('screenPickCopy');
    const cancelButton = $('screenPickCancel');
    const prevWrap = $('screenPickPrevWrap');
    const prevChip = $('screenPickPrev');
    const prevHex = $('screenPickPrevHex');

    let open = false;
    let ready = false;
    let frame = null;
    let resolveResult = null;
    let resultPromise = null;
    let pendingMove = null;
    let renderScheduled = false;
    let current = null;

    function setStatus(value) { status.textContent = value; }

    function finish(value) {
      const resolve = resolveResult;
      resolveResult = null;
      open = false;
      ready = false;
      frame = null;
      pendingMove = null;
      current = null;
      root.hidden = true;
      root.classList.remove('ready');
      lens.hidden = true;
      screenCanvas.removeAttribute('style');
      if (resolve) resolve(value);
    }

    function cancel() {
      if (!open) return;
      finish(null);
    }

    function imagePoint(event) {
      if (!ready || !frame) return null;
      const bounds = screenCanvas.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) return null;
      return {
        x: clamp((event.clientX - bounds.left) / bounds.width * frame.width, 0, frame.width),
        y: clamp((event.clientY - bounds.top) / bounds.height * frame.height, 0, frame.height),
      };
    }

    function layout() {
      if (!frame) return;
      const bounds = stage.getBoundingClientRect();
      const scale = Math.min(bounds.width / frame.width, bounds.height / frame.height);
      const width = Math.max(1, frame.width * scale);
      const height = Math.max(1, frame.height * scale);
      screenCanvas.style.width = width + 'px';
      screenCanvas.style.height = height + 'px';
      screenCanvas.style.left = Math.max(0, (bounds.width - width) / 2) + 'px';
      screenCanvas.style.top = Math.max(0, (bounds.height - height) / 2) + 'px';
    }

    function hexOf(rgb) {
      const two = function (n) { return (n < 16 ? '0' : '') + n.toString(16); };
      return '#' + two(rgb.r) + two(rgb.g) + two(rgb.b);
    }

    function sampleAt(point) {
      const x = Math.max(0, Math.min(frame.width - 1, Math.round(point.x)));
      const y = Math.max(0, Math.min(frame.height - 1, Math.round(point.y)));
      const data = ctx.getImageData(x, y, 1, 1).data;
      return { x: x, y: y, r: data[0], g: data[1], b: data[2] };
    }

    function renderLens(point) {
      const sampled = sampleAt(point);
      const x0 = clamp(sampled.x - (LENS - 1) / 2, 0, frame.width - LENS);
      const y0 = clamp(sampled.y - (LENS - 1) / 2, 0, frame.height - LENS);
      const pixels = ctx.getImageData(Math.round(x0), Math.round(y0), LENS, LENS).data;
      lensCtx.clearRect(0, 0, LENS_SIZE, LENS_SIZE);
      for (let row = 0; row < LENS; row++) {
        for (let col = 0; col < LENS; col++) {
          const index = (row * LENS + col) * 4;
          lensCtx.fillStyle = 'rgb(' + pixels[index] + ',' + pixels[index + 1] + ',' + pixels[index + 2] + ')';
          lensCtx.fillRect(col * LENS_ZOOM, row * LENS_ZOOM, LENS_ZOOM, LENS_ZOOM);
        }
      }
      lensCtx.strokeStyle = 'rgba(255,255,255,0.16)';
      lensCtx.lineWidth = 1;
      for (let i = 1; i < LENS; i++) {
        lensCtx.beginPath();
        lensCtx.moveTo(i * LENS_ZOOM + 0.5, 0);
        lensCtx.lineTo(i * LENS_ZOOM + 0.5, LENS_SIZE);
        lensCtx.moveTo(0, i * LENS_ZOOM + 0.5);
        lensCtx.lineTo(LENS_SIZE, i * LENS_ZOOM + 0.5);
        lensCtx.stroke();
      }
      // 中心像素：白色内框 + 黑色外框，深浅背景下都清晰可见。
      const cx = (LENS - 1) / 2 * LENS_ZOOM;
      lensCtx.strokeStyle = 'rgba(0,0,0,0.9)';
      lensCtx.strokeRect(cx - 2.5, cx - 2.5, LENS_ZOOM + 5, LENS_ZOOM + 5);
      lensCtx.strokeStyle = '#ffffff';
      lensCtx.strokeRect(cx - 1.5, cx - 1.5, LENS_ZOOM + 3, LENS_ZOOM + 3);

      // 放大镜跟随指针，靠近屏幕边缘时翻转方向。
      const bounds = screenCanvas.getBoundingClientRect();
      const px = bounds.left + sampled.x / frame.width * bounds.width;
      const py = bounds.top + sampled.y / frame.height * bounds.height;
      const margin = 14;
      const lensWidth = lens.offsetWidth || LENS_SIZE;
      const lensHeight = lens.offsetHeight || LENS_SIZE + 60;
      let left = px + 22;
      let top = py + 22;
      if (left + lensWidth + margin > window.innerWidth) left = px - lensWidth - 22;
      if (top + lensHeight + margin > window.innerHeight) top = py - lensHeight - 22;
      left = clamp(left, margin, window.innerWidth - lensWidth - margin);
      top = clamp(top, margin, window.innerHeight - lensHeight - margin);
      lens.hidden = false;
      lens.style.left = left + 'px';
      lens.style.top = top + 'px';
    }

    function updateReadout(sampled) {
      current = { hex: hexOf(sampled), r: sampled.r, g: sampled.g, b: sampled.b };
      chip.style.background = current.hex;
      hexEl.textContent = current.hex.toUpperCase();
      rgbEl.textContent = 'rgb(' + sampled.r + ', ' + sampled.g + ', ' + sampled.b + ')';
      posEl.textContent = sampled.x + ', ' + sampled.y;
    }

    function updatePoint(event) {
      if (!ready || !frame) return;
      pendingMove = event;
      if (renderScheduled) return;
      renderScheduled = true;
      requestAnimationFrame(function () {
        renderScheduled = false;
        if (!ready || !pendingMove) return;
        const point = imagePoint(pendingMove);
        pendingMove = null;
        if (!point) return;
        updateReadout(sampleAt(point));
        renderLens(point);
      });
    }

    function copyCurrent() {
      if (!open || !ready) return;
      if (!current) {
        Pico.toast('请先移动指针读取颜色', { duration: 1600 });
        return;
      }
      const value = current.hex.toUpperCase();
      const done = function () { Pico.toast('已复制颜色 ' + value, { type: 'ok', duration: 1800 }); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done, function () { Pico.toast('复制失败，请手动记录 ' + value, { type: 'warn' }); });
      } else {
        Pico.toast('复制失败，请手动记录 ' + value, { type: 'warn' });
      }
    }

    stage.addEventListener('pointermove', updatePoint);
    stage.addEventListener('pointerdown', function (event) {
      if (!ready || !frame || event.button !== 0) return;
      event.preventDefault();
      const point = imagePoint(event);
      if (!point) return;
      const sampled = sampleAt(point);
      finish({ hex: hexOf(sampled), r: sampled.r, g: sampled.g, b: sampled.b });
    });
    copyButton.addEventListener('click', copyCurrent);
    cancelButton.addEventListener('click', cancel);
    window.addEventListener('resize', function () {
      if (!open) return;
      requestAnimationFrame(layout);
    });
    // 取色层是模态层：打开期间拦截所有按键，避免编辑器快捷键在背后生效。
    window.addEventListener('keydown', function (event) {
      if (!open) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        cancel();
        return;
      }
      if (event.ctrlKey && (event.key === 'c' || event.key === 'C')) copyCurrent();
    }, true);

    return pickerCtl = {
      isOpen: function () { return open; },
      open: function (initial) {
        cancel();
        open = true;
        root.hidden = false;
        root.classList.remove('ready');
        chip.style.background = '';
        hexEl.textContent = '#------';
        rgbEl.textContent = '移动指针读取颜色';
        posEl.textContent = '—';
        // 独立取色（编辑器之外）没有“当前绘制颜色”，隐藏参考块。
        prevWrap.hidden = !initial;
        prevChip.style.background = initial || 'transparent';
        prevHex.textContent = String(initial || '').toUpperCase();
        setStatus('正在准备屏幕画面…');
        resultPromise = new Promise(function (resolve) { resolveResult = resolve; });
        requestAnimationFrame(layout);
        return resultPromise;
      },
      setFrame: function (value) {
        if (!open || !value) return;
        frame = value;
        screenCanvas.width = frame.width;
        screenCanvas.height = frame.height;
        ctx.clearRect(0, 0, frame.width, frame.height);
        ctx.drawImage(frame, 0, 0);
        ready = true;
        root.classList.add('ready');
        setStatus('移动指针预览颜色，点击选取 · Esc 取消');
        requestAnimationFrame(layout);
      },
      cancel: cancel,
      close: function () { if (open) cancel(); },
    };
  };

  let pickBusy = false;

  /** 打开屏幕取色器，返回所选颜色 {hex, r, g, b}；取消返回 null。 */
  Pico.pickScreenColor = async function (initial) {
    if (pickBusy) return null;
    pickBusy = true;
    if (!pickerCtl) Pico.initScreenPicker();
    const resultPromise = pickerCtl.open(initial);
    try {
      const frame = await Pico.captureScreenFrame();
      pickerCtl.setFrame(frame);
      return await resultPromise;
    } finally {
      pickerCtl.close();
      pickBusy = false;
    }
  };
})();
