/* ── SLIP GAJI PRODUKSI (di dalam Rekap Produksi) ── */
/* NOTE: bulan/tahun sengaja TIDAK punya variabel sendiri — ikut rekapProdBulan/rekapProdTahun,
   mengikuti konvensi yang sudah dipakai di Rincian Produksi. */

let slipGajiProdSelectedUid  = null;
let slipGajiProdSelectedNama = null;

const SLIP_GAJI_PROD_TEMPLATE = {
  pendapatan: [
    { key: "upahPokok",          label: "Upah Pokok",          hari: 0, pembayaran: 0, fixed: true },
    { key: "tunjanganTransport", label: "Tunjangan Transport", hari: 0, pembayaran: 0, fixed: true },
  ],
  bonus: [
    { key: "bonusKehadiran", label: "Bonus Kehadiran", hari: 0, pembayaran: 0, fixed: true },
  ],
  potongan: [
    { key: "kasbon", label: "Kasbon", hari: 0, pembayaran: 0, fixed: true },
  ],
};

let slipGajiProdData = null;

window.initSlipGajiProdView = function() {
  document.getElementById("slipGajiProdReloadBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("slipGajiProdReloadBtn");
    btn.classList.add("spinning");
    await reloadLaporanAdminDataProd?.();
    await renderSlipGajiProdKurirGrid();
    btn.classList.remove("spinning");
  });

  document.getElementById("slipGajiProdSaveBtn")?.addEventListener("click", simpanSlipGajiProd);

  document.querySelectorAll(".slipgajiprod-add-btn").forEach(btn => {
    btn.addEventListener("click", () => tambahItemCustomProd(btn.dataset.section));
  });

  initSlipGajiProdFilter();

  // ── KLIK ITEM LIST "Slip Gaji" DI PANEL KIRI ──
  document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='slipgaji']").forEach(item => {
    item.addEventListener("click", async () => {
      document.querySelectorAll("#rekapProduksiList .lap-kurir-item").forEach(x => x.classList.remove("active"));
      item.classList.add("active");

      window.activateRekapProdPanel?.("slipgajiProduksiDetailWrapper");

      document.getElementById("slipgajiProduksiEmpty").style.display   = "none";
      document.getElementById("slipgajiProduksiContent").style.display = "flex";

      document.getElementById("slipGajiProdFormWrap").style.display = "none";
      slipGajiProdSelectedUid = null;

      if (window.innerWidth <= 768) {
        const backBtn = document.getElementById("slipgajiProduksiBackBtn");
        if (backBtn) backBtn.style.display = "flex";
      }

      await renderSlipGajiProdKurirGrid();
    });
  });

  document.getElementById("slipgajiProduksiBackBtn")?.addEventListener("click", () => {
    document.getElementById("slipgajiProduksiDetailWrapper").style.setProperty("display", "none", "important");
    document.getElementById("slipgajiProduksiDetailWrapper")?.classList.remove("show");
    document.getElementById("slipgajiProduksiBackBtn").style.display = "none";
    document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='slipgaji']").forEach(x => x.classList.remove("active"));
  });
};

