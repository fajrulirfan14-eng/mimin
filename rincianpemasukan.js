/* ── RINCIAN PEMASUKAN & PENGELUARAN (REKAP DISTRIBUSI) VIEW ── */
let rincianPemasukanBulan = new Date().getMonth();
let rincianPemasukanTahun = new Date().getFullYear();

function initRincianPemasukanFilter() {
  const bulanBtn = document.getElementById("rincianPemasukanBulanBtn");
  const tahunBtn = document.getElementById("rincianPemasukanTahunBtn");
  const bulanDD  = document.getElementById("rincianPemasukanBulanDropdown");
  const tahunDD  = document.getElementById("rincianPemasukanTahunDropdown");

  document.getElementById("rincianPemasukanBulanLabel").textContent = REKAP_DIST_BULAN_NAMA[rincianPemasukanBulan];
  document.getElementById("rincianPemasukanTahunLabel").textContent = rincianPemasukanTahun;

  bulanDD.innerHTML = REKAP_DIST_BULAN_NAMA.map((nama, idx) =>
    `<div class="rekap-dist-dropdown-option ${idx===rincianPemasukanBulan?"selected":""}" data-bulan="${idx}">${nama}</div>`
  ).join("");

  const now = new Date().getFullYear();
  tahunDD.innerHTML = [now-1, now, now+1].map(y =>
    `<div class="rekap-dist-dropdown-option ${y===rincianPemasukanTahun?"selected":""}" data-tahun="${y}">${y}</div>`
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

  bulanDD?.addEventListener("click", async e => {
    e.stopPropagation();
    const opt = e.target.closest(".rekap-dist-dropdown-option");
    if (!opt) return;
    rincianPemasukanBulan = Number(opt.dataset.bulan);
    document.getElementById("rincianPemasukanBulanLabel").textContent = REKAP_DIST_BULAN_NAMA[rincianPemasukanBulan];
    bulanDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();

    // sync balik ke rekapDist biar panel Rekapitulasi ikut
    rekapDistBulan = rincianPemasukanBulan;
    const rekapBulanLabel = document.getElementById("rekapDistBulanLabel");
    if (rekapBulanLabel) rekapBulanLabel.textContent = REKAP_DIST_BULAN_NAMA[rekapDistBulan];
    document.querySelectorAll("#rekapDistBulanDropdown .rekap-dist-dropdown-option").forEach(o => {
      o.classList.toggle("selected", Number(o.dataset.bulan) === rekapDistBulan);
    });

    await renderRincianPemasukanPanel();
  });

  tahunDD?.addEventListener("click", async e => {
    e.stopPropagation();
    const opt = e.target.closest(".rekap-dist-dropdown-option");
    if (!opt) return;
    rincianPemasukanTahun = Number(opt.dataset.tahun);
    document.getElementById("rincianPemasukanTahunLabel").textContent = rincianPemasukanTahun;
    tahunDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();

    // sync balik ke rekapDist biar panel Rekapitulasi ikut
    rekapDistTahun = rincianPemasukanTahun;
    const rekapTahunLabel = document.getElementById("rekapDistTahunLabel");
    if (rekapTahunLabel) rekapTahunLabel.textContent = rekapDistTahun;
    document.querySelectorAll("#rekapDistTahunDropdown .rekap-dist-dropdown-option").forEach(o => {
      o.classList.toggle("selected", Number(o.dataset.tahun) === rekapDistTahun);
    });

    await renderRincianPemasukanPanel();
  });

  document.getElementById("rincianPemasukanReloadBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("rincianPemasukanReloadBtn");
    btn.classList.add("spinning");
    const savedBulan = rekapDistBulan, savedTahun = rekapDistTahun;
    rekapDistBulan = rincianPemasukanBulan;
    rekapDistTahun = rincianPemasukanTahun;
    await reloadLaporanAdminData();
    rekapDistBulan = savedBulan;
    rekapDistTahun = savedTahun;
    await renderRincianPemasukanPanel();
    btn.classList.remove("spinning");
  });
}

