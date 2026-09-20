/* Run in the Garden - 100% local audio engine (Web Audio API).
   No files, no network: cheerful background music loop + synthesized SFX.
   Works fully offline. */
(function () {
  'use strict';
  window.RG = window.RG || {};
  var U;

  var Audio2 = {
    ctx: null, master: null, musicGain: null, sfxGain: null,
    musicOn: true, sfxOn: true,
    _started: false, _nextNote: 0, _step: 0, _timer: null,
    _unlocked: false,

    /* ---------------- setup ---------------- */
    init: function () {
      U = RG.Utils;
      var st = RG.Storage;
      this.musicOn = st.get('music');
      this.sfxOn = st.get('sfx');
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.musicOn ? 0.16 : 0;
        this.musicGain.connect(this.master);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.sfxOn ? 0.5 : 0;
        this.sfxGain.connect(this.master);
      } catch (e) { this.ctx = null; }
    },

    /* must be called from a user gesture (autoplay policies) */
    unlock: function () {
      if (!this.ctx || this._unlocked) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(function () {});
      }
      this._unlocked = true;
      if (this.musicOn) this.startMusic();
    },

    setMusic: function (on) {
      this.musicOn = on;
      RG.Storage.set('music', on);
      if (!this.ctx) return;
      var g = this.musicGain.gain;
      g.cancelScheduledValues(this.ctx.currentTime);
      g.linearRampToValueAtTime(on ? 0.16 : 0, this.ctx.currentTime + 0.25);
      if (on) this.startMusic();
    },

    setSfx: function (on) {
      this.sfxOn = on;
      RG.Storage.set('sfx', on);
      if (this.ctx) this.sfxGain.gain.value = on ? 0.5 : 0;
    },

    /* ---------------- music: 8-bar cheerful loop, lookahead scheduler ---------------- */
    /* progression: C - G - Am - F  (pentatonic melody) */
    _chords: [
      [261.63, 329.63, 392.00],  // C
      [246.94, 293.66, 392.00],  // G
      [220.00, 261.63, 329.63],  // Am
      [174.61, 220.00, 261.63]   // F
    ],
    _melody: [
      0, 4, 7, 12, 7, 4, 2, 4,   // semitone offsets over chord root (C pentatonic-ish)
      2, 7, 11, 14, 11, 7, 4, 7,
      0, 3, 7, 12, 7, 3, 0, 3,
      -2, 2, 5, 9, 5, 2, 0, 2
    ],
    _roots: [261.63, 246.94, 220.00, 174.61],

    startMusic: function () {
      if (!this.ctx || this._started) return;
      this._started = true;
      this._nextNote = this.ctx.currentTime + 0.1;
      this._timer = setInterval(this._schedule.bind(this), 40);
    },

    _schedule: function () {
      if (!this.ctx) return;
      var stepDur = 60 / 132 / 2;   // 8th notes at 132 bpm
      while (this._nextNote < this.ctx.currentTime + 0.25) {
        var s = this._step % 32;
        var bar = Math.floor(s / 8);
        var beat = s % 8;
        var t = this._nextNote;

        // bass on beats 0 / 3 / 4 / 6-ish for bounce
        if (beat === 0 || beat === 4) {
          this._tone(this._roots[bar] / 2, t, stepDur * 1.7, 'triangle', 0.55, this.musicGain);
        }
        // chord pad on bar start
        if (beat === 0) {
          var ch = this._chords[bar];
          for (var i = 0; i < ch.length; i++) {
            this._tone(ch[i], t, stepDur * 3.2, 'sine', 0.18, this.musicGain);
          }
        }
        // melody
        var semi = this._melody[s];
        if (!(s % 8 === 7 && (bar === 1 || bar === 3))) { // tiny breathing space
          var f = this._roots[bar] * Math.pow(2, semi / 12);
          this._tone(f, t, stepDur * 0.9, 'square', 0.12, this.musicGain, 1800);
        }
        // soft hat
        if (beat % 2 === 1) this._noise(t, 0.03, 0.05, this.musicGain, 6000);

        this._nextNote += stepDur;
        this._step++;
      }
    },

    _tone: function (freq, when, dur, type, vol, dest, lp) {
      if (!this.ctx) return;
      var o = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vol, when + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      if (lp) {
        var f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = lp;
        o.connect(f); f.connect(g);
      } else {
        o.connect(g);
      }
      g.connect(dest);
      o.start(when); o.stop(when + dur + 0.05);
    },

    _noise: function (when, dur, vol, dest, hp) {
      if (!this.ctx) return;
      var n = Math.floor(this.ctx.sampleRate * dur);
      var buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = this.ctx.createBufferSource();
      src.buffer = buf;
      var f = this.ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = hp || 3000;
      var g = this.ctx.createGain(); g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(dest);
      src.start(when);
    },

    _sweep: function (f0, f1, dur, type, vol) {
      if (!this.ctx || !this.sfxOn) return;
      var t = this.ctx.currentTime;
      var o = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.sfxGain);
      o.start(t); o.stop(t + dur + 0.05);
    },

    /* ---------------- SFX ---------------- */
    sfx: function (name) {
      if (!this.ctx || !this.sfxOn) return;
      switch (name) {
        case 'jump':    this._sweep(300, 640, 0.18, 'sine', 0.5); break;
        case 'land':    this._noise(this.ctx.currentTime, 0.05, 0.12, this.sfxGain, 1200); break;
        case 'coin':    this._tone(1174.7, this.ctx.currentTime, 0.07, 'square', 0.25, this.sfxGain);
                        this._tone(1568.0, this.ctx.currentTime + 0.07, 0.12, 'square', 0.25, this.sfxGain); break;
        case 'star':    this._tone(1046.5, this.ctx.currentTime, 0.08, 'triangle', 0.4, this.sfxGain);
                        this._tone(1318.5, this.ctx.currentTime + 0.08, 0.08, 'triangle', 0.4, this.sfxGain);
                        this._tone(1568.0, this.ctx.currentTime + 0.16, 0.16, 'triangle', 0.4, this.sfxGain); break;
        case 'power':   this._sweep(440, 880, 0.12, 'triangle', 0.4);
                        this._sweep(660, 1320, 0.18, 'sine', 0.35); break;
        case 'shieldBreak': this._noise(this.ctx.currentTime, 0.2, 0.3, this.sfxGain, 900);
                        this._sweep(700, 160, 0.25, 'sawtooth', 0.25); break;
        case 'hit':     this._noise(this.ctx.currentTime, 0.3, 0.5, this.sfxGain, 400);
                        this._sweep(320, 60, 0.4, 'sawtooth', 0.5); break;
        case 'gameover':this._tone(392.0, this.ctx.currentTime, 0.22, 'triangle', 0.4, this.sfxGain);
                        this._tone(311.1, this.ctx.currentTime + 0.22, 0.22, 'triangle', 0.4, this.sfxGain);
                        this._tone(233.1, this.ctx.currentTime + 0.44, 0.4, 'triangle', 0.4, this.sfxGain); break;
        case 'btn':     this._tone(880, this.ctx.currentTime, 0.06, 'square', 0.18, this.sfxGain); break;
        case 'whoosh':  this._noise(this.ctx.currentTime, 0.09, 0.1, this.sfxGain, 2200); break;
        case 'revive':  this._sweep(330, 660, 0.15, 'triangle', 0.4);
                        this._tone(880, this.ctx.currentTime + 0.15, 0.2, 'triangle', 0.35, this.sfxGain); break;
        case 'tick':    this._tone(660, this.ctx.currentTime, 0.05, 'square', 0.15, this.sfxGain); break;
        case 'go':      this._tone(523.3, this.ctx.currentTime, 0.1, 'square', 0.3, this.sfxGain);
                        this._tone(1046.5, this.ctx.currentTime + 0.1, 0.22, 'square', 0.3, this.sfxGain); break;
        case 'best':    var t = this.ctx.currentTime, n = [523.3, 659.3, 784.0, 1046.5], i;
                        for (i = 0; i < n.length; i++) this._tone(n[i], t + i * 0.11, 0.16, 'triangle', 0.38, this.sfxGain);
                        break;
        case 'splash':  this._noise(this.ctx.currentTime, 0.15, 0.22, this.sfxGain, 800); break;
        case 'smash':   this._noise(this.ctx.currentTime, 0.12, 0.3, this.sfxGain, 700);
                        this._sweep(500, 900, 0.1, 'square', 0.2); break;
      }
    }
  };

  RG.Audio = Audio2;
})();
