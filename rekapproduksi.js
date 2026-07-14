/* ── REKAP PRODUKSI VIEW ── */
let rekapProdBulan = new Date().getMonth();
let rekapProdTahun = new Date().getFullYear();
const REKAP_PROD_BULAN_NAMA = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

const REKAP_PROD_JENIS = [
  "Saldo Kemarin",
  "Input",
  "Reject",
  "Output",
  "Fee",
  "Rusak Freezer",
  "Basi Freezer",
  "Off Flavor",
  "Barang Hilang",
  "Promosi",
  "Saldo Akhir",
  "Jumlah Rugi"
];

let rekapProdVarianList = [];
let rekapProdData = {}; // { "Saldo Kemarin": { CB: 10, BB: 5, ... }, ... }

function activateRekapProdPanel(targetWrapperId) {
  // sembunyikan SEMUA panel detail di dalam view ini, lalu tampilkan yang diminta
  const allWrappers = document.querySelectorAll('#view-rekapproduksi [id$="DetailWrapper"]');
  allWrappers.forEach(el => {
    el.classList.remove("show");
    el.style.setProperty("display", "none", "important");
  });

  const target = document.getElementById(targetWrapperId);
  if (target) {
    target.classList.add("show");
    target.style.setProperty("display", "flex", "important");
  }

  // MOBILE: paksa sembunyikan list panel supaya overlay bener-bener full screen
  if (window.innerWidth <= 768) {
    const listPanel = document.querySelector('#view-rekapproduksi .lap-list-panel');
    if (listPanel) listPanel.style.setProperty("display", "none", "important");
  }
}
window.activateRekapProdPanel = activateRekapProdPanel;

function showRekapProdListMobile() {
  const listPanel = document.querySelector('#view-rekapproduksi .lap-list-panel');
  if (listPanel) listPanel.style.removeProperty("display");
}
window.showRekapProdListMobile = showRekapProdListMobile;

function getPrevMonthTanggal(bulan, tahun) {
  let prevBulan = bulan - 1;
  let prevTahun = tahun;
  if (prevBulan < 0) { prevBulan = 11; prevTahun -= 1; }
  const mm = String(prevBulan + 1).padStart(2, "0");
  return `${prevTahun}-${mm}`;
}

const REKAP_PROD_FIELD_MAP = {
  "Input":         "produksi",
  "Reject":        "reject",
  "Rusak Freezer": "rusakFreezer",
  "Basi Freezer":  "basiFreezer",
  "Barang Hilang": "barangHilang",
  "Promosi":       "promosi"
};

const REKAP_PROD_LAPORAN_FIELD_MAP = {
  "Fee":        "fee",
  "Off Flavor": "offFlavor",
  "Output":     "pembayaran.closing"
};

function getNestedField(obj, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] != null) ? acc[key] : undefined, obj);
}

async function loadLaporanAdminAggregates() {
  const result = {};
  Object.keys(REKAP_PROD_LAPORAN_FIELD_MAP).forEach(jenis => { result[jenis] = {}; });

  try {
    const bulanStr = String(rekapProdBulan + 1).padStart(2, "0");
    const prefix   = `${rekapProdTahun}-${bulanStr}`;

    const allRecords = await window.idb.getAllLaporanAdmin();
    const filtered = allRecords.filter(r => (r.tanggal || "").startsWith(prefix));

    filtered.forEach(record => {
      const dataPerUid = record.data || {};
      Object.values(dataPerUid).forEach(uidData => {
        Object.entries(REKAP_PROD_LAPORAN_FIELD_MAP).forEach(([jenis, path]) => {
          const fieldMap = getNestedField(uidData, path) || {};
          Object.entries(fieldMap).forEach(([varian, nilai]) => {
            result[jenis][varian] = (result[jenis][varian] || 0) + Number(nilai || 0);
          });
        });
      });
    });
  } catch (err) {
    console.error("❌ loadLaporanAdminAggregates:", err);
  }

  return result;
}