window.syncRincianPemasukanFilter = function() {
  rincianPemasukanBulan = rekapDistBulan;
  rincianPemasukanTahun = rekapDistTahun;
  const bulanLabel = document.getElementById("rincianPemasukanBulanLabel");
  const tahunLabel = document.getElementById("rincianPemasukanTahunLabel");
  if (bulanLabel) bulanLabel.textContent = REKAP_DIST_BULAN_NAMA[rincianPemasukanBulan];
  if (tahunLabel) tahunLabel.textContent = rincianPemasukanTahun;

  document.getElementById("rincianPemasukanReloadBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("rincianPemasukanReloadBtn");
    btn.classList.add("spinning");
    await renderRincianPemasukanPanel();
    btn.classList.remove("spinning");
  });
}

const RINCIAN_PEMASUKAN_VARIAN_LIST = ["CB", "BB", "BK", "MC"];
async function loadRincianDistribusiPengeluaranAgg() {
  const result = {};
  try {
    const adminUid = window.auth?.currentUser?.uid;
    if (!adminUid) return result;

    const mm    = String(rincianPemasukanBulan + 1).padStart(2, "0");
    const start = `${rincianPemasukanTahun}-${mm}-01`;
    const end   = `${rincianPemasukanTahun}-${mm}-31`;

    const snap = await window.getDocs(window.query(
      window.collection(window.db, "users", adminUid, "pengeluaran"),
      window.where("tanggal", ">=", start),
      window.where("tanggal", "<=", end)
    ));

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const distribusi = data.distribusi || [];

      distribusi.forEach(item => {
        const jenis   = item.jenis || "Lainnya";
        const nama    = item.nama  || "Tanpa Nama";
        const qty     = Number(item.qty)     || 0;
        const nominal = Number(item.nominal) || 0;

        if (!result[jenis]) result[jenis] = { qty: 0, nominal: 0, items: {} };
        result[jenis].qty     += qty;
        result[jenis].nominal += nominal;

        if (!result[jenis].items[nama]) result[jenis].items[nama] = { qty: 0, nominal: 0 };
        result[jenis].items[nama].qty     += qty;
        result[jenis].items[nama].nominal += nominal;
      });
    });
  } catch (err) {
    console.error("❌ loadRincianDistribusiPengeluaranAgg:", err);
  }

  return result;
}

