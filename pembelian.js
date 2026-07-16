/* ── PEMBELIAN BAHAN BAKU: STATE ── */
let pembelianList = [];

/* ── FORMAT TANGGAL INDONESIA ── */
const PEMBELIAN_HARI_NAMA = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const PEMBELIAN_BULAN_NAMA_LENGKAP = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
function formatTanggalIndo(tanggalStr) {
  if (!tanggalStr) return "-";
  const [y, m, d] = tanggalStr.split("-").map(Number);
  if (!y || !m || !d) return tanggalStr;
  const dateObj = new Date(y, m - 1, d);
  const namaHari = PEMBELIAN_HARI_NAMA[dateObj.getDay()];
  const namaBulan = PEMBELIAN_BULAN_NAMA_LENGKAP[m - 1];
  return `${namaHari}, ${d} ${namaBulan} ${y}`;
}
let pembelianBulan = new Date().getMonth();
let pembelianTahun = new Date().getFullYear();
let pembelianLoyangOptions = [];
let pembelianFilterJenis = "";
async function loadPembelianLoyangOptions() {
  try {
    const kantorCabang = await window.idb.getKantorCabang();
    const loyangArr = kantorCabang?.loyang || [];
    return loyangArr
      .filter(l => l.status === true)
      .map(l => ({ jenis: l.jenisLoyang, harga: Number(l.hargaPaket) || 0 }));
  } catch (err) {
    console.error("❌ loadPembelianLoyangOptions:", err);
    return [];
  }
}

/* ── LOAD RIWAYAT DARI FIRESTORE ── */
async function loadPembelianList() {
  const adminUid = window.auth?.currentUser?.uid;
  if (!adminUid) { pembelianList = []; return; }

  const periode = `${pembelianTahun}-${String(pembelianBulan + 1).padStart(2, "0")}`;

  try {
    const snap = await window.getDocs(window.query(
      window.collection(window.db, "users", adminUid, "pembelianBahanBaku"),
      window.where("periode", "==", periode)
    ));

    pembelianList = [];
    snap.forEach(docSnap => {
      pembelianList.push({ id: docSnap.id, ...docSnap.data() });
    });

    pembelianList.sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""));
  } catch (err) {
    console.error("❌ loadPembelianList:", err);
    pembelianList = [];
  }
}

/* ── RENDER RINGKASAN (pakai pola rincian-summary-card) ── */
function renderPembelianSummary() {
  let totalPembelian = 0, totalDibayar = 0, totalSisa = 0;
  getPembelianListTerfilter().forEach(p => {
    totalPembelian += Number(p.totalHarga) || 0;
    totalDibayar   += Number(p.dibayar)    || 0;
    totalSisa      += Number(p.sisa)       || 0;
  });

  const beliEl    = document.getElementById("pembelianTotalBeli");
  const bayarEl   = document.getElementById("pembelianTotalDibayar");
  const sisaEl    = document.getElementById("pembelianTotalSisa");

  if (beliEl)  beliEl.textContent  = `Rp ${totalPembelian.toLocaleString("id-ID")}`;
  if (bayarEl) bayarEl.textContent = `Rp ${totalDibayar.toLocaleString("id-ID")}`;
  if (sisaEl)  sisaEl.textContent  = `Rp ${totalSisa.toLocaleString("id-ID")}`;
}

