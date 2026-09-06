async function request(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) throw new Error(await response.text() || 'Error de servidor')
  return response.json()
}

function csrfHeaders() {
  const token = typeof document === 'undefined' ? '' : document.cookie.split('; ').find((cookie) => cookie.startsWith('csrftoken='))?.split('=')[1]
  return token ? { 'X-CSRFToken': token } : {}
}

export const loadMovements = () => request('/api/movements')

export const loadCategories = () => request('/api/categories')

export const createCategory = (name) => request('/api/categories', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...csrfHeaders() }, body: JSON.stringify({ name }),
})

export const renameCategory = (id, name) => request(`/api/categories/${id}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', ...csrfHeaders() }, body: JSON.stringify({ name }),
})

export const deleteCategory = (id, replacementId) => request(`/api/categories/${id}`, {
  method: 'DELETE', headers: { 'Content-Type': 'application/json', ...csrfHeaders() }, body: JSON.stringify({ replacement_id: replacementId }),
})

export const updateCategory = (id, category) => request(`/api/movements/${id}/category`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', ...csrfHeaders() }, body: JSON.stringify({ category }),
})

export function importFiles(files) {
  const body = new FormData()
  for (const file of files) body.append('files', file)
  return request('/api/imports', { method: 'POST', headers: csrfHeaders(), body })
}
