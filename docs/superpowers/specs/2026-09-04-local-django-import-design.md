# Importación local de movimientos — Diseño

## Objetivo

Integrar el dashboard React con un servidor Django local que procese cartolas
BCI en PDF/XLS y persista movimientos en SQLite.

## Alcance

- Todo funciona en `127.0.0.1`; no hay usuarios, autenticación ni servicios
  externos.
- React ofrece un menú horizontal alineado a la izquierda: `Dashboard` e
  `Importar`.
- `Importar` acepta múltiples archivos `.pdf` y `.xls`, informa el resultado
  por archivo y actualiza el panel.
- Los PDF/XLS reales, SQLite y la semilla de los 367 movimientos existentes
  quedan sólo en el equipo local y fuera de Git.

## Arquitectura

`server/` contiene Django y SQLite. `dashboard/` contiene React/Vite. Durante
desarrollo, Vite redirige `/api` a Django mediante proxy local.

```
React ── /api ──> Django ──> SQLite
                    │
                    ├── xlrd (.xls)
                    └── pdftotext (.pdf)
```

## Datos y procesamiento

`Movement` guarda fecha, descripción, monto, saldo, categoría y una huella
SHA-256 de los valores normalizados. La huella es única y evita duplicados al
reimportar cartolas.

XLS se lee con `xlrd`. Para PDF, Django escribe el upload en un archivo
temporal, ejecuta `pdftotext -layout`, lo normaliza y elimina el temporal al
finalizar. Un error de formato en un archivo no impide procesar los demás.
No se guarda el archivo fuente ni un historial de cargas.

La semilla inicial local será `server/private/initial_movements.json`, un
archivo ignorado. El comando `seed_movements` la carga en SQLite; el
repositorio ofrece un ejemplo vacío y no incluye movimientos reales.

## API

- `GET /api/movements`: movimientos ordenados por fecha.
- `POST /api/imports`: recibe `files[]`; responde importados, omitidos por
  duplicado y errores por archivo.
- No se expone una ruta HTTP para sembrar datos.

## Interfaz y pruebas

La pantalla `Dashboard` carga movimientos desde la API. `Importar` usa un
formulario multipart y presenta estados de carga, éxito y error. Tras una
carga exitosa refresca los datos mostrados.

Las pruebas usan fixtures sanitizados para XLS/PDF, validan la API, duplicados
y cargas parciales. React conserva pruebas para su lógica pura y compila con
Vite. Desarrollo requiere `python manage.py runserver 127.0.0.1:8000` y
`npm run dev`.
