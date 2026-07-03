/* ── AMPLOP VIEW ── */
let amplopListUnsubscribe = null;
let amplopAllDocs         = [];
let amplopSearch          = "";
let amplopStatus          = "semua";
let amplopRangeDari       = "";
let amplopRangeSampai     = "";
let amplopBulan           = new Date().getMonth();
let amplopTahun           = new Date().getFullYear();

const AMPLOP_BULAN_NAMA = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function formatTanggalIndo(tanggalStr) {
  if (!tanggalStr) return "-";
  const [y, m, d] = tanggalStr.split("-");
  return `${parseInt(d)} ${BULAN_NAMA[parseInt(m) - 1]} ${y}`;
}

/* ── FILTER & RENDER LIST ── */
function amplopFilterAndRender() {
  let filtered = [...amplopAllDocs];

  if (amplopSearch) {
    const q = amplopSearch.toLowerCase();
    filtered = filtered.filter(d =>
      (d.tanggal||"").includes(q) ||
      String(d.distribusi?.amplop||"").includes(q) ||
      String(d.produksi?.amplop||"").includes(q)
    );
  }

  if (amplopStatus === "diterima") filtered = filtered.filter(d => d.diterima === true);
  if (amplopStatus === "pending")  filtered = filtered.filter(d => d.diterima !== true);

  if (amplopRangeDari)   filtered = filtered.filter(d => d.tanggal >= amplopRangeDari);
  if (amplopRangeSampai) filtered = filtered.filter(d => d.tanggal <= amplopRangeSampai);

  renderAmplopList(filtered);
}

function renderAmplopList(docs) {
  const container = document.getElementById("amplopList");
  if (!container) return;

  if (!docs.length) {
    container.innerHTML = `<div class="amplop-list-empty">Belum ada data setoran bulan ini</div>`;
    return;
  }

  container.innerHTML = docs.map(data => {
    const badgeClass = data.diterima ? "sent" : "pending";
    const badgeText  = data.diterima ? "Diterima" : "Belum Diterima";
    return `
      <div class="amplop-card" data-tanggal="${data.tanggal}">
        <div class="amplop-card-top">
          <div class="amplop-card-date">${formatTanggalIndo(data.tanggal)}</div>
          <div class="amplop-card-badge ${badgeClass}" data-tanggal="${data.tanggal}" data-diterima="${data.diterima}">${badgeText}</div>
        </div>
        <div class="amplop-card-row">
          <span class="amplop-card-label">Amplop Distribusi</span>
          <span class="amplop-card-value">${window.formatRupiah(data.distribusi?.amplop)}</span>
        </div>
        <div class="amplop-card-row">
          <span class="amplop-card-label">Amplop Produksi</span>
          <span class="amplop-card-value">${window.formatRupiah(data.produksi?.amplop)}</span>
        </div>
      </div>`;
  }).join("");

  container.querySelectorAll(".amplop-card").forEach(card => {
    card.addEventListener("click", e => {
      if (e.target.closest(".amplop-card-badge")) return;
      const tanggal = card.dataset.tanggal;
      const data    = docs.find(d => d.tanggal === tanggal);
      if (data) openAmplopDetail(data);
    });
  });

  container.querySelectorAll(".amplop-card-badge").forEach(badge => {
    badge.addEventListener("click", e => {
      e.stopPropagation();
      const tanggal  = badge.dataset.tanggal;
      const diterima = badge.dataset.diterima === "true";
      showAmplopKonfirmasi(tanggal, diterima);
    });
  });
}

