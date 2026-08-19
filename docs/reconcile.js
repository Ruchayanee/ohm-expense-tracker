(function () {
  let appState;

  try {
    appState = state;
  } catch {
    return;
  }

  if (!appState || !Array.isArray(appState.expenses) || !Array.isArray(appState.transfers)) return;

  const originalRender = render;
  const originalSaveState = saveState;
  const originalPushToSheet = pushToSheet;

  function amount(value) {
    return Math.round(Number(String(value || 0).replaceAll(",", "")) * 100) / 100;
  }

  function unpaidExpenses() {
    return appState.expenses
      .filter((expense) => Number(expense.amount || 0) > Number(expense.paid || 0))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || Number(a.createdAt || 0) - Number(b.createdAt || 0));
  }

  function applyItems(items) {
    for (const item of items) {
      const expense = appState.expenses.find((entry) => entry.id === item.expenseId);
      if (!expense) continue;

      const due = Math.max(0, Number(expense.amount || 0) - Number(expense.paid || 0));
      const applied = Math.min(due, Number(item.amount || 0));
      expense.paid = amount(Number(expense.paid || 0) + applied);
    }
  }

  function applyAmount(transferAmount) {
    let remaining = Number(transferAmount || 0);

    for (const expense of unpaidExpenses()) {
      if (remaining <= 0) break;

      const due = Math.max(0, Number(expense.amount || 0) - Number(expense.paid || 0));
      const applied = Math.min(due, remaining);
      expense.paid = amount(Number(expense.paid || 0) + applied);
      remaining = amount(remaining - applied);
    }
  }

  function reconcile() {
    for (const expense of appState.expenses) {
      expense.amount = amount(expense.amount);
      expense.paid = amount(expense.paid);
    }

    if (!appState.transfers.length) return;

    for (const expense of appState.expenses) {
      expense.paid = 0;
    }

    const transfers = [...appState.transfers].sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    for (const transfer of transfers) {
      const items = Array.isArray(transfer.items) ? transfer.items : [];
      if (items.length) {
        applyItems(items);
      } else {
        applyAmount(transfer.amount);
      }
    }
  }

  render = function () {
    reconcile();
    return originalRender();
  };

  saveState = function () {
    reconcile();
    return originalSaveState();
  };

  pushToSheet = function (silent) {
    reconcile();
    return originalPushToSheet(silent);
  };

  reconcile();
  originalRender();
})();
