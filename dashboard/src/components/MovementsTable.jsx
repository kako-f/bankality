import { pesos } from "../formatters.js";

function SortableHeader({ field, label, sort, onSort }) {
  const active = sort.field === field;
  const direction = active ? sort.direction : "none";
  return (
    <th aria-sort={direction === "none" ? "none" : direction === "asc" ? "ascending" : "descending"}>
      <button type="button" className="sort-button" onClick={() => onSort(field)}>
        {label} <span aria-hidden="true">{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}

function ColumnFilters({ filters, categories, onChange }) {
  const update = (field) => (event) => onChange({ ...filters, [field]: event.target.value });
  return (
    <tr className="column-filters">
      <th><div className="date-range-filter"><input aria-label="Fecha inicial" title="Desde" type="date" value={filters.dateFrom} onChange={update("dateFrom")} /><input aria-label="Fecha final" title="Hasta" type="date" value={filters.dateTo} onChange={update("dateTo")} /></div></th>
      <th><input aria-label="Filtrar por descripción" placeholder="Buscar" value={filters.description} onChange={update("description")} /></th>
      <th><select aria-label="Filtrar por categoría" value={filters.category} onChange={update("category")}><option value="">Todas</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></th>
      <th><div className="range-filter"><input aria-label="Monto mínimo" type="number" placeholder="Mín." value={filters.amountMin} onChange={update("amountMin")} /><input aria-label="Monto máximo" type="number" placeholder="Máx." value={filters.amountMax} onChange={update("amountMax")} /></div></th>
      <th><div className="range-filter"><input aria-label="Saldo mínimo" type="number" placeholder="Mín." value={filters.balanceMin} onChange={update("balanceMin")} /><input aria-label="Saldo máximo" type="number" placeholder="Máx." value={filters.balanceMax} onChange={update("balanceMax")} /></div></th>
    </tr>
  );
}

export default function MovementsTable({ movements, categories, editable, onCategoryChange, filters, onFilterChange, sort, onSort }) {
  return (
    <div className="panel">
      <table>
        <thead>
          <tr><SortableHeader field="date" label="Fecha" sort={sort} onSort={onSort} /><SortableHeader field="description" label="Descripción" sort={sort} onSort={onSort} /><SortableHeader field="category" label="Categoría" sort={sort} onSort={onSort} /><th>Monto</th><th>Saldo</th></tr>
          <ColumnFilters filters={filters} categories={categories} onChange={onFilterChange} />
        </thead>
        <tbody>{movements.map((item) => (
          <tr key={item.id}>
            <td>{item.date}</td><td>{item.description}</td>
            <td>{editable ? <select aria-label={`Categoría de ${item.description}`} value={item.category} onChange={(event) => onCategoryChange(item, event.target.value)}>{!categories.includes(item.category) && <option value={item.category}>{item.category}</option>}{categories.map((category) => <option key={category}>{category}</option>)}</select> : item.category}</td>
            <td className={item.amount > 0 ? "credit" : "debit"}>{pesos.format(item.amount)}</td><td>{pesos.format(item.balance)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
