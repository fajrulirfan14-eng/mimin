/* ── TRIKOTOMI ── */
const TRI_DEFAULT = {
  produktif:    { return: { min:0, max:1    }, expired: { min:0, max:0    } },
  stabil:       { return: { min:2, max:2    }, expired: { min:0, max:1    } },
  nonProduktif: { return: { min:3, max:9999 }, expired: { min:2, max:9999 } }
};

function triInRange(val, min, max) { return val >= min && val <= max; }

function triKlasifikasi(returnTotal, expiredTotal, tri) {
  function getK(val, field) {
    if (triInRange(val, tri.produktif[field].min,    tri.produktif[field].max))    return 1;
    if (triInRange(val, tri.stabil[field].min,       tri.stabil[field].max))       return 2;
    if (triInRange(val, tri.nonProduktif[field].min, tri.nonProduktif[field].max)) return 3;
    return 0;
  }
  const worst = Math.max(getK(returnTotal, "return"), getK(expiredTotal, "expired"));
  return worst === 3 ? "red" : worst === 2 ? "yellow" : worst === 1 ? "green" : "grey";
}

async function loadTrikotomiSetting() {
  try {
    const idCabang = window.currentUser?.idCabang || "";
    if (!idCabang) return TRI_DEFAULT;
    const snap = await window.getDoc(window.doc(window.db, "kantorCabang", idCabang));
    const tri = snap.exists() ? (snap.data()?.trikotomi || null) : null;
    return tri ? { ...TRI_DEFAULT, ...tri } : TRI_DEFAULT;
  } catch (err) {
    return TRI_DEFAULT;
  }
}

window.dsmAnalisaPeriode = 1;
window.dsmAnalisaFilter  = "default";
window.dsmAnalisaSearchQuery = "";

// ambil `count` minggu mundur dari mingguKeStart, nyambung ke bulan sebelumnya kalau perlu
function getDsmReferenceDates(hari, bulan, tahun, mingguKeStart, count) {
  const result = [];
  let curBulan = bulan, curTahun = tahun;
  let list = window._dsmHitungMinggu(hari, curBulan, curTahun);
  let idx  = mingguKeStart - 1;
  let guard = 0; // batas aman biar gak infinite loop

  while (result.length < count && guard < 120) {
    guard++;
    if (idx >= 0 && idx < list.length) {
      result.push(list[idx]);
      idx--;
    } else {
      curBulan--;
      if (curBulan < 0) { curBulan = 11; curTahun--; }
      list = window._dsmHitungMinggu(hari, curBulan, curTahun);
      idx = list.length - 1;
      if (!list.length) break;
    }
  }
  return result; // urutan: paling baru duluan
}

