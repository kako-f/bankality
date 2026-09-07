import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  createCategory,
  deleteCategory,
  importFiles,
  loadCategories,
  loadMovements,
  previewFiles,
  resetData,
  renameCategory,
  updateCategory,
} from "./api.js";
import { filterMovementRows, sortMovementRows } from "./filters.js";
import { movementsByCategory, movementsByMonth } from "./chartData.js";
import { BarChart } from "@mui/x-charts/BarChart";

const pesos = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const PAGE_SIZE = 25;
const CATEGORY_CHART_MARGIN = Object.freeze({
  left: 75,
  right: 25,
  top: 25,
  bottom: 50,
});
const MONTH_CHART_MARGIN = Object.freeze({
  left: 85,
  right: 25,
  top: 25,
  bottom: 65,
});
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
  return (
    <th
      aria-sort={
        direction === "none"
          ? "none"
          : direction === "asc"
            ? "ascending"
            : "descending"
      }
    >
      <button
        type="button"
        className="sort-button"
        onClick={() => onSort(field)}
      >
        {label}{" "}
        <span aria-hidden="true">
          {active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function ColumnFilters({ filters, categories, onChange }) {
  const update = (field) => (event) =>
    onChange({ ...filters, [field]: event.target.value });
  return (
    <tr className="column-filters">
      <th>
        <div className="date-range-filter">
          <input
            aria-label="Fecha inicial"
            title="Desde"
            type="date"
            value={filters.dateFrom}
            onChange={update("dateFrom")}
          />
          <input
            aria-label="Fecha final"
            title="Hasta"
            type="date"
            value={filters.dateTo}
            onChange={update("dateTo")}
          />
        </div>
      </th>
      <th>
        <input
          aria-label="Filtrar por descripción"
          placeholder="Buscar"
          value={filters.description}
          onChange={update("description")}
        />
      </th>
      <th>
        <select
          aria-label="Filtrar por categoría"
          value={filters.category}
          onChange={update("category")}
        >
          <option value="">Todas</option>
          {categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </th>
      <th>
        <div className="range-filter">
          <input
            aria-label="Monto mínimo"
            type="number"
            placeholder="Mín."
            value={filters.amountMin}
            onChange={update("amountMin")}
          />
          <input
            aria-label="Monto máximo"
            type="number"
            placeholder="Máx."
            value={filters.amountMax}
            onChange={update("amountMax")}
          />
        </div>
      </th>
      <th>
        <div className="range-filter">
          <input
            aria-label="Saldo mínimo"
            type="number"
            placeholder="Mín."
            value={filters.balanceMin}
            onChange={update("balanceMin")}
          />
          <input
            aria-label="Saldo máximo"
            type="number"
            placeholder="Máx."
            value={filters.balanceMax}
            onChange={update("balanceMax")}
          />
        </div>
      </th>
    </tr>
  );
}

function MovementsTable({
  movements,
  categories,
  editable,
  onCategoryChange,
  filters,
  onFilterChange,
  sort,
  onSort,
}) {
  return (
    <div className="panel">
      <table>
        <thead>
          <tr>
            <SortableHeader
              field="date"
              label="Fecha"
              sort={sort}
              onSort={onSort}
            />
            <SortableHeader
              field="description"
              label="Descripción"
              sort={sort}
              onSort={onSort}
            />
            <SortableHeader
              field="category"
              label="Categoría"
              sort={sort}
              onSort={onSort}
            />
            <th>Monto</th>
            <th>Saldo</th>
          </tr>
          <ColumnFilters
            filters={filters}
            categories={categories}
            onChange={onFilterChange}
          />
        </thead>
        <tbody>
          {movements.map((item) => (
            <tr key={item.id}>
              <td>{item.date}</td>
              <td>{item.description}</td>
              <td>
                {editable ? (
                  <select
                    aria-label={`Categoría de ${item.description}`}
                    value={item.category}
                    onChange={(event) =>
                      onCategoryChange(item, event.target.value)
                    }
                  >
                    {!categories.includes(item.category) && (
                      <option value={item.category}>{item.category}</option>
                    )}
                    {categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                ) : (
                  item.category
                )}
              </td>
              <td className={item.amount > 0 ? "credit" : "debit"}>
                {pesos.format(item.amount)}
              </td>
              <td>{pesos.format(item.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ page, pages, setPage }) {
  return (
    <div className="pagination" aria-label="Paginación de movimientos">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Anterior
      </button>
      <span>
        Página {page} de {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => setPage(page + 1)}
      >
        Siguiente
      </button>
    </div>
  );
}

function ExpenseCharts({ movements, categories = [] }) {
  const categoryTotals = useMemo(() => {
    const totals = movementsByCategory(movements);
    const seen = new Set(totals.map(({ label }) => label));
    return [
      ...totals,
      ...categories
        .filter((category) => !seen.has(category))
        .map((label) => ({ label, total: 0 })),
    ];
  }, [movements, categories]);
  const monthTotals = useMemo(() => movementsByMonth(movements), [movements]);
  const chartSx = useMemo(
    () => ({
      "& .MuiChartsAxis-tickLabel": { fill: "var(--muted)" },
      "& .MuiChartsAxis-label": { fill: "var(--muted)" },
      "& .MuiChartsLegend-label": { fill: "var(--muted)" },
      "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": {
        stroke: "var(--border)",
      },
    }),
    [],
  );
  const categoryLabels = useMemo(
    () => categoryTotals.map(({ label }) => label),
    [categoryTotals],
  );
  const categoryValues = useMemo(
    () => categoryTotals.map(({ total }) => total),
    [categoryTotals],
  );
  const monthLabels = useMemo(
    () => monthTotals.map(({ label }) => label),
    [monthTotals],
  );
  const monthIncomeValues = useMemo(
    () => monthTotals.map(({ income }) => income),
    [monthTotals],
  );
  const monthExpenseValues = useMemo(
    () => monthTotals.map(({ expenses }) => expenses),
    [monthTotals],
  );
  const categoryXAxis = useMemo(
    () => [
      {
        scaleType: "band",
        data: categoryLabels,
        tickLabelInterval: () => true,
        tickLabelMinGap: 0,
        tickSpacing: 0,
        label: "Categoría",
        tickLabelStyle: { angle: -45, textAnchor: "end", fontSize: 12 },
      },
    ],
    [categoryLabels],
  );
  const categoryYAxis = useMemo(
    () => [{ valueFormatter: (value) => pesos.format(value) }],
    [],
  );
  const categorySeries = useMemo(
    () => [{ data: categoryValues, label: "Monto", color: "var(--accent)" }],
    [categoryValues],
  );
  const monthXAxis = useMemo(
    () => [{ scaleType: "band", data: monthLabels }],
    [monthLabels],
  );
  const monthYAxis = useMemo(
    () => [{ valueFormatter: (value) => pesos.format(value) }],
    [],
  );
  const monthSeries = useMemo(
    () => [
      { data: monthIncomeValues, label: "Ingresos", color: "var(--accent)" },
      { data: monthExpenseValues, label: "Gastos", color: "var(--danger)" },
    ],
    [monthIncomeValues, monthExpenseValues],
  );

  return (
    <div className="charts" aria-label="Gráficos de movimientos">
      <article className="chart-panel">
        <h2>Movimientos por categoría</h2>
        {categoryTotals.length ? (
          <BarChart
            height={550}
            xAxis={categoryXAxis}
            yAxis={categoryYAxis}
            series={categorySeries}
            margin={CATEGORY_CHART_MARGIN}
            sx={chartSx}
          />
        ) : (
          <p className="chart-empty">No hay movimientos para mostrar.</p>
        )}
        {categoryTotals.length > 0 && (
          <div
            className="category-axis-labels"
            aria-label="Categorías del eje X"
            style={{ gridTemplateColumns: `repeat(${categoryLabels.length}, minmax(0, 1fr))` }}
          >
            {categoryLabels.map((label) => <span key={label}>{label}</span>)}
          </div>
        )}
        {categoryTotals.length > 0 && (
          <div
            className="category-summary"
            aria-label="Detalle de movimientos por categoría"
          >
            {categoryTotals.map(({ label, total }) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{pesos.format(total)}</strong>
              </div>
            ))}
          </div>
        )}
      </article>
      <article className="chart-panel">
        <h2>Movimientos por mes</h2>
        {monthTotals.length ? (
          <BarChart
            height={360}
            xAxis={monthXAxis}
            series={monthSeries}
            yAxis={monthYAxis}
            margin={MONTH_CHART_MARGIN}
            sx={chartSx}
          />
        ) : (
          <p className="chart-empty">No hay movimientos para mostrar.</p>
        )}
      </article>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof localStorage === "undefined") return "dark";
    return localStorage.getItem("bankality-theme") || "dark";
  });
  const [section, setSection] = useState("dashboard");
  const [categorizePage, setCategorizePage] = useState("movements");
  const [analysisDateFilters, setAnalysisDateFilters] = useState({
    dateFrom: "",
    dateTo: "",
  });
  const [movements, setMovements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("info");
  const [loading, setLoading] = useState(true);
  const [dashboardPage, setDashboardPage] = useState(1);
  const [categorizeMovementsPage, setCategorizeMovementsPage] = useState(1);
  const [dashboardTableFilters, setDashboardTableFilters] =
    useState(EMPTY_TABLE_FILTERS);
  const [categorizeTableFilters, setCategorizeTableFilters] =
    useState(EMPTY_TABLE_FILTERS);
  const [dashboardSort, setDashboardSort] = useState({
    field: "date",
    direction: "desc",
  });
  const [categorizeSort, setCategorizeSort] = useState({
    field: "date",
    direction: "desc",
  });
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
      const [nextMovements] = await Promise.all([
        loadMovements(),
        refreshCategories(),
      ]);
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
    () =>
      sortMovementRows(
        filterMovementRows(movements, {
          dateFrom: dashboardTableFilters.dateFrom,
          dateTo: dashboardTableFilters.dateTo,
        }),
        { field: "date", direction: "desc" },
      ),
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

  const categoryNames = useMemo(
    () => categories.map((category) => category.name),
    [categories],
  );
  const dashboardMovements = useMemo(
    () =>
      sortMovementRows(
        filterMovementRows(movements, dashboardTableFilters),
        dashboardSort,
      ),
    [movements, dashboardTableFilters, dashboardSort],
  );
  const categorizeMovements = useMemo(
    () =>
      sortMovementRows(
        filterMovementRows(movements, categorizeTableFilters),
        categorizeSort,
      ),
    [movements, categorizeTableFilters, categorizeSort],
  );
  const analysisMovements = useMemo(
    () => filterMovementRows(movements, analysisDateFilters),
    [movements, analysisDateFilters],
  );
  const dashboardPages = Math.max(
    1,
    Math.ceil(dashboardMovements.length / PAGE_SIZE),
  );
  const categorizePages = Math.max(
    1,
    Math.ceil(categorizeMovements.length / PAGE_SIZE),
  );
  const dashboardRows = dashboardMovements.slice(
    (dashboardPage - 1) * PAGE_SIZE,
    dashboardPage * PAGE_SIZE,
  );
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
      setFiles([]);
      setPreview(null);
      await refresh();
      const imported = result.files.reduce(
        (total, file) => total + (file.imported || 0),
        0,
      );
      const skipped = result.files.reduce(
        (total, file) => total + (file.skipped || 0),
        0,
      );
      const errors = result.files.filter((file) => file.error);
      setMessage(
        `Importación completada: ${imported} importados, ${skipped} omitidos${errors.length ? ` · Errores: ${errors.map((file) => `${file.name}: ${file.error}`).join("; ")}` : ""}.`,
      );
      setMessageKind(errors.length && !imported ? "error" : "success");
    } catch (error) {
      setMessage(error.message);
      setMessageKind("error");
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
      setMessageKind("error");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function resetAllData() {
    if (
      !window.confirm(
        "¿Borrar todos los movimientos y categorías? Esta acción no se puede deshacer.",
      )
    )
      return;
    setLoading(true);
    try {
      const result = await resetData();
      setFiles([]);
      setPreview(null);
      await refresh();
      setMessage(
        `Datos reiniciados: ${result.deleted_movements} movimientos y ${result.deleted_categories} categorías eliminados.`,
      );
      setMessageKind("success");
    } catch (error) {
      setMessage(error.message);
      setMessageKind("error");
      setLoading(false);
    }
  }

  async function changeCategory(item, category) {
    try {
      const updated = await updateCategory(item.id, category);
      setMovements((current) =>
        current.map((movement) =>
          movement.id === updated.id
            ? { ...movement, category: updated.category }
            : movement,
        ),
      );
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
      await renameCategory(
        category.id,
        categoryEdits[category.id] ?? category.name,
      );
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
            className={section === "analysis" ? "active" : ""}
            onClick={() => setSection("analysis")}
          >
            Análisis
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
            <h1>
              {section === "dashboard"
                ? "Dashboard"
                : section === "categorize"
                  ? "Categorizar"
                  : section === "analysis"
                    ? "Análisis"
                    : "Importar"}
            </h1>
          </div>
          <div className="topbar-actions">
            <button
              className="theme-toggle"
              type="button"
              onClick={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
            >
              {theme === "dark" ? "☀ Tema claro" : "☾ Tema oscuro"}
            </button>
            <span className="local-status">Django local</span>
          </div>
        </header>
        {message && <p className={`notice ${messageKind}`}>{message}</p>}
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
            <div className="table-heading">
              <h2>Movimientos</h2>
            </div>
            <Pagination
              page={dashboardPage}
              pages={dashboardPages}
              setPage={setDashboardPage}
            />
            <br></br>
            {loading ? (
              <p>Cargando…</p>
            ) : (
              <MovementsTable
                movements={dashboardRows}
                categories={categoryNames}
                filters={dashboardTableFilters}
                onFilterChange={(nextFilters) => {
                  setDashboardTableFilters(nextFilters);
                  setDashboardPage(1);
                }}
                sort={dashboardSort}
                onSort={(field) => {
                  setDashboardSort((current) => ({
                    field,
                    direction:
                      current.field === field && current.direction === "asc"
                        ? "desc"
                        : "asc",
                  }));
                  setDashboardPage(1);
                }}
              />
            )}
            <Pagination
              page={dashboardPage}
              pages={dashboardPages}
              setPage={setDashboardPage}
            />
          </section>
        ) : section === "analysis" ? (
          <section>
            <div className="table-heading">
              <h2>Gastos</h2>
              <div className="analysis-filters">
                <label>
                  Desde{" "}
                  <input
                    type="date"
                    value={analysisDateFilters.dateFrom}
                    onChange={(event) =>
                      setAnalysisDateFilters((current) => ({
                        ...current,
                        dateFrom: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Hasta{" "}
                  <input
                    type="date"
                    value={analysisDateFilters.dateTo}
                    onChange={(event) =>
                      setAnalysisDateFilters((current) => ({
                        ...current,
                        dateTo: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </div>
            {loading ? (
              <p>Cargando…</p>
            ) : (
              <ExpenseCharts
                movements={analysisMovements}
                categories={categoryNames}
              />
            )}
          </section>
        ) : section === "categorize" ? (
          <section>
            <nav className="subnav" aria-label="Categorizar">
              <button
                className={categorizePage === "movements" ? "active" : ""}
                onClick={() => setCategorizePage("movements")}
              >
                Movimientos
              </button>
              <button
                className={categorizePage === "categories" ? "active" : ""}
                onClick={() => setCategorizePage("categories")}
              >
                Categorías
              </button>
            </nav>
            {categorizePage === "movements" ? (
              <>
                <div className="table-heading">
                  <h2>Modificar categorías</h2>
                </div>
                {loading ? (
                  <p>Cargando…</p>
                ) : (
                  <MovementsTable
                    movements={categorizeRows}
                    categories={categoryNames}
                    editable
                    onCategoryChange={changeCategory}
                    filters={categorizeTableFilters}
                    onFilterChange={(nextFilters) => {
                      setCategorizeTableFilters(nextFilters);
                      setCategorizeMovementsPage(1);
                    }}
                    sort={categorizeSort}
                    onSort={(field) => {
                      setCategorizeSort((current) => ({
                        field,
                        direction:
                          current.field === field && current.direction === "asc"
                            ? "desc"
                            : "asc",
                      }));
                      setCategorizeMovementsPage(1);
                    }}
                  />
                )}
                <Pagination
                  page={categorizeMovementsPage}
                  pages={categorizePages}
                  setPage={setCategorizeMovementsPage}
                />
              </>
            ) : loading ? (
              <p>Cargando…</p>
            ) : (
              <>
                <h2>Categorías</h2>
                <form className="category-form" onSubmit={addCategory}>
                  <input
                    aria-label="Nueva categoría"
                    placeholder="Nueva categoría"
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                  />
                  <button>Crear</button>
                </form>
                <div className="panel">
                  {categories.map((category) => {
                    const replacementId = replacementIds[category.id] ?? "";
                    return (
                      <div className="category-row" key={category.id}>
                        <input
                          aria-label={`Nombre de ${category.name}`}
                          value={categoryEdits[category.id] ?? category.name}
                          onChange={(event) =>
                            setCategoryEdits((current) => ({
                              ...current,
                              [category.id]: event.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          onClick={() => updateCategoryName(category)}
                        >
                          Renombrar
                        </button>
                        <select
                          aria-label={`Reemplazar ${category.name} por`}
                          value={replacementId}
                          onChange={(event) =>
                            setReplacementIds((current) => ({
                              ...current,
                              [category.id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Reemplazar por…</option>
                          {categories
                            .filter((candidate) => candidate.id !== category.id)
                            .map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.name}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          disabled={categories.length < 2 || !replacementId}
                          onClick={() => removeCategory(category)}
                        >
                          Eliminar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
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
            <button
              className="reset-button"
              type="button"
              disabled={loading || previewLoading}
              onClick={resetAllData}
            >
              Reiniciar datos
            </button>
            <p className="reset-warning">
              Borra todos los movimientos y categorías.
            </p>
            {previewLoading && <p>Generando previsualización…</p>}
            {preview?.files.map((file) => (
              <div className="preview" key={file.name}>
                <h3>{file.name}</h3>
                {file.error ? (
                  <p className="preview-error">{file.error}</p>
                ) : (
                  <>
                    <p>
                      {file.total} movimiento{file.total === 1 ? "" : "s"}{" "}
                      detectado{file.total === 1 ? "" : "s"}
                      {file.total > file.rows.length
                        ? ` · mostrando los primeros ${file.rows.length}`
                        : ""}
                      .
                    </p>
                    <div className="panel">
                      <table>
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Descripción</th>
                            <th>Categoría</th>
                            <th>Monto</th>
                            <th>Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {file.rows.map((row, index) => (
                            <tr key={`${file.name}-${index}`}>
                              <td>{row.date}</td>
                              <td>{row.description}</td>
                              <td>{row.category}</td>
                              <td>{pesos.format(row.amount)}</td>
                              <td>{pesos.format(row.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
