/* Run in the Garden - track entities (FORWARD 3D): obstacles, coins,
   stars and power-ups live at (lateral lane, z-distance ahead of the
   player) and rush toward the camera. Includes the fair pattern spawner,
   magnet attraction, pickup collection and all procedural drawing. */
(function () {
  'use strict';
  window.RG = window.RG || {};
  var U, C;

  var Entities = {
    obstacles: [], pickups: [],
    nextSpawnAt: 0, _t: 0,

    reset: function () {
      C = RG.Config; U = RG.Utils;
      this.obstacles.length = 0;
      this.pickups.length = 0;
      this.nextSpawnAt = C.spawn.firstDelayUnits;
      this._t = 0;
    },

    /* ------------------------- projection ---------------------------- */
    _project: function (e, view) {
      var V3 = C.view3d;
      var s = RG.World.scaleAt(Math.max(e.z, 0), V3.camD);
      e.s = s;
      e.vs = s * (V3.entityScale || 1);   // sprite size scale (projection stays lane-true)
      e.sx = view.cx + e.lat * V3.laneSpan * s;
      e.sy = view.horizonY + (view.baseY - view.horizonY) * s;
    },

    /* ============================ update ============================ */
    update: function (dt, view, speed, dist, magnetOn) {
      this._t += dt;
      var V3 = C.view3d;
      var i, e;
      var mv = speed * V3.zSpeedK * dt;
      var p = RG.Player;

      // move obstacles toward the camera
      for (i = this.obstacles.length - 1; i >= 0; i--) {
        e = this.obstacles[i];
        e.z -= mv;
        if (e.z < -10) { this.obstacles.splice(i, 1); continue; }
        this._project(e, view);
      }

      // move / attract pickups
      for (i = this.pickups.length - 1; i >= 0; i--) {
        e = this.pickups[i];
        e.z -= mv;
        if (magnetOn && (e.kind === 'coin' || e.kind === 'star') && e.z < V3.magnetZ && e.z > -4) {
          e.lat = U.damp(e.lat, p.lat, 6, dt);
          e.y = U.damp(e.y, 30, 5, dt);
          e.z -= mv * 0.9; // extra pull
        }
        if (e.z < -6) { this.pickups.splice(i, 1); continue; }
        this._project(e, view);
      }

      // spawning by distance travelled
      if (dist >= this.nextSpawnAt) {
        this._spawnPattern(dist);
      }
    },

    /* =========================== spawning =========================== */
    _laneFree: function () { return U.randi(0, 2); },
    _lat: function (lane) { return lane - 1; },

    _spawnPattern: function (dist) {
      var sp = C.spawn;
      var z0 = C.view3d.zFar;
      var gapSec;

      if (U.chance(sp.powerupChance)) {
        this._spawnPowerup(z0);
        gapSec = U.rand(sp.gapMinSec, sp.gapMaxSec);
      } else {
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
          case 'coinLine': this._coinLine(z0); break;
          case 'single': this._single(z0, dist); break;
          case 'jumpRow': this._jumpRow(z0); break;
          case 'twoWall': this._twoWall(z0); break;
          case 'fenceWall': this._fenceWall(z0); break;
          case 'puddles': this._puddles(z0); break;
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

    _addObstacle: function (kind, lat, z) {
      this.obstacles.push({
        kind: kind, lat: lat, z: z,
        w: C.obstacles[kind].w, h: C.obstacles[kind].h,
        jumpable: C.obstacles[kind].jump,
        seed: Math.random() * 6.28,
        sx: 0, sy: 0, s: 1
      });
    },

    _addCoin: function (lat, z, y) {
      if (U.chance(C.spawn.starChance)) {
        this.pickups.push({ kind: 'star', lat: lat, z: z, y: y, r: C.starR, seed: Math.random() * 6.28, sx: 0, sy: 0, s: 1 });
      } else {
        this.pickups.push({ kind: 'coin', lat: lat, z: z, y: y, r: C.coinR, seed: Math.random() * 6.28, sx: 0, sy: 0, s: 1 });
      }
    },

    _coinLine: function (z0) {
      var lane = this._laneFree();
      var lat = this._lat(lane);
      var n = U.randi(5, 8);
      for (var i = 0; i < n; i++) {
        this._addCoin(lat, z0 + i * 7, 28 + Math.sin(i * 0.9) * 8);
      }
    },

    _coinArc: function (zc, lat) {
      for (var i = 0; i < 7; i++) {
        var t = i / 6;
        var z = zc + 30 - t * 60;
        var y = 34 + Math.sin(t * Math.PI) * 96;
        this._addCoin(lat, z, y);
      }
    },

    _single: function (z0, dist) {
      var lane = this._laneFree();
      var lat = this._lat(lane);
      var kind = this._obWeighted(false);
      this._addObstacle(kind, lat, z0);
      var def = C.obstacles[kind];
      if (def.lethal && U.chance(0.45)) {
        this._coinArc(z0, lat);
      } else if (U.chance(0.35)) {
        var l2 = this._lat((lane + U.randi(1, 2)) % 3);
        for (var i = 0; i < 4; i++) {
          this._addCoin(l2, z0 + i * 7, 28);
        }
      }
    },

    _jumpRow: function (z0) {
      var mid = this._laneFree();
      for (var l = 0; l < 3; l++) {
        var kind = l === mid ? 'rock' : U.pick(['rock', 'branch', 'bush']);
        this._addObstacle(kind, this._lat(l), z0 + (l === 1 ? 0 : U.rand(-1, 1)));
      }
      this._coinArc(z0, this._lat(mid));
    },

    _twoWall: function (z0) {
      var free = this._laneFree();
      for (var l = 0; l < 3; l++) {
        if (l === free) continue;
        this._addObstacle(this._obWeighted(false), this._lat(l), z0 + U.rand(-1, 1));
      }
      if (U.chance(0.6)) {
        var lat = this._lat(free);
        for (var i = 0; i < 4; i++) {
          this._addCoin(lat, z0 + i * 7, 28);
        }
      }
    },

    _fenceWall: function (z0) {
      var free = this._laneFree();
      for (var l = 0; l < 3; l++) {
        if (l === free) continue;
        this._addObstacle('fence', this._lat(l), z0);
      }
      var lat = this._lat(free);
      for (var i = 0; i < 4; i++) {
        this._addCoin(lat, z0 + 2 + i * 7, 28);
      }
    },

    _puddles: function (z0) {
      var lanes = [0, 1, 2];
      var skip = this._laneFree();
      for (var i = 0; i < lanes.length; i++) {
        if (lanes[i] === skip) continue;
        this._addObstacle('puddle', this._lat(lanes[i]), z0 + U.rand(-1, 1));
      }
      if (U.chance(0.5)) this._coinLine(z0 + 26);
    },

    _spawnPowerup: function (z0) {
      var lane = this._laneFree();
      var kind = U.pick(['shield', 'shield', 'magnet', 'boost', 'x2']);
      this.pickups.push({
        kind: 'pu', pu: kind, lat: this._lat(lane),
        z: z0, y: 64, r: 24, seed: Math.random() * 6.28,
        sx: 0, sy: 0, s: 1
      });
    },

    /* =========================== collisions =========================== */
    /* first obstacle currently crossing the player plane in the
       player's lane, or null. Jumpable ones are cleared mid-air. */
    hitObstacle: function (p) {
      var V3 = C.view3d;
      for (var i = 0; i < this.obstacles.length; i++) {
        var o = this.obstacles[i];
        if (o.z > V3.hitZ || o.z < -V3.hitZ) continue;
        if (Math.abs(p.lat - o.lat) >= V3.laneHitTol) continue;
        // scaled threshold: matches the taller on-screen sprite so jump-overs look fair
        if (o.jumpable && p.jumpH > o.h * 0.62 * (V3.entityScale || 1)) continue;
        return o;
      }
      return null;
    },

    removeObstacle: function (o) {
      var i = this.obstacles.indexOf(o);
      if (i >= 0) this.obstacles.splice(i, 1);
    },

    clearAhead: function (view) {
      // used on revive: wipe everything near the player plane
      var i;
      for (i = this.obstacles.length - 1; i >= 0; i--) {
        var o = this.obstacles[i];
        if (o.z < 34) {
          RG.Particles.poof(o.sx, o.sy - o.h * (o.vs || o.s) * 0.5);
          this.obstacles.splice(i, 1);
        }
      }
      for (i = this.pickups.length - 1; i >= 0; i--) {
        if (this.pickups[i].kind === 'pu' && this.pickups[i].z < 34) {
          this.pickups.splice(i, 1);
        }
      }
    },

    /* returns collected pickups: [{kind, value?, pu?, sx, sy}] */
    collect: function (p) {
      var V3 = C.view3d;
      var out = [];
      var torso = 30 + p.jumpH;
      for (var i = this.pickups.length - 1; i >= 0; i--) {
        var e = this.pickups[i];
        if (e.z > V3.coinZWin || e.z < -2) continue;
        if (Math.abs(p.lat - e.lat) > 0.55) continue;
        if (Math.abs(torso - e.y) > V3.coinYTol) continue;
        out.push(e);
        this.pickups.splice(i, 1);
      }
      return out;
    },

    /* ============================ rendering ============================ */
    render: function (ctx, view) {
      // painter's order: far -> near
      var list = [];
      var i, e;
      for (i = 0; i < this.obstacles.length; i++) list.push(this.obstacles[i]);
      for (i = 0; i < this.pickups.length; i++) list.push(this.pickups[i]);
      list.sort(function (a, b) { return b.z - a.z; });
      for (i = 0; i < list.length; i++) {
        e = list[i];
        if (e.kind === 'coin') this._coin(ctx, e);
        else if (e.kind === 'star') this._star(ctx, e);
        else if (e.kind === 'pu') this._powerup(ctx, e);
        else this._obstacle(ctx, e);
      }
    },

    _coin: function (ctx, e) {
      var s = e.s, k = e.vs;                 // s = projection, k = sprite size
      var r = Math.max(e.r * k * 1.25, 1.6);
      var bob = Math.sin(this._t * 4 + e.seed) * 3 * k;
      var x = e.sx, y = e.sy - e.y * s * 0.55 + bob;
      // ground shadow
      ctx.fillStyle = 'rgba(60,90,50,0.18)';
      ctx.beginPath(); ctx.ellipse(e.sx, e.sy, r * 0.9, r * 0.28, 0, 0, 6.283); ctx.fill();
      var spin = Math.abs(Math.sin(this._t * 5 + e.seed));
      var rx = r * (0.35 + spin * 0.65);
      var g = ctx.createLinearGradient(x - rx, y - r, x + rx, y + r);
      g.addColorStop(0, '#FFE27A'); g.addColorStop(0.55, '#FFC93C'); g.addColorStop(1, '#E8A400');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, Math.max(rx, 1), r, 0, 0, 6.283); ctx.fill();
      if (r > 4) {
        ctx.strokeStyle = '#C77800'; ctx.lineWidth = Math.max(1, 2 * k * 1.3);
        ctx.beginPath(); ctx.ellipse(x, y, Math.max(rx, 1), r, 0, 0, 6.283); ctx.stroke();
        if (spin > 0.45) {
          ctx.strokeStyle = 'rgba(199,120,0,0.8)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.ellipse(x, y, rx * 0.45, r * 0.45, 0, 0, 6.283); ctx.stroke();
        }
      }
    },

    _star: function (ctx, e) {
      var s = e.s, k = e.vs;
      var r = Math.max(e.r * k * 1.25, 1.8);
      var x = e.sx, y = e.sy - e.y * s * 0.55 + Math.sin(this._t * 3 + e.seed) * 3 * k;
      ctx.fillStyle = 'rgba(60,90,50,0.16)';
      ctx.beginPath(); ctx.ellipse(e.sx, e.sy, r * 0.8, r * 0.25, 0, 0, 6.283); ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this._t * 1.4 + e.seed);
      ctx.fillStyle = '#FFD84D';
      ctx.strokeStyle = '#C77800';
      ctx.lineWidth = Math.max(1, 2 * k * 1.3);
      ctx.beginPath();
      for (var i = 0; i < 5; i++) {
        var a = i * 1.2566 - 1.5708;
        var a2 = a + 0.6283;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
      if (r > 4) {
        var tw = 0.5 + Math.sin(this._t * 6 + e.seed) * 0.5;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + tw * 0.5) + ')';
        ctx.beginPath();
        ctx.arc(x + r * 0.4, y - r * 0.5, 1.8 + tw * k * 2, 0, 6.283);
        ctx.fill();
      }
    },

    _powerup: function (ctx, e) {
      var s = e.s, k = e.vs;
      var size = 20 * k * 1.3;
      var bob = Math.sin(this._t * 3 + e.seed) * 4 * k;
      var x = e.sx, y = e.sy - (e.y * s * 0.55) + bob;
      var col = { shield: '#5AC8FA', magnet: '#F25555', boost: '#FF9F1C', x2: '#FFC93C' }[e.pu];
      var dark = { shield: '#2E86C1', magnet: '#C93A3A', boost: '#D97E0E', x2: '#E8A400' }[e.pu];

      // halo
      var g = ctx.createRadialGradient(x, y, size * 0.2, x, y, size * 1.8);
      g.addColorStop(0, col + '66');
      g.addColorStop(1, col + '00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, size * 1.8, 0, 6.283); ctx.fill();

      // rounded box
      ctx.fillStyle = col;
      this._rrect(ctx, x - size, y - size, size * 2, size * 2, size * 0.45);
      ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.2, 2.6 * k * 1.3);
      this._rrect(ctx, x - size, y - size, size * 2, size * 2, size * 0.45);
      ctx.stroke();
      if (size > 6) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        this._rrect(ctx, x - size + size * 0.15, y - size + size * 0.15, size * 2 - size * 0.3, size * 0.4, size * 0.2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#FFFFFF';
        var pk = e.pu;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k * 1.3, k * 1.3);
        if (pk === 'shield') {
          ctx.beginPath();
          ctx.moveTo(0, -11); ctx.lineTo(9, -7); ctx.lineTo(9, 2);
          ctx.quadraticCurveTo(9, 9, 0, 12);
          ctx.quadraticCurveTo(-9, 9, -9, 2); ctx.lineTo(-9, -7);
          ctx.closePath(); ctx.fill();
        } else if (pk === 'magnet') {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'butt';
          ctx.beginPath(); ctx.arc(0, 2, 8, Math.PI, 0); ctx.stroke();
          ctx.fillRect(-10.5, 2, 5, 8);
          ctx.fillRect(5.5, 2, 5, 8);
        } else if (pk === 'boost') {
          ctx.beginPath();
          ctx.moveTo(2, -12); ctx.lineTo(-7, 2); ctx.lineTo(-1, 2);
          ctx.lineTo(-3, 12); ctx.lineTo(7, -2); ctx.lineTo(1, -2);
          ctx.closePath(); ctx.fill();
        } else if (pk === 'x2') {
          ctx.font = '900 17px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('2X', 0, 1);
        }
        ctx.restore();
      }
    },

    _obstacle: function (ctx, o) {
      var k = o.vs || o.s;                   // sprite size (entityScale applied)
      // ground shadow
      ctx.fillStyle = 'rgba(50,80,40,0.20)';
      ctx.beginPath();
      ctx.ellipse(o.sx, o.sy, o.w * k * 0.55, o.h * k * 0.16 + 1, 0, 0, 6.283);
      ctx.fill();
      var w = o.w * k * 1.25, h = o.h * k * 1.25, x = o.sx, bottom = o.sy;
      switch (o.kind) {
        case 'rock': this._rock(ctx, x, bottom, w, h, o); break;
        case 'pot': this._pot(ctx, x, bottom, w, h, o); break;
        case 'branch': this._branch(ctx, x, bottom, w, h, o); break;
        case 'bush': this._bush(ctx, x, bottom, w, h, o); break;
        case 'puddle': this._puddle(ctx, x, bottom, w, h, o); break;
        case 'fence': this._fence(ctx, x, bottom, w, h, o); break;
      }
    },

    _rock: function (ctx, x, bottom, w, h, o) {
      var g = ctx.createLinearGradient(x, bottom - h, x, bottom);
      g.addColorStop(0, '#B8BFC4'); g.addColorStop(1, '#8A939B');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, bottom);
      ctx.lineTo(x - w / 2 + 6 * (w / 54), bottom - h * 0.62);
      ctx.lineTo(x - w * 0.16, bottom - h);
      ctx.lineTo(x + w * 0.3, bottom - h * 0.86);
      ctx.lineTo(x + w / 2, bottom - h * 0.34);
      ctx.lineTo(x + w / 2 - 3 * (w / 54), bottom);
      ctx.closePath(); ctx.fill();
      if (w > 10) {
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
        ctx.ellipse(x - w * 0.18, bottom - h + 3, w * 0.15, h * 0.1, -0.3, 0, 6.283);
        ctx.fill();
      }
    },

    _pot: function (ctx, x, bottom, w, h, o) {
      ctx.fillStyle = '#C96F4A';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.32, bottom - h);
      ctx.lineTo(x + w * 0.32, bottom - h);
      ctx.lineTo(x + w * 0.24, bottom - 8 * (h / 52));
      ctx.quadraticCurveTo(x, bottom - 2 * (h / 52), x - w * 0.24, bottom - 8 * (h / 52));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#B45F3D';
      ctx.fillRect(x - w * 0.38, bottom - h - 7 * (h / 52), w * 0.76, 9 * (h / 52));
      if (w > 12) {
        ctx.fillStyle = '#D98360';
        ctx.fillRect(x - w * 0.38, bottom - h - 7 * (h / 52), w * 0.76, 3 * (h / 52));
        RG.World.drawFlower(ctx, x - 4 * (w / 46), bottom - h - 8 * (h / 52), 0.95 * (w / 46) * 1.25, '#FF8AC2');
      }
    },

    _branch: function (ctx, x, bottom, w, h, o) {
      var g = ctx.createLinearGradient(0, bottom - h, 0, bottom);
      g.addColorStop(0, '#A8794E'); g.addColorStop(1, '#7E5636');
      ctx.fillStyle = g;
      this._rrect(ctx, x - w / 2, bottom - h, w, h, h / 2);
      ctx.fill();
      if (w > 12) {
        ctx.fillStyle = '#C99B6C';
        ctx.beginPath(); ctx.ellipse(x - w / 2 + 5 * (w / 78), bottom - h / 2, 4.5 * (w / 78), h / 2 - 1, 0, 0, 6.283); ctx.fill();
        ctx.strokeStyle = '#7E5636'; ctx.lineWidth = 3 * (w / 78); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + w * 0.15, bottom - h);
        ctx.lineTo(x + w * 0.28, bottom - h - 9 * (h / 30));
        ctx.stroke();
        ctx.fillStyle = '#57B85A';
        ctx.beginPath();
        ctx.ellipse(x + w * 0.33, bottom - h - 11 * (h / 30), 5 * (w / 78), 2.6 * (w / 78), -0.6, 0, 6.283);
        ctx.fill();
      }
    },

    _bush: function (ctx, x, bottom, w, h, o) {
      ctx.fillStyle = '#4E9E52';
      ctx.beginPath();
      ctx.arc(x - w * 0.26, bottom - h * 0.4, h * 0.42, 0, 6.283);
      ctx.arc(x, bottom - h * 0.62, h * 0.52, 0, 6.283);
      ctx.arc(x + w * 0.26, bottom - h * 0.4, h * 0.42, 0, 6.283);
      ctx.fill();
      if (w > 12) {
        ctx.fillStyle = '#5FB35C';
        ctx.beginPath();
        ctx.arc(x - w * 0.1, bottom - h * 0.75, h * 0.3, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = '#F25555';
        ctx.beginPath();
        ctx.arc(x - w * 0.2, bottom - h * 0.5, 2.4 * (w / 62), 0, 6.283);
        ctx.arc(x + w * 0.12, bottom - h * 0.72, 2.4 * (w / 62), 0, 6.283);
        ctx.arc(x + w * 0.3, bottom - h * 0.42, 2.4 * (w / 62), 0, 6.283);
        ctx.fill();
      }
    },

    _puddle: function (ctx, x, bottom, w, h, o) {
      var g = ctx.createRadialGradient(x, bottom - 3 * (h / 14), 2, x, bottom - 3 * (h / 14), w * 0.55);
      g.addColorStop(0, 'rgba(143,217,255,0.95)');
      g.addColorStop(0.7, 'rgba(95,191,239,0.8)');
      g.addColorStop(1, 'rgba(95,191,239,0.25)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, bottom - 3 * (h / 14), w / 2, Math.max(h * 0.8, 1.4), 0, 0, 6.283);
      ctx.fill();
      if (w > 14) {
        var rp = (this._t * 1.6 + o.seed) % 1;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 - rp * 0.7) + ')';
        ctx.lineWidth = 1.6 * (w / 86);
        ctx.beginPath();
        ctx.ellipse(x, bottom - 3 * (h / 14), w * 0.22 + rp * w * 0.26, 3 + rp * 5 * (h / 14), 0, 0, 6.283);
        ctx.stroke();
      }
    },

    _fence: function (ctx, x, bottom, w, h, o) {
      var top = bottom - h;
      // lattice
      ctx.fillStyle = '#D9C29A';
      ctx.fillRect(x - w / 2, top + 12 * (h / 165), w, h - 12 * (h / 165));
      if (w > 16) {
        ctx.strokeStyle = '#B49A6E';
        ctx.lineWidth = 3 * (w / 56);
        var i;
        for (i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(x + i * 16 * (w / 56) - 8 * (w / 56), bottom);
          ctx.lineTo(x + i * 16 * (w / 56) + 8 * (w / 56), top + 14 * (h / 165));
          ctx.moveTo(x + i * 16 * (w / 56) + 8 * (w / 56), bottom);
          ctx.lineTo(x + i * 16 * (w / 56) - 8 * (w / 56), top + 14 * (h / 165));
          ctx.stroke();
        }
        // climbing rose vine
        ctx.strokeStyle = '#4E9E52';
        ctx.lineWidth = 3 * (w / 56);
        ctx.beginPath();
        ctx.moveTo(x - w / 2 + 2, bottom - 6 * (h / 165));
        ctx.quadraticCurveTo(x - w * 0.1, bottom - h * 0.5, x - w / 2 + 4, top + 10 * (h / 165));
        ctx.stroke();
        RG.World.drawFlower(ctx, x - w * 0.18, bottom - h * 0.42, 0.85 * (w / 56) * 1.25, '#FF8AC2');
        RG.World.drawFlower(ctx, x + w * 0.2, bottom - h * 0.6, 0.8 * (w / 56) * 1.25, '#FF7A6E');
      }
      // posts
      ctx.fillStyle = '#B49A6E';
      ctx.fillRect(x - w / 2 - 3 * (w / 56), top + 6 * (h / 165), 7 * (w / 56), h - 6 * (h / 165));
      ctx.fillRect(x + w / 2 - 4 * (w / 56), top + 6 * (h / 165), 7 * (w / 56), h - 6 * (h / 165));
      ctx.fillStyle = '#C9AE84';
      ctx.fillRect(x - w / 2 - 5 * (w / 56), top + 2 * (h / 165), 11 * (w / 56), 6 * (h / 165));
      ctx.fillRect(x + w / 2 - 6 * (w / 56), top + 2 * (h / 165), 11 * (w / 56), 6 * (h / 165));
      // arch top
      ctx.fillStyle = '#C9AE84';
      ctx.beginPath();
      ctx.ellipse(x, top + 8 * (h / 165), w / 2 + 4 * (w / 56), 8 * (h / 165), 0, Math.PI, 0);
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
