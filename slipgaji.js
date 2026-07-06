/* ── SLIP GAJI (di dalam Rekap Distribusi) ── */
let slipGajiBulan = new Date().getMonth();
let slipGajiTahun = new Date().getFullYear();
let slipGajiSelectedUid  = null;
let slipGajiSelectedNama = null;
const SLIP_GAJI_BULAN_NAMA = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

const SLIP_GAJI_TEMPLATE = {
  pendapatan: [
    { key: "upahPokok",          label: "Upah Pokok",          hari: 0, pembayaran: 0, fixed: true },
    { key: "tunjanganTransport", label: "Tunjangan Transport", hari: 0, pembayaran: 0, fixed: true },
  ],
  bonus: [
    { key: "bonusKehadiran",    label: "Bonus Kehadiran",             hari: 0, pembayaran: 0, fixed: true },
    { key: "bonusKunjungan",    label: "Bonus Kunjungan",             hari: 0, pembayaran: 0, fixed: true },
    { key: "bonusHariLiburPerusahaan", label: "Bonus Hari Libur Perusahaan", hari: 0, pembayaran: 0, fixed: true },
    { key: "bonusCustomerBaru", label: "Bonus Customer Baru",         hari: 0, pembayaran: 0, fixed: true },
  ],
  potongan: [
    { key: "targetData",     label: "Target Data",     hari: 0, pembayaran: 0, fixed: true },
    { key: "targetCustomer", label: "Target Customer", hari: 0, pembayaran: 0, fixed: true },
    { key: "klaimInsentif",  label: "Klaim Insentif",  hari: 0, pembayaran: 0, fixed: true },
    { key: "kasbon",         label: "Kasbon",          hari: 0, pembayaran: 0, fixed: true },
  ],
};

let slipGajiData = null;

window.initSlipGajiPanel = function() {
  document.getElementById("slipGajiReloadBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("slipGajiReloadBtn");
    btn.classList.add("spinning");
    await renderSlipGajiKurirGrid();
    btn.classList.remove("spinning");
  });

  document.getElementById("slipGajiToRekapBackBtn")?.addEventListener("click", () => {
    document.getElementById("slipGajiDetailWrapper")?.classList.remove("show");
    document.querySelectorAll("#rekapDistribusiList .lap-kurir-item").forEach(x => x.classList.remove("active"));
  });

  document.getElementById("slipGajiSaveBtn")?.addEventListener("click", simpanSlipGaji);

  document.querySelectorAll(".slip-gaji-add-btn").forEach(btn => {
    btn.addEventListener("click", () => tambahItemCustom(btn.dataset.section));
  });

  initSlipGajiFilter();
};

window.openSlipGajiPanel = function() {
  document.getElementById("rekapDistribusiDetailWrapper")?.classList.remove("show");
  document.getElementById("assetsDetailWrapper")?.classList.remove("show");
  document.getElementById("slipGajiDetailWrapper")?.classList.add("show");

  document.getElementById("slipGajiFormWrap").style.display = "none";
  slipGajiSelectedUid = null;

  if (window.innerWidth <= 768) {
    document.getElementById("slipGajiToRekapBackBtn").style.display = "flex";
  }

  renderSlipGajiKurirGrid();
};

async function renderSlipGajiKurirGrid() {
  const gridEl = document.getElementById("slipGajiKurirGrid");
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

  const periodeLabel = `${SLIP_GAJI_BULAN_NAMA[slipGajiBulan]} ${slipGajiTahun}`;

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
          <span class="rekap-dist-saved-badge" id="slipGajiBadge-${escSlip(u.uid)}" style="display:none">
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
      pilihKurirSlipGaji(card.dataset.uid, card.dataset.nama);
    });
  });

  cekSlipGajiSudahDikirimBatch(users.map(u => u.uid));
}

