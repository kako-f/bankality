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
  resetData,
  updateCategory,
} from "./api.js";
import { filterMovementRows, sortMovementRows } from "./filters.js";
import { EMPTY_TABLE_FILTERS, PAGE_SIZE, pesos } from "./formatters.js";
import CategoryManager from "./components/CategoryManager.jsx";
import Analysis from "./components/Analysis.jsx";
import ResetSection from "./components/GeneralOptionSection.jsx";
import ImportSection from "./components/ImportSection.jsx";
import MovementsTable from "./components/MovementsTable.jsx";
import Pagination from "./components/Pagination.jsx";
import Sidebar from "./components/Sidebar.jsx";
import GeneralOptionSection from "./components/GeneralOptionSection.jsx";
import { createTheme, ThemeProvider } from "@mui/material/styles";

import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

function sortState() {
  return { field: "date", direction: "desc" };
}

function App() {
  const [theme, setTheme] = useState(() => (typeof localStorage === "undefined" ? "dark" : localStorage.getItem("bankality-theme") || "dark"));
  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: theme,
          primary: {
            main: theme === "dark" ? "#39b86d" : "#198754",
          },
          background: {
            default: theme === "dark" ? "#202522" : "#f3f6f4",
            paper: theme === "dark" ? "#2b332e" : "#ffffff",
          },
          text: {
            primary: theme === "dark" ? "#e5eee8" : "#243029",
            secondary: theme === "dark" ? "#aab8ae" : "#5e6e64",
          },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: { textTransform: "none" },
            },
          },
        },
      }),
    [theme],
  );
  const [section, setSection] = useState("dashboard");
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
  const [dashboardTableFilters, setDashboardTableFilters] = useState(EMPTY_TABLE_FILTERS);
  const [categorizeTableFilters, setCategorizeTableFilters] = useState(EMPTY_TABLE_FILTERS);
  const [dashboardSort, setDashboardSort] = useState(sortState);
  const [categorizeSort, setCategorizeSort] = useState(sortState);
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
      setMessageKind("error");
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
      .catch((error) => {
        setMessage(error.message);
        setMessageKind("error");
      })
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
  const categoryNames = useMemo(() => categories.map((category) => category.name), [categories]);
  const dashboardMovements = useMemo(
    () => sortMovementRows(filterMovementRows(movements, dashboardTableFilters), dashboardSort),
    [movements, dashboardTableFilters, dashboardSort],
  );
  const categorizeMovements = useMemo(
    () => sortMovementRows(filterMovementRows(movements, categorizeTableFilters), categorizeSort),
    [movements, categorizeTableFilters, categorizeSort],
  );
  const dashboardPages = Math.max(1, Math.ceil(dashboardMovements.length / PAGE_SIZE));
  const categorizePages = Math.max(1, Math.ceil(categorizeMovements.length / PAGE_SIZE));
  const dashboardRows = dashboardMovements.slice((dashboardPage - 1) * PAGE_SIZE, dashboardPage * PAGE_SIZE);
  const categorizeRows = categorizeMovements.slice((categorizeMovementsPage - 1) * PAGE_SIZE, categorizeMovementsPage * PAGE_SIZE);

  async function submit(event) {
    event.preventDefault();
    if (!files.length) return;
    setLoading(true);
    try {
      const result = await importFiles(files);
      setFiles([]);
      setPreview(null);
      await refresh();
      const imported = result.files.reduce((total, file) => total + (file.imported || 0), 0);
      const skipped = result.files.reduce((total, file) => total + (file.skipped || 0), 0);
      const errors = result.files.filter((file) => file.error);
      setMessage(
        `Importación completa: ${imported} importados, ${skipped} omitidos${errors.length ? ` · Errores: ${errors.map((file) => `${file.name}: ${file.error}`).join("; ")}` : ""}.`,
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
    if (!window.confirm("¿Borrar todos los movimientos y categorías? Esta acción no se puede deshacer.")) return;
    setLoading(true);
    try {
      const result = await resetData();
      setFiles([]);
      setPreview(null);
      await refresh();
      setMessage(`Datos reiniciados: ${result.deleted_movements} movimientos y ${result.deleted_categories} categorías eliminados.`);
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
      setMovements((current) => current.map((movement) => (movement.id === updated.id ? { ...movement, category: updated.category } : movement)));
    } catch (error) {
      setMessage(error.message);
      setMessageKind("error");
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
      setMessageKind("error");
    }
  }

  async function updateCategoryName(category) {
    try {
      await renameCategory(category.id, categoryEdits[category.id] ?? category.name);
      await refresh();
    } catch (error) {
      setMessage(error.message);
      setMessageKind("error");
    }
  }

  async function removeCategory(category) {
    try {
      await deleteCategory(category.id, Number(replacementIds[category.id]));
      await refresh();
    } catch (error) {
      setMessage(error.message);
      setMessageKind("error");
    }
  }

  const setTableFilter = (setter, pageSetter) => (nextFilters) => {
    setter(nextFilters);
    pageSetter(1);
  };
  const toggleSort = (setter, pageSetter) => (field) => {
    setter((current) => ({
      field,
      direction: current.field === field && current.direction === "asc" ? "desc" : "asc",
    }));
    pageSetter(1);
  };
  const changeSection = (nextSection) => {
    setSection(nextSection);
    setMessage("");
  };
  const title = {
    dashboard: "Principal",
    import: "Importar",
    analysis: "Análisis",
    option: "Opciones",
    movements: "Movimientos",
    categories: "Categorías",
    delete: "Reiniciar",
    genOptions: "Opciones Generales",
  }[section];

  return (
    <ThemeProvider theme={muiTheme}>
      <div className="app-shell">
        <Sidebar section={section} onSectionChange={changeSection} />
        <main className="main-content">
          <header className="topbar">
            <div>
              <h1>{title}</h1>
            </div>
            <div className="topbar-actions">
              <button className="theme-toggle" type="button" onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}>
                {theme === "dark" ? "☀ Tema claro" : "☾ Tema oscuro"}
              </button>
            </div>
          </header>
          {message && <p className={`notice ${messageKind}`}>{message}</p>}
          {section === "dashboard" && (
            <section>
              <div className="cards">
                <Card sx={{ minWidth: 275, borderLeft: "4px solid #3c8dbc" }}>
                  <CardContent>
                    <Typography gutterBottom sx={{ color: "text.secondary", fontSize: 14 }}>
                      Saldo Final
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                      {pesos.format(finalBalance)}
                    </Typography>
                  </CardContent>
                </Card>
                <Card sx={{ minWidth: 275, borderLeft: "4px solid #3c8dbc" }}>
                  <CardContent>
                    <Typography gutterBottom sx={{ color: "text.secondary", fontSize: 14 }}>
                      Abonos
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                      {pesos.format(totals.credits)}
                    </Typography>
                  </CardContent>
                </Card>
                <Card sx={{ minWidth: 275, borderLeft: "4px solid #3c8dbc"}}>
                  <CardContent>
                    <Typography gutterBottom sx={{ color: "text.secondary", fontSize: 14 }}>
                      Saldo Final
                    </Typography>
                    <Typography variant="h4" sx={{fontWeight: 'bold'}}>
                      {pesos.format(totals.debits)}
                    </Typography>
                  </CardContent>
                </Card>                
              </div>
              <div className="table-heading">
                <h2>Movimientos</h2>
              </div>
              <Pagination page={dashboardPage} pages={dashboardPages} setPage={setDashboardPage} />
              <br />
              {loading ? (
                <p>Cargando…</p>
              ) : (
                <MovementsTable
                  movements={dashboardRows}
                  categories={categoryNames}
                  filters={dashboardTableFilters}
                  onFilterChange={setTableFilter(setDashboardTableFilters, setDashboardPage)}
                  sort={dashboardSort}
                  onSort={toggleSort(setDashboardSort, setDashboardPage)}
                />
              )}
              <Pagination page={dashboardPage} pages={dashboardPages} setPage={setDashboardPage} />
            </section>
          )}

          {section === "movements" && (
            <section>
              <div className="table-heading">
                <h2>Modificar categorías de los movimientos</h2>
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
                  onFilterChange={setTableFilter(setCategorizeTableFilters, setCategorizeMovementsPage)}
                  sort={categorizeSort}
                  onSort={toggleSort(setCategorizeSort, setCategorizeMovementsPage)}
                />
              )}

              <Pagination page={categorizeMovementsPage} pages={categorizePages} setPage={setCategorizeMovementsPage} />
            </section>
          )}

          {section === "categories" && (
            <section>
              {loading ? (
                <p>Cargando…</p>
              ) : (
                <CategoryManager
                  categories={categories}
                  newCategoryName={newCategoryName}
                  setNewCategoryName={setNewCategoryName}
                  categoryEdits={categoryEdits}
                  setCategoryEdits={setCategoryEdits}
                  replacementIds={replacementIds}
                  setReplacementIds={setReplacementIds}
                  onAdd={addCategory}
                  onRename={updateCategoryName}
                  onRemove={removeCategory}
                />
              )}
            </section>
          )}
          {section === "analysis" && <Analysis categories={categories} movements={movements}></Analysis>}

          {section === "import" && (
            <ImportSection
              files={files}
              preview={preview}
              previewLoading={previewLoading}
              loading={loading}
              onSubmit={submit}
              onSelectFiles={selectFiles}
              onReset={resetAllData}
            />
          )}
          {section === "genOptions" && (
            <GeneralOptionSection previewLoading={previewLoading} loading={loading} onSubmit={submit} onReset={resetAllData}></GeneralOptionSection>
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
