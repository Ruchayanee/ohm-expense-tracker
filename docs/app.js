const STORAGE_KEY = "ohm-expenses-v1";
const SYNC_URL_KEY = "ohm-apps-script-url";
const INSTALL_PROMPT_KEY = "ohm-ios-install-prompt-seen";
const view = document.body.dataset.view;
const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" });
const today = new Date().toISOString().slice(0, 10);
const state = loadState();
let bulkDraft = [];

const syncUrlInput = document.querySelector("#sync-url");
const syncStatus = document.querySelector("#sync-status");

boot();

function boot() {
  if (document.querySelector("#expense-date")) document.querySelector("#expense-date").value = today;
  if (document.querySelector("#bulk-default-date")) document.querySelector("#bulk-default-date").value = today;
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

  document.querySelector("#analyze-bulk-button")?.addEventListener("click", analyzeBulkExpenses);
  document.querySelector("#save-bulk-button")?.addEventListener("click", saveBulkExpenses);
  document.querySelector("#clear-bulk-button")?.addEventListener("click", clearBulkExpenses);
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
  return round(Number(String(input || "").replaceAll(",", "")));
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

function analyzeBulkExpenses() {
  const text = value("#bulk-expense-text").trim();
  bulkDraft = parseBulkExpenses(text);
  renderBulkAnalysis(bulkDraft);
}

function saveBulkExpenses() {
  if (!bulkDraft.length) return;

  const createdAt = Date.now();
  for (const [index, expense] of bulkDraft.entries()) {
    state.expenses.push({
      id: crypto.randomUUID(),
      date: expense.date,
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      paid: 0,
      createdAt: createdAt + index
    });
  }

  saveState();
  pushToSheet(true);
  render();
  renderBulkAnalysis([], `บันทึกแล้ว ${bulkDraft.length} รายการ รวม ${money.format(sumAmounts(bulkDraft))}`);
  bulkDraft = [];
  const button = document.querySelector("#save-bulk-button");
  if (button) button.disabled = true;
}

function clearBulkExpenses() {
  const input = document.querySelector("#bulk-expense-text");
  if (input) input.value = "";
  bulkDraft = [];
  renderBulkAnalysis([]);
}

function parseBulkExpenses(text) {
  if (!text) return [];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let activeDate = value("#bulk-default-date") || today;
  const expenses = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/^[\-•–—]\s*/, "").trim();
    const parsedDate = parseThaiDate(line);

    if (parsedDate) {
      activeDate = parsedDate;
      continue;
    }

    const parsedAmount = extractTrailingAmount(line);
    if (!parsedAmount) continue;

    expenses.push({
      date: activeDate,
      category: inferCategory(parsedAmount.description),
      description: parsedAmount.description,
      amount: parsedAmount.amount
    });
  }

  return expenses;
}

function parseThaiDate(line) {
  const match = line.match(/^วันที่\s*(\d{1,2})\s*([ก-๙.]+)\s*$/i);
  if (!match) return "";

  const month = thaiMonthNumber(match[2]);
  if (!month) return "";

  const year = new Date().getFullYear();
  const day = match[1].padStart(2, "0");
  return `${year}-${String(month).padStart(2, "0")}-${day}`;
}

function thaiMonthNumber(monthText) {
  const clean = monthText.replaceAll(".", "").trim();
  const months = [
    ["มกรา", "มกราคม"],
    ["กุมภา", "กุมภาพันธ์"],
    ["มีนา", "มีนาคม"],
    ["เมษา", "เมษายน"],
    ["พฤษภา", "พฤษภาคม"],
    ["มิถุนา", "มิถุนายน"],
    ["กรกฎา", "กรกฎาคม"],
    ["สิงหา", "สิงหาคม"],
    ["กันยา", "กันยายน"],
    ["ตุลา", "ตุลาคม"],
    ["พฤศจิกา", "พฤศจิกายน"],
    ["ธันวา", "ธันวาคม"]
  ];

  const index = months.findIndex((aliases) => aliases.some((alias) => clean.startsWith(alias)));
  return index >= 0 ? index + 1 : 0;
}

