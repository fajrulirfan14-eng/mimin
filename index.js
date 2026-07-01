import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, collection, query, where,
  getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, deleteField,
  collectionGroup, orderBy, limit, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref as storageRef,
  uploadBytes, uploadBytesResumable,
  getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/* ── FIREBASE CONFIG ── */
const firebaseConfig = {
  apiKey: "AIzaSyCp32H2WeN3A4ZwwWeUWe3Qcjqh0mz_vvQ",
  authDomain: "teh-tarik-nusantara-26371.firebaseapp.com",
  projectId: "teh-tarik-nusantara-26371",
  storageBucket: "teh-tarik-nusantara-26371.firebasestorage.app",
  messagingSenderId: "354760960352",
  appId: "1:354760960352:web:7d6a6c07dace937a74d605"
};

const app     = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

/* ── GLOBALS ── */
window.auth            = auth;
window.db              = db;
window.storage         = storage;
window.doc             = doc;
window.getDoc          = getDoc;
window.collection      = collection;
window.collectionGroup = collectionGroup;
window.query           = query;
window.where           = where;
window.orderBy         = orderBy;
window.limit           = limit;
window.getDocs         = getDocs;
window.addDoc          = addDoc;
window.setDoc          = setDoc;
window.updateDoc       = updateDoc;
window.deleteDoc       = deleteDoc;
window.onSnapshot      = onSnapshot;
window.serverTimestamp = serverTimestamp;
window.Timestamp = Timestamp;
window.deleteField     = deleteField;
window.storageRef      = storageRef;
window.uploadBytes     = uploadBytes;
window.uploadBytesResumable = uploadBytesResumable;
window.getDownloadURL  = getDownloadURL;
window.deleteObject    = deleteObject;
window.currentUser     = null;

/* ── VIEW CONFIG ── */
const VIEW_TITLES = {
  home:         "Dashboard",
  dataharian:   "Data Harian",
  customer:     "Customer",
  dsm:          "DSM",
  laporan:      "Laporan",
  customerbaru: "Customer Baru",
  akun:         "Akun"
};

// views yang tampilkan topbar reload
const RELOAD_VIEWS = ["dataharian", "customer", "dsm", "laporan", "customerbaru"];

/* ── STATE ── */
let currentView = "home";
let _inited     = {};

/* ── AUTH ── */
onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = "login.html"; return; }
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) { window.location.href = "login.html"; return; }
    const data = snap.data();
    if (data.role !== "adminCabang") { window.location.href = "login.html"; return; }
    window.currentUser = { uid: user.uid, email: user.email, ...data };
    localStorage.setItem("userCache", JSON.stringify(window.currentUser));
  } catch {
    const cache = localStorage.getItem("userCache");
    if (cache) window.currentUser = JSON.parse(cache);
    else { window.location.href = "login.html"; return; }
  }

  initApp();
});

/* ── INIT APP ── */
function initApp() {
  setTopbarAvatar();
  initSidebar();
  initTopbar();
  initBottomNav();

  // restore last view
  const last = localStorage.getItem("lastView") || "home";
  showView(last);

  // show app
  requestAnimationFrame(() => {
    document.getElementById("app").style.visibility = "visible";
  });
}

/* ── SHOW VIEW ── */
window.showView = function(viewName) {
  if (!document.getElementById(`view-${viewName}`)) viewName = "home";
  currentView = viewName;

  // switch view
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(`view-${viewName}`)?.classList.add("active");
  const tambahBtn = document.getElementById("topbarTambahCustomer");
  if (tambahBtn) tambahBtn.style.display = viewName === "customer" ? "flex" : "none";

  // update nav active
  document.querySelectorAll(".nav-item, .bottom-nav-item").forEach(n => {
    n.classList.toggle("active", n.dataset.view === viewName);
  });

  // topbar title
  const titleEl = document.getElementById("topbarTitle");
  if (titleEl) titleEl.textContent = VIEW_TITLES[viewName] || viewName;

  // reload btn
  const reloadBtn = document.getElementById("topbarReload");
  if (reloadBtn) reloadBtn.style.display = ["home"].includes(viewName) ? "flex" : "none";
  
  // tabel btn
  const tabelBtn = document.getElementById("topbarTabel");
  if (tabelBtn) tabelBtn.style.display = viewName === "dataharian" ? "flex" : "none";
  const lapTabelBtn = document.getElementById("lapTopbarTabel");
  if (lapTabelBtn) lapTabelBtn.style.display = viewName === "laporan" ? "flex" : "none";
  // back btn — reset
  const backBtn = document.getElementById("topbarBackBtn");
  if (backBtn) backBtn.style.display = "none";

  // save
  localStorage.setItem("lastView", viewName);

  // mobile: tutup sidebar
  if (window.innerWidth <= 768) closeSidebar();

  // lazy init view
  lazyInitView(viewName);
};

