export const measurementId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const measurementDay = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString();
