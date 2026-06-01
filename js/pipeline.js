/* ============================================================
   WWYW — Code Analyzer Inspection
   The figure is the artifact under analysis. A scan sweep descends the code
   panel; as it crosses a line that hides a threat, that threat SURFACES in place
   (a hardcoded key, an injection sink, a smuggled bundle import, a zero-width
   GLASSWORM character) and the matching stage in the findings ledger resolves —
   lighting its node and revealing its finding. Stages with no single line (static
   = clean, adversarial verification, attack-chain construction) resolve in order
   as the sweep completes. When all eight are resolved the verdict assembles: a
   verified vulnerability report.

   Discipline (mirrors scan-radar.js / defense-field.js): mounts by
   [data-inspect]; runs once on first intersection; honors prefers-reduced-motion
   by surfacing every threat and resolving every stage immediately with no sweep.
   The sweep is positioned by writing --scan-y onto the code figure; class toggles
   drive flagged / lit / complete states. One short rAF pass per mount — measure
   geometry once up front (no per-frame layout reads), no persistent loop.
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  var hosts = document.querySelectorAll("[data-inspect]");
  if (!hosts.length) return;

  var SCAN_MS = 2600; // sweep travel time across the code panel

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  // Count a finding number up to its target as its stage resolves.
  function countFind(stage) {
    var el = stage.querySelector("[data-find-to]");
    if (!el) return;
    var to = parseInt(el.getAttribute("data-find-to"), 10) || 0;
    if (prefersReduced || to <= 0) { el.textContent = String(to); return; }
    var start = null, dur = 420;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      el.textContent = String(Math.round(easeOut(p) * to));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Resolve a ledger stage: light it, count its finding, bump the progress
  // counter. Deliberately decoupled from the code-line flagging below — the
  // ledger always fills 01→08 in listed order, while threats surface in the code
  // by the sweep's vertical position. (No connector is drawn between a ledger row
  // and its line, so the two cadences need not be synchronised; keeping them
  // independent is what makes the ledger read cleanly top-to-bottom.)
  function resolveStage(stage, progEl, progState) {
    if (stage.classList.contains("is-lit")) return;
    stage.classList.add("is-lit");
    countFind(stage);
    progState.n += 1;
    if (progEl) progEl.textContent = String(progState.n);
  }

  function run(host) {
    var stages = host.querySelectorAll(".inspect-stage");
    if (!stages.length) return;

    var lines = host.querySelectorAll(".cl[data-line]");
    var scan = host.querySelector("[data-scan]");
    var codeBody = host.querySelector(".inspect__pre");
    var progEl = host.querySelector("[data-prog-to]");
    var progState = { n: 0 };
    var n = stages.length;

    function lightAll() {
      Array.prototype.forEach.call(stages, function (s) { resolveStage(s, progEl, progState); });
      Array.prototype.forEach.call(lines, function (l) { l.classList.add("is-flagged"); });
    }

    if (prefersReduced || !("requestAnimationFrame" in window) || !scan || !codeBody) {
      lightAll();
      host.classList.add("is-complete");
      return;
    }

    // Measure code-line offsets once up front (no per-frame layout reads): each
    // threatened line gets the sweep-Y at which it should surface.
    var codeTop = codeBody.getBoundingClientRect().top;
    var codeH = codeBody.offsetHeight;
    var lineYs = Array.prototype.map.call(lines, function (l) {
      return l.getBoundingClientRect().top - codeTop + 10;
    });

    host.classList.add("is-scanning");

    var begin = null;
    function frame(ts) {
      if (begin === null) begin = ts;
      var p = Math.min(1, (ts - begin) / SCAN_MS);
      var y = easeOut(p) * codeH;
      host.style.setProperty("--scan-y", y + "px");

      // Ledger fills strictly in order, paced by overall progress.
      var resolved = Math.round(p * n);
      for (var s = 0; s < resolved && s < n; s++) {
        resolveStage(stages[s], progEl, progState);
      }
      // Threats surface in the code as the sweep crosses their line.
      for (var i = 0; i < lineYs.length; i++) {
        if (y >= lineYs[i] - 4) lines[i].classList.add("is-flagged");
      }

      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        lightAll(); // seal: every stage resolved, every threat surfaced
        host.classList.remove("is-scanning");
        host.classList.add("is-complete");
      }
    }
    requestAnimationFrame(frame);
  }

  Array.prototype.forEach.call(hosts, function (host) {
    if (!("IntersectionObserver" in window)) { run(host); return; }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { run(entry.target); obs.unobserve(entry.target); }
      });
    }, { threshold: 0.3 });
    io.observe(host);
  });
})();
