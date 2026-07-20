/* ── AUDIT BARANG MENTAH: DATA & RENDER (UI placeholder, data dummy) ── */
let auditBahanList = [];
let auditBulan = new Date().getMonth();
let auditTahun = new Date().getFullYear();

async function loadAuditBelanjaAggregates() {
  const result = {};
  try {
    const bulanStr = String(auditBulan + 1).padStart(2, "0");
    const prefix   = `${auditTahun}-${bulanStr}`;

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
    console.error("❌ loadAuditBelanjaAggregates:", err);
  }
  return result;
}
async function loadAuditBelanjaLoyangAgg() {
  const result = {}; // { [jenisPaket]: totalQty }
  try {
    const adminUid = window.auth?.currentUser?.uid;
    if (!adminUid) return result;

    const periode = `${auditTahun}-${String(auditBulan + 1).padStart(2, "0")}`;

    const snap = await window.getDocs(window.query(
      window.collection(window.db, "users", adminUid, "pembelianBahanBaku"),
      window.where("periode", "==", periode)
    ));

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const jenisPaket = data.jenisPaket || "Lainnya";
      const qty = Number(data.qty) || 0;
      result[jenisPaket] = (result[jenisPaket] || 0) + qty;
    });
  } catch (err) {
    console.error("❌ loadAuditBelanjaLoyangAgg:", err);
  }
  return result;
}
async function loadAuditVarianProduksiAgg() {
  const result = {}; // { CB: 10, BB: 715, ... }
  try {
    const bulanStr = String(auditBulan + 1).padStart(2, "0");
    const prefix   = `${auditTahun}-${bulanStr}`;

    const allRecords = await window.idb.getAllStockOpname();
    const filtered = allRecords.filter(r => (r.tanggal || "").startsWith(prefix));

    filtered.forEach(record => {
      const data = record.data || {};
      const produksiMap = data.produksi || {};
      Object.entries(produksiMap).forEach(([key, val]) => {
        result[key] = (result[key] || 0) + (Number(val) || 0);
      });
    });
  } catch (err) {
    console.error("❌ loadAuditVarianProduksiAgg:", err);
  }
  return result;
}
async function loadAuditPengeluaranAgg() {
  const result = {};
  try {
    const adminUid = window.auth?.currentUser?.uid;
    if (!adminUid) return result;

    const mm    = String(auditBulan + 1).padStart(2, "0");
    const start = `${auditTahun}-${mm}-01`;
    const end   = `${auditTahun}-${mm}-31`;

    const snap = await window.getDocs(window.query(
      window.collection(window.db, "users", adminUid, "pengeluaran"),
      window.where("tanggal", ">=", start),
      window.where("tanggal", "<=", end)
    ));

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const produksi = data.produksi || [];

      produksi.forEach(item => {
        if (item.jenis !== "variable") return;
        const nama = item.nama || "Lainnya";
        const qty  = Number(item.qty) || 0;
        result[nama] = (result[nama] || 0) + qty;
      });
    });
  } catch (err) {
    console.error("❌ loadAuditPengeluaranAgg:", err);
  }
  return result;
}
async function loadAuditFixedTotal() {
  let total = 0;
  try {
    const adminUid = window.auth?.currentUser?.uid;
    if (!adminUid) return total;

    const mm    = String(auditBulan + 1).padStart(2, "0");
    const start = `${auditTahun}-${mm}-01`;
    const end   = `${auditTahun}-${mm}-31`;

    const snap = await window.getDocs(window.query(
      window.collection(window.db, "users", adminUid, "pengeluaran"),
      window.where("tanggal", ">=", start),
      window.where("tanggal", "<=", end)
    ));

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const produksi = data.produksi || [];

      produksi.forEach(item => {
        if (item.jenis !== "fixed") return;
        total += Number(item.nominal) || 0;
      });
    });
  } catch (err) {
    console.error("❌ loadAuditFixedTotal:", err);
  }
  return total;
}
async function loadAuditSlipGajiTotal() {
  let total = 0;
  try {
    const periode = `${auditTahun}-${String(auditBulan + 1).padStart(2, "0")}`;

    const allUsers = await window.idb.getUsers();
    const relevantUsers = (allUsers || []).filter(
      u => u.role === "adminCabang" || u.role === "produksi"
    );

    if (!relevantUsers.length) return total;

    const hasilPerUser = await Promise.all(
      relevantUsers.map(async u => {
        try {
          const snap = await window.getDoc(window.doc(window.db, "users", u.uid, "slipGaji", periode));
          if (!snap.exists()) return 0;
          return Number(snap.data()?.totalPendapatan) || 0;
        } catch (err) {
          console.error(`❌ loadAuditSlipGajiTotal (${u.uid}):`, err);
          return 0;
        }
      })
    );

    total = hasilPerUser.reduce((a, b) => a + b, 0);
  } catch (err) {
    console.error("❌ loadAuditSlipGajiTotal:", err);
  }
  return total;
}
async function loadAuditStockAkhirBulanLalu(periodeSekarang) {
  const result = {};
  const adminUid = window.auth?.currentUser?.uid;
  if (!adminUid) return result;

  try {
    const snap = await window.getDocs(window.query(
      window.collection(window.db, "users", adminUid, "audit"),
      window.where("periode", "<", periodeSekarang),
      window.orderBy("periode", "desc"),
      window.limit(1)
    ));

    if (snap.empty) return result;

    const docData = snap.docs[0].data();
    const rows = docData.data || [];
    rows.forEach(r => {
      const key = `${r.kategori || "loyang"}::${r.nama || ""}`;
      result[key] = Number(r.stockAkhir) || 0;
    });
  } catch (err) {
    console.error("❌ loadAuditStockAkhirBulanLalu:", err);
  }
  return result;
}
async function loadAuditBahanList() {
  const kantorCabang = await idb.getKantorCabang();
  const loyangList    = kantorCabang?.loyang || [];
  const variableList  = kantorCabang?.pengeluaran?.variable || [];
  const varianMap     = kantorCabang?.varian || {};
  const belanjaAgg        = await loadAuditBelanjaAggregates();
  const belanjaLoyangAgg  = await loadAuditBelanjaLoyangAgg();
  const pengeluaranAgg    = await loadAuditPengeluaranAgg();
  const varianProduksiAgg = await loadAuditVarianProduksiAgg();

  const dariLoyang = loyangList
    .filter(l => l.status === true)
    .map((l, i) => ({
      id: "loy-" + i,
      nama: "Paket " + l.jenisLoyang,
      kategori: "loyang",
      stockAwal: 0,
      belanja: belanjaLoyangAgg[l.jenisLoyang] || 0,
      hppReal: belanjaAgg[l.jenisLoyang] || 0,
      stockAkhir: 0,
      hargaPaket: Number(l.hargaPaket) || 0
    }));

  const dariVariable = variableList.map((v, i) => ({
    id: "var-" + i,
    nama: v.jenis,
    kategori: "variable",
    stockAwal: 0,
    belanja: pengeluaranAgg[v.jenis] || 0,
    hppReal: 0,
    stockAkhir: 0,
    harga: Number(v.harga) || 0
  }));

  const dariVarian = Object.entries(varianMap).map(([key, nama]) => ({
    id: "varn-" + key,
    nama: nama,
    kategori: "varian",
    stockAwal: 0,
    belanja: 0,
    hppReal: varianProduksiAgg[key] || 0,
    stockAkhir: 0
  }));

  const gabungan = [...dariLoyang, ...dariVariable, ...dariVarian];

  const periodeSekarang = `${auditTahun}-${String(auditBulan + 1).padStart(2, "0")}`;
  const stockAwalMap = await loadAuditStockAkhirBulanLalu(periodeSekarang);

  auditBahanList = gabungan.map(row => {
    const key = `${row.kategori}::${row.nama}`;
    const stockAwalBulanLalu = stockAwalMap[key];
    return {
      ...row,
      stockAwal: stockAwalBulanLalu !== undefined ? stockAwalBulanLalu : row.stockAwal
    };
  });

  urutkanAuditBahanListPerKategori();
}