async function loadRekapProdLoyangList() {
  try {
    const kantorCabang = await window.idb.getKantorCabang();
    const loyangArr = kantorCabang?.loyang || [];

    const aktifList = loyangArr
      .filter(item => item?.status === true)
      .map(item => item.jenisLoyang)
      .filter(Boolean);

    return aktifList.length ? aktifList : ["Original"];
  } catch (err) {
    console.error("❌ loadRekapProdLoyangList:", err);
    return ["Original"];
  }
}

async function loadStockOpnameKpi() {
  const result = {};

  const loyangList = await loadRekapProdLoyangList();
  loyangList.forEach(jenis => { result[jenis] = 0; });

  try {
    const bulanStr = String(rekapProdBulan + 1).padStart(2, "0");
    const prefix   = `${rekapProdTahun}-${bulanStr}`;

    const allRecords = await window.idb.getAllStockOpname();
    const filtered = allRecords.filter(r => (r.tanggal || "").startsWith(prefix));

    filtered.forEach(record => {
      const data = record.data || {};
      Object.entries(data).forEach(([key, val]) => {
        if (!key.startsWith("jumlahLoyang")) return;
        if (typeof val !== "number" && isNaN(Number(val))) return;

        const suffix = key.replace("jumlahLoyang", "");
        const label  = suffix === "" ? "Original" : suffix;

        result[label] = (result[label] || 0) + Number(val || 0);
      });
    });
  } catch (err) {
    console.error("❌ loadStockOpnameKpi:", err);
  }

  return result;
}

function renderRekapProdKpi(kpiData) {
  const wrap = document.getElementById("rekapProdKpiRow");
  if (!wrap) return;

  const labels = Object.keys(kpiData);
  if (!labels.length) {
    wrap.innerHTML = "";
    return;
  }

  wrap.innerHTML = labels.map((label, i) => `
    <div class="rekap-prod-kpi-card kpi-c${i % 5}">
      <div class="rekap-prod-kpi-label">Jumlah Loyang ${label}</div>
      <div class="rekap-prod-kpi-value">${(kpiData[label] || 0).toLocaleString("id-ID")}</div>
    </div>
  `).join("");
}

async function loadStockOpnameAggregates() {
  const result = {};
  Object.keys(REKAP_PROD_FIELD_MAP).forEach(jenis => { result[jenis] = {}; });

  try {
    const bulanStr = String(rekapProdBulan + 1).padStart(2, "0");
    const prefix   = `${rekapProdTahun}-${bulanStr}`;

    const allRecords = await window.idb.getAllStockOpname();
    const filtered = allRecords.filter(r => (r.tanggal || "").startsWith(prefix));

    filtered.forEach(record => {
      const data = record.data || {};
      Object.entries(REKAP_PROD_FIELD_MAP).forEach(([jenis, field]) => {
        const fieldMap = data[field] || {};
        Object.entries(fieldMap).forEach(([varian, nilai]) => {
          result[jenis][varian] = (result[jenis][varian] || 0) + Number(nilai || 0);
        });
      });
    });
  } catch (err) {
    console.error("❌ loadStockOpnameAggregates:", err);
  }

  return result;
}

async function loadSaldoKemarin(adminUid) {
  try {
    const tanggal = getPrevMonthTanggal(rekapProdBulan, rekapProdTahun);
    const docRef  = window.doc(window.db, "users", adminUid, "saldoBulanKemarin", tanggal);
    const snap    = await window.getDoc(docRef);
    if (!snap.exists()) {
      console.warn("⚠️ saldoBulanKemarin tidak ditemukan untuk:", tanggal);
      return {};
    }
    return snap.data()?.saldo || {};
  } catch (err) {
    console.error("❌ loadSaldoKemarin:", err);
    return {};
  }
}

