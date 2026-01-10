const MaxSpreadsheetAgent = (() => {
  let ls = null;
  let keyMap = null; // { key: { a1, sheetName? } }

  const a1ToRC = (a1) => {
    if (typeof a1 !== 'string') return null;
    const m = a1.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
    if (!m) return null;
    const letters = m[1];
    const row = parseInt(m[2], 10) - 1;
    let col = 0;
    for (let i = 0; i < letters.length; i++) {
      col = col * 26 + (letters.charCodeAt(i) - 64);
    }
    col -= 1;
    return { r: row, c: col };
  };

  const getSheets = () => {
    try {
      if (ls && typeof ls.getAllSheets === 'function') return ls.getAllSheets();
      if (Array.isArray(window.luckysheetfile)) return window.luckysheetfile;
    } catch (_) {}
    return [];
  };

  const getSheetIndexByName = (name) => {
    const sheets = getSheets();
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i]?.name === name) return sheets[i].index ?? i;
    }
    return null;
  };

  const setActiveSheet = (target) => {
    try {
      if (!ls || typeof ls.setActiveSheet !== 'function') return false;
      if (typeof target === 'number') {
        ls.setActiveSheet(target);
        return true;
      }
      if (typeof target === 'string') {
        const idx = getSheetIndexByName(target);
        if (idx !== null) {
          ls.setActiveSheet(idx);
          return true;
        }
      }
    } catch (_) {}
    return false;
  };

  const setCell = (a1, value, sheetName) => {
    if (!ls) return { ok: false, error: 'Luckysheet not ready' };
    if (sheetName) setActiveSheet(sheetName);
    const rc = a1ToRC(a1);
    if (!rc) return { ok: false, error: 'Invalid A1 reference' };
    try {
      if (typeof ls.setCellValue === 'function') {
        ls.setCellValue(rc.r, rc.c, value);
      } else if (typeof ls.setRangeValue === 'function') {
        ls.setRangeValue([{ row: [rc.r, rc.r], column: [rc.c, rc.c], value: [[value]] }]);
      } else {
        return { ok: false, error: 'No setter API available' };
      }
      if (typeof ls.refresh === 'function') ls.refresh();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };

  const setFormula = (a1, formula, sheetName) => {
    const f = typeof formula === 'string' && formula.trim().startsWith('=') ? formula : `=${formula}`;
    return setCell(a1, f, sheetName);
  };

  const findReplace = (params) => {
    if (!ls) return { ok: false, error: 'Luckysheet not ready' };
    const { find, replace, sheetName } = params || {};
    if (!find) return { ok: false, error: 'Missing find string' };
    if (sheetName) setActiveSheet(sheetName);

    const sheets = getSheets();
    let activeIdx = null;
    try {
      if (typeof ls.getSheet === 'function') activeIdx = ls.getSheet()?.index;
    } catch (_) {}
    const targetIdx = activeIdx ?? 0;
    const target = sheets.find(s => (s.index ?? -1) === targetIdx) || sheets[targetIdx];
    if (!target) return { ok: false, error: 'Active sheet not found' };

    const celldata = Array.isArray(target.celldata) ? target.celldata : [];
    let changes = 0;
    for (let i = 0; i < celldata.length; i++) {
      const cell = celldata[i];
      const v = cell?.v?.m ?? cell?.v?.v ?? cell?.v;
      if (typeof v === 'string' && v.includes(find)) {
        const next = v.replaceAll(find, replace ?? '');
        const res = setCell(`${colToLetters(cell.c)}${cell.r + 1}`, next);
        if (res.ok) changes++;
      }
    }

    return { ok: true, changes };
  };

  const colToLetters = (colIdx) => {
    let n = colIdx + 1;
    let letters = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      letters = String.fromCharCode(65 + rem) + letters;
      n = Math.floor((n - 1) / 26);
    }
    return letters;
  };

  const parseRange = (rng) => {
    if (typeof rng !== 'string') return null;
    const m = rng.trim().toUpperCase().match(/^([A-Z]+\d+):([A-Z]+\d+)$/);
    if (!m) return null;
    const a = a1ToRC(m[1]);
    const b = a1ToRC(m[2]);
    if (!a || !b) return null;
    const startRow = Math.min(a.r, b.r);
    const endRow = Math.max(a.r, b.r);
    const startCol = Math.min(a.c, b.c);
    const endCol = Math.max(a.c, b.c);
    return { startRow, endRow, startCol, endCol };
  };

  const applyCommand = (cmd) => {
    if (!cmd || !cmd.type) return { ok: false, error: 'Invalid command' };
    switch (cmd.type) {
      case 'set_key_value': {
        if (!keyMap) return { ok: false, error: 'Key mapping not loaded' };
        const k = cmd.key;
        const entry = keyMap[k];
        if (!entry || !entry.a1) return { ok: false, error: `Unknown key: ${k}` };
        return setCell(entry.a1, cmd.value, entry.sheetName);
      }
      case 'set_key_formula': {
        if (!keyMap) return { ok: false, error: 'Key mapping not loaded' };
        const k = cmd.key;
        const entry = keyMap[k];
        if (!entry || !entry.a1) return { ok: false, error: `Unknown key: ${k}` };
        return setFormula(entry.a1, cmd.formula, entry.sheetName);
      }
      case 'get_key_value': {
        if (!keyMap) return { ok: false, error: 'Key mapping not loaded' };
        const k = cmd.key;
        const entry = keyMap[k];
        if (!entry || !entry.a1) return { ok: false, error: `Unknown key: ${k}` };
        const rc = a1ToRC(entry.a1);
        if (!rc) return { ok: false, error: 'Bad mapped A1' };
        try {
          const sheets = getSheets();
          let idx = null;
          if (entry.sheetName) idx = getSheetIndexByName(entry.sheetName);
          if (idx === null) {
            if (typeof ls.getSheet === 'function') idx = ls.getSheet()?.index; else idx = 0;
          }
          const target = sheets.find(s => (s.index ?? -1) === idx) || sheets[idx];
          const celldata = target?.celldata || [];
          const cell = celldata.find(c => c.r === rc.r && c.c === rc.c);
          const value = cell?.v?.m ?? cell?.v?.v ?? cell?.v ?? null;
          return { ok: true, value };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }
      case 'set_value':
        return setCell(cmd.a1, cmd.value, cmd.sheetName);
      case 'set_formula':
        return setFormula(cmd.a1, cmd.formula, cmd.sheetName);
      case 'find_replace':
        return findReplace(cmd);
      case 'set_active_sheet':
        return { ok: setActiveSheet(cmd.sheetName ?? cmd.index) };
      case 'set_range_values': {
        if (!ls || typeof ls.setRangeValue !== 'function') return { ok: false, error: 'Range API unavailable' };
        const range = parseRange(cmd.range);
        if (!range) return { ok: false, error: 'Invalid range' };
        try {
          const rows = range.startRow;
          const rowe = range.endRow;
          const cols = range.startCol;
          const cole = range.endCol;
          const values = Array.isArray(cmd.values) ? cmd.values : [];
          ls.setRangeValue([{ row: [rows, rowe], column: [cols, cole], value: values }]);
          if (typeof ls.refresh === 'function') ls.refresh();
          return { ok: true };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }
      case 'merge': {
        const range = parseRange(cmd.range);
        if (!range) return { ok: false, error: 'Invalid range' };
        try {
          const sheets = getSheets();
          let idx = null;
          if (cmd.sheetName) idx = getSheetIndexByName(cmd.sheetName);
          if (idx === null) {
            if (typeof ls.getSheet === 'function') idx = ls.getSheet()?.index; else idx = 0;
          }
          const target = sheets.find(s => (s.index ?? -1) === idx) || sheets[idx];
          if (!target) return { ok: false, error: 'Sheet not found' };
          target.config = target.config || {};
          target.config.merge = target.config.merge || {};
          const key = `${range.startRow}_${range.startCol}`;
          target.config.merge[key] = {
            r: range.startRow,
            c: range.startCol,
            rowspan: range.endRow - range.startRow + 1,
            colspan: range.endCol - range.startCol + 1
          };
          if (typeof ls.refresh === 'function') ls.refresh();
          return { ok: true };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }
      case 'insert_rows': {
        const index = Number(cmd.index ?? 0);
        const count = Number(cmd.count ?? 1);
        try {
          if (ls && typeof ls.insertRow === 'function') {
            ls.insertRow(index, count);
            if (typeof ls.refresh === 'function') ls.refresh();
            return { ok: true };
          }
          return { ok: false, error: 'insertRow not available' };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }
      case 'delete_rows': {
        const index = Number(cmd.index ?? 0);
        const count = Number(cmd.count ?? 1);
        try {
          if (ls && typeof ls.deleteRow === 'function') {
            ls.deleteRow(index, count);
            if (typeof ls.refresh === 'function') ls.refresh();
            return { ok: true };
          }
          return { ok: false, error: 'deleteRow not available' };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }
      case 'insert_cols': {
        const index = Number(cmd.index ?? 0);
        const count = Number(cmd.count ?? 1);
        try {
          if (ls && typeof ls.insertColumn === 'function') {
            ls.insertColumn(index, count);
            if (typeof ls.refresh === 'function') ls.refresh();
            return { ok: true };
          }
          return { ok: false, error: 'insertColumn not available' };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }
      case 'delete_cols': {
        const index = Number(cmd.index ?? 0);
        const count = Number(cmd.count ?? 1);
        try {
          if (ls && typeof ls.deleteColumn === 'function') {
            ls.deleteColumn(index, count);
            if (typeof ls.refresh === 'function') ls.refresh();
            return { ok: true };
          }
          return { ok: false, error: 'deleteColumn not available' };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }
      case 'get_value': {
        const rc = a1ToRC(cmd.a1);
        if (!rc) return { ok: false, error: 'Invalid A1 reference' };
        const sheets = getSheets();
        try {
          let idx = null;
          if (cmd.sheetName) idx = getSheetIndexByName(cmd.sheetName);
          if (idx === null) {
            if (typeof ls.getSheet === 'function') idx = ls.getSheet()?.index;
            else idx = 0;
          }
          const target = sheets.find(s => (s.index ?? -1) === idx) || sheets[idx];
          const celldata = target?.celldata || [];
          const cell = celldata.find(c => c.r === rc.r && c.c === rc.c);
          const value = cell?.v?.m ?? cell?.v?.v ?? cell?.v ?? null;
          return { ok: true, value };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }
      default:
        return { ok: false, error: `Unsupported command: ${cmd.type}` };
    }
  };

  const applyCommands = async (commands = []) => {
    const results = [];
    for (let i = 0; i < commands.length; i++) {
      results.push(applyCommand(commands[i]));
    }
    return results;
  };

  const register = (luckysheet) => {
    ls = luckysheet || window.luckysheet || null;
    const api = { register, applyCommands, applyCommand, a1ToRC, setActiveSheet };
    window.MaxSpreadsheetAgent = api;
    return api;
  };

  const setKeyMapping = (mappingRows) => {
    try {
      console.log('[AGENT] setKeyMapping called with:', mappingRows?.length, 'rows');
      console.log('[AGENT] First row sample:', mappingRows?.[0]);
      // mappingRows: [{ key, cell, section, label, type, required }]
      const map = {};
      (mappingRows || []).forEach((row) => {
        const key = row?.key || row?.json_field;
        const cell = row?.cell;
        console.log('[AGENT] Processing row - key:', key, 'cell:', cell);
        if (key && cell) {
          map[key] = { a1: cell, sheetName: row?.sheet || null };
        }
      });
      console.log('[AGENT] Final keyMap:', map);
      console.log('[AGENT] Total keys mapped:', Object.keys(map).length);
      keyMap = map;
      return true;
    } catch (e) {
      console.error('[AGENT] setKeyMapping error:', e);
      return false;
    }
  };

  return { register, applyCommands, applyCommand, a1ToRC, setActiveSheet, setKeyMapping };
})();

export default MaxSpreadsheetAgent;
