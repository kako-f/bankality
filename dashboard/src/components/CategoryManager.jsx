import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";

export default function CategoryManager({
  categories,
  newCategoryName,
  setNewCategoryName,
  categoryEdits,
  setCategoryEdits,
  replacementIds,
  setReplacementIds,
  onAdd,
  onRename,
  onRemove,
}) {
  return (
    <>
      <div className="panel">
        {categories.map((category) => {
          const replacementId = replacementIds[category.id] ?? "";
          return (
            <div className="category-row" key={category.id}>
              <TextField
                id={`category-name-${category.id}`}
                label={`Nombre de ${category.name}`}
                size="small"
                value={categoryEdits[category.id] ?? category.name}
                onChange={(event) =>
                  setCategoryEdits((current) => ({
                    ...current,
                    [category.id]: event.target.value,
                  }))
                }
              />
              <Button type="button" variant="outlined" onClick={() => onRename(category)}>
                Renombrar
              </Button>
              <TextField
                select
                id={`category-replacement-${category.id}`}
                label={`Reemplazar ${category.name} por`}
                size="small"
                value={replacementId}
                onChange={(event) =>
                  setReplacementIds((current) => ({
                    ...current,
                    [category.id]: event.target.value,
                  }))
                }
              >
                <MenuItem value="">Reemplazar por…</MenuItem>
                {categories
                  .filter((candidate) => candidate.id !== category.id)
                  .map((candidate) => (
                    <MenuItem key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </MenuItem>
                  ))}
              </TextField>
              <Button type="button" color="error" variant="outlined" disabled={categories.length < 2 || !replacementId} onClick={() => onRemove(category)}>
                Eliminar
              </Button>
            </div>
          );
        })}
      </div>
      <Typography component="h2" variant="h6" sx={{ mt: 3 }}>
        Crear nueva categoría
      </Typography>
      <form className="category-form" onSubmit={onAdd}>
        <TextField
          id="new-category-name"
          label="Nueva categoría"
          size="small"
          value={newCategoryName}
          onChange={(event) => setNewCategoryName(event.target.value)}
        />
        <Button type="submit" variant="contained">Crear</Button>
      </form>
    </>
  );
}
