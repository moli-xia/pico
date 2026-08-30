/* ============================================================
 * Pico 图片查看器 · formats.js
 * PSD/PSB、PDF 兼容 Illustrator AI 与 DWG 的本地预览管线。
 *
 * 原文件仍保存为 item.file；这里生成的只是查看器/缩略图使用的
 * 临时栅格预览，因此不会修改或覆盖用户的设计文件。
 * ============================================================ */
(function () {
  'use strict';
  const Pico = (window.Pico = window.Pico || {});
  const SCRIPT_ROOT = new URL('js/', document.baseURI);
  const ADVANCED_EXTENSIONS = Object.freeze(['psd', 'psb', 'ai', 'dwg']);
  const MAX_PSD_PIXELS = 64 * 1024 * 1024;
  const MAX_PDF_PIXELS = 24 * 1024 * 1024;

  let psdModulePromise = null;
  let pdfModulePromise = null;
  let dwgEnginePromise = null;

  function moduleURL(path) {
    return new URL(path, SCRIPT_ROOT).href;
  }

  function extOf(file) {
    return Pico.extOf(file && (file.name || file)) || '';
  }

  Pico.previewExtensions = ADVANCED_EXTENSIONS.slice();
  Pico.isAdvancedPreviewFile = function (file) {
    return ADVANCED_EXTENSIONS.indexOf(extOf(file)) >= 0;
  };
  Pico.previewLabel = function (file) {
    const ext = extOf(file);
    return ext === 'psd' || ext === 'psb' ? 'PSD 合成预览' :
      ext === 'ai' ? 'Illustrator PDF 兼容预览' :
        ext === 'dwg' ? 'DWG 图纸预览' : '图片预览';
  };

  function loadImageURL(url) {
    return new Promise(function (resolve, reject) {
      const image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error('预览图片无法解码')); };
      image.src = url;
    });
  }

  async function blobDimensions(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const image = await loadImageURL(url);
      return { width: image.naturalWidth || image.width || 0, height: image.naturalHeight || image.height || 0 };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function canvasBlob(canvas, mime, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob); else reject(new Error('预览图片编码失败'));
      }, mime, quality);
    });
  }

  function littleEndianU32(bytes, offset) {
    return (bytes[offset] || 0) + ((bytes[offset + 1] || 0) << 8) +
      ((bytes[offset + 2] || 0) << 16) + ((bytes[offset + 3] || 0) * 0x1000000);
  }

  /* LibreDWG exposes BMP thumbnails as a DIB (BITMAPINFOHEADER + palette + pixels).
   * Browsers expect the 14-byte BITMAPFILEHEADER as well, so wrap it before decoding. */
  function dibToBmp(bytes) {
    if (!bytes || bytes.length < 40 || littleEndianU32(bytes, 0) !== 40) return bytes;
    const bitCount = (bytes[14] || 0) | ((bytes[15] || 0) << 8);
    let colorCount = littleEndianU32(bytes, 32);
    if (!colorCount && bitCount > 0 && bitCount <= 8) colorCount = 1 << bitCount;
    const pixelOffset = 14 + colorCount * 4 + 40;
    const result = new Uint8Array(14 + bytes.length);
    result[0] = 0x42; result[1] = 0x4d;
    const fileSize = result.length;
    result[2] = fileSize & 0xff; result[3] = (fileSize >>> 8) & 0xff;
    result[4] = (fileSize >>> 16) & 0xff; result[5] = (fileSize >>> 24) & 0xff;
    result[10] = pixelOffset & 0xff; result[11] = (pixelOffset >>> 8) & 0xff;
    result[12] = (pixelOffset >>> 16) & 0xff; result[13] = (pixelOffset >>> 24) & 0xff;
    result.set(bytes, 14);
    return result;
  }

  async function rgbaBlob(pixels, width, height) {
    width = Math.max(1, Math.floor(Number(width) || 0));
    height = Math.max(1, Math.floor(Number(height) || 0));
    if (width * height > MAX_PSD_PIXELS) throw new Error('PSD 图像过大，已超过安全预览上限');
    if (!pixels || pixels.length < width * height * 4) throw new Error('PSD 合成像素数据不完整');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels.subarray ? pixels.subarray(0, width * height * 4) : pixels);
    ctx.putImageData(imageData, 0, 0);
    return canvasBlob(canvas, 'image/png');
  }

  function rawRGBPixels(psd) {
    const data = psd && psd.imageData;
    const red = data && data.red;
    const green = data && data.green;
    const blue = data && data.blue;
    const alpha = data && data.alpha;
    const width = Number(psd && psd.width) || 0;
    const height = Number(psd && psd.height) || 0;
    const length = width * height;
    if (!length || !red || !green || !blue || red.compression !== 0 || green.compression !== 0 ||
      blue.compression !== 0 || (alpha && alpha.compression !== 0) || red.data.length < length ||
      green.data.length < length || blue.data.length < length || (alpha && alpha.data.length < length)) {
      return null;
    }
    const pixels = new Uint8ClampedArray(length * 4);
    for (let i = 0; i < length; i++) {
      const out = i * 4;
      pixels[out] = red.data[i];
      pixels[out + 1] = green.data[i];
      pixels[out + 2] = blue.data[i];
      pixels[out + 3] = alpha ? alpha.data[i] : 255;
    }
    return pixels;
  }

  function decodeRawPSD(bytes) {
    if (!bytes || bytes.length < 38 || ascii(bytes, 0, 4) !== '8BPS') return null;
    const version = readU16(bytes, 4);
    if (version !== 1 && version !== 2) return null;
    const channels = readU16(bytes, 12);
    const height = readU32(bytes, 14);
    const width = readU32(bytes, 18);
    const depth = readU16(bytes, 22);
    const colorMode = readU16(bytes, 24);
    const pixels = width * height;
    if (colorMode !== 3 || depth !== 8 || channels < 3 || !Number.isSafeInteger(pixels) ||
      width < 1 || height < 1 || pixels > MAX_PSD_PIXELS) return null;
    let offset = 26;
    const colorLength = readU32(bytes, offset); offset += 4 + colorLength;
    if (offset + 4 > bytes.length) return null;
    const resourcesLength = readU32(bytes, offset); offset += 4 + resourcesLength;
    if (offset + 4 > bytes.length) return null;
    const layerMaskFieldSize = version === 2 ? 8 : 4;
    const layerMaskLength = version === 2 ? readU64(bytes, offset) : readU32(bytes, offset);
    offset += layerMaskFieldSize + layerMaskLength;
    if (offset + 2 > bytes.length) return null;
    const compression = readU16(bytes, offset); offset += 2;
    if (compression !== 0 || !Number.isSafeInteger(layerMaskLength) ||
      pixels > (bytes.length - offset) / channels) return null;
    const red = bytes.subarray(offset, offset + pixels);
    const green = bytes.subarray(offset + pixels, offset + pixels * 2);
    const blue = bytes.subarray(offset + pixels * 2, offset + pixels * 3);
    const alpha = channels >= 4 ? bytes.subarray(offset + pixels * 3, offset + pixels * 4) : null;
    const output = new Uint8ClampedArray(pixels * 4);
    for (let i = 0; i < pixels; i++) {
      const out = i * 4;
      output[out] = red[i];
      output[out + 1] = green[i];
      output[out + 2] = blue[i];
      output[out + 3] = alpha ? alpha[i] : 255;
    }
    return { pixels: output, width: width, height: height };
  }

  function readU16(bytes, offset) {
    return ((bytes[offset] || 0) << 8) | (bytes[offset + 1] || 0);
  }

  function readU32(bytes, offset) {
    return (((bytes[offset] || 0) * 0x1000000) + ((bytes[offset + 1] || 0) << 16) +
      ((bytes[offset + 2] || 0) << 8) + (bytes[offset + 3] || 0));
  }

  function readU64(bytes, offset) {
    return readU32(bytes, offset) * 0x100000000 + readU32(bytes, offset + 4);
  }

  function ascii(bytes, offset, length) {
    let result = '';
    for (let i = 0; i < length && offset + i < bytes.length; i++) result += String.fromCharCode(bytes[offset + i]);
    return result;
  }

  function findBytes(bytes, needle, from, reverse) {
    from = from == null ? (reverse ? bytes.length - needle.length : 0) : from;
    if (reverse) {
      for (let i = Math.min(from, bytes.length - needle.length); i >= 0; i--) {
        let ok = true;
        for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) { ok = false; break; }
        if (ok) return i;
      }
      return -1;
    }
    for (let i = Math.max(0, from); i <= bytes.length - needle.length; i++) {
      let ok = true;
      for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) { ok = false; break; }
      if (ok) return i;
    }
    return -1;
  }

  /*
   * Photoshop stores a small JPEG in image resource 1033/1036. It is a useful
   * fallback for files saved without “Maximize Compatibility”, where the full
   * composite section is intentionally absent or unsupported by the parser.
   */
  function extractPsdThumbnail(bytes) {
    if (!bytes || bytes.length < 38 || ascii(bytes, 0, 4) !== '8BPS') return null;
    const version = readU16(bytes, 4);
    if (version !== 1 && version !== 2) return null;
    let offset = 26;
    if (offset + 4 > bytes.length) return null;
    const colorLength = readU32(bytes, offset); offset += 4 + colorLength;
    if (offset + 4 > bytes.length) return null;
    const resourcesLength = readU32(bytes, offset); offset += 4;
    const end = Math.min(bytes.length, offset + resourcesLength);
    while (offset + 12 <= end) {
      const signature = ascii(bytes, offset, 4); offset += 4;
      if (signature !== '8BIM' && signature !== '8B64') break;
      const id = readU16(bytes, offset); offset += 2;
      const nameLength = bytes[offset++] || 0;
      offset += nameLength;
      if ((1 + nameLength) % 2) offset++;
      if (offset + 4 > end) break;
      const size = readU32(bytes, offset); offset += 4;
      const dataStart = offset;
      const dataEnd = Math.min(end, dataStart + size);
      if ((id === 1033 || id === 1036) && dataEnd - dataStart >= 28) {
        const format = readU32(bytes, dataStart);
        if (format === 1) {
          const width = readU32(bytes, dataStart + 4);
          const height = readU32(bytes, dataStart + 8);
          const jpegStart = dataStart + 28;
          const compressedSize = readU32(bytes, dataStart + 20);
          const jpegEnd = Math.min(dataEnd, jpegStart + Math.max(0, compressedSize || dataEnd - jpegStart));
          if (jpegEnd > jpegStart) {
            return { blob: new Blob([bytes.slice(jpegStart, jpegEnd)], { type: 'image/jpeg' }), width: width, height: height };
          }
        }
      }
      offset = dataEnd + (size % 2);
    }
    return null;
  }

  async function loadPSD() {
    if (!psdModulePromise) {
      psdModulePromise = import(moduleURL('vendor/psd.js')).then(function (module) { return module.default || module; });
    }
    return psdModulePromise;
  }

  async function decodePSD(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const raw = decodeRawPSD(bytes);
    if (raw) {
      const blob = await rgbaBlob(raw.pixels, raw.width, raw.height);
      return { blob: blob, width: raw.width, height: raw.height, mime: 'image/png', description: Pico.previewLabel(file) };
    }
    let parserError = null;
    try {
      const Psd = await loadPSD();
      const document = Psd.parse(bytes.buffer);
      // The common 8-bit/raw RGB case needs no decoder runtime at all. This
      // also gives WebView2 a deterministic fast path while compressed PSDs
      // continue through the package's WASM decoder below.
      const pixels = rawRGBPixels(document) || await document.composite();
      const blob = await rgbaBlob(pixels, document.width, document.height);
      return { blob: blob, width: document.width, height: document.height, mime: 'image/png', description: Pico.previewLabel(file) };
    } catch (error) {
      parserError = error;
    }
    const thumbnail = extractPsdThumbnail(bytes);
    if (thumbnail) {
      const size = thumbnail.width && thumbnail.height ? thumbnail : await blobDimensions(thumbnail.blob);
      return { blob: thumbnail.blob, width: size.width, height: size.height, mime: 'image/jpeg', description: Pico.previewLabel(file) + '（内嵌缩略图）' };
    }
    const detail = parserError && (parserError.message || String(parserError));
    throw new Error('PSD/PSB 没有可用的合成预览' + (detail ? '：' + detail : ''));
  }

  async function loadPDF() {
    if (!pdfModulePromise) {
      pdfModulePromise = import(moduleURL('vendor/pdf.min.mjs')).then(function (module) {
        const pdf = module || window.pdfjsLib;
        if (!pdf || !pdf.getDocument) throw new Error('PDF 预览引擎不可用');
        if (pdf.GlobalWorkerOptions) pdf.GlobalWorkerOptions.workerSrc = moduleURL('vendor/pdf.worker.min.mjs');
        return pdf;
      });
    }
    return pdfModulePromise;
  }

  function extractPDF(bytes) {
    const header = [37, 80, 68, 70, 45]; // %PDF-
    const start = findBytes(bytes, header, 0, false);
    if (start < 0) return null;
    const eof = findBytes(bytes, [37, 37, 69, 79, 70], bytes.length - 5, true); // %%EOF
    return bytes.slice(start, eof >= start ? eof + 5 : bytes.length);
  }

  async function decodeAI(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdfBytes = extractPDF(bytes);
    if (!pdfBytes) throw new Error('该 AI 文件不是 PDF 兼容格式；请在 Illustrator 保存时勾选“创建 PDF 兼容文件”');
    const pdf = await loadPDF();
    const loadingTask = pdf.getDocument({ data: pdfBytes, isEvalSupported: false });
    let pdfDocument = null;
    try {
      pdfDocument = await loadingTask.promise;
      if (!pdfDocument.numPages) throw new Error('AI 文件没有可显示的画板');
      const page = await pdfDocument.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const basePixels = Math.max(1, base.width * base.height);
      const scale = Math.min(3, Math.max(0.5, Math.sqrt(MAX_PDF_PIXELS / basePixels)));
      const viewport = page.getViewport({ scale: scale });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: viewport, background: '#ffffff' }).promise;
      const blob = await canvasBlob(canvas, 'image/png');
      return { blob: blob, width: canvas.width, height: canvas.height, mime: 'image/png', description: Pico.previewLabel(file) + '（第一页）' };
    } finally {
      if (pdfDocument && pdfDocument.cleanup) { try { await pdfDocument.cleanup(); } catch (e) {} }
      if (pdfDocument && pdfDocument.destroy) { try { await pdfDocument.destroy(); } catch (e) {} }
    }
  }

  async function loadDWG() {
    if (!dwgEnginePromise) {
      dwgEnginePromise = import(moduleURL('vendor/libredwg-web.js')).then(async function (module) {
        if (!module || !module.LibreDwg) throw new Error('DWG 预览引擎不可用');
        const engine = await module.LibreDwg.create();
        return { engine: engine, fileType: module.Dwg_File_Type && module.Dwg_File_Type.DWG != null ? module.Dwg_File_Type.DWG : 0 };
      });
    }
    return dwgEnginePromise;
  }

  async function decodeDWG(file) {
    const loaded = await loadDWG();
    const engine = loaded.engine;
    const dataBytes = await file.arrayBuffer();
    let data = null;
    try {
      data = engine.dwg_read_data(dataBytes, loaded.fileType);
      if (!data) throw new Error('DWG 数据为空');
      const thumbnail = engine.dwg_bmp(data);
      if (thumbnail && thumbnail.data && thumbnail.data.length) {
        const imageType = Number(thumbnail.type);
        const mime = imageType === 6 ? 'image/png' : (imageType === 2 ? 'image/bmp' : '');
        if (mime) {
          const rawThumbnail = new Uint8Array(thumbnail.data);
          const thumbnailBytes = imageType === 2 ? dibToBmp(rawThumbnail) : rawThumbnail;
          const blob = new Blob([thumbnailBytes], { type: mime });
          try {
            const size = await blobDimensions(blob);
            return { blob: blob, width: size.width, height: size.height, mime: mime, description: Pico.previewLabel(file) + '（内嵌缩略图）' };
          } catch (e) {}
        }
      }
      const database = engine.convert(data);
      const svg = engine.dwg_to_svg(database);
      if (!svg) throw new Error('DWG 没有可渲染的图元');
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const size = await blobDimensions(blob);
      if (!size.width || !size.height) throw new Error('DWG SVG 预览尺寸无效');
      return { blob: blob, width: size.width, height: size.height, mime: 'image/svg+xml', description: Pico.previewLabel(file) + '（矢量预览）' };
    } finally {
      if (data) { try { engine.dwg_free(data); } catch (e) {} }
    }
  }

  async function decodeAdvanced(file) {
    const ext = extOf(file);
    if (ext === 'psd' || ext === 'psb') return decodePSD(file);
    if (ext === 'ai') return decodeAI(file);
    if (ext === 'dwg') return decodeDWG(file);
    throw new Error('不支持的设计文件格式');
  }

  /*
   * 返回最终给 <img> 使用的 URL。相同 item 的并发查看、缩略图和编辑
   * 请求共享一个 Promise，避免重复启动 WebAssembly/PDF 解码。
   */
  Pico.ensurePreview = function (item) {
    if (!item || !item.file) return Promise.reject(new Error('没有可预览的文件'));
    if (!Pico.isAdvancedPreviewFile(item)) return Promise.resolve(item.url || '');
    if (item.previewURL) {
      item.url = item.previewURL;
      return Promise.resolve(item.previewURL);
    }
    if (item.previewPromise) return item.previewPromise;
    item.previewPromise = decodeAdvanced(item.file).then(function (result) {
      item.previewURL = URL.createObjectURL(result.blob);
      item.url = item.previewURL;
      item.previewMime = result.mime;
      item.previewDescription = result.description;
      if (result.width && result.height) { item.w = result.width; item.h = result.height; }
      return item.previewURL;
    }).catch(function (error) {
      item.previewError = error;
      throw error;
    });
    return item.previewPromise;
  };

  Pico.previewErrorMessage = function (item, error) {
    const ext = extOf(item);
    if (ext === 'ai') return 'AI 预览失败：' + (error && error.message ? error.message : '文件可能未保存 PDF 兼容预览');
    if (ext === 'dwg') return 'DWG 预览失败：' + (error && error.message ? error.message : '文件版本或图元暂不兼容');
    if (ext === 'psd' || ext === 'psb') return 'PSD/PSB 预览失败：' + (error && error.message ? error.message : '没有可用合成图');
    return '文件预览失败';
  };
})();