function lazyInitView(viewName) {
  if (_inited[viewName]) return;

  switch (viewName) {
    case "home":
      _inited.home = true;
      window.initHomeView?.();
      break;
    case "dataharian":
      _inited.dataharian = true;
      window.initDataharianView?.();
      break;
    case "customer":
      _inited.customer = true;
      window.initCustomerView?.();
      break;
    case "dsm":
      _inited.dsm = true;
      window.initDsmView?.();
      break;
    case "stockopname":
      _inited.stockopname = true;
      window.initStockOpnameView?.();
      break;
    case "pengeluaran":
      _inited.pengeluaran = true;
      window.initPengeluaranView?.();
      break;
    case "laporan":
      _inited.laporan = true;
      window.initLaporanView?.();
      break;
    case "customerbaru":
      _inited.customerbaru = true;
      window.initCustomerBaruView?.();
      break;
    case "akun":
      _inited.akun = true;
      window.initAkunView?.();
      break;
  }
}

/* ── SIDEBAR ── */
function initSidebar() {
  const hamburger = document.getElementById("hamburger");
  const overlay   = document.getElementById("sidebarOverlay");

  hamburger?.addEventListener("click", toggleSidebar);
  overlay?.addEventListener("click", closeSidebar);
  document.querySelectorAll(".nav-item, .bottom-nav-item").forEach(item => {
    item.addEventListener("click", () => {
      const view = item.dataset.view;
      if (view) showView(view);
    });
  });

  // desktop: restore state
  if (window.innerWidth >= 769) {
    const wasOpen = localStorage.getItem("sidebarOpen") === "true";
    if (wasOpen) {
      document.getElementById("sidebar")?.classList.add("open");
      hamburger?.classList.add("open");
    }
  }
}

function toggleSidebar() {
  const sidebar   = document.getElementById("sidebar");
  const hamburger = document.getElementById("hamburger");
  const overlay   = document.getElementById("sidebarOverlay");
  if (!sidebar) return;
  const isOpen = sidebar.classList.toggle("open");
  hamburger?.classList.toggle("open", isOpen);
  if (window.innerWidth <= 768) {
    overlay?.classList.toggle("show", isOpen);
  }
  localStorage.setItem("sidebarOpen", isOpen);
}

function closeSidebar() {
  const sidebar   = document.getElementById("sidebar");
  const hamburger = document.getElementById("hamburger");
  const overlay   = document.getElementById("sidebarOverlay");
  sidebar?.classList.remove("open");
  hamburger?.classList.remove("open");
  overlay?.classList.remove("show");
  localStorage.setItem("sidebarOpen", "false");
}

/* ── TOPBAR ── */
function initTopbar() {
  // reload
  document.getElementById("topbarReload")?.addEventListener("click", () => {
    switch (currentView) {
      case "dataharian":   window.onDataharianReload?.();   break;
      case "customer":     window.onCustomerReload?.();     break;
      case "dsm":          window.onDsmReload?.();          break;
      case "laporan":      window.onLaporanReload?.();      break;
      case "customerbaru": window.onCustomerBaruReload?.(); break;
    }
  });
  document.getElementById("lapTopbarTabel")?.addEventListener("click", () => {
    const wrapper = document.getElementById("lapTabelWrapper");
    if (!wrapper) return;
    const isShow = wrapper.classList.toggle("show");
    const bottomNav = document.getElementById("bottomNav");
    if (bottomNav) bottomNav.style.display = isShow ? "none" : "";
    if (isShow) window.initLapTabel?.();
  });
  document.getElementById("topbarTabel")?.addEventListener("click", () => {
    const wrapper = document.getElementById("dhTabelWrapper");
    if (!wrapper) return;
    const isShow = wrapper.classList.toggle("show");
    const bottomNav = document.getElementById("bottomNav");
    if (bottomNav) bottomNav.style.display = isShow ? "none" : "";
    if (isShow) window.initTabelRekap?.();
  });
  document.getElementById("topbarMap")?.addEventListener("click", () => {
    window.openPetaGlobal?.();
  });
  document.getElementById("topbarRumus")?.addEventListener("click", () => {
    window.openRumusPanel?.();
  });
  // notif
  document.getElementById("topbarNotif")?.addEventListener("click", () => {
    showToast("Notifikasi coming soon", "");
  });

  // avatar
  document.getElementById("topbarAvatar")?.addEventListener("click", () => {
    showView("akun");
  });
}

