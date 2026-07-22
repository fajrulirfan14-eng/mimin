let custUsersUnsub = null;

window.initCustomerView = async function() {
  initCustUsersListener();
  loadRollingBadge();
  updateVerifikasiBadge();
  document.getElementById("topbarBackBtn")?.addEventListener("click", () => {
    const rightPanel  = document.getElementById("custRightPanel");
    const middlePanel = document.getElementById("custMiddlePanel");
    const bottomNav   = document.getElementById("bottomNav");
    if (rightPanel?.classList.contains("show")) {
      rightPanel.classList.remove("show");
      if (bottomNav) {
      bottomNav.style.display = "flex";
      requestAnimationFrame(() => { bottomNav.style.transform = ""; });
    }
    } else {
      middlePanel?.classList.remove("show");
      document.getElementById("topbarBackBtn").style.display = "none";
      if (window.innerWidth <= 768) history.pushState({ panel: true }, "", "");
      if (bottomNav) {
      bottomNav.style.display = "flex";
      requestAnimationFrame(() => { bottomNav.style.transform = ""; });
    }
    }
  });

  document.getElementById("custRightBack")?.addEventListener("click", () => {
    document.getElementById("custRightPanel")?.classList.remove("show");
    const bottomNav = document.getElementById("bottomNav");
    if (bottomNav) {
      bottomNav.style.display = "flex";
      requestAnimationFrame(() => { bottomNav.style.transform = ""; });
    }
  });
};

/* ── MARKETING LIST — live listener (bukan IDB) ── */
function initCustUsersListener() {
  const idCabang = window.currentUser?.idCabang || "";
  const adminUid = window.auth?.currentUser?.uid;

  if (custUsersUnsub) { custUsersUnsub(); custUsersUnsub = null; }

  custUsersUnsub = window.onSnapshot(
    window.query(
      window.collection(window.db, "users"),
      window.where("idCabang", "==", idCabang),
      window.where("createdBy", "==", adminUid)
    ),
    snap => {
      window.usersCache = snap.docs.map(d => ({ ...d.data(), uid: d.id }));
      loadCustGroups();
    },
    err => {}
  );
}

// ── ROLLING DRAG ──
let _rollingDragCustomer = null;
let _rollingDragEl       = null;
let _rollingPopupEl      = null;
let _rollingHoverTarget  = null;

async function initRollingDrag(card, customer) {
  let longPressTimer = null;
  let isDragging     = false;
  const startDrag = async (clientX, clientY) => {
    isDragging = true;
    _rollingDragCustomer = customer;

    // buat avatar drag
    const avatar = document.createElement("div");
    avatar.className = "cust-drag-avatar";
    avatar.innerHTML = customer.foto
      ? `<img src="${customer.foto}" alt="">`
      : (customer.namaCustomer||"?").charAt(0).toUpperCase();
    avatar.style.left = clientX + "px";
    avatar.style.top  = clientY + "px";
    document.body.appendChild(avatar);
    _rollingDragEl = avatar;
    setTimeout(() => avatar.classList.add("dragging"), 10);

    // buat popup list target
    await showRollingTargetPopup(clientX, clientY);
  };

  // touch
  card.addEventListener("touchstart", e => {
    if (!document.getElementById("mapRollingWrap")) return;
    const touch = e.touches[0];
    longPressTimer = setTimeout(() => startDrag(touch.clientX, touch.clientY), 500);
  }, { passive: true });
  card.addEventListener("touchmove", e => {
    if (!isDragging) { clearTimeout(longPressTimer); return; }
    e.preventDefault();
    const touch = e.touches[0];
    if (_rollingDragEl) {
      _rollingDragEl.style.left = touch.clientX + "px";
      _rollingDragEl.style.top  = touch.clientY + "px";
    }
    // highlight target di bawah jari
    highlightRollingTarget(touch.clientX, touch.clientY);
  }, { passive: false });

  card.addEventListener("touchend", e => {
    clearTimeout(longPressTimer);
    if (!isDragging) return;
    const touch = e.changedTouches[0];
    dropRolling(touch.clientX, touch.clientY);
    isDragging = false;
  });

  // mouse
  card.addEventListener("mousedown", e => {
    if (!document.getElementById("mapRollingWrap")) return;
    e.preventDefault();
    longPressTimer = setTimeout(() => startDrag(e.clientX, e.clientY), 500);

    const onMouseMove = e => {
      if (!isDragging) { clearTimeout(longPressTimer); return; }
      if (_rollingDragEl) {
        _rollingDragEl.style.left = e.clientX + "px";
        _rollingDragEl.style.top  = e.clientY + "px";
      }
      highlightRollingTarget(e.clientX, e.clientY);
    };
    const onMouseUp = e => {
      clearTimeout(longPressTimer);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      if (!isDragging) return;
      dropRolling(e.clientX, e.clientY);
      isDragging = false;
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}
async function showRollingTargetPopup(x, y) {
  // hapus popup lama
  document.getElementById("custRollingPopup")?.remove();

  const popup = document.createElement("div");
  popup.id = "custRollingPopup";
  popup.className = "cust-rolling-popup";

  // posisi popup — hindari keluar layar
  const popupW = 220;
  const popupH = 300;
  let left = x + 20;
  let top  = y - 50;
  if (left + popupW > window.innerWidth)  left = x - popupW - 10;
  if (top  + popupH > window.innerHeight) top  = window.innerHeight - popupH - 10;
  if (top < 10) top = 10;
  popup.style.left = left + "px";
  popup.style.top  = top  + "px";

  // ambil jumlah customer per kurir/sales sesuai filter hari — langsung Firestore
  const hariFilter    = localStorage.getItem("rollingFilterHari") || "";
  const targets       = (window.usersCache||[]).filter(u => ["kurir","sales"].includes(u.role));
  const idCabangPopup = window.currentUser?.idCabang || "";

  popup.innerHTML = `<div class="cust-rolling-popup-title">Pindah ke</div>`;

  for (const u of targets) {
    const nama    = u.nama || "Tanpa Nama";
    const inisial = nama.trim().charAt(0).toUpperCase();
    const avatar  = u.foto ? `<img src="${esc(u.foto)}" alt="">` : inisial;

    // hitung jumlah customer langsung dari Firestore
    let count = 0;
    try {
      const baseWhere = u.role === "kurir"
        ? [window.where("pemilik", "==", u.uid), window.where("idCabang", "==", idCabangPopup), window.where("status", "==", true)]
        : [window.where("pemilik", "==", u.uid), window.where("idCabang", "==", idCabangPopup), window.where("diserahkan", "==", false)];
      if (hariFilter) baseWhere.push(window.where("hari", "==", hariFilter));
      const collName = u.role === "kurir" ? "customer" : "customerSales";
      const snapCount = await window.getDocs(window.query(window.collection(window.db, collName), ...baseWhere));
      count = snapCount.size;
    } catch (err) {}

    popup.innerHTML += `
      <div class="cust-rolling-target" data-uid="${esc(u.uid)}" data-role="${u.role}">
        <div class="cust-rolling-target-avatar">${avatar}</div>
        <div class="cust-rolling-target-info">
          <div class="cust-rolling-target-nama">${esc(nama)}</div>
          <div class="cust-rolling-target-count">${count} Customer</div>
        </div>
      </div>`;
  }

  document.body.appendChild(popup);
  _rollingPopupEl = popup;
}
function highlightRollingTarget(x, y) {
  if (!_rollingPopupEl) return;
  _rollingPopupEl.querySelectorAll(".cust-rolling-target").forEach(t => {
    const rect = t.getBoundingClientRect();
    const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    t.classList.toggle("highlight", inside);
    if (inside) _rollingHoverTarget = t;
  });
}
function dropRolling(x, y) {
  // hapus avatar
  _rollingDragEl?.remove();
  _rollingDragEl = null;

  // cari target di posisi drop
  let target = null;
  if (_rollingPopupEl) {
    _rollingPopupEl.querySelectorAll(".cust-rolling-target").forEach(t => {
      const rect = t.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        target = t;
      }
    });
  }

  _rollingPopupEl?.remove();
  _rollingPopupEl    = null;
  _rollingHoverTarget = null;

  if (target && _rollingDragCustomer) {
    const uid      = target.dataset.uid;
    const role     = target.dataset.role;
    const user     = (window.usersCache||[]).find(u => u.uid === uid);
    const hariFilter = localStorage.getItem("rollingFilterHari") || _rollingDragCustomer.hari;
    konfirmasiDragRolling(_rollingDragCustomer, user, hariFilter);
  }

  _rollingDragCustomer = null;
}
function konfirmasiDragRolling(customer, targetUser, hari) {
  const existing = document.getElementById("custDragRollingOverlay");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = "custDragRollingOverlay";
  el.className = "lap-frozen-overlay";
  el.innerHTML = `
    <div class="lap-frozen-box">
      <div class="lap-frozen-icon">🔄</div>
      <div class="lap-frozen-title">Serahkan Customer?</div>
      <div class="lap-frozen-desc">
        <strong>${esc(customer.namaCustomer || "-")}</strong><br>
        Ke: ${esc(targetUser?.nama || "-")} (${targetUser?.role || "-"})<br>
        Hari: ${esc(hari || customer.hari || "-")}
      </div>
      <div class="lap-frozen-footer">
        <button class="lap-frozen-btn-cancel" id="custDragRollingNo">Batal</button>
        <button class="lap-frozen-btn-save" id="custDragRollingYes">Ya, Serahkan</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById("custDragRollingNo").onclick = () => el.remove();
  document.getElementById("custDragRollingYes").onclick = async () => {
    el.remove();
    await eksekusiDragRolling(customer, targetUser, hari);
  };
}
async function eksekusiDragRolling(customer, targetUser, hari) {
  try {
    const custId   = customer.id;
    const hunterUid = custActiveUser?.uid;
    const newHari   = hari || customer.hari;
    const adminUid  = window.auth?.currentUser?.uid;
    const idCabang  = window.currentUser?.idCabang || "";
    const snapHunter = await window.getDoc(
      window.doc(window.db, "users", hunterUid, "customerBaruHunter", custId)
    );
    if (!snapHunter.exists()) {
      window.showToast("Data customer tidak ditemukan", "error");
      return;
    }
    const hunterData = snapHunter.data();

    if (targetUser.role === "kurir") {
      // buat di collection customer
      const kurirUser = targetUser;
      const varianList = (kurirUser.varian || []).filter(v => {
        const k = Object.keys(v)[0]; return k && v[k]?.isAktif;
      });
      const dataKemarin = {};
      varianList.forEach(v => {
        const k = Object.keys(v)[0];
        const qty = hunterData.konsinyasi?.[k] || 0;
        dataKemarin[k] = { qty };
      });

      await window.setDoc(
        window.doc(window.db, "customer", custId),
        {
          namaCustomer:   hunterData.namaCustomer   || "",
          alamatCustomer: hunterData.alamatCustomer || "",
          foto:           hunterData.foto           || "",
          hari:           newHari,
          idCabang,
          lokasiCustomer: hunterData.lokasiCustomer || { latitude: 0, longitude: 0 },
          jarak:          hunterData.jarak          || 0,
          pemilik:        targetUser.uid,
          status:         true,
          isNew:          true,
          dataKemarin,
          createdAt:      hunterData.createdAt      || new Date().toISOString(),
          createdBy:      hunterData.createdBy || adminUid,
          updatedAt:      window.serverTimestamp(),
        }
      );

      window.showToast(`${hunterData.namaCustomer||"Customer"} diserahkan ke kurir ${targetUser.nama}`, "success");

    } else if (targetUser.role === "sales") {
      // copy semua field ke customerSales
      await window.setDoc(
        window.doc(window.db, "customerSales", custId),
        {
          ...hunterData,
          pemilik:   targetUser.uid,
          hari:      newHari,
          idCabang,
          createdBy: adminUid,
          updatedAt: window.serverTimestamp(),
        }
      );

      window.showToast(`${hunterData.namaCustomer||"Customer"} diserahkan ke sales ${targetUser.nama}`, "success");
    }

    // update diserahkan di hunter subcollection
    await window.setDoc(
      window.doc(window.db, "users", hunterUid, "customerBaruHunter", custId),
      { diserahkan: true, updatedAt: window.serverTimestamp() },
      { merge: true }
    );
    // hapus card dari list
    const card = document.querySelector(`#custDetailList .cust-card[data-id="${custId}"]`);
    if (card) card.remove();

    // update badge
    updateMarketingBadge(hunterUid, "hunter");
    updateMarketingBadge(targetUser.uid, targetUser.role);
    const remaining = document.querySelectorAll("#custDetailList .cust-card").length;
    updateHariBadge(custActiveHari, remaining);

  } catch (err) {
    window.showToast("Gagal menyerahkan customer", "error");
  }
}

async function loadRollingBadge() {
  try {
    const idCabang = window.currentUser?.idCabang || "";
    const snap = await window.getDocs(window.query(
      window.collection(window.db, "rolling"),
      window.where("idCabang", "==", idCabang),
      window.where("status",   "==", "pending")
    ));
    const count = snap.size;
    if (count === 0) return;
    const menuItem = document.querySelector(".cust-menu-item[data-menu='rolling']");
    if (!menuItem) return;
    let badge = menuItem.querySelector(".cust-rolling-menu-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "cust-rolling-menu-badge";
      menuItem.appendChild(badge);
    }
    badge.textContent = count;
  } catch (err) {}
}
async function loadCustGroups() {
  const kurir   = window.usersCache.filter(u => u.role === "kurir");
  const hunter  = window.usersCache.filter(u => u.role === "hunter");
  const sales   = window.usersCache.filter(u => u.role === "sales");

  // render dulu baru badge
  renderCustExpand("custExpandKurir",  kurir,  "kurir");
  renderCustExpand("custExpandHunter", hunter, "hunter");
  renderCustExpand("custExpandSales",  sales,  "sales");

  await renderAllMarketingBadges([...kurir, ...hunter, ...sales]);

  initCustGroupsStaticListeners();
}

// hitung badge semua marketing langsung dari Firestore — 3 query total, bukan per-uid-per-hari
async function renderAllMarketingBadges(allMarketing) {
  const idCabang = window.currentUser?.idCabang || "";
  if (!idCabang) return;

  const countByUid = {};

  try {
    const snapKurir = await window.getDocs(window.query(
      window.collection(window.db, "customer"),
      window.where("idCabang", "==", idCabang),
      window.where("status",   "==", true)
    ));
    snapKurir.forEach(d => {
      const uid = d.data().pemilik;
      if (uid) countByUid[uid] = (countByUid[uid] || 0) + 1;
    });
  } catch (err) {}

  try {
    const snapSales = await window.getDocs(window.query(
      window.collection(window.db, "customerSales"),
      window.where("idCabang",   "==", idCabang),
      window.where("diserahkan", "==", false)
    ));
    snapSales.forEach(d => {
      const uid = d.data().pemilik;
      if (uid) countByUid[uid] = (countByUid[uid] || 0) + 1;
    });
  } catch (err) {}

  try {
    const snapHunter = await window.getDocs(window.query(
      window.collectionGroup(window.db, "customerBaruHunter"),
      window.where("idCabang",   "==", idCabang),
      window.where("diserahkan", "==", false)
    ));
    snapHunter.forEach(d => {
      const uid = d.ref.parent.parent?.id;
      if (uid) countByUid[uid] = (countByUid[uid] || 0) + 1;
    });
  } catch (err) {}

  allMarketing.forEach(u => {
    const total = countByUid[u.uid] || 0;
    const item = document.querySelector(`.cust-sub-item[data-uid="${u.uid}"]`);
    if (!item) return;
    let badge = item.querySelector(".cust-sub-badge");
    if (total === 0) { badge?.remove(); return; }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "cust-sub-badge";
      item.appendChild(badge);
    }
    badge.textContent = total;
  });
}

