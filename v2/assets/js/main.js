/* =========================================================================
   ALWAHAA v2 — Interaction layer
   Lenis smooth scroll · GSAP parallax · Three.js hero · reveals · cursor
   ========================================================================= */
(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  var doc = document;
  var root = doc.documentElement;
  doc.body.classList.remove("no-js");

  /* ------------------------------------------------------------------ *
   * 1. Preloader
   * ------------------------------------------------------------------ */
  (function preloader() {
    var el = doc.getElementById("preloader");
    if (!el) return;
    if (prefersReduced) { el.remove(); start(); return; }
    var bar = doc.getElementById("pl-bar");
    var num = doc.getElementById("pl-num");
    var startedAt = performance.now();
    var done = false;
    var frame = 0;
    function paint(now) {
      if (done) return;
      var p = Math.min(92, ((now - startedAt) / 900) * 92);
      if (bar) bar.style.width = p + "%";
      if (num) num.textContent = Math.round(p);
      frame = requestAnimationFrame(paint);
    }
    function finish() {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame);
      if (bar) bar.style.width = "100%";
      if (num) num.textContent = "100";
      el.classList.add("is-done");
      doc.body.classList.add("is-loaded");
      start();
      setTimeout(function () { el.remove(); }, 850);
    }
    function finishAfterMinimum() {
      setTimeout(finish, Math.max(0, 420 - (performance.now() - startedAt)));
    }
    requestAnimationFrame(paint);
    if (doc.readyState === "complete") finishAfterMinimum();
    else window.addEventListener("load", finishAfterMinimum, { once: true });
    setTimeout(finish, 1400);
  })();

  /* ------------------------------------------------------------------ *
   * 2. Theme toggle
   * ------------------------------------------------------------------ */
  (function theme() {
    var btn = doc.getElementById("themeToggle");
    if (!btn) return;
    function updateThemeLabel() {
      var dark = root.getAttribute("data-theme") === "dark";
      btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      btn.setAttribute("aria-pressed", String(dark));
    }
    updateThemeLabel();
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("aw-theme", next); } catch (e) {}
      updateThemeLabel();
      window.dispatchEvent(new CustomEvent("themechange", { detail: next }));
    });
  })();

  /* ------------------------------------------------------------------ *
   * 3. Year
   * ------------------------------------------------------------------ */
  var yr = doc.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------ *
   * 4. Lenis smooth scroll
   * ------------------------------------------------------------------ */
  var lenis = null;
  var lenisTried = false;
  function initLenis() {
    if (lenisTried && lenis) return;
    if (prefersReduced || typeof window.Lenis === "undefined") { if (!lenisTried) rafFallback(); lenisTried = true; return; }
    lenisTried = true;
    lenis = new window.Lenis({ duration: 1.1, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
    lenis.on("scroll", onScroll);
    // anchor links
    doc.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href");
        if (id.length < 2) return;
        var target = doc.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -80, duration: 1.2 });
        closeMobileNav();
      });
    });
    // GSAP sync
    if (window.gsap && window.ScrollTrigger) {
      lenis.on("scroll", window.ScrollTrigger.update);
      window.gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      })(performance.now());
    }
  }
  function rafFallback() {
    doc.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href"); if (id.length < 2) return;
        var t = doc.querySelector(id); if (!t) return;
        e.preventDefault();
        window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 80, behavior: prefersReduced ? "auto" : "smooth" });
        closeMobileNav();
      });
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------------ *
   * 5. Header + scroll progress
   * ------------------------------------------------------------------ */
  var header = doc.getElementById("header");
  var progress = doc.getElementById("scrollProgress");
  var lastY = 0;
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (header) {
      header.classList.toggle("is-scrolled", y > 24);
      if (y > lastY && y > 400) header.classList.add("is-hidden");
      else header.classList.remove("is-hidden");
    }
    if (progress) {
      var h = doc.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = "scaleX(" + (h > 0 ? y / h : 0) + ")";
    }
    lastY = y;
  }

  /* ------------------------------------------------------------------ *
   * 6. Mobile nav
   * ------------------------------------------------------------------ */
  var menuToggle = doc.getElementById("menuToggle");
  var mobileNav = doc.getElementById("mobileNav");
  function setMobileNav(open, returnFocus) {
    if (!mobileNav) return;
    mobileNav.classList.toggle("is-open", open);
    mobileNav.setAttribute("aria-hidden", String(!open));
    if ("inert" in mobileNav) mobileNav.inert = !open;
    if (menuToggle) {
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
    doc.body.style.overflow = open ? "hidden" : "";
    if (!open && returnFocus && menuToggle) {
      menuToggle.focus();
    }
  }
  function closeMobileNav(returnFocus) {
    setMobileNav(false, returnFocus);
  }
  if (menuToggle && mobileNav) {
    setMobileNav(false, false);
    menuToggle.addEventListener("click", function () {
      setMobileNav(!mobileNav.classList.contains("is-open"), false);
    });
    mobileNav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { closeMobileNav(false); });
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mobileNav.classList.contains("is-open")) closeMobileNav(true);
    });
    window.addEventListener("resize", function () {
      if (innerWidth > 860 && mobileNav.classList.contains("is-open")) closeMobileNav(false);
    });
  }

  /* ------------------------------------------------------------------ *
   * 7. Reveal + stagger via IntersectionObserver
   * ------------------------------------------------------------------ */
  function initReveals() {
    if (prefersReduced || !("IntersectionObserver" in window)) {
      doc.querySelectorAll("[data-reveal],[data-stagger]").forEach(function (el) { el.classList.add("in"); });
      runCounters(doc);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        if (el.hasAttribute("data-stagger")) {
          var kids = el.children, i;
          for (i = 0; i < kids.length; i++) {
            (function (k, idx) { setTimeout(function () { k.style.opacity = 1; k.style.transform = "none"; }, idx * 65); })(kids[i], i);
          }
          el.classList.add("in");
        } else {
          el.classList.add("in");
        }
        runCounters(el);
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    doc.querySelectorAll("[data-reveal],[data-stagger]").forEach(function (el) { io.observe(el); });
    // counters that aren't inside reveal blocks
    var cobs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { runCounters(en.target.parentNode || doc); cobs.unobserve(en.target); } });
    }, { threshold: 0.5 });
    doc.querySelectorAll("[data-count]").forEach(function (el) { cobs.observe(el); });
  }

  /* ------------------------------------------------------------------ *
   * 8. Count-up
   * ------------------------------------------------------------------ */
  function runCounters(scope) {
    var nodes = scope.querySelectorAll ? scope.querySelectorAll("[data-count]") : [];
    nodes.forEach(function (el) {
      if (el.dataset.counted) return;
      el.dataset.counted = "1";
      var target = parseFloat(el.getAttribute("data-count")) || 0;
      var suffix = el.getAttribute("data-suffix") || "";
      if (prefersReduced) { el.textContent = target + suffix; return; }
      var dur = 1500, start = performance.now();
      function tick(now) {
        var t = Math.min(1, (now - start) / dur);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  /* ------------------------------------------------------------------ *
   * 9. FAQ accordion
   * ------------------------------------------------------------------ */
  doc.querySelectorAll(".faq-item").forEach(function (item, index) {
    var q = item.querySelector(".faq-item__q");
    var answer = item.querySelector(".faq-item__a");
    if (!q || !answer) return;
    var qId = q.id || "faq-question-" + (index + 1);
    var answerId = answer.id || "faq-answer-" + (index + 1);
    q.id = qId;
    q.setAttribute("aria-controls", answerId);
    answer.id = answerId;
    answer.setAttribute("role", "region");
    answer.setAttribute("aria-labelledby", qId);
    answer.setAttribute("aria-hidden", "true");
    q.addEventListener("click", function () {
      var open = item.classList.toggle("is-open");
      q.setAttribute("aria-expanded", String(open));
      answer.setAttribute("aria-hidden", String(!open));
    });
  });

  /* ------------------------------------------------------------------ *
   * 9b. Blog category filter
   * ------------------------------------------------------------------ */
  (function blogFilter() {
    var cats = doc.getElementById("blogCats");
    var grid = doc.getElementById("blogGrid");
    if (!cats || !grid) return;
    var cards = grid.querySelectorAll(".post-card");
    var empty = doc.getElementById("blogEmpty");
    cats.querySelectorAll("button[data-filter]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.classList.contains("is-active")));
    });
    cats.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-filter]");
      if (!btn) return;
      cats.querySelectorAll("button").forEach(function (b) {
        var active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      btn.classList.add("is-active");
      var f = btn.getAttribute("data-filter");
      var shown = 0;
      cards.forEach(function (c) {
        var match = f === "all" || c.getAttribute("data-category") === f;
        c.classList.toggle("is-hidden", !match);
        c.hidden = !match;
        if (match) shown++;
      });
      if (empty) empty.hidden = shown !== 0;
    });
  })();

  /* ------------------------------------------------------------------ *
   * 10. Custom cursor + magnetic + tilt + spotlight
   * ------------------------------------------------------------------ */
  function initPointer() {
    if (isTouch || prefersReduced || innerWidth <= 860) return;
    var dot = doc.querySelector(".cursor-dot");
    var ring = doc.querySelector(".cursor-ring");
    if (!dot || !ring) return;
    doc.body.classList.add("cursor-active");
    var mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    window.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = "translate(" + mx + "px," + my + "px) translate(-50%,-50%)";
    });
    (function loop() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = "translate(" + rx + "px," + ry + "px) translate(-50%,-50%)";
      requestAnimationFrame(loop);
    })();
    doc.querySelectorAll("[data-cursor], a, button").forEach(function (el) {
      el.addEventListener("mouseenter", function () { ring.classList.add("is-hover"); });
      el.addEventListener("mouseleave", function () { ring.classList.remove("is-hover"); });
    });

    // Magnetic buttons — set --tx/--ty so the CSS :active scale still composes
    doc.querySelectorAll("[data-magnetic]").forEach(function (el) {
      var strength = 0.32;
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * strength;
        var y = (e.clientY - r.top - r.height / 2) * strength;
        el.style.setProperty("--tx", x.toFixed(1) + "px");
        el.style.setProperty("--ty", y.toFixed(1) + "px");
      });
      el.addEventListener("mouseleave", function () {
        el.style.removeProperty("--tx");
        el.style.removeProperty("--ty");
      });
    });

    // Tilt media
    doc.querySelectorAll("[data-tilt]").forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = "perspective(900px) rotateX(" + (-py * 5) + "deg) rotateY(" + (px * 6) + "deg)";
      });
      el.addEventListener("mouseleave", function () { el.style.transform = ""; });
    });
  }
  // Spotlight (works on touch too, cheap)
  doc.querySelectorAll("[data-spotlight]").forEach(function (el) {
    el.addEventListener("mousemove", function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (e.clientX - r.left) + "px");
      el.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });

  /* ------------------------------------------------------------------ *
   * 11. GSAP parallax (atmosphere + hero copy)
   * ------------------------------------------------------------------ */
  var parallaxDone = false;
  function initParallax() {
    if (parallaxDone || prefersReduced || !window.gsap || !window.ScrollTrigger) return;
    parallaxDone = true;
    var gsap = window.gsap; gsap.registerPlugin(window.ScrollTrigger);
    if (doc.querySelector(".blob")) {
      gsap.to(".blob.b1", { yPercent: 18, ease: "none", scrollTrigger: { trigger: "body", start: "top top", end: "bottom bottom", scrub: true } });
      gsap.to(".blob.b2", { yPercent: -22, ease: "none", scrollTrigger: { trigger: "body", start: "top top", end: "bottom bottom", scrub: true } });
      gsap.to(".blob.b3", { yPercent: 14, ease: "none", scrollTrigger: { trigger: "body", start: "top top", end: "bottom bottom", scrub: true } });
    }
    if (doc.querySelector(".hero")) {
      gsap.to(".hero__copy", { yPercent: 16, opacity: 0.65, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
      gsap.to(".hero__grid", { yPercent: 24, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    }
  }

  /* ------------------------------------------------------------------ *
   * 12. Three.js hero — globe of global reach
   * ------------------------------------------------------------------ */
  var hero3DDone = false;
  function initHero3D() {
    if (hero3DDone) return;
    var canvas = doc.getElementById("heroCanvas");
    if (!canvas || typeof window.THREE === "undefined") return;
    hero3DDone = true;
    var THREE = window.THREE;
    var compactGlobe = !!canvas.closest(".svc-globe");
    var host = canvas.closest(".svc-globe") || doc.querySelector(".hero") || canvas.parentNode;
    var lowPower = isTouch || innerWidth < 760;
    if (prefersReduced) return;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
    camera.position.z = 13;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: !lowPower });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));

    var group = new THREE.Group();
    scene.add(group);

    function themeColors() {
      var dark = root.getAttribute("data-theme") === "dark";
      return {
        wire: dark ? 0x6f7c93 : (compactGlobe ? 0x65758c : 0x9fb0c8),
        wireOpacity: dark ? 0.28 : (compactGlobe ? 0.58 : 0.4),
        dots: dark ? 0xe4ce8e : 0xb08d3a,
        field: dark ? 0xc8a24b : (compactGlobe ? 0xb08d3a : 0x6b7686)
      };
    }
    var col = themeColors();

    // Wireframe sphere
    var sphereGeo = new THREE.SphereGeometry(4.4, 30, 30);
    var wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(sphereGeo),
      new THREE.LineBasicMaterial({ color: col.wire, transparent: true, opacity: col.wireOpacity })
    );
    group.add(wire);

    // Surface points (gold)
    var ptsGeo = new THREE.BufferGeometry();
    var N = lowPower ? 320 : 700, pos = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      var t = Math.acos(2 * Math.random() - 1), ph = 2 * Math.PI * Math.random(), rr = 4.45;
      pos[i * 3] = rr * Math.sin(t) * Math.cos(ph);
      pos[i * 3 + 1] = rr * Math.sin(t) * Math.sin(ph);
      pos[i * 3 + 2] = rr * Math.cos(t);
    }
    ptsGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    var dotMat = new THREE.PointsMaterial({ color: col.dots, size: lowPower ? 0.06 : 0.05, transparent: true, opacity: 0.95 });
    var dots = new THREE.Points(ptsGeo, dotMat);
    group.add(dots);

    // Ambient field particles
    var fGeo = new THREE.BufferGeometry();
    var FN = lowPower ? 200 : 480, fpos = new Float32Array(FN * 3);
    for (var j = 0; j < FN; j++) {
      var R = 7 + Math.random() * 9, a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1);
      fpos[j * 3] = R * Math.sin(b) * Math.cos(a);
      fpos[j * 3 + 1] = R * Math.sin(b) * Math.sin(a);
      fpos[j * 3 + 2] = R * Math.cos(b);
    }
    fGeo.setAttribute("position", new THREE.BufferAttribute(fpos, 3));
    var field = new THREE.Points(fGeo, new THREE.PointsMaterial({ color: col.field, size: 0.045, transparent: true, opacity: 0.5 }));
    scene.add(field);

    group.rotation.z = 0.35;
    group.position.x = compactGlobe ? 0 : (innerWidth > 900 ? 3.2 : 0);
    group.position.y = compactGlobe ? 0 : (innerWidth > 900 ? 0 : 1.4);

    var tmx = 0, tmy = 0, cmx = 0, cmy = 0;
    window.addEventListener("mousemove", function (e) {
      tmx = (e.clientX / innerWidth - 0.5);
      tmy = (e.clientY / innerHeight - 0.5);
    });

    window.addEventListener("themechange", function () {
      col = themeColors();
      wire.material.color.setHex(col.wire); wire.material.opacity = col.wireOpacity;
      dotMat.color.setHex(col.dots);
      field.material.color.setHex(col.field);
    });

    var visible = true;
    if ("IntersectionObserver" in window && host) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0.02 }).observe(host);
    }

    function resize() {
      var box = host && compactGlobe ? host.getBoundingClientRect() : null;
      var w = box ? Math.max(280, box.width) : innerWidth;
      var h = box ? Math.max(260, box.height) : innerHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      group.position.x = compactGlobe ? 0 : (w > 900 ? 3.2 : 0);
      group.position.y = compactGlobe ? 0 : (w > 900 ? 0 : 1.4);
    }
    resize();
    window.addEventListener("resize", resize);

    var paused = false;
    doc.addEventListener("visibilitychange", function () { paused = doc.hidden; });

    function animate() {
      requestAnimationFrame(animate);
      if (paused || !visible) return;
      cmx += (tmx - cmx) * 0.05; cmy += (tmy - cmy) * 0.05;
      group.rotation.y += 0.0016;
      group.rotation.x = cmy * 0.4;
      group.rotation.y += cmx * 0.0015;
      field.rotation.y -= 0.0004;
      renderer.render(scene, camera);
    }
    animate();
  }

  /* ------------------------------------------------------------------ *
   * 13. Testimonials marquee — clone for seamless loop
   * ------------------------------------------------------------------ */
  function initTstMarquee() {
    var track = doc.querySelector(".tst-track");
    if (!track || track.dataset.cloned) return;
    track.dataset.cloned = "1";
    var kids = Array.prototype.slice.call(track.children);
    kids.forEach(function (k) {
      var c = k.cloneNode(true);
      c.setAttribute("aria-hidden", "true");
      track.appendChild(c);
    });
  }

  /* ------------------------------------------------------------------ *
   * 13b. About hero — UAE map float
   * ------------------------------------------------------------------ */
  var aboutFloatDone = false;
  function initAboutFloat() {
    if (aboutFloatDone || prefersReduced || !window.gsap) return;
    var orbit = doc.querySelector(".about-orbit");
    if (!orbit) return;
    aboutFloatDone = true;
    var gsap = window.gsap;
    var skyline = orbit.querySelector(".about-skyline");
    if (skyline) {
      gsap.to(skyline, { y: -10, x: 6, scale: 1.012, rotation: 0.22, transformOrigin: "68% 52%", duration: 7.2, ease: "sine.inOut", repeat: -1, yoyo: true });
    }
    orbit.querySelectorAll(".about-service-card").forEach(function (el, i) {
      gsap.to(el, { y: i % 2 ? 11 : -9, x: i % 2 ? -5 : 5, rotation: i % 2 ? -0.45 : 0.45, duration: 4.8 + i * 0.42, delay: i * 0.18, ease: "sine.inOut", repeat: -1, yoyo: true });
    });
    gsap.to(orbit.querySelectorAll(".about-route path"), { strokeDashoffset: -42, duration: 6, ease: "none", repeat: -1 });
  }

  /* ------------------------------------------------------------------ *
   * 13c. Home hero — gateway micro-parallax
   * ------------------------------------------------------------------ */
  var gatewayMotionDone = false;
  function initGatewayMotion() {
    if (gatewayMotionDone || prefersReduced || isTouch) return;
    var stage = doc.querySelector(".gateway-stage");
    var hero = doc.querySelector(".hero");
    if (!stage || !hero) return;
    gatewayMotionDone = true;
    hero.addEventListener("mousemove", function (e) {
      var box = hero.getBoundingClientRect();
      var x = ((e.clientX - box.left) / box.width - 0.5);
      var y = ((e.clientY - box.top) / box.height - 0.5);
      stage.style.setProperty("--gateway-ry", (x * 4).toFixed(2) + "deg");
      stage.style.setProperty("--gateway-rx", (y * -3).toFixed(2) + "deg");
    });
    hero.addEventListener("mouseleave", function () {
      stage.style.setProperty("--gateway-ry", "0deg");
      stage.style.setProperty("--gateway-rx", "0deg");
    });
  }

  /* ------------------------------------------------------------------ *
   * 14. Wrap every "Alwahaa" in the Ventoux brand font
   * ------------------------------------------------------------------ */
  function wrapBrandWord() {
    var roots = [doc.querySelector("main"), doc.querySelector("footer")];
    roots.forEach(function (root) {
      if (!root) return;
      var walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          if (!node.nodeValue || node.nodeValue.indexOf("Alwahaa") === -1) return NodeFilter.FILTER_REJECT;
          var p = node.parentNode;
          if (!p) return NodeFilter.FILTER_REJECT;
          var tag = p.nodeName;
          if (tag === "SCRIPT" || tag === "STYLE") return NodeFilter.FILTER_REJECT;
          if (p.closest && p.closest(".wahaa")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var targets = [], n;
      while ((n = walker.nextNode())) targets.push(n);
      targets.forEach(function (node) {
        var parts = node.nodeValue.split("Alwahaa");
        var frag = doc.createDocumentFragment();
        parts.forEach(function (part, i) {
          if (i > 0) {
            var s = doc.createElement("span");
            s.className = "wahaa";
            s.textContent = "Alwahaa";
            frag.appendChild(s);
          }
          if (part) frag.appendChild(doc.createTextNode(part));
        });
        node.parentNode.replaceChild(frag, node);
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  var booted = false;
  function start() {
    if (booted) return; booted = true;
    wrapBrandWord();
    initTstMarquee();
    initAboutFloat();
    initGatewayMotion();
    initReveals();
    initPointer();
  }

  function boot() {
    initLenis();
    initParallax();
    initHero3D();
    start();
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 60); });
  } else {
    setTimeout(boot, 60);
  }
  // libs are deferred; ensure they exist
  window.addEventListener("load", function () {
    if (!lenis) initLenis();
    initParallax();
    initHero3D();
    initAboutFloat();
    initGatewayMotion();
  });
})();
