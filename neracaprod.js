
/* ── NERACA SALDO: STATE ── */
let neracaBulan = new Date().getMonth();
let neracaTahun = new Date().getFullYear();
let neracaDataLancar = [];
let neracaDataTetap = [];
let neracaDataLiabilitas = [];
let neracaDataEkuitas = [];

function parseAngkaRibuanNeraca(str) {
  return Number(String(str || "").replace(/\D/g, "")) || 0;
}
function attachFormatRibuanNeraca(inputId) {
  const el = document.getElementById(inputId);
  if (!el || el.dataset.ribuanBound) return;
  el.dataset.ribuanBound = "true";
  el.addEventListener("input", () => {
    const angka = parseAngkaRibuanNeraca(el.value);
    el.value = angka ? angka.toLocaleString("id-ID") : "";
  });
}

/* ── LOAD DATA ── */
function getDefaultNeracaLancar() {
  return [
    { id: "default-saldokas",   nama: "Saldo Kas",         nilai: 0 },
    { id: "default-stockbahan", nama: "Stock Bahan Baku",  nilai: 0 },
    { id: "default-stockjadi",  nama: "Stock Barang Jadi", nilai: 0 },
    { id: "default-modalpend",  nama: "Modal Pending",     nilai: 0 }
  ];
}
function getDefaultNeracaTetap() {
  return [
    { id: "default-peralatan", nama: "Peralatan & Perlengkapan", nilai: 0 }
  ];
}
function getDefaultNeracaLiabilitas() {
  return [
    { id: "default-hutangusaha", nama: "Hutang Usaha", nilai: 0 },
    { id: "default-hutangbank",  nama: "Hutang Bank",  nilai: 0 }
  ];
}
function getDefaultNeracaEkuitas() {
  return [
    { id: "default-modalinvestor", nama: "Modal Investor", nilai: 0 }
  ];
}
async function loadNeracaData() {
  const adminUid = window.auth?.currentUser?.uid;
  if (!adminUid) { neracaDataLancar = []; neracaDataTetap = []; return; }

  const periode = `${neracaTahun}-${String(neracaBulan + 1).padStart(2, "0")}`;

  try {
    const snap = await window.getDoc(window.doc(window.db, "users", adminUid, "neracaSaldo", periode));
    if (snap.exists()) {
      const data = snap.data();
      neracaDataLancar     = data.asetLancar || [];
      neracaDataTetap      = data.asetTetap || [];
      neracaDataLiabilitas = data.liabilitas || [];
      neracaDataEkuitas    = data.ekuitas || [];
    } else {
      neracaDataLancar = getDefaultNeracaLancar();
      neracaDataTetap = getDefaultNeracaTetap();
      neracaDataLiabilitas = getDefaultNeracaLiabilitas();
      neracaDataEkuitas = getDefaultNeracaEkuitas();
    }
  } catch (err) {
    console.error("❌ loadNeracaData:", err);
    neracaDataLancar = [];
    neracaDataTetap = [];
    neracaDataLiabilitas = [];
    neracaDataEkuitas = [];
  }
}

/* ── RENDER ── */
function hitungTotalNeraca(list) {
  return list.reduce((sum, item) => sum + (Number(item.nilai) || 0), 0);
}
function renderNeracaSummary() {
  const totalKiri  = hitungTotalNeraca(neracaDataLancar) + hitungTotalNeraca(neracaDataTetap);
  const totalKanan = hitungTotalNeraca(neracaDataLiabilitas) + hitungTotalNeraca(neracaDataEkuitas);

  const kiriEl  = document.getElementById("neracaTotalKiri");
  const kananEl = document.getElementById("neracaTotalKanan");
  if (kiriEl)  kiriEl.textContent  = `Rp ${totalKiri.toLocaleString("id-ID")}`;
  if (kananEl) kananEl.textContent = `Rp ${totalKanan.toLocaleString("id-ID")}`;

  renderNeracaKpi();
  renderNeracaLabaBerjalan();
}
function hitungLabaBerjalan() {
  const totalAset = hitungTotalNeraca(neracaDataLancar) + hitungTotalNeraca(neracaDataTetap);
  const totalLiabilitasEkuitas = hitungTotalNeraca(neracaDataLiabilitas) + hitungTotalNeraca(neracaDataEkuitas);
  return totalAset - totalLiabilitasEkuitas;
}
function renderNeracaLabaBerjalan() {
  const el = document.getElementById("neracaLabaBerjalan");
  if (!el) return;
  const laba = hitungLabaBerjalan();
  el.textContent = `Rp ${laba.toLocaleString("id-ID")}`;
  el.style.color = laba < 0 ? "var(--danger)" : "var(--brand-primary)";
}
function renderNeracaKpi() {
  const wrap = document.getElementById("neracaKpiRow");
  if (!wrap) return;

  const cards = [
    { label: "Aset Lancar",  value: hitungTotalNeraca(neracaDataLancar) },
    { label: "Aset Tetap",   value: hitungTotalNeraca(neracaDataTetap) },
    { label: "Liabilitas",   value: hitungTotalNeraca(neracaDataLiabilitas) },
    { label: "Ekuitas",      value: hitungTotalNeraca(neracaDataEkuitas) }
  ];

  wrap.innerHTML = cards.map((c, i) => `
    <div class="rekap-prod-kpi-card kpi-c${i % 5}">
      <div class="rekap-prod-kpi-label">${c.label}</div>
      <div class="rekap-prod-kpi-value">Rp ${c.value.toLocaleString("id-ID")}</div>
    </div>
  `).join("");
}
const NERACA_KATEGORI_MAP = {
  lancar:      { data: () => neracaDataLancar,      elId: "neracaListLancar" },
  tetap:       { data: () => neracaDataTetap,       elId: "neracaListTetap" },
  liabilitas:  { data: () => neracaDataLiabilitas,  elId: "neracaListLiabilitas" },
  ekuitas:     { data: () => neracaDataEkuitas,     elId: "neracaListEkuitas" }
};