async function cekSlipGajiSudahDikirimBatch(uids) {
  const periode = `${slipGajiTahun}-${String(slipGajiBulan + 1).padStart(2, "0")}`;
  await Promise.all(uids.map(async uid => {
    const badge = document.getElementById(`slipGajiBadge-${uid}`);
    if (!badge) return;
    try {
      const snap = await window.getDoc(window.doc(window.db, "users", uid, "slipGaji", periode));
      badge.style.display = snap.exists() ? "flex" : "none";
    } catch (err) {
      console.error("❌ cekSlipGajiSudahDikirim:", err);
    }
  }));
}

async function pilihKurirSlipGaji(uid, nama) {
  slipGajiSelectedUid  = uid;
  slipGajiSelectedNama = nama;

  document.getElementById("slipGajiFormWrap").style.display = "block";
  document.getElementById("slipGajiFormNama").textContent   = nama;

  slipGajiData = JSON.parse(JSON.stringify(SLIP_GAJI_TEMPLATE));
  document.getElementById("slipGajiCatatan").value = "";

  // hitung hariMasukKerja untuk kurir ini di bulan/tahun filter aktif
  const allLaporan = await window.idb.getAllLaporanAdmin();
  const mm = String(slipGajiBulan + 1).padStart(2, "0");
  const filteredLaporan = allLaporan.filter(l => l.tanggal?.startsWith(`${slipGajiTahun}-${mm}`));
  const hariMasukKerja = filteredLaporan.filter(l => l.data?.[uid]).length;

  const kantorCabang = await window.idb.getKantorCabang();
  const upahHarian   = Number(kantorCabang?.upahHarian) || 0;
  const insentifHarian = Number(kantorCabang?.bonus?.data?.insentif) || 0;

  // isi Upah Pokok
  const idxUpah = slipGajiData.pendapatan.findIndex(i => i.key === "upahPokok");
  if (idxUpah !== -1) {
    slipGajiData.pendapatan[idxUpah].hari = hariMasukKerja;
    slipGajiData.pendapatan[idxUpah].pembayaran = hariMasukKerja * upahHarian;
  }

  // isi Tunjangan Transport
  const idxTransport = slipGajiData.pendapatan.findIndex(i => i.key === "tunjanganTransport");
  if (idxTransport !== -1) {
    slipGajiData.pendapatan[idxTransport].hari = hariMasukKerja;
    slipGajiData.pendapatan[idxTransport].pembayaran = hariMasukKerja * insentifHarian;
  }

  // ── BONUS KEHADIRAN (pakai fungsi shared dengan Rekap Distribusi) ──
  const bonusInfo = await window.hitungBonusKehadiran(uid, slipGajiBulan, slipGajiTahun);
  const bonusKehadiran = bonusInfo.bonusKehadiran;

  let bonusKunjungan = 0;
  filteredLaporan.forEach(l => {
    const d = l.data?.[uid];
    if (!d) return;
    bonusKunjungan += Number(d.distribusi?.keuangan?.bonus?.bonusKunjungan) || 0;
  });

  const idxBonusKehadiran = slipGajiData.bonus.findIndex(i => i.key === "bonusKehadiran");
  if (idxBonusKehadiran !== -1) {
    slipGajiData.bonus[idxBonusKehadiran].hari = bonusKehadiran > 0 ? hariMasukKerja : 0;
    slipGajiData.bonus[idxBonusKehadiran].pembayaran = bonusKehadiran;
  }
  const idxBonusKunjungan = slipGajiData.bonus.findIndex(i => i.key === "bonusKunjungan");
  if (idxBonusKunjungan !== -1) {
    slipGajiData.bonus[idxBonusKunjungan].hari = "-";
    slipGajiData.bonus[idxBonusKunjungan].pembayaran = bonusKunjungan;
  }

  // ── Bonus Hari Libur Perusahaan ──
  const adminUid = window.auth?.currentUser?.uid;
  const bulanStrLibur = `${slipGajiTahun}-${String(slipGajiBulan + 1).padStart(2, "0")}`;
  let jumlahHariLiburPerusahaan = 0;
  try {
    const liburSnap = await window.getDoc(window.doc(window.db, "users", adminUid, "hariLibur", bulanStrLibur));
    if (liburSnap.exists()) jumlahHariLiburPerusahaan = Number(liburSnap.data()?.jumlahHari) || 0;
  } catch (err) {
    console.error("❌ fetch hariLibur (slip gaji):", err);
  }
  const bonusHariLiburPerusahaan = jumlahHariLiburPerusahaan * upahHarian;

  const idxBonusLibur = slipGajiData.bonus.findIndex(i => i.key === "bonusHariLiburPerusahaan");
  if (idxBonusLibur !== -1) {
    slipGajiData.bonus[idxBonusLibur].hari = jumlahHariLiburPerusahaan;
    slipGajiData.bonus[idxBonusLibur].pembayaran = bonusHariLiburPerusahaan;
  }

  // ── POTONGAN: Target Data, Target Customer, Klaim Insentif, Kasbon ──
  let klaimInsentif = 0, kasbon = 0;
  let potonganTargetData = 0, potonganTargetCustomer = 0;
  let customerNew = 0;
  filteredLaporan.forEach(l => {
    const d = l.data?.[uid];
    if (!d) return;
    const dist = d.distribusi || {};
    klaimInsentif += Number(dist.keuangan?.klaimInsentif) || 0;
    kasbon        += Number(dist.keuangan?.kasbon)        || 0;
    potonganTargetData     += Number(dist.infoTarget?.potongan?.potonganTargetData)     || 0;
    potonganTargetCustomer += Number(dist.infoTarget?.potongan?.potonganTargetCustomer) || 0;
    customerNew   += Number(dist.infoTarget?.customerNew) || 0;
  });

  const idxTargetData = slipGajiData.potongan.findIndex(i => i.key === "targetData");
  if (idxTargetData !== -1) {
    slipGajiData.potongan[idxTargetData].hari = "-";
    slipGajiData.potongan[idxTargetData].pembayaran = potonganTargetData;
  }

  const idxTargetCustomer = slipGajiData.potongan.findIndex(i => i.key === "targetCustomer");
  if (idxTargetCustomer !== -1) {
    slipGajiData.potongan[idxTargetCustomer].hari = "-";
    slipGajiData.potongan[idxTargetCustomer].pembayaran = potonganTargetCustomer;
  }

  const idxKlaimInsentif = slipGajiData.potongan.findIndex(i => i.key === "klaimInsentif");
  if (idxKlaimInsentif !== -1) {
    slipGajiData.potongan[idxKlaimInsentif].hari = "-";
    slipGajiData.potongan[idxKlaimInsentif].pembayaran = klaimInsentif;
  }

  const idxKasbon = slipGajiData.potongan.findIndex(i => i.key === "kasbon");
  if (idxKasbon !== -1) {
    slipGajiData.potongan[idxKasbon].hari = "-";
    slipGajiData.potongan[idxKasbon].pembayaran = kasbon;
  }

  const upahHunter = Number(kantorCabang?.upahHunter) || 0;
  const nominalCustomerBaru = customerNew * upahHunter;

  const idxBonusCustomerBaru = slipGajiData.bonus.findIndex(i => i.key === "bonusCustomerBaru");
  if (idxBonusCustomerBaru !== -1) {
    slipGajiData.bonus[idxBonusCustomerBaru].hari = customerNew || "-";
    slipGajiData.bonus[idxBonusCustomerBaru].pembayaran = nominalCustomerBaru;
  }

  renderSlipGajiItems();
}

