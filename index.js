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
  amplop:       "Amplop",
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
  // cleanup view lama sebelum ganti
  if (currentView === "amplop") window.onAmplopViewHide?.();
  currentView = viewName;
  // restart listener kalau balik ke amplop
  if (viewName === "amplop" && _inited.amplop) {
    window.loadAmplopList?.();
  }
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
    case "amplop":
      _inited.amplop = true;
      window.initAmplopView?.();
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
let rumusUnsubscribe = null;
let rumusPengeluaranUnsubscribe = null;
let rumusSetoranUnsubscribe = null;
let rumusLaporanData = null;
let rumusPengeluaranData = null;

function formatRupiah(num) {
  return "Rp " + (num || 0).toLocaleString("id-ID");
}
window.formatRupiah = formatRupiah;
function buildDistribusiPayload() {
  const omset = [];
  const lainnya = [];
  let totalOmset = 0, totalLainnya = 0, totalPengeluaran = 0;

  if (rumusLaporanData) {
    Object.keys(rumusLaporanData).forEach((key) => {
      if (key === "tanggal" || key === "createdBy") return;
      const kurir = rumusLaporanData[key];
      const keuangan = kurir?.distribusi?.keuangan;
      if (!keuangan) return;

      const nilaiOmset = keuangan.grossMargin || 0;
      const bonusPay = keuangan.bonus?.bonusPay || 0;
      const klaimInsentif = keuangan.klaimInsentif || 0;
      const kasbon = keuangan.kasbon || 0;
      const totalKurirLainnya = bonusPay + klaimInsentif + kasbon;

      omset.push({ uid: key, nama: kurir?.nama || "", nilai: nilaiOmset });
      lainnya.push({
        uid: key,
        nama: kurir?.nama || "",
        bonusPay,
        klaimInsentif,
        kasbon,
        total: totalKurirLainnya
      });

      totalOmset += nilaiOmset;
      totalLainnya += totalKurirLainnya;
    });
  }

  const pengeluaran = (rumusPengeluaranData?.distribusi || []).map((item) => ({
    nama: item.nama || "",
    qty: item.qty || 0,
    nominal: item.nominal || 0
  }));
  totalPengeluaran = pengeluaran.reduce((sum, item) => sum + (item.nominal || 0), 0);

  return {
    omset,
    lainnya,
    pengeluaranDistribusi: { pengeluaran },
    amplop: totalOmset - totalLainnya - totalPengeluaran
  };
}
function buildProduksiPayload() {
  const omset = [];
  let totalOmset = 0, totalPengeluaran = 0;

  if (rumusLaporanData) {
    Object.keys(rumusLaporanData).forEach((key) => {
      if (key === "tanggal" || key === "createdBy") return;
      const kurir = rumusLaporanData[key];
      const nilaiOmset = kurir?.pembayaran?.nota?.bayar || 0;

      omset.push({ uid: key, nama: kurir?.nama || "", nilai: nilaiOmset });
      totalOmset += nilaiOmset;
    });
  }

  const pengeluaran = (rumusPengeluaranData?.produksi || []).map((item) => ({
    nama: item.nama || "",
    qty: item.qty || 0,
    nominal: item.nominal || 0
  }));
  totalPengeluaran = pengeluaran.reduce((sum, item) => sum + (item.nominal || 0), 0);

  return {
    omset,
    lainnya: [],
    pengeluaranProduksi: { pengeluaran },
    amplop: totalOmset - totalPengeluaran
  };
}
async function simpanSetoranAmplop() {
  const tanggal = document.getElementById("rumusTanggal")?.value;
  const catatan = document.getElementById("rumusCatatan")?.value || "";
  const btn = document.getElementById("rumusSaveBtn");

  if (!tanggal) {
    showToast("Tanggal belum diisi", "error");
    return;
  }

  try {
    if (btn) { btn.disabled = true; btn.textContent = "Menyimpan..."; }

    const users = await window.idb.getUsers();
    const adminCabang = users.find(u => u.role === "adminCabang");
    if (!adminCabang) {
      showToast("Data admin cabang tidak ditemukan", "error");
      return;
    }

    const payload = {
      createdBy: adminCabang.uid,
      createdAt: serverTimestamp(),
      idCabang: adminCabang.idCabang || "",
      tanggal,
      catatan,
      diterima: false,
      distribusi: buildDistribusiPayload(),
      produksi: buildProduksiPayload()
    };

    const ref = doc(db, "users", adminCabang.uid, "setoranAmplop", tanggal);
    await setDoc(ref, payload);

    showToast("Setoran amplop berhasil disimpan", "");
  } catch (err) {
    showToast("Gagal menyimpan setoran amplop", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Simpan"; }
  }
}
function updateProduksiUI() {
  let totalOmset = 0, totalPengeluaran = 0;
  let omsetRows = "", pengeluaranRows = "";

  if (rumusLaporanData) {
    Object.keys(rumusLaporanData).forEach(key => {
      if (key === "tanggal" || key === "createdBy") return;
      const kurir = rumusLaporanData[key];
      const nilai = kurir?.pembayaran?.nota?.bayar || 0;
      totalOmset += nilai;
      omsetRows  += `<div class="amplop-detail-row"><span class="label">${kurir?.nama||""}</span><span class="value">${formatRupiah(nilai)}</span></div>`;
    });
  }

  if (rumusPengeluaranData?.produksi) {
    rumusPengeluaranData.produksi.forEach(item => {
      totalPengeluaran += Number(item.nominal) || 0;
      pengeluaranRows  += `<div class="amplop-detail-row"><span class="label">${item.nama||""} (x${item.qty||1})</span><span class="value">- ${formatRupiah(item.nominal)}</span></div>`;
    });
  }

  const amplop = totalOmset - totalPengeluaran;

  const card = document.querySelector("#rumusPanelBody .rumus-card-produksi");
  if (card) {
    card.innerHTML = `
      <div class="amplop-detail-subtitle">Omset</div>
      ${omsetRows || `<div class="amplop-detail-row"><span class="label">-</span><span class="value">Rp 0</span></div>`}
      <div class="amplop-detail-row amplop-detail-row-sum"><span class="label">Total Omset</span><span class="value">${formatRupiah(totalOmset)}</span></div>

      <div class="amplop-detail-subtitle">Pengeluaran</div>
      ${pengeluaranRows || `<div class="amplop-detail-row"><span class="label">Tidak ada</span><span class="value">Rp 0</span></div>`}
      <div class="amplop-detail-row amplop-detail-row-sum"><span class="label">Total Pengeluaran</span><span class="value">- ${formatRupiah(totalPengeluaran)}</span></div>

      <div class="amplop-detail-total"><span>Amplop Produksi</span><span>${formatRupiah(amplop)}</span></div>`;
  }

  const elAmplop = document.getElementById("rumusAmplopProduksi");
  if (elAmplop) elAmplop.textContent = formatRupiah(amplop);
}
function toggleRumusTanggalCheck(show) {
  const el = document.getElementById("rumusTanggalCheck");
  if (el) el.style.display = show ? "" : "none";
}
function updateDistribusiUI() {
  let totalOmset = 0, totalLainnya = 0, totalPengeluaran = 0;
  let omsetRows = "", lainnyaRows = "", pengeluaranRows = "";

  if (rumusLaporanData) {
    Object.keys(rumusLaporanData).forEach(key => {
      if (key === "tanggal" || key === "createdBy") return;
      const kurir    = rumusLaporanData[key];
      const keuangan = kurir?.distribusi?.keuangan;
      if (!keuangan) return;

      const nilaiOmset    = keuangan.grossMargin || 0;
      const bonusPay      = keuangan.bonus?.bonusPay || 0;
      const klaimInsentif = keuangan.klaimInsentif || 0;
      const kasbon        = keuangan.kasbon || 0;
      const totalKurir    = bonusPay + klaimInsentif + kasbon;
      const netto         = nilaiOmset - bonusPay - klaimInsentif;

      totalOmset   += netto;
      totalLainnya += totalKurir;

      const details = [
        bonusPay      > 0 ? `Bonus Pay: ${formatRupiah(bonusPay)}`          : null,
        klaimInsentif > 0 ? `Klaim Insentif: ${formatRupiah(klaimInsentif)}` : null,
        kasbon        > 0 ? `Kasbon: ${formatRupiah(kasbon)}`                : null,
      ].filter(Boolean).join(" · ");

      omsetRows   += `<div class="amplop-detail-row"><span class="label">${kurir?.nama||""}</span><span class="value">${formatRupiah(netto)}</span></div>`;
      lainnyaRows += `
        <div class="amplop-detail-row" style="flex-direction:column;align-items:flex-start;gap:2px">
          <div style="display:flex;justify-content:space-between;width:100%">
            <span class="label">${kurir?.nama||""}</span>
            <span class="value">- ${formatRupiah(totalKurir)}</span>
          </div>
          ${details ? `<div style="font-size:11px;color:var(--text-muted)">${details}</div>` : ""}
        </div>`;
    });
  }

  if (rumusPengeluaranData?.distribusi) {
    rumusPengeluaranData.distribusi.forEach(item => {
      totalPengeluaran += Number(item.nominal) || 0;
      pengeluaranRows  += `<div class="amplop-detail-row"><span class="label">${item.nama||""} (x${item.qty||1})</span><span class="value">- ${formatRupiah(item.nominal)}</span></div>`;
    });
  }
  const amplop = totalOmset - totalPengeluaran;
  const card = document.querySelector(".rumus-card-distribusi");
  if (card) {
    card.innerHTML = `
      <div class="amplop-detail-subtitle">Omset</div>
      ${omsetRows || `<div class="amplop-detail-row"><span class="label">-</span><span class="value">Rp 0</span></div>`}
      <div class="amplop-detail-row amplop-detail-row-sum"><span class="label">Total Omset</span><span class="value">${formatRupiah(totalOmset)}</span></div>

      <div class="amplop-detail-subtitle">Lainnya</div>
      ${lainnyaRows || `<div class="amplop-detail-row"><span class="label">Tidak ada</span><span class="value">Rp 0</span></div>`}
      <div class="amplop-detail-row amplop-detail-row-sum"><span class="label">Total Lainnya</span><span class="value">- ${formatRupiah(totalLainnya)}</span></div>

      <div class="amplop-detail-subtitle">Pengeluaran</div>
      ${pengeluaranRows || `<div class="amplop-detail-row"><span class="label">Tidak ada</span><span class="value">Rp 0</span></div>`}
      <div class="amplop-detail-row amplop-detail-row-sum"><span class="label">Total Pengeluaran</span><span class="value">- ${formatRupiah(totalPengeluaran)}</span></div>

      <div class="amplop-detail-total"><span>Amplop Distribusi</span><span>${formatRupiah(amplop)}</span></div>`;
  }

  const elAmplop = document.getElementById("rumusAmplopDistribusi");
  if (elAmplop) elAmplop.textContent = formatRupiah(amplop);
}
async function getUidAdminCabang() {
  try {
    const users = await window.idb.getUsers();
    const adminCabang = users.find(u => u.role === "adminCabang");
    if (!adminCabang) {
      return null;
    }
    return adminCabang.uid;
  } catch (err) {
    return null;
  }
}
window.getUidAdminCabang = getUidAdminCabang;
async function loadRumusData(tanggal) {
  // matikan listener lama dulu biar gak numpuk
  if (rumusUnsubscribe) {
    rumusUnsubscribe();
    rumusUnsubscribe = null;
  }
  if (rumusPengeluaranUnsubscribe) {
    rumusPengeluaranUnsubscribe();
    rumusPengeluaranUnsubscribe = null;
  }
  if (!tanggal) return;

  const uidAdminCabang = await getUidAdminCabang();
  if (!uidAdminCabang) return;

  // reset dulu biar gak nampilin data tanggal sebelumnya sekilas
  rumusLaporanData = null;
  rumusPengeluaranData = null;
  updateDistribusiUI();
  updateProduksiUI();
  toggleRumusTanggalCheck(false);

  // ── laporanAdmin ──
  const ref = doc(db, "users", uidAdminCabang, "laporanAdmin", tanggal);
  rumusUnsubscribe = onSnapshot(
    ref,
    (snap) => {
      rumusLaporanData = snap.exists() ? snap.data() : null;
      updateDistribusiUI();
      updateProduksiUI();
    },
    (err) => {}
  );

  // ── pengeluaran ──
  const refPengeluaran = doc(db, "users", uidAdminCabang, "pengeluaran", tanggal);
  rumusPengeluaranUnsubscribe = onSnapshot(
    refPengeluaran,
    (snap) => {
      rumusPengeluaranData = snap.exists() ? snap.data() : null;
      updateDistribusiUI();
      updateProduksiUI();
    },
    (err) => {}
  );

  // ── setoranAmplop (cek sudah disetor atau belum) ──
  const refSetoran = doc(db, "users", uidAdminCabang, "setoranAmplop", tanggal);
  rumusSetoranUnsubscribe = onSnapshot(
    refSetoran,
    (snap) => {
      toggleRumusTanggalCheck(snap.exists());
      const catatanInput = document.getElementById("rumusCatatan");
      if (catatanInput) {
        catatanInput.value = snap.exists() ? (snap.data().catatan || "") : "";
      }
    },
    (err) => {}
  );
}
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

  loadRumusData(tanggalInput?.value);
}
function closeRumusPanel() {
  document.getElementById("rumusOverlay")?.classList.remove("show");
  document.getElementById("rumusPanel")?.classList.remove("show");

  if (rumusUnsubscribe) {
    rumusUnsubscribe();
    rumusUnsubscribe = null;
  }
  if (rumusPengeluaranUnsubscribe) {
    rumusPengeluaranUnsubscribe();
    rumusPengeluaranUnsubscribe = null;
  }
  if (rumusSetoranUnsubscribe) {
    rumusSetoranUnsubscribe();
    rumusSetoranUnsubscribe = null;
  }
}
window.openRumusPanel = openRumusPanel;
window.closeRumusPanel = closeRumusPanel;
document.getElementById("rumusPanelClose")?.addEventListener("click", closeRumusPanel);
document.getElementById("rumusOverlay")?.addEventListener("click", closeRumusPanel);
document.getElementById("rumusTanggal")?.addEventListener("change", (e) => {
  loadRumusData(e.target.value);
  window.onRumusTanggalChange?.(e.target.value); // hook buat trigger query nanti
});
document.getElementById("rumusSaveBtn")?.addEventListener("click", () => {
  simpanSetoranAmplop();
});

