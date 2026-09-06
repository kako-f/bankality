import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  createCategory,
  deleteCategory,
  importFiles,
  loadCategories,
  loadMovements,
  renameCategory,
  updateCategory,
} from "./api.js";
import { filterMovements } from "./filters.js";

const pesos = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const PAGE_SIZE = 25;

function MovementsTable({ movements, categories, editable, onCategoryChange }) {
  return (
    <div className="panel">
      <table>
        <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Monto</th><th>Saldo</th></tr></thead>
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

function App() {
  const [section, setSection] = useState("dashboard");
  const [categorizePage, setCategorizePage] = useState("movements");
  const [movements, setMovements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [dashboardPage, setDashboardPage] = useState(1);
  const [categorizeMovementsPage, setCategorizeMovementsPage] = useState(1);
  const [dashboardFilter, setDashboardFilter] = useState("");
  const [categorizeFilter, setCategorizeFilter] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryEdits, setCategoryEdits] = useState({});
  const [replacementIds, setReplacementIds] = useState({});

  async function refreshCategories() {
    const nextCategories = await loadCategories();
    const nextCategoryNames = nextCategories.map((category) => category.name);
    setCategories(nextCategories);
    setDashboardFilter((current) => current && !nextCategoryNames.includes(current) ? "" : current);
    setCategorizeFilter((current) => current && !nextCategoryNames.includes(current) ? "" : current);
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
  const totals = useMemo(
    () =>
      movements.reduce(
        (result, item) => ({
          credits: result.credits + Math.max(item.amount, 0),
          debits: result.debits - Math.min(item.amount, 0),
        }),
        { credits: 0, debits: 0 },
      ),
    [movements],
  );

  const categoryNames = categories.map((category) => category.name);
  const dashboardMovements = filterMovements(movements, dashboardFilter);
  const categorizeMovements = filterMovements(movements, categorizeFilter);
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
          <span className="local-status">Django local</span>
        </header>
        {message && <p className="notice">{message}</p>}
        {section === "dashboard" ? (
          <section>
            <div className="cards">
              <article>
                <span>Saldo final</span>
                <strong>{pesos.format(movements.at(-1)?.balance || 0)}</strong>
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
            <div className="table-heading"><h2>Movimientos</h2><label>Filtrar categoría <select value={dashboardFilter} onChange={(event) => { setDashboardFilter(event.target.value); setDashboardPage(1); }}><option value="">Todas</option>{categoryNames.map((category) => <option key={category}>{category}</option>)}</select></label></div>
            {loading ? (
              <p>Cargando…</p>
            ) : (
              <MovementsTable movements={dashboardRows} categories={categoryNames} />
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
              <div className="table-heading"><h2>Modificar categorías</h2><label>Filtrar categoría <select value={categorizeFilter} onChange={(event) => { setCategorizeFilter(event.target.value); setCategorizeMovementsPage(1); }}><option value="">Todas</option>{categoryNames.map((category) => <option key={category}>{category}</option>)}</select></label></div>
              {loading ? <p>Cargando…</p> : <MovementsTable movements={categorizeRows} categories={categoryNames} editable onCategoryChange={changeCategory} />}
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
                accept=".pdf,.xls"
                multiple
                onChange={(event) => setFiles([...event.target.files])}
              />
              <button disabled={!files.length || loading}>
                Importar {files.length ? `(${files.length})` : ""}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
