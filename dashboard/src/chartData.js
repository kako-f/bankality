function expenseMovements(movements) {
  return movements.filter((movement) => movement.amount < 0);
}

export function expensesByCategory(movements) {
  const totals = new Map();
  expenseMovements(movements).forEach((movement) => {
    const category = movement.category?.trim() || "Sin categoría";
    totals.set(category, (totals.get(category) || 0) + Math.abs(movement.amount));
  });
  return [...totals.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label));
}

export function expensesByMonth(movements) {
  const totals = new Map();
  expenseMovements(movements).forEach((movement) => {
    const month = movement.date.slice(0, 7);
    totals.set(month, (totals.get(month) || 0) + Math.abs(movement.amount));
  });
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, total]) => ({
      label: new Intl.DateTimeFormat("es-CL", { month: "short", year: "numeric" }).format(new Date(`${month}-01T00:00:00`)),
      total,
    }));
}

export function movementsByMonth(movements) {
  const totals = new Map();
  movements.forEach((movement) => {
    const month = movement.date.slice(0, 7);
    const current = totals.get(month) || { income: 0, expenses: 0 };
    if (movement.amount >= 0) current.income += movement.amount;
    else current.expenses += Math.abs(movement.amount);
    totals.set(month, current);
  });
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, { income, expenses }]) => ({
      label: new Intl.DateTimeFormat("es-CL", { month: "short", year: "numeric" }).format(new Date(`${month}-01T00:00:00`)),
      income,
      expenses,
    }));
}
