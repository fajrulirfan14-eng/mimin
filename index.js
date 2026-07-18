import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, collection, query, where,
  getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, deleteField,
  collectionGroup, orderBy, limit, Timestamp, writeBatch,
  arrayUnion, arrayRemove, runTransaction
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
window.initializeApp                 = initializeApp;
window.deleteApp                     = deleteApp;
window.getAuth                       = getAuth;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signOut                       = signOut;
window.firebaseConfig                = firebaseConfig;
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
window.writeBatch = writeBatch;
window.deleteField     = deleteField;
window.arrayUnion      = arrayUnion;
window.arrayRemove     = arrayRemove;
window.runTransaction  = runTransaction;
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
  amplop:       "Amplop",
  rekapdistribusi: "Rekap Distribusi",
  rekapproduksi: "Rekap Produksi",
  akun:         "Akun",
  profil: "Profil"
};

// views yang tampilkan topbar reload
const RELOAD_VIEWS = ["dataharian", "customer", "dsm", "laporan", "customerbaru"];

/* ── STATE ── */
let currentView = "home";
let _inited     = {};
let unlockedPages = {};
const PAGE_PASSWORD_VIEWS = ["rekapdistribusi", "rekapproduksi"];
const PAGE_PASSWORD_COOLDOWN_MS = 15 * 60 * 1000;
function isPageUnlocked(viewName) {
  const unlockedAt = unlockedPages[viewName];
  if (!unlockedAt) return false;
  return (Date.now() - unlockedAt) < PAGE_PASSWORD_COOLDOWN_MS;
}
window.requestView = function(viewName) {
  if (PAGE_PASSWORD_VIEWS.includes(viewName) && !isPageUnlocked(viewName)) {
    openPagePasswordPopup(viewName);
    return;
  }
  showView(viewName);
};
function openPagePasswordPopup(viewName) {
  const overlay = document.getElementById("pagePasswordOverlay");
  const input   = document.getElementById("pagePasswordInput");
  const errEl   = document.getElementById("pagePasswordError");
  if (!overlay || !input) return;
  input.value = "";
  if (errEl) errEl.style.display = "none";
  overlay.dataset.targetView = viewName;
  overlay.classList.add("show");
  setTimeout(() => input.focus(), 100);
}
function closePagePasswordPopup() {
  document.getElementById("pagePasswordOverlay")?.classList.remove("show");
}
async function verifyPagePassword() {
  const overlay    = document.getElementById("pagePasswordOverlay");
  const input      = document.getElementById("pagePasswordInput");
  const errEl      = document.getElementById("pagePasswordError");
  const targetView = overlay?.dataset.targetView;
  if (!targetView) return;

  let kantor = null;
  try { kantor = await window.idb.getKantorCabang(); } catch (err) { console.error("❌ getKantorCabang:", err); }
  const savedPass = kantor?.pagePassword || "";

  if (!savedPass) {
    unlockedPages[targetView] = Date.now();
    closePagePasswordPopup();
    showView(targetView);
    return;
  }

  const inputHashed = await hashPassword(input.value);

  if (inputHashed === savedPass) {
    unlockedPages[targetView] = Date.now();
    closePagePasswordPopup();
    showView(targetView);
  } else {
    if (errEl) errEl.style.display = "block";
    input.value = "";
    input.focus();
  }
}
function initPagePasswordPopup() {
  const overlay = document.getElementById("pagePasswordOverlay");
  overlay?.addEventListener("click", e => {
    if (e.target === overlay) closePagePasswordPopup();
  });
  document.getElementById("pagePasswordCancelBtn")?.addEventListener("click", closePagePasswordPopup);
  document.getElementById("pagePasswordSubmitBtn")?.addEventListener("click", verifyPagePassword);
  document.getElementById("pagePasswordInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter") verifyPagePassword();
  });
}

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