async function loadRekapProdVarianList() {
  try {
    const adminUid = window.auth?.currentUser?.uid;
    if (!adminUid) return [];

    const allUsers = await window.idb.getUsers();
    const userData = allUsers.find(u => u.uid === adminUid);
    const varianArr = userData?.varian || [];

    const aktifList = [];
    varianArr.forEach(item => {
      const namaVarian = Object.keys(item)[0];
      const detail = item[namaVarian];
      if (detail && detail.isAktif === true) {
        aktifList.push(namaVarian);
      }
    });

    return aktifList;
  } catch (err) {
    console.error("❌ loadRekapProdVarianList:", err);
    return [];
  }
}

function hitungSaldoAkhir() {
  const result = {};

  rekapProdVarianList.forEach(v => {
    const saldoKemarin = Number(rekapProdData["Saldo Kemarin"]?.[v])  || 0;
    const input        = Number(rekapProdData["Input"]?.[v])          || 0;
    const reject       = Number(rekapProdData["Reject"]?.[v])         || 0;
    const output       = Number(rekapProdData["Output"]?.[v])         || 0;
    const fee          = Number(rekapProdData["Fee"]?.[v])            || 0;
    const rusakFreezer = Number(rekapProdData["Rusak Freezer"]?.[v])  || 0;
    const basiFreezer  = Number(rekapProdData["Basi Freezer"]?.[v])   || 0;
    const offFlavor    = Number(rekapProdData["Off Flavor"]?.[v])     || 0;
    const barangHilang = Number(rekapProdData["Barang Hilang"]?.[v])  || 0;
    const promosi      = Number(rekapProdData["Promosi"]?.[v])        || 0;

    result[v] = saldoKemarin + input - reject - output - fee - rusakFreezer - basiFreezer - offFlavor - barangHilang - promosi;
  });

  return result;
}

function hitungJumlahRugi() {
  const result = {};

  rekapProdVarianList.forEach(v => {
    const fee          = Number(rekapProdData["Fee"]?.[v])           || 0;
    const reject       = Number(rekapProdData["Reject"]?.[v])        || 0;
    const basiFreezer  = Number(rekapProdData["Basi Freezer"]?.[v])  || 0;
    const offFlavor    = Number(rekapProdData["Off Flavor"]?.[v])    || 0;
    const promosi      = Number(rekapProdData["Promosi"]?.[v])       || 0;
    const barangHilang = Number(rekapProdData["Barang Hilang"]?.[v])|| 0;

    result[v] = fee + reject + basiFreezer + offFlavor + promosi + barangHilang;
  });

  return result;
}

async function loadKasbonProduksiPerUser() {
  const result = {}; // { uid: totalNominal }
  try {
    const adminUid = window.auth?.currentUser?.uid;
    if (!adminUid) return result;

    const mm    = String(rekapProdBulan + 1).padStart(2, "0");
    const start = `${rekapProdTahun}-${mm}-01`;
    const end   = `${rekapProdTahun}-${mm}-31`;

    const snap = await window.getDocs(window.query(
      window.collection(window.db, "users", adminUid, "pengeluaran"),
      window.where("tanggal", ">=", start),
      window.where("tanggal", "<=", end)
    ));

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const kasbonArr = data.kasbonProduksi || [];

      kasbonArr.forEach(item => {
        const uid     = item.uid;
        const nominal = Number(item.nominal) || 0;
        if (!uid) return;

        result[uid] = (result[uid] || 0) + nominal;
      });
    });
  } catch (err) {
    console.error("❌ loadKasbonProduksiPerUser:", err);
  }

  return result;
}