function urutkanAuditBahanListPerKategori() {
  const urutanKategori = ["loyang", "variable", "varian", "manual"];

  auditBahanList.sort((a, b) => {
    const idxA = urutanKategori.indexOf(a.kategori);
    const idxB = urutanKategori.indexOf(b.kategori);

    if (idxA !== idxB) return idxA - idxB;
    return (b.nama || "").localeCompare(a.nama || "", "id");
  });
}
function hitungAuditRow(row) {
  const stockAwal = Number(row.stockAwal) || 0;
  const belanja   = Number(row.belanja)   || 0;

  if (row.kategori === "variable" || row.kategori === "manual") {
    const saldo   = Number(row.stockAkhir) || 0;
    const hppReal = stockAwal + belanja + saldo;
    return { saldo, hppReal };
  }

  const hppReal = Number(row.hppReal) || 0;
  const saldo   = stockAwal + belanja + hppReal;
  return { saldo, hppReal };
}
function renderAuditTable() {
  const tbody = document.getElementById("auditTableBody");
  if (!tbody) return;

  if (!auditBahanList.length) {
    tbody.innerHTML = `<tr class="audit-empty-row"><td colspan="6">Belum ada bahan baku</td></tr>`;
    return;
  }

  tbody.innerHTML = auditBahanList.map(row => {
    const { saldo, hppReal } = hitungAuditRow(row);
    const belanja = Number(row.belanja) || 0;
    const belanjaCell = row.kategori === "manual"
      ? `<input type="number" min="0" class="audit-input audit-input-belanja" data-id="${row.id}" value="${row.belanja || ""}">`
      : `<span class="audit-readonly-val audit-readonly-belanja">${belanja ? belanja.toLocaleString("id-ID") : ""}</span>`;
    return `
      <tr data-id="${row.id}">
        <td class="audit-td-jenis">
          <span>${row.nama}</span>
        </td>
        <td>
          <input type="number" min="0" class="audit-input audit-input-stockawal" data-id="${row.id}" value="${row.stockAwal || ""}">
        </td>
        <td>
          ${belanjaCell}
        </td>
        <td>
          <span class="audit-readonly-val audit-readonly-hppreal">${hppReal ? hppReal.toLocaleString("id-ID") : ""}</span>
        </td>
        <td>
          <span class="audit-readonly-val audit-readonly-saldo ${saldo < 0 ? "negative" : ""}">${saldo ? saldo.toLocaleString("id-ID") : ""}</span>
        </td>
        <td>
          <input type="number" min="0" class="audit-input audit-input-stockakhir" data-id="${row.id}" value="${row.stockAkhir || ""}">
        </td>
      </tr>`;
  }).join("");
  attachAuditInputListeners();
}
function attachAuditInputListeners() {
  document.querySelectorAll(".audit-input-stockawal, .audit-input-stockakhir, .audit-input-belanja").forEach(input => {
    input.oninput = () => {
      const id  = input.dataset.id;
      const row = auditBahanList.find(r => r.id === id);
      if (!row) return;

      if (input.classList.contains("audit-input-stockawal"))  row.stockAwal  = Number(input.value) || 0;
      if (input.classList.contains("audit-input-stockakhir")) row.stockAkhir = Number(input.value) || 0;
      if (input.classList.contains("audit-input-belanja"))    row.belanja    = Number(input.value) || 0;

      const { saldo, hppReal } = hitungAuditRow(row);
      const tr = input.closest("tr");

      const saldoEl = tr.querySelector(".audit-readonly-saldo");
      saldoEl.textContent = saldo ? saldo.toLocaleString("id-ID") : "";
      saldoEl.classList.toggle("negative", saldo < 0);

      const hppRealEl = tr.querySelector(".audit-readonly-hppreal");
      hppRealEl.textContent = hppReal ? hppReal.toLocaleString("id-ID") : "";
      hppRealEl.classList.toggle("negative", hppReal < 0);
    };
  });
}

