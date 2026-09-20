/* Run in the Garden - player: a cheerful garden bunny.
   Physics: lane lerp, jump with coyote-time & input buffering,
   squash & stretch, run cycle, power-up visuals. */
(function () {
  'use strict';
  window.RG = window.RG || {};
  var U, C;

  var Player = {
    lane: 1, x: 200, targetX: 200,
    y: 0, vy: 0,
    grounded: true,
    w: 46, h: 58,
    runPhase: 0,
    blinkTimer: 2, blinking: false,
    squash: 0,
    coyote: 0, buffer: 0,
    // buffs (managed by game, mirrored here for drawing)
    shield: false, invincible: 0,
    magnet: 0, boost: 0, x2: 0,
    scarfT: 0,

    reset: function (view) {
      C = RG.Config;
      U = RG.Utils;
      this.lane = 1;
      this.x = C.laneX[1];
      this.targetX = this.x;
      this.y = view.trackY;
      this.vy = 0;
      this.grounded = true;
      this.runPhase = 0;
      this.squash = 0;
      this.coyote = 0; this.buffer = 0;
      this.shield = false; this.invincible = 0;
      this.magnet = 0; this.boost = 0; this.x2 = 0;
    },

    moveLane: function (dir, view) {
      var nl = U.clamp(this.lane + dir, 0, 2);
      if (nl !== this.lane) {
        this.lane = nl;
        this.targetX = C.laneX[nl];
        RG.Audio.sfx('whoosh');
      }
    },

    tryJump: function (view) {
      this.buffer = C.player.bufferMs / 1000;
      this._consumeJump(view);
    },

    _consumeJump: function (view) {
      if (this.buffer > 0 && (this.grounded || this.coyote > 0)) {
        this.vy = -C.player.jumpV;
        this.grounded = false;
        this.coyote = 0;
        this.buffer = 0;
        RG.Audio.sfx('jump');
        RG.Particles.dust(this.x, view.trackY, 6);
      }
    },

    update: function (dt, view) {
      // lane easing
      this.x = U.damp(this.x, this.targetX, C.player.laneLerp, dt);
      if (Math.abs(this.x - this.targetX) < 0.4) this.x = this.targetX;

      // vertical physics
      if (!this.grounded) {
        this.vy += C.player.gravity * dt;
        this.y += this.vy * dt;
        if (this.y >= view.trackY) {
          this.y = view.trackY;
          if (this.vy > 250) {
            this.squash = Math.min(1, this.vy / 900);
            RG.Audio.sfx('land');
            RG.Particles.dust(this.x, view.trackY, 5);
          }
          this.vy = 0;
          this.grounded = true;
        }
      } else {
        this.coyote = C.player.coyoteMs / 1000;
      }

      this.buffer = Math.max(0, this.buffer - dt);
      this.coyote = Math.max(0, this.coyote - dt);
      if (this.buffer > 0) this._consumeJump(view);

      // animation state
      this.runPhase += dt * (this.grounded ? 11 + RG.Game.speedNow() * 0.02 : 6);
      this.squash = Math.max(0, this.squash - dt * 4.5);
      this.invincible = Math.max(0, this.invincible - dt);
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinking = !this.blinking;
        this.blinkTimer = this.blinking ? 0.12 : U.rand(1.6, 4);
      }
      this.scarfT += dt * 9;

      if (this.buffer > 0 && (this.grounded || this.coyote > 0)) this._consumeJump(view);
    },

    /* current collision box (logical units) */
    box: function () {
      var w = this.w, h = this.h;
      if (this.squash > 0.4) { h -= 8; w += 6; }
      return { x: this.x - w / 2, y: this.y - h, w: w, h: h };
    },

    rect: function () { return this.box(); },

    render: function (ctx, view) {
      var x = this.x, y = this.y;
      var bob = this.grounded ? Math.abs(Math.sin(this.runPhase)) * 3 : 0;
      var sq = this.squash;

      // shadow
      var airH = Math.max(0, view.trackY - y);
      var shScale = U.clamp(1 - airH / 260, 0.35, 1);
      ctx.fillStyle = 'rgba(30,70,30,0.28)';
      ctx.beginPath();
      ctx.ellipse(x, view.trackY + 3, 22 * shScale, 6.5 * shScale, 0, 0, 6.283);
      ctx.fill();

      ctx.save();
      ctx.translate(x, y);

      // jump stretch / landing squash
      if (!this.grounded) {
        var st = U.clamp(-this.vy / 1400, -0.12, 0.16);
        ctx.scale(1 - st, 1 + st);
      } else if (sq > 0) {
        ctx.scale(1 + sq * 0.14, 1 - sq * 0.16);
      }

      var legSwing = this.grounded ? Math.sin(this.runPhase) : 0.6;
      var legSwing2 = this.grounded ? Math.sin(this.runPhase + Math.PI) : -0.4;
      var bodyBob = this.grounded ? Math.sin(this.runPhase * 2) * 1.5 : 0;

      // feet
      ctx.fillStyle = '#F0F0EA';
      this._foot(ctx, -10, legSwing, airH);
      this._foot(ctx, 10, legSwing2, airH);

      // body
      var g = ctx.createLinearGradient(0, -58, 0, -12);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(1, '#EFEDE4');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, -26 - bodyBob * 0.4, 17, 20, 0, 0, 6.283);
      ctx.fill();

      // belly patch
      ctx.fillStyle = '#FFF7F0';
      ctx.beginPath();
      ctx.ellipse(0, -22, 10, 13, 0, 0, 6.283);
      ctx.fill();

      // scarf (fluttering)
      var fl = Math.sin(this.scarfT) * 3;
      ctx.fillStyle = '#F25555';
      ctx.beginPath();
      ctx.moveTo(-11, -40);
      ctx.quadraticCurveTo(-18 - fl, -36, -22 - fl * 1.6, -28);
      ctx.quadraticCurveTo(-14 - fl * 0.5, -33, -8, -35);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -41, 11, 4.6, 0, 0, 6.283);
      ctx.fill();

      // head
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, -58 - bodyBob, 15, 0, 6.283);
      ctx.fill();

      // ears
      var earTilt = this.grounded ? Math.sin(this.runPhase) * 0.08 : -0.28;
      this._ear(ctx, -7, earTilt, bodyBob);
      this._ear(ctx, 7, earTilt + 0.1, bodyBob);

      // face
      ctx.fillStyle = '#2E2A26';
      if (!this.blinking) {
        ctx.beginPath(); ctx.arc(-5, -59 - bodyBob, 2.1, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(5, -59 - bodyBob, 2.1, 0, 6.283); ctx.fill();
      } else {
        ctx.strokeStyle = '#2E2A26'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-7, -59 - bodyBob); ctx.lineTo(-3, -59 - bodyBob);
        ctx.moveTo(3, -59 - bodyBob); ctx.lineTo(7, -59 - bodyBob); ctx.stroke();
      }
      // nose + cheeks
      ctx.fillStyle = '#F58EA8';
      ctx.beginPath(); ctx.arc(0, -54 - bodyBob, 1.8, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(245,142,168,0.5)';
      ctx.beginPath(); ctx.arc(-9, -54 - bodyBob, 2.6, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(9, -54 - bodyBob, 2.6, 0, 6.283); ctx.fill();

      // little arms while running
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-12, -30);
      ctx.quadraticCurveTo(-16, -24 + legSwing * 3, -13, -18 + legSwing * 4);
      ctx.moveTo(12, -30);
      ctx.quadraticCurveTo(16, -24 + legSwing2 * 3, 13, -18 + legSwing2 * 4);
      ctx.stroke();

      ctx.restore();

      // ---- buff visuals ----
      if (this.shield) {
        var pulse = 1 + Math.sin(this.runPhase * 0.9) * 0.05;
        ctx.strokeStyle = 'rgba(90,200,250,0.85)';
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(90,200,250,0.16)';
        ctx.beginPath();
        ctx.arc(x, y - 34, 42 * pulse, 0, 6.283);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.ellipse(x - 14, y - 52, 7, 4.5, -0.6, 0, 6.283);
        ctx.fill();
      }
      if (this.invincible > 0 && !this.shield) {
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 + Math.sin(RG.Utils.now() / 60) * 0.25) + ')';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y - 34, 40, 0, 6.283);
        ctx.stroke();
      }
      if (this.magnet > 0) {
        ctx.strokeStyle = 'rgba(242,85,85,0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.lineDashOffset = -RG.Utils.now() / 30;
        ctx.beginPath();
        ctx.arc(x, y - 30, RG.Config.magnetRadius * 0.6, 0, 6.283);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (this.boost > 0) {
        RG.Particles.speedLines(x - 26, y - 26);
      }
    },

    _ear: function (ctx, dx, tilt, bob) {
      ctx.save();
      ctx.translate(dx, -68 - bob);
      ctx.rotate(tilt);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(0, -13, 5.2, 16, 0, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = '#FBD3DC';
      ctx.beginPath();
      ctx.ellipse(0, -11, 2.4, 10.5, 0, 0, 6.283);
      ctx.fill();
      ctx.restore();
    },

    _foot: function (ctx, dx, swing, airH) {
      ctx.save();
      ctx.translate(dx, -8 - Math.max(0, swing) * 8 + Math.min(0, airH * 0.02));
      ctx.rotate(swing * 0.3);
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 4.6, 0, 0, 6.283);
      ctx.fill();
      ctx.restore();
    }
  };

  RG.Player = Player;
})();
