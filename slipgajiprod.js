/* ── SLIP GAJI PRODUKSI VIEW ── */
window.initSlipGajiProdView = function() {

  document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='slipgaji']").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll("#rekapProduksiList .lap-kurir-item").forEach(x => x.classList.remove("active"));
      item.classList.add("active");

      window.activateRekapProdPanel("slipgajiProduksiDetailWrapper");

      document.getElementById("slipgajiProduksiEmpty").style.display   = "none";
      document.getElementById("slipgajiProduksiContent").style.display = "flex";

      if (window.innerWidth <= 768) {
        const backBtn = document.getElementById("slipgajiProduksiBackBtn");
        if (backBtn) backBtn.style.display = "flex";
      }
    });
  });

  document.getElementById("slipgajiProduksiBackBtn")?.addEventListener("click", () => {
    document.getElementById("slipgajiProduksiDetailWrapper").style.setProperty("display", "none", "important");
    document.getElementById("slipgajiProduksiDetailWrapper")?.classList.remove("show");
    document.getElementById("slipgajiProduksiBackBtn").style.display = "none";
    document.querySelectorAll("#rekapProduksiList .lap-kurir-item[data-id='slipgaji']").forEach(x => x.classList.remove("active"));
  });

};