/* ── RENDER TABEL RIWAYAT ── */
function getPembelianListTerfilter() {
  if (!pembelianFilterJenis) return pembelianList;
  return pembelianList.filter(p => p.jenisPaket === pembelianFilterJenis);
}
function renderPembelianTable() {
  const tbody = document.getElementById("pembelianTableBody");
  if (!tbody) return;

  const list = getPembelianListTerfilter();

  if (!list.length) {
    tbody.innerHTML = `<tr class="audit-empty-row"><td colspan="8">Belum ada riwayat pembelian bulan ini</td></tr>`;
    return;
  }

  let totalQty = 0;
  const rowsHtml = list.map(p => {
    const total   = Number(p.totalHarga) || 0;
    const dibayar = Number(p.dibayar)    || 0;
    const sisa    = Number(p.sisa)       || 0;
    const lunas   = sisa >= 0;
    totalQty += Number(p.qty) || 0;

    return `
      <tr class="pembelian-row-clickable" data-id="${p.id}">
        <td class="pembelian-td-text">${formatTanggalIndo(p.tanggal)}</td>
        <td class="pembelian-td-text">${p.jenisPaket || "-"}</td>
        <td>${p.qty || "-"}</td>
        <td>${p.hargaPerPaket ? Number(p.hargaPerPaket).toLocaleString("id-ID") : ""}</td>
        <td>${total ? total.toLocaleString("id-ID") : ""}</td>
        <td>${dibayar ? dibayar.toLocaleString("id-ID") : ""}</td>
        <td><span class="pembelian-status-badge ${lunas ? "pembelian-status-lunas" : "pembelian-status-belum"}">${lunas ? "Lunas" : "Belum Lunas"}</span></td>
        <td class="${sisa < 0 ? "pembelian-sisa-minus" : ""}">${sisa ? sisa.toLocaleString("id-ID") : ""}</td>
      </tr>`;
  }).join("");

  const jumlahLunas = list.filter(p => (Number(p.sisa) || 0) <= 0).length;
  const jumlahBelum = list.length - jumlahLunas;

  const totalRowHtml = `
    <tr class="pembelian-total-row">
      <td colspan="2">Total</td>
      <td>${totalQty.toLocaleString("id-ID")}</td>
      <td></td>
      <td></td>
      <td></td>
      <td>${jumlahLunas} Lunas / ${jumlahBelum} Belum</td>
      <td></td>
    </tr>
  `;

  tbody.innerHTML = rowsHtml + totalRowHtml;

  tbody.querySelectorAll("tr[data-id]").forEach(tr => {
    tr.addEventListener("click", () => openBayarModal(tr.dataset.id));
  });
}
async function refreshPembelianData() {
  await loadPembelianList();
  renderPembelianSummary();
  renderPembelianTable();
}

/* ── FORMAT RIBUAN (1.000) ── */
function parseAngkaRibuan(str) {
  return Number(String(str || "").replace(/\D/g, "")) || 0;
}
function formatInputRibuan(input) {
  const angka = parseAngkaRibuan(input.value);
  input.value = angka ? angka.toLocaleString("id-ID") : "";
}
function attachFormatRibuan(inputId) {
  const el = document.getElementById(inputId);
  if (!el || el.dataset.ribuanBound) return;
  el.dataset.ribuanBound = "true";
  el.addEventListener("input", () => formatInputRibuan(el));
}

/* ── KONFIRMASI HAPUS (custom, ganti window.confirm) ── */
let pembelianConfirmCallback = null;
function tampilkanKonfirmasiHapus(pesan, onConfirm) {
  document.getElementById("pembelianConfirmMessage").textContent = pesan;
  pembelianConfirmCallback = onConfirm;
  document.getElementById("pembelianConfirmOverlay").classList.add("show");
}
function tutupKonfirmasiHapus() {
  document.getElementById("pembelianConfirmOverlay")?.classList.remove("show");
  pembelianConfirmCallback = null;
}
function initPembelianConfirmModal() {
  const overlay = document.getElementById("pembelianConfirmOverlay");
  if (!overlay || overlay.dataset.bound) return;
  overlay.dataset.bound = "true";

  document.getElementById("pembelianConfirmCancel")?.addEventListener("click", tutupKonfirmasiHapus);
  document.getElementById("pembelianConfirmYes")?.addEventListener("click", async () => {
    const callback = pembelianConfirmCallback;
    tutupKonfirmasiHapus();
    if (callback) await callback();
  });
  overlay.addEventListener("click", e => {
    if (e.target.id === "pembelianConfirmOverlay") tutupKonfirmasiHapus();
  });
}

