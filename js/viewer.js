/* ============================================================
 * Pico 图片查看器 · viewer.js
 * 全屏查看器：滚轮光标缩放 / 拖拽平移 / 双击缩放 / 旋转
 * 幻灯片 / 胶片栏 / EXIF 信息面板 / 自动隐藏 UI
 * 手感参照 PhotoSwipe 5，工具集参照 Viewer.js / ImageGlass
 * ============================================================ */
(function () {
  'use strict';
  const Pico = window.Pico;
  const clamp = Pico.clamp;

  Pico.initViewer = function (hooks) {
    const $ = function (id) { return document.getElementById(id); };
    const viewer = $('viewer'), stage = $('vStage'), wrap = $('vZoomWrap'), img = $('vImg');
    const elName = $('vName'), elCount = $('vCount'), elBadge = $('vZoomBadge');
    const elLoad = $('vLoading'), elStrip = $('vStrip'), elInfo = $('vInfo'), elInfoBody = $('vInfoBody');
    const elProgress = $('vProgress');
    const btnPlay = $('vBtnPlay'), btnFull = $('vBtnFull'), btnInfo = $('vBtnInfo'), btnStrip = $('vBtnStrip');
    const btnEdit = $('vBtnEdit'), btnSaveAs = $('vBtnSaveAs');

    /* ---------- 内部状态 ---------- */
    let openState = false;
    let cur = -1;                 // 当前索引（位于 hooks.getList() 中）
    let W = 0, H = 0;             // 舞台尺寸
    let natW = 0, natH = 0;       // 图片自然尺寸
    let s = 1, tx = 0, ty = 0;    // 缩放与平移（相对舞台中心）
    let rot = 0;
    let fitMode = true;
    let playing = false, playTimer = 0;
    let chromeTimer = 0;
    let stripTimer = 0;
    let infoOpen = false;
    let stripDirty = true;
    let loadTick = 0;

    const pointers = new Map();
    let drag = null, pinch = null;

    const list = function () { return hooks.getList(); };
    const settings = function () { return hooks.getSettings(); };

    /* ---------- 几何 ---------- */
    function dispW() { return rot % 180 ? natH : natW; }
    function dispH() { return rot % 180 ? natW : natH; }
    function fitScale() {
      const stageW = Math.max(1, Number(W) || stage.clientWidth || window.innerWidth || 1);
      const stageH = Math.max(1, Number(H) || stage.clientHeight || window.innerHeight || 1);
      const imageW = Math.max(1, Number(dispW()) || 1);
      const imageH = Math.max(1, Number(dispH()) || 1);
      const pad = 36;
      const scale = Math.min(Math.max(1, stageW - pad) / imageW, Math.max(1, stageH - pad) / imageH, 1);
      return isFinite(scale) && scale > 0 ? scale : 1;
    }
    function minScale() { return Math.max(0.02, Math.min(0.05, fitScale() / 5)); }
    function maxScale() { return Math.max(8, fitScale() * 4); }

    function clampPan() {
      const hw = dispW() * s / 2, hh = dispH() * s / 2;
      const mx = Math.max(0, hw - W / 2), my = Math.max(0, hh - H / 2);
      tx = clamp(tx, -mx, mx); ty = clamp(ty, -my, my);
    }

    function apply(anim) {
      if (anim) { wrap.classList.add('anim'); } else { wrap.classList.remove('anim'); }
      clampPan();
      wrap.style.transform =
        'translate(' + tx + 'px,' + ty + 'px)' +
        ' rotate(' + rot + 'deg) scale(' + s + ')';
      elBadge.textContent = Math.round(s * 100) + '%';
    }
    wrap.addEventListener('transitionend', function () { wrap.classList.remove('anim'); });

    function fit(anim) {
      // 适应按钮可能在窗口、原生全屏或工具栏状态刚变化后触发，点击时必须重新读取舞台尺寸。
      measure();
      fitMode = true;
      s = fitScale();
      tx = 0; ty = 0;
      apply(anim);
      wake();
    }
    function actual(anim) { fitMode = false; s = 1; tx = 0; ty = 0; apply(anim); }
    function zoomAt(cx, cy, k, anim) {
      const ns = clamp(s * k, minScale(), maxScale());
      k = ns / s;
      if (k === 1) return;
      fitMode = false;
      tx = cx - k * (cx - tx);
      ty = cy - k * (cy - ty);
      s = ns;
      apply(anim);
    }
    function measure() {
      const r = stage.getBoundingClientRect();
      W = r.width; H = r.height;
    }

    /* ---------- 加载与导航 ---------- */
    function show(i, opts) {
      opts = opts || {};
      const items = list();
      if (!items.length) { close(); return; }
      cur = clamp(i, 0, items.length - 1);
      const item = items[cur];

      elName.textContent = item.name;
      elName.title = item.dir ? (item.dir + '/' + item.name) : item.name;
      elCount.textContent = (cur + 1) + ' / ' + items.length;
      $('vPrev').style.visibility = cur > 0 ? 'visible' : 'hidden';
      $('vNext').style.visibility = cur < items.length - 1 ? 'visible' : 'hidden';

      rot = item.rot || 0;
      natW = item.w || 0; natH = item.h || 0;

      const tick = ++loadTick;
      elLoad.classList.remove('on');
      img.classList.add('loading');
      img.onload = function () {
        if (tick !== loadTick) return;
        natW = img.naturalWidth || 1; natH = img.naturalHeight || 1;
        item.w = natW; item.h = natH;
        // 将图片中心对齐到 wrap 原点（舞台中心），缩放/旋转围绕图片中心进行
        img.style.width = natW + 'px';
        img.style.height = natH + 'px';
        img.style.marginLeft = (-natW / 2) + 'px';
        img.style.marginTop = (-natH / 2) + 'px';
        img.classList.remove('loading');
        img.classList.remove('show-in'); void img.offsetWidth; img.classList.add('show-in');
        elLoad.classList.remove('on');
        if (fitMode || opts.resetView !== false) fit(false); else apply(false);
        if (infoOpen) renderInfo(item);
      };
      img.onerror = function () {
        if (tick !== loadTick) return;
        img.classList.remove('loading');
        elLoad.classList.remove('on');
        Pico.toast('无法解码这张图片：' + item.name, { type: 'warn' });
      };
      const usePreview = typeof Pico.ensurePreview === 'function'
        ? Pico.ensurePreview(item)
        : Promise.resolve(item.url);
      usePreview.then(function (url) {
        if (tick !== loadTick) return;
        img.src = url;
        if (img.complete && img.naturalWidth) img.onload();
      }).catch(function (error) {
        if (tick !== loadTick) return;
        img.classList.remove('loading');
        elLoad.classList.remove('on');
        const message = Pico.previewErrorMessage ? Pico.previewErrorMessage(item, error) : ('无法解码这张图片：' + item.name);
        Pico.toast(message, { type: 'warn', duration: 4200 });
      });

      // 大图解码延迟提示
      setTimeout(function () {
        if (tick === loadTick && !img.complete) elLoad.classList.add('on');
      }, 180);

      if (opts.restartSlide !== false) restartTimer();
      syncStrip();
      preloadNeighbors();
      wake();
    }

    function preloadNeighbors() {
      const items = list();
      [cur - 1, cur + 1].forEach(function (j) {
        const it = items[j];
        if (it) {
          const p = new Image();
          const ready = typeof Pico.ensurePreview === 'function' ? Pico.ensurePreview(it) : Promise.resolve(it.url);
          ready.then(function (url) { p.src = url; }).catch(function () {});
        }
      });
    }

    function next(wrapOk) {
      const n = list().length;
      if (cur < n - 1) show(cur + 1);
      else if (wrapOk && settings().loop) show(0);
      else if (wrapOk) pause();
    }
    function prev(wrapOk) {
      if (cur > 0) show(cur - 1);
      else if (wrapOk && settings().loop) show(list().length - 1);
      else if (wrapOk) pause();
    }

    /* ---------- 变换操作 ---------- */
    function doRotate(dir) {
      const item = list()[cur]; if (!item) return;
      rot = (rot + (dir > 0 ? 90 : 270)) % 360;
      item.rot = rot;
      if (hooks.onChange) hooks.onChange(item);
      if (fitMode) fit(true); else apply(true);
    }
    /* ---------- 幻灯片 ---------- */
    function setPlayBtn() {
      btnPlay.innerHTML = Pico.icon(playing ? 'pause' : 'play');
      btnPlay.classList.toggle('on', playing);
    }
    function startProgress(sec) {
      elProgress.hidden = false;
      elProgress.classList.remove('run');
      void elProgress.offsetWidth;
      elProgress.style.animationDuration = sec + 's';
      elProgress.classList.add('run');
    }
    function stopProgress() {
      elProgress.classList.remove('run');
      elProgress.hidden = true;
    }
    function restartTimer() {
      clearTimeout(playTimer);
      stopProgress();
      if (!playing) return;
      const sec = clamp(settings().interval || 3, 1, 60);
      startProgress(sec);
      playTimer = setTimeout(function () { next(true); }, sec * 1000);
    }
    function play() {
      if (list().length < 1) return;
      playing = true; setPlayBtn(); restartTimer();
    }
    function pause() {
      playing = false; clearTimeout(playTimer); stopProgress(); setPlayBtn();
    }

    /* ---------- 胶片栏 ---------- */
    function buildStrip() {
      const items = list();
      const frag = document.createDocumentFragment();
      items.forEach(function (it, i) {
        const b = document.createElement('button');
        b.className = 'v-fstrip-item' + (i === cur ? ' cur' : '');
        b.type = 'button';
        b.setAttribute('data-i', i);
        b.setAttribute('data-id', String(it.id));
        if (it.thumbURL) {
          const im = document.createElement('img');
          im.src = it.thumbURL; im.alt = ''; im.loading = 'lazy'; im.draggable = false;
          b.appendChild(im);
        } else {
          b.style.background = 'linear-gradient(135deg,#1c2230,#141824)';
        }
        const idx = document.createElement('span');
        idx.className = 'idx'; idx.textContent = i + 1;
        b.appendChild(idx);
        frag.appendChild(b);
      });
      elStrip.replaceChildren(frag);
      stripDirty = false;
    }
    function syncStrip() {
      if (elStrip.hidden) return;
      const items = list();
      let nodes = elStrip.children;
      let stale = nodes.length !== items.length;
      if (!stale) {
        for (let i = 0; i < items.length; i++) {
          if (nodes[i].getAttribute('data-id') !== String(items[i].id)) { stale = true; break; }
        }
      }
      if (stale) {
        buildStrip();
        nodes = elStrip.children;
      }
      const current = items[cur];
      let curEl = null;
      for (let i = 0; i < nodes.length; i++) {
        const selected = !!current && nodes[i].getAttribute('data-id') === String(current.id);
        nodes[i].classList.toggle('cur', selected);
        if (selected) curEl = nodes[i];
      }
      if (curEl && curEl.scrollIntoView) {
        try { curEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); }
        catch (e) { curEl.scrollIntoView(); }
      }
    }
    elStrip.addEventListener('click', function (e) {
      const b = e.target.closest('.v-fstrip-item');
      if (b) show(+b.getAttribute('data-i'));
    });

    /* ---------- 信息面板 ---------- */
    function renderInfo(item) {
      const esc = Pico.escapeHTML;
      const rows = [];
      const row = function (k, v) { rows.push('<div class="info-row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'); };

      let html = '<div class="info-sec">预览</div>';
      html += '<img class="v-info-thumb" alt="" src="' + (item.thumbURL || item.previewURL || item.url) + '">';
      html += '<div class="info-sec">基本信息</div>';
      row('文件名', esc(item.name));
      row('类型', (Pico.extOf(item.name) || '?').toUpperCase());
      row('尺寸', (natW ? natW + ' × ' + natH + ' px' : '解码中…'));
      if (item.previewDescription) row('预览方式', esc(item.previewDescription));
      if (item.previewError) row('预览状态', esc(Pico.previewErrorMessage(item, item.previewError)));
      row('文件大小', Pico.formatBytes(item.size));
      row('修改时间', Pico.formatDate(item.mtime));
      const storagePath = item.path || (item.file && (item.file.path || item.file.webkitPath)) || '';
      row('存储位置', storagePath ? esc(storagePath) : 'Pico 本地图库（未关联本机文件）');
      row('导入分类', item.dir ? esc(item.dir) : '（顶层）');
      html += rows.join('');

      html += '<div class="info-sec">拍摄信息（EXIF）</div>';
      if (item.exif === undefined) {
        html += '<div class="info-row"><span class="v" style="text-align:left;color:#8b94a7">读取中…</span></div>';
        item.exif = null;
        Pico.readExif(item.file).then(function (ex) {
          item.exif = ex || null;
          if (infoOpen && list()[cur] === item) renderInfo(item);
        });
      } else if (item.exif) {
        const ex = Pico.exifRows(item.exif);
        html += ex.length
          ? ex.map(function (r) {
              return '<div class="info-row"><span class="k">' + r[0] + '</span><span class="v">' + esc(r[1]) + '</span></div>';
            }).join('')
          : '<div class="info-row"><span class="v" style="text-align:left;color:#8b94a7">未找到 EXIF 数据</span></div>';
      } else {
        html += '<div class="info-row"><span class="v" style="text-align:left;color:#8b94a7">无 EXIF 信息</span></div>';
      }
      elInfoBody.innerHTML = html;
    }
    function toggleInfo(force) {
      infoOpen = force != null ? force : !infoOpen;
      elInfo.hidden = !infoOpen;
      btnInfo.classList.toggle('on', infoOpen);
      if (infoOpen && list()[cur]) renderInfo(list()[cur]);
      wake();
    }

    /* ---------- 全屏 ---------- */
    let cssFullscreen = false;
    function requestNativeFullscreen(on) {
      if (typeof window.picoSetFullscreen !== 'function') return false;
      try {
        const result = window.picoSetFullscreen(!!on);
        if (result && result.catch) result.catch(function () {});
        return true;
      } catch (e) { return false; }
    }
    function setFullscreenState(on) {
      cssFullscreen = !!on;
      viewer.classList.toggle('pseudo-fullscreen', cssFullscreen);
      document.body.classList.toggle('pico-fullscreen', cssFullscreen);
      btnFull.innerHTML = Pico.icon((document.fullscreenElement || cssFullscreen) ? 'minimize' : 'maximize');
      btnFull.classList.toggle('on', !!(document.fullscreenElement || cssFullscreen));
    }
    function toggleFull() {
      if (document.fullscreenElement) {
        const result = document.exitFullscreen();
        if (result && result.catch) result.catch(function () { setFullscreenState(false); });
        else setFullscreenState(false);
        return;
      }
      if (cssFullscreen) {
        requestNativeFullscreen(false);
        setFullscreenState(false);
        return;
      }
      if (requestNativeFullscreen(true)) {
        setFullscreenState(true);
        wake();
        return;
      }
      if (!viewer.requestFullscreen) { setFullscreenState(true); return; }
      let result;
      try { result = viewer.requestFullscreen({ navigationUI: 'hide' }); }
      catch (e) { setFullscreenState(true); return; }
      if (result && result.catch) {
        result.catch(function () { setFullscreenState(true); });
        result.then(function () {
          setTimeout(function () {
            if (openState && !document.fullscreenElement && !cssFullscreen) setFullscreenState(true);
          }, 260);
        });
      } else {
        setTimeout(function () {
          if (openState && !document.fullscreenElement && !cssFullscreen) setFullscreenState(true);
        }, 260);
      }
    }
    document.addEventListener('fullscreenchange', function () {
      setFullscreenState(!!document.fullscreenElement);
    });

    /* ---------- 自动隐藏 UI ---------- */
    function wake() {
      viewer.classList.remove('chrome-hidden');
      revealStrip();
      clearTimeout(chromeTimer);
      chromeTimer = setTimeout(function () {
        if (openState && !infoOpen && !playing) viewer.classList.add('chrome-hidden');
      }, 2800);
    }
    viewer.addEventListener('mousemove', wake);
    viewer.addEventListener('pointerdown', wake);

    /* ---------- 指针交互：平移 / 双指缩放 / 点击图片外退出 ---------- */
    let stageGesture = null;
    function pointInImage(e) {
      const r = img.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    }
    function revealStrip() {
      clearTimeout(stripTimer);
      if (elStrip.hidden) return;
      elStrip.classList.remove('auto-hidden');
      stripTimer = setTimeout(function () {
        if (openState && !elStrip.hidden) elStrip.classList.add('auto-hidden');
      }, 2800);
    }
    stage.addEventListener('pointerdown', function (e) {
      if (!openState) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      stageGesture = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, outside: !pointInImage(e), moved: false };
      stage.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        drag = { tx: tx, ty: ty, x: e.clientX, y: e.clientY };
        stage.classList.add('dragging');
      } else if (pointers.size === 2) {
        drag = null;
        const pts = Array.from(pointers.values());
        pinch = {
          d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
          mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2,
        };
      }
    });
    stage.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      if (stageGesture && stageGesture.pointerId === e.pointerId && Math.hypot(e.clientX - stageGesture.x, e.clientY - stageGesture.y) > 6) stageGesture.moved = true;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = stage.getBoundingClientRect();
      if (pinch && pointers.size >= 2) {
        const pts = Array.from(pointers.values());
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const mx = (pts[0].x + pts[1].x) / 2 - r.left - r.width / 2;
        const my = (pts[0].y + pts[1].y) / 2 - r.top - r.height / 2;
        if (pinch.d > 0 && d > 0) zoomAt(mx, my, d / pinch.d, false);
        tx += mx - (pinch.mx - r.left - r.width / 2);
        ty += my - (pinch.my - r.top - r.height / 2);
        pinch.d = d; pinch.mx = (pts[0].x + pts[1].x) / 2; pinch.my = (pts[0].y + pts[1].y) / 2;
        fitMode = false;
        apply(false);
      } else if (drag) {
        tx = drag.tx + (e.clientX - drag.x);
        ty = drag.ty + (e.clientY - drag.y);
        fitMode = false;
        apply(false);
      }
    });
    function endPointer(e) {
      const gesture = stageGesture && stageGesture.pointerId === e.pointerId ? stageGesture : null;
      pointers.delete(e.pointerId);
      if (stage.hasPointerCapture && stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) {
        drag = null; stage.classList.remove('dragging'); stageGesture = null;
        if (gesture && gesture.outside && !gesture.moved && e.button === 0) { close(); return; }
      }
      if (pointers.size === 1) {
        const p = Array.from(pointers.values())[0];
        drag = { tx: tx, ty: ty, x: p.x, y: p.y };
      }
    }
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    stage.addEventListener('dblclick', function (e) {
      e.preventDefault();
      if (!pointInImage(e)) { close(); return; }
      const r = stage.getBoundingClientRect();
      const cx = e.clientX - r.left - r.width / 2, cy = e.clientY - r.top - r.height / 2;
      if (s < fitScale() * 1.4) {
        const target = clamp(fitScale() * 2.5, minScale(), maxScale());
        zoomAt(cx, cy, target / s, true);
      } else {
        fit(true);
      }
    });

    stage.addEventListener('wheel', function (e) {
      if (!openState) return;
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      if (e.ctrlKey || settings().wheel === 'zoom') {
        if (!e.deltaY) return;
        const k = Math.exp(-clamp(e.deltaY, -180, 180) * 0.0022);
        zoomAt(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2, k, false);
      } else {
        if (e.deltaY > 4) next(false); else if (e.deltaY < -4) prev(false);
      }
    }, { passive: false });

    /* ---------- 键盘 ---------- */
    document.addEventListener('keydown', function (e) {
      if (!openState) return;
      if (document.getElementById('editor') && !document.getElementById('editor').hidden) return;
      if (document.querySelector('dialog[open]')) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.ctrlKey && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        if (hooks.onCapture) hooks.onCapture();
        return;
      }
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        const saveItem = list()[cur];
        if (saveItem && hooks.onSaveAs) hooks.onSaveAs(saveItem);
        return;
      }
      const k = e.key;
      switch (k) {
        case 'ArrowLeft': case 'PageUp': e.preventDefault(); prev(false); break;
        case 'ArrowRight': case 'PageDown': e.preventDefault(); next(false); break;
        case 'Home': e.preventDefault(); show(0); break;
        case 'End': e.preventDefault(); show(list().length - 1); break;
        case '+': case '=': zoomAt(0, 0, 1.25, true); break;
        case '-': case '_': zoomAt(0, 0, 0.8, true); break;
        case '0': fit(true); break;
        case '1': actual(true); break;
        case 'r': case 'R': doRotate(1); break;
        case 'l': case 'L': doRotate(-1); break;
        case 'i': case 'I': toggleInfo(); break;
        case 't': case 'T': setStrip(!elStrip.hidden ? false : true); break;
        case 'e': case 'E': {
          const item = list()[cur];
          if (item && hooks.onEdit) hooks.onEdit(item);
          break;
        }
        case 'o': case 'O': {
          const item = list()[cur];
          if (item && hooks.onSaveAs) hooks.onSaveAs(item);
          break;
        }
        case 'f': case 'F': toggleFull(); break;
        case ' ': e.preventDefault(); playing ? pause() : play(); break;
        case 'Delete': case 'Backspace': e.preventDefault(); if (hooks.onDelete) hooks.onDelete(cur); break;
        case 'Escape': close(); break;
      }
    });

    /* ---------- 工具栏按钮 ---------- */
    $('vBtnClose').addEventListener('click', close);
    $('vPrev').addEventListener('click', function () { prev(false); });
    $('vNext').addEventListener('click', function () { next(false); });
    $('vBtnZoomIn').addEventListener('click', function () { zoomAt(0, 0, 1.25, true); });
    $('vBtnZoomOut').addEventListener('click', function () { zoomAt(0, 0, 0.8, true); });
    $('vBtnFit').addEventListener('click', function () { fit(true); });
    $('vBtnActual').addEventListener('click', function () { actual(true); });
    $('vZoomBadge').addEventListener('click', function () { actual(true); });
    $('vBtnRotCW').addEventListener('click', function () { doRotate(1); });
    $('vBtnRotCCW').addEventListener('click', function () { doRotate(-1); });
    btnPlay.addEventListener('click', function () { playing ? pause() : play(); });
    btnInfo.addEventListener('click', function () { toggleInfo(); });
    $('vInfoClose').addEventListener('click', function () { toggleInfo(false); });
    btnFull.addEventListener('click', toggleFull);
    btnStrip.addEventListener('click', function () { setStrip(!elStrip.hidden ? false : true); });
    btnEdit.addEventListener('click', function () {
      const item = list()[cur];
      if (item && hooks.onEdit) hooks.onEdit(item);
      wake();
    });
    btnSaveAs.addEventListener('click', function () {
      const item = list()[cur]; if (!item) return;
      if (hooks.onSaveAs) hooks.onSaveAs(item);
    });
    $('vBtnDelete').addEventListener('click', function () {
      if (hooks.onDelete) hooks.onDelete(cur);
    });

    function setStrip(on) {
      elStrip.hidden = !on;
      elStrip.classList.toggle('auto-hidden', false);
      btnStrip.classList.toggle('on', on);
      clearTimeout(stripTimer);
      if (on && stripDirty) buildStrip();
      if (on) { syncStrip(); revealStrip(); }
      wake();
    }

    window.addEventListener('resize', function () {
      if (!openState) return;
      measure();
      if (fitMode) fit(false); else apply(false);
    });

    /* ---------- 开关 ---------- */
    function open(i) {
      if (!list().length) return;
      openState = true;
      viewer.hidden = false;
      viewer.classList.remove('closing');
      measure();
      natW = natH = 0; fitMode = true;
      setStrip(settings().strip);
      toggleInfo(false);
      setPlayBtn();
      show(i);
      wake();
    }
    function close() {
      if (!openState) return;
      pause();
      clearTimeout(stripTimer);
      openState = false;
      infoOpen = false; elInfo.hidden = true; btnInfo.classList.remove('on');
      viewer.classList.add('closing');
      setTimeout(function () {
        viewer.hidden = true;
        viewer.classList.remove('closing', 'chrome-hidden');
      }, 170);
      if (document.fullscreenElement && document.exitFullscreen) {
        const result = document.exitFullscreen();
        if (result && result.catch) result.catch(function () {});
      }
      if (cssFullscreen) {
        requestNativeFullscreen(false);
        setFullscreenState(false);
      }
      if (hooks.onClose) hooks.onClose();
    }

    /* ---------- 控制器 ---------- */
    return {
      open: open,
      close: close,
      isOpen: function () { return openState; },
      index: function () { return cur; },
      current: function () { return openState && list()[cur] ? list()[cur] : null; },
      showInfo: function () { if (openState) toggleInfo(true); },
      showAt: function (i) { if (openState) show(i); },
      /** 列表变化后同步（导入/删除） */
      refresh: function () {
        const previous = openState ? list()[cur] : null;
        stripDirty = true;
        if (!openState) return;
        const items = list();
        const n = items.length;
        if (!n) { close(); return; }
        // 排序或导入新图片后，索引可能变化；优先按对象身份保留当前图片。
        const preserved = previous ? items.indexOf(previous) : -1;
        const nextIndex = preserved >= 0 ? preserved : clamp(cur, 0, n - 1);
        if (elStrip && !elStrip.hidden) buildStrip();
        show(nextIndex, { resetView: false });
      },
      /** 单张缩略图就绪后实时更新胶片栏 */
      notifyThumb: function (it) {
        if (!openState || elStrip.hidden || !it.thumbURL) return;
        const items = list();
        const i = items.indexOf(it);
        if (i < 0) return;
        let b = null;
        for (let j = 0; j < elStrip.children.length; j++) {
          if (elStrip.children[j].getAttribute('data-id') === String(it.id)) { b = elStrip.children[j]; break; }
        }
        if (!b || b.querySelector('img')) return;
        const im = document.createElement('img');
        im.src = it.thumbURL; im.alt = ''; im.draggable = false;
        b.insertBefore(im, b.firstChild);
      },
    };
  };
})();