function openAuditAddModal() {
  const overlay = document.getElementById("auditAddModalOverlay");
  const input   = document.getElementById("auditAddModalInput");
  input.value = "";
  overlay.classList.add("show");
  setTimeout(() => input.focus(), 50);
}
function closeAuditAddModal() {
  document.getElementById("auditAddModalOverlay")?.classList.remove("show");
}
function confirmAuditAddModal() {
  const input = document.getElementById("auditAddModalInput");
  const nama  = input.value.trim();
  if (!nama) { input.focus(); return; }

  auditBahanList.push({
    id: "b" + Date.now(),
    nama,
    kategori: "manual",
    stockAwal: 0,
    belanja: 0,
    hppReal: 0,
    stockAkhir: 0
  });
  renderAuditTable();
  closeAuditAddModal();
}

function initAuditFilter() {
  const bulanBtn = document.getElementById("auditBulanBtn");
  const tahunBtn = document.getElementById("auditTahunBtn");
  const bulanDD  = document.getElementById("auditBulanDropdown");
  const tahunDD  = document.getElementById("auditTahunDropdown");
  if (!bulanBtn || !tahunBtn) return;

  document.getElementById("auditBulanLabel").textContent = REKAP_PROD_BULAN_NAMA[auditBulan];
  document.getElementById("auditTahunLabel").textContent = auditTahun;

  const now = new Date().getFullYear();
  tahunDD.innerHTML = [now-1, now, now+1].map(y =>
    `<div class="rekap-dist-dropdown-option ${y===auditTahun?"selected":""}" data-tahun="${y}">${y}</div>`
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
      auditBulan = Number(opt.dataset.bulan);
      document.getElementById("auditBulanLabel").textContent = REKAP_PROD_BULAN_NAMA[auditBulan];
      bulanDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      closeAll();
      await loadAuditBahanList();
      renderAuditTable();
      await loadAuditPreview();
    });
  });

  tahunDD.addEventListener("click", async e => {
    e.stopPropagation();
    const opt = e.target.closest(".rekap-dist-dropdown-option");
    if (!opt) return;
    auditTahun = Number(opt.dataset.tahun);
    document.getElementById("auditTahunLabel").textContent = auditTahun;
    tahunDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    await loadAuditBahanList();
    renderAuditTable();
    await loadAuditPreview();
  });

  document.getElementById("auditReloadBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("auditReloadBtn");
    btn.classList.add("spinning");
    await reloadStockOpnameData();
    await loadAuditBahanList();
    renderAuditTable();
    await loadAuditPreview();
    btn.classList.remove("spinning");
  });
}