/* ── FILTER BULAN/TAHUN (ikut rekapProdBulan/Tahun, cuma sinkron label) ── */
function initSlipGajiProdFilter() {
  const bulanBtn = document.getElementById("slipGajiProdBulanBtn");
  const tahunBtn = document.getElementById("slipGajiProdTahunBtn");
  const bulanDD  = document.getElementById("slipGajiProdBulanDropdown");
  const tahunDD  = document.getElementById("slipGajiProdTahunDropdown");

  document.getElementById("slipGajiProdBulanLabel").textContent = REKAP_PROD_BULAN_NAMA[rekapProdBulan];
  document.getElementById("slipGajiProdTahunLabel").textContent = rekapProdTahun;

  bulanDD.innerHTML = REKAP_PROD_BULAN_NAMA.map((nama, idx) =>
    `<div class="rekap-dist-dropdown-option ${idx===rekapProdBulan?"selected":""}" data-bulan="${idx}">${nama}</div>`
  ).join("");

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

  bulanDD?.addEventListener("click", async e => {
    e.stopPropagation();
    const opt = e.target.closest(".rekap-dist-dropdown-option");
    if (!opt) return;
    rekapProdBulan = Number(opt.dataset.bulan);

    // sync label di semua panel yang share rekapProdBulan
    document.getElementById("rekapProdBulanLabel").textContent    = REKAP_PROD_BULAN_NAMA[rekapProdBulan];
    document.getElementById("rincianProdBulanLabel").textContent  = REKAP_PROD_BULAN_NAMA[rekapProdBulan];
    document.getElementById("slipGajiProdBulanLabel").textContent = REKAP_PROD_BULAN_NAMA[rekapProdBulan];

    bulanDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();

    document.getElementById("slipGajiProdFormWrap").style.display = "none";
    slipGajiProdSelectedUid = null;
    await renderSlipGajiProdKurirGrid();
  });

  tahunDD?.addEventListener("click", async e => {
    e.stopPropagation();
    const opt = e.target.closest(".rekap-dist-dropdown-option");
    if (!opt) return;
    rekapProdTahun = Number(opt.dataset.tahun);

    document.getElementById("rekapProdTahunLabel").textContent    = rekapProdTahun;
    document.getElementById("rincianProdTahunLabel").textContent  = rekapProdTahun;
    document.getElementById("slipGajiProdTahunLabel").textContent = rekapProdTahun;

    tahunDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();

    document.getElementById("slipGajiProdFormWrap").style.display = "none";
    slipGajiProdSelectedUid = null;
    await renderSlipGajiProdKurirGrid();
  });
}