function renderNeracaList(kategori, focusLastInput = false) {
  const list = NERACA_KATEGORI_MAP[kategori].data();
  const wrap = document.getElementById(NERACA_KATEGORI_MAP[kategori].elId);
  if (!wrap) return;

  if (!list.length) {
    wrap.innerHTML = `<div class="neraca-list-empty">Belum ada akun</div>`;
    return;
  }

  wrap.innerHTML = list.map(item => `
    <div class="neraca-list-row" data-id="${item.id}">
      <input type="text" class="neraca-input-nama" data-id="${item.id}" data-kategori="${kategori}" value="${item.nama || ""}" placeholder="Nama akun">
      <input type="text" inputmode="numeric" class="neraca-input-nilai" data-id="${item.id}" data-kategori="${kategori}" value="${item.nilai ? Number(item.nilai).toLocaleString("id-ID") : ""}" placeholder="0">
      <button class="neraca-delete-btn" data-id="${item.id}" data-kategori="${kategori}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join("");

  wrap.querySelectorAll(".neraca-delete-btn").forEach(btn => {
    btn.addEventListener("click", () => hapusAkunBaris(btn.dataset.kategori, btn.dataset.id));
  });

  wrap.querySelectorAll(".neraca-input-nama").forEach(input => {
    input.addEventListener("input", () => {
      const list = NERACA_KATEGORI_MAP[input.dataset.kategori].data();
      const item = list.find(i => i.id === input.dataset.id);
      if (item) item.nama = input.value;
    });
  });

  wrap.querySelectorAll(".neraca-input-nilai").forEach(input => {
    input.addEventListener("input", () => {
      const angka = parseAngkaRibuanNeraca(input.value);
      input.value = angka ? angka.toLocaleString("id-ID") : "";
      const list = NERACA_KATEGORI_MAP[input.dataset.kategori].data();
      const item = list.find(i => i.id === input.dataset.id);
      if (item) item.nilai = angka;
      renderNeracaSummary();
    });
  });

  if (focusLastInput) {
    const inputs = wrap.querySelectorAll(".neraca-input-nama");
    inputs[inputs.length - 1]?.focus();
  }
}
function renderNeracaAll() {
  renderNeracaList("lancar");
  renderNeracaList("tetap");
  renderNeracaList("liabilitas");
  renderNeracaList("ekuitas");
  renderNeracaSummary();
}

/* ── TAMBAH AKUN BARU (langsung baris input, tanpa popup) ── */
function tambahAkunBaru(kategori) {
  const list = NERACA_KATEGORI_MAP[kategori].data();
  list.push({ id: "neraca" + Date.now(), nama: "", nilai: 0 });
  renderNeracaList(kategori, true);
  renderNeracaSummary();
}

/* ── HAPUS AKUN (langsung, tanpa konfirmasi) ── */
function hapusAkunBaris(kategori, itemId) {
  const list = NERACA_KATEGORI_MAP[kategori].data();
  const idx = list.findIndex(i => i.id === itemId);
  if (idx !== -1) list.splice(idx, 1);
  renderNeracaList(kategori);
  renderNeracaSummary();
}
async function simpanNeracaSemua() {
  const adminUid = window.auth?.currentUser?.uid;
  if (!adminUid) { window.showToast("User tidak terdeteksi", "error"); return; }

  const periode = `${neracaTahun}-${String(neracaBulan + 1).padStart(2, "0")}`;
  const allUsers = await window.idb.getUsers();
  const userData = allUsers.find(u => u.uid === adminUid);
  const idCabang = userData?.idCabang || "";

  try {
    await window.setDoc(window.doc(window.db, "users", adminUid, "neracaSaldo", periode), {
      asetLancar: neracaDataLancar,
      asetTetap: neracaDataTetap,
      liabilitas: neracaDataLiabilitas,
      ekuitas: neracaDataEkuitas,
      labaBerjalan: hitungLabaBerjalan(),
      createdBy: adminUid,
      idCabang,
      periode,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    window.showToast("Neraca saldo berhasil disimpan", "success");
  } catch (err) {
    console.error("❌ simpanNeracaSemua:", err);
    window.showToast("Gagal menyimpan neraca saldo", "error");
  }
}
/* ── FILTER BULAN/TAHUN (pola sama kayak Audit) ── */
function initNeracaFilter() {
  const bulanBtn = document.getElementById("neracaBulanBtn");
  const tahunBtn = document.getElementById("neracaTahunBtn");
  const bulanDD  = document.getElementById("neracaBulanDropdown");
  const tahunDD  = document.getElementById("neracaTahunDropdown");
  if (!bulanBtn || !tahunBtn) return;

  document.getElementById("neracaBulanLabel").textContent = REKAP_PROD_BULAN_NAMA[neracaBulan];
  document.getElementById("neracaTahunLabel").textContent = neracaTahun;

  const now = new Date().getFullYear();
  tahunDD.innerHTML = [now-1, now, now+1].map(y =>
    `<div class="rekap-dist-dropdown-option ${y===neracaTahun?"selected":""}" data-tahun="${y}">${y}</div>`
  ).join("");

  const closeAll = () => { bulanDD.style.display = "none"; tahunDD.style.display = "none"; };
  document.addEventListener("click", e => {
    if (!e.target.closest(".rekap-dist-filter-wrap")) closeAll();
  });

  const openDD = (btn, dd) => {
    const isOpen = dd.style.display === "block";
    closeAll();
    if (isOpen) return;
    const rect = btn.getBoundingClientRect();
    dd.style.top  = (rect.bottom + 4) + "px";
    dd.style.left = rect.left + "px";
    dd.style.display = "block";
  };

  bulanBtn.addEventListener("click", e => { e.stopPropagation(); openDD(bulanBtn, bulanDD); });
  tahunBtn.addEventListener("click", e => { e.stopPropagation(); openDD(tahunBtn, tahunDD); });

  bulanDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(opt => {
    opt.addEventListener("click", async e => {
      e.stopPropagation();
      neracaBulan = Number(opt.dataset.bulan);
      document.getElementById("neracaBulanLabel").textContent = REKAP_PROD_BULAN_NAMA[neracaBulan];
      bulanDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      closeAll();
      await loadNeracaData();
      renderNeracaAll();
    });
  });

  tahunDD.addEventListener("click", async e => {
    e.stopPropagation();
    const opt = e.target.closest(".rekap-dist-dropdown-option");
    if (!opt) return;
    neracaTahun = Number(opt.dataset.tahun);
    document.getElementById("neracaTahunLabel").textContent = neracaTahun;
    tahunDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    await loadNeracaData();
    renderNeracaAll();
  });

  document.getElementById("neracaReloadBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("neracaReloadBtn");
    btn.classList.add("spinning");
    await loadNeracaData();
    renderNeracaAll();
    btn.classList.remove("spinning");
  });
}

/* ── INIT VIEW ── */
window.initNeracaSaldoView = function() {
  initNeracaFilter();

  document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='neraca']").forEach(item => {
    item.addEventListener("click", async () => {
      document.querySelectorAll("#rekapProduksiList .lap-kurir-item").forEach(x => x.classList.remove("active"));
      item.classList.add("active");

      window.activateRekapProdPanel("neracaProduksiDetailWrapper");

      document.getElementById("neracaProduksiEmpty").style.display   = "none";
      document.getElementById("neracaProduksiContent").style.display = "flex";

      if (window.innerWidth <= 768) {
        const backBtn = document.getElementById("neracaProduksiBackBtn");
        if (backBtn) backBtn.style.display = "flex";
      }

      await loadNeracaData();
      renderNeracaAll();
    });
  });

  document.getElementById("neracaProduksiBackBtn")?.addEventListener("click", () => {
    document.getElementById("neracaProduksiDetailWrapper").style.setProperty("display", "none", "important");
    document.getElementById("neracaProduksiDetailWrapper")?.classList.remove("show");
    document.getElementById("neracaProduksiBackBtn").style.display = "none";
    document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='neraca']").forEach(x => x.classList.remove("active"));
    window.showRekapProdListMobile();
  });

  document.getElementById("neracaAddLancarBtn")?.addEventListener("click", () => tambahAkunBaru("lancar"));
  document.getElementById("neracaAddTetapBtn")?.addEventListener("click", () => tambahAkunBaru("tetap"));
  document.getElementById("neracaAddLiabilitasBtn")?.addEventListener("click", () => tambahAkunBaru("liabilitas"));
  document.getElementById("neracaAddEkuitasBtn")?.addEventListener("click", () => tambahAkunBaru("ekuitas"));
  document.getElementById("neracaSaveBtn")?.addEventListener("click", simpanNeracaSemua);
};