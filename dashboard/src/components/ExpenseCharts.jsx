import { useMemo } from "react";
import { BarChart } from "@mui/x-charts/BarChart";
import { movementsByCategory, movementsByMonth } from "../chartData.js";
import { pesos } from "../formatters.js";

const CATEGORY_CHART_MARGIN = Object.freeze({ left: 75, right: 25, top: 25, bottom: 50 });
const MONTH_CHART_MARGIN = Object.freeze({ left: 85, right: 25, top: 25, bottom: 65 });

export default function ExpenseCharts({ movements, categories = [] }) {
  const categoryTotals = useMemo(() => {
    const totals = movementsByCategory(movements);
    const seen = new Set(totals.map(({ label }) => label));
    return [...totals, ...categories.filter((category) => !seen.has(category)).map((label) => ({ label, total: 0 }))];
  }, [movements, categories]);
  const monthTotals = useMemo(() => movementsByMonth(movements), [movements]);
  const chartSx = useMemo(() => ({
    "& .MuiChartsAxis-tickLabel": { fill: "var(--muted)" },
    "& .MuiChartsAxis-label": { fill: "var(--muted)" },
    "& .MuiChartsLegend-label": { fill: "var(--muted)" },
    "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": { stroke: "var(--border)" },
  }), []);
  const categoryLabels = useMemo(() => categoryTotals.map(({ label }) => label), [categoryTotals]);
  const categoryValues = useMemo(() => categoryTotals.map(({ total }) => total), [categoryTotals]);
  const monthLabels = useMemo(() => monthTotals.map(({ label }) => label), [monthTotals]);
  const monthIncomeValues = useMemo(() => monthTotals.map(({ income }) => income), [monthTotals]);
  const monthExpenseValues = useMemo(() => monthTotals.map(({ expenses }) => expenses), [monthTotals]);
  const categoryXAxis = useMemo(() => [{
    scaleType: "band",
    data: categoryLabels,
    tickLabelInterval: () => true,
    tickLabelMinGap: 0,
    tickSpacing: 0,
    label: "Categoría",
    tickLabelStyle: { angle: -45, textAnchor: "end", fontSize: 12, fill: "#b8c7d3" },
    labelStyle: { fill: "#b8c7d3", fontSize: 12 },
  }], [categoryLabels]);
  const categoryYAxis = useMemo(() => [{ valueFormatter: (value) => pesos.format(value) }], []);
  const categorySeries = useMemo(() => [{ data: categoryValues, label: "Monto", color: "var(--accent)" }], [categoryValues]);
  const monthXAxis = useMemo(() => [{ scaleType: "band", data: monthLabels }], [monthLabels]);
  const monthYAxis = useMemo(() => [{ valueFormatter: (value) => pesos.format(value) }], []);
  const monthSeries = useMemo(() => [
    { data: monthIncomeValues, label: "Ingresos", color: "var(--accent)" },
    { data: monthExpenseValues, label: "Gastos", color: "var(--danger)" },
  ], [monthIncomeValues, monthExpenseValues]);

  return <div className="charts" aria-label="Gráficos de movimientos">
    <article className="chart-panel">
      <h2>Movimientos por categoría</h2>
      {categoryTotals.length ? <BarChart height={550} xAxis={categoryXAxis} yAxis={categoryYAxis} series={categorySeries} margin={CATEGORY_CHART_MARGIN} sx={chartSx} /> : <p className="chart-empty">No hay movimientos para mostrar.</p>}
      {categoryTotals.length > 0 && <div className="category-summary" aria-label="Detalle de movimientos por categoría">{categoryTotals.map(({ label, total }) => <div key={label}><span>{label}</span><strong>{pesos.format(total)}</strong></div>)}</div>}
    </article>
    <article className="chart-panel">
      <h2>Movimientos por mes</h2>
      {monthTotals.length ? <BarChart height={360} xAxis={monthXAxis} series={monthSeries} yAxis={monthYAxis} margin={MONTH_CHART_MARGIN} sx={chartSx} /> : <p className="chart-empty">No hay movimientos para mostrar.</p>}
    </article>
  </div>;
}