/* ── BOTTOM NAV ── */
function initBottomNav() {
  document.querySelectorAll(".bottom-nav-item").forEach(item => {
    item.addEventListener("click", () => {
      const view = item.dataset.view;
      if (view) showView(view);
    });
  });
}

/* ── TOPBAR AVATAR ── */
function setTopbarAvatar() {
  const user    = window.currentUser;
  const avatarEl = document.getElementById("topbarAvatar");
  if (!avatarEl || !user) return;
  if (user.foto) {
    avatarEl.innerHTML = `<img src="${user.foto}" alt="foto">`;
  } else {
    avatarEl.textContent = (user.nama || user.email || "A")[0].toUpperCase();
  }
}

/* ── RUMUS PANEL ── */
function openRumusPanel() {
  document.getElementById("rumusOverlay")?.classList.add("show");
  document.getElementById("rumusPanel")?.classList.add("show");

  const tanggalInput = document.getElementById("rumusTanggal");
  if (tanggalInput && !tanggalInput.value) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    tanggalInput.value = `${yyyy}-${mm}-${dd}`;
  }
}
function closeRumusPanel() {
  document.getElementById("rumusOverlay")?.classList.remove("show");
  document.getElementById("rumusPanel")?.classList.remove("show");
}
window.openRumusPanel = openRumusPanel;
window.closeRumusPanel = closeRumusPanel;
document.getElementById("rumusPanelClose")?.addEventListener("click", closeRumusPanel);
document.getElementById("rumusOverlay")?.addEventListener("click", closeRumusPanel);
document.getElementById("rumusTanggal")?.addEventListener("change", (e) => {
  window.onRumusTanggalChange?.(e.target.value); // hook buat trigger query nanti
});
document.getElementById("rumusSaveBtn")?.addEventListener("click", () => {
  window.onRumusSimpan?.(document.getElementById("rumusTanggal")?.value); // hook buat simpan nanti
});

/* ── SWIPE TO CLOSE ── */
(function initRumusSwipe() {
  const panel = document.getElementById("rumusPanel");
  if (!panel) return;

  let startX = 0, startY = 0;
  let deltaX = 0, deltaY = 0;
  let dragging = false;
  let isDesktop = window.matchMedia("(min-width: 769px)").matches;

  window.addEventListener("resize", () => {
    isDesktop = window.matchMedia("(min-width: 769px)").matches;
  });

  panel.addEventListener("pointerdown", (e) => {
    // hindari drag kalau mulai dari area yang bisa discroll teksnya, kecuali handle/header
    const isHandle = e.target.closest(".rumus-panel-handle, .rumus-panel-header");
    if (!isHandle && !isDesktop) return; // di mobile, batasi drag mulai dari handle/header
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    deltaX = 0;
    deltaY = 0;
    panel.style.transition = "none";
    panel.setPointerCapture?.(e.pointerId);
  });

  panel.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    deltaX = e.clientX - startX;
    deltaY = e.clientY - startY;

    if (isDesktop) {
      // hanya boleh geser ke kanan (menutup)
      const move = Math.max(0, deltaX);
      panel.style.transform = `translateX(${move}px)`;
    } else {
      // hanya boleh geser ke bawah (menutup)
      const move = Math.max(0, deltaY);
      panel.style.transform = `translateY(${move}px)`;
    }
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    panel.style.transition = "";
    panel.style.transform = "";

    const threshold = isDesktop ? 120 : 100;
    const moved = isDesktop ? deltaX : deltaY;

    if (moved > threshold) {
      closeRumusPanel();
    }
    deltaX = 0;
    deltaY = 0;
  }

  panel.addEventListener("pointerup", endDrag);
  panel.addEventListener("pointercancel", endDrag);
})();

/* ── TOAST ── */
let _toastTimer = null;
window.showToast = function(msg, type = "", duration = 2800) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className   = `toast ${type}`;
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), duration);
};

/* ── VISIBILITY CHANGE ── */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    const last = Number(sessionStorage.getItem("lastActiveAt") || 0);
    if (Date.now() - last > 10 * 60 * 1000) window.location.reload();
  } else {
    sessionStorage.setItem("lastActiveAt", Date.now());
  }
});

/* ── COMPRESS IMAGE ── */
window.compressImage = function(blob, maxWidth = 1280, quality = 0.78) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob(b => resolve(b), "image/jpeg", quality);
    };
    img.src = url;
  });
};
