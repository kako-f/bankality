# Final-fix report

Implemented the four final-review corrections:

- Match legacy padded category values canonically in list responses, category rename/delete, movement updates, and dashboard filtering, while retaining stored fingerprints unless a user explicitly recategorizes a movement.
- Lock the validated category and target movement in one transaction, so a concurrent rename/delete cannot be undone by a stale movement update.
- Return HTTP 400 for malformed UTF-8 JSON payloads.
- Accept category names only when their JSON value is a string.

Regression coverage includes padded legacy values, malformed encodings, non-string names, fingerprints, and concurrent rename/delete updates.

Verification on 2026-09-06:

- `server: python manage.py test -v 1` — 29 tests passed.
- `server: python manage.py check` — no issues.
- `dashboard: npm test`, `npm run lint`, and `npm run build` — passed.

Known ceiling: legacy matching scans distinct movement labels, documented in `movements_in_category`; add a normalized indexed category column only if catalog mutation volume makes that measurable.
