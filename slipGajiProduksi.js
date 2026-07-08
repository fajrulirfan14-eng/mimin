
let slipGajiProdSelectedUid  = null;
let slipGajiProdSelectedNama = null;

const SLIP_GAJI_PROD_TEMPLATE = {
  pendapatan: [],
  bonus: [],
  potongan: [
    { key: "kasbon", label: "Kasbon", hari: "-", pembayaran: 0, fixed: true },
  ],
};

let slipGajiProdData = null;
let slipGajiProdSelectedRole = null;
let slipGajiProdPendapatanTotal = 0;

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
    slipGajiProdSelectedRole = null;
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
    slipGajiProdSelectedRole = null;
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
      <div class="rekap-dist-card slip-gaji-kurir-card" data-uid="${escSlip(u.uid)}" data-nama="${escSlip(nama)}" data-role="${escSlip(u.role || "")}">
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
      pilihKurirSlipGajiProd(card.dataset.uid, card.dataset.nama, card.dataset.role);
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
async function pilihKurirSlipGajiProd(uid, nama, role) {
  slipGajiProdSelectedUid  = uid;
  slipGajiProdSelectedNama = nama;
  slipGajiProdSelectedRole = role;

  document.getElementById("slipGajiProdFormWrap").style.display = "block";
  document.getElementById("slipGajiProdFormNama").textContent   = nama;

  const periodeLabelForm = `Periode: ${REKAP_PROD_BULAN_NAMA[rekapProdBulan]} ${rekapProdTahun}`;
  const periodeEl = document.getElementById("slipGajiProdFormPeriode");
  if (periodeEl) periodeEl.textContent = periodeLabelForm;

  await cekSlipGajiProdFormBadge(uid);

  slipGajiProdData = JSON.parse(JSON.stringify(SLIP_GAJI_PROD_TEMPLATE));
  document.getElementById("slipGajiProdCatatan").value = "";
  slipGajiProdPendapatanTotal = 0;

  const kasbonPerUser = await loadKasbonProduksiPerUser();
  const idxKasbon = slipGajiProdData.potongan.findIndex(i => i.key === "kasbon");
  if (idxKasbon !== -1) {
    slipGajiProdData.potongan[idxKasbon].pembayaran = kasbonPerUser[uid] || 0;
  }

  if (role === "produksi") {
    await renderSlipGajiProdPendapatanTable(uid);
  } else {
    // adminCabang: Pendapatan cuma "Gaji Pokok" input manual
    slipGajiProdData.pendapatan = [
      { key: "gajiPokok", label: "Gaji Pokok", pembayaran: 0, fixed: true },
    ];
    renderSlipGajiProdPendapatanManual();
  }

  renderSlipGajiProdItems();
}

async function renderSlipGajiProdPendapatanTable(uid) {
  const bodyEl = document.getElementById("slipGajiProdPendapatanBody");
  if (!bodyEl) return;

  bodyEl.innerHTML = `<tr><td colspan="4" class="slipgajiprod-empty-cell">Memuat...</td></tr>`;

  try {
    const kantorCabang = await window.idb.getKantorCabang();
    const loyangArr = kantorCabang?.loyang || [];
    const aktifList = loyangArr.filter(item => item?.status === true);

    const hargaMap = {};
    aktifList.forEach(item => {
      if (item.jenisLoyang) hargaMap[item.jenisLoyang] = Number(item.upah) || 0;
    });

    const qtyPerUser = await loadStockOpnameLoyangPerUser();
    const qtyMap = qtyPerUser[uid] || {};

    const jenisList = aktifList.map(item => item.jenisLoyang).filter(Boolean);

    if (!jenisList.length) {
      bodyEl.innerHTML = `<tr><td colspan="4" class="slipgajiprod-empty-cell">-</td></tr>`;
      slipGajiProdPendapatanTotal = 0;
      return;
    }

    let total = 0;
    bodyEl.innerHTML = jenisList.map(jenis => {
      const qty   = qtyMap[jenis]   || 0;
      const harga = hargaMap[jenis] || 0;
      const upah  = qty * harga;
      total += upah;
      return `
        <tr>
          <td>${jenis}</td>
          <td>${qty || "-"}</td>
          <td>${harga ? harga.toLocaleString("id-ID") : "-"}</td>
          <td>${upah ? upah.toLocaleString("id-ID") : "-"}</td>
        </tr>`;
    }).join("") + `
      <tr class="slipgajiprod-total-row">
        <td>Jumlah</td><td></td><td></td>
        <td>${total ? total.toLocaleString("id-ID") : "-"}</td>
      </tr>`;

    slipGajiProdPendapatanTotal = total;
  } catch (err) {
    console.error("❌ renderSlipGajiProdPendapatanTable:", err);
    bodyEl.innerHTML = `<tr><td colspan="4" class="slipgajiprod-empty-cell">Gagal memuat</td></tr>`;
    slipGajiProdPendapatanTotal = 0;
  }

  hitungTotalPenerimaanProd();
}

