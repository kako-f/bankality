async function request(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) throw new Error(await response.text() || 'Error de servidor')
  return response.json()
}

export const loadMovements = () => request('/api/movements')

export function importFiles(files) {
  const body = new FormData()
  for (const file of files) body.append('files', file)
  return request('/api/imports', { method: 'POST', body })
}
