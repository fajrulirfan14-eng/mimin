/* ── TABEL DISTRIBUSI (file terpisah, self-contained) ── */
function escLapTabel(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function getLapTanggalLocalTabel() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}
function formatTanggalLokalTabel(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

async function initLapTabel() {
  // isi dropdown kurir
  const list     = document.getElementById("lapTabelDropdownList");
  const trigger  = document.getElementById("lapTabelDropdownTrigger");
  const label    = document.getElementById("lapTabelDropdownLabel");
  const hidden   = document.getElementById("lapTabelFilterKurir");
  const dropdown = document.getElementById("lapTabelDropdown");

  if (list && list.children.length === 0) {
    let users = (window.usersCache || []).filter(u => ["kurir","sales","hunter"].includes(u.role));
    if (!users.length) {
      try {
        const idCabang = window.currentUser?.idCabang || "";
        const adminUid = window.auth?.currentUser?.uid;
        const snap = await window.getDocs(window.query(
          window.collection(window.db, "users"),
          window.where("idCabang", "==", idCabang),
          window.where("createdBy", "==", adminUid)
        ));
        const all = snap.docs.map(d => ({ ...d.data(), uid: d.id }));
        users = all.filter(u => ["kurir","sales","hunter"].includes(u.role));
      } catch (err) {}
    }

    if (!users.length) {
      list.innerHTML = `<div class="lap-tabel-dropdown-item-empty">Belum ada kurir</div>`;
    } else {
      list.innerHTML = users.map(u => `
        <div class="lap-tabel-dropdown-item" data-uid="${escLapTabel(u.uid)}" data-nama="${escLapTabel(u.nama || 'Tanpa Nama')}">
          ${escLapTabel(u.nama || 'Tanpa Nama')}
        </div>`).join("");

      list.querySelectorAll(".lap-tabel-dropdown-item").forEach(item => {
        item.addEventListener("click", () => {
          list.querySelectorAll(".lap-tabel-dropdown-item").forEach(x => x.classList.remove("active"));
          item.classList.add("active");
          if (label) label.textContent = item.dataset.nama;
          if (hidden) hidden.value = item.dataset.uid;
          dropdown?.classList.remove("open");
          renderLapTabel();
        });
      });
    }

    trigger?.addEventListener("click", e => { e.stopPropagation(); dropdown?.classList.toggle("open"); });
    document.addEventListener("click", e => {
      if (!dropdown?.contains(e.target)) dropdown?.classList.remove("open");
    });
  }

  // default tanggal
  const today = getLapTanggalLocalTabel();
  const from  = document.getElementById("lapTabelDateFrom");
  const to    = document.getElementById("lapTabelDateTo");
  if (from && !from.value) {
    const d = new Date(today + "T00:00:00");
    d.setDate(1);
    from.value = formatTanggalLokalTabel(d);
  }
  if (to && !to.value) to.value = today;
  document.getElementById("lapTabelExportPng")?.addEventListener("click", () => {
    const nama = document.getElementById("lapTabelDropdownLabel")?.textContent || "kurir";
    window.exportTabelPNG("lapTabelScroll", `tabel_distribusi_${nama}`);
  });
  document.getElementById("lapTabelExportCsv")?.addEventListener("click", () => {
    const nama = document.getElementById("lapTabelDropdownLabel")?.textContent || "kurir";
    window.exportTabelCSV("lapTabelScroll", `tabel_distribusi_${nama}`);
  });
  document.getElementById("lapTabelClose")?.addEventListener("click", () => {
    document.getElementById("lapTabelWrapper")?.classList.remove("show");
    const bottomNav = document.getElementById("bottomNav");
    if (bottomNav) bottomNav.style.display = "";
  });

  document.getElementById("lapTabelDateFrom")?.addEventListener("change", renderLapTabel);
  document.getElementById("lapTabelDateTo")?.addEventListener("change", renderLapTabel);
}

async function renderLapTabel() {
  const scroll = document.getElementById("lapTabelScroll");
  if (!scroll) return;
  scroll.innerHTML = `<div class="dh-ringkasan-empty">Memuat...</div>`;

  const filterUid = document.getElementById("lapTabelFilterKurir")?.value || "";
  const dateFrom  = document.getElementById("lapTabelDateFrom")?.value || "";
  const dateTo    = document.getElementById("lapTabelDateTo")?.value   || "";

  if (!filterUid) { scroll.innerHTML = `<div class="dh-ringkasan-empty">Pilih kurir terlebih dahulu</div>`; return; }
  if (!dateFrom || !dateTo) { scroll.innerHTML = `<div class="dh-ringkasan-empty">Pilih tanggal terlebih dahulu</div>`; return; }

  const user = (window.usersCache || []).find(u => u.uid === filterUid);
  if (!user) return;

  const varian = (user.varian || [])
    .filter(v => { const k = Object.keys(v)[0]; return k && v[k]?.isAktif; })
    .map(v => Object.keys(v)[0]);
  const V = varian.length ? varian : ["CB","BB","BK","MC"];

  const tanggalList = [];
  let cur = new Date(dateFrom + "T00:00:00");
  const end = new Date(dateTo + "T00:00:00");
  while (cur <= end) { tanggalList.push(formatTanggalLokalTabel(cur)); cur.setDate(cur.getDate() + 1); }

  const hariNama = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

  const COLS = [
    { key: "closing", label: "Closing", cls: "closing", hasJml: true },
    { key: "pay",     label: "Pay",     cls: "pay",     hasJml: true },
    { key: "expired", label: "Expired", cls: "expired", hasJml: true, hasPersen: true },
  ];

  const hargaMapTbl = {};
  (user?.varian || []).forEach(v => { const k = Object.keys(v)[0]; if (k) hargaMapTbl[k] = Number(v[k]?.hargaProduksi) || 0; });

  const CUST_COLS = ["Lama","Tambahan","Baru","Jumlah","Kunjungan","Tgt Data","Tgt Cust"];
  const KEU_COLS  = ["Omset","Input Omset","Bonus","Klaim Insentif","Kasbon"];
  const PAY_COLS  = ["Tagihan","Bayar","Keterangan"];

  const th1 = `<tr>
    <th rowspan="2" style="position:sticky;left:0;z-index:5;background:var(--bg-card);min-width:120px;text-align:left;padding:7px 10px">Tanggal</th>
    ${COLS.map(c => { let span = V.length; if (c.hasJml) span++; if (c.hasPersen) span++; return `<th colspan="${span}" class="lap-dist-th-${c.cls}">${c.label}</th>`; }).join("")}
    <th colspan="${CUST_COLS.length}" class="lap-dist-th-customer">Customer</th>
    <th colspan="${KEU_COLS.length}"  class="lap-dist-th-keuangan">Keuangan</th>
    <th colspan="${PAY_COLS.length}"  class="lap-dist-th-closing">Pembayaran</th>
  </tr>`;
  const th2 = `<tr>
    ${COLS.map(c => {
      const vCols  = V.map(v => `<th class="lap-dist-th-${c.cls}" style="top:31px">${v}</th>`).join("");
      const jml    = c.hasJml    ? `<th class="lap-dist-th-${c.cls}" style="top:31px">JML</th>` : "";
      const persen = c.hasPersen ? `<th class="lap-dist-th-${c.cls}" style="top:31px">%</th>`   : "";
      return vCols + jml + persen;
    }).join("")}
    ${CUST_COLS.map(c => `<th class="lap-dist-th-customer" style="top:31px">${c}</th>`).join("")}
    ${KEU_COLS.map(c  => `<th class="lap-dist-th-keuangan" style="top:31px">${c}</th>`).join("")}
    ${PAY_COLS.map(c  => `<th class="lap-dist-th-closing"  style="top:31px">${c}</th>`).join("")}
  </tr>`;

  const mkSums = () => { const s = {}; COLS.forEach(c => { s[c.key] = {}; V.forEach(v => { s[c.key][v] = 0; }); }); return s; };
  const mkCust = () => ({ Lama:0, Tambahan:0, Baru:0, Jumlah:0, Kunjungan:0 });
  const mkKeu  = () => ({ Omset:0, InputOmset:0, Bonus:0, KlaimInsentif:0, Kasbon:0 });
  const mkPay  = () => ({ Tagihan:0, Bayar:0, Keterangan:0 });

  const grandSums = mkSums(), grandCust = mkCust(), grandKeu = mkKeu(), grandPay = mkPay();
  let   weekSums  = mkSums(), weekCust  = mkCust(), weekKeu  = mkKeu(), weekPay  = mkPay();
  let weekStart = null;

  const resetWeek = () => { weekSums = mkSums(); weekCust = mkCust(); weekKeu = mkKeu(); weekPay = mkPay(); };

  const getSrcForCol = (doc, key) => {
    if (key === "closing") return doc?.pembayaran?.closing || {};
    if (key === "pay")     return doc?.distribusi?.pay     || {};
    if (key === "expired") return doc?.distribusi?.expired || {};
    return {};
  };

  const buildSumRow = (sums, cust, keu, pay, label, cls = "lap-dist-tr-total") => {
    const sumCells = COLS.map(c => {
      const vCells = V.map(v => `<td class="lap-dist-col-${c.cls} lap-dist-td-sum">${sums[c.key]?.[v] || ""}</td>`).join("");
      const jmlVal = V.reduce((acc, v) => acc + (sums[c.key]?.[v] || 0), 0);
      const jml    = c.hasJml ? `<td class="lap-dist-col-${c.cls} lap-dist-td-sum">${jmlVal || ""}</td>` : "";
      if (c.hasPersen) {
        const sumPay = V.reduce((acc, v) => acc + (sums["pay"]?.[v] || 0), 0);
        const pct    = sumPay > 0 ? Math.round(jmlVal / sumPay * 100) : 0;
        return vCells + jml + `<td class="lap-dist-col-${c.cls} lap-dist-td-sum">${pct ? pct+"%" : ""}</td>`;
      }
      return vCells + jml;
    }).join("");
    return `<tr class="${cls}">
      <td class="lap-dist-td-sum" style="position:sticky;left:0;background:var(--bg-card);text-align:left;padding:6px 10px;white-space:nowrap;font-size:11px">${label}</td>
      ${sumCells}
      <td class="lap-dist-col-customer lap-dist-td-sum">${cust.Lama||""}</td>
      <td class="lap-dist-col-customer lap-dist-td-sum">${cust.Tambahan||""}</td>
      <td class="lap-dist-col-customer lap-dist-td-sum">${cust.Baru||""}</td>
      <td class="lap-dist-col-customer lap-dist-td-sum">${cust.Jumlah||""}</td>
      <td class="lap-dist-col-customer lap-dist-td-sum">${cust.Kunjungan||""}</td>
      <td class="lap-dist-col-customer lap-dist-td-sum"></td>
      <td class="lap-dist-col-customer lap-dist-td-sum"></td>
      <td class="lap-dist-col-keuangan lap-dist-td-sum">${keu.Omset         ? keu.Omset.toLocaleString("id-ID")         : ""}</td>
      <td class="lap-dist-col-keuangan lap-dist-td-sum">${keu.InputOmset    ? keu.InputOmset.toLocaleString("id-ID")    : ""}</td>
      <td class="lap-dist-col-keuangan lap-dist-td-sum">${keu.Bonus         ? keu.Bonus.toLocaleString("id-ID")         : ""}</td>
      <td class="lap-dist-col-keuangan lap-dist-td-sum">${keu.KlaimInsentif ? keu.KlaimInsentif.toLocaleString("id-ID") : ""}</td>
      <td class="lap-dist-col-keuangan lap-dist-td-sum">${keu.Kasbon        ? keu.Kasbon.toLocaleString("id-ID")        : ""}</td>
      <td class="lap-dist-col-closing  lap-dist-td-sum">${pay.Tagihan    ? pay.Tagihan.toLocaleString("id-ID")    : ""}</td>
      <td class="lap-dist-col-closing  lap-dist-td-sum">${pay.Bayar      ? pay.Bayar.toLocaleString("id-ID")      : ""}</td>
      <td class="lap-dist-col-closing  lap-dist-td-sum" style="${pay.Keterangan < 0 ? 'color:#d05050' : pay.Keterangan > 0 ? 'color:#7040c0' : ''}">${
        pay.Keterangan === 0 ? "Lunas"
        : pay.Keterangan < 0 ? `Kurang ${Math.abs(pay.Keterangan).toLocaleString("id-ID")}`
        : `Lebih ${pay.Keterangan.toLocaleString("id-ID")}`
      }</td>
    </tr>`;
  };

  // prefetch laporanMarketing semua tanggal — 1 query per tanggal, berlaku semua role
  const laporanMap = {};
  await Promise.all(tanggalList.map(async tgl => {
    try {
      const snap = await window.getDoc(window.doc(window.db, "users", user.uid, "laporanMarketing", tgl));
      if (snap.exists()) laporanMap[tgl] = snap.data();
    } catch (err) {}
  }));

  let tbodyHtml = "";

  for (const tgl of tanggalList) {
    const dayOfWeek = new Date(tgl + "T00:00:00").getDay();
    const hari      = hariNama[dayOfWeek];
    const label     = `${hari}, ${tgl}`;

    const data = laporanMap[tgl] || null;

    const cells = COLS.map(c => {
      const src    = getSrcForCol(data, c.key);
      const vCells = V.map(v => {
        const val = Number(src[v] || 0);
        grandSums[c.key][v] = (grandSums[c.key][v] || 0) + val;
        weekSums[c.key][v]  = (weekSums[c.key][v]  || 0) + val;
        return `<td class="lap-dist-col-${c.cls}">${val || ""}</td>`;
      }).join("");
      const jmlVal = V.reduce((acc, v) => acc + (Number(src[v] || 0)), 0);
      const jml    = c.hasJml ? `<td class="lap-dist-col-${c.cls}" style="font-weight:700">${jmlVal || ""}</td>` : "";
      if (c.hasPersen) {
        const paySrc = getSrcForCol(data, "pay");
        const sumPay = V.reduce((acc, v) => acc + (Number(paySrc[v] || 0)), 0);
        const pct    = sumPay > 0 ? Math.round(jmlVal / sumPay * 100) : 0;
        return vCells + jml + `<td class="lap-dist-col-${c.cls}" style="font-weight:700">${pct ? pct+"%" : ""}</td>`;
      }
      return vCells + jml;
    }).join("");

    const infoTarget = data?.distribusi?.infoTarget || {};
    const cl         = infoTarget.customerLama     || 0;
    const ct         = infoTarget.customerTambahan || 0;
    const cn         = infoTarget.customerNew      || 0;
    const jml        = infoTarget.jumlahCustomer   ?? (cl + ct + cn);
    const kun        = infoTarget.kunjungan        || 0;
    const tgtData    = infoTarget.targetData     ?? "";
    const tgtCust    = infoTarget.targetCustomer ?? "";
    const omset         = data?.distribusi?.keuangan?.omset         || 0;
    const inputOmset    = data?.distribusi?.keuangan?.inputOmset    || 0;
    const bonus         = data?.distribusi?.keuangan?.bonus?.jumlahBonus || 0;
    const klaimInsentif = data?.distribusi?.keuangan?.klaimInsentif || 0;
    const kasbon         = data?.distribusi?.keuangan?.kasbon        || 0;
    const closingRow = data?.pembayaran?.closing || {};
    const tagihan    = Object.entries(closingRow).reduce((acc, [k, v]) => acc + (Number(v)||0) * (hargaMapTbl[k]||0), 0);
    const nota       = data?.pembayaran?.nota || {};
    const bayar      = nota?.bayar || 0;
    const ket        = nota?.keterangan || 0;
    const status     = nota?.status || "";
    let ketHtml = "", ketCls = "";
    if      (status.toLowerCase() === "lunas")  { ketHtml = "Lunas";                                          ketCls = "color:#3a9a62;font-weight:700"; }
    else if (status.toLowerCase() === "kurang") { ketHtml = `Kurang ${Math.abs(ket).toLocaleString("id-ID")}`; ketCls = "color:#d05050;font-weight:700"; }
    else if (status.toLowerCase() === "lebih")  { ketHtml = `Lebih ${ket.toLocaleString("id-ID")}`;            ketCls = "color:#7040c0;font-weight:700"; }

    grandCust.Lama += cl; grandCust.Tambahan += ct; grandCust.Baru += cn;
    grandCust.Jumlah += jml; grandCust.Kunjungan += kun;
    grandKeu.Omset += omset; grandKeu.InputOmset += inputOmset;
    grandKeu.Bonus += bonus; grandKeu.KlaimInsentif += klaimInsentif;
    grandKeu.Kasbon += kasbon;
    grandPay.Tagihan += tagihan; grandPay.Bayar += bayar; grandPay.Keterangan += ket;

    weekCust.Lama += cl; weekCust.Tambahan += ct; weekCust.Baru += cn;
    weekCust.Jumlah += jml; weekCust.Kunjungan += kun;
    weekKeu.Omset += omset; weekKeu.InputOmset += inputOmset;
    weekKeu.Bonus += bonus; weekKeu.KlaimInsentif += klaimInsentif;
    weekKeu.Kasbon += kasbon;
    weekPay.Tagihan += tagihan; weekPay.Bayar += bayar; weekPay.Keterangan += ket;

    if (dayOfWeek === 1) weekStart = tgl;

    const omsetCls = inputOmset === 0 ? "" : inputOmset === omset ? "color:#3a9a62" : "color:#d05050";

    tbodyHtml += `<tr>
      <td style="position:sticky;left:0;background:var(--bg-card);font-size:11px;font-weight:600;white-space:nowrap;padding:6px 10px;border:1px solid var(--border-card)">${escLapTabel(label)}</td>
      ${cells}
      <td class="lap-dist-col-customer">${cl||""}</td>
      <td class="lap-dist-col-customer">${ct||""}</td>
      <td class="lap-dist-col-customer">${cn||""}</td>
      <td class="lap-dist-col-customer">${jml||""}</td>
      <td class="lap-dist-col-customer">${kun||""}</td>
      <td class="lap-dist-col-customer">${tgtData !== "" ? tgtData : ""}</td>
      <td class="lap-dist-col-customer">${tgtCust !== "" ? tgtCust : ""}</td>
      <td class="lap-dist-col-keuangan">${omset      ? omset.toLocaleString("id-ID")      : ""}</td>
      <td class="lap-dist-col-keuangan" style="${omsetCls}">${inputOmset ? inputOmset.toLocaleString("id-ID") : ""}</td>
      <td class="lap-dist-col-keuangan">${bonus         ? Number(bonus).toLocaleString("id-ID")         : ""}</td>
      <td class="lap-dist-col-keuangan">${klaimInsentif ? Number(klaimInsentif).toLocaleString("id-ID") : ""}</td>
      <td class="lap-dist-col-keuangan">${kasbon        ? Number(kasbon).toLocaleString("id-ID")        : ""}</td>
      <td class="lap-dist-col-closing">${tagihan     ? tagihan.toLocaleString("id-ID")  : ""}</td>
      <td class="lap-dist-col-closing">${bayar       ? bayar.toLocaleString("id-ID")    : ""}</td>
      <td class="lap-dist-col-closing" style="${ketCls}">${ketHtml}</td>
    </tr>`;

    if (dayOfWeek === 0 && weekStart) {
      tbodyHtml += buildSumRow(weekSums, weekCust, weekKeu, weekPay, "Total Minggu", "lap-dist-tr-week");
      resetWeek();
      weekStart = null;
    }
  }

  const lastDay = new Date(tanggalList[tanggalList.length - 1] + "T00:00:00").getDay();
  if (lastDay !== 0 && weekStart) {
    tbodyHtml += buildSumRow(weekSums, weekCust, weekKeu, weekPay, "Total Minggu", "lap-dist-tr-week");
  }

  const grandRow = buildSumRow(grandSums, grandCust, grandKeu, grandPay, "Grand Total", "lap-dist-tr-total");

  scroll.innerHTML = `
    <table class="lap-dist-table">
      <thead>${th1}${th2}</thead>
      <tbody>${tbodyHtml}${grandRow}</tbody>
    </table>`;
}

window.initLapTabel  = initLapTabel;
window.renderLapTabel = renderLapTabel;