async function loadStockOpnameLoyangPerUser() {
  const result = {}; // { uid: { jenisLoyang: qty } }
  try {
    const bulanStr = String(rekapProdBulan + 1).padStart(2, "0");
    const prefix   = `${rekapProdTahun}-${bulanStr}`;

    const allRecords = await window.idb.getAllStockOpname();
    const filtered = allRecords.filter(r => (r.tanggal || "").startsWith(prefix));

    filtered.forEach(record => {
      const data = record.data || {};
      const uid  = data.uidKoki;
      if (!uid) return;

      if (!result[uid]) result[uid] = {};

      Object.entries(data).forEach(([key, val]) => {
        if (!key.startsWith("jumlahLoyang")) return;
        if (typeof val !== "number" && isNaN(Number(val))) return;

        const suffix = key.replace("jumlahLoyang", "");
        const jenis  = suffix === "" ? "Original" : suffix;

        result[uid][jenis] = (result[uid][jenis] || 0) + Number(val || 0);
      });
    });
  } catch (err) {
    console.error("❌ loadStockOpnameLoyangPerUser:", err);
  }

  return result;
}

function renderRekapProdUserCards(loyangPerUser, kasbonPerUser) {
  const gridEl = document.getElementById("rekapProdUserGrid");
  if (!gridEl) return;

  const users = (window.usersCache || []).filter(u => u.role === "produksi" || u.role === "adminCabang");

  if (!users.length) {
    gridEl.innerHTML = `<div class="dh-ringkasan-empty">Belum ada pegawai produksi</div>`;
    return;
  }

  gridEl.innerHTML = users.map(u => {
    const nama    = u.nama || "Tanpa Nama";
    const inisial = nama.trim().charAt(0).toUpperCase();
    const avatar  = u.foto
      ? `<img class="rekap-dist-avatar" src="${escSlip(u.foto)}" alt="${escSlip(nama)}">`
      : `<div class="rekap-dist-avatar">${escSlip(inisial)}</div>`;

    // hargaMap: { jenisLoyang: upah } dari dokumen user
    const hargaMap = {};
    (u.loyang || []).forEach(item => {
      const jenis = item.jenisLoyang;
      if (jenis) hargaMap[jenis] = Number(item.upah) || 0;
    });

    const qtyMap = loyangPerUser[u.uid] || {};

    // gabungkan jenis dari hargaMap & qtyMap, biar semua jenis ke-cover walau salah satunya kosong
    const jenisSet = new Set([...Object.keys(hargaMap), ...Object.keys(qtyMap)]);
    const jenisList = jenisSet.size ? Array.from(jenisSet) : ["Original", "Matcha"];

    let totalUpah = 0;
    const loyangRows = jenisList.map(jenis => {
      const qty   = qtyMap[jenis]   || 0;
      const harga = hargaMap[jenis] || 0;
      const upah  = qty * harga;
      totalUpah  += upah;
      return `
        <tr>
          <td>${jenis}</td>
          <td>${qty || "-"}</td>
          <td>${harga ? harga.toLocaleString("id-ID") : "-"}</td>
          <td>${upah ? upah.toLocaleString("id-ID") : "-"}</td>
        </tr>`;
    }).join("");

    return `
      <div class="rekap-dist-card" data-uid="${escSlip(u.uid)}">
        <div class="rekap-dist-card-header">
          ${avatar}
          <div>
            <div class="rekap-dist-nama">${escSlip(nama)}</div>
            <div class="rekap-dist-role">${escSlip(u.role || "-")}</div>
          </div>
        </div>
        <div class="rekap-dist-card-body">

          <div>
            <div class="rekap-dist-section-title">Loyang</div>
            <table class="rekap-dist-table">
              <thead><tr><th>Loyang</th><th>Qty</th><th>Harga</th><th>Upah</th></tr></thead>
              <tbody>
                ${loyangRows}
                <tr><td>Jumlah Upah</td><td>-</td><td>-</td><td>${totalUpah ? totalUpah.toLocaleString("id-ID") : "-"}</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <div class="rekap-dist-section-title">Kasbon</div>
            <table class="rekap-dist-table">
              <thead><tr><th>Keterangan</th><th>Nominal</th></tr></thead>
              <tbody>
                <tr><td>Kasbon</td><td>${(kasbonPerUser[u.uid] || 0) ? (kasbonPerUser[u.uid]).toLocaleString("id-ID") : "-"}</td></tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>`;
  }).join("");
}

