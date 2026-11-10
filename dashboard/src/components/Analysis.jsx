import { BarChart } from "@mui/x-charts/BarChart";
import { pesos } from "../formatters.js";

import { useMemo, useState } from "react";
import { categoryTotals } from "../filters.js";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";

export default function Analysis({ movements }) {
  const [month, setMonth] = useState("");
  const [hiddenCategories, setHiddenCategories] = useState(new Set());

  const months = useMemo(() => [...new Set(movements.map(({ date }) => date.slice(0, 7)))].sort().reverse(), [movements]);

  const data = useMemo(() => categoryTotals(movements, month, hiddenCategories), [movements, month, hiddenCategories]);
  const categories = useMemo(() => categoryTotals(movements, month).map(({ category }) => category), [movements, month]);

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
      <Typography variant="h4">Gastos y abonos</Typography>
      <br></br>
      <TextField
        select
        value={month}
        label="Mes"
        onChange={(event) => setMonth(event.target.value)}
        slotProps={{
          select: { displayEmpty: true },
          inputLabel: { shrink: true },
        }}
      >
        <MenuItem value="">Todos los meses</MenuItem>
        {months.map((value) => (
          <MenuItem key={value} value={value}>
            {value}
          </MenuItem>
        ))}
      </TextField>
      <br></br>
      <hr></hr>
      <FormControl component="fieldset">
        <FormLabel component="legend">Categorías</FormLabel>
        <FormGroup row>
          {categories.map((category) => (
            <FormControlLabel
              key={category}
              label={category}
              control={<Checkbox checked={!hiddenCategories.has(category)} onChange={() => toggleCategory(category)} />}
            />
          ))}
        </FormGroup>
      </FormControl>
      <div className="panel" style={{ height: 500 }}>
        <BarChart
          dataset={data}
          borderRadius={15}
          xAxis={[
            {
              scaleType: "band",
              dataKey: "category",
              height: 100,
              categoryGapRatio: 0.3,
              barGapRatio: 0.1,
              tickLabelStyle: {
                angle: -45,
                textAnchor: "end",
              },
            },
          ]}
          yAxis={[{ width: 100 }]}
          series={[
            {
              dataKey: "expenses",
              label: "Gastos",
              valueFormatter: (value) => (value == null ? "" : pesos.format(value)),
            },
            {
              dataKey: "income",
              label: "Abonos",
              valueFormatter: (value) => (value == null ? "" : pesos.format(value)),
            },
          ]}
          height={450}
        />
      </div>
    </>
  );
}