function initCustGroupsStaticListeners() {
  if (window._custGroupsListenersInit) return;
  window._custGroupsListenersInit = true;

  // group trigger — independen, tidak tutup yang lain
  document.querySelectorAll(".cust-group-trigger").forEach(trigger => {
    trigger.addEventListener("click", () => {
      const group  = trigger.dataset.group;
      if (document.getElementById("mapRollingWrap")) window.closeMapRolling?.();
      const expand = document.getElementById(`custExpand${capitalize(group)}`);
      const isOpen = expand?.classList.contains("open");

      expand?.classList.toggle("open");
      trigger.classList.toggle("open");
      trigger.classList.toggle("active", !isOpen);
    });
  });

  // menu item (rolling, nonaktif, history)
  document.querySelectorAll(".cust-menu-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".cust-menu-item").forEach(i => i.classList.remove("active"));
      if (document.getElementById("mapRollingWrap")) window.closeMapRolling?.();
      document.querySelectorAll(".cust-group-trigger").forEach(t => { t.classList.remove("active"); t.classList.remove("open"); });
      document.querySelectorAll(".cust-group-expand").forEach(e => e.classList.remove("open"));
      document.querySelectorAll(".cust-sub-item").forEach(s => s.classList.remove("active"));
      item.classList.add("active");

      const menu = item.dataset.menu;
      const titles = { rolling: "Rolling Customer", nonaktif: "Non Aktif", history: "History Customer", verifikasi: "Verifikasi" };
      if (menu === "nonaktif") {
        showNonAktifView();
      } else if (menu === "history") {
        showHistoryView();
      } else if (menu === "rolling") {
        showRollingView();
      } else if (menu === "verifikasi") {
        showVerifikasiView();
      } else {
        showCustDetail(titles[menu] || menu, null, menu);
      }
    });
  });
}
async function updateVerifikasiBadge() {
  try {
    const idCabang = window.currentUser?.idCabang || "";
    if (!idCabang) return;
    const snap = await window.getDocs(window.query(
      window.collection(window.db, "requestCabang"),
      window.where("idCabangTujuan", "==", idCabang),
      window.where("status", "==", "pending")
    ));

    const count = snap.size;
    const menuItem = document.querySelector(".cust-menu-item[data-menu='verifikasi']");
    if (!menuItem) return;

    let badge = menuItem.querySelector(".cust-rolling-menu-badge");
    if (count === 0) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "cust-rolling-menu-badge";
      menuItem.appendChild(badge);
    }
    badge.textContent = count;
  } catch (err) {}
}
window.updateVerifikasiBadge = updateVerifikasiBadge;
async function showVerifikasiView() {
  resetCustRightPanel();
  if (window.innerWidth <= 768) {
    document.getElementById("custMiddlePanel")?.classList.add("show");
    if (window.innerWidth <= 768) history.pushState({ panel: true }, "", "");
    const backBtn = document.getElementById("topbarBackBtn");
    if (backBtn) backBtn.style.display = "flex";
  }

  const empty   = document.getElementById("custDetailEmpty");
  const content = document.getElementById("custDetailContent");
  const titleEl = document.getElementById("custDetailTitle");
  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (titleEl) titleEl.textContent   = "Verifikasi";

  document.getElementById("custHariChips").style.display = "none";

  const searchWrap = document.querySelector(".cust-search-wrap");
  if (searchWrap) searchWrap.style.display = "none";

  const list = document.getElementById("custDetailList");
  if (!list) return;
  list.innerHTML = `<div class="dh-ringkasan-empty">Memuat...</div>`;

  try {
    const idCabang = window.currentUser?.idCabang || "";
    const snap = await window.getDocs(window.query(
      window.collection(window.db, "requestCabang"),
      window.where("idCabangTujuan", "==", idCabang),
      window.where("status", "==", "pending")
    ));

    if (snap.empty) {
      list.innerHTML = `<div class="dh-ringkasan-empty">Tidak ada permintaan pindah cabang</div>`;
      return;
    }

    const requests = [];
    for (const docSnap of snap.docs) {
      const reqData = docSnap.data();
      const staffUid = reqData.idHunter;

      // fetch role & foto dari users/{uid} (nama & cabang sudah ada langsung di requestCabang)
      let userData = null;
      if (staffUid) {
        try {
          const userSnap = await window.getDoc(window.doc(window.db, "users", staffUid));
          if (userSnap.exists()) userData = userSnap.data();
        } catch (err) {}
      }

      requests.push({
        requestId: docSnap.id,
        uid: staffUid,
        nama: reqData.namaHunter || userData?.nama || "Tanpa Nama",
        role: userData?.role || "Hunter",
        namaCabangAsal: reqData.namaCabangAsal || "-",
        foto: userData?.foto || "",
      });
    }

    renderVerifikasiList(requests);

  } catch (err) {
    list.innerHTML = `<div class="dh-ringkasan-empty">Gagal memuat data</div>`;
  }
}
function renderVerifikasiList(requests) {
  const list = document.getElementById("custDetailList");
  if (!list) return;

  list.innerHTML = requests.map(r => {
    const inisial = (r.nama || "?").trim().charAt(0).toUpperCase();
    const avatar  = r.foto
      ? `<img src="${esc(r.foto)}" alt="">`
      : inisial;

    return `
      <div class="cust-verifikasi-card" data-request-id="${esc(r.requestId)}">
        <div class="cust-verifikasi-avatar">${avatar}</div>
        <div class="cust-verifikasi-info">
          <div class="cust-verifikasi-nama">${esc(r.nama)}</div>
          <div class="cust-verifikasi-role">${esc(r.role)} · dari cabang ${esc(r.namaCabangAsal)}</div>
        </div>
        <div class="cust-verifikasi-actions">
          <button class="cust-verifikasi-btn tolak" data-action="tolak" data-request-id="${esc(r.requestId)}">Tolak</button>
          <button class="cust-verifikasi-btn setuju" data-action="setuju" data-request-id="${esc(r.requestId)}" data-uid="${esc(r.uid)}">Setujui</button>
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll(".cust-verifikasi-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const requestId = btn.dataset.requestId;
      const action    = btn.dataset.action;
      const uid       = btn.dataset.uid;
      const card      = btn.closest(".cust-verifikasi-card");
      const nama      = card?.querySelector(".cust-verifikasi-nama")?.textContent || "-";

      if (action === "setuju") {
        konfirmasiApproveVerifikasi(requestId, uid, nama, btn);
      } else {
        rejectVerifikasi(requestId);
      }
    });
  });
}
function konfirmasiApproveVerifikasi(requestId, uid, nama, btn) {
  const existing = document.getElementById("custApproveOverlay");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = "custApproveOverlay";
  el.className = "lap-frozen-overlay";
  el.innerHTML = `
    <div class="lap-frozen-box">
      <div class="lap-frozen-icon">⚖︎</div>
      <div class="lap-frozen-title">Setujui Pindah Cabang?</div>
      <div class="lap-frozen-desc">
        <strong>${esc(nama)}</strong> akan dipindahkan ke cabang ini.
      </div>
      <div class="lap-frozen-footer">
        <button class="lap-frozen-btn-cancel" id="custApproveNo">Batal</button>
        <button class="lap-frozen-btn-save" id="custApproveYes">Ya, Setujui</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById("custApproveNo").onclick = () => el.remove();
  document.getElementById("custApproveYes").onclick = async () => {
    el.remove();
    if (btn) btn.disabled = true;
    await approveVerifikasi(requestId, uid);
  };
}
async function approveVerifikasi(requestId, uid) {
  try {
    const kantorCabang = await window.idb.getKantorCabang();
    const idCabang     = kantorCabang?.id || "";
    const adminUid = window.auth?.currentUser?.uid;
    await window.setDoc(
      window.doc(window.db, "users", uid),
      { idCabang, kantorCabang: kantorCabang?.namaCabang || "", createdBy: adminUid },
      { merge: true }
    );
    await window.setDoc(
      window.doc(window.db, "requestCabang", requestId),
      { status: "approved", updatedAt: window.serverTimestamp() },
      { merge: true }
    );
    window.showToast("Permintaan pindah cabang disetujui", "success");
    await showVerifikasiView();
    await updateVerifikasiBadge();
  } catch (err) {
    console.error("❌ approveVerifikasi:", err);
    window.showToast("Gagal menyetujui permintaan", "error");
  }
}
async function rejectVerifikasi(requestId) {
  try {
    await window.setDoc(
      window.doc(window.db, "requestCabang", requestId),
      { status: "rejected", updatedAt: window.serverTimestamp() },
      { merge: true }
    );

    window.showToast("Permintaan pindah cabang ditolak", "success");
    await showVerifikasiView();
    await updateVerifikasiBadge();
  } catch (err) {
    console.error("❌ rejectVerifikasi:", err);
    window.showToast("Gagal menolak permintaan", "error");
  }
}

async function showHistoryView() {
  resetCustRightPanel();
  if (window.innerWidth <= 768) {
    document.getElementById("custMiddlePanel")?.classList.add("show");
    if (window.innerWidth <= 768) history.pushState({ panel: true }, "", "");
    const backBtn = document.getElementById("topbarBackBtn");
    if (backBtn) backBtn.style.display = "flex";
  }

  const empty   = document.getElementById("custDetailEmpty");
  const content = document.getElementById("custDetailContent");
  const titleEl = document.getElementById("custDetailTitle");
  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (titleEl) titleEl.textContent   = "History Customer";

  document.getElementById("custHariChips").style.display = "none";

  // ganti search jadi search history
  const searchWrap = document.querySelector(".cust-search-wrap");
  if (searchWrap) searchWrap.style.display = "flex";
  const searchInput = document.getElementById("custSearchInput");
  const clearBtn    = document.getElementById("custSearchClear");
  if (searchInput) {
    const newInput = searchInput.cloneNode(true);
    newInput.placeholder = "Cari history customer...";
    searchInput.parentNode.replaceChild(newInput, searchInput);
    newInput.addEventListener("input", e => {
      const q = e.target.value.toLowerCase().trim();
      if (clearBtn) clearBtn.style.display = q ? "flex" : "none";
      filterHistoryList(q);
    });
  }
  if (clearBtn) {
    const newClear = clearBtn.cloneNode(true);
    clearBtn.parentNode.replaceChild(newClear, clearBtn);
    newClear.addEventListener("click", () => {
      const inp = document.getElementById("custSearchInput");
      if (inp) inp.value = "";
      newClear.style.display = "none";
      filterHistoryList("");
    });
  }

  const list = document.getElementById("custDetailList");
  if (!list) return;
  list.innerHTML = `<div class="dh-ringkasan-empty">Memuat...</div>`;

  try {
    const idCabang = window.currentUser?.idCabang || "";

    const snap = await window.getDocs(window.query(
      window.collection(window.db, "customerNonAktif"),
      window.where("idCabang", "==", idCabang)
    ));

    const customers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window._custHistoryData = customers;

    renderHistoryList(customers);

  } catch (err) {
    list.innerHTML = `<div class="dh-ringkasan-empty">Gagal memuat data</div>`;
  }
}
function filterHistoryList(q) {
  const data = window._custHistoryData || [];
  const filtered = q ? data.filter(c => (c.namaCustomer||"").toLowerCase().includes(q)) : data;
  renderHistoryList(filtered);
}
function renderHistoryList(data) {
  const list = document.getElementById("custDetailList");
  if (!list) return;

  if (!data.length) {
    list.innerHTML = `<div class="dh-ringkasan-empty">Tidak ada history customer</div>`;
    return;
  }

  list.innerHTML = data.map(c => {
    const nama       = c.namaCustomer || "Tanpa Nama";
    const inisial    = nama.trim().charAt(0).toUpperCase();
    const pemilikNama = (window.usersCache||[]).find(u => u.uid === c.pemilik)?.nama || "-";
    const nonAktifAt  = c.nonAktifAt?.seconds
      ? new Date(c.nonAktifAt.seconds * 1000).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" })
      : "-";
    const hasLokasi = c.lokasiCustomer?.latitude || c.lokasiCustomer?._lat;
    return `
      <div class="cust-card cust-history-card" data-id="${esc(c.id)}">
        <div class="cust-card-avatar">${inisial}</div>
        <div class="cust-card-info">
          <div class="cust-card-nama">${esc(nama)}</div>
          <div class="cust-card-sub">${esc(pemilikNama)} · ${esc(c.hari||"-")}</div>
        </div>
        <div class="cust-card-actions">
          ${hasLokasi ? `<button class="cust-card-map-btn" data-id="${esc(c.id)}">
            <i class="fa-solid fa-map-location-dot"></i>
          </button>` : ""}
          <i class="fa-solid fa-chevron-right cust-card-arrow"></i>
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll(".cust-history-card").forEach(card => {
    card.addEventListener("click", e => {
      if (e.target.closest(".cust-card-map-btn")) return;
      list.querySelectorAll(".cust-history-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      const id = card.dataset.id;
      const c  = data.find(x => x.id === id);
      if (!c) return;

      // show panel kanan
      const empty   = document.getElementById("custRightEmpty");
      const content = document.getElementById("custRightContent");
      const title   = document.getElementById("custRightTitle");
      if (empty)   empty.style.display   = "none";
      if (content) content.style.display = "flex";
      if (title)   title.textContent     = c.namaCustomer || "Detail History";

      openHistoryDetail(c);

      if (window.innerWidth <= 768) {
        document.getElementById("custRightPanel")?.classList.add("show");
        const backBtn = document.getElementById("topbarBackBtn");
        if (backBtn) backBtn.style.display = "flex";
      }
    });
  });

  list.querySelectorAll(".cust-card-map-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const c  = data.find(x => x.id === id);
      if (!c) return;
      const lat = c.lokasiCustomer?.latitude || c.lokasiCustomer?._lat;
      const lng = c.lokasiCustomer?.longitude || c.lokasiCustomer?._long;
      if (lat && lng) window.openPetaGlobal({ id: c.id, lat, lng });
    });
  });
}
async function loadHistoryCustomer(user) {
  const empty   = document.getElementById("custRightEmpty");
  const content = document.getElementById("custRightContent");
  const title   = document.getElementById("custRightTitle");
  const body    = document.getElementById("custRightBody");

  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (title)   title.textContent     = `History — ${user.nama || "-"}`;

  if (body) body.innerHTML = `
    <div class="cust-nonaktif-search-wrap">
      <i class="fa-solid fa-magnifying-glass" style="color:var(--text-muted);font-size:12px"></i>
      <input type="text" class="cust-search-input" id="custHistorySearch" placeholder="Cari customer...">
      <button class="cust-search-clear" id="custHistoryClear" style="display:none">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div id="custHistoryList"><div class="dh-ringkasan-empty">Memuat...</div></div>`;

  try {
    const idCabang = window.currentUser?.idCabang || "";

    const snap = await window.getDocs(window.query(
      window.collection(window.db, "customerNonAktif"),
      window.where("idCabang", "==", idCabang),
      window.where("pemilik",  "==", user.uid)
    ));

    const customers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const historyList = document.getElementById("custHistoryList");
    if (!historyList) return;

    function renderHistoryList(data) {
      if (!data.length) {
        historyList.innerHTML = `<div class="dh-ringkasan-empty">Tidak ada history customer</div>`;
        return;
      }
      historyList.innerHTML = data.map(c => {
        const nama    = c.namaCustomer || "Tanpa Nama";
        const inisial = nama.trim().charAt(0).toUpperCase();
        const hasLokasi = c.lokasiCustomer?.latitude || c.lokasiCustomer?._lat;
        const nonAktifAt = c.nonAktifAt?.seconds
          ? new Date(c.nonAktifAt.seconds * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
          : "-";
        return `
          <div class="cust-card" data-id="${esc(c.id)}">
            <div class="cust-card-avatar">${inisial}</div>
            <div class="cust-card-info">
              <div class="cust-card-nama">${esc(nama)}</div>
              <div class="cust-card-sub">${esc(c.hari||"-")} · Dihapus ${nonAktifAt}</div>
            </div>
            <div class="cust-card-actions">
              ${hasLokasi ? `<button class="cust-card-map-btn" data-id="${esc(c.id)}" title="Lihat di Map">
                <i class="fa-solid fa-map-location-dot"></i>
              </button>` : ""}
              <i class="fa-solid fa-chevron-right cust-card-arrow"></i>
            </div>
          </div>`;
      }).join("");

      // klik card buka detail
      historyList.querySelectorAll(".cust-card").forEach(card => {
        card.addEventListener("click", e => {
          if (e.target.closest(".cust-card-map-btn")) return;
          historyList.querySelectorAll(".cust-card").forEach(c => c.classList.remove("active"));
          card.classList.add("active");
          const id = card.dataset.id;
          const c  = data.find(x => x.id === id);
          if (c) openHistoryDetail(c);
        });
      });

      // map btn
      historyList.querySelectorAll(".cust-card-map-btn").forEach(btn => {
        btn.addEventListener("click", e => {
          e.stopPropagation();
          const id = btn.dataset.id;
          const c  = data.find(x => x.id === id);
          if (!c) return;
          const lat = c.lokasiCustomer?.latitude || c.lokasiCustomer?._lat;
          const lng = c.lokasiCustomer?.longitude || c.lokasiCustomer?._long;
          if (lat && lng) window.openPetaGlobal({ id: c.id, lat, lng });
        });
      });
    }

    renderHistoryList(customers);

    // search
    const searchInput = document.getElementById("custHistorySearch");
    const clearBtn    = document.getElementById("custHistoryClear");
    searchInput?.addEventListener("input", e => {
      const q = e.target.value.toLowerCase().trim();
      if (clearBtn) clearBtn.style.display = q ? "flex" : "none";
      const filtered = q ? customers.filter(c => (c.namaCustomer||"").toLowerCase().includes(q)) : customers;
      renderHistoryList(filtered);
    });
    clearBtn?.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      clearBtn.style.display = "none";
      renderHistoryList(customers);
    });

  } catch (err) {
    const historyList = document.getElementById("custHistoryList");
    if (historyList) historyList.innerHTML = `<div class="dh-ringkasan-empty">Gagal memuat data</div>`;
  }
}
function openHistoryDetail(c) {
  const body = document.getElementById("custRightBody");
  if (!body) return;

  const pemilikNama = (window.usersCache||[]).find(u => u.uid === c.pemilik)?.nama || c.pemilik || "-";
  const nonAktifAt  = c.nonAktifAt?.seconds
    ? new Date(c.nonAktifAt.seconds * 1000).toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" })
    : "-";
  const createdAt = c.createdAt?.seconds
    ? new Date(c.createdAt.seconds * 1000).toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" })
    : "-";

  body.innerHTML = `
    <div style="padding:4px 0 16px">
      <div class="cust-card-avatar" style="width:56px;height:56px;font-size:20px;border-radius:14px;margin-bottom:12px">
        ${(c.namaCustomer||"?").charAt(0).toUpperCase()}
      </div>
      <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:4px">${esc(c.namaCustomer||"-")}</div>
      <div style="font-size:12px;color:var(--text-muted)">${esc(c.hari||"-")}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div class="cust-info-row"><span class="cust-info-label">Pemilik</span><span class="cust-info-val">${esc(pemilikNama)}</span></div>
      <div class="cust-info-row"><span class="cust-info-label">Dibuat</span><span class="cust-info-val">${esc(createdAt)}</span></div>
      <div class="cust-info-row"><span class="cust-info-label">Dihapus</span><span class="cust-info-val">${esc(nonAktifAt)}</span></div>
    </div>`;
}
function resetCustRightPanel() {
  const empty   = document.getElementById("custRightEmpty");
  const content = document.getElementById("custRightContent");
  const body    = document.getElementById("custRightBody");
  if (empty)   empty.style.display   = "flex";
  if (content) content.style.display = "none";
  if (body)    body.innerHTML        = "";
  if (window.innerWidth <= 768) {
    document.getElementById("custRightPanel")?.classList.remove("show");
  }
}

async function showNonAktifView() {
  resetCustRightPanel();
  if (window.innerWidth <= 768) {
    document.getElementById("custMiddlePanel")?.classList.add("show");
    const backBtn = document.getElementById("topbarBackBtn");
    if (backBtn) backBtn.style.display = "flex";
  }

  // panel tengah — list marketing
  const empty   = document.getElementById("custDetailEmpty");
  const content = document.getElementById("custDetailContent");
  const titleEl = document.getElementById("custDetailTitle");
  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (titleEl) titleEl.textContent   = "Non Aktif";

  // sembunyikan chips hari, reload, dan search
  document.getElementById("custHariChips").style.display = "none";
  document.querySelector(".cust-search-wrap").style.display = "none";
  const list = document.getElementById("custDetailList");
  if (!list) return;

  const allMarketing = (window.usersCache||[]).filter(u => ["kurir","hunter","sales"].includes(u.role));

  list.innerHTML = allMarketing.map(u => {
    const nama    = u.nama || "Tanpa Nama";
    const inisial = nama.trim().charAt(0).toUpperCase();
    const avatar  = u.foto ? `<img src="${esc(u.foto)}" alt="${esc(nama)}">` : inisial;
    const roleColor = { kurir: "kurir", hunter: "hunter", sales: "sales" };
    return `
      <div class="cust-card cust-nonaktif-marketing" data-uid="${esc(u.uid)}" data-role="${u.role}">
        <div class="cust-card-avatar">${avatar}</div>
        <div class="cust-card-info">
          <div class="cust-card-nama">${esc(nama)}</div>
          <div class="cust-card-sub">${u.role}</div>
        </div>
        <i class="fa-solid fa-chevron-right cust-card-arrow"></i>
      </div>`;
  }).join("");

  list.querySelectorAll(".cust-nonaktif-marketing").forEach(card => {
    card.addEventListener("click", () => {
      list.querySelectorAll(".cust-nonaktif-marketing").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      const uid  = card.dataset.uid;
      const role = card.dataset.role;
      const user = (window.usersCache||[]).find(u => u.uid === uid);
      loadNonAktifCustomer(user, role);

      if (window.innerWidth <= 768) {
        document.getElementById("custRightPanel")?.classList.add("show");
        const backBtn = document.getElementById("topbarBackBtn");
        if (backBtn) backBtn.style.display = "flex";
      }
    });
  });
}
async function loadNonAktifCustomer(user, role) {
  const empty   = document.getElementById("custRightEmpty");
  const content = document.getElementById("custRightContent");
  const title   = document.getElementById("custRightTitle");
  const body    = document.getElementById("custRightBody");

  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (title)   title.textContent     = `Non Aktif — ${user.nama || "-"}`;

  if (body) body.innerHTML = `
    <div class="cust-nonaktif-search-wrap">
      <i class="fa-solid fa-magnifying-glass" style="color:var(--text-muted);font-size:12px"></i>
      <input type="text" class="cust-search-input" id="custNonAktifSearch" placeholder="Cari customer...">
      <button class="cust-search-clear" id="custNonAktifClear" style="display:none">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div id="custNonAktifList"><div class="dh-ringkasan-empty">Memuat...</div></div>`;
  try {
    const idCabang = window.currentUser?.idCabang || "";
    let snap;

    if (role === "kurir") {
      snap = await window.getDocs(window.query(
        window.collection(window.db, "customer"),
        window.where("pemilik",  "==", user.uid),
        window.where("idCabang", "==", idCabang),
        window.where("status",   "==", false)
      ));
    } else if (role === "hunter") {
      snap = await window.getDocs(window.query(
        window.collection(window.db, "users", user.uid, "customerBaruHunter"),
        window.where("idCabang",   "==", idCabang),
        window.where("diserahkan", "==", true)
      ));
    } else if (role === "sales") {
      snap = await window.getDocs(window.query(
        window.collection(window.db, "customerSales"),
        window.where("pemilik",    "==", user.uid),
        window.where("idCabang",   "==", idCabang),
        window.where("diserahkan", "==", true)
      ));
    }
    const customers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window._custNonAktifData = customers;
    const nonAktifList = document.getElementById("custNonAktifList");
    if (!nonAktifList) return;
    function renderNonAktifList(data) {
      if (!data.length) {
        nonAktifList.innerHTML = `<div class="dh-ringkasan-empty">Tidak ada customer non aktif</div>`;
        return;
      }
      nonAktifList.innerHTML = `<div class="cust-nonaktif-list">${data.map(c => {
      const nama    = c.namaCustomer || "Tanpa Nama";
      const inisial = nama.trim().charAt(0).toUpperCase();
      const avatar  = c.foto ? `<img src="${esc(c.foto)}" alt="${esc(nama)}">` : inisial;
      const hasLokasi = c.lokasiCustomer?.latitude || c.lokasiCustomer?._lat;
      return `
        <div class="cust-card" data-id="${esc(c.id)}">
          <div class="cust-card-avatar">${avatar}</div>
          <div class="cust-card-info">
            <div class="cust-card-nama">${esc(nama)}</div>
            <div class="cust-card-sub">${esc(c.alamatCustomer || "-")} · ${esc(c.hari || "-")}</div>
          </div>
          <div class="cust-card-actions">
            <button class="cust-card-restore-btn" data-id="${esc(c.id)}" data-role="${role}" title="Aktifkan Kembali">
              <i class="fa-solid fa-rotate-left"></i>
            </button>
            <button class="cust-card-trash-btn" data-id="${esc(c.id)}" data-role="${role}" data-uid="${esc(user.uid)}" title="Hapus Permanen">
              <i class="fa-solid fa-trash"></i>
            </button>
            ${hasLokasi ? `<button class="cust-card-map-btn" data-id="${esc(c.id)}" title="Lihat di Map">
              <i class="fa-solid fa-map-location-dot"></i>
            </button>` : ""}
          </div>
        </div>`;
      }).join("")}</div>`;

      // event restore
    body.querySelectorAll(".cust-card-restore-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const id     = btn.dataset.id;
        const cardEl = btn.closest(".cust-card");
        konfirmasiRestore(id, role, user.uid, cardEl);
      });
    });

    // event hapus permanen
    body.querySelectorAll(".cust-card-trash-btn").forEach(btn => {
      btn.addEventListener("click", async e => {
        e.stopPropagation();
        const id   = btn.dataset.id;
        const role = btn.dataset.role;
        const uid  = btn.dataset.uid;
        konfirmasiHapusPermanen(id, role, uid, btn.closest(".cust-card"));
      });
    });

    // event map
      nonAktifList.querySelectorAll(".cust-card-map-btn").forEach(btn => {
        btn.addEventListener("click", e => {
          e.stopPropagation();
          const id = btn.dataset.id;
          const c  = data.find(x => x.id === id);
          if (!c) return;
          const lat = c.lokasiCustomer?.latitude || c.lokasiCustomer?._lat;
          const lng = c.lokasiCustomer?.longitude || c.lokasiCustomer?._long;
          if (lat && lng) window.openPetaGlobal({ id: c.id, lat, lng });
        });
      });
    } // end renderNonAktifList

    renderNonAktifList(customers);

    // search
    const searchInput = document.getElementById("custNonAktifSearch");
    const clearBtn    = document.getElementById("custNonAktifClear");
    searchInput?.addEventListener("input", e => {
      const q = e.target.value.toLowerCase().trim();
      if (clearBtn) clearBtn.style.display = q ? "flex" : "none";
      const filtered = q
        ? customers.filter(c => (c.namaCustomer||"").toLowerCase().includes(q))
        : customers;
      renderNonAktifList(filtered);
    });
    clearBtn?.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      clearBtn.style.display = "none";
      renderNonAktifList(customers);
    });

  } catch (err) {
    body.innerHTML = `<div class="dh-ringkasan-empty">Gagal memuat data</div>`;
  }
}
function konfirmasiRestore(custId, role, uid, cardEl) {
  const existing = document.getElementById("custRestoreOverlay");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = "custRestoreOverlay";
  el.className = "lap-frozen-overlay";
  el.innerHTML = `
    <div class="lap-frozen-box">
      <div class="lap-frozen-icon">🔄</div>
      <div class="lap-frozen-title">Aktifkan Kembali?</div>
      <div class="lap-frozen-desc">Customer ini akan diaktifkan kembali dan muncul di list aktif.</div>
      <div class="lap-frozen-footer">
        <button class="lap-frozen-btn-cancel" id="custRestoreNo">Batal</button>
        <button class="lap-frozen-btn-save" id="custRestoreYes">Aktifkan</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById("custRestoreNo").onclick = () => el.remove();
  document.getElementById("custRestoreYes").onclick = async () => {
    el.remove();
    try {
      // ambil data customer dulu dari Firestore
      let custSnap, custData, custHari;
      if (role === "kurir") {
        custSnap = await window.getDoc(window.doc(window.db, "customer", custId));
        custData = custSnap.exists() ? custSnap.data() : null;
        custHari = custData?.hari;
        await window.setDoc(window.doc(window.db, "customer", custId),
          { status: true, updatedAt: window.serverTimestamp() }, { merge: true });
      } else if (role === "sales") {
        custSnap = await window.getDoc(window.doc(window.db, "customerSales", custId));
        custData = custSnap.exists() ? custSnap.data() : null;
        custHari = custData?.hari;
        await window.setDoc(window.doc(window.db, "customerSales", custId),
          { diserahkan: false, updatedAt: window.serverTimestamp() }, { merge: true });
      } else if (role === "hunter") {
        custSnap = await window.getDoc(window.doc(window.db, "users", uid, "customerBaruHunter", custId));
        custData = custSnap.exists() ? custSnap.data() : null;
        custHari = custData?.hari;
        await window.setDoc(window.doc(window.db, "users", uid, "customerBaruHunter", custId),
          { diserahkan: false, updatedAt: window.serverTimestamp() }, { merge: true });
      }
      cardEl?.remove();
      if (custHari) updateMarketingBadge(uid, role);
      window.showToast("Customer diaktifkan kembali", "success");
    } catch (err) {
      window.showToast("Gagal mengaktifkan", "error");
    }
  };
}
function konfirmasiHapusPermanen(custId, role, uid, cardEl) {
  const existing = document.getElementById("custHapusOverlay");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = "custHapusOverlay";
  el.className = "lap-frozen-overlay";
  el.innerHTML = `
    <div class="lap-frozen-box">
      <div class="lap-frozen-icon">🗑️</div>
      <div class="lap-frozen-title">Hapus Permanen?</div>
      <div class="lap-frozen-desc">Customer ini akan dihapus secara permanen dan tidak bisa dikembalikan.</div>
      <div class="lap-frozen-footer">
        <button class="lap-frozen-btn-cancel" id="custHapusNo">Batal</button>
        <button class="lap-frozen-btn-save" id="custHapusYes" style="background:linear-gradient(135deg,#d05050,#e07070)">Hapus</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById("custHapusNo").onclick = () => el.remove();
  document.getElementById("custHapusYes").onclick = async () => {
    el.remove();
    try {
      // ambil data dulu sebelum hapus
      let custData = null;
      try {
        let snap;
        if (role === "kurir")  snap = await window.getDoc(window.doc(window.db, "customer", custId));
        if (role === "sales")  snap = await window.getDoc(window.doc(window.db, "customerSales", custId));
        if (role === "hunter") snap = await window.getDoc(window.doc(window.db, "users", uid, "customerBaruHunter", custId));
        if (snap?.exists()) custData = snap.data();
      } catch {}

      // hapus foto dari Storage jika ada
      try {
        if (custData?.foto) {
          const ref = window.storageRef(window.storage, custData.foto);
          await window.deleteObject(ref);
        }
      } catch {}

      // simpan ke customerNonAktif
      try {
        if (custData) {
          await window.setDoc(
            window.doc(window.db, "customerNonAktif", custId),
            {
              namaCustomer:   custData.namaCustomer   || "",
              hari:           custData.hari            || "",
              idCabang:       custData.idCabang        || "",
              lokasiCustomer: custData.lokasiCustomer  || null,
              pemilik:        custData.pemilik         || "",
              createdAt:      custData.createdAt       || null,
              createdBy:      custData.createdBy       || "",
              nonAktifAt:     window.serverTimestamp(),
            }
          );
        }
      } catch {}
      if (role === "kurir") {
        await window.deleteDoc(window.doc(window.db, "customer", custId));
      } else if (role === "sales") {
        await window.deleteDoc(window.doc(window.db, "customerSales", custId));
      } else if (role === "hunter") {
        await window.deleteDoc(window.doc(window.db, "users", uid, "customerBaruHunter", custId));
      }
      cardEl?.remove();
      updateMarketingBadge(uid, role);
      window.showToast("Customer dihapus permanen", "success");
    } catch (err) {
      window.showToast("Gagal menghapus", "error");
    }
  };
}

async function showRollingView() {
  resetCustRightPanel();
  if (window.innerWidth <= 768) {
    document.getElementById("custMiddlePanel")?.classList.add("show");
    const backBtn = document.getElementById("topbarBackBtn");
    if (backBtn) backBtn.style.display = "flex";
  }

  const empty   = document.getElementById("custDetailEmpty");
  const content = document.getElementById("custDetailContent");
  const titleEl = document.getElementById("custDetailTitle");
  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (titleEl) titleEl.textContent   = "Rolling Customer";

  document.getElementById("custHariChips").style.display = "none";
  document.querySelector(".cust-search-wrap").style.display = "none";

  const list = document.getElementById("custDetailList");
  if (!list) return;
  list.innerHTML = `<div class="dh-ringkasan-empty">Memuat...</div>`;

  try {
    const idCabang = window.currentUser?.idCabang || "";
    const snap = await window.getDocs(window.query(
      window.collection(window.db, "rolling"),
      window.where("idCabang", "==", idCabang),
      window.where("status",   "==", "pending")
    ));

    const pengajuan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window._custRollingData = pengajuan;

    if (!pengajuan.length) {
      list.innerHTML = `<div class="dh-ringkasan-empty">Tidak ada pengajuan rolling</div>`;
      return;
    }

    list.innerHTML = pengajuan.map(p => {
      const isPemilik = p.type === "pemilik";
      const fromText  = isPemilik
        ? (p.from?.namaUser || "-")
        : (p.from?.hari || "-");
      const toText    = isPemilik
        ? (p.to?.namaUser || "-")
        : (p.to?.hari || "-");

      return `
        <div class="cust-card cust-rolling-card" data-id="${esc(p.id)}">
          <div class="cust-card-info" style="flex:1">
            <div class="cust-card-nama">${esc(p.namaCustomer || "-")}</div>
            <div class="cust-card-sub">${esc(p.requestedBy?.nama || "-")}</div>
            <div class="cust-rolling-route">
              <span class="cust-rolling-from">${esc(fromText)}</span>
              <i class="fa-solid fa-arrow-right" style="font-size:10px;color:var(--text-muted)"></i>
              <span class="cust-rolling-to">${esc(toText)}</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
            <span class="cust-rolling-badge ${isPemilik ? "pemilik" : "hari"}">
              ${isPemilik ? "Pindah Pemilik" : "Pindah Hari"}
            </span>
            <i class="fa-solid fa-chevron-right" style="font-size:11px;color:var(--text-muted)"></i>
          </div>
        </div>`;
    }).join("");

    list.querySelectorAll(".cust-rolling-card").forEach(card => {
      card.addEventListener("click", () => {
        list.querySelectorAll(".cust-rolling-card").forEach(c => c.classList.remove("active"));
        card.classList.add("active");
        const id = card.dataset.id;
        const p  = pengajuan.find(x => x.id === id);
        if (p) openRollingDetail(p);
        if (window.innerWidth <= 768) {
          document.getElementById("custRightPanel")?.classList.add("show");
          const backBtn = document.getElementById("topbarBackBtn");
          if (backBtn) backBtn.style.display = "flex";
        }
      });
    });

  } catch (err) {
    list.innerHTML = `<div class="dh-ringkasan-empty">Gagal memuat data</div>`;
  }
}
function openRollingDetail(p) {
  const empty   = document.getElementById("custRightEmpty");
  const content = document.getElementById("custRightContent");
  const title   = document.getElementById("custRightTitle");
  const body    = document.getElementById("custRightBody");

  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (title)   title.textContent     = "Detail Pengajuan";

  const isPemilik = p.type === "pemilik";
  const fromText  = isPemilik ? (p.from?.namaUser || "-") : (p.from?.hari || "-");
  const toText    = isPemilik ? (p.to?.namaUser   || "-") : (p.to?.hari   || "-");
  const parseDate = val => {
    if (!val) return "-";
    if (val?.seconds) return new Date(val.seconds * 1000);
    if (typeof val === "string") return new Date(val);
    return null;
  };
  const createdAtDate = parseDate(p.createdAt);
  const createdAt = createdAtDate
    ? createdAtDate.toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" })
    : "-";

  body.innerHTML = `
    <div class="cust-rolling-detail">

      <div class="cust-rolling-detail-header">
        <span class="cust-rolling-badge ${isPemilik ? "pemilik" : "hari"}" style="font-size:11px">
          ${isPemilik ? "Pindah Pemilik" : "Pindah Hari"}
        </span>
        <div class="cust-rolling-detail-nama">${esc(p.namaCustomer || "-")}</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
        <div class="cust-info-row">
          <span class="cust-info-label">Pengaju</span>
          <span class="cust-info-val">${esc(p.requestedBy?.nama || "-")}</span>
        </div>
        <div class="cust-info-row">
          <span class="cust-info-label">Tanggal</span>
          <span class="cust-info-val">${esc(createdAt)}</span>
        </div>
        <div class="cust-info-row">
          <span class="cust-info-label">Alasan</span>
          <span class="cust-info-val">${esc(p.alasan || "-")}</span>
        </div>
      </div>

      <div class="cust-rolling-route-detail">
        <div class="cust-rolling-route-box from">
          <div class="cust-rolling-route-label">Dari</div>
          <div class="cust-rolling-route-val">${esc(fromText)}</div>
        </div>
        <i class="fa-solid fa-arrow-right" style="color:var(--text-muted);font-size:16px"></i>
        <div class="cust-rolling-route-box to">
          <div class="cust-rolling-route-label">Ke</div>
          <div class="cust-rolling-route-val">${esc(toText)}</div>
        </div>
      </div>

      <div class="cust-rolling-actions">
        <button class="cust-rolling-btn tolak" id="custRollingTolak" data-id="${esc(p.id)}">
          <i class="fa-solid fa-xmark"></i> Tolak
        </button>
        <button class="cust-rolling-btn acc" id="custRollingAcc" data-id="${esc(p.id)}">
          <i class="fa-solid fa-check"></i> ACC
        </button>
      </div>

    </div>`;

  document.getElementById("custRollingTolak")?.addEventListener("click", () => {
    konfirmasiRolling("tolak", p);
  });
  document.getElementById("custRollingAcc")?.addEventListener("click", () => {
    konfirmasiRolling("acc", p);
  });
}
function konfirmasiRolling(type, p) {
  const existing = document.getElementById("custRollingConfirmOverlay");
  if (existing) existing.remove();

  const isAcc     = type === "acc";
  const isPemilik = p.type === "pemilik";
  const fromText  = isPemilik ? (p.from?.namaUser || "-") : (p.from?.hari || "-");
  const toText    = isPemilik ? (p.to?.namaUser   || "-") : (p.to?.hari   || "-");

  const el = document.createElement("div");
  el.id = "custRollingConfirmOverlay";
  el.className = "lap-frozen-overlay";
  el.innerHTML = `
    <div class="lap-frozen-box">
      <div class="lap-frozen-icon">${isAcc ? "✅" : "❌"}</div>
      <div class="lap-frozen-title">${isAcc ? "Setujui Pengajuan?" : "Tolak Pengajuan?"}</div>
      <div class="lap-frozen-desc">
        <strong>${esc(p.namaCustomer || "-")}</strong><br>
        ${isPemilik ? "Pindah Pemilik" : "Pindah Hari"}: ${esc(fromText)} → ${esc(toText)}
      </div>
      <div class="lap-frozen-footer">
        <button class="lap-frozen-btn-cancel" id="custRollingConfirmNo">Batal</button>
        <button class="lap-frozen-btn-save" id="custRollingConfirmYes"
          style="${!isAcc ? "background:linear-gradient(135deg,#d05050,#e07070)" : ""}">
          ${isAcc ? "Ya, ACC" : "Ya, Tolak"}
        </button>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById("custRollingConfirmNo").onclick  = () => el.remove();
  document.getElementById("custRollingConfirmYes").onclick = () => {
    el.remove();
    if (isAcc) accRolling(p);
    else tolakRolling(p);
  };
}
async function tolakRolling(p) {
  const btn = document.getElementById("custRollingTolak");
  if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`; }
  try {
    await window.setDoc(
      window.doc(window.db, "rolling", p.id),
      { status: "rejected", rejectedAt: window.serverTimestamp() },
      { merge: true }
    );
    window.showToast("Pengajuan ditolak", "error");
    hapusRollingCard(p.id);
  } catch (err) {
    window.showToast("Gagal menolak", "error");
    if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-xmark"></i> Tolak`; }
  }
}
async function accRolling(p) {
  const btn = document.getElementById("custRollingAcc");
  if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`; }
  try {
    const adminUid = window.auth?.currentUser?.uid;

    // update status rolling
    await window.setDoc(
      window.doc(window.db, "rolling", p.id),
      { status: "approved", approvedAt: new Date().toISOString(), approvedBy: adminUid },
      { merge: true }
    );

    // update customer sesuai type dan role
    if (p.type === "pemilik") {
      await updateRollingPemilik(p);
    } else if (p.type === "hari") {
      await updateRollingHari(p);
    }

    window.showToast("Pengajuan disetujui", "success");
    hapusRollingCard(p.id);
  } catch (err) {
    window.showToast("Gagal menyetujui", "error");
    if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-check"></i> ACC`; }
  }
}
async function updateRollingPemilik(p) {
  const idCustomer = p.idCustomer;
  const newPemilik = p.to?.idUser;
  const oldPemilik = p.from?.idUser;
  if (!idCustomer || !newPemilik) return;

  const oldUser = (window.usersCache||[]).find(u => u.uid === oldPemilik);
  const newUser = (window.usersCache||[]).find(u => u.uid === newPemilik);
  const oldRole = oldUser?.role || "kurir";
  const newRole = newUser?.role || "kurir";
  const adminUid = window.auth?.currentUser?.uid;
  const idCabang = window.currentUser?.idCabang || "";

  if (oldRole === "kurir" && newRole === "kurir") {
    // kurir → kurir: update pemilik + isNew
    await window.setDoc(
      window.doc(window.db, "customer", idCustomer),
      { pemilik: newPemilik, isNew: true, updatedAt: window.serverTimestamp() },
      { merge: true }
    );

  } else if (oldRole === "sales" && newRole === "sales") {
    await window.setDoc(
      window.doc(window.db, "customerSales", idCustomer),
      { pemilik: newPemilik, updatedAt: window.serverTimestamp() },
      { merge: true }
    );

  } else if (oldRole === "sales" && newRole === "kurir") {
    const snapSales = await window.getDoc(window.doc(window.db, "customerSales", idCustomer));
    if (!snapSales.exists()) return;
    const salesData = snapSales.data();

    // update diserahkan di sales
    await window.setDoc(
      window.doc(window.db, "customerSales", idCustomer),
      { diserahkan: true, updatedAt: window.serverTimestamp() },
      { merge: true }
    );

    // buat dataKemarin dari konsinyasi
    const kurirUser  = newUser;
    const varianList = (kurirUser?.varian || []).filter(v => {
      const k = Object.keys(v)[0]; return k && v[k]?.isAktif;
    });
    const dataKemarin = {};
    varianList.forEach(v => {
      const k = Object.keys(v)[0];
      dataKemarin[k] = { qty: salesData.konsinyasi?.[k] || 0 };
    });

    const hari = salesData.hari || "";

    // buat dokumen baru di customer
    await window.setDoc(
      window.doc(window.db, "customer", idCustomer),
      {
        namaCustomer:   salesData.namaCustomer   || "",
        alamatCustomer: salesData.alamatCustomer || "",
        foto:           salesData.foto           || "",
        hari,
        idCabang,
        lokasiCustomer: salesData.lokasiCustomer || { latitude: 0, longitude: 0 },
        jarak:          salesData.jarak          || 0,
        pemilik:        newPemilik,
        status:         true,
        isNew:          true,
        dataKemarin,
        createdAt:      salesData.createdAt      || new Date().toISOString(),
        createdBy:      salesData.createdBy      || adminUid,
        updatedAt:      window.serverTimestamp(),
      }
    );
  }
}
async function updateRollingHari(p) {
  const idCustomer = p.idCustomer;
  const newHari    = p.to?.hari;
  const oldHari    = p.from?.hari;
  const pemilik    = p.requestedBy?.uid;
  if (!idCustomer || !newHari) return;

  // update Firestore
  await window.setDoc(
    window.doc(window.db, "customer", idCustomer),
    { hari: newHari, updatedAt: window.serverTimestamp() },
    { merge: true }
  );
}
function hapusRollingCard(id) {
  const card = document.querySelector(`.cust-rolling-card[data-id="${id}"]`);
  if (card) card.remove();
  resetCustRightPanel();

  const list = document.getElementById("custDetailList");
  if (list && !list.querySelector(".cust-rolling-card")) {
    list.innerHTML = `<div class="dh-ringkasan-empty">Tidak ada pengajuan rolling</div>`;
  }
}

function renderCustExpand(containerId, users, role) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!users.length) {
    el.innerHTML = `<div class="cust-sub-item" style="pointer-events:none;color:var(--text-muted)">Tidak ada data</div>`;
    return;
  }

  el.innerHTML = users.map(u => {
    const nama    = u.nama || "Tanpa Nama";
    const inisial = nama.trim().charAt(0).toUpperCase();
    const avatar  = u.foto
      ? `<img src="${esc(u.foto)}" alt="${esc(nama)}">`
      : inisial;
    return `
      <div class="cust-sub-item" data-uid="${esc(u.uid)}" data-role="${role}">
        <div class="cust-sub-avatar">${avatar}</div>
        <span>${esc(nama)}</span>
      </div>`;
  }).join("");
  if (document.getElementById("mapRollingWrap")) window.closeMapRolling?.();
  el.querySelectorAll(".cust-sub-item").forEach(item => {
    item.addEventListener("click", () => {
      if (document.getElementById("mapRollingWrap")) window.closeMapRolling?.();
      document.querySelectorAll(".cust-sub-item").forEach(s => s.classList.remove("active"));
      document.querySelectorAll(".cust-menu-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      const uid  = item.dataset.uid;
      const user = window.usersCache.find(u => u.uid === uid);
      showCustDetail(user?.nama || "Customer", user, null);
      if (window.innerWidth <= 768) {
        document.getElementById("custMiddlePanel")?.classList.add("show");
        const backBtn = document.getElementById("topbarBackBtn");
        if (backBtn) backBtn.style.display = "flex";
      }
    });
  });
}
async function updateMarketingBadge(uid, role) {
  const idCabang = window.currentUser?.idCabang || "";
  let total = 0;
  try {
    if (role === "kurir") {
      const snap = await window.getDocs(window.query(
        window.collection(window.db, "customer"),
        window.where("pemilik",  "==", uid),
        window.where("idCabang", "==", idCabang),
        window.where("status",   "==", true)
      ));
      total = snap.size;
    } else if (role === "sales") {
      const snap = await window.getDocs(window.query(
        window.collection(window.db, "customerSales"),
        window.where("pemilik",    "==", uid),
        window.where("idCabang",   "==", idCabang),
        window.where("diserahkan", "==", false)
      ));
      total = snap.size;
    } else if (role === "hunter") {
      const snap = await window.getDocs(window.query(
        window.collection(window.db, "users", uid, "customerBaruHunter"),
        window.where("idCabang",   "==", idCabang),
        window.where("diserahkan", "==", false)
      ));
      total = snap.size;
    }
  } catch (err) {
    console.error("❌ updateMarketingBadge:", err);
  }

  const item = document.querySelector(`.cust-sub-item[data-uid="${uid}"]`);
  if (!item) return;
  let badge = item.querySelector(".cust-sub-badge");
  if (total === 0) { badge?.remove(); return; }
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "cust-sub-badge";
    item.appendChild(badge);
  }
  badge.textContent = total;
}