function extractTrailingAmount(line) {
  const matches = [...line.matchAll(/\d[\d,]*(?:\.\d+)?/g)];
  if (!matches.length) return null;

  const last = matches[matches.length - 1];
  const amount = toNumber(last[0]);
  if (!amount) return null;

  const description = line.slice(0, last.index).replace(/[=:\s]+$/, "").trim();
  return {
    amount,
    description: description || line.replace(last[0], "").trim() || "ไม่ระบุรายละเอียด"
  };
}

function inferCategory(description) {
  const text = description.toLowerCase();

  if (/ข้าว|ปิ้งย่าง|ส้มตำ|ไก่ย่าง|ยำ|กุ๊ก|กุ้ง|อาหาร|กิน/.test(text)) return "อาหาร";
  if (/รถ|ที่จอด|ปะยาง|มอไซต์|มอเตอร์ไซ|ตู้|เดินทาง/.test(text)) return "เดินทาง";
  if (/gpt|แชท|chat/.test(text)) return "การเรียน";
  if (/นาฬิกา|เซอวิส|service|ของใช้/.test(text)) return "ของใช้";
  if (/หมอ|ยา|สุขภาพ/.test(text)) return "สุขภาพ";
  return "อื่น ๆ";
}

function renderBulkAnalysis(items, message = "") {
  const result = document.querySelector("#bulk-analysis");
  const saveButton = document.querySelector("#save-bulk-button");
  if (!result) return;

  if (saveButton) saveButton.disabled = !items.length;

  if (!items.length) {
    result.innerHTML = message ? `<p class="status">${escapeHtml(message)}</p>` : "";
    return;
  }

  const grouped = groupByCategory(items);
  const groupedHtml = Object.entries(grouped)
    .map(([category, total]) => `<span class="summary-pill">${escapeHtml(category)} ${money.format(total)}</span>`)
    .join("");
  const rows = items
    .map((item) => `
      <tr>
        <td>${escapeHtml(item.date)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.description)}</td>
        <td class="amount-cell">${money.format(item.amount)}</td>
      </tr>
    `)
    .join("");

  result.innerHTML = `
    <div class="bulk-total">
      <span>อ่านได้ ${items.length} รายการ</span>
      <strong>${money.format(sumAmounts(items))}</strong>
    </div>
    <div class="summary-pills">${groupedHtml}</div>
    <div class="table-wrap">
      <table class="bulk-table">
        <thead>
          <tr>
            <th>วันที่</th>
            <th>หมวด</th>
            <th>รายการ</th>
            <th>ยอด</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function sumAmounts(items) {
  return round(items.reduce((sum, item) => sum + Number(item.amount || 0), 0));
}

function groupByCategory(items) {
  return items.reduce((groups, item) => {
    groups[item.category] = round((groups[item.category] || 0) + Number(item.amount || 0));
    return groups;
  }, {});
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

  const appName = view === "child" ? "ค่าใช้จ่าย" : "โอม";
  const guide = document.createElement("aside");
  guide.className = "install-guide";
  guide.setAttribute("role", "dialog");
  guide.setAttribute("aria-label", `วิธีเพิ่มแอป${appName}ไปหน้าโฮม`);
  guide.innerHTML = `
    <div class="install-card">
      <button class="install-close" type="button" aria-label="ปิดคำแนะนำ">×</button>
      <div class="install-icon">${appName}</div>
      <p class="eyebrow">ใช้ง่ายเหมือนแอป</p>
      <h2>เพิ่ม “${appName}” ไว้หน้าโฮม iPhone</h2>
      <ol>
        <li>กดปุ่มแชร์ <span class="share-mark">□↑</span> ด้านล่างของ Safari</li>
        <li>เลื่อนหาเมนู “เพิ่มไปยังหน้าจอโฮม”</li>
        <li>กด “เพิ่ม” แล้วเปิด${appName}จากหน้าโฮมได้เลย</li>
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
