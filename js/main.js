/* ============================================================
   WWYW landing — orchestration
   - Mounts LetterGlitch into hero / dividers / footer
   - Drives the "watch console" — 4 Lottie scan passes on one screen
   - Sticky-header scroll state + mobile menu
   - IntersectionObserver scroll-reveal
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- LetterGlitch backdrops ---------- */
  function mountGlitch() {
    if (typeof window.LetterGlitch !== "function") return;
    var targets = document.querySelectorAll("[data-glitch]");
    targets.forEach(function (el) {
      // eslint-disable-next-line no-new
      new window.LetterGlitch(el, {
        glitchColors: ["#69ff12", "#3d6f3c", "#1aa6b7"],
        smooth: true,
        outerVignette: true
      });
    });
  }

  /* ---------- Watch console: one screen, four scan passes ----------
     - Lazy-loads all 4 Lottie animations (lottie-web CDN), but only the
       ACTIVE pass plays — the rest are paused (perf + the "same screen,
       four passes" concept).
     - Auto-cycles the live HIGHLIGHT through the 4 passes; pauses on
       hover/focus/off-screen. All copy is ALWAYS readable (a list, not a
       tablist) — the active row is a visual + aria-current highlight.
     - Panels reveal with a staggered scan-sweep on scroll-in, then stay open.
     - prefers-reduced-motion: no autoplay/cycle/reveal — all copy open + a
       static frame; clicking a pass still moves the highlight + screen.
  ------------------------------------------------------------------- */
  var READOUTS = [
    { label: "scanning · malware signatures", status: "removing" },
    { label: "hashing · core file integrity", status: "verified" },
    { label: "tracing · attacker entry point", status: "root cause" },
    { label: "monitoring · intrusion detection", status: "protected" }
  ];

  function mountConsole() {
    var root = document.querySelector("[data-console]");
    if (!root || typeof window.lottie === "undefined") return;

    var mounts = Array.prototype.slice.call(root.querySelectorAll("[data-lottie]"));
    var tabs = Array.prototype.slice.call(root.querySelectorAll("[data-pass-btn]"));
    var items = Array.prototype.slice.call(root.querySelectorAll("[data-pass-item]"));
    var passes = root.querySelector("[data-passes]");
    var screen = root.querySelector(".console__screen");
    var readoutLabel = root.querySelector("[data-readout-label]");
    var readoutStatus = root.querySelector("[data-readout-status]");
    if (!mounts.length || !tabs.length) return;

    // ms per pass is the CSS --pass-dwell on .pass__bar-fill; that animation's
    // completion (animationend) is the single cycle clock — no JS duplicate.
    var anims = [];
    var active = 0;
    var toggle = root.querySelector("[data-console-toggle]");
    var toggleLabel = root.querySelector("[data-console-toggle-label]");
    var canHover = typeof matchMedia === "function" && matchMedia("(hover: hover)").matches;

    var hoverPaused = false; // transient: keyboard focus inside the console (pointer hover no longer pauses)
    var userPaused = false;  // sticky: user pressed the toggle (or tapped on touch)
    // Two separate visibility concerns — collapsing them is what froze the bars on
    // desktop. The PASSES list is much taller than the viewport, so scrolling down to
    // read the lower rows pushes the Lottie SCREEN off the top while the bars stay in
    // view. Gate the cycle on the passes being visible (what the user watches), and
    // gate only the Lottie's play/pause on the screen being visible (a perf concern).
    var cycleVisible = false;  // the passes list (bars + highlight) is on screen
    var screenVisible = false; // the Lottie panel is on screen

    // Halted = the cycle must not progress: user/hover pause OR the passes are off
    // screen. When halted the bar's CSS fill freezes in place (animation-play-state via
    // data-paused) rather than racing to scaleX(1) and firing a dropped animationend.
    function isHalted() { return hoverPaused || userPaused || !cycleVisible; }

    function load(i) {
      var el = mounts[i];
      if (!el || el.dataset.loaded === "true") return;
      el.dataset.loaded = "true";
      anims[i] = window.lottie.loadAnimation({
        container: el,
        renderer: "svg",
        loop: true,
        autoplay: false,
        path: el.getAttribute("data-lottie")
      });
      // play immediately if this is the active pass and we're allowed to move
      anims[i].addEventListener("DOMLoaded", function () {
        if (prefersReduced) {
          anims[i].goToAndStop(Math.floor(anims[i].totalFrames * 0.55), true);
        } else if (i === active && screenVisible && !hoverPaused && !userPaused) {
          anims[i].play();
        }
      });
    }

    function select(i, focusBtn) {
      if (i === active) return;
      // Highlight the active row (visual + aria-current). Panels stay open —
      // this is a list, not a tablist; the "active" pass is just the one the
      // live scan is on right now.
      items.forEach(function (li, n) { li.classList.toggle("is-active", n === i); });
      tabs.forEach(function (b, n) {
        if (n === i) b.setAttribute("aria-current", "true");
        else b.removeAttribute("aria-current");
      });
      // swap which single Lottie plays on the screen
      mounts.forEach(function (m, n) { m.hidden = n !== i; });
      if (anims[active]) anims[active].stop();
      active = i;
      load(active);
      if (anims[active] && !prefersReduced && screenVisible && !hoverPaused && !userPaused) anims[active].play();
      if (readoutLabel) readoutLabel.textContent = READOUTS[i].label;
      if (readoutStatus) readoutStatus.textContent = READOUTS[i].status;
      restartBar();
      if (focusBtn) tabs[i].focus();
    }

    // re-trigger the active pass's progress-bar fill animation
    function restartBar() {
      var fill = tabs[active].querySelector(".pass__bar-fill");
      if (!fill) return;
      fill.style.animation = "none";
      // force reflow so the animation restarts
      void fill.offsetWidth;
      fill.style.animation = "";
    }

    // The progress bar's CSS fill (pass-fill, --pass-dwell long) IS the cycle
    // clock: when it finishes, advance to the next pass. Hover/user pauses freeze
    // the fill via animation-play-state (data-paused), which simply delays the
    // animationend — it is never reset, so repeated pause/resume can't wedge the
    // cycle. One clock, no setInterval to drift against or clear mid-flight.
    function advance() { select((active + 1) % tabs.length); }
    passes.addEventListener("animationend", function (e) {
      if (e.animationName !== "pass-fill") return;
      if (prefersReduced || isHalted()) return; // isHalted() already covers off-screen
      advance();
    });

    // Staggered "scan sweep" reveal: panels open one-by-one on scroll-in, then
    // STAY open (accumulate) so all copy is readable without a click. Fast
    // (~110ms/row, ~1s total) and decoupled from the 5.2s highlight loop. Under
    // reduced-motion / no-JS the CSS renders everything open, so this only runs
    // as a progressive enhancement.
    var revealed = false;
    function revealPasses() {
      if (revealed || prefersReduced) return;
      revealed = true;
      passes.classList.add("is-revealing");
      items.forEach(function (li, n) {
        window.setTimeout(function () { li.classList.add("is-revealed"); }, 120 + n * 110);
      });
    }

    // Apply state for both visibility concerns:
    //  • the BAR/cycle freezes via data-paused → animation-play-state when isHalted()
    //    (user/hover pause or the passes scrolled out of view). It continues in place
    //    on resume — animationend drives the cycle, no interval to start or clear.
    //  • the LOTTIE plays only while its screen panel is on-screen and not user/hover
    //    paused — independent of cycle visibility, purely a render-cost concern.
    function applyHalt() {
      root.setAttribute("data-paused", isHalted() ? "true" : "false");
      if (!anims[active]) return;
      var lottiePlaying = screenVisible && !prefersReduced && !hoverPaused && !userPaused;
      if (lottiePlaying) anims[active].play();
      else anims[active].pause();
    }
    function setHoverPaused(state) {
      // a sticky user-pause overrides transient hover state
      if (userPaused) { hoverPaused = state; return; }
      hoverPaused = state;
      applyHalt();
    }
    function setUserPaused(state) {
      userPaused = state;
      if (toggle) {
        toggle.setAttribute("aria-pressed", state ? "true" : "false");
        if (toggleLabel) toggleLabel.textContent = state ? "Play" : "Pause";
      }
      applyHalt();
    }

    // ----- wire interactions -----
    // Toggle button — the discoverable WCAG 2.2.2 pause control.
    if (toggle) {
      toggle.addEventListener("click", function () { setUserPaused(!userPaused); });
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        // On touch (no hover), a tap is the user taking control — pause stickily
        // so the live highlight doesn't move off the pass they just picked.
        if (!canHover && !userPaused) setUserPaused(true);
        select(i, false);
      });
      tab.addEventListener("keydown", function (e) {
        var key = e.key;
        var next = null;
        if (key === "ArrowDown" || key === "ArrowRight") next = (i + 1) % tabs.length;
        else if (key === "ArrowUp" || key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        else if (key === "Home") next = 0;
        else if (key === "End") next = tabs.length - 1;
        if (next !== null) { e.preventDefault(); select(next, true); }
      });
    });

    // Pointer hover does NOT pause anymore: freezing the whole scan the instant the
    // cursor crossed the console read as broken/distracting. The discoverable Pause
    // button (WCAG 2.2.2) is the real pause control. We DO still pause on keyboard
    // focus within the console, so a keyboard user reading a row doesn't have the
    // live highlight slide off the pass they just landed on.
    root.addEventListener("focusin", function () { setHoverPaused(true); });
    root.addEventListener("focusout", function () {
      if (!root.contains(document.activeElement)) setHoverPaused(false);
    });

    // The passes list scrolled in/out of view → freeze/resume the cycle. The bar
    // continues in place on resume; on the very first reveal restart it once (the
    // fill may have raced to scaleX(1) during initial page load while off-screen).
    var everShown = false;
    function onCycleVisible(isVisible) {
      cycleVisible = isVisible;
      if (isVisible && !everShown) {
        everShown = true;
        load(active);
        if (!prefersReduced && !isHalted()) restartBar();
      }
      applyHalt();
    }
    // The Lottie panel scrolled in/out of view → play/pause the animation (perf only).
    function onScreenVisible(isVisible) {
      screenVisible = isVisible;
      if (isVisible) load(active);
      applyHalt();
    }

    // preload the active pass right away; lazily warm the rest after
    load(active);

    if ("IntersectionObserver" in window) {
      // 1a) CYCLE clock: gate on the PASSES list (the bars + highlight the user
      //     watches). It is taller than the viewport, so use isIntersecting — keep
      //     cycling whenever ANY part of the list is on screen. This is the fix for
      //     "bars freeze when I scroll down to read the passes": the cycle no longer
      //     depends on the Lottie screen, which scrolls off the top first.
      var cycleIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { onCycleVisible(entry.isIntersecting); });
      }, { rootMargin: "0px", threshold: 0 });
      cycleIo.observe(passes);

      // 1b) LOTTIE render: gate on the screen panel. Use a ratio threshold so we only
      //     pay to animate it while it's meaningfully on screen — purely a perf knob,
      //     decoupled from the cycle above.
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { onScreenVisible(entry.intersectionRatio >= 0.25); });
      }, { rootMargin: "0px", threshold: [0, 0.25, 0.5] });
      io.observe(screen || root);

      // 2) fire the scan-sweep reveal only when the RAIL itself scrolls into
      //    view, so the staggered open actually happens in front of the user
      //    (not while the panels are still below the fold). rootMargin pulls the
      //    trigger up so it starts just as the first rows appear.
      var revealIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { revealPasses(); revealIo.disconnect(); }
        });
      }, { rootMargin: "0px 0px -20% 0px", threshold: 0.15 });
      revealIo.observe(passes);
    } else {
      // No IntersectionObserver: assume on-screen and run.
      onScreenVisible(true);
      onCycleVisible(true);
    }
  }

  /* ---------- Sticky header scroll state ---------- */
  function stickyHeader() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var ticking = false;
    function update() {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ---------- Mobile menu ---------- */
  function mobileMenu() {
    var toggle = document.querySelector(".nav__toggle");
    var menu = document.getElementById("mobile-menu");
    if (!toggle || !menu) return;

    var main = document.querySelector("main");
    var footer = document.querySelector(".site-footer");
    var scrim = menu.querySelector("[data-menu-scrim]");
    var firstLink = menu.querySelector(".mobile-menu__link");
    var revealTimer = null;

    function setOpen(open) {
      if (open) {
        // Lift `hidden` (display:none) BEFORE flipping the open class so the
        // panel/scrim transitions actually run from their closed state.
        menu.hidden = false;
        // Force a reflow so the just-shown element animates instead of jumping.
        // eslint-disable-next-line no-unused-expressions
        menu.offsetHeight;
      }
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menu.classList.toggle("is-open", open);
      document.body.style.overflow = open ? "hidden" : "";
      // Trap focus inside the overlay: take the page content behind the fixed
      // menu out of the tab order (and the a11y tree) while it is open.
      if (main) main.inert = open;
      if (footer) footer.inert = open;

      if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
      if (open) {
        // Move focus into the menu for keyboard users. The panel is
        // visibility:hidden until the open transition runs, and hidden
        // elements aren't focusable — so wait for the panel to settle
        // (a hair past --dur-slow) before focusing the first link.
        if (firstLink) {
          revealTimer = setTimeout(function () {
            if (toggle.getAttribute("aria-expanded") === "true") {
              firstLink.focus({ preventScroll: true });
            }
          }, 300);
        }
      } else {
        // Re-apply `hidden` once the close transition has settled, so the
        // collapsed menu can't trap pointer/scroll events behind the page.
        revealTimer = setTimeout(function () {
          if (toggle.getAttribute("aria-expanded") !== "true") menu.hidden = true;
        }, 320);
      }
    }

    function close() {
      setOpen(false);
      toggle.focus();
    }

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    // Tapping a nav link or CTA navigates and closes (no focus return — the
    // user is leaving the menu by intent).
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    // Backdrop dismiss — return focus to the toggle, like Escape.
    if (scrim) scrim.addEventListener("click", close);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        close();
      }
    });
    // Close if viewport grows past the mobile breakpoint (keep 768px synced
    // with the CSS hide breakpoint + header anchor).
    var mq = matchMedia("(min-width: 768px)");
    (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(function () {
      if (mq.matches && toggle.getAttribute("aria-expanded") === "true") close();
    });
  }

  /* ---------- Active-link highlighting on scroll ---------- */
  function scrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".nav__link[href^='#']"));
    if (!links.length || !("IntersectionObserver" in window)) return;
    var map = {};
    links.forEach(function (l) {
      var id = l.getAttribute("href").slice(1);
      var sec = document.getElementById(id);
      if (sec) map[id] = l;
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          links.forEach(function (l) { l.removeAttribute("aria-current"); });
          var active = map[entry.target.id];
          if (active) active.setAttribute("aria-current", "true");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(map).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) io.observe(sec);
    });
  }

  /* ---------- Scroll reveal (+ staggered groups) ---------- */
  function scrollReveal() {
    // Assign a stagger index to each child of a reveal-group so CSS can delay them.
    Array.prototype.forEach.call(document.querySelectorAll(".reveal-group"), function (g) {
      Array.prototype.forEach.call(g.children, function (child, i) {
        child.style.setProperty("--i", i);
      });
    });

    var items = document.querySelectorAll(".reveal, .reveal-group");
    if (!items.length) return;
    if (prefersReduced || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(items, function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
    Array.prototype.forEach.call(items, function (el) { io.observe(el); });
  }

  /* ---------- Count-up for stats ---------- */
  function countUp() {
    var nums = document.querySelectorAll("[data-count]");
    if (!nums.length) return;

    function render(el, value) {
      // Format with thousands separators; re-append any suffix markup (+, %, /yr…).
      var sup = el.getAttribute("data-sup") || "";
      var dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
      var formatted = dec > 0
        ? value.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })
        : Math.round(value).toLocaleString("en-US");
      el.innerHTML = formatted + (sup ? '<span class="stat__sup">' + sup + "</span>" : "");
    }

    function run(el) {
      var target = parseFloat(el.getAttribute("data-count"));
      if (isNaN(target)) return;
      if (prefersReduced) { render(el, target); return; }
      var dur = 1500, start = null;
      var ease = function (t) { return 1 - Math.pow(1 - t, 3); }; // out-cubic
      function step(ts) {
        if (start === null) start = ts;
        var t = Math.min(1, (ts - start) / dur);
        render(el, target * ease(t));
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(nums, function (el) { run(el); });
      return;
    }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { run(entry.target); obs.unobserve(entry.target); }
      });
    }, { threshold: 0.4 });
    Array.prototype.forEach.call(nums, function (el) { io.observe(el); });
  }

  function init() {
    mountGlitch();
    mountConsole();
    stickyHeader();
    mobileMenu();
    scrollSpy();
    scrollReveal();
    countUp();
    document.documentElement.classList.add("js-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
