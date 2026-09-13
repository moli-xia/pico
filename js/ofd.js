/* ============================================================
 * Pico 图片查看器 · ofd.js
 * OFD（GB/T 33190 版式文件）的最小本地渲染器。
 *
 * OFD 文件本质是 zip 包：OFD.xml 描述文档、Document.xml 描述页面、
 * Pages 下的 Content.xml 是每页图元。这里解包后按 文字/图片/路径 三类
 * 图元把页面绘制到 canvas，供 formats.js 生成预览图。
 * 属于尽力而为的阅读级渲染：不处理印章验证、注释与嵌入字体。
 * ============================================================ */
(function () {
  'use strict';
  const Pico = (window.Pico = window.Pico || {});

  /* ---------- zip 解包 ---------- */

  async function inflateRaw(data) {
    if (typeof DecompressionStream !== 'function') throw new Error('当前环境不支持 zip 解压');
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const buffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
  }

  function decodeName(raw, flagged) {
    // zip 规范：未置语言标志时文件名编码由实现自定，中文压缩包常见 GBK。
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(raw);
    if (flagged || !/[ÃÂÏÐÑ]/.test(utf8)) return utf8;
    try { return new TextDecoder('gbk').decode(raw); } catch (e) { return utf8; }
  }

  async function readZip(bytes) {
    let eocd = -1;
    const limit = Math.max(0, bytes.length - 66000);
    for (let i = bytes.length - 22; i >= limit; i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('不是有效的 zip/OFD 文件');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let count = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const entries = new Map();
    for (let n = 0; n < count; n++) {
      if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) break;
      const method = view.getUint16(offset + 10, true);
      const compSize = view.getUint32(offset + 20, true);
      const nameLen = view.getUint16(offset + 28, true);
      const extraLen = view.getUint16(offset + 30, true);
      const commentLen = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const flags = view.getUint16(offset + 8, true);
      const name = decodeName(bytes.subarray(offset + 46, offset + 46 + nameLen), (flags & 0x800) !== 0);
      entries.set(name.replace(/\\/g, '/'), { method: method, compSize: compSize, localOffset: localOffset });
      offset += 46 + nameLen + extraLen + commentLen;
    }
    return {
      names: function () { return Array.from(entries.keys()); },
      has: function (name) { return entries.has(name); },
      read: async function (name) {
        const entry = entries.get(name);
        if (!entry) return null;
        const base = entry.localOffset;
        if (base + 30 > bytes.length || view.getUint32(base, true) !== 0x04034b50) return null;
        const nameLen = view.getUint16(base + 26, true);
        const extraLen = view.getUint16(base + 28, true);
        const start = base + 30 + nameLen + extraLen;
        const raw = bytes.subarray(start, start + entry.compSize);
        return entry.method === 0 ? raw.slice() : await inflateRaw(raw);
      },
      readText: async function (name) {
        const data = await this.read(name);
        return data ? new TextDecoder('utf-8').decode(data) : null;
      },
    };
  }

  /* ---------- XML 工具 ---------- */

  function parseXML(text) {
    return new DOMParser().parseFromString(text, 'text/xml').documentElement;
  }
  // 与命名空间前缀无关，只按 localName 取子元素。
  function children(el, name) {
    if (!el) return [];
    const out = [];
    for (let n = el.firstElementChild; n; n = n.nextElementSibling) {
      if (n.localName === name) out.push(n);
    }
    return out;
  }
  function child(el, name) { return children(el, name)[0] || null; }
  function descendants(el, name) {
    return el ? Array.from(el.getElementsByTagName('*')).filter(function (n) { return n.localName === name; }) : [];
  }
  function floatList(value) {
    return String(value || '').trim().split(/[\s,]+/).map(Number).filter(isFinite);
  }

  function parseColor(value) {
    const v = String(value || '').trim();
    if (!v) return null;
    if (v.charAt(0) === '#') return v.length === 8 ? '#' + v.slice(2) : v;
    // CMYK 分量取值 0–255，转为 RGB 近似（阅读级即可）。
    const parts = v.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(isFinite)) {
      const c = parts[0] / 255, m = parts[1] / 255, y = parts[2] / 255, k = parts[3] / 255;
      const r = Math.round(255 * (1 - Math.min(1, c + k)));
      const g = Math.round(255 * (1 - Math.min(1, m + k)));
      const b = Math.round(255 * (1 - Math.min(1, y + k)));
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
    return null;
  }

  /* ---------- 路径与图元 ---------- */

  function pathBoundsToTransform(boundary, unitPx) {
    return { x: boundary[0] * unitPx, y: boundary[1] * unitPx };
  }

  // AbbreviatedData 与 SVG path 语法一致：M/L/C/Q/Z。
  function applyAbbreviatedPath(ctx, el, unitPx, ox, oy) {
    const tokens = String(el.textContent || '').trim().match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
    let i = 0;
    let cx = 0, cy = 0;
    const u = function () { return (Number(tokens[i++]) || 0) * unitPx; };
    const P = function () { return [u(), u()]; };
    while (i < tokens.length) {
      const cmd = tokens[i++];
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      const nx = function (x, y) { cx = rel ? cx + x : x; cy = rel ? cy + y : y; return [ox + cx, oy + cy]; };
      switch (C) {
        case 'M': { const p = nx(u(), u()); ctx.moveTo(p[0], p[1]); break; }
        case 'L': { const p = nx(u(), u()); ctx.lineTo(p[0], p[1]); break; }
        case 'C': {
          const a = P(), b = P(), p = nx(u(), u());
          ctx.bezierCurveTo(ox + (rel ? cx - p[0] + a[0] : a[0]), oy + (rel ? cy - p[1] + a[1] : a[1]),
            ox + (rel ? cx - p[0] + b[0] : b[0]), oy + (rel ? cy - p[1] + b[1] : b[1]), p[0], p[1]);
          break;
        }
        case 'Q': { const a = P(), p = nx(u(), u()); ctx.quadraticCurveTo(a[0], a[1], p[0], p[1]); break; }
        case 'Z': ctx.closePath(); break;
        default: break;
      }
    }
  }

  function drawFillColor(obj, res, prop) {
    const el = child(obj, 'FillColor');
    const param = obj.getAttribute('DrawParam') && res.drawParams[String(obj.getAttribute('DrawParam'))];
    const value = el ? el.getAttribute('Value') : (param && param.fill);
    return parseColor(value) || (prop === 'stroke' ? null : '#000000');
  }

  /* ---------- 资源表 ---------- */

  function newResTable() {
    return { images: new Map(), fonts: new Map(), drawParams: new Map() };
  }

  function ingestRes(res, zip, xmlText, baseDir) {
    if (!xmlText) return;
    const root = parseXML(xmlText);
    const baseLoc = root.getAttribute('BaseLoc') || '';
    const base = joinPath(baseDir, baseLoc ? baseLoc.replace(/\/?$/, '/') : '');
    for (const media of descendants(root, 'MultiMedia')) {
      const id = media.getAttribute('ID');
      const loc = (child(media, 'Loc') || {}).textContent || '';
      if (id && loc) res.images.set(String(id), joinPath(base, loc.trim()));
    }
    for (const font of descendants(root, 'Font')) {
      const id = font.getAttribute('ID');
      if (id) {
        const fileLoc = child(font, 'FontFileLoc');
        res.fonts.set(String(id), {
          name: font.getAttribute('FontName') || '',
          file: fileLoc ? joinPath(base, fileLoc.textContent.trim()) : '',
        });
      }
    }
    for (const param of descendants(root, 'DrawParam')) {
      const id = param.getAttribute('ID');
      if (id) {
        const fill = child(param, 'FillColor');
        const stroke = child(param, 'StrokeColor');
        const width = child(param, 'LineWidth');
        res.drawParams.set(String(id), {
          fill: fill ? fill.getAttribute('Value') : '',
          stroke: stroke ? stroke.getAttribute('Value') : '',
          width: width ? Number(width.textContent) : NaN,
        });
      }
    }
  }

  function joinPath() {
    const parts = Array.from(arguments).filter(Boolean).map(function (p) { return String(p).replace(/\\/g, '/'); });
    const out = [];
    for (const part of parts.join('/').split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') out.pop(); else out.push(part);
    }
    return out.join('/');
  }

  /* ---------- 文档解析 ---------- */

  function parseBox(text, scale) {
    const v = floatList(text);
    if (v.length < 4) return null;
    return { x: v[0], y: v[1], w: v[2] * scale, h: v[3] * scale };
  }

  async function openOFD(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const zip = await readZip(bytes);
    const ofdXml = await zip.readText('OFD.xml');
    if (!ofdXml) throw new Error('OFD.xml 缺失，文件可能已损坏');
    const root = parseXML(ofdXml);
    const docRoot = (child(child(root, 'DocBody') || root, 'DocRoot') || {}).textContent;
    if (!docRoot) throw new Error('OFD.xml 中没有 DocRoot');
    const docDir = docRoot.replace(/\/?$/, '/');

    const documentXml = await zip.readText(joinPath(docRoot, 'Document.xml'));
    if (!documentXml) throw new Error('Document.xml 缺失');
    const document = parseXML(documentXml);

    const res = newResTable();
    const common = child(document, 'CommonData') || document;
    // PhysicalBox 以毫米计；页面正文坐标以 0.1mm 计。按 144dpi 渲染保证文字清晰。
    const pxPerMM = 144 / 25.4;
    const unitPx = pxPerMM / 10;
    const box = parseBox((child(common, 'PhysicalBox') || child(common, 'PageBox') || {}).textContent, pxPerMM) ||
      { x: 0, y: 0, w: 210 * pxPerMM, h: 297 * pxPerMM };
    const pageSize = { w: box.w, h: box.h };

    await ingestRes(res, zip, await zip.readText(joinPath(docRoot, 'PublicRes/PublicRes.xml')), joinPath(docRoot, 'PublicRes'));
    await ingestRes(res, zip, await zip.readText(joinPath(docRoot, 'DocumentRes/DocumentRes.xml')), joinPath(docRoot, 'DocumentRes'));

    const pageNodes = descendants(common, 'Page');
    const pages = pageNodes.map(function (node) { return node.getAttribute('BaseLoc') || ''; });

    const templates = new Map();
    for (const tpl of descendants(common, 'Template')) {
      const id = tpl.getAttribute('TemplateID');
      const loc = tpl.getAttribute('BaseLoc') || (child(tpl, 'BaseLoc') || {}).textContent;
      if (id && loc) templates.set(id, loc);
    }

    async function pageLayers(contentXml, contentDir, cacheRes) {
      const pageRoot = parseXML(contentXml);
      const pageResEl = child(pageRoot, 'PageRes');
      if (pageResEl) {
        const loc = (child(pageResEl, 'Loc') || {}).textContent;
        if (loc) await ingestRes(cacheRes, zip, await zip.readText(joinPath(contentDir, loc)), joinPath(contentDir, loc.replace(/[^/]*$/, '')));
      }
      const content = child(pageRoot, 'Content');
      const layers = [];
      for (const layer of children(content || pageRoot, 'Layer')) layers.push(layer);
      for (const layer of descendants(content || pageRoot, 'Layer')) {
        if (layers.indexOf(layer) < 0) layers.push(layer);
      }
      return layers;
    }

    const layerCache = new Map();
    async function layersFor(index) {
      if (layerCache.has(index)) return layerCache.get(index);
      const loc = pages[index];
      const contentDir = joinPath(docRoot, loc.replace(/[^/]*$/, ''));
      const contentXml = await zip.readText(joinPath(docRoot, loc));
      if (!contentXml) throw new Error('第 ' + (index + 1) + ' 页内容缺失');
      const pageRes = newResTable();
      pageRes.images = res.images; pageRes.fonts = res.fonts; pageRes.drawParams = res.drawParams;
      const layers = await pageLayers(contentXml, contentDir, pageRes);
      // 页面可引用模板层（背景/版式），先画模板层再画正文层。
      const contentRoot = parseXML(contentXml);
      const tplId = (contentRoot.getAttribute('TemplateID') || (contentRoot.firstElementChild && contentRoot.firstElementChild.getAttribute('TemplateID')) || '');
      const out = { layers: layers, template: null };
      if (tplId && templates.has(tplId)) {
        const tplLoc = templates.get(tplId);
        const tplDir = joinPath(docRoot, tplLoc.replace(/[^/]*$/, ''));
        const tplXml = await zip.readText(joinPath(docRoot, tplLoc));
        if (tplXml) out.template = await pageLayers(tplXml, tplDir, pageRes);
      }
      layerCache.set(index, out);
      return out;
    }

    const imageCache = new Map();
    async function loadImage(ref) {
      if (imageCache.has(ref)) return imageCache.get(ref);
      const promise = (async function () {
        const data = await zip.read(ref);
        if (!data) return null;
        return await createImageBitmap(new Blob([data]));
      })();
      imageCache.set(ref, promise);
      return promise;
    }

    async function renderLayer(ctx, layer, unitPx) {
      for (const obj of layer.children) {
        try {
          switch (obj.localName) {
            case 'TextObject': await drawText(ctx, obj, unitPx); break;
            case 'ImageObject': await drawImage(ctx, obj, unitPx); break;
            case 'PathObject': await drawPath(ctx, obj, unitPx); break;
            case 'CompositeObject':
              for (const sub of children(obj, 'PageBlock') || []) await renderLayer(ctx, sub, unitPx);
              break;
          }
        } catch (e) { /* 单个图元失败不阻断整页渲染 */ }
      }
    }

    async function drawText(ctx, obj, unitPx) {
      const boundary = floatList(obj.getAttribute('Boundary'));
      if (boundary.length < 4) return;
      const ox = boundary[0] * unitPx, oy = boundary[1] * unitPx;
      const fontEl = child(obj, 'Font');
      const size = (Number(fontEl && fontEl.getAttribute('Size')) || 30) * unitPx;
      const bold = fontEl && fontEl.getAttribute('Bold') === '1';
      const fill = drawFillColor(obj, res, 'fill');
      const hscale = Number(obj.getAttribute('HScale')) || 1;
      ctx.save();
      ctx.fillStyle = fill || '#000000';
      for (const code of children(obj, 'TextCode')) {
        const text = code.textContent || '';
        if (!text) continue;
        const dx = floatList(code.getAttribute('deltaX'));
        const dy = floatList(code.getAttribute('deltaY'));
        let x = ox + (Number(code.getAttribute('x')) || 0) * unitPx;
        let y = oy + (Number(code.getAttribute('y')) || 0) * unitPx;
        ctx.font = (bold ? '600 ' : '') + size + 'px "SimSun","Microsoft YaHei",sans-serif';
        ctx.textBaseline = 'alphabetic';
        const chars = Array.from(text);
        for (let i = 0; i < chars.length; i++) {
          if (dy[i]) y += dy[i] * unitPx;
          if (chars[i] !== ' ') ctx.fillText(chars[i], x, y);
          if (dx[i]) x += dx[i] * unitPx;
          else {
            const w = ctx.measureText(chars[i]).width;
            x += (chars[i].charCodeAt(0) < 256 ? w * 0.5 : w) * hscale;
          }
        }
      }
      ctx.restore();
    }

    async function drawImage(ctx, obj, unitPx) {
      const boundary = floatList(obj.getAttribute('Boundary'));
      if (boundary.length < 4) return;
      const ref = res.images.get(String(obj.getAttribute('ResourceID')));
      if (!ref) return;
      const bitmap = await loadImage(ref);
      if (!bitmap) return;
      const dx = boundary[0] * unitPx, dy = boundary[1] * unitPx;
      const dw = boundary[2] * unitPx, dh = boundary[3] * unitPx;
      const matrix = floatList(obj.getAttribute('CTM'));
      ctx.save();
      if (matrix.length >= 6) {
        // CTM: a b c d e/f，仅应用缩放与平移（阅读级渲染够用）。
        ctx.transform(matrix[0], matrix[1], matrix[2], matrix[3], dx + matrix[4] * unitPx, dy + matrix[5] * unitPx);
        ctx.drawImage(bitmap, 0, 0, dw, dh);
      } else {
        ctx.drawImage(bitmap, dx, dy, dw, dh);
      }
      ctx.restore();
    }

    async function drawPath(ctx, obj, unitPx) {
      const boundary = floatList(obj.getAttribute('Boundary'));
      if (boundary.length < 4) return;
      const ox = boundary[0] * unitPx, oy = boundary[1] * unitPx;
      const abbrev = child(obj, 'AbbreviatedData') || obj;
      const fill = drawFillColor(obj, res, 'fill');
      const strokeEl = child(obj, 'StrokeColor');
      const stroke = parseColor(strokeEl ? strokeEl.getAttribute('Value') : '');
      const param = res.drawParams[String(obj.getAttribute('DrawParam'))] || {};
      const lineWidth = ((Number((child(obj, 'LineWidth') || {}).textContent) || param.width || 0.35) * unitPx) || 1;
      ctx.save();
      ctx.beginPath();
      applyAbbreviatedPath(ctx, abbrev, unitPx, ox, oy);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke || (!fill && !stroke)) { ctx.strokeStyle = stroke || '#000000'; ctx.lineWidth = lineWidth; ctx.stroke(); }
      ctx.restore();
    }

    return {
      kind: 'ofd',
      pageCount: Math.max(1, pages.length),
      pageSize: function () { return { w: Math.round(pageSize.w), h: Math.round(pageSize.h) }; },
      renderPage: async function (index) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(pageSize.w));
        canvas.height = Math.max(1, Math.round(pageSize.h));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const data = await layersFor(index);
        if (data.template) {
          for (const layer of data.template) await renderLayer(ctx, layer, unitPx);
        }
        for (const layer of data.layers) await renderLayer(ctx, layer, unitPx);
        return canvas;
      },
    };
  }

  Pico.OFD = { open: openOFD };
})();
