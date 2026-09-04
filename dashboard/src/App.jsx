import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { importFiles, loadMovements } from './api.js'

const pesos = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

function App() {
  const [section, setSection] = useState('dashboard')
  const [movements, setMovements] = useState([])
  const [files, setFiles] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try { setMovements(await loadMovements()); setMessage('') } catch (error) { setMessage(error.message) } finally { setLoading(false) }
  }

  useEffect(() => {
    loadMovements().then(setMovements).catch((error) => setMessage(error.message)).finally(() => setLoading(false))
  }, [])
  const totals = useMemo(() => movements.reduce((result, item) => ({
    credits: result.credits + Math.max(item.amount, 0), debits: result.debits - Math.min(item.amount, 0),
  }), { credits: 0, debits: 0 }), [movements])

  async function submit(event) {
    event.preventDefault()
    if (!files.length) return
    setLoading(true)
    try {
      const result = await importFiles(files)
      setMessage(result.files.map((file) => file.error || `${file.name}: ${file.imported} importados, ${file.skipped} omitidos`).join(' · '))
      setFiles([])
      await refresh()
    } catch (error) { setMessage(error.message); setLoading(false) }
  }

  return <main>
    <header><p>Bankality · local</p><h1>Movimientos bancarios</h1></header>
    <nav aria-label="Secciones"><button className={section === 'dashboard' ? 'active' : ''} onClick={() => setSection('dashboard')}>Dashboard</button><button className={section === 'import' ? 'active' : ''} onClick={() => setSection('import')}>Importar</button></nav>
    {message && <p className="notice">{message}</p>}
    {section === 'dashboard' ? <section>
      <div className="cards"><article><span>Saldo final</span><strong>{pesos.format(movements.at(-1)?.balance || 0)}</strong></article><article><span>Abonos</span><strong>{pesos.format(totals.credits)}</strong></article><article><span>Cargos</span><strong>{pesos.format(totals.debits)}</strong></article></div>
      <h2>Movimientos</h2>{loading ? <p>Cargando…</p> : <div className="table"><table><thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Monto</th><th>Saldo</th></tr></thead><tbody>{[...movements].reverse().map((item, index) => <tr key={`${item.date}-${item.balance}-${index}`}><td>{item.date}</td><td>{item.description}</td><td>{item.category}</td><td className={item.amount > 0 ? 'credit' : 'debit'}>{pesos.format(item.amount)}</td><td>{pesos.format(item.balance)}</td></tr>)}</tbody></table></div>}
    </section> : <section className="import"><h2>Importar cartolas</h2><p>Selecciona archivos BCI en formato PDF o XLS. Se procesan sólo en este equipo.</p><form onSubmit={submit}><input type="file" accept=".pdf,.xls" multiple onChange={(event) => setFiles([...event.target.files])} /><button disabled={!files.length || loading}>Importar {files.length ? `(${files.length})` : ''}</button></form></section>}
  </main>
}

export default App
