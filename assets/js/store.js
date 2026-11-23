/* ==========================================================================
   Bajrang Electric — storefront logic
   Keeps the existing Supabase backend, estimate flow and WhatsApp checkout.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Config                                                              */
  /* ------------------------------------------------------------------ */
  // Keep these in sync with admin.html if the Supabase project changes.
  const SUPABASE_URL = "https://fabhqatewbsmzutqycsb.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_vm_IHA6csiVVoErrcoeWtw_erFiE0r3";

  const SHOP = {
    name: "બજરંગ ઇલેક્ટ્રિક",
    latin: "Bajrang Electric",
    whatsapp: "919824980276",
    phone: "+919824980276"
  };

  const PLACEHOLDER = "assets/img/placeholder.svg";
  const PREVIEW = new URLSearchParams(window.location.search).get("preview") === "1";
  // Demo mode gets its own cart so previewing never wipes a real saved estimate.
  const CART_KEY = PREVIEW ? "bajrang-estimate-preview-v1" : "bajrang-estimate-v1";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */
  const $ = (id) => document.getElementById(id);

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function inr(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0";
    return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }

  function money(value) {
    return "₹" + inr(value);
  }

  function discountPct(product) {
    if (!product.mrp || product.mrp <= product.selling_price) return 0;
    return Math.round(((product.mrp - product.selling_price) / product.mrp) * 100);
  }

  function categoryCounts() {
    const map = new Map();
    products.forEach((p) => {
      const cat = p.category || "Other";
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return map;
  }

  function paletteFor(text) {
    const palette = [
      { a: "#22d3ee", b: "#2563eb", tint: "#e0f2fe" },
      { a: "#a78bfa", b: "#7c3aed", tint: "#f3e8ff" },
      { a: "#fbbf24", b: "#f97316", tint: "#fef3c7" },
      { a: "#34d399", b: "#059669", tint: "#d1fae5" },
      { a: "#fb7185", b: "#e11d48", tint: "#ffe4e6" },
      { a: "#38bdf8", b: "#06b6d4", tint: "#cffafe" },
      { a: "#818cf8", b: "#4f46e5", tint: "#e0e7ff" }
    ];
    let hash = 0;
    for (const ch of String(text || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return palette[hash % palette.length];
  }

  function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("The price service took too long to respond.")), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  /* ------------------------------------------------------------------ */
  /* Icons                                                               */
  /* ------------------------------------------------------------------ */
  const ICON_PATHS = {
    bolt: '<path d="M13.4 1.8 4.2 13.1c-.5.6-.1 1.5.7 1.5h5.2l-1 7.2c-.1.9 1 1.4 1.6.7l9.3-11.4c.5-.6.1-1.5-.7-1.5h-5.2l1-7.1c.1-.9-1-1.4-1.7-.7Z"/>',
    fan: '<circle cx="12" cy="12" r="2.1"/><path d="M12 9.9c0-4 .9-6.2 3-6.2s3 2.2 1.8 4.1-3.1 2.9-4.8 2.1Z"/><path d="M14.1 12c4 0 6.2.9 6.2 3s-2.2 3-4.1 1.8-2.9-3.1-2.1-4.8Z"/><path d="M12 14.1c0 4-.9 6.2-3 6.2s-3-2.2-1.8-4.1 3.1-2.9 4.8-2.1Z"/><path d="M9.9 12c-4 0-6.2-.9-6.2-3s2.2-3 4.1-1.8 2.9 3.1 2.1 4.8Z"/>',
    wire: '<path d="M3 8c3 0 3-5 6-5s3 5 6 5 3-5 6-5"/><path d="M3 16c3 0 3-5 6-5s3 5 6 5 3-5 6-5"/>',
    pump: '<path d="M12 2.8s5.7 5.9 5.7 9.8a5.7 5.7 0 0 1-11.4 0C6.3 8.7 12 2.8 12 2.8Z"/><path d="M9.5 13.2a2.5 2.5 0 0 0 2.5 2.5"/>',
    bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.4 1 1.1 1 1.8V18h6v-1.5c0-.7.4-1.4 1-1.8A7 7 0 0 0 12 2Z"/>',
    switch: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 12h4"/>',
    solar: '<path d="M4 15h16l-2 5H6l-2-5Z"/><path d="M12 2v3M5.6 4.6l2.1 2.1M18.4 4.6l-2.1 2.1M3 15h18M9 15l-1 5M15 15l1 5"/>',
    battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 10v4M6 10v4M10 10v4M14 10v4"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-6 7-9 16-9 0 9-3 16-9 16Z"/><path d="M4 21c3-6 7-9 12-11"/>',
    tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.1 2.1-2.9-2.9 2-2.2Z"/>',
    motor: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 5v3M12 16v3M5 12h3M16 12h3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    zoom: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/>',
    cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    wa: ""
  };

  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON_PATHS[name] || ICON_PATHS.bolt) + "</svg>";
  }

  const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z"/><path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.2-.3-.2-.6-.4Z"/></svg>';

  const CATEGORY_ICONS = [
    { test: /fan|પંખો|air|cooler/i, icon: "fan" },
    { test: /wire|cable|વાયર|કેબલ/i, icon: "wire" },
    { test: /pump|પંપ|motor|મોટર/i, icon: "pump" },
    { test: /bulb|light|lamp|led|લાઇટ|બલ્બ/i, icon: "bulb" },
    { test: /switch|socket|board|સ્વિચ/i, icon: "switch" },
    { test: /solar|સોલાર/i, icon: "solar" },
    { test: /battery|inverter|બેટરી/i, icon: "battery" },
    { test: /spray|agri|farm|ખેતી|સ્પ્રે|કૃષિ/i, icon: "leaf" },
    { test: /tool|drill|સાધન/i, icon: "tool" },
    { test: /heater|geyser|iron|હીટર/i, icon: "bolt" },
    { test: /motor|pump|મોટર/i, icon: "motor" }
  ];

  function iconForCategory(cat) {
    for (const entry of CATEGORY_ICONS) {
      if (entry.test.test(cat)) return icon(entry.icon);
    }
    return icon("bolt");
  }

  /* ------------------------------------------------------------------ */
  /* Preview data (only when ?preview=1)                                 */
  /* ------------------------------------------------------------------ */
  const PREVIEW_PRODUCTS = [
    { id: "PV-101", name: "Crompton 1200mm Ceiling Fan", category: "Fans", specs: "1200 mm • 5-star • Brown", selling_price: 1899, mrp: 2499, unit: "Piece", in_stock: true, image_url: PLACEHOLDER, created_at: "2026-11-20T10:00:00Z" },
    { id: "PV-102", name: "Polycab 1.5 sq mm Wire — 90m Roll", category: "Wires & Cables", specs: "FR PVC • Copper • 90 metres", selling_price: 2150, mrp: 2600, unit: "Roll", in_stock: true, image_url: PLACEHOLDER, created_at: "2026-11-19T10:00:00Z" },
    { id: "PV-103", name: "Kirloskar 1 HP Water Pump", category: "Pumps & Motors", specs: "1 HP • Single phase • Self-priming", selling_price: 8499, mrp: 9999, unit: "Piece", in_stock: true, image_url: PLACEHOLDER, created_at: "2026-11-18T10:00:00Z" },
    { id: "PV-104", name: "Philips 9W LED Bulb", category: "Lights", specs: "Cool daylight • B22 • 9 watt", selling_price: 99, mrp: 149, unit: "Piece", in_stock: true, image_url: PLACEHOLDER, created_at: "2026-11-17T10:00:00Z" },
    { id: "PV-105", name: "Havells 6A Modular Switch", category: "Switches & Boards", specs: "6 amp • White • ISI marked", selling_price: 65, mrp: 85, unit: "Piece", in_stock: true, image_url: PLACEHOLDER, created_at: "2026-11-16T10:00:00Z" },
    { id: "PV-106", name: "Luminous 150Ah Tall Tubular Battery", category: "Batteries & Inverters", specs: "150 Ah • 48 months warranty", selling_price: 14500, mrp: 16200, unit: "Piece", in_stock: false, image_url: PLACEHOLDER, created_at: "2026-11-15T10:00:00Z" },
    { id: "PV-107", name: "Agricultural Sprayer 16L", category: "Farm & Agriculture", specs: "16 litre • Battery sprayer • 12V", selling_price: 1650, mrp: 1999, unit: "Piece", in_stock: true, image_url: PLACEHOLDER, created_at: "2026-11-14T10:00:00Z" },
    { id: "PV-108", name: "Waaree 540W Solar Panel", category: "Solar", specs: "540 Wp • Mono PERC • 24V", selling_price: 13500, mrp: 15000, unit: "Piece", in_stock: true, image_url: PLACEHOLDER, created_at: "2026-11-13T10:00:00Z" },
    { id: "PV-109", name: "Bosch 13mm Drill Machine", category: "Tools", specs: "550 W • 13 mm chuck • Variable speed", selling_price: 3299, mrp: 3999, unit: "Piece", in_stock: true, image_url: PLACEHOLDER, created_at: "2026-11-12T10:00:00Z" }
  ];

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */
  let products = [];
  let activeCategory = "All";
  let sortMode = "newest";
  let searchTerm = "";
  let cart = loadCart();
  let supabaseClient = null;
  let isLoading = false;
  let currentViewerId = null;
  let viewerLastFocused = null;
  let drawerLastFocused = null;
  let deepLinkHandled = false;
  let toastTimer = null;
  let searchTimer = null;

  /* ------------------------------------------------------------------ */
  /* DOM                                                                 */
  /* ------------------------------------------------------------------ */
  const els = {
    header: $("siteHeader"),
    hero: $("hero"),
    grid: $("productGrid"),
    categoryTiles: $("categoryTiles"),
    categoryBar: $("categoryBar"),
    searchInput: $("searchInput"),
    clearSearchBtn: $("clearSearchBtn"),
    sortSelect: $("sortSelect"),
    itemCountText: $("itemCountText"),
    refreshBtn: $("refreshBtn"),
    loadError: $("loadError"),
    retryBtn: $("retryBtn"),
    statItems: $("statItems"),
    statCats: $("statCats"),
    estimateBar: $("estimateBar"),
    cartBadgeCount: $("cartBadgeCount"),
    cartBarTotal: $("cartBarTotal"),
    openDrawerArea: $("openDrawerArea"),
    sendBarBtn: $("sendBarBtn"),
    drawer: $("estimateDrawer"),
    drawerBackdrop: $("drawerBackdrop"),
    closeDrawerBtn: $("closeDrawerBtn"),
    drawerItemsList: $("drawerItemsList"),
    drawerTotalAmount: $("drawerTotalAmount"),
    clearCartBtn: $("clearCartBtn"),
    sendDrawerBtn: $("sendDrawerBtn"),
    viewer: $("viewer"),
    viewerBackdrop: $("viewerBackdrop"),
    viewerClose: $("viewerClose"),
    viewerImg: $("viewerImg"),
    viewerCategory: $("viewerCategory"),
    viewerName: $("viewerName"),
    viewerSpecs: $("viewerSpecs"),
    viewerPrice: $("viewerPrice"),
    viewerMrp: $("viewerMrp"),
    viewerStock: $("viewerStock"),
    viewerAdd: $("viewerAdd"),
    viewerWa: $("viewerWa"),
    viewerShare: $("viewerShare"),
    toast: $("toast"),
    footerYear: $("footerYear"),
    previewBadge: $("previewBadge")
  };

  const waBase = "https://wa.me/" + SHOP.whatsapp;
  const helloText = encodeURIComponent("Hello " + SHOP.name + ", I want to enquire about your products.");

  /* ------------------------------------------------------------------ */
  /* Cart persistence                                                    */
  /* ------------------------------------------------------------------ */
  function loadCart() {
    const out = {};
    try {
      const raw = window.localStorage.getItem(CART_KEY);
      if (!raw) return out;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return out;
      Object.keys(parsed).forEach((id) => {
        const n = Math.floor(Number(parsed[id]));
        if (n > 0 && n <= 99) out[id] = n;
      });
    } catch (err) {
      /* storage can be blocked in private mode — estimates still work for this visit */
    }
    return out;
  }

  function saveCart() {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (err) {
      /* ignore */
    }
  }

  /* ------------------------------------------------------------------ */
  /* Contact links                                                       */
  /* ------------------------------------------------------------------ */
  function wireContactLinks() {
    ["headerWa", "heroWa", "contactWa", "waFloat", "footerWa", "errorWa"].forEach((id) => {
      const el = $(id);
      if (el) el.href = waBase + "?text=" + helloText;
    });
    if (els.footerYear) els.footerYear.textContent = String(new Date().getFullYear());
  }

  /* ------------------------------------------------------------------ */
  /* Supabase                                                            */
  /* ------------------------------------------------------------------ */
  function waitForSupabase(timeout) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const limit = timeout || 9000;
      if (window.supabase && typeof window.supabase.createClient === "function") {
        resolve(window.supabase);
        return;
      }
      const timer = window.setInterval(() => {
        if (window.supabase && typeof window.supabase.createClient === "function") {
          window.clearInterval(timer);
          resolve(window.supabase);
        } else if (Date.now() - started > limit) {
          window.clearInterval(timer);
          reject(new Error("The price service could not be loaded."));
        }
      }, 120);
    });
  }

  function normalizeProduct(row) {
    const selling = Number(row.selling_price);
    const mrpValue = row.mrp == null || row.mrp === "" ? null : Number(row.mrp);
    return {
      id: String(row.id == null ? "" : row.id),
      name: String(row.name || "Untitled item"),
      category: String(row.category || "Other"),
      specs: row.specs ? String(row.specs) : "",
      selling_price: Number.isFinite(selling) ? selling : 0,
      mrp: Number.isFinite(mrpValue) && mrpValue > 0 ? mrpValue : null,
      unit: row.unit ? String(row.unit) : "",
      image_url: row.image_url ? String(row.image_url) : "",
      in_stock: row.in_stock === true || row.in_stock === "true",
      created_at: row.created_at || null
    };
  }

  async function fetchProducts() {
    if (isLoading) return;
    isLoading = true;
    setRefreshLoading(true);
    hideError();

    if (!products.length) showSkeletons();

    try {
      let rows;
      if (PREVIEW) {
        await new Promise((resolve) => window.setTimeout(resolve, 320));
        rows = PREVIEW_PRODUCTS.slice();
      } else {
        const supabase = await waitForSupabase();
        if (!supabaseClient) {
          supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
        const result = await withTimeout(
          supabaseClient.from("products").select("*").order("created_at", { ascending: false }),
          15000
        );
        if (result.error) throw result.error;
        rows = result.data || [];
      }

      products = rows.map(normalizeProduct);
      renderAll();
      handleDeepLink();
      if (!products.length) {
        els.grid.innerHTML = emptyState(
          "The catalogue is empty",
          "The shop hasn't added any items yet. Call or WhatsApp us and we'll check the price for you.",
          true
        );
      }
    } catch (err) {
      console.error("[Bajrang Electric] Could not load live prices:", err);
      if (products.length) {
        showToast("Couldn't refresh. Showing the last loaded prices.", "warn");
      } else {
        showError();
      }
    } finally {
      isLoading = false;
      setRefreshLoading(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */
  function renderAll() {
    renderStats();
    renderCategoryBar();
    renderCategoryTiles();
    renderProducts();
    updateEstimateUI();
  }

  function renderStats() {
    const cats = categoryCounts();
    animateNumber(els.statItems, products.length);
    animateNumber(els.statCats, cats.size);
  }

  function animateNumber(el, target) {
    if (!el) return;
    const end = Number(target) || 0;
    if (reduceMotion) {
      el.textContent = String(end);
      return;
    }
    const start = performance.now();
    const duration = 620;
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(end * eased));
      if (t < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  function renderCategoryBar() {
    if (!els.categoryBar) return;
    const counts = categoryCounts();
    const cats = ["All"].concat(
      Array.from(counts.keys()).sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0))
    );
    els.categoryBar.innerHTML = cats.map((cat) => {
      const active = activeCategory === cat;
      return '<button type="button" class="chip' + (active ? " active" : "") + '" data-cat="' + esc(cat) + '" aria-pressed="' + active + '">' + esc(cat) + "</button>";
    }).join("");
  }

  function renderCategoryTiles() {
    if (!els.categoryTiles) return;
    const counts = categoryCounts();
    const entries = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    if (!entries.length) {
      els.categoryTiles.innerHTML = '<p class="section-sub">Categories will appear as soon as the shop adds products.</p>';
      return;
    }

    els.categoryTiles.innerHTML = entries.map(([cat, count], i) => {
      const pal = paletteFor(cat);
      return '<button type="button" class="category-tile" style="--g1:' + pal.a + ';--g2:' + pal.b + ';--tint:' + pal.tint + ';--i:' + i + '" data-cat-tile="' + esc(cat) + '" aria-label="Shop ' + esc(cat) + ', ' + count + ' items">' +
        '<span class="category-icon">' + iconForCategory(cat) + "</span>" +
        '<span class="category-info"><strong>' + esc(cat) + "</strong><span>" + count + " item" + (count === 1 ? "" : "s") + "</span></span>" +
        '<svg class="category-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
        "</button>";
    }).join("");
  }

  function getFilteredProducts() {
    const query = searchTerm;
    const filtered = products.filter((p) => {
      const okCat = activeCategory === "All" || p.category === activeCategory;
      if (!okCat) return false;
      if (!query) return true;
      const haystack = [p.name, p.specs, p.id, p.category, p.unit].join(" ").toLowerCase();
      return haystack.indexOf(query) !== -1;
    });

    const sorted = filtered.slice();
    if (sortMode === "price-asc") {
      sorted.sort((a, b) => a.selling_price - b.selling_price);
    } else if (sortMode === "price-desc") {
      sorted.sort((a, b) => b.selling_price - a.selling_price);
    } else if (sortMode === "discount") {
      sorted.sort((a, b) => discountPct(b) - discountPct(a));
    }
    return sorted;
  }

  function renderProducts(opts) {
    if (!els.grid) return;
    const noAnim = !!(opts && opts.noAnim);
    const list = getFilteredProducts();
    const total = products.length;

    if (els.itemCountText) {
      els.itemCountText.textContent = total
        ? "Showing " + list.length + " of " + total + " item" + (total === 1 ? "" : "s")
        : "No items yet";
    }

    if (!list.length) {
      if (!total) {
        els.grid.innerHTML = emptyState(
          "The catalogue is empty",
          "The shop hasn't added any items yet. Call or WhatsApp us and we'll check the price for you.",
          true
        );
      } else {
        els.grid.innerHTML = emptyState(
          "No matches found",
          "Try a different search, or clear the filters to see the full catalogue.",
          false
        );
      }
      return;
    }

    els.grid.innerHTML = list.map((p, i) => productCard(p, i, noAnim)).join("");
    attachImageFallbacks(els.grid);
  }

  function productCard(p, index, noAnim) {
    const qty = cart[p.id] || 0;
    const disc = discountPct(p);
    const img = p.image_url ? esc(p.image_url) : PLACEHOLDER;
    const unit = p.unit ? '<span class="per">/ ' + esc(p.unit) + "</span>" : "";
    const mrp = p.mrp && p.mrp > p.selling_price ? "<s>MRP " + money(p.mrp) + "</s>" : "";
    const classes = "product-card" + (p.in_stock ? "" : " out") + (noAnim ? " no-anim" : "");

    return '<article class="' + classes + '" data-id="' + esc(p.id) + '" style="--i:' + Math.min(index, 12) + '">' +
      '<button type="button" class="product-media" data-view="' + esc(p.id) + '" aria-label="View ' + esc(p.name) + '">' +
        '<img src="' + img + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async">' +
        (disc ? '<span class="discount-badge">' + disc + "% OFF</span>" : "") +
        (!p.in_stock ? '<span class="out-badge">Out of stock</span>' : "") +
        '<span class="zoom-hint">' + icon("zoom") + " View</span>" +
      "</button>" +
      '<div class="product-body">' +
        '<div class="product-top"><span class="product-cat">' + esc(p.category) + '</span><span class="product-sku">' + esc(p.id) + "</span></div>" +
        '<h3 class="product-name"><button type="button" data-view="' + esc(p.id) + '">' + esc(p.name) + "</button></h3>" +
        (p.specs ? '<p class="product-specs">' + esc(p.specs) + "</p>" : "") +
        '<div class="product-price"><strong>' + money(p.selling_price) + "</strong>" + unit + mrp + "</div>" +
      "</div>" +
      '<div class="product-actions">' + actionsHtml(p, qty) + "</div>" +
    "</article>";
  }

  function actionsHtml(p, qty) {
    const waLink = waProductLink(p);
    const waBtn = '<a class="wa-btn" href="' + waLink + '" target="_blank" rel="noopener" aria-label="Ask about ' + esc(p.name) + ' on WhatsApp">' + WA_ICON + "</a>";

    if (!p.in_stock) {
      return '<span class="stock-out">Out of stock</span>' + waBtn;
    }

    if (qty > 0) {
      return '<div class="stepper" role="group" aria-label="Quantity for ' + esc(p.name) + '">' +
        '<button type="button" data-qty="' + esc(p.id) + '" data-n="' + (qty - 1) + '" aria-label="Remove one ' + esc(p.name) + '">−</button>' +
        '<span class="qty-num">' + qty + "</span>" +
        '<button type="button" data-qty="' + esc(p.id) + '" data-n="' + (qty + 1) + '" aria-label="Add one ' + esc(p.name) + '">+</button>' +
      "</div>" + waBtn;
    }

    return '<button type="button" class="add-btn" data-add="' + esc(p.id) + '">' + icon("plus") + " Add</button>" + waBtn;
  }

  function emptyState(title, text, showWa) {
    return '<div class="empty-state">' +
      '<span class="empty-icon">' + icon("search") + "</span>" +
      "<h3>" + esc(title) + "</h3>" +
      "<p>" + esc(text) + "</p>" +
      (showWa
        ? '<a class="btn btn-wa btn-sm" href="' + waBase + "?text=" + helloText + '" target="_blank" rel="noopener">' + WA_ICON + " WhatsApp the shop</a>"
        : '<button type="button" class="btn btn-dark btn-sm" data-clear-filters>Clear filters</button>') +
      "</div>";
  }

  function showSkeletons() {
    if (!els.grid) return;
    let html = "";
    for (let i = 0; i < 8; i += 1) {
      html += '<div class="skeleton-card"><div class="sk sk-media"></div><div class="sk sk-line w70"></div><div class="sk sk-line w90"></div><div class="sk sk-line w50"></div></div>';
    }
    els.grid.innerHTML = html;
  }

  function showError() {
    if (els.loadError) els.loadError.hidden = false;
    if (els.grid) els.grid.innerHTML = "";
    if (els.itemCountText) els.itemCountText.textContent = "Live prices unavailable";
    if (els.categoryBar) els.categoryBar.innerHTML = "";
    if (els.categoryTiles) {
      els.categoryTiles.innerHTML = '<p class="section-sub">Categories will appear when live prices are back.</p>';
    }
    if (els.statItems) els.statItems.textContent = "—";
    if (els.statCats) els.statCats.textContent = "—";
  }

  function hideError() {
    if (els.loadError) els.loadError.hidden = true;
  }

  function setRefreshLoading(loading) {
    if (!els.refreshBtn) return;
    els.refreshBtn.classList.toggle("is-loading", loading);
    els.refreshBtn.disabled = loading;
  }

  function attachImageFallbacks(scope) {
    if (!scope) return;
    scope.querySelectorAll("img").forEach((img) => {
      img.addEventListener("error", () => {
        if (img.dataset.fallback === "1") return;
        img.dataset.fallback = "1";
        img.src = PLACEHOLDER;
        img.classList.add("img-fallback");
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Estimate / cart                                                     */
  /* ------------------------------------------------------------------ */
  function changeQty(id, next) {
    const product = products.find((p) => p.id === id);
    if (!product || !product.in_stock) return;

    const previous = cart[id] || 0;
    const qty = Math.max(0, Math.min(99, Math.floor(Number(next) || 0)));

    if (qty === 0) delete cart[id];
    else cart[id] = qty;

    saveCart();
    renderProducts({ noAnim: true });
    updateEstimateUI();
    updateViewerAdd();

    if (previous === 0 && qty > 0) showToast("Added to your estimate");
    else if (qty === 0 && previous > 0) showToast("Removed from your estimate");
  }

  function updateEstimateUI() {
    if (!els.drawerItemsList) return;

    let pruned = false;
    if (products.length) {
      Object.keys(cart).forEach((id) => {
        if (!products.some((p) => p.id === id)) {
          delete cart[id];
          pruned = true;
        }
      });
      if (pruned) saveCart();
    }

    const ids = Object.keys(cart).filter((id) => products.some((p) => p.id === id));
    let totalQty = 0;
    let total = 0;

    const rows = ids.map((id) => {
      const p = products.find((x) => x.id === id);
      const qty = cart[id];
      const line = p.selling_price * qty;
      totalQty += qty;
      total += line;
      const img = p.image_url ? esc(p.image_url) : PLACEHOLDER;
      const unit = p.unit ? " / " + esc(p.unit) : "";
      return '<div class="drawer-item">' +
        '<img class="drawer-thumb" src="' + img + '" alt="" loading="lazy">' +
        '<div class="drawer-info">' +
          "<h4>" + esc(p.name) + "</h4>" +
          "<p>" + money(p.selling_price) + unit + " each · <strong>" + money(line) + "</strong></p>" +
        "</div>" +
        '<div class="drawer-qty" role="group" aria-label="Quantity for ' + esc(p.name) + '">' +
          '<button type="button" data-dqty="' + esc(id) + '" data-n="' + (qty - 1) + '" aria-label="Remove one">−</button>' +
          "<span>" + qty + "</span>" +
          '<button type="button" data-dqty="' + esc(id) + '" data-n="' + (qty + 1) + '" aria-label="Add one">+</button>' +
        "</div>" +
      "</div>";
    });

    els.drawerItemsList.innerHTML = rows.length
      ? rows.join("")
      : '<p class="section-sub" style="padding:24px 0">Your estimate is empty. Add products from the catalogue.</p>';
    attachImageFallbacks(els.drawerItemsList);

    if (els.cartBadgeCount) {
      let label = ids.length + " item" + (ids.length === 1 ? "" : "s");
      if (totalQty !== ids.length) label += " · " + totalQty + " qty";
      els.cartBadgeCount.textContent = label;
    }
    if (els.cartBarTotal) els.cartBarTotal.textContent = inr(total);
    if (els.drawerTotalAmount) els.drawerTotalAmount.textContent = inr(total);

    if (els.estimateBar) {
      els.estimateBar.classList.toggle("show", ids.length > 0);
      els.estimateBar.setAttribute("aria-hidden", ids.length > 0 ? "false" : "true");
    }
    document.body.classList.toggle("cart-open", ids.length > 0);

    if (!ids.length && !els.drawer.hidden) closeDrawer();
  }

  function clearCart() {
    if (!Object.keys(cart).length) return;
    cart = {};
    saveCart();
    renderProducts({ noAnim: true });
    updateEstimateUI();
    updateViewerAdd();
    showToast("Estimate cleared");
  }

  function sendEstimateToWhatsApp() {
    const ids = Object.keys(cart).filter((id) => products.some((p) => p.id === id));
    if (!ids.length) return;

    let total = 0;
    const lines = ["*⚡ Estimate enquiry — " + SHOP.name + "*", "————————————"];

    ids.forEach((id, index) => {
      const p = products.find((x) => x.id === id);
      if (!p) return;
      const qty = cart[id];
      const sub = p.selling_price * qty;
      total += sub;
      const unit = p.unit ? " (" + p.unit + ")" : "";
      lines.push(
        (index + 1) + ". *" + p.name + "*" + unit + "\n   Qty: " + qty + " × " + money(p.selling_price) + " = *" + money(sub) + "*"
      );
    });

    lines.push("————————————", "*Estimated total: " + money(total) + "*", "", "Please confirm availability and the final price. Thank you!");

    window.open(waBase + "?text=" + encodeURIComponent(lines.join("\n")), "_blank", "noopener");
  }

  /* ------------------------------------------------------------------ */
  /* Drawer                                                              */
  /* ------------------------------------------------------------------ */
  function openDrawer() {
    if (!Object.keys(cart).length || !els.drawer) return;
    drawerLastFocused = document.activeElement;
    els.drawer.hidden = false;
    document.body.classList.add("no-scroll");
    if (els.closeDrawerBtn) els.closeDrawerBtn.focus();
  }

  function closeDrawer() {
    if (!els.drawer) return;
    els.drawer.hidden = true;
    if (els.viewer.hidden) document.body.classList.remove("no-scroll");
    if (drawerLastFocused && typeof drawerLastFocused.focus === "function") {
      drawerLastFocused.focus();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Product viewer                                                      */
  /* ------------------------------------------------------------------ */
  function openViewer(id) {
    const p = products.find((x) => x.id === id);
    if (!p || !els.viewer) return;

    currentViewerId = id;
    viewerLastFocused = document.activeElement;

    delete els.viewerImg.dataset.fallback;
    els.viewerImg.src = p.image_url || PLACEHOLDER;
    els.viewerImg.alt = p.name;
    els.viewerImg.classList.toggle("img-fallback", !p.image_url);
    els.viewerCategory.textContent = p.category;
    els.viewerName.textContent = p.name;
    els.viewerSpecs.textContent = p.specs || "Ask the shop for full specifications.";
    els.viewerPrice.textContent = money(p.selling_price) + (p.unit ? " / " + p.unit : "");
    els.viewerMrp.hidden = !(p.mrp && p.mrp > p.selling_price);
    if (!els.viewerMrp.hidden) els.viewerMrp.textContent = "MRP " + money(p.mrp);
    els.viewerStock.textContent = p.in_stock ? "In stock" : "Out of stock";
    els.viewerStock.classList.toggle("out", !p.in_stock);
    els.viewerWa.href = waProductLink(p);
    updateViewerAdd();
    els.viewer.hidden = false;
    document.body.classList.add("no-scroll");
    if (els.viewerClose) els.viewerClose.focus();
  }

  function updateViewerAdd() {
    if (!els.viewerAdd) return;
    const p = products.find((x) => x.id === currentViewerId);
    if (!p) {
      els.viewerAdd.textContent = "Add to estimate";
      els.viewerAdd.disabled = true;
      return;
    }
    const qty = cart[p.id] || 0;
    els.viewerAdd.disabled = !p.in_stock;
    if (!p.in_stock) {
      els.viewerAdd.textContent = "Out of stock";
    } else if (qty > 0) {
      els.viewerAdd.textContent = "Add another · " + qty + " in list";
    } else {
      els.viewerAdd.textContent = "Add to estimate";
    }
  }

  function closeViewer() {
    if (!els.viewer) return;
    els.viewer.hidden = true;
    currentViewerId = null;
    if (els.drawer.hidden) document.body.classList.remove("no-scroll");
    if (viewerLastFocused && typeof viewerLastFocused.focus === "function") {
      viewerLastFocused.focus();
    }
  }

  async function shareCurrentProduct() {
    const p = products.find((x) => x.id === currentViewerId);
    if (!p) return;
    const url = window.location.origin + window.location.pathname + "?item=" + encodeURIComponent(p.id);
    const text = p.name + " — " + money(p.selling_price) + " at " + SHOP.latin;

    if (navigator.share) {
      try {
        await navigator.share({ title: p.name, text: text, url: url });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(text + "\n" + url);
      showToast("Product link copied");
    } catch (err) {
      showToast("Couldn't share on this device", "warn");
    }
  }

  function handleDeepLink() {
    if (deepLinkHandled) return;
    const id = new URLSearchParams(window.location.search).get("item");
    if (!id) return;
    if (products.some((p) => p.id === id)) {
      deepLinkHandled = true;
      openViewer(id);
    }
  }

  /* ------------------------------------------------------------------ */
  /* WhatsApp links                                                      */
  /* ------------------------------------------------------------------ */
  function waProductLink(p) {
    const text = "Hello " + SHOP.name + ", I want to enquire about:\n*" + p.name + "*\nPrice: " + money(p.selling_price) + (p.unit ? " (" + p.unit + ")" : "");
    return waBase + "?text=" + encodeURIComponent(text);
  }

  /* ------------------------------------------------------------------ */
  /* Filters                                                             */
  /* ------------------------------------------------------------------ */
  function setCategory(cat, scroll) {
    activeCategory = cat || "All";
    renderCategoryBar();
    renderProducts();
    if (scroll) {
      const target = $("catalogue");
      if (target) target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
  }

  function resetFilters() {
    activeCategory = "All";
    searchTerm = "";
    sortMode = "newest";
    if (els.searchInput) els.searchInput.value = "";
    if (els.sortSelect) els.sortSelect.value = "newest";
    updateClearButton();
    renderCategoryBar();
    renderProducts();
  }

  function updateClearButton() {
    if (!els.clearSearchBtn || !els.searchInput) return;
    els.clearSearchBtn.hidden = !els.searchInput.value;
  }

  /* ------------------------------------------------------------------ */
  /* Toast                                                               */
  /* ------------------------------------------------------------------ */
  function showToast(message, type) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.toggle("warn", type === "warn");
    els.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove("show");
    }, 2600);
  }

  /* ------------------------------------------------------------------ */
  /* 3D card tilt (mouse only)                                           */
  /* ------------------------------------------------------------------ */
  function wireTilt() {
    if (!els.grid) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches || reduceMotion) return;

    els.grid.addEventListener("pointermove", (event) => {
      const card = event.target.closest(".product-card");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.classList.add("is-tilting");
      card.style.transform = "perspective(900px) rotateX(" + (-y * 5).toFixed(2) + "deg) rotateY(" + (x * 6).toFixed(2) + "deg) translateY(-3px)";
    });

    els.grid.addEventListener("pointerout", (event) => {
      const card = event.target.closest(".product-card");
      if (card && !card.contains(event.relatedTarget)) {
        card.classList.remove("is-tilting");
        card.style.transform = "";
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Event wiring                                                        */
  /* ------------------------------------------------------------------ */
  function wireEvents() {
    if (els.grid) {
      els.grid.addEventListener("click", (event) => {
        const clear = event.target.closest("[data-clear-filters]");
        if (clear) {
          resetFilters();
          return;
        }
        const add = event.target.closest("[data-add]");
        if (add) {
          changeQty(add.dataset.add, (cart[add.dataset.add] || 0) + 1);
          return;
        }
        const qty = event.target.closest("[data-qty]");
        if (qty) {
          changeQty(qty.dataset.qty, Number(qty.dataset.n));
          return;
        }
        const view = event.target.closest("[data-view]");
        if (view) openViewer(view.dataset.view);
      });
    }

    if (els.categoryBar) {
      els.categoryBar.addEventListener("click", (event) => {
        const chip = event.target.closest("[data-cat]");
        if (chip) setCategory(chip.dataset.cat, false);
      });
    }

    if (els.categoryTiles) {
      els.categoryTiles.addEventListener("click", (event) => {
        const tile = event.target.closest("[data-cat-tile]");
        if (tile) setCategory(tile.dataset.catTile, true);
      });
    }

    if (els.searchInput) {
      els.searchInput.addEventListener("input", () => {
        searchTerm = els.searchInput.value.trim().toLowerCase();
        updateClearButton();
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(renderProducts, 110);
      });
    }

    if (els.clearSearchBtn) {
      els.clearSearchBtn.addEventListener("click", () => {
        els.searchInput.value = "";
        searchTerm = "";
        updateClearButton();
        renderProducts();
        els.searchInput.focus();
      });
    }

    if (els.sortSelect) {
      els.sortSelect.addEventListener("change", () => {
        sortMode = els.sortSelect.value;
        renderProducts();
      });
    }

    if (els.refreshBtn) els.refreshBtn.addEventListener("click", fetchProducts);
    if (els.retryBtn) els.retryBtn.addEventListener("click", fetchProducts);

    if (els.openDrawerArea) els.openDrawerArea.addEventListener("click", openDrawer);
    if (els.sendBarBtn) els.sendBarBtn.addEventListener("click", sendEstimateToWhatsApp);
    if (els.sendDrawerBtn) els.sendDrawerBtn.addEventListener("click", sendEstimateToWhatsApp);
    if (els.clearCartBtn) els.clearCartBtn.addEventListener("click", clearCart);
    if (els.closeDrawerBtn) els.closeDrawerBtn.addEventListener("click", closeDrawer);
    if (els.drawerBackdrop) els.drawerBackdrop.addEventListener("click", closeDrawer);

    if (els.drawerItemsList) {
      els.drawerItemsList.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-dqty]");
        if (btn) changeQty(btn.dataset.dqty, Number(btn.dataset.n));
      });
    }

    if (els.viewerClose) els.viewerClose.addEventListener("click", closeViewer);
    if (els.viewerBackdrop) els.viewerBackdrop.addEventListener("click", closeViewer);
    if (els.viewerAdd) {
      els.viewerAdd.addEventListener("click", () => {
        if (!currentViewerId) return;
        changeQty(currentViewerId, (cart[currentViewerId] || 0) + 1);
      });
    }
    if (els.viewerShare) els.viewerShare.addEventListener("click", shareCurrentProduct);

    if (els.viewerImg) {
      els.viewerImg.addEventListener("error", () => {
        if (els.viewerImg.dataset.fallback === "1") return;
        els.viewerImg.dataset.fallback = "1";
        els.viewerImg.src = PLACEHOLDER;
        els.viewerImg.classList.add("img-fallback");
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!els.viewer.hidden) closeViewer();
      else if (!els.drawer.hidden) closeDrawer();
    });

    let scrollTick = false;
    window.addEventListener("scroll", () => {
      if (scrollTick) return;
      scrollTick = true;
      window.requestAnimationFrame(() => {
        if (els.header) els.header.classList.toggle("scrolled", window.scrollY > 14);
        scrollTick = false;
      });
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                */
  /* ------------------------------------------------------------------ */
  function init() {
    wireContactLinks();
    wireEvents();
    wireTilt();
    updateClearButton();

    if (PREVIEW && els.previewBadge) els.previewBadge.hidden = false;

    if (els.header) els.header.classList.toggle("scrolled", window.scrollY > 14);

    // Show a saved estimate immediately, even before prices arrive.
    updateEstimateUI();

    fetchProducts();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
