
import { useState } from "react";

export default function Sidebar({ section, onSectionChange }) {
  const submenus = {
    categorize: [
      ["movements", "Movimientos"],
      ["categories", "Categorías"],
    ],
    option: [
      ["import", "Importar datos"],
      ["genOptions", "Opciones Generales"],
    ],
  };

  const navItems = [
    ["dashboard", "Principal"],
    ["categorize", "Categorizar"],
    ["analysis", "Análisis"],
    ["option", "Opciones"],
  ];

  const [openMenus, setOpenMenus] = useState({
    categorize: ["categorize", "movements", "categories"].includes(section),
    option: ["option", "import", "genOptions"].includes(section),
  });

  const toggleMenu = (menu) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menu]: !prev[menu],
    }));
  };

  return (
    <aside className="sidebar">
      <p className="brand">Bankality</p>

      <nav className="side-nav" aria-label="Secciones">
        {navItems.map(([value, label]) => {
          const submenu = submenus[value];
          const hasSubmenu = Boolean(submenu);

          const isActive =
            section === value ||
            (hasSubmenu && submenu.some(([id]) => id === section));

          return (
            <div key={value} className="nav-group">
              <button
                className={isActive ? "active" : ""}
                onClick={() =>
                  hasSubmenu
                    ? toggleMenu(value)
                    : onSectionChange(value)
                }
                aria-expanded={
                  hasSubmenu ? openMenus[value] : undefined
                }
              >
                {label}

                {hasSubmenu && (
                  <span className="submenu-arrow">
                    {openMenus[value] ? "▾" : "▸"}
                  </span>
                )}
              </button>

              {hasSubmenu && openMenus[value] && (
                <div className="side-submenu">
                  {submenu.map(([id, text]) => (
                    <button
                      key={id}
                      className={section === id ? "active" : ""}
                      onClick={() => onSectionChange(id)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
