const LIVE_SYNC_INTERVAL_MS = 20000;
const liveSyncStatus = document.querySelector("#mother-sync-status");
const liveSyncView = document.body.dataset.view;
let liveSyncPending = false;

function setLiveSyncStatus(message) {
  if (liveSyncStatus) liveSyncStatus.textContent = message;
}

function refreshMotherFromSheet(silent = true) {
  if (typeof window.pullFromSheet !== "function") return;
  if (!silent) setLiveSyncStatus("กำลังดึงข้อมูลจากฝั่งโอม...");
  window.pullFromSheet(true);
  window.setTimeout(() => {
    setLiveSyncStatus(`อัปเดตล่าสุด ${new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`);
  }, 2500);
}

if (liveSyncView === "mother") {
  document.querySelector("#mother-refresh-button")?.addEventListener("click", () => refreshMotherFromSheet(false));
  window.setTimeout(() => refreshMotherFromSheet(true), 500);
  window.setInterval(() => {
    if (document.visibilityState === "visible") refreshMotherFromSheet(true);
  }, LIVE_SYNC_INTERVAL_MS);
}

if (liveSyncView === "child") {
  document.querySelector("#expense-form")?.addEventListener("submit", () => {
    liveSyncPending = true;
    setLiveSyncStatus("บันทึกแล้ว กำลังส่งให้ฝั่งแม่...");
  });

  document.querySelector("#save-bulk-button")?.addEventListener("click", () => {
    liveSyncPending = true;
    setLiveSyncStatus("บันทึกหลายรายการแล้ว กำลังส่งให้ฝั่งแม่...");
  });

  document.querySelector("#sync-frame")?.addEventListener("load", () => {
    if (!liveSyncPending) return;
    liveSyncPending = false;
    setLiveSyncStatus("ส่งข้อมูลให้ฝั่งแม่แล้ว");
  });
}
