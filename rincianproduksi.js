/* ── RINCIAN PRODUKSI VIEW ── */
let rincianProdVarianList = [];
let rincianProdMarketingList = [];
let rincianProdLaporanAgg = {};

async function loadRincianVarianList() {
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
    console.error("❌ loadRincianVarianList:", err);
    return [];
  }
}

async function loadRincianPengeluaranAgg() {
  const result = {};

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
      const produksi = data.produksi || [];

      produksi.forEach(item => {
        const jenis  = item.jenis || "Lainnya";
        const nama   = item.nama  || "Tanpa Nama";
        const qty    = Number(item.qty)     || 0;
        const nominal = Number(item.nominal) || 0;

        if (!result[jenis]) result[jenis] = { qty: 0, nominal: 0, items: {} };
        result[jenis].qty      += qty;
        result[jenis].nominal  += nominal;

        if (!result[jenis].items[nama]) result[jenis].items[nama] = { qty: 0, nominal: 0 };
        result[jenis].items[nama].qty     += qty;
        result[jenis].items[nama].nominal += nominal;
      });
    });
  } catch (err) {
    console.error("❌ loadRincianPengeluaranAgg:", err);
  }

  return result;
}

async function loadRincianLaporanAgg() {
  const result = {};
  try {
    const bulanStr = String(rekapProdBulan + 1).padStart(2, "0");
    const prefix   = `${rekapProdTahun}-${bulanStr}`;

    const allRecords = await window.idb.getAllLaporanAdmin();
    const filtered = allRecords.filter(r => (r.tanggal || "").startsWith(prefix));

    filtered.forEach(record => {
      const dataPerUid = record.data || {};
      Object.entries(dataPerUid).forEach(([uid, uidData]) => {
        if (!result[uid]) result[uid] = { order: {}, pembayaran: 0, keterangan: 0 };

        const closing = uidData?.pembayaran?.closing || {};
        Object.entries(closing).forEach(([varian, nilai]) => {
          result[uid].order[varian] = (result[uid].order[varian] || 0) + Number(nilai || 0);
        });

        const bayar      = Number(uidData?.pembayaran?.nota?.bayar)      || 0;
        const keterangan = Number(uidData?.pembayaran?.nota?.keterangan) || 0;
        result[uid].pembayaran += bayar;
        result[uid].keterangan += keterangan;
      });
    });
  } catch (err) {
    console.error("❌ loadRincianLaporanAgg:", err);
  }

  return result;
}

async function loadRincianMarketingList() {
  try {
    const allUsers = await window.idb.getUsers();
    return allUsers.filter(u => u.role === "kurir" || u.role === "sales");
  } catch (err) {
    console.error("❌ loadRincianMarketingList:", err);
    return [];
  }
}

function renderRincianProdTable() {
  const theadTop = document.getElementById("rincianProdTableHeadTop");
  const theadSub = document.getElementById("rincianProdTableHeadSub");
  const tbody    = document.getElementById("rincianProdTableBody");
  if (!theadTop || !theadSub || !tbody) return;

  theadTop.innerHTML = `
    <th class="rincian-prod-th-nama" rowspan="2">Nama Marketing</th>
    <th colspan="${rincianProdVarianList.length}">Order</th>
    <th rowspan="2">Pembayaran</th>
    <th rowspan="2">Keterangan</th>
    <th rowspan="2">Total</th>
  `;

  // Header baris bawah: nama tiap varian (sub-kolom dari "Order")
  theadSub.innerHTML = rincianProdVarianList.map(v => `<th>${v}</th>`).join("");

  // Body: satu baris per marketing (kurir/sales)
  if (!rincianProdMarketingList.length) {
    const totalCols = 1 + rincianProdVarianList.length + 3;
    tbody.innerHTML = `<tr><td colspan="${totalCols}" style="text-align:center; color:#9ca3af; padding:20px;">Belum ada marketing (kurir/sales)</td></tr>`;
    return 0;
  }

  const grandTotal = {
    order: {},
    pembayaran: 0,
    keterangan: 0,
    total: 0
  };

  tbody.innerHTML = rincianProdMarketingList.map(u => {
    const agg         = rincianProdLaporanAgg[u.uid] || { order: {}, pembayaran: 0, keterangan: 0 };
    const pembayaran  = agg.pembayaran || 0;
    const keterangan  = agg.keterangan || 0;
    const total       = pembayaran + keterangan;

    rincianProdVarianList.forEach(v => {
      const nilai = agg.order[v] || 0;
      grandTotal.order[v] = (grandTotal.order[v] || 0) + nilai;
    });
    grandTotal.pembayaran += pembayaran;
    grandTotal.keterangan += keterangan;
    grandTotal.total      += total;

    return `
    <tr data-uid="${u.uid}">
      <td class="rincian-prod-td-nama">
        ${u.nama || "Tanpa Nama"}
        <span class="rincian-prod-role-badge">${u.role || "-"}</span>
      </td>
      ${rincianProdVarianList.map(v => {
        const nilai = agg.order[v];
        return `<td>${nilai ? nilai.toLocaleString("id-ID") : ""}</td>`;
      }).join("")}
      <td>${pembayaran ? pembayaran.toLocaleString("id-ID") : ""}</td>
      <td>${keterangan ? keterangan.toLocaleString("id-ID") : ""}</td>
      <td class="rincian-prod-td-total">${total ? total.toLocaleString("id-ID") : ""}</td>
    </tr>
  `;
  }).join("");

  // Baris Total keseluruhan
  tbody.innerHTML += `
    <tr class="rincian-prod-total-row">
      <td class="rincian-prod-td-nama">Total</td>
      ${rincianProdVarianList.map(v => {
        const nilai = grandTotal.order[v];
        return `<td>${nilai ? nilai.toLocaleString("id-ID") : ""}</td>`;
      }).join("")}
      <td>${grandTotal.pembayaran ? grandTotal.pembayaran.toLocaleString("id-ID") : ""}</td>
      <td>${grandTotal.keterangan ? grandTotal.keterangan.toLocaleString("id-ID") : ""}</td>
      <td class="rincian-prod-td-total">${grandTotal.total ? grandTotal.total.toLocaleString("id-ID") : ""}</td>
    </tr>
  `;

  return grandTotal.total;
}

