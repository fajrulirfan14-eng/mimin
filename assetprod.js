
/* ── ASSETS: STATE ── */
let assetDataProduksi = [];
let assetDataDistribusi = [];
let assetFormKategori = null;
let assetFormEditId = null;
let assetLastKategori = null;
let assetPenyusutan = { produksi: 0, distribusi: 0 };

/* ── FORMAT RIBUAN (reuse pola dari pembelian) ── */
function parseAngkaRibuanAsset(str) {
  return Number(String(str || "").replace(/\D/g, "")) || 0;
}
function attachFormatRibuanAsset(inputId) {
  const el = document.getElementById(inputId);
  if (!el || el.dataset.ribuanBound) return;
  el.dataset.ribuanBound = "true";
  el.addEventListener("input", () => {
    const angka = parseAngkaRibuanAsset(el.value);
    el.value = angka ? angka.toLocaleString("id-ID") : "";
  });
}

/* ── LOAD DATA DARI FIRESTORE ── */
async function loadAssetData() {
  const adminUid = window.auth?.currentUser?.uid;
  if (!adminUid) { assetDataProduksi = []; assetDataDistribusi = []; return; }

  try {
    const snap = await window.getDoc(window.doc(window.db, "users", adminUid, "assetProd", "data"));
    if (snap.exists()) {
      const data = snap.data();
      assetDataProduksi   = data.produksi || [];
      assetDataDistribusi = data.distribusi || [];
      assetPenyusutan     = data.penyusutanAset || { produksi: 0, distribusi: 0 };
    } else {
      assetDataProduksi = [];
      assetDataDistribusi = [];
      assetPenyusutan = { produksi: 0, distribusi: 0 };
    }
  } catch (err) {
    console.error("❌ loadAssetData:", err);
    assetDataProduksi = [];
    assetDataDistribusi = [];
  }
}

/* ── RENDER TABEL ── */
function renderAssetTable(kategori) {
  const list = kategori === "produksi" ? assetDataProduksi : assetDataDistribusi;
  const tbody = document.getElementById(kategori === "produksi" ? "assetTableBodyProduksi" : "assetTableBodyDistribusi");
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `<tr class="audit-empty-row"><td colspan="4">Belum ada barang</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => `
    <tr class="asset-row-clickable" data-id="${item.id}">
      <td class="asset-td-update">${item.updatedAt || "-"}</td>
      <td class="pembelian-td-text">${item.nama || "-"}</td>
      <td>${item.qty || "-"}</td>
      <td>${item.harga ? Number(item.harga).toLocaleString("id-ID") : ""}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll("tr[data-id]").forEach(tr => {
    tr.addEventListener("click", () => openAssetForm(kategori, tr.dataset.id));
  });
}
function hitungTotalAsetKategori(list) {
  return list.reduce((sum, item) => sum + ((Number(item.qty) || 0) * (Number(item.harga) || 0)), 0);
}
function renderAssetRingkasan() {
  const totalProduksi   = hitungTotalAsetKategori(assetDataProduksi);
  const totalDistribusi = hitungTotalAsetKategori(assetDataDistribusi);

  const penyusutanProduksi   = Number(assetPenyusutan.produksi)   || 0;
  const penyusutanDistribusi = Number(assetPenyusutan.distribusi) || 0;

  const netProduksi   = totalProduksi   - penyusutanProduksi;
  const netDistribusi = totalDistribusi - penyusutanDistribusi;
  const totalJumlah   = netProduksi + netDistribusi;

  document.getElementById("assetTotalProduksi").textContent   = `Rp ${totalProduksi.toLocaleString("id-ID")}`;
  document.getElementById("assetTotalDistribusi").textContent = `Rp ${totalDistribusi.toLocaleString("id-ID")}`;

  document.getElementById("assetPenyusutanProduksiVal").textContent   = `- Rp ${penyusutanProduksi.toLocaleString("id-ID")}`;
  document.getElementById("assetPenyusutanDistribusiVal").textContent = `- Rp ${penyusutanDistribusi.toLocaleString("id-ID")}`;

  document.getElementById("assetNetProduksi").textContent   = `Rp ${netProduksi.toLocaleString("id-ID")}`;
  document.getElementById("assetNetDistribusi").textContent = `Rp ${netDistribusi.toLocaleString("id-ID")}`;

  document.getElementById("assetTotalJumlah").textContent = `Rp ${totalJumlah.toLocaleString("id-ID")}`;
}
function renderAssetAll() {
  renderAssetTable("produksi");
  renderAssetTable("distribusi");
  renderAssetRingkasan();
}