function renderRekapProduksiTable() {
  const thead = document.getElementById("rekapProdTableHead");
  const tbody = document.getElementById("rekapProdTableBody");
  if (!thead || !tbody) return;

  thead.innerHTML = `<th class="rekap-prod-th-jenis">Jenis</th>` +
    rekapProdVarianList.map(v => `<th>${v}</th>`).join("");

  tbody.innerHTML = REKAP_PROD_JENIS.map(jenis => {
    const jenisData = rekapProdData[jenis] || {};
    const slug = jenis.toLowerCase().replace(/\s+/g, "-");
    return `
    <tr data-jenis="${slug}">
      <td class="rekap-prod-td-jenis">${jenis}</td>
      ${rekapProdVarianList.map(v => {
        const nilai = jenisData[v];
        const tampil = nilai ? nilai.toLocaleString("id-ID") : "";
        return `<td>${tampil}</td>`;
      }).join("")}
    </tr>
  `;
  }).join("");
}

async function refreshRekapProduksiData() {
  const adminUid = window.auth?.currentUser?.uid;
  if (!adminUid) return;

  rekapProdVarianList = await loadRekapProdVarianList();
  rekapProdData["Saldo Kemarin"] = await loadSaldoKemarin(adminUid);

  const stockAgg = await loadStockOpnameAggregates();
  Object.assign(rekapProdData, stockAgg);

  const kpiData = await loadStockOpnameKpi();
  renderRekapProdKpi(kpiData);

  const laporanAgg = await loadLaporanAdminAggregates();
  Object.assign(rekapProdData, laporanAgg);

  rekapProdData["Saldo Akhir"] = hitungSaldoAkhir();
  rekapProdData["Jumlah Rugi"] = hitungJumlahRugi();

  renderRekapProduksiTable();

  if (!window.usersCache?.length) {
    window.usersCache = await window.idb.getUsers();
  }
  const loyangPerUser = await loadStockOpnameLoyangPerUser();
  const kasbonPerUser = await loadKasbonProduksiPerUser();
  renderRekapProdUserCards(loyangPerUser, kasbonPerUser);
}

window.initRekapProduksiView = function() {
  initRekapProdFilter();
  window.initRincianProduksiView?.();
  window.initAuditProduksiView?.();
  window.initPembelianBahanBakuView?.();
  window.initAssetProduksiView?.();
  window.initNeracaSaldoView?.();
  window.initSlipGajiProdView?.();

  document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='rekapitulasi']").forEach(item => {
    item.addEventListener("click", async () => {
      document.querySelectorAll("#rekapProduksiList .lap-kurir-item").forEach(x => x.classList.remove("active"));
      item.classList.add("active");

      activateRekapProdPanel("rekapProduksiDetailWrapper");

      document.getElementById("rekapProduksiEmpty").style.display   = "none";
      document.getElementById("rekapProduksiContent").style.display = "flex";

      if (window.innerWidth <= 768) {
        const backBtn = document.getElementById("rekapProduksiBackBtn");
        if (backBtn) backBtn.style.display = "flex";
      }

      await refreshRekapProduksiData();
    });
  });

  document.getElementById("rekapProduksiBackBtn")?.addEventListener("click", () => {
    document.getElementById("rekapProduksiDetailWrapper").style.setProperty("display", "none", "important");
    document.getElementById("rekapProduksiDetailWrapper")?.classList.remove("show");
    document.getElementById("rekapProduksiBackBtn").style.display = "none";
    document.querySelectorAll("#rekapProduksiList .lap-kurir-item").forEach(x => x.classList.remove("active"));
  });

  document.getElementById("rekapProdReloadBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("rekapProdReloadBtn");
    btn.classList.add("spinning");
    await reloadStockOpnameData();
    await reloadLaporanAdminDataProd();
    await refreshRekapProduksiData();
    btn.classList.remove("spinning");
  });
};

