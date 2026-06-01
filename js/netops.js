/* ============================================================
   WWYW — Hero Network Defense Monitor
   Drives the hero's aggregate "network operations" panel:
     1. a live defense WAVEFORM — a threat-activity trace scrolling right→left,
        with periodic attack spikes (the network's "heartbeat" of blocked threats);
     2. the under-watch count drifting gently upward;
     3. a "threats blocked / min" rate beside the scope;
     4. a rolling event tape (oldest ages out, a new one arrives at the top).
   This is the AGGREGATE story — deliberately distinct from the per-site watch
   console (scan radar) further down the page, and from every other motif on it.

   Discipline (mirrors scan-radar.js / pipeline.js): mounts by [data-netops];
   runs only while on-screen and the tab is visible; honors prefers-reduced-
   motion by painting ONE static, already-readable frame and stopping. No
   Math.random — the trace is a deterministic composite of sines + a fixed
   spike schedule, so it's stable and reproducible.
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  var host = document.querySelector("[data-netops]");
  if (!host) return;

  var countEl = host.querySelector("[data-netops-count]");
  var feedEl = host.querySelector("[data-netops-feed]");
  var waveEl = host.querySelector("[data-netops-wave]");
  var waveLine = host.querySelector("[data-netops-wave-line]");
  var waveArea = host.querySelector("[data-netops-wave-area]");
  var waveHead = host.querySelector("[data-netops-wave-head]");
  var rateEl = host.querySelector("[data-netops-wave-rate]");

  // ---- waveform model (grid units: 300 wide × 80 tall, baseline at y=46) ----
  var GW = 300, GH = 80, BASE = 46, SAMPLES = 60; // one sample every 5 grid-px
  var STEP = GW / (SAMPLES - 1);
  // phase advances each tick; the trace is sampled at integer offsets so it
  // scrolls smoothly. We keep a virtual "x position" that only ever grows.
  var phase = 0;

  // Deterministic spike schedule: an attack lands every `SPIKE_EVERY` phase
  // units, decaying over a few samples — reads as a blocked-threat burst.
  var SPIKE_EVERY = 11;

  // Sample the trace height at a given virtual sample index `s` (larger = newer,
  // i.e. further right). Returns a y in grid space. Composite of two slow sines
  // for an organic idle baseline, plus any active spike's contribution.
  function heightAt(s) {
    var idle =
      Math.sin(s * 0.45) * 3.2 +
      Math.sin(s * 0.17 + 1.3) * 2.0 +
      Math.sin(s * 0.9 + 0.6) * 1.1;
    // spikes: each lands at s ≈ k*SPIKE_EVERY and decays going back in time
    var spike = 0;
    var nearest = Math.round(s / SPIKE_EVERY) * SPIKE_EVERY;
    var k;
    for (k = -1; k <= 1; k++) {
      var c = nearest + k * SPIKE_EVERY;
      var d = s - c;                 // distance from this spike's crest
      if (d < 0) continue;            // spikes only exist once "fired" (d>=0)
      // amplitude varies deterministically by which spike (no RNG)
      var amp = 16 + ((Math.abs(c / SPIKE_EVERY)) % 4) * 4; // 16..28
      spike += amp * Math.exp(-d * d * 0.5); // sharp gaussian crest
    }
    return idle + spike;
  }

  function buildPaths(scroll) {
    var linePts = "", i, s, x, y;
    var firstX = 0, lastX = 0, lastY = BASE;
    for (i = 0; i < SAMPLES; i++) {
      // newest sample (i = SAMPLES-1) is at the right edge (x = GW)
      s = scroll - (SAMPLES - 1 - i);
      x = i * STEP;
      y = BASE - heightAt(s);
      if (y < 2) y = 2; if (y > GH - 2) y = GH - 2;
      linePts += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
      if (i === 0) firstX = x;
      lastX = x; lastY = y;
    }
    if (waveLine) waveLine.setAttribute("d", linePts.trim());
    if (waveArea) {
      // close the area down to the baseline edge for the gradient fill
      waveArea.setAttribute("d",
        linePts.trim() + " L" + lastX.toFixed(1) + " " + GH + " L" + firstX.toFixed(1) + " " + GH + " Z");
    }
    if (waveHead) { waveHead.setAttribute("cx", lastX.toFixed(1)); waveHead.setAttribute("cy", lastY.toFixed(1)); }
  }

  // Live "threats blocked / min" — derived from the spike cadence so the number
  // is consistent with what's drawn. Drifts within a believable band.
  function renderRate(scroll) {
    if (!rateEl) return;
    var v = 142 + Math.round(Math.sin(scroll * 0.08) * 9 + Math.sin(scroll * 0.31) * 4);
    rateEl.textContent = v.toLocaleString("en-US");
  }

  // ---- live count drift (gentle, around the real 2.9M figure) ----
  var base = 2900000;
  var shown = base;
  function renderCount(v) {
    if (countEl) countEl.textContent = Math.round(v).toLocaleString("en-US");
  }

  // ---- rolling event feed (deterministic cycle, no RNG) ----
  var EVENTS = [
    { txt: "malware removed · shared host", teal: false },
    { txt: "vuln flagged · vibe-coded app", teal: true },
    { txt: "core hashes verified · WP 6.x", teal: false },
    { txt: "entry point sealed · root cause", teal: false },
    { txt: "secrets scan clean · API repo", teal: true },
    { txt: "intrusion blocked · edge layer", teal: false },
    { txt: "attack chain mapped · report sent", teal: true },
    { txt: "integrity scan · 4s · no change", teal: false }
  ];
  // The first four events (indices 0..3) are already rendered in the DOM, so the
  // next event to inject is index 4 — starting at 0 would re-show event 0 as a
  // visible duplicate of the row already on screen.
  var nextIdx = 4;
  function buildRow(ev) {
    var li = document.createElement("li");
    li.className = "netops__event";
    var dot = document.createElement("span");
    dot.className = "netops__event-dot" + (ev.teal ? " netops__event-dot--teal" : "");
    var txt = document.createElement("span");
    txt.className = "netops__event-txt";
    txt.textContent = ev.txt;
    var t = document.createElement("span");
    t.className = "netops__event-t";
    t.textContent = "0s";
    li.appendChild(dot); li.appendChild(txt); li.appendChild(t);
    // reset entrance animation so the new row fades in
    li.style.animation = "none";
    requestAnimationFrame(function () { li.style.animation = ""; });
    return li;
  }
  function ageStamps() {
    var rows = feedEl ? feedEl.children : [];
    for (var i = 0; i < rows.length; i++) {
      var t = rows[i].querySelector(".netops__event-t");
      if (t) t.textContent = (i * 3) + "s";
    }
  }

  // Paint one static, readable frame (used for reduced-motion AND as the initial
  // frame before the loop runs / when paused). This recomputes the SAME frame the
  // HTML seeds inline (buildPaths(66) / rate at 66) — so no-JS shows that baseline
  // and JS simply reasserts it before animating. Keep the two in sync.
  var STATIC_SCROLL = SAMPLES + 6; // = 66
  function paintStatic() {
    buildPaths(STATIC_SCROLL); // offset places spikes mid-scope, not at an edge
    renderRate(STATIC_SCROLL);
  }

  var countTimer = 0, feedTimer = 0, waveRaf = 0, running = false, lastT = 0;

  function startCount() {
    if (countTimer) return;
    countTimer = setInterval(function () {
      shown += 1 + (nextIdx % 3); // small deterministic increment
      renderCount(shown);
    }, 1800);
  }
  function startFeed() {
    if (feedTimer || !feedEl) return;
    feedTimer = setInterval(function () {
      var ev = EVENTS[nextIdx % EVENTS.length];
      nextIdx += 1;
      feedEl.insertBefore(buildRow(ev), feedEl.firstChild);
      while (feedEl.children.length > 4) feedEl.removeChild(feedEl.lastChild);
      ageStamps();
    }, 3200);
  }
  function waveFrame(now) {
    if (!running) return;
    waveRaf = requestAnimationFrame(waveFrame);
    var dt = lastT ? (now - lastT) / 1000 : 0;
    lastT = now;
    phase += dt * 6; // ~6 samples/sec → one new sample every ~0.17s
    buildPaths(phase);
    renderRate(phase);
  }
  function startWave() {
    if (waveRaf || !waveEl) return;
    lastT = 0;
    waveRaf = requestAnimationFrame(waveFrame);
  }

  function play() {
    if (running || prefersReduced) return;
    running = true;
    startCount(); startFeed(); startWave();
  }
  function pause() {
    running = false;
    clearInterval(countTimer); countTimer = 0;
    clearInterval(feedTimer); feedTimer = 0;
    if (waveRaf) cancelAnimationFrame(waveRaf); waveRaf = 0;
  }

  // Always paint an initial readable trace so the scope is never blank (no-JS
  // leaves it blank, but the moment this script runs it has a baseline).
  paintStatic();

  if (prefersReduced) return; // static frame is already drawn; do not animate

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      var on = entries[0].isIntersecting;
      on && !document.hidden ? play() : pause();
    }, { threshold: 0.2 });
    io.observe(host);
  } else {
    play();
  }
  document.addEventListener("visibilitychange", function () {
    document.hidden ? pause() : (host.getBoundingClientRect().top < innerHeight && play());
  });
})();
