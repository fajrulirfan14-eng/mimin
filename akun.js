/* ── AKUN VIEW ── */
let akunSelectedUid  = null;
let akunAllUsers     = [];
let akunSearchQuery  = "";
let akunRoleFilter   = "semua";
let akunTambahRole   = "";

window.initAkunView = async function() {
  await loadAkunList();
  initAkunSearch();
  initAkunTabs();
  initAkunTambah();
  initAkunDetail();
};

/* ── LOAD LIST ── */
async function loadAkunList() {
  const listEl = document.getElementById("akunList");
  if (!listEl) return;
  listEl.innerHTML = `<div class="dh-ringkasan-empty">Memuat...</div>`;

  try {
    const kantorCabang = await window.idb.getKantorCabang();
    const idCabang     = kantorCabang?.id || "";
    const adminUid     = window.auth?.currentUser?.uid;

    const snap = await window.getDocs(window.query(
      window.collection(window.db, "users"),
      window.where("idCabang", "==", idCabang),
      window.where("createdBy", "==", adminUid)
    ));

    akunAllUsers = snap.docs.map(d => ({ ...d.data(), uid: d.id })).filter(u => u.uid !== adminUid);

    // update usersCache juga
    window.usersCache = [...(window.usersCache||[]).filter(u => u.idCabang !== idCabang), ...akunAllUsers];

    renderAkunList();
  } catch (err) {
    console.error("❌ loadAkunList:", err);
    document.getElementById("akunList").innerHTML = `<div class="dh-ringkasan-empty">Gagal memuat</div>`;
  }
}

/* ── RENDER LIST ── */
function renderAkunList() {
  const listEl = document.getElementById("akunList");
  if (!listEl) return;

  let filtered = akunAllUsers;
  if (akunRoleFilter !== "semua") filtered = filtered.filter(u => u.role === akunRoleFilter);
  if (akunSearchQuery) filtered = filtered.filter(u => (u.nama||"").toLowerCase().includes(akunSearchQuery));

  if (!filtered.length) {
    listEl.innerHTML = `<div class="dh-ringkasan-empty">Tidak ada akun</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(u => {
    const isAktif    = u.status !== false;
    const badgeClass = isAktif ? "aktif" : "nonaktif";
    const badgeText  = isAktif ? "Aktif" : "Nonaktif";
    const foto       = u.foto || "";
    return `
      <div class="akun-card ${akunSelectedUid === u.uid ? "active" : ""}" data-uid="${u.uid}">
        <img class="akun-card-foto" src="${foto || "https://ui-avatars.com/api/?name="+encodeURIComponent(u.nama||"?")+"&background=random"}" alt="">
        <div class="akun-card-info">
          <div class="akun-card-nama">${u.nama||"-"}</div>
          <div class="akun-card-role">${u.role||"-"}</div>
        </div>
        <div class="akun-card-badge ${badgeClass}">${badgeText}</div>
      </div>`;
  }).join("");

  listEl.querySelectorAll(".akun-card").forEach(card => {
    card.addEventListener("click", () => {
      akunSelectedUid = card.dataset.uid;
      const user = akunAllUsers.find(u => u.uid === akunSelectedUid);
      if (user) openAkunDetail(user);
      renderAkunList();
    });
  });
}

/* ── SEARCH ── */
function initAkunSearch() {
  document.getElementById("akunSearchInput")?.addEventListener("input", e => {
    akunSearchQuery = e.target.value.toLowerCase().trim();
    renderAkunList();
  });
}

/* ── TABS ── */
function initAkunTabs() {
  document.querySelectorAll(".akun-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".akun-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      akunRoleFilter = tab.dataset.role;
      renderAkunList();
    });
  });
}

/* ── DETAIL ── */
function openAkunDetail(user) {
  document.getElementById("akunEmptyState").style.display = "none";
  document.getElementById("akunDetail").style.display     = "flex";
  document.getElementById("akunPanelRight")?.classList.add("show");

  const isAktif = user.status !== false;
  document.getElementById("akunDetailFoto").src    = user.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nama||"?")}&background=random`;
  document.getElementById("akunDetailNama").textContent  = user.nama || "-";
  document.getElementById("akunDetailRole").textContent  = user.role || "-";

  const statusEl = document.getElementById("akunDetailStatus");
  statusEl.textContent  = isAktif ? "Aktif" : "Nonaktif";
  statusEl.className    = `akun-detail-status ${isAktif ? "aktif" : "nonaktif"}`;

  document.getElementById("akunInputNama").value    = user.nama     || "";
  document.getElementById("akunInputEmail").value   = user.email    || "";
  document.getElementById("akunInputTelpon").value  = user.noTelpon || "";
  document.getElementById("akunInputNik").value     = user.nik      || "";
  document.getElementById("akunInputAlamat").value  = user.alamat   || "";
  document.getElementById("akunInputMotivasi").value = user.motivasi || "";

  const toggleBtn = document.getElementById("akunToggleStatusBtn");
  toggleBtn.textContent = isAktif ? "Nonaktifkan" : "Aktifkan";
  toggleBtn.className   = isAktif ? "akun-btn-toggle" : "akun-btn-toggle akun-btn-aktifkan";
}

function initAkunDetail() {
  // back btn mobile
  document.getElementById("akunBackBtn")?.addEventListener("click", () => {
    document.getElementById("akunPanelRight")?.classList.remove("show");
    akunSelectedUid = null;
    renderAkunList();
  });

  // foto change
  document.getElementById("akunFotoChangeBtn")?.addEventListener("click", () => {
    document.getElementById("akunFotoInput")?.click();
  });
  document.getElementById("akunFotoInput")?.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file || !akunSelectedUid) return;
    await uploadAkunFoto(file);
  });

  // simpan
  document.getElementById("akunSaveBtn")?.addEventListener("click", simpanAkunDetail);

  // toggle status
  document.getElementById("akunToggleStatusBtn")?.addEventListener("click", toggleAkunStatus);

  // reset password
  document.getElementById("akunResetPasswordBtn")?.addEventListener("click", resetAkunPassword);
}

