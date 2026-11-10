import { pesos } from "../formatters.js";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";

function SortableHeader({ field, label, sort, onSort }) {
  const active = sort.field === field;

  return (
    <TableCell sortDirection={active ? sort.direction : false}>
      <TableSortLabel active={active} direction={active ? sort.direction : "asc"} onClick={() => onSort(field)}>
        {label}
      </TableSortLabel>
    </TableCell>
  );
}

function ColumnFilters({ filters, categories, onChange }) {
  const update = (field) => (event) => onChange({ ...filters, [field]: event.target.value });
  return (
    <TableRow className="column-filters">
      <TableCell>
        <div className="date-range-filter">
          <input aria-label="Fecha inicial" title="Desde" type="date" value={filters.dateFrom} onChange={update("dateFrom")} />
          <input aria-label="Fecha final" title="Hasta" type="date" value={filters.dateTo} onChange={update("dateTo")} />
        </div>
      </TableCell>
      <TableCell>
        <input aria-label="Filtrar por descripción" placeholder="Buscar" value={filters.description} onChange={update("description")} />
      </TableCell>
      <TableCell>
        <select aria-label="Filtrar por categoría" value={filters.category} onChange={update("category")}>
          <option value="">Todas</option>
          {categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </TableCell>
      <TableCell>
        <div className="range-filter">
          <input aria-label="Monto mínimo" type="number" placeholder="Mín." value={filters.amountMin} onChange={update("amountMin")} />
          <input aria-label="Monto máximo" type="number" placeholder="Máx." value={filters.amountMax} onChange={update("amountMax")} />
        </div>
      </TableCell>
      <TableCell>
        <div className="range-filter">
          <input aria-label="Saldo mínimo" type="number" placeholder="Mín." value={filters.balanceMin} onChange={update("balanceMin")} />
          <input aria-label="Saldo máximo" type="number" placeholder="Máx." value={filters.balanceMax} onChange={update("balanceMax")} />
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function MovementsTable({ movements, categories, editable, onCategoryChange, filters, onFilterChange, sort, onSort }) {
  return (
    <div className="panel">
      <TableContainer>
        <Table size="small" aria-label="Movimientos">
          <TableHead>
            <TableRow>
              <SortableHeader field="date" label="Fecha" sort={sort} onSort={onSort} />
              <SortableHeader field="description" label="Descripción" sort={sort} onSort={onSort} />
              <SortableHeader field="category" label="Categoría" sort={sort} onSort={onSort} />
              <TableCell>Monto</TableCell>
              <TableCell>Saldo</TableCell>
            </TableRow>
            <ColumnFilters filters={filters} categories={categories} onChange={onFilterChange} />
          </TableHead>
          <TableBody>
            {movements.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.date}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell>
                  {editable ? (
                    <select
                      aria-label={`Categoría de ${item.description}`}
                      value={item.category}
                      onChange={(event) => onCategoryChange(item, event.target.value)}
                    >
                      {!categories.includes(item.category) && <option value={item.category}>{item.category}</option>}
                      {categories.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  ) : (
                    item.category
                  )}
                </TableCell>
                <TableCell sx={{ color: item.amount > 0 ? "var(--accent)" : "var(--danger)" }}> {pesos.format(item.amount)}</TableCell>
                <TableCell>{pesos.format(item.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
