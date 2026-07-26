window.initHomeView = async function() {
  const user = window.currentUser;
  const now  = new Date();

  const greeting = now.getHours() < 11 ? "Selamat Pagi ☀️"
    : now.getHours() < 15 ? "Selamat Siang 🌤️"
    : now.getHours() < 18 ? "Selamat Sore 🌅"
    : "Selamat Malam 🌙";

  const tanggal = now.toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  const el = id => document.getElementById(id);
  if (el("homeBannerGreeting")) el("homeBannerGreeting").textContent = greeting;
  if (el("homeBannerName"))     el("homeBannerName").textContent     = user?.nama || "Admin";
  if (el("homeBannerSub"))      el("homeBannerSub").textContent      = tanggal;

  window.onHomeReload = async () => {
    const reloadBtn = document.getElementById("topbarReload");
    const icon      = reloadBtn?.querySelector("i");
    if (icon) icon.classList.add("fa-spin");
    if (reloadBtn) reloadBtn.disabled = true;
    try {
      await loadUsers();
    } catch {}
    if (icon) icon.classList.remove("fa-spin");
    if (reloadBtn) reloadBtn.disabled = false;
  };

  await loadUsers();
};

let usersCache = [];

async function loadUsers() {
  const uid = window.auth?.currentUser?.uid;
  if (!uid) return;

  try {
    // selalu query Firestore saat buka home
    const snap = await window.getDocs(window.query(
      window.collection(window.db, "users"),
      window.where("createdBy", "==", uid)
    ));

    usersCache        = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    window.usersCache = usersCache;

    await loadKantorCabang();

    renderStats();
    renderUsersList();
  } catch (err) {
    console.error("❌ loadUsers:", err);
    const listEl = document.getElementById("homeUsersList");
    if (listEl) listEl.innerHTML = `<div class="home-users-empty">Gagal memuat data</div>`;
  }
}

async function loadKantorCabang() {
  try {
    const idCabang = window.currentUser?.idCabang;
    if (!idCabang) return;

    const snap = await window.getDoc(window.doc(window.db, "kantorCabang", idCabang));
    if (snap.exists()) {
      const data = { id: snap.id, ...snap.data() };
      window.kantorCabang = data;
    }
  } catch (err) {
    console.error("❌ loadKantorCabang:", err);
  }
}