/* ── SIMPAN DETAIL ── */
async function simpanAkunDetail() {
  if (!akunSelectedUid) return;
  const btn    = document.getElementById("akunSaveBtn");
  const detail = document.getElementById("akunDetail");
  btn.disabled = true; btn.textContent = "Menyimpan...";
  detail?.classList.add("akun-saving");
  try {
    const payload = {
      nama:      document.getElementById("akunInputNama").value.trim(),
      noTelpon:  document.getElementById("akunInputTelpon").value.trim(),
      nik:       document.getElementById("akunInputNik").value.trim(),
      alamat:    document.getElementById("akunInputAlamat").value.trim(),
      motivasi:  document.getElementById("akunInputMotivasi").value.trim(),
      updatedAt: window.serverTimestamp(),
    };

    await window.setDoc(window.doc(window.db, "users", akunSelectedUid), payload, { merge: true });

    // update local cache
    const idx = akunAllUsers.findIndex(u => u.uid === akunSelectedUid);
    if (idx !== -1) { akunAllUsers[idx] = { ...akunAllUsers[idx], ...payload }; }
    window.usersCache = window.usersCache?.map(u => u.uid === akunSelectedUid ? { ...u, ...payload } : u);

    // sync IDB
    const updatedUser = akunAllUsers[idx] || {};
    await window.idb.saveUser(updatedUser);

    document.getElementById("akunDetailNama").textContent = payload.nama;
    renderAkunList();
    window.showToast("Berhasil disimpan", "success");
  } catch (err) {
    console.error("❌ simpanAkunDetail:", err);
    window.showToast("Gagal menyimpan", "error");
  } finally {
    btn.disabled = false; btn.textContent = "Simpan";
    detail?.classList.remove("akun-saving");
  }
}

