# Luckysheet Template Loading

The Property tab’s “Load Template” prefers your original Excel for a pixel-identical replica, then falls back to JSON if needed.

Preferred template names:
- XLSX: `client/public/templates/multifamily.xlsx`
- JSON (fallback 1): `client/public/templates/multifamily.json`
- JSON (fallback 2): `client/public/templates/underwriting-model.json`

Behavior:
- If `multifamily.xlsx` exists, it is fetched and converted via LuckyExcel into Luckysheet format client-side. This preserves merges, column/row sizes, borders, and cell styles.
- If the XLSX is missing or conversion yields no sheets, the loader tries `multifamily.json`.
- If neither is present, it falls back to `underwriting-model.json`.

Tips:
- For ad-hoc files, use the “Load XLSX” button which opens a file picker and converts the selected Excel into Luckysheet sheets.
- JSON templates should be an array of Luckysheet sheet objects (e.g., `[ { name, celldata, config } ]`). Include `config.merge`, `config.rowlen`, and `config.columnlen` where applicable to match layout.
