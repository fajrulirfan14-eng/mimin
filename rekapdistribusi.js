/* ── REKAP DISTRIBUSI VIEW ── */
let rekapDistBulan = new Date().getMonth();
let rekapDistTahun = new Date().getFullYear();
const REKAP_DIST_BULAN_NAMA = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function initRekapDistFilter() {
  const bulanBtn = document.getElementById("rekapDistBulanBtn");
  const tahunBtn = document.getElementById("rekapDistTahunBtn");
  const bulanDD  = document.getElementById("rekapDistBulanDropdown");
  const tahunDD  = document.getElementById("rekapDistTahunDropdown");

  document.getElementById("rekapDistBulanLabel").textContent = REKAP_DIST_BULAN_NAMA[rekapDistBulan];
  document.getElementById("rekapDistTahunLabel").textContent = rekapDistTahun;

  const now = new Date().getFullYear();
  tahunDD.innerHTML = [now-1, now, now+1].map(y =>
    `<div class="rekap-dist-dropdown-option ${y===rekapDistTahun?"selected":""}" data-tahun="${y}">${y}</div>`
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
      rekapDistBulan = Number(opt.dataset.bulan);
      document.getElementById("rekapDistBulanLabel").textContent = REKAP_DIST_BULAN_NAMA[rekapDistBulan];
      bulanDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      closeAll();
      window.syncAssetsFilterLabel?.(false);
      await renderRekapDistribusiGrid();
    });
  });

  tahunDD?.addEventListener("click", async e => {
    e.stopPropagation();
    const opt = e.target.closest(".rekap-dist-dropdown-option");
    if (!opt) return;
    rekapDistTahun = Number(opt.dataset.tahun);
    document.getElementById("rekapDistTahunLabel").textContent = rekapDistTahun;
    tahunDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    window.syncAssetsFilterLabel?.(false);
    await renderRekapDistribusiGrid();
  });
}

/* ── HARI LIBUR POPUP ── */
function initHariLiburPopup() {
  ["rekapDistHariLiburBtn", "assetsHariLiburBtn", "slipGajiHariLiburBtn"].forEach(btnId => {
    document.getElementById(btnId)?.addEventListener("click", async () => {
      await openHariLiburPopup();
    });
  });

  document.getElementById("hariLiburBatalBtn")?.addEventListener("click", () => {
    document.getElementById("hariLiburOverlay").style.display = "none";
  });
  document.getElementById("hariLiburOverlay")?.addEventListener("click", e => {
    if (e.target.id === "hariLiburOverlay") e.currentTarget.style.display = "none";
  });

  document.getElementById("hariLiburSaveBtn")?.addEventListener("click", async () => {
    const btn   = document.getElementById("hariLiburSaveBtn");
    const input = document.getElementById("hariLiburInput");
    const jumlahHari = Number(input.value) || 0;

    btn.disabled = true; btn.textContent = "Menyimpan...";
    try {
      const adminUid     = window.auth?.currentUser?.uid;
      const kantorCabang = await window.idb.getKantorCabang();
      const bulanStr     = `${rekapDistTahun}-${String(rekapDistBulan + 1).padStart(2, "0")}`;

      await window.setDoc(
        window.doc(window.db, "users", adminUid, "hariLibur", bulanStr),
        {
          bulan: bulanStr,
          idCabang: kantorCabang?.id || "",
          jumlahHari,
        }
      );

      window.showToast("Hari libur berhasil disimpan", "success");
      document.getElementById("hariLiburOverlay").style.display = "none";
      await renderRekapDistribusiGrid();
    } catch (err) {
      console.error("❌ simpan hariLibur:", err);
      window.showToast("Gagal menyimpan", "error");
    } finally {
      btn.disabled = false; btn.textContent = "Simpan";
    }
  });
}