/* ── DROPDOWN KATEGORI (custom) ── */
function setAssetKategoriDisplay(kategori) {
  const label = kategori === "produksi" ? "Peralatan Produksi" : (kategori === "distribusi" ? "Perlengkapan Distribusi" : "Pilih Kategori");
  document.getElementById("assetKategoriBtnLabel").textContent = label;

  document.querySelectorAll("#assetKategoriDropdown .pembelian-select-option").forEach(opt => {
    opt.classList.toggle("selected", opt.dataset.kategori === kategori);
  });
}
function initAssetKategoriDropdown() {
  const wrap = document.getElementById("assetKategoriWrap");
  const btn  = document.getElementById("assetKategoriBtn");
  const dd   = document.getElementById("assetKategoriDropdown");
  if (!wrap || !btn || !dd || wrap.dataset.bound) return;
  wrap.dataset.bound = "true";

  btn.addEventListener("click", e => {
    e.stopPropagation();
    wrap.classList.toggle("open");
  });

  dd.querySelectorAll(".pembelian-select-option").forEach(opt => {
    opt.addEventListener("click", () => {
      assetFormKategori = opt.dataset.kategori;
      assetLastKategori = opt.dataset.kategori;
      setAssetKategoriDisplay(assetFormKategori);
      wrap.classList.remove("open");
    });
  });

  document.addEventListener("click", e => {
    if (!e.target.closest("#assetKategoriWrap")) wrap.classList.remove("open");
  });
}

/* ── MODAL: TAMBAH/EDIT ── */
function openAssetForm(kategori, itemId = null) {
  assetFormKategori = kategori || assetLastKategori;
  assetFormEditId = itemId;
  const list = assetFormKategori ? (assetFormKategori === "produksi" ? assetDataProduksi : assetDataDistribusi) : [];
  const item = itemId ? list.find(i => i.id === itemId) : null;

  document.getElementById("assetFormModalTitle").textContent = item ? "Edit Barang" : "Tambah Barang";
  setAssetKategoriDisplay(assetFormKategori);
  initAssetKategoriDropdown();
  document.getElementById("assetFormNama").value  = item?.nama || "";
  document.getElementById("assetFormQty").value   = item?.qty || "";
  document.getElementById("assetFormHarga").value = item?.harga ? Number(item.harga).toLocaleString("id-ID") : "";

  attachFormatRibuanAsset("assetFormHarga");
  document.getElementById("assetFormModalOverlay").classList.add("show");
}
function closeAssetForm() {
  document.getElementById("assetFormModalOverlay")?.classList.remove("show");
  assetFormKategori = null;
  assetFormEditId = null;
}
async function confirmAssetForm() {
  const adminUid = window.auth?.currentUser?.uid;
  if (!adminUid || !assetFormKategori) return;

  const allUsers = await window.idb.getUsers();
  const userData = allUsers.find(u => u.uid === adminUid);
  const idCabang = userData?.idCabang || "";
  const nama  = document.getElementById("assetFormNama").value.trim();
  const qty   = Number(document.getElementById("assetFormQty").value) || 0;
  const harga = parseAngkaRibuanAsset(document.getElementById("assetFormHarga").value);

  if (!assetFormKategori || !nama || qty <= 0) {
    window.showToast("Lengkapi kategori, nama barang, dan qty", "error");
    return;
  }

  const kategori = assetFormKategori;
  const list = kategori === "produksi" ? [...assetDataProduksi] : [...assetDataDistribusi];
  const tanggal = new Date().toISOString().slice(0, 10);

  if (assetFormEditId) {
    const idx = list.findIndex(i => i.id === assetFormEditId);
    if (idx !== -1) list[idx] = { ...list[idx], nama, qty, harga, updatedAt: tanggal };
  } else {
    list.push({ id: "asset" + Date.now(), nama, qty, harga, updatedAt: tanggal });
  }

  try {
    await window.setDoc(window.doc(window.db, "users", adminUid, "assetProd", "data"), {
      [kategori]: list,
      createdBy: adminUid,
      idCabang
    }, { merge: true });

    if (kategori === "produksi") assetDataProduksi = list; else assetDataDistribusi = list;
    renderAssetTable(kategori);
    renderAssetRingkasan();
    window.showToast(assetFormEditId ? "Barang berhasil diupdate" : "Barang berhasil ditambahkan", "success");
    closeAssetForm();
  } catch (err) {
    console.error("❌ confirmAssetForm:", err);
    window.showToast("Gagal menyimpan barang", "error");
  }
}

