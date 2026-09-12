import { ResponsiveBar } from "@nivo/bar";
import { useMemo, useState } from "react";
import { categoryTotals } from "../filters.js";

export default function Analysis({movements }) {
  const [month, setMonth] = useState("");
  const [hiddenCategories, setHiddenCategories] = useState(new Set());

  const months = useMemo(
    () =>
      [...new Set(movements.map(({ date }) => date.slice(0, 7)))]
        .sort()
        .reverse(),
    [movements],
  );

  const data = useMemo(
    () => categoryTotals(movements, month, hiddenCategories),
    [movements, month, hiddenCategories],
  );
  const categories = useMemo(
    () => categoryTotals(movements, month).map(({ category }) => category),
    [movements, month],
  );

  const toggleCategory = (category) => {
    setHiddenCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };
  return (
    <>
      <h2>Gastos y abonos / Mes</h2>
      <label>
        Mes
        <select
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        >
          <option value="">Todos los meses</option>
          {months.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Categorías</legend>
        {categories.map((category) => (
          <label key={category}>
            <input
              type="checkbox"
              checked={!hiddenCategories.has(category)}
              onChange={() => toggleCategory(category)}
            />
            {category}
          </label>
        ))}
      </fieldset>
      <div className="panel" style={{ height: 400 }}>
        <ResponsiveBar
          data={data}
          keys={["expenses", "income"]}
          indexBy="category"
          groupMode="grouped"
          margin={{ top: 20, right: 20, bottom: 100, left: 70 }}
          padding={0.2}
          colors={{ scheme: "paired" }}
          axisBottom={{ tickRotation: -45 }}
          valueFormat={(value) => `$${Number(value).toLocaleString("es-CL")}`}
        />
      </div>
    </>
  );
}