function initApp() {
  setTopbarAvatar();
  initSidebar();
  initTopbar();
  initBottomNav();
  initPagePasswordPopup();
  const last = localStorage.getItem("lastView") || "home";
  showView(last);
  requestAnimationFrame(() => {
    document.getElementById("app").style.visibility = "visible";
  });
}
window.showView = function(viewName) {
  if (!document.getElementById(`view-${viewName}`)) viewName = "home";
  if (currentView === "amplop") window.onAmplopViewHide?.();
  currentView = viewName;
  if (viewName === "amplop" && _inited.amplop) {
    window.loadAmplopList?.();
  }
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(`view-${viewName}`)?.classList.add("active");
  const tambahBtn = document.getElementById("topbarTambahCustomer");
  const purchaseBtn = document.getElementById("topbarPurchase");
  if (purchaseBtn) purchaseBtn.style.display = viewName === "customer" ? "none" : "flex";
  if (tambahBtn) tambahBtn.style.display = viewName === "customer" ? "flex" : "none";
  document.querySelectorAll(".nav-item, .bottom-nav-item").forEach(n => {
    n.classList.toggle("active", n.dataset.view === viewName);
  });

  const titleEl = document.getElementById("topbarTitle");
  if (titleEl) titleEl.textContent = VIEW_TITLES[viewName] || viewName;
  const tabelBtn = document.getElementById("topbarTabel");
  if (tabelBtn) tabelBtn.style.display = viewName === "dataharian" ? "flex" : "none";
  const lapTabelBtn = document.getElementById("lapTopbarTabel");
  if (lapTabelBtn) lapTabelBtn.style.display = viewName === "laporan" ? "flex" : "none";
  const backBtn = document.getElementById("topbarBackBtn");
  if (backBtn) backBtn.style.display = "none";
  localStorage.setItem("lastView", viewName);
  if (window.innerWidth <= 768) closeSidebar();
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
    case "amplop":
      _inited.amplop = true;
      window.initAmplopView?.();
      break;
    case "rekapdistribusi":
      _inited.rekapdistribusi = true;
      window.initRekapDistribusiView?.();
      break;
    case "rekapproduksi":
      _inited.rekapproduksi = true;
      window.initRekapProduksiView?.();
      break;
    case "akun":
      _inited.akun = true;
      window.initAkunView?.();
      break;
    case "profil":
      _inited.profil = true;
      window.initProfilView?.();
      break;
  }
}

