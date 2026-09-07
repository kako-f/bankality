import { pesos } from "../formatters.js";

export default function ImportSection({ files, preview, previewLoading, loading, onSubmit, onSelectFiles, onReset }) {
  return <section className="import">
    <h2>Importar cartolas</h2>
    <p>Selecciona archivos BCI en formato PDF o XLS. Se procesan sólo en este equipo.</p>
    <form onSubmit={onSubmit}>
      <input type="file" accept=".pdf,.xls,.xlsx" multiple onChange={onSelectFiles} />
      <button disabled={!files.length || loading || previewLoading}>Importar {files.length ? `(${files.length})` : ""}</button>
    </form>
    <button className="reset-button" type="button" disabled={loading || previewLoading} onClick={onReset}>Reiniciar datos</button>
    <p className="reset-warning">Borra todos los movimientos y categorías.</p>
    {previewLoading && <p>Generando previsualización…</p>}
    {preview?.files.map((file) => <div className="preview" key={file.name}>
      <h3>{file.name}</h3>
      {file.error ? <p className="preview-error">{file.error}</p> : <>
        <p>{file.total} movimiento{file.total === 1 ? "" : "s"} detectado{file.total === 1 ? "" : "s"}{file.total > file.rows.length ? ` · mostrando los primeros ${file.rows.length}` : ""}.</p>
        <div className="panel"><table><thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Monto</th><th>Saldo</th></tr></thead><tbody>
          {file.rows.map((row, index) => <tr key={`${file.name}-${index}`}><td>{row.date}</td><td>{row.description}</td><td>{row.category}</td><td>{pesos.format(row.amount)}</td><td>{pesos.format(row.balance)}</td></tr>)}
        </tbody></table></div>
      </>}
    </div>)}
  </section>;
}