/* ── SWIPE TO CLOSE ── */
(function initRumusSwipe() {
  const panel = document.getElementById("rumusPanel");
  if (!panel) return;
  const body = panel.querySelector(".rumus-panel-body");
  let startY = 0, lastY = 0, dy = 0, dragging = false, tracking = false;
  panel.addEventListener("touchstart", (e) => {
    if (window.innerWidth > 768) return;
    tracking = true;
    dragging = false;
    startY = lastY = e.touches[0].clientY;
    dy = 0;
    panel.style.transition = "none";
  }, { passive: true });
  panel.addEventListener("touchmove", (e) => {
    if (!tracking) return;
    const y = e.touches[0].clientY;
    const stepY = y - lastY; // gerakan sejak event terakhir
    lastY = y;
    dy = y - startY;

    if (!dragging) {
      const atTop = !body || body.scrollTop <= 0;
      if (atTop && stepY > 0) {
        dragging = true;
      } else if (body) {
        e.preventDefault();
        body.scrollTop -= stepY;
        return;
      }
    }

    if (dragging) {
      e.preventDefault();
      panel.style.transform = `translateY(${Math.max(0, dy)}px)`;
    }
  }, { passive: false });
  panel.addEventListener("touchend", () => {
    tracking = false;
    if (!dragging) return;
    dragging = false;
    panel.style.transition = "transform .3s cubic-bezier(.32,1,.23,1)";

    if (dy > 120) {
      // lanjutkan animasi turun sampai bener-bener hilang, baru beneran tutup
      panel.style.transform = "translateY(100%)";
      setTimeout(() => {
        closeRumusPanel();
        panel.style.transform = "";
        panel.style.transition = "";
      }, 300);
    } else {
      // batal, balik ke posisi terbuka
      panel.style.transform = "";
      setTimeout(() => { panel.style.transition = ""; }, 300);
    }
  });
  // ── DESKTOP: swipe ke kanan (mouse drag) ──
  let startX = 0, curX = 0, draggingDesktop = false;
  panel.addEventListener("mousedown", (e) => {
    if (window.innerWidth <= 768) return;
    startX = curX = e.clientX;
    draggingDesktop = true;
    panel.style.transition = "none";
  });
  window.addEventListener("mousemove", (e) => {
    if (!draggingDesktop) return;
    curX = e.clientX;
    const dx = curX - startX;
    if (dx < 0) return;
    panel.style.transform = `translateX(${dx}px)`;
  });
  window.addEventListener("mouseup", () => {
    if (!draggingDesktop) return;
    draggingDesktop = false;

    panel.style.transition = "transform .3s cubic-bezier(.32,1,.23,1)";

    if (curX - startX > 120) {
      panel.style.transform = "translateX(100%)";
      setTimeout(() => {
        closeRumusPanel();
        panel.style.transform = "";
        panel.style.transition = "";
      }, 300);
    } else {
      panel.style.transform = "";
      setTimeout(() => { panel.style.transition = ""; }, 300);
    }
  });
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
