/* ============================================================
   WWYW — Interactive Code Analyzer (scanner page)
   Turns the static .inspect window into a driven, interactive scanner:
   a visitor enters a GitHub repo / app URL, hits "Scan Now", and the eight-stage
   pipeline runs to a verified report. Built as a TEMPLATE — the only place that
   produces results is requestScan() (the BACKEND SEAM below); swap its demo body
   for a fetch() to the real analyzer API and the whole UI renders from real data.

   Discipline (mirrors netops.js / pipeline.js): ES5 IIFE, no build, no deps;
   mounts on [data-scanner-form]; honors prefers-reduced-motion (settles straight
   to the full report, no sweep) and the global WCAG-2.2.2 "wwyw:motion" pause
   (if paused mid-run, jump to the resolved end-state instead of blind-animating).
   No Math.random — demo datasets and timing are deterministic.

   This host carries [data-scan-driven], which tells pipeline.js NOT to auto-run
   it — this module owns the inspect window's run lifecycle.
   ============================================================ */
(function () {
  "use strict";

  var root = document.querySelector("[data-scanner-form]");
  if (!root) return;

  var prefersReduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- DOM ---------------------------------------------------------------- */
  var form = root.querySelector("[data-scan-launch]");
  var input = root.querySelector("[data-scan-input]");
  var submitBtn = root.querySelector("[data-scan-submit]");
  var submitLabel = root.querySelector("[data-scan-submit-label]");
  var errEl = root.querySelector("[data-scan-error]");
  var sampleBtns = root.querySelectorAll("[data-scan-sample]");

  var inspect = root.querySelector("[data-inspect]");
  var stages = inspect ? inspect.querySelectorAll(".inspect-stage") : [];
  var lines = inspect ? inspect.querySelectorAll(".cl[data-line]") : [];
  var scanBand = inspect ? inspect.querySelector("[data-scan]") : null;
  var codeBody = inspect ? inspect.querySelector(".inspect__pre") : null;
  var progEl = inspect ? inspect.querySelector("[data-prog-to]") : null;
  var fileEl = inspect ? inspect.querySelector("[data-inspect-file]") : null;
  var langEl = inspect ? inspect.querySelector("[data-inspect-lang]") : null;
  var verdictSub = inspect ? inspect.querySelector("[data-verdict-sub]") : null;

  var report = root.querySelector("[data-scan-report]");
  var reportTitle = report ? report.querySelector("[data-report-title], #scan-report-title") : null;
  var reportTarget = root.querySelector("[data-report-target]");
  var reportVerdict = root.querySelector("[data-report-verdict]");
  var sumConfirmed = root.querySelector("[data-summary-confirmed]");
  var sumCritical = root.querySelector("[data-summary-critical]");
  var sumChains = root.querySelector("[data-summary-chains]");
  var findingsEl = root.querySelector("[data-report-findings]");
  var resetBtn = root.querySelector("[data-scan-reset]");
  var statusEl = root.querySelector("[data-scan-status]");
  var statusStageEl = root.querySelector("[data-scan-status-stage]");
  var statusTextEl = root.querySelector("[data-scan-status-text]");

  if (!form || !input || !inspect || !stages.length) return;

  // Per-stage dwell — the scanner page replicates a real multi-stage scan, so
  // each of the 8 stages takes a visible beat to "run" before it resolves
  // (≈20s total). This is the deliberate difference from the home page's quick
  // for-show sweep. Believable, not literal: the real product quotes "under 5
  // minutes", but a demo that takes minutes is unusable, so we compress to a
  // substantial-but-watchable ~2.3s/stage.
  var STAGE_MS = 2300;       // how long each stage spends "running"
  var STAGE_GAP_MS = 200;    // brief settle between stages
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  // Status copy shown live while each stage runs ("scanning" verb per stage).
  var STAGE_STATUS = [
    "Scanning for exposed secrets",
    "Parsing AST · running Semgrep rules",
    "Auditing dependencies against OSV",
    "Deep LLM review of program logic",
    "Inspecting compiled bundle output",
    "Hunting hidden-character steganography",
    "Red-team verifying each finding",
    "Constructing attack chains"
  ];

  // Render the code panel from a result's optional `code` field, REPLACING the
  // seeded sample source. Built entirely with createElement + textContent — the
  // `code` field is untrusted source we just fetched to scan, so it must never
  // be interpolated as HTML (innerHTML here would be XSS in the one product where
  // that's most damning). When `result.code` is absent (today's demo), the
  // seeded sample in the HTML is left in place — it is also the no-JS floor.
  //
  // After rendering we re-query `lines` so every closure that reads it
  // (driveSweep/settleInspect/resetInspect) picks up the new rows for free.
  // Geometry is measured later (in driveSweep), so it always reflects what's
  // actually on screen.
  //
  // code shape: { file?, lang?, lines: [ { n:int, text:string, stage?:int } ] }
  // A line with `stage` set highlights the WHOLE line when that stage is a hit
  // (the seeded sample highlights a token within the line — a small fidelity
  // difference the client should know about; whole-line is fine for real source).
  function renderCode(result) {
    var code = result && result.code;
    if (!code || !code.lines || !code.lines.length || !codeBody) return;

    var codeEl = codeBody.querySelector("code");
    if (!codeEl) return;

    // clear existing rows without touching the sibling [data-scan] sweep band
    while (codeEl.firstChild) codeEl.removeChild(codeEl.firstChild);

    code.lines.forEach(function (ln) {
      var cl = document.createElement("span");
      cl.className = "cl";
      var hasStage = typeof ln.stage === "number";
      if (hasStage) cl.setAttribute("data-line", String(ln.n));

      var gutter = document.createElement("span");
      gutter.className = "ln";
      gutter.textContent = String(ln.n);
      cl.appendChild(gutter);

      if (hasStage) {
        // whole-line threat token (carries data-threat so surfacing/lineIsActive work)
        var threat = document.createElement("span");
        threat.className = "threat";
        threat.setAttribute("data-threat", String(ln.stage));
        threat.textContent = ln.text || "";
        cl.appendChild(threat);
      } else {
        cl.appendChild(document.createTextNode(ln.text || ""));
      }
      codeEl.appendChild(cl);
    });

    if (fileEl && code.file) fileEl.textContent = code.file;
    if (langEl && code.lang) langEl.textContent = code.lang;

    // re-query the line set so the run lifecycle drives the freshly-rendered rows
    lines = inspect.querySelectorAll(".cl[data-line]");
  }

  // A code line surfaces a threat only if at least one of its threat tokens
  // belongs to a stage the result marked "hit". This keeps the fixed code
  // artifact coherent with whatever stages resolve — clean stages never light
  // their line (important once real ScanResult data drives the view).
  function lineIsActive(line, result) {
    var threats = line.querySelectorAll("[data-threat]");
    if (!threats.length) return false;
    for (var i = 0; i < threats.length; i++) {
      var si = parseInt(threats[i].getAttribute("data-threat"), 10);
      var spec = result && result.stages && result.stages[si];
      if (spec && spec.find === "hit") return true;
    }
    return false;
  }

  /* === BACKEND SEAM =========================================================
     requestScan(target) -> Promise<ScanResult>

     TODAY (demo mode): resolves to a deterministic sample ScanResult after a
     short, believable delay. NOTHING is transmitted — the input never leaves the
     browser.

     TO GO LIVE: replace the body with a real request, e.g.

         function requestScan(target) {
           return fetch("https://api.wewatchyourwebsite.com/v1/scan", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ target: target })
           }).then(function (r) {
             if (!r.ok) throw new Error("Scan failed: " + r.status);
             return r.json();         // must match the ScanResult shape below
           });
         }

     Then delete the [data-scan-demo-note] line in scanner/index.html, and add the
     API origin to the connect-src / Content-Security-Policy in _headers.

     ScanResult shape (the findings, summary, stages, verdict, and chrome filename
     render from this — real data drives those parts of the view). NOTE: the code-
     preview pane (the source + its data-threat tokens) is a FIXED demo artifact in
     scanner/index.html and is decorative, NOT driven by this object. With a real
     backend it will show the demo file regardless of target; to show real source,
     either link out to the repo from the report, or add an optional `code` field
     here and render it into .inspect__pre (and surface lines from the result):
       {
         target:   string,                 // echoed back in the report header
         file:     string,                  // shown in the window chrome
         verdict:  "clean" | "review" | "action",   // overall disposition
         summary:  { confirmed:int, critical:int, chains:int, owasp:string },
         // one entry per pipeline stage, in pipeline order (index 0..7), aligned
         // to the eight .inspect-stage[data-stage] nodes:
         stages:   [ { find: "hit"|"clean"|"verify", count?:int, label?:string } ],
         // confirmed findings, rendered as the report list:
         findings: [ { sev:"critical"|"high"|"medium"|"low", title, cwe, owasp, where, detail } ],
         // OPTIONAL — the real source the analyzer fetched. When present, the code
         // panel renders THIS instead of the seeded sample (see renderCode). Omit
         // it and the demo's sample stays. A line with `stage` highlights the whole
         // line when that stage is a hit (the seeded sample highlights a token):
         code?:    { file?:string, lang?:string, lines: [ { n:int, text:string, stage?:int } ] }
       }
     ========================================================================== */
  function requestScan(target) {
    var data = demoResultFor(target);
    return new Promise(function (resolve) {
      // brief "submitting" beat; the run animation is what conveys progress.
      setTimeout(function () { resolve(data); }, prefersReduced ? 0 : 520);
    });
  }

  // DEV/QA aid: append ?real=1 to the scanner URL to exercise the real-code
  // render path (renderCode) with a mock `code` payload — the same path a wired
  // backend will hit. Off by default; harmless in production. Lets you confirm
  // the panel renders fetched source (not the seeded sample) before the API is
  // live. Remove this block once the real backend is wired if you prefer.
  function mockCodePayload() {
    return {
      file: "src/server/auth.js",
      lang: "javascript · fetched",
      lines: [
        { n: 1, text: 'import express from "express"' },
        { n: 2, text: 'import { db } from "./db"' },
        { n: 3, text: "" },
        { n: 4, text: 'const SECRET = "sk_live_a1b2c3d4e5f6g7h8"', stage: 0 },
        { n: 5, text: "" },
        { n: 6, text: "app.post('/login', (req, res) => {" },
        { n: 7, text: "  const q = `SELECT * FROM users WHERE id=${req.body.id}`", stage: 3 },
        { n: 8, text: "  db.query(q).then(rows => res.json(rows))" },
        { n: 9, text: "})" },
        { n: 10, text: "" },
        { n: 11, text: "app.get('/run', (req) => eval(req.query.cmd))", stage: 1 },
        { n: 12, text: 'import "./vendor/tracker.min.js"', stage: 2 },
        { n: 13, text: "app.listen(3000)" }
      ]
    };
  }

  /* ---- Deterministic demo dataset (no RNG) -------------------------------- */
  // ONE canonical result for every target. Why single, not per-target: the code
  // artifact in the .inspect window is a fixed file (auth.middleware.js) and its
  // threat tokens surface by stage hit-status. A divergent dataset (e.g. a mostly
  // "clean" repo) would contradict that fixed artifact — clean stages over a
  // window full of red threats, a "server.js" header above auth-middleware code.
  // So the demo stays coherent with one result; the visitor's typed target is
  // echoed back so it still feels responsive. Real per-repo divergence arrives
  // with the backend (requestScan), where the code artifact comes from the API
  // too. The demo note states this is representative sample data.
  var DEMO_RESULT = {
    file: "auth.middleware.js",
    verdict: "action",
    summary: { confirmed: 5, critical: 1, chains: 2, owasp: "A03" },
    // index 0..7 aligned to the eight .inspect-stage nodes; find drives the
    // stage badge AND which code threats surface (data-threat="N" → stage N).
    stages: [
      { find: "hit", count: 1 }, { find: "hit" }, { find: "hit", count: 1 },
      { find: "hit" }, { find: "clean" }, { find: "hit", count: 1 },
      { find: "verify" }, { find: "verify" }
    ],
    findings: [
      { sev: "critical", title: "Hardcoded live API key", cwe: "CWE-798", owasp: "A07:2025", where: "auth.middleware.js:4", detail: "A production secret (sk_live_…) is committed in source — anyone with repo access can drain the connected account." },
      { sev: "high", title: "Remote code execution via eval()", cwe: "CWE-95", owasp: "A03:2025", where: "auth.middleware.js:9", detail: "Token claims are passed straight to eval(), turning a forged token into arbitrary code execution." },
      { sev: "high", title: "SQL injection in admin route", cwe: "CWE-89", owasp: "A03:2025", where: "auth.middleware.js:12", detail: "req.query.id flows unsanitized into runQuery() — classic injection on an unauthenticated admin endpoint." },
      { sev: "medium", title: "Zero-width character near token check", cwe: "CWE-1007", owasp: "A04:2025", where: "auth.middleware.js:7", detail: "A GLASSWORM-style invisible character is smuggled next to the validation call, a vector for review-evading logic tampering." },
      { sev: "medium", title: "Untrusted vendored bundle import", cwe: "CWE-829", owasp: "A08:2025", where: "auth.middleware.js:2", detail: "A minified third-party bundle is imported without integrity pinning — a supply-chain foothold." }
    ]
  };

  var WANT_REAL_CODE =
    typeof location !== "undefined" && /[?&]real=1\b/.test(location.search);

  function demoResultFor(target) {
    // shallow clone + echo the target the visitor actually typed
    var r = {
      target: String(target || "").trim(),
      file: DEMO_RESULT.file,
      verdict: DEMO_RESULT.verdict,
      summary: DEMO_RESULT.summary,
      stages: DEMO_RESULT.stages,
      findings: DEMO_RESULT.findings
    };
    // ?real=1 exercises the renderCode() path with mock fetched source.
    if (WANT_REAL_CODE) { r.code = mockCodePayload(); r.file = r.code.file; }
    return r;
  }

  /* ---- Validation --------------------------------------------------------- */
  function validate(value) {
    var v = String(value || "").trim();
    if (!v) return "Enter a GitHub repository or app URL to scan.";
    // Permissive on purpose (the real API will do authoritative validation):
    // require something host-shaped — a dot with a non-space tail, or a known
    // git host path. Rejects obvious junk, accepts repos and bare domains.
    var looksLikeHostOrRepo = /([a-z0-9-]+\.[a-z]{2,})|(^[\w.-]+\/[\w.-]+$)/i.test(v);
    if (!looksLikeHostOrRepo) {
      return "That doesn’t look like a repository or URL. Try github.com/org/app or https://your-app.com.";
    }
    return "";
  }

  function showError(msg) {
    if (!errEl) return;
    if (msg) {
      errEl.textContent = msg;
      errEl.hidden = false;
      input.setAttribute("aria-invalid", "true");
    } else {
      errEl.textContent = "";
      errEl.hidden = true;
      input.removeAttribute("aria-invalid");
    }
  }

  /* ---- Inspect-window state ----------------------------------------------- */
  // Reset to a clean "idle" frame: stages dim, findings hidden, sweep parked,
  // verdict not assembled, progress 0. (pipeline.js seeds the static report for
  // the no-JS floor; once this module runs we take it back to idle and let the
  // visitor drive it.)
  function resetInspect() {
    inspect.classList.remove("is-scanning", "is-complete");
    inspect.style.setProperty("--scan-y", "0px");
    if (progEl) progEl.textContent = "0";
    Array.prototype.forEach.call(stages, function (s) { s.classList.remove("is-lit"); });
    Array.prototype.forEach.call(lines, function (l) { l.classList.remove("is-flagged"); });
    // reset each stage's find badge to 0 — BOTH text and the data-find-to
    // attribute, so a later scan whose stage has no explicit count can't read a
    // stale carry-over from the previous run's countFind() write-back.
    Array.prototype.forEach.call(stages, function (s) {
      var n = s.querySelector("[data-find-to]");
      if (n) { n.textContent = "0"; n.setAttribute("data-find-to", "0"); }
    });
  }

  // Resolve one stage from its data: light it, count its finding, apply the
  // result class (hit/clean/verify), bump progress.
  function resolveStage(i, result, progState) {
    var s = stages[i];
    if (!s || s.classList.contains("is-lit")) return;
    var spec = result.stages && result.stages[i];
    if (spec && spec.find) s.setAttribute("data-find", spec.find);
    s.classList.add("is-lit");
    countFind(s, spec);
    progState.n += 1;
    if (progEl) progEl.textContent = String(progState.n);
  }

  function countFind(stage, spec) {
    var el = stage.querySelector("[data-find-to]");
    if (!el) return;
    var to = spec && typeof spec.count === "number"
      ? spec.count
      : (parseInt(el.getAttribute("data-find-to"), 10) || 0);
    el.setAttribute("data-find-to", String(to));
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

  // Settle the inspect window straight to its fully-resolved state (no sweep).
  // Used for reduced-motion, and as the jump-to-end when motion is paused mid-run.
  function settleInspect(result) {
    var progState = { n: 0 };
    var i;
    for (i = 0; i < stages.length; i++) resolveStage(i, result, progState);
    Array.prototype.forEach.call(lines, function (l) {
      if (lineIsActive(l, result)) l.classList.add("is-flagged");
      else l.classList.remove("is-flagged");
    });
    inspect.classList.remove("is-scanning");
    inspect.classList.add("is-complete");
    if (verdictSub) verdictSub.textContent = verdictSubText(result);
  }

  function verdictSubText(r) {
    var s = r.summary || {};
    var bits = [];
    bits.push((s.confirmed || 0) + " confirmed");
    if (s.chains) bits.push(s.chains + (s.chains === 1 ? " attack chain" : " attack chains"));
    bits.push("ready");
    return bits.join(" · ");
  }

  /* ---- Run lifecycle ------------------------------------------------------ */
  var rafId = 0;
  var stageTimer = 0;        // setTimeout id for the gap between stages
  var running = false;
  var motionPaused = document.documentElement.getAttribute("data-motion") === "paused";
  var pendingResult = null;  // result of the in-flight run, for jump-to-end on pause

  // Stage-by-stage scan: each stage gets its own "running" beat (sweep eases to
  // that stage's slice of the code, the active ledger row pulses, the status line
  // narrates the pass), then resolves and surfaces its hit-lines, then the next
  // begins. This reads as a real scanner doing real work — the deliberate
  // contrast with the home page's single quick for-show sweep. All timers/raf are
  // tracked so pause-mid-run and reset can cancel cleanly (no orphaned work).
  function driveSweep(result, onDone) {
    if (!scanBand || !codeBody) { settleInspect(result); onDone(); return; }

    // Measure geometry once up front (no per-frame layout reads).
    var codeTop = codeBody.getBoundingClientRect().top;
    var codeH = codeBody.offsetHeight;
    var lineYs = Array.prototype.map.call(lines, function (l) {
      return l.getBoundingClientRect().top - codeTop + 10;
    });

    inspect.classList.add("is-scanning");
    var n = stages.length;
    running = true;

    // Surface the hit-lines that belong to a given stage (called as it resolves).
    function surfaceStageLines(idx) {
      for (var i = 0; i < lines.length; i++) {
        var t = lines[i].querySelector('[data-threat="' + idx + '"]');
        if (t && lineIsActive(lines[i], result)) lines[i].classList.add("is-flagged");
      }
    }

    function runStage(idx) {
      if (!running) return; // paused/aborted — jump-to-end handled elsewhere
      if (idx >= n) {       // all stages done
        settleInspect(result);
        running = false;
        clearStatus();
        onDone();
        return;
      }

      // mark the active row + narrate
      stages[idx].classList.add("is-running");
      setStatus(idx);

      // The sweep eases from this stage's slice of the code to the next, so over
      // the whole run it travels top→bottom. (Sweep band Y is in code-body px.)
      var fromY = (idx / n) * codeH;
      var toY = ((idx + 1) / n) * codeH;
      var begin = null;

      function frame(ts) {
        if (!running) return;
        if (begin === null) begin = ts;
        var p = Math.min(1, (ts - begin) / STAGE_MS);
        inspect.style.setProperty("--scan-y", (fromY + (toY - fromY) * easeOut(p)) + "px");
        if (p < 1) { rafId = requestAnimationFrame(frame); return; }

        // stage complete: resolve it, surface its lines, drop the running mark
        rafId = 0;
        var progState = { n: countLit() };
        resolveStage(idx, result, progState);
        surfaceStageLines(idx);
        stages[idx].classList.remove("is-running");

        // brief settle, then the next stage
        stageTimer = setTimeout(function () {
          stageTimer = 0;
          runStage(idx + 1);
        }, STAGE_GAP_MS);
      }
      rafId = requestAnimationFrame(frame);
    }

    runStage(0);
  }

  function setStatus(idx) {
    if (statusEl) statusEl.hidden = false;
    if (statusStageEl) statusStageEl.textContent = "Stage " + (idx + 1) + "/" + stages.length;
    if (statusTextEl) statusTextEl.textContent = STAGE_STATUS[idx] || "Analyzing";
  }
  function clearStatus() {
    if (statusEl) statusEl.hidden = true;
  }

  function countLit() {
    var n = 0;
    Array.prototype.forEach.call(stages, function (s) { if (s.classList.contains("is-lit")) n++; });
    return n;
  }

  // Cancel any in-flight sweep work (rAF + the inter-stage timer + running mark).
  function cancelSweep() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (stageTimer) { clearTimeout(stageTimer); stageTimer = 0; }
    running = false;
    Array.prototype.forEach.call(stages, function (s) { s.classList.remove("is-running"); });
  }

  function abortSweepToEnd() {
    cancelSweep();
    clearStatus();
    if (pendingResult) {
      settleInspect(pendingResult);
      finishRun(pendingResult);
    }
  }

  /* ---- States: idle | scanning | done ------------------------------------- */
  function setState(state) {
    root.setAttribute("data-state", state);
  }

  function startScan(target) {
    showError("");
    pendingResult = null;
    setState("scanning");
    setSubmitting(true);
    resetInspect();
    if (report) report.hidden = true;

    // initial "submitting" status during the requestScan() round-trip, before
    // the first stage starts narrating (skipped under reduced-motion, which
    // settles instantly).
    if (!prefersReduced && !motionPaused && statusEl) {
      statusEl.hidden = false;
      if (statusStageEl) statusStageEl.textContent = "Queued";
      if (statusTextEl) statusTextEl.textContent = "Submitting scan";
    }

    requestScan(target).then(function (result) {
      pendingResult = result;
      if (fileEl && result.file) fileEl.textContent = result.file;

      // Render real source (if the result carries a `code` field) BEFORE either
      // path runs — so reduced-motion settles over the real lines and the sweep
      // measures the real geometry, not the stale sample.
      renderCode(result);

      // reduced-motion OR motion paused → settle immediately, no sweep
      if (prefersReduced || motionPaused) {
        settleInspect(result);
        finishRun(result);
        return;
      }
      driveSweep(result, function () { finishRun(result); });
    });
  }

  function finishRun(result) {
    setSubmitting(false);
    setState("done");
    renderReport(result);
  }

  function setSubmitting(on) {
    if (!submitBtn) return;
    submitBtn.disabled = on;
    submitBtn.setAttribute("aria-busy", on ? "true" : "false");
    if (submitLabel) submitLabel.textContent = on ? "Scanning…" : "Scan Now";
  }

  /* ---- Report rendering --------------------------------------------------- */
  var VERDICT_COPY = {
    clean: "No critical issues",
    review: "Review recommended",
    action: "Action required"
  };

  function renderReport(result) {
    if (!report) return;
    var s = result.summary || {};
    if (reportTarget) reportTarget.textContent = result.target || "submitted target";
    if (reportVerdict) {
      reportVerdict.textContent = VERDICT_COPY[result.verdict] || "Report ready";
      reportVerdict.setAttribute("data-verdict", result.verdict || "review");
    }
    if (sumConfirmed) sumConfirmed.textContent = String(s.confirmed || 0);
    if (sumCritical) sumCritical.textContent = String(s.critical || 0);
    if (sumChains) sumChains.textContent = String(s.chains || 0);

    if (findingsEl) {
      findingsEl.textContent = "";
      var list = result.findings || [];
      if (!list.length) {
        var li = document.createElement("li");
        li.className = "scan-finding scan-finding--clean";
        li.textContent = "No confirmed vulnerabilities in this scan.";
        findingsEl.appendChild(li);
      } else {
        for (var i = 0; i < list.length; i++) findingsEl.appendChild(buildFinding(list[i]));
      }
    }

    report.hidden = false;
    // Move focus to the report heading so keyboard/AT users land on the result
    // after the async scan — but DON'T let .focus() yank the viewport (that read
    // as "it jumped to the report"). Focus without scrolling, then bring the
    // report into view gently (honoring reduced-motion).
    if (reportTitle && typeof reportTitle.focus === "function") {
      reportTitle.focus({ preventScroll: true });
      if (typeof reportTitle.scrollIntoView === "function") {
        reportTitle.scrollIntoView({
          behavior: prefersReduced ? "auto" : "smooth",
          block: "nearest"
        });
      }
    }
  }

  function buildFinding(f) {
    var li = document.createElement("li");
    li.className = "scan-finding scan-finding--" + (f.sev || "medium");

    var sev = document.createElement("span");
    sev.className = "scan-finding__sev";
    sev.textContent = f.sev || "medium";

    var body = document.createElement("div");
    body.className = "scan-finding__body";

    var head = document.createElement("p");
    head.className = "scan-finding__head";
    var title = document.createElement("span");
    title.className = "scan-finding__title";
    title.textContent = f.title || "Finding";
    var where = document.createElement("span");
    where.className = "scan-finding__where";
    where.textContent = f.where || "";
    head.appendChild(title);
    if (f.where) head.appendChild(where);

    var detail = document.createElement("p");
    detail.className = "scan-finding__detail";
    detail.textContent = f.detail || "";

    var tags = document.createElement("p");
    tags.className = "scan-finding__tags";
    if (f.cwe) tags.appendChild(tag(f.cwe));
    if (f.owasp) tags.appendChild(tag("OWASP " + f.owasp));

    body.appendChild(head);
    if (f.detail) body.appendChild(detail);
    if (f.cwe || f.owasp) body.appendChild(tags);

    li.appendChild(sev);
    li.appendChild(body);
    return li;
  }

  function tag(text) {
    var el = document.createElement("span");
    el.className = "scan-finding__tag";
    el.textContent = text;
    return el;
  }

  /* ---- Reset (Scan another) ----------------------------------------------- */
  function resetAll() {
    cancelSweep();      // kill any in-flight rAF + inter-stage timer + running mark
    clearStatus();
    pendingResult = null;
    setSubmitting(false);
    resetInspect();
    if (report) report.hidden = true;
    if (verdictSub) verdictSub.textContent = "5 confirmed · 2 attack chains · ready";
    setState("idle");
    showError("");
    input.value = "";
    input.focus();
  }

  /* ---- Wire up ------------------------------------------------------------ */
  // Take the inspect window back to idle on load (pipeline.js skipped it).
  resetInspect();
  setState("idle");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (running) return;
    var msg = validate(input.value);
    if (msg) { showError(msg); input.focus(); return; }
    startScan(input.value);
  });

  // Clear the error as soon as the visitor starts fixing the input.
  input.addEventListener("input", function () {
    if (errEl && !errEl.hidden) showError("");
  });

  Array.prototype.forEach.call(sampleBtns, function (btn) {
    btn.addEventListener("click", function () {
      input.value = btn.getAttribute("data-scan-sample") || "";
      showError("");
      input.focus();
    });
  });

  if (resetBtn) resetBtn.addEventListener("click", resetAll);

  // Global Pause/Resume (WCAG 2.2.2): if a sweep is mid-run, jump straight to the
  // resolved end-state rather than freezing a half-painted scan. (The scanner is
  // event-driven — no ambient loop to resume — so resume is a no-op beyond
  // recording the flag for the next run.)
  document.addEventListener("wwyw:motion", function (e) {
    motionPaused = !!(e.detail && e.detail.paused);
    if (motionPaused && running) abortSweepToEnd();
  });
})();
