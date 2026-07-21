/* ── EKUITAS VIEW ── */
let ekuitasProdBulan = new Date().getMonth();
let ekuitasProdTahun = new Date().getFullYear();
let ekuitasInvestorList = [];

function initEkuitasProdFilter() {
  const bulanBtn = document.getElementById("ekuitasProdBulanBtn");
  const tahunBtn = document.getElementById("ekuitasProdTahunBtn");
  const bulanDD  = document.getElementById("ekuitasProdBulanDropdown");
  const tahunDD  = document.getElementById("ekuitasProdTahunDropdown");
  if (!bulanBtn || !tahunBtn || !bulanDD || !tahunDD) return;

  document.getElementById("ekuitasProdBulanLabel").textContent = REKAP_PROD_BULAN_NAMA[ekuitasProdBulan];
  document.getElementById("ekuitasProdTahunLabel").textContent = ekuitasProdTahun;

  const now = new Date().getFullYear();
  tahunDD.innerHTML = [now-1, now, now+1].map(y =>
    `<div class="rekap-dist-dropdown-option ${y===ekuitasProdTahun?"selected":""}" data-tahun="${y}">${y}</div>`
  ).join("");

  bulanDD.innerHTML = REKAP_PROD_BULAN_NAMA.map((nama, i) =>
    `<div class="rekap-dist-dropdown-option ${i===ekuitasProdBulan?"selected":""}" data-bulan="${i}">${nama}</div>`
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

  bulanDD.addEventListener("click", async e => {
    e.stopPropagation();
    const opt = e.target.closest(".rekap-dist-dropdown-option");
    if (!opt) return;
    ekuitasProdBulan = Number(opt.dataset.bulan);
    document.getElementById("ekuitasProdBulanLabel").textContent = REKAP_PROD_BULAN_NAMA[ekuitasProdBulan];
    bulanDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    await refreshEkuitasInvestorData();
  });

  tahunDD.addEventListener("click", async e => {
    e.stopPropagation();
    const opt = e.target.closest(".rekap-dist-dropdown-option");
    if (!opt) return;
    ekuitasProdTahun = Number(opt.dataset.tahun);
    document.getElementById("ekuitasProdTahunLabel").textContent = ekuitasProdTahun;
    tahunDD.querySelectorAll(".rekap-dist-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    await refreshEkuitasInvestorData();
    if (ekuitasSelectedInvestor) await renderEkuitasRoiRiwayat(ekuitasSelectedInvestor);
  });
}

async function loadEkuitasInvestorList() {
  try {
    const adminUid = window.auth?.currentUser?.uid;
    if (!adminUid) return [];

    const allUsers = await window.idb.getUsers();
    const adminData = allUsers.find(u => u.uid === adminUid);
    const idCabangAdmin = adminData?.idCabang;
    if (!idCabangAdmin) return [];

    return allUsers.filter(u => u.role === "investor" && u.idCabang === idCabangAdmin && u.status === true);
  } catch (err) {
    console.error("❌ loadEkuitasInvestorList:", err);
    return [];
  }
}

function renderEkuitasInvestorList() {
  const container = document.getElementById("ekuitasInvestorList");
  if (!container) return;

  if (!ekuitasInvestorList.length) {
    container.innerHTML = `<div class="ekuitas-investor-kosong">Belum ada investor terdaftar di cabang ini</div>`;
    return;
  }

  container.innerHTML = ekuitasInvestorList.map(u => {
    const fotoUrl = u.foto || "";
    const ekuitasNominal = Number(u.ekuitas) || 0;

    return `
    <div class="ekuitas-investor-item" data-uid="${u.id}">
      <div class="ekuitas-investor-avatar">
        ${fotoUrl
          ? `<img src="${fotoUrl}" alt="${u.nama || "Investor"}" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-user\\'></i>'">`
          : `<i class="fa-solid fa-user"></i>`}
      </div>
      <div class="ekuitas-investor-info">
        <div class="ekuitas-investor-nama">${u.nama || "Tanpa Nama"}</div>
        <div class="ekuitas-investor-cabang">${u.cabangEkuitas || "-"}</div>
        <div class="ekuitas-investor-nominal">Rp ${ekuitasNominal.toLocaleString("id-ID")}</div>
      </div>
    </div>
  `;
  }).join("");

  container.querySelectorAll(".ekuitas-investor-item").forEach(item => {
    item.addEventListener("click", () => {
      container.querySelectorAll(".ekuitas-investor-item").forEach(x => x.classList.remove("active"));
      item.classList.add("active");

      const uid = item.dataset.uid;
      const investor = ekuitasInvestorList.find(u => u.id === uid);
      if (investor) fillEkuitasInfoLengkap(investor);
    });
  });
}

let ekuitasSelectedInvestor = null;
let ekuitasEditMode = false;
let ekuitasTtdFile = null;
let ekuitasTtdPreviewUrl = null; // simpan preview base64 sementara biar gak "-" saat re-render

function renderEkuitasTtd(u) {
  const ttdWrap = document.getElementById("ekuitasInfoTtd");
  if (!ttdWrap) return;

  // Kalau baru saja pilih file baru (belum tersimpan), pakai preview lokal
  const src = ekuitasTtdPreviewUrl || u.ttd;

  if (src) {
    ttdWrap.innerHTML = `<img src="${src}" alt="Tanda Tangan"
      onerror="console.error('❌ Gagal load gambar TTD:', this.src); this.parentElement.innerHTML='<span class=\\'ekuitas-info-value\\'>-</span>'">`;
  } else {
    ttdWrap.innerHTML = `<span class="ekuitas-info-value">-</span>`;
  }
}

/* ── CACHE: dokumen ROI per tahun (dipakai bareng semua investor & popup Input ROI) ── */
let ekuitasRoiYearCache = {};
async function loadEkuitasRoiYearDocs(tahun, forceRefresh = false) {
  if (!forceRefresh && ekuitasRoiYearCache[tahun]) {
    return ekuitasRoiYearCache[tahun];
  }

  const adminUid = window.auth?.currentUser?.uid;
  if (!adminUid) return [];

  try {
    const snap = await window.getDocs(window.query(
      window.collection(window.db, "users", adminUid, "roi"),
      window.where("periode", ">=", `${tahun}-01`),
      window.where("periode", "<=", `${tahun}-12`)
    ));

    const docs = [];
    snap.forEach(docSnap => docs.push({ id: docSnap.id, ...docSnap.data() }));
    ekuitasRoiYearCache[tahun] = docs;
    return docs;
  } catch (err) {
    console.error("❌ loadEkuitasRoiYearDocs:", err);
    return [];
  }
}
async function renderEkuitasRoiRiwayat(u) {
  const wrap = document.getElementById("ekuitasRoiRiwayatList");
  if (!wrap) return;

  const investorUid = u.id;
  if (!investorUid) { wrap.innerHTML = ""; return; }

  try {
    const docs = await loadEkuitasRoiYearDocs(ekuitasProdTahun);

    const rows = [];
    docs.forEach(data => {
      const entry = data[investorUid];
      if (entry && Number(entry.return) > 0) {
        rows.push({ periode: data.periode, nominal: Number(entry.return) || 0 });
      }
    });

    if (!rows.length) {
      wrap.innerHTML = `<div class="ekuitas-roi-riwayat-empty">Belum ada data return di tahun ${ekuitasProdTahun}</div>`;
      return;
    }

    rows.sort((a, b) => a.periode.localeCompare(b.periode));

    wrap.innerHTML = rows.map(r => {
      const bulanIdx = Number(r.periode.split("-")[1]) - 1;
      const namaBulan = REKAP_PROD_BULAN_NAMA[bulanIdx] || r.periode;
      return `
        <div class="ekuitas-roi-riwayat-row">
          <span class="ekuitas-roi-riwayat-label">Periode ${namaBulan} ${ekuitasProdTahun}</span>
          <span class="ekuitas-roi-riwayat-value">${r.nominal.toLocaleString("id-ID")}</span>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("❌ renderEkuitasRoiRiwayat:", err);
    wrap.innerHTML = `<div class="ekuitas-roi-riwayat-empty">Gagal memuat riwayat return</div>`;
  }
}
function renderEkuitasRoiKpi(u) {
  const returnVal = Number(u.return) || 0;
  const ekuitasVal = Number(u.ekuitas) || 0;
  const persen = ekuitasVal > 0 ? (returnVal / ekuitasVal) * 100 : 0;

  const nominalEl = document.getElementById("ekuitasRoiNominal");
  const persenEl  = document.getElementById("ekuitasRoiPersen");
  if (nominalEl) nominalEl.textContent = `Rp ${returnVal.toLocaleString("id-ID")}`;
  if (persenEl)  persenEl.textContent  = `${persen >= 0 ? "+" : ""}${persen.toFixed(1)}%`;
}
function fillEkuitasInfoLengkap(u) {
  ekuitasSelectedInvestor = u;
  ekuitasTtdFile = null;
  ekuitasTtdPreviewUrl = null;

  renderEkuitasRoiKpi(u);
  renderEkuitasRoiRiwayat(u);

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || "-";
  };

  setText("ekuitasInfoNama", u.nama);
  const ekuitasNominal = Number(u.ekuitas) || 0;
  setText("ekuitasInfoNominal", "Rp " + ekuitasNominal.toLocaleString("id-ID"));
  setText("ekuitasInfoEmail", u.email);
  setText("ekuitasInfoTelepon", u.noTelepon);
  setText("ekuitasInfoNik", u.nik);
  setText("ekuitasInfoPekerjaan", u.pekerjaan);
  setText("ekuitasInfoTtl", u.tempatTanggalLahir);
  setText("ekuitasInfoAlamat", u.alamat);
  setText("ekuitasInfoCabang", u.cabangEkuitas);
  setText("ekuitasInfoTglInvest", u.tanggalInvest);

  renderEkuitasTtd(u);

  const editBtn = document.getElementById("ekuitasEditBtn");
  if (editBtn) editBtn.style.display = "flex";
  setEkuitasEditMode(false);
}
function setEkuitasEditMode(on) {
  ekuitasEditMode = on;
  const editableIds = [
    "ekuitasInfoNama", "ekuitasInfoNominal", "ekuitasInfoEmail", "ekuitasInfoTelepon",
    "ekuitasInfoNik", "ekuitasInfoPekerjaan", "ekuitasInfoTtl", "ekuitasInfoAlamat",
    "ekuitasInfoCabang", "ekuitasInfoTglInvest"
  ];
  editableIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.contentEditable = on ? "true" : "false";
    el.classList.toggle("editing", on);
  });
  document.getElementById("ekuitasInfoTtd")?.classList.toggle("editing", on);

  const editBtn   = document.getElementById("ekuitasEditBtn");
  const editIcon   = document.getElementById("ekuitasEditBtnIcon");
  const editLabel  = document.getElementById("ekuitasEditBtnLabel");
  const saveBtn    = document.getElementById("ekuitasSaveBtn");

  if (editBtn) editBtn.style.display = "flex"; // tombol tetap tampil di dua mode
  if (editIcon)  editIcon.className = on ? "fa-solid fa-xmark" : "fa-solid fa-pen";
  if (editLabel) editLabel.textContent = on ? "Batalkan" : "Edit";
  if (saveBtn) saveBtn.style.display = on ? "flex" : "none";
}
function showEkuitasConfirm(message, onConfirm) {
  const modal = document.getElementById("ekuitasConfirmModal");
  const msgEl = document.getElementById("ekuitasConfirmMsg");
  if (!modal || !msgEl) return;
  msgEl.textContent = message;
  modal.style.display = "flex";

  const oldYes = document.getElementById("ekuitasConfirmYes");
  const oldNo  = document.getElementById("ekuitasConfirmNo");
  const yesBtn = oldYes.cloneNode(true);
  const noBtn  = oldNo.cloneNode(true);
  oldYes.replaceWith(yesBtn);
  oldNo.replaceWith(noBtn);

  const cleanup = () => { modal.style.display = "none"; };
  yesBtn.addEventListener("click", () => { cleanup(); onConfirm(); });
  noBtn.addEventListener("click", cleanup);
}
function showEkuitasToast(message, success) {
  const container = document.getElementById("ekuitasToastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "ekuitas-toast " + (success ? "ekuitas-toast-success" : "ekuitas-toast-error");
  toast.innerHTML = `<i class="fa-solid ${success ? "fa-circle-check" : "fa-circle-xmark"}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
async function saveEkuitasEdit() {
  if (!ekuitasSelectedInvestor) return;

  showEkuitasConfirm("Simpan perubahan data investor ini?", async () => {
    try {
      const uid = ekuitasSelectedInvestor.id;
      const nominalRaw = document.getElementById("ekuitasInfoNominal").textContent.replace(/[^\d]/g, "");

      const updatedData = {
        nama: document.getElementById("ekuitasInfoNama").textContent.trim(),
        ekuitas: Number(nominalRaw) || 0,
        email: document.getElementById("ekuitasInfoEmail").textContent.trim(),
        noTelepon: document.getElementById("ekuitasInfoTelepon").textContent.trim(),
        nik: document.getElementById("ekuitasInfoNik").textContent.trim(),
        pekerjaan: document.getElementById("ekuitasInfoPekerjaan").textContent.trim(),
        tempatTanggalLahir: document.getElementById("ekuitasInfoTtl").textContent.trim(),
        alamat: document.getElementById("ekuitasInfoAlamat").textContent.trim(),
        cabangEkuitas: document.getElementById("ekuitasInfoCabang").textContent.trim(),
        tanggalInvest: document.getElementById("ekuitasInfoTglInvest").textContent.trim(),
      };

      // === FIX UTAMA: upload TTD ===
      if (ekuitasTtdFile) {
        // 1. Path stabil (tanpa Date.now()) -> upload berikutnya akan MENIMPA file lama,
        //    bukan bikin file baru terus-menerus (menghindari sampah di storage).
        const ext = (ekuitasTtdFile.type && ekuitasTtdFile.type.split("/")[1]) || "png";
        const path = `ttd/${uid}.${ext}`;
        const fileRef = window.storageRef(window.storage, path);

        // 2. Set contentType EKSPLISIT. Ini kunci -- storage rules kamu mewajibkan
        //    request.resource.contentType.matches("image/.*"). Kalau uploadBytes
        //    tidak mengirim contentType yang valid, upload DITOLAK oleh rules,
        //    tapi error-nya gampang ke-skip kalau tidak di-log dengan jelas.
        const metadata = { contentType: ekuitasTtdFile.type || "image/png" };

        await window.uploadBytes(fileRef, ekuitasTtdFile, metadata);

        // 3. Ambil URL baru. Firebase otomatis kasih token baru tiap upload,
        //    jadi <img> pasti fetch ulang (tidak ke-cache oleh browser).
        const newTtdUrl = await window.getDownloadURL(fileRef);
        updatedData.ttd = newTtdUrl;
      }

      await window.updateDoc(window.doc(window.db, "users", uid), updatedData);

      Object.assign(ekuitasSelectedInvestor, updatedData);
      const idx = ekuitasInvestorList.findIndex(u => u.id === uid);
      if (idx > -1) ekuitasInvestorList[idx] = ekuitasSelectedInvestor;

      // Bersihkan state file/preview SEBELUM render ulang supaya renderEkuitasTtd
      // pakai u.ttd (URL final dari server), bukan preview base64 lama.
      ekuitasTtdFile = null;
      ekuitasTtdPreviewUrl = null;

      renderEkuitasInvestorList();
      fillEkuitasInfoLengkap(ekuitasSelectedInvestor);
      showEkuitasToast("Data berhasil disimpan", true);
    } catch (err) {
      // Sebelumnya error upload/permission ketelan dan UI cuma nampilin "-" tanpa alasan jelas.
      console.error("❌ saveEkuitasEdit:", err);
      showEkuitasToast("Gagal menyimpan data: " + (err?.message || "unknown error"), false);
    }
  });
}

async function openEkuitasRoiModal() {
  if (!ekuitasSelectedInvestor) {
    showEkuitasToast("Pilih investor dulu", false);
    return;
  }

  const adminUid = window.auth?.currentUser?.uid;
  const investorUid = ekuitasSelectedInvestor.id;
  const periode = `${ekuitasProdTahun}-${String(ekuitasProdBulan + 1).padStart(2, "0")}`;
  const namaBulan = REKAP_PROD_BULAN_NAMA[ekuitasProdBulan];

  document.getElementById("ekuitasRoiModalPeriode").textContent = `Periode ${namaBulan} ${ekuitasProdTahun}`;
  document.getElementById("ekuitasRoiModalNominal").value = "";
  document.getElementById("ekuitasRoiModalSave").textContent = "Simpan";
  document.getElementById("ekuitasRoiModalOverlay").style.display = "flex";
  
  let entry = null;
  const cachedDocs = ekuitasRoiYearCache[ekuitasProdTahun];
  if (cachedDocs) {
    const docPeriode = cachedDocs.find(d => d.periode === periode);
    entry = docPeriode?.[investorUid] || null;
  } else {
    // 2) cache kosong -> fallback fetch dari Firestore (sekalian ngisi cache tahun ini)
    try {
      const docs = await loadEkuitasRoiYearDocs(ekuitasProdTahun);
      const docPeriode = docs.find(d => d.periode === periode);
      entry = docPeriode?.[investorUid] || null;
    } catch (err) {
      console.error("❌ cek data ROI existing:", err);
    }
  }

  if (entry && Number(entry.return) > 0) {
    const nominal = Number(entry.return) || 0;
    document.getElementById("ekuitasRoiModalNominal").value = nominal.toLocaleString("id-ID");
    document.getElementById("ekuitasRoiModalSave").textContent = "Update";
  }
}
function closeEkuitasRoiModal() {
  document.getElementById("ekuitasRoiModalOverlay").style.display = "none";
}
async function hitungTotalReturnInvestor(adminUid, investorUid) {
  const snap = await window.getDocs(window.collection(window.db, "users", adminUid, "roi"));
  let total = 0;
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const entry = data[investorUid];
    if (entry) total += Number(entry.return) || 0;
  });
  return total;
}
function updateEkuitasRoiCache(tahun, periode, investorUid, nominal) {
  if (!ekuitasRoiYearCache[tahun]) return;
  const docs = ekuitasRoiYearCache[tahun];
  let target = docs.find(d => d.periode === periode);
  if (!target) {
    target = { id: periode, periode };
    docs.push(target);
  }
  target[investorUid] = { return: nominal };
}
async function simpanEkuitasRoi() {
  if (!ekuitasSelectedInvestor) return;

  const adminUid = window.auth?.currentUser?.uid;
  if (!adminUid) { showEkuitasToast("User tidak terdeteksi", false); return; }

  const nominal = Number(document.getElementById("ekuitasRoiModalNominal").value.replace(/\D/g, "")) || 0;
  if (nominal <= 0) {
    showEkuitasToast("Isi nominal dulu", false);
    return;
  }

  const investorUid = ekuitasSelectedInvestor.id;
  const periode = `${ekuitasProdTahun}-${String(ekuitasProdBulan + 1).padStart(2, "0")}`;

  try {
    const kantorCabang = await window.idb.getKantorCabang();

    await window.setDoc(window.doc(window.db, "users", adminUid, "roi", periode), {
      createdAt: window.serverTimestamp(),
      createdBy: adminUid,
      idCabang: kantorCabang?.id || "",
      periode,
      [investorUid]: { return: nominal }
    }, { merge: true });

    updateEkuitasRoiCache(ekuitasProdTahun, periode, investorUid, nominal);

    const totalReturn = await hitungTotalReturnInvestor(adminUid, investorUid);
    await window.updateDoc(window.doc(window.db, "users", investorUid), { return: totalReturn });

    // update state di memori + IDB biar KPI langsung ke-refresh tanpa perlu reload
    ekuitasSelectedInvestor.return = totalReturn;
    const idx = ekuitasInvestorList.findIndex(u => u.id === investorUid);
    if (idx > -1) ekuitasInvestorList[idx].return = totalReturn;
    try {
      await window.idb.saveUsers([ekuitasSelectedInvestor]);
    } catch (idbErr) {
      console.error("❌ Gagal update IDB return (non-fatal):", idbErr);
    }

    renderEkuitasRoiKpi(ekuitasSelectedInvestor);
    renderEkuitasRoiRiwayat(ekuitasSelectedInvestor);
    renderEkuitasInvestorList();

    showEkuitasToast("ROI berhasil disimpan", true);
    closeEkuitasRoiModal();
  } catch (err) {
    console.error("❌ simpanEkuitasRoi:", err);
    showEkuitasToast("Gagal menyimpan ROI", false);
  }
}

function initEkuitasRoiModal() {
  document.getElementById("ekuitasInputRoiBtn")?.addEventListener("click", openEkuitasRoiModal);
  document.getElementById("ekuitasRoiModalCancel")?.addEventListener("click", closeEkuitasRoiModal);
  document.getElementById("ekuitasRoiModalSave")?.addEventListener("click", simpanEkuitasRoi);
  document.getElementById("ekuitasRoiModalOverlay")?.addEventListener("click", e => {
    if (e.target.id === "ekuitasRoiModalOverlay") closeEkuitasRoiModal();
  });

  const nominalInput = document.getElementById("ekuitasRoiModalNominal");
  if (nominalInput && !nominalInput.dataset.ribuanBound) {
    nominalInput.dataset.ribuanBound = "true";
    nominalInput.addEventListener("input", () => {
      const angka = Number(nominalInput.value.replace(/\D/g, "")) || 0;
      nominalInput.value = angka ? angka.toLocaleString("id-ID") : "";
    });
  }
}
function initEkuitasEditHandlers() {
  document.getElementById("ekuitasEditBtn")?.addEventListener("click", () => {
    if (!ekuitasSelectedInvestor) return;

    if (ekuitasEditMode) {
      // sedang di mode edit -> tombol berfungsi sebagai "Batalkan"
      fillEkuitasInfoLengkap(ekuitasSelectedInvestor); // reset tampilan ke data asli, otomatis balik ke mode non-edit
      return;
    }

    document.getElementById("ekuitasInfoNominal").textContent = String(Number(ekuitasSelectedInvestor.ekuitas) || 0);
    setEkuitasEditMode(true);
  });

  document.getElementById("ekuitasSaveBtn")?.addEventListener("click", saveEkuitasEdit);

  document.getElementById("ekuitasInfoTtd")?.addEventListener("click", () => {
    if (!ekuitasEditMode) return;
    document.getElementById("ekuitasTtdFileInput")?.click();
  });

  document.getElementById("ekuitasTtdFileInput")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showEkuitasToast("File harus berupa gambar", false);
      e.target.value = "";
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showEkuitasToast("Ukuran gambar maksimal 3MB", false);
      e.target.value = "";
      return;
    }

    ekuitasTtdFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      ekuitasTtdPreviewUrl = ev.target.result;
      document.getElementById("ekuitasInfoTtd").innerHTML =
        `<img src="${ekuitasTtdPreviewUrl}" alt="Preview Tanda Tangan">`;
    };
    reader.readAsDataURL(file);
  });
}

async function loadEkuitasNeracaPeriode() {
  const adminUid = window.auth?.currentUser?.uid;
  if (!adminUid) return null;

  const periode = `${ekuitasProdTahun}-${String(ekuitasProdBulan + 1).padStart(2, "0")}`;

  try {
    const snap = await window.getDoc(window.doc(window.db, "users", adminUid, "neracaSaldo", periode));
    if (!snap.exists()) return null;
    return snap.data();
  } catch (err) {
    console.error("❌ loadEkuitasNeracaPeriode:", err);
    return null;
  }
}
function hitungAkumulasiEkuitas() {
  return ekuitasInvestorList.reduce((sum, u) => sum + (Number(u.ekuitas) || 0), 0);
}
function renderEkuitasLabaTable(valuasi, dividen) {
  const wrap = document.getElementById("ekuitasLabaTableBody");
  if (!wrap) return;

  if (!ekuitasInvestorList.length) {
    wrap.innerHTML = `<div class="ekuitas-laba-empty">Belum ada investor terdaftar</div>`;
    return;
  }

  const list = ekuitasInvestorList.slice(0, 5);

  wrap.innerHTML = list.map(u => {
    const ekuitasNominal = Number(u.ekuitas) || 0;
    const kepemilikanPersen = valuasi > 0 ? (ekuitasNominal / valuasi) * 100 : 0;
    const roiNominal = (kepemilikanPersen / 100) * dividen;

    return `
      <div class="ekuitas-laba-table-row">
        <span class="nama">${u.nama || "Tanpa Nama"}</span>
        <span class="value">${valuasi > 0 ? kepemilikanPersen.toFixed(1) + "%" : "-"}</span>
        <span class="value">Rp ${roiNominal.toLocaleString("id-ID")}</span>
      </div>
    `;
  }).join("");
}
async function refreshEkuitasLabaCard() {
  const neraca  = await loadEkuitasNeracaPeriode();
  const valuasi = hitungAkumulasiEkuitas();

  const labaBersih = Number(neraca?.labaBerjalan) || 0;
  const dividen    = Number(neraca?.pembagianLaba?.dividen) || 0;

  document.getElementById("ekuitasLabaBersih").textContent  = `Rp ${labaBersih.toLocaleString("id-ID")}`;
  document.getElementById("ekuitasLabaDividen").textContent = `Rp ${dividen.toLocaleString("id-ID")}`;
  document.getElementById("ekuitasLabaValuasi").textContent = valuasi > 0 ? `Rp ${valuasi.toLocaleString("id-ID")}` : "-";

  renderEkuitasLabaTable(valuasi, dividen);
}

async function refreshEkuitasInvestorData() {
  ekuitasInvestorList = await loadEkuitasInvestorList();
  renderEkuitasInvestorList();
  await refreshEkuitasLabaCard();
}
async function submitTambahEkuitasInvestor() {
  const btn   = document.getElementById("ekuitasTambahSubmitBtn");
  const label = document.getElementById("ekuitasTambahSubmitLabel");
  const nama  = document.getElementById("ekuitasTambahNama").value.trim();
  const email = document.getElementById("ekuitasTambahEmail").value.trim();
  const pass  = document.getElementById("ekuitasTambahPassword").value.trim();
  const nominal = Number(document.getElementById("ekuitasTambahNominal").value.replace(/\D/g, "")) || 0;

  if (!nama || !email || !pass || nominal <= 0) {
    showEkuitasToast("Lengkapi semua field", false);
    return;
  }
  if (pass.length < 6) {
    showEkuitasToast("Password minimal 6 karakter", false);
    return;
  }

  btn.disabled = true;
  label.textContent = "Membuat akun...";

  try {
    const kantorCabang = await window.idb.getKantorCabang();
    const adminUid     = window.auth?.currentUser?.uid;

    // buat akun via secondary app supaya adminCabang tidak logout (pola sama kayak akun.js)
    const secondaryApp  = window.initializeApp(window.firebaseConfig, "secondary-ekuitas");
    const secondaryAuth = window.getAuth(secondaryApp);
    const cred          = await window.createUserWithEmailAndPassword(secondaryAuth, email, pass);
    const newUid        = cred.user.uid;
    await window.signOut(secondaryAuth);
    await window.deleteApp(secondaryApp);

    const payload = {
      uid:           newUid,
      id:            newUid,
      nama,
      email,
      role:          "investor",
      idCabang:      kantorCabang?.id         || "",
      cabangEkuitas: kantorCabang?.namaCabang || "",
      ekuitas:       nominal,
      return:        0,
      foto:          "",
      ttd:           "",
      noTelepon:     document.getElementById("ekuitasTambahTelepon").value.trim(),
      nik:           document.getElementById("ekuitasTambahNik").value.trim(),
      pekerjaan:     document.getElementById("ekuitasTambahPekerjaan").value.trim(),
      tempatTanggalLahir: document.getElementById("ekuitasTambahTtl").value.trim(),
      alamat:        document.getElementById("ekuitasTambahAlamat").value.trim(),
      tanggalInvest: document.getElementById("ekuitasTambahTglInvest").value.trim(),
      status:        true,
      createdBy:     adminUid,
      createdAt:     window.serverTimestamp(),
    };

    await window.setDoc(window.doc(window.db, "users", newUid), payload);
    await window.setDoc(window.doc(window.db, "akun", newUid), {
      uid: newUid,
      role: "investor",
      password: pass,
      email,
      idCabang: kantorCabang?.id || "",
    });

    ekuitasInvestorList.push(payload);
    if (window.usersCache) window.usersCache.push(payload);
    try {
      await window.idb.saveUsers([payload]);
    } catch (idbErr) {
      console.error("❌ Gagal simpan ke IDB cache (non-fatal):", idbErr);
    }
    renderEkuitasInvestorList();
    document.getElementById("ekuitasSheetOverlay")?.classList.remove("show");
    document.getElementById("ekuitasSheet")?.classList.remove("open");
    document.body.style.overflow = "";
    showEkuitasToast("Akun investor berhasil dibuat", true);
  } catch (err) {
    console.error("❌ submitTambahEkuitasInvestor:", err);
    const msg = err.code === "auth/email-already-in-use" ? "Email sudah dipakai" : "Gagal membuat akun investor";
    showEkuitasToast(msg, false);
  } finally {
    btn.disabled = false;
    label.textContent = "Buat Akun Investor";
  }
}
function initEkuitasSheet() {
  const overlay  = document.getElementById("ekuitasSheetOverlay");
  const sheet    = document.getElementById("ekuitasSheet");
  const openBtn  = document.getElementById("ekuitasTambahAkunBtn");
  const closeBtn = document.getElementById("ekuitasSheetCloseBtn");
  const handle   = document.getElementById("ekuitasSheetHandle");
  if (!overlay || !sheet || !openBtn) return;

  if (overlay.parentElement !== document.body) {
    document.body.appendChild(overlay);
  }
  if (sheet.parentElement !== document.body) {
    document.body.appendChild(sheet);
  }

  const openSheet = () => {
    document.getElementById("ekuitasTambahNama").value = "";
    document.getElementById("ekuitasTambahEmail").value = "";
    document.getElementById("ekuitasTambahPassword").value = "";
    document.getElementById("ekuitasTambahNominal").value = "";
    document.getElementById("ekuitasTambahTelepon").value = "";
    document.getElementById("ekuitasTambahNik").value = "";
    document.getElementById("ekuitasTambahPekerjaan").value = "";
    document.getElementById("ekuitasTambahTtl").value = "";
    document.getElementById("ekuitasTambahAlamat").value = "";
    document.getElementById("ekuitasTambahTglInvest").value = "";

    overlay.classList.add("show");
    sheet.classList.add("open");
    document.body.style.overflow = "hidden";
  };
  const closeSheet = () => {
    overlay.classList.remove("show");
    sheet.classList.remove("open");
    sheet.style.transform = ""; // reset sisa drag
    document.body.style.overflow = "";
  };

  openBtn.addEventListener("click", openSheet);
  closeBtn?.addEventListener("click", closeSheet);
  overlay.addEventListener("click", closeSheet);

  const nominalInput = document.getElementById("ekuitasTambahNominal");
  if (nominalInput && !nominalInput.dataset.ribuanBound) {
    nominalInput.dataset.ribuanBound = "true";
    nominalInput.addEventListener("input", () => {
      const angka = Number(nominalInput.value.replace(/\D/g, "")) || 0;
      nominalInput.value = angka ? angka.toLocaleString("id-ID") : "";
    });
  }

  document.getElementById("ekuitasTambahSubmitBtn")?.addEventListener("click", submitTambahEkuitasInvestor);

  // ── Swipe ke bawah buat nutup (mobile only) ──
  let startY = 0;
  let currentY = 0;
  let dragging = false;

  const onTouchStart = (e) => {
    if (window.innerWidth > 768) return;
    startY = e.touches[0].clientY;
    dragging = true;
    sheet.classList.add("dragging");
  };

  const onTouchMove = (e) => {
    if (!dragging) return;
    currentY = e.touches[0].clientY - startY;
    if (currentY < 0) currentY = 0; // gak bisa ditarik ke atas
    sheet.style.transform = `translateY(${currentY}px)`;
  };

  const onTouchEnd = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove("dragging");

    const threshold = sheet.offsetHeight * 0.25; // 25% tinggi sheet
    if (currentY > threshold) {
      closeSheet();
    } else {
      sheet.style.transform = ""; // snap balik ke posisi terbuka
    }
    currentY = 0;
  };

  handle?.addEventListener("touchstart", onTouchStart, { passive: true });
  handle?.addEventListener("touchmove", onTouchMove, { passive: true });
  handle?.addEventListener("touchend", onTouchEnd);

  // opsional: drag juga bisa mulai dari header, bukan cuma handle
  const header = sheet.querySelector(".ekuitas-sheet-header");
  header?.addEventListener("touchstart", onTouchStart, { passive: true });
  header?.addEventListener("touchmove", onTouchMove, { passive: true });
  header?.addEventListener("touchend", onTouchEnd);
}

window.initEkuitasProduksiView = function() {
  initEkuitasProdFilter();
  initEkuitasEditHandlers();
  initEkuitasSheet();
  initEkuitasRoiModal();

  document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='ekuitas']").forEach(item => {
    item.addEventListener("click", async () => {
      document.querySelectorAll("#rekapProduksiList .lap-kurir-item").forEach(x => x.classList.remove("active"));
      item.classList.add("active");

      window.activateRekapProdPanel("ekuitasProduksiDetailWrapper");

      document.getElementById("ekuitasProduksiEmpty").style.display   = "none";
      document.getElementById("ekuitasProduksiContent").style.display = "flex";

      if (window.innerWidth <= 768) {
        const backBtn = document.getElementById("ekuitasProduksiBackBtn");
        if (backBtn) backBtn.style.display = "flex";
      }

      await refreshEkuitasInvestorData();
    });
  });

  document.getElementById("ekuitasProduksiBackBtn")?.addEventListener("click", () => {
    document.getElementById("ekuitasProduksiDetailWrapper").style.setProperty("display", "none", "important");
    document.getElementById("ekuitasProduksiDetailWrapper")?.classList.remove("show");
    document.getElementById("ekuitasProduksiBackBtn").style.display = "none";
    document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='ekuitas']").forEach(x => x.classList.remove("active"));
    window.showRekapProdListMobile?.();
  });
};