window.renderDsmAnalisa = async function renderDsmAnalisa() {
  const groupEl = document.getElementById("dsmAnalisaGroups");
  if (!groupEl) return;

  const state = window._dsmGetState();
  const { dsmSelectedKurir, dsmSelectedHari, dsmSelectedBulan, dsmSelectedTahun, dsmMingguKe, dsmCustomers } = state;

  if (!dsmSelectedKurir) {
    groupEl.innerHTML = `<div class="dh-ringkasan-empty">Pilih kurir dulu</div>`;
    return;
  }

  groupEl.innerHTML = `<div class="dh-ringkasan-empty">Memuat analisa...</div>`;

  const tri = await loadTrikotomiSetting();

  // ambil N tanggal referensi mundur dari minggu yang lagi dibuka,
  // otomatis nyambung ke bulan-bulan sebelumnya kalau kehabisan minggu di bulan aktif
  const refDates = getDsmReferenceDates(dsmSelectedHari, dsmSelectedBulan, dsmSelectedTahun, dsmMingguKe, window.dsmAnalisaPeriode);

  if (!refDates.length) {
    groupEl.innerHTML = `<div class="dh-ringkasan-empty">Tidak ada data</div>`;
    document.getElementById("dsmAnalisaGreen").textContent  = "0";
    document.getElementById("dsmAnalisaYellow").textContent = "0";
    document.getElementById("dsmAnalisaRed").textContent    = "0";
    document.getElementById("dsmAnalisaGrey").textContent   = String(dsmCustomers.length);
    return;
  }

  const refMaps = [];
  for (const d of refDates) {
    const tStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const data = await window._dsmGetDataCached(dsmSelectedKurir, tStr);
    refMaps.push(data?.customers || {});
  }

  const result = dsmCustomers.map(c => {
    const docs = refMaps.map(m => m[c.id]).filter(Boolean);

    let retTotal = 0, expTotal = 0, statusKet = "";
    if (docs.length) {
      if (window.dsmAnalisaPeriode === 1) {
        const dh = docs[0];
        retTotal = Object.values(dh.return  || {}).reduce((a,v) => a+(Number(v)||0), 0);
        expTotal = Object.values(dh.expired || {}).reduce((a,v) => a+(Number(v)||0), 0);
        statusKet = dh.keterangan?.status?.toLowerCase() || "";
      } else {
        const sums = docs.map(dh => ({
          r: Object.values(dh.return  || {}).reduce((a,v) => a+(Number(v)||0), 0),
          e: Object.values(dh.expired || {}).reduce((a,v) => a+(Number(v)||0), 0),
        }));
        retTotal = Math.round(sums.reduce((a,s) => a+s.r, 0) / docs.length);
        expTotal = Math.round(sums.reduce((a,s) => a+s.e, 0) / docs.length);
        statusKet = docs[docs.length-1].keterangan?.status?.toLowerCase() || "";
      }
    }

    // hitung berapa hari dalam periode ini berstatus tutup / pending / putus
    const tutupCount   = docs.filter(dh => (dh.keterangan?.status?.toLowerCase() || "") === "tutup").length;
    const pendingCount = docs.filter(dh => (dh.keterangan?.status?.toLowerCase() || "") === "pending").length;
    const putusCount   = docs.filter(dh => (dh.keterangan?.status?.toLowerCase() || "") === "putus").length;
    const combinedTutupPending = tutupCount + pendingCount;

    let status = docs.length ? triKlasifikasi(retTotal, expTotal, tri) : "grey";
    if (combinedTutupPending >= 3) {
      status = "red";
    } else if (combinedTutupPending >= 1 && status !== "red") {
      status = "yellow";
    }
    if (putusCount >= 1) {
      status = "red";
    }

    return { nama: c.namaCustomer || "-", status, retTotal, expTotal, tutupCount, pendingCount, putusCount, statusKet, catatan: c.catatanAnalisa || "", hasData: docs.length > 0 };
  });

  let filteredResult = result;
  if (window.dsmAnalisaFilter === "return")  filteredResult = result.filter(c => c.retTotal > 0);
  if (window.dsmAnalisaFilter === "expired") filteredResult = result.filter(c => c.expTotal > 0);
  if (window.dsmAnalisaFilter === "tutup")   filteredResult = result.filter(c => c.statusKet === "tutup");
  if (window.dsmAnalisaFilter === "pending") filteredResult = result.filter(c => c.statusKet === "pending");
  if (window.dsmAnalisaFilter === "putus")   filteredResult = result.filter(c => c.putusCount > 0);

  if (window.dsmAnalisaFilter === "catatan") filteredResult = result.filter(c => !!c.catatan);

  const searchQ = (window.dsmAnalisaSearchQuery || "").toLowerCase().trim();
  if (searchQ) filteredResult = filteredResult.filter(c => c.nama.toLowerCase().includes(searchQ));

  const green  = filteredResult.filter(x => x.status === "green");
  const yellow = filteredResult.filter(x => x.status === "yellow");
  const red    = filteredResult.filter(x => x.status === "red");
  const grey   = filteredResult.filter(x => x.status === "grey");

  document.getElementById("dsmAnalisaGreen").textContent  = green.length;
  document.getElementById("dsmAnalisaYellow").textContent = yellow.length;
  document.getElementById("dsmAnalisaRed").textContent    = red.length;
  document.getElementById("dsmAnalisaGrey").textContent   = grey.length;

  const refLabel = refDates.map(d => d.toLocaleDateString("id-ID", { day:"numeric", month:"short" })).join(" & ");
  document.getElementById("dsmAnalisaSubtitle").textContent =
    `${document.getElementById("dsmKurirLabel")?.textContent || "-"} · Referensi: ${refLabel}`;

  const statusColor = { green: "#3a9a62", yellow: "#f5a623", red: "#d05050", grey: "#787878" };
  const statusLabel = { green: "Produktif", yellow: "Stabil", red: "Non Produktif", grey: "Belum Ada Data" };

  if (!filteredResult.length) {
    groupEl.innerHTML = `<div class="dh-ringkasan-empty">Tidak ada customer</div>`;
    return;
  }

  const renderColumn = (items, status) => `
    <div class="dsm-analisa-col dsm-analisa-col-${status}">
      <div class="dsm-analisa-col-header" style="color:${statusColor[status]}">
        ${statusLabel[status]} (${items.length})
      </div>
      <div class="dsm-analisa-col-list">
        ${items.length ? items.map(c => `
          <div class="dsm-analisa-item" style="border-left:4px solid ${statusColor[c.status]}">
            <div class="dsm-analisa-item-nama">${escTri(c.nama)}</div>
            <div class="dsm-analisa-item-info">
              ${c.hasData ? `<span class="dsm-analisa-item-detail">
                Return: <b style="color:#b02020">${c.retTotal}</b> ·
                Expired: <b style="color:#c05020">${c.expTotal}</b> ·
                Tutup: <b style="color:#d05050">${c.tutupCount}</b> ·
                Pending: <b style="color:#f5a623">${c.pendingCount}</b> ·
                Putus: <b style="color:#7040c0">${c.putusCount}</b>
              </span>` : `<span class="dsm-analisa-item-detail">Tidak ada data</span>`}
              <button class="dsm-analisa-item-catatan-btn" data-cust-id="${escTri(c.custId)}" data-nama="${escTri(c.nama)}">
                <i class="fa-solid fa-pen"></i>
              </button>
            </div>
            ${c.catatan ? `<div class="dsm-analisa-item-catatan"><i class="fa-solid fa-note-sticky"></i><span class="dsm-analisa-item-catatan-text">${escTri(c.catatan)}</span></div>` : ""}
          </div>`).join("") : `<div class="dsm-analisa-col-empty">Tidak ada</div>`}
      </div>
    </div>`;

  groupEl.innerHTML = `
    <div class="dsm-analisa-grid">
      ${renderColumn(green,  "green")}
      ${renderColumn(yellow, "yellow")}
      ${renderColumn(red,    "red")}
      ${renderColumn(grey,   "grey")}
    </div>`;

  groupEl.querySelectorAll(".dsm-analisa-item-catatan-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      showDsmCatatanPopup(btn.dataset.custId, btn.dataset.nama);
    });
  });
};