/* ── DETAIL POPUP ── */
function renderAmplopSection(sectionData, sectionTitle) {
  if (!sectionData) return "";

  const pengeluaranArr = sectionData.pengeluaranDistribusi?.pengeluaran
    || sectionData.pengeluaranProduksi?.pengeluaran
    || [];

  // build map lainnya per uid
  const lainnyaByUid = {};
  (sectionData.lainnya || []).forEach(item => {
    if (item.uid) lainnyaByUid[item.uid] = {
      bonusPay:      Number(item.bonusPay)      || 0,
      klaimInsentif: Number(item.klaimInsentif) || 0,
    };
  });

  // omset per orang = nilai - bonusPay - klaimInsentif
  const omsetRows = (sectionData.omset || []).map(item => {
    const l     = lainnyaByUid[item.uid] || {};
    const netto = (Number(item.nilai) || 0) - (l.bonusPay || 0) - (l.klaimInsentif || 0);
    return `<div class="amplop-detail-row"><span class="label">${item.nama}</span><span class="value">${window.formatRupiah(netto)}</span></div>`;
  }).join("") || `<div class="amplop-detail-row"><span class="label">-</span><span class="value">Rp 0</span></div>`;

  const totalOmset = (sectionData.omset || []).reduce((a, item) => {
    const l = lainnyaByUid[item.uid] || {};
    return a + (Number(item.nilai) || 0) - (l.bonusPay || 0) - (l.klaimInsentif || 0);
  }, 0);

  const totalLainnya = (sectionData.lainnya || []).reduce((a, b) => a + (Number(b.total ?? b.nilai) || 0), 0);

  const lainnyaRows = (sectionData.lainnya || []).map(item => {
    const details = [
      item.bonusPay      > 0 ? `Bonus Pay: ${window.formatRupiah(item.bonusPay)}`          : null,
      item.klaimInsentif > 0 ? `Klaim Insentif: ${window.formatRupiah(item.klaimInsentif)}` : null,
      item.kasbon        > 0 ? `Kasbon: ${window.formatRupiah(item.kasbon)}`                : null,
    ].filter(Boolean).join(" · ");
    return `
      <div class="amplop-detail-row amplop-detail-row-multi">
        <div class="amplop-detail-row-top">
          <span class="label">${item.nama}</span>
          <span class="value">- ${window.formatRupiah(item.total ?? item.nilai)}</span>
        </div>
        ${details ? `<div class="amplop-detail-row-sub">${details}</div>` : ""}
      </div>`;
  }).join("") || `<div class="amplop-detail-row"><span class="label">Tidak ada</span><span class="value">Rp 0</span></div>`;

  const totalPengeluaran = pengeluaranArr.reduce((a, b) => a + (Number(b.nominal) || 0), 0);

  const pengeluaranRows = pengeluaranArr.map(item =>
    `<div class="amplop-detail-row"><span class="label">${item.nama||""} (x${item.qty||1})</span><span class="value">- ${window.formatRupiah(item.nominal)}</span></div>`
  ).join("") || `<div class="amplop-detail-row"><span class="label">Tidak ada</span><span class="value">Rp 0</span></div>`;

  return `
    <div class="amplop-detail-section-title">${sectionTitle}</div>

    <div class="amplop-detail-subtitle">Omset</div>
    ${omsetRows}
    <div class="amplop-detail-row amplop-detail-row-sum">
      <span class="label">Total Omset</span>
      <span class="value">${window.formatRupiah(totalOmset)}</span>
    </div>

    <div class="amplop-detail-subtitle">Lainnya</div>
    ${lainnyaRows}
    <div class="amplop-detail-row amplop-detail-row-sum">
      <span class="label">Total Lainnya</span>
      <span class="value">- ${window.formatRupiah(totalLainnya)}</span>
    </div>

    <div class="amplop-detail-subtitle">Pengeluaran</div>
    ${pengeluaranRows}
    <div class="amplop-detail-row amplop-detail-row-sum">
      <span class="label">Total Pengeluaran</span>
      <span class="value">- ${window.formatRupiah(totalPengeluaran)}</span>
    </div>

    <div class="amplop-detail-total">
      <span>Amplop</span>
      <span>${window.formatRupiah(sectionData.amplop)}</span>
    </div>`;
}