function hitungHppRealDanHasilAudit(dataBahan, hasilFixed = 0, hasilGaji = 0) {
  let hasilLoyang = 0;
  let hasilVariable = 0;
  let totalSaldoVarian = 0;
  let totalStockAkhirVarian = 0;

  dataBahan.forEach(row => {
    if (row.kategori === "loyang") {
      hasilLoyang += (Number(row.saldo) || 0) * (Number(row.hargaPaket) || 0);
    }
    if (row.kategori === "variable") {
      hasilVariable += (Number(row.saldo) || 0) * (Number(row.harga) || 0);
    }
    if (row.kategori === "varian") {
      totalSaldoVarian      += Number(row.saldo)      || 0;
      totalStockAkhirVarian += Number(row.stockAkhir) || 0;
    }
  });

  const hasilJumlah = hasilLoyang + hasilVariable + Number(hasilFixed || 0) + Number(hasilGaji || 0);
  const hppReal     = totalSaldoVarian !== 0 ? hasilJumlah / totalSaldoVarian : 0;
  const hasilAudit  = hppReal * totalStockAkhirVarian;

  return { hppReal, hasilAudit };
}
async function simpanAuditData() {
  const adminUid = window.auth?.currentUser?.uid;
  if (!adminUid) {
    window.showToast("User tidak terdeteksi", "error");
    return;
  }

  const periode = `${auditTahun}-${String(auditBulan + 1).padStart(2, "0")}`; // YYYY-MM

  const dataBahan = auditBahanList.map(row => {
    const { saldo, hppReal } = hitungAuditRow(row);
    return {
      id: row.id,
      nama: row.nama,
      kategori: row.kategori || "loyang",
      stockAwal: Number(row.stockAwal) || 0,
      belanja: Number(row.belanja) || 0,
      hppReal: hppReal,
      saldo: saldo,
      stockAkhir: Number(row.stockAkhir) || 0,
      hargaPaket: Number(row.hargaPaket) || 0,
      harga: Number(row.harga) || 0
    };
  });

  const hasilFixed = await loadAuditFixedTotal();
  const hasilGaji  = await loadAuditSlipGajiTotal();
  const { hppReal, hasilAudit } = hitungHppRealDanHasilAudit(dataBahan, hasilFixed, hasilGaji);

  try {
    await window.setDoc(window.doc(window.db, "users", adminUid, "audit", periode), {
      periode,
      createdBy: adminUid,
      data: dataBahan,
      hppReal,
      hasilAudit,
      hasilFixed,
      hasilGaji,
      updatedAt: new Date().toISOString()
    });
    window.showToast("Data audit berhasil disimpan", "success");
    await loadAuditPreview();
  } catch (err) {
    console.error("❌ simpanAuditData:", err);
    window.showToast("Gagal menyimpan data audit", "error");
  }
}

