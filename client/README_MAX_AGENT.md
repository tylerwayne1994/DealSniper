# Max Spreadsheet Agent Integration

This agent exposes programmatic control of the Luckysheet grid so "Max" (your assistant) can edit, replace, and retrieve spreadsheet data.

## Command Schema

Each command is an object with a `type` and parameters:

- `set_value`: `{ type: 'set_value', a1: 'B3', value: 123, sheetName?: 'Sheet1' }`
- `set_formula`: `{ type: 'set_formula', a1: 'C5', formula: '=SUM(A1:A10)', sheetName?: 'Sheet1' }`
- `find_replace`: `{ type: 'find_replace', find: 'old', replace: 'new', sheetName?: 'Sheet1' }`
- `set_active_sheet`: `{ type: 'set_active_sheet', sheetName: 'Sheet1' }` or `{ type: 'set_active_sheet', index: 0 }`
- `get_value`: `{ type: 'get_value', a1: 'D7', sheetName?: 'Sheet1' }`

Responses:
- General: `{ ok: boolean, error?: string }`
- `get_value`: `{ ok: true, value: any }`
- `find_replace`: `{ ok: true, changes: number }`

## Usage

The agent is registered as `window.MaxSpreadsheetAgent` once Luckysheet initializes in the Property tab.

Examples:

```js
// Single command
window.MaxSpreadsheetAgent.applyCommand({
  type: 'set_value',
  a1: 'B3',
  value: 2500,
  sheetName: 'Inputs'
});

// Multiple commands
window.MaxSpreadsheetAgent.applyCommands([
  { type: 'set_active_sheet', sheetName: 'Inputs' },
  { type: 'set_value', a1: 'B4', value: 0.08 },
  { type: 'set_formula', a1: 'C10', formula: '=SUM(B3:B9)' }
]);

// Get a value
const res = window.MaxSpreadsheetAgent.applyCommand({ type: 'get_value', a1: 'C10' });
console.log(res.value);
```

## Notes
- A1 addresses are parsed client-side (e.g., `B3` → row 2, column 1).
- `set_formula` ensures formulas start with `=`.
- Operations target the active sheet unless `sheetName` is provided.
- Luckysheet recalculates automatically; the agent calls `refresh()` when available.

## Next Steps (Optional)
- Backend relay via WebSocket/HTTP so Max can send commands to active sessions server-side.
- Extended operations: insert/delete rows/columns, style changes, merges, range reads/writes.
