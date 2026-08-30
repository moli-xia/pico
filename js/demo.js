/* ============================================================
 * Pico 图片查看器 · demo.js
 * 程序化生成演示图片（离线可用的"观看演示"）
 * ============================================================ */
(function () {
  'use strict';
  const Pico = (window.Pico = window.Pico || {});

  const PALETTES = [
    { sky: ['#1b2a5e', '#7a4fb3', '#f28cae'], sun: '#ffd9a0', peaks: ['#2b2350', '#1c1a3e', '#120f2b'] },
    { sky: ['#0e3b5e', '#2e86ab', '#a8e0e0'], sun: '#fff3b0', peaks: ['#155e75', '#0e4a5e', '#082f3d'] },
    { sky: ['#3b0764', '#9d174d', '#fb7185'], sun: '#ffe4e6', peaks: ['#4c1d95', '#3b0f70', '#25064f'] },
    { sky: ['#134e4a', '#0f766e', '#99f6e4'], sun: '#fef9c3', peaks: ['#115e59', '#134e4a', '#042f2e'] },
    { sky: ['#7c2d12', '#ea580c', '#fdba74'], sun: '#fff7ed', peaks: ['#7c2d12', '#431407', '#1c0a03'] },
    { sky: ['#1e1b4b', '#4338ca', '#93c5fd'], sun: '#e0f2fe', peaks: ['#312e81', '#1e1b4b', '#171233'] },
  ];

  let seed = 20260829;
  const rnd = function () { // 可复现的伪随机
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
  const rr = function (a, b) { return a + rnd() * (b - a); };

  const SCENES = ['山峦晨雾', '静海之滨', '暮色峡谷', '翡翠湖泊', '赤霞荒原', '夜航灯塔', '极光雪原', '几何构成',
    '流体渐变', '城市夜色', '丘陵日落', '深海气泡', '晶体折射', '群星低语'];

  function drawMountains(ctx, W, H, pal) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.sky[0]); g.addColorStop(0.55, pal.sky[1]); g.addColorStop(1, pal.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 太阳 / 月亮
    const sx = rr(W * 0.2, W * 0.8), sy = rr(H * 0.18, H * 0.42), srad = rr(28, 60);
    const halo = ctx.createRadialGradient(sx, sy, 2, sx, sy, srad * 4);
    halo.addColorStop(0, pal.sun); halo.addColorStop(0.25, pal.sun + 'aa'); halo.addColorStop(1, pal.sun + '00');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(sx, sy, srad * 4, 0, 7); ctx.fill();
    ctx.fillStyle = pal.sun; ctx.beginPath(); ctx.arc(sx, sy, srad, 0, 7); ctx.fill();

    // 层叠山
    const horizon = H * rr(0.52, 0.68);
    pal.peaks.forEach(function (col, pi) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
      let x = 0, y = horizon + pi * H * 0.07 + rr(-20, 20);
      ctx.lineTo(0, y);
      while (x < W) {
        x += rr(90, 240);
        y = horizon + pi * H * 0.07 + rr(-70 - pi * 18, 40 - pi * 10);
        ctx.lineTo(Math.min(x, W), Math.max(H * 0.22, y));
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    });

    // 水面反光
    const wr = ctx.createLinearGradient(0, horizon, 0, H);
    wr.addColorStop(0, pal.sky[2] + '66'); wr.addColorStop(1, pal.sky[0] + 'cc');
    ctx.fillStyle = wr; ctx.fillRect(0, horizon + H * 0.16, W, H);
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 40; i++) {
      const wy = horizon + H * 0.16 + rnd() * (H - horizon - H * 0.16);
      const ww = rr(30, 160);
      ctx.fillStyle = pal.sun; ctx.globalAlpha = 0.05 + rnd() * 0.1;
      ctx.fillRect(sx - ww / 2 + rr(-60, 60), wy, ww, 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawAurora(ctx, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#020617'); g.addColorStop(1, '#0f172a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 星
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + rr(0.15, 0.9) + ')';
      ctx.fillRect(rnd() * W, rnd() * H * 0.85, rr(0.8, 2.2), rr(0.8, 2.2));
    }
    // 极光带
    for (let b = 0; b < 5; b++) {
      const hue = pick([150, 170, 190, 120]);
      ctx.beginPath();
      const baseY = H * rr(0.18, 0.45);
      ctx.moveTo(-50, baseY);
      for (let x = -50; x <= W + 50; x += 60) {
        ctx.lineTo(x, baseY + Math.sin(x * 0.004 + b * 1.7) * H * 0.08 + rr(-16, 16));
      }
      for (let x = W + 50; x >= -50; x -= 60) {
        ctx.lineTo(x, baseY + Math.sin(x * 0.004 + b * 1.7) * H * 0.08 - rr(H * 0.18, H * 0.3));
      }
      ctx.closePath();
      const ag = ctx.createLinearGradient(0, baseY - H * 0.3, 0, baseY);
      ag.addColorStop(0, 'hsla(' + hue + ',85%,65%,0)');
      ag.addColorStop(1, 'hsla(' + hue + ',85%,62%,0.5)');
      ctx.fillStyle = ag; ctx.filter = 'blur(10px)'; ctx.fill(); ctx.filter = 'none';
    }
    // 雪原
    ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.moveTo(0, H);
    let x = 0, y = H * 0.82;
    ctx.lineTo(0, y);
    while (x < W) { x += rr(120, 300); ctx.lineTo(x, y + rr(-26, 26)); }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(148,163,184,0.35)';
    ctx.beginPath(); ctx.moveTo(0, H); let x2 = 0;
    ctx.lineTo(0, H * 0.9);
    while (x2 < W) { x2 += rr(150, 320); ctx.lineTo(x2, H * 0.9 + rr(-14, 14)); }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }

  function drawCity(ctx, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#020617'); g.addColorStop(0.6, '#1e1b4b'); g.addColorStop(1, '#4c1d95');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + rr(0.1, 0.7) + ')';
      ctx.fillRect(rnd() * W, rnd() * H * 0.5, 1.6, 1.6);
    }
    // 月亮
    ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(W * 0.78, H * 0.18, 34, 0, 7); ctx.fill();
    ctx.fillStyle = '#1e1b4b'; ctx.beginPath(); ctx.arc(W * 0.78 + 14, H * 0.18 - 8, 30, 0, 7); ctx.fill();
    // 楼群
    const horizon = H * 0.8;
    let x = 0;
    while (x < W) {
      const bw = rr(50, 130), bh = rr(H * 0.2, H * 0.52);
      const shade = Math.floor(rr(8, 30));
      ctx.fillStyle = 'rgb(' + shade + ',' + (shade + 3) + ',' + (shade + 12) + ')';
      ctx.fillRect(x, horizon - bh, bw, bh + H * 0.2);
      // 窗
      for (let wy = horizon - bh + 10; wy < horizon - 8; wy += 14) {
        for (let wx = x + 6; wx < x + bw - 6; wx += 11) {
          if (rnd() < 0.42) {
            ctx.fillStyle = pick(['rgba(253,224,71,0.9)', 'rgba(147,197,253,0.85)', 'rgba(254,215,170,0.8)']);
            ctx.fillRect(wx, wy, 5, 7);
          }
        }
      }
      x += bw + rr(6, 22);
    }
    // 地面反光
    const fg = ctx.createLinearGradient(0, horizon, 0, H);
    fg.addColorStop(0, 'rgba(99,102,241,0.30)'); fg.addColorStop(1, 'rgba(2,6,23,0.9)');
    ctx.fillStyle = fg; ctx.fillRect(0, horizon, W, H - horizon);
  }

  function drawAbstract(ctx, W, H) {
    const pal2 = pick([['#0f172a', '#3b82f6', '#22d3ee', '#a78bfa'], ['#1c0a03', '#f97316', '#facc15', '#fb7185'],
      ['#052e16', '#22c55e', '#a3e635', '#5eead4'], ['#2e1065', '#c084fc', '#f472b6', '#fbbf24']]);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, pal2[0]); g.addColorStop(1, pal2[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 14; i++) {
      const cx = rnd() * W, cy = rnd() * H, r = rr(H * 0.12, H * 0.5);
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      const col = pick([pal2[1], pal2[2], pal2[3]]);
      rg.addColorStop(0, col + '88'); rg.addColorStop(1, col + '00');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // 细线网格
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    for (let i = 0; i < 24; i++) {
      ctx.beginPath(); ctx.moveTo(i * W / 24, 0); ctx.lineTo(i * W / 24 + H * 0.3, H); ctx.stroke();
    }
  }

  function drawBubbles(ctx, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#082f49'); g.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const beam = ctx.createLinearGradient(W * 0.2, 0, W * 0.7, H);
    beam.addColorStop(0, 'rgba(125,211,252,0.22)'); beam.addColorStop(1, 'rgba(125,211,252,0)');
    ctx.fillStyle = beam;
    ctx.beginPath(); ctx.moveTo(W * 0.25, 0); ctx.lineTo(W * 0.55, 0); ctx.lineTo(W * 0.95, H); ctx.lineTo(W * 0.35, H);
    ctx.closePath(); ctx.fill();
    for (let i = 0; i < 60; i++) {
      const bx = rnd() * W, by = rnd() * H, r = rr(4, 34);
      const bg = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, r * 0.1, bx, by, r);
      bg.addColorStop(0, 'rgba(255,255,255,0.55)'); bg.addColorStop(0.7, 'rgba(186,230,253,0.12)'); bg.addColorStop(1, 'rgba(186,230,253,0.28)');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    }
  }

  /** 生成全部演示图 File[] */
  Pico.generateDemoFiles = async function () {
    seed = 20260829;
    const W = 1280, H = 854, out = [];
    for (let i = 0; i < SCENES.length; i++) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      const pal = PALETTES[i % PALETTES.length];
      const name = SCENES[i];
      if (name === '极光雪原') drawAurora(ctx, W, H);
      else if (name === '城市夜色') drawCity(ctx, W, H);
      else if (name === '几何构成' || name === '流体渐变' || name === '晶体折射') drawAbstract(ctx, W, H);
      else if (name === '深海气泡') drawBubbles(ctx, W, H);
      else drawMountains(ctx, W, H, pal);

      // 轻噪点提升质感
      const dots = Math.floor(W * H / 900);
      for (let d = 0; d < dots; d++) {
        ctx.fillStyle = 'rgba(' + (rnd() < 0.5 ? '255,255,255' : '0,0,0') + ',' + rr(0.015, 0.05) + ')';
        ctx.fillRect(rnd() * W, rnd() * H, 1.5, 1.5);
      }
      const blob = await new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.85); });
      const file = new File([blob], '示例-' + String(i + 1).padStart(2, '0') + '-' + name + '.jpg',
        { type: 'image/jpeg', lastModified: Date.now() - i * 3600e3 });
      out.push(file);
    }
    return out;
  };
})();
