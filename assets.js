/* ── ASSETS VIEW ── */
window.initAssetsView = function() {
  initAssetsFilterSync();

  document.getElementById("assetsReloadBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("assetsReloadBtn");
    btn.classList.add("spinning");
    await renderAssetsGrid();
    btn.classList.remove("spinning");
  });

  document.getElementById("assetsBackBtn")?.addEventListener("click", () => {
    document.getElementById("assetsDetailWrapper")?.classList.remove("show");
    document.getElementById("assetsBackBtn").style.display = "none";
    document.querySelectorAll("#rekapDistribusiList .lap-kurir-item").forEach(x => x.classList.remove("active"));
  });

  document.getElementById("assetsReloadBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("assetsReloadBtn");
    btn.classList.add("spinning");
    await renderAssetsGrid();
    btn.classList.remove("spinning");
  });
};

function openAssetsPanel() {
  document.getElementById("rekapDistribusiEmpty").style.display   = "none";
  document.getElementById("rekapDistribusiContent").style.display = "none";
  document.getElementById("rekapDistribusiDetailWrapper")?.classList.remove("show");

  document.getElementById("assetsEmpty").style.display   = "none";
  document.getElementById("assetsContent").style.display = "flex";
  document.getElementById("assetsDetailWrapper")?.classList.add("show");

  if (window.innerWidth <= 768) {
    const backBtn = document.getElementById("assetsBackBtn");
    if (backBtn) backBtn.style.display = "flex";
  }

  renderAssetsGrid();
}
function initAssetsFilterSync() {
  const bulanBtn = document.getElementById("assetsBulanBtn");
  const tahunBtn = document.getElementById("assetsTahunBtn");

  // sinkron label awal
  document.getElementById("assetsBulanLabel").textContent = REKAP_DIST_BULAN_NAMA?.[rekapDistBulan] || "-";
  document.getElementById("assetsTahunLabel").textContent = rekapDistTahun;

  // buat dropdown sama seperti rekapDistBulanDropdown, tapi khusus assets
  const bulanDD = document.createElement("div");
  bulanDD.className = "rekap-dist-dropdown";
  bulanDD.id = "assetsBulanDropdown";
  bulanDD.style.display = "none";
  bulanDD.innerHTML = REKAP_DIST_BULAN_NAMA.map((nama, i) =>
    `<div class="rekap-dist-dropdown-option ${i === rekapDistBulan ? "selected" : ""}" data-bulan="${i}">${nama}</div>`
  ).join("");
  document.body.appendChild(bulanDD);

  const tahunDD = document.createElement("div");
  tahunDD.className = "rekap-dist-dropdown";
  tahunDD.id = "assetsTahunDropdown";
  tahunDD.style.display = "none";
  const now = new Date().getFullYear();
  tahunDD.innerHTML = [now-1, now, now+1].map(y =>
    `<div class="rekap-dist-dropdown-option ${y===rekapDistTahun?"selected":""}" data-tahun="${y}">${y}</div>`
  ).join("");
  document.body.appendChild(tahunDD);

  const closeAll = () => { bulanDD.style.display = "none"; tahunDD.style.display = "none"; };
  document.addEventListener("click", e => {
    if (!e.target.closest("#assetsBulanBtn") && !e.target.closest("#assetsTahunBtn")
        && !e.target.closest("#assetsBulanDropdown") && !e.target.closest("#assetsTahunDropdown")) {
      closeAll();
    }
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
      rekapDistBulan = Number(opt.dataset.bulan);
      syncAssetsFilterLabel();
      closeAll();
      renderAssetsGrid();
    });
  });

  tahunDD.addEventListener("click", e => {
    e.stopPropagation();
    const opt = e.target.closest(".rekap-dist-dropdown-option");
    if (!opt) return;
    rekapDistTahun = Number(opt.dataset.tahun);
    syncAssetsFilterLabel();
    closeAll();
    renderAssetsGrid();
  });
}
function syncAssetsFilterLabel(shouldRerender = true) {
  document.getElementById("assetsBulanLabel").textContent = REKAP_DIST_BULAN_NAMA[rekapDistBulan];
  document.getElementById("assetsTahunLabel").textContent = rekapDistTahun;
  document.getElementById("rekapDistBulanLabel").textContent = REKAP_DIST_BULAN_NAMA[rekapDistBulan];
  document.getElementById("rekapDistTahunLabel").textContent = rekapDistTahun;

  document.querySelectorAll("#rekapDistBulanDropdown .rekap-dist-dropdown-option").forEach(o => {
    o.classList.toggle("selected", Number(o.dataset.bulan) === rekapDistBulan);
  });
  document.querySelectorAll("#rekapDistTahunDropdown .rekap-dist-dropdown-option").forEach(o => {
    o.classList.toggle("selected", Number(o.dataset.tahun) === rekapDistTahun);
  });

  // update badge "sudah disimpan" karena ini terkait periode, bukan render ulang seluruh grid
  cekAssetsSudahDisimpan();

  // hanya update label header teks (bulan/tahun akan disimpan), tidak render ulang grid data real-time
  const roleLabel = document.querySelector("#assetsGrid .rekap-dist-total-card .rekap-dist-role");
  if (roleLabel) {
    roleLabel.textContent = `Data real-time · akan disimpan sebagai periode ${REKAP_DIST_BULAN_NAMA[rekapDistBulan]} ${rekapDistTahun}`;
  }
}
async function renderAssetsGrid() {
  const gridEl = document.getElementById("assetsGrid");
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

  const kantorCabang = await window.idb.getKantorCabang();
  const upahHunter   = Number(kantorCabang?.upahHunter) || 0;
  window._assetsKantorCabangCache = kantorCabang;
  const varianList   = ["CB", "BB", "BK", "MC"];
  const HARI_LIST    = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];

  const cardsHtml = [];
  window._assetsBaseData = { totalJumlahCustomer: 0, totalNominalCustomer: 0, totalModalQty: {}, totalModalNominal: {} };
  varianList.forEach(v => { window._assetsBaseData.totalModalQty[v] = 0; window._assetsBaseData.totalModalNominal[v] = 0; });
  let totalJumlahCustomer = 0;
  let totalNominalCustomer = 0;
  const totalModalQty = {};
  const totalModalNominal = {};
  varianList.forEach(v => { totalModalQty[v] = 0; totalModalNominal[v] = 0; });

  for (const u of users) {
    const nama    = u.nama || "Tanpa Nama";
    const inisial = nama.trim().charAt(0).toUpperCase();
    const avatar  = u.foto
      ? `<img class="rekap-dist-avatar" src="${escAssets(u.foto)}" alt="${escAssets(nama)}">`
      : `<div class="rekap-dist-avatar">${escAssets(inisial)}</div>`;

    // ambil harga produksi per varian dari profil kurir
    const hargaMap = {};
    (u.varian || []).forEach(v => {
      const key = Object.keys(v)[0];
      if (key) hargaMap[key] = Number(v[key]?.hargaProduksi) || 0;
    });

    // hitung jumlah customer aktif + modal pending (dataKemarin)
    let jumlahCustomer = 0;
    const modalQty = {};
    varianList.forEach(v => { modalQty[v] = 0; });

    for (const h of HARI_LIST) {
      const custHari = await window.idb.getCustKurir(u.uid, h);
      if (!custHari?.length) continue;
      custHari.forEach(c => {
        if (c.status !== true) return;
        jumlahCustomer++;
        varianList.forEach(v => {
          modalQty[v] += Number(c.dataKemarin?.[v]?.qty) || 0;
        });
      });
    }

    const nominalCustomer = jumlahCustomer * upahHunter;

    const modalRows = varianList.map(v => {
      const qty = modalQty[v];
      const nominal = qty * (hargaMap[v] || 0);
      return `<tr><td>${v}</td><td>${qty || "-"}</td><td>${nominal ? nominal.toLocaleString("id-ID") : "-"}</td></tr>`;
    }).join("");

    const jumlahModalQty = varianList.reduce((a, v) => a + modalQty[v], 0);
    const jumlahModalNominal = varianList.reduce((a, v) => a + modalQty[v] * (hargaMap[v] || 0), 0);
    totalJumlahCustomer  += jumlahCustomer;
    totalNominalCustomer += nominalCustomer;
    varianList.forEach(v => {
      totalModalQty[v]     += modalQty[v];
      totalModalNominal[v] += modalQty[v] * (hargaMap[v] || 0);
    });

    window._assetsBaseData.totalJumlahCustomer  = totalJumlahCustomer;
    window._assetsBaseData.totalNominalCustomer = totalNominalCustomer;
    varianList.forEach(v => {
      window._assetsBaseData.totalModalQty[v]     = totalModalQty[v];
      window._assetsBaseData.totalModalNominal[v] = totalModalNominal[v];
    });
    const totalAssetKurir = nominalCustomer + jumlahModalNominal;
    perKurirData.push({
      uid: u.uid,
      nama,
      jumlahCustomer,
      nominalCustomer,
      modalQty: { ...modalQty },
      modalNominal: varianList.reduce((acc, v) => { acc[v] = modalQty[v] * (hargaMap[v] || 0); return acc; }, {}),
      totalAssetKurir,
    });

    const cardHtml = `
      <div class="rekap-dist-card" data-uid="${escAssets(u.uid)}">
        <div class="rekap-dist-card-header">
          ${avatar}
          <div>
            <div class="rekap-dist-nama">${escAssets(nama)}</div>
            <div class="rekap-dist-role">${escAssets(u.role || "-")}</div>
          </div>
        </div>
        <div class="rekap-dist-card-body">

          <div>
            <div class="rekap-dist-section-title">Customer</div>
            <table class="rekap-dist-table">
              <thead><tr><th>Jenis</th><th>Qty</th><th>Nominal</th></tr></thead>
              <tbody>
                <tr><td>Jumlah Customer</td><td>${jumlahCustomer || "-"}</td><td>${nominalCustomer ? nominalCustomer.toLocaleString("id-ID") : "-"}</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <div class="rekap-dist-section-title">Modal Pending</div>
            <table class="rekap-dist-table">
              <thead><tr><th>Jenis</th><th>Qty</th><th>Nominal</th></tr></thead>
              <tbody>
                ${modalRows}
                <tr><td>Jumlah Modal Pending</td><td>${jumlahModalQty || "-"}</td><td>${jumlahModalNominal ? jumlahModalNominal.toLocaleString("id-ID") : "-"}</td></tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>`;
    cardsHtml.push(cardHtml);
  }
  const bulanNamaList = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const bulanLabel = bulanNamaList[rekapDistBulan] || "-";

  const totalVarianRows = varianList.map(v => `
    <tr><td>${v}</td><td>${totalModalQty[v] || "-"}</td><td>${totalModalNominal[v] ? totalModalNominal[v].toLocaleString("id-ID") : "-"}</td></tr>
  `).join("");

  const grandTotalNominal = totalNominalCustomer + varianList.reduce((a, v) => a + totalModalNominal[v], 0);

  const totalCardHtml = `
    <div class="rekap-dist-card rekap-dist-total-card">
      <div class="rekap-dist-card-header">
        <div>
          <div class="rekap-dist-nama">Total Assets Distribusi</div>
          <div class="rekap-dist-role">Data real-time · akan disimpan sebagai periode ${bulanLabel} ${rekapDistTahun}</div>
        </div>
        <span class="rekap-dist-saved-badge" id="assetsSavedBadge" style="display:none">
          <i class="fa-solid fa-circle-check"></i> Sudah disimpan
        </span>
        <button class="rekap-dist-save-assets-btn" id="assetsSaveBtn">
          <i class="fa-solid fa-floppy-disk"></i> Simpan
        </button>
      </div>
      <div class="rekap-dist-card-body">

        <div>
          <div class="rekap-dist-section-title">Customer</div>
          <table class="rekap-dist-table">
            <thead><tr><th>Jenis</th><th>Qty</th><th>Nominal</th></tr></thead>
            <tbody>
              <tr><td>Jumlah Customer</td><td>${totalJumlahCustomer || "-"}</td><td>${totalNominalCustomer ? totalNominalCustomer.toLocaleString("id-ID") : "-"}</td></tr>
            </tbody>
          </table>
        </div>

        <div>
          <div class="rekap-dist-section-title">Modal Pending</div>
          <table class="rekap-dist-table">
            <thead><tr><th>Jenis</th><th>Qty</th><th>Nominal</th></tr></thead>
            <tbody>${totalVarianRows}</tbody>
          </table>
        </div>

        <div>
          <div class="rekap-dist-section-title">Total Asset</div>
          <table class="rekap-dist-table">
            <thead><tr><th>Jenis</th><th>Qty</th><th>Nominal</th></tr></thead>
            <tbody>
              <tr><td>Total Asset</td><td>-</td><td>${grandTotalNominal ? grandTotalNominal.toLocaleString("id-ID") : "-"}</td></tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>`;

  const historyCardHtml = `
    <div class="rekap-dist-card rekap-dist-total-card" id="assetsHistoryCard">
      <div class="rekap-dist-card-header">
        <div>
          <div class="rekap-dist-nama">Histori Assets Tersimpan</div>
          <div class="rekap-dist-role">Semua periode yang sudah disimpan</div>
        </div>
        <div class="rekap-dist-mode-toggle">
          <button class="rekap-dist-mode-btn active" data-mode="tabel">
            <i class="fa-solid fa-table"></i>
          </button>
          <button class="rekap-dist-mode-btn" data-mode="grafik">
            <i class="fa-solid fa-chart-line"></i>
          </button>
        </div>
      </div>
      <div class="rekap-dist-card-body" id="assetsHistoryBody">
        <div class="dh-ringkasan-empty">Memuat...</div>
      </div>
    </div>`;

  const tambahCardHtml = `
    <div class="rekap-dist-card assets-tambah-card">
      <button class="assets-tambah-btn" id="assetsTambahBtn">
        <i class="fa-solid fa-plus"></i> Tambah Kurir/Hunter/Sales
      </button>
    </div>`;

  gridEl.innerHTML = cardsHtml.join("") + tambahCardHtml + totalCardHtml + historyCardHtml;

  initAssetsTambahCard(varianList);
  loadAssetsHistory();
  initAssetsHistoryToggle();

  document.getElementById("assetsSaveBtn")?.addEventListener("click", () => {
    simpanAssetsSnapshot(perKurirData, {
      totalJumlahCustomer, totalNominalCustomer,
      totalModalQty, totalModalNominal, grandTotalNominal
    });
  });

  cekAssetsSudahDisimpan();
}
let assetsExtraCards = [];
function initAssetsTambahCard(varianList) {
  document.getElementById("assetsTambahBtn")?.addEventListener("click", () => {
    tambahAssetsExtraCard(varianList);
  });
}
async function tambahAssetsExtraCard(varianList) {
  if (!window.usersCache?.length) {
    window.usersCache = await window.idb.getUsers();
  }
  const eligibleUsers = (window.usersCache || []).filter(u =>
    ["kurir", "hunter", "sales"].includes(u.role)
  );

  const cardId = `extra-${Date.now()}`;
  assetsExtraCards.push({ id: cardId, uid: null, nama: null, role: null, qty: {}, jumlahCustomer: 0 });

  const gridEl = document.getElementById("assetsGrid");
  const tambahBtnCard = document.getElementById("assetsTambahBtn")?.closest(".assets-tambah-card");

  const cardEl = document.createElement("div");
  cardEl.className = "rekap-dist-card assets-extra-card";
  cardEl.dataset.cardId = cardId;
  cardEl.innerHTML = `
    <div class="rekap-dist-card-header">
      <div class="assets-extra-select-wrap">
        <button class="assets-extra-select-btn" data-card="${cardId}">
          <span>Pilih nama</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="assets-extra-select-dd" style="display:none">
          ${eligibleUsers.map(u => `<div class="assets-extra-select-opt" data-uid="${u.uid}" data-nama="${escAssets(u.nama||"-")}" data-role="${u.role}">${escAssets(u.nama||"-")} (${u.role})</div>`).join("")}
        </div>
      </div>
      <button class="assets-extra-remove-btn" data-card="${cardId}">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
    <div class="rekap-dist-card-body">

      <div>
        <div class="rekap-dist-section-title">Customer</div>
        <table class="rekap-dist-table">
          <thead><tr><th>Jenis</th><th>Qty</th><th>Nominal</th></tr></thead>
          <tbody>
            <tr>
              <td>Jumlah Customer</td>
              <td><input type="number" min="0" class="assets-extra-input" data-card="${cardId}" data-field="jumlahCustomer" style="width:60px;text-align:right"></td>
              <td class="assets-extra-nominal" data-card="${cardId}" data-field="jumlahCustomer">-</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <div class="rekap-dist-section-title">Modal Pending</div>
        <table class="rekap-dist-table">
          <thead><tr><th>Jenis</th><th>Qty</th><th>Nominal</th></tr></thead>
          <tbody>
            ${varianList.map(v => `
              <tr>
                <td>${v}</td>
                <td><input type="number" min="0" class="assets-extra-input" data-card="${cardId}" data-field="${v}" style="width:60px;text-align:right"></td>
                <td class="assets-extra-nominal" data-card="${cardId}" data-field="${v}">-</td>
              </tr>`).join("")}
            <tr>
              <td>Jumlah Modal Pending</td>
              <td class="assets-extra-jumlah-qty" data-card="${cardId}">-</td>
              <td class="assets-extra-jumlah-nominal" data-card="${cardId}">-</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>`;

  gridEl.insertBefore(cardEl, tambahBtnCard);

  // dropdown pilih nama
  const selectBtn = cardEl.querySelector(".assets-extra-select-btn");
  const selectDD  = cardEl.querySelector(".assets-extra-select-dd");
  selectBtn.addEventListener("click", e => {
    e.stopPropagation();
    selectDD.style.display = selectDD.style.display === "none" ? "block" : "none";
  });
  selectDD.querySelectorAll(".assets-extra-select-opt").forEach(opt => {
    opt.addEventListener("click", () => {
      const cardData = assetsExtraCards.find(c => c.id === cardId);
      cardData.uid  = opt.dataset.uid;
      cardData.nama = opt.dataset.nama;
      cardData.role = opt.dataset.role;
      selectBtn.querySelector("span").textContent = `${opt.dataset.nama} (${opt.dataset.role})`;
      selectDD.style.display = "none";
    });
  });
  document.addEventListener("click", () => { selectDD.style.display = "none"; });

  // input qty → hitung nominal
  cardEl.querySelectorAll(".assets-extra-input").forEach(input => {
    input.addEventListener("input", async () => {
      const field = input.dataset.field;
      const cardData = assetsExtraCards.find(c => c.id === cardId);
      const val = Number(input.value) || 0;

      const kantorCabang = await window.idb.getKantorCabang();
      const upahHunter = Number(kantorCabang?.upahHunter) || 0;

      if (field === "jumlahCustomer") {
        cardData.jumlahCustomer = val;
        const nominal = val * upahHunter;
        const nominalEl = cardEl.querySelector(`.assets-extra-nominal[data-field="jumlahCustomer"]`);
        if (nominalEl) nominalEl.textContent = nominal ? nominal.toLocaleString("id-ID") : "-";
      } else {
        cardData.qty[field] = val;

        let hargaProduksi = 0;
        if (cardData.uid) {
          const userData = (window.usersCache || []).find(u => u.uid === cardData.uid);
          const varianObj = (userData?.varian || []).find(v => Object.keys(v)[0] === field);
          hargaProduksi = Number(varianObj?.[field]?.hargaProduksi) || 0;
        }
        const nominal = val * hargaProduksi;
        const nominalEl = cardEl.querySelector(`.assets-extra-nominal[data-field="${field}"]`);
        if (nominalEl) nominalEl.textContent = nominal ? nominal.toLocaleString("id-ID") : "-";
      }

      await updateAssetsExtraJumlah(cardEl, cardId, varianList);
      recalculateTotalAssetsCard(varianList);
    });
  });

  // tombol hapus card
  cardEl.querySelector(".assets-extra-remove-btn").addEventListener("click", () => {
    assetsExtraCards = assetsExtraCards.filter(c => c.id !== cardId);
    cardEl.remove();
  });
}
function recalculateTotalAssetsCard(varianList) {
  const base = window._assetsBaseData;
  if (!base) return;

  let extraJumlahCustomer = 0;
  const extraModalQty = {};
  varianList.forEach(v => { extraModalQty[v] = 0; });

  assetsExtraCards.forEach(cardData => {
    extraJumlahCustomer += cardData.jumlahCustomer || 0;
    varianList.forEach(v => { extraModalQty[v] += cardData.qty[v] || 0; });
  });

  const kantorCabang = window._assetsKantorCabangCache;
  const upahHunter = Number(kantorCabang?.upahHunter) || 0;

  const finalJumlahCustomer = base.totalJumlahCustomer + extraJumlahCustomer;
  const finalNominalCustomer = base.totalNominalCustomer + (extraJumlahCustomer * upahHunter);

  const totalCard = document.querySelector(".rekap-dist-total-card");
  if (!totalCard) return;

  const customerRow = totalCard.querySelector("tbody tr");
  if (customerRow) {
    const tds = customerRow.querySelectorAll("td");
    tds[1].textContent = finalJumlahCustomer || "-";
    tds[2].textContent = finalNominalCustomer ? finalNominalCustomer.toLocaleString("id-ID") : "-";
  }

  // update modal pending rows (varian) + grand total
  let grandTotal = finalNominalCustomer;
  varianList.forEach((v, i) => {
    const finalQty = base.totalModalQty[v] + extraModalQty[v];
    // nominal extra pakai harga dari user masing-masing (sudah dihitung per card), ambil dari cardData
    let extraNominalVarian = 0;
    assetsExtraCards.forEach(cardData => {
      if (!cardData.uid) return;
      const userData = (window.usersCache || []).find(u => u.uid === cardData.uid);
      const varianObj = (userData?.varian || []).find(o => Object.keys(o)[0] === v);
      const harga = Number(varianObj?.[v]?.hargaProduksi) || 0;
      extraNominalVarian += (cardData.qty[v] || 0) * harga;
    });
    const finalNominalVarian = base.totalModalNominal[v] + extraNominalVarian;
    grandTotal += finalNominalVarian;

    const modalRows = totalCard.querySelectorAll(".rekap-dist-card-body > div")[1]?.querySelectorAll("tbody tr");
    if (modalRows && modalRows[i]) {
      const tds = modalRows[i].querySelectorAll("td");
      tds[1].textContent = finalQty || "-";
      tds[2].textContent = finalNominalVarian ? finalNominalVarian.toLocaleString("id-ID") : "-";
    }
  });

  const totalAssetRow = totalCard.querySelectorAll(".rekap-dist-card-body > div")[2]?.querySelector("tbody tr td:last-child");
  if (totalAssetRow) {
    totalAssetRow.textContent = grandTotal ? grandTotal.toLocaleString("id-ID") : "-";
  }
}
async function updateAssetsExtraJumlah(cardEl, cardId, varianList) {
  const cardData = assetsExtraCards.find(c => c.id === cardId);
  const jumlahQty = varianList.reduce((a, v) => a + (cardData.qty[v] || 0), 0);
  cardEl.querySelector(".assets-extra-jumlah-qty").textContent = jumlahQty || "-";

  let jumlahNominal = 0;
  if (cardData.uid) {
    const userData = (window.usersCache || []).find(u => u.uid === cardData.uid);
    varianList.forEach(v => {
      const varianObj = (userData?.varian || []).find(o => Object.keys(o)[0] === v);
      const harga = Number(varianObj?.[v]?.hargaProduksi) || 0;
      jumlahNominal += (cardData.qty[v] || 0) * harga;
    });
  }
  cardEl.querySelector(".assets-extra-jumlah-nominal").textContent = jumlahNominal ? jumlahNominal.toLocaleString("id-ID") : "-";
}
async function cekAssetsSudahDisimpan() {
  const badge = document.getElementById("assetsSavedBadge");
  if (!badge) return;
  try {
    const adminUid = window.auth?.currentUser?.uid;
    const periode  = `${rekapDistTahun}-${String(rekapDistBulan + 1).padStart(2, "0")}`;
    const snap = await window.getDoc(window.doc(window.db, "users", adminUid, "assets", periode));
    badge.style.display = snap.exists() ? "flex" : "none";
  } catch (err) {
    console.error("❌ cekAssetsSudahDisimpan:", err);
  }
}
async function simpanAssetsSnapshot(perKurirData, totalData) {
  const btn = document.getElementById("assetsSaveBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Menyimpan..."; }

  try {
    const adminUid = window.auth?.currentUser?.uid;
    const periode  = `${rekapDistTahun}-${String(rekapDistBulan + 1).padStart(2, "0")}`;

    await window.setDoc(
      window.doc(window.db, "users", adminUid, "assets", periode),
      {
        periode,
        perKurir: perKurirData,
        totalJumlahCustomer: totalData.totalJumlahCustomer,
        totalNominalCustomer: totalData.totalNominalCustomer,
        totalModalQty: totalData.totalModalQty,
        totalModalNominal: totalData.totalModalNominal,
        grandTotal: totalData.grandTotalNominal,
        savedAt: window.serverTimestamp(),
      }
    );

    window.showToast("Assets berhasil disimpan", "success");
    document.getElementById("assetsSavedBadge").style.display = "flex";
    await loadAssetsHistory();
  } catch (err) {
    console.error("❌ simpanAssetsSnapshot:", err);
    window.showToast("Gagal menyimpan assets", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan`; }
  }
}
let assetsHistoryData = [];
let assetsHistoryMode = "tabel";
let assetsHistoryChartInstance = null;

async function loadAssetsHistory() {
  const bodyEl = document.getElementById("assetsHistoryBody");
  if (!bodyEl) return;
  bodyEl.innerHTML = `<div class="dh-ringkasan-empty">Memuat...</div>`;

  try {
    const adminUid = window.auth?.currentUser?.uid;
    const snap = await window.getDocs(window.collection(window.db, "users", adminUid, "assets"));
    assetsHistoryData = snap.docs.map(d => d.data()).sort((a, b) => a.periode.localeCompare(b.periode));

    if (!assetsHistoryData.length) {
      bodyEl.innerHTML = `<div class="dh-ringkasan-empty">Belum ada data tersimpan</div>`;
      return;
    }

    renderAssetsHistoryView();
  } catch (err) {
    console.error("❌ loadAssetsHistory:", err);
    bodyEl.innerHTML = `<div class="dh-ringkasan-empty">Gagal memuat histori</div>`;
  }
}

function renderAssetsHistoryView() {
  const bodyEl = document.getElementById("assetsHistoryBody");
  if (!bodyEl) return;

  if (assetsHistoryMode === "tabel") {
    if (assetsHistoryChartInstance) { assetsHistoryChartInstance.destroy(); assetsHistoryChartInstance = null; }

    const rows = assetsHistoryData.map(d => `
      <tr><td>${d.periode}</td><td>-</td><td>${d.grandTotal ? d.grandTotal.toLocaleString("id-ID") : "-"}</td></tr>
    `).join("");

    bodyEl.innerHTML = `
      <table class="rekap-dist-table">
        <thead><tr><th>Periode</th><th>Qty</th><th>Grand Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  } else {
    if (assetsHistoryData.length < 2) {
      bodyEl.innerHTML = `<div class="dh-ringkasan-empty">Simpan minimal 2 periode untuk melihat trend grafik</div>`;
      return;
    }
    bodyEl.innerHTML = `<canvas id="assetsHistoryChart"></canvas>`;
    const canvas = document.getElementById("assetsHistoryChart");
    if (!canvas || !window.Chart) return;

    assetsHistoryChartInstance = new Chart(canvas, {
      type: "line",
      data: {
        labels: assetsHistoryData.map(d => d.periode),
        datasets: [{
          label: "Grand Total Assets",
          data: assetsHistoryData.map(d => d.grandTotal || 0),
          borderColor: "#b05c00",
          backgroundColor: "rgba(176,92,0,0.15)",
          fill: true,
          tension: 0.3,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }
}

function initAssetsHistoryToggle() {
  document.querySelectorAll(".rekap-dist-mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".rekap-dist-mode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      assetsHistoryMode = btn.dataset.mode;
      renderAssetsHistoryView();
    });
  });
}
function escAssets(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
window.syncAssetsFilterLabel = syncAssetsFilterLabel;