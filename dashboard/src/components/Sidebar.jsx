export default function Sidebar({ section, onSectionChange }) {
  return <aside className="sidebar">
    <p className="brand">Bankality<small>Panel local</small></p>
    <nav className="side-nav" aria-label="Secciones">
      {[["dashboard", "Dashboard"], ["categorize", "Categorizar"], ["analysis", "Análisis"], ["import", "Importar"]].map(([value, label]) => <button key={value} className={section === value ? "active" : ""} onClick={() => onSectionChange(value)}>{label}</button>)}
    </nav>
  </aside>;
}
