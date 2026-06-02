/* ============================================================
   WWYW — Faulty Terminal background
   A dependency-free WebGL port of react-bits' "FaultyTerminal" shader
   (GLSL lifted verbatim from DavidHDev/react-bits). Renders a raining-
   digits CRT field used as a subtle backdrop behind the stats heading.

   This is deliberately tuned toward a LIVE-SECURE terminal, not a broken
   one: lime tint to match --accent, gentle scanlines + flicker, no glitch
   tear, no chromatic aberration. It sits at low opacity behind text and
   must never compete with the scan radar (the section's centerpiece) or
   make the real numbers hard to read.

   Discipline (mirrors scan-radar.js / netops.js): mounts by
   [data-faulty-terminal]; runs only while on-screen and the tab is
   visible; honors prefers-reduced-motion by painting ONE static frame and
   stopping. DPR-clamped, debounced resize. Silently no-ops without WebGL.
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  var hosts = document.querySelectorAll("[data-faulty-terminal]");
  if (!hosts.length) return;

  var VERT =
    "attribute vec2 position;" +
    "attribute vec2 uv;" +
    "varying vec2 vUv;" +
    "void main(){ vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }";

  // Fragment shader — verbatim from react-bits FaultyTerminal.
  var FRAG = [
    "precision mediump float;",
    "varying vec2 vUv;",
    "uniform float iTime;",
    "uniform vec3  iResolution;",
    "uniform float uScale;",
    "uniform vec2  uGridMul;",
    "uniform float uDigitSize;",
    "uniform float uScanlineIntensity;",
    "uniform float uGlitchAmount;",
    "uniform float uFlickerAmount;",
    "uniform float uNoiseAmp;",
    "uniform float uChromaticAberration;",
    "uniform float uDither;",
    "uniform float uCurvature;",
    "uniform vec3  uTint;",
    "uniform vec2  uMouse;",
    "uniform float uMouseStrength;",
    "uniform float uUseMouse;",
    "uniform float uPageLoadProgress;",
    "uniform float uUsePageLoadAnimation;",
    "uniform float uBrightness;",
    "float time;",
    "float hash21(vec2 p){ p = fract(p * 234.56); p += dot(p, p + 34.56); return fract(p.x * p.y); }",
    "float noise(vec2 p){ return sin(p.x * 10.0) * sin(p.y * (3.0 + sin(time * 0.090909))) + 0.2; }",
    "mat2 rotate(float angle){ float c = cos(angle); float s = sin(angle); return mat2(c, -s, s, c); }",
    "float fbm(vec2 p){",
    "  p *= 1.1;",
    "  float f = 0.0;",
    "  float amp = 0.5 * uNoiseAmp;",
    "  mat2 modify0 = rotate(time * 0.02);",
    "  f += amp * noise(p); p = modify0 * p * 2.0; amp *= 0.454545;",
    "  mat2 modify1 = rotate(time * 0.02);",
    "  f += amp * noise(p); p = modify1 * p * 2.0; amp *= 0.454545;",
    "  mat2 modify2 = rotate(time * 0.08);",
    "  f += amp * noise(p);",
    "  return f;",
    "}",
    "float pattern(vec2 p, out vec2 q, out vec2 r){",
    "  vec2 offset1 = vec2(1.0); vec2 offset0 = vec2(0.0);",
    "  mat2 rot01 = rotate(0.1 * time); mat2 rot1 = rotate(0.1);",
    "  q = vec2(fbm(p + offset1), fbm(rot01 * p + offset1));",
    "  r = vec2(fbm(rot1 * q + offset0), fbm(q + offset0));",
    "  return fbm(p + r);",
    "}",
    "float digit(vec2 p){",
    "  vec2 grid = uGridMul * 15.0;",
    "  vec2 s = floor(p * grid) / grid;",
    "  p = p * grid;",
    "  vec2 q, r;",
    "  float intensity = pattern(s * 0.1, q, r) * 1.3 - 0.03;",
    "  if(uUseMouse > 0.5){",
    "    vec2 mouseWorld = uMouse * uScale;",
    "    float distToMouse = distance(s, mouseWorld);",
    "    float mouseInfluence = exp(-distToMouse * 8.0) * uMouseStrength * 10.0;",
    "    intensity += mouseInfluence;",
    "    float ripple = sin(distToMouse * 20.0 - iTime * 5.0) * 0.1 * mouseInfluence;",
    "    intensity += ripple;",
    "  }",
    "  if(uUsePageLoadAnimation > 0.5){",
    "    float cellRandom = fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453);",
    "    float cellDelay = cellRandom * 0.8;",
    "    float cellProgress = clamp((uPageLoadProgress - cellDelay) / 0.2, 0.0, 1.0);",
    "    float fadeAlpha = smoothstep(0.0, 1.0, cellProgress);",
    "    intensity *= fadeAlpha;",
    "  }",
    "  p = fract(p);",
    "  p *= uDigitSize;",
    "  float px5 = p.x * 5.0;",
    "  float py5 = (1.0 - p.y) * 5.0;",
    "  float x = fract(px5);",
    "  float y = fract(py5);",
    "  float i = floor(py5) - 2.0;",
    "  float j = floor(px5) - 2.0;",
    "  float n = i * i + j * j;",
    "  float f = n * 0.0625;",
    "  float isOn = step(0.1, intensity - f);",
    "  float brightness = isOn * (0.2 + y * 0.8) * (0.75 + x * 0.25);",
    "  return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0) * brightness;",
    "}",
    "float onOff(float a, float b, float c){ return step(c, sin(iTime + a * cos(iTime * b))) * uFlickerAmount; }",
    "float displace(vec2 look){",
    "  float y = look.y - mod(iTime * 0.25, 1.0);",
    "  float window = 1.0 / (1.0 + 50.0 * y * y);",
    "  return sin(look.y * 20.0 + iTime) * 0.0125 * onOff(4.0, 2.0, 0.8) * (1.0 + cos(iTime * 60.0)) * window;",
    "}",
    "vec3 getColor(vec2 p){",
    "  float bar = step(mod(p.y + time * 20.0, 1.0), 0.2) * 0.4 + 1.0;",
    "  bar *= uScanlineIntensity;",
    "  float displacement = displace(p);",
    "  p.x += displacement;",
    "  if (uGlitchAmount != 1.0) { float extra = displacement * (uGlitchAmount - 1.0); p.x += extra; }",
    "  float middle = digit(p);",
    "  const float off = 0.002;",
    "  float sum = digit(p + vec2(-off, -off)) + digit(p + vec2(0.0, -off)) + digit(p + vec2(off, -off)) +",
    "              digit(p + vec2(-off, 0.0)) + digit(p + vec2(0.0, 0.0)) + digit(p + vec2(off, 0.0)) +",
    "              digit(p + vec2(-off, off)) + digit(p + vec2(0.0, off)) + digit(p + vec2(off, off));",
    "  vec3 baseColor = vec3(0.9) * middle + sum * 0.1 * vec3(1.0) * bar;",
    "  return baseColor;",
    "}",
    "vec2 barrel(vec2 uv){ vec2 c = uv * 2.0 - 1.0; float r2 = dot(c, c); c *= 1.0 + uCurvature * r2; return c * 0.5 + 0.5; }",
    "void main(){",
    "  time = iTime * 0.333333;",
    "  vec2 uv = vUv;",
    "  if(uCurvature != 0.0){ uv = barrel(uv); }",
    "  vec2 p = uv * uScale;",
    "  vec3 col = getColor(p);",
    "  if(uChromaticAberration != 0.0){",
    "    vec2 ca = vec2(uChromaticAberration) / iResolution.xy;",
    "    col.r = getColor(p + ca).r;",
    "    col.b = getColor(p - ca).b;",
    "  }",
    "  col *= uTint;",
    "  col *= uBrightness;",
    "  if(uDither > 0.0){ float rnd = hash21(gl_FragCoord.xy); col += (rnd - 0.5) * (uDither * 0.003922); }",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  // --- "secure terminal" tuning: gentle, lime, no glitch/CA/noise ---------
  // uTint is lime (#69ff12) normalized; the shader multiplies the white-ish
  // digits by this, so the field reads brand-green rather than CRT amber.
  var TINT = [105 / 255, 255 / 255, 18 / 255];

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function FaultyTerminal(host) {
    var canvas = document.createElement("canvas");
    canvas.className = "faulty-terminal__canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    var gl =
      canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false }) ||
      canvas.getContext("experimental-webgl");
    if (!gl) { host.removeChild(canvas); return; }

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { host.removeChild(canvas); return; }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { host.removeChild(canvas); return; }
    gl.useProgram(prog);

    // Fullscreen triangle (covers the clip space; cheaper than a quad).
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // position.xy, uv.xy
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0, 0,
       3, -1, 2, 0,
      -1,  3, 0, 2
    ]), gl.STATIC_DRAW);
    var posLoc = gl.getAttribLocation(prog, "position");
    var uvLoc = gl.getAttribLocation(prog, "uv");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

    function U(name) { return gl.getUniformLocation(prog, name); }
    var uTime = U("iTime");
    var uRes = U("iResolution");

    // Static uniforms — set once. Tuned for a calm, legible backdrop.
    gl.uniform1f(U("uScale"), 1.4);
    gl.uniform2f(U("uGridMul"), 2.0, 1.0);
    gl.uniform1f(U("uDigitSize"), 1.3);
    gl.uniform1f(U("uScanlineIntensity"), 0.4);
    gl.uniform1f(U("uGlitchAmount"), 1.0);   // 1.0 == no extra glitch displace
    gl.uniform1f(U("uFlickerAmount"), 0.6);  // gentle, not a dying tube
    gl.uniform1f(U("uNoiseAmp"), 1.0);
    gl.uniform1f(U("uChromaticAberration"), 0.0);
    gl.uniform1f(U("uDither"), 0.0);
    gl.uniform1f(U("uCurvature"), 0.1);
    gl.uniform3f(U("uTint"), TINT[0], TINT[1], TINT[2]);
    gl.uniform2f(U("uMouse"), 0.5, 0.5);
    gl.uniform1f(U("uMouseStrength"), 0.0);
    gl.uniform1f(U("uUseMouse"), 0.0);       // background — no pointer tracking
    gl.uniform1f(U("uPageLoadProgress"), 1.0);
    gl.uniform1f(U("uUsePageLoadAnimation"), 0.0);
    gl.uniform1f(U("uBrightness"), 0.8);

    var w = 0, h = 0, dpr = 1;

    function resize() {
      // Cap DPR hard — this is a decorative background; full-res is wasteful.
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = host.clientWidth;
      h = host.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform3f(uRes, canvas.width, canvas.height, 1.0);
    }

    var raf = 0, running = false, startMs = 0;

    function draw(timeSec) {
      gl.uniform1f(uTime, timeSec);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!startMs) startMs = now;
      draw((now - startMs) / 1000);
    }

    var motionPaused = document.documentElement.getAttribute("data-motion") === "paused";

    function play() {
      if (running || prefersReduced || motionPaused) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }
    function pause() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    // Re-measure + repaint a static frame when paused/reduced (the running
    // loop repaints itself). Used by both ResizeObserver and the resize fallback.
    function remeasure() {
      resize();
      if (prefersReduced || !running) draw(2.0);
    }

    resize();
    if (prefersReduced) {
      draw(2.0); // one settled static frame
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
      // Global Pause/Resume (WCAG 2.2.2): freeze to one settled static frame, or
      // resume only when on-screen and the tab is visible.
      document.addEventListener("wwyw:motion", function (e) {
        motionPaused = !!(e.detail && e.detail.paused);
        if (motionPaused) { pause(); draw(2.0); }
        else if (onScreen && !document.hidden) play();
      });
      draw(0);
      play();
    }

    // Re-fit the drawing buffer on EVERY box change, not just window resizes —
    // on mobile the host's final size can settle after our init measurement
    // (with no `resize` event), which would otherwise leave the canvas
    // mis-sized until a manual refresh. ResizeObserver covers that; window
    // resize is the fallback for browsers without it.
    if ("ResizeObserver" in window) {
      var rt = 0;
      new ResizeObserver(function () {
        clearTimeout(rt);
        rt = setTimeout(remeasure, 100);
      }).observe(host);
    } else {
      var rtw = 0;
      window.addEventListener("resize", function () {
        clearTimeout(rtw);
        rtw = setTimeout(remeasure, 150);
      }, { passive: true });
    }
  }

  Array.prototype.forEach.call(hosts, function (host) { new FaultyTerminal(host); });
})();