function updateAuditFixedGajiCards(hasilFixed, hasilGaji) {
  const fixedEl = document.getElementById("auditKpiFixed");
  const gajiEl  = document.getElementById("auditKpiGaji");
  if (fixedEl) fixedEl.textContent = `Rp ${Number(hasilFixed || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
  if (gajiEl)  gajiEl.textContent  = `Rp ${Number(hasilGaji  || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
}
function updateAuditKpiCards(docData) {
  const hppRealEl    = document.getElementById("auditKpiHppReal");
  const hasilAuditEl = document.getElementById("auditKpiHasilAudit");
  if (!hppRealEl || !hasilAuditEl) return;

  if (!docData) {
    hppRealEl.textContent    = "-";
    hasilAuditEl.textContent = "-";
    return;
  }

  const hppReal    = Number(docData.hppReal)    || 0;
  const hasilAudit = Number(docData.hasilAudit) || 0;

  hppRealEl.textContent    = `Rp ${hppReal.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
  hasilAuditEl.textContent = `Rp ${hasilAudit.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
}
function updateAuditPreviewPeriodeLabel() {
  const titleEl = document.querySelector(".audit-preview-title");
  if (!titleEl) return;

  const namaBulan = REKAP_PROD_BULAN_NAMA[auditBulan] || "";
  const teks = `Periode : ${namaBulan} ${auditTahun}`;

  let periodeEl = titleEl.querySelector(".audit-preview-periode");
  if (!periodeEl) {
    periodeEl = document.createElement("span");
    periodeEl.className = "audit-preview-periode";
    titleEl.appendChild(periodeEl);
  }
  periodeEl.textContent = teks;
}
async function loadAuditPreview() {
  const body = document.getElementById("auditPreviewBody");
  if (!body) return;

  updateAuditPreviewPeriodeLabel();

  const adminUid = window.auth?.currentUser?.uid;
  if (!adminUid) return;

  const periode = `${auditTahun}-${String(auditBulan + 1).padStart(2, "0")}`;

  // hasilFixed & hasilGaji selalu live query, gak tergantung sudah disimpan atau belum
  const [hasilFixedLive, hasilGajiLive] = await Promise.all([
    loadAuditFixedTotal(),
    loadAuditSlipGajiTotal()
  ]);
  updateAuditFixedGajiCards(hasilFixedLive, hasilGajiLive);

  try {
    const snap = await window.getDoc(window.doc(window.db, "users", adminUid, "audit", periode));

    if (!snap.exists()) {
      body.innerHTML = `<div class="audit-preview-empty">Belum ada data tersimpan untuk periode ini</div>`;
      updateAuditKpiCards(null);
      return;
    }

    const docData  = snap.data();
    const rows = docData.data || [];

    updateAuditKpiCards(docData);

    if (!rows.length) {
      body.innerHTML = `<div class="audit-preview-empty">Belum ada data tersimpan untuk periode ini</div>`;
      return;
    }

    const rowsHtml = rows.map(r => {
      const stockAwal  = Number(r.stockAwal)  || 0;
      const belanja    = Number(r.belanja)    || 0;
      const hppReal    = Number(r.hppReal)    || 0;
      const saldo      = Number(r.saldo)      || 0;
      const stockAkhir = Number(r.stockAkhir) || 0;
      return `
      <tr>
        <td>${r.nama || "-"}</td>
        <td>${stockAwal  ? stockAwal.toLocaleString("id-ID")  : ""}</td>
        <td>${belanja    ? belanja.toLocaleString("id-ID")    : ""}</td>
        <td>${hppReal    ? hppReal.toLocaleString("id-ID")    : ""}</td>
        <td>${saldo      ? saldo.toLocaleString("id-ID")      : ""}</td>
        <td>${stockAkhir ? stockAkhir.toLocaleString("id-ID") : ""}</td>
      </tr>
    `;
    }).join("");

    body.innerHTML = `
      <table class="audit-preview-table">
        <thead>
          <tr>
            <th>Jenis Bahan Baku</th>
            <th>Stock Awal</th>
            <th>Belanja</th>
            <th>Hpp Real</th>
            <th>Saldo</th>
            <th>Stock Akhir</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  } catch (err) {
    console.error("❌ loadAuditPreview:", err);
    body.innerHTML = `<div class="audit-preview-empty">Gagal memuat data preview</div>`;
  }
}

/* ── AUDIT BARANG MENTAH VIEW ── */
window.initAuditProduksiView = function() {
  initAuditFilter();
  document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='audit']").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll("#rekapProduksiList .lap-kurir-item").forEach(x => x.classList.remove("active"));
      item.classList.add("active");

      window.activateRekapProdPanel("auditProduksiDetailWrapper");

      document.getElementById("auditProduksiEmpty").style.display   = "none";
      document.getElementById("auditProduksiContent").style.display = "flex";
      if (window.innerWidth <= 768) {
        const backBtn = document.getElementById("auditProduksiBackBtn");
        if (backBtn) backBtn.style.display = "flex";
      }
      loadAuditBahanList().then(renderAuditTable);
      loadAuditPreview();
    });
  });

  document.getElementById("auditAddBtn")?.addEventListener("click", openAuditAddModal);
  document.getElementById("auditAddModalCancel")?.addEventListener("click", closeAuditAddModal);
  document.getElementById("auditAddModalConfirm")?.addEventListener("click", confirmAuditAddModal);
  document.getElementById("auditAddModalOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "auditAddModalOverlay") closeAuditAddModal();
  });
  document.getElementById("auditAddModalInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmAuditAddModal();
    if (e.key === "Escape") closeAuditAddModal();
  });

  document.getElementById("auditSaveBtn")?.addEventListener("click", simpanAuditData);

  document.getElementById("auditProduksiBackBtn")?.addEventListener("click", () => {
    document.getElementById("auditProduksiDetailWrapper").style.setProperty("display", "none", "important");
    document.getElementById("auditProduksiDetailWrapper")?.classList.remove("show");
    document.getElementById("auditProduksiBackBtn").style.display = "none";
    document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='audit']").forEach(x => x.classList.remove("active"));
    showRekapProdListMobile();
  });

};