let custActiveUser = null;
let custActiveHari = "Senin";
let custActiveMenu = null;
let custActiveUnsub = null;
let custActiveRawData = [];

function showCustDetail(title, user = null, menu = null) {
  resetCustRightPanel();
  const empty   = document.getElementById("custDetailEmpty");
  const content = document.getElementById("custDetailContent");
  const titleEl = document.getElementById("custDetailTitle");

  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (titleEl) titleEl.textContent   = title;

  custActiveUser = user;
  custActiveMenu = menu;

  // init hari chips
  initCustHariChips();
  // tombol rolling — hanya untuk hunter
  const rollingBtn = document.getElementById("custRollingMapBtn");
  if (rollingBtn) {
    rollingBtn.style.display = user?.role === "hunter" ? "flex" : "none";
    const newRollingBtn = rollingBtn.cloneNode(true);
    rollingBtn.parentNode.replaceChild(newRollingBtn, rollingBtn);
    newRollingBtn.addEventListener("click", () => window.openMapRolling());
  }

  // init search
  const searchInput = document.getElementById("custSearchInput");
  const clearBtn    = document.getElementById("custSearchClear");
  if (searchInput) {
    const newInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newInput, searchInput);
    newInput.addEventListener("input", e => {
      if (clearBtn) clearBtn.style.display = e.target.value ? "flex" : "none";
      filterCustList(e.target.value);
    });
  }
  if (clearBtn) {
    const newClear = clearBtn.cloneNode(true);
    clearBtn.parentNode.replaceChild(newClear, clearBtn);
    newClear.addEventListener("click", () => {
      const inp = document.getElementById("custSearchInput");
      if (inp) inp.value = "";
      newClear.style.display = "none";
      filterCustList("");
    });
  }
  if (user) updateMarketingBadge(user.uid, user.role);
  subscribeCustActiveMarketing();
}
function initCustHariChips() {
  const chips = document.getElementById("custHariChips");
  if (!chips) return;

  // show/hide chips sesuai tipe
  const showChips = custActiveMenu === null;
  chips.style.display = showChips ? "flex" : "none";

  // reset semua badge dulu — nanti diisi ulang otomatis begitu data live datang
  chips.querySelectorAll(".cust-hari-badge").forEach(b => b.remove());

  chips.querySelectorAll(".cust-hari-chip").forEach(chip => {
    const newChip = chip.cloneNode(true);
    chip.parentNode.replaceChild(newChip, chip);
    newChip.addEventListener("click", () => {
      chips.querySelectorAll(".cust-hari-chip").forEach(c => c.classList.remove("active"));
      newChip.classList.add("active");
      custActiveHari = newChip.dataset.hari;
      renderActiveCustDataForHari();
    });
  });
}

