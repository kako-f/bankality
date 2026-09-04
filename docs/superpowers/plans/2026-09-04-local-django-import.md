# Local Django Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar un dashboard React con importación local de cartolas BCI por un servidor Django y SQLite.

**Architecture:** Django expone movimientos e importaciones, normaliza XLS/PDF y guarda sólo registros en SQLite. React alterna entre Dashboard e Importar y consume la API local mediante el proxy de Vite.

**Tech Stack:** Python, Django, SQLite, xlrd, pdftotext, React, Vite, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-04-local-django-import-design.md`

## Global Constraints

- Nunca versionar cartolas reales, descripciones reales, `db.sqlite3` ni `server/private/initial_movements.json`.
- El servicio se enlaza exclusivamente a `127.0.0.1` durante desarrollo.
- No añadir autenticación, servicios remotos, router React ni librerías de gráficos.
- Los fixtures de pruebas deben contener sólo datos sintéticos.

---

### Task 1: Crear el esqueleto seguro del repositorio

**Files:**
- Create: `.gitignore`, `README.md`, `requirements.txt`
- Create: `dashboard/` (Vite + React)
- Create: `server/` (Django project)
- Create: `server/private.example/README.md`

**Interfaces:**
- Produces: `npm run dev`, `npm test`, `npm run build`, `python manage.py test`.

- [ ] **Step 1: Crear reglas de privacidad antes de añadir código**

Añadir a `.gitignore`:

```gitignore
dashboard/node_modules/
dashboard/dist/
dashboard/src/data/movements.js
server/db.sqlite3
server/private/
*.pdf
*.xls
```

- [ ] **Step 2: Inicializar las dos aplicaciones**

Run:

```bash
npm create vite@latest dashboard -- --template react
cd dashboard && npm install
python -m django startproject config server
cd server && python manage.py startapp movements
```

- [ ] **Step 3: Declarar dependencias Python**

Crear `requirements.txt` con:

```text
Django
xlrd
```

- [ ] **Step 4: Confirmar los esqueletos**

Run:

```bash
cd dashboard && npm run build
cd ../server && python manage.py check
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore README.md requirements.txt dashboard server
git commit -m "chore: initialize local dashboard and server"
```

### Task 2: Persistir y listar movimientos en Django

**Files:**
- Modify: `server/config/settings.py`, `server/config/urls.py`
- Create: `server/movements/models.py`, `server/movements/views.py`, `server/movements/urls.py`
- Create: `server/movements/tests/test_api.py`

**Interfaces:**
- Produces: `Movement(date, description, amount, balance, category, fingerprint)`.
- Produces: `GET /api/movements` con JSON ordenado ascendente por fecha.

- [ ] **Step 1: Escribir la prueba RED de listado**

```python
def test_lists_movements_in_date_order(self):
    Movement.objects.create(date='2026-09-02', description='Compra', amount=-2200,
                            balance=3308103, category='Compras', fingerprint='second')
    Movement.objects.create(date='2026-09-01', description='Abono', amount=1000,
                            balance=3310303, category='Otros abonos', fingerprint='first')
    response = self.client.get('/api/movements')
    self.assertEqual([item['date'] for item in response.json()], ['2026-09-01', '2026-09-02'])
```

- [ ] **Step 2: Confirmar RED**

Run: `cd server && python manage.py test movements.tests.test_api`

Expected: FAIL porque no existe el modelo ni la ruta.

- [ ] **Step 3: Implementar modelo, migración y endpoint mínimo**

Registrar `movements` en `INSTALLED_APPS`; crear el modelo con
`fingerprint = models.CharField(max_length=64, unique=True)`. La vista debe
usar `Movement.objects.order_by('date', 'id').values(...)` y `JsonResponse(...,
safe=False)`. Crear y aplicar migración.

- [ ] **Step 4: Confirmar GREEN**

Run: `cd server && python manage.py test movements.tests.test_api`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server
git commit -m "feat: add local movements API"
```

### Task 3: Normalizar XLS y PDF con fixtures sanitizados

**Files:**
- Create: `server/movements/parsers.py`
- Create: `server/movements/tests/fixtures/sample.xls`, `server/movements/tests/fixtures/sample.pdf`
- Create: `server/movements/tests/test_parsers.py`

**Interfaces:**
- Produces: `parse_xls(upload)` y `parse_pdf(upload)`, ambos retornan
  diccionarios con `date`, `description`, `amount`, `balance`, `category`.
- Raises: `ValueError` cuando no se reconoce un estado de cuenta BCI válido.

- [ ] **Step 1: Escribir pruebas RED con datos sintéticos**

Probar que el XLS devuelve un abono y un cargo; probar que el PDF mínimo
devuelve un cargo y que texto sin columnas bancarias lanza `ValueError`.

- [ ] **Step 2: Confirmar RED**

Run: `cd server && python manage.py test movements.tests.test_parsers`

Expected: FAIL porque `parsers.py` no existe.

