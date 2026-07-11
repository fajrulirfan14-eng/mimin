/* ── PROFIL VIEW ── */
window.initProfilView = async function() {
  const user = window.auth?.currentUser;
  if (!user) return;

  const uid = user.uid;
  let userData = (window.usersCache || []).find(u => u.uid === uid);
  if (!userData) {
    try {
      const snap = await window.getDoc(window.doc(window.db, "users", uid));
      if (snap.exists()) userData = snap.data();
    } catch (err) {
      console.error("❌ load profil:", err);
    }
  }

  const kantorCabang = await window.idb.getKantorCabang();

  // render header
  document.getElementById("profilFoto").src = userData?.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData?.nama||"A")}&background=random`;
  document.getElementById("profilNama").textContent  = userData?.nama || "-";
  document.getElementById("profilRole").textContent  = userData?.role || "-";
  document.getElementById("profilEmail").textContent = userData?.email || user.email || "-";

  // kantor cabang
  document.getElementById("profilCabangNama").textContent = kantorCabang?.namaCabang || "-";
  document.getElementById("profilCabangId").textContent   = kantorCabang?.id || "-";

  // form edit
  document.getElementById("profilInputNama").value   = userData?.nama     || "";
  document.getElementById("profilInputTelpon").value = userData?.noTelpon || "";
  document.getElementById("profilInputAlamat").value = userData?.alamat   || "";

  // dark mode toggle
  const darkToggle = document.getElementById("profilDarkModeToggle");
  darkToggle.checked = document.documentElement.getAttribute("data-theme") === "dark";
  darkToggle.addEventListener("change", () => { window.toggleDarkMode(); });

  // foto upload
  document.getElementById("profilFotoBtn")?.addEventListener("click", () => {
    document.getElementById("profilFotoInput")?.click();
  });
  document.getElementById("profilFotoInput")?.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const compressed = await window.compressImage(file, 400, 0.7);
      const path = `fotoUsers/${uid}`;
      const ref  = window.storageRef(window.storage, path);
      await window.uploadBytes(ref, compressed);
      const url = await window.getDownloadURL(ref);
      await window.setDoc(window.doc(window.db, "users", uid), { foto: url }, { merge: true });
      document.getElementById("profilFoto").src = url;
      window.showToast("Foto berhasil diupdate", "success");
    } catch (err) {
      console.error("❌ upload foto profil:", err);
      window.showToast("Gagal upload foto", "error");
    }
  });

  // simpan profil
  document.getElementById("profilSaveBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("profilSaveBtn");
    btn.disabled = true; btn.textContent = "Menyimpan...";
    try {
      const payload = {
        nama:      document.getElementById("profilInputNama").value.trim(),
        noTelpon:  document.getElementById("profilInputTelpon").value.trim(),
        alamat:    document.getElementById("profilInputAlamat").value.trim(),
      };
      await window.setDoc(window.doc(window.db, "users", uid), payload, { merge: true });
      document.getElementById("profilNama").textContent = payload.nama;
      window.showToast("Profil berhasil disimpan", "success");
    } catch (err) {
      console.error("❌ simpan profil:", err);
      window.showToast("Gagal menyimpan", "error");
    } finally {
      btn.disabled = false; btn.textContent = "Simpan Profil";
    }
  });

  // logout
  document.getElementById("profilLogoutBtn")?.addEventListener("click", async () => {
    const confirm = await showProfilKonfirmasi("Yakin ingin logout?");
    if (!confirm) return;
    try {
      await window.signOut(window.auth);
      window.location.reload();
    } catch (err) {
      console.error("❌ logout:", err);
    }
  });
};

function showProfilKonfirmasi(pesan) {
  return new Promise(resolve => {
    const el = document.createElement("div");
    el.className = "amplop-konfirmasi-overlay";
    el.style.display = "flex";
    el.innerHTML = `
      <div class="amplop-konfirmasi-box">
        <div class="amplop-konfirmasi-title">Konfirmasi</div>
        <div class="amplop-konfirmasi-pesan">${pesan}</div>
        <div class="amplop-konfirmasi-actions">
          <button class="amplop-konfirmasi-batal" id="profilKonfBatal">Batal</button>
          <button class="amplop-konfirmasi-oke amplop-konfirmasi-oke-red" id="profilKonfOke">Logout</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    document.getElementById("profilKonfBatal").onclick = () => { el.remove(); resolve(false); };
    document.getElementById("profilKonfOke").onclick   = () => { el.remove(); resolve(true); };
    el.onclick = e => { if (e.target === el) { el.remove(); resolve(false); } };
  });
}