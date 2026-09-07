export const pesos = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export const PAGE_SIZE = 25;

export const EMPTY_TABLE_FILTERS = {
  dateFrom: "",
  dateTo: "",
  description: "",
  category: "",
  amountMin: "",
  amountMax: "",
  balanceMin: "",
  balanceMax: "",
};