/* ── SIDEBAR ── */
function initSidebar() {
  const hamburger = document.getElementById("hamburger");
  const overlay   = document.getElementById("sidebarOverlay");

  hamburger?.addEventListener("click", toggleSidebar);
  overlay?.addEventListener("click", closeSidebar);
  document.querySelectorAll(".nav-item[data-view], .bottom-nav-item[data-view]").forEach(item => {
    item.addEventListener("click", () => {
      const view = item.dataset.view;
      if (view) requestView(view);
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
/* ── BOTTOM NAV ── */
function initBottomNav() {
  document.querySelectorAll(".bottom-nav-item[data-view]").forEach(item => {
    item.addEventListener("click", () => {
      const view = item.dataset.view;
      if (view) showView(view);
    });
  });

  initBottomNavMore();
}
function initBottomNavMore() {
  const moreBtn = document.getElementById("bottomNavMoreBtn");
  const sheet   = document.getElementById("bottomNavMoreSheet");
  const handle  = sheet?.querySelector(".bottom-nav-more-handle");
  if (!moreBtn || !sheet) return;

  const openSheet  = () => {
    sheet.classList.add("show");
    sheet.style.transform = "";
  };
  const closeSheet = () => {
    sheet.classList.remove("show");
    sheet.style.transform = "";
    const icon = moreBtn.querySelector("i");
    if (icon) icon.className = "fa-solid fa-ellipsis";
  };

  const moreIcon = moreBtn.querySelector("i");
  moreBtn.addEventListener("click", e => {
    e.stopPropagation();
    if (sheet.classList.contains("show")) {
      closeSheet();
      moreIcon.className = "fa-solid fa-ellipsis";
    } else {
      openSheet();
      moreIcon.className = "fa-solid fa-xmark";
    }
  });
  document.addEventListener("click", e => {
    if (sheet.classList.contains("show") && !e.target.closest("#bottomNavMoreSheet") && !e.target.closest("#bottomNavMoreBtn")) {
      closeSheet();
    }
  });

  document.querySelectorAll(".bottom-nav-more-item").forEach(item => {
    item.addEventListener("click", () => {
      const view = item.dataset.view;
      closeSheet();
      if (view) requestView(view);
    });
  });

  // ── SWIPE DOWN TO CLOSE ──
  let startY = 0;
  let currentY = 0;
  let dragging = false;

  const onTouchStart = e => {
    startY = e.touches[0].clientY;
    currentY = startY;
    dragging = true;
    sheet.style.transition = "none";
  };

  const onTouchMove = e => {
    if (!dragging) return;
    currentY = e.touches[0].clientY;
    const delta = currentY - startY;
    if (delta > 0) {
      sheet.style.transform = `translateY(${delta}px)`;
      e.preventDefault();
    }
  };

  const onTouchEnd = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = "";
    const delta = currentY - startY;
    const threshold = sheet.getBoundingClientRect().height * 0.25;

    if (delta > threshold) {
      closeSheet();
    } else {
      sheet.style.transform = "";
    }
  };

  handle?.addEventListener("touchstart", onTouchStart, { passive: true });
  handle?.addEventListener("touchmove", onTouchMove, { passive: false });
  handle?.addEventListener("touchend", onTouchEnd);

  sheet.addEventListener("touchstart", onTouchStart, { passive: true });
  sheet.addEventListener("touchmove", onTouchMove, { passive: false });
  sheet.addEventListener("touchend", onTouchEnd);
}

/* ── TOPBAR ── */
function initTopbar() {
  initPurchaseSheet();
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
    openNotifSheet();
  });
  // avatar
  document.getElementById("topbarAvatar")?.addEventListener("click", () => {
    showView("profil");
  });
}
function initPurchaseSheet() {
  const btn     = document.getElementById("topbarPurchase");
  const overlay = document.getElementById("purchaseOverlay");
  const sheet   = document.getElementById("purchaseSheet");
  const closeBtn = document.getElementById("purchaseSheetClose");
  const handle  = sheet?.querySelector(".purchase-sheet-handle");
  if (!btn || !overlay || !sheet) return;

  const openSheet = () => {
    overlay.classList.add("show");
    sheet.classList.add("show");
    sheet.style.transform = "";
    window.initPurchaseForm?.();
  };
  const closeSheet = () => {
    overlay.classList.remove("show");
    sheet.classList.remove("show");
    sheet.style.transform = "";
  };

  btn.addEventListener("click", e => { e.stopPropagation(); openSheet(); });
  closeBtn?.addEventListener("click", closeSheet);
  overlay.addEventListener("click", closeSheet);

  // swipe down to close (mobile) — tidak boleh kepicu kalau area body sedang discroll
  let startY = 0, currentY = 0, dragging = false, allowDrag = false;
  const bodyEl = sheet.querySelector(".purchase-sheet-body");

  const onTouchStart = e => {
    const target = e.target;
    const isFromBody = bodyEl?.contains(target);
    allowDrag = !isFromBody || (bodyEl && bodyEl.scrollTop <= 0);
    if (!allowDrag) return;
    startY = e.touches[0].clientY;
    currentY = startY;
    dragging = true;
    sheet.style.transition = "none";
  };
  const onTouchMove = e => {
    if (!dragging || !allowDrag) return;
    currentY = e.touches[0].clientY;
    const delta = currentY - startY;
    if (delta > 0) {
      sheet.style.transform = `translateY(${delta}px)`;
      e.preventDefault();
    }
  };
  const onTouchEnd = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = "";
    const delta = currentY - startY;
    const threshold = sheet.getBoundingClientRect().height * 0.25;
    if (allowDrag && delta > threshold) closeSheet();
    else sheet.style.transform = "";
  };

  handle?.addEventListener("touchstart", onTouchStart, { passive: true });
  handle?.addEventListener("touchmove", onTouchMove, { passive: false });
  handle?.addEventListener("touchend", onTouchEnd);

  sheet.addEventListener("touchstart", onTouchStart, { passive: true });
  sheet.addEventListener("touchmove", onTouchMove, { passive: false });
  sheet.addEventListener("touchend", onTouchEnd);
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

/* ── ANDROID BACK BUTTON HANDLER ── */
(function initBackButtonHandler() {
  // push state awal
  history.pushState({ view: "home" }, "", "");

  // setiap buka view, push state
  const originalShowView = window.showView;
  window.showView = function(viewName) {
    originalShowView(viewName);
    if (viewName !== "home") {
      history.pushState({ view: viewName }, "", "");
    }
  };

  window.addEventListener("popstate", () => {
    // 1. Cek popup/overlay yang terbuka — tutup dulu
    const popups = [
      // amplop konfirmasi
      document.getElementById("amplopKonfirmasiOverlay"),
      // hari libur
      document.getElementById("hariLiburOverlay"),
      // amplop detail
      document.getElementById("amplopDetailOverlay"),
      // stock opname popup
      document.getElementById("soPopupMainOverlay"),
      document.getElementById("soPopupPlusOverlay"),
      // akun tambah
      document.getElementById("akunTambahOverlay"),
      // dsm foto/fee popup
      document.getElementById("dsmFeeOverlay"),
      // akun konfirmasi
      document.getElementById("akunKonfirmasiOverlay"),
      // amplop range
      document.getElementById("amplopRangeOverlay"),
    ];

    for (const popup of popups) {
      if (popup && (popup.style.display === "flex" || popup.style.display === "block" || popup.classList.contains("show"))) {
        popup.style.display = "none";
        popup.classList.remove("show");
        history.pushState({ view: currentView }, "", "");
        return;
      }
    }

    // 2. Cek panel detail yang terbuka — tutup panel
    const panels = [
      // rekap distribusi panels
      { wrapper: document.getElementById("rekapDistribusiDetailWrapper"), back: document.getElementById("rekapDistribusiBackBtn") },
      { wrapper: document.getElementById("assetsDetailWrapper"), back: document.getElementById("assetsBackBtn") },
      { wrapper: document.getElementById("slipGajiDetailWrapper"), back: document.getElementById("slipGajiToRekapBackBtn") },
      { wrapper: document.getElementById("rincianPemasukanDetailWrapper"), back: document.getElementById("rincianPemasukanBackBtn") },
      // rekap produksi: sub-panel detail (harus dicek SEBELUM wrapper induk)
      { wrapper: document.getElementById("rincianProduksiDetailWrapper"), back: document.getElementById("rincianProduksiBackBtn"), listRestore: window.showRekapProdListMobile },
      { wrapper: document.getElementById("ekuitasProduksiDetailWrapper"), back: document.getElementById("ekuitasProduksiBackBtn"), listRestore: window.showRekapProdListMobile },
      { wrapper: document.getElementById("slipgajiProduksiDetailWrapper"), back: document.getElementById("slipgajiProduksiBackBtn"), listRestore: window.showRekapProdListMobile },
      { wrapper: document.getElementById("assetProduksiDetailWrapper"), back: document.getElementById("assetProduksiBackBtn"), listRestore: window.showRekapProdListMobile },
      { wrapper: document.getElementById("neracaProduksiDetailWrapper"), back: document.getElementById("neracaProduksiBackBtn"), listRestore: window.showRekapProdListMobile },
      { wrapper: document.getElementById("pembelianProduksiDetailWrapper"), back: document.getElementById("pembelianProduksiBackBtn"), listRestore: window.showRekapProdListMobile },
      { wrapper: document.getElementById("auditProduksiDetailWrapper"), back: document.getElementById("auditProduksiBackBtn"), listRestore: window.showRekapProdListMobile },
      // rekap produksi panel induk
      { wrapper: document.getElementById("rekapProduksiDetailWrapper"), back: document.getElementById("rekapProduksiBackBtn"), listRestore: window.showRekapProdListMobile },
      // akun panel kanan (mobile)
      { wrapper: document.getElementById("akunPanelRight"), back: document.getElementById("akunBackBtn") },
      // laporan detail
      { wrapper: document.getElementById("lapDetailWrapper"), back: document.getElementById("lapDetailBackBtn") },
      // data harian detail
      { wrapper: document.getElementById("dhDetailWrapper"), back: document.getElementById("dhDetailBackBtn") },
      // customer panels (right dulu, baru middle)
      { wrapper: document.getElementById("custRightPanel"), back: document.getElementById("custRightBack") },
      { wrapper: document.getElementById("custMiddlePanel"), back: document.getElementById("topbarBackBtn") },
    ];

    for (const panel of panels) {
      const isShowing = panel.wrapper && (
        panel.wrapper.classList.contains("show") ||
        panel.wrapper.style.display === "flex"
      );
      if (isShowing) {
        panel.wrapper.classList.remove("show");
        panel.wrapper.style.removeProperty("display");
        if (panel.back) panel.back.style.display = "none";
        panel.listRestore?.();
        history.pushState({ view: currentView }, "", "");
        return;
      }
    }

    // 3. Cek bottom sheet / overlay yang punya class .show
    const overlays = document.querySelectorAll(".amplop-detail-overlay.show, .so-popup-overlay.show");
    for (const overlay of overlays) {
      overlay.classList.remove("show");
      overlay.style.display = "none";
      history.pushState({ view: currentView }, "", "");
      return;
    }

    // 4. Kalau tidak ada panel/popup terbuka — kembali ke Home
    if (currentView !== "home") {
      window.showView("home");
      history.pushState({ view: "home" }, "", "");
    }
  });
})();

/* ── VISIBILITY CHANGE REFRESH ── */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    const last = Number(sessionStorage.getItem("lastActiveAt") || 0);
    if (Date.now() - last > 10 * 60 * 1000) window.location.reload();
  } else {
    sessionStorage.setItem("lastActiveAt", Date.now());
  }
});

async function hashPassword(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
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

/* ── DARK MODE ── */
function initDarkMode() {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") document.documentElement.setAttribute("data-theme", "dark");

  window.toggleDarkMode = function() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    }
  };
}
initDarkMode();
