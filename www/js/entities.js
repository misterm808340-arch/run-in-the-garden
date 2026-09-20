/* Run in the Garden - track entities: obstacles, coins, stars, power-ups.
   Includes the distance-based fair pattern spawner, magnet attraction,
   pickup collection and all entity drawing (procedural). */
(function () {
  'use strict';
  window.RG = window.RG || {};
  var U, C;

  var Entities = {
    obstacles: [], pickups: [],
    nextSpawnAt: 0, nextDecorAt: 0, _t: 0,

    reset: function () {
      C = RG.Config; U = RG.Utils;
      this.obstacles.length = 0;
      this.pickups.length = 0;
      this.nextSpawnAt = C.spawn.firstDelayUnits;
      this._t = 0;
    },

    /* ============================ update ============================ */
    update: function (dt, view, speed, dist, magnetOn) {
      this._t += dt;
      var i, e;
      var mv = speed * dt;

      // move obstacles
      for (i = this.obstacles.length - 1; i >= 0; i--) {
        e = this.obstacles[i];
        e.x -= mv;
        if (e.x < -140) this.obstacles.splice(i, 1);
      }

      // move / attract / collect pickups
      var pcx = RG.Player.x, pcy = RG.Player.y - 30;
      for (i = this.pickups.length - 1; i >= 0; i--) {
        e = this.pickups[i];
        e.x -= mv;
        if (magnetOn && (e.kind === 'coin' || e.kind === 'star')) {
          var dx = pcx - e.x, dy = pcy - e.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < C.magnetRadius * C.magnetRadius) {
            var d = Math.sqrt(d2) || 1;
            e.x += dx / d * C.magnetPull * dt;
            e.y += dy / d * C.magnetPull * dt;
          }
        }
        if (e.x < -60) { this.pickups.splice(i, 1); continue; }
      }

      // spawning by distance
      if (dist >= this.nextSpawnAt) {
        this._spawnPattern(dist, view);
      }
    },

    /* =========================== spawning =========================== */
    _laneFree: function () { return U.randi(0, 2); },

    _spawnPattern: function (dist, view) {
      var sp = C.spawn;
      var S = view;
      var x0 = S.w + 80;
      var gapSec;

      if (U.chance(sp.powerupChance)) {
        this._spawnPowerup(x0, view);
        gapSec = U.rand(sp.gapMinSec, sp.gapMaxSec);
      } else {
        var r = Math.random();
        var hard = dist > sp.hardAfterDist;
        var fences = dist > sp.fenceAfterDist;
        var type;
        if (hard && fences) {
          type = U.weightedPick([
            { key: 'coinLine', weight: 2.0 },
            { key: 'single', weight: 3.2 },
            { key: 'jumpRow', weight: 2.0 },
            { key: 'twoWall', weight: 2.4 },
            { key: 'fenceWall', weight: 2.2 },
            { key: 'puddles', weight: 1.4 }
          ]);
        } else if (hard) {
          type = U.weightedPick([
            { key: 'coinLine', weight: 2.0 },
            { key: 'single', weight: 3.4 },
            { key: 'jumpRow', weight: 2.0 },
            { key: 'twoWall', weight: 2.2 },
            { key: 'puddles', weight: 1.4 }
          ]);
        } else {
          type = U.weightedPick([
            { key: 'coinLine', weight: 2.6 },
            { key: 'single', weight: 3.4 },
            { key: 'puddles', weight: 1.2 }
          ]);
        }

        switch (type) {
          case 'coinLine': this._coinLine(x0, view); break;
          case 'single': this._single(x0, view, dist); break;
          case 'jumpRow': this._jumpRow(x0, view); break;
          case 'twoWall': this._twoWall(x0, view); break;
          case 'fenceWall': this._fenceWall(x0, view); break;
          case 'puddles': this._puddles(x0, view); break;
        }
        gapSec = U.rand(sp.gapMinSec, sp.gapMaxSec);
        if (type === 'twoWall' || type === 'fenceWall' || type === 'jumpRow') {
          gapSec += sp.hardPatternExtraSec;
        }
      }
      this.nextSpawnAt = dist + Math.max(240, RG.Game.speedNow() * gapSec);
    },

    _obWeighted: function (allowFence) {
      var list = [], k;
      for (k in C.obstacles) {
        var o = C.obstacles[k];
        if (k === 'fence' && !allowFence) continue;
        list.push({ key: k, weight: o.weight });
      }
      return U.weightedPick(list);
    },

    _addObstacle: function (kind, lane, x, view) {
      var def = C.obstacles[kind];
      var bottom = view.trackY + view.laneDepthY[lane];
      this.obstacles.push({
        kind: kind, lane: lane,
        x: x, w: def.w, h: def.h,
        bottom: bottom,
        seed: Math.random() * 6.28
      });
    },

    _addCoin: function (x, y) {
      if (U.chance(C.spawn.starChance)) {
        this.pickups.push({ kind: 'star', x: x, y: y, r: C.starR, seed: Math.random() * 6.28 });
      } else {
        this.pickups.push({ kind: 'coin', x: x, y: y, r: C.coinR, seed: Math.random() * 6.28 });
      }
    },

    _coinLine: function (x0, view) {
      var lane = this._laneFree();
      var n = U.randi(5, 8);
      for (var i = 0; i < n; i++) {
        this._addCoin(x0 + i * 34, view.trackY + view.laneDepthY[lane] - 30 + Math.sin(i * 0.9) * 8);
      }
    },

    _coinArc: function (cx, lane, view) {
      var baseY = view.trackY + view.laneDepthY[lane];
      for (var i = 0; i < 7; i++) {
        var t = i / 6;
        var x = cx - 78 + t * 156;
        var y = baseY - 34 - Math.sin(t * Math.PI) * 96;
        this._addCoin(x, y);
      }
    },

    _single: function (x0, view, dist) {
      var lane = this._laneFree();
      var kind = this._obWeighted(false);
      this._addObstacle(kind, lane, x0, view);
      var def = C.obstacles[kind];
      if (def.lethal && U.chance(0.45)) {
        this._coinArc(x0, lane, view);
      } else if (U.chance(0.35)) {
        var l2 = (lane + U.randi(1, 2)) % 3;
        for (var i = 0; i < 4; i++) {
          this._addCoin(x0 + i * 34, view.trackY + view.laneDepthY[l2] - 30);
        }
      }
    },

    _jumpRow: function (x0, view) {
      var mid = this._laneFree();
      for (var l = 0; l < 3; l++) {
        var kind = l === mid ? 'rock' : U.pick(['rock', 'branch', 'bush']);
        this._addObstacle(kind, l, x0 + (l === 1 ? 0 : U.rand(-12, 12)), view);
      }
      this._coinArc(x0, mid, view);
    },

    _twoWall: function (x0, view) {
      var free = this._laneFree();
      for (var l = 0; l < 3; l++) {
        if (l === free) continue;
        this._addObstacle(this._obWeighted(false), l, x0 + U.rand(-10, 10), view);
      }
      if (U.chance(0.6)) {
        for (var i = 0; i < 4; i++) {
          this._addCoin(x0 + i * 34, view.trackY + view.laneDepthY[free] - 30);
        }
      }
    },

    _fenceWall: function (x0, view) {
      var free = this._laneFree();
      for (var l = 0; l < 3; l++) {
        if (l === free) continue;
        this._addObstacle('fence', l, x0, view);
      }
      for (var i = 0; i < 4; i++) {
        this._addCoin(x0 + 10 + i * 34, view.trackY + view.laneDepthY[free] - 30);
      }
    },

    _puddles: function (x0, view) {
      var lanes = [0, 1, 2];
      var skip = this._laneFree();
      for (var i = 0; i < lanes.length; i++) {
        if (lanes[i] === skip) continue;
        this._addObstacle('puddle', lanes[i], x0 + U.rand(-8, 8), view);
      }
      if (U.chance(0.5)) this._coinLine(x0 + 130, view);
    },

    _spawnPowerup: function (x0, view) {
      var lane = this._laneFree();
      var kind = U.pick(['shield', 'shield', 'magnet', 'boost', 'x2']);
      this.pickups.push({
        kind: 'pu', pu: kind, lane: lane,
        x: x0, y: view.trackY + view.laneDepthY[lane] - 64,
        r: 24, seed: Math.random() * 6.28
      });
    },

    /* =========================== collisions =========================== */
    /* returns first obstacle overlapping the player box, or null */
    hitObstacle: function (pbox) {
      for (var i = 0; i < this.obstacles.length; i++) {
        var o = this.obstacles[i];
        var oy = o.bottom - o.h;
        if (U.hit(pbox.x, pbox.y, pbox.w, pbox.h, o.x - o.w / 2, oy, o.w, o.h, 5, 4)) {
          return o;
        }
      }
      return null;
    },

    removeObstacle: function (o) {
      var i = this.obstacles.indexOf(o);
      if (i >= 0) this.obstacles.splice(i, 1);
    },

    clearAhead: function (view) {
      // used on revive: wipe a safe corridor
      var i;
      for (i = this.obstacles.length - 1; i >= 0; i--) {
        if (this.obstacles[i].x < view.w + 260) {
          RG.Particles.poof(this.obstacles[i].x, this.obstacles[i].bottom - 20);
          this.obstacles.splice(i, 1);
        }
      }
      for (i = this.pickups.length - 1; i >= 0; i--) {
        if (this.pickups[i].kind === 'pu' && this.pickups[i].x < view.w + 260) {
          this.pickups.splice(i, 1);
        }
      }
    },

    /* returns list of collected pickups: [{kind, value, pu, x, y}] */
    collect: function (pbox) {
      var out = [];
      var cx = pbox.x + pbox.w / 2, cy = pbox.y + pbox.h / 2;
      for (var i = this.pickups.length - 1; i >= 0; i--) {
        var e = this.pickups[i];
        var dx = Math.max(Math.abs(e.x - cx) - pbox.w / 2, 0);
        var dy = Math.max(Math.abs(e.y - cy) - pbox.h / 2, 0);
        if (dx * dx + dy * dy < e.r * e.r) {
          out.push(e);
          this.pickups.splice(i, 1);
        }
      }
      return out;
    },

    /* ============================ rendering ============================ */
    render: function (ctx, view) {
      var i, e;
      // pickups first (they float), then obstacles sorted by depth
      for (i = 0; i < this.pickups.length; i++) {
        e = this.pickups[i];
        if (e.kind === 'coin') this._coin(ctx, e, view);
        else if (e.kind === 'star') this._star(ctx, e, view);
        else this._powerup(ctx, e, view);
      }
      var obs = this.obstacles.slice().sort(function (a, b) { return a.bottom - b.bottom; });
      for (i = 0; i < obs.length; i++) {
        this._obstacle(ctx, obs[i], view);
      }
    },

    _coin: function (ctx, e, view) {
      var bob = Math.sin(this._t * 4 + e.seed) * 4;
      var spin = Math.abs(Math.sin(this._t * 5 + e.seed));
      var rx = e.r * (0.35 + spin * 0.65);
      var x = e.x, y = e.y + bob;
      ctx.fillStyle = 'rgba(199,120,0,0.35)';
      ctx.beginPath(); ctx.ellipse(x, y + e.r + 4, e.r * 0.7, 2.6, 0, 0, 6.283); ctx.fill();
      var g = ctx.createLinearGradient(x - rx, y - e.r, x + rx, y + e.r);
      g.addColorStop(0, '#FFE27A'); g.addColorStop(0.55, '#FFC93C'); g.addColorStop(1, '#E8A400');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, Math.max(rx, 2.5), e.r, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#C77800'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, Math.max(rx, 2.5), e.r, 0, 0, 6.283); ctx.stroke();
      if (spin > 0.45) {
        ctx.strokeStyle = 'rgba(199,120,0,0.8)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(x, y, rx * 0.45, e.r * 0.45, 0, 0, 6.283); ctx.stroke();
      }
    },

    _star: function (ctx, e, view) {
      var x = e.x, y = e.y + Math.sin(this._t * 3 + e.seed) * 4;
      var rot = this._t * 1.4 + e.seed;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = '#FFD84D';
      ctx.strokeStyle = '#C77800';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var i = 0; i < 5; i++) {
        var a = i * 1.2566 - 1.5708;
        var a2 = a + 0.6283;
        ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
        ctx.lineTo(Math.cos(a2) * e.r * 0.45, Math.sin(a2) * e.r * 0.45);
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
      var tw = 0.5 + Math.sin(this._t * 6 + e.seed) * 0.5;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + tw * 0.5) + ')';
      ctx.beginPath();
      ctx.arc(x + 5, y - 6, 2.2 + tw, 0, 6.283);
      ctx.fill();
    },

    _powerup: function (ctx, e, view) {
      var bob = Math.sin(this._t * 3 + e.seed) * 5;
      var x = e.x, y = e.y + bob;
      var s = 20;
      var col = { shield: '#5AC8FA', magnet: '#F25555', boost: '#FF9F1C', x2: '#FFC93C' }[e.pu];
      var dark = { shield: '#2E86C1', magnet: '#C93A3A', boost: '#D97E0E', x2: '#E8A400' }[e.pu];

      // halo
      var g = ctx.createRadialGradient(x, y, 4, x, y, 34);
      g.addColorStop(0, col + '66');
      g.addColorStop(1, col + '00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 34, 0, 6.283); ctx.fill();

      // rounded box
      ctx.fillStyle = col;
      this._rrect(ctx, x - s, y - s, s * 2, s * 2, 9);
      ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 2.6;
      this._rrect(ctx, x - s, y - s, s * 2, s * 2, 9);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      this._rrect(ctx, x - s + 3, y - s + 3, s * 2 - 6, 8, 4);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#FFFFFF';
      var k = e.pu;
      ctx.save();
      ctx.translate(x, y);
      if (k === 'shield') {
        ctx.beginPath();
        ctx.moveTo(0, -11); ctx.lineTo(9, -7); ctx.lineTo(9, 2);
        ctx.quadraticCurveTo(9, 9, 0, 12);
        ctx.quadraticCurveTo(-9, 9, -9, 2); ctx.lineTo(-9, -7);
        ctx.closePath(); ctx.fill();
      } else if (k === 'magnet') {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.arc(0, 2, 8, Math.PI, 0); ctx.stroke();
        ctx.fillRect(-10.5, 2, 5, 8);
        ctx.fillRect(5.5, 2, 5, 8);
      } else if (k === 'boost') {
        ctx.beginPath();
        ctx.moveTo(2, -12); ctx.lineTo(-7, 2); ctx.lineTo(-1, 2);
        ctx.lineTo(-3, 12); ctx.lineTo(7, -2); ctx.lineTo(1, -2);
        ctx.closePath(); ctx.fill();
      } else if (k === 'x2') {
        ctx.font = '900 17px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('2X', 0, 1);
      }
      ctx.restore();
    },

    _obstacle: function (ctx, o, view) {
      var x = o.x, bottom = o.bottom;
      switch (o.kind) {
        case 'rock': this._rock(ctx, x, bottom, o); break;
        case 'pot': this._pot(ctx, x, bottom, o); break;
        case 'branch': this._branch(ctx, x, bottom, o); break;
        case 'bush': this._bush(ctx, x, bottom, o); break;
        case 'puddle': this._puddle(ctx, x, bottom, o); break;
        case 'fence': this._fence(ctx, x, bottom, o); break;
      }
    },

    _rock: function (ctx, x, bottom, o) {
      var w = o.w, h = o.h;
      var g = ctx.createLinearGradient(x, bottom - h, x, bottom);
      g.addColorStop(0, '#B8BFC4'); g.addColorStop(1, '#8A939B');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, bottom);
      ctx.lineTo(x - w / 2 + 6, bottom - h * 0.62);
      ctx.lineTo(x - w * 0.16, bottom - h);
      ctx.lineTo(x + w * 0.3, bottom - h * 0.86);
      ctx.lineTo(x + w / 2, bottom - h * 0.34);
      ctx.lineTo(x + w / 2 - 3, bottom);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9AA3AB';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.05, bottom - h * 0.95);
      ctx.lineTo(x + w * 0.3, bottom - h * 0.82);
      ctx.lineTo(x + w * 0.12, bottom - h * 0.5);
      ctx.lineTo(x - w * 0.16, bottom - h * 0.62);
      ctx.closePath(); ctx.fill();
      // moss
      ctx.fillStyle = '#6FBF62';
      ctx.beginPath();
      ctx.ellipse(x - w * 0.18, bottom - h + 4, 8, 4, -0.3, 0, 6.283);
      ctx.fill();
    },

    _pot: function (ctx, x, bottom, o) {
      var w = o.w, h = o.h;
      ctx.fillStyle = '#C96F4A';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.32, bottom - h);
      ctx.lineTo(x + w * 0.32, bottom - h);
      ctx.lineTo(x + w * 0.24, bottom - 8);
      ctx.quadraticCurveTo(x, bottom - 2, x - w * 0.24, bottom - 8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#B45F3D';
      ctx.fillRect(x - w * 0.38, bottom - h - 7, w * 0.76, 9);
      ctx.fillStyle = '#D98360';
      ctx.fillRect(x - w * 0.38, bottom - h - 7, w * 0.76, 3);
      RG.World.drawFlower(ctx, x - 4, bottom - h - 8, 0.95, '#FF8AC2');
    },

    _branch: function (ctx, x, bottom, o) {
      var w = o.w, h = o.h;
      var g = ctx.createLinearGradient(0, bottom - h, 0, bottom);
      g.addColorStop(0, '#A8794E'); g.addColorStop(1, '#7E5636');
      ctx.fillStyle = g;
      this._rrect(ctx, x - w / 2, bottom - h, w, h, h / 2);
      ctx.fill();
      // end rings
      ctx.fillStyle = '#C99B6C';
      ctx.beginPath(); ctx.ellipse(x - w / 2 + 5, bottom - h / 2, 4.5, h / 2 - 1, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#8A6B4F'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(x - w / 2 + 5, bottom - h / 2, 2.2, h / 4, 0, 0, 6.283); ctx.stroke();
      // twig
      ctx.strokeStyle = '#7E5636'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.15, bottom - h);
      ctx.lineTo(x + w * 0.28, bottom - h - 9);
      ctx.stroke();
      // leaf
      ctx.fillStyle = '#57B85A';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.33, bottom - h - 11, 5, 2.6, -0.6, 0, 6.283);
      ctx.fill();
    },

    _bush: function (ctx, x, bottom, o) {
      var w = o.w, h = o.h;
      ctx.fillStyle = '#4E9E52';
      ctx.beginPath();
      ctx.arc(x - w * 0.26, bottom - h * 0.4, h * 0.42, 0, 6.283);
      ctx.arc(x, bottom - h * 0.62, h * 0.52, 0, 6.283);
      ctx.arc(x + w * 0.26, bottom - h * 0.4, h * 0.42, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = '#5FB35C';
      ctx.beginPath();
      ctx.arc(x - w * 0.1, bottom - h * 0.75, h * 0.3, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = '#F25555';
      ctx.beginPath();
      ctx.arc(x - w * 0.2, bottom - h * 0.5, 2.4, 0, 6.283);
      ctx.arc(x + w * 0.12, bottom - h * 0.72, 2.4, 0, 6.283);
      ctx.arc(x + w * 0.3, bottom - h * 0.42, 2.4, 0, 6.283);
      ctx.fill();
    },

    _puddle: function (ctx, x, bottom, o) {
      var w = o.w;
      var g = ctx.createRadialGradient(x, bottom - 3, 2, x, bottom - 3, w * 0.55);
      g.addColorStop(0, 'rgba(143,217,255,0.95)');
      g.addColorStop(0.7, 'rgba(95,191,239,0.8)');
      g.addColorStop(1, 'rgba(95,191,239,0.25)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, bottom - 3, w / 2, o.h * 0.8, 0, 0, 6.283);
      ctx.fill();
      var rp = (this._t * 1.6 + o.seed) % 1;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 - rp * 0.7) + ')';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(x, bottom - 3, w * 0.22 + rp * w * 0.26, 3 + rp * 5, 0, 0, 6.283);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.ellipse(x - w * 0.18, bottom - 5, w * 0.1, 1.8, -0.2, 0, 6.283);
      ctx.fill();
    },

    _fence: function (ctx, x, bottom, o) {
      var w = o.w, h = o.h;
      var top = bottom - h;
      // lattice
      ctx.fillStyle = '#D9C29A';
      ctx.fillRect(x - w / 2, top + 12, w, h - 12);
      ctx.strokeStyle = '#B49A6E';
      ctx.lineWidth = 3;
      var i;
      for (i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * 16 - 8, bottom);
        ctx.lineTo(x + i * 16 + 8, top + 14);
        ctx.moveTo(x + i * 16 + 8, bottom);
        ctx.lineTo(x + i * 16 - 8, top + 14);
        ctx.stroke();
      }
      // posts
      ctx.fillStyle = '#B49A6E';
      ctx.fillRect(x - w / 2 - 3, top + 6, 7, h - 6);
      ctx.fillRect(x + w / 2 - 4, top + 6, 7, h - 6);
      ctx.fillStyle = '#C9AE84';
      ctx.fillRect(x - w / 2 - 5, top + 2, 11, 6);
      ctx.fillRect(x + w / 2 - 6, top + 2, 11, 6);
      // climbing rose vine
      ctx.strokeStyle = '#4E9E52';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + 2, bottom - 6);
      ctx.quadraticCurveTo(x - w * 0.1, bottom - h * 0.5, x - w / 2 + 4, top + 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - 2, bottom - 4);
      ctx.quadraticCurveTo(x + w * 0.15, bottom - h * 0.62, x + w / 2 - 4, top + 18);
      ctx.stroke();
      RG.World.drawFlower(ctx, x - w * 0.18, bottom - h * 0.42, 0.85, '#FF8AC2');
      RG.World.drawFlower(ctx, x + w * 0.2, bottom - h * 0.6, 0.8, '#FF7A6E');
      RG.World.drawFlower(ctx, x - w * 0.05, top + 16, 0.75, '#FFF3A8');
      // arch top
      ctx.fillStyle = '#C9AE84';
      ctx.beginPath();
      ctx.ellipse(x, top + 8, w / 2 + 4, 8, 0, Math.PI, 0);
      ctx.fill();
    },

    _rrect: function (ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  };

  RG.Entities = Entities;
})();
