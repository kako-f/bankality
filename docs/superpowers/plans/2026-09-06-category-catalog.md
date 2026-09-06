# Category Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the local user manage a persistent category catalog and classify movements from a dedicated Categorizar child page.

**Architecture:** Add a SQLite-backed `Category` catalog while retaining `Movement.category` as text. Django category endpoints create, rename, and delete/reassign catalog values atomically; imports create missing parser-produced categories. React loads the catalog for filters and the Categorizar subpages, keeping Dashboard read-only.

**Tech Stack:** Django 6.1, SQLite, React 19, Vite, native `fetch`, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-06-category-catalog-design.md`

## Global Constraints

- Local-only application; do not add network services or dependencies.
- Keep bank statements, SQLite data, and real movement data ignored by Git.
- Keep `Movement.category` as a `CharField`; do not change stored fingerprints during rename or reassignment.
- Keep CSRF enabled; use the existing `csrfHeaders()` client helper for unsafe requests.
- Categories have a unique trimmed name with 1–80 characters.

---

### Task 1: Add and seed the category catalog

**Files:**
- Modify: `server/movements/models.py`
- Create: `server/movements/migrations/0002_category.py`
- Create: `server/movements/migrations/0003_seed_categories.py`
- Modify: `server/movements/services.py`
- Test: `server/movements/tests/test_imports.py`

**Interfaces:**
- Produces: `Category(name: CharField(unique=True, max_length=80))`.
- Produces: `store_records(records)`, which ensures every `record['category']` has a `Category` row before storing movements.
- Consumes: parser records with a string `category` field.

- [ ] **Step 1: Write the failing import-catalog test**

Add to `test_imports.py`:

```python
def test_creates_catalog_category_from_import(self, _):
    response = self.client.post('/api/imports', {'files': [SimpleUploadedFile('movements.xls', b'fixture')]})

    self.assertEqual(response.status_code, 200)
    self.assertTrue(Category.objects.filter(name='Compras').exists())
```

Import `Category` from `movements.models`; keep the existing parser patch used by the test class.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd server
/home/cako/miniforge3/envs/devEnv/bin/python manage.py test movements.tests.test_imports.ImportTests.test_creates_catalog_category_from_import
```

Expected: FAIL because `Category` does not exist.

- [ ] **Step 3: Add the model and migrations**

Add this model before `Movement` in `models.py`:

```python
class Category(models.Model):
    name = models.CharField(max_length=80, unique=True)

    class Meta:
        ordering = ['name']
```

Generate `0002_category.py` with `python manage.py makemigrations movements`. Create `0003_seed_categories.py` as a data migration that gets historical `Movement` and `Category` models, then `get_or_create`s every distinct existing movement category plus:

```python
DEFAULT_CATEGORIES = (
    'Arriendo', 'Supermercado', 'Transporte', 'Cuentas', 'Comida',
    'Transferencia', 'T. Crédito', 'Salud', 'Ocio', 'Otros',
)
```

Use `migrations.RunPython(seed_categories, migrations.RunPython.noop)`.

- [ ] **Step 4: Make imports create missing catalog entries**

In `services.py`, import `Category` and use `transaction.atomic` around `store_records`. Before each existing `Movement.objects.get_or_create`, add:

```python
Category.objects.get_or_create(name=record['category'])
```

Do not alter `fingerprint()` or any existing fingerprint values.

- [ ] **Step 5: Run focused tests and migrations**

Run:

```bash
cd server
/home/cako/miniforge3/envs/devEnv/bin/python manage.py migrate
/home/cako/miniforge3/envs/devEnv/bin/python manage.py test movements.tests.test_imports
```

Expected: all import tests pass, including the new catalog assertion.

- [ ] **Step 6: Commit Task 1**

```bash
git add server/movements/models.py server/movements/services.py server/movements/migrations/0002_category.py server/movements/migrations/0003_seed_categories.py server/movements/tests/test_imports.py
git commit -m "feat: add local category catalog"
```

### Task 2: Add category CRUD and movement validation APIs

**Files:**
- Modify: `server/movements/views.py`
- Modify: `server/movements/urls.py`
- Modify: `server/movements/tests/test_api.py`

**Interfaces:**
- Produces: `GET/POST /api/categories`, `PATCH/DELETE /api/categories/<int:category_id>`.
- Produces: `PATCH /api/movements/<int:movement_id>/category`, validated against `Category.name`.
- Consumes: JSON `{"name": "Arriendo"}` for create/rename and `{"replacement_id": 3}` for delete.

- [ ] **Step 1: Write failing API tests**

Add four tests to `MovementApiTests`:

