/* Run in the Garden - main game orchestrator.
   Canvas scaling, game loop, state machine (menu/howto/playing/paused/
   revive/gameover), scoring, power-up effects, crash/revive flow,
   persistence and service-worker registration. */
(function () {
  'use strict';
  window.RG = window.RG || {};
  var U, C, A;

  var Game = {
    state: 'loading',
    canvas: null, ctx: null, dpr: 1, scale: 1,
    view: { w: 400, h: 700, horizonY: 252, baseY: 560, cx: 200, laneSpan: 100, trackHalfW: 150, camD: 5.8, zFar: 100 },

    dist: 0, elapsed: 0, coinsRun: 0, coinScore: 0,
    pu: { magnet: 0, boost: 0, x2: 0 },
    slowUntil: 0, reviveUsed: false, doubledUsed: false,
    reviveTimer: null,
    shakeT: 0, menuDist: 0,
    _lastTs: 0, _hudT: 0,

    /* ============================ boot ============================ */
    boot: function () {
      U = RG.Utils; C = RG.Config; A = RG.Audio;
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');

      RG.Storage.load && RG.Storage.load();
      A.init();
      RG.World.init();
      RG.Particles.reset();
      RG.Entities.reset();

      var self = this;
      RG.Input.init({
        left: function () { if (self.state === 'playing') RG.Player.moveLane(-1, self.view); },
        right: function () { if (self.state === 'playing') RG.Player.moveLane(1, self.view); },
        jump: function () { if (self.state === 'playing') RG.Player.tryJump(self.view); },
        pause: function () {
          if (self.state === 'playing') self.doPause();
          else if (self.state === 'paused') self.doResume();
        }
      });

      RG.UI.init({
        play: function () { self.startRun(); },
        howto: function () { self.state = 'howto'; RG.UI.show('howto'); },
        howtoClose: function () { self.toMenu(); },
        pause: function () { if (self.state === 'playing') self.doPause(); },
        resume: function () { self.doResume(); },
        restart: function () { self.startRun(); },
        quit: function () { self.toMenu(); },
        reviveAd: function () { self.watchReviveAd(); },
        reviveNo: function () { self.declineRevive(); },
        again: function () { self.startRun(); },
        double: function () { self.watchDoubleAd(); },
        music: function () {
          A.setMusic(!A.musicOn);
          RG.UI.setSoundButtons(A.musicOn, A.sfxOn);
        },
        sfx: function () {
          A.setSfx(!A.sfxOn);
          RG.UI.setSoundButtons(A.musicOn, A.sfxOn);
        },
        masterSound: function () {
          var on = !(A.musicOn || A.sfxOn);
          A.setMusic(on); A.setSfx(on);
          RG.UI.setSoundButtons(A.musicOn, A.sfxOn);
        }
      });

      RG.AdMob.init();
      RG.Player.reset(this.view);
      this.resize();
      window.addEventListener('resize', function () { self.resize(); });
      window.addEventListener('orientationchange', function () { setTimeout(function () { self.resize(); }, 250); });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden && self.state === 'playing') self.doPause();
      });
      document.addEventListener('pointerdown', function () { A.unlock(); }, { once: false });

      this.toMenu(true);
      this.registerSW();

      this._lastTs = U.now();
      requestAnimationFrame(this._loop.bind(this));
    },

    registerSW: function () {
      try {
        var Cap = window.Capacitor;
        if (Cap && Cap.isNativePlatform && Cap.isNativePlatform()) return; // native needs no SW
        if (!('serviceWorker' in navigator)) return;
        if (location.protocol !== 'https:' && location.protocol !== 'http:') return;
        navigator.serviceWorker.register('sw.js').catch(function () {});
      } catch (e) { /* offline PWA optional on file:// */ }
    },

    /* ============================ view ============================ */
    resize: function () {
      var cssW = window.innerWidth, cssH = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2); // cap for perf
      this.canvas.width = Math.round(cssW * this.dpr);
      this.canvas.height = Math.round(cssH * this.dpr);
      this.scale = this.canvas.width / C.logicalW;
      var h = this.canvas.height / this.scale;
      var V3 = C.view3d;
      this.view.w = C.logicalW;
      this.view.h = h;
      this.view.horizonY = h * V3.horizonFrac;
      this.view.baseY = h * V3.baseFrac;
      this.view.cx = C.logicalW / 2;
      this.view.laneSpan = V3.laneSpan;
      this.view.trackHalfW = V3.trackHalfW;
      this.view.camD = V3.camD;
      this.view.zFar = V3.zFar;
      RG.World.resize(C.logicalW, h, this.view.horizonY, this.view.baseY);
    },

    /* player position on screen (logical units) - used by fx */
    playerScreen: function () {
      var p = RG.Player;
      var SC = (C.view3d.playerScale || 1);
      return {
        x: this.view.cx + p.lat * this.view.laneSpan,
        y: this.view.baseY - p.jumpH - 30 * SC
      };
    },

    /* ============================ states ============================ */
    toMenu: function (first) {
      this.state = 'menu';
      this.cancelReviveTimer();
      RG.UI.cancelCountdown();
      RG.Entities.reset();
      RG.Particles.reset();
      RG.Player.reset(this.view);
      RG.UI.updateMenuStats(RG.Storage.get('bestScore'), RG.Storage.get('coinBank'));
      RG.UI.setSoundButtons(A.musicOn, A.sfxOn);
      RG.UI.show('menu');
    },

    startRun: function () {
      A.unlock();
      this.dist = 0; this.elapsed = 0;
      this.coinsRun = 0; this.coinScore = 0;
      this.pu.magnet = 0; this.pu.boost = 0; this.pu.x2 = 0;
      this.slowUntil = 0;
      this.reviveUsed = false; this.doubledUsed = false;
      this.shakeT = 0;
      RG.Entities.reset();
      RG.Particles.reset();
      RG.Player.reset(this.view);
      this.state = 'countdown';
      RG.UI.show('playing');
      RG.UI.updateHUD(0, 0, 0);
      RG.UI.setPowerups([]);
      var self = this;
      RG.UI.countdown(function () {
        self.state = 'playing';
      });
    },

    doPause: function () {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      RG.UI.populatePause(this.scoreNow(), this.dist * C.metersPerUnit, this.coinsRun);
      RG.UI.setSoundButtons(A.musicOn, A.sfxOn);
      RG.UI.show('paused');
    },

    doResume: function () {
      if (this.state !== 'paused') return;
      var self = this;
      this.state = 'countdown';
      RG.UI.show('playing');
      RG.UI.countdown(function () { self.state = 'playing'; });
    },

    /* ============================ scoring ============================ */
    speedNow: function () {
      var base = Math.min(C.speedStart + C.speedGainPerSec * this.elapsed, C.speedMax);
      var s = base;
      if (this.pu.boost > 0) s *= C.boostMul;
      if (U.now() < this.slowUntil) s *= C.slowMul;
      return s;
    },

    scoreNow: function () {
      return Math.floor(this.dist * C.metersPerUnit) * C.scorePerMeter + this.coinScore;
    },

    /* ============================ loop ============================ */
    _loop: function (ts) {
      var dt = Math.min((ts - this._lastTs) / 1000, 0.05);
      this._lastTs = ts;
      this.update(dt);
      this.render(dt);
      requestAnimationFrame(this._loop.bind(this));
    },

    update: function (dt) {
      var menuLike = (this.state === 'menu' || this.state === 'howto' || this.state === 'loading');
      var trackPos = menuLike ? this.menuDist : this.dist * C.view3d.zSpeedK;
      RG.World.update(dt, this.speedNow(), !menuLike, trackPos);

      if (menuLike) {
        this.menuDist += dt * 40;
        RG.Player.runPhase += dt * 9;
        RG.Particles.update(dt);
        return;
      }
      if (this.state !== 'playing') {
        RG.Particles.update(dt);
        if (this.shakeT > 0) this.shakeT -= dt;
        return;
      }

      /* ---- playing ---- */
      this.elapsed += dt;
      var speed = this.speedNow();
      this.dist += speed * dt;

      RG.Player.update(dt, this.view);
      RG.Entities.update(dt, this.view, speed, this.dist, RG.Player.magnet > 0);

      // power-up timers
      var p = RG.Player;
      if (this.pu.magnet > 0) { this.pu.magnet -= dt; if (this.pu.magnet <= 0) { this.pu.magnet = 0; } }
      if (this.pu.boost > 0) { this.pu.boost -= dt; if (this.pu.boost <= 0) this.pu.boost = 0; }
      if (this.pu.x2 > 0) { this.pu.x2 -= dt; if (this.pu.x2 <= 0) this.pu.x2 = 0; }
      p.magnet = this.pu.magnet > 0 ? this.pu.magnet : 0;
      p.boost = this.pu.boost > 0 ? this.pu.boost : 0;
      p.x2 = this.pu.x2 > 0 ? this.pu.x2 : 0;

      this._collide(dt);
      RG.Particles.update(dt);
      if (this.shakeT > 0) this.shakeT -= dt;
      this._hud();
    },

    _hud: function () {
      this._hudT -= 1;
      RG.UI.updateHUD(this.scoreNow(), this.coinsRun, this.dist * C.metersPerUnit);
      var list = [];
      if (RG.Player.shield) list.push({ kind: 'shield', remaining: 1, dur: 0 });
      if (this.pu.magnet > 0) list.push({ kind: 'magnet', remaining: this.pu.magnet, dur: C.puDur.magnet });
      if (this.pu.boost > 0) list.push({ kind: 'boost', remaining: this.pu.boost, dur: C.puDur.boost });
      if (this.pu.x2 > 0) list.push({ kind: 'x2', remaining: this.pu.x2, dur: C.puDur.x2 });
      RG.UI.setPowerups(list);
    },

    _collide: function (dt) {
      var p = RG.Player;

      /* pickups */
      var got = RG.Entities.collect(p);
      for (var i = 0; i < got.length; i++) {
        var e = got[i];
        var ex = e.sx, ey = e.sy - e.y * e.s * 0.55;
        if (e.kind === 'coin' || e.kind === 'star') {
          var base = e.kind === 'coin' ? C.coinValue : C.starValue;
          var v = base * (this.pu.x2 > 0 ? 2 : 1);
          this.coinScore += v;
          this.coinsRun += e.kind === 'coin' ? 1 : 5;
          A.sfx(e.kind === 'coin' ? 'coin' : 'star');
          RG.Particles.coinBurst(ex, ey, e.kind === 'coin' ? '#FFC93C' : '#FFD84D');
          RG.Particles.text(ex, ey - 14, '+' + v, e.kind === 'coin' ? '#FFE27A' : '#FFD84D');
        } else if (e.kind === 'pu') {
          this._applyPowerup(e.pu, ex, ey);
        }
      }

      /* obstacles */
      var o = RG.Entities.hitObstacle(p);
      if (!o) return;
      var ox = o.sx, oy = o.sy - o.h * (o.vs || o.s) * 0.5;

      if (o.kind === 'puddle') {
        // run through it (grounded) = splash + brief slow-down; jumping over = clean
        if (p.grounded && U.now() >= this.slowUntil) {
          this.slowUntil = U.now() + C.slowDur * 1000;
          A.sfx('splash');
          RG.Particles.splash(o.sx, o.sy);
        }
        return;
      }

      if (this.pu.boost > 0) {                       // dash smashes everything
        A.sfx('smash');
        RG.Particles.smash(ox, oy);
        RG.Particles.text(ox, oy - 16, '+' + C.boostSmashBonus, '#FF9F1C');
        this.coinScore += C.boostSmashBonus;
        RG.Entities.removeObstacle(o);
        this.shakeT = 0.12;
        return;
      }
      if (p.invincible > 0) return;                  // post-revive grace

      if (p.shield) {                                // shield absorbs one hit
        p.shield = false;
        p.invincible = C.player.invincibleAfterShieldSec;
        A.sfx('shieldBreak');
        RG.Particles.powerBurst(ox, oy, '#5AC8FA');
        RG.Entities.removeObstacle(o);
        RG.UI.toast('Shield saved you!');
        return;
      }

      this.crash(o);
    },

    _applyPowerup: function (kind, x, y) {
      var p = RG.Player;
      switch (kind) {
        case 'shield':
          p.shield = true;
          RG.UI.toast('Shield!');
          break;
        case 'magnet':
          this.pu.magnet = C.puDur.magnet;
          RG.UI.toast('Magnet!');
          break;
        case 'boost':
          this.pu.boost = C.puDur.boost;
          RG.UI.toast('Speed Boost!');
          break;
        case 'x2':
          this.pu.x2 = C.puDur.x2;
          RG.UI.toast('Double Coins!');
          break;
      }
      A.sfx('power');
      RG.Particles.powerBurst(x, y, { shield: '#5AC8FA', magnet: '#F25555', boost: '#FF9F1C', x2: '#FFC93C' }[kind]);
    },

    /* ============================ crash / revive ============================ */
    crash: function (o) {
      var p = RG.Player;
      var ps = this.playerScreen();
      A.sfx('hit');
      RG.Particles.crash(ps.x, ps.y);
      this.shakeT = 0.4;
      this.cancelReviveTimer();

      if (!this.reviveUsed) {
        this.state = 'revive';
        RG.UI.show('revive');
        this._reviveCount = C.ads.reviveTimerSec;
        RG.UI.reviveTick(this._reviveCount);
        var self = this;
        this.reviveTimer = setInterval(function () {
          self._reviveCount--;
          if (self._reviveCount <= 0) { self.declineRevive(); return; }
          RG.UI.reviveTick(self._reviveCount);
          A.sfx('tick');
        }, 1000);
      } else {
        this.gameOver();
      }
    },

    cancelReviveTimer: function () {
      if (this.reviveTimer) { clearInterval(this.reviveTimer); this.reviveTimer = null; }
    },

    watchReviveAd: function () {
      var self = this;
      this.cancelReviveTimer();
      A.sfx('btn');
      RG.AdMob.showRewarded(
        function () { self.reviveRun(); },               // reward earned
        function () { /* ad closed */ },
        function () {                                    // failed: stay on panel
          RG.UI.toast('Ad not ready - try again');
          self.state = 'revive';
          RG.UI.show('revive');
          self._reviveCount = C.ads.reviveTimerSec;
          RG.UI.reviveTick(self._reviveCount);
          self.reviveTimer = setInterval(function () {
            self._reviveCount--;
            if (self._reviveCount <= 0) { self.declineRevive(); return; }
            RG.UI.reviveTick(self._reviveCount);
          }, 1000);
        }
      );
    },

    reviveRun: function () {
      this.cancelReviveTimer();
      this.reviveUsed = true;
      A.sfx('revive');
      var p = RG.Player;
      p.reset(this.view);
      p.invincible = C.player.invincibleAfterReviveSec;
      RG.Entities.clearAhead(this.view);
      this.slowUntil = 0;
      this.pu.boost = 0;
      var self = this;
      this.state = 'countdown';
      RG.UI.show('playing');
      RG.UI.countdown(function () { self.state = 'playing'; });
    },

    declineRevive: function () {
      this.cancelReviveTimer();
      this.gameOver();
    },

    /* ============================ game over ============================ */
    gameOver: function () {
      this.state = 'gameover';
      var score = this.scoreNow();
      var distM = Math.floor(this.dist * C.metersPerUnit);
      var newBest = RG.Storage.recordRun(score, distM, this.coinsRun);
      if (newBest) A.sfx('best');
      A.sfx('gameover');

      var self = this;
      var openPanel = function () {
        RG.UI.populateGameOver({
          score: score, best: RG.Storage.get('bestScore'),
          newBest: newBest, distM: distM, coins: self.coinsRun,
          canDouble: self.coinsRun > 0 && !self.doubledUsed,
          doubled: self.doubledUsed
        });
        RG.UI.show('gameover');
      };
      RG.AdMob.maybeInterstitial(openPanel);
    },

    watchDoubleAd: function () {
      var self = this;
      if (this.doubledUsed) return;
      A.sfx('btn');
      RG.AdMob.showRewarded(
        function () {
          self.doubledUsed = true;
          var extra = self.coinsRun;
          self.coinsRun *= 2;
          self.coinScore *= 2;
          RG.Storage.set('coinBank', RG.Storage.get('coinBank') + extra);
          RG.UI.populateGameOver({
            score: self.scoreNow(), best: RG.Storage.get('bestScore'),
            newBest: false, distM: Math.floor(self.dist * C.metersPerUnit),
            coins: self.coinsRun, canDouble: false, doubled: true
          });
          RG.UI.toast('Coins doubled!');
          A.sfx('best');
        },
        null,
        function () { RG.UI.toast('Ad not ready - try again'); }
      );
    },

    /* ============================ render ============================ */
    render: function (dt) {
      var ctx = this.ctx;
      var v = this.view;
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

      var menuLike = (this.state === 'menu' || this.state === 'howto' || this.state === 'loading');
      var camDist = menuLike ? this.menuDist : this.dist * C.view3d.zSpeedK;

      // screen shake
      if (this.shakeT > 0) {
        var s = this.shakeT * 10;
        ctx.translate(U.rand(-s, s), U.rand(-s, s));
      }

      var cam = {
        w: v.w, h: v.h,
        horizonY: v.horizonY, baseY: v.baseY,
        laneSpan: v.laneSpan, trackHalfW: v.trackHalfW,
        cx: v.cx, camD: v.camD, zFar: v.zFar,
        dist: camDist
      };
      RG.World.render(ctx, cam);

      if (!menuLike) {
        RG.Entities.render(ctx, v);
      }

      RG.Player.render(ctx, v);
      RG.Particles.render(ctx);
      RG.World.renderFront(ctx, cam);
    }
  };

  RG.Game = Game;

  /* boot once DOM is ready */
  function ready() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { Game.boot(); });
    } else {
      Game.boot();
    }
  }
  ready();

  /* small debug/automation hooks (used by screenshots & QA) */
  window.RG_DEBUG = {
    start: function () { Game.startRun(); },
    menu: function () { Game.toMenu(); },
    kill: function () { if (Game.state === 'playing') Game.crash({ kind: 'rock', sx: 0, sy: 0, h: 40, s: 1 }); },
    finish: function () { if (Game.state === 'playing' || Game.state === 'revive') { Game.cancelReviveTimer(); Game.gameOver(); } },
    pu: function (k) {
      if (k === 'shield') RG.Player.shield = true;
      else Game._applyPowerup(k || 'magnet', RG.Player.lat, 0);
    },
    game: function () { return Game; }
  };
})();