function renderSlipGajiItems() {
  ["pendapatan", "bonus", "potongan"].forEach(section => {
    const containerEl = document.getElementById(`slipGaji${capitalize(section)}Items`);
    if (!containerEl) return;

    const jumlahSection = slipGajiData[section].reduce((a, v) => a + (Number(v.pembayaran) || 0), 0);

    containerEl.innerHTML = slipGajiData[section].map((item, idx) => `
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
        slipGajiData[section][idx].hari = Number(hariInput.value) || 0;
      });
      nominalInput.addEventListener("input", () => {
        const angka = nominalInput.value.replace(/\D/g, "");
        nominalInput.value = angka ? Number(angka).toLocaleString("id-ID") : "";
        slipGajiData[section][idx].pembayaran = Number(angka) || 0;
        updateJumlahSection(section);
        hitungTotalPenerimaan();
      });
      labelInput?.addEventListener("input", () => {
        if (!slipGajiData[section][idx].fixed) {
          slipGajiData[section][idx].label = labelInput.value;
        }
      });
      removeBtn?.addEventListener("click", () => {
        slipGajiData[section].splice(idx, 1);
        renderSlipGajiItems();
        hitungTotalPenerimaan();
      });
    });
  });

  hitungTotalPenerimaan();
}
function updateJumlahSection(section) {
  const containerEl = document.getElementById(`slipGaji${capitalize(section)}Items`);
  if (!containerEl) return;
  const jumlahRow = containerEl.querySelector(".slip-gaji-jumlah-row .slip-gaji-jumlah-val");
  if (!jumlahRow) return;
  const jumlahSection = slipGajiData[section].reduce((a, v) => a + (Number(v.pembayaran) || 0), 0);
  jumlahRow.textContent = jumlahSection ? jumlahSection.toLocaleString("id-ID") : "-";
}
function tambahItemCustom(section) {
  if (!slipGajiData) return;
  slipGajiData[section].push({ key: `custom_${Date.now()}`, label: "", hari: 0, pembayaran: 0, fixed: false });
  renderSlipGajiItems();
}

function hitungTotalPenerimaan() {
  if (!slipGajiData) return;
  const sum = arr => arr.reduce((a, v) => a + (Number(v.pembayaran) || 0), 0);
  const totalPendapatan = sum(slipGajiData.pendapatan);
  const totalBonus      = sum(slipGajiData.bonus);
  const totalPotongan   = sum(slipGajiData.potongan);
  const total = totalPendapatan + totalBonus - totalPotongan;

  const el = document.getElementById("slipGajiTotalPenerimaan");
  if (el) el.textContent = `Rp ${total.toLocaleString("id-ID")}`;
}

async function simpanSlipGaji() {
  if (!slipGajiSelectedUid) { window.showToast("Pilih kurir dulu", "error"); return; }

  const btn = document.getElementById("slipGajiSaveBtn");
  btn.disabled = true; btn.textContent = "Menyimpan...";

  try {
    const adminUid     = window.auth?.currentUser?.uid;
    const kantorCabang = await window.idb.getKantorCabang();
    const periode      = `${slipGajiTahun}-${String(slipGajiBulan + 1).padStart(2, "0")}`;
    const catatan      = document.getElementById("slipGajiCatatan").value.trim();

    const toObj = arr => arr.reduce((acc, item) => {
      acc[item.key] = { hari: item.hari, pembayaran: item.pembayaran };
      return acc;
    }, {});

    const sum = arr => arr.reduce((a, v) => a + (Number(v.pembayaran) || 0), 0);
    const totalPenerimaan = sum(slipGajiData.pendapatan) + sum(slipGajiData.bonus) - sum(slipGajiData.potongan);

    await window.setDoc(
      window.doc(window.db, "users", slipGajiSelectedUid, "slipGaji", periode),
      {
        catatan,
        createdAt: window.serverTimestamp(),
        createdBy: adminUid,
        idCabang: kantorCabang?.id || "",
        idUser: slipGajiSelectedUid,
        periode,
        slipGaji: [
          { pendapatan: toObj(slipGajiData.pendapatan) },
          { bonus:      toObj(slipGajiData.bonus) },
          { potongan:   toObj(slipGajiData.potongan) },
        ],
        totalPenerimaan,
      }
    );

    window.showToast("Slip gaji berhasil disimpan", "success");
  } catch (err) {
    console.error("❌ simpanSlipGaji:", err);
    window.showToast("Gagal menyimpan slip gaji", "error");
  } finally {
    btn.disabled = false; btn.textContent = "Simpan Slip Gaji";
  }
}

function initSlipGajiFilter() {
  const bulanBtn = document.getElementById("slipGajiBulanBtn");
  const tahunBtn = document.getElementById("slipGajiTahunBtn");
  const bulanNamaList = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

  document.getElementById("slipGajiBulanLabel").textContent = bulanNamaList[slipGajiBulan];
  document.getElementById("slipGajiTahunLabel").textContent = slipGajiTahun;

  const bulanDD = document.createElement("div");
  bulanDD.className = "rekap-dist-dropdown";
  bulanDD.id = "slipGajiBulanDropdown";
  bulanDD.style.display = "none";
  bulanDD.innerHTML = bulanNamaList.map((n, i) =>
    `<div class="rekap-dist-dropdown-option ${i===slipGajiBulan?"selected":""}" data-bulan="${i}">${n}</div>`).join("");
  document.body.appendChild(bulanDD);

  const tahunDD = document.createElement("div");
  tahunDD.className = "rekap-dist-dropdown";
  tahunDD.id = "slipGajiTahunDropdown";
  tahunDD.style.display = "none";
  const now = new Date().getFullYear();
  tahunDD.innerHTML = [now-1, now, now+1].map(y =>
    `<div class="rekap-dist-dropdown-option ${y===slipGajiTahun?"selected":""}" data-tahun="${y}">${y}</div>`).join("");
  document.body.appendChild(tahunDD);

  const closeAll = () => { bulanDD.style.display = "none"; tahunDD.style.display = "none"; };
  document.addEventListener("click", e => {
    if (!e.target.closest("#slipGajiBulanBtn") && !e.target.closest("#slipGajiTahunBtn")
        && !e.target.closest("#slipGajiBulanDropdown") && !e.target.closest("#slipGajiTahunDropdown")) closeAll();
  });

  const openDD = (btn, dd) => {
    const isOpen = dd.style.display === "block";
    closeAll();
    if (isOpen) return;
    const rect = btn.getBoundingClientRect();
    dd.style.position = "fixed";
    dd.style.top  = (rect.bottom + 4) + "px";
    dd.style.left = rect.left + "px";
    dd.style.display = "block";
  };

  bulanBtn?.addEventListener("click", e => { e.stopPropagation(); openDD(bulanBtn, bulanDD); });
  tahunBtn?.addEventListener("click", e => { e.stopPropagation(); openDD(tahunBtn, tahunDD); });

  bulanDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(opt => {
    opt.addEventListener("click", e => {
      e.stopPropagation();
      slipGajiBulan = Number(opt.dataset.bulan);
      document.getElementById("slipGajiBulanLabel").textContent = bulanNamaList[slipGajiBulan];
      bulanDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      closeAll();
      document.getElementById("slipGajiFormWrap").style.display = "none";
      slipGajiSelectedUid = null;
      renderSlipGajiKurirGrid();
    });
  });

  tahunDD.addEventListener("click", e => {
    e.stopPropagation();
    const opt = e.target.closest(".rekap-dist-dropdown-option");
    if (!opt) return;
    slipGajiTahun = Number(opt.dataset.tahun);
    document.getElementById("slipGajiTahunLabel").textContent = slipGajiTahun;
    tahunDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    document.getElementById("slipGajiFormWrap").style.display = "none";
    slipGajiSelectedUid = null;
    renderSlipGajiKurirGrid();
  });
}

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function escSlip(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}