function showDsmCatatanPopup(custId, nama) {
  document.getElementById("dsmCatatanOverlay")?.remove();

  const state = window._dsmGetState();
  const customer = (state.dsmCustomers || []).find(c => c.id === custId);
  const existingText = customer?.catatanAnalisa || "";

  const el = document.createElement("div");
  el.id = "dsmCatatanOverlay";
  el.className = "dsm-foto-overlay";
  el.innerHTML = `
    <div class="dsm-foto-box">
      <div class="dsm-foto-title">Catatan — ${escTri(nama)}</div>
      <textarea id="dsmCatatanInput" class="dsm-catatan-textarea" rows="3" maxlength="50" placeholder="Tulis catatan untuk customer ini...">${escTri(existingText)}</textarea>
      <div class="dsm-catatan-counter" id="dsmCatatanCounter">${existingText.length}/50</div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="dsm-foto-close" id="dsmCatatanCancelBtn" style="background:var(--bg-hover);color:var(--text-muted)">Batal</button>
        <button class="dsm-foto-close" id="dsmCatatanSaveBtn">Simpan</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById("dsmCatatanCancelBtn").onclick = () => el.remove();
  el.onclick = e => { if (e.target === el) el.remove(); };

  document.getElementById("dsmCatatanInput").addEventListener("input", e => {
    document.getElementById("dsmCatatanCounter").textContent = `${e.target.value.length}/50`;
  });
  document.getElementById("dsmCatatanSaveBtn").onclick = async () => {
    const btn = document.getElementById("dsmCatatanSaveBtn");
    const text = document.getElementById("dsmCatatanInput").value.trim();
    btn.disabled = true;
    btn.textContent = "Menyimpan...";
    try {
      const adminUid = window.auth?.currentUser?.uid;
      await window.setDoc(
        window.doc(window.db, "customer", custId),
        { catatanAnalisa: text, catatanUpdatedAt: window.serverTimestamp(), catatanUpdatedBy: adminUid },
        { merge: true }
      );
      // update data lokal biar langsung kelihatan tanpa reload
      if (customer) customer.catatanAnalisa = text;
      window.showToast("Catatan disimpan", "success");
      el.remove();
      window.renderDsmAnalisa?.();
    } catch (err) {
      window.showToast("Gagal menyimpan catatan", "error");
      btn.disabled = false;
      btn.textContent = "Simpan";
    }
  };
}

function showDsmHapusCatatanPopup() {
  document.getElementById("dsmHapusCatatanOverlay")?.remove();

  const state = window._dsmGetState();
  const customers = state.dsmCustomers || [];

  const el = document.createElement("div");
  el.id = "dsmHapusCatatanOverlay";
  el.className = "lap-frozen-overlay";
  el.style.zIndex = "7000";
  el.innerHTML = `
    <div class="lap-frozen-box">
      <div class="lap-frozen-icon">🗑️</div>
      <div class="lap-frozen-title">Hapus Semua Catatan?</div>
      <div class="lap-frozen-desc">Semua catatan analisa untuk kurir ini akan dihapus permanen dan tidak bisa dikembalikan.</div>
      <div class="lap-frozen-footer">
        <button class="lap-frozen-btn-cancel" id="dsmHapusCatatanNo">Batal</button>
        <button class="lap-frozen-btn-save" id="dsmHapusCatatanYes" style="background:linear-gradient(135deg,#d05050,#e07070)">Hapus</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById("dsmHapusCatatanNo").onclick = () => el.remove();
  document.getElementById("dsmHapusCatatanYes").onclick = async () => {
    const btn = document.getElementById("dsmHapusCatatanYes");
    btn.disabled = true;
    btn.textContent = "Menghapus...";
    try {
      const batch = window.writeBatch(window.db);
      customers.forEach(c => {
        const ref = window.doc(window.db, "customer", c.id);
        batch.update(ref, { catatanAnalisa: window.deleteField() });
        c.catatanAnalisa = "";
      });
      await batch.commit();
      window.showToast("Semua catatan berhasil dihapus", "success");
      el.remove();
      window.renderDsmAnalisa?.();
    } catch (err) {
      window.showToast("Gagal menghapus catatan", "error");
      btn.disabled = false;
      btn.textContent = "Hapus";
    }
  };
}
window.showDsmHapusCatatanPopup = showDsmHapusCatatanPopup;