function subscribeCustActiveMarketing() {
  const list = document.getElementById("custDetailList");
  if (!list) return;
  if (custActiveUnsub) { custActiveUnsub(); custActiveUnsub = null; }

  // skeleton
  list.innerHTML = [1,2,3].map(() => `
    <div class="cust-card-sk">
      <div class="sk" style="width:38px;height:38px;border-radius:10px;flex-shrink:0"></div>
      <div style="flex:1">
        <div class="sk" style="height:12px;width:120px;border-radius:6px;margin-bottom:6px"></div>
        <div class="sk" style="height:10px;width:80px;border-radius:6px"></div>
      </div>
    </div>`).join("");

  const role     = custActiveUser?.role;
  const uid      = custActiveUser?.uid;
  const idCabang = window.currentUser?.idCabang || "";
  if (!role || !uid || !idCabang) return;

  let q = null;
  if (role === "kurir") {
    q = window.query(
      window.collection(window.db, "customer"),
      window.where("pemilik",  "==", uid),
      window.where("idCabang", "==", idCabang),
      window.where("status",   "==", true)
    );
  } else if (role === "hunter") {
    q = window.query(
      window.collection(window.db, "users", uid, "customerBaruHunter"),
      window.where("idCabang",   "==", idCabang),
      window.where("diserahkan", "==", false)
    );
  } else if (role === "sales") {
    q = window.query(
      window.collection(window.db, "customerSales"),
      window.where("pemilik",    "==", uid),
      window.where("idCabang",   "==", idCabang),
      window.where("diserahkan", "==", false)
    );
  }
  if (!q) return;

  custActiveUnsub = window.onSnapshot(q, snap => {
    custActiveRawData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderActiveCustDataForHari();
    computeAndRenderHariBadges(custActiveRawData);
  }, err => {
    list.innerHTML = `<div class="dh-ringkasan-empty">Gagal memuat data</div>`;
  });
}
function renderActiveCustDataForHari() {
  const list = document.getElementById("custDetailList");
  if (!list) return;
  const filtered = custActiveRawData.filter(c => c.hari === custActiveHari);
  if (!filtered.length) {
    list.innerHTML = `<div class="dh-ringkasan-empty">Belum ada data</div>`;
    return;
  }
  renderCustCards(filtered);
}

