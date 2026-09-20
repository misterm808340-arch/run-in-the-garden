/* Run in the Garden - lightweight particle system (capped for low-end devices) */
(function () {
  'use strict';
  window.RG = window.RG || {};
  var U;
  var MAX = 240;

  var Particles = {
    list: [],

    reset: function () { U = RG.Utils; this.list.length = 0; },

    _add: function (p) {
      if (this.list.length >= MAX) this.list.shift();
      this.list.push(p);
    },

    /* landing / running dust */
    dust: function (x, y, n) {
      for (var i = 0; i < n; i++) {
        this._add({
          x: x + U.rand(-10, 10), y: y + U.rand(-3, 1),
          vx: U.rand(-46, 46), vy: U.rand(-58, -8),
          life: U.rand(0.3, 0.55), max: 0.55,
          size: U.rand(2.5, 5), color: 'rgba(214,232,206,0.9)',
          grav: 160, type: 'dot'
        });
      }
    },

    coinBurst: function (x, y, color) {
      color = color || '#FFC93C';
      for (var i = 0; i < 7; i++) {
        var a = U.rand(0, 6.283), sp = U.rand(60, 150);
        this._add({
          x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
          life: U.rand(0.3, 0.5), max: 0.5,
          size: U.rand(2, 3.6), color: color, grav: 220, type: 'dot'
        });
      }
    },

    powerBurst: function (x, y, color) {
      for (var i = 0; i < 14; i++) {
        var a = (i / 14) * 6.283;
        this._add({
          x: x, y: y,
          vx: Math.cos(a) * 120, vy: Math.sin(a) * 120,
          life: 0.45, max: 0.45,
          size: 3.4, color: color, grav: 0, type: 'spark'
        });
      }
    },

    poof: function (x, y) {
      for (var i = 0; i < 8; i++) {
        this._add({
          x: x + U.rand(-14, 14), y: y + U.rand(-10, 6),
          vx: U.rand(-30, 30), vy: U.rand(-70, -20),
          life: U.rand(0.35, 0.6), max: 0.6,
          size: U.rand(5, 9), color: 'rgba(255,255,255,0.85)',
          grav: -30, type: 'grow'
        });
      }
    },

    crash: function (x, y) {
      for (var i = 0; i < 16; i++) {
        var a = U.rand(0, 6.283), sp = U.rand(90, 260);
        this._add({
          x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          life: U.rand(0.4, 0.8), max: 0.8,
          size: U.rand(2.5, 5), color: U.pick(['#F25555', '#FFC93C', '#FFFFFF', '#FF8A3D']),
          grav: 380, type: 'dot'
        });
      }
      for (i = 0; i < 5; i++) {
        this._add({
          x: x, y: y,
          vx: U.rand(-60, 60), vy: U.rand(-120, -40),
          life: 0.7, max: 0.7, size: 6,
          color: '#FFC93C', grav: 300, type: 'star'
        });
      }
    },

    smash: function (x, y, color) {
      for (var i = 0; i < 12; i++) {
        var a = U.rand(0, 6.283), sp = U.rand(100, 240);
        this._add({
          x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.5, max: 0.5, size: U.rand(3, 6),
          color: color || '#8A939B', grav: 350, type: 'dot'
        });
      }
    },

    splash: function (x, y) {
      for (var i = 0; i < 10; i++) {
        this._add({
          x: x + U.rand(-24, 24), y: y,
          vx: U.rand(-50, 50), vy: U.rand(-140, -60),
          life: U.rand(0.3, 0.5), max: 0.5,
          size: U.rand(2, 4), color: 'rgba(143,217,255,0.95)',
          grav: 420, type: 'dot'
        });
      }
    },

    speedLines: function (x, y) {
      if (!U.chance(0.6)) return;
      // vertical streaks rushing past at the screen edges (forward motion)
      var side = U.chance(0.5) ? U.rand(0, 60) : U.rand(340, 400);
      this._add({
        x: side, y: U.rand(200, 560),
        vx: 0, vy: U.rand(420, 640),
        life: 0.28, max: 0.28, size: U.rand(14, 26),
        color: 'rgba(255,255,255,0.75)', grav: 0, type: 'lineV'
      });
    },

    text: function (x, y, str, color) {
      this._add({
        x: x, y: y, vx: 0, vy: -64,
        life: 0.85, max: 0.85, size: 15,
        color: color || '#FFFFFF', grav: 0, type: 'text', str: str
      });
    },

    update: function (dt) {
      var L = this.list;
      for (var i = L.length - 1; i >= 0; i--) {
        var p = L[i];
        p.life -= dt;
        if (p.life <= 0) { L.splice(i, 1); continue; }
        p.vy += (p.grav || 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    },

    render: function (ctx) {
      var L = this.list;
      for (var i = 0; i < L.length; i++) {
        var p = L[i];
        var a = U.clamp(p.life / p.max, 0, 1);
        ctx.globalAlpha = a;
        switch (p.type) {
          case 'dot':
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, 6.283); ctx.fill();
            break;
          case 'spark':
            ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
            ctx.stroke();
            break;
          case 'grow':
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, 6.283); ctx.fill();
            break;
          case 'line':
            ctx.strokeStyle = p.color; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.size, p.y);
            ctx.stroke();
            break;
          case 'lineV':
            ctx.strokeStyle = p.color; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + p.size);
            ctx.stroke();
            break;
          case 'star':
            ctx.fillStyle = p.color;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.life * 6);
            ctx.beginPath();
            for (var k = 0; k < 5; k++) {
              var ang = k * 1.2566 - 1.5708;
              ctx.lineTo(Math.cos(ang) * p.size, Math.sin(ang) * p.size);
              ctx.lineTo(Math.cos(ang + 0.6283) * p.size * 0.45, Math.sin(ang + 0.6283) * p.size * 0.45);
            }
            ctx.closePath(); ctx.fill();
            ctx.restore();
            break;
          case 'text':
            ctx.font = '900 ' + p.size + 'px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = 'rgba(46,125,50,0.9)';
            ctx.strokeText(p.str, p.x, p.y);
            ctx.fillStyle = p.color;
            ctx.fillText(p.str, p.x, p.y);
            break;
        }
      }
      ctx.globalAlpha = 1;
    }
  };

  RG.Particles = Particles;
})();
