/* Run in the Garden - small helpers */
(function () {
  'use strict';
  window.RG = window.RG || {};

  var Utils = {
    rand: function (a, b) { return a + Math.random() * (b - a); },
    randi: function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },

    /* frame-rate independent exponential approach */
    damp: function (a, b, rate, dt) { return a + (b - a) * (1 - Math.exp(-rate * dt)); },

    chance: function (p) { return Math.random() < p; },

    weightedPick: function (table) { // [{key, weight}, ...]
      var total = 0, i;
      for (i = 0; i < table.length; i++) total += table[i].weight;
      var r = Math.random() * total;
      for (i = 0; i < table.length; i++) {
        r -= table[i].weight;
        if (r <= 0) return table[i].key;
      }
      return table[table.length - 1].key;
    },

    fmt: function (n) {
      n = Math.floor(n);
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
      if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
      return String(n);
    },

    /* AABB overlap with per-side inset (forgiveness margins) */
    hit: function (ax, ay, aw, ah, bx, by, bw, bh, insetA, insetB) {
      var a1 = insetA || 0, b1 = insetB || 0;
      return ax + a1 < bx + bw - b1 &&
             ax + aw - a1 > bx + b1 &&
             ay + a1 < by + bh - b1 &&
             ay + ah - a1 > by + b1;
    },

    now: function () { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  };

  RG.Utils = Utils;
})();