- [ ] **Step 3: Implementar los parsers**

`parse_xls` debe detectar los encabezados `Fecha`, `Descripción`, `Monto $` y
`Saldo Contable $` y convertir pesos a enteros. `parse_pdf` debe usar
`NamedTemporaryFile`, ejecutar `pdftotext -layout`, detectar las filas de
cartola y calcular el signo según saldo consecutivo. Ambas funciones usan una
función compartida para categoría y devuelven sólo registros normalizados.

- [ ] **Step 4: Confirmar GREEN**

Run: `cd server && python manage.py test movements.tests.test_parsers`

Expected: PASS; ningún fixture contiene datos reales.

- [ ] **Step 5: Commit**

```bash
git add server/movements
git commit -m "feat: parse local BCI statements"
```

### Task 4: Importar, deduplicar y sembrar datos locales

**Files:**
- Modify: `server/movements/views.py`, `server/movements/urls.py`
- Create: `server/movements/management/commands/seed_movements.py`
- Create: `server/movements/tests/test_imports.py`

**Interfaces:**
- Produces: `POST /api/imports` con `{ files: [{ name, imported, skipped, error }] }`.
- Produces: `python manage.py seed_movements`, que consume sólo
  `server/private/initial_movements.json`.

- [ ] **Step 1: Escribir pruebas RED de importación**

Probar una carga válida, una segunda carga idéntica que devuelve `skipped: 1`,
y una solicitud con XLS válido más PDF inválido que devuelve resultados para
ambos archivos sin revertir el XLS.

- [ ] **Step 2: Confirmar RED**

Run: `cd server && python manage.py test movements.tests.test_imports`

Expected: FAIL porque `POST /api/imports` no existe.

- [ ] **Step 3: Implementar endpoint y comando**

Para cada archivo, seleccionar parser por extensión, calcular SHA-256 de los
cinco campos normalizados y usar `get_or_create` por huella. Capturar
`ValueError` por archivo y devolverlo en su resultado. El comando valida la
existencia de la semilla privada, informa un error claro si no está y reutiliza
el mismo servicio de persistencia.

- [ ] **Step 4: Confirmar GREEN**

Run: `cd server && python manage.py test movements.tests.test_imports`

Expected: PASS; importar el mismo archivo no crea registros duplicados.

- [ ] **Step 5: Commit**

```bash
git add server
git commit -m "feat: import and deduplicate local statements"
```

### Task 5: Consumir la API y crear la sección Importar

**Files:**
- Modify: `dashboard/vite.config.js`, `dashboard/src/App.jsx`, `dashboard/src/App.css`, `dashboard/src/index.css`, `dashboard/package.json`
- Create: `dashboard/src/api.js`, `dashboard/src/api.test.js`

**Interfaces:**
- Consumes: `GET /api/movements`, `POST /api/imports`.
- Produces: navegación horizontal `Dashboard | Importar` y formulario de carga.

- [ ] **Step 1: Escribir la prueba RED de cliente API**

```js
test('turns a failed import response into an error', async () => {
  globalThis.fetch = async () => new Response('Formato no reconocido', { status: 400 })
  await assert.rejects(importFiles([new File(['x'], 'bad.pdf')]), /Formato no reconocido/)
})
```

- [ ] **Step 2: Confirmar RED**

Run: `cd dashboard && node --test src/api.test.js`

Expected: FAIL porque `api.js` no existe.

- [ ] **Step 3: Implementar el cliente y las dos secciones**

`api.js` usa `fetch('/api/movements')` y `FormData` para `files[]`; rechaza
respuestas no exitosas con el cuerpo de error. Configurar proxy `/api` a
`http://127.0.0.1:8000`. En `App.jsx`, cargar desde API, presentar estados de
carga/error y conservar filtros. Añadir un menú de dos botones alineado a la
izquierda y la vista Importar con input `multiple` que acepta `.pdf,.xls`.
Tras éxito, recargar movimientos y mostrar los resultados por archivo.

- [ ] **Step 4: Confirmar GREEN**

Run: `cd dashboard && npm test && npm run build`

Expected: PASS y build Vite exitoso.

- [ ] **Step 5: Commit**

```bash
git add dashboard
git commit -m "feat: add dashboard import section"
```

### Task 6: Sembrar, verificar y publicar sin datos privados

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Documentar operación local**

Incluir instalación Python/NPM, requerimiento de `pdftotext`, arranque de
Django y Vite, uso de Importar y creación manual de la semilla privada.

- [ ] **Step 2: Ejecutar comprobaciones completas**

Run:

```bash
cd server && python manage.py test && python manage.py check
cd ../dashboard && npm test && npm run build && npm run lint
git status --short
```

Expected: pruebas y builds verdes; `git status --short` no muestra PDF/XLS,
SQLite ni datos de semilla.

- [ ] **Step 3: Commit y push**

```bash
git add README.md docs server dashboard .gitignore requirements.txt
git commit -m "feat: add local bank statement importer"
git push -u origin main
```