function computeAndRenderHariBadges(data) {
  const HARI_LIST = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
  HARI_LIST.forEach(h => {
    const count = data.filter(c => c.hari === h).length;
    updateHariBadge(h, count);
  });
}
function updateHariBadge(hari, count) {
  const chips = document.getElementById("custHariChips");
  if (!chips) return;
  const chip = chips.querySelector(`.cust-hari-chip[data-hari="${hari}"]`);
  if (!chip) return;
  const existing = chip.querySelector(".cust-hari-badge");
  if (existing) existing.remove();
  if (count > 0) {
    const badge = document.createElement("span");
    badge.className = "cust-hari-badge";
    badge.textContent = count;
    chip.appendChild(badge);
  }
}

function renderCustCards(customers = []) {
  const list = document.getElementById("custDetailList");
  if (!list) return;

  list.innerHTML = customers.map(c => {
    const nama    = c.namaCustomer || c.nama || c.namaToko || "Tanpa Nama";
    const inisial = nama.trim().charAt(0).toUpperCase();
    const avatar  = c.foto
      ? `<img src="${esc(c.foto)}" alt="${esc(nama)}">`
      : inisial;
    const hasLokasi = (c.lokasiCustomer?.latitude || c.lokasiCustomer?._lat) && 
                      (c.lokasiCustomer?.longitude || c.lokasiCustomer?._long);
    return `
      <div class="cust-card" data-id="${esc(c.id)}">
        <div class="cust-card-avatar">${avatar}</div>
        <div class="cust-card-info">
          <div class="cust-card-nama">${esc(nama)}</div>
          <div class="cust-card-sub">${esc(c.alamatCustomer || "-")} · ${esc(c.hari || "-")}</div>
        </div>
        <div class="cust-card-actions">
          <button class="cust-card-del-btn" data-id="${esc(c.id)}" title="Non-Aktifkan">
            <i class="fa-solid fa-user-slash"></i>
          </button>
          ${hasLokasi ? `<button class="cust-card-map-btn" data-id="${esc(c.id)}" title="Lihat di Map">
            <i class="fa-solid fa-map-location-dot"></i>
          </button>` : ""}
          <i class="fa-solid fa-chevron-right cust-card-arrow"></i>
        </div>
      </div>`;
  }).join("");

  window._custCurrentList = customers;

  list.querySelectorAll(".cust-card").forEach(card => {
    card.addEventListener("click", e => {
      if (e.target.closest(".cust-card-map-btn")) return;
      if (e.target.closest(".cust-card-del-btn")) return;
      list.querySelectorAll(".cust-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      const id       = card.dataset.id;
      const customer = customers.find(c => c.id === id);
      if (!customer) return;
      const mapWrap = document.getElementById("mapRollingWrap");
      if (mapWrap) {
        window.closeMapRolling?.();
      }

      openCustDetail(customer);
    });
  });
  // init rolling drag — hanya saat mode rolling aktif
  list.querySelectorAll(".cust-card").forEach(card => {
    const id       = card.dataset.id;
    const customer = customers.find(c => c.id === id);
    if (customer) initRollingDrag(card, customer);
  });
  list.querySelectorAll(".cust-card-del-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const id       = btn.dataset.id;
      const customer = customers.find(c => c.id === id);
      if (!customer) return;
      konfirmasiNonAktif(customer, customers);
    });
  });
  list.querySelectorAll(".cust-card-map-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const id       = btn.dataset.id;
      const customer = customers.find(c => c.id === id);
      if (!customer) return;
      const lat = customer.lokasiCustomer?.latitude || customer.lokasiCustomer?._lat;
      const lng = customer.lokasiCustomer?.longitude || customer.lokasiCustomer?._long;
      if (!lat || !lng) return;
      window.openPetaGlobal({ id: customer.id, lat, lng });
    });
  });
}
function filterCustListByHari(hari) {
  const cards = document.querySelectorAll("#custDetailList .cust-card");
  cards.forEach(card => {
    if (!hari) { card.style.display = ""; return; }
    const sub = card.querySelector(".cust-card-sub")?.textContent || "";
    card.style.display = sub.includes(hari) ? "" : "none";
  });
}
function konfirmasiNonAktif(customer, customers) {
  const existing = document.getElementById("custNonAktifOverlay");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = "custNonAktifOverlay";
  el.className = "lap-frozen-overlay";
  el.innerHTML = `
    <div class="lap-frozen-box">
      <div class="lap-frozen-icon">⚠️</div>
      <div class="lap-frozen-title">Non-Aktifkan Customer?</div>
      <div class="lap-frozen-desc">${esc(customer.namaCustomer || "Customer ini")} akan dinonaktifkan dan tidak muncul di list aktif.</div>
      <div class="lap-frozen-footer">
        <button class="lap-frozen-btn-cancel" id="custNonAktifNo">Batal</button>
        <button class="lap-frozen-btn-save" id="custNonAktifYes">Non-Aktifkan</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById("custNonAktifNo").onclick  = () => el.remove();
  document.getElementById("custNonAktifYes").onclick = async () => {
    el.remove();
    await nonAktifkanCustomer(customer.id, customers);
  };
}

async function nonAktifkanCustomer(custId, customers) {
  try {
    await window.setDoc(
      window.doc(window.db, "customer", custId),
      { status: false, updatedAt: window.serverTimestamp() },
      { merge: true }
    );
    // hapus card dari list
    const card = document.querySelector(`#custDetailList .cust-card[data-id="${custId}"]`);
    if (card) card.remove();

    // update badge hari langsung dari DOM
    const remaining = document.querySelectorAll("#custDetailList .cust-card").length;
    updateHariBadge(custActiveHari, remaining);

    // update badge marketing dari IDB yang sudah terupdate
    if (custActiveUser) updateMarketingBadge(custActiveUser.uid, custActiveUser.role);
    window.showToast("Customer dinonaktifkan", "success");
  } catch (err) {
    window.showToast("Gagal menonaktifkan", "error");
  }
}
function openCustDetail(customer) {
  const empty   = document.getElementById("custRightEmpty");
  const content = document.getElementById("custRightContent");
  const title   = document.getElementById("custRightTitle");
  const body    = document.getElementById("custRightBody");

  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (title)   title.textContent     = customer.namaCustomer || "Detail Customer";

  // state edit sementara
  window._custEditData = { ...customer };

  if (body) body.innerHTML = `
    <!-- FOTO -->
    <div class="cust-edit-photo-wrap">
      <div class="cust-edit-photo" id="custEditPhoto">
        ${customer.foto
          ? `<img src="${esc(customer.foto)}" alt="foto">`
          : `<span>${(customer.namaCustomer||"?").charAt(0).toUpperCase()}</span>`}
        <div class="cust-edit-photo-overlay"><i class="fa-solid fa-camera"></i></div>
      </div>
    </div>

    <!-- FORM -->
    <div class="cust-edit-form">

      <div class="cust-edit-group">
        <label class="cust-edit-label">Nama Customer</label>
        <input type="text" class="cust-edit-input" id="custEditNama" value="${esc(customer.namaCustomer||"")}">
      </div>

      <div class="cust-edit-group">
        <label class="cust-edit-label">Alamat</label>
        <input type="text" class="cust-edit-input" id="custEditAlamat" value="${esc(customer.alamatCustomer||"")}">
      </div>

      <div class="cust-edit-group">
        <label class="cust-edit-label">Hari</label>
        <div class="cust-dropdown" id="custDropHari">
          <div class="cust-dropdown-trigger" id="custDropHariTrigger">
            <span id="custDropHariLabel">${esc(customer.hari||"Pilih Hari")}</span>
            <i class="fa-solid fa-chevron-down cust-dropdown-arrow"></i>
          </div>
          <div class="cust-dropdown-list" id="custDropHariList">
            ${["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"].map(h =>
              `<div class="cust-dropdown-item ${customer.hari === h ? "active" : ""}" data-val="${h}">${h}</div>`
            ).join("")}
          </div>
        </div>
      </div>

      <div class="cust-edit-group">
        <label class="cust-edit-label">Pemilik</label>
        <div class="cust-dropdown" id="custDropPemilik">
          <div class="cust-dropdown-trigger" id="custDropPemilikTrigger">
            <span id="custDropPemilikLabel">${esc((window.usersCache||[]).find(u=>u.uid===customer.pemilik)?.nama || customer.pemilik || "Pilih Pemilik")}</span>
            <i class="fa-solid fa-chevron-down cust-dropdown-arrow"></i>
          </div>
          <div class="cust-dropdown-list" id="custDropPemilikList">
            ${(window.usersCache||[]).filter(u=>["kurir","hunter","sales"].includes(u.role)).map(u =>
              `<div class="cust-dropdown-item ${customer.pemilik === u.uid ? "active" : ""}" data-val="${esc(u.uid)}">${esc(u.nama||"Tanpa Nama")}</div>`
            ).join("")}
          </div>
        </div>
      </div>

      <div class="cust-edit-group">
        <label class="cust-edit-label">Data Kemarin</label>
        <div class="cust-dk-chips">
          ${(custActiveUser?.varian || [])
            .filter(v => { const k = Object.keys(v)[0]; return k && v[k]?.isAktif; })
            .map(v => {
              const k   = Object.keys(v)[0];
              const qty = customer.dataKemarin?.[k]?.qty ?? 0;
              return `<div class="cust-dk-chip ${qty > 0 ? "active" : ""}">
                <span class="cust-dk-chip-key">${esc(k)}</span>
                <span class="cust-dk-chip-val">${qty}</span>
              </div>`;
            }).join("")}
        </div>
      </div>

      <!-- STATUS READ ONLY + ISNEW TOGGLE -->
      <div class="cust-edit-toggles">
        <div class="cust-toggle-item">
          <div class="cust-toggle-info">
            <div class="cust-toggle-label">Status</div>
          </div>
          <div class="cust-status-badge ${customer.status ? "aktif" : "nonaktif"}">
            <i class="fa-solid ${customer.status ? "fa-circle-check" : "fa-circle-xmark"}"></i>
            ${customer.status ? "Aktif" : "Non Aktif"}
          </div>
        </div>
        <div class="cust-toggle-item">
          <div class="cust-toggle-info">
            <div class="cust-toggle-label">Tipe Customer</div>
            <div class="cust-toggle-desc" id="custToggleNewDesc">${customer.isNew ? "Baru" : "Lama"}</div>
          </div>
          <div class="cust-toggle-switch ${customer.isNew ? "on" : ""}" id="custToggleNew"></div>
        </div>
      </div>

    </div>

    <!-- SIMPAN -->
    <div class="cust-edit-footer">
      <button class="cust-edit-save-btn" id="custEditSaveBtn">
        <i class="fa-solid fa-floppy-disk"></i> Simpan
      </button>
    </div>
  `;
  // init foto upload
  const photoEl = document.getElementById("custEditPhoto");
  if (photoEl) {
    photoEl.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = "image/*";
      input.addEventListener("change", async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const compressed = await window.compressImage(file, { maxSize: 600, quality: 0.6 });
          const ext        = file.name.split(".").pop() || "jpg";
          const path       = `fotoCustomer/${customer.id}_${Date.now()}.${ext}`;
          const ref        = window.storageRef(window.storage, path);

          // tampil progress
          photoEl.innerHTML = `
            <div class="cust-photo-progress-wrap">
              <div class="cust-photo-progress-ring">
                <svg viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border-card)" stroke-width="3"/>
                  <circle cx="18" cy="18" r="15" fill="none" stroke="var(--brand-primary)" stroke-width="3"
                    stroke-dasharray="94" stroke-dashoffset="94"
                    stroke-linecap="round" id="custPhotoProgressCircle"
                    style="transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset .2s"/>
                </svg>
                <span class="cust-photo-progress-pct" id="custPhotoProgressPct">0%</span>
              </div>
            </div>`;

          await new Promise((resolve, reject) => {
            const task = window.uploadBytesResumable(ref, compressed);
            task.on("state_changed",
              snap => {
                const pct    = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
                const offset = 94 - (94 * pct / 100);
                const circle = document.getElementById("custPhotoProgressCircle");
                const pctEl  = document.getElementById("custPhotoProgressPct");
                if (circle) circle.style.strokeDashoffset = offset;
                if (pctEl)  pctEl.textContent = pct + "%";
              },
              err => reject(err),
              () => resolve()
            );
          });

          const url = await window.getDownloadURL(ref);
          photoEl.innerHTML = `
            <img src="${url}" alt="foto">
            <div class="cust-edit-photo-overlay"><i class="fa-solid fa-camera"></i></div>`;

          window._custEditData.foto = url;
          window.showToast("Foto diperbarui", "success");
        } catch (err) {
          window.showToast("Gagal upload foto", "error");
        }
      });
      input.click();
    });
  }
  // init dropdown hari
  initCustDropdown("custDropHari", "custDropHariTrigger", "custDropHariLabel", "custDropHariList", val => {
    window._custEditData.hari = val;
  });

  // init dropdown pemilik
  initCustDropdown("custDropPemilik", "custDropPemilikTrigger", "custDropPemilikLabel", "custDropPemilikList", val => {
    window._custEditData.pemilik = val;
  });
  // init toggle isNew
  const toggleNew = document.getElementById("custToggleNew");
  toggleNew?.addEventListener("click", () => {
    window._custEditData.isNew = !window._custEditData.isNew;
    toggleNew.classList.toggle("on", window._custEditData.isNew);
    document.getElementById("custToggleNewDesc").textContent = window._custEditData.isNew ? "Baru" : "Lama";
  });

  // simpan
  document.getElementById("custEditSaveBtn")?.addEventListener("click", () => simpanCustEdit(customer.id));

  if (window.innerWidth <= 768) {
    document.getElementById("custRightPanel")?.classList.add("show");
    const bottomNav = document.getElementById("bottomNav");
    if (bottomNav) {
      bottomNav.style.transform = "translateY(100%)";
      setTimeout(() => { bottomNav.style.display = "none"; }, 250);
    }
  }
}
function filterCustList(query) {
  const cards = document.querySelectorAll("#custDetailList .cust-card");
  cards.forEach(card => {
    const nama = card.querySelector(".cust-card-nama")?.textContent?.toLowerCase() || "";
    card.style.display = nama.includes(query.toLowerCase()) ? "" : "none";
  });
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function esc(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function initCustDropdown(wrapperId, triggerId, labelId, listId, onChange) {
  const wrapper = document.getElementById(wrapperId);
  const trigger = document.getElementById(triggerId);
  const list    = document.getElementById(listId);

  trigger?.addEventListener("click", e => {
    e.stopPropagation();
    wrapper?.classList.toggle("open");
  });

  list?.querySelectorAll(".cust-dropdown-item").forEach((item, idx, arr) => {
    item.setAttribute("tabindex", "0");
    item.addEventListener("click", () => {
      list.querySelectorAll(".cust-dropdown-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      document.getElementById(labelId).textContent = item.textContent.trim();
      onChange?.(item.dataset.val);
      wrapper?.classList.remove("open");
    });
    item.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); item.click(); }
      if (e.key === "ArrowDown") { e.preventDefault(); arr[idx+1]?.focus(); }
      if (e.key === "ArrowUp")   { e.preventDefault(); arr[idx-1]?.focus(); }
    });
  });

  document.addEventListener("click", e => {
    if (!wrapper?.contains(e.target)) wrapper?.classList.remove("open");
  });
}

