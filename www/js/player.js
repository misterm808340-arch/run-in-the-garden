/* Run in the Garden - player: a cheerful garden bunny seen FROM BEHIND,
   running forward into the garden (Subway-Surfers style).
   Physics: lane lerp, jump with coyote-time & input buffering,
   squash & stretch, run cycle, power-up visuals. */
(function () {
  'use strict';
  window.RG = window.RG || {};
  var U, C;

  var Player = {
    lat: 0, latTarget: 0,          // lateral: -1 left lane .. +1 right lane
    jumpH: 0, vy: 0,               // height above the path (up positive)
    grounded: true,
    runPhase: 0,
    squash: 0,
    coyote: 0, buffer: 0,
    // buffs (managed by game, mirrored here for drawing)
    shield: false, invincible: 0,
    magnet: 0, boost: 0, x2: 0,
    scarfT: 0,

    reset: function (view) {
      C = RG.Config;
      U = RG.Utils;
      this._view = view || this._view;
      this.lat = 0; this.latTarget = 0;
      this.jumpH = 0; this.vy = 0;
      this.grounded = true;
      this.runPhase = 0;
      this.squash = 0;
      this.coyote = 0; this.buffer = 0;
      this.shield = false; this.invincible = 0;
      this.magnet = 0; this.boost = 0; this.x2 = 0;
    },

    moveLane: function (dir, view) {
      var nl = U.clamp(this.latTarget + dir, -1, 1);
      if (nl !== this.latTarget) {
        this.latTarget = nl;
        RG.Audio.sfx('whoosh');
      }
    },

    tryJump: function (view) {
      this.buffer = C.player.bufferMs / 1000;
      this._consumeJump(view);
    },

    _consumeJump: function (view) {
      if (this.buffer > 0 && (this.grounded || this.coyote > 0)) {
        this.vy = C.player.jumpV;
        this.grounded = false;
        this.coyote = 0;
        this.buffer = 0;
        RG.Audio.sfx('jump');
        RG.Particles.dust(this._px(view), (view || this._view || { baseY: 560 }).baseY, 6);
      }
    },

    /* screen x of the bunny (logical units) */
    _px: function (view) {
      var v = view || this._view;
      var lane = (v && v.laneSpan) || 100;
      var cx = (v && v.cx) || 200;
      return cx + this.lat * lane;
    },

    update: function (dt, view) {
      // lane easing
      this.lat = U.damp(this.lat, this.latTarget, C.player.laneLerp, dt);
      if (Math.abs(this.lat - this.latTarget) < 0.004) this.lat = this.latTarget;

      // vertical physics (up positive)
      if (!this.grounded) {
        this.vy -= C.player.gravity * dt;
        this.jumpH += this.vy * dt;
        if (this.jumpH <= 0) {
          this.jumpH = 0;
          if (this.vy < -250) {
            this.squash = Math.min(1, -this.vy / 900);
            RG.Audio.sfx('land');
            RG.Particles.dust(this._px(view), view.baseY, 5);
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
      this.scarfT += dt * 9;

      if (this.buffer > 0 && (this.grounded || this.coyote > 0)) this._consumeJump(view);
    },

    /* current collision info used by the 3D entity checks */
    box: function () {
      return { lat: this.lat, jumpH: this.jumpH, w: this.w, h: this.h };
    },

    rect: function () { return this.box(); },

    render: function (ctx, view) {
      this._view = view;
      var SC = (RG.Config.view3d.playerScale || 1);
      var x = this._px(view);
      var groundY = view.baseY;
      var y = groundY - this.jumpH;
      var bob = this.grounded ? Math.abs(Math.sin(this.runPhase)) * 3 : 0;
      var sq = this.squash;
      var lean = U.clamp((this.latTarget - this.lat) * 0.55, -0.3, 0.3);

      // shadow on the path (shrinks while airborne)
      var airK = U.clamp(1 - this.jumpH / 260, 0.35, 1);
      ctx.fillStyle = 'rgba(30,70,30,0.28)';
      ctx.beginPath();
      ctx.ellipse(x, groundY + 3, 22 * airK * SC, 6.5 * airK * SC, 0, 0, 6.283);
      ctx.fill();

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(SC, SC);

      // jump stretch / landing squash
      if (!this.grounded) {
        var st = U.clamp(this.vy / 1400, -0.12, 0.16);
        ctx.scale(1 - st, 1 + st);
      } else if (sq > 0) {
        ctx.scale(1 + sq * 0.14, 1 - sq * 0.16);
      }
      ctx.rotate(lean);

      var legSwing = this.grounded ? Math.sin(this.runPhase) : 0.6;
      var legSwing2 = this.grounded ? Math.sin(this.runPhase + Math.PI) : -0.4;
      var bodyBob = this.grounded ? Math.sin(this.runPhase * 2) * 1.5 : 0;

      // feet (visible from behind, pumping)
      ctx.fillStyle = '#F0F0EA';
      this._foot(ctx, -10, legSwing);
      this._foot(ctx, 10, legSwing2);

      // little arms pumping (seen from behind)
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-12, -30);
      ctx.quadraticCurveTo(-17, -24 + legSwing * 3, -14, -18 + legSwing * 4);
      ctx.moveTo(12, -30);
      ctx.quadraticCurveTo(17, -24 + legSwing2 * 3, 14, -18 + legSwing2 * 4);
      ctx.stroke();

      // body
      var g = ctx.createLinearGradient(0, -58, 0, -12);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(1, '#EFEDE4');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, -26 - bodyBob * 0.4, 17, 20, 0, 0, 6.283);
      ctx.fill();

      // tail puff
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, -14 - bodyBob * 0.3 + Math.sin(this.runPhase) * 1.2, 7.5, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = '#F4F2EA';
      ctx.beginPath();
      ctx.arc(1.5, -12.5 - bodyBob * 0.3, 4.5, 0, 6.283);
      ctx.fill();

      // scarf flying back toward the camera
      var fl = Math.sin(this.scarfT) * 3;
      ctx.fillStyle = '#F25555';
      ctx.beginPath();
      ctx.moveTo(-9, -38);
      ctx.quadraticCurveTo(-12 - fl, -28, -8 - fl * 1.4, -16);
      ctx.quadraticCurveTo(-2 - fl * 0.4, -24, 9, -38);
      ctx.quadraticCurveTo(0, -33, -9, -38);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -40 - bodyBob * 0.4, 11, 4.6, 0, 0, 6.283);
      ctx.fill();

      // head (back of the head)
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, -58 - bodyBob, 15, 0, 6.283);
      ctx.fill();

      // ears (both visible from behind, pink inner edges peeking)
      var earTilt = this.grounded ? Math.sin(this.runPhase) * 0.08 : -0.28;
      this._ear(ctx, -7, earTilt, bodyBob, 1);
      this._ear(ctx, 7, earTilt + 0.1, bodyBob, -1);

      ctx.restore();

      // ---- buff visuals ----
      if (this.shield) {
        var pulse = 1 + Math.sin(this.runPhase * 0.9) * 0.05;
        ctx.strokeStyle = 'rgba(90,200,250,0.85)';
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(90,200,250,0.16)';
        ctx.beginPath();
        ctx.arc(x, y - 34 * SC, 42 * SC * pulse, 0, 6.283);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.ellipse(x - 14 * SC, y - 52 * SC, 7 * SC, 4.5 * SC, -0.6, 0, 6.283);
        ctx.fill();
      }
      if (this.invincible > 0 && !this.shield) {
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 + Math.sin(RG.Utils.now() / 60) * 0.25) + ')';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y - 34 * SC, 40 * SC, 0, 6.283);
        ctx.stroke();
      }
      if (this.magnet > 0) {
        ctx.strokeStyle = 'rgba(242,85,85,0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.lineDashOffset = -RG.Utils.now() / 30;
        ctx.beginPath();
        ctx.arc(x, y - 30 * SC, RG.Config.view3d.magnetZ * 0.9, 0, 6.283);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (this.boost > 0) {
        RG.Particles.speedLines(x, y - 26 * SC);
      }
    },

    _ear: function (ctx, dx, tilt, bob, innerSide) {
      ctx.save();
      ctx.translate(dx, -68 - bob);
      ctx.rotate(tilt);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(0, -13, 5.2, 16, 0, 0, 6.283);
      ctx.fill();
      // inner pink barely visible on the inner edge
      ctx.fillStyle = '#FBD3DC';
      ctx.beginPath();
      ctx.ellipse(innerSide * 1.6, -11, 1.6, 10, 0, 0, 6.283);
      ctx.fill();
      ctx.restore();
    },

    _foot: function (ctx, dx, swing) {
      ctx.save();
      ctx.translate(dx, -8 - Math.max(0, swing) * 8);
      ctx.rotate(swing * 0.3);
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 4.6, 0, 0, 6.283);
      ctx.fill();
      ctx.restore();
    }
  };

  RG.Player = Player;
})();