async function openAmplopDetail(data) {
  const titleEl = document.getElementById("amplopDetailTitle");
  const bodyEl  = document.getElementById("amplopDetailBody");
  if (titleEl) titleEl.textContent = `Detail Setoran - ${formatTanggalIndo(data.tanggal)}`;

  document.getElementById("amplopDetailOverlay")?.classList.add("show");
  document.getElementById("amplopDetailPanel")?.classList.add("show");

  if (bodyEl) bodyEl.innerHTML = `<div class="amplop-list-empty">Memuat...</div>`;

  try {
    const uidAdminCabang = await window.getUidAdminCabang();
    const snap = await window.getDoc(
      window.doc(window.db, "users", uidAdminCabang, "setoranAmplop", data.tanggal)
    );
    const fresh = snap.exists() ? snap.data() : data;
    if (bodyEl) {
      bodyEl.innerHTML = `
        ${renderAmplopSection(fresh.produksi,   "Produksi")}
        ${renderAmplopSection(fresh.distribusi, "Distribusi")}
        ${fresh.catatan ? `<div class="amplop-detail-catatan">${fresh.catatan}</div>` : ""}`;
    }
  } catch {
    if (bodyEl) {
      bodyEl.innerHTML = `
        ${renderAmplopSection(data.produksi,   "Produksi")}
        ${renderAmplopSection(data.distribusi, "Distribusi")}
        ${data.catatan ? `<div class="amplop-detail-catatan">${data.catatan}</div>` : ""}`;
    }
  }
}

function closeAmplopDetail() {
  document.getElementById("amplopDetailOverlay")?.classList.remove("show");
  document.getElementById("amplopDetailPanel")?.classList.remove("show");
}

