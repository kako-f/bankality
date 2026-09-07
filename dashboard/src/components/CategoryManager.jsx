export default function CategoryManager({ categories, newCategoryName, setNewCategoryName, categoryEdits, setCategoryEdits, replacementIds, setReplacementIds, onAdd, onRename, onRemove }) {
  return <>
    <h2>Categorías</h2>
    <form className="category-form" onSubmit={onAdd}>
      <input aria-label="Nueva categoría" placeholder="Nueva categoría" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} />
      <button>Crear</button>
    </form>
    <div className="panel">
      {categories.map((category) => {
        const replacementId = replacementIds[category.id] ?? "";
        return <div className="category-row" key={category.id}>
          <input aria-label={`Nombre de ${category.name}`} value={categoryEdits[category.id] ?? category.name} onChange={(event) => setCategoryEdits((current) => ({ ...current, [category.id]: event.target.value }))} />
          <button type="button" onClick={() => onRename(category)}>Renombrar</button>
          <select aria-label={`Reemplazar ${category.name} por`} value={replacementId} onChange={(event) => setReplacementIds((current) => ({ ...current, [category.id]: event.target.value }))}>
            <option value="">Reemplazar por…</option>
            {categories.filter((candidate) => candidate.id !== category.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
          </select>
          <button type="button" disabled={categories.length < 2 || !replacementId} onClick={() => onRemove(category)}>Eliminar</button>
        </div>;
      })}
    </div>
  </>;
}
