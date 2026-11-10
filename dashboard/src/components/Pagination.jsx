import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";

export default function Pagination({ page, pages, setPage }) {
  return (
    <div className="pagination" aria-label="Paginación">
      <Button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
        Anterior
      </Button>
      <span>
        Página {page} de {pages}
      </span>
      <Button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>
        Siguiente
      </Button>
    </div>
  );
}