/* ── SWIPE CLOSE SHEET ── */
function attachSwipeCloseSheet(overlayId, closeFn) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  const box = overlay.querySelector(".pembelian-sheet-box");
  if (!box || box.dataset.swipeBound) return;
  box.dataset.swipeBound = "true";

  let startX = 0, currentX = 0, dragging = false;

  box.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
    dragging = true;
    box.style.transition = "none";
  }, { passive: true });

  box.addEventListener("touchmove", e => {
    if (!dragging) return;
    currentX = e.touches[0].clientX - startX;
    if (currentX > 0) {
      box.style.transform = `translateX(${currentX}px)`;
    }
  }, { passive: true });

  box.addEventListener("touchend", () => {
    dragging = false;
    box.style.transition = "";
    box.style.transform = "";
    if (currentX > 80) {
      closeFn();
    }
    currentX = 0;
  });
}

/* ── MODAL: UPDATE PEMBAYARAN ── */
let pembelianBayarTargetId = null;
function renderPembelianRiwayat(item) {
  const wrap = document.getElementById("pembelianRiwayatList");
  const riwayat = item.riwayatBayar || [];

  if (!riwayat.length) {
    wrap.innerHTML = `
      <div class="pembelian-riwayat-empty">
        <i class="fa-regular fa-clock"></i>
        <span>Belum ada cicilan tercatat</span>
      </div>`;
    return;
  }
  const withIdx = riwayat.map((r, idx) => ({ ...r, __idx: idx }));
  const sorted = withIdx.sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""));

  wrap.innerHTML = sorted.map(r => {
    const diterima = r.diterima === true;
    return `
    <div class="pembelian-riwayat-item ${diterima ? "" : "belum-diterima"}" data-idx="${r.__idx}">
      <div class="info">
        <div class="baris-atas">
          <span class="tanggal">${formatTanggalIndo(r.tanggal)}</span>
          <span class="pembelian-riwayat-diterima-badge ${diterima ? "sudah" : "belum"}">${diterima ? "Sudah Diterima" : "Belum Diterima"}</span>
        </div>
        <span class="nominal">Rp ${(Number(r.nominal) || 0).toLocaleString("id-ID")}</span>
      </div>
      <div class="pembelian-riwayat-actions">
        <button class="pembelian-riwayat-icon-btn riwayat-edit-btn" data-idx="${r.__idx}"><i class="fa-solid fa-pen"></i></button>
      </div>
    </div>`;
  }).join("");

  wrap.querySelectorAll(".riwayat-edit-btn").forEach(btn => {
    btn.addEventListener("click", () => bukaEditRiwayatInline(Number(btn.dataset.idx)));
  });
}
function bukaEditRiwayatInline(idx) {
  const item = pembelianList.find(p => p.id === pembelianBayarTargetId);
  if (!item) return;
  const entry = (item.riwayatBayar || [])[idx];
  if (!entry) return;

  const el = document.querySelector(`.pembelian-riwayat-item[data-idx="${idx}"]`);
  if (!el) return;

  el.outerHTML = `
    <div class="pembelian-riwayat-edit-row" data-idx="${idx}">
      <div class="row-inputs">
        <div class="pembelian-riwayat-field">
          <span class="field-label">Nominal</span>
          <input type="text" inputmode="numeric" id="riwayatEditNominal-${idx}" value="${(Number(entry.nominal)||0).toLocaleString("id-ID")}">
        </div>
      </div>
      <div class="row-actions">
        <button class="pembelian-riwayat-cancel-btn" id="riwayatCancelBtn-${idx}">Batal</button>
        <button class="pembelian-riwayat-save-btn" id="riwayatSaveBtn-${idx}">Simpan</button>
      </div>
    </div>
  `;

  attachFormatRibuan(`riwayatEditNominal-${idx}`);

  document.getElementById(`riwayatCancelBtn-${idx}`)?.addEventListener("click", () => {
    renderPembelianRiwayat(item);
  });

  document.getElementById(`riwayatSaveBtn-${idx}`)?.addEventListener("click", async () => {
    const nominalBaru = parseAngkaRibuan(document.getElementById(`riwayatEditNominal-${idx}`).value);
    await simpanEditRiwayat(idx, nominalBaru);
  });
}
async function simpanEditRiwayat(idx, nominalBaru) {
  const adminUid = window.auth?.currentUser?.uid;
  if (!adminUid || !pembelianBayarTargetId) return;

  const item = pembelianList.find(p => p.id === pembelianBayarTargetId);
  if (!item) return;

  if (nominalBaru <= 0) {
    window.showToast("Nominal cicilan tidak valid", "error");
    return;
  }

  const riwayatBaru = (item.riwayatBayar || []).map((r, i) =>
    i === idx ? { ...r, nominal: nominalBaru } : r
  );

  await simpanUlangRiwayat(item, riwayatBaru);
}
async function simpanUlangRiwayat(item, riwayatBaru) {
  const adminUid = window.auth?.currentUser?.uid;
  if (!adminUid) return;

  const totalDibayar = riwayatBaru.reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
  const total = Number(item.totalHarga) || 0;
  const sisa  = totalDibayar - total;
  const status = sisa === 0 ? "lunas" : (sisa < 0 ? "kurang" : "lebih");

  try {
    await window.updateDoc(window.doc(window.db, "users", adminUid, "pembelianBahanBaku", item.id), {
      riwayatBayar: riwayatBaru,
      dibayar: totalDibayar,
      sisa,
      status,
      updatedAt: new Date().toISOString()
    });
    window.showToast("Riwayat cicilan berhasil diupdate", "success");
    await refreshPembelianData();
    openBayarModal(item.id); // refresh sheet dengan data terbaru
  } catch (err) {
    console.error("❌ simpanUlangRiwayat:", err);
    window.showToast("Gagal update riwayat cicilan", "error");
  }
}
function openBayarModal(id) {
  const item = pembelianList.find(p => p.id === id);
  if (!item) return;
  pembelianBayarTargetId = id;

  const total   = Number(item.totalHarga) || 0;
  const dibayar = Number(item.dibayar)    || 0;
  const sisa    = Number(item.sisa)       || 0;

  document.getElementById("pembelianBayarInfo").innerHTML = `
    <span>Total: <b>Rp ${total.toLocaleString("id-ID")}</b></span>
    <span>Sisa: <b class="${sisa < 0 ? "pembelian-sisa-minus" : ""}">Rp ${sisa.toLocaleString("id-ID")}</b></span>
  `;

  document.getElementById("pembelianBayarModalInput").value = "";
  renderPembelianRiwayat(item);

  // tampilkan data pembelian sebagai read-only (input dari gudang)
  document.getElementById("pembelianEditJenisReadonly").textContent = item.jenisPaket || "-";
  document.getElementById("pembelianEditQtyReadonly").textContent   = item.qty ? String(item.qty) : "-";
  document.getElementById("pembelianEditHargaReadonly").textContent = item.hargaPerPaket ? `Rp ${Number(item.hargaPerPaket).toLocaleString("id-ID")}` : "-";

  document.getElementById("pembelianBayarModalOverlay").classList.add("show");
  attachSwipeCloseSheet("pembelianBayarModalOverlay", closeBayarModal);
  attachFormatRibuan("pembelianBayarModalInput");
  initPembelianBayarValidation(item);
}