function escTri(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

async function showDsmInfoPopup() {
  document.getElementById("dsmInfoOverlay")?.remove();

  const tri = await loadTrikotomiSetting();
  const rp = tri.produktif.return, ep = tri.produktif.expired;
  const rs = tri.stabil.return,    es = tri.stabil.expired;
  const rn = tri.nonProduktif.return, en = tri.nonProduktif.expired;

  const fmtRange = (min, max) => max >= 9999 ? `${min}+` : (min === max ? `${min}` : `${min}-${max}`);

  const el = document.createElement("div");
  el.id = "dsmInfoOverlay";
  el.className = "dsm-info-overlay";
  el.innerHTML = `
    <div class="dsm-info-box">
      <div class="dsm-info-header">
        <div class="dsm-info-title">Cara Kerja Analisa Trikotomi</div>
        <button class="dsm-info-close" id="dsmInfoCloseBtn"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="dsm-info-body">

        <div class="dsm-info-section">
          <div class="dsm-info-section-icon blue"><i class="fa-solid fa-calculator"></i></div>
          <div class="dsm-info-section-text">
            <div class="dsm-info-section-title">Apa yang dihitung?</div>
            <div class="dsm-info-section-desc">
              Tiap customer dicek 2 angka dalam periode yang dipilih: total <b>Return</b> dan total <b>Expired</b>.
              Sistem melihat kategori masing-masing angka, lalu <b>mengambil yang paling buruk</b> di antara keduanya sebagai hasil akhir.
            </div>
          </div>
        </div>

        <div class="dsm-info-section">
          <div class="dsm-info-section-icon green"><i class="fa-solid fa-circle-check"></i></div>
          <div class="dsm-info-section-text">
            <div class="dsm-info-section-title">🟢 Produktif</div>
            <div class="dsm-info-section-desc">
              Return <b>${fmtRange(rp.min, rp.max)}</b> dan Expired <b>${fmtRange(ep.min, ep.max)}</b>.
              Customer ini jalan lancar, hampir tidak ada barang balik atau kadaluarsa.
            </div>
          </div>
        </div>

        <div class="dsm-info-section">
          <div class="dsm-info-section-icon yellow"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div class="dsm-info-section-text">
            <div class="dsm-info-section-title">🟡 Stabil</div>
            <div class="dsm-info-section-desc">
              Return <b>${fmtRange(rs.min, rs.max)}</b> atau Expired <b>${fmtRange(es.min, es.max)}</b>.
              Masih wajar, tapi perlu dipantau. Customer juga masuk sini kalau statusnya Tutup/Pending
              sebanyak <b>1-2 hari</b> dalam periode ini.
            </div>
          </div>
        </div>

        <div class="dsm-info-section">
          <div class="dsm-info-section-icon red"><i class="fa-solid fa-circle-xmark"></i></div>
          <div class="dsm-info-section-text">
            <div class="dsm-info-section-title">🔴 Non Produktif</div>
            <div class="dsm-info-section-desc">
              Return <b>${fmtRange(rn.min, rn.max)}</b> atau Expired <b>${fmtRange(en.min, en.max)}</b>.
              Banyak barang balik/kadaluarsa, perlu perhatian khusus. Customer juga otomatis masuk sini
              kalau statusnya Tutup/Pending sudah <b>3 hari atau lebih</b> dalam periode ini, atau kalau statusnya
              pernah <b>Putus</b> minimal 1 hari — meski Return/Expired-nya sendiri rendah.
            </div>
          </div>
        </div>

        <div class="dsm-info-section">
          <div class="dsm-info-section-icon grey"><i class="fa-solid fa-circle-question"></i></div>
          <div class="dsm-info-section-text">
            <div class="dsm-info-section-title">⚪ Belum Ada Data</div>
            <div class="dsm-info-section-desc">
              Customer ini belum pernah diinput datanya sama sekali di semua tanggal periode yang dipilih (T-1, T-2, dst).
            </div>
          </div>
        </div>

        <div class="dsm-info-section">
          <div class="dsm-info-section-icon blue"><i class="fa-solid fa-calendar-week"></i></div>
          <div class="dsm-info-section-text">
            <div class="dsm-info-section-title">Soal Periode (T-1, T-2, dst)</div>
            <div class="dsm-info-section-desc">
              T-1 artinya cuma lihat 1 minggu terakhir. T-3 artinya menggabungkan 3 minggu terakhir
              (kalau kurang dari 3 minggu di bulan ini, otomatis nyambung ke bulan sebelumnya).
              Semakin besar periode, semakin akurat gambaran jangka panjangnya.
            </div>
          </div>
        </div>

      </div>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));

  document.getElementById("dsmInfoCloseBtn").onclick = () => el.classList.remove("show");
  el.onclick = e => { if (e.target === el) el.classList.remove("show"); };
}

document.getElementById("dsmAnalisaInfoBtn")?.addEventListener("click", showDsmInfoPopup);