/* ── TOGGLE STATUS ── */
async function toggleAkunStatus() {
  if (!akunSelectedUid) return;
  const user    = akunAllUsers.find(u => u.uid === akunSelectedUid);
  const isAktif = user?.status !== false;
  const confirm = await showAkunKonfirmasi(
    isAktif ? "Nonaktifkan akun ini?" : "Aktifkan akun ini?"
  );
  if (!confirm) return;

  try {
    await window.setDoc(
      window.doc(window.db, "users", akunSelectedUid),
      { status: !isAktif }, { merge: true }
    );
    const idx = akunAllUsers.findIndex(u => u.uid === akunSelectedUid);
    if (idx !== -1) akunAllUsers[idx].status = !isAktif;
    window.usersCache = window.usersCache?.map(u => u.uid === akunSelectedUid ? { ...u, status: !isAktif } : u);
    openAkunDetail(akunAllUsers[idx]);
    renderAkunList();
    window.showToast(!isAktif ? "Akun diaktifkan" : "Akun dinonaktifkan", "success");
  } catch (err) {
    console.error("❌ toggleAkunStatus:", err);
    window.showToast("Gagal mengubah status", "error");
  }
}

/* ── RESET PASSWORD ── */
async function resetAkunPassword() {
  if (!akunSelectedUid) return;
  const user = akunAllUsers.find(u => u.uid === akunSelectedUid);
  if (!user?.email) { window.showToast("Email tidak ditemukan", "error"); return; }

  const confirm = await showAkunKonfirmasi(`Kirim reset password ke ${user.email}?`);
  if (!confirm) return;

  try {
    await window.sendPasswordResetEmail(window.auth, user.email);
    window.showToast("Email reset password terkirim", "success");
  } catch (err) {
    console.error("❌ resetPassword:", err);
    window.showToast("Gagal kirim email reset", "error");
  }
}

/* ── UPLOAD FOTO ── */
async function uploadAkunFoto(file) {
  try {
    const compressed = await window.compressImage(file, 400, 0.7);
    const path       = `fotoUsers/${akunSelectedUid}`;
    const ref        = window.storageRef(window.storage, path);
    await window.uploadBytes(ref, compressed);
    const url = await window.getDownloadURL(ref);

    await window.setDoc(window.doc(window.db, "users", akunSelectedUid), { foto: url }, { merge: true });

    document.getElementById("akunDetailFoto").src = url;
    const idx = akunAllUsers.findIndex(u => u.uid === akunSelectedUid);
    if (idx !== -1) akunAllUsers[idx].foto = url;
    window.usersCache = window.usersCache?.map(u => u.uid === akunSelectedUid ? { ...u, foto: url } : u);
    renderAkunList();
    window.showToast("Foto berhasil diupload", "success");
  } catch (err) {
    console.error("❌ uploadAkunFoto:", err);
    window.showToast("Gagal upload foto", "error");
  }
}

/* ── TAMBAH AKUN ── */
function initAkunTambah() {
  document.getElementById("akunTambahBtn")?.addEventListener("click", () => {
    document.getElementById("akunTambahOverlay")?.classList.add("show");
    akunTambahRole = "";
    document.getElementById("akunTambahRoleLabel").textContent = "Pilih role";
    document.getElementById("akunTambahNama").value    = "";
    document.getElementById("akunTambahEmail").value   = "";
    document.getElementById("akunTambahPassword").value = "";
    document.getElementById("akunTambahTelpon").value  = "";
    document.getElementById("akunTambahNik").value     = "";
    document.getElementById("akunTambahAlamat").value  = "";
  });

  document.getElementById("akunTambahClose")?.addEventListener("click", () => {
    document.getElementById("akunTambahOverlay")?.classList.remove("show");
  });
  document.getElementById("akunTambahOverlay")?.addEventListener("click", e => {
    if (e.target.id === "akunTambahOverlay") e.currentTarget.classList.remove("show");
  });

  // role dropdown
  const roleBtn = document.getElementById("akunTambahRoleBtn");
  const roleDD  = document.getElementById("akunTambahRoleDropdown");
  roleBtn?.addEventListener("click", e => {
    e.stopPropagation();
    roleDD.style.display = roleDD.style.display === "none" ? "block" : "none";
  });
  roleDD?.querySelectorAll(".akun-select-option").forEach(opt => {
    opt.addEventListener("click", () => {
      akunTambahRole = opt.dataset.role;
      document.getElementById("akunTambahRoleLabel").textContent = opt.textContent;
      roleDD.style.display = "none";
    });
  });
  document.addEventListener("click", () => { if (roleDD) roleDD.style.display = "none"; });

  document.getElementById("akunTambahSave")?.addEventListener("click", tambahAkun);
}

