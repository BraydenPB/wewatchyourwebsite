/* ============================================================
   WWYW landing — orchestration
   - Mounts LetterGlitch into hero / dividers / footer
   - Lazy-loads the 4 Lottie pillar animations (lottie-web CDN)
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

  /* ---------- Lottie pillar animations ---------- */
  function mountLottie() {
    if (typeof window.lottie === "undefined") return;
    var mounts = document.querySelectorAll("[data-lottie]");
    if (!mounts.length) return;

    function load(el) {
      if (el.dataset.loaded === "true") return;
      el.dataset.loaded = "true";
      var anim = window.lottie.loadAnimation({
        container: el,
        renderer: "svg",
        loop: true,
        autoplay: !prefersReduced,
        path: el.getAttribute("data-lottie")
      });
      if (prefersReduced) {
        anim.addEventListener("DOMLoaded", function () {
          // hold a representative static frame
          anim.goToAndStop(Math.floor(anim.totalFrames * 0.5), true);
        });
      }
    }

    if (!("IntersectionObserver" in window)) {
      mounts.forEach(load);
      return;
    }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          load(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: "200px 0px" });
    mounts.forEach(function (el) { io.observe(el); });
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

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menu.classList.toggle("is-open", open);
      document.body.style.overflow = open ? "hidden" : "";
      // Trap focus inside the overlay: take the page content behind the fixed
      // menu out of the tab order (and the a11y tree) while it is open.
      if (main) main.inert = open;
      if (footer) footer.inert = open;
    }
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
    // Close if viewport grows past the mobile breakpoint.
    var mq = matchMedia("(min-width: 768px)");
    (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(function () {
      if (mq.matches) setOpen(false);
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

  /* ---------- Scroll reveal ---------- */
  function scrollReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;
    if (prefersReduced || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
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
    items.forEach(function (el) { io.observe(el); });
  }

  function init() {
    mountGlitch();
    mountLottie();
    stickyHeader();
    mobileMenu();
    scrollSpy();
    scrollReveal();
    document.documentElement.classList.add("js-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
