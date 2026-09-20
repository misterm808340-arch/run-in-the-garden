/* Run in the Garden - FORWARD 3D garden world (Subway-Surfers style).
   The camera sits behind the bunny looking down a garden path that
   recedes to the horizon. Everything is procedural (no image assets).
   Projection: scale(z) = camD / (camD + z)  - z in [0 .. zFar]. */
(function () {
  'use strict';
  window.RG = window.RG || {};
  var U;

  function hash01(n) {
    var s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  }

  var World = {
    w: 400, h: 700, horizonY: 252, baseY: 560,
    clouds: [], birds: [], butterflies: [], petals: [],
    _birdTimer: 5, _t: 0, camDist: 0,

    init: function () {
      U = RG.Utils;
      var i;
      for (i = 0; i < 5; i++) {
        this.clouds.push({ x: U.rand(0, 500), y: U.rand(24, 120), s: U.rand(0.7, 1.4), spd: U.rand(4, 9) });
      }
      for (i = 0; i < 4; i++) {
        this.butterflies.push(this._newButterfly(true));
      }
      for (i = 0; i < 9; i++) {
        this.petals.push({
          x: U.rand(0, 440), y: U.rand(-400, 700),
          vy: U.rand(26, 52), sway: U.rand(0, 6.28),
          rot: U.rand(0, 6.28), vr: U.rand(-2, 2),
          c: U.pick(['#FFB7C5', '#FFD1DC', '#FFE3EA', '#F9C0D0'])
        });
      }
    },

    _newButterfly: function (anywhere) {
      return {
        x: anywhere ? U.rand(0, 400) : 420,
        y: U.rand(this.horizonY + 30, this.baseY - 90),
        vx: U.rand(-46, -24),
        ph: U.rand(0, 6.28),
        c1: U.pick(['#FF8AC2', '#FFC93C', '#8FD9FF', '#C79BFF']),
        c2: U.pick(['#5AC8FA', '#FF8A3D', '#F25555', '#57B85A'])
      };
    },

    resize: function (w, h, horizonY, baseY) {
      this.w = w; this.h = h;
      this.horizonY = horizonY; this.baseY = baseY;
      this._sky = null;
    },

    /* ------------------------------ update ------------------------------ */
    update: function (dt, speed, active, trackPos) {
      this._t += dt;
      this.camDist = trackPos || 0;
      var i, p;
      var drift = (active ? speed : 40);

      for (i = 0; i < this.clouds.length; i++) {
        p = this.clouds[i];
        p.x -= (p.spd + drift * 0.02) * dt;
        if (p.x < -110) { p.x = this.w + U.rand(30, 140); p.y = U.rand(24, 120); }
      }

      // birds occasionally crossing the sky
      this._birdTimer -= dt;
      if (this._birdTimer <= 0) {
        this._birdTimer = U.rand(7, 15);
        var n = U.randi(1, 3);
        for (i = 0; i < n; i++) {
          this.birds.push({ x: this.w + 30 + i * 26, y: U.rand(24, this.horizonY * 0.55), vx: U.rand(-72, -46), ph: U.rand(0, 6.28) });
        }
      }
      for (i = this.birds.length - 1; i >= 0; i--) {
        p = this.birds[i];
        p.x += p.vx * dt;
        p.y += Math.sin(this._t * 3 + p.ph) * 8 * dt;
        if (p.x < -60) this.birds.splice(i, 1);
      }

      // butterflies flutter around the path
      for (i = 0; i < this.butterflies.length; i++) {
        p = this.butterflies[i];
        p.ph += dt * 6;
        p.x += p.vx * dt;
        p.y += Math.sin(p.ph) * 30 * dt;
        if (p.x < -30) this.butterflies[i] = this._newButterfly(false);
        if (p.y < this.horizonY + 16) p.y = this.horizonY + 16;
      }

      // falling petals drift toward the camera
      for (i = 0; i < this.petals.length; i++) {
        p = this.petals[i];
        p.sway += dt * 2.2;
        p.rot += p.vr * dt;
        p.x += Math.sin(p.sway) * 18 * dt;
        p.y += (p.vy + drift * 0.10) * dt;
        if (p.y > this.h + 20 || p.x < -30) {
          p.x = U.rand(0, this.w + 60); p.y = U.rand(-80, -10);
        }
      }
    },

    /* --------------------------- projection ----------------------------- */
    scaleAt: function (z, camD) { return camD / (camD + Math.max(z, 0)); },

    /* ------------------------------- render ----------------------------- */
    render: function (ctx, cam) {
      var V = cam; // {w,h,horizonY,baseY,laneSpan,trackHalfW,dist,cx,camD}
      this._skyFill(ctx, V);
      this._sun(ctx);
      this._clouds(ctx);
      this._birds(ctx);
      this._hills(ctx, V);
      this._ground(ctx, V);
      this._track(ctx, V);
      this._trackProps(ctx, V);
      this._trackFlowers(ctx, V);
      this._petals(ctx);
    },

    renderFront: function (ctx, cam) {
      this._butterflies(ctx, cam);
      this._cornerTufts(ctx);
    },

    _skyFill: function (ctx, V) {
      var hy = V.horizonY;
      if (!this._sky) {
        var g = ctx.createLinearGradient(0, 0, 0, hy);
        g.addColorStop(0, '#6FC3F7');
        g.addColorStop(0.6, '#A5E3FF');
        g.addColorStop(1, '#D8F9E0');
        this._sky = g;
      }
      ctx.fillStyle = this._sky;
      ctx.fillRect(0, 0, this.w, hy + 2);
    },

    _sun: function (ctx) {
      var x = 60, y = 64, r = 28;
      var g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.6);
      g.addColorStop(0, 'rgba(255,236,140,0.9)');
      g.addColorStop(1, 'rgba(255,236,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, 6.283); ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this._t * 0.15);
      ctx.fillStyle = 'rgba(255,225,110,0.85)';
      for (var i = 0; i < 8; i++) {
        ctx.rotate(0.785);
        ctx.beginPath();
        ctx.moveTo(r + 6, -4); ctx.lineTo(r + 16, 0); ctx.lineTo(r + 6, 4);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = '#FFE45C';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#FFF3A8';
      ctx.beginPath(); ctx.arc(x - 6, y - 7, r * 0.55, 0, 6.283); ctx.fill();
    },

    _clouds: function (ctx) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      for (var i = 0; i < this.clouds.length; i++) {
        var c = this.clouds[i];
        if (c.y > this.horizonY - 20) continue;
        this._cloud(ctx, c.x, c.y, c.s);
      }
    },

    _cloud: function (ctx, x, y, s) {
      ctx.beginPath();
      ctx.arc(x, y, 16 * s, 0, 6.283);
      ctx.arc(x + 18 * s, y - 8 * s, 20 * s, 0, 6.283);
      ctx.arc(x + 40 * s, y, 16 * s, 0, 6.283);
      ctx.arc(x + 20 * s, y + 8 * s, 18 * s, 0, 6.283);
      ctx.fill();
    },

    _birds: function (ctx) {
      ctx.strokeStyle = '#4A6B78';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      for (var i = 0; i < this.birds.length; i++) {
        var b = this.birds[i];
        if (b.y > this.horizonY - 10) continue;
        var f = Math.sin(this._t * 9 + b.ph) * 4;
        ctx.beginPath();
        ctx.moveTo(b.x - 7, b.y - f * 0.4);
        ctx.quadraticCurveTo(b.x - 3, b.y - 4 - f, b.x, b.y);
        ctx.quadraticCurveTo(b.x + 3, b.y - 4 - f, b.x + 7, b.y - f * 0.4);
        ctx.stroke();
      }
    },

    /* distant hills + far trees sitting ON the horizon */
    _hills: function (ctx, V) {
      var off = V.dist * 0.02;
      var hy = V.horizonY;
      // far hill range
      ctx.fillStyle = '#BCE8A8';
      this._hillRange(ctx, off * 0.5, hy, 300, 30);
      // near hill range
      ctx.fillStyle = '#9FDD8F';
      this._hillRange(ctx, off, hy, 210, 20);
      // far tree line
      ctx.fillStyle = '#6FBF62';
      var spacing = 30;
      var start = Math.floor((off - 40) / spacing);
      var end = Math.ceil((off + this.w + 40) / spacing);
      for (var n = start; n <= end; n++) {
        var r = hash01(n * 3.3);
        if (r < 0.2) continue;
        var x = n * spacing - off;
        var s = 0.4 + hash01(n * 9.1) * 0.5;
        this._farTree(ctx, x, hy + 2, s);
      }
      // hedge bumps along the horizon
      ctx.fillStyle = '#4E9E52';
      var hsp = 17;
      var hs = Math.floor((off - 30) / hsp);
      var he = Math.ceil((off + this.w + 30) / hsp);
      for (var m = hs; m <= he; m++) {
        var hb = 3 + hash01(m * 5.7) * 4;
        ctx.beginPath();
        ctx.arc(m * hsp - off, hy + 1, hb, Math.PI, 0);
        ctx.fill();
      }
    },

    _farTree: function (ctx, x, baseY, s) {
      ctx.fillRect(x - 1.6 * s, baseY - 14 * s, 3.2 * s, 14 * s);
      ctx.beginPath();
      ctx.arc(x, baseY - 18 * s, 7 * s, 0, 6.283);
      ctx.fill();
    },

    _hillRange: function (ctx, off, baseY, wl, amp) {
      ctx.beginPath();
      ctx.moveTo(-20, baseY + 2);
      var x, y;
      for (x = -20; x <= this.w + 20; x += 14) {
        var wx = x + off;
        y = baseY - amp * (0.5 + 0.5 * Math.sin(wx / wl * 6.283)) - Math.sin(wx / (wl * 0.37) + 2) * amp * 0.2;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(this.w + 20, baseY + 2);
      ctx.closePath();
      ctx.fill();
    },

    /* grass ground plane with converging mow bands */
    _ground: function (ctx, V) {
      var hy = V.horizonY;
      var g = ctx.createLinearGradient(0, hy, 0, this.h);
      g.addColorStop(0, '#9BDD88');
      g.addColorStop(0.35, '#7CC96C');
      g.addColorStop(1, '#5FB35C');
      ctx.fillStyle = g;
      ctx.fillRect(0, hy, this.w, this.h - hy);

      // perspective mow bands moving toward the camera
      var spacing = 22;
      var tPos = V.dist;
      var m0 = Math.floor(tPos / spacing);
      var m1 = Math.ceil((tPos + 130) / spacing);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (var m = m0; m <= m1; m++) {
        if (m % 2 !== 0) continue;
        var z0 = m * spacing - tPos;
        var z1 = z0 + spacing;
        if (z1 <= 0) continue;
        var yN = this._yAt(Math.max(z0, 0), V);
        var yF = this._yAt(z1, V);
        ctx.fillRect(0, yF, this.w, yN - yF + 1);
      }

      // horizon rim
      ctx.fillStyle = 'rgba(38,92,40,0.35)';
      ctx.fillRect(0, hy, this.w, 3);
    },

    _yAt: function (z, V) {
      var s = this.scaleAt(z, V.camD);
      return V.horizonY + (V.baseY - V.horizonY) * s;
    },

    /* the garden path: trapezoid + moving stripes + lane dashes */
    _track: function (ctx, V) {
      var cx = V.cx, hy = V.horizonY, by = V.baseY;
      var hwN = V.trackHalfW * this.scaleAt(V.zFar, V.camD);
      var hwP = V.trackHalfW;

      // trapezoid
      var g = ctx.createLinearGradient(0, hy, 0, by);
      g.addColorStop(0, '#D9C49B');
      g.addColorStop(0.5, '#E4D0A8');
      g.addColorStop(1, '#EADCB8');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - hwP, by);
      ctx.lineTo(cx - hwN, hy);
      ctx.lineTo(cx + hwN, hy);
      ctx.lineTo(cx + hwP, by);
      ctx.closePath();
      ctx.fill();

      // soft edges
      ctx.strokeStyle = 'rgba(122,92,66,0.55)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - hwP, by); ctx.lineTo(cx - hwN, hy);
      ctx.moveTo(cx + hwP, by); ctx.lineTo(cx + hwN, hy);
      ctx.stroke();

      // transverse stripes sweeping toward the player
      var spacing = 14;
      var tPos = V.dist;
      var m0 = Math.floor(tPos / spacing);
      var m1 = Math.ceil((tPos + V.zFar) / spacing);
      for (var m = m0; m <= m1; m++) {
        var z = m * spacing - tPos;
        if (z <= 0) continue;
        var s = this.scaleAt(z, V.camD);
        var y = hy + (by - hy) * s;
        var half = hwP * s;
        ctx.strokeStyle = 'rgba(122,92,66,' + (0.30 * s + 0.05) + ')';
        ctx.lineWidth = Math.max(1, 3.2 * s);
        ctx.beginPath();
        ctx.moveTo(cx - half, y);
        ctx.lineTo(cx + half, y);
        ctx.stroke();
      }

      // lane divider dashes at lat = -0.5 and +0.5
      var dashSeg = 10;
      var phase = tPos % (dashSeg * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (var d = -1; d <= 1; d += 2) {
        var lat = d * 0.5;
        var k0 = Math.floor((tPos - phase) / dashSeg);
        var k1 = Math.ceil((tPos + V.zFar) / dashSeg);
        for (var k = k0; k <= k1; k++) {
          if (k % 2 !== 0) continue;
          var zA = Math.max(k * dashSeg - tPos + phase * 0, 0);
          // dash spans zA .. zA + dashSeg
          var sA = this.scaleAt(zA, V.camD);
          var sB = this.scaleAt(zA + dashSeg, V.camD);
          var yA = hy + (by - hy) * sA;
          var yB = hy + (by - hy) * sB;
          var xA = cx + lat * V.laneSpan * sA;
          var xB = cx + lat * V.laneSpan * sB;
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.18 + 0.35 * sA) + ')';
          ctx.lineWidth = Math.max(1, 4.5 * sA);
          ctx.beginPath();
          ctx.moveTo(xA, yA);
          ctx.lineTo(xB, yB);
          ctx.stroke();
        }
      }
    },

    /* big props on both sides of the path (z-sorted, far -> near) */
    _trackProps: function (ctx, V) {
      var spacing = 26;
      var tPos = V.dist;
      var n0 = Math.ceil(tPos / spacing);
      var n1 = Math.floor((tPos + V.zFar) / spacing);
      var list = [];
      for (var n = n0; n <= n1; n++) {
        var r = hash01(n * 1.7);
        if (r > 0.78) continue; // breather gaps
        var z = n * spacing - tPos;
        var side = hash01(n * 3.1) < 0.5 ? -1 : 1;
        var lat = side * (1.9 + hash01(n * 7.7) * 1.5); // beyond track edge
        var kind =
          r < 0.09 ? 'tree' :
          r < 0.17 ? 'bushBig' :
          r < 0.23 ? 'bench' :
          r < 0.29 ? 'lamp' :
          r < 0.335 ? 'fountain' :
          r < 0.38 ? 'signpost' : 'tree';
        list.push({ z: z, lat: lat, kind: kind, s: 0.8 + hash01(n * 9.3) * 0.45, n: n });
      }
      list.sort(function (a, b) { return b.z - a.z; }); // far first
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var s = this.scaleAt(p.z, V.camD) * p.s * 1.5;
        if (s < 0.02) continue;
        var x = V.cx + p.lat * V.laneSpan * this.scaleAt(p.z, V.camD);
        var y = this._yAt(p.z, V);
        var sway = Math.sin(this._t * 1.1 + p.n * 0.7) * 0.02;
        switch (p.kind) {
          case 'tree': this._tree(ctx, x, y, s, sway); break;
          case 'bushBig': this._bushBig(ctx, x, y, s); break;
          case 'bench': this._bench(ctx, x, y, s); break;
          case 'lamp': this._lamp(ctx, x, y, s); break;
          case 'fountain': this._fountain(ctx, x, y, s); break;
          case 'signpost': this._signpost(ctx, x, y, s); break;
        }
      }
    },

    _trackFlowers: function (ctx, V) {
      var spacing = 13;
      var tPos = V.dist;
      var n0 = Math.ceil(tPos / spacing);
      var n1 = Math.floor((tPos + 70) / spacing); // only near flowers (perf)
      var list = [];
      for (var n = n0; n <= n1; n++) {
        var r = hash01(n * 11.3);
        if (r < 0.3) continue;
        var z = n * spacing - tPos;
        var side = hash01(n * 13.9) < 0.5 ? -1 : 1;
        var lat = side * (1.25 + hash01(n * 17.1) * 0.5);
        list.push({ z: z, lat: lat, c: ['#FF8AC2', '#FFC93C', '#FF7A6E', '#C79BFF', '#FFF3A8'][Math.floor(r * 5) % 5], s: 0.7 + hash01(n * 19.3) * 0.5 });
      }
      list.sort(function (a, b) { return b.z - a.z; });
      for (var i = 0; i < list.length; i++) {
        var f = list[i];
        var s = this.scaleAt(f.z, V.camD) * f.s * 1.3;
        if (s < 0.025) continue;
        var x = V.cx + f.lat * V.laneSpan * this.scaleAt(f.z, V.camD);
        var y = this._yAt(f.z, V);
        this._flower(ctx, x, y, s, f.c);
      }
    },

    _petals: function (ctx) {
      for (var i = 0; i < this.petals.length; i++) {
        var p = this.petals[i];
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(0, 0, 5.5, 3, 0, 0, 6.283);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },

    _butterflies: function (ctx, cam) {
      for (var i = 0; i < this.butterflies.length; i++) {
        var b = this.butterflies[i];
        var flap = Math.sin(b.ph * 2.2) * 0.7;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.sin(b.ph * 0.7) * 0.18);
        ctx.fillStyle = b.c1;
        ctx.beginPath();
        ctx.ellipse(-4.5, 0, 5, 7 * (0.35 + Math.abs(flap) * 0.65), -0.5 + flap * 0.25, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = b.c2;
        ctx.beginPath();
        ctx.ellipse(4.5, 0, 5, 7 * (0.35 + Math.abs(flap) * 0.65), 0.5 - flap * 0.25, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = '#4A3B2A';
        ctx.beginPath(); ctx.ellipse(0, 0, 1.6, 4.5, 0, 0, 6.283); ctx.fill();
        ctx.restore();
      }
    },

    /* soft grass silhouettes in the bottom corners (depth framing) */
    _cornerTufts: function (ctx) {
      ctx.fillStyle = '#3F8A44';
      ctx.globalAlpha = 0.8;
      var sway = Math.sin(this._t * 1.3) * 3;
      this._tuft(ctx, -6 + sway, this.h + 8, 2.4);
      this._tuft(ctx, this.w + 6 - sway, this.h + 8, 2.6);
      ctx.fillStyle = '#4E9E52';
      this._tuft(ctx, 16 + sway * 0.6, this.h + 10, 1.8);
      this._tuft(ctx, this.w - 16 - sway * 0.6, this.h + 10, 2.0);
      ctx.globalAlpha = 1;
    },

    /* ------------------------- prop drawing helpers ------------------------- */
    _tree: function (ctx, x, baseY, s, sway) {
      ctx.save();
      ctx.translate(x, baseY);
      ctx.rotate(sway || 0);
      ctx.fillStyle = '#7A5C42';
      ctx.beginPath();
      ctx.moveTo(-5 * s, 0);
      ctx.lineTo(-3 * s, -40 * s);
      ctx.lineTo(3 * s, -40 * s);
      ctx.lineTo(5 * s, 0);
      ctx.closePath(); ctx.fill();
      var g = ctx.createRadialGradient(-6 * s, -58 * s, 4, 0, -52 * s, 34 * s);
      g.addColorStop(0, '#79C96B');
      g.addColorStop(1, '#4E9E52');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -58 * s, 22 * s, 0, 6.283);
      ctx.arc(-15 * s, -46 * s, 14 * s, 0, 6.283);
      ctx.arc(15 * s, -46 * s, 14 * s, 0, 6.283);
      ctx.arc(0, -42 * s, 16 * s, 0, 6.283);
      ctx.fill();
      ctx.restore();
    },

    _bushBig: function (ctx, x, baseY, s) {
      ctx.fillStyle = '#4E9E52';
      ctx.beginPath();
      ctx.arc(x - 14 * s, baseY - 12 * s, 14 * s, 0, 6.283);
      ctx.arc(x, baseY - 18 * s, 16 * s, 0, 6.283);
      ctx.arc(x + 14 * s, baseY - 12 * s, 14 * s, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = '#F25555';
      ctx.beginPath();
      ctx.arc(x - 10 * s, baseY - 16 * s, 2.4 * s, 0, 6.283);
      ctx.arc(x + 6 * s, baseY - 22 * s, 2.4 * s, 0, 6.283);
      ctx.fill();
    },

    _bench: function (ctx, x, baseY, s) {
      ctx.save();
      ctx.translate(x, baseY);
      ctx.fillStyle = '#B98A5A';
      ctx.fillRect(-22 * s, -22 * s, 44 * s, 6 * s);
      ctx.fillRect(-22 * s, -40 * s, 44 * s, 5 * s);
      ctx.fillRect(-22 * s, -40 * s, 4 * s, 40 * s);
      ctx.fillRect(18 * s, -40 * s, 4 * s, 40 * s);
      ctx.fillRect(-20 * s, -16 * s, 4 * s, 16 * s);
      ctx.fillRect(16 * s, -16 * s, 4 * s, 16 * s);
      ctx.restore();
    },

    _lamp: function (ctx, x, baseY, s) {
      ctx.save();
      ctx.translate(x, baseY);
      ctx.fillStyle = '#5E6B5A';
      ctx.fillRect(-2.5 * s, -54 * s, 5 * s, 54 * s);
      ctx.fillStyle = '#FFE45C';
      ctx.beginPath();
      ctx.arc(0, -58 * s, 7 * s, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#5E6B5A';
      ctx.beginPath();
      ctx.arc(0, -66 * s, 6 * s, Math.PI, 0); ctx.fill();
      ctx.restore();
    },

    _fountain: function (ctx, x, baseY, s) {
      ctx.save();
      ctx.translate(x, baseY);
      ctx.fillStyle = '#9FB8C8';
      ctx.beginPath(); ctx.ellipse(0, -4 * s, 26 * s, 8 * s, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#B9D2E0';
      ctx.fillRect(-24 * s, -10 * s, 48 * s, 7 * s);
      ctx.fillStyle = '#8FC6E8';
      ctx.beginPath(); ctx.ellipse(0, -9 * s, 21 * s, 5.5 * s, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#C9D8E2';
      ctx.fillRect(-4 * s, -34 * s, 8 * s, 26 * s);
      var sp = (Math.sin(this._t * 3) + 1) * 3 * s;
      ctx.fillStyle = 'rgba(200,235,255,0.9)';
      ctx.beginPath();
      ctx.arc(0, -40 * s - sp, 4.5 * s, 0, 6.283); ctx.fill();
      ctx.restore();
    },

    _signpost: function (ctx, x, baseY, s) {
      ctx.save();
      ctx.translate(x, baseY);
      ctx.fillStyle = '#B98A5A';
      ctx.fillRect(-2.5 * s, -44 * s, 5 * s, 44 * s);
      ctx.fillStyle = '#E8D9B8';
      ctx.beginPath();
      ctx.moveTo(-16 * s, -44 * s);
      ctx.lineTo(14 * s, -44 * s);
      ctx.lineTo(18 * s, -37 * s);
      ctx.lineTo(14 * s, -30 * s);
      ctx.lineTo(-16 * s, -30 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8A6B4F';
      ctx.fillRect(-10 * s, -40 * s, 18 * s, 3 * s);
      ctx.fillRect(-10 * s, -34 * s, 12 * s, 3 * s);
      ctx.restore();
    },

    _tuft: function (ctx, x, baseY, s) {
      ctx.beginPath();
      for (var i = -2; i <= 2; i++) {
        ctx.moveTo(x + i * 5 * s, baseY);
        ctx.quadraticCurveTo(x + i * 7 * s, baseY - 16 * s, x + i * 9 * s, baseY - 26 * s);
        ctx.quadraticCurveTo(x + i * 6 * s, baseY - 14 * s, x + i * 3 * s, baseY);
      }
      ctx.fill();
    },

    /* single flower (reused by props, pots, foreground) */
    _flower: function (ctx, x, y, s, color) {
      ctx.fillStyle = '#4E9E52';
      ctx.fillRect(x - 1 * s, y - 14 * s, 2 * s, 14 * s);
      ctx.beginPath();
      ctx.ellipse(x + 4 * s, y - 7 * s, 3.4 * s, 1.8 * s, -0.5, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = color;
      var i, a;
      for (i = 0; i < 5; i++) {
        a = i / 5 * 6.283 + Math.sin(this._t * 0.8 + x) * 0.05;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * 4.2 * s, y - 16 * s + Math.sin(a) * 4.2 * s, 3 * s, 3 * s, a, 0, 6.283);
        ctx.fill();
      }
      ctx.fillStyle = '#FFE9A8';
      ctx.beginPath(); ctx.arc(x, y - 16 * s, 2.4 * s, 0, 6.283); ctx.fill();
    }
  };

  RG.World = World;
  RG.World.drawFlower = function (ctx, x, y, s, color) { World._flower(ctx, x, y, s, color); };
})();
