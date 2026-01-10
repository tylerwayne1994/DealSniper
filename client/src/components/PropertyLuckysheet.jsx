import React, { useEffect, useRef } from 'react';

// Dynamically load external scripts/styles from CDN (no npm needed)
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

function loadStyle(href) {
  return new Promise((resolve, reject) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    l.onload = resolve;
    l.onerror = reject;
    document.head.appendChild(l);
  });
}

const SHEETJS_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
const LUCKYSHEET_CSS = 'https://cdn.jsdelivr.net/npm/luckysheet@2.1.7/dist/plugins/css/luckysheet.css';
const LUCKYSHEET_JS = 'https://cdn.jsdelivr.net/npm/luckysheet@2.1.7/dist/luckysheet.min.js';

export default function PropertyLuckysheet() {
  const containerRef = useRef(null);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      try {
        // Load Luckysheet and SheetJS
        await loadStyle(LUCKYSHEET_CSS);
        await loadScript(SHEETJS_CDN);
        await loadScript(LUCKYSHEET_JS);

        if (destroyed) return;

        // Fetch the XLSX template (place multifamilytemplate.xlsx under client/public for dev)
        // Try public root, then build path as fallback
        let resp = await fetch('/multifamilytemplate.xlsx');
        if (!resp.ok) {
          resp = await fetch('/build/multifamilytemplate.xlsx');
        }
        if (!resp.ok) {
          console.warn('Template not found at /multifamilytemplate.xlsx or /build/multifamilytemplate.xlsx; loading skeleton');
          renderSkeleton();
          return;
        }
        const buf = await resp.arrayBuffer();

        // Parse XLSX via SheetJS
        // eslint-disable-next-line no-undef
        const wb = window.XLSX.read(buf, { type: 'array', cellStyles: true });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        // Decode range and build data grid with styles for exact fidelity
        // eslint-disable-next-line no-undef
        const rng = window.XLSX.utils.decode_range(ws['!ref']);
        const rowCount = rng.e.r - rng.s.r + 1;
        const colCount = rng.e.c - rng.s.c + 1;

        const dataGrid = Array.from({ length: rowCount }).map(() => Array.from({ length: colCount }).map(() => null));
        // eslint-disable-next-line no-undef
        const encode_cell = window.XLSX.utils.encode_cell;
        for (let r = rng.s.r; r <= rng.e.r; r++) {
          for (let c = rng.s.c; c <= rng.e.c; c++) {
            const addr = encode_cell({ r, c });
            const cell = ws[addr];
            if (!cell) continue;
            const v = cell.v;
            if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) continue;
            const out = { v: String(v) };
            const s = cell.s || {};
            // Map styles: font, fill, alignment
            if (s.font) {
              const f = s.font;
              if (f.bold) out.bl = 1;
              if (f.italic) out.it = 1;
              if (f.sz) out.fs = Math.round(f.sz);
              if (f.name) out.ff = f.name;
              if (f.color && f.color.rgb) out.fc = `#${String(f.color.rgb).slice(0,6)}`;
            }
            if (s.fill) {
              const fg = s.fill.fgColor;
              const rgb = fg && fg.rgb;
              if (rgb) out.bg = `#${String(rgb).slice(0,6)}`;
            }
            if (s.alignment) {
              const a = s.alignment;
              if (a.horizontal) out.ht = a.horizontal; // 'left'|'center'|'right'
              if (a.vertical) out.vt = a.vertical;     // 'top'|'middle'|'bottom'
              if (a.wrapText) out.tb = '1';
            }
            dataGrid[r - rng.s.r][c - rng.s.c] = out;
          }
        }

        // Merges
        const merges = (ws['!merges'] || []).map(m => {
          const r = m.s.r;
          const c = m.s.c;
          const rowspan = (m.e.r - m.s.r) + 1;
          const colspan = (m.e.c - m.s.c) + 1;
          return { r, c, rowspan, colspan };
        });
        const mergeMap = {};
        merges.forEach(m => {
          mergeMap[`${m.r}_${m.c}`] = m;
        });

        // Row heights and column widths (if available)
        const rowlen = {};
        const columnlen = {};
        const wsRows = ws['!rows'] || [];
        for (let i = 0; i < wsRows.length; i++) {
          const rd = wsRows[i];
          if (!rd) continue;
          const h = rd.hpx || rd.hpt;
          if (h) rowlen[i - rng.s.r] = Math.round(h);
        }
        const wsCols = ws['!cols'] || [];
        for (let j = 0; j < wsCols.length; j++) {
          const cd = wsCols[j];
          if (!cd) continue;
          const w = cd.wpx || cd.wch ? Math.round((cd.wpx || (cd.wch * 7))) : null;
        
          if (w) columnlen[j - rng.s.c] = Math.max(40, w);
        }

        // Render Luckysheet
        // eslint-disable-next-line no-undef
        window.luckysheet.create({
          container: containerRef.current?.id || 'luckysheet',
          data: [
            {
              name: 'Property',
              row: rowCount,
              column: colCount,
              data: dataGrid,
              config: {
                merge: mergeMap,
                rowlen,
                columnlen,
              },
            },
          ],
          showinfobar: false,
          allowEdit: true,
          showtoolbar: true,
          showsheetbar: false,
          enableAddRow: true,
          enableAddCol: true,
        });
      } catch (e) {
        console.error('Failed to init Luckysheet renderer:', e);
        renderSkeleton();
      }
    }

    function renderSkeleton() {
      try {
        // eslint-disable-next-line no-undef
        if (window.luckysheet) {
          window.luckysheet.create({
            container: containerRef.current?.id || 'luckysheet',
            data: [
              {
                name: 'Property',
                row: 50,
                column: 10,
                data: [
                  [{ v: 'Multifamily Underwriting Model' }],
                ],
              },
            ],
            showinfobar: false,
            allowEdit: true,
            showtoolbar: true,
            showsheetbar: false,
          });
        } else if (containerRef.current) {
          containerRef.current.innerHTML = '<div style="padding:8px;font-weight:600">Property template failed to load. Place multifamilytemplate.xlsx in client/public.</div>';
        }
      } catch {}
    }

    init();
    return () => {
      destroyed = true;
    };
  }, []);

  return (
    <div id="luckysheet" ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, background: '#fff' }} />
  );
}
