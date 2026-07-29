/* ── AKUN VIEW ── */
let akunSelectedUid  = null;
let akunAllUsers     = [];
let akunSearchQuery  = "";
let akunRoleFilter   = "semua";
let akunTambahRole   = "";

let akunUnsub = null;

window.initAkunView = async function() {
  initAkunListListener();
  initAkunSearch();
  initAkunTabs();
  initAkunTambah();
  initAkunDetail();
};

/* ── LOAD LIST (live, onSnapshot) ── */
function initAkunListListener() {
  const listEl = document.getElementById("akunList");
  if (!listEl) return;
  listEl.innerHTML = `<div class="dh-ringkasan-empty">Memuat...</div>`;

  const idCabang = window.currentUser?.idCabang || "";
  const adminUid = window.auth?.currentUser?.uid;

  if (akunUnsub) { akunUnsub(); akunUnsub = null; }

  akunUnsub = window.onSnapshot(
    window.query(
      window.collection(window.db, "users"),
      window.where("idCabang", "==", idCabang),
      window.where("createdBy", "==", adminUid)
    ),
    snap => {
      akunAllUsers = snap.docs.map(d => ({ ...d.data(), uid: d.id })).filter(u => u.uid !== adminUid);

      // update usersCache juga (in-memory, bukan IDB)
      window.usersCache = [...(window.usersCache||[]).filter(u => u.idCabang !== idCabang), ...akunAllUsers];

      renderAkunList();

      // kalau detail lagi kebuka, refresh juga datanya biar sinkron sama snapshot terbaru
      if (akunSelectedUid) {
        const user = akunAllUsers.find(u => u.uid === akunSelectedUid);
        if (user) openAkunDetail(user);
      }
    },
    err => {
      console.error("❌ initAkunListListener:", err);
      document.getElementById("akunList").innerHTML = `<div class="dh-ringkasan-empty">Gagal memuat</div>`;
    }
  );
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
  document.getElementById("akunHapusBtn")?.addEventListener("click", hapusAkunPermanen);
  document.getElementById("akunGantiPasswordBtn")?.addEventListener("click", gantiAkunPassword);
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

    document.getElementById("akunDetailNama").textContent = payload.nama;
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
/* ── HAPUS AKUN PERMANEN (Firestore + Auth + Storage) ── */
function showAkunHapusPasswordPopup() {
  return new Promise(resolve => {
    document.getElementById("akunHapusPassOverlay")?.remove();
    const el = document.createElement("div");
    el.id = "akunHapusPassOverlay";
    el.className = "amplop-konfirmasi-overlay";
    el.style.display = "flex";
    el.innerHTML = `
      <div class="amplop-konfirmasi-box">
        <div class="amplop-konfirmasi-title">Konfirmasi Hapus Akun</div>
        <div class="amplop-konfirmasi-pesan">Masukkan password halaman untuk melanjutkan penghapusan permanen.</div>
        <input type="password" class="amplop-konfirmasi-pass" id="akunHapusPassInput" placeholder="Masukkan password">
        <div class="amplop-konfirmasi-err akun-popup-err" id="akunHapusPassErr"></div>
        <div class="amplop-konfirmasi-actions">
          <button class="amplop-konfirmasi-batal" id="akunHapusPassBatal">Batal</button>
          <button class="amplop-konfirmasi-oke amplop-konfirmasi-oke-red" id="akunHapusPassOke">Hapus</button>
        </div>
      </div>`;
    document.body.appendChild(el);

    const passInput = document.getElementById("akunHapusPassInput");
    const errEl     = document.getElementById("akunHapusPassErr");
    setTimeout(() => passInput?.focus(), 100);

    document.getElementById("akunHapusPassBatal").onclick = () => { el.remove(); resolve(false); };
    el.onclick = e => { if (e.target === el) { el.remove(); resolve(false); } };

    document.getElementById("akunHapusPassOke").onclick = async () => {
      const inputVal = passInput?.value?.trim() || "";
      if (!inputVal) { errEl.textContent = "Password wajib diisi"; return; }

      let kantorCabang = null;
      try {
        const idCabangHapus = window.currentUser?.idCabang || "";
        const snapKc = await window.getDoc(window.doc(window.db, "kantorCabang", idCabangHapus));
        if (snapKc.exists()) kantorCabang = { id: snapKc.id, ...snapKc.data() };
      } catch (err) {
        console.error("❌ fetch kantorCabang (hapusAkun):", err);
      }
      const correctPassword = kantorCabang?.pagePassword || "";
      const hashedInput     = await window.hashPassword(inputVal);

      if (hashedInput !== correctPassword) {
        errEl.textContent = "Password salah";
        passInput.value = "";
        passInput.focus();
        return;
      }
      el.remove();
      resolve(true);
    };
  });
}

/* ── UBAH PASSWORD (via secondary app, delete→create dokumen akun) ── */
function showAkunGantiPasswordPopup() {
  return new Promise(resolve => {
    document.getElementById("akunGantiPassOverlay")?.remove();
    const el = document.createElement("div");
    el.id = "akunGantiPassOverlay";
    el.className = "amplop-konfirmasi-overlay";
    el.style.display = "flex";
    el.innerHTML = `
      <div class="amplop-konfirmasi-box">
        <div class="amplop-konfirmasi-title">Ubah Password Akun</div>
        <div class="amplop-konfirmasi-pesan">Masukkan password baru untuk akun ini, lalu password halaman untuk konfirmasi.</div>
        <input type="password" class="amplop-konfirmasi-pass akun-popup-input-spaced" id="akunGantiPassBaruInput" placeholder="Password baru (min. 6 karakter)">
        <input type="password" class="amplop-konfirmasi-pass" id="akunGantiPassHalamanInput" placeholder="Password halaman">
        <div class="amplop-konfirmasi-err akun-popup-err" id="akunGantiPassErr"></div>
        <div class="amplop-konfirmasi-actions">
          <button class="amplop-konfirmasi-batal" id="akunGantiPassBatal">Batal</button>
          <button class="amplop-konfirmasi-oke amplop-konfirmasi-oke-brand" id="akunGantiPassOke">Simpan</button>
        </div>
      </div>`;
    document.body.appendChild(el);

    const passBaruInput    = document.getElementById("akunGantiPassBaruInput");
    const passHalamanInput = document.getElementById("akunGantiPassHalamanInput");
    const errEl            = document.getElementById("akunGantiPassErr");
    setTimeout(() => passBaruInput?.focus(), 100);

    document.getElementById("akunGantiPassBatal").onclick = () => { el.remove(); resolve(null); };
    el.onclick = e => { if (e.target === el) { el.remove(); resolve(null); } };

    document.getElementById("akunGantiPassOke").onclick = async () => {
      const passBaru     = passBaruInput?.value?.trim() || "";
      const passHalaman  = passHalamanInput?.value?.trim() || "";

      if (passBaru.length < 6) { errEl.textContent = "Password baru minimal 6 karakter"; return; }
      if (!passHalaman) { errEl.textContent = "Password halaman wajib diisi"; return; }

      let kantorCabang = null;
      try {
        const idCabangGanti = window.currentUser?.idCabang || "";
        const snapKc = await window.getDoc(window.doc(window.db, "kantorCabang", idCabangGanti));
        if (snapKc.exists()) kantorCabang = { id: snapKc.id, ...snapKc.data() };
      } catch (err) {
        console.error("❌ fetch kantorCabang (gantiPassword):", err);
      }
      const correctPassword = kantorCabang?.pagePassword || "";
      const hashedInput     = await window.hashPassword(passHalaman);

      if (hashedInput !== correctPassword) {
        errEl.textContent = "Password halaman salah";
        passHalamanInput.value = "";
        passHalamanInput.focus();
        return;
      }
      el.remove();
      resolve(passBaru);
    };
  });
}

async function gantiAkunPassword() {
  if (!akunSelectedUid) return;

  const passwordBaru = await showAkunGantiPasswordPopup();
  if (!passwordBaru) return;

  const btn = document.getElementById("akunGantiPasswordBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Menyimpan..."; }

  try {
    // 1. ambil email + password lama dari collection "akun"
    const akunSnap = await window.getDoc(window.doc(window.db, "akun", akunSelectedUid));
    if (!akunSnap.exists()) throw new Error("Data login akun tidak ditemukan");
    const { email, password: passwordLama, role, idCabang } = akunSnap.data();
    if (!email || !passwordLama) throw new Error("Email/password akun tidak lengkap");

    // 2. login sebagai akun itu di secondary app, update password di Auth
    const secondaryApp  = window.initializeApp(window.firebaseConfig, "secondary-ganti-password");
    const secondaryAuth = window.getAuth(secondaryApp);
    try {
      const cred = await window.signInWithEmailAndPassword(secondaryAuth, email, passwordLama);
      await window.updatePassword(cred.user, passwordBaru);
    } finally {
      try { await window.signOut(secondaryAuth); } catch {}
      await window.deleteApp(secondaryApp);
    }

    // 3. hapus dokumen "akun" lama, buat dokumen baru dengan password ter-update
    //    (delete→create supaya lolos rule "create" adminCabang, bukan "update" yang belum diizinkan)
    await window.deleteDoc(window.doc(window.db, "akun", akunSelectedUid));
    await window.setDoc(window.doc(window.db, "akun", akunSelectedUid), {
      uid:      akunSelectedUid,
      role,
      password: passwordBaru,
      email,
      idCabang,
    });

    window.showToast("Password berhasil diubah", "success");
  } catch (err) {
    console.error("❌ gantiAkunPassword:", err);
    const msg = err.code === "auth/wrong-password" || err.code === "auth/invalid-credential"
      ? "Password tersimpan tidak valid — mungkin user pernah ganti password sendiri"
      : err.code === "auth/weak-password"
      ? "Password baru terlalu lemah"
      : "Gagal mengubah password";
    window.showToast(msg, "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Ubah Password"; }
  }
}

async function cekMasihPunyaCustomer(uid, role) {
  const idCabang = window.currentUser?.idCabang || "";
  try {
    let q;
    if (role === "kurir") {
      q = window.query(
        window.collection(window.db, "customer"),
        window.where("pemilik", "==", uid),
        window.where("idCabang", "==", idCabang),
        window.limit(1)
      );
    } else if (role === "sales") {
      q = window.query(
        window.collection(window.db, "customerSales"),
        window.where("pemilik", "==", uid),
        window.where("idCabang", "==", idCabang),
        window.limit(1)
      );
    } else if (role === "hunter") {
      q = window.query(
        window.collection(window.db, "users", uid, "customerBaruHunter"),
        window.where("idCabang", "==", idCabang),
        window.limit(1)
      );
    } else {
      return false; // role lain (adminCabang/produksi) gak perlu dicek
    }
    const snap = await window.getDocs(q);
    return !snap.empty;
  } catch (err) {
    console.error("❌ cekMasihPunyaCustomer:", err);
    window.showToast("Gagal mengecek data customer, coba lagi", "error");
    return true; // kalau error, anggap AMAN dengan cara memblokir (lebih baik gagal-aman daripada salah izinkan hapus)
  }
}

function showAkunMasihPunyaCustomerPopup(nama) {
  document.getElementById("akunMasihCustomerOverlay")?.remove();
  const el = document.createElement("div");
  el.id = "akunMasihCustomerOverlay";
  el.className = "lap-frozen-overlay";
  el.innerHTML = `
    <div class="lap-frozen-box">
      <div class="lap-frozen-icon">⚠️</div>
      <div class="lap-frozen-title">Tidak Bisa Dihapus</div>
      <div class="lap-frozen-desc">Akun "${nama}" masih memiliki customer yang terdaftar. Pindahkan atau hapus customer tersebut terlebih dahulu sebelum menghapus akun ini.</div>
      <div class="lap-frozen-footer">
        <button class="lap-frozen-btn-save" id="akunMasihCustomerOke" style="width:100%">Mengerti</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  document.getElementById("akunMasihCustomerOke").onclick = () => el.remove();
  el.onclick = e => { if (e.target === el) el.remove(); };
}
async function hapusAkunPermanen() {
  if (!akunSelectedUid) return;
  const user = akunAllUsers.find(u => u.uid === akunSelectedUid);
  if (!user) return;

  // cek dulu — kalau masih ada customer yang nempel (kurir/sales/hunter), blokir total
  if (["kurir", "sales", "hunter"].includes(user.role)) {
    const masihAda = await cekMasihPunyaCustomer(akunSelectedUid, user.role);
    if (masihAda) {
      showAkunMasihPunyaCustomerPopup(user.nama || "-");
      return;
    }
  }

  const confirm = await showAkunHapusPasswordPopup();
  if (!confirm) return;

  const btn = document.getElementById("akunHapusBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Menghapus..."; }

  try {
    // 1. ambil email + password plaintext dari collection "akun"
    const akunSnap = await window.getDoc(window.doc(window.db, "akun", akunSelectedUid));
    if (!akunSnap.exists()) throw new Error("Data login akun tidak ditemukan");
    const { email, password } = akunSnap.data();
    if (!email || !password) throw new Error("Email/password akun tidak lengkap");

    // 2. login sebagai akun itu di secondary app, hapus diri sendiri dari Auth
    const secondaryApp  = window.initializeApp(window.firebaseConfig, "secondary-hapus-akun");
    const secondaryAuth = window.getAuth(secondaryApp);
    try {
      const cred = await window.signInWithEmailAndPassword(secondaryAuth, email, password);
      await cred.user.delete();
    } finally {
      try { await window.signOut(secondaryAuth); } catch {}
      await window.deleteApp(secondaryApp);
    }

    // 3. hapus foto di Storage (kalau ada)
    try {
      const fotoRef = window.storageRef(window.storage, `fotoUsers/${akunSelectedUid}`);
      await window.deleteObject(fotoRef);
    } catch (err) {
      if (err.code !== "storage/object-not-found") {
        console.error("❌ hapus foto storage:", err);
      }
      // kalau foto emang gak ada, gapapa lanjut aja
    }

    // 4. hapus dokumen Firestore terkait (akun dulu, karena rule-nya butuh dokumen users masih ada buat cek createdBy)
    await window.deleteDoc(window.doc(window.db, "akun", akunSelectedUid));
    await window.deleteDoc(window.doc(window.db, "users", akunSelectedUid));

    // 5. update state lokal
    akunAllUsers = akunAllUsers.filter(u => u.uid !== akunSelectedUid);
    window.usersCache = window.usersCache?.filter(u => u.uid !== akunSelectedUid);
    akunSelectedUid = null;

    // reset panel kanan balik ke empty state
    document.getElementById("akunDetail").style.display     = "none";
    document.getElementById("akunEmptyState").style.display = "flex";
    document.getElementById("akunPanelRight")?.classList.remove("show");

    renderAkunList();

    window.showToast("Akun berhasil dihapus permanen", "success");
  } catch (err) {
    console.error("❌ hapusAkunPermanen:", err);
    const msg = err.code === "auth/wrong-password" || err.code === "auth/invalid-credential"
      ? "Password tersimpan tidak valid — mungkin user pernah ganti password sendiri"
      : "Gagal menghapus akun";
    window.showToast(msg, "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Hapus Akun Permanen"; }
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
    const idCabang     = window.currentUser?.idCabang || "";
    const adminUid     = window.auth?.currentUser?.uid;

    let adminVarian = [];
    let namaCabang  = "";
    try {
      const adminSnap = await window.getDoc(window.doc(window.db, "users", adminUid));
      adminVarian = adminSnap.exists() ? (adminSnap.data()?.varian || []) : [];
      namaCabang  = adminSnap.exists() ? (adminSnap.data()?.kantorCabang || "") : "";
    } catch (err) {
      console.error("❌ ambil data admin:", err);
    }

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
      idCabang,
      kantorCabang: namaCabang,
      noTelpon:     document.getElementById("akunTambahTelpon").value.trim(),
      nik:          document.getElementById("akunTambahNik").value.trim(),
      alamat:       document.getElementById("akunTambahAlamat").value.trim(),
      foto:         "",
      motivasi:     "",
      status:       true,
      varian:       adminVarian,
      createdBy:    adminUid,
      createdAt:    window.serverTimestamp(),
    };

    await window.setDoc(window.doc(window.db, "users", newUid), payload);
    await window.setDoc(window.doc(window.db, "akun", newUid), {
      uid:      newUid,
      role:     akunTambahRole,
      password: pass,
      email,
      idCabang,
    });

    document.getElementById("akunTambahOverlay")?.classList.remove("show");
    window.showToast("Akun berhasil dibuat", "success");
  } catch (err) {
    console.error("❌ tambahAkun:", err?.message || err, err?.stack);
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