async function simpanCustEdit(custId) {
  const btn = document.getElementById("custEditSaveBtn");
  if (!btn) return;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

  try {
    const d = window._custEditData;
    const updateData = {
      namaCustomer:   document.getElementById("custEditNama")?.value?.trim()   || d.namaCustomer,
      alamatCustomer: document.getElementById("custEditAlamat")?.value?.trim() || d.alamatCustomer,
      hari:      d.hari,
      pemilik:   d.pemilik,
      isNew:     d.isNew,
      foto:      d.foto || "",
      updatedAt: window.serverTimestamp()
    };

    // 1. simpan ke Firestore
    await window.setDoc(
      window.doc(window.db, "customer", custId),
      updateData,
      { merge: true }
    );
    // 2. update card di list
    const card = document.querySelector(`#custDetailList .cust-card[data-id="${custId}"]`);
    if (card) {
      const nama    = updateData.namaCustomer || "Tanpa Nama";
      const inisial = nama.trim().charAt(0).toUpperCase();
      const avatarEl = card.querySelector(".cust-card-avatar");
      const namaEl   = card.querySelector(".cust-card-nama");
      const subEl    = card.querySelector(".cust-card-sub");
      if (avatarEl) avatarEl.innerHTML = updateData.foto
        ? `<img src="${updateData.foto}" alt="${esc(nama)}">`
        : inisial;
      if (namaEl) namaEl.textContent = nama;
      if (subEl)  subEl.textContent  = updateData.alamatCustomer || updateData.hari || "-";
    }

    // 3. update title panel kanan
    const titleEl = document.getElementById("custRightTitle");
    if (titleEl) titleEl.textContent = updateData.namaCustomer || "Detail Customer";

    window.showToast("Berhasil disimpan", "success");
  } catch (err) {
    window.showToast("Gagal menyimpan", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan`;
  }
}

// ── TAMBAH CUSTOMER ──
document.getElementById("topbarTambahCustomer")?.addEventListener("click", () => {
  openCustAddModal();
});

async function openCustAddModal() {
  const overlay = document.getElementById("custAddOverlay");
  if (!overlay) return;

  // pertahankan state jika sudah ada
  if (!window._custAddData) {
    window._custAddData = { foto: null, pemilik: null, hari: null, dataKemarin: {} };
  }

  // render form
  const body = document.getElementById("custAddBody");
  if (body) body.innerHTML = `
    <div class="cust-add-photo-wrap">
      <div class="cust-add-photo" id="custAddPhoto">
        <div class="cust-add-photo-placeholder">
          <i class="fa-solid fa-camera"></i>
          <span>Tambah Foto</span>
        </div>
        <div class="cust-edit-photo-overlay"><i class="fa-solid fa-camera"></i></div>
      </div>
    </div>

    <div class="cust-edit-form">

      <div class="cust-edit-group">
        <label class="cust-edit-label">Nama Customer</label>
        <input type="text" class="cust-edit-input" id="custAddNama" placeholder="Nama customer...">
      </div>

      <div class="cust-edit-group">
        <label class="cust-edit-label">Alamat</label>
        <input type="text" class="cust-edit-input" id="custAddAlamat" placeholder="Alamat customer...">
      </div>

      <div class="cust-edit-group">
        <label class="cust-edit-label">Pemilik</label>
        <div class="cust-dropdown" id="custAddDropPemilik">
          <div class="cust-dropdown-trigger" id="custAddDropPemilikTrigger">
            <span id="custAddDropPemilikLabel">${window._custAddData?.pemilik ? ((window.usersCache||[]).find(u=>u.uid===window._custAddData.pemilik)?.nama || "Pilih Pemilik") : "Pilih Pemilik"}</span>
            <i class="fa-solid fa-chevron-down cust-dropdown-arrow"></i>
          </div>
          <div class="cust-dropdown-list" id="custAddDropPemilikList">
            ${(window.usersCache||[])
              .filter(u => u.role === "kurir")
              .map(u => `<div class="cust-dropdown-item" data-val="${esc(u.uid)}">
                ${esc(u.nama||"Tanpa Nama")}
              </div>`).join("")}
          </div>
        </div>
      </div>

      <div class="cust-edit-group">
        <label class="cust-edit-label">Hari</label>
        <div class="cust-dropdown" id="custAddDropHari">
          <div class="cust-dropdown-trigger" id="custAddDropHariTrigger">
            <span id="custAddDropHariLabel">${window._custAddData?.hari || "Pilih Hari"}</span>
            <i class="fa-solid fa-chevron-down cust-dropdown-arrow"></i>
          </div>
          <div class="cust-dropdown-list" id="custAddDropHariList">
            ${["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"].map(h =>
              `<div class="cust-dropdown-item" data-val="${h}">${h}</div>`
            ).join("")}
          </div>
        </div>
      </div>

      <div class="cust-edit-group">
        <label class="cust-edit-label">Data Kemarin</label>
        <div class="cust-dk-grid" id="custAddDkGrid">
          <div style="font-size:12px;color:var(--text-muted)">Memuat varian...</div>
        </div>
      </div>

    </div>

    <div class="cust-edit-footer">
      <button class="cust-edit-save-btn" id="custAddSaveBtn" disabled>
        <i class="fa-solid fa-floppy-disk"></i> Simpan
      </button>
    </div>`;

  // load varian dari user kurir pertama yang ada
  const kurirUser = (window.usersCache||[]).find(u => u.role === "kurir");
  const varian = (kurirUser?.varian || []).filter(v => {
    const k = Object.keys(v)[0]; return k && v[k]?.isAktif;
  });
  const dkGrid = document.getElementById("custAddDkGrid");
  if (dkGrid) {
    if (varian.length) {
      dkGrid.innerHTML = varian.map(v => {
        const k = Object.keys(v)[0];
        return `<div class="cust-dk-chip-input">
          <label class="cust-dk-chip-label">${esc(k)}</label>
          <input type="number" class="cust-dk-input" data-varian="${esc(k)}" 
            value="${window._custAddData?.dataKemarin?.[k] || ""}" 
            min="0" placeholder="0">
        </div>`;
      }).join("");
    } else {
      dkGrid.innerHTML = `<div style="font-size:12px;color:var(--text-muted)">Tidak ada varian</div>`;
    }
  }

  // init dropdown pemilik
  initCustDropdown("custAddDropPemilik","custAddDropPemilikTrigger","custAddDropPemilikLabel","custAddDropPemilikList", val => {
    window._custAddData.pemilik = val;
    checkCustAddValid();
  });

  // init dropdown hari
  initCustDropdown("custAddDropHari","custAddDropHariTrigger","custAddDropHariLabel","custAddDropHariList", val => {
    window._custAddData.hari = val;
    checkCustAddValid();
  });
  // simpan state dataKemarin saat input + enter pindah fokus
  const dkInputs = [...(document.getElementById("custAddDkGrid")?.querySelectorAll(".cust-dk-input") || [])];
  dkInputs.forEach((input, i) => {
    input.addEventListener("input", () => {
      window._custAddData.dataKemarin[input.dataset.varian] = Number(input.value) || 0;
    });
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        const next = dkInputs[i + 1];
        if (next) next.focus();
        else document.getElementById("custAddNama")?.focus();
      }
    });
  });

  // enter di nama pindah ke alamat
  document.getElementById("custAddNama")?.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); document.getElementById("custAddAlamat")?.focus(); }
  });

  // enter di alamat buka dropdown pemilik
  document.getElementById("custAddAlamat")?.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("custAddDropPemilik")?.classList.add("open");
      document.getElementById("custAddDropPemilikList")?.querySelector(".cust-dropdown-item")?.focus();
    }
  });
  // validasi nama
  document.getElementById("custAddNama")?.addEventListener("input", checkCustAddValid);
  // simpan
  document.getElementById("custAddSaveBtn")?.addEventListener("click", simpanCustBaru);
  // foto upload
  const photoEl = document.getElementById("custAddPhoto");
  if (photoEl) {
    photoEl.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = "image/*";
      input.addEventListener("change", async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const compressed = await window.compressImage(file, { maxSize: 600, quality: 0.6 });
          const ext  = file.name.split(".").pop() || "jpg";
          const path = `fotoCustomer/new_${Date.now()}.${ext}`;
          const ref  = window.storageRef(window.storage, path);

          photoEl.innerHTML = `
            <div class="cust-photo-progress-wrap">
              <div class="cust-photo-progress-ring">
                <svg viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border-card)" stroke-width="3"/>
                  <circle cx="18" cy="18" r="15" fill="none" stroke="var(--brand-primary)" stroke-width="3"
                    stroke-dasharray="94" stroke-dashoffset="94" stroke-linecap="round"
                    id="custAddProgressCircle"
                    style="transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset .2s"/>
                </svg>
                <span class="cust-photo-progress-pct" id="custAddProgressPct">0%</span>
              </div>
            </div>`;

          await new Promise((resolve, reject) => {
            const task = window.uploadBytesResumable(ref, compressed);
            task.on("state_changed",
              snap => {
                const pct    = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
                const offset = 94 - (94 * pct / 100);
                document.getElementById("custAddProgressCircle")?.style.setProperty("stroke-dashoffset", offset);
                const pctEl = document.getElementById("custAddProgressPct");
                if (pctEl) pctEl.textContent = pct + "%";
              },
              err => reject(err),
              () => resolve()
            );
          });

          const url = await window.getDownloadURL(ref);
          photoEl.innerHTML = `
            <img src="${url}" alt="foto" style="width:100%;height:100%;object-fit:cover">
            <div class="cust-edit-photo-overlay"><i class="fa-solid fa-camera"></i></div>`;
          window._custAddData.foto = url;
        } catch (err) {
          window.showToast("Gagal upload foto", "error");
        }
      });
      input.click();
    });
  }

  overlay.style.display = "flex";
  requestAnimationFrame(() => overlay.classList.add("show"));

  const closeBtn = document.getElementById("custAddClose");
  if (closeBtn) {
    const newClose = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newClose, closeBtn);
    newClose.addEventListener("click", closeCustAddModal);
  }
  overlay.onclick = e => { if (e.target === overlay) closeCustAddModal(); };

  // swipe down to close — mobile
  if (window.innerWidth <= 768) {
    const box = document.getElementById("custAddBox");
    let startY = 0, curY = 0, dragging = false;
    box.addEventListener("touchstart", e => {
      startY = curY = e.touches[0].clientY;
      dragging = true;
      box.style.transition = "none";
    }, { passive: true });
    box.addEventListener("touchmove", e => {
      if (!dragging) return;
      curY = e.touches[0].clientY;
      const dy = curY - startY;
      if (dy < 0) return;

      // cek apakah body masih bisa scroll ke atas
      const body = document.getElementById("custAddBody");
      if (body && body.scrollTop > 0) {
        dragging = false;
        box.style.transform = "";
        return;
      }

      box.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    box.addEventListener("touchend", () => {
      dragging = false;
      box.style.transition = "transform .3s cubic-bezier(.32,1,.23,1)";
      if (curY - startY > 120) {
        box.style.transform = "translateY(100%)";
        setTimeout(() => closeCustAddModal(), 300);
      } else {
        box.style.transform = "";
      }
    });
  }
}
async function simpanCustBaru() {
  const btn = document.getElementById("custAddSaveBtn");
  if (!btn) return;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

  try {
    const d          = window._custAddData;
    const nama       = document.getElementById("custAddNama")?.value?.trim();
    const alamat     = document.getElementById("custAddAlamat")?.value?.trim() || "";
    const adminUid   = window.auth?.currentUser?.uid;
    const idCabang   = window.currentUser?.idCabang || "";

    // dataKemarin
    const dataKemarin = {};
    document.querySelectorAll("#custAddDkGrid .cust-dk-input").forEach(input => {
      const k = input.dataset.varian;
      dataKemarin[k] = { qty: Number(input.value) || 0 };
    });

    const newId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    const data  = {
      namaCustomer:   nama,
      alamatCustomer: alamat,
      foto:           d.foto || "",
      hari:           d.hari,
      pemilik:        d.pemilik,
      idCabang,
      status:         true,
      isNew:          true,
      lokasiCustomer: { latitude: 0, longitude: 0 },
      jarak:          0,
      dataKemarin,
      createdBy:      adminUid,
      createdAt:      new Date().toISOString(),
      updatedAt:      window.serverTimestamp(),
    };
    // cek duplikat nama langsung dari Firestore (se-cabang)
    try {
      const namaLower = nama.toLowerCase().trim();
      const [snapCust, snapSales, snapHunter] = await Promise.all([
        window.getDocs(window.query(window.collection(window.db, "customer"), window.where("idCabang", "==", idCabang))),
        window.getDocs(window.query(window.collection(window.db, "customerSales"), window.where("idCabang", "==", idCabang))),
        window.getDocs(window.query(window.collectionGroup(window.db, "customerBaruHunter"), window.where("idCabang", "==", idCabang))),
      ]);
      const semuaDoc = [...snapCust.docs, ...snapSales.docs, ...snapHunter.docs];
      const duplikat = semuaDoc.some(d => (d.data().namaCustomer || "").toLowerCase().trim() === namaLower);
      if (duplikat) {
        window.showToast("Nama customer sudah ada, ganti dengan yang lain", "error", 3000);
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan`;
        return;
      }
    } catch (err) {}

    // simpan ke Firestore
    await window.setDoc(
      window.doc(window.db, "customer", newId),
      data
    );

    // update badge hari
    if (custActiveUser?.uid === d.pemilik && custActiveHari === d.hari) {
      const remaining = document.querySelectorAll("#custDetailList .cust-card").length + 1;
      updateHariBadge(d.hari, remaining);
    }
    // update badge marketing
    await updateMarketingBadge(d.pemilik, "kurir");
    window.showToast("Customer berhasil ditambah", "success");
    // pertahankan pemilik dan hari, reset yang lain
    window._custAddData = {
      foto: null,
      pemilik: d.pemilik,
      hari: d.hari,
      dataKemarin: {}
    };
    closeCustAddModal();
  } catch (err) {
    window.showToast("Gagal menyimpan", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan`;
  }
}

function checkCustAddValid() {
  const nama    = document.getElementById("custAddNama")?.value?.trim();
  const btn     = document.getElementById("custAddSaveBtn");
  const valid   = !!(nama && window._custAddData?.pemilik && window._custAddData?.hari);
  if (btn) btn.disabled = !valid;
}
function closeCustAddModal() {
  const overlay = document.getElementById("custAddOverlay");
  if (!overlay) return;
  overlay.classList.remove("show");
  setTimeout(() => { overlay.style.display = "none"; }, 300);
}
