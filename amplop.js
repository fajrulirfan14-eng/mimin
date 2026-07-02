/* ── AMPLOP VIEW ── */
let amplopListUnsubscribe = null;

function formatTanggalIndo(tanggalStr) {
  if (!tanggalStr) return "-";
  const [y, m, d] = tanggalStr.split("-");
  const bulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${parseInt(d)} ${bulan[parseInt(m) - 1]} ${y}`;
}

function renderAmplopList(docs) {
  const container = document.getElementById("amplopList");
  if (!container) return;

  if (!docs.length) {
    container.innerHTML = `<div class="amplop-list-empty">Belum ada data setoran bulan ini</div>`;
    return;
  }

  container.innerHTML = docs.map((data) => {
    const badgeClass = data.diterima ? "sent" : "pending";
    const badgeText = data.diterima ? "Diterima" : "Belum Diterima";
    return `
      <div class="amplop-card" data-tanggal="${data.tanggal}">
        <div class="amplop-card-top">
          <div class="amplop-card-date">${formatTanggalIndo(data.tanggal)}</div>
          <div class="amplop-card-badge ${badgeClass}">${badgeText}</div>
        </div>
        <div class="amplop-card-row">
          <span class="amplop-card-label">Amplop Distribusi</span>
          <span class="amplop-card-value">${window.formatRupiah(data.distribusi?.amplop)}</span>
        </div>
        <div class="amplop-card-row">
          <span class="amplop-card-label">Amplop Produksi</span>
          <span class="amplop-card-value">${window.formatRupiah(data.produksi?.amplop)}</span>
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".amplop-card").forEach((card) => {
    card.addEventListener("click", () => {
      const tanggal = card.dataset.tanggal;
      const data = docs.find(d => d.tanggal === tanggal);
      if (data) openAmplopDetail(data);
    });
  });
}

async function loadAmplopList(monthValue) {
  if (amplopListUnsubscribe) {
    amplopListUnsubscribe();
    amplopListUnsubscribe = null;
  }
  if (!monthValue) return;

  const uidAdminCabang = await window.getUidAdminCabang();
  if (!uidAdminCabang) return;

  const start = `${monthValue}-01`;
  const end = `${monthValue}-31`;

  const q = window.query(
    window.collection(window.db, "users", uidAdminCabang, "setoranAmplop"),
    window.where("tanggal", ">=", start),
    window.where("tanggal", "<=", end),
    window.orderBy("tanggal", "desc")
  );

  amplopListUnsubscribe = window.onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map(d => d.data());
      renderAmplopList(docs);
    },
    (err) => {}
  );
}

function renderAmplopSection(sectionData, sectionTitle) {
  if (!sectionData) return "";

  const omsetRows = (sectionData.omset || []).map(item =>
    `<div class="amplop-detail-row"><span class="label">${item.nama}</span><span class="value">${window.formatRupiah(item.nilai)}</span></div>`
  ).join("") || `<div class="amplop-detail-row"><span class="label">-</span><span class="value">Rp 0</span></div>`;

  const lainnyaRows = (sectionData.lainnya || []).map(item => {
    if (item.total !== undefined) {
      return `<div class="amplop-detail-row"><span class="label">${item.nama} (Bonus+Klaim+Kasbon)</span><span class="value">${window.formatRupiah(item.total)}</span></div>`;
    }
    return `<div class="amplop-detail-row"><span class="label">${item.nama}</span><span class="value">${window.formatRupiah(item.nilai)}</span></div>`;
  }).join("") || `<div class="amplop-detail-row"><span class="label">Tidak ada</span><span class="value">Rp 0</span></div>`;

  const pengeluaranArr = sectionData.pengeluaranDistribusi?.pengeluaran || sectionData.pengeluaranProduksi?.pengeluaran || [];
  const pengeluaranRows = pengeluaranArr.map(item =>
    `<div class="amplop-detail-row"><span class="label">${item.nama} (x${item.qty})</span><span class="value">${window.formatRupiah(item.nominal)}</span></div>`
  ).join("") || `<div class="amplop-detail-row"><span class="label">Tidak ada</span><span class="value">Rp 0</span></div>`;

  return `
    <div class="amplop-detail-section-title">${sectionTitle}</div>
    <div class="amplop-detail-subtitle">Omset</div>
    ${omsetRows}
    <div class="amplop-detail-subtitle">Lainnya</div>
    ${lainnyaRows}
    <div class="amplop-detail-subtitle">Pengeluaran</div>
    ${pengeluaranRows}
    <div class="amplop-detail-total">
      <span>Amplop</span>
      <span>${window.formatRupiah(sectionData.amplop)}</span>
    </div>
  `;
}

function openAmplopDetail(data) {
  const titleEl = document.getElementById("amplopDetailTitle");
  const bodyEl = document.getElementById("amplopDetailBody");
  if (titleEl) titleEl.textContent = `Detail Setoran - ${formatTanggalIndo(data.tanggal)}`;

  if (bodyEl) {
    bodyEl.innerHTML = `
      ${renderAmplopSection(data.produksi, "Produksi")}
      ${renderAmplopSection(data.distribusi, "Distribusi")}
      ${data.catatan ? `<div class="amplop-detail-catatan">${data.catatan}</div>` : ""}
    `;
  }

  document.getElementById("amplopDetailOverlay")?.classList.add("show");
  document.getElementById("amplopDetailPanel")?.classList.add("show");
}

function closeAmplopDetail() {
  document.getElementById("amplopDetailOverlay")?.classList.remove("show");
  document.getElementById("amplopDetailPanel")?.classList.remove("show");
}

document.getElementById("amplopDetailClose")?.addEventListener("click", closeAmplopDetail);
document.getElementById("amplopDetailOverlay")?.addEventListener("click", closeAmplopDetail);

/* ── SWIPE TO CLOSE ── */
(function initAmplopDetailSwipe() {
  const panel = document.getElementById("amplopDetailPanel");
  if (!panel) return;
  const body = panel.querySelector(".amplop-detail-body");

  // ── MOBILE: swipe ke bawah ──
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
    const stepY = y - lastY;
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
      panel.style.transform = "translateY(100%)";
      setTimeout(() => {
        closeAmplopDetail();
        panel.style.transform = "";
        panel.style.transition = "";
      }, 300);
    } else {
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
        closeAmplopDetail();
        panel.style.transform = "";
        panel.style.transition = "";
      }, 300);
    } else {
      panel.style.transform = "";
      setTimeout(() => { panel.style.transition = ""; }, 300);
    }
  });
})();

window.initAmplopView = function () {
  const monthInput = document.getElementById("amplopFilterMonth");
  if (!monthInput) return;

  if (!monthInput.value) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    monthInput.value = `${yyyy}-${mm}`;
  }

  loadAmplopList(monthInput.value);

  monthInput.addEventListener("change", (e) => {
    loadAmplopList(e.target.value);
  });
};
