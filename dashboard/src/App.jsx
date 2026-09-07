import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  createCategory,
  deleteCategory,
  importFiles,
  loadCategories,
  loadMovements,
  previewFiles,
  renameCategory,
  updateCategory,
} from "./api.js";
import { filterMovementRows, sortMovementRows } from "./filters.js";
import { expensesByCategory, expensesByMonth } from "./chartData.js";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";

const pesos = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const PAGE_SIZE = 25;
const EMPTY_TABLE_FILTERS = {
  dateFrom: "",
  dateTo: "",
  description: "",
  category: "",
  amountMin: "",
  amountMax: "",
  balanceMin: "",
  balanceMax: "",
};

function SortableHeader({ field, label, sort, onSort }) {
  const active = sort.field === field;
  const direction = active ? sort.direction : "none";
  return <th aria-sort={direction === "none" ? "none" : direction === "asc" ? "ascending" : "descending"}>
    <button type="button" className="sort-button" onClick={() => onSort(field)}>{label} <span aria-hidden="true">{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span></button>
  </th>;
}

function ColumnFilters({ filters, categories, onChange }) {
  const update = (field) => (event) => onChange({ ...filters, [field]: event.target.value });
  return <tr className="column-filters">
    <th><div className="date-range-filter"><input aria-label="Fecha inicial" title="Desde" type="date" value={filters.dateFrom} onChange={update("dateFrom")} /><input aria-label="Fecha final" title="Hasta" type="date" value={filters.dateTo} onChange={update("dateTo")} /></div></th>
    <th><input aria-label="Filtrar por descripción" placeholder="Buscar" value={filters.description} onChange={update("description")} /></th>
    <th><select aria-label="Filtrar por categoría" value={filters.category} onChange={update("category")}><option value="">Todas</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></th>
    <th><div className="range-filter"><input aria-label="Monto mínimo" type="number" placeholder="Mín." value={filters.amountMin} onChange={update("amountMin")} /><input aria-label="Monto máximo" type="number" placeholder="Máx." value={filters.amountMax} onChange={update("amountMax")} /></div></th>
    <th><div className="range-filter"><input aria-label="Saldo mínimo" type="number" placeholder="Mín." value={filters.balanceMin} onChange={update("balanceMin")} /><input aria-label="Saldo máximo" type="number" placeholder="Máx." value={filters.balanceMax} onChange={update("balanceMax")} /></div></th>
  </tr>;
}

function MovementsTable({ movements, categories, editable, onCategoryChange, filters, onFilterChange, sort, onSort }) {
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

function Pagination({ page, pages, setPage }) {
  return <div className="pagination" aria-label="Paginación de movimientos">
    <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
    <span>Página {page} de {pages}</span>
    <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Siguiente</button>
  </div>;
}

function ExpenseCharts({ movements }) {
  const categoryTotals = expensesByCategory(movements);
  const monthTotals = expensesByMonth(movements);
  const chartText = { fill: "var(--muted)" };
  const chartSx = {
    "& .MuiChartsAxis-tickLabel": chartText,
    "& .MuiChartsAxis-label": chartText,
    "& .MuiChartsLegend-label": chartText,
    "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": { stroke: "var(--border)" },
  };

  return <div className="charts" aria-label="Gráficos de gastos">
    <article className="chart-panel">
      <h2>Gastos por categoría</h2>
      {categoryTotals.length ? <BarChart
        layout="horizontal"
        height={Math.max(250, categoryTotals.length * 54)}
        xAxis={[{ valueFormatter: (value) => pesos.format(value) }]}
        yAxis={[{ scaleType: "band", data: categoryTotals.map(({ label }) => label) }]}
        series={[{ data: categoryTotals.map(({ total }) => total), label: "Gastos", color: "var(--danger)" }]}
        margin={{ left: 110, right: 20, top: 20, bottom: 45 }}
        sx={chartSx}
      /> : <p className="chart-empty">No hay gastos para mostrar.</p>}
    </article>
    <article className="chart-panel">
      <h2>Evolución mensual</h2>
      {monthTotals.length ? <LineChart
        height={300}
        xAxis={[{ scaleType: "point", data: monthTotals.map(({ label }) => label) }]}
        series={[{ data: monthTotals.map(({ total }) => total), label: "Gastos", color: "var(--accent)", area: true, showMark: true }]}
        yAxis={[{ valueFormatter: (value) => pesos.format(value) }]}
        margin={{ left: 75, right: 20, top: 20, bottom: 45 }}
        sx={chartSx}
      /> : <p className="chart-empty">No hay gastos para mostrar.</p>}
    </article>
  </div>;
}

function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof localStorage === "undefined") return "dark";
    return localStorage.getItem("bankality-theme") || "dark";
  });
  const [section, setSection] = useState("dashboard");
  const [categorizePage, setCategorizePage] = useState("movements");
  const [movements, setMovements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [dashboardPage, setDashboardPage] = useState(1);
  const [categorizeMovementsPage, setCategorizeMovementsPage] = useState(1);
  const [dashboardTableFilters, setDashboardTableFilters] = useState(EMPTY_TABLE_FILTERS);
  const [categorizeTableFilters, setCategorizeTableFilters] = useState(EMPTY_TABLE_FILTERS);
  const [dashboardSort, setDashboardSort] = useState({ field: "date", direction: "desc" });
  const [categorizeSort, setCategorizeSort] = useState({ field: "date", direction: "desc" });
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryEdits, setCategoryEdits] = useState({});
  const [replacementIds, setReplacementIds] = useState({});

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("bankality-theme", theme);
  }, [theme]);

  async function refreshCategories() {
    const nextCategories = await loadCategories();
    setCategories(nextCategories);
    setCategoryEdits({});
    setReplacementIds({});
  }

  async function refresh() {
    setDashboardPage(1);
    setCategorizeMovementsPage(1);
    setLoading(true);
    try {
      const [nextMovements] = await Promise.all([loadMovements(), refreshCategories()]);
      setMovements(nextMovements);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([loadMovements(), loadCategories()])
      .then(([nextMovements, nextCategories]) => {
        setMovements(nextMovements);
        setCategories(nextCategories);
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);
  const summaryMovements = useMemo(
    () => sortMovementRows(filterMovementRows(movements, { dateFrom: dashboardTableFilters.dateFrom, dateTo: dashboardTableFilters.dateTo }), { field: "date", direction: "desc" }),
    [movements, dashboardTableFilters.dateFrom, dashboardTableFilters.dateTo],
  );
  const totals = useMemo(
    () =>
      summaryMovements.reduce(
        (result, item) => ({
          credits: result.credits + Math.max(item.amount, 0),
          debits: result.debits - Math.min(item.amount, 0),
        }),
        { credits: 0, debits: 0 },
      ),
    [summaryMovements],
  );
  const finalBalance = summaryMovements[0]?.balance || 0;

  const categoryNames = categories.map((category) => category.name);
  const dashboardMovements = sortMovementRows(filterMovementRows(movements, dashboardTableFilters), dashboardSort);
  const categorizeMovements = sortMovementRows(filterMovementRows(movements, categorizeTableFilters), categorizeSort);
  const dashboardPages = Math.max(1, Math.ceil(dashboardMovements.length / PAGE_SIZE));
  const categorizePages = Math.max(1, Math.ceil(categorizeMovements.length / PAGE_SIZE));
  const dashboardRows = dashboardMovements.slice((dashboardPage - 1) * PAGE_SIZE, dashboardPage * PAGE_SIZE);
  const categorizeRows = categorizeMovements.slice(
    (categorizeMovementsPage - 1) * PAGE_SIZE,
    categorizeMovementsPage * PAGE_SIZE,
  );

  async function submit(event) {
    event.preventDefault();
    if (!files.length) return;
    setLoading(true);
    try {
      const result = await importFiles(files);
      setMessage(
        result.files
          .map(
            (file) =>
              file.error ||
              `${file.name}: ${file.imported} importados, ${file.skipped} omitidos`,
          )
          .join(" · "),
      );
      setFiles([]);
      await refresh();
    } catch (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }

  async function selectFiles(event) {
    const nextFiles = [...event.target.files];
    setFiles(nextFiles);
    setPreview(null);
    if (!nextFiles.length) return;
    setPreviewLoading(true);
    try {
      setPreview(await previewFiles(nextFiles));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function changeCategory(item, category) {
    try {
      const updated = await updateCategory(item.id, category);
      setMovements((current) => current.map((movement) => (
        movement.id === updated.id ? { ...movement, category: updated.category } : movement
      )));
      setDashboardPage(1);
      setCategorizeMovementsPage(1);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function addCategory(event) {
    event.preventDefault();
    try {
      await createCategory(newCategoryName);
      setNewCategoryName("");
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateCategoryName(category) {
    try {
      await renameCategory(category.id, categoryEdits[category.id] ?? category.name);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function removeCategory(category) {
    try {
      await deleteCategory(category.id, Number(replacementIds[category.id]));
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <p className="brand">
          Bankality<small>Panel local</small>
        </p>
        <nav className="side-nav" aria-label="Secciones">
          <button
            className={section === "dashboard" ? "active" : ""}
            onClick={() => setSection("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={section === "categorize" ? "active" : ""}
            onClick={() => setSection("categorize")}
          >
            Categorizar
          </button>
          <button
            className={section === "import" ? "active" : ""}
            onClick={() => setSection("import")}
          >
            Importar
          </button>
        </nav>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Movimientos bancarios</p>
            <h1>{section === "dashboard" ? "Dashboard" : section === "categorize" ? "Categorizar" : "Importar"}</h1>
          </div>
          <div className="topbar-actions">
            <button className="theme-toggle" type="button" onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "☀ Tema claro" : "☾ Tema oscuro"}
            </button>
            <span className="local-status">Django local</span>
          </div>
        </header>
        {message && <p className="notice">{message}</p>}
        {section === "dashboard" ? (
          <section>
            <div className="cards">
              <article>
                <span>Saldo final</span>
                <strong>{pesos.format(finalBalance)}</strong>
              </article>
              <article>
                <span>Abonos</span>
                <strong>{pesos.format(totals.credits)}</strong>
              </article>
              <article>
                <span>Cargos</span>
                <strong>{pesos.format(totals.debits)}</strong>
              </article>
            </div>
            {!loading && <ExpenseCharts movements={dashboardMovements} />}
            <div className="table-heading"><h2>Movimientos</h2></div>
            {loading ? (
              <p>Cargando…</p>
            ) : (
              <MovementsTable
                movements={dashboardRows}
                categories={categoryNames}
                filters={dashboardTableFilters}
                onFilterChange={(nextFilters) => { setDashboardTableFilters(nextFilters); setDashboardPage(1); }}
                sort={dashboardSort}
                onSort={(field) => { setDashboardSort((current) => ({ field, direction: current.field === field && current.direction === "asc" ? "desc" : "asc" })); setDashboardPage(1); }}
              />
            )}
            <Pagination page={dashboardPage} pages={dashboardPages} setPage={setDashboardPage} />
          </section>
        ) : section === "categorize" ? (
          <section>
            <nav className="subnav" aria-label="Categorizar">
              <button className={categorizePage === "movements" ? "active" : ""} onClick={() => setCategorizePage("movements")}>Movimientos</button>
              <button className={categorizePage === "categories" ? "active" : ""} onClick={() => setCategorizePage("categories")}>Categorías</button>
            </nav>
            {categorizePage === "movements" ? <>
              <div className="table-heading"><h2>Modificar categorías</h2></div>
              {loading ? <p>Cargando…</p> : <MovementsTable
                movements={categorizeRows}
                categories={categoryNames}
                editable
                onCategoryChange={changeCategory}
                filters={categorizeTableFilters}
                onFilterChange={(nextFilters) => { setCategorizeTableFilters(nextFilters); setCategorizeMovementsPage(1); }}
                sort={categorizeSort}
                onSort={(field) => { setCategorizeSort((current) => ({ field, direction: current.field === field && current.direction === "asc" ? "desc" : "asc" })); setCategorizeMovementsPage(1); }}
              />}
              <Pagination page={categorizeMovementsPage} pages={categorizePages} setPage={setCategorizeMovementsPage} />
            </> : loading ? <p>Cargando…</p> : <>
              <h2>Categorías</h2>
              <form className="category-form" onSubmit={addCategory}>
                <input aria-label="Nueva categoría" placeholder="Nueva categoría" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} />
                <button>Crear</button>
              </form>
              <div className="panel">
                {categories.map((category) => {
                  const replacementId = replacementIds[category.id] ?? "";
                  return <div className="category-row" key={category.id}>
                    <input aria-label={`Nombre de ${category.name}`} value={categoryEdits[category.id] ?? category.name} onChange={(event) => setCategoryEdits((current) => ({ ...current, [category.id]: event.target.value }))} />
                    <button type="button" onClick={() => updateCategoryName(category)}>Renombrar</button>
                    <select aria-label={`Reemplazar ${category.name} por`} value={replacementId} onChange={(event) => setReplacementIds((current) => ({ ...current, [category.id]: event.target.value }))}>
                      <option value="">Reemplazar por…</option>
                      {categories.filter((candidate) => candidate.id !== category.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
                    </select>
                    <button type="button" disabled={categories.length < 2 || !replacementId} onClick={() => removeCategory(category)}>Eliminar</button>
                  </div>;
                })}
              </div>
            </>}
          </section>
        ) : (
          <section className="import">
            <h2>Importar cartolas</h2>
            <p>
              Selecciona archivos BCI en formato PDF o XLS. Se procesan sólo en
              este equipo.
            </p>
            <form onSubmit={submit}>
              <input
                type="file"
                accept=".pdf,.xls,.xlsx"
                multiple
                onChange={selectFiles}
              />
              <button disabled={!files.length || loading || previewLoading}>
                Importar {files.length ? `(${files.length})` : ""}
              </button>
            </form>
            {previewLoading && <p>Generando previsualización…</p>}
            {preview?.files.map((file) => <div className="preview" key={file.name}>
              <h3>{file.name}</h3>
              {file.error ? <p className="preview-error">{file.error}</p> : <>
                <p>{file.total} movimiento{file.total === 1 ? "" : "s"} detectado{file.total === 1 ? "" : "s"}{file.total > file.rows.length ? ` · mostrando los primeros ${file.rows.length}` : ""}.</p>
                <div className="panel"><table>
                  <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Monto</th><th>Saldo</th></tr></thead>
                  <tbody>{file.rows.map((row, index) => <tr key={`${file.name}-${index}`}><td>{row.date}</td><td>{row.description}</td><td>{row.category}</td><td>{pesos.format(row.amount)}</td><td>{pesos.format(row.balance)}</td></tr>)}</tbody>
                </table></div>
              </>}
            </div>)}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