/* ── KONFIRMASI DITERIMA ── */
function showAmplopKonfirmasi(tanggal, diterimaSekarang) {
  document.getElementById("amplopKonfirmasiOverlay")?.remove();
  const pesan = diterimaSekarang
    ? "Tandai amplop ini sebagai <b>Belum Diterima</b>?"
    : "Tandai amplop ini sebagai <b>Diterima</b>?";
  const el = document.createElement("div");
  el.id = "amplopKonfirmasiOverlay";
  el.className = "amplop-konfirmasi-overlay";
  el.innerHTML = `
    <div class="amplop-konfirmasi-box">
      <div class="amplop-konfirmasi-title">Konfirmasi</div>
      <div class="amplop-konfirmasi-pesan">${pesan}</div>
      <div class="amplop-konfirmasi-actions">
        <button class="amplop-konfirmasi-batal" id="amplopKonfirmasiBatal">Batal</button>
        <button class="amplop-konfirmasi-oke ${diterimaSekarang ? "amplop-konfirmasi-oke-red" : "amplop-konfirmasi-oke-green"}" id="amplopKonfirmasiOke">
          ${diterimaSekarang ? "Batalkan" : "Diterima"}
        </button>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById("amplopKonfirmasiBatal").onclick = () => el.remove();
  el.onclick = e => { if (e.target === el) el.remove(); };

  document.getElementById("amplopKonfirmasiOke").onclick = async () => {
    const btn = document.getElementById("amplopKonfirmasiOke");
    btn.disabled = true; btn.textContent = "Menyimpan...";
    try {
      const uidAdminCabang = await window.getUidAdminCabang();
      await window.setDoc(
        window.doc(window.db, "users", uidAdminCabang, "setoranAmplop", tanggal),
        { diterima: !diterimaSekarang }, { merge: true }
      );
      window.showToast(!diterimaSekarang ? "Ditandai diterima" : "Dibatalkan", "success");
      el.remove();
    } catch (err) {
      console.error("❌ update diterima:", err);
      window.showToast("Gagal menyimpan", "error");
      btn.disabled = false;
      btn.textContent = diterimaSekarang ? "Batalkan" : "Diterima";
    }
  };
}

/* ── SWIPE TO CLOSE DETAIL ── */
(function initAmplopDetailSwipe() {
  const panel = document.getElementById("amplopDetailPanel");
  if (!panel) return;
  const body = panel.querySelector(".amplop-detail-body");

  let startY = 0, lastY = 0, dy = 0, dragging = false, tracking = false;
  panel.addEventListener("touchstart", e => {
    if (window.innerWidth > 768) return;
    tracking = true; dragging = false;
    startY = lastY = e.touches[0].clientY; dy = 0;
    panel.style.transition = "none";
  }, { passive: true });
  panel.addEventListener("touchmove", e => {
    if (!tracking) return;
    const y = e.touches[0].clientY;
    const stepY = y - lastY;
    lastY = y; dy = y - startY;
    if (!dragging) {
      const atTop = !body || body.scrollTop <= 0;
      if (atTop && stepY > 0) { dragging = true; }
      else if (body) { e.preventDefault(); body.scrollTop -= stepY; return; }
    }
    if (dragging) { e.preventDefault(); panel.style.transform = `translateY(${Math.max(0, dy)}px)`; }
  }, { passive: false });
  panel.addEventListener("touchend", () => {
    tracking = false;
    if (!dragging) return;
    dragging = false;
    panel.style.transition = "transform .3s cubic-bezier(.32,1,.23,1)";
    if (dy > 120) {
      panel.style.transform = "translateY(100%)";
      setTimeout(() => { closeAmplopDetail(); panel.style.transform = ""; panel.style.transition = ""; }, 300);
    } else { panel.style.transform = ""; setTimeout(() => { panel.style.transition = ""; }, 300); }
  });

  let startX = 0, curX = 0, draggingDesktop = false;
  panel.addEventListener("mousedown", e => {
    if (window.innerWidth <= 768) return;
    startX = curX = e.clientX; draggingDesktop = true;
    panel.style.transition = "none";
  });
  window.addEventListener("mousemove", e => {
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
      setTimeout(() => { closeAmplopDetail(); panel.style.transform = ""; panel.style.transition = ""; }, 300);
    } else { panel.style.transform = ""; setTimeout(() => { panel.style.transition = ""; }, 300); }
  });
})();

/* ── LOAD DATA ── */
async function reloadAmplopData() {
  if (amplopListUnsubscribe) { amplopListUnsubscribe(); amplopListUnsubscribe = null; }

  const uidAdminCabang = await window.getUidAdminCabang();
  if (!uidAdminCabang) return;

  const mm    = String(amplopBulan + 1).padStart(2, "0");
  const start = `${amplopTahun}-${mm}-01`;
  const end   = `${amplopTahun}-${mm}-31`;

  const q = window.query(
    window.collection(window.db, "users", uidAdminCabang, "setoranAmplop"),
    window.where("tanggal", ">=", start),
    window.where("tanggal", "<=", end),
    window.orderBy("tanggal", "desc")
  );

  amplopListUnsubscribe = window.onSnapshot(q, snap => {
    amplopAllDocs = snap.docs.map(d => d.data());
    amplopFilterAndRender();
  }, () => {});
}

window.loadAmplopList = reloadAmplopData;

/* ── INIT VIEW ── */
window.initAmplopView = function () {
  const bulanBtn  = document.getElementById("amplopBulanBtn");
  const tahunBtn  = document.getElementById("amplopTahunBtn");
  const statusBtn = document.getElementById("amplopStatusBtn");
  const rangeBtn  = document.getElementById("amplopRangeBtn");
  const bulanDD   = document.getElementById("amplopBulanDropdown");
  const tahunDD   = document.getElementById("amplopTahunDropdown");
  const statusDD  = document.getElementById("amplopStatusDropdown");

  document.getElementById("amplopBulanLabel").textContent = AMPLOP_BULAN_NAMA[amplopBulan];
  document.getElementById("amplopTahunLabel").textContent = amplopTahun;

  // build tahun dropdown
  const now = new Date().getFullYear();
  tahunDD.innerHTML = [now-1, now, now+1].map(y =>
    `<div class="amplop-dropdown-option ${y===amplopTahun?"selected":""}" data-tahun="${y}">${y}</div>`
  ).join("");

  const closeAll = () => {
    bulanDD.style.display  = "none";
    tahunDD.style.display  = "none";
    statusDD.style.display = "none";
  };
  document.addEventListener("click", e => {
    if (!e.target.closest(".amplop-dropdown") && !e.target.closest(".amplop-filter-btn")) {
      closeAll();
    }
  });

  const openDD = (btn, dd) => {
    const isOpen = dd.style.display === "block";
    closeAll();
    if (isOpen) return;
    const rect = btn.getBoundingClientRect();
    dd.style.top      = (rect.bottom + 4) + "px";
    dd.style.left     = rect.left + "px";
    dd.style.position = "fixed";
    dd.style.zIndex   = "9999";
    dd.style.display  = "block";
  };

  bulanBtn?.addEventListener("click",  e => { e.stopPropagation(); openDD(bulanBtn,  bulanDD); });
  tahunBtn?.addEventListener("click",  e => { e.stopPropagation(); openDD(tahunBtn,  tahunDD); });
  statusBtn?.addEventListener("click", e => { e.stopPropagation(); openDD(statusBtn, statusDD); });

  bulanDD?.querySelectorAll(".amplop-dropdown-option").forEach(opt => {
    opt.addEventListener("click", e => {
      e.stopPropagation();
      amplopBulan = Number(opt.dataset.bulan);
      document.getElementById("amplopBulanLabel").textContent = AMPLOP_BULAN_NAMA[amplopBulan];
      bulanDD.querySelectorAll(".amplop-dropdown-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      closeAll();
      reloadAmplopData();
    });
  });

  tahunDD?.addEventListener("click", e => {
    e.stopPropagation();
    const opt = e.target.closest(".amplop-dropdown-option");
    if (!opt) return;
    amplopTahun = Number(opt.dataset.tahun);
    document.getElementById("amplopTahunLabel").textContent = amplopTahun;
    tahunDD.querySelectorAll(".amplop-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    reloadAmplopData();
  });

  statusDD?.querySelectorAll(".amplop-dropdown-option").forEach(opt => {
    opt.addEventListener("click", e => {
      e.stopPropagation();
      amplopStatus = opt.dataset.status;
      document.getElementById("amplopStatusLabel").textContent = opt.textContent;
      statusDD.querySelectorAll(".amplop-dropdown-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      statusBtn.classList.toggle("active", amplopStatus !== "semua");
      closeAll();
      amplopFilterAndRender();
    });
  });

  document.getElementById("amplopSearchInput")?.addEventListener("input", e => {
    amplopSearch = e.target.value.toLowerCase().trim();
    amplopFilterAndRender();
  });

  rangeBtn?.addEventListener("click", e => {
    e.stopPropagation();
    document.getElementById("amplopRangeOverlay").style.display = "flex";
  });
  document.getElementById("amplopRangeOverlay")?.addEventListener("click", e => {
    if (e.target.id === "amplopRangeOverlay") e.currentTarget.style.display = "none";
  });
  document.getElementById("amplopRangeApply")?.addEventListener("click", () => {
    amplopRangeDari   = document.getElementById("amplopRangeDari").value;
    amplopRangeSampai = document.getElementById("amplopRangeSampai").value;
    document.getElementById("amplopRangeOverlay").style.display = "none";
    document.getElementById("amplopRangeBtn").classList.toggle("active", !!(amplopRangeDari || amplopRangeSampai));
    amplopFilterAndRender();
  });
  document.getElementById("amplopRangeReset")?.addEventListener("click", () => {
    amplopRangeDari = amplopRangeSampai = "";
    document.getElementById("amplopRangeDari").value    = "";
    document.getElementById("amplopRangeSampai").value  = "";
    document.getElementById("amplopRangeOverlay").style.display = "none";
    document.getElementById("amplopRangeBtn").classList.remove("active");
    amplopFilterAndRender();
  });

  document.getElementById("amplopDetailClose")?.addEventListener("click", closeAmplopDetail);
  document.getElementById("amplopDetailOverlay")?.addEventListener("click", closeAmplopDetail);

  reloadAmplopData();
};

window.onAmplopViewHide = function() {
  if (amplopListUnsubscribe) { amplopListUnsubscribe(); amplopListUnsubscribe = null; }
};
