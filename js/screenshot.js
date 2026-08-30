/* ============================================================
 * Pico 图片查看器 · screenshot.js
 * 屏幕截图与全屏拖框裁剪。截图只在本地生成 PNG，不上传，也不依赖第三方库。
 * ============================================================ */
(function () {
  'use strict';
  const Pico = (window.Pico = window.Pico || {});
  const clamp = function (value, min, max) { return Math.min(max, Math.max(min, value)); };

  function two(n) { return n < 10 ? '0' + n : '' + n; }

  function screenshotName() {
    const now = new Date();
    return 'Pico-截图-' + now.getFullYear() + two(now.getMonth() + 1) + two(now.getDate()) + '-' +
      two(now.getHours()) + two(now.getMinutes()) + two(now.getSeconds()) + '.png';
  }

  function canvasBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (value) {
        if (value) resolve(value); else reject(new Error('截图编码失败'));
      }, 'image/png');
    });
  }

  function canvasFromNativeCapture(capture) {
    if (!capture || typeof capture.data !== 'string') throw new Error('Windows 屏幕截图数据为空');
    const raw = atob(capture.data);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'image/png' });
    if (window.createImageBitmap) {
      return window.createImageBitmap(blob).then(function (bitmap) {
        const canvas = document.createElement('canvas');
        canvas.width = Number(capture.width) || bitmap.width || 1;
        canvas.height = Number(capture.height) || bitmap.height || 1;
        canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        if (bitmap.close) bitmap.close();
        return canvas;
      });
    }
    return new Promise(function (resolve, reject) {
      const image = new Image();
      const url = URL.createObjectURL(blob);
      image.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = Number(capture.width) || image.naturalWidth || 1;
        canvas.height = Number(capture.height) || image.naturalHeight || 1;
        canvas.getContext('2d', { alpha: false }).drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      image.onerror = function () { URL.revokeObjectURL(url); reject(new Error('无法解码 Windows 屏幕截图')); };
      image.src = url;
    });
  }

  /**
   * 打开系统的屏幕共享选择器，并返回完整的第一帧画布。
   * 由 app.js 在快捷键事件中直接调用，保持浏览器的用户激活状态。
   */
  Pico.captureScreenFrame = async function () {
    if (typeof window.picoCaptureScreen === 'function') {
      return canvasFromNativeCapture(await window.picoCaptureScreen());
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      const err = new Error('当前环境不支持屏幕截图，请使用独立版应用或最新 Chrome / Edge。');
      err.code = 'UNSUPPORTED';
      throw err;
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' },
      audio: false,
    });
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;

    try {
      await new Promise(function (resolve, reject) {
        if (video.readyState >= 1 && video.videoWidth) { resolve(); return; }
        video.onloadedmetadata = function () { resolve(); };
        video.onerror = function () { reject(new Error('无法读取屏幕画面')); };
      });
      await video.play();
      // 等待两帧，避免刚建立视频轨道时得到全黑或尺寸为 0 的画面。
      await new Promise(function (resolve) {
        requestAnimationFrame(function () { requestAnimationFrame(resolve); });
      });
      const width = video.videoWidth || 1;
      const height = video.videoHeight || 1;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.drawImage(video, 0, 0, width, height);
      return canvas;
    } finally {
      stream.getTracks().forEach(function (track) { track.stop(); });
      video.srcObject = null;
    }
  };

  // 保留旧接口，方便外部页面或旧快捷键调用；新的主流程使用拖框控制器。
  Pico.captureScreen = async function () {
    const canvas = await Pico.captureScreenFrame();
    const blob = await canvasBlob(canvas);
    return new File([blob], screenshotName(), { type: 'image/png', lastModified: Date.now() });
  };

  /** 全屏截图裁剪层：按下拖动选择区域，确认后返回裁剪后的 PNG File。 */
  Pico.initScreenCrop = function () {
    const $ = function (id) { return document.getElementById(id); };
    const root = $('screenCrop');
    const stage = $('screenCropStage');
    const screenCanvas = $('screenCropCanvas');
    const rect = $('screenCropRect');
    const rectSize = $('screenCropSize');
    const status = $('screenCropStatus');
    const confirm = $('screenCropConfirm');
    const cancelButton = $('screenCropCancel');
    const ctx = screenCanvas.getContext('2d', { alpha: false });

    let open = false;
    let ready = false;
    let frame = null;
    let selection = null;
    let selectionCommitted = false;
    let drag = null;
    let resolveResult = null;
    let resultPromise = null;

    function setStatus(value) { status.textContent = value; }

    function clearRect() {
      selection = null;
      selectionCommitted = false;
      rect.hidden = true;
      // Once the native frame is ready, “确定” is also a deliberate
      // full-screen capture action.  It must not depend on a drag having
      // produced a non-zero selection first.
      confirm.disabled = !ready;
      rectSize.textContent = '';
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

    function renderRect() {
      if (!selection || !frame) {
        rect.hidden = true;
        return;
      }
      const stageBounds = stage.getBoundingClientRect();
      const canvasBounds = screenCanvas.getBoundingClientRect();
      rect.hidden = false;
      rect.style.left = (canvasBounds.left - stageBounds.left + selection.x / frame.width * canvasBounds.width) + 'px';
      rect.style.top = (canvasBounds.top - stageBounds.top + selection.y / frame.height * canvasBounds.height) + 'px';
      rect.style.width = (selection.w / frame.width * canvasBounds.width) + 'px';
      rect.style.height = (selection.h / frame.height * canvasBounds.height) + 'px';
      rectSize.textContent = Math.round(selection.w) + ' × ' + Math.round(selection.h);
    }

    function newSelectionFromDrag(start, point) {
      return {
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        w: Math.abs(point.x - start.x),
        h: Math.abs(point.y - start.y),
      };
    }

    function resizeSelection(base, handle, point) {
      const min = 2;
      let left = base.x, right = base.x + base.w;
      let top = base.y, bottom = base.y + base.h;
      if (handle.indexOf('w') !== -1) left = clamp(point.x, 0, right - min);
      if (handle.indexOf('e') !== -1) right = clamp(point.x, left + min, frame.width);
      if (handle.indexOf('n') !== -1) top = clamp(point.y, 0, bottom - min);
      if (handle.indexOf('s') !== -1) bottom = clamp(point.y, top + min, frame.height);
      return {
        x: left,
        y: top,
        w: Math.max(min, right - left),
        h: Math.max(min, bottom - top),
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
      renderRect();
    }

    function finish(value) {
      const resolve = resolveResult;
      resolveResult = null;
      open = false;
      ready = false;
      frame = null;
      drag = null;
      selection = null;
      selectionCommitted = false;
      root.hidden = true;
      root.classList.remove('ready');
      rect.hidden = true;
      confirm.disabled = true;
      screenCanvas.removeAttribute('style');
      if (resolve) resolve(value);
    }

    function cancel() {
      if (!open) return;
      finish(null);
    }

    async function confirmCrop() {
      if (!open || !frame) return;
      // A click/double-click can generate a tiny synthetic pointer movement.
      // Only an intentional drag commits a crop; otherwise the operation is
      // the requested full-screen capture.
      const selected = selectionCommitted && selection && selection.w >= 2 && selection.h >= 2;
      const crop = selected ? selection : { x: 0, y: 0, w: frame.width, h: frame.height };
      confirm.disabled = true;
      setStatus(selected ? '正在生成选区截图…' : '正在生成全屏截图…');
      try {
        const out = document.createElement('canvas');
        out.width = Math.max(1, Math.round(crop.w));
        out.height = Math.max(1, Math.round(crop.h));
        const outCtx = out.getContext('2d', { alpha: false });
        outCtx.drawImage(frame, Math.round(crop.x), Math.round(crop.y), out.width, out.height, 0, 0, out.width, out.height);
        const blob = await canvasBlob(out);
        finish(new File([blob], screenshotName(), { type: 'image/png', lastModified: Date.now() }));
      } catch (error) {
        confirm.disabled = !ready;
        setStatus('生成失败，请重新选择区域');
      }
    }

    stage.addEventListener('pointerdown', function (event) {
      if (!ready || event.button !== 0) return;
      const point = imagePoint(event);
      if (!point) return;
      event.preventDefault();
      const handleNode = event.target && event.target.closest ? event.target.closest('.screen-crop-handle') : null;
      if (handleNode && selection) {
        drag = {
          pointerId: event.pointerId,
          mode: 'resize',
          handle: handleNode.dataset.handle || 'se',
          start: point,
          base: { x: selection.x, y: selection.y, w: selection.w, h: selection.h },
        };
      } else if (selection && (event.target === rect || rect.contains(event.target))) {
        drag = {
          pointerId: event.pointerId,
          mode: 'move',
          start: point,
          base: { x: selection.x, y: selection.y, w: selection.w, h: selection.h },
        };
      } else {
        clearRect();
        drag = { pointerId: event.pointerId, mode: 'new', start: point, current: point };
      }
      if (stage.setPointerCapture) stage.setPointerCapture(event.pointerId);
      stage.classList.add('dragging');
    });
    stage.addEventListener('pointermove', function (event) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const point = imagePoint(event);
      if (!point) return;
      event.preventDefault();
      drag.current = point;
      if (drag.mode === 'resize') selection = resizeSelection(drag.base, drag.handle, point);
      else if (drag.mode === 'move') {
        selection = {
          x: clamp(drag.base.x + point.x - drag.start.x, 0, frame.width - drag.base.w),
          y: clamp(drag.base.y + point.y - drag.start.y, 0, frame.height - drag.base.h),
          w: drag.base.w,
          h: drag.base.h,
        };
      } else {
        selection = newSelectionFromDrag(drag.start, point);
        selectionCommitted = (Math.abs(point.x - drag.start.x) >= 3 || Math.abs(point.y - drag.start.y) >= 3) &&
          selection.w >= 2 && selection.h >= 2;
      }
      // An invalid/empty selection falls back to the complete frame, so the
      // button remains available while the user is adjusting the crop.
      confirm.disabled = false;
      renderRect();
    });
    function endDrag(event) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag = null;
      stage.classList.remove('dragging');
      if (stage.releasePointerCapture) {
        try { stage.releasePointerCapture(event.pointerId); } catch (e) {}
      }
      if (selectionCommitted && selection && selection.w >= 2 && selection.h >= 2) {
        setStatus('已选择区域，可点击“确定”或双击完成截图');
      } else if (ready) {
        setStatus('未选择有效区域，点击“确定”或双击将截取全屏');
      }
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('dblclick', function (event) {
      if (!open || !ready) return;
      event.preventDefault();
      event.stopPropagation();
      confirmCrop();
    });
    confirm.addEventListener('click', confirmCrop);
    cancelButton.addEventListener('click', cancel);
    window.addEventListener('resize', layout);
    window.addEventListener('keydown', function (event) {
      if (!open || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }, true);

    return {
      isOpen: function () { return open; },
      open: function () {
        cancel();
        open = true;
        root.hidden = false;
        root.classList.remove('ready');
        setStatus('正在准备屏幕画面…');
        clearRect();
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
        confirm.disabled = false;
        setStatus('可直接点击“确定”或双击截取全屏；也可拖动选择区域后确认');
        requestAnimationFrame(layout);
      },
      cancel: cancel,
      close: function () { if (open) cancel(); },
    };
  };
})();