function initRekapProdFilter() {
  const bulanBtn = document.getElementById("rekapProdBulanBtn");
  const tahunBtn = document.getElementById("rekapProdTahunBtn");
  const bulanDD  = document.getElementById("rekapProdBulanDropdown");
  const tahunDD  = document.getElementById("rekapProdTahunDropdown");

  document.getElementById("rekapProdBulanLabel").textContent = REKAP_PROD_BULAN_NAMA[rekapProdBulan];
  document.getElementById("rekapProdTahunLabel").textContent = rekapProdTahun;

  const now = new Date().getFullYear();
  tahunDD.innerHTML = [now-1, now, now+1].map(y =>
    `<div class="rekap-dist-dropdown-option ${y===rekapProdTahun?"selected":""}" data-tahun="${y}">${y}</div>`
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

  bulanBtn?.addEventListener("click", e => { e.stopPropagation(); openDD(bulanBtn, bulanDD); });
  tahunBtn?.addEventListener("click", e => { e.stopPropagation(); openDD(tahunBtn, tahunDD); });

  bulanDD?.querySelectorAll(".rekap-dist-dropdown-option").forEach(opt => {
    opt.addEventListener("click", async e => {
      e.stopPropagation();
      rekapProdBulan = Number(opt.dataset.bulan);
      document.getElementById("rekapProdBulanLabel").textContent = REKAP_PROD_BULAN_NAMA[rekapProdBulan];
      bulanDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      closeAll();
      await refreshRekapProduksiData();
    });
  });

  tahunDD?.addEventListener("click", async e => {
    e.stopPropagation();
    const opt = e.target.closest(".rekap-dist-dropdown-option");
    if (!opt) return;
    rekapProdTahun = Number(opt.dataset.tahun);
    document.getElementById("rekapProdTahunLabel").textContent = rekapProdTahun;
    tahunDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    await refreshRekapProduksiData();
  });
}

async function reloadLaporanAdminDataProd() {
  try {
    const adminUid = window.auth?.currentUser?.uid;
    if (!adminUid) return;

    const mm    = String(rekapProdBulan + 1).padStart(2, "0");
    const start = `${rekapProdTahun}-${mm}-01`;
    const end   = `${rekapProdTahun}-${mm}-31`;

    const snap = await window.getDocs(window.query(
      window.collection(window.db, "users", adminUid, "laporanAdmin"),
      window.where("tanggal", ">=", start),
      window.where("tanggal", "<=", end)
    ));

    let count = 0;
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      await window.idb.saveLaporanAdmin(data.tanggal || docSnap.id, data);
      count++;
    }

    window.showToast(`${count} data laporan admin berhasil dimuat`, "success");
  } catch (err) {
    console.error("❌ reloadLaporanAdminDataProd:", err);
    window.showToast("Gagal memuat data laporan admin", "error");
  }
}

async function reloadStockOpnameData() {
  try {
    const adminUid = window.auth?.currentUser?.uid;
    if (!adminUid) return;

    const mm    = String(rekapProdBulan + 1).padStart(2, "0");
    const start = `${rekapProdTahun}-${mm}-01`;
    const end   = `${rekapProdTahun}-${mm}-31`;

    const snap = await window.getDocs(window.query(
      window.collection(window.db, "users", adminUid, "stockOpname"),
      window.where("tanggal", ">=", start),
      window.where("tanggal", "<=", end)
    ));

    let count = 0;
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      await window.idb.saveStockOpname(data.tanggal || docSnap.id, data);
      count++;
    }

    window.showToast(`${count} data stock opname berhasil dimuat`, "success");
  } catch (err) {
    console.error("❌ reloadStockOpnameData:", err);
    window.showToast("Gagal memuat data stock opname", "error");
  }
}