/* ── GRID PILIH PEGAWAI ── */
async function renderSlipGajiProdKurirGrid() {
  const gridEl = document.getElementById("slipGajiProdKurirGrid");
  if (!gridEl) return;
  gridEl.innerHTML = `<div class="dh-ringkasan-empty">Memuat...</div>`;

  if (!window.usersCache?.length) {
    window.usersCache = await window.idb.getUsers();
  }
  const users = (window.usersCache || []).filter(u => u.role === "produksi" || u.role === "adminCabang");

  if (!users.length) {
    gridEl.innerHTML = `<div class="dh-ringkasan-empty">Belum ada pegawai produksi</div>`;
    return;
  }

  const periodeLabel = `${REKAP_PROD_BULAN_NAMA[rekapProdBulan]} ${rekapProdTahun}`;

  gridEl.innerHTML = users.map(u => {
    const nama    = u.nama || "Tanpa Nama";
    const inisial = nama.trim().charAt(0).toUpperCase();
    const avatar  = u.foto
      ? `<img class="rekap-dist-avatar" src="${escSlip(u.foto)}" alt="">`
      : `<div class="rekap-dist-avatar">${escSlip(inisial)}</div>`;

    return `
      <div class="rekap-dist-card slip-gaji-kurir-card" data-uid="${escSlip(u.uid)}" data-nama="${escSlip(nama)}">
        <div class="rekap-dist-card-header">
          ${avatar}
          <div>
            <div class="rekap-dist-nama">${escSlip(nama)}</div>
            <div class="rekap-dist-role">${escSlip(periodeLabel)}</div>
          </div>
          <span class="rekap-dist-saved-badge" id="slipGajiProdBadge-${escSlip(u.uid)}" style="display:none">
            <i class="fa-solid fa-circle-check"></i> Sudah dikirim
          </span>
          <i class="fa-solid fa-chevron-right" style="margin-left:8px;color:var(--text-muted)"></i>
        </div>
      </div>`;
  }).join("");

  gridEl.querySelectorAll(".slip-gaji-kurir-card").forEach(card => {
    card.addEventListener("click", () => {
      gridEl.querySelectorAll(".slip-gaji-kurir-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      pilihKurirSlipGajiProd(card.dataset.uid, card.dataset.nama);
    });
  });

  cekSlipGajiProdSudahDikirimBatch(users.map(u => u.uid));
}

async function cekSlipGajiProdSudahDikirimBatch(uids) {
  const periode = `${rekapProdTahun}-${String(rekapProdBulan + 1).padStart(2, "0")}`;
  await Promise.all(uids.map(async uid => {
    const badge = document.getElementById(`slipGajiProdBadge-${uid}`);
    if (!badge) return;
    try {
      const snap = await window.getDoc(window.doc(window.db, "users", uid, "slipGajiProduksi", periode));
      badge.style.display = snap.exists() ? "flex" : "none";
    } catch (err) {
      console.error("❌ cekSlipGajiProdSudahDikirim:", err);
    }
  }));
}

/* ── PILIH PEGAWAI → ISI FORM ── */
async function pilihKurirSlipGajiProd(uid, nama) {
  slipGajiProdSelectedUid  = uid;
  slipGajiProdSelectedNama = nama;

  document.getElementById("slipGajiProdFormWrap").style.display = "block";
  document.getElementById("slipGajiProdFormNama").textContent   = nama;

  const periodeLabelForm = `Periode: ${REKAP_PROD_BULAN_NAMA[rekapProdBulan]} ${rekapProdTahun}`;
  const periodeEl = document.getElementById("slipGajiProdFormPeriode");
  if (periodeEl) periodeEl.textContent = periodeLabelForm;

  await cekSlipGajiProdFormBadge(uid);

  slipGajiProdData = JSON.parse(JSON.stringify(SLIP_GAJI_PROD_TEMPLATE));
  document.getElementById("slipGajiProdCatatan").value = "";

  // TODO: isi nilai hari/pembayaran dari data produksi (laporanAdmin/pengeluaran) sesuai kebutuhan bisnis
  // Untuk sekarang UI shell dulu, nilai default 0 — logic hitungan menyusul.

  renderSlipGajiProdItems();
}

async function cekSlipGajiProdFormBadge(uid) {
  const badge = document.getElementById("slipGajiProdFormBadge");
  if (!badge) return;
  badge.style.display = "none";

  const periode = `${rekapProdTahun}-${String(rekapProdBulan + 1).padStart(2, "0")}`;
  try {
    const snap = await window.getDoc(window.doc(window.db, "users", uid, "slipGajiProduksi", periode));
    badge.style.display = snap.exists() ? "flex" : "none";
  } catch (err) {
    console.error("❌ cekSlipGajiProdFormBadge:", err);
  }
}

/* ── RENDER ITEM (Pendapatan/Bonus/Potongan) ── */
function renderSlipGajiProdItems() {
  ["pendapatan", "bonus", "potongan"].forEach(section => {
    const containerEl = document.getElementById(`slipGajiProd${capitalize(section)}Items`);
    if (!containerEl) return;

    const jumlahSection = slipGajiProdData[section].reduce((a, v) => a + (Number(v.pembayaran) || 0), 0);

    containerEl.innerHTML = slipGajiProdData[section].map((item, idx) => `
      <div class="slip-gaji-item-row" data-section="${section}" data-idx="${idx}">
        <input type="text" class="slip-gaji-input-label" value="${escSlip(item.label)}" ${item.fixed ? "readonly" : ""}>
        <input type="number" class="slip-gaji-input-hari" min="0" value="${item.hari || ""}" placeholder="-">
        <input type="text" class="slip-gaji-input-nominal" value="${item.pembayaran ? item.pembayaran.toLocaleString("id-ID") : ""}" placeholder="0">
        <button class="slip-gaji-remove-btn" ${item.fixed ? "style=\"visibility:hidden\"" : ""}>
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>`).join("") + `
      <div class="slip-gaji-item-row slip-gaji-jumlah-row">
        <span>Jumlah</span>
        <span></span>
        <span class="slip-gaji-jumlah-val">${jumlahSection ? jumlahSection.toLocaleString("id-ID") : "-"}</span>
        <span></span>
      </div>`;

    containerEl.querySelectorAll(".slip-gaji-item-row[data-idx]").forEach(row => {
      const idx = Number(row.dataset.idx);
      const hariInput    = row.querySelector(".slip-gaji-input-hari");
      const nominalInput = row.querySelector(".slip-gaji-input-nominal");
      const labelInput   = row.querySelector(".slip-gaji-input-label");
      const removeBtn    = row.querySelector(".slip-gaji-remove-btn");

      hariInput.addEventListener("input", () => {
        slipGajiProdData[section][idx].hari = Number(hariInput.value) || 0;
      });
      nominalInput.addEventListener("input", () => {
        const angka = nominalInput.value.replace(/\D/g, "");
        nominalInput.value = angka ? Number(angka).toLocaleString("id-ID") : "";
        slipGajiProdData[section][idx].pembayaran = Number(angka) || 0;
        updateJumlahSectionProd(section);
        hitungTotalPenerimaanProd();
      });
      labelInput?.addEventListener("input", () => {
        if (!slipGajiProdData[section][idx].fixed) {
          slipGajiProdData[section][idx].label = labelInput.value;
        }
      });
      removeBtn?.addEventListener("click", () => {
        slipGajiProdData[section].splice(idx, 1);
        renderSlipGajiProdItems();
        hitungTotalPenerimaanProd();
      });
    });
  });

  hitungTotalPenerimaanProd();
}

function updateJumlahSectionProd(section) {
  const containerEl = document.getElementById(`slipGajiProd${capitalize(section)}Items`);
  if (!containerEl) return;
  const jumlahRow = containerEl.querySelector(".slip-gaji-jumlah-row .slip-gaji-jumlah-val");
  if (!jumlahRow) return;
  const jumlahSection = slipGajiProdData[section].reduce((a, v) => a + (Number(v.pembayaran) || 0), 0);
  jumlahRow.textContent = jumlahSection ? jumlahSection.toLocaleString("id-ID") : "-";
}

function tambahItemCustomProd(section) {
  if (!slipGajiProdData) return;
  slipGajiProdData[section].push({ key: `custom_${Date.now()}`, label: "", hari: 0, pembayaran: 0, fixed: false });
  renderSlipGajiProdItems();
}

function hitungTotalPenerimaanProd() {
  if (!slipGajiProdData) return;
  const sum = arr => arr.reduce((a, v) => a + (Number(v.pembayaran) || 0), 0);
  const totalPendapatan = sum(slipGajiProdData.pendapatan);
  const totalBonus      = sum(slipGajiProdData.bonus);
  const totalPotongan   = sum(slipGajiProdData.potongan);
  const total = totalPendapatan + totalBonus - totalPotongan;

  const el = document.getElementById("slipGajiProdTotalPenerimaan");
  if (el) el.textContent = `Rp ${total.toLocaleString("id-ID")}`;
}

/* ── SIMPAN ── */
async function simpanSlipGajiProd() {
  if (!slipGajiProdSelectedUid) { window.showToast("Pilih pegawai dulu", "error"); return; }

  const btn = document.getElementById("slipGajiProdSaveBtn");
  btn.disabled = true; btn.textContent = "Menyimpan...";

  try {
    const adminUid     = window.auth?.currentUser?.uid;
    const kantorCabang = await window.idb.getKantorCabang();
    const periode      = `${rekapProdTahun}-${String(rekapProdBulan + 1).padStart(2, "0")}`;
    const catatan      = document.getElementById("slipGajiProdCatatan").value.trim();

    const toObj = arr => arr.reduce((acc, item) => {
      acc[item.key] = { hari: item.hari, pembayaran: item.pembayaran };
      return acc;
    }, {});

    const sum = arr => arr.reduce((a, v) => a + (Number(v.pembayaran) || 0), 0);
    const totalPenerimaan = sum(slipGajiProdData.pendapatan) + sum(slipGajiProdData.bonus) - sum(slipGajiProdData.potongan);

    await window.setDoc(
      window.doc(window.db, "users", slipGajiProdSelectedUid, "slipGajiProduksi", periode),
      {
        catatan,
        createdAt: window.serverTimestamp(),
        createdBy: adminUid,
        idCabang: kantorCabang?.id || "",
        idUser: slipGajiProdSelectedUid,
        periode,
        slipGaji: [
          { pendapatan: toObj(slipGajiProdData.pendapatan) },
          { bonus:      toObj(slipGajiProdData.bonus) },
          { potongan:   toObj(slipGajiProdData.potongan) },
        ],
        totalPenerimaan,
      }
    );

    window.showToast("Slip gaji berhasil disimpan", "success");
    document.getElementById("slipGajiProdFormBadge").style.display = "flex";
    const badgeGrid = document.getElementById(`slipGajiProdBadge-${slipGajiProdSelectedUid}`);
    if (badgeGrid) badgeGrid.style.display = "flex";
  } catch (err) {
    console.error("❌ simpanSlipGajiProd:", err);
    window.showToast("Gagal menyimpan slip gaji", "error");
  } finally {
    btn.disabled = false; btn.textContent = "Simpan Slip Gaji";
  }
}