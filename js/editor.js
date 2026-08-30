/* ============================================================
 * Pico 图片查看器 · editor.js
 * Canvas 图片编辑器：裁剪、旋转、亮度/对比度/饱和度/模糊、
 * 基础图形/画笔/箭头/马赛克/文字标注、撤销重做与 PNG/JPEG/WebP 导出。
 * 原文件始终保持不变。
 * ============================================================ */
(function () {
  'use strict';
  const Pico = (window.Pico = window.Pico || {});
  const $ = function (id) { return document.getElementById(id); };
  const clamp = Pico.clamp;

  Pico.initEditor = function (hooks) {
    hooks = hooks || {};
    const editor = $('editor');
    const preview = $('editorPreview');
    const canvas = $('editorCanvas');
    const textMeasureCanvas = document.createElement('canvas');
    const textMeasureCtx = textMeasureCanvas.getContext('2d');
    const cropBox = $('editorCropBox');
    const cropSize = $('editorCropSize');
    const hint = $('editorPreviewHint');
    const status = $('editorStatus');
    const nameEl = $('editorName');
    const undoBtn = $('editorUndo');
    const redoBtn = $('editorRedo');
    const quality = $('editorQuality');
    const qualityVal = $('editorQualityVal');
    const format = $('editorFormat');
    const qualityWrap = document.querySelector('.editor-quality');

    let openState = false;
    let item = null;
    let source = null;
    let sourceW = 0, sourceH = 0;
    let displayScale = 1;
    let editorZoom = 1;
    let state = null;
    let history = [];
    let future = [];
    let openTick = 0;
    let busy = false;
    const sliderStarts = new Map();
    let cropPointer = null;
    let annotationPointer = null;
    let activeAnnotation = null;
    let selectedAnnotation = -1;
    let annotationMode = 'select';
    let editingTextIndex = -1;
    let editingTextPoint = null;
    let editingTextBefore = null;
    let shapeRotationBefore = null;
    let markWidthBefore = null;
    let markOpacityBefore = null;

    const drawPalette = $('editorDrawPalette');
    const drawWidth = $('editorDrawWidth');
    const drawWidthVal = $('editorDrawWidthVal');
    const drawOpacity = $('editorDrawOpacity');
    const drawOpacityVal = $('editorDrawOpacityVal');
    const drawFill = $('editorDrawFill');
    const shapeRotation = $('editorShapeRotation');
    const shapeRotationVal = $('editorShapeRotationVal');
    const rotateMarkCCW = $('editorRotateMarkCCW');
    const rotateMarkCW = $('editorRotateMarkCW');
    const inlineText = $('editorInlineText');
    const textBold = $('editorTextBold');
    const outputWidth = $('editorOutputWidth');
    const outputHeight = $('editorOutputHeight');
    const dimensionLock = $('editorDimensionLock');
    const dimensionReset = $('editorDimensionReset');
    let outputSizeDirty = false;
    let dimensionRatioLocked = true;
    let drawColorValue = '#ff0000';
    let lastDrawWidth = Math.max(1, +drawWidth.value || 6);
    let lastTextSize = 42;

    const PALETTE = [
      { value: '#000000', label: '黑色' },
      { value: '#ffffff', label: '白色' },
      { value: '#808080', label: '灰色' },
      { value: '#c0c0c0', label: '银色' },
      { value: '#800000', label: '栗色' },
      { value: '#ff0000', label: '红色' },
      { value: '#808000', label: '橄榄色' },
      { value: '#ffff00', label: '黄色' },
      { value: '#008000', label: '绿色' },
      { value: '#00ff00', label: '亮绿' },
      { value: '#008080', label: '水鸭色' },
      { value: '#00ffff', label: '青色' },
      { value: '#000080', label: '海军蓝' },
      { value: '#0000ff', label: '蓝色' },
      { value: '#800080', label: '紫色' },
      { value: '#ff00ff', label: '品红' },
      { value: '#f97316', label: '橙色' },
      { value: '#a52a2a', label: '棕色' },
      { value: '#f4a460', label: '沙棕' },
      { value: '#ffd700', label: '金色' },
      { value: '#90ee90', label: '浅绿' },
      { value: '#228b22', label: '森林绿' },
      { value: '#2e8b57', label: '海绿' },
      { value: '#87ceeb', label: '天蓝' },
      { value: '#1e90ff', label: '道奇蓝' },
      { value: '#4169e1', label: '宝蓝' },
      { value: '#4b0082', label: '靛蓝' },
      { value: '#ee82ee', label: '紫罗兰' },
      { value: '#ffc0cb', label: '粉色' },
      { value: '#ff69b4', label: '热粉' },
      { value: '#dc143c', label: '深红' },
      { value: '#f5f5f5', label: '白烟' },
      { value: '#36454f', label: '炭灰' },
      { value: '#1e293b', label: '石板深蓝' },
    ];

    function selectPalette(root, value) {
      if (!root) return;
      const wanted = String(value || '').toLowerCase();
      root.querySelectorAll('.color-swatch').forEach(function (swatch) {
        const selected = swatch.dataset.color.toLowerCase() === wanted;
        swatch.classList.toggle('on', selected);
        swatch.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
    }

    function setupPalette(root, initial, onChange) {
      if (!root) return;
      root.innerHTML = '';
      PALETTE.forEach(function (color) {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'color-swatch';
        swatch.dataset.color = color.value;
        swatch.title = color.label + ' ' + color.value;
        swatch.setAttribute('aria-label', color.label);
        swatch.setAttribute('aria-pressed', 'false');
        swatch.style.setProperty('--swatch', color.value);
        swatch.addEventListener('click', function () {
          onChange(color.value);
          selectPalette(root, color.value);
          updateInlineTextStyle();
        });
        root.appendChild(swatch);
      });
      selectPalette(root, initial);
    }

    setupPalette(drawPalette, drawColorValue, function (value) {
      drawColorValue = value;
      if (editingTextIndex >= 0 && state && state.annotations[editingTextIndex]) {
        state.annotations[editingTextIndex].color = value;
      } else {
        updateSelectedAnnotation(function (annotation) {
          annotation.color = value;
        });
      }
    });

    function updateSelectedAnnotation(mutator) {
      if (!state || busy || editingTextIndex !== -1 || annotationMode !== 'select' ||
          selectedAnnotation < 0 || !state.annotations[selectedAnnotation]) return false;
      const before = snapshot();
      mutator(state.annotations[selectedAnnotation]);
      setHistory(before);
      render();
      syncControls();
      return true;
    }

    function syncSelectedMarkControls() {
      if (!state || annotationMode !== 'select' || selectedAnnotation < 0) return;
      const annotation = state.annotations[selectedAnnotation];
      if (!annotation) return;
      const value = annotation.type === 'text'
        ? Math.max(8, annotation.size || 42)
        : Math.max(1, annotation.width || 1);
      drawWidth.value = String(value);
      drawWidthVal.textContent = String(value);
      drawColorValue = annotation.color || drawColorValue;
      selectPalette(drawPalette, drawColorValue);
      drawOpacity.value = String(annotation.opacity == null ? 100 : annotation.opacity);
      drawOpacityVal.textContent = drawOpacity.value;
      drawFill.checked = !!annotation.fill;
    }

    const sliderDefs = [
      ['brightness', 'editorBrightness', 'editorBrightnessVal', 0],
      ['contrast', 'editorContrast', 'editorContrastVal', 0],
      ['saturation', 'editorSaturation', 'editorSaturationVal', 0],
      ['blur', 'editorBlur', 'editorBlurVal', 0],
      ['opacity', 'editorOpacity', 'editorOpacityVal', 100],
    ];

    function preferredFormat(it) {
      const ext = Pico.extOf(it && it.name);
      return ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : (ext === 'webp' ? 'webp' : 'png');
    }

    function freshState(it) {
      return {
        rotation: 0,
        brightness: 0,
        contrast: 0,
        saturation: 0,
        blur: 0,
        opacity: 100,
        cropEnabled: false,
        ratio: 'free',
        crop: null,
        annotations: [],
        format: preferredFormat(it),
        quality: 100,
      };
    }

    function orientedW() { return state && state.rotation % 180 ? sourceH : sourceW; }
    function orientedH() { return state && state.rotation % 180 ? sourceW : sourceH; }

    function fullCrop() { return { x: 0, y: 0, w: orientedW(), h: orientedH() }; }

    function previewScale() {
      const width = canvas.getBoundingClientRect().width;
      const imageWidth = orientedW();
      return width > 0 && imageWidth > 0 ? width / imageWidth : displayScale * editorZoom;
    }

    function cloneCrop(c) {
      return c ? { x: c.x, y: c.y, w: c.w, h: c.h } : null;
    }

    function cloneAnnotation(a) {
      const copy = Object.assign({}, a);
      if (a.points) copy.points = a.points.map(function (p) { return { x: p.x, y: p.y }; });
      return copy;
    }

    function cloneAnnotations(list) {
      return (list || []).map(cloneAnnotation);
    }

    function snapshot() {
      return {
        rotation: state.rotation,
        brightness: state.brightness, contrast: state.contrast,
        saturation: state.saturation, blur: state.blur,
        opacity: state.opacity,
        cropEnabled: state.cropEnabled, ratio: state.ratio,
        crop: cloneCrop(state.crop), annotations: cloneAnnotations(state.annotations),
        format: state.format, quality: state.quality,
      };
    }

    function sameCrop(a, b) {
      if (!a || !b) return a === b;
      return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01 &&
        Math.abs(a.w - b.w) < 0.01 && Math.abs(a.h - b.h) < 0.01;
    }

    function sameSnapshot(a, b) {
      return a.rotation === b.rotation &&
        a.brightness === b.brightness && a.contrast === b.contrast &&
        a.saturation === b.saturation && a.blur === b.blur &&
        a.opacity === b.opacity &&
        a.cropEnabled === b.cropEnabled && a.ratio === b.ratio &&
        a.format === b.format && a.quality === b.quality && sameCrop(a.crop, b.crop) &&
        JSON.stringify(a.annotations || []) === JSON.stringify(b.annotations || []);
    }

    function normalizeCrop(c) {
      const w = orientedW(), h = orientedH();
      if (!c || !w || !h) return fullCrop();
      const x = clamp(Math.min(c.x, c.x + c.w), 0, w);
      const y = clamp(Math.min(c.y, c.y + c.h), 0, h);
      const right = clamp(Math.max(c.x, c.x + c.w), x, w);
      const bottom = clamp(Math.max(c.y, c.y + c.h), y, h);
      return { x: x, y: y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
    }

    function setHistory(before) {
      if (sameSnapshot(before, snapshot())) return;
      history.push(before);
      if (history.length > 50) history.shift();
      future = [];
    }

    function commit(mutator) {
      if (!source || !state || busy) return;
      if (editingTextIndex !== -1) commitTextEdit();
      const before = snapshot();
      mutator();
      state.crop = normalizeCrop(state.crop);
      setHistory(before);
      render();
      syncControls();
    }

    function restore(snap) {
      state = {
        rotation: snap.rotation,
        brightness: snap.brightness, contrast: snap.contrast,
        saturation: snap.saturation, blur: snap.blur,
        opacity: snap.opacity == null ? 100 : snap.opacity,
        cropEnabled: snap.cropEnabled, ratio: snap.ratio,
        crop: cloneCrop(snap.crop), annotations: cloneAnnotations(snap.annotations),
        format: snap.format, quality: snap.quality,
      };
      state.crop = normalizeCrop(state.crop);
      render();
      syncControls();
    }

    function undo() {
      if (editingTextIndex !== -1) commitTextEdit();
      if (!history.length || busy) return;
      future.push(snapshot());
      restore(history.pop());
    }

    function redo() {
      if (editingTextIndex !== -1) commitTextEdit();
      if (!future.length || busy) return;
      history.push(snapshot());
      restore(future.pop());
    }

    function filterText() {
      return 'brightness(' + (100 + state.brightness) + '%) ' +
        'contrast(' + (100 + state.contrast) + '%) ' +
        'saturate(' + (100 + state.saturation) + '%) ' +
        'blur(' + state.blur + 'px)';
    }

    function drawTransformed(ctx) {
      const w = orientedW(), h = orientedH();
      ctx.save();
      ctx.filter = filterText();
      ctx.globalAlpha = clamp((state.opacity == null ? 100 : state.opacity) / 100, 0, 1);
      ctx.translate(w / 2, h / 2);
      ctx.rotate(state.rotation * Math.PI / 180);
      ctx.drawImage(source, -sourceW / 2, -sourceH / 2, sourceW, sourceH);
      ctx.restore();
      ctx.filter = 'none';
    }

    function normalizeAngle(value) {
      let n = (Number(value) || 0) % 360;
      if (n > 180) n -= 360;
      if (n < -180) n += 360;
      return n;
    }

    function rotatePoint(p, center, degrees) {
      const rad = degrees * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const dx = p.x - center.x, dy = p.y - center.y;
      return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
    }

    function annotationBaseBounds(a) {
      if (!a) return { x: 0, y: 0, w: 0, h: 0 };
      if (a.type === 'pen' && a.points && a.points.length) {
        const xs = a.points.map(function (p) { return p.x; });
        const ys = a.points.map(function (p) { return p.y; });
        const pad = Math.max(6, (a.width || 1) * 1.5);
        const minX = Math.min.apply(Math, xs), maxX = Math.max.apply(Math, xs);
        const minY = Math.min.apply(Math, ys), maxY = Math.max.apply(Math, ys);
        return { x: minX - pad, y: minY - pad, w: Math.max(1, maxX - minX + pad * 2), h: Math.max(1, maxY - minY + pad * 2) };
      }
      if (a.type === 'text') {
        const size = Math.max(8, a.size || 42);
        const text = String(a.text || '');
        textMeasureCtx.font = (a.bold ? '700 ' : '400 ') + size + 'px "Segoe UI", "Microsoft YaHei", sans-serif';
        const metrics = textMeasureCtx.measureText(text || ' ');
        const width = Math.max(1, metrics.width || size);
        const ascent = metrics.actualBoundingBoxAscent || size * 0.78;
        const descent = metrics.actualBoundingBoxDescent || size * 0.22;
        return { x: a.x || 0, y: a.y || 0, w: width, h: Math.max(1, ascent + descent) };
      }
      const x = Math.min(a.x || 0, (a.x || 0) + (a.w || 0));
      const y = Math.min(a.y || 0, (a.y || 0) + (a.h || 0));
      const pad = Math.max(6, (a.width || 1) * 1.5);
      return { x: x - pad, y: y - pad, w: Math.abs(a.w || 0) + pad * 2, h: Math.abs(a.h || 0) + pad * 2 };
    }

    function annotationCenter(a) {
      const b = annotationBaseBounds(a);
      return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    }

    function annotationBounds(a) {
      const b = annotationBaseBounds(a);
      const angle = normalizeAngle(a && a.rotation);
      if (!angle) return b;
      const center = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      const corners = [
        rotatePoint({ x: b.x, y: b.y }, center, angle),
        rotatePoint({ x: b.x + b.w, y: b.y }, center, angle),
        rotatePoint({ x: b.x, y: b.y + b.h }, center, angle),
        rotatePoint({ x: b.x + b.w, y: b.y + b.h }, center, angle),
      ];
      const xs = corners.map(function (p) { return p.x; });
      const ys = corners.map(function (p) { return p.y; });
      const minX = Math.min.apply(Math, xs), maxX = Math.max.apply(Math, xs);
      const minY = Math.min.apply(Math, ys), maxY = Math.max.apply(Math, ys);
      return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
    }

    function contextScale(ctx) {
      if (ctx && typeof ctx.getTransform === 'function') {
        const transform = ctx.getTransform();
        return Math.max(0.01, Math.hypot(transform.a || 1, transform.b || 0));
      }
      return Math.max(0.01, ctx && ctx.__picoScale ? ctx.__picoScale : 1);
    }

    function drawMosaic(ctx, a, x, y, w, h) {
      if (!w || !h) return;
      const scale = contextScale(ctx);
      const logicalW = ctx.canvas.width / scale;
      const logicalH = ctx.canvas.height / scale;
      const left = Math.max(0, Math.floor(x * scale));
      const top = Math.max(0, Math.floor(y * scale));
      const right = Math.min(ctx.canvas.width, Math.ceil((x + w) * scale));
      const bottom = Math.min(ctx.canvas.height, Math.ceil((y + h) * scale));
      if (right <= left || bottom <= top || x >= logicalW || y >= logicalH) return;
      let imageData;
      try {
        imageData = ctx.getImageData(left, top, right - left, bottom - top);
      } catch (e) {
        return;
      }
      const block = Math.max(2, Math.round((a.width || 8) * scale));
      const pixels = imageData.data;
      const regionW = imageData.width;
      const regionH = imageData.height;
      for (let by = 0; by < regionH; by += block) {
        for (let bx = 0; bx < regionW; bx += block) {
          const sampleX = Math.min(regionW - 1, bx + Math.floor(Math.min(block, regionW - bx) / 2));
          const sampleY = Math.min(regionH - 1, by + Math.floor(Math.min(block, regionH - by) / 2));
          const sample = (sampleY * regionW + sampleX) * 4;
          for (let py = by; py < Math.min(regionH, by + block); py++) {
            for (let px = bx; px < Math.min(regionW, bx + block); px++) {
              const index = (py * regionW + px) * 4;
              pixels[index] = pixels[sample];
              pixels[index + 1] = pixels[sample + 1];
              pixels[index + 2] = pixels[sample + 2];
              pixels[index + 3] = pixels[sample + 3];
            }
          }
        }
      }
      const mosaic = document.createElement('canvas');
      mosaic.width = regionW;
      mosaic.height = regionH;
      mosaic.getContext('2d').putImageData(imageData, 0, 0);
      const smoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(mosaic, x, y, w, h);
      ctx.imageSmoothingEnabled = smoothing;
    }

    function drawAnnotation(ctx, a) {
      if (!a) return;
      const alpha = clamp((a.opacity == null ? 100 : a.opacity) / 100, 0, 1);
      const x = Math.min(a.x || 0, (a.x || 0) + (a.w || 0));
      const y = Math.min(a.y || 0, (a.y || 0) + (a.h || 0));
      const w = Math.abs(a.w || 0);
      const h = Math.abs(a.h || 0);
      const center = annotationCenter(a);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = a.color || '#ff0000';
      ctx.fillStyle = a.color || '#ff0000';
      ctx.lineWidth = Math.max(1, a.width || 1);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (normalizeAngle(a.rotation)) {
        ctx.translate(center.x, center.y);
        ctx.rotate(normalizeAngle(a.rotation) * Math.PI / 180);
        ctx.translate(-center.x, -center.y);
      }
      if (a.type === 'pen') {
        if (a.points && a.points.length) {
          ctx.beginPath();
          ctx.moveTo(a.points[0].x, a.points[0].y);
          for (let i = 1; i < a.points.length; i++) ctx.lineTo(a.points[i].x, a.points[i].y);
          if (a.points.length === 1) ctx.lineTo(a.points[0].x + 0.1, a.points[0].y + 0.1);
          ctx.stroke();
        }
      } else if (a.type === 'line' || a.type === 'arrow') {
        const x2 = (a.x || 0) + (a.w || 0), y2 = (a.y || 0) + (a.h || 0);
        ctx.beginPath(); ctx.moveTo(a.x || 0, a.y || 0); ctx.lineTo(x2, y2); ctx.stroke();
        if (a.type === 'arrow') {
          const angle = Math.atan2(y2 - (a.y || 0), x2 - (a.x || 0));
          const head = Math.max(10, (a.width || 1) * 3.5);
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
        }
      } else if (a.type === 'rect') {
        if (a.fill) { ctx.save(); ctx.globalAlpha = alpha * 0.22; ctx.fillRect(x, y, w, h); ctx.restore(); }
        ctx.strokeRect(x, y, w, h);
      } else if (a.type === 'ellipse') {
        ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, Math.max(0.5, w / 2), Math.max(0.5, h / 2), 0, 0, Math.PI * 2);
        if (a.fill) { ctx.save(); ctx.globalAlpha = alpha * 0.22; ctx.fill(); ctx.restore(); }
        ctx.stroke();
      } else if (a.type === 'mosaic') {
        drawMosaic(ctx, a, x, y, w, h);
      } else if (a.type === 'text') {
        const size = Math.max(8, a.size || 42);
        ctx.font = (a.bold ? '700 ' : '400 ') + size + 'px "Segoe UI", "Microsoft YaHei", sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(a.text || '', a.x || 0, a.y || 0);
      }
      ctx.restore();
    }

    function drawSelection(ctx, a) {
      const b = annotationBounds(a);
      ctx.save();
      ctx.strokeStyle = '#6a8dff';
      ctx.lineWidth = 2 / Math.max(0.01, displayScale);
      ctx.setLineDash([8 / Math.max(0.01, displayScale), 5 / Math.max(0.01, displayScale)]);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.restore();
    }

    function drawAnnotations(ctx) {
      (state.annotations || []).forEach(function (a, index) {
        if (index !== editingTextIndex) drawAnnotation(ctx, a);
      });
      if (activeAnnotation) drawAnnotation(ctx, activeAnnotation);
      if (selectedAnnotation >= 0 && state.annotations[selectedAnnotation]) drawSelection(ctx, state.annotations[selectedAnnotation]);
    }

    function pointNearSegment(p, a, b, distance) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1) : 0;
      const x = a.x + t * dx, y = a.y + t * dy;
      return Math.hypot(p.x - x, p.y - y) <= distance;
    }

    function hitAnnotation(p, a) {
      const q = normalizeAngle(a && a.rotation) ? rotatePoint(p, annotationCenter(a), -normalizeAngle(a.rotation)) : p;
      const b = annotationBaseBounds(a);
      if (a.type === 'text') return q.x >= b.x && q.x <= b.x + b.w && q.y >= b.y && q.y <= b.y + b.h;
      if (a.type === 'pen') {
        for (let i = 1; i < (a.points || []).length; i++) {
          if (pointNearSegment(q, a.points[i - 1], a.points[i], Math.max(8, (a.width || 1) * 1.8))) return true;
        }
        return false;
      }
      if (a.type === 'line' || a.type === 'arrow') {
        return pointNearSegment(q, { x: a.x || 0, y: a.y || 0 }, { x: (a.x || 0) + (a.w || 0), y: (a.y || 0) + (a.h || 0) }, Math.max(8, (a.width || 1) * 1.8));
      }
      if (a.type === 'mosaic') {
        const mx = Math.min(a.x || 0, (a.x || 0) + (a.w || 0));
        const my = Math.min(a.y || 0, (a.y || 0) + (a.h || 0));
        return q.x >= mx && q.x <= mx + Math.abs(a.w || 0) && q.y >= my && q.y <= my + Math.abs(a.h || 0);
      }
      if (a.type === 'ellipse') {
        const rx = Math.max(1, Math.abs(a.w || 0) / 2), ry = Math.max(1, Math.abs(a.h || 0) / 2);
        const n = Math.pow((q.x - (Math.min(a.x || 0, (a.x || 0) + (a.w || 0)) + rx)) / rx, 2) + Math.pow((q.y - (Math.min(a.y || 0, (a.y || 0) + (a.h || 0)) + ry)) / ry, 2);
        return a.fill ? n <= 1.08 : Math.abs(n - 1) <= Math.max(0.12, 12 / Math.max(rx, ry));
      }
      const x = Math.min(a.x || 0, (a.x || 0) + (a.w || 0));
      const y = Math.min(a.y || 0, (a.y || 0) + (a.h || 0));
      const w = Math.abs(a.w || 0), h = Math.abs(a.h || 0);
      const inside = q.x >= x && q.x <= x + w && q.y >= y && q.y <= y + h;
      if (a.fill && inside) return true;
      const edge = Math.max(7, (a.width || 1) * 1.8);
      return inside && (Math.abs(q.x - x) <= edge || Math.abs(q.x - (x + w)) <= edge || Math.abs(q.y - y) <= edge || Math.abs(q.y - (y + h)) <= edge);
    }

    function translateAnnotation(a, dx, dy) {
      if (a.type === 'pen') (a.points || []).forEach(function (p) { p.x += dx; p.y += dy; });
      else { a.x = (a.x || 0) + dx; a.y = (a.y || 0) + dy; }
    }

    function remapAnnotations(list, mapper, rotationDelta) {
      return (list || []).map(function (a) {
        const copy = cloneAnnotation(a);
        if (rotationDelta) copy.rotation = normalizeAngle((copy.rotation || 0) + rotationDelta);
        if (copy.type === 'pen') {
          copy.points = (copy.points || []).map(mapper);
        } else if (copy.type === 'text') {
          const p = mapper({ x: copy.x || 0, y: copy.y || 0 });
          copy.x = p.x; copy.y = p.y;
        } else {
          const x = copy.x || 0, y = copy.y || 0, x2 = x + (copy.w || 0), y2 = y + (copy.h || 0);
          const points = [mapper({ x: x, y: y }), mapper({ x: x2, y: y }), mapper({ x: x, y: y2 }), mapper({ x: x2, y: y2 })];
          const xs = points.map(function (p) { return p.x; }), ys = points.map(function (p) { return p.y; });
          const minX = Math.min.apply(Math, xs), maxX = Math.max.apply(Math, xs);
          const minY = Math.min.apply(Math, ys), maxY = Math.max.apply(Math, ys);
          copy.x = minX; copy.y = minY; copy.w = maxX - minX; copy.h = maxY - minY;
        }
        return copy;
      });
    }

    function render() {
      if (!source || !state) return;
      const w = orientedW(), h = orientedH();
      const maxW = Math.max(180, preview.clientWidth - 34);
      const maxH = Math.max(180, preview.clientHeight - 34);
      displayScale = Math.min(1, maxW / w, maxH / h);
      if (!isFinite(displayScale) || displayScale <= 0) displayScale = 1;
      canvas.width = Math.max(1, Math.round(w * displayScale));
      canvas.height = Math.max(1, Math.round(h * displayScale));
      // 保留适应窗口的基础采样尺寸，再用 CSS 尺寸放大预览；这样滚轮缩放
      // 不会改变导出像素，也不会让大图因为重新采样而变模糊。
      canvas.style.width = Math.max(1, Math.round(w * displayScale * editorZoom)) + 'px';
      canvas.style.height = Math.max(1, Math.round(h * displayScale * editorZoom)) + 'px';
      canvas.style.maxWidth = 'none';
      canvas.style.maxHeight = 'none';
      const ctx = canvas.getContext('2d');
      ctx.__picoScale = displayScale;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(displayScale, displayScale);
      drawTransformed(ctx);
      drawAnnotations(ctx);
      ctx.restore();

      state.crop = normalizeCrop(state.crop);
      const cr = state.crop;
      const outputCrop = state.cropEnabled ? cr : fullCrop();
      const canvasRect = canvas.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      const visualScale = previewScale();
      cropBox.style.left = (canvasRect.left - previewRect.left + cr.x * visualScale) + 'px';
      cropBox.style.top = (canvasRect.top - previewRect.top + cr.y * visualScale) + 'px';
      cropBox.style.width = Math.max(2, cr.w * visualScale) + 'px';
      cropBox.style.height = Math.max(2, cr.h * visualScale) + 'px';
      cropBox.hidden = !state.cropEnabled;
      cropSize.textContent = Math.round(cr.w) + ' × ' + Math.round(cr.h);
      const outputSize = outputPixelSize(outputCrop);
      hint.hidden = true;
      status.textContent = w + ' × ' + h + ' px  ·  输出 ' + outputSize.w + ' × ' + outputSize.h + ' px' +
        '  ·  预览 ' + Math.round(editorZoom * 100) + '%' +
        (state.rotation ? '  ·  ' + state.rotation + '°' : '') +
        (state.blur ? '  ·  模糊 ' + state.blur + ' px' : '') +
        (state.annotations && state.annotations.length ? '  ·  标注 ' + state.annotations.length : '');
      updateInlineTextPosition();
    }

    function updateInlineTextPosition() {
      if (editingTextIndex === -1 || !editingTextPoint || inlineText.hidden || !source) return;
      const canvasRect = canvas.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      const scale = previewScale();
      const left = canvasRect.left - previewRect.left + editingTextPoint.x * scale;
      const top = canvasRect.top - previewRect.top + editingTextPoint.y * scale;
      const maxLeft = Math.max(6, preview.clientWidth - inlineText.offsetWidth - 6);
      const maxTop = Math.max(6, preview.clientHeight - inlineText.offsetHeight - 6);
      inlineText.style.left = clamp(left, 6, maxLeft) + 'px';
      inlineText.style.top = clamp(top, 6, maxTop) + 'px';
    }

    function updateInlineTextStyle() {
      if (editingTextIndex === -1 || !inlineText) return;
      const existing = editingTextIndex >= 0 ? state.annotations[editingTextIndex] : null;
      const size = Math.max(8, existing ? existing.size || 42 : +drawWidth.value || 42);
      const color = existing ? existing.color || drawColorValue : drawColorValue;
      const bold = existing ? !!existing.bold : !!textBold.checked;
      const fontSize = Math.max(12, Math.round(size * previewScale()));
      inlineText.style.fontSize = fontSize + 'px';
      inlineText.style.lineHeight = Math.max(1, Math.round(fontSize * 1.25)) + 'px';
      inlineText.style.height = Math.max(32, Math.round(fontSize * 1.45)) + 'px';
      inlineText.style.fontWeight = bold ? '700' : '400';
      inlineText.style.color = color;
      const hex = color.replace('#', '');
      const red = parseInt(hex.slice(0, 2), 16) || 0;
      const green = parseInt(hex.slice(2, 4), 16) || 0;
      const blue = parseInt(hex.slice(4, 6), 16) || 0;
      inlineText.style.background = (red * 0.299 + green * 0.587 + blue * 0.114) < 128 ? 'rgba(255, 255, 255, .88)' : 'rgba(8, 12, 20, .86)';
      const chars = Math.max(8, String(inlineText.value || '').length + 2);
      const width = Math.min(Math.max(140, Math.round(chars * fontSize * 0.62 + 18)), Math.max(140, preview.clientWidth - 16));
      inlineText.style.width = width + 'px';
      updateInlineTextPosition();
    }

    function hideInlineText() {
      inlineText.hidden = true;
      inlineText.value = '';
      inlineText.style.left = '';
      inlineText.style.top = '';
      editingTextIndex = -1;
      editingTextPoint = null;
      editingTextBefore = null;
    }

    function commitTextEdit() {
      if (editingTextIndex === -1 || !state) return;
      const index = editingTextIndex;
      const before = editingTextBefore;
      const value = inlineText.value.trim();
      if (value) {
        if (index >= 0 && state.annotations[index]) {
          state.annotations[index].text = value;
          state.annotations[index].size = Math.max(8, +drawWidth.value || 42);
          state.annotations[index].color = drawColorValue;
          state.annotations[index].bold = !!textBold.checked;
          selectedAnnotation = index;
        } else {
          const opts = markSettings();
          state.annotations.push({
            type: 'text', x: editingTextPoint.x, y: editingTextPoint.y, text: value,
            size: Math.max(8, +drawWidth.value || 42), color: drawColorValue,
            bold: !!textBold.checked, opacity: opts.opacity, width: 0, fill: false, rotation: 0,
          });
          selectedAnnotation = state.annotations.length - 1;
        }
        setHistory(before);
      }
      hideInlineText();
      lastTextSize = Math.max(8, +drawWidth.value || lastTextSize);
      drawWidth.value = String(lastDrawWidth);
      drawWidthVal.textContent = drawWidth.value;
      annotationMode = 'select';
      render();
      syncControls();
    }

    function cancelTextEdit() {
      if (editingTextIndex === -1) return;
      const isNew = editingTextIndex < 0;
      hideInlineText();
      if (isNew) selectedAnnotation = -1;
      lastTextSize = Math.max(8, +drawWidth.value || lastTextSize);
      drawWidth.value = String(lastDrawWidth);
      drawWidthVal.textContent = drawWidth.value;
      annotationMode = 'select';
      render();
      syncControls();
    }

    function beginTextEdit(point, index) {
      if (!state || busy) return;
      if (editingTextIndex !== -1) commitTextEdit();
      const existing = index >= 0 && state.annotations[index] && state.annotations[index].type === 'text' ? state.annotations[index] : null;
      editingTextIndex = existing ? index : -2;
      editingTextPoint = { x: existing ? existing.x : point.x, y: existing ? existing.y : point.y };
      editingTextBefore = snapshot();
      selectedAnnotation = existing ? index : -1;
      annotationMode = 'text';
      if (existing) {
        lastTextSize = Math.max(8, existing.size || 42);
        drawWidth.value = String(lastTextSize);
        drawWidthVal.textContent = drawWidth.value;
        drawColorValue = existing.color || drawColorValue;
        selectPalette(drawPalette, drawColorValue);
        textBold.checked = !!existing.bold;
      }
      inlineText.value = existing ? existing.text || '' : '';
      inlineText.hidden = false;
      render();
      syncControls();
      updateInlineTextStyle();
      inlineText.focus();
      inlineText.select();
    }

    function canRotateSelectedMark() {
      const a = state && selectedAnnotation >= 0 ? state.annotations[selectedAnnotation] : null;
      return !!a && a.type !== 'text';
    }

    function updateRotationUI() {
      const enabled = canRotateSelectedMark() && !busy;
      const a = enabled ? state.annotations[selectedAnnotation] : null;
      const angle = a ? normalizeAngle(a.rotation) : 0;
      shapeRotation.value = String(angle);
      shapeRotationVal.textContent = String(angle);
      shapeRotation.disabled = !enabled;
      rotateMarkCCW.disabled = !enabled;
      rotateMarkCW.disabled = !enabled;
    }

    function rotateSelectedMark(delta) {
      if (!canRotateSelectedMark()) return;
      commit(function () {
        const a = state.annotations[selectedAnnotation];
        a.rotation = normalizeAngle((a.rotation || 0) + delta);
      });
    }

    function updateMarkUI() {
      document.querySelectorAll('.editor-mark-tool').forEach(function (button) {
        const mode = button.id.replace('editorTool', '').toLowerCase();
        button.classList.toggle('on', mode === annotationMode);
      });
      preview.classList.toggle('marking', annotationMode !== 'select' && !state.cropEnabled);
      preview.classList.toggle('selecting', annotationMode === 'select' && !state.cropEnabled);
      preview.style.cursor = state.cropEnabled && annotationMode === 'select' ? 'crosshair' : '';
      updateInlineTextPosition();
    }

    function chooseMarkMode(mode) {
      if (!state) { annotationMode = mode; return; }
      if (editingTextIndex !== -1) commitTextEdit();
      if (mode === 'text' && annotationMode !== 'text') {
        if (annotationMode !== 'select' || selectedAnnotation < 0) {
          lastDrawWidth = Math.max(1, +drawWidth.value || lastDrawWidth);
        }
        drawWidth.value = String(lastTextSize);
        drawWidthVal.textContent = drawWidth.value;
      } else if (mode !== 'text' && annotationMode === 'text') {
        lastTextSize = Math.max(8, +drawWidth.value || lastTextSize);
        drawWidth.value = String(lastDrawWidth);
        drawWidthVal.textContent = drawWidth.value;
      }
      if (mode !== 'select' && state.cropEnabled) commit(function () { state.cropEnabled = false; });
      annotationMode = mode;
      selectedAnnotation = -1;
      activeAnnotation = null;
      updateMarkUI();
      render();
    }

    function removeSelectedAnnotation() {
      if (!state || selectedAnnotation < 0 || !state.annotations[selectedAnnotation]) return;
      commit(function () {
        state.annotations.splice(selectedAnnotation, 1);
        selectedAnnotation = -1;
      });
    }

    function syncControls() {
      if (!state) return;
      sliderDefs.forEach(function (def) {
        const el = $(def[1]), out = $(def[2]);
        el.value = state[def[0]];
        out.textContent = state[def[0]];
      });
      format.value = state.format;
      quality.value = state.quality;
      qualityVal.textContent = state.quality;
      qualityWrap.hidden = state.format === 'png';
      undoBtn.disabled = !history.length || busy;
      redoBtn.disabled = !future.length || busy;
      $('editorCropToggle').textContent = state.cropEnabled ? '关闭裁剪' : '启用裁剪';
      $('editorCropToggle').classList.toggle('on', state.cropEnabled);
      document.querySelectorAll('#editorRatios button').forEach(function (b) {
        const value = b.dataset.ratio;
        const selected = value === state.ratio || (value === 'free' && state.ratio == null);
        b.classList.toggle('on', selected);
      });
      [
        ['editorBrightness', state.brightness !== 0],
        ['editorContrast', state.contrast !== 0],
        ['editorSaturation', state.saturation !== 0],
        ['editorBlur', state.blur !== 0],
        ['editorOpacity', state.opacity !== 100],
      ].forEach(function (x) { $(x[0]).closest('.editor-range').classList.toggle('changed', x[1]); });
      if (annotationMode === 'select' && selectedAnnotation >= 0) syncSelectedMarkControls();
      drawWidthVal.textContent = drawWidth.value;
      drawOpacityVal.textContent = drawOpacity.value;
      selectPalette(drawPalette, drawColorValue);
      $('editorClearMarks').disabled = !state.annotations.length || busy;
      updateMarkUI();
      updateRotationUI();
      updateInlineTextStyle();
      syncDimensionControls(false);
    }

    function cropPixelSize(crop) {
      const c = crop || (state && state.cropEnabled ? normalizeCrop(state.crop) : fullCrop());
      return {
        w: Math.max(1, Math.round(c && c.w ? c.w : orientedW())),
        h: Math.max(1, Math.round(c && c.h ? c.h : orientedH())),
      };
    }

    function syncDimensionControls(force) {
      if (!state || !outputWidth || !outputHeight) return;
      if (force || !outputSizeDirty) {
        const size = cropPixelSize();
        outputWidth.value = String(size.w);
        outputHeight.value = String(size.h);
      }
      dimensionLock.classList.toggle('on', dimensionRatioLocked);
      dimensionLock.setAttribute('aria-pressed', dimensionRatioLocked ? 'true' : 'false');
      dimensionLock.title = dimensionRatioLocked ? '已锁定宽高比，修改一边会联动另一边' : '未锁定宽高比，可分别设置宽高';
    }

    function outputPixelSize(crop) {
      const base = cropPixelSize(crop);
      if (!outputSizeDirty) return base;
      return {
        w: clamp(Math.round(+outputWidth.value || base.w), 1, 12000),
        h: clamp(Math.round(+outputHeight.value || base.h), 1, 12000),
      };
    }

    function updateOutputDimension(changed) {
      if (!state) return;
      const base = cropPixelSize();
      let width = clamp(Math.round(+outputWidth.value || 1), 1, 12000);
      let height = clamp(Math.round(+outputHeight.value || 1), 1, 12000);
      if (dimensionRatioLocked) {
        const ratio = (base.w || width) / (base.h || height) || 1;
        if (changed === 'width') height = clamp(Math.round(width / ratio), 1, 12000);
        else width = clamp(Math.round(height * ratio), 1, 12000);
      }
      outputWidth.value = String(width);
      outputHeight.value = String(height);
      outputSizeDirty = true;
      render();
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

    function cropWithRatio(c, ratio) {
      if (!ratio || ratio <= 0) return c;
      let w = c.w, h = c.h;
      if (w / h > ratio) w = h * ratio; else h = w / ratio;
      return { x: c.x + (c.w - w) / 2, y: c.y + (c.h - h) / 2, w: w, h: h };
    }

    function ratioValue(value) {
      if (value === 'free') return null;
      if (value === 'original') return orientedW() / orientedH();
      return parseFloat(value);
    }

    function pointOnImage(e) {
      const r = canvas.getBoundingClientRect();
      return {
        x: clamp((e.clientX - r.left) / Math.max(1, r.width) * orientedW(), 0, orientedW()),
        y: clamp((e.clientY - r.top) / Math.max(1, r.height) * orientedH(), 0, orientedH()),
      };
    }

    function pointInsideCrop(p, c) {
      return p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h;
    }

    function cropHandleAt(p, c) {
      const tolerance = Math.max(10, 16 / Math.max(0.01, displayScale));
      const left = Math.abs(p.x - c.x) <= tolerance;
      const right = Math.abs(p.x - (c.x + c.w)) <= tolerance;
      const top = Math.abs(p.y - c.y) <= tolerance;
      const bottom = Math.abs(p.y - (c.y + c.h)) <= tolerance;
      const withinX = p.x >= c.x - tolerance && p.x <= c.x + c.w + tolerance;
      const withinY = p.y >= c.y - tolerance && p.y <= c.y + c.h + tolerance;
      if (left && top) return 'nw';
      if (right && top) return 'ne';
      if (left && bottom) return 'sw';
      if (right && bottom) return 'se';
      if (top && withinX) return 'n';
      if (right && withinY) return 'e';
      if (bottom && withinX) return 's';
      if (left && withinY) return 'w';
      if (pointInsideCrop(p, c)) return 'move';
      return 'new';
    }

    function cropCursor(handle) {
      return ({
        nw: 'nwse-resize', se: 'nwse-resize',
        ne: 'nesw-resize', sw: 'nesw-resize',
        n: 'ns-resize', s: 'ns-resize',
        e: 'ew-resize', w: 'ew-resize',
        move: 'move', new: 'crosshair',
      })[handle] || 'crosshair';
    }

    function cropIsFull(c) {
      return c.x < 0.01 && c.y < 0.01 &&
        c.w > orientedW() - 0.01 && c.h > orientedH() - 0.01;
    }

    function updateCropCursor(p) {
      if (!state || !state.cropEnabled || annotationMode !== 'select') return;
      const current = normalizeCrop(state.crop);
      preview.style.cursor = cropCursor(cropIsFull(current) ? 'new' : cropHandleAt(p, current));
    }

    function newCropFromPointer(cp, p) {
      const ow = orientedW(), oh = orientedH();
      const dx = p.x - cp.start.x, dy = p.y - cp.start.y;
      let x = dx >= 0 ? cp.start.x : p.x;
      let y = dy >= 0 ? cp.start.y : p.y;
      let w = Math.abs(dx), h = Math.abs(dy);
      const ratio = state.ratio && state.ratio !== 'original' ? ratioValue(state.ratio) : null;
      if (ratio && w && h) {
        if (w / h > ratio) h = w / ratio; else w = h * ratio;
        if (dx < 0) x = cp.start.x - w;
        if (dy < 0) y = cp.start.y - h;
      }
      w = Math.max(12, w); h = Math.max(12, h);
      if (x < 0) { w += x; x = 0; }
      if (y < 0) { h += y; y = 0; }
      if (x + w > ow) w = ow - x;
      if (y + h > oh) h = oh - y;
      return { x: x, y: y, w: Math.max(1, w), h: Math.max(1, h) };
    }

    function resizeCropFromPointer(cp, p) {
      const b = cp.base;
      const ow = orientedW(), oh = orientedH();
      const min = Math.min(12, ow, oh);
      const handle = cp.handle;
      let left = b.x, right = b.x + b.w, top = b.y, bottom = b.y + b.h;
      if (handle.indexOf('w') !== -1) left = clamp(p.x, 0, right - min);
      if (handle.indexOf('e') !== -1) right = clamp(p.x, left + min, ow);
      if (handle.indexOf('n') !== -1) top = clamp(p.y, 0, bottom - min);
      if (handle.indexOf('s') !== -1) bottom = clamp(p.y, top + min, oh);
      let width = Math.max(min, right - left);
      let height = Math.max(min, bottom - top);
      const ratio = state.ratio && state.ratio !== 'free' ? ratioValue(state.ratio) : null;
      if (!ratio || !isFinite(ratio) || ratio <= 0) {
        return { x: left, y: top, w: width, h: height };
      }

      const isHorizontalEdge = handle === 'e' || handle === 'w';
      const isVerticalEdge = handle === 'n' || handle === 's';
      if (isHorizontalEdge) {
        height = Math.max(min, width / ratio);
        if (height > oh) { height = oh; width = height * ratio; }
        if (handle === 'w') left = right - width; else right = left + width;
        const centerY = (b.y + b.h / 2);
        top = clamp(centerY - height / 2, 0, oh - height);
        bottom = top + height;
      } else if (isVerticalEdge) {
        width = Math.max(min, height * ratio);
        if (width > ow) { width = ow; height = width / ratio; }
        if (handle === 'n') top = bottom - height; else bottom = top + height;
        const centerX = (b.x + b.w / 2);
        left = clamp(centerX - width / 2, 0, ow - width);
        right = left + width;
      } else {
        const anchorX = handle.indexOf('w') !== -1 ? b.x + b.w : b.x;
        const anchorY = handle.indexOf('n') !== -1 ? b.y + b.h : b.y;
        const signX = handle.indexOf('w') !== -1 ? -1 : 1;
        const signY = handle.indexOf('n') !== -1 ? -1 : 1;
        if (width / height > ratio) height = width / ratio; else width = height * ratio;
        const maxWidth = signX < 0 ? anchorX : ow - anchorX;
        const maxHeight = signY < 0 ? anchorY : oh - anchorY;
        if (width > maxWidth) { width = maxWidth; height = width / ratio; }
        if (height > maxHeight) { height = maxHeight; width = height * ratio; }
        width = Math.max(1, width); height = Math.max(1, height);
        left = signX < 0 ? anchorX - width : anchorX;
        right = signX < 0 ? anchorX : anchorX + width;
        top = signY < 0 ? anchorY - height : anchorY;
        bottom = signY < 0 ? anchorY : anchorY + height;
      }
      return { x: clamp(left, 0, ow), y: clamp(top, 0, oh), w: Math.max(1, right - left), h: Math.max(1, bottom - top) };
    }

    function updateCropFromPointer(p) {
      const cp = cropPointer;
      if (!cp) return;
      const ow = orientedW(), oh = orientedH();
      let next;
      if (cp.mode === 'move') {
        next = {
          x: clamp(cp.base.x + p.x - cp.start.x, 0, ow - cp.base.w),
          y: clamp(cp.base.y + p.y - cp.start.y, 0, oh - cp.base.h),
          w: cp.base.w, h: cp.base.h,
        };
      } else if (cp.mode === 'resize') {
        next = resizeCropFromPointer(cp, p);
      } else {
        next = newCropFromPointer(cp, p);
      }
      state.crop = normalizeCrop(next);
      render();
    }

    function endCropPointer() {
      if (!cropPointer) return;
      const cp = cropPointer;
      const before = cp.before;
      try { if (preview.hasPointerCapture(cp.pointerId)) preview.releasePointerCapture(cp.pointerId); } catch (e) {}
      cropPointer = null;
      setHistory(before);
      render();
      syncControls();
    }

    function markSettings() {
      return {
        color: drawColorValue,
        width: Math.max(1, +drawWidth.value || 6),
        opacity: Math.max(20, +drawOpacity.value || 100),
        fill: !!drawFill.checked,
      };
    }

    function makeAnnotation(p) {
      const opts = markSettings();
      if (annotationMode === 'pen') return { type: 'pen', points: [{ x: p.x, y: p.y }], color: opts.color, width: opts.width, opacity: opts.opacity, fill: false, rotation: 0 };
      return { type: annotationMode, x: p.x, y: p.y, w: 0, h: 0, color: opts.color, width: opts.width, opacity: opts.opacity, fill: opts.fill, rotation: 0 };
    }

    function updateAnnotationFromPointer(p) {
      const ap = annotationPointer;
      if (!ap) return;
      if (ap.kind === 'select') {
        if (ap.index < 0 || !state.annotations[ap.index]) return;
        const dx = p.x - ap.start.x, dy = p.y - ap.start.y;
        if (Math.abs(dx) + Math.abs(dy) > 1) ap.moved = true;
        translateAnnotation(state.annotations[ap.index], dx, dy);
        ap.start = p;
      } else if (activeAnnotation) {
        if (activeAnnotation.type === 'pen') {
          const last = activeAnnotation.points[activeAnnotation.points.length - 1];
          if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 1) activeAnnotation.points.push({ x: p.x, y: p.y });
        } else {
          activeAnnotation.w = p.x - ap.start.x;
          activeAnnotation.h = p.y - ap.start.y;
        }
      }
      render();
    }

    preview.addEventListener('wheel', function (e) {
      if (!openState || !source || !e.deltaY) return;
      e.preventDefault();
      const factor = Math.exp(-clamp(e.deltaY, -180, 180) * 0.0022);
      const next = clamp(editorZoom * factor, 0.25, 5);
      if (Math.abs(next - editorZoom) < 0.0001) return;
      editorZoom = next;
      render();
    }, { passive: false });

    function endAnnotationPointer() {
      if (!annotationPointer) return;
      const ap = annotationPointer;
      annotationPointer = null;
      if (ap.kind === 'select') {
        if (ap.moved) setHistory(ap.before);
      } else if (activeAnnotation) {
        const a = activeAnnotation;
        activeAnnotation = null;
        const valid = a.type === 'pen' ? a.points.length > 1 : Math.hypot(a.w || 0, a.h || 0) > 4;
        if (valid) {
          state.annotations.push(a);
          selectedAnnotation = state.annotations.length - 1;
          // 新标注落笔后立即进入选择状态，用户可以直接继续改颜色、大小、
          // 不透明度或按 Delete 删除，而不必先重新点一次“选择”。
          annotationMode = 'select';
          setHistory(ap.before);
        }
      }
      render();
      syncControls();
    }

    function cancelAnnotationPointer() {
      annotationPointer = null;
      activeAnnotation = null;
      render();
      syncControls();
    }

    function startCropPointer(e) {
      const p = pointOnImage(e);
      const current = normalizeCrop(state.crop);
      const handle = cropIsFull(current) ? 'new' : cropHandleAt(p, current);
      cropPointer = {
        pointerId: e.pointerId, start: p, base: cloneCrop(current),
        handle: handle,
        mode: handle === 'move' ? 'move' : (handle === 'new' ? 'new' : 'resize'),
        before: snapshot(),
      };
      preview.style.cursor = cropCursor(handle);
      preview.setPointerCapture(e.pointerId);
      e.preventDefault();
      updateCropFromPointer(p);
    }

    function startAnnotationPointer(e) {
      const p = pointOnImage(e);
      if (annotationMode === 'text') {
        beginTextEdit(p, -1);
        e.preventDefault();
        return;
      }
      if (annotationMode === 'select') {
        let hit = -1;
        for (let i = state.annotations.length - 1; i >= 0; i--) {
          if (hitAnnotation(p, state.annotations[i])) { hit = i; break; }
        }
        selectedAnnotation = hit;
        if (hit >= 0) syncSelectedMarkControls();
        if (hit >= 0) {
          annotationPointer = { kind: 'select', pointerId: e.pointerId, start: p, index: hit, moved: false, before: snapshot() };
          preview.setPointerCapture(e.pointerId);
          e.preventDefault();
        }
        render();
        return;
      }
      activeAnnotation = makeAnnotation(p);
      annotationPointer = { kind: 'draw', pointerId: e.pointerId, start: p, before: snapshot() };
      preview.setPointerCapture(e.pointerId);
      e.preventDefault();
      render();
    }

    preview.addEventListener('pointerdown', function (e) {
      if (!openState || !source || (e.button !== 0 && e.pointerType === 'mouse')) return;
      if (e.target === inlineText) return;
      if (state.cropEnabled && annotationMode === 'select') startCropPointer(e);
      else startAnnotationPointer(e);
    });
    preview.addEventListener('pointermove', function (e) {
      if (cropPointer && cropPointer.pointerId === e.pointerId) updateCropFromPointer(pointOnImage(e));
      else if (annotationPointer && annotationPointer.pointerId === e.pointerId) updateAnnotationFromPointer(pointOnImage(e));
      else if (state.cropEnabled && annotationMode === 'select') updateCropCursor(pointOnImage(e));
      else return;
      e.preventDefault();
    });
    preview.addEventListener('pointerup', function (e) {
      if (cropPointer && cropPointer.pointerId === e.pointerId) endCropPointer();
      else if (annotationPointer && annotationPointer.pointerId === e.pointerId) endAnnotationPointer();
    });
    preview.addEventListener('pointercancel', function (e) {
      if (cropPointer && cropPointer.pointerId === e.pointerId) {
        try { if (preview.hasPointerCapture(e.pointerId)) preview.releasePointerCapture(e.pointerId); } catch (x) {}
        cropPointer = null; render(); syncControls();
      }
      else if (annotationPointer && annotationPointer.pointerId === e.pointerId) cancelAnnotationPointer();
    });
    preview.addEventListener('dblclick', function (e) {
      if (!openState || !source || state.cropEnabled || annotationMode !== 'select' || e.target === inlineText) return;
      const p = pointOnImage(e);
      for (let i = state.annotations.length - 1; i >= 0; i--) {
        const a = state.annotations[i];
        if (a.type === 'text' && hitAnnotation(p, a)) {
          beginTextEdit({ x: a.x, y: a.y }, i);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    });

    $('editorCropToggle').addEventListener('click', function () {
      commit(function () {
        state.cropEnabled = !state.cropEnabled;
        if (state.cropEnabled) state.crop = normalizeCrop(state.crop || fullCrop());
      });
    });
    document.querySelectorAll('#editorRatios button').forEach(function (b) {
      b.addEventListener('click', function () {
        commit(function () {
          const value = b.dataset.ratio;
          if (value === 'original') {
            state.ratio = 'original'; state.cropEnabled = false; state.crop = fullCrop();
          } else {
            state.ratio = value;
            state.cropEnabled = true;
            state.crop = value === 'free' ? normalizeCrop(state.crop || fullCrop()) : cropWithRatio(normalizeCrop(state.crop || fullCrop()), ratioValue(value));
          }
        });
      });
    });

    ['select', 'pen', 'line', 'rect', 'ellipse', 'arrow', 'mosaic', 'text'].forEach(function (mode) {
      $('editorTool' + mode.charAt(0).toUpperCase() + mode.slice(1)).addEventListener('click', function () {
        chooseMarkMode(mode);
      });
    });
    drawWidth.addEventListener('input', function () {
      drawWidthVal.textContent = this.value;
      const selected = annotationMode === 'select' && selectedAnnotation >= 0 && state && state.annotations[selectedAnnotation];
      if (annotationMode === 'text') lastTextSize = Math.max(8, +this.value || lastTextSize);
      else if (!selected) lastDrawWidth = Math.max(1, +this.value || lastDrawWidth);
      if (editingTextIndex >= 0 && state && state.annotations[editingTextIndex]) {
        state.annotations[editingTextIndex].size = Math.max(8, +this.value || 42);
        render();
      } else if (selected) {
        if (!markWidthBefore) markWidthBefore = snapshot();
        const annotation = state.annotations[selectedAnnotation];
        if (annotation.type === 'text') {
          annotation.size = Math.max(8, +this.value || 42);
          lastTextSize = annotation.size;
        } else {
          annotation.width = Math.max(1, +this.value || 1);
          lastDrawWidth = annotation.width;
        }
        render();
      }
      updateInlineTextStyle();
    });
    drawWidth.addEventListener('change', function () {
      if (markWidthBefore) setHistory(markWidthBefore);
      markWidthBefore = null;
      syncControls();
    });
    drawOpacity.addEventListener('pointerdown', function () {
      if (annotationMode === 'select' && selectedAnnotation >= 0 && state && state.annotations[selectedAnnotation]) {
        if (!markOpacityBefore) markOpacityBefore = snapshot();
      }
    });
    drawOpacity.addEventListener('keydown', function () {
      if (annotationMode === 'select' && selectedAnnotation >= 0 && state && state.annotations[selectedAnnotation]) {
        if (!markOpacityBefore) markOpacityBefore = snapshot();
      }
    });
    drawOpacity.addEventListener('input', function () {
      drawOpacityVal.textContent = this.value;
      const value = clamp(+this.value || 100, 20, 100);
      if (editingTextIndex >= 0 && state && state.annotations[editingTextIndex]) {
        if (!markOpacityBefore) markOpacityBefore = snapshot();
        state.annotations[editingTextIndex].opacity = value;
        render();
      } else if (annotationMode === 'select' && selectedAnnotation >= 0 && state && state.annotations[selectedAnnotation]) {
        if (!markOpacityBefore) markOpacityBefore = snapshot();
        state.annotations[selectedAnnotation].opacity = value;
        render();
      }
    });
    drawOpacity.addEventListener('change', function () {
      if (markOpacityBefore) setHistory(markOpacityBefore);
      markOpacityBefore = null;
      syncControls();
    });
    textBold.addEventListener('change', updateInlineTextStyle);
    $('editorClearMarks').addEventListener('click', function () {
      if (!state || !state.annotations.length) return;
      commit(function () { state.annotations = []; selectedAnnotation = -1; });
    });

    rotateMarkCCW.addEventListener('click', function () { rotateSelectedMark(-15); });
    rotateMarkCW.addEventListener('click', function () { rotateSelectedMark(15); });
    const rotationStart = function () {
      if (canRotateSelectedMark() && !shapeRotationBefore) shapeRotationBefore = snapshot();
    };
    shapeRotation.addEventListener('pointerdown', rotationStart);
    shapeRotation.addEventListener('keydown', rotationStart);
    shapeRotation.addEventListener('input', function () {
      if (!canRotateSelectedMark()) return;
      if (!shapeRotationBefore) shapeRotationBefore = snapshot();
      const a = state.annotations[selectedAnnotation];
      a.rotation = normalizeAngle(shapeRotation.value);
      shapeRotationVal.textContent = String(a.rotation);
      render();
    });
    shapeRotation.addEventListener('change', function () {
      if (shapeRotationBefore) setHistory(shapeRotationBefore);
      shapeRotationBefore = null;
      syncControls();
    });

    inlineText.addEventListener('input', updateInlineTextStyle);
    inlineText.addEventListener('keydown', function (e) {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        commitTextEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancelTextEdit();
      }
    });
    inlineText.addEventListener('blur', function () {
      if (editingTextIndex !== -1) window.setTimeout(function () {
        if (editingTextIndex !== -1) commitTextEdit();
      }, 0);
    });

    $('editorRotateCCW').addEventListener('click', function () {
      commit(function () {
        const oldW = orientedW();
        state.rotation = (state.rotation + 270) % 360;
        state.annotations = remapAnnotations(state.annotations, function (p) { return { x: p.y, y: oldW - p.x }; }, -90);
        state.crop = fullCrop();
        selectedAnnotation = -1;
      });
    });
    $('editorRotateCW').addEventListener('click', function () {
      commit(function () {
        const oldH = orientedH();
        state.rotation = (state.rotation + 90) % 360;
        state.annotations = remapAnnotations(state.annotations, function (p) { return { x: oldH - p.y, y: p.x }; }, 90);
        state.crop = fullCrop();
        selectedAnnotation = -1;
      });
    });
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    $('editorReset').addEventListener('click', function () {
      commit(function () {
        const f = state.format, q = state.quality;
        state = freshState(item); state.format = f; state.quality = q; state.crop = fullCrop();
        selectedAnnotation = -1;
      });
      outputSizeDirty = false;
      dimensionRatioLocked = true;
      syncDimensionControls(true);
      render();
    });

    sliderDefs.forEach(function (def) {
      const el = $(def[1]);
      const start = function () { if (!sliderStarts.has(def[0])) sliderStarts.set(def[0], snapshot()); };
      el.addEventListener('pointerdown', start);
      el.addEventListener('keydown', start);
      el.addEventListener('input', function () {
        if (!sliderStarts.has(def[0])) sliderStarts.set(def[0], snapshot());
        state[def[0]] = parseFloat(el.value) || 0;
        $(def[2]).textContent = state[def[0]];
        render();
      });
      el.addEventListener('change', function () {
        const before = sliderStarts.get(def[0]);
        sliderStarts.delete(def[0]);
        if (before) setHistory(before);
        syncControls();
      });
    });
    format.addEventListener('change', function () {
      state.format = format.value;
      syncControls();
    });
    quality.addEventListener('input', function () {
      state.quality = +quality.value;
      qualityVal.textContent = state.quality;
    });
    outputWidth.addEventListener('input', function () { updateOutputDimension('width'); });
    outputHeight.addEventListener('input', function () { updateOutputDimension('height'); });
    dimensionLock.addEventListener('click', function () {
      dimensionRatioLocked = !dimensionRatioLocked;
      syncDimensionControls(false);
    });
    dimensionReset.addEventListener('click', function () {
      outputSizeDirty = false;
      syncDimensionControls(true);
      render();
    });

    async function buildOutput() {
      const w = Math.max(1, Math.round(orientedW()));
      const h = Math.max(1, Math.round(orientedH()));
      const full = document.createElement('canvas');
      full.width = w; full.height = h;
      const fullCtx = full.getContext('2d');
      const mime = state.format === 'jpeg' ? 'image/jpeg' : (state.format === 'webp' ? 'image/webp' : 'image/png');
      if (mime === 'image/jpeg') { fullCtx.fillStyle = '#fff'; fullCtx.fillRect(0, 0, w, h); }
      drawTransformed(fullCtx);
      drawAnnotations(fullCtx);
      const c = normalizeCrop(state.crop);
      const exportCrop = state.cropEnabled ? c : { x: 0, y: 0, w: w, h: h };
      const target = outputPixelSize(exportCrop);
      let output = full;
      const cropChanged = exportCrop.x > 0.01 || exportCrop.y > 0.01 || exportCrop.w < w - 0.01 || exportCrop.h < h - 0.01;
      const sizeChanged = target.w !== Math.round(exportCrop.w) || target.h !== Math.round(exportCrop.h);
      if ((state.cropEnabled && cropChanged) || sizeChanged) {
        output = document.createElement('canvas');
        output.width = target.w;
        output.height = target.h;
        const outCtx = output.getContext('2d');
        if (mime === 'image/jpeg') { outCtx.fillStyle = '#fff'; outCtx.fillRect(0, 0, output.width, output.height); }
        outCtx.drawImage(full, exportCrop.x, exportCrop.y, exportCrop.w, exportCrop.h, 0, 0, output.width, output.height);
      }
      const blob = await new Promise(function (resolve, reject) {
        output.toBlob(function (value) { value ? resolve(value) : reject(new Error('图片编码失败')); }, mime, state.quality / 100);
      });
      const ext = state.format === 'jpeg' ? 'jpg' : state.format;
      const stem = (item.name || 'pico-image').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_');
      const name = stem + '-edited.' + ext;
      return { blob: blob, file: new File([blob], name, { type: mime, lastModified: Date.now() }), name: name, mime: mime };
    }

    async function saveCopy() {
      if (!openState || !source || busy) return;
      if (editingTextIndex !== -1) commitTextEdit();
      busy = true; syncControls();
      try {
        const result = await buildOutput();
        const ok = hooks.onSave ? await hooks.onSave(result) : await Pico.saveBlob(result.blob, result.name, result.mime);
        if (ok !== false) Pico.toast('已保存编辑副本：' + result.name, { type: 'ok' });
      } catch (e) {
        Pico.toast('导出失败：' + (e && e.message ? e.message : '无法编码图片'), { type: 'warn' });
      } finally { busy = false; syncControls(); }
    }

    async function addCopy() {
      if (!openState || !source || busy) return;
      if (editingTextIndex !== -1) commitTextEdit();
      busy = true; syncControls();
      try {
        const result = await buildOutput();
        const ok = hooks.onAdd ? await hooks.onAdd({ item: item, file: result.file, name: result.name, mime: result.mime }) : false;
        if (ok !== false) {
          Pico.toast('编辑副本已加入图库', { type: 'ok' });
          close();
        }
      } catch (e) {
        Pico.toast('加入图库失败：' + (e && e.message ? e.message : '无法编码图片'), { type: 'warn' });
      } finally { busy = false; syncControls(); }
    }

    $('editorSave').addEventListener('click', saveCopy);
    $('editorAdd').addEventListener('click', addCopy);
    $('editorClose').addEventListener('click', close);
    $('editorCancel').addEventListener('click', close);
    window.addEventListener('resize', function () { if (openState) render(); });
    window.addEventListener('keydown', function (e) {
      if (!openState) return;
      const tag = (e.target && e.target.tagName) || '';
      if (e.key === 'Escape') {
        e.preventDefault();
        if (editingTextIndex !== -1) cancelTextEdit();
        else if (annotationPointer) cancelAnnotationPointer();
        else if (annotationMode !== 'select') chooseMarkMode('select');
        else close();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && tag !== 'INPUT' && tag !== 'TEXTAREA' && annotationMode === 'select' && selectedAnnotation >= 0) {
        e.preventDefault();
        removeSelectedAnnotation();
        return;
      }
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveCopy(); }
    });

    async function open(it) {
      if (!it) return;
      const tick = ++openTick;
      openState = true;
      item = it;
      source = null;
      sourceW = sourceH = 0;
      editorZoom = 1;
      state = freshState(it);
      state.crop = null;
      outputSizeDirty = false;
      dimensionRatioLocked = true;
      history = []; future = []; sliderStarts.clear();
      annotationPointer = null;
      activeAnnotation = null;
      selectedAnnotation = -1;
      annotationMode = 'select';
      shapeRotationBefore = null;
      markWidthBefore = null;
      markOpacityBefore = null;
      hideInlineText();
      nameEl.textContent = it.name;
      nameEl.title = it.name;
      editor.hidden = false;
      hint.hidden = false;
      hint.textContent = '正在读取图片…';
      cropBox.hidden = true;
      status.textContent = '—';
      syncControls();
      try {
        const im = await loadImage(it);
        if (!openState || tick !== openTick) return;
        source = im;
        sourceW = im.naturalWidth || im.width;
        sourceH = im.naturalHeight || im.height;
        state.crop = fullCrop();
        hint.hidden = true;
        render();
        syncControls();
      } catch (e) {
        if (tick !== openTick) return;
        hint.hidden = false;
        hint.textContent = '无法读取这张图片';
        Pico.toast('无法读取这张图片：' + it.name, { type: 'warn' });
      }
    }

    function close() {
      if (!openState) return;
      if (editingTextIndex !== -1) commitTextEdit();
      ++openTick;
      openState = false;
      source = null;
      item = null;
      cropPointer = null;
      annotationPointer = null;
      activeAnnotation = null;
      selectedAnnotation = -1;
      shapeRotationBefore = null;
      markWidthBefore = null;
      markOpacityBefore = null;
      hideInlineText();
      editor.hidden = true;
      if (hooks.onClose) hooks.onClose();
    }

    return { open: open, close: close, isOpen: function () { return openState; } };
  };
})();
