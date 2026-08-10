const STORAGE_KEY = "ohm-expenses-v1";
const SYNC_URL_KEY = "ohm-apps-script-url";
const INSTALL_PROMPT_KEY = "ohm-ios-install-prompt-seen";
const view = document.body.dataset.view;
const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" });
const today = new Date().toISOString().slice(0, 10);
const state = loadState();

const syncUrlInput = document.querySelector("#sync-url");
const syncStatus = document.querySelector("#sync-status");

boot();

function boot() {
  if (document.querySelector("#expense-date")) document.querySelector("#expense-date").value = today;
  if (document.querySelector("#transfer-date")) document.querySelector("#transfer-date").value = today;
  if (syncUrlInput) syncUrlInput.value = localStorage.getItem(SYNC_URL_KEY) || window.OHM_APPS_SCRIPT_URL || "";

  bindSync();
  bindChild();
  bindMother();
  render();
  updateSyncStatus();
  showIosInstallGuide();
}

function bindSync() {
  document.querySelector("#save-sync-url")?.addEventListener("click", () => {
    localStorage.setItem(SYNC_URL_KEY, getSyncUrl());
    updateSyncStatus("บันทึกลิงก์แล้ว");
  });

  document.querySelector("#pull-sync")?.addEventListener("click", pullFromSheet);
  document.querySelector("#push-sync")?.addEventListener("click", () => pushToSheet(false));
}

function bindChild() {
  document.querySelector("#expense-form")?.addEventListener("submit", (event) => {
    event.preventDefault();

    state.expenses.push({
      id: crypto.randomUUID(),
      date: value("#expense-date"),
      category: value("#category"),
      description: value("#description").trim(),
      amount: toNumber(value("#amount")),
      paid: 0,
      createdAt: Date.now()
    });

    event.target.reset();
    document.querySelector("#expense-date").value = today;
    saveState();
    pushToSheet(true);
    render();
  });
}

