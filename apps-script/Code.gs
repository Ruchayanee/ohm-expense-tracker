const EXPENSE_SHEET = "expenses";
const TRANSFER_SHEET = "transfers";
const SPREADSHEET_ID = "1gtuicHZgvWCz0H7OHbC7QbyL-zr8NtSgRB3pifZL3xI";

function doGet(e) {
  const callback = e.parameter.callback || "callback";
  const data = loadState();
  const output = `${callback}(${JSON.stringify(data)});`;

  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(e) {
  const payload = JSON.parse(e.parameter.payload || "{}");
  saveState(payload);

  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

function loadState() {
  return {
    expenses: readExpenses(),
    transfers: readTransfers()
  };
}

function saveState(state) {
  const current = loadState();
  const expenses = mergeExpenses(current.expenses, Array.isArray(state.expenses) ? state.expenses : []);
  const transfers = mergeById(current.transfers, Array.isArray(state.transfers) ? state.transfers : []);

  reconcilePayments(expenses, transfers);
  writeExpenses(expenses);
  writeTransfers(transfers);
}

function mergeExpenses(existingRows, incomingRows) {
  const byId = {};

  existingRows.concat(incomingRows).forEach((expense) => {
    if (!expense || !expense.id) return;

    const current = byId[expense.id] || {};
    byId[expense.id] = {
      id: String(expense.id),
      date: expense.date || current.date || "",
      category: expense.category || current.category || "",
      description: expense.description || current.description || "",
      amount: Number(expense.amount || current.amount || 0),
      paid: Math.max(Number(current.paid || 0), Number(expense.paid || 0)),
      createdAt: Number(current.createdAt || expense.createdAt || Date.now())
    };
  });

  return Object.keys(byId)
    .map((id) => byId[id])
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
}

function mergeById(existingRows, incomingRows) {
  const byId = {};

  existingRows.concat(incomingRows).forEach((row) => {
    if (!row || !row.id) return;
    byId[row.id] = Object.assign({}, byId[row.id] || {}, row);
  });

  return Object.keys(byId)
    .map((id) => byId[id])
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
}

function reconcilePayments(expenses, transfers) {
  if (!transfers.length) return;

  expenses.forEach((expense) => {
    expense.paid = 0;
  });

  transfers.forEach((transfer) => {
    const items = Array.isArray(transfer.items) ? transfer.items : [];
    if (items.length) {
      applyTransferItems(expenses, items);
      return;
    }

    applyTransferByAmount(expenses, Number(transfer.amount || 0));
  });
}

function applyTransferItems(expenses, items) {
  items.forEach((item) => {
    const expense = expenses.find((entry) => entry.id === item.expenseId);
    if (!expense) return;

    const due = Math.max(0, Number(expense.amount || 0) - Number(expense.paid || 0));
    const applied = Math.min(due, Number(item.amount || 0));
    expense.paid = round(Number(expense.paid || 0) + applied);
  });
}

function applyTransferByAmount(expenses, amount) {
  let remaining = Number(amount || 0);
  const unpaid = expenses
    .filter((expense) => Number(expense.amount || 0) > Number(expense.paid || 0))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || Number(a.createdAt || 0) - Number(b.createdAt || 0));

  unpaid.forEach((expense) => {
    if (remaining <= 0) return;

    const due = Math.max(0, Number(expense.amount || 0) - Number(expense.paid || 0));
    const applied = Math.min(due, remaining);
    expense.paid = round(Number(expense.paid || 0) + applied);
    remaining = round(remaining - applied);
  });
}

function round(number) {
  return Math.round(Number(number || 0) * 100) / 100;
}

function readExpenses() {
  const sheet = getSheet(EXPENSE_SHEET, [
    "id",
    "date",
    "category",
    "description",
    "amount",
    "paid",
    "createdAt"
  ]);
  const values = sheet.getDataRange().getValues().slice(1);

  return values
    .filter((row) => row[0])
    .map((row) => ({
      id: String(row[0]),
      date: String(row[1]),
      category: String(row[2]),
      description: String(row[3]),
      amount: Number(row[4] || 0),
      paid: Number(row[5] || 0),
      createdAt: Number(row[6] || Date.now())
    }));
}

function readTransfers() {
  const sheet = getSheet(TRANSFER_SHEET, ["id", "date", "amount", "note", "items", "createdAt", "slipFileName", "recipientMatched", "checkedText", "remainingAfterTransfer", "slipAttachedDate"]);
  const values = sheet.getDataRange().getValues().slice(1);

  return values
    .filter((row) => row[0])
    .map((row) => ({
      id: String(row[0]),
      date: String(row[1]),
      amount: Number(row[2] || 0),
      note: String(row[3] || ""),
      items: parseItems(row[4]),
      createdAt: Number(row[5] || Date.now()),
      slip: row[6] ? {
        fileName: String(row[6] || ""),
        recipientMatched: row[7] === true || String(row[7]).toLowerCase() === "true",
        checkedText: String(row[8] || ""),
        remainingAfterTransfer: Number(row[9] || 0),
        attachedDate: String(row[10] || "")
      } : null
    }));
}

function writeExpenses(expenses) {
  const headers = ["id", "date", "category", "description", "amount", "paid", "createdAt"];
  const rows = expenses.map((expense) => [
    expense.id,
    expense.date,
    expense.category,
    expense.description,
    Number(expense.amount || 0),
    Number(expense.paid || 0),
    Number(expense.createdAt || Date.now())
  ]);

  writeRows(EXPENSE_SHEET, headers, rows);
}

function writeTransfers(transfers) {
  const headers = ["id", "date", "amount", "note", "items", "createdAt", "slipFileName", "recipientMatched", "checkedText", "remainingAfterTransfer", "slipAttachedDate"];
  const rows = transfers.map((transfer) => [
    transfer.id,
    transfer.date,
    Number(transfer.amount || 0),
    transfer.note || "",
    JSON.stringify(Array.isArray(transfer.items) ? transfer.items : []),
    Number(transfer.createdAt || Date.now()),
    transfer.slip && transfer.slip.fileName ? transfer.slip.fileName : "",
    transfer.slip && transfer.slip.recipientMatched ? true : false,
    transfer.slip && transfer.slip.checkedText ? transfer.slip.checkedText : "",
    transfer.slip && transfer.slip.remainingAfterTransfer !== undefined ? transfer.slip.remainingAfterTransfer : "",
    transfer.slip && transfer.slip.attachedDate ? transfer.slip.attachedDate : ""
  ]);

  writeRows(TRANSFER_SHEET, headers, rows);
}

function writeRows(sheetName, headers, rows) {
  const sheet = getSheet(sheetName, headers);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function getSheet(name, headers) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function parseItems(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}