function initPembelianBayarValidation(item) {
  const input = document.getElementById("pembelianBayarModalInput");
  const warning = document.getElementById("pembelianBayarWarning");
  const confirmBtn = document.getElementById("pembelianBayarModalConfirm");
  if (!input || !warning || !confirmBtn) return;

  const total = Number(item.totalHarga) || 0;
  const sudahDibayar = Number(item.dibayar) || 0;

  const cekValidasi = () => {
    const nominalBaru = parseAngkaRibuan(input.value);
    const previewSisa = (sudahDibayar + nominalBaru) - total;
    const lebih = previewSisa > 0;
    warning.style.display = lebih ? "block" : "none";
    confirmBtn.disabled = lebih;
  };

  input.oninput = cekValidasi;
  cekValidasi();
}
function closeBayarModal() {
  document.getElementById("pembelianBayarModalOverlay")?.classList.remove("show");
  pembelianBayarTargetId = null;
}
async function confirmBayarModal() {
  const adminUid = window.auth?.currentUser?.uid;
  if (!adminUid || !pembelianBayarTargetId) return;

  const item = pembelianList.find(p => p.id === pembelianBayarTargetId);
  if (!item) return;

  const nominalBaru = parseAngkaRibuan(document.getElementById("pembelianBayarModalInput").value);
  if (nominalBaru <= 0) {
    window.showToast("Isi nominal cicilan dulu", "error");
    return;
  }

  const riwayatLama = item.riwayatBayar || [];
  const riwayatBaru = [...riwayatLama, {
    id: Date.now().toString(),
    tanggal: new Date().toISOString().slice(0, 10),
    nominal: nominalBaru,
    diterima: false
  }];

  const totalDibayar = riwayatBaru.reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
  const total = Number(item.totalHarga) || 0;
  const sisa  = totalDibayar - total;

  if (sisa > 0) {
    window.showToast("Nominal melebihi batas total", "error");
    return;
  }

  const status = sisa === 0 ? "lunas" : (sisa < 0 ? "kurang" : "lebih");

  try {
    await window.updateDoc(window.doc(window.db, "users", adminUid, "pembelianBahanBaku", item.id), {
      riwayatBayar: riwayatBaru,
      dibayar: totalDibayar,
      sisa,
      status,
      updatedAt: new Date().toISOString()
    });
    window.showToast("Cicilan berhasil dicatat", "success");
    closeBayarModal();
    await refreshPembelianData();
  } catch (err) {
    console.error("❌ confirmBayarModal:", err);
    window.showToast("Gagal mencatat cicilan", "error");
  }
}

