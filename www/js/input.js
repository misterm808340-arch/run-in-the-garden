/* Run in the Garden - input: touch swipes, on-screen buttons, keyboard */
(function () {
  'use strict';
  window.RG = window.RG || {};
  var U;

  var Input = {
    actions: null,          // {left(), right(), jump(), pause()} injected by game
    _swipeStart: null,
    _lastTapMs: 0,

    init: function (actions) {
      U = RG.Utils;
      this.actions = actions;

      var app = document.getElementById('app');

      /* ---------- touch swipes on the whole game area ---------- */
      app.addEventListener('touchstart', function (e) {
        document.body.classList.add('touch-mode');
        if (e.target.closest('button, .card, #screen-howto')) return;
        var t = e.changedTouches[0];
        this._swipeStart = { x: t.clientX, y: t.clientY, t: U.now() };
      }.bind(this), { passive: true });

      app.addEventListener('touchend', function (e) {
        if (!this._swipeStart) return;
        var t = e.changedTouches[0];
        var dx = t.clientX - this._swipeStart.x;
        var dy = t.clientY - this._swipeStart.y;
        var dt = U.now() - this._swipeStart.t;
        this._swipeStart = null;
        if (dt > 700) return;
        var TH = 26;
        if (Math.abs(dx) < TH && Math.abs(dy) < TH) {
          // quick tap on the canvas = jump (mobile friendly backup)
          if (!e.target.closest('button, .card')) this.actions.jump();
          return;
        }
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) this.actions.right(); else this.actions.left();
        } else {
          if (dy < 0) this.actions.jump();
        }
      }.bind(this), { passive: true });

      /* ---------- on-screen buttons ---------- */
      this.bindHold('tc-left', 'left');
      this.bindHold('tc-right', 'right');
      this.bindHold('tc-jump', 'jump');

      /* ---------- keyboard ---------- */
      window.addEventListener('keydown', function (e) {
        if (e.repeat) return;
        switch (e.key) {
          case 'ArrowLeft': case 'a': case 'A': this.actions.left(); break;
          case 'ArrowRight': case 'd': case 'D': this.actions.right(); break;
          case ' ': case 'ArrowUp': case 'w': case 'W':
            e.preventDefault(); this.actions.jump(); break;
          case 'p': case 'P': case 'Escape': this.actions.pause(); break;
        }
      }.bind(this));

      /* keep the page from scrolling / zooming on gestures */
      document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
      document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      document.addEventListener('dblclick', function (e) { e.preventDefault(); });
    },

    bindHold: function (id, action) {
      var el = document.getElementById(id);
      if (!el) return;
      var fire = function (e) {
        e.preventDefault();
        document.body.classList.add('touch-mode');
        this.actions[action]();
      }.bind(this);
      el.addEventListener('pointerdown', fire);
    }
  };

  RG.Input = Input;
})();
