/* ============================================================
   LetterGlitch — vanilla canvas port of the reactbits component.
   Re-themed to WWYW lime/teal triad. outerVignette on.
   Respects prefers-reduced-motion (renders one static frame).

   Usage:
     const lg = new LetterGlitch(containerEl, { glitchColors:[...], smooth:true });
     lg.start();   // started automatically by the constructor
     lg.destroy(); // tears down RAF + listeners
   ============================================================ */
(function (global) {
  "use strict";

  var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789".split("");

  var FONT_SIZE = 16;
  var CHAR_WIDTH = 10;
  var CHAR_HEIGHT = 20;
  var GLITCH_SPEED = 50; // ms between glitch passes

  function randInt(n) { return Math.floor(Math.random() * n); }

  function hexToRgb(hex) {
    var shorthand = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthand, function (m, r, g, b) { return r + r + g + g + b + b; });
    var res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return res
      ? { r: parseInt(res[1], 16), g: parseInt(res[2], 16), b: parseInt(res[3], 16) }
      : { r: 0, g: 0, b: 0 };
  }

  function interpolateColor(a, b, factor) {
    return {
      r: Math.round(a.r + (b.r - a.r) * factor),
      g: Math.round(a.g + (b.g - a.g) * factor),
      b: Math.round(a.b + (b.b - a.b) * factor)
    };
  }

  function LetterGlitch(container, options) {
    options = options || {};
    this.container = container;
    this.glitchColors = options.glitchColors || ["#69ff12", "#3d6f3c", "#1aa6b7"];
    this.glitchSpeed = options.glitchSpeed || GLITCH_SPEED;
    this.smooth = options.smooth !== false; // default true
    this.outerVignette = options.outerVignette !== false; // default true

    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.ctx = this.canvas.getContext("2d");
    this.letters = [];
    this.grid = { columns: 0, rows: 0 };
    this.last = 0;
    this.rafId = null;
    this.resizeTimer = null;

    this._reduceMotion =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;

    this._mount();
    this._bindResize();
    this.resize();
    // Only animate while the backdrop is on-screen. Each instance runs a per-frame
    // canvas redraw; with several instances (hero, dividers, footer) all looping
    // unconditionally, the combined per-frame cost janks the main thread during
    // scroll — most visibly while the sticky console is being repositioned, which
    // stalls everything (Lottie, progress bars, highlight) until scrolling settles.
    // Pausing off-screen instances removed 100% of scroll long-tasks in profiling.
    this._bindVisibility();
  }

  LetterGlitch.prototype._mount = function () {
    this.container.classList.add("glitch");
    this.container.appendChild(this.canvas);
    if (this.outerVignette) {
      var v = document.createElement("div");
      v.className = "glitch__vignette";
      this.container.appendChild(v);
    }
  };

  LetterGlitch.prototype._bindResize = function () {
    var self = this;
    this._onResize = function () {
      clearTimeout(self.resizeTimer);
      self.resizeTimer = setTimeout(function () {
        var wasRunning = self.rafId != null;
        cancelAnimationFrame(self.rafId);
        self.rafId = null;
        self.resize();
        // Only resume the loop if it was running (i.e. on-screen). Off-screen
        // instances stay paused — the IntersectionObserver restarts them on entry.
        if (wasRunning || self._reduceMotion) self.start();
      }, 120);
    };
    window.addEventListener("resize", self._onResize);
  };

  LetterGlitch.prototype._randomColor = function () {
    return this.glitchColors[randInt(this.glitchColors.length)];
  };

  LetterGlitch.prototype._randomChar = function () {
    return GLYPHS[randInt(GLYPHS.length)];
  };

  LetterGlitch.prototype._calcGrid = function (w, h) {
    return {
      columns: Math.ceil(w / CHAR_WIDTH),
      rows: Math.ceil(h / CHAR_HEIGHT)
    };
  };

  LetterGlitch.prototype._initLetters = function (columns, rows) {
    this.grid = { columns: columns, rows: rows };
    var total = columns * rows;
    this.letters = new Array(total);
    for (var i = 0; i < total; i++) {
      var c = this._randomColor();
      this.letters[i] = {
        char: this._randomChar(),
        color: c,
        targetColor: c,
        colorProgress: 1
      };
    }
  };

  LetterGlitch.prototype.resize = function () {
    var rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    // Cache the measured dimensions so _draw() never re-measures the container
    // (a layout read each frame forces a reflow). Updated only on resize.
    this._w = rect.width;
    this._h = rect.height;
    var dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.canvas.style.width = rect.width + "px";
    this.canvas.style.height = rect.height + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var g = this._calcGrid(rect.width, rect.height);
    this._initLetters(g.columns, g.rows);
    this._draw();
  };

  LetterGlitch.prototype._draw = function () {
    if (!this.letters.length) return;
    // Use cached dims from resize() — no per-frame getBoundingClientRect reflow.
    this.ctx.clearRect(0, 0, this._w, this._h);
    this.ctx.font = FONT_SIZE + "px monospace";
    this.ctx.textBaseline = "top";

    for (var i = 0; i < this.letters.length; i++) {
      var L = this.letters[i];
      var x = (i % this.grid.columns) * CHAR_WIDTH;
      var y = Math.floor(i / this.grid.columns) * CHAR_HEIGHT;
      this.ctx.fillStyle = L.color;
      this.ctx.fillText(L.char, x, y);
    }
  };

  LetterGlitch.prototype._glitch = function () {
    var count = Math.max(1, Math.floor(this.letters.length * 0.05));
    for (var k = 0; k < count; k++) {
      var idx = randInt(this.letters.length);
      var L = this.letters[idx];
      if (!L) continue;
      L.char = this._randomChar();
      L.targetColor = this._randomColor();
      if (this.smooth) {
        L.colorProgress = 0;
      } else {
        L.color = L.targetColor;
        L.colorProgress = 1;
      }
    }
  };

  LetterGlitch.prototype._stepSmooth = function () {
    var changed = false;
    for (var i = 0; i < this.letters.length; i++) {
      var L = this.letters[i];
      if (L.colorProgress < 1) {
        L.colorProgress = Math.min(1, L.colorProgress + 0.05);
        var start = hexToRgb(L.color);
        var end = hexToRgb(L.targetColor);
        var c = interpolateColor(start, end, L.colorProgress);
        L.color = "rgb(" + c.r + "," + c.g + "," + c.b + ")";
        changed = true;
      }
    }
    return changed;
  };

  LetterGlitch.prototype._loop = function (now) {
    var self = this;
    this.rafId = requestAnimationFrame(function (t) { self._loop(t); });

    if (now - this.last >= this.glitchSpeed) {
      this._glitch();
      this.last = now;
      if (!this.smooth) { this._draw(); return; }
    }
    if (this.smooth) {
      if (this._stepSmooth()) this._draw();
    }
  };

  // Run the animation only while on-screen. Under reduced motion we draw one static
  // frame and never loop, so there's nothing to gate — render it once and bail.
  LetterGlitch.prototype._bindVisibility = function () {
    if (this._reduceMotion || typeof IntersectionObserver !== "function") {
      this.start();
      return;
    }
    var self = this;
    this._io = new IntersectionObserver(function (entries) {
      var onScreen = entries[entries.length - 1].isIntersecting;
      if (onScreen) self.start();
      else self.stop();
    }, { rootMargin: "200px 0px" }); // warm up just before it scrolls into view
    this._io.observe(this.container);
  };

  LetterGlitch.prototype.stop = function () {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  };

  LetterGlitch.prototype.start = function () {
    // Reduced motion: render a single static frame, then stop.
    if (this._reduceMotion) {
      this._glitch();
      if (this.smooth) {
        // resolve any in-flight lerps to their target instantly
        for (var i = 0; i < this.letters.length; i++) {
          var L = this.letters[i];
          L.color = L.targetColor;
          L.colorProgress = 1;
        }
      }
      this._draw();
      return;
    }
    if (this.rafId) cancelAnimationFrame(this.rafId);
    var self = this;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(function (t) { self._loop(t); });
  };

  LetterGlitch.prototype.destroy = function () {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this._io) { this._io.disconnect(); this._io = null; }
    clearTimeout(this.resizeTimer);
    window.removeEventListener("resize", this._onResize);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  };

  global.LetterGlitch = LetterGlitch;
})(window);