```python
def test_creates_a_category(self):
    response = self.client.post('/api/categories', '{"name": "Mascotas"}', content_type='application/json')
    self.assertEqual(response.status_code, 201)
    self.assertTrue(Category.objects.filter(name='Mascotas').exists())

def test_rejects_a_duplicate_category(self):
    Category.objects.create(name='Comida')
    response = self.client.post('/api/categories', '{"name": " Comida "}', content_type='application/json')
    self.assertEqual(response.status_code, 400)

def test_renames_category_and_its_movements(self):
    category = Category.objects.create(name='Comida')
    Movement.objects.create(date='2026-09-02', description='Cena', amount=-2000, balance=10, category='Comida', fingerprint='food')
    response = self.client.patch(f'/api/categories/{category.id}', '{"name": "Restaurantes"}', content_type='application/json')
    self.assertEqual(response.status_code, 200)
    self.assertTrue(Movement.objects.filter(category='Restaurantes').exists())

def test_deletes_category_after_reassigning_movements(self):
    source = Category.objects.create(name='Comida')
    replacement = Category.objects.create(name='Otros')
    Movement.objects.create(date='2026-09-02', description='Cena', amount=-2000, balance=10, category='Comida', fingerprint='reassign')
    response = self.client.delete(f'/api/categories/{source.id}', '{"replacement_id": %s}' % replacement.id, content_type='application/json')
    self.assertEqual(response.status_code, 200)
    self.assertFalse(Category.objects.filter(id=source.id).exists())
    self.assertTrue(Movement.objects.filter(category='Otros').exists())
```

Also update the current movement-category test to create `Category(name='Arriendo')` before its PATCH call.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
cd server
/home/cako/miniforge3/envs/devEnv/bin/python manage.py test movements.tests.test_api
```

Expected: FAIL with missing category routes or the old static category validation.

- [ ] **Step 3: Implement small JSON and name validation helpers**

In `views.py`, replace the static `CATEGORIES` set with `Category`. Add a JSON parser that returns a 400 response for malformed payloads. Normalize names with:

```python
name = str(payload.get('name', '')).strip()
if not name or len(name) > 80:
    return JsonResponse({'error': 'Nombre de categoría no reconocido'}, status=400)
```

Catch `IntegrityError` when saving a duplicate and return the same 400 response.

- [ ] **Step 4: Implement the catalog endpoints atomically**

Add a collection view that returns `list(Category.objects.values('id', 'name'))` on GET and creates on POST. Add a detail view that:

```python
with transaction.atomic():
    old_name = category.name
    category.name = name
    category.save()
    Movement.objects.filter(category=old_name).update(category=name)
```

for PATCH, and for DELETE loads a different `replacement_id`, updates `Movement.objects.filter(category=category.name)` to `replacement.name`, then deletes `category`. Return `{id, name}` for create/rename and `{deleted: id}` for delete.

Change `update_category` to accept only a name for which `Category.objects.filter(name=category).exists()`.

Register:

```python
path('categories', categories),
path('categories/<int:category_id>', category_detail),
```

- [ ] **Step 5: Run backend verification**

Run:

```bash
cd server
/home/cako/miniforge3/envs/devEnv/bin/python manage.py test
/home/cako/miniforge3/envs/devEnv/bin/python manage.py check
```

Expected: all existing and new backend tests pass with no check issues.

- [ ] **Step 6: Commit Task 2**

```bash
git add server/movements/views.py server/movements/urls.py server/movements/tests/test_api.py
git commit -m "feat: manage and reassign categories"
```

### Task 3: Extend the React API client

**Files:**
- Modify: `dashboard/src/api.js`
- Modify: `dashboard/src/api.test.js`

**Interfaces:**
- Produces: `loadCategories()`, `createCategory(name)`, `renameCategory(id, name)`, `deleteCategory(id, replacementId)`.
- Consumes: existing `request()` and `csrfHeaders()` helpers.

- [ ] **Step 1: Write failing request-contract tests**

Add tests asserting the following boundary contracts through mocked `fetch`:

```javascript
await api.createCategory('Mascotas')
// POST /api/categories, JSON body {"name":"Mascotas"}, Content-Type and X-CSRFToken headers

await api.renameCategory(4, 'Restaurantes')
// PATCH /api/categories/4, JSON body {"name":"Restaurantes"}

await api.deleteCategory(4, 2)
// DELETE /api/categories/4, JSON body {"replacement_id":2}
```

Assert a literal URL, HTTP method, and JSON body for every request.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd dashboard
npm test
```

Expected: FAIL because the three exported client functions do not exist.

- [ ] **Step 3: Add the minimal client functions**

Implement:

```javascript
export const loadCategories = () => request('/api/categories')
export const createCategory = (name) => request('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json', ...csrfHeaders() }, body: JSON.stringify({ name }) })
export const renameCategory = (id, name) => request(`/api/categories/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...csrfHeaders() }, body: JSON.stringify({ name }) })
export const deleteCategory = (id, replacementId) => request(`/api/categories/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...csrfHeaders() }, body: JSON.stringify({ replacement_id: replacementId }) })
```

- [ ] **Step 4: Run client tests and lint**

Run:

```bash
cd dashboard
npm test
npm run lint
```

Expected: tests pass and oxlint prints no diagnostics.

- [ ] **Step 5: Commit Task 3**

```bash
git add dashboard/src/api.js dashboard/src/api.test.js
git commit -m "feat: add category catalog client"
```

### Task 4: Add Categorizar child pages and category management UI

**Files:**
- Modify: `dashboard/src/App.jsx`
- Modify: `dashboard/src/App.css`
- Modify: `dashboard/src/filters.js`

**Interfaces:**
- Consumes: category client functions from Task 3 and movement API functions already in `api.js`.
- Produces: `Categorizar → Movimientos` and `Categorizar → Categorías` subpages.
- Produces: filters that accept the loaded catalog names and reset pagination to page 1.

- [ ] **Step 1: Add component-state behavior checks manually before UI changes**

Run the current local application and confirm Dashboard has read-only category cells and Categorizar has the editable table. This establishes the pre-change behavior; do not add a component-test framework for this small local UI.

- [ ] **Step 2: Load and refresh the dynamic catalog**

In `App.jsx`, replace the static `categories` array with `const [categories, setCategories] = useState([])`. Load `loadCategories()` with initial movements. Add `refreshCategories()` and call it after an import, creation, rename, or deletion. Pass `categories.map((category) => category.name)` to movement filters and editable selectors.

- [ ] **Step 3: Add the Categorizar subnavigation**

Add `const [categorizePage, setCategorizePage] = useState('movements')`. When the sidebar section is `categorize`, render a secondary navigation with buttons `Movimientos` and `Categorías`.

Keep the existing filtered, paginated editable table under `Movimientos`. Keep Dashboard’s current table category cell as plain text. Reset each table page to 1 when its category filter changes.

- [ ] **Step 4: Add the Categorías child page**

Render a controlled create input and button that calls `createCategory(name)`. Render catalog rows with an editable name input, a Rename button calling `renameCategory(id, name)`, a replacement `<select>` excluding the current category, and a Delete button calling `deleteCategory(id, replacementId)`.

Disable Delete when `categories.length < 2` or no replacement is selected. On each failure, place the returned API error in the existing `message` state. On success, refresh the catalog and movements.

- [ ] **Step 5: Add only the CSS needed for the subnavigation and catalog controls**

Add scoped rules for `.subnav`, `.category-form`, and `.category-row` that use the existing dark palette and collapse to one column under the current 700px media query. Reuse the current generic `select`, button, panel, and notice styles.

- [ ] **Step 6: Verify the UI manually and build it**

With Django and Vite running locally:

1. Open `Categorizar → Categorías`.
2. Create `Mascotas`, rename it to `Veterinaria`, and verify it appears in both filters.
3. Assign one movement to `Veterinaria` in `Categorizar → Movimientos`.
4. Delete `Veterinaria`, choose `Otros` as replacement, and verify that movement now reads `Otros` in Dashboard.
5. Import a statement containing an unseen parser category and verify it appears in the catalog.

Then run:

```bash
cd dashboard
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit Task 4**

```bash
git add dashboard/src/App.jsx dashboard/src/App.css dashboard/src/filters.js
git commit -m "feat: add category management page"
```

### Task 5: Final verification and handoff

**Files:**
- Verify: `server/movements/tests/`, `dashboard/src/`, `README.md`

- [ ] **Step 1: Run the complete verification suite**

Run:

```bash
cd server
/home/cako/miniforge3/envs/devEnv/bin/python manage.py test
/home/cako/miniforge3/envs/devEnv/bin/python manage.py check
cd ../dashboard
npm test
npm run lint
npm run build
git diff --check
```

Expected: all tests and checks pass; `git diff --check` has no output.

- [ ] **Step 2: Review staged changes for sensitive data**

Run:

```bash
git status --short
git diff --cached --stat
```

Confirm no PDF, XLS, SQLite database, or real movement data is staged.

- [ ] **Step 3: Commit only intentional code and migrations**

```bash
git add server dashboard
git commit -m "feat: complete local category management"
```

Do not stage user-owned unrelated edits without explicit confirmation.