/* ── FILTER JENIS LOYANG (di tabel riwayat) ── */
function initPembelianFilterJenis() {
  const wrap = document.getElementById("pembelianFilterJenisWrap");
  const btn  = document.getElementById("pembelianFilterJenisBtn");
  const dd   = document.getElementById("pembelianFilterJenisDropdown");
  if (!wrap || !btn || !dd) return;

  dd.innerHTML = [`<div class="pembelian-select-option ${!pembelianFilterJenis ? "selected" : ""}" data-jenis="">Semua Jenis</div>`]
    .concat(pembelianLoyangOptions.map(o => `
      <div class="pembelian-select-option ${o.jenis === pembelianFilterJenis ? "selected" : ""}" data-jenis="${o.jenis}">${o.jenis}</div>
    `)).join("");

  dd.querySelectorAll(".pembelian-select-option").forEach(opt => {
    opt.addEventListener("click", () => {
      pembelianFilterJenis = opt.dataset.jenis || "";
      document.getElementById("pembelianFilterJenisBtnLabel").textContent = pembelianFilterJenis || "Semua Jenis";
      dd.querySelectorAll(".pembelian-select-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      wrap.classList.remove("open");
      renderPembelianSummary();
      renderPembelianTable();
    });
  });

  if (!wrap.dataset.bound) {
    wrap.dataset.bound = "true";
    btn.addEventListener("click", e => {
      e.stopPropagation();
      wrap.classList.toggle("open");
    });
    document.addEventListener("click", e => {
      if (!e.target.closest("#pembelianFilterJenisWrap")) wrap.classList.remove("open");
    });
  }
}

/* ── FILTER BULAN/TAHUN (pola sama kayak Audit) ── */
function initPembelianFilter() {
  const bulanBtn = document.getElementById("pembelianBulanBtn");
  const tahunBtn = document.getElementById("pembelianTahunBtn");
  const bulanDD  = document.getElementById("pembelianBulanDropdown");
  const tahunDD  = document.getElementById("pembelianTahunDropdown");
  if (!bulanBtn || !tahunBtn) return;

  document.getElementById("pembelianBulanLabel").textContent = REKAP_PROD_BULAN_NAMA[pembelianBulan];
  document.getElementById("pembelianTahunLabel").textContent = pembelianTahun;

  const now = new Date().getFullYear();
  tahunDD.innerHTML = [now-1, now, now+1].map(y =>
    `<div class="rekap-dist-dropdown-option ${y===pembelianTahun?"selected":""}" data-tahun="${y}">${y}</div>`
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
      pembelianBulan = Number(opt.dataset.bulan);
      document.getElementById("pembelianBulanLabel").textContent = REKAP_PROD_BULAN_NAMA[pembelianBulan];
      bulanDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      closeAll();
      await refreshPembelianData();
    });
  });

  tahunDD.addEventListener("click", async e => {
    e.stopPropagation();
    const opt = e.target.closest(".rekap-dist-dropdown-option");
    if (!opt) return;
    pembelianTahun = Number(opt.dataset.tahun);
    document.getElementById("pembelianTahunLabel").textContent = pembelianTahun;
    tahunDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    await refreshPembelianData();
  });

  document.getElementById("pembelianReloadBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("pembelianReloadBtn");
    btn.classList.add("spinning");
    await refreshPembelianData();
    btn.classList.remove("spinning");
  });
}
function relokasiSheetKeBody() {
  ["pembelianBayarModalOverlay", "pembelianConfirmOverlay"].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.parentElement !== document.body) {
      document.body.appendChild(el);
    }
  });
}

