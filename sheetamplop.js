/* ── RUMUS PANEL ── */
let rumusUnsubscribe = null;
let rumusPengeluaranUnsubscribe = null;
let rumusSetoranUnsubscribe = null;
let rumusLaporanData = null;
let rumusPengeluaranData = null;

function formatRupiah(num) {
  return "Rp " + (num || 0).toLocaleString("id-ID");
}
window.formatRupiah = formatRupiah;
function buildDistribusiPayload() {
  const omset = [];
  const lainnya = [];
  let totalOmset = 0, totalLainnya = 0, totalPengeluaran = 0;

  if (rumusLaporanData) {
    Object.keys(rumusLaporanData).forEach((key) => {
      if (key === "tanggal" || key === "createdBy") return;
      const kurir = rumusLaporanData[key];
      const keuangan = kurir?.distribusi?.keuangan;
      if (!keuangan) return;

      const nilaiOmset = keuangan.grossMargin || 0;
      const bonusPay = keuangan.bonus?.bonusPay || 0;
      const klaimInsentif = keuangan.klaimInsentif || 0;
      const kasbon = keuangan.kasbon || 0;
      const totalKurirLainnya = bonusPay + klaimInsentif + kasbon;

      omset.push({ uid: key, nama: kurir?.nama || "", nilai: nilaiOmset });
      lainnya.push({
        uid: key,
        nama: kurir?.nama || "",
        bonusPay,
        klaimInsentif,
        kasbon,
        total: totalKurirLainnya
      });

      totalOmset += nilaiOmset;
      totalLainnya += totalKurirLainnya;
    });
  }

  const pengeluaran = (rumusPengeluaranData?.distribusi || []).map((item) => ({
    nama: item.nama || "",
    qty: item.qty || 0,
    nominal: item.nominal || 0
  }));
  totalPengeluaran = pengeluaran.reduce((sum, item) => sum + (item.nominal || 0), 0);

  return {
    omset,
    lainnya,
    pengeluaranDistribusi: { pengeluaran },
    amplop: totalOmset - totalLainnya - totalPengeluaran
  };
}
function buildProduksiPayload() {
  const omset = [];
  let totalOmset = 0, totalPengeluaran = 0, totalKasbon = 0;

  if (rumusLaporanData) {
    Object.keys(rumusLaporanData).forEach((key) => {
      if (key === "tanggal" || key === "createdBy") return;
      const kurir = rumusLaporanData[key];
      const nilaiOmset = kurir?.pembayaran?.nota?.bayar || 0;

      omset.push({ uid: key, nama: kurir?.nama || "", nilai: nilaiOmset });
      totalOmset += nilaiOmset;
    });
  }

  const pengeluaran = (rumusPengeluaranData?.produksi || []).map((item) => ({
    nama: item.nama || "",
    qty: item.qty || 0,
    nominal: item.nominal || 0
  }));
  totalPengeluaran = pengeluaran.reduce((sum, item) => sum + (item.nominal || 0), 0);

  const kasbon = (rumusPengeluaranData?.kasbonProduksi || []).map((item) => ({
    uid: item.uid || "",
    nama: item.nama || "",
    role: item.role || "",
    nominal: item.nominal || 0
  }));
  totalKasbon = kasbon.reduce((sum, item) => sum + (item.nominal || 0), 0);

  return {
    omset,
    lainnya: [],
    pengeluaranProduksi: { pengeluaran, kasbon },
    amplop: totalOmset - totalPengeluaran - totalKasbon
  };
}
async function simpanSetoranAmplop() {
  const tanggal = document.getElementById("rumusTanggal")?.value;
  const catatan = document.getElementById("rumusCatatan")?.value || "";
  const btn = document.getElementById("rumusSaveBtn");

  if (!tanggal) {
    showToast("Tanggal belum diisi", "error");
    return;
  }

  try {
    if (btn) { btn.disabled = true; btn.textContent = "Menyimpan..."; }

    const users = await window.idb.getUsers();
    const adminCabang = users.find(u => u.role === "adminCabang");
    if (!adminCabang) {
      showToast("Data admin cabang tidak ditemukan", "error");
      return;
    }

    const payload = {
      createdBy: adminCabang.uid,
      createdAt: serverTimestamp(),
      idCabang: adminCabang.idCabang || "",
      tanggal,
      catatan,
      diterima: false,
      diserahkan: false,
      distribusi: buildDistribusiPayload(),
      produksi: buildProduksiPayload()
    };

    const ref = doc(db, "users", adminCabang.uid, "setoranAmplop", tanggal);
    await setDoc(ref, payload);

    showToast("Setoran amplop berhasil disimpan", "");
  } catch (err) {
    showToast("Gagal menyimpan setoran amplop", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Simpan"; }
  }
}
function updateProduksiUI() {
  let totalOmset = 0, totalPengeluaran = 0, totalKasbon = 0;
  let omsetRows = "", pengeluaranRows = "", kasbonRows = "";

  if (rumusLaporanData) {
    Object.keys(rumusLaporanData).forEach(key => {
      if (key === "tanggal" || key === "createdBy") return;
      const kurir = rumusLaporanData[key];
      const nilai = kurir?.pembayaran?.nota?.bayar || 0;
      totalOmset += nilai;
      omsetRows  += `<div class="amplop-detail-row"><span class="label">${kurir?.nama||""}</span><span class="value">${formatRupiah(nilai)}</span></div>`;
    });
  }

  if (rumusPengeluaranData?.produksi) {
    rumusPengeluaranData.produksi.forEach(item => {
      totalPengeluaran += Number(item.nominal) || 0;
      pengeluaranRows  += `<div class="amplop-detail-row"><span class="label">${item.nama||""} (x${item.qty||1})</span><span class="value">- ${formatRupiah(item.nominal)}</span></div>`;
    });
  }

  if (rumusPengeluaranData?.kasbonProduksi) {
    rumusPengeluaranData.kasbonProduksi.forEach(item => {
      totalKasbon += Number(item.nominal) || 0;
      kasbonRows  += `<div class="amplop-detail-row"><span class="label">${item.nama||""}</span><span class="value">- ${formatRupiah(item.nominal)}</span></div>`;
    });
  }

  const amplop = totalOmset - totalPengeluaran - totalKasbon;

  const card = document.querySelector("#rumusPanelBody .rumus-card-produksi");
  if (card) {
    card.innerHTML = `
      <div class="amplop-detail-subtitle">Omset</div>
      ${omsetRows || `<div class="amplop-detail-row"><span class="label">-</span><span class="value">Rp 0</span></div>`}
      <div class="amplop-detail-row amplop-detail-row-sum"><span class="label">Total Omset</span><span class="value">${formatRupiah(totalOmset)}</span></div>

      <div class="amplop-detail-subtitle">Pengeluaran</div>
      ${pengeluaranRows || `<div class="amplop-detail-row"><span class="label">Tidak ada</span><span class="value">Rp 0</span></div>`}
      <div class="amplop-detail-row amplop-detail-row-sum"><span class="label">Total Pengeluaran</span><span class="value">- ${formatRupiah(totalPengeluaran)}</span></div>

      <div class="amplop-detail-subtitle">Kasbon</div>
      ${kasbonRows || `<div class="amplop-detail-row"><span class="label">Tidak ada</span><span class="value">Rp 0</span></div>`}
      <div class="amplop-detail-row amplop-detail-row-sum"><span class="label">Total Kasbon</span><span class="value">- ${formatRupiah(totalKasbon)}</span></div>

      <div class="amplop-detail-total"><span>Amplop Produksi</span><span>${formatRupiah(amplop)}</span></div>`;
  }

  const elAmplop = document.getElementById("rumusAmplopProduksi");
  if (elAmplop) elAmplop.textContent = formatRupiah(amplop);
}
function toggleRumusTanggalCheck(show) {
  const el = document.getElementById("rumusTanggalCheck");
  if (el) el.style.display = show ? "" : "none";
}
function updateDistribusiUI() {
  let totalOmset = 0, totalLainnya = 0, totalPengeluaran = 0;
  let omsetRows = "", lainnyaRows = "", pengeluaranRows = "";

  if (rumusLaporanData) {
    Object.keys(rumusLaporanData).forEach(key => {
      if (key === "tanggal" || key === "createdBy") return;
      const kurir    = rumusLaporanData[key];
      const keuangan = kurir?.distribusi?.keuangan;
      if (!keuangan) return;

      const nilaiOmset    = keuangan.grossMargin || 0;
      const bonusPay      = keuangan.bonus?.bonusPay || 0;
      const klaimInsentif = keuangan.klaimInsentif || 0;
      const kasbon        = keuangan.kasbon || 0;
      const totalKurir    = bonusPay + klaimInsentif + kasbon;
      const netto         = nilaiOmset - bonusPay - klaimInsentif - kasbon;

      totalOmset   += netto;
      totalLainnya += totalKurir;

      const details = [
        bonusPay      > 0 ? `Bonus Pay: ${formatRupiah(bonusPay)}`          : null,
        klaimInsentif > 0 ? `Klaim Insentif: ${formatRupiah(klaimInsentif)}` : null,
        kasbon        > 0 ? `Kasbon: ${formatRupiah(kasbon)}`                : null,
      ].filter(Boolean).join(" · ");

      omsetRows   += `<div class="amplop-detail-row"><span class="label">${kurir?.nama||""}</span><span class="value">${formatRupiah(netto)}</span></div>`;
      lainnyaRows += `
        <div class="amplop-detail-row" style="flex-direction:column;align-items:flex-start;gap:2px">
          <div style="display:flex;justify-content:space-between;width:100%">
            <span class="label">${kurir?.nama||""}</span>
            <span class="value">- ${formatRupiah(totalKurir)}</span>
          </div>
          ${details ? `<div style="font-size:11px;color:var(--text-muted)">${details}</div>` : ""}
        </div>`;
    });
  }

  if (rumusPengeluaranData?.distribusi) {
    rumusPengeluaranData.distribusi.forEach(item => {
      totalPengeluaran += Number(item.nominal) || 0;
      pengeluaranRows  += `<div class="amplop-detail-row"><span class="label">${item.nama||""} (x${item.qty||1})</span><span class="value">- ${formatRupiah(item.nominal)}</span></div>`;
    });
  }
  const amplop = totalOmset - totalPengeluaran;
  const card = document.querySelector(".rumus-card-distribusi");
  if (card) {
    card.innerHTML = `
      <div class="amplop-detail-subtitle">Omset</div>
      ${omsetRows || `<div class="amplop-detail-row"><span class="label">-</span><span class="value">Rp 0</span></div>`}
      <div class="amplop-detail-row amplop-detail-row-sum"><span class="label">Total Omset</span><span class="value">${formatRupiah(totalOmset)}</span></div>

      <div class="amplop-detail-subtitle">Lainnya</div>
      ${lainnyaRows || `<div class="amplop-detail-row"><span class="label">Tidak ada</span><span class="value">Rp 0</span></div>`}
      <div class="amplop-detail-row amplop-detail-row-sum"><span class="label">Total Lainnya</span><span class="value">- ${formatRupiah(totalLainnya)}</span></div>

      <div class="amplop-detail-subtitle">Pengeluaran</div>
      ${pengeluaranRows || `<div class="amplop-detail-row"><span class="label">Tidak ada</span><span class="value">Rp 0</span></div>`}
      <div class="amplop-detail-row amplop-detail-row-sum"><span class="label">Total Pengeluaran</span><span class="value">- ${formatRupiah(totalPengeluaran)}</span></div>

      <div class="amplop-detail-total"><span>Amplop Distribusi</span><span>${formatRupiah(amplop)}</span></div>`;
  }

  const elAmplop = document.getElementById("rumusAmplopDistribusi");
  if (elAmplop) elAmplop.textContent = formatRupiah(amplop);
}
async function getUidAdminCabang() {
  try {
    const users = await window.idb.getUsers();
    const adminCabang = users.find(u => u.role === "adminCabang");
    if (!adminCabang) {
      return null;
    }
    return adminCabang.uid;
  } catch (err) {
    return null;
  }
}
window.getUidAdminCabang = getUidAdminCabang;
async function loadRumusData(tanggal) {
  // matikan listener lama dulu biar gak numpuk
  if (rumusUnsubscribe) {
    rumusUnsubscribe();
    rumusUnsubscribe = null;
  }
  if (rumusPengeluaranUnsubscribe) {
    rumusPengeluaranUnsubscribe();
    rumusPengeluaranUnsubscribe = null;
  }
  if (!tanggal) return;

  const uidAdminCabang = await getUidAdminCabang();
  if (!uidAdminCabang) return;

  // reset dulu biar gak nampilin data tanggal sebelumnya sekilas
  rumusLaporanData = null;
  rumusPengeluaranData = null;
  updateDistribusiUI();
  updateProduksiUI();
  toggleRumusTanggalCheck(false);

  // ── laporanAdmin ──
  const ref = doc(db, "users", uidAdminCabang, "laporanAdmin", tanggal);
  rumusUnsubscribe = onSnapshot(
    ref,
    (snap) => {
      rumusLaporanData = snap.exists() ? snap.data() : null;
      updateDistribusiUI();
      updateProduksiUI();
    },
    (err) => {}
  );

  // ── pengeluaran ──
  const refPengeluaran = doc(db, "users", uidAdminCabang, "pengeluaran", tanggal);
  rumusPengeluaranUnsubscribe = onSnapshot(
    refPengeluaran,
    (snap) => {
      rumusPengeluaranData = snap.exists() ? snap.data() : null;
      updateDistribusiUI();
      updateProduksiUI();
    },
    (err) => {}
  );

  // ── setoranAmplop (cek sudah disetor atau belum) ──
  const refSetoran = doc(db, "users", uidAdminCabang, "setoranAmplop", tanggal);
  rumusSetoranUnsubscribe = onSnapshot(
    refSetoran,
    (snap) => {
      toggleRumusTanggalCheck(snap.exists());
      const catatanInput = document.getElementById("rumusCatatan");
      if (catatanInput) {
        catatanInput.value = snap.exists() ? (snap.data().catatan || "") : "";
      }
    },
    (err) => {}
  );
}
function openRumusPanel() {
  document.getElementById("rumusOverlay")?.classList.add("show");
  document.getElementById("rumusPanel")?.classList.add("show");

  const tanggalInput = document.getElementById("rumusTanggal");
  if (tanggalInput && !tanggalInput.value) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    tanggalInput.value = `${yyyy}-${mm}-${dd}`;
  }

  loadRumusData(tanggalInput?.value);
}
function closeRumusPanel() {
  document.getElementById("rumusOverlay")?.classList.remove("show");
  document.getElementById("rumusPanel")?.classList.remove("show");

  if (rumusUnsubscribe) {
    rumusUnsubscribe();
    rumusUnsubscribe = null;
  }
  if (rumusPengeluaranUnsubscribe) {
    rumusPengeluaranUnsubscribe();
    rumusPengeluaranUnsubscribe = null;
  }
  if (rumusSetoranUnsubscribe) {
    rumusSetoranUnsubscribe();
    rumusSetoranUnsubscribe = null;
  }
}
window.openRumusPanel = openRumusPanel;
window.closeRumusPanel = closeRumusPanel;
document.getElementById("rumusPanelClose")?.addEventListener("click", closeRumusPanel);
document.getElementById("rumusOverlay")?.addEventListener("click", closeRumusPanel);
document.getElementById("rumusTanggal")?.addEventListener("change", (e) => {
  loadRumusData(e.target.value);
  window.onRumusTanggalChange?.(e.target.value); // hook buat trigger query nanti
});
document.getElementById("rumusSaveBtn")?.addEventListener("click", () => {
  simpanSetoranAmplop();
});

