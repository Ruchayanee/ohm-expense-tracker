const OFFICIAL_STORAGE_KEY = "ohm-expenses-v1";
const officialMoney = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" });

document.querySelector("#official-preview-button")?.addEventListener("click", () => openOfficialStatement(false));
document.querySelector("#official-print-button")?.addEventListener("click", () => openOfficialStatement(true));

function openOfficialStatement(shouldPrint) {
  const state = loadOfficialState();
  if (!state.expenses.length) {
    alert("ยังไม่มีรายการค่าใช้จ่ายสำหรับสร้างเอกสาร");
    return;
  }

  const documentWindow = window.open("", "_blank");
  if (!documentWindow) {
    alert("กรุณาอนุญาตให้เบราว์เซอร์เปิดหน้าต่างใหม่ก่อนสร้างเอกสาร");
    return;
  }

  documentWindow.document.open();
  documentWindow.document.write(buildOfficialStatementHtml(state, shouldPrint));
  documentWindow.document.close();
}

function loadOfficialState() {
  try {
    const data = JSON.parse(localStorage.getItem(OFFICIAL_STORAGE_KEY));
    return {
      expenses: Array.isArray(data?.expenses) ? data.expenses : [],
      transfers: Array.isArray(data?.transfers) ? data.transfers : []
    };
  } catch {
    return { expenses: [], transfers: [] };
  }
}

