import assert from 'node:assert/strict'
import test from 'node:test'
import * as api from './api.js'
import { expensesByCategory, expensesByMonth } from './chartData.js'
import { filterMovementRows, filterMovements } from './filters.js'

test('turns a failed import response into an error', async () => {
  const originalFetch = globalThis.fetch
  const originalDocument = globalThis.document
  globalThis.document = { cookie: 'csrftoken=local-token' }
  globalThis.fetch = async (_, options) => {
    assert.equal(options.headers['X-CSRFToken'], 'local-token')
    return new Response('Formato no reconocido', { status: 400 })
  }

  await assert.rejects(api.importFiles([]), /Formato no reconocido/)
  globalThis.fetch = originalFetch
  globalThis.document = originalDocument
})

test('sends a category choice to its movement', async () => {
  assert.equal(typeof api.updateCategory, 'function')
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/movements/7/category')
    assert.equal(options.method, 'PATCH')
    assert.deepEqual(options.headers, { 'Content-Type': 'application/json' })
    assert.equal(options.body, '{"category":"Arriendo"}')
    return new Response('{"id":7,"category":"Arriendo"}', { headers: { 'Content-Type': 'application/json' } })
  }

  assert.deepEqual(await api.updateCategory(7, 'Arriendo'), { id: 7, category: 'Arriendo' })
  globalThis.fetch = originalFetch
})

test('sends the csrf cookie when updating a category', async () => {
  const originalFetch = globalThis.fetch
  const originalDocument = globalThis.document
  globalThis.document = { cookie: 'csrftoken=local-token' }
  globalThis.fetch = async (_, options) => {
    assert.equal(options.headers['X-CSRFToken'], 'local-token')
    return new Response('{"id":7,"category":"Arriendo"}', { headers: { 'Content-Type': 'application/json' } })
  }

  await api.updateCategory(7, 'Arriendo')
  globalThis.fetch = originalFetch
  globalThis.document = originalDocument
})

test('loads the category catalog', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    assert.equal(url, '/api/categories')
    return new Response('[{"id":1,"name":"Mascotas"}]', { headers: { 'Content-Type': 'application/json' } })
  }

  assert.deepEqual(await api.loadCategories(), [{ id: 1, name: 'Mascotas' }])
  globalThis.fetch = originalFetch
})

test('creates a category with its name and csrf header', async () => {
  const originalFetch = globalThis.fetch
  const originalDocument = globalThis.document
  globalThis.document = { cookie: 'csrftoken=local-token' }
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/categories')
    assert.equal(options.method, 'POST')
    assert.deepEqual(options.headers, { 'Content-Type': 'application/json', 'X-CSRFToken': 'local-token' })
    assert.equal(options.body, '{"name":"Mascotas"}')
    return new Response('{"id":1,"name":"Mascotas"}', { headers: { 'Content-Type': 'application/json' } })
  }

  assert.deepEqual(await api.createCategory('Mascotas'), { id: 1, name: 'Mascotas' })
  globalThis.fetch = originalFetch
  globalThis.document = originalDocument
})

test('renames a category with its id, name, and csrf header', async () => {
  const originalFetch = globalThis.fetch
  const originalDocument = globalThis.document
  globalThis.document = { cookie: 'csrftoken=local-token' }
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/categories/4')
    assert.equal(options.method, 'PATCH')
    assert.deepEqual(options.headers, { 'Content-Type': 'application/json', 'X-CSRFToken': 'local-token' })
    assert.equal(options.body, '{"name":"Restaurantes"}')
    return new Response('{"id":4,"name":"Restaurantes"}', { headers: { 'Content-Type': 'application/json' } })
  }

  assert.deepEqual(await api.renameCategory(4, 'Restaurantes'), { id: 4, name: 'Restaurantes' })
  globalThis.fetch = originalFetch
  globalThis.document = originalDocument
})

test('deletes a category with its replacement id and csrf header', async () => {
  const originalFetch = globalThis.fetch
  const originalDocument = globalThis.document
  globalThis.document = { cookie: 'csrftoken=local-token' }
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/categories/4')
    assert.equal(options.method, 'DELETE')
    assert.deepEqual(options.headers, { 'Content-Type': 'application/json', 'X-CSRFToken': 'local-token' })
    assert.equal(options.body, '{"replacement_id":2}')
    return new Response('{"deleted":true}', { headers: { 'Content-Type': 'application/json' } })
  }

  assert.deepEqual(await api.deleteCategory(4, 2), { deleted: true })
  globalThis.fetch = originalFetch
  globalThis.document = originalDocument
})

test('filters movements by the selected category', async () => {
  assert.equal(typeof filterMovements, 'function')
  const rent = { id: 1, category: 'Arriendo' }
  const food = { id: 2, category: 'Comida' }

  assert.deepEqual(filterMovements([rent, food], 'Arriendo'), [rent])
})

test('filters padded historical categories by their canonical catalog name', async () => {
  const rent = { id: 1, category: ' \tArriendo\u00a0 ' }

  assert.deepEqual(filterMovements([rent], 'Arriendo'), [rent])
})

test('filters movement rows by each table column', () => {
  const movements = [
    { date: '2026-09-02', description: 'Pago arriendo', category: 'Arriendo', amount: -400000, balance: 1000000 },
    { date: '2026-09-03', description: 'Compra supermercado', category: 'Comida', amount: -25000, balance: 975000 },
  ]

  assert.deepEqual(filterMovementRows(movements, { description: 'super', amountMin: -30000, balanceMax: 999000 }), [movements[1]])
})

test('filters rows beyond the first 25-row page', () => {
  const movements = Array.from({ length: 26 }, (_, index) => ({
    date: '2026-09-02',
    description: index === 25 ? 'Arriendo mensual' : `Compra ${index}`,
    category: index === 25 ? 'Arriendo' : 'Compras',
    amount: -1000,
    balance: 100000,
  }))

  assert.deepEqual(filterMovementRows(movements, { description: 'arriendo' }), [movements[25]])
})

test('aggregates expenses by category and ignores credits', () => {
  assert.deepEqual(expensesByCategory([
    { amount: -400000, category: 'Arriendo' },
    { amount: -2000, category: 'Comida' },
    { amount: -3000, category: 'Comida' },
    { amount: 100000, category: 'Sueldo' },
  ]), [
    { label: 'Arriendo', total: 400000 },
    { label: 'Comida', total: 5000 },
  ])
})

test('aggregates expenses by month in chronological order', () => {
  assert.deepEqual(expensesByMonth([
    { date: '2026-10-03', amount: -2000 },
    { date: '2026-09-30', amount: -3000 },
    { date: '2026-10-01', amount: 1000 },
  ]).map(({ total }) => total), [3000, 2000])
})
