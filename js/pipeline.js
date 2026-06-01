/* ============================================================
   WWYW — Code Analyzer Pipeline (live scan engine)
   A glowing scan beam descends the rail when the figure enters view, igniting
   each of the eight stages in turn: the node lights, the rail segment flows, and
   the stage's finding readout reveals (counting up where it's a number). When the
   beam clears the last stage the output node ignites — the verified report has
   been assembled. The scan runs once and settles in its fully-processed state
   (it accumulates, it does not loop).

   Discipline (mirrors scan-radar.js / defense-field.js): mounts by
   [data-pipeline]; runs once on first intersection; honors
   prefers-reduced-motion by lighting every stage immediately with findings shown
   and no travelling beam. The beam is positioned by writing --beam-top onto the
   host; class toggles drive the lit/finding/complete states. One short rAF pass
   per mount — no persistent loop.
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  var hosts = document.querySelectorAll("[data-pipeline]");
  if (!hosts.length) return;

  var SCAN_MS = 2200; // total beam travel time across the figure

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  // Count a finding number up to its target as its stage lights.
  function countFind(stage) {
    var el = stage.querySelector("[data-find-to]");
    if (!el) return;
    var to = parseInt(el.getAttribute("data-find-to"), 10) || 0;
    if (prefersReduced || to <= 0) { el.textContent = String(to); return; }
    var start = null,
      dur = 420;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      el.textContent = String(Math.round(easeOut(p) * to));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function lightStage(stage) {
    if (stage.classList.contains("is-lit")) return;
    stage.classList.add("is-lit");
    countFind(stage);
  }

  function settleAll(host, stages) {
    Array.prototype.forEach.call(stages, lightStage);
    host.classList.add("is-complete");
  }

  function run(host) {
    var stages = host.querySelectorAll(".pipeline-stage");
    if (!stages.length) return;

    if (prefersReduced || !("requestAnimationFrame" in window)) {
      settleAll(host, stages);
      return;
    }

    // Geometry: the beam travels from the first node's center to the last node's
    // center, in coordinates relative to the host. Each stage lights when the
    // beam reaches its node center. Measured once up front; the figure is static
    // in layout during the brief scan.
    var hostTop = host.getBoundingClientRect().top;
    var centers = Array.prototype.map.call(stages, function (s) {
      var n = s.querySelector(".pipeline-stage__num");
      var r = (n || s).getBoundingClientRect();
      return r.top - hostTop + r.height / 2;
    });
    var startY = centers[0];
    var endY = centers[centers.length - 1];
    var span = Math.max(1, endY - startY);

    host.classList.add("is-scanning");

    var begin = null;
    function frame(ts) {
      if (begin === null) begin = ts;
      var p = Math.min(1, (ts - begin) / SCAN_MS);
      var y = startY + easeOut(p) * span;
      // Center the 64px beam on its leading edge.
      host.style.setProperty("--beam-top", (y - 48) + "px");

      for (var i = 0; i < centers.length; i++) {
        if (y >= centers[i] - 2) lightStage(stages[i]);
      }

      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        // Fade the beam out and mark the report assembled.
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
    }, { threshold: 0.25 });
    io.observe(host);
  });
})();
