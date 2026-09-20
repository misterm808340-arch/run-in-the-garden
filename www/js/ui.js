/* Run in the Garden - UI controller: screens, HUD, power-up chips,
   countdown, toasts. All DOM-based, styled in style.css. */
(function () {
  'use strict';
  window.RG = window.RG || {};
  var $ = function (id) { return document.getElementById(id); };

  var SCREENS = ['screen-loading', 'screen-menu', 'screen-howto', 'screen-pause', 'screen-revive', 'screen-gameover'];

  var UI = {
    cb: null,
    _hudCache: { score: -1, coins: -1, dist: -1 },
    _puKeys: '',
    _countdownTimer: null,

    init: function (cb) {
      this.cb = cb;

      $('btn-play').addEventListener('click', cb.play);
      $('btn-howto').addEventListener('click', cb.howto);
      $('btn-howto-close').addEventListener('click', cb.howtoClose);
      $('btn-pause').addEventListener('click', cb.pause);
      $('btn-resume').addEventListener('click', cb.resume);
      $('btn-restart').addEventListener('click', cb.restart);
      $('btn-quit').addEventListener('click', cb.quit);
      $('btn-revive-ad').addEventListener('click', cb.reviveAd);
      $('btn-revive-no').addEventListener('click', cb.reviveNo);
      $('btn-again').addEventListener('click', cb.again);
      $('btn-go-menu').addEventListener('click', cb.quit);
      $('btn-double').addEventListener('click', cb.double);
      $('btn-sound').addEventListener('click', cb.masterSound);
      $('btn-music').addEventListener('click', cb.music);
      $('btn-sfx').addEventListener('click', cb.sfx);
      $('btn-privacy').addEventListener('click', function () {
        window.location.href = 'legal/privacy-policy.html';
      });
      $('btn-terms').addEventListener('click', function () {
        window.location.href = 'legal/terms-and-conditions.html';
      });

      // every button click gets feedback sound
      var ids = ['btn-play', 'btn-howto', 'btn-howto-close', 'btn-pause', 'btn-resume',
        'btn-restart', 'btn-quit', 'btn-revive-no', 'btn-again', 'btn-go-menu'];
      ids.forEach(function (id) {
        var el = $(id);
        if (el) el.addEventListener('pointerdown', function () { RG.Audio.sfx('btn'); });
      });
    },

    /* show one screen ('playing' hides all), sync HUD + banner */
    show: function (name) {
      var i, id;
      for (i = 0; i < SCREENS.length; i++) {
        $(SCREENS[i]).classList.add('hidden');
      }
      var map = {
        loading: 'screen-loading', menu: 'screen-menu', howto: 'screen-howto',
        paused: 'screen-pause', revive: 'screen-revive', gameover: 'screen-gameover'
      };
      if (map[name]) $(map[name]).classList.remove('hidden');

      var hudOn = (name === 'playing' || name === 'paused' || name === 'revive');
      $('hud').classList.toggle('hidden', !hudOn);
      document.body.classList.toggle('playing', name === 'playing');

      if (RG.AdMob) {
        if (name === 'menu' || name === 'howto' || name === 'gameover') RG.AdMob.showBanner();
        else RG.AdMob.hideBanner();
      }
    },

    /* ------------------------- HUD ------------------------- */
    updateHUD: function (score, coins, distM) {
      if (this._hudCache.score !== score) {
        this._hudCache.score = score;
        $('hud-score-val').textContent = RG.Utils.fmt(score);
      }
      if (this._hudCache.coins !== coins) {
        this._hudCache.coins = coins;
        $('hud-coins-val').textContent = coins;
      }
      var d = Math.floor(distM);
      if (this._hudCache.dist !== d) {
        this._hudCache.dist = d;
        $('hud-dist-val').textContent = d + 'm';
      }
    },

    /* power-up chips: list [{kind, remaining, dur}] */
    setPowerups: function (list) {
      var key = list.map(function (p) { return p.kind; }).join(',');
      var wrap = $('hud-powerups');
      if (key !== this._puKeys) {
        this._puKeys = key;
        var html = '';
        for (var i = 0; i < list.length; i++) {
          var p = list[i];
          html += '<div class="pu-chip ' + p.kind + '" id="pu-chip-' + p.kind + '">' +
            '<span class="ring" style="--pc:' + this._puColor(p.kind) + '">' +
            '<svg viewBox="0 0 24 24" fill="#fff">' + this._puSvg(p.kind) + '</svg></span>' +
            '<span id="pu-time-' + p.kind + '">' + this._puLabel(p) + '</span></div>';
        }
        wrap.innerHTML = html;
      }
      for (var j = 0; j < list.length; j++) {
        var q = list[j];
        var chip = $('pu-chip-' + q.kind);
        if (!chip) continue;
        var pct = q.dur > 0 ? (q.remaining / q.dur * 100) : 100;
        chip.querySelector('.ring').style.setProperty('--deg', pct.toFixed(1));
        var t = $('pu-time-' + q.kind);
        if (t) t.textContent = this._puLabel(q);
      }
    },

    _puLabel: function (p) {
      if (p.dur <= 0) return 'Ready';
      return Math.ceil(p.remaining) + 's';
    },
    _puColor: function (k) {
      return { shield: '#5AC8FA', magnet: '#F25555', boost: '#FF9F1C', x2: '#FFC93C' }[k];
    },
    _puSvg: function (k) {
      switch (k) {
        case 'shield': return '<path d="M12 3l7 3v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6z"/>';
        case 'magnet': return '<path d="M6 4h4v8a2 2 0 004 0V4h4v8a6 6 0 01-12 0z"/>';
        case 'boost': return '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>';
        default: return '<circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="2.5"/><text x="12" y="15.5" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">2X</text>';
      }
    },

    /* ------------------------- panels ------------------------- */
    populatePause: function (score, distM, coins) {
      $('pause-score').textContent = RG.Utils.fmt(score);
      $('pause-dist').textContent = Math.floor(distM) + 'm';
      $('pause-coins').textContent = coins;
    },

    populateGameOver: function (o) {
      $('go-score').textContent = RG.Utils.fmt(o.score);
      $('go-best').textContent = 'Best ' + RG.Utils.fmt(o.best);
      $('go-dist').textContent = Math.floor(o.distM) + 'm';
      $('go-coins').textContent = o.coins;
      $('go-newbest').classList.toggle('hidden', !o.newBest);
      var b = $('btn-double');
      b.disabled = !o.canDouble;
      $('btn-double-txt').textContent = o.doubled ? 'Coins doubled!' : 'Double Coins - Watch Ad';
      $('go-ads-note').textContent = RG.AdMob.mode === 'native'
        ? 'AdMob test ads enabled' : 'AdMob test ads (simulated here)';
    },

    reviveTick: function (n) {
      $('revive-count').textContent = n;
    },

    updateMenuStats: function (best, bank) {
      $('menu-best').textContent = 'Best ' + RG.Utils.fmt(best);
      $('menu-bank').textContent = RG.Utils.fmt(bank);
    },

    setSoundButtons: function (musicOn, sfxOn) {
      $('btn-music').textContent = 'Music: ' + (musicOn ? 'On' : 'Off');
      $('btn-sfx').textContent = 'Sound: ' + (sfxOn ? 'On' : 'Off');
      document.body.classList.toggle('muted', !musicOn && !sfxOn);
    },

    /* ------------------------- helpers ------------------------- */
    toast: function (msg) {
      var t = $('toast');
      t.textContent = msg;
      t.classList.remove('hidden');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 1400);
    },

    /* big 3-2-1 countdown; onDone called after final tick */
    countdown: function (onDone) {
      var self = this;
      var n = 3;
      var cd = $('countdown');
      var num = $('countdown-num');
      cd.classList.remove('hidden');
      var step = function () {
        if (n <= 0) {
          cd.classList.add('hidden');
          clearInterval(self._countdownTimer);
          onDone();
          return;
        }
        num.textContent = n;
        num.style.animation = 'none';
        void num.offsetWidth;
        num.style.animation = '';
        RG.Audio.sfx(n === 1 ? 'go' : 'tick');
        n--;
      };
      step();
      this._countdownTimer = setInterval(step, 900);
    },

    cancelCountdown: function () {
      clearInterval(this._countdownTimer);
      $('countdown').classList.add('hidden');
    }
  };

  RG.UI = UI;
})();
