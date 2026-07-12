/* ── NOTIF SHEET ── */
function ensureNotifSheetDOM() {
  if (document.getElementById("notifSheetOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "notifSheetOverlay";
  overlay.innerHTML = `
    <div id="notifSheetPanel" onclick="event.stopPropagation()">
      <div class="notif-sheet-header" id="notifSheetHeaderNormal">
        <div class="notif-sheet-title">Notifikasi</div>
        <button class="notif-sheet-close" id="notifSheetCloseBtn">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="notif-sheet-header-select" id="notifSheetHeaderSelect">
        <span class="notif-select-count" id="notifSelectCount">0 dipilih</span>
        <div class="notif-select-actions">
          <button class="notif-select-cancel" id="notifSelectCancelBtn">Batal</button>
          <button class="notif-select-delete" id="notifSelectDeleteBtn" disabled>
            <i class="fa-solid fa-trash"></i> Hapus
          </button>
        </div>
      </div>
      <div class="notif-sheet-tabs">
        <button class="notif-sheet-tab active" id="notifTabInput" data-tab="input">Input</button>
        <button class="notif-sheet-tab" id="notifTabHistori" data-tab="histori">Histori</button>
      </div>
      <div class="notif-sheet-body" id="notifSheetBody">

        <div class="notif-tab-panel active" id="notifPanelInput">
          <div class="notif-form-photo-wrap">
            <div class="notif-form-photo" id="notifFormPhoto">
              <div class="notif-form-photo-placeholder">
                <i class="fa-solid fa-image"></i>
                <span>Tambah Foto (opsional)</span>
              </div>
            </div>
          </div>
          <div class="notif-form-group">
            <label class="notif-form-label">Judul</label>
            <input type="text" class="notif-form-input" id="notifFormJudul" placeholder="Judul notifikasi...">
          </div>
          <div class="notif-form-group">
            <label class="notif-form-label">Pesan</label>
            <textarea class="notif-form-textarea" id="notifFormPesan" rows="5" placeholder="Tulis pesan..."></textarea>
          </div>
          <button class="notif-form-send-btn" id="notifFormSendBtn" disabled>
            <i class="fa-solid fa-paper-plane"></i> Kirim ke Semua Staff
          </button>
        </div>

        <div class="notif-tab-panel" id="notifPanelHistori">
          <div class="notif-sheet-empty" id="notifHistoriEmpty" style="display:none">
            <i class="fa-regular fa-bell-slash"></i>
            <span>Belum ada notifikasi</span>
          </div>
          <div id="notifHistoriList"></div>
        </div>

      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", closeNotifSheet);
  document.getElementById("notifSheetCloseBtn")?.addEventListener("click", closeNotifSheet);
  document.getElementById("notifSelectCancelBtn")?.addEventListener("click", exitNotifSelectMode);
  document.getElementById("notifSelectDeleteBtn")?.addEventListener("click", () => {
    konfirmasiHapusNotif();
  });

  // Swipe kanan pada panel untuk menutup sheet — dioptimasi rAF
  const panel = document.getElementById("notifSheetPanel");
  let notifSwipeStartX = 0, notifSwipeStartY = 0, notifSwipeActive = false, notifSwipeLocked = false;
  let notifSwipeDx = 0, notifSwipeRaf = null;

  const notifApplyTransform = () => {
    notifSwipeRaf = null;
    panel.style.transform = notifSwipeDx > 0 ? `translate3d(${notifSwipeDx}px,0,0)` : "";
  };
  const notifQueueTransform = dx => {
    notifSwipeDx = dx;
    if (notifSwipeRaf === null) notifSwipeRaf = requestAnimationFrame(notifApplyTransform);
  };
  const notifCancelQueue = () => {
    if (notifSwipeRaf !== null) { cancelAnimationFrame(notifSwipeRaf); notifSwipeRaf = null; }
  };
  const notifFinishSwipe = dx => {
    notifCancelQueue();
    if (dx > 80) {
      panel.style.transition = "transform .25s ease-out";
      panel.style.transform  = "translate3d(100%,0,0)";
      setTimeout(() => closeNotifSheet(), 250);
    } else {
      panel.style.transition = "transform .2s ease-out";
      panel.style.transform  = "";
    }
  };

  panel.addEventListener("touchstart", e => {
    notifSwipeStartX = e.touches[0].clientX;
    notifSwipeStartY = e.touches[0].clientY;
    notifSwipeActive = true;
    notifSwipeLocked = false;
    panel.style.willChange = "transform";
  }, { passive: true });

  panel.addEventListener("touchmove", e => {
    if (!notifSwipeActive || notifSwipeLocked) return;
    const dx = e.touches[0].clientX - notifSwipeStartX;
    const dy = Math.abs(e.touches[0].clientY - notifSwipeStartY);

    if (dy > Math.abs(dx) && dy > 8) {
      notifSwipeLocked = true;
      notifCancelQueue();
      panel.style.transition = "";
      panel.style.transform  = "";
      return;
    }

    if (dx > 0) {
      e.preventDefault();
      panel.style.transition = "none";
      notifQueueTransform(dx);
    }
  }, { passive: false });

  panel.addEventListener("touchend", e => {
    if (!notifSwipeActive || notifSwipeLocked) { notifSwipeActive = false; return; }
    notifSwipeActive = false;
    const dx = e.changedTouches[0].clientX - notifSwipeStartX;
    notifFinishSwipe(dx);
  }, { passive: true });

  // Mouse — pola sama seperti touch
  panel.addEventListener("mousedown", e => {
    notifSwipeStartX = e.clientX;
    notifSwipeStartY = e.clientY;
    notifSwipeActive = true;
    notifSwipeLocked = false;
    panel.style.willChange = "transform";
    panel.style.transition = "none";

    const onMouseMove = e => {
      if (!notifSwipeActive || notifSwipeLocked) return;
      const dx = e.clientX - notifSwipeStartX;
      const dy = Math.abs(e.clientY - notifSwipeStartY);
      if (dy > Math.abs(dx) && dy > 8) {
        notifSwipeLocked = true;
        notifCancelQueue();
        panel.style.transform = "";
        return;
      }
      if (dx > 0) notifQueueTransform(dx);
    };
    const onMouseUp = e => {
      if (!notifSwipeActive) return;
      notifSwipeActive = false;
      const dx = e.clientX - notifSwipeStartX;
      if (!notifSwipeLocked) notifFinishSwipe(dx);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  document.querySelectorAll(".notif-sheet-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".notif-sheet-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".notif-tab-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab === "input" ? "notifPanelInput" : "notifPanelHistori";
      document.getElementById(target)?.classList.add("active");
      if (tab.dataset.tab === "histori") loadNotifHistori();
    });
  });

  window._notifFormData = { fotoFile: null, previewUrl: null };
  document.getElementById("notifFormPhoto")?.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.addEventListener("change", async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const photoEl = document.getElementById("notifFormPhoto");
      try {
        const compressed = await window.compressImage(file, { maxSize: 800, quality: 0.6 });
        if (window._notifFormData.previewUrl) {
          URL.revokeObjectURL(window._notifFormData.previewUrl);
        }
        const previewUrl = URL.createObjectURL(compressed);
        photoEl.innerHTML = `<img src="${previewUrl}" alt="foto">`;
        window._notifFormData.fotoFile   = compressed;
        window._notifFormData.previewUrl = previewUrl;
      } catch (err) {
        console.error("❌ compress foto notif:", err);
        window.showToast("Gagal memproses foto", "error");
      }
    });
    input.click();
  });

  const judulInput = document.getElementById("notifFormJudul");
  const pesanInput = document.getElementById("notifFormPesan");
  const sendBtn    = document.getElementById("notifFormSendBtn");
  const checkValid = () => {
    if (sendBtn) sendBtn.disabled = !(judulInput.value.trim() && pesanInput.value.trim());
  };
  judulInput?.addEventListener("input", checkValid);
  pesanInput?.addEventListener("input", checkValid);
  sendBtn?.addEventListener("click", kirimNotifikasi);
}
let _notifSelectMode = false;
let _notifSelectedIds = new Set();

function enterNotifSelectMode(firstId) {
  _notifSelectMode = true;
  _notifSelectedIds = new Set(firstId ? [firstId] : []);
  document.getElementById("notifSheetHeaderNormal")?.classList.add("hide");
  document.getElementById("notifSheetHeaderSelect")?.classList.add("show");
  document.getElementById("notifSheetBody")?.classList.add("select-mode");
  updateNotifSelectUI();
}
function exitNotifSelectMode() {
  _notifSelectMode = false;
  _notifSelectedIds = new Set();
  document.getElementById("notifSheetHeaderNormal")?.classList.remove("hide");
  document.getElementById("notifSheetHeaderSelect")?.classList.remove("show");
  document.getElementById("notifSheetBody")?.classList.remove("select-mode");
  document.querySelectorAll(".notif-histori-card.selected").forEach(c => c.classList.remove("selected"));
}
function toggleNotifSelect(id, cardEl) {
  if (_notifSelectedIds.has(id)) {
    _notifSelectedIds.delete(id);
    cardEl.classList.remove("selected");
  } else {
    _notifSelectedIds.add(id);
    cardEl.classList.add("selected");
  }
  if (_notifSelectedIds.size === 0) {
    exitNotifSelectMode();
  } else {
    updateNotifSelectUI();
  }
}
function updateNotifSelectUI() {
  const countEl  = document.getElementById("notifSelectCount");
  const deleteBtn = document.getElementById("notifSelectDeleteBtn");
  if (countEl) countEl.textContent = `${_notifSelectedIds.size} dipilih`;
  if (deleteBtn) deleteBtn.disabled = _notifSelectedIds.size === 0;
}
function attachNotifLongPress(card, id) {
  let timer = null;
  let longPressed = false;

  const start = () => {
    longPressed = false;
    timer = setTimeout(() => {
      longPressed = true;
      if (!_notifSelectMode) enterNotifSelectMode(id);
      else toggleNotifSelect(id, card);
      card.classList.add("selected");
    }, 500);
  };
  const cancel = () => clearTimeout(timer);
  const click = () => {
    if (longPressed) { longPressed = false; return; }
    if (_notifSelectMode) toggleNotifSelect(id, card);
  };

  card.addEventListener("touchstart", start, { passive: true });
  card.addEventListener("touchend", cancel);
  card.addEventListener("touchmove", cancel);
  card.addEventListener("mousedown", start);
  card.addEventListener("mouseup", cancel);
  card.addEventListener("mouseleave", cancel);
  card.addEventListener("click", click);
}
function konfirmasiHapusNotif() {
  const count = _notifSelectedIds.size;
  if (!count) return;
  const existing = document.getElementById("notifHapusOverlay");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = "notifHapusOverlay";
  el.className = "lap-frozen-overlay";
  el.style.zIndex = "10000";
  el.innerHTML = `
    <div class="lap-frozen-box" id="notifHapusBox">
      <div class="lap-frozen-icon">🗑️</div>
      <div class="lap-frozen-title">Hapus ${count} Notifikasi?</div>
      <div class="lap-frozen-desc">Notifikasi yang dihapus tidak bisa dikembalikan.</div>
      <div class="lap-frozen-footer">
        <button class="lap-frozen-btn-cancel" id="notifHapusNo">Batal</button>
        <button class="lap-frozen-btn-save" id="notifHapusYes" style="background:linear-gradient(135deg,#d05050,#e07070)">Hapus</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById("notifHapusNo").onclick = () => el.remove();
  document.getElementById("notifHapusYes").onclick = async () => {
    el.remove();
    await hapusNotifTerpilih();
  };

  // swipe kanan di area overlay/sheet untuk menutup popup
  const box = document.getElementById("notifHapusBox");
  let swipeStartX = 0, swipeStartY = 0, swipeActive = false, swipeLocked = false;

  el.addEventListener("touchstart", e => {
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
    swipeActive = true;
    swipeLocked = false;
  }, { passive: true });

  el.addEventListener("touchmove", e => {
    if (!swipeActive || swipeLocked) return;
    const dx = e.touches[0].clientX - swipeStartX;
    const dy = Math.abs(e.touches[0].clientY - swipeStartY);

    if (dy > Math.abs(dx) && dy > 8) {
      swipeLocked = true;
      box.style.transition = "";
      box.style.transform  = "";
      return;
    }

    if (dx > 0) {
      e.preventDefault();
      box.style.transition = "none";
      box.style.transform  = `translateX(${dx}px)`;
    }
  }, { passive: false });

  el.addEventListener("touchend", e => {
    if (!swipeActive || swipeLocked) return;
    swipeActive = false;
    const dx = e.changedTouches[0].clientX - swipeStartX;
    box.style.transition = "";
    if (dx > 80) {
      el.remove();
    } else {
      box.style.transform = "";
    }
  }, { passive: true });

  // Mouse — pola sama seperti touch, listener di overlay
  el.addEventListener("mousedown", e => {
    swipeStartX = e.clientX;
    swipeStartY = e.clientY;
    swipeActive = true;
    swipeLocked = false;
    box.style.transition = "none";

    const onMouseMove = e => {
      if (!swipeActive || swipeLocked) return;
      const dx = e.clientX - swipeStartX;
      const dy = Math.abs(e.clientY - swipeStartY);
      if (dy > Math.abs(dx) && dy > 8) {
        swipeLocked = true;
        box.style.transform = "";
        return;
      }
      if (dx > 0) box.style.transform = `translateX(${dx}px)`;
    };
    const onMouseUp = e => {
      if (!swipeActive) return;
      swipeActive = false;
      const dx = e.clientX - swipeStartX;
      box.style.transition = "";
      if (!swipeLocked && dx > 80) {
        el.remove();
      } else {
        box.style.transform = "";
      }
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}
async function hapusNotifTerpilih() {
  const btn = document.getElementById("notifSelectDeleteBtn");
  if (!_notifSelectedIds.size) return;

  const ids = [..._notifSelectedIds];
  if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`; }

  try {
    for (const id of ids) {
      await window.deleteDoc(window.doc(window.db, "notifikasi", id));
    }
    window.showToast(`${ids.length} notifikasi dihapus`, "success");
    exitNotifSelectMode();
    await loadNotifHistori();
  } catch (err) {
    console.error("❌ hapusNotifTerpilih:", err);
    window.showToast("Gagal menghapus notifikasi", "error");
    if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-trash"></i> Hapus`; }
  }
}

function escNotif(str) {
  return String(str ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
async function kirimNotifikasi() {
  const btn   = document.getElementById("notifFormSendBtn");
  const judul = document.getElementById("notifFormJudul")?.value?.trim();
  const pesan = document.getElementById("notifFormPesan")?.value?.trim();
  if (!judul || !pesan) return;

  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...`;

  try {
    const adminUid = window.auth?.currentUser?.uid;

    // upload foto sekarang, baru pas tombol kirim ditekan
    let fotoUrl = "";
    const fotoFile = window._notifFormData?.fotoFile;
    if (fotoFile) {
      const path = `notifikasi/${Date.now()}.jpg`;
      const ref  = window.storageRef(window.storage, path);
      await window.uploadBytes(ref, fotoFile);
      fotoUrl = await window.getDownloadURL(ref);
    }

    // ⚠️ ASUMSI: target notif = semua staff (kurir/hunter/sales) yang ada di usersCache
    // adminCabang ini, ditambah admin pengirim sendiri. Koreksi kalau target beda.
    const staffUids = (window.usersCache || [])
      .filter(u => ["kurir","hunter","sales"].includes(u.role))
      .map(u => u.uid);

    const dibaca = {};
    [...staffUids, adminUid].forEach(uid => { if (uid) dibaca[uid] = false; });

    await window.addDoc(window.collection(window.db, "notifikasi"), {
      judul,
      pesan,
      foto: fotoUrl,
      type: "kurir",
      createdBy: adminUid,
      createdAt: window.serverTimestamp(),
      dibaca,
    });

    window.showToast("Notifikasi terkirim", "success");
    resetNotifForm();
  } catch (err) {
    console.error("❌ kirimNotifikasi:", err);
    window.showToast("Gagal mengirim notifikasi", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Kirim ke Semua Staff`;
  }
}
function resetNotifForm() {
  const judulEl = document.getElementById("notifFormJudul");
  const pesanEl = document.getElementById("notifFormPesan");
  if (judulEl) judulEl.value = "";
  if (pesanEl) pesanEl.value = "";
  const photoEl = document.getElementById("notifFormPhoto");
  if (photoEl) photoEl.innerHTML = `
    <div class="notif-form-photo-placeholder">
      <i class="fa-solid fa-image"></i>
      <span>Tambah Foto (opsional)</span>
    </div>`;
  if (window._notifFormData?.previewUrl) {
    URL.revokeObjectURL(window._notifFormData.previewUrl);
  }
  window._notifFormData = { fotoFile: null, previewUrl: null };
  const sendBtn = document.getElementById("notifFormSendBtn");
  if (sendBtn) sendBtn.disabled = true;
}
async function loadNotifHistori() {
  const list  = document.getElementById("notifHistoriList");
  const empty = document.getElementById("notifHistoriEmpty");
  if (!list) return;
  list.innerHTML = `<div class="dh-ringkasan-empty">Memuat...</div>`;
  if (empty) empty.style.display = "none";

  try {
    const adminUid = window.auth?.currentUser?.uid;
    const snap = await window.getDocs(window.query(
      window.collection(window.db, "notifikasi"),
      window.where("createdBy", "==", adminUid),
      window.orderBy("createdAt", "desc")
    ));

    if (snap.empty) {
      list.innerHTML = "";
      if (empty) empty.style.display = "flex";
      return;
    }

    list.innerHTML = snap.docs.map(d => {
      const n         = d.data();
      const dibacaMap = n.dibaca || {};
      const total     = Object.keys(dibacaMap).length;
      const sudah     = Object.values(dibacaMap).filter(Boolean).length;
      const tanggal   = n.createdAt?.seconds
        ? new Date(n.createdAt.seconds * 1000).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
        : "-";
      return `
        <div class="notif-histori-card" data-id="${escNotif(d.id)}">
          <div class="notif-histori-check"><i class="fa-solid fa-check"></i></div>
          ${n.foto ? `<img src="${escNotif(n.foto)}" class="notif-histori-photo" alt="">` : ""}
          <div class="notif-histori-info">
            <div class="notif-histori-judul">${escNotif(n.judul || "-")}</div>
            <div class="notif-histori-pesan">${escNotif(n.pesan || "-")}</div>
            <div class="notif-histori-meta">
              <span>${escNotif(tanggal)}</span>
              <span class="notif-histori-dibaca">${sudah}/${total} dibaca</span>
            </div>
          </div>
        </div>`;
    }).join("");

    exitNotifSelectMode();
    list.querySelectorAll(".notif-histori-card").forEach(card => {
      attachNotifLongPress(card, card.dataset.id);
    });
  } catch (err) {
    console.error("❌ loadNotifHistori:", err);
    list.innerHTML = `<div class="dh-ringkasan-empty">Gagal memuat data</div>`;
  }
}
function openNotifSheet() {
  ensureNotifSheetDOM();
  const overlay = document.getElementById("notifSheetOverlay");
  requestAnimationFrame(() => overlay?.classList.add("show"));
}
function closeNotifSheet() {
  document.getElementById("notifSheetOverlay")?.classList.remove("show");
  const panel = document.getElementById("notifSheetPanel");
  if (panel) {
    setTimeout(() => {
      panel.style.transition = "";
      panel.style.transform  = "";
    }, 300);
  }
}
window.openNotifSheet  = openNotifSheet;
window.closeNotifSheet = closeNotifSheet;