function renderSlipGajiProdPendapatanManual() {
  const bodyEl = document.getElementById("slipGajiProdPendapatanBody");
  if (!bodyEl) return;

  bodyEl.innerHTML = slipGajiProdData.pendapatan.map((item, idx) => `
    <tr data-idx="${idx}">
      <td>${escSlip(item.label)}</td>
      <td>-</td>
      <td>-</td>
      <td>
        <input type="text" class="slipgajiprod-input-nominal" data-idx="${idx}" value="${item.pembayaran ? item.pembayaran.toLocaleString("id-ID") : ""}" placeholder="0">
      </td>
    </tr>`).join("");

  bodyEl.querySelectorAll(".slipgajiprod-input-nominal").forEach(inp => {
    inp.addEventListener("input", () => {
      const idx = Number(inp.dataset.idx);
      const angka = inp.value.replace(/\D/g, "");
      inp.value = angka ? Number(angka).toLocaleString("id-ID") : "";
      slipGajiProdData.pendapatan[idx].pembayaran = Number(angka) || 0;
      slipGajiProdPendapatanTotal = slipGajiProdData.pendapatan.reduce((a, v) => a + (Number(v.pembayaran) || 0), 0);
      hitungTotalPenerimaanProd();
    });
  });
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
  ["bonus", "potongan"].forEach(section => {
    const bodyEl = document.getElementById(`slipGajiProd${capitalize(section)}Body`);
    if (!bodyEl) return;

    const items = slipGajiProdData[section];

    if (!items.length) {
      const emptyLabel = section === "bonus" ? "Belum ada bonus" : "Belum ada potongan";
      bodyEl.innerHTML = `<tr class="slipgajiprod-placeholder-row"><td colspan="3" class="slipgajiprod-empty-cell">${emptyLabel}</td></tr>`;
      return;
    }

    bodyEl.innerHTML = items.map((item, idx) => `
      <tr data-section="${section}" data-idx="${idx}">
        <td>
          <input type="text" class="slipgajiprod-input-label" value="${escSlip(item.label)}" ${item.fixed ? "readonly" : ""}>
        </td>
        <td>
          <input type="text" class="slipgajiprod-input-nominal" value="${item.pembayaran ? item.pembayaran.toLocaleString("id-ID") : ""}" placeholder="0">
        </td>
        <td>
          ${item.fixed ? "" : `<button class="slipgajiprod-remove-btn"><i class="fa-solid fa-trash"></i></button>`}
        </td>
      </tr>`).join("");

    bodyEl.querySelectorAll("tr[data-idx]").forEach(row => {
      const idx = Number(row.dataset.idx);
      const nominalInput = row.querySelector(".slipgajiprod-input-nominal");
      const labelInput   = row.querySelector(".slipgajiprod-input-label");
      const removeBtn    = row.querySelector(".slipgajiprod-remove-btn");

      nominalInput.addEventListener("input", () => {
        const angka = nominalInput.value.replace(/\D/g, "");
        nominalInput.value = angka ? Number(angka).toLocaleString("id-ID") : "";
        slipGajiProdData[section][idx].pembayaran = Number(angka) || 0;
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
function tambahItemCustomProd(section) {
  if (!slipGajiProdData) return;
  slipGajiProdData[section].push({ key: `custom_${Date.now()}`, label: "", hari: 0, pembayaran: 0, fixed: false });
  renderSlipGajiProdItems();
}

function hitungTotalPenerimaanProd() {
  if (!slipGajiProdData) return;
  const sum = arr => arr.reduce((a, v) => a + (Number(v.pembayaran) || 0), 0);
  const totalBonus    = sum(slipGajiProdData.bonus);
  const totalPotongan = sum(slipGajiProdData.potongan);
  const total = slipGajiProdPendapatanTotal + totalBonus - totalPotongan;

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
    const totalPenerimaan = slipGajiProdPendapatanTotal + sum(slipGajiProdData.bonus) - sum(slipGajiProdData.potongan);

    const slipGajiPayload = [
      { bonus:    toObj(slipGajiProdData.bonus) },
      { potongan: toObj(slipGajiProdData.potongan) },
    ];
    // adminCabang: pendapatan manual (Gaji Pokok) ikut disimpan sebagai rincian
    if (slipGajiProdSelectedRole !== "produksi") {
      slipGajiPayload.unshift({ pendapatan: toObj(slipGajiProdData.pendapatan) });
    }

    await window.setDoc(
      window.doc(window.db, "users", slipGajiProdSelectedUid, "slipGajiProduksi", periode),
      {
        catatan,
        createdAt: window.serverTimestamp(),
        createdBy: adminUid,
        idCabang: kantorCabang?.id || "",
        idUser: slipGajiProdSelectedUid,
        periode,
        totalPendapatan: slipGajiProdPendapatanTotal,
        slipGaji: slipGajiPayload,
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