/* Run in the Garden - localStorage persistence (offline, private, no server) */
(function () {
  'use strict';
  window.RG = window.RG || {};
  var KEY = 'ritg.save.v1';

  var DEFAULTS = {
    bestScore: 0,
    bestDist: 0,
    coinBank: 0,
    gamesPlayed: 0,
    music: true,
    sfx: true,
    adsLastShownAt: 0
  };

  var data = load();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return cloneDefaults();
      var parsed = JSON.parse(raw);
      var out = cloneDefaults();
      for (var k in out) {
        if (Object.prototype.hasOwnProperty.call(parsed, k)) out[k] = parsed[k];
      }
      return out;
    } catch (e) { return cloneDefaults(); }
  }

  function cloneDefaults() {
    var o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    return o;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
  }

  var Storage = {
    get: function (k) { return data[k]; },
    set: function (k, v) { data[k] = v; save(); },

    /* record a finished run; returns whether it was a new best */
    recordRun: function (score, distM, coins) {
      var newBest = score > data.bestScore;
      if (newBest) data.bestScore = score;
      if (distM > data.bestDist) data.bestDist = distM;
      data.coinBank += coins;
      data.gamesPlayed += 1;
      save();
      return newBest;
    },

    resetAll: function () { data = cloneDefaults(); save(); }
  };

  RG.Storage = Storage;
})();
