/* ============================================================
   WWYW — Code Analyzer Pipeline
   Lights the eight pipeline stages in sequence as the section scrolls
   into view, simulating a scan packet descending the conveyor: source →
   01..08 → verified report. Once lit, stages stay lit (the scan accumulates,
   it doesn't loop) so the figure settles into a "fully processed" state.

   Discipline (mirrors scan-radar.js / defense-field.js): mounts by
   [data-pipeline]; runs once on first intersection; honors
   prefers-reduced-motion by lighting every stage immediately (no travelling
   packet). Pure class toggling — no canvas, no rAF loop.
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  var hosts = document.querySelectorAll("[data-pipeline]");
  if (!hosts.length) return;

  var STEP = 220; // ms between successive stage lights

  function lightAll(stages) {
    Array.prototype.forEach.call(stages, function (s) { s.classList.add("is-lit"); });
  }

  function run(host) {
    var stages = host.querySelectorAll(".pipeline-stage");
    if (!stages.length) return;

    if (prefersReduced) { lightAll(stages); return; }

    var i = 0;
    (function tick() {
      if (i >= stages.length) return;
      stages[i].classList.add("is-lit");
      i += 1;
      setTimeout(tick, STEP);
    })();
  }

  Array.prototype.forEach.call(hosts, function (host) {
    if (!("IntersectionObserver" in window)) { run(host); return; }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { run(entry.target); obs.unobserve(entry.target); }
      });
    }, { threshold: 0.25 });
    io.observe(host);
  });
})();