async function openHariLiburPopup() {
  const overlay = document.getElementById("hariLiburOverlay");
  const label   = document.getElementById("hariLiburPeriodeLabel");
  const input   = document.getElementById("hariLiburInput");

  label.textContent = `Periode: ${REKAP_DIST_BULAN_NAMA[rekapDistBulan]} ${rekapDistTahun}`;
  input.value = "";

  try {
    const adminUid = window.auth?.currentUser?.uid;
    const bulanStr = `${rekapDistTahun}-${String(rekapDistBulan + 1).padStart(2, "0")}`;
    const snap = await window.getDoc(window.doc(window.db, "users", adminUid, "hariLibur", bulanStr));
    if (snap.exists()) input.value = snap.data()?.jumlahHari || "";
  } catch (err) {
    console.error("❌ load hariLibur:", err);
  }

  overlay.style.display = "flex";
}

/* ── MAIN INIT ── */
window.initRekapDistribusiView = function() {
  initRekapDistFilter();
  initHariLiburPopup();
  window.initAssetsView?.();
  window.initSlipGajiPanel?.();

  document.querySelectorAll("#rekapDistribusiList .lap-kurir-item").forEach(item => {
    item.addEventListener("click", async () => {
      document.querySelectorAll("#rekapDistribusiList .lap-kurir-item").forEach(x => x.classList.remove("active"));
      item.classList.add("active");

      document.getElementById("rekapDistribusiDetailWrapper")?.classList.remove("show");
      document.getElementById("assetsDetailWrapper")?.classList.remove("show");
      document.getElementById("slipGajiDetailWrapper")?.classList.remove("show");

      if (item.dataset.id === "assets") {
        window.openAssetsPanel?.();
        return;
      }

      if (item.dataset.id === "slipgaji") {
        window.openSlipGajiPanel?.();
        return;
      }

      document.getElementById("rekapDistribusiEmpty").style.display   = "none";
      document.getElementById("rekapDistribusiContent").style.display = "flex";
      document.getElementById("rekapDistribusiDetailWrapper")?.classList.add("show");

      if (window.innerWidth <= 768) {
        const backBtn = document.getElementById("rekapDistribusiBackBtn");
        if (backBtn) backBtn.style.display = "flex";
      }

      await renderRekapDistribusiGrid();
    });
  });

  document.getElementById("rekapDistribusiBackBtn")?.addEventListener("click", () => {
    document.getElementById("rekapDistribusiDetailWrapper")?.classList.remove("show");
    document.getElementById("rekapDistribusiBackBtn").style.display = "none";
    document.querySelectorAll("#rekapDistribusiList .lap-kurir-item").forEach(x => x.classList.remove("active"));
  });

  document.getElementById("rekapDistReloadBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("rekapDistReloadBtn");
    btn.classList.add("spinning");
    await reloadLaporanAdminData();
    await reloadCustKurirData();
    await renderRekapDistribusiGrid();
    btn.classList.remove("spinning");
  });
};

/* ── RELOAD DATA LAPORAN ADMIN ── */
async function reloadLaporanAdminData() {
  try {
    const adminUid = window.auth?.currentUser?.uid;
    if (!adminUid) return;

    const mm    = String(rekapDistBulan + 1).padStart(2, "0");
    const start = `${rekapDistTahun}-${mm}-01`;
    const end   = `${rekapDistTahun}-${mm}-31`;

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

    window.showToast(`${count} data berhasil dimuat`, "success");
  } catch (err) {
    console.error("❌ reloadLaporanAdminData:", err);
    window.showToast("Gagal memuat data", "error");
  }
}

