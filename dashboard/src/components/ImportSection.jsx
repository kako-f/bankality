import { pesos } from "../formatters.js";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

export default function ImportSection({ files, preview, previewLoading, loading, onSubmit, onSelectFiles }) {
  return (
    <section className="import">
      <p>
        Selecciona archivos en formato PDF o XLS.
        <br></br>
        <small>Se procesan sólo en este equipo</small>
      </p>
      <form onSubmit={onSubmit}>
        <Stack spacing={2} direction="row">
          <Button component="label" variant="contained" color="success">
            Seleccionar archivos
            <input hidden type="file" accept=".pdf,.xls,.xlsx" multiple onChange={onSelectFiles} />
          </Button>
          <Button type="submit" variant="contained" disabled={!files.length || loading || previewLoading}>
            Importar {files.length ? files.map((file) => file.name).join(", ") : ""}
          </Button>
        </Stack>
      </form>
      <hr></hr>
      {previewLoading && <p>Generando previsualización…</p>}
      {preview?.files.map((file) => (
        <div className="preview" key={file.name}>
          <h3>{file.name}</h3>
          {file.error ? (
            <p className="preview-error">{file.error}</p>
          ) : (
            <>
              <p>
                {file.total} movimiento{file.total === 1 ? "" : "s"} detectado{file.total === 1 ? "" : "s"}
                {file.total > file.rows.length ? ` · mostrando los primeros ${file.rows.length}` : ""}.
              </p>
              <div className="panel">
                <TableContainer>
                  <Table sx={{ minWidth: 650 }} aria-label="simple table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Descripción</TableCell>
                        <TableCell>Categoría</TableCell>
                        <TableCell>Monto</TableCell>
                        <TableCell>Saldo</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {file.rows.map((row, index) => (
                        <TableRow key={`${file.name}-${index}`}>
                          <TableCell>{row.date}</TableCell >
                          <TableCell>{row.description}</TableCell >
                          <TableCell>{row.category}</TableCell >
                          <TableCell>{pesos.format(row.amount)}</TableCell >
                          <TableCell>{pesos.format(row.balance)}</TableCell >
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

              </div>
            </>
          )}
        </div>
      ))}
    </section>
  );
}
