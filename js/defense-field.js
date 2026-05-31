/* ============================================================
   WWYW — Defense Field
   A custom, dependency-free 2D-canvas figure for the "we work one layer
   below" argument. Three zones, read top to bottom:

     1. Attack vectors rain down from the exposed surface — angled lime/teal
        streaks aimed at the site.
     2. A DEFENDED BOUNDARY runs across the middle. Every vector bursts and
        deflects on impact — none pass through. The line flares at each hit.
        This is the signature motion: vertical, directional, energetic —
        deliberately NOT the rotating sweep of the scan radar below it.
     3. Beneath the line, our infrastructure layer: a solid, faintly hashed
        plane with a slow, SUBTLE horizontal scan (kept quiet so it doesn't
        echo the radar). The ground the site rests on, out of reach.

   Discipline (mirrors scan-radar.js): mounts by [data-defense-field];
   pauses offscreen or when the tab is hidden; honors prefers-reduced-motion
   by painting ONE static frame that still tells the story (vectors frozen
   stopped at the line, foundation solid). DPR-aware, debounced resize.
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  var hosts = document.querySelectorAll("[data-defense-field]");
  if (!hosts.length) return;

  var LIME = [105, 255, 18];
  var TEAL = [61, 214, 232];
  var SURFACE = "rgba(13,16,24,0.98)"; // --surface-1, opaque (site body)
  var INK = "rgba(5,6,10,1)";          // --bg-base (the secured-badge check)

  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }

  function DefenseField(host) {
    var canvas = document.createElement("canvas");
    canvas.className = "defense-field__canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    var ctx = canvas.getContext("2d");

    var w = 0, h = 0, dpr = 1, bound = 0; // bound = y of the defended line
    var topY = 0, frontH = 0, persp = 0;  // foundation slab: top-surface y, front-face height, perspective inset
    var siteX = 0, siteY = 0, siteW = 0, siteH = 0; // protected website glyph
    var raf = 0, running = false, last = 0;

    // Vectors: each falls from above toward the boundary along a fixed angle,
    // bursts on impact, then respawns. Deterministic spawn columns (no
    // Math.random — matches scan-radar discipline; variety via index/seed).
    var COLS = 9;
    var vectors = [];
    function seedVectors() {
      vectors.length = 0;
      for (var i = 0; i < COLS; i++) {
        var frac = (i + 0.5) / COLS;            // column position 0..1
        var lean = ((i % 3) - 1) * 0.18;         // -0.18 / 0 / +0.18 horizontal lean
        vectors.push({
          x: frac, lean: lean,
          // staggered starts + varied speeds so impacts never sync up
          p: (i * 0.137) % 1,                    // progress 0..1 (0 top, 1 boundary)
          speed: 0.34 + (i % 4) * 0.07,          // progress/sec
          hot: 0,                                // impact flash 0..1, decays
          teal: i % 3 === 0                      // a couple read teal for variety
        });
      }
    }

    // Ripples on the boundary where a vector just struck — expanding arcs.
    var ripples = [];

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
      bound = Math.round(h * 0.40);          // the shield line where attacks burst
      // Foundation slab seen in slight 3/4: a top surface receding from the
      // shield line down to topY, then a front face of height frontH. The site
      // rests ON the top surface, fully BELOW the shield — protected.
      persp = Math.round(w * 0.10);          // horizontal inset of the far (top) edge
      topY = Math.round(h * 0.82);           // front edge of the top surface
      frontH = Math.round(h * 0.13);         // thickness of the slab's front face
      // Protected website glyph, centred, resting on the slab's top surface —
      // its TOP sits clearly below the shield line so attacks never touch it.
      siteW = Math.min(Math.round(w * 0.32), 250);
      siteH = Math.round(siteW * 0.58);
      siteX = Math.round(w / 2 - siteW / 2);
      siteY = Math.max(bound + Math.round(h * 0.06), Math.round(topY - siteH - h * 0.04));
    }

    // --- drawing ---------------------------------------------------------
    // Vectors start spread across the top and CONVERGE toward the protected
    // site's column as they fall — so the attack is visibly aimed at the site,
    // then bursts on the shield before it can reach it.
    function vx(v, p) {
      var startX = (v.x + v.lean * 0.2) * w;
      var aimX = (w / 2) + (v.x - 0.5) * w * 0.34; // toward centre (the site), but fanned
      return startX + (aimX - startX) * p;
    }
    function vy(p) { return p * bound; }                       // y at progress p

    // Map an x at the FAR edge (y=bound) inward by the perspective inset, and
    // interpolate toward the full-width near edge (y=topY). Lets us draw a
    // receding grid on the slab's top surface.
    function topEdgeX(xFrac, depth) {
      // depth 0 = far (at bound), 1 = near (at topY)
      var far = persp + xFrac * (w - 2 * persp);
      var near = xFrac * w;
      return far + (near - far) * depth;
    }

    function drawFoundation(now, animated) {
      // ---- TOP SURFACE: a trapezoid receding from the shield line to topY.
      ctx.beginPath();
      ctx.moveTo(persp, bound);
      ctx.lineTo(w - persp, bound);
      ctx.lineTo(w, topY);
      ctx.lineTo(0, topY);
      ctx.closePath();
      var topFill = ctx.createLinearGradient(0, bound, 0, topY);
      topFill.addColorStop(0, rgba(LIME, 0.035));   // far = dimmer (atmospheric)
      topFill.addColorStop(1, rgba(LIME, 0.11));    // near = brighter
      ctx.fillStyle = topFill;
      ctx.fill();

      // dim receding grid ON the top surface (backdrop only — kept quiet).
      ctx.save();
      ctx.clip();
      var i, depthLines = 6, d, gy, gx;
      // lines parallel to the shield (constant depth), brighter toward the front
      for (i = 1; i <= depthLines; i++) {
        d = i / depthLines;
        gy = bound + (topY - bound) * d * d;        // ease so they bunch toward the back
        ctx.strokeStyle = rgba(LIME, 0.04 + d * 0.06);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(topEdgeX(0, d * d), gy);
        ctx.lineTo(topEdgeX(1, d * d), gy);
        ctx.stroke();
      }
      // converging depth lines (toward a vanishing region)
      for (i = 0; i <= 8; i++) {
        gx = i / 8;
        ctx.strokeStyle = rgba(LIME, 0.05);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(topEdgeX(gx, 0), bound);
        ctx.lineTo(topEdgeX(gx, 1), topY);
        ctx.stroke();
      }
      // subtle scan sweeping ACROSS the top surface toward the viewer (depth),
      // not rotating — distinct from the radar.
      if (animated) {
        var sp = (now * 0.00009) % 1;
        var sy = bound + (topY - bound) * sp * sp;
        var sg = ctx.createLinearGradient(0, sy - 16, 0, sy + 16);
        sg.addColorStop(0, rgba(LIME, 0));
        sg.addColorStop(0.5, rgba(LIME, 0.10));
        sg.addColorStop(1, rgba(LIME, 0));
        ctx.fillStyle = sg;
        ctx.fillRect(0, sy - 16, w, 32);
      }
      ctx.restore();

      // ---- FRONT FACE: the slab's thickness, darker (in shadow). Reads solid.
      var faceFill = ctx.createLinearGradient(0, topY, 0, topY + frontH);
      faceFill.addColorStop(0, rgba(LIME, 0.10));
      faceFill.addColorStop(1, "rgba(0,0,0,0.0)");
      ctx.fillStyle = faceFill;
      ctx.fillRect(0, topY, w, frontH);
      // a darkening so the face reads as a vertical plane, not more floor
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, topY, w, frontH);
      // bright top lip where top surface meets front face — catches the light
      ctx.strokeStyle = rgba(LIME, 0.28);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, topY); ctx.lineTo(w, topY); ctx.stroke();
    }

    // The protected website — a small browser glyph resting on the slab's top
    // surface, BELOW the shield line. Soft shadow + a faint "safe" pulse.
    function drawSite(now, animated) {
      var x = siteX, y = siteY, sw = siteW, sh = siteH;
      var cx2 = x + sw / 2;

      // protective shield dome — a faint arc arcing from the boundary down and
      // around the site, making the "covered / protected" relationship explicit.
      var domeR = sw * 0.78;
      var domeCy = y + sh * 0.5;
      var dg = ctx.createRadialGradient(cx2, domeCy, domeR * 0.55, cx2, domeCy, domeR);
      dg.addColorStop(0, rgba(LIME, 0));
      dg.addColorStop(0.82, rgba(LIME, 0));
      dg.addColorStop(1, rgba(LIME, 0.05));
      ctx.fillStyle = dg;
      ctx.beginPath(); ctx.arc(cx2, domeCy, domeR, Math.PI, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(LIME, 0.16);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx2, domeCy, domeR, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke();

      // contact shadow on the top surface
      var shY = y + sh + 6;
      var shg = ctx.createRadialGradient(x + sw / 2, shY, 2, x + sw / 2, shY, sw * 0.7);
      shg.addColorStop(0, "rgba(0,0,0,0.45)");
      shg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = shg;
      ctx.beginPath(); ctx.ellipse(x + sw / 2, shY, sw * 0.6, 9, 0, 0, Math.PI * 2); ctx.fill();

      // safe-pulse halo
      var pulse = animated ? 0.5 + 0.5 * Math.sin(now * 0.0022) : 0.7;
      ctx.strokeStyle = rgba(LIME, 0.10 + pulse * 0.10);
      ctx.lineWidth = 1;
      roundRect(x - 6, y - 6, sw + 12, sh + 12, 10);
      ctx.stroke();

      // body
      ctx.fillStyle = SURFACE;
      roundRect(x, y, sw, sh, 7);
      ctx.fill();
      ctx.strokeStyle = rgba(LIME, 0.62);
      ctx.lineWidth = 1.5;
      roundRect(x, y, sw, sh, 7);
      ctx.stroke();

      // title bar + traffic-light dots
      var barH = Math.max(12, Math.round(sh * 0.22));
      ctx.fillStyle = rgba(LIME, 0.10);
      roundRectTop(x, y, sw, barH, 7);
      ctx.fill();
      var dotY = y + barH / 2, dr = 2.2, dx = x + 12, k;
      for (k = 0; k < 3; k++) {
        ctx.fillStyle = rgba(LIME, 0.5 - k * 0.12);
        ctx.beginPath(); ctx.arc(dx + k * 9, dotY, dr, 0, Math.PI * 2); ctx.fill();
      }
      // content lines
      ctx.strokeStyle = rgba(LIME, 0.22);
      ctx.lineWidth = 2;
      var ly = y + barH + 12, lx = x + 12, lw = sw - 24, n2;
      for (n2 = 0; n2 < 3; n2++) {
        ctx.beginPath();
        ctx.moveTo(lx, ly + n2 * 9);
        ctx.lineTo(lx + lw * (n2 === 1 ? 0.6 : 0.85), ly + n2 * 9);
        ctx.stroke();
      }
      // a small lime check/lock badge — "secured"
      var bx = x + sw - 16, by = y + sh - 14;
      ctx.fillStyle = rgba(LIME, 0.9);
      ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(bx - 2.6, by); ctx.lineTo(bx - 0.6, by + 2.2); ctx.lineTo(bx + 3, by - 2.4);
      ctx.stroke();
      ctx.lineCap = "butt";
    }

    function roundRect(x, y, rw, rh, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + rw, y, x + rw, y + rh, r);
      ctx.arcTo(x + rw, y + rh, x, y + rh, r);
      ctx.arcTo(x, y + rh, x, y, r);
      ctx.arcTo(x, y, x + rw, y, r);
      ctx.closePath();
    }
    function roundRectTop(x, y, rw, rh, r) {
      ctx.beginPath();
      ctx.moveTo(x, y + rh);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.lineTo(x + rw - r, y);
      ctx.arcTo(x + rw, y, x + rw, y + r, r);
      ctx.lineTo(x + rw, y + rh);
      ctx.closePath();
    }

    function drawBoundary(now, animated) {
      // base defended line
      ctx.strokeStyle = rgba(LIME, 0.55);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, bound); ctx.lineTo(w, bound); ctx.stroke();

      // soft glow along the line
      var gg = ctx.createLinearGradient(0, bound - 14, 0, bound + 14);
      gg.addColorStop(0, rgba(LIME, 0));
      gg.addColorStop(0.5, rgba(LIME, 0.18));
      gg.addColorStop(1, rgba(LIME, 0));
      ctx.fillStyle = gg;
      ctx.fillRect(0, bound - 14, w, 28);

      // impact ripples
      for (var i = ripples.length - 1; i >= 0; i--) {
        var rp = ripples[i];
        var a = Math.max(0, 1 - rp.life);
        ctx.strokeStyle = rgba(rp.teal ? TEAL : LIME, a * 0.6);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(rp.x, bound, 4 + rp.life * 26, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
        // bright hit point
        ctx.fillStyle = rgba(rp.teal ? TEAL : LIME, a);
        ctx.beginPath(); ctx.arc(rp.x, bound, 2.5 + a * 2, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawVector(v) {
      var col = v.teal ? TEAL : LIME;
      var headP = v.p;
      var hx = vx(v, headP), hy = vy(headP);
      // trailing streak (a few segments behind the head, fading up)
      var segs = 6, i, p, x, y, prevx = hx, prevy = hy;
      for (i = 1; i <= segs; i++) {
        p = Math.max(0, headP - i * 0.05);
        x = vx(v, p); y = vy(p);
        ctx.strokeStyle = rgba(col, (1 - i / segs) * 0.5);
        ctx.lineWidth = 2 - i * 0.18;
        ctx.beginPath(); ctx.moveTo(prevx, prevy); ctx.lineTo(x, y); ctx.stroke();
        prevx = x; prevy = y;
      }
      // bright head
      ctx.fillStyle = rgba(col, 0.95);
      ctx.beginPath(); ctx.arc(hx, hy, 2.2, 0, Math.PI * 2); ctx.fill();
    }

    function drawBurst(v) {
      // a short-lived burst of deflected shards at the impact point — this is
      // the signature moment, so it lands hard: bright flash on the line, a
      // fan of shards thrown UPWARD (deflected, never through), and a glow.
      var col = v.teal ? TEAL : LIME;
      var bx = vx(v, 1), hot = v.hot;

      // radial glow bloom at impact
      var gr = 10 + hot * 26;
      var g = ctx.createRadialGradient(bx, bound, 0, bx, bound, gr);
      g.addColorStop(0, rgba(col, hot * 0.55));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, bound, gr, 0, Math.PI * 2); ctx.fill();

      // brief brightening of the line segment around the hit
      var seg = 22 + hot * 30;
      var lg = ctx.createLinearGradient(bx - seg, 0, bx + seg, 0);
      lg.addColorStop(0, rgba(col, 0));
      lg.addColorStop(0.5, rgba(col, hot * 0.9));
      lg.addColorStop(1, rgba(col, 0));
      ctx.strokeStyle = lg; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(bx - seg, bound); ctx.lineTo(bx + seg, bound); ctx.stroke();

      // fan of deflected shards — thrown back up and out
      var n = 7, i, ang, len = 10 + hot * 22;
      ctx.lineCap = "round";
      for (i = 0; i < n; i++) {
        ang = Math.PI + (i / (n - 1) - 0.5) * Math.PI * 1.05;
        ctx.strokeStyle = rgba(col, hot * 0.95);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, bound);
        ctx.lineTo(bx + Math.cos(ang) * len, bound + Math.sin(ang) * len * (0.7 + (i % 2) * 0.5));
        ctx.stroke();
      }
      ctx.lineCap = "butt";

      // bright core at the point of impact
      ctx.fillStyle = rgba(col, hot);
      ctx.beginPath(); ctx.arc(bx, bound, 2 + hot * 3, 0, Math.PI * 2); ctx.fill();
    }

    function render(animated, now) {
      ctx.clearRect(0, 0, w, h);
      drawFoundation(now, animated);   // the deep slab (top surface + front face)
      drawSite(now, animated);         // the protected website, resting on it
      // attacks fall from the exposed surface above and burst on the shield
      for (var i = 0; i < vectors.length; i++) {
        var v = vectors[i];
        if (v.hot > 0.02) drawBurst(v);
        drawVector(v);
      }
      drawBoundary(now, animated);     // the shield line + impact ripples, on top
    }

    function step(dt, now) {
      var i, v;
      for (i = 0; i < vectors.length; i++) {
        v = vectors[i];
        v.p += dt * v.speed;
        if (v.hot > 0) v.hot = Math.max(0, v.hot - dt * 1.7);
        if (v.p >= 1) {
          // impact: flash, spawn ripple, respawn at top
          v.hot = 1;
          ripples.push({ x: vx(v, 1), life: 0, teal: v.teal });
          v.p = 0;
        }
      }
      for (i = ripples.length - 1; i >= 0; i--) {
        ripples[i].life += dt * 1.6;
        if (ripples[i].life >= 1) ripples.splice(i, 1);
      }
    }

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      step(dt, now);
      render(true, now);
    }

    function play() {
      if (running || prefersReduced) return;
      running = true; last = 0;
      raf = requestAnimationFrame(frame);
    }
    function pause() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    // --- static (reduced-motion) frame: STILL tells the story ------------
    // Idempotent: resets all transient state so repeated calls (e.g. on resize)
    // paint an identical frame — no accumulating ripples.
    function staticFrame() {
      ripples.length = 0;
      // freeze every vector just short of the line, one mid-burst at impact,
      // so the figure reads "attacks stopped at the boundary" without motion.
      for (var i = 0; i < vectors.length; i++) {
        var v = vectors[i];
        v.p = 0.82 - (i % 4) * 0.12;   // strung along, approaching
        v.hot = 0;
      }
      vectors[2].p = 1; vectors[2].hot = 1;            // one frozen at impact
      ripples.push({ x: vx(vectors[2], 1), life: 0.35, teal: vectors[2].teal });
      render(false, 0);
    }

    seedVectors();
    resize();
    seedVectors(); // re-seed after resize so positions use real width

    if (prefersReduced) {
      staticFrame();
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
        if (prefersReduced) staticFrame();
        else if (!running) render(false, 0);
      }, 150);
    }, { passive: true });
  }

  Array.prototype.forEach.call(hosts, function (host) { new DefenseField(host); });
})();
