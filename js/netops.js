/* ============================================================
   WWYW — Hero Network-Ops panel
   Gives the hero's aggregate "network operations" panel a subtle live pulse:
   the under-watch count drifts gently upward, and the event feed rolls (oldest
   event ages out, a new one arrives at the top). This is the AGGREGATE story —
   deliberately distinct from the per-site watch console further down the page.

   Discipline (mirrors scan-radar.js / pipeline.js): mounts by [data-netops];
   runs only while on-screen and the tab is visible; honors prefers-reduced-
   motion by leaving the static (already-readable) markup untouched. No
   Math.random — deterministic rotation, variation via index.
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  var host = document.querySelector("[data-netops]");
  if (!host || prefersReduced) return;

  var countEl = host.querySelector("[data-netops-count]");
  var feedEl = host.querySelector("[data-netops-feed]");

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
  var nextIdx = 0; // first events already in the DOM are 0..3
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

  var countTimer = 0, feedTimer = 0, running = false;

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
  function play() { if (running) return; running = true; startCount(); startFeed(); }
  function pause() {
    running = false;
    clearInterval(countTimer); countTimer = 0;
    clearInterval(feedTimer); feedTimer = 0;
  }

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
