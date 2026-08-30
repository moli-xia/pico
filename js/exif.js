/* ============================================================
 * Pico 图片查看器 · exif.js
 * 轻量 JPEG EXIF 解析（读取 APP1 段常用拍摄参数）
 * ============================================================ */
(function () {
  'use strict';
  const Pico = (window.Pico = window.Pico || {});

  const TAGS = {
    0x010F: 'make', 0x0110: 'model',
    0x0112: 'orientation',
    0x0132: 'dateTime',
    0x829A: 'exposureTime', 0x829D: 'fNumber',
    0x8827: 'iso', 0x920A: 'focalLength',
    0x9003: 'dateTimeOriginal', 0x9004: 'dateTimeDigitized',
    0xA002: 'pixelXDim', 0xA003: 'pixelYDim',
    0x9209: 'flash', 0xA434: 'lensModel', 0xA432: 'lensSpec',
  };

  /** 解析 JPEG 的 ArrayBuffer，返回 {make,model,...} 或 null（非 JPEG / 无 EXIF） */
  function parse(buffer) {
    const v = new DataView(buffer);
    if (buffer.byteLength < 4 || v.getUint16(0, false) !== 0xFFD8) return null;

    let offset = 2, tiffStart = -1;
    while (offset < buffer.byteLength - 4) {
      if (v.getUint8(offset) !== 0xFF) break;
      const marker = v.getUint8(offset + 1);
      const size = v.getUint16(offset + 2, false);
      if (marker === 0xE1 && offset + 10 < buffer.byteLength &&
          v.getUint32(offset + 4, false) === 0x45786966 /* Exif */) {
        tiffStart = offset + 10;
        break;
      }
      offset += 2 + size;
    }
    if (tiffStart < 0) return null;

    try {
      const little = v.getUint16(tiffStart, false) === 0x4949;
      if (v.getUint16(tiffStart + 2, !little) !== 0x002A) return null;
      const ifd0 = readIFD(v, tiffStart, tiffStart + v.getUint32(tiffStart + 4, !little), little, false);
      const exifIfdPtr = ifd0._ptrs[0x8769];
      const out = Object.assign({}, ifd0._vals);
      if (exifIfdPtr) {
        const exif = readIFD(v, tiffStart, tiffStart + exifIfdPtr, little, true);
        Object.assign(out, exif._vals);
      }
      delete out._ptrs; // 安全兜底
      return Object.keys(out).length ? out : null;
    } catch (e) { return null; }
  }

  function readIFD(v, tiffStart, dirStart, little, isSub) {
    const entries = v.getUint16(dirStart, little);
    const vals = {}, ptrs = {};
    for (let i = 0; i < entries; i++) {
      const e = dirStart + 2 + i * 12;
      if (e + 12 > v.byteLength) break;
      const tag = v.getUint16(e, little);
      const type = v.getUint16(e + 2, little);
      const count = v.getUint32(e + 4, little);
      const sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
      if (!sizes[type]) continue;
      const total = sizes[type] * count;
      const valOff = total > 4 ? tiffStart + v.getUint32(e + 8, little) : e + 8;
      if (valOff < 0 || valOff + total > v.byteLength) continue;

      if (type === 2) { // ASCII
        let s = '';
        for (let c = 0; c < count - 1; c++) {
          const ch = v.getUint8(valOff + c);
          if (ch === 0) break;
          s += String.fromCharCode(ch);
        }
        vals[TAGS[tag] || ('tag_' + tag)] = s.trim();
      } else if (type === 5 || type === 10) { // RATIONAL / SRATIONAL
        const num = v.getUint32(valOff, little) || v.getInt32(valOff, little);
        const den = v.getUint32(valOff + 4, little) || v.getInt32(valOff + 4, little);
        const rat = den === 0 ? 0 : num / den;
        vals[TAGS[tag] || ('tag_' + tag)] = rat;
      } else if (type === 3) {
        vals[TAGS[tag] || ('tag_' + tag)] = v.getUint16(valOff, little);
      } else if (type === 4 || type === 9) {
        vals[TAGS[tag] || ('tag_' + tag)] = v.getUint32(valOff, little);
      } else if (type === 1 || type === 7) {
        if (tag === 0xA432) { /* lens spec 略 */ }
        vals[TAGS[tag] || ('tag_' + tag)] = v.getUint8(valOff);
      }
      if (isSub === false) ptrs[tag] = (tag === 0x8769) ? v.getUint32(e + 8, little) : undefined;
    }
    return { _vals: vals, _ptrs: ptrs };
  }

  /** 从 File 读取 EXIF（只读取前 256KB，JPEG 专属；其他格式返回 null） */
  Pico.readExif = async function (file) {
    if (!file) return null;
    const ext = Pico.extOf(file.name);
    if (file.type && file.type !== 'image/jpeg' && ext !== 'jpg' && ext !== 'jpeg' && ext !== 'jfif') return null;
    try {
      const buf = await file.slice(0, 256 * 1024).arrayBuffer();
      return parse(buf);
    } catch (e) { return null; }
  };

  /** 将原始 EXIF 字段整理为可直接展示的 [label, value] 列表 */
  Pico.exifRows = function (ex) {
    if (!ex) return [];
    const rows = [];
    const trim = function (s) { return String(s || '').trim(); };

    const camera = [trim(ex.make), trim(ex.model)].filter(Boolean).join(' ').replace(/\u0000/g, '');
    if (camera) rows.push(['相机', camera]);
    if (ex.lensModel) rows.push(['镜头', trim(ex.lensModel).replace(/\u0000/g, '')]);

    const dt = ex.dateTimeOriginal || ex.dateTime || ex.dateTimeDigitized;
    if (typeof dt === 'string' && dt.length >= 10) {
      const m = /^(\d{4}):(\d{2}):(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?/.exec(dt);
      if (m) rows.push(['拍摄时间', m[1] + '-' + m[2] + '-' + m[3] + (m[4] ? ' ' + m[4] + ':' + m[5] + ':' + m[6] : '')]);
    }
    if (ex.exposureTime > 0) {
      const t = ex.exposureTime;
      rows.push(['曝光时间', t >= 1 ? (Math.round(t * 10) / 10 + ' s') : ('1/' + Math.round(1 / t) + ' s')]);
    }
    if (ex.fNumber > 0) rows.push(['光圈', 'f/' + (Math.round(ex.fNumber * 10) / 10)]);
    if (ex.iso) rows.push(['ISO', ex.iso]);
    if (ex.focalLength > 0) rows.push(['焦距', (Math.round(ex.focalLength * 10) / 10) + ' mm']);
    if (ex.flash != null) {
      rows.push(['闪光灯', (ex.flash & 1) ? '已闪光' : '未闪光']);
    }
    return rows;
  };
})();
