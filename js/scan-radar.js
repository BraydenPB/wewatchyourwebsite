/* ============================================================
   WWYW — Scan Radar
   A custom, dependency-free 2D-canvas radar: concentric range rings,
   a rotating sweep beam with a fading wake, and detected "blips" that
   flare when the beam passes them. Lime-themed (#69ff12) to match the
   brand's shield/scanline identity.

   Discipline (mirrors the Chameleon radar): mounts by [data-scan-radar];
   pauses when offscreen or the tab is hidden; honors prefers-reduced-
   motion by painting ONE static frame (rings + blips, no sweep) and
   stopping. DPR-aware, debounced resize.
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  var hosts = document.querySelectorAll("[data-scan-radar]");
  if (!hosts.length) return;

  var LIME = [105, 255, 18];
  var TEAL = [61, 214, 232];

  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }

  function ScanRadar(host) {
    var canvas = document.createElement("canvas");
    canvas.className = "scan-radar__canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    var ctx = canvas.getContext("2d");

    var w = 0, h = 0, cx = 0, cy = 0, R = 0, dpr = 1;
    var raf = 0, running = false, t0 = 0, last = 0, angle = 0;

    // Fixed "detections" (deterministic — no Math.random, which is fine and
    // also keeps it stable). Each: radius fraction, angle, base label intensity.
    var blips = [
      { r: 0.42, a: 0.6, seed: 0 },
      { r: 0.74, a: 2.3, seed: 1 },
      { r: 0.30, a: 3.8, seed: 2 },
      { r: 0.86, a: 5.0, seed: 3 },
      { r: 0.58, a: 1.5, seed: 4 },
      { r: 0.66, a: 4.4, seed: 5 }
    ];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = host.clientWidth;
      h = host.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2;
      cy = h / 2;
      R = Math.min(w, h) / 2 * 0.92;
    }

    function drawRings() {
      var i, rr;
      // concentric range rings
      for (i = 1; i <= 4; i++) {
        rr = (R * i) / 4;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(LIME, 0.10);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // crosshair spokes
      ctx.strokeStyle = rgba(LIME, 0.07);
      for (i = 0; i < 12; i++) {
        var a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.stroke();
      }
      // outer rim, brighter
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(LIME, 0.22);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = rgba(LIME, 0.6);
      ctx.fill();
    }

    function drawBlip(b, flare) {
      var bx = cx + Math.cos(b.a) * R * b.r;
      var by = cy + Math.sin(b.a) * R * b.r;
      var size = 2.5 + flare * 4;
      // glow
      if (flare > 0.02) {
        var g = ctx.createRadialGradient(bx, by, 0, bx, by, 16 + flare * 18);
        g.addColorStop(0, rgba(LIME, 0.5 * flare));
        g.addColorStop(1, rgba(LIME, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, 16 + flare * 18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(bx, by, size, 0, Math.PI * 2);
      ctx.fillStyle = rgba(flare > 0.3 ? TEAL : LIME, 0.35 + flare * 0.65);
      ctx.fill();
    }

    function drawSweep() {
      // wake: a fading wedge trailing the beam
      var segs = 36, spread = Math.PI * 0.42, i, a, alpha;
      for (i = 0; i < segs; i++) {
        a = angle - (i / segs) * spread;
        alpha = (1 - i / segs) * 0.16;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, a, a + spread / segs + 0.01);
        ctx.closePath();
        ctx.fillStyle = rgba(LIME, alpha);
        ctx.fill();
      }
      // leading beam line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * R, cy + Math.sin(angle) * R);
      ctx.strokeStyle = rgba(LIME, 0.55);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    function angDiff(a, b) {
      var d = ((a - b) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      return Math.abs(d);
    }

    function render(animated, now) {
      ctx.clearRect(0, 0, w, h);
      drawRings();
      if (animated) drawSweep();
      for (var i = 0; i < blips.length; i++) {
        var b = blips[i];
        // flare ramps when the beam is near the blip's angle, then decays
        var flare = 0;
        if (animated) {
          var diff = angDiff(angle, b.a);
          flare = Math.max(0, 1 - diff / 0.5);
          // lingering decay using time + seed for subtle variation
          flare = Math.max(flare, 0.12 + 0.1 * Math.sin(now * 0.001 + b.seed));
        } else {
          flare = 0.3;
        }
        drawBlip(b, flare);
      }
    }

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!t0) t0 = now;
      var dt = last ? (now - last) / 1000 : 0;
      last = now;
      angle += dt * 0.9; // ~0.9 rad/s sweep
      if (angle > Math.PI * 2) angle -= Math.PI * 2;
      render(true, now);
    }

    function play() {
      if (running || prefersReduced) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    }
    function pause() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    resize();
    if (prefersReduced) {
      render(false, 0); // single static frame
    } else {
      var onScreen = true;
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          onScreen = entries[0].isIntersecting;
          onScreen && !document.hidden ? play() : pause();
        }, { threshold: 0 }).observe(host);
      } else {
        play();
      }
      document.addEventListener("visibilitychange", function () {
        document.hidden || !onScreen ? pause() : play();
      });
      render(true, 0);
      play();
    }

    var rt = 0;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        resize();
        if (prefersReduced || !running) render(running, performance.now ? performance.now() : 0);
      }, 150);
    }, { passive: true });
  }

  Array.prototype.forEach.call(hosts, function (host) { new ScanRadar(host); });
})();
