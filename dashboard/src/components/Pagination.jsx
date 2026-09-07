export default function Pagination({ page, pages, setPage }) {
  return (
    <div className="pagination" aria-label="Paginación de movimientos">
      <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
        Anterior
      </button>
      <span>Página {page} de {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>
        Siguiente
      </button>
    </div>
  );
}
