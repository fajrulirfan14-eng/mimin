
function getPurchaseTargetTanggal(tanggalInputStr) {
  const [y, m, d] = tanggalInputStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  dateObj.setDate(dateObj.getDate() + 2);
  const yy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function formatTanggalPurchase(tanggalStr) {
  const hariNama  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const bulanNama = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const [y, m, d] = tanggalStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  return `${hariNama[dateObj.getDay()]}, ${d} ${bulanNama[m - 1]} ${y}`;
}

function escPurchase(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function hidePurchaseStatus() {
  const el = document.getElementById("purchaseStatus");
  if (!el) return;
  el.textContent = "";
  el.className = "purchase-status";
}

function renderPurchaseStaffList(staffUsers, varian, existingStaffMap) {
  const container = document.getElementById("purchaseStaffList");
  if (!container) return;

  if (!staffUsers.length) {
    container.innerHTML = '<div class="purchase-varian-empty">Belum ada staff (kurir/hunter/sales).</div>';
    return;
  }

  const varianEntries = Object.entries(varian || {}).sort((a, b) => a[0].localeCompare(b[0]));

  container.innerHTML = staffUsers.map((u) => {
    const nama = u.nama || "Tanpa Nama";
    const existingVarian = existingStaffMap?.[u.uid]?.varian || {};
    const varianInputsHtml = varianEntries.length
      ? varianEntries.map(([kode]) => `
          <div class="purchase-varian-item">
            <input type="number" min="0" inputmode="numeric" class="purchase-varian-input"
              data-uid="${u.uid}" data-kode="${kode}"
              value="${existingVarian[kode] || ""}" placeholder="${kode}">
          </div>
        `).join("")
      : '<div class="purchase-varian-empty">Varian belum tersedia.</div>';

    return `
      <div class="purchase-staff-card" data-uid="${u.uid}" data-nama="${escPurchase(nama)}" data-role="${escPurchase(u.role || "")}">
        <div class="purchase-staff-header">
          <div class="purchase-staff-info">
            <div class="purchase-staff-nama">${escPurchase(nama)}</div>
            <div class="purchase-staff-role">${escPurchase(u.role || "-")}</div>
          </div>
        </div>
        <div class="purchase-varian-grid">
          ${varianInputsHtml}
        </div>
      </div>
    `;
  }).join("");
}

function collectPurchaseStaffData(staffUsers) {
  const staffMap = {};

  staffUsers.forEach((u) => {
    const varianData = {};
    let adaIsi = false;

    document.querySelectorAll(`.purchase-varian-input[data-uid="${u.uid}"]`).forEach((inp) => {
      const val = Number(inp.value) || 0;
      varianData[inp.dataset.kode] = val;
      if (val > 0) adaIsi = true;
    });

    if (adaIsi) {
      staffMap[u.uid] = {
        nama: u.nama || "Tanpa Nama",
        role: u.role || "",
        varian: varianData,
      };
    }
  });

  return staffMap;
}

async function loadPurchasePreview(tanggalInputOverride) {
  const adminUid = window.currentUser?.uid;
  const targetDisplayEl = document.getElementById("purchaseTargetDisplay");
  const catatanEl = document.getElementById("purchaseCatatan");
  const nativeInputEl = document.getElementById("purchaseTanggalInputNative");
  if (!adminUid) return;

  const tanggalInput = tanggalInputOverride || new Date().toISOString().slice(0, 10);
  const tanggalTarget = getPurchaseTargetTanggal(tanggalInput);

  if (nativeInputEl) nativeInputEl.value = tanggalInput;
  const inputTextEl = document.getElementById("purchaseTanggalInputText");
  if (inputTextEl) inputTextEl.textContent = formatTanggalPurchase(tanggalInput);
  if (targetDisplayEl) targetDisplayEl.textContent = formatTanggalPurchase(tanggalTarget);

  let varian = {};
  let estimasiConfig = {};
  try {
    const idCabang = window.currentUser?.idCabang || "";
    const snapKc = await window.getDoc(window.doc(window.db, "kantorCabang", idCabang));
    if (snapKc.exists()) {
      const kcData = snapKc.data();
      varian = kcData?.varian || {};
      estimasiConfig = kcData?.estimasi || {};
    }
  } catch (err) {
    console.error("❌ fetch kantorCabang (loadPurchasePreview):", err);
  }
  window._purchaseEstimasiConfig = estimasiConfig;

  let allUsers = window.usersCache;
  if (!allUsers?.length) {
    try {
      const idCabang = window.currentUser?.idCabang || "";
      const snap = await window.getDocs(window.query(
        window.collection(window.db, "users"),
        window.where("idCabang", "==", idCabang),
        window.where("createdBy", "==", adminUid)
      ));
      allUsers = snap.docs.map(d => ({ ...d.data(), uid: d.id }));
      window.usersCache = allUsers;
    } catch (err) {
      console.error("❌ fetch users (loadPurchasePreview):", err);
      allUsers = [];
    }
  }
  const staffUsers = allUsers.filter((u) => ["kurir", "hunter", "sales"].includes(u.role));

  let existingStaffMap = {};
  let existingCatatan = "";
  let sudahTersimpan = false;
  try {
    const snap = await window.getDoc(window.doc(window.db, "users", adminUid, "purchase", tanggalTarget));
    if (snap.exists()) {
      const data = snap.data();
      existingStaffMap = data.staff || {};
      existingCatatan = data.catatan || "";
      sudahTersimpan = true;
    }
  } catch (err) {
    console.error("❌ loadPurchasePreview:", err);
  }

  const badgeEl = document.getElementById("purchaseSavedBadge");
  if (badgeEl) badgeEl.style.display = sudahTersimpan ? "flex" : "none";

  renderPurchaseStaffList(staffUsers, varian, existingStaffMap);
  if (catatanEl) catatanEl.value = existingCatatan;

  window._purchaseStaffUsers = staffUsers;
  window._purchaseTanggalInput = tanggalInput;
  window._purchaseTanggalTarget = tanggalTarget;

  await recalcPurchaseEstimasi(tanggalTarget, true);
}

/* ── ESTIMASI LOYANG (read only, dihitung live dari input + saldo) ── */
window._purchaseSaldoCache = window._purchaseSaldoCache || {};

function hitungTotalVarianDariInput() {
  const total = {};
  document.querySelectorAll(".purchase-varian-input").forEach(inp => {
    const kode = inp.dataset.kode;
    const val  = Number(inp.value) || 0;
    total[kode] = (total[kode] || 0) + val;
  });
  return total;
}

async function recalcPurchaseEstimasi(tanggalTarget, forceRefetchSaldo) {
  const cardEl = document.getElementById("purchaseEstimasiCard");
  if (!cardEl || !tanggalTarget) return;

  const estimasiConfig = window._purchaseEstimasiConfig || {};
  const groupKeys = Object.keys(estimasiConfig);
  if (!groupKeys.length) {
    cardEl.innerHTML = '<div class="purchase-varian-empty">Estimasi loyang belum diset di Kantor Cabang.</div>';
    return;
  }

  if (forceRefetchSaldo || !window._purchaseSaldoCache[tanggalTarget]) {
    cardEl.innerHTML = '<div class="purchase-estimasi-loading">Menghitung saldo...</div>';
    try {
      window._purchaseSaldoCache[tanggalTarget] = (await window.hitungSaldoUntukTanggal?.(tanggalTarget)) || {};
    } catch (err) {
      console.error("❌ recalcPurchaseEstimasi (saldo):", err);
      window._purchaseSaldoCache[tanggalTarget] = {};
    }
  }
  const saldoMap = window._purchaseSaldoCache[tanggalTarget] || {};
  const totalInput = hitungTotalVarianDariInput();

  const rows = groupKeys.map(groupKey => {
    const capacityMap = estimasiConfig[groupKey] || {};
    let fraksiTotal = 0;
    Object.entries(capacityMap).forEach(([kode, kapasitas]) => {
      const kap = Number(kapasitas) || 0;
      if (kap <= 0) return;
      const input     = Number(totalInput[kode] || 0);
      const saldo     = Number(saldoMap[kode]   || 0);
      const kebutuhan = Math.max(0, input - saldo);
      fraksiTotal += kebutuhan / kap;
    });
    const jumlahLoyang = fraksiTotal > 0 ? Math.ceil(fraksiTotal) : 0;
    const label = groupKey.replace(/^loyang/i, "") || groupKey;
    return { label, jumlahLoyang };
  });

  cardEl.innerHTML = rows.map(r => `
    <div class="purchase-estimasi-row">
      <span class="purchase-estimasi-label">${escPurchase(r.label)}</span>
      <span class="purchase-estimasi-value">${r.jumlahLoyang} loyang</span>
    </div>
  `).join("");
}
async function simpanPurchaseOrder() {
  const btn = document.getElementById("purchaseSaveBtn");
  const adminUid = window.currentUser?.uid;
  if (!adminUid) {
    window.showToast?.("Data admin tidak ditemukan", "error");
    return;
  }

  const tanggalInput = window._purchaseTanggalInput || new Date().toISOString().slice(0, 10);
  const tanggalTarget = getPurchaseTargetTanggal(tanggalInput);
  const catatan = document.getElementById("purchaseCatatan")?.value?.trim() || "";
  const staffUsers = window._purchaseStaffUsers || [];
  const staffMap = collectPurchaseStaffData(staffUsers);

  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="purchase-btn-spinner"></span> Menyimpan...';
  hidePurchaseStatus();

  try {
    const ref = window.doc(window.db, "users", adminUid, "purchase", tanggalTarget);
    await window.setDoc(ref, {
      tanggal: tanggalTarget,
      tanggalInput,
      createdBy: adminUid,
      staff: staffMap,
      catatan,
      updatedAt: window.serverTimestamp(),
    }, { merge: true });

    window.showToast?.("Purchase order berhasil disimpan", "success");
    const badgeEl = document.getElementById("purchaseSavedBadge");
    if (badgeEl) badgeEl.style.display = "flex";
  } catch (err) {
    console.error("❌ simpanPurchaseOrder:", err);
    window.showToast?.("Gagal menyimpan purchase order", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}
window.initPurchaseForm = function () {
  document.getElementById("purchaseSaveBtn")?.addEventListener("click", simpanPurchaseOrder);
  document.getElementById("purchaseTanggalInputNative")?.addEventListener("change", (e) => {
    if (e.target.value) loadPurchasePreview(e.target.value);
  });
  document.getElementById("purchaseStaffList")?.addEventListener("input", (e) => {
    if (e.target.classList.contains("purchase-varian-input")) {
      recalcPurchaseEstimasi(window._purchaseTanggalTarget, false);
    }
  });
  loadPurchasePreview();
};
