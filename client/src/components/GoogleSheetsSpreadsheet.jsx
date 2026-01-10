import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import Spreadsheet from 'x-data-spreadsheet';
import 'x-data-spreadsheet/dist/xspreadsheet.css';

const customCSS = `
  .x-spreadsheet-toolbar {
    position: sticky !important;
    top: 0 !important;
    z-index: 100 !important;
    background: #fff !important;
  }
`;

const GoogleSheetsSpreadsheet = forwardRef(({ scenarioData, onChange }, ref) => {
  const containerRef = useRef(null);
  const spreadsheetRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const originalDimensionsRef = useRef({ rowHeight: 25, colWidth: 100, indexWidth: 60 });

  // Expose API methods to parent component
  useImperativeHandle(ref, () => ({
    // Execute array of operations from backend
    executeOperations: (operations) => {
      if (!spreadsheetRef.current) return;
      
      operations.forEach(op => {
        switch (op.type) {
          case 'setCells':
            setCells(op.data.cells);
            break;
          case 'setFormula':
            setFormulas(op.data.cells);
            break;
          case 'setStyle':
            setStyle(op.data.range, op.data.style);
            break;
          case 'merge':
            mergeCells(op.data.range);
            break;
          default:
            console.warn('Unknown operation type:', op.type);
        }
      });
      
      // Refresh spreadsheet
      spreadsheetRef.current.reRender();
    },
    
    // Get current sheet data
    getData: () => {
      if (!spreadsheetRef.current) return null;
      return spreadsheetRef.current.getData();
    },
    
    // Clear all data
    clear: () => {
      if (!spreadsheetRef.current) return;
      spreadsheetRef.current.loadData([{ name: 'Sheet1', rows: {} }]);
    },
    
    // Zoom in/out - scale the entire spreadsheet
    setZoom: (zoomPercent) => {
      const xs = spreadsheetRef.current;
      if (!xs) return;
      
      const scale = Math.max(0.5, Math.min(2, zoomPercent / 100));
      const origDims = originalDimensionsRef.current;
      
      // Update the spreadsheet options with scaled dimensions
      const newRowHeight = Math.round(origDims.rowHeight * scale);
      const newColWidth = Math.round(origDims.colWidth * scale);
      const newIndexWidth = Math.round(origDims.indexWidth * scale);
      
      // Access the internal options and update them
      if (xs.options) {
        if (xs.options.row) {
          xs.options.row.height = newRowHeight;
        }
        if (xs.options.col) {
          xs.options.col.width = newColWidth;
          xs.options.col.indexWidth = newIndexWidth;
        }
      }
      
      // Force re-render with new dimensions
      const currentData = xs.getData();
      xs.loadData(currentData);
      xs.reRender();
    }
  }));

  // Set cell values
  const setCells = (cells) => {
    if (!spreadsheetRef.current) return;
    
    cells.forEach(({ row, col, value }) => {
      spreadsheetRef.current.cellText(row, col, value, 0);
    });
  };

  // Set formulas
  const setFormulas = (cells) => {
    if (!spreadsheetRef.current) return;
    
    cells.forEach(({ row, col, formula }) => {
      spreadsheetRef.current.cellText(row, col, formula, 0);
    });
  };

  // Apply styles to range
  const setStyle = (range, style) => {
    if (!spreadsheetRef.current) return;
    
    const { startRow, endRow, startCol, endCol } = range;
    
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        // Apply style using x-data-spreadsheet API
        const cell = spreadsheetRef.current.cell(r, c, 0);
        if (cell) {
          if (style.bgcolor) cell.style = cell.style || {};
          if (style.bgcolor) cell.style.bgcolor = style.bgcolor;
          if (style.color) cell.style.color = style.color;
          if (style.font) {
            cell.style.font = cell.style.font || {};
            if (style.font.bold !== undefined) cell.style.font.bold = style.font.bold;
            if (style.font.size) cell.style.font.size = style.font.size;
            if (style.font.italic !== undefined) cell.style.font.italic = style.font.italic;
          }
        }
      }
    }
  };

  // Merge cells
  const mergeCells = (range) => {
    if (!spreadsheetRef.current) return;
    
    const { startRow, endRow, startCol, endCol } = range;
    const mergeStr = `${startCol}:${startRow}:${endCol}:${endRow}`;
    
    // Add merge using x-data-spreadsheet API
    const data = spreadsheetRef.current.getData()[0];
    data.merges = data.merges || [];
    data.merges.push(mergeStr);
  };

  // Generate spreadsheet data from scenario
  // Keep latest onChange without forcing re-init.
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // (moved) loadFromXlsx is defined above
  const loadFromXlsx = useCallback(async (xs) => {
    try {
      // Dynamically load SheetJS if not already present (avoid bundler import)
      if (!(window && window.XLSX)) {
        await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
      }
      const XLSX = window.XLSX;
      if (!XLSX) return;
      let resp = await fetch('/multifamilytemplate.xlsx');
      if (!resp.ok) {
        resp = await fetch('/build/multifamilytemplate.xlsx');
      }
      if (!resp.ok) return;
      const buf = await resp.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellStyles: true });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];

      const rng = XLSX.utils.decode_range(ws['!ref']);
      const minRow = rng.s.r;
      const maxRow = rng.e.r;
      const minCol = rng.s.c;
      const maxCol = rng.e.c;

      const rows = {};
      const styles = [
        {
          bgcolor: '#ffffff', align: 'left', valign: 'middle', textwrap: false,
          color: '#0a0a0a', font: { name: 'Arial', size: 10, bold: false, italic: false },
        },
      ];
      const styleKeyToIndex = new Map();
      styleKeyToIndex.set(JSON.stringify(styles[0]), 0);

      function normalizeStyle(cellStyle) {
        const s = cellStyle || {};
        const out = {
          bgcolor: '#ffffff', align: 'left', valign: 'middle', textwrap: false,
          color: '#0a0a0a', font: { name: 'Arial', size: 10, bold: false, italic: false },
        };
        if (s.font) {
          const f = s.font;
          if (f.bold) out.font.bold = true;
          if (f.italic) out.font.italic = true;
          if (f.sz) out.font.size = Math.round(f.sz);
          if (f.name) out.font.name = f.name;
          if (f.color && f.color.rgb) out.color = `#${String(f.color.rgb).slice(0,6)}`;
        }
        if (s.fill) {
          const fg = s.fill.fgColor;
          const rgb = fg && fg.rgb;
          if (rgb) out.bgcolor = `#${String(rgb).slice(0,6)}`;
        }
        if (s.alignment) {
          const a = s.alignment;
          if (a.horizontal) out.align = a.horizontal; // left|center|right
          if (a.vertical) out.valign = a.vertical;     // top|middle|bottom
          if (a.wrapText) out.textwrap = true;
        }
        return out;
      }

      const encode_cell = XLSX.utils.encode_cell;
      for (let r = minRow; r <= maxRow; r++) {
        const rowIdx = r - minRow;
        const cells = {};
        for (let c = minCol; c <= maxCol; c++) {
          const colIdx = c - minCol;
          const addr = encode_cell({ r, c });
          const cell = ws[addr];
          if (!cell) continue;
          const v = cell.v;
          if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) continue;
          const styleObj = normalizeStyle(cell.s);
          const key = JSON.stringify(styleObj);
          let styleIndex = styleKeyToIndex.get(key);
          if (styleIndex === undefined) {
            styles.push(styleObj);
            styleIndex = styles.length - 1;
            styleKeyToIndex.set(key, styleIndex);
          }
          cells[colIdx] = { text: String(v), style: styleIndex };
        }
        if (Object.keys(cells).length > 0) {
          rows[rowIdx] = { cells };
        }
      }

      // Row heights
      const wsRows = ws['!rows'] || [];
      wsRows.forEach((rd, i) => {
        if (!rd) return;
        const h = rd.hpx || rd.hpt;
        if (h) {
          const rowIdx = i - minRow;
          if (rowIdx >= 0) rows[rowIdx] = { ...(rows[rowIdx] || {}), height: Math.round(h) };
        }
      });

      // Column widths
      const wsCols = ws['!cols'] || [];
      const colsOut = { len: (maxCol - minCol + 1) };
      wsCols.forEach((cd, j) => {
        if (!cd) return;
        const w = cd.wpx || (cd.wch ? Math.round(cd.wch * 7) : null);
        const colIdx = j - minCol;
        if (w && colIdx >= 0) colsOut[colIdx] = { width: Math.max(40, Math.round(w)) };
      });

      // Merges
      const merges = (ws['!merges'] || []).map(m => {
        const startCol = m.s.c - minCol;
        const startRow = m.s.r - minRow;
        const endCol = m.e.c - minCol;
        const endRow = m.e.r - minRow;
        return `${startCol}:${startRow}:${endCol}:${endRow}`;
      });

      const data = {
        name: 'Property',
        rows,
        cols: colsOut,
        merges,
        styles,
      };
      xs.loadData([data]);
      xs.reRender?.();
    } catch (e) {
      // ignore; static template already loaded
    }
  }, []);

  // Initialize the spreadsheet ONCE (React 18 dev StrictMode mounts effects twice).
  useEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl || spreadsheetRef.current) return;

    // Clear any leftover DOM (prevents duplicate toolbars/sheets in StrictMode/dev refreshes).
    containerEl.innerHTML = '';

    // Add custom CSS
    const style = document.createElement('style');
    style.textContent = customCSS;
    document.head.appendChild(style);

    const sheetData = getStaticTemplateData();

    const options = {
      mode: 'edit',
      showToolbar: true,
      showGrid: true,
      showContextmenu: true,
      view: {
        height: () => {
          const el = containerRef.current;
          return el ? el.clientHeight : 600;
        },
        width: () => {
          const el = containerRef.current;
          return el ? el.clientWidth : 800;
        },
      },
      row: {
        len: 100,
        height: 25,
      },
      col: {
        len: 26,
        width: 100,
        indexWidth: 60,
        minWidth: 60,
      },
      style: {
        bgcolor: '#ffffff',
        align: 'left',
        valign: 'middle',
        textwrap: false,
        strike: false,
        underline: false,
        color: '#0a0a0a',
        font: {
          name: 'Arial',
          size: 10,
          bold: false,
          italic: false,
        },
      },
    };

    const xs = new Spreadsheet(containerEl, options);
    xs.loadData([sheetData]);

    spreadsheetRef.current = xs;

    // Fix toolbar position - scroll to top
    setTimeout(() => {
      const scrollableArea = containerRef.current?.querySelector('.x-spreadsheet-sheet');
      if (scrollableArea) {
        scrollableArea.scrollTop = 0;
      }
    }, 100);

    // Listen for changes
    xs.change((data) => {
      const cb = onChangeRef.current;
      if (cb) {
        cb(data);
      }
    });

    // Attempt to load template directly from XLSX (client-side)
    loadFromXlsx(xs);

    return () => {
      try {
        xs?.destroy?.();
      } catch (e) {
        // ignore
      }
      spreadsheetRef.current = null;
      try {
        containerEl.innerHTML = '';
      } catch (e) {
        // ignore
      }
      try {
        document.head.removeChild(style);
      } catch (e) {
        // ignore
      }
    };
  }, [loadFromXlsx]);

  // Update sheet contents when scenarioData changes (without re-creating the instance).
  const loadMultifamilyTemplate = useCallback(async () => {
    const xs = spreadsheetRef.current;
    if (!xs) return;
    
    try {
      const response = await fetch(`http://127.0.0.1:8010/api/spreadsheet/get-template?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const result = await response.json();
      if (result.success && result.data) {
        xs.loadData([result.data]);
        xs.reRender?.();
        return;
      }
    } catch (error) {
      console.error('Failed to load multifamily template:', error);
    }
    // Fallback: load static client-side template immediately
    xs.loadData([getStaticTemplateData()]);
    xs.reRender?.();
  }, []);

  useEffect(() => {
    const xs = spreadsheetRef.current;
    if (!xs) return;
    
    // Try backend template; fallback to static template for immediate display
    loadMultifamilyTemplate();
  }, [scenarioData, loadMultifamilyTemplate]);
  
  // Load the full multifamily underwriting model template
  // (note) loadMultifamilyTemplate moved above and wrapped with useCallback

  // (moved) loadFromXlsx defined above

  // Helper to load external scripts from CSP-allowed sources
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Static client-side template for immediate use in Property tab
  function getStaticTemplateData() {
    // Values-only labels + merges + widths + basic styles for closer fidelity
    const styles = [
      // 0: default
      {
        bgcolor: '#ffffff', align: 'left', valign: 'middle', textwrap: false,
        color: '#0a0a0a', font: { name: 'Arial', size: 10, bold: false, italic: false },
      },
      // 1: title
      {
        bgcolor: '#ffffff', align: 'center', valign: 'middle', textwrap: false,
        color: '#0a0a0a', font: { name: 'Arial', size: 14, bold: true, italic: false },
      },
      // 2: section header
      {
        bgcolor: '#f3f4f6', align: 'left', valign: 'middle', textwrap: false,
        color: '#111827', font: { name: 'Arial', size: 11, bold: true, italic: false },
      },
      // 3: table header
      {
        bgcolor: '#e5e7eb', align: 'center', valign: 'middle', textwrap: true,
        color: '#111827', font: { name: 'Arial', size: 10, bold: true, italic: false },
      },
    ];

    const rows = {
      0: { cells: { 0: { text: 'Multifamily Underwriting Model', style: 1 } }, height: 30 },
      2: { cells: { 0: { text: 'Property Information', style: 2 } }, height: 24 },
      3: { cells: { 0: { text: 'Property Name' }, 2: { text: '' }, 4: { text: 'Address' }, 6: { text: '' } } },
      4: { cells: { 0: { text: 'City' }, 2: { text: '' }, 4: { text: 'State' }, 6: { text: '' } } },
      5: { cells: { 0: { text: 'Zip Code' }, 2: { text: '' }, 4: { text: 'Year Built' }, 6: { text: '' } } },
      7: { cells: { 0: { text: 'Unit Mix', style: 2 } }, height: 24 },
      8: { cells: { 0: { text: 'Type', style: 3 }, 1: { text: '# Units', style: 3 }, 2: { text: 'Avg SF', style: 3 }, 3: { text: 'Rent', style: 3 }, 4: { text: 'Other Income', style: 3 } } },
      9: { cells: { 0: { text: 'Studio' }, 1: { text: '' }, 2: { text: '' }, 3: { text: '' }, 4: { text: '' } } },
      10: { cells: { 0: { text: '1 Bed' }, 1: { text: '' }, 2: { text: '' }, 3: { text: '' }, 4: { text: '' } } },
      11: { cells: { 0: { text: '2 Bed' }, 1: { text: '' }, 2: { text: '' }, 3: { text: '' }, 4: { text: '' } } },
      12: { cells: { 0: { text: '3 Bed' }, 1: { text: '' }, 2: { text: '' }, 3: { text: '' }, 4: { text: '' } } },
      14: { cells: { 0: { text: 'Income', style: 2 } }, height: 24 },
      15: { cells: { 0: { text: 'Gross Potential Rent' }, 3: { text: '' } } },
      16: { cells: { 0: { text: 'Loss to Lease' }, 3: { text: '' } } },
      17: { cells: { 0: { text: 'Vacancy' }, 3: { text: '' } } },
      18: { cells: { 0: { text: 'Concessions' }, 3: { text: '' } } },
      19: { cells: { 0: { text: 'Other Income' }, 3: { text: '' } } },
      21: { cells: { 0: { text: 'Expenses', style: 2 } }, height: 24 },
      22: { cells: { 0: { text: 'Payroll' }, 3: { text: '' } } },
      23: { cells: { 0: { text: 'Repairs & Maintenance' }, 3: { text: '' } } },
      24: { cells: { 0: { text: 'Contract Services' }, 3: { text: '' } } },
      25: { cells: { 0: { text: 'Utilities' }, 3: { text: '' } } },
      26: { cells: { 0: { text: 'Taxes' }, 3: { text: '' } } },
      27: { cells: { 0: { text: 'Insurance' }, 3: { text: '' } } },
      28: { cells: { 0: { text: 'Admin/Marketing' }, 3: { text: '' } } },
      30: { cells: { 0: { text: 'Financing', style: 2 } }, height: 24 },
      31: { cells: { 0: { text: 'Loan Amount' }, 3: { text: '' } } },
      32: { cells: { 0: { text: 'Interest Rate' }, 3: { text: '' } } },
      33: { cells: { 0: { text: 'Amortization (years)' }, 3: { text: '' } } },
      34: { cells: { 0: { text: 'Term (years)' }, 3: { text: '' } } },
      36: { cells: { 0: { text: 'Returns', style: 2 } }, height: 24 },
      37: { cells: { 0: { text: 'NOI' }, 3: { text: '' } } },
      38: { cells: { 0: { text: 'Cap Rate' }, 3: { text: '' } } },
      39: { cells: { 0: { text: 'Cash-on-Cash' }, 3: { text: '' } } },
      40: { cells: { 0: { text: 'IRR' }, 3: { text: '' } } },
    };

    const merges = [
      '0:0:6:0', // Title span wider
      '0:2:6:2', // Property Information
      '0:7:4:7', // Unit Mix header
      '0:13:6:13', // Income header line
      '0:20:6:20', // Expenses header line
      '0:29:6:29', // Financing header line
      '0:35:6:35', // Returns header line
    ];

    const cols = {
      len: 12,
      0: { width: 180 },
      1: { width: 110 },
      2: { width: 110 },
      3: { width: 130 },
      4: { width: 130 },
      5: { width: 120 },
      6: { width: 120 },
      7: { width: 100 },
      8: { width: 100 },
    };

    return {
      name: 'Property',
      rows,
      cols,
      merges,
      styles,
    };
  }

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#fff',
        overflow: 'hidden'
      }} 
    />
  );
});

export default GoogleSheetsSpreadsheet;