function buildOfficialStatementHtml(state, shouldPrint) {
  const expenses = [...state.expenses].sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.createdAt - b.createdAt);
  const total = roundOfficial(expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const paid = roundOfficial(expenses.reduce((sum, item) => sum + Number(item.paid || 0), 0));
  const outstanding = roundOfficial(total - paid);
  const generatedDate = formatThaiDisplayDate(new Date().toISOString().slice(0, 10));
  const period = getExpensePeriod(expenses);
  const documentNo = `OHM-${Date.now()}`;
  const categoryRows = Object.entries(groupOfficialByCategory(expenses))
    .map(([category, amount]) => `
      <tr>
        <td>${escapeOfficialHtml(category)}</td>
        <td class="right">${officialMoney.format(amount)}</td>
      </tr>
    `)
    .join("");
  const expenseRows = expenses
    .map((expense, index) => {
      const due = roundOfficial(Number(expense.amount || 0) - Number(expense.paid || 0));
      return `
        <tr>
          <td class="center">${index + 1}</td>
          <td>${escapeOfficialHtml(formatThaiDisplayDate(expense.date))}</td>
          <td>${escapeOfficialHtml(expense.category || "-")}</td>
          <td>${escapeOfficialHtml(expense.description || "-")}</td>
          <td class="right">${officialMoney.format(expense.amount || 0)}</td>
          <td class="right">${officialMoney.format(expense.paid || 0)}</td>
          <td class="right">${officialMoney.format(due)}</td>
          <td>${escapeOfficialHtml(getOfficialStatus(expense))}</td>
        </tr>
      `;
    })
    .join("");
  const printScript = shouldPrint ? "window.addEventListener('load', () => window.setTimeout(() => window.print(), 300));" : "";

  return `<!doctype html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>เอกสารแจ้งยอดค่าใช้จ่าย - โอม</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@600;700&family=Sarabun:wght@400;500;600;700&display=swap");
      * { box-sizing: border-box; }
      body { margin: 0; color: #111827; background: #ede7dc; font-family: "Sarabun", sans-serif; }
      .page { width: min(960px, 100%); margin: 0 auto; padding: 28px; }
      .sheet { min-height: calc(100vh - 56px); border: 1px solid #d8c6a6; padding: 34px; background: #fffdf8; box-shadow: 0 24px 70px rgba(17, 24, 39, 0.14); }
      .letterhead { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px double #0b1730; padding-bottom: 18px; }
      h1, h2, h3 { margin: 0; color: #0b1730; font-family: "Noto Serif Thai", serif; }
      h1 { font-size: 30px; }
      h2 { margin-top: 28px; margin-bottom: 12px; font-size: 20px; }
      p { margin: 0; }
      .muted { color: #6b6256; }
      .meta { display: grid; gap: 4px; text-align: right; font-weight: 600; }
      .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
      .info-box, .summary-box { border: 1px solid #d8c6a6; border-radius: 14px; padding: 14px; background: #fff8ec; }
      .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
      .summary-box span { display: block; color: #6b6256; font-size: 13px; font-weight: 700; }
      .summary-box strong { display: block; margin-top: 4px; color: #0b1730; font-family: "Noto Serif Thai", serif; font-size: 22px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
      th, td { border: 1px solid #d8c6a6; padding: 8px 9px; vertical-align: top; }
      th { color: #0b1730; background: #efe3d0; font-weight: 800; }
      .right { text-align: right; white-space: nowrap; }
      .center { text-align: center; }
      .notice { margin-top: 18px; border-left: 4px solid #b8955a; padding: 12px 14px; background: #fff8ec; line-height: 1.65; }
      .signatures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 36px; margin-top: 56px; }
      .signature { text-align: center; }
      .line { border-bottom: 1px solid #111827; height: 42px; margin-bottom: 8px; }
      .toolbar { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 14px; }
      button { border: 0; border-radius: 999px; padding: 12px 18px; color: #fff7ea; background: #0b1730; font: inherit; font-weight: 700; cursor: pointer; }
      @media print {
        body { background: #fff; }
        .page { width: 100%; padding: 0; }
        .sheet { min-height: auto; border: 0; box-shadow: none; padding: 18mm; }
        .toolbar { display: none; }
      }
      @media (max-width: 720px) {
        .page { padding: 14px; }
        .sheet { padding: 20px; }
        .letterhead, .info-grid, .summary-grid, .signatures { display: grid; grid-template-columns: 1fr; }
        .meta { text-align: left; }
        table { font-size: 12px; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <div class="toolbar">
        <button type="button" onclick="window.print()">พิมพ์ / บันทึก PDF</button>
      </div>
      <section class="sheet">
        <header class="letterhead">
          <div>
            <h1>เอกสารแจ้งยอดค่าใช้จ่าย</h1>
            <p class="muted">รายการค่าใช้จ่ายครอบครัว แอป “ค่าใช้จ่าย”</p>
          </div>
          <div class="meta">
            <p>เลขที่เอกสาร: ${documentNo}</p>
            <p>วันที่ออกเอกสาร: ${escapeOfficialHtml(generatedDate)}</p>
            <p>รอบรายการ: ${escapeOfficialHtml(period)}</p>
          </div>
        </header>

        <section class="info-grid">
          <div class="info-box">
            <h3>ผู้แจ้งยอด</h3>
            <p>รัชพล กุลวิทูรเวที</p>
          </div>
          <div class="info-box">
            <h3>ผู้รับแจ้งยอด</h3>
            <p>หม่าม๊า</p>
          </div>
        </section>

        <section class="summary-grid">
          <div class="summary-box"><span>ยอดค่าใช้จ่ายรวม</span><strong>${officialMoney.format(total)}</strong></div>
          <div class="summary-box"><span>ยอดชำระแล้ว</span><strong>${officialMoney.format(paid)}</strong></div>
          <div class="summary-box"><span>ยอดคงค้าง</span><strong>${outstanding <= 0 ? "ไม่มียอดค้าง" : officialMoney.format(outstanding)}</strong></div>
        </section>

        <h2>สรุปตามประเภทค่าใช้จ่าย</h2>
        <table>
          <thead><tr><th>ประเภทค่าใช้จ่าย</th><th class="right">ยอดรวม</th></tr></thead>
          <tbody>${categoryRows}</tbody>
        </table>

        <h2>รายละเอียดรายการค่าใช้จ่าย</h2>
        <table>
          <thead>
            <tr>
              <th class="center">ลำดับ</th>
              <th>วันที่</th>
              <th>ประเภท</th>
              <th>รายละเอียด</th>
              <th class="right">ยอดค่าใช้จ่าย</th>
              <th class="right">ชำระแล้ว</th>
              <th class="right">คงค้าง</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>${expenseRows}</tbody>
        </table>

        <p class="notice">หมายเหตุ: เอกสารฉบับนี้สร้างจากข้อมูลที่บันทึกในระบบติดตามค่าใช้จ่ายครอบครัว เพื่อใช้แจ้งยอดและประกอบการโอนชำระค่าใช้จ่ายตามรายการข้างต้น</p>

        <section class="signatures">
          <div class="signature">
            <div class="line"></div>
            <p>ผู้แจ้งยอด</p>
            <p class="muted">(รัชพล กุลวิทูรเวที)</p>
          </div>
          <div class="signature">
            <div class="line"></div>
            <p>ผู้รับทราบ / ผู้ชำระค่าใช้จ่าย</p>
            <p class="muted">(หม่าม๊า)</p>
          </div>
        </section>
      </section>
    </main>
    <script>${printScript}</script>
  </body>
</html>`;
}

function groupOfficialByCategory(expenses) {
  return expenses.reduce((groups, expense) => {
    const category = expense.category || "อื่น ๆ";
    groups[category] = roundOfficial((groups[category] || 0) + Number(expense.amount || 0));
    return groups;
  }, {});
}

function getExpensePeriod(expenses) {
  const dates = expenses.map((expense) => expense.date).filter(Boolean).sort();
  if (!dates.length) return "-";
  return `${formatThaiDisplayDate(dates[0])} - ${formatThaiDisplayDate(dates[dates.length - 1])}`;
}

function getOfficialStatus(expense) {
  if (Number(expense.paid || 0) >= Number(expense.amount || 0)) return "ชำระครบ";
  if (Number(expense.paid || 0) > 0) return "ชำระบางส่วน";
  return "ค้างชำระ";
}

function formatThaiDisplayDate(dateText) {
  if (!dateText) return "-";
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText;
  return date.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}

function roundOfficial(number) {
  return Math.round(Number(number || 0) * 100) / 100;
}

function escapeOfficialHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