function renderStats() {
  const kurir  = usersCache.filter(u => u.role === "kurir").length;
  const sales  = usersCache.filter(u => u.role === "sales").length;
  const hunter = usersCache.filter(u => u.role === "hunter").length;
  const total  = usersCache.length;

  const grid = document.getElementById("homeStatGrid");
  if (!grid) return;

  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-card-icon brown"><i class="fa-solid fa-users"></i></div>
      <div class="stat-card-label">Total Anggota</div>
      <div class="stat-card-value">${total}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon blue"><i class="fa-solid fa-motorcycle"></i></div>
      <div class="stat-card-label">Kurir</div>
      <div class="stat-card-value">${kurir}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon green"><i class="fa-solid fa-handshake"></i></div>
      <div class="stat-card-label">Sales</div>
      <div class="stat-card-value">${sales}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon purple"><i class="fa-solid fa-binoculars"></i></div>
      <div class="stat-card-label">Hunter</div>
      <div class="stat-card-value">${hunter}</div>
    </div>`;
}

function renderUsersList() {
  const wrapEl = document.getElementById("homeUsersList");
  if (!wrapEl) return;

  // hentikan animasi lama dulu (kalau ada), biar gak numpuk loop pas reload
  if (window._homeBubbleRaf) { cancelAnimationFrame(window._homeBubbleRaf); window._homeBubbleRaf = null; }

  if (!usersCache.length) {
    wrapEl.innerHTML = `<div class="home-users-empty">Belum ada anggota</div>`;
    return;
  }

  wrapEl.innerHTML = `<div class="home-bubble-wrap" id="homeBubbleWrap"></div>`;
  const container = document.getElementById("homeBubbleWrap");
  const rect = () => container.getBoundingClientRect();
  const { width: W, height: H } = rect();

  const isMobile = window.innerWidth <= 768;
  const bubbleSize = isMobile
    ? (usersCache.length > 20 ? 32 : usersCache.length > 10 ? 40 : 48)
    : (usersCache.length > 20 ? 60 : usersCache.length > 10 ? 72 : 88);
  const radius = bubbleSize / 2;

  const bubbles = usersCache.map(u => {
    const nama    = u.nama || "Tanpa Nama";
    const inisial = nama.trim().charAt(0).toUpperCase();
    const el = document.createElement("div");
    el.className = `home-bubble badge-${esc(u.role || "kurir")}`;
    el.style.width  = bubbleSize + "px";
    el.style.height = bubbleSize + "px";
    el.innerHTML = u.foto
      ? `<img src="${esc(u.foto)}" alt="${esc(nama)}">`
      : `<span>${esc(inisial)}</span>`;
    container.appendChild(el);
    return {
      uid: u.uid,
      el,
      x: Math.random() * Math.max(W - bubbleSize, 1) + radius,
      y: Math.random() * Math.max(H - bubbleSize, 1) + radius,
      angle: Math.random() * Math.PI * 2, // arah gerak dasar
      ix: 0, iy: 0, // impuls dari dorongan kursor/jari (meredam sendiri)
    };
  });

  let pointer = null; // posisi kursor/jari relatif ke container, null kalau gak aktif
  const getRelPos = e => {
    const r  = rect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: cx - r.left, y: cy - r.top };
  };
  container.addEventListener("pointermove", e => { pointer = getRelPos(e); });
  container.addEventListener("pointerleave", () => { pointer = null; });
  container.addEventListener("touchmove", e => { pointer = getRelPos(e); }, { passive: true });
  container.addEventListener("touchend", () => { pointer = null; });

  // klik vs drag: kalau geser kurang dari 6px dianggap klik → buka detail akun
  bubbles.forEach(b => {
    let downX = 0, downY = 0, moved = false;
    b.el.addEventListener("pointerdown", e => { downX = e.clientX; downY = e.clientY; moved = false; });
    b.el.addEventListener("pointermove", e => {
      if (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6) moved = true;
    });
    b.el.addEventListener("pointerup", () => {
      if (!moved) window.openAkunDetailByUid?.(b.uid);
    });
  });

  const BASE_SPEED = 0.8, TURN_RATE = 0.15, REPEL_RADIUS = 90, REPEL_STRENGTH = 7, IMPULSE_FRICTION = 0.93;

  function step() {
    const { width, height } = rect();
    bubbles.forEach(b => {
      // gerak dasar: belok pelan-pelan, kecepatan tetap (gak diredam)
      b.angle += (Math.random() - 0.5) * TURN_RATE;
      const baseVx = Math.cos(b.angle) * BASE_SPEED;
      const baseVy = Math.sin(b.angle) * BASE_SPEED;

      // impuls dorongan dari kursor/jari (ini yang diredam)
      if (pointer) {
        const dx = b.x - pointer.x, dy = b.y - pointer.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < REPEL_RADIUS) {
          const force = (REPEL_RADIUS - dist) / REPEL_RADIUS * REPEL_STRENGTH;
          b.ix += (dx / dist) * force;
          b.iy += (dy / dist) * force;
        }
      }
      b.ix *= IMPULSE_FRICTION;
      b.iy *= IMPULSE_FRICTION;

      b.x += baseVx + b.ix;
      b.y += baseVy + b.iy;

      // pantul dari tepi — belokin arah dasar (bukan cuma impuls)
      if (b.x < radius)          { b.x = radius;          b.angle = Math.PI - b.angle; }
      if (b.x > width - radius)  { b.x = width - radius;  b.angle = Math.PI - b.angle; }
      if (b.y < radius)          { b.y = radius;          b.angle = -b.angle; }
      if (b.y > height - radius) { b.y = height - radius; b.angle = -b.angle; }

      b.el.style.transform = `translate(${b.x - radius}px, ${b.y - radius}px)`;
    });
    window._homeBubbleRaf = requestAnimationFrame(step);
  }
  step();
}

function esc(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