function bindMother() {
  document.querySelector("#transfer-form")?.addEventListener("submit", (event) => {
    event.preventDefault();

    let remaining = toNumber(value("#transfer-amount"));
    const transfer = {
      id: crypto.randomUUID(),
      date: value("#transfer-date"),
      amount: remaining,
      note: value("#transfer-note").trim(),
      items: [],
      createdAt: Date.now()
    };

    for (const expense of getUnpaidExpenses()) {
      if (remaining <= 0) break;

      const due = round(expense.amount - expense.paid);
      const applied = Math.min(due, remaining);
      expense.paid = round(expense.paid + applied);
      remaining = round(remaining - applied);
      transfer.items.push({ expenseId: expense.id, amount: applied });
    }

    if (remaining > 0) {
      alert("ยอดโอนมากกว่ายอดค้าง กรุณาใส่ยอดไม่เกินยอดค้าง");
      return;
    }

    state.transfers.push(transfer);
    event.target.reset();
    document.querySelector("#transfer-date").value = today;
    saveState();
    pushToSheet(true);
    render();
  });

  document.querySelector("#export-button")?.addEventListener("click", exportData);
  document.querySelector("#import-button")?.addEventListener("click", () => {
    document.querySelector("#import-file").click();
  });
  document.querySelector("#import-file")?.addEventListener("change", importData);
  document.querySelector("#clear-button")?.addEventListener("click", clearData);
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { expenses: [], transfers: [] };
  } catch {
    return { expenses: [], transfers: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function value(selector) {
  return document.querySelector(selector)?.value || "";
}

function toNumber(input) {
  return round(Number(input || 0));
}

function round(number) {
  return Math.round(number * 100) / 100;
}

function getUnpaidExpenses() {
  return state.expenses
    .filter((expense) => expense.amount > expense.paid)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.createdAt - b.createdAt);
}

function getStatus(expense) {
  if (expense.paid >= expense.amount) return "ชำระครบ";
  if (expense.paid > 0) return "ชำระบางส่วน";
  return "ค้างชำระ";
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function expenseHtml(expense) {
  const due = round(expense.amount - expense.paid);

  return `
    <article class="item">
      <div class="item-top">
        <div>
          <strong>${escapeHtml(expense.description)}</strong>
          <div class="muted">${escapeHtml(expense.date)} · ${escapeHtml(expense.category)}</div>
        </div>
        <div class="amount">${money.format(expense.amount)}</div>
      </div>
      <span class="badge">${getStatus(expense)} · ค้าง ${money.format(due)}</span>
    </article>
  `;
}

function transferHtml(transfer) {
  return `
    <article class="item">
      <div class="item-top">
        <div>
          <strong>${escapeHtml(transfer.date)}</strong>
          <div class="muted">${escapeHtml(transfer.note || "ไม่มีหมายเหตุ")}</div>
        </div>
        <div class="amount">${money.format(transfer.amount)}</div>
      </div>
      <span class="badge">ครอบคลุม ${transfer.items.length} รายการ</span>
    </article>
  `;
}

function renderList(selector, html, emptyText) {
  const element = document.querySelector(selector);
  if (element) element.innerHTML = html || `<p class="muted">${emptyText}</p>`;
}

function render() {
  const total = state.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const paid = state.expenses.reduce((sum, expense) => sum + Number(expense.paid || 0), 0);
  const outstanding = round(total - paid);
  const newest = [...state.expenses].sort((a, b) => b.createdAt - a.createdAt);
  const unpaid = getUnpaidExpenses();
  const transfers = [...state.transfers].sort((a, b) => b.createdAt - a.createdAt);

  setText("#total-expense", money.format(total));
  setText("#paid-total", money.format(paid));
  setText("#outstanding", money.format(outstanding));
  setText("#expense-count", String(state.expenses.length));
  renderList("#expense-list", newest.map(expenseHtml).join(""), "ยังไม่มีรายการ");
  renderList("#unpaid-list", unpaid.map(expenseHtml).join(""), "ไม่มีรายการค้างชำระ");
  renderList("#transfer-list", transfers.map(transferHtml).join(""), "ยังไม่มีประวัติการโอน");
}

function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
}

function getSyncUrl() {
  return (syncUrlInput?.value || localStorage.getItem(SYNC_URL_KEY) || window.OHM_APPS_SCRIPT_URL || "").trim();
}

function updateSyncStatus(message) {
  if (!syncStatus) return;
  const syncUrl = getSyncUrl();
  syncStatus.textContent = message || (syncUrl ? "พร้อมซิงก์กับ Google Sheet" : "ยังไม่ได้ตั้งค่าลิงก์");
}

function pushToSheet(silent) {
  const syncUrl = getSyncUrl();

  if (!syncUrl) {
    if (!silent) updateSyncStatus("กรุณาวางลิงก์ Apps Script ก่อน");
    return;
  }

  localStorage.setItem(SYNC_URL_KEY, syncUrl);
  document.querySelector("#sync-form").action = syncUrl;
  document.querySelector("#sync-payload").value = JSON.stringify({
    expenses: state.expenses,
    transfers: state.transfers,
    updatedAt: new Date().toISOString()
  });
  document.querySelector("#sync-form").submit();

  if (!silent) updateSyncStatus("ส่งข้อมูลไป Google Sheet แล้ว");
}

function pullFromSheet() {
  const syncUrl = getSyncUrl();

  if (!syncUrl) {
    updateSyncStatus("กรุณาวางลิงก์ Apps Script ก่อน");
    return;
  }

  localStorage.setItem(SYNC_URL_KEY, syncUrl);
  const callbackName = `receiveSheetData_${Date.now()}`;
  const script = document.createElement("script");
  const separator = syncUrl.includes("?") ? "&" : "?";

  window[callbackName] = (data) => {
    state.expenses = Array.isArray(data.expenses) ? data.expenses : [];
    state.transfers = Array.isArray(data.transfers) ? data.transfers : [];
    saveState();
    render();
    updateSyncStatus("ดึงข้อมูลจาก Google Sheet แล้ว");
    delete window[callbackName];
    script.remove();
  };

  script.onerror = () => {
    updateSyncStatus("ดึงข้อมูลไม่ได้ กรุณาตรวจลิงก์ Apps Script");
    delete window[callbackName];
    script.remove();
  };

  script.src = `${syncUrl}${separator}action=load&callback=${callbackName}`;
  document.body.appendChild(script);
  updateSyncStatus("กำลังดึงข้อมูลจาก Google Sheet...");
}

function exportData() {
  const file = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = `ohm-expenses-${today}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const imported = JSON.parse(await file.text());
  state.expenses = Array.isArray(imported.expenses) ? imported.expenses : [];
  state.transfers = Array.isArray(imported.transfers) ? imported.transfers : [];
  saveState();
  render();
  pushToSheet(true);
}

function clearData() {
  if (!confirm("ล้างข้อมูลทั้งหมดใช่ไหม?")) return;
  state.expenses = [];
  state.transfers = [];
  saveState();
  pushToSheet(true);
  render();
}

function showIosInstallGuide() {
  const isAppleTouchDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;

  if (!isAppleTouchDevice || isStandalone || localStorage.getItem(INSTALL_PROMPT_KEY)) return;

  const guide = document.createElement("aside");
  guide.className = "install-guide";
  guide.setAttribute("role", "dialog");
  guide.setAttribute("aria-label", "วิธีเพิ่มแอปโอมไปหน้าโฮม");
  guide.innerHTML = `
    <div class="install-card">
      <button class="install-close" type="button" aria-label="ปิดคำแนะนำ">×</button>
      <div class="install-icon">โอม</div>
      <p class="eyebrow">ใช้ง่ายเหมือนแอป</p>
      <h2>เพิ่ม “โอม” ไว้หน้าโฮม iPhone</h2>
      <ol>
        <li>กดปุ่มแชร์ <span class="share-mark">□↑</span> ด้านล่างของ Safari</li>
        <li>เลื่อนหาเมนู “เพิ่มไปยังหน้าจอโฮม”</li>
        <li>กด “เพิ่ม” แล้วเปิดโอมจากหน้าโฮมได้เลย</li>
      </ol>
      <button class="install-done" type="button">เข้าใจแล้ว</button>
    </div>
  `;

  const closeGuide = () => {
    localStorage.setItem(INSTALL_PROMPT_KEY, "1");
    guide.remove();
  };

  guide.querySelector(".install-close").addEventListener("click", closeGuide);
  guide.querySelector(".install-done").addEventListener("click", closeGuide);
  document.body.appendChild(guide);
}
