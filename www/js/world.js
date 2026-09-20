/* Run in the Garden - layered parallax garden world.
   Everything is procedurally drawn (no image assets): sky, sun, clouds,
   birds, hills, hedges, track-side props (trees, benches, fountain, lamps),
   flowers, butterflies and petals. */
(function () {
  'use strict';
  window.RG = window.RG || {};
  var U;

  function hash01(n) {
    var s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  }

  var World = {
    w: 400, h: 700, groundY: 560,
    clouds: [], birds: [], butterflies: [], petals: [],
    _birdTimer: 5, _t: 0,

    init: function () {
      U = RG.Utils;
      var i;
      for (i = 0; i < 5; i++) {
        this.clouds.push({ x: U.rand(0, 500), y: U.rand(30, 170), s: U.rand(0.7, 1.5), spd: U.rand(4, 10) });
      }
      for (i = 0; i < 4; i++) {
        this.butterflies.push(this._newButterfly(true));
      }
      for (i = 0; i < 9; i++) {
        this.petals.push({
          x: U.rand(0, 440), y: U.rand(-400, 650),
          vy: U.rand(26, 52), sway: U.rand(0, 6.28),
          rot: U.rand(0, 6.28), vr: U.rand(-2, 2),
          c: U.pick(['#FFB7C5', '#FFD1DC', '#FFE3EA', '#F9C0D0'])
        });
      }
    },

    _newButterfly: function (anywhere) {
      return {
        x: anywhere ? U.rand(0, 400) : 420,
        y: U.rand(this.groundY - 240, this.groundY - 40),
        vx: U.rand(-46, -24),
        ph: U.rand(0, 6.28),
        c1: U.pick(['#FF8AC2', '#FFC93C', '#8FD9FF', '#C79BFF']),
        c2: U.pick(['#5AC8FA', '#FF8A3D', '#F25555', '#57B85A'])
      };
    },

    resize: function (w, h, groundY) {
      this.w = w; this.h = h; this.groundY = groundY;
      this._sky = null;
    },

    /* ------------------------------- update ------------------------------- */
    update: function (dt, speed, active) {
      this._t += dt;
      var i, p;
      var drift = (active ? speed : 40);

      for (i = 0; i < this.clouds.length; i++) {
        p = this.clouds[i];
        p.x -= (p.spd + drift * 0.045) * dt;
        if (p.x < -110) { p.x = this.w + U.rand(30, 140); p.y = U.rand(30, 170); }
      }

      // birds occasionally crossing the sky
      this._birdTimer -= dt;
      if (this._birdTimer <= 0) {
        this._birdTimer = U.rand(7, 15);
        var n = U.randi(1, 3);
        for (i = 0; i < n; i++) {
          this.birds.push({ x: this.w + 30 + i * 26, y: U.rand(40, this.groundY * 0.32), vx: U.rand(-72, -46), ph: U.rand(0, 6.28) });
        }
      }
      for (i = this.birds.length - 1; i >= 0; i--) {
        p = this.birds[i];
        p.x += p.vx * dt;
        p.y += Math.sin(this._t * 3 + p.ph) * 8 * dt;
        if (p.x < -60) this.birds.splice(i, 1);
      }

      // butterflies flutter around the track
      for (i = 0; i < this.butterflies.length; i++) {
        p = this.butterflies[i];
        p.ph += dt * 6;
        p.x += p.vx * dt;
        p.y += Math.sin(p.ph) * 34 * dt;
        if (p.x < -30) this.butterflies[i] = this._newButterfly(false);
      }

      // falling petals
      for (i = 0; i < this.petals.length; i++) {
        p = this.petals[i];
        p.sway += dt * 2.2;
        p.rot += p.vr * dt;
        p.x += Math.sin(p.sway) * 18 * dt - drift * 0.18 * dt;
        p.y += p.vy * dt;
        if (p.y > this.h + 20 || p.x < -30) {
          p.x = U.rand(0, this.w + 60); p.y = U.rand(-80, -10);
        }
      }
    },

    /* ------------------------------- render ------------------------------- */
    render: function (ctx, cam) {
      this._skyFill(ctx, cam);
      this._sun(ctx);
      this._clouds(ctx);
      this._birds(ctx);
      this._hills(ctx, cam);
      this._hedge(ctx, cam);
      this._ground(ctx, cam);
      this._trackProps(ctx, cam);
      this._trackFlowers(ctx, cam);
      this._petals(ctx);
    },

    renderFront: function (ctx, cam) {
      this._butterflies(ctx, cam);
      this._foreground(ctx, cam);
    },

    _skyFill: function (ctx, cam) {
      if (!this._sky) {
        var g = ctx.createLinearGradient(0, 0, 0, this.groundY);
        g.addColorStop(0, '#6FC3F7');
        g.addColorStop(0.55, '#A5E3FF');
        g.addColorStop(1, '#D8F9E0');
        this._sky = g;
      }
      ctx.fillStyle = this._sky;
      ctx.fillRect(0, 0, this.w, this.groundY + 2);
    },

    _sun: function (ctx) {
      var x = 66, y = 72, r = 30;
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
        this._cloud(ctx, this.clouds[i].x, this.clouds[i].y, this.clouds[i].s);
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
        var f = Math.sin(this._t * 9 + b.ph) * 4;
        ctx.beginPath();
        ctx.moveTo(b.x - 7, b.y - f * 0.4);
        ctx.quadraticCurveTo(b.x - 3, b.y - 4 - f, b.x, b.y);
        ctx.quadraticCurveTo(b.x + 3, b.y - 4 - f, b.x + 7, b.y - f * 0.4);
        ctx.stroke();
      }
    },

    _hills: function (ctx, cam) {
      var off = cam.dist * 0.18;
      // far hills
      ctx.fillStyle = '#BCE8A8';
      this._hillRange(ctx, off * 0.55, this.groundY - 96, 240, 46);
      // near hills with far trees
      ctx.fillStyle = '#9FDd8F'.toLowerCase();
      this._hillRange(ctx, off, this.groundY - 58, 200, 40);
      this._farTrees(ctx, cam, off);
    },

    _hillRange: function (ctx, off, baseY, wl, amp) {
      ctx.beginPath();
      ctx.moveTo(0, baseY + amp + 60);
      var x, y;
      for (x = -40; x <= this.w + 40; x += 10) {
        var wx = x + off;
        y = baseY + Math.sin(wx / wl * 6.283) * amp * 0.5 + Math.sin(wx / (wl * 0.37) + 2) * amp * 0.22;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(this.w + 40, baseY + amp + 60);
      ctx.closePath();
      ctx.fill();
    },

    _farTrees: function (ctx, cam, off) {
      var spacing = 64, baseY = this.groundY - 52;
      var start = Math.floor((off - 60) / spacing);
      var end = Math.ceil((off + this.w + 60) / spacing);
      for (var n = start; n <= end; n++) {
        var r = hash01(n);
        if (r < 0.18) continue;
        var x = n * spacing - off + (hash01(n * 3) * 30 - 15);
        var s = 0.55 + hash01(n * 7) * 0.5;
        ctx.fillStyle = r > 0.5 ? '#6FBF62' : '#5FAF57';
        this._treeShape(ctx, x, baseY + 6, s * 0.8, true);
      }
    },

    /* continuous garden hedge with picket accents (mid layer) */
    _hedge: function (ctx, cam) {
      var off = cam.dist * 0.42;
      var baseY = this.groundY - 6;
      ctx.fillStyle = '#4E9E52';
      var spacing = 34;
      var start = Math.floor((off - 40) / spacing);
      var end = Math.ceil((off + this.w + 40) / spacing);
      for (var n = start; n <= end; n++) {
        var x = n * spacing - off;
        var s = 0.9 + hash01(n * 13) * 0.35;
        ctx.beginPath();
        ctx.arc(x, baseY - 10 * s, 15 * s, Math.PI, 0);
        ctx.arc(x + 15 * s, baseY - 14 * s, 13 * s, Math.PI, 0);
        ctx.arc(x - 15 * s, baseY - 12 * s, 12 * s, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(x - 20 * s, baseY - 11 * s, 40 * s, 12 * s);
      }
      // fence pickets peeking above hedge occasionally
      ctx.fillStyle = '#E8D9B8';
      var psp = 150;
      var pstart = Math.floor((off - 40) / psp);
      var pend = Math.ceil((off + this.w + 40) / psp);
      for (var m = pstart; m <= pend; m++) {
        if (hash01(m * 29) < 0.35) continue;
        var px = m * psp - off;
        ctx.fillRect(px - 2, baseY - 40, 4, 26);
        ctx.fillRect(px + 10, baseY - 40, 4, 26);
        ctx.fillRect(px - 6, baseY - 34, 24, 4);
      }
    },

    _ground: function (ctx, cam) {
      var gy = this.groundY;
      var g = ctx.createLinearGradient(0, gy, 0, this.h);
      g.addColorStop(0, '#8ED67E');
      g.addColorStop(1, '#5FB35C');
      ctx.fillStyle = g;
      ctx.fillRect(0, gy, this.w, this.h - gy);

      // mowed stripes scrolling with the track
      var stripe = 46;
      var off = cam.dist % (stripe * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.055)';
      for (var x = -off; x < this.w + stripe; x += stripe * 2) {
        ctx.fillRect(x, gy, stripe, this.h - gy);
      }

      // back edge of the track: darker rim
      ctx.fillStyle = 'rgba(38,92,40,0.30)';
      ctx.fillRect(0, gy, this.w, 5);

      // lane divider hints (dotted, scrolling)
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      var dashOff = (cam.dist * 1.0) % 56;
      for (var i = 0; i < 2; i++) {
        var lx = this.w * (i + 1) / 3;
        for (var y = gy + 16 - 0; y < this.h - 8; y += 56) {
          ctx.beginPath();
          ctx.arc(lx + Math.sin((y + cam.dist) * 0.02) * 1.5, y - dashOff * 0, 2.2, 0, 6.283);
          ctx.fill();
        }
      }
    },

    /* big props standing just behind the track (1:1 parallax) */
    _trackProps: function (ctx, cam) {
      var off = cam.dist;
      var spacing = 130;
      var start = Math.floor((off - 120) / spacing);
      var end = Math.ceil((off + this.w + 120) / spacing);
      for (var n = start; n <= end; n++) {
        var r = hash01(n * 1.7);
        var x = n * spacing - off + (hash01(n * 5.1) * 46 - 23);
        var baseY = this.groundY + 8;
        var s = 0.85 + hash01(n * 9.3) * 0.4;
        if (r < 0.26) {
          this._tree(ctx, x, baseY, s);
        } else if (r < 0.44) {
          this._bushBig(ctx, x, baseY, s);
        } else if (r < 0.58) {
          this._bench(ctx, x, baseY, s);
        } else if (r < 0.68) {
          this._lamp(ctx, x, baseY, s);
        } else if (r < 0.74) {
          this._fountain(ctx, x, baseY, s);
        } else if (r < 0.82) {
          this._signpost(ctx, x, baseY, s);
        }
        // else: leave a breather gap
      }
    },

    _trackFlowers: function (ctx, cam) {
      var off = cam.dist * 1.0;
      var spacing = 30;
      var start = Math.floor((off - 30) / spacing);
      var end = Math.ceil((off + this.w + 30) / spacing);
      for (var n = start; n <= end; n++) {
        var r = hash01(n * 11.3);
        if (r < 0.25) continue;
        var x = n * spacing - off + (hash01(n * 3.7) * 22 - 11);
        var gy = this.groundY + 3;
        this._flower(ctx, x, gy, 0.55 + hash01(n * 17) * 0.5,
          ['#FF8AC2', '#FFC93C', '#FF7A6E', '#C79BFF', '#FFF3A8'][Math.floor(r * 5) % 5]);
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

    /* big blurred grass tufts at the very front (parallax > 1) */
    _foreground: function (ctx, cam) {
      var off = cam.dist * 1.22;
      var spacing = 72;
      ctx.globalAlpha = 0.65;
      var start = Math.floor((off - 100) / spacing);
      var end = Math.ceil((off + this.w + 100) / spacing);
      for (var n = start; n <= end; n++) {
        var r = hash01(n * 23.7);
        if (r < 0.3) continue;
        var x = n * spacing - off;
        var y = this.h + 6;
        ctx.fillStyle = '#4E9E52';
        this._tuft(ctx, x, y, 1.1 + r * 0.9);
        if (r > 0.75) {
          this._flower(ctx, x + 14, y - 26, 0.9,
            ['#FF8AC2', '#FFC93C', '#FF7A6E'][Math.floor(r * 3) % 3]);
        }
      }
      ctx.globalAlpha = 1;
    },

    /* ------------------------- prop drawing helpers ------------------------- */
    _treeShape: function (ctx, x, baseY, s, far) {
      ctx.fillStyle = far ? '#8A6B4F' : '#8A6B4F';
      ctx.fillRect(x - 3.5 * s, baseY - 34 * s, 7 * s, 34 * s);
      ctx.beginPath();
      ctx.arc(x, baseY - 46 * s, 17 * s, 0, 6.283);
      ctx.arc(x - 12 * s, baseY - 36 * s, 12 * s, 0, 6.283);
      ctx.arc(x + 12 * s, baseY - 36 * s, 12 * s, 0, 6.283);
      ctx.fill();
    },

    _tree: function (ctx, x, baseY, s) {
      ctx.save();
      ctx.translate(x, baseY);
      var sway = Math.sin(this._t * 1.1 + x * 0.05) * 0.02;
      ctx.rotate(sway);
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
      // berries
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
      ctx.fillRect(-22 * s, -22 * s, 44 * s, 6 * s);          // seat
      ctx.fillRect(-22 * s, -40 * s, 44 * s, 5 * s);          // back
      ctx.fillRect(-22 * s, -40 * s, 4 * s, 40 * s);          // posts
      ctx.fillRect(18 * s, -40 * s, 4 * s, 40 * s);
      ctx.fillRect(-20 * s, -16 * s, 4 * s, 16 * s);          // legs
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
      ctx.beginPath();
      ctx.arc(-6 * s, -36 * s - sp * 0.6, 2.6 * s, 0, 6.283); ctx.fill();
      ctx.beginPath();
      ctx.arc(6 * s, -36 * s - sp * 0.6, 2.6 * s, 0, 6.283); ctx.fill();
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