/* ── MODAL: INPUT PENYUSUTAN ── */
function hitungPenyusutanPreview() {
  const produksi   = parseAngkaRibuanAsset(document.getElementById("assetPenyusutanProduksiInput").value);
  const distribusi = parseAngkaRibuanAsset(document.getElementById("assetPenyusutanDistribusiInput").value);
  const total = produksi + distribusi;
  document.getElementById("assetPenyusutanTotalPreview").textContent = `Rp ${total.toLocaleString("id-ID")}`;
  return total;
}
function openPenyusutanModal() {
  document.getElementById("assetPenyusutanProduksiInput").value = assetPenyusutan.produksi ? Number(assetPenyusutan.produksi).toLocaleString("id-ID") : "";
  document.getElementById("assetPenyusutanDistribusiInput").value = assetPenyusutan.distribusi ? Number(assetPenyusutan.distribusi).toLocaleString("id-ID") : "";

  attachFormatRibuanAsset("assetPenyusutanProduksiInput");
  attachFormatRibuanAsset("assetPenyusutanDistribusiInput");

  hitungPenyusutanPreview();
  ["assetPenyusutanProduksiInput", "assetPenyusutanDistribusiInput"].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.previewBound) {
      el.dataset.previewBound = "true";
      el.addEventListener("input", hitungPenyusutanPreview);
    }
  });

  document.getElementById("assetPenyusutanModalOverlay").classList.add("show");
}
function closePenyusutanModal() {
  document.getElementById("assetPenyusutanModalOverlay")?.classList.remove("show");
}
async function confirmPenyusutan() {
  const adminUid = window.auth?.currentUser?.uid;
  if (!adminUid) return;

  const produksi   = parseAngkaRibuanAsset(document.getElementById("assetPenyusutanProduksiInput").value);
  const distribusi = parseAngkaRibuanAsset(document.getElementById("assetPenyusutanDistribusiInput").value);

  try {
    await window.setDoc(window.doc(window.db, "users", adminUid, "assetProd", "data"), {
      penyusutanAset: { produksi, distribusi },
      createdBy: adminUid
    }, { merge: true });

    assetPenyusutan = { produksi, distribusi };
    renderAssetRingkasan();
    window.showToast("Penyusutan aset berhasil disimpan", "success");
    closePenyusutanModal();
  } catch (err) {
    console.error("❌ confirmPenyusutan:", err);
    window.showToast("Gagal menyimpan penyusutan aset", "error");
  }
}

/* ── INIT VIEW ── */
window.initAssetProduksiView = function() {

  document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='asset']").forEach(item => {
    item.addEventListener("click", async () => {
      document.querySelectorAll("#rekapProduksiList .lap-kurir-item").forEach(x => x.classList.remove("active"));
      item.classList.add("active");

      window.activateRekapProdPanel("assetProduksiDetailWrapper");

      document.getElementById("assetProduksiEmpty").style.display   = "none";
      document.getElementById("assetProduksiContent").style.display = "flex";

      if (window.innerWidth <= 768) {
        const backBtn = document.getElementById("assetProduksiBackBtn");
        if (backBtn) backBtn.style.display = "flex";
      }

      await loadAssetData();
      renderAssetAll();
    });
  });

  document.getElementById("assetProduksiBackBtn")?.addEventListener("click", () => {
    document.getElementById("assetProduksiDetailWrapper").style.setProperty("display", "none", "important");
    document.getElementById("assetProduksiDetailWrapper")?.classList.remove("show");
    document.getElementById("assetProduksiBackBtn").style.display = "none";
    document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='asset']").forEach(x => x.classList.remove("active"));
    window.showRekapProdListMobile();
  });

  document.getElementById("assetAddBtn")?.addEventListener("click", () => openAssetForm(null));

  document.getElementById("assetPenyusutanBtn")?.addEventListener("click", openPenyusutanModal);
  document.getElementById("assetPenyusutanCancel")?.addEventListener("click", closePenyusutanModal);
  document.getElementById("assetPenyusutanConfirm")?.addEventListener("click", confirmPenyusutan);
  document.getElementById("assetPenyusutanModalOverlay")?.addEventListener("click", e => {
    if (e.target.id === "assetPenyusutanModalOverlay") closePenyusutanModal();
  });
  document.getElementById("assetFormModalCancel")?.addEventListener("click", closeAssetForm);
  document.getElementById("assetFormModalConfirm")?.addEventListener("click", confirmAssetForm);
  document.getElementById("assetFormModalOverlay")?.addEventListener("click", e => {
    if (e.target.id === "assetFormModalOverlay") closeAssetForm();
  });
};
