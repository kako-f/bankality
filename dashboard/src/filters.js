export const filterMovements = (movements, category) => [...movements].reverse().filter((movement) => !category || movement.category.trim() === category.trim())

export function filterMovementRows(movements, filters = {}) {
  const description = filters.description?.trim().toLocaleLowerCase();
  const amountMin = filters.amountMin === "" || filters.amountMin == null ? null : Number(filters.amountMin);
  const amountMax = filters.amountMax === "" || filters.amountMax == null ? null : Number(filters.amountMax);
  const balanceMin = filters.balanceMin === "" || filters.balanceMin == null ? null : Number(filters.balanceMin);
  const balanceMax = filters.balanceMax === "" || filters.balanceMax == null ? null : Number(filters.balanceMax);
  return movements.filter((movement) => (
    (!filters.dateFrom || movement.date >= filters.dateFrom) &&
    (!filters.dateTo || movement.date <= filters.dateTo) &&
    (!description || movement.description.toLocaleLowerCase().includes(description)) &&
    (!filters.category || movement.category.trim() === filters.category.trim()) &&
    (amountMin == null || Number.isNaN(amountMin) || movement.amount >= amountMin) &&
    (amountMax == null || Number.isNaN(amountMax) || movement.amount <= amountMax) &&
    (balanceMin == null || Number.isNaN(balanceMin) || movement.balance >= balanceMin) &&
    (balanceMax == null || Number.isNaN(balanceMax) || movement.balance <= balanceMax)
  ));
}

export function sortMovementRows(movements, { field = 'date', direction = 'desc' } = {}) {
  const factor = direction === 'asc' ? 1 : -1;
  return [...movements].sort((left, right) => {
    const comparison = field === 'date'
      ? left.date.localeCompare(right.date)
      : left[field].localeCompare(right[field], 'es-CL', { sensitivity: 'base' });
    return comparison * factor;
  });
}
