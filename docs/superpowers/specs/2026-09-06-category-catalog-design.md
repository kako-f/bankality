# Category catalog design

## Purpose

Let the local user define the categories available for classifying bank movements. Categories can be created, renamed, and deleted only after their movements are reassigned.

## Data model

Add a `Category` model with a unique, non-empty name of at most 80 characters. `Movement.category` remains a text field to avoid rewriting existing data and imports.

The initial migration creates the catalog. Existing category values and the current default manual categories are added to it. During imports, any parser-produced category missing from the catalog is created automatically.

Renaming and reassignment update matching `Movement.category` values in the same database transaction. Movement fingerprints are deliberately not changed: they retain their original import identity so reimporting a statement remains deduplicated.

## API

- `GET /api/categories` returns category IDs and names.
- `POST /api/categories` creates a category from JSON `{ "name": "..." }`.
- `PATCH /api/categories/<id>` renames it from JSON `{ "name": "..." }` and updates matching movements.
- `DELETE /api/categories/<id>` accepts JSON `{ "replacement_id": 3 }`, reassigns matching movements, then deletes the category.
- `PATCH /api/movements/<id>/category` accepts a catalog category name only.

Invalid JSON, blank or duplicate names, an unknown replacement, and using the same category as replacement return HTTP 400. An unknown resource returns HTTP 404. Existing CSRF protection remains in use.

## Interface

`Categorizar` has two local subpages: `Movimientos` and `Categorías`.

`Movimientos` keeps the editable paginated, category-filtered table. Dashboard keeps its read-only category text and category filter. `Categorías` shows a create form and a list of names. Each row supports rename and delete; deletion requires selecting a different replacement category and is disabled when no replacement exists.

After any catalog change, React refreshes the category catalog. After an import, it refreshes movements and categories so parser-created categories become immediately available.

## Verification

Backend tests cover creation, duplicate rejection, rename propagation, deletion/reassignment, and category validation for a movement update. Frontend API tests cover the catalog requests. Existing import, CSRF, filtering, lint, and build checks remain green.