async function refreshRincianProduksiData() {
  rincianProdVarianList     = await loadRincianVarianList();
  rincianProdMarketingList  = await loadRincianMarketingList();
  rincianProdLaporanAgg     = await loadRincianLaporanAgg();
  const totalPemasukan = renderRincianProdTable() || 0;

  const pengeluaranAgg   = await loadRincianPengeluaranAgg();
  const totalPengeluaran = renderRincianPengeluaranTable(pengeluaranAgg) || 0;

  const selisih = totalPemasukan - totalPengeluaran;

  const pemasukanCard   = document.getElementById("rincianProdTotalPemasukan");
  const pengeluaranCard = document.getElementById("rincianProdTotalPengeluaran");
  const selisihCard     = document.getElementById("rincianProdSelisih");

  if (pemasukanCard)   pemasukanCard.textContent   = `Rp ${totalPemasukan.toLocaleString("id-ID")}`;
  if (pengeluaranCard) pengeluaranCard.textContent = `Rp ${totalPengeluaran.toLocaleString("id-ID")}`;
  if (selisihCard) {
    selisihCard.textContent = `${selisih < 0 ? "-Rp " : "Rp "}${Math.abs(selisih).toLocaleString("id-ID")}`;
  }
}

function initRincianProdFilter() {
  const bulanBtn = document.getElementById("rincianProdBulanBtn");
  const tahunBtn = document.getElementById("rincianProdTahunBtn");
  const bulanDD  = document.getElementById("rincianProdBulanDropdown");
  const tahunDD  = document.getElementById("rincianProdTahunDropdown");

  document.getElementById("rincianProdBulanLabel").textContent = REKAP_PROD_BULAN_NAMA[rekapProdBulan];
  document.getElementById("rincianProdTahunLabel").textContent = rekapProdTahun;

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

      // sync label di kedua panel (Rekapitulasi & Rincian)
      document.getElementById("rekapProdBulanLabel").textContent    = REKAP_PROD_BULAN_NAMA[rekapProdBulan];
      document.getElementById("rincianProdBulanLabel").textContent  = REKAP_PROD_BULAN_NAMA[rekapProdBulan];

      bulanDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      closeAll();
      await refreshRincianProduksiData();
    });
  });

  tahunDD?.addEventListener("click", async e => {
    e.stopPropagation();
    const opt = e.target.closest(".rekap-dist-dropdown-option");
    if (!opt) return;
    rekapProdTahun = Number(opt.dataset.tahun);

    document.getElementById("rekapProdTahunLabel").textContent    = rekapProdTahun;
    document.getElementById("rincianProdTahunLabel").textContent  = rekapProdTahun;

    tahunDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    await refreshRincianProduksiData();
  });

  document.getElementById("rincianProdReloadBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("rincianProdReloadBtn");
    btn.classList.add("spinning");
    await reloadLaporanAdminDataProd();
    await refreshRincianProduksiData();
    btn.classList.remove("spinning");
  });
}

window.initRincianProduksiView = function() {
  initRincianProdFilter();
  initRincianPengeluaranToggle();
  document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='rincian']").forEach(item => {
    item.addEventListener("click", async () => {
      document.querySelectorAll("#rekapProduksiList .lap-kurir-item").forEach(x => x.classList.remove("active"));
      item.classList.add("active");

      window.activateRekapProdPanel("rincianProduksiDetailWrapper");

      document.getElementById("rincianProduksiEmpty").style.display   = "none";
      document.getElementById("rincianProduksiContent").style.display = "flex";

      if (window.innerWidth <= 768) {
        const backBtn = document.getElementById("rincianProduksiBackBtn");
        if (backBtn) backBtn.style.display = "flex";
      }

      await refreshRincianProduksiData();
    });
  });

  document.getElementById("rincianProduksiBackBtn")?.addEventListener("click", () => {
    document.getElementById("rincianProduksiDetailWrapper").style.setProperty("display", "none", "important");
    document.getElementById("rincianProduksiDetailWrapper")?.classList.remove("show");
    document.getElementById("rincianProduksiBackBtn").style.display = "none";
    document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='rincian']").forEach(x => x.classList.remove("active"));
  });

};

function renderRincianPengeluaranTable(groupedData) {
  const tbody = document.getElementById("rincianPengeluaranTableBody");
  if (!tbody) return;

  const jenisKeys = Object.keys(groupedData || {});

  if (!jenisKeys.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="rincian-peng-empty">Belum ada data pengeluaran</td></tr>`;
    return 0;
  }

  let totalNominal = 0;

  tbody.innerHTML = jenisKeys.map(jenis => {
    const data  = groupedData[jenis];
    const slug  = jenis.toLowerCase().replace(/\s+/g, "-");
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
function initRincianPengeluaranToggle() {
  const tbody = document.getElementById("rincianPengeluaranTableBody");
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