/* ── INIT VIEW ── */
window.initPembelianBahanBakuView = async function() {
  initPembelianFilter();
  relokasiSheetKeBody();
  initPembelianConfirmModal();
  pembelianLoyangOptions = await loadPembelianLoyangOptions();
  initPembelianFilterJenis();

  document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='pembelian']").forEach(item => {
    item.addEventListener("click", async () => {
      document.querySelectorAll("#rekapProduksiList .lap-kurir-item").forEach(x => x.classList.remove("active"));
      item.classList.add("active");

      window.activateRekapProdPanel("pembelianProduksiDetailWrapper");

      document.getElementById("pembelianProduksiEmpty").style.display   = "none";
      document.getElementById("pembelianProduksiContent").style.display = "flex";

      if (window.innerWidth <= 768) {
        const backBtn = document.getElementById("pembelianProduksiBackBtn");
        if (backBtn) backBtn.style.display = "flex";
      }

      await refreshPembelianData();
    });
  });

  document.getElementById("pembelianProduksiBackBtn")?.addEventListener("click", () => {
    document.getElementById("pembelianProduksiDetailWrapper").style.setProperty("display", "none", "important");
    document.getElementById("pembelianProduksiDetailWrapper")?.classList.remove("show");
    document.getElementById("pembelianProduksiBackBtn").style.display = "none";
    document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='pembelian']").forEach(x => x.classList.remove("active"));
    window.showRekapProdListMobile();
  });

  document.getElementById("pembelianBayarModalCancel")?.addEventListener("click", closeBayarModal);
  document.getElementById("pembelianBayarModalConfirm")?.addEventListener("click", confirmBayarModal);
  document.getElementById("pembelianBayarModalOverlay")?.addEventListener("click", e => {
    if (e.target.id === "pembelianBayarModalOverlay") closeBayarModal();
  });
};