/* ── RELOAD DATA CUSTOMER (custKurir) ── */
async function reloadCustKurirData() {
  try {
    const kantorCabang = await window.idb.getKantorCabang();
    const idCabang = kantorCabang?.id || "";
    if (!idCabang) return;

    const snap = await window.getDocs(window.query(
      window.collection(window.db, "customer"),
      window.where("idCabang", "==", idCabang)
    ));

    const grouped = {};
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const uid  = data.pemilik;
      const hari = data.hari;
      if (!uid || !hari) return;
      const key = `${uid}_${hari}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ id: docSnap.id, ...data });
    });

    for (const key in grouped) {
      const [uid, hari] = key.split("_");
      await window.idb.saveCustKurir(uid, hari, grouped[key]);
    }

    return grouped;
  } catch (err) {
    console.error("❌ reloadCustKurirData:", err);
    return null;
  }
}
/* ── SHARED: HITUNG HARI KERJA & BONUS KEHADIRAN ── */
async function hitungJumlahHariKerja(bulan, tahun) {
  const kantorCabang = await window.idb.getKantorCabang();
  const hariLiburNama = kantorCabang?.hariLibur?.distribusi || "";
  const totalTanggalBulan = new Date(tahun, bulan + 1, 0).getDate();

  const HARI_NAMA_LIST = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const targetDay = HARI_NAMA_LIST.indexOf(hariLiburNama);
  let totalLiburMingguan = 0;
  if (targetDay >= 0) {
    for (let d = 1; d <= totalTanggalBulan; d++) {
      const date = new Date(tahun, bulan, d);
      if (date.getDay() === targetDay) totalLiburMingguan++;
    }
  }

  const adminUid = window.auth?.currentUser?.uid;
  const bulanStr = `${tahun}-${String(bulan + 1).padStart(2, "0")}`;
  let liburPerusahaan = 0;
  try {
    const liburSnap = await window.getDoc(window.doc(window.db, "users", adminUid, "hariLibur", bulanStr));
    if (liburSnap.exists()) liburPerusahaan = Number(liburSnap.data()?.jumlahHari) || 0;
  } catch (err) {
    console.error("❌ fetch hariLibur:", err);
  }

  return totalTanggalBulan - totalLiburMingguan - liburPerusahaan;
}

async function hitungBonusKehadiran(uid, bulan, tahun, jumlahHariKerjaCache = null, kantorCabangCache = null) {
  const allLaporan = await window.idb.getAllLaporanAdmin();
  const mm = String(bulan + 1).padStart(2, "0");
  const filteredLaporan = allLaporan.filter(l => l.tanggal?.startsWith(`${tahun}-${mm}`));

  const hariMasukKerja   = filteredLaporan.filter(l => l.data?.[uid]).length;
  const jumlahHariKerja  = jumlahHariKerjaCache  ?? await hitungJumlahHariKerja(bulan, tahun);
  const kantorCabang     = kantorCabangCache     ?? await window.idb.getKantorCabang();
  const bonusKehadiranNilai = Number(kantorCabang?.bonus?.kehadiran) || 0;
  const bonusKehadiran = hariMasukKerja >= jumlahHariKerja ? bonusKehadiranNilai : 0;

  return { hariMasukKerja, jumlahHariKerja, bonusKehadiran };
}

window.hitungJumlahHariKerja  = hitungJumlahHariKerja;
window.hitungBonusKehadiran   = hitungBonusKehadiran;
/* ── RENDER GRID REKAPITULASI ── */
async function renderRekapDistribusiGrid() {
  const gridEl = document.getElementById("rekapDistGrid");
  if (!gridEl) return;
  gridEl.innerHTML = `<div class="dh-ringkasan-empty">Memuat...</div>`;

  if (!window.usersCache?.length) {
    window.usersCache = await window.idb.getUsers();
  }
  const users = (window.usersCache || []).filter(u => u.role === "kurir");
  if (!users.length) {
    gridEl.innerHTML = `<div class="dh-ringkasan-empty">Belum ada kurir</div>`;
    return;
  }

  const allLaporan = await window.idb.getAllLaporanAdmin();
  const mm = String(rekapDistBulan + 1).padStart(2, "0");
  const filteredLaporan = allLaporan.filter(l => l.tanggal?.startsWith(`${rekapDistTahun}-${mm}`));

  const varianList = ["CB", "BB", "BK", "MC"];

  const jumlahHariKerjaGlobal = await hitungJumlahHariKerja(rekapDistBulan, rekapDistTahun);

  // fetch sekali di luar loop — dipakai untuk semua kurir
  const kantorCabangShared = await window.idb.getKantorCabang();
  const adminUidShared = window.auth?.currentUser?.uid;
  const bulanStrShared  = `${rekapDistTahun}-${String(rekapDistBulan + 1).padStart(2, "0")}`;
  let jumlahHariLiburPerusahaanShared = 0;
  try {
    const liburSnapShared = await window.getDoc(window.doc(window.db, "users", adminUidShared, "hariLibur", bulanStrShared));
    if (liburSnapShared.exists()) jumlahHariLiburPerusahaanShared = Number(liburSnapShared.data()?.jumlahHari) || 0;
  } catch (err) {
    console.error("❌ fetch hariLibur (shared):", err);
  }
  const upahHarianShared = Number(kantorCabangShared?.upahHarian) || 0;
  const bonusHariLiburPerusahaanShared = jumlahHariLiburPerusahaanShared * upahHarianShared;

  const cardsHtml = [];
  const chartData = [];

  for (const u of users) {
    const nama    = u.nama || "Tanpa Nama";
    const inisial = nama.trim().charAt(0).toUpperCase();
    const avatar  = u.foto
      ? `<img class="rekap-dist-avatar" src="${esc(u.foto)}" alt="${esc(nama)}">`
      : `<div class="rekap-dist-avatar">${esc(inisial)}</div>`;

    const pay      = {};
    const expired  = {};
    varianList.forEach(v => { pay[v] = 0; expired[v] = 0; });

    let customerNew = 0, customerPutus = 0;
    let targetData = 0, targetCustomer = 0, klaimInsentif = 0, kasbon = 0;
    let potonganTargetData = 0, potonganTargetCustomer = 0;
    let bonusTargetHarian = 0, bonusPay = 0, bonusInsentif = 0;
    let jumlahCustomer = 0;
    const bonusInfo = await hitungBonusKehadiran(u.uid, rekapDistBulan, rekapDistTahun, jumlahHariKerjaGlobal, kantorCabangShared);
    const bonusKehadiran   = bonusInfo.bonusKehadiran;
    const jumlahHariKerja  = bonusInfo.jumlahHariKerja;
    const hariMasukKerja   = bonusInfo.hariMasukKerja;
    const jumlahHariLiburPerusahaan = jumlahHariLiburPerusahaanShared;
    const bonusHariLiburPerusahaan  = bonusHariLiburPerusahaanShared;
    let customerPutusIdb = 0;
    const HARI_LIST = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
    for (const h of HARI_LIST) {
      const custHari = await window.idb.getCustKurir(u.uid, h);
      if (custHari?.length) {
        jumlahCustomer  += custHari.filter(c => c.status === true).length;
        customerPutusIdb += custHari.filter(c => c.status === false).length;
      }
    }

    const upahHunter = Number(kantorCabangShared?.upahHunter) || 0;
    const nominalJumlahCustomer = jumlahCustomer * upahHunter;

    filteredLaporan.forEach(l => {
      const d = l.data?.[u.uid];
      if (!d) return;

      const dist = d.distribusi || {};
      varianList.forEach(v => {
        pay[v]     += Number(dist.pay?.[v])     || 0;
        expired[v] += Number(dist.expired?.[v]) || 0;
      });

      customerNew    += Number(dist.infoTarget?.customerNew) || 0;
      customerPutus  += Number(dist.infoTarget?.putus)       || 0;
      targetData     += Number(dist.infoTarget?.targetData)  || 0;
      targetCustomer += Number(dist.infoTarget?.targetCustomer) || 0;
      potonganTargetData     += Number(dist.infoTarget?.potongan?.potonganTargetData)     || 0;
      potonganTargetCustomer += Number(dist.infoTarget?.potongan?.potonganTargetCustomer) || 0;
      klaimInsentif  += Number(dist.keuangan?.klaimInsentif) || 0;
      kasbon         += Number(dist.keuangan?.kasbon)        || 0;
      bonusTargetHarian += Number(dist.keuangan?.bonus?.bonusKunjungan) || 0;
      bonusPay          += Number(dist.keuangan?.bonus?.bonusPay)       || 0;
      bonusInsentif     += Number(dist.keuangan?.bonus?.bonusInsentif)  || 0;
    });

    const hargaMap = {};
    (u.varian || []).forEach(v => {
      const key = Object.keys(v)[0];
      if (key) hargaMap[key] = {
        konsumen: Number(v[key]?.hargaKonsumen) || 0,
        produksi: Number(v[key]?.hargaProduksi) || 0,
      };
    });

    const buildPayRows = () => varianList.map(v => {
      const qty    = pay[v] || 0;
      const harga  = hargaMap[v] || { konsumen: 0, produksi: 0 };
      const margin = harga.konsumen - harga.produksi;
      const nominal = qty * margin;
      return `<tr><td>${v}</td><td>${qty || "-"}</td><td>${nominal ? nominal.toLocaleString("id-ID") : "-"}</td></tr>`;
    }).join("");

    const buildExpiredRows = () => varianList.map(v => {
      const qty    = expired[v] || 0;
      const harga  = hargaMap[v] || { produksi: 0 };
      const nominal = qty * harga.produksi;
      return `<tr><td>${v}</td><td>${qty || "-"}</td><td>${nominal ? nominal.toLocaleString("id-ID") : "-"}</td></tr>`;
    }).join("");

    const jumlahPay     = varianList.reduce((a, v) => a + (pay[v]     || 0), 0);
    const jumlahExpired = varianList.reduce((a, v) => a + (expired[v] || 0), 0);
    const persenExpired = jumlahPay > 0 ? Math.round((jumlahExpired / jumlahPay) * 100) : 0;
    const jumlahNominalPay = varianList.reduce((a, v) => {
      const harga  = hargaMap[v] || { konsumen: 0, produksi: 0 };
      const margin = harga.konsumen - harga.produksi;
      return a + (pay[v] || 0) * margin;
    }, 0);
    const jumlahNominalExpired = varianList.reduce((a, v) => {
      const harga = hargaMap[v] || { produksi: 0 };
      return a + (expired[v] || 0) * harga.produksi;
    }, 0);

    chartData.push({ nama, jumlahPay, jumlahExpired });

    const cardHtml = `
      <div class="rekap-dist-card" data-uid="${esc(u.uid)}">
        <div class="rekap-dist-card-header">
          ${avatar}
          <div>
            <div class="rekap-dist-nama">${esc(nama)}</div>
            <div class="rekap-dist-role">${esc(u.role || "-")}</div>
          </div>
        </div>
        <div class="rekap-dist-card-body">

          <div>
            <div class="rekap-dist-section-title">Pay</div>
            <table class="rekap-dist-table">
              <thead><tr><th>Jenis</th><th>Qty</th><th>Nominal</th></tr></thead>
              <tbody>
                ${buildPayRows()}
                <tr><td>Jumlah Pay</td><td>${jumlahPay || "-"}</td><td>${jumlahNominalPay ? jumlahNominalPay.toLocaleString("id-ID") : "-"}</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <div class="rekap-dist-section-title">Expired</div>
            <table class="rekap-dist-table">
              <thead><tr><th>Jenis</th><th>Qty</th><th>Nominal</th></tr></thead>
              <tbody>
                ${buildExpiredRows()}
                <tr><td>Jumlah Expired</td><td>${jumlahExpired || "-"}</td><td>${jumlahNominalExpired ? jumlahNominalExpired.toLocaleString("id-ID") : "-"}</td></tr>
                <tr><td>Persentase Expired</td><td>${persenExpired ? persenExpired + "%" : "-"}</td><td>-</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <div class="rekap-dist-section-title">Info Target</div>
            <table class="rekap-dist-table">
              <thead><tr><th>Jenis</th><th>Qty</th><th>Nominal</th></tr></thead>
              <tbody>
                <tr><td>Customer New</td><td>${customerNew || "-"}</td><td>${customerNew ? (customerNew * upahHunter).toLocaleString("id-ID") : "-"}</td></tr>
                <tr><td>Customer Putus</td><td>${customerPutusIdb || "-"}</td><td>${customerPutusIdb ? (customerPutusIdb * upahHunter).toLocaleString("id-ID") : "-"}</td></tr>
                <tr><td>Jumlah Customer</td><td>${jumlahCustomer || "-"}</td><td>${nominalJumlahCustomer ? nominalJumlahCustomer.toLocaleString("id-ID") : "-"}</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <div class="rekap-dist-section-title">Potongan</div>
            <table class="rekap-dist-table">
              <thead><tr><th>Jenis</th><th>Qty</th><th>Nominal</th></tr></thead>
              <tbody>
                <tr><td>Target Data</td><td>-</td><td>${potonganTargetData ? potonganTargetData.toLocaleString("id-ID") : "-"}</td></tr>
                <tr><td>Target Customer</td><td>-</td><td>${potonganTargetCustomer ? potonganTargetCustomer.toLocaleString("id-ID") : "-"}</td></tr>
                <tr><td>Klaim Insentif</td><td>-</td><td>${klaimInsentif ? klaimInsentif.toLocaleString("id-ID") : "-"}</td></tr>
                <tr><td>Kasbon</td><td>-</td><td>${kasbon ? kasbon.toLocaleString("id-ID") : "-"}</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <div class="rekap-dist-section-title">Bonus</div>
            <table class="rekap-dist-table">
              <thead><tr><th>Jenis</th><th>Qty</th><th>Nominal</th></tr></thead>
              <tbody>
                <tr><td>Bonus Kehadiran</td><td>-</td><td>${bonusKehadiran ? bonusKehadiran.toLocaleString("id-ID") : "-"}</td></tr>
                <tr><td>Bonus Kunjungan</td><td>-</td><td>${bonusTargetHarian ? bonusTargetHarian.toLocaleString("id-ID") : "-"}</td></tr>
                <tr><td>Bonus Pay</td><td>-</td><td>${bonusPay ? bonusPay.toLocaleString("id-ID") : "-"}</td></tr>
                <tr><td>Bonus Insentif</td><td>-</td><td>${bonusInsentif ? bonusInsentif.toLocaleString("id-ID") : "-"}</td></tr>
                <tr><td>Bonus Hari Libur Perusahaan</td><td>${jumlahHariLiburPerusahaan || "-"}</td><td>${bonusHariLiburPerusahaan ? bonusHariLiburPerusahaan.toLocaleString("id-ID") : "-"}</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <div class="rekap-dist-section-title">Keterangan</div>
            <table class="rekap-dist-table">
              <thead><tr><th>Jenis</th><th>Qty</th><th>Nominal</th></tr></thead>
              <tbody>
                <tr><td>Jumlah Hari Kerja</td><td>${jumlahHariKerja || "-"}</td><td>-</td></tr>
                <tr><td>Izin</td><td>-</td><td>-</td></tr>
                <tr><td>Hari Masuk Kerja</td><td>${hariMasukKerja || "-"}</td><td>-</td></tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>`;
    cardsHtml.push(cardHtml);
  }

  gridEl.innerHTML = cardsHtml.join("");

  renderRekapDistChart(chartData);
}

/* ── CHART ── */
let rekapDistChartInstance = null;
function renderRekapDistChart(data) {
  const canvas = document.getElementById("rekapDistChart");
  if (!canvas || !window.Chart) return;

  if (rekapDistChartInstance) rekapDistChartInstance.destroy();

  rekapDistChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: data.map(d => d.nama),
      datasets: [
        { label: "Pay",     data: data.map(d => d.jumlahPay),     backgroundColor: "#1a7080" },
        { label: "Expired", data: data.map(d => d.jumlahExpired), backgroundColor: "#c05020" }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "top" } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function esc(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
