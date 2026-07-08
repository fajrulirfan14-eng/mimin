/* ── AUDIT BARANG MENTAH VIEW ── */
window.initAuditProduksiView = function() {

  document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='audit']").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll("#rekapProduksiList .lap-kurir-item").forEach(x => x.classList.remove("active"));
      item.classList.add("active");

      window.activateRekapProdPanel("auditProduksiDetailWrapper");

      document.getElementById("auditProduksiEmpty").style.display   = "none";
      document.getElementById("auditProduksiContent").style.display = "flex";

      if (window.innerWidth <= 768) {
        const backBtn = document.getElementById("auditProduksiBackBtn");
        if (backBtn) backBtn.style.display = "flex";
      }
    });
  });

  document.getElementById("auditProduksiBackBtn")?.addEventListener("click", () => {
    document.getElementById("auditProduksiDetailWrapper").style.setProperty("display", "none", "important");
    document.getElementById("auditProduksiDetailWrapper")?.classList.remove("show");
    document.getElementById("auditProduksiBackBtn").style.display = "none";
    document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='audit']").forEach(x => x.classList.remove("active"));
  });

};