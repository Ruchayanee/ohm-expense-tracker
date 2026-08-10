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
  writeExpenses(Array.isArray(state.expenses) ? state.expenses : []);
  writeTransfers(Array.isArray(state.transfers) ? state.transfers : []);
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
  const sheet = getSheet(TRANSFER_SHEET, ["id", "date", "amount", "note", "items", "createdAt"]);
  const values = sheet.getDataRange().getValues().slice(1);

  return values
    .filter((row) => row[0])
    .map((row) => ({
      id: String(row[0]),
      date: String(row[1]),
      amount: Number(row[2] || 0),
      note: String(row[3] || ""),
      items: parseItems(row[4]),
      createdAt: Number(row[5] || Date.now())
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
  const headers = ["id", "date", "amount", "note", "items", "createdAt"];
  const rows = transfers.map((transfer) => [
    transfer.id,
    transfer.date,
    Number(transfer.amount || 0),
    transfer.note || "",
    JSON.stringify(Array.isArray(transfer.items) ? transfer.items : []),
    Number(transfer.createdAt || Date.now())
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