function renderRincianDistribusiPengeluaranTable(groupedData) {
  const tbody = document.getElementById("rincianPengeluaranDistribusiTableBody");
  if (!tbody) return 0;

  const jenisKeys = Object.keys(groupedData || {});

  if (!jenisKeys.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="rincian-peng-empty">Belum ada data pengeluaran</td></tr>`;
    return 0;
  }

  let totalNominal = 0;

  tbody.innerHTML = jenisKeys.map(jenis => {
    const data = groupedData[jenis];
    const slug = "dist-" + jenis.toLowerCase().replace(/\s+/g, "-");
    totalNominal += data.nominal || 0;

    const namaRows = Object.entries(data.items || {}).map(([nama, item]) => `
      <tr class="rincian-peng-nama-row" data-parent="${slug}">
        <td>${nama}</td>
        <td>${item.qty ? item.qty.toLocaleString("id-ID") : ""}</td>
        <td>${item.nominal ? item.nominal.toLocaleString("id-ID") : ""}</td>
      </tr>
    `).join("");

    return `
      <tr class="rincian-peng-jenis-row" data-jenis="${slug}">
        <td class="rincian-prod-td-nama"><span class="rincian-peng-chevron">▶</span>${jenis}</td>
        <td>${data.qty ? data.qty.toLocaleString("id-ID") : ""}</td>
        <td>${data.nominal ? data.nominal.toLocaleString("id-ID") : ""}</td>
      </tr>
      ${namaRows}
    `;
  }).join("");

  tbody.innerHTML += `
    <tr class="rincian-peng-total-row">
      <td class="rincian-prod-td-nama">Total</td>
      <td></td>
      <td>${totalNominal ? totalNominal.toLocaleString("id-ID") : ""}</td>
    </tr>
  `;

  return totalNominal;
}

function initRincianDistribusiPengeluaranToggle() {
  const tbody = document.getElementById("rincianPengeluaranDistribusiTableBody");
  if (!tbody) return;

  tbody.addEventListener("click", e => {
    const row = e.target.closest(".rincian-peng-jenis-row");
    if (!row) return;

    const slug = row.dataset.jenis;
    row.classList.toggle("expanded");

    document.querySelectorAll(`.rincian-peng-nama-row[data-parent="${slug}"]`).forEach(r => {
      r.classList.toggle("show");
    });
  });
}

async function hitungPemasukanPay() {
  // hasil: { CB: { qty, nominal }, BB: { qty, nominal }, ... }
  const result = {};
  RINCIAN_PEMASUKAN_VARIAN_LIST.forEach(v => { result[v] = { qty: 0, nominal: 0 }; });

  try {
    if (!window.usersCache?.length) {
      window.usersCache = await window.idb.getUsers();
    }
    const users = (window.usersCache || []).filter(u => u.role === "kurir");
    if (!users.length) return result;

    const allLaporan = await window.idb.getAllLaporanAdmin();
    const mm = String(rincianPemasukanBulan + 1).padStart(2, "0");
    const filteredLaporan = allLaporan.filter(l => l.tanggal?.startsWith(`${rincianPemasukanTahun}-${mm}`));

    users.forEach(u => {
      const hargaMap = {};
      (u.varian || []).forEach(v => {
        const key = Object.keys(v)[0];
        if (key) hargaMap[key] = {
          konsumen: Number(v[key]?.hargaKonsumen) || 0,
          produksi: Number(v[key]?.hargaProduksi) || 0,
        };
      });

      const payQty = {};
      RINCIAN_PEMASUKAN_VARIAN_LIST.forEach(v => { payQty[v] = 0; });

      filteredLaporan.forEach(l => {
        const dist = l.data?.[u.uid]?.distribusi;
        if (!dist) return;
        RINCIAN_PEMASUKAN_VARIAN_LIST.forEach(v => {
          payQty[v] += Number(dist.pay?.[v]) || 0;
        });
      });

      RINCIAN_PEMASUKAN_VARIAN_LIST.forEach(v => {
        const harga  = hargaMap[v] || { konsumen: 0, produksi: 0 };
        const margin = harga.konsumen - harga.produksi;
        result[v].qty     += payQty[v];
        result[v].nominal += payQty[v] * margin;
      });
    });
  } catch (err) {
    console.error("❌ hitungPemasukanPay:", err);
  }

  return result;
}
async function loadRincianDistSlipGajiPerUser(kurirUid, periode) {
  try {
    const snap = await window.getDoc(window.doc(window.db, "users", kurirUid, "slipGaji", periode));
    if (!snap.exists()) return 0;

    const data = snap.data();
    return Number(data.totalPenerimaan) || 0;
  } catch (err) {
    console.error(`❌ loadRincianDistSlipGajiPerUser (${kurirUid}):`, err);
    return 0;
  }
}
async function gabungkanGajiKeRincianPengeluaranDistribusi(groupedData) {
  const jenisGaji = "Total Pemberian Gaji";
  const periode = `${rincianPemasukanTahun}-${String(rincianPemasukanBulan + 1).padStart(2, "0")}`;

  try {
    if (!window.usersCache?.length) {
      window.usersCache = await window.idb.getUsers();
    }
    const kurirList = (window.usersCache || []).filter(u => u.role === "kurir");

    if (!kurirList.length) return;

    const hasilPerKurir = await Promise.all(
      kurirList.map(async u => {
        const nama = u.nama || "Tanpa Nama";
        const nominal = await loadRincianDistSlipGajiPerUser(u.uid, periode);
        return { nama, nominal };
      })
    );

    if (!groupedData[jenisGaji]) {
      groupedData[jenisGaji] = { qty: 0, nominal: 0, items: {} };
    }

    hasilPerKurir.forEach(({ nama, nominal }) => {
      groupedData[jenisGaji].items[nama] = { qty: 0, nominal };
      groupedData[jenisGaji].nominal += nominal;
    });
  } catch (err) {
    console.error("❌ gabungkanGajiKeRincianPengeluaranDistribusi:", err);
  }
}
async function renderRincianPemasukanPanel() {
  const pemasukanTbody = document.getElementById("rincianPemasukanTable")?.querySelector("tbody");
  if (!pemasukanTbody) return;

  const payPerVarian = await hitungPemasukanPay();

  let totalPemasukan = 0;
  let totalQtyPemasukan = 0;
  const rows = RINCIAN_PEMASUKAN_VARIAN_LIST.map(v => {
    const { qty, nominal } = payPerVarian[v] || { qty: 0, nominal: 0 };
    totalPemasukan += nominal;
    totalQtyPemasukan += qty;
    return `
      <tr>
        <td>${v}</td>
        <td>${qty ? qty.toLocaleString("id-ID") : "-"}</td>
        <td>${nominal ? "Rp " + nominal.toLocaleString("id-ID") : "Rp 0"}</td>
      </tr>`;
  }).join("");

  const totalRow = `
      <tr class="rincian-tabel-total-row">
        <td>Total</td>
        <td>${totalQtyPemasukan ? totalQtyPemasukan.toLocaleString("id-ID") : "-"}</td>
        <td>Rp ${totalPemasukan.toLocaleString("id-ID")}</td>
      </tr>`;

  pemasukanTbody.innerHTML = (rows || `<tr><td>-</td><td>-</td><td>Rp 0</td></tr>`) + totalRow;

  const pengeluaranAgg   = await loadRincianDistribusiPengeluaranAgg();
  await gabungkanGajiKeRincianPengeluaranDistribusi(pengeluaranAgg);
  const totalPengeluaran = renderRincianDistribusiPengeluaranTable(pengeluaranAgg);
  const selisih          = totalPemasukan - totalPengeluaran;

  const totalPemasukanCard   = document.querySelector('.rincian-summary-card[data-tipe="pemasukan"] .rincian-summary-total');
  const totalPengeluaranCard = document.querySelector('.rincian-summary-card[data-tipe="pengeluaran"] .rincian-summary-total');
  const selisihCard          = document.querySelector('.rincian-summary-card[data-tipe="selisih"] .rincian-summary-total');

  if (totalPemasukanCard)   totalPemasukanCard.textContent   = `Rp ${totalPemasukan.toLocaleString("id-ID")}`;
  if (totalPengeluaranCard) totalPengeluaranCard.textContent = `Rp ${totalPengeluaran.toLocaleString("id-ID")}`;
  if (selisihCard) {
    selisihCard.textContent = `${selisih < 0 ? "-Rp " : "Rp "}${Math.abs(selisih).toLocaleString("id-ID")}`;
  }
}

window.openRincianPemasukanPanel = async function() {
  rincianPemasukanBulan = rekapDistBulan;
  rincianPemasukanTahun = rekapDistTahun;
  document.getElementById("rincianPemasukanBulanLabel").textContent = REKAP_DIST_BULAN_NAMA[rincianPemasukanBulan];
  document.getElementById("rincianPemasukanTahunLabel").textContent = rincianPemasukanTahun;
  document.getElementById("rincianPemasukanDetailWrapper")?.classList.add("show");

  if (window.innerWidth <= 768) {
    history.pushState({ panel: true }, "", "");
    const backBtn = document.getElementById("rincianPemasukanBackBtn");
    if (backBtn) backBtn.style.display = "flex";
  }

  await renderRincianPemasukanPanel();
};

window.initRincianPemasukanView = function() {
  initRincianPemasukanFilter();
  initRincianDistribusiPengeluaranToggle();

  document.getElementById("rincianPemasukanBackBtn")?.addEventListener("click", () => {
    document.getElementById("rincianPemasukanDetailWrapper")?.classList.remove("show");
    document.getElementById("rincianPemasukanBackBtn").style.display = "none";
    document.querySelectorAll("#rekapDistribusiList .lap-kurir-item").forEach(x => x.classList.remove("active"));
  });
};