async function tambahAkun() {
  const btn   = document.getElementById("akunTambahSave");
  const nama  = document.getElementById("akunTambahNama").value.trim();
  const email = document.getElementById("akunTambahEmail").value.trim();
  const pass  = document.getElementById("akunTambahPassword").value.trim();

  if (!nama || !email || !pass || !akunTambahRole) {
    window.showToast("Lengkapi semua field", "error"); return;
  }

  btn.disabled = true; btn.textContent = "Membuat akun...";

  try {
    const kantorCabang = await window.idb.getKantorCabang();
    const adminUid     = window.auth?.currentUser?.uid;

    // buat akun via secondary app supaya admin tidak logout
    const secondaryApp  = window.initializeApp(window.firebaseConfig, "secondary-akun");
    const secondaryAuth = window.getAuth(secondaryApp);
    const cred          = await window.createUserWithEmailAndPassword(secondaryAuth, email, pass);
    const newUid        = cred.user.uid;
    await window.signOut(secondaryAuth);
    await window.deleteApp(secondaryApp);

    const payload = {
      uid:          newUid,
      nama,
      email,
      role:         akunTambahRole,
      idCabang:     kantorCabang?.id         || "",
      kantorCabang: kantorCabang?.namaCabang || "",
      noTelpon:     document.getElementById("akunTambahTelpon").value.trim(),
      nik:          document.getElementById("akunTambahNik").value.trim(),
      alamat:       document.getElementById("akunTambahAlamat").value.trim(),
      foto:         "",
      motivasi:     "",
      status:       true,
      createdBy:    adminUid,
      createdAt:    window.serverTimestamp(),
    };

    await window.setDoc(window.doc(window.db, "users", newUid), payload);
    await window.setDoc(window.doc(window.db, "akun", newUid), {
      uid:      newUid,
      role:     akunTambahRole,
      password: pass,
      email,
      idCabang: kantorCabang?.id || "",
    });

    akunAllUsers.push(payload);
    if (window.usersCache) window.usersCache.push(payload);
    await window.idb.saveUser(payload);
    renderAkunList();
    document.getElementById("akunTambahOverlay")?.classList.remove("show");
    window.showToast("Akun berhasil dibuat", "success");
  } catch (err) {
    console.error("❌ tambahAkun:", err);
    const msg = err.code === "auth/email-already-in-use" ? "Email sudah dipakai" : "Gagal membuat akun";
    window.showToast(msg, "error");
  } finally {
    btn.disabled = false; btn.textContent = "Buat Akun";
  }
}

/* ── KONFIRMASI POPUP ── */
function showAkunKonfirmasi(pesan) {
  return new Promise(resolve => {
    document.getElementById("akunKonfirmasiOverlay")?.remove();
    const el = document.createElement("div");
    el.id = "akunKonfirmasiOverlay";
    el.className = "amplop-konfirmasi-overlay";
    el.innerHTML = `
      <div class="amplop-konfirmasi-box">
        <div class="amplop-konfirmasi-title">Konfirmasi</div>
        <div class="amplop-konfirmasi-pesan">${pesan}</div>
        <div class="amplop-konfirmasi-actions">
          <button class="amplop-konfirmasi-batal" id="akunKonfBatal">Batal</button>
          <button class="amplop-konfirmasi-oke amplop-konfirmasi-oke-green" id="akunKonfOke">OK</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    document.getElementById("akunKonfBatal").onclick = () => { el.remove(); resolve(false); };
    document.getElementById("akunKonfOke").onclick   = () => { el.remove(); resolve(true); };
    el.onclick = e => { if (e.target === el) { el.remove(); resolve(false); } };
  });
}