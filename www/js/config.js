/* Run in the Garden - global configuration & tuning */
(function () {
  'use strict';
  window.RG = window.RG || {};

  // ---- Google AdMob OFFICIAL TEST ad unit IDs (safe for development) ----
  var AD_IDS = {
    app:          'ca-app-pub-3940256099942544~3347511713', // Android TEST app id
    banner:       'ca-app-pub-3940256099942544/6300978111', // TEST banner
    interstitial: 'ca-app-pub-3940256099942544/1033173712', // TEST interstitial
    rewarded:     'ca-app-pub-3940256099942544/5224354917', // TEST rewarded video
    appOpen:      'ca-app-pub-3940256099942544/3419835294'  // TEST app open
  };

  var Config = {
    VERSION: '1.3.0',

    /* ---------------- AdMob (TEST MODE) ---------------- */
    ads: {
      ids: AD_IDS,
      testMode: true,            // true = use Google's official test ad units
      appOpenEnabled: true,      // show app-open test ad on native cold start
      interstitialEveryN: 3,     // a test interstitial every N game overs
      interstitialMinGapMs: 45000,
      simDurationMs: 3000,       // web simulation ad length
      reviveTimerSec: 5
    },

    /* ---------------- World / forward 3D view ---------------- */
    logicalW: 400,               // design width in world units
    metersPerUnit: 1 / 50,
    view3d: {
      horizonFrac: 0.36,         // horizon line as fraction of view height
      baseFrac: 0.80,            // player base line as fraction of view height
      laneSpan: 100,             // px between adjacent lane centers at player plane
      trackHalfW: 150,           // track half width at player plane
      camD: 5.8,                 // perspective: scale(z) = camD / (camD + z)
      zFar: 100,                 // spawn distance (normalized track units)
      playerScale: 1.0,          // bunny at natural size (world objects scale instead)
      entityScale: 1.4,          // coins/stars/power-ups/obstacles drawn ~40% bigger
      zSpeedK: 0.14,             // world speed (u/s) -> z approach speed
      hitZ: 6,                   // collision window around the player plane
      laneHitTol: 0.58,          // lateral tolerance to hit an obstacle
      coinZWin: 9,               // coin collection z window
      coinYTol: 46,              // coin height tolerance vs bunny
      magnetZ: 62                // magnet attraction range (z units)
    },

    /* ---------------- Speed & difficulty ----------------
       Gentle start, then builds up to a fast pace over time. */
    speedStart: 265,             // world units / second (easy warm-up)
    speedGainPerSec: 3.6,        // linear ramp while alive (gets fast)
    speedMax: 820,
    boostMul: 1.55,
    slowMul: 0.55,               // puddle slow factor
    slowDur: 1.2,

    /* ---------------- Player ---------------- */
    player: {
      w: 46, h: 58,
      laneLerp: 13,              // lane switch easing
      jumpV: 900, gravity: 2600,
      coyoteMs: 90, bufferMs: 110,
      invincibleAfterReviveSec: 2.5,
      invincibleAfterShieldSec: 1.2
    },

    /* ---------------- Pickups ---------------- */
    coinR: 13, starR: 16,
    coinValue: 10, starValue: 50,
    magnetRadius: 150, magnetPull: 1050,

    /* ---------------- Power-up durations (seconds) ---------------- */
    puDur: { shield: 0 /* until hit */, magnet: 8, boost: 5, x2: 10 },

    /* ---------------- Obstacle catalog ----------------
       jump: can be cleared by jumping. lethal: ends the run. */
    obstacles: {
      rock:   { w: 54, h: 40, jump: true,  lethal: true,  weight: 10 },
      pot:    { w: 46, h: 52, jump: true,  lethal: true,  weight: 9  },
      branch: { w: 78, h: 30, jump: true,  lethal: true,  weight: 8  },
      bush:   { w: 62, h: 46, jump: true,  lethal: true,  weight: 7  },
      puddle: { w: 86, h: 14, jump: true,  lethal: false, weight: 6  },
      fence:  { w: 56, h: 165, jump: false, lethal: true, weight: 0 } // weight scales with distance
    },

    /* ---------------- Spawning ---------------- */
    spawn: {
      firstDelayUnits: 520,
      gapMinSec: 0.82, gapMaxSec: 1.30,   // gap scaled by current speed
      hardPatternExtraSec: 0.5,
      powerupChance: 0.085,
      starChance: 0.09,
      fenceAfterDist: 550,                 // units before fences appear
      hardAfterDist: 350                   // two-lane walls after this distance
    },

    decor: { gapMin: 70, gapMax: 160 },
    flowers: { gapMin: 22, gapMax: 46 },

    /* ---------------- Scoring ---------------- */
    scorePerMeter: 1,
    boostSmashBonus: 25
  };

  RG.Config = Config;
})();
