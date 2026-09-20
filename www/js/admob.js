/* Run in the Garden - AdMob TEST MODE integration.
   ------------------------------------------------------------
   - Uses Google's OFFICIAL test ad unit IDs (always safe to click).
   - When wrapped with Capacitor + @capacitor-community/admob (real
     device build), it talks to the native AdMob SDK.
   - In a plain browser / PWA preview it runs a clearly-labelled
     "Test Ad" simulation so the whole flow is testable offline.
   Formats: banner (menus), interstitial (every 3rd game over),
   rewarded (revive + double coins), app open (native cold start).
   ------------------------------------------------------------ */
(function () {
  'use strict';
  window.RG = window.RG || {};
  var U, CFG;

  var AdMob = {
    mode: 'web-sim',        // 'native' | 'web-sim'
    plugin: null,
    ready: false,
    bannerVisible: false,
    _lastAdAt: 0,
    _interstitialReady: false,
    _rewardedReady: false,

    /* ============================ init ============================ */
    init: function () {
      U = RG.Utils;
      CFG = RG.Config.ads;
      this._buildDom();

      var Cap = window.Capacitor;
      var isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
      if (isNative) {
        this.plugin = (Cap.Plugins && Cap.Plugins.AdMob) || null;
        if (this.plugin) {
          this.mode = 'native';
          this._nativeInit();
        }
      }
      this._updateBadge();
    },

    _nativeInit: function () {
      var self = this;
      var p = this.plugin;
      try {
        Promise.resolve(p.initialize({
          initializeForTesting: true,          // TEST MODE
          maxAdContentRating: 'G',
          tagForChildDirectedTreatment: true,
          tagForUnderAgeOfConsent: true
        })).then(function () {
          self.ready = true;
          self._preload();
          if (CFG.appOpenEnabled) self._showAppOpen();
        }).catch(function (err) {
          // fall back to simulation so the game flow keeps working
          self.mode = 'web-sim';
          self._updateBadge();
          if (window.console) console.warn('[AdMob] native init failed, using sim:', err);
        });
      } catch (e) {
        this.mode = 'web-sim';
        this._updateBadge();
      }
    },

    _preload: function () {
      var p = this.plugin, self = this;
      try {
        Promise.resolve(p.prepareInterstitial({ adId: CFG.ids.interstitial }))
          .then(function () { self._interstitialReady = true; })
          .catch(function () {});
        Promise.resolve(p.prepareRewardVideoAd({ adId: CFG.ids.rewarded }))
          .then(function () { self._rewardedReady = true; })
          .catch(function () {});
      } catch (e) { /* non-critical */ }
    },

    _showAppOpen: function () {
      var p = this.plugin;
      if (!p) return;
      try {
        Promise.resolve(p.prepareAppOpenAd({ adId: CFG.ids.appOpen }))
          .then(function () { return p.showAppOpenAd(); })
          .catch(function () { /* app open is optional */ });
      } catch (e) { /* optional format */ }
    },

    _updateBadge: function () {
      var b = document.getElementById('ads-badge');
      if (b) {
        b.textContent = this.mode === 'native'
          ? 'ADMOB TEST MODE (NATIVE)'
          : 'ADMOB TEST MODE';
      }
    },

    /* ============================ banner ============================ */
    showBanner: function () {
      if (this.bannerVisible) return;
      this.bannerVisible = true;
      if (this.mode === 'native' && this.plugin) {
        try {
          // BannerAdPosition.BOTTOM_CENTER = 8, BannerAdSize.ADAPTIVE_BANNER = 4
          Promise.resolve(this.plugin.showBanner({
            adId: CFG.ids.banner, position: 8, adSize: 4, margin: 0
          })).catch(function () {});
        } catch (e) { /* non-critical */ }
      } else {
        var el = document.getElementById('ad-sim-banner');
        if (el) el.classList.remove('hidden');
      }
    },

    hideBanner: function () {
      if (!this.bannerVisible) return;
      this.bannerVisible = false;
      if (this.mode === 'native' && this.plugin) {
        try {
          Promise.resolve(this.plugin.hideBanner()).catch(function () {});
        } catch (e) { /* non-critical */ }
      } else {
        var el = document.getElementById('ad-sim-banner');
        if (el) el.classList.add('hidden');
      }
    },

    /* ========================= interstitial ========================= */
    /* Called on game over. Returns true if an ad is being shown. */
    maybeInterstitial: function (onDone) {
      var st = RG.Storage;
      var now = Date.now(); // epoch - must survive page reloads
      if (st.get('gamesPlayed') % CFG.interstitialEveryN !== 0 ||
          now - st.get('adsLastShownAt') < CFG.interstitialMinGapMs) {
        if (onDone) onDone();
        return false;
      }
      st.set('adsLastShownAt', now);
      this.showInterstitial(onDone);
      return true;
    },

    showInterstitial: function (onDone) {
      var self = this;
      if (this.mode === 'native' && this.plugin) {
        var p = this.plugin;
        var finish = function () { if (onDone) onDone(); };
        try {
          var handler = function () {
            finish();
            self._preload();
          };
          if (p.addListener && window.Capacitor &&
              window.Capacitor.Plugins && p.addListener) {
            // listen once for dismissal (event name differs across plugin versions)
            var off1, off2;
            try { off1 = p.addListener('interstitialDidDismiss', handler); } catch (e) {}
            try { off2 = p.addListener('onInterstitialDismissed', handler); } catch (e) {}
          }
          Promise.resolve(p.showInterstitial())
            .then(function () { self._preload(); setTimeout(finish, 30000); })
            .catch(function () { finish(); });
          // safety: never block the flow
          setTimeout(finish, 30000);
        } catch (e) { if (onDone) onDone(); }
      } else {
        this._simAd('interstitial', onDone);
      }
    },

    /* =========================== rewarded =========================== */
    showRewarded: function (onReward, onDone, onFail) {
      var self = this;
      var done = function (rewarded) {
        if (rewarded && onReward) onReward();
        if (onDone) onDone();
      };
      if (this.mode === 'native' && this.plugin) {
        var p = this.plugin;
        try {
          Promise.resolve(p.prepareRewardVideoAd({ adId: CFG.ids.rewarded }))
            .then(function () { return p.showRewardVideoAd(); })
            .then(function (rewardItem) {
              // v6 resolves with the reward item when earned
              done(!!rewardItem);
              self._rewardedReady = false;
              self._preload();
            })
            .catch(function () {
              // failed to load/show - treat as "no reward", keep flow alive
              if (onFail) onFail(); else done(false);
            });
        } catch (e) { if (onFail) onFail(); else done(false); }
      } else {
        this._simAd('rewarded', function () { done(true); });
      }
    },

    /* ==================== web test-ad simulation ==================== */
    _simAd: function (kind, onDone) {
      var self = this;
      var wrap = document.getElementById('ad-sim');
      var box = document.getElementById('ad-sim-box');
      var label = document.getElementById('ad-sim-label');
      var creative = document.getElementById('ad-sim-creative');
      var btn = document.getElementById('ad-sim-close');
      var bar = document.getElementById('ad-sim-bar');
      if (!wrap) { if (onDone) onDone(); return; }

      // run-once guard: a stale click on Close must never re-fire an old flow
      var token = (this._simToken = (this._simToken || 0) + 1);

      label.textContent = kind === 'rewarded'
        ? 'Rewarded Test Ad - Google AdMob'
        : 'Interstitial Test Ad - Google AdMob';
      creative.className = 'ad-sim-creative ' + kind;
      creative.innerHTML = kind === 'rewarded'
        ? '<div class="ad-sim-gift"><svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="4" rx="1.5" fill="#C93A3A"/><rect x="5" y="12" width="14" height="9" rx="1.5" fill="#F25555"/><rect x="10.5" y="8" width="3" height="13" fill="#FFC93C"/><path d="M12 8C9 8 7 6.5 7.8 4.8 8.6 3.2 11 3.8 12 8zm0 0c3 0 5-1.5 4.2-3.2C15.4 3.2 13 3.8 12 8z" fill="#FFC93C"/></svg></div><div class="ad-sim-line">Reward waiting: watch this test ad</div>'
        : '<div class="ad-sim-line big">Your ad could be here</div><div class="ad-sim-line">This is a Google AdMob test creative</div>';
      btn.classList.add('hidden');
      btn.textContent = kind === 'rewarded' ? 'Claim Reward' : 'Close Ad';

      wrap.classList.remove('hidden');
      requestAnimationFrame(function () { wrap.classList.add('show'); });

      var dur = CFG.simDurationMs;
      var start = U.now();
      var tick = function () {
        var t = U.now() - start;
        if (wrap.classList.contains('hidden')) return; // cancelled
        if (t >= dur) {
          bar.style.width = '100%';
          btn.classList.remove('hidden');
          return;
        }
        bar.style.width = (t / dur * 100) + '%';
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      btn.onclick = function () {
        if (token !== self._simToken) return; // stale handler, ignore
        btn.onclick = null;
        RG.Audio.sfx('btn');
        wrap.classList.remove('show');
        setTimeout(function () { wrap.classList.add('hidden'); }, 220);
        self._lastAdAt = U.now();
        if (onDone) onDone();
      };
    },

    _buildDom: function () {
      if (document.getElementById('ad-sim')) return;
      var d = document.createElement('div');
      d.innerHTML =
        '<div id="ad-sim" class="hidden">' +
          '<div class="ad-sim-dim"></div>' +
          '<div id="ad-sim-box" class="ad-sim-box">' +
            '<div class="ad-sim-head">' +
              '<span id="ad-sim-label">Test Ad - Google AdMob</span>' +
              '<span class="ad-sim-tag">TEST</span>' +
            '</div>' +
            '<div id="ad-sim-creative" class="ad-sim-creative"></div>' +
            '<div class="ad-sim-progress"><div id="ad-sim-bar"></div></div>' +
            '<button id="ad-sim-close" class="btn btn-white btn-sm">Close Ad</button>' +
          '</div>' +
        '</div>' +
        '<div id="ad-sim-banner" class="hidden">' +
          '<div class="ad-sim-banner-inner">' +
            '<span class="ad-sim-tag dark">TEST</span>' +
            '<span>AdMob Test Banner - 320x50</span>' +
          '</div>' +
        '</div>';
      document.getElementById('app').appendChild(d);
    }
  };

  RG.AdMob = AdMob;
})();