/* ── SWIPE TO CLOSE ── */
(function initRumusSwipe() {
  const panel = document.getElementById("rumusPanel");
  if (!panel) return;
  const body = panel.querySelector(".rumus-panel-body");
  let startY = 0, lastY = 0, dy = 0, dragging = false, tracking = false;
  panel.addEventListener("touchstart", (e) => {
    if (window.innerWidth > 768) return;
    tracking = true;
    dragging = false;
    startY = lastY = e.touches[0].clientY;
    dy = 0;
    panel.style.transition = "none";
  }, { passive: true });
  panel.addEventListener("touchmove", (e) => {
    if (!tracking) return;
    const y = e.touches[0].clientY;
    const stepY = y - lastY; // gerakan sejak event terakhir
    lastY = y;
    dy = y - startY;

    if (!dragging) {
      const atTop = !body || body.scrollTop <= 0;
      if (atTop && stepY > 0) {
        dragging = true;
      } else if (body) {
        e.preventDefault();
        body.scrollTop -= stepY;
        return;
      }
    }

    if (dragging) {
      e.preventDefault();
      panel.style.transform = `translateY(${Math.max(0, dy)}px)`;
    }
  }, { passive: false });
  panel.addEventListener("touchend", () => {
    tracking = false;
    if (!dragging) return;
    dragging = false;
    panel.style.transition = "transform .3s cubic-bezier(.32,1,.23,1)";

    if (dy > 120) {
      // lanjutkan animasi turun sampai bener-bener hilang, baru beneran tutup
      panel.style.transform = "translateY(100%)";
      setTimeout(() => {
        closeRumusPanel();
        panel.style.transform = "";
        panel.style.transition = "";
      }, 300);
    } else {
      // batal, balik ke posisi terbuka
      panel.style.transform = "";
      setTimeout(() => { panel.style.transition = ""; }, 300);
    }
  });
  // ── DESKTOP: swipe ke kanan (mouse drag) ──
  let startX = 0, curX = 0, draggingDesktop = false;
  panel.addEventListener("mousedown", (e) => {
    if (window.innerWidth <= 768) return;
    startX = curX = e.clientX;
    draggingDesktop = true;
    panel.style.transition = "none";
  });
  window.addEventListener("mousemove", (e) => {
    if (!draggingDesktop) return;
    curX = e.clientX;
    const dx = curX - startX;
    if (dx < 0) return;
    panel.style.transform = `translateX(${dx}px)`;
  });
  window.addEventListener("mouseup", () => {
    if (!draggingDesktop) return;
    draggingDesktop = false;

    panel.style.transition = "transform .3s cubic-bezier(.32,1,.23,1)";

    if (curX - startX > 120) {
      panel.style.transform = "translateX(100%)";
      setTimeout(() => {
        closeRumusPanel();
        panel.style.transform = "";
        panel.style.transition = "";
      }, 300);
    } else {
      panel.style.transform = "";
      setTimeout(() => { panel.style.transition = ""; }, 300);
    }
  });
})();

/* ── TOAST ── */
let _toastTimer = null;
window.showToast = function(msg, type = "", duration = 2800) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className   = `toast ${type}`;
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), duration);
};