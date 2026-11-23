/* ==========================================================================
   Bajrang Electric — interactive 3D energy core
   Procedural Three.js scene. No models, no textures to download.
   Falls back to the SVG artwork when WebGL or the module is unavailable.
   ========================================================================== */
(function () {
  "use strict";

  const canvas = document.getElementById("heroCanvas");
  const hero = document.getElementById("hero");
  if (!canvas || !hero) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    document.documentElement.classList.add("no-3d");
    return;
  }

  function hasWebGL() {
    try {
      const test = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (test.getContext("webgl2") || test.getContext("webgl") || test.getContext("experimental-webgl")));
    } catch (err) {
      return false;
    }
  }

  if (!hasWebGL()) {
    document.documentElement.classList.add("no-3d");
    return;
  }

  function fail(reason) {
    hero.classList.remove("has-3d");
    document.documentElement.classList.add("no-3d");
    if (reason) console.warn("[Bajrang Electric] 3D hero unavailable:", reason);
  }

  (async function boot() {
    let THREE;
    try {
      THREE = await import("../vendor/three.module.min.js");
    } catch (err) {
      fail(err);
      return;
    }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });
    } catch (err) {
      fail(err);
      return;
    }

    const isMobile = window.matchMedia("(max-width: 860px)").matches;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.6 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.25, 8.4);

    const world = new THREE.Group();
    scene.add(world);

    /* ------------------------------------------------------------------ */
    /* Glow texture                                                        */
    /* ------------------------------------------------------------------ */
    function glowTexture() {
      const size = 128;
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d");
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.22, "rgba(255,255,255,.72)");
      gradient.addColorStop(0.55, "rgba(255,255,255,.2)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      const texture = new THREE.CanvasTexture(c);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    const glow = glowTexture();

    function sprite(color, scale, opacity) {
      const material = new THREE.SpriteMaterial({
        map: glow,
        color: color,
        transparent: true,
        opacity: opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const s = new THREE.Sprite(material);
      s.scale.set(scale, scale, 1);
      return s;
    }

    /* ------------------------------------------------------------------ */
    /* Lights                                                              */
    /* ------------------------------------------------------------------ */
    scene.add(new THREE.AmbientLight(0x8fb8ff, 0.7));

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(4, 6, 7);
    scene.add(keyLight);

    const cyanLight = new THREE.PointLight(0x22d3ee, 45, 22, 2);
    cyanLight.position.set(-4.5, 2.5, 3.5);
    scene.add(cyanLight);

    const violetLight = new THREE.PointLight(0x8b5cf6, 55, 24, 2);
    violetLight.position.set(4.5, -1.5, -1.5);
    scene.add(violetLight);

    const bulbLight = new THREE.PointLight(0xffb020, 16, 9, 2);
    bulbLight.position.set(0, 0.15, 0.4);
    scene.add(bulbLight);

    /* ------------------------------------------------------------------ */
    /* Background glow sprites                                             */
    /* ------------------------------------------------------------------ */
    const halo = sprite(0x22d3ee, 6.8, 0.22);
    halo.position.set(0, 0, -1.8);
    world.add(halo);

    const warmHalo = sprite(0xffb020, 3.4, 0.3);
    warmHalo.position.set(0, 0.1, 0.2);
    world.add(warmHalo);

    /* ------------------------------------------------------------------ */
    /* Light bulb                                                          */
    /* ------------------------------------------------------------------ */
    const bulb = new THREE.Group();
    bulb.position.y = 0.1;
    world.add(bulb);

    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x9fe8ff,
      roughness: 0.06,
      metalness: 0.08,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const glass = new THREE.Mesh(new THREE.SphereGeometry(1.02, 40, 28), glassMaterial);
    bulb.add(glass);

    const filamentMaterial = new THREE.MeshStandardMaterial({
      color: 0xffc45c,
      emissive: 0xff9d1a,
      emissiveIntensity: 3.6,
      roughness: 0.32,
      metalness: 0.2
    });
    const filament = new THREE.Mesh(new THREE.TorusKnotGeometry(0.3, 0.034, 96, 10, 2, 3), filamentMaterial);
    filament.rotation.set(0.45, 0.2, 0.1);
    bulb.add(filament);

    const wireMaterial = new THREE.MeshStandardMaterial({ color: 0xd8b56f, metalness: 0.85, roughness: 0.3 });
    [-0.14, 0.14].forEach(function (x) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.72, 8), wireMaterial);
      stem.position.set(x, -0.74, 0);
      bulb.add(stem);
    });

    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa7b8, metalness: 0.95, roughness: 0.26 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 0.42, 28), baseMaterial);
    base.position.y = -1.24;
    bulb.add(base);

    const threadMaterial = new THREE.MeshStandardMaterial({ color: 0x7c8798, metalness: 0.9, roughness: 0.32 });
    [-1.09, -1.17, -1.25, -1.33].forEach(function (y) {
      const thread = new THREE.Mesh(new THREE.TorusGeometry(0.415, 0.021, 8, 40), threadMaterial);
      thread.rotation.x = Math.PI / 2;
      thread.position.y = y;
      bulb.add(thread);
    });

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), baseMaterial);
    tip.position.y = -1.48;
    bulb.add(tip);

    /* ------------------------------------------------------------------ */
    /* Orbits + electrons                                                  */
    /* ------------------------------------------------------------------ */
    const orbitDefinitions = [
      { radius: 1.55, tube: 0.011, color: 0x22d3ee, electron: 0x7ff3ff, tilt: [1.18, 0.24, 0.18], speed: 0.55 },
      { radius: 1.85, tube: 0.009, color: 0x818cf8, electron: 0xc7d2fe, tilt: [1.52, -0.52, -0.3], speed: -0.38 },
      { radius: 2.15, tube: 0.008, color: 0xfbbf24, electron: 0xfde68a, tilt: [1.02, 0.92, 0.52], speed: 0.26 }
    ];

    const orbits = [];

    orbitDefinitions.forEach(function (definition) {
      const orbit = new THREE.Group();
      orbit.rotation.set(definition.tilt[0], definition.tilt[1], definition.tilt[2]);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(definition.radius, definition.tube, 8, 180),
        new THREE.MeshBasicMaterial({
          color: definition.color,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      orbit.add(ring);

      const electron = new THREE.Mesh(
        new THREE.SphereGeometry(0.052, 14, 14),
        new THREE.MeshBasicMaterial({ color: definition.electron })
      );
      electron.position.x = definition.radius;
      orbit.add(electron);

      const electronGlow = sprite(definition.electron, 0.46, 0.85);
      electronGlow.position.copy(electron.position);
      orbit.add(electronGlow);

      world.add(orbit);
      orbits.push({
        group: orbit,
        speed: definition.speed,
        electron: electron,
        electronGlow: electronGlow
      });
    });

    /* ------------------------------------------------------------------ */
    /* Floating hex nuts                                                   */
    /* ------------------------------------------------------------------ */
    const nutGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.055, 6);
    const goldMaterial = new THREE.MeshStandardMaterial({ color: 0xf2c56b, metalness: 0.95, roughness: 0.26 });
    const silverMaterial = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.92, roughness: 0.3 });
    const nuts = [];

    for (let i = 0; i < 9; i += 1) {
      const mesh = new THREE.Mesh(nutGeometry, i % 2 ? goldMaterial : silverMaterial);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      world.add(mesh);
      nuts.push({
        mesh: mesh,
        radius: 2.15 + Math.random() * 1.45,
        y: (Math.random() - 0.5) * 2.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.14 + Math.random() * 0.22,
        wobble: 0.12 + Math.random() * 0.22,
        spinX: 0.25 + Math.random() * 0.55,
        spinY: 0.2 + Math.random() * 0.5
      });
    }

    /* ------------------------------------------------------------------ */
    /* Particle field                                                      */
    /* ------------------------------------------------------------------ */
    const particleCount = isMobile ? 320 : 640;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const radius = 2.5 + Math.random() * 4.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.cos(phi) * 0.72;
      particlePositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x7dd3fc,
      size: 0.038,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    world.add(particles);

    /* ------------------------------------------------------------------ */
    /* Lightning arcs                                                      */
    /* ------------------------------------------------------------------ */
    const boltGroup = new THREE.Group();
    world.add(boltGroup);

    function makeBolt() {
      const startAngle = Math.random() * Math.PI * 2;
      const startRadius = 1.3;
      const endRadius = 2.7 + Math.random() * 1.3;
      const start = new THREE.Vector3(
        Math.cos(startAngle) * startRadius,
        (Math.random() - 0.5) * 1.5,
        Math.sin(startAngle) * startRadius
      );
      const end = new THREE.Vector3(
        Math.cos(startAngle + 0.55) * endRadius,
        (Math.random() - 0.5) * 2.4,
        Math.sin(startAngle + 0.55) * endRadius
      );
      const points = [];
      const segments = 7;
      for (let i = 0; i <= segments; i += 1) {
        const point = start.clone().lerp(end, i / segments);
        if (i > 0 && i < segments) {
          point.x += (Math.random() - 0.5) * 0.5;
          point.y += (Math.random() - 0.5) * 0.5;
          point.z += (Math.random() - 0.5) * 0.5;
        }
        points.push(point);
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0xa5f3fc,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      return new THREE.Line(geometry, material);
    }

    const bolts = [];
    for (let i = 0; i < 3; i += 1) {
      const line = makeBolt();
      boltGroup.add(line);
      bolts.push({
        line: line,
        life: Math.random() * 1.4,
        maxLife: 1.1 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2
      });
    }

    /* ------------------------------------------------------------------ */
    /* Layout                                                              */
    /* ------------------------------------------------------------------ */
    function layout() {
      const width = hero.clientWidth || window.innerWidth;
      const height = hero.clientHeight || window.innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const wide = width >= 900;
      world.position.x = wide ? 1.85 : 0;
      world.position.y = wide ? 0.02 : 0.62;
      world.scale.setScalar(wide ? Math.min(1, width / 1280) : 0.8);
      camera.position.z = wide ? 8.4 : 9.4;
      camera.lookAt(0, 0, 0);
    }

    layout();

    if ("ResizeObserver" in window) {
      new ResizeObserver(layout).observe(hero);
    } else {
      window.addEventListener("resize", layout);
    }

    /* ------------------------------------------------------------------ */
    /* Interaction                                                         */
    /* ------------------------------------------------------------------ */
    let targetRX = 0;
    let targetRY = 0;
    let rotX = 0;
    let rotY = 0;
    let autoY = 0;
    let spin = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    hero.addEventListener("pointermove", function (event) {
      if (event.pointerType === "touch" || dragging) return;
      const rect = hero.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      targetRX = ny * 0.26;
      targetRY = nx * 0.46;
    });

    hero.addEventListener("pointerleave", function () {
      if (dragging) return;
      targetRX = 0;
      targetRY = 0;
    });

    canvas.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "touch") return;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.style.cursor = "grabbing";
      try { canvas.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
    });

    canvas.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      targetRY += dx * 0.006;
      targetRX += dy * 0.004;
      spin = dx * 0.0009;
    });

    function endDrag(event) {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = "grab";
      try { canvas.releasePointerCapture(event.pointerId); } catch (err) { /* ignore */ }
    }

    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    canvas.addEventListener("webglcontextlost", function (event) {
      event.preventDefault();
      fail("WebGL context lost");
    });

    /* ------------------------------------------------------------------ */
    /* Scroll fade + visibility                                            */
    /* ------------------------------------------------------------------ */
    let heroVisible = true;
    let scrollQueued = false;

    function updateScrollFade() {
      const rect = hero.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / (rect.height * 0.9)));
      if (progress > 0) canvas.style.opacity = String(1 - progress * 0.95);
      else canvas.style.opacity = "";
    }

    window.addEventListener("scroll", function () {
      if (scrollQueued) return;
      scrollQueued = true;
      window.requestAnimationFrame(function () {
        updateScrollFade();
        scrollQueued = false;
      });
    }, { passive: true });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        heroVisible = entries[0].isIntersecting;
      }, { threshold: 0.01 }).observe(hero);
    }

    /* ------------------------------------------------------------------ */
    /* Animation                                                           */
    /* ------------------------------------------------------------------ */
    const clock = new THREE.Clock();
    let elapsed = 0;

    function animate() {
      window.requestAnimationFrame(animate);
      const delta = Math.min(0.05, clock.getDelta());
      if (!heroVisible || document.hidden) return;
      elapsed += delta;

      autoY += delta * 0.11 + spin;
      spin *= 0.94;
      rotX += (targetRX - rotX) * 0.06;
      rotY += (targetRY - rotY) * 0.06;
      world.rotation.x = rotX;
      world.rotation.y = rotY + autoY;

      bulb.position.y = 0.1 + Math.sin(elapsed * 1.15) * 0.075;
      bulb.rotation.y += delta * 0.16;
      filament.rotation.z += delta * 0.25;
      bulbLight.intensity = 15 + Math.sin(elapsed * 2.1) * 2.5;

      orbits.forEach(function (orbit, index) {
        orbit.group.rotation.z += orbit.speed * delta;
        orbit.electronGlow.material.opacity = 0.7 + Math.sin(elapsed * 2 + index) * 0.2;
      });

      nuts.forEach(function (nut) {
        const angle = nut.phase + elapsed * nut.speed;
        nut.mesh.position.set(
          Math.cos(angle) * nut.radius,
          nut.y + Math.sin(angle * 1.7) * nut.wobble,
          Math.sin(angle) * nut.radius
        );
        nut.mesh.rotation.x += delta * nut.spinX;
        nut.mesh.rotation.y += delta * nut.spinY;
      });

      particles.rotation.y += delta * 0.028;
      particles.rotation.x = Math.sin(elapsed * 0.12) * 0.05;

      bolts.forEach(function (bolt) {
        bolt.life -= delta;
        if (bolt.life <= 0) {
          boltGroup.remove(bolt.line);
          bolt.line.geometry.dispose();
          bolt.line.material.dispose();
          bolt.line = makeBolt();
          boltGroup.add(bolt.line);
          bolt.maxLife = 1.1 + Math.random() * 1.5;
          bolt.life = bolt.maxLife;
        }
        bolt.line.material.opacity = 0.22 + 0.62 * Math.abs(Math.sin(elapsed * 7 + bolt.phase));
      });

      halo.material.opacity = 0.18 + Math.sin(elapsed * 1.4) * 0.05;
      warmHalo.material.opacity = 0.26 + Math.sin(elapsed * 2.2) * 0.06;

      renderer.render(scene, camera);
    }

    // First frame, then reveal the canvas over the SVG fallback.
    renderer.render(scene, camera);
    hero.classList.add("has-3d");
    updateScrollFade();
    animate();
  })().catch(function (err) {
    fail(err);
  });
})();
