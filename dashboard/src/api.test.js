import assert from 'node:assert/strict'
import test from 'node:test'
import { importFiles } from './api.js'

test('turns a failed import response into an error', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('Formato no reconocido', { status: 400 })

  await assert.rejects(importFiles([]), /Formato no reconocido/)
  globalThis.fetch = originalFetch
})
