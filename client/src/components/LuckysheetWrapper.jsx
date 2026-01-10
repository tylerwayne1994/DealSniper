import React, { useEffect, useRef } from 'react';
import LuckyExcel from 'luckyexcel';
import MaxSpreadsheetAgent from '../agents/MaxSpreadsheetAgent';
import MaxAgentListener from '../agents/MaxAgentListener';

const LuckysheetWrapper = ({ data, onChange, scenarioData }) => {
  const containerRef = useRef(null);
  const luckysheetInstance = useRef(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;

    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        // Check if script already exists
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
          // Wait a bit to ensure it's executed
          setTimeout(resolve, 50);
          return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = false; // Important: load scripts in order
        script.onload = () => {
          // Add small delay to ensure script is fully executed
          setTimeout(resolve, 50);
        };
        script.onerror = reject;
        document.body.appendChild(script);
      });
    };

    const loadCSS = (href) => {
      // Check if CSS already exists
      const existing = document.querySelector(`link[href="${href}"]`);
      if (existing) return;

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    };

    const addIconPathFix = () => {
      // Hide broken icon font and show text labels instead
      const styleId = 'luckysheet-icon-fix';
      if (document.getElementById(styleId)) return;
      
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        /* FORCE EVERYTHING TO BE INTERACTIVE */
        #luckysheet-container,
        #luckysheet-container *,
        .luckysheet-grid-container,
        .luckysheet-grid-container *,
        #luckysheet-cell-main,
        #luckysheet-cell-main *,
        canvas {
          pointer-events: auto !important;
          user-select: auto !important;
          touch-action: auto !important;
        }
        
        /* Ensure container takes full space */
        #luckysheet-container {
          width: 100% !important;
          height: 100% !important;
          min-height: 800px !important;
          position: relative !important;
          z-index: 1 !important;
        }
        
        /* Make cells clickable */
        .luckysheet-cell,
        #luckysheet-cell-main,
        #luckysheet-grid-window-1,
        canvas.luckysheet-data-visualization-canvas {
          pointer-events: auto !important;
          cursor: cell !important;
        }
        
        /* Hide broken icon font characters */
        .iconfont-luckysheet:before {
          content: '' !important;
        }
        
        /* Show text labels for toolbar buttons instead */
        .luckysheet-icon-img-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        
        /* Specific toolbar button labels */
        #luckysheet-icon-undo .luckysheet-icon-img-container:after { content: '↶'; font-size: 18px; }
        #luckysheet-icon-redo .luckysheet-icon-img-container:after { content: '↷'; font-size: 18px; }
        #luckysheet-icon-paintformat .luckysheet-icon-img-container:after { content: '🖌'; }
        #luckysheet-icon-function .luckysheet-icon-img-container:after { content: 'ƒx'; }
        #luckysheet-icon-frozenmode .luckysheet-icon-img-container:after { content: '❄'; }
        #luckysheet-icon-sort .luckysheet-icon-img-container:after { content: '⇅'; font-size: 16px; }
        #luckysheet-icon-filter .luckysheet-icon-img-container:after { content: '⏚'; font-size: 16px; }
        #luckysheet-icon-chart .luckysheet-icon-img-container:after { content: '📊'; }
        #luckysheet-icon-pivot .luckysheet-icon-img-container:after { content: '⊞'; font-size: 18px; }
        #luckysheet-icon-screenshot .luckysheet-icon-img-container:after { content: '📷'; }
        #luckysheet-icon-findAndReplace .luckysheet-icon-img-container:after { content: '🔍'; }
        
        /* Format buttons */
        .luckysheet-icon-bold:after { content: 'B'; font-weight: bold; }
        .luckysheet-icon-italic:after { content: 'I'; font-style: italic; }
        .luckysheet-icon-underline:after { content: 'U'; text-decoration: underline; }
        .luckysheet-icon-strikethrough:after { content: 'S'; text-decoration: line-through; }
        
        /* Fix image paths */
        [style*="waffle_sprite.png"] {
          background-image: url('/spreadsheet/css/waffle_sprite.png') !important;
        }
        
        [style*="loading.gif"] {
          background-image: url('/spreadsheet/css/loading.gif') !important;
        }
      `;
      document.head.appendChild(style);
    };

    const initLuckysheet = async () => {
      try {
        console.log('Starting Luckysheet initialization...');
        
        // Load local Font Awesome to satisfy CSP (no external CDNs)
        loadCSS('/spreadsheet/plugins/font-awesome.min.css');
        
        // Load CSS files
        loadCSS('/spreadsheet/plugins/jquery-ui.min.css');
        loadCSS('/spreadsheet/plugins/css/spectrum.min.css');
        loadCSS('/spreadsheet/css/iconCustom.css');
        loadCSS('/spreadsheet/css/luckysheet-core.css');
        loadCSS('/spreadsheet/css/luckysheet-cellFormat.css');
        loadCSS('/spreadsheet/css/luckysheet-protection.css');
        loadCSS('/spreadsheet/css/luckysheet-zoom.css');
        
        // Add icon path fix
        addIconPathFix();
        
        console.log('CSS files loaded');

        // Load jQuery from CDN first (Luckysheet requires it)
        console.log('Loading jQuery...');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js');
        
        // Wait for jQuery to be available in global scope
        let jqueryAttempts = 0;
        while (!window.$ && !window.jQuery && jqueryAttempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          jqueryAttempts++;
        }
        
        if (!window.$ || !window.jQuery) {
          throw new Error('jQuery failed to load');
        }
        
        console.log('jQuery loaded:', typeof window.$, typeof window.jQuery);
        
        // Load other plugin dependencies (these depend on jQuery)
        console.log('Loading plugins...');
        await loadScript('/spreadsheet/plugins/js/lodash.min.js');
        await loadScript('/spreadsheet/plugins/js/jquery-ui.min.js');
        await loadScript('/spreadsheet/plugins/js/jquery.mousewheel.min.js');
        await loadScript('/spreadsheet/plugins/js/spectrum.min.js');
        console.log('Plugins loaded');
        
        // Load Luckysheet core
        console.log('Loading Luckysheet core...');
        
        // Add uuid polyfill (Luckysheet requires uuid.v4)
        if (!window.uuid) {
          window.uuid = {
            v4: function() {
              return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : ((r & 0x3) | 0x8);
                return v.toString(16);
              });
            }
          };
        }
        
        await loadScript('/spreadsheet/luckysheet.umd.js');
        console.log('Luckysheet loaded:', typeof window.luckysheet);

        // Wait a bit for everything to initialize
        await new Promise(resolve => setTimeout(resolve, 100));

        // Helper: convert x-data-spreadsheet JSON into Luckysheet sheet config
        const convertXDataToLuckysheet = (x) => {
          try {
            const celldata = [];
            const rowlen = {};
            const columnlen = {};
            const merge = {};
            // Rows & cells
            const rows = x?.rows || {};
            Object.keys(rows).forEach((rKey) => {
              const r = parseInt(rKey, 10);
              const rowObj = rows[rKey] || {};
              if (rowObj.height) rowlen[r] = rowObj.height;
              const cells = rowObj.cells || {};
              Object.keys(cells).forEach((cKey) => {
                const c = parseInt(cKey, 10);
                const cell = cells[cKey] || {};
                const text = cell.text != null ? String(cell.text) : '';
                const hasVal = typeof cell.val === 'number';
                const v = hasVal ? { v: cell.val, m: cell.disp || text } : { v: text, m: text };
                if (cell.bg) v.bg = cell.bg;
                if (cell.fc) v.fc = cell.fc;
                if (cell.bold) v.bl = 1;
                if (cell.italic) v.it = 1;
                if (cell.fs) v.fs = cell.fs;
                // Alignments mapping: ht (0:left,1:center,2:right), vt (0:top,1:middle,2:bottom)
                const htMap = { left: 0, center: 1, right: 2, justify: 0, distributed: 0 };
                const vtMap = { top: 0, center: 1, middle: 1, bottom: 2, justify: 0, distributed: 0 };
                if (cell.ht && htMap[cell.ht] !== undefined) v.ht = htMap[cell.ht];
                if (cell.vt && vtMap[cell.vt] !== undefined) v.vt = vtMap[cell.vt];
                celldata.push({ r, c, v });
              });
            });
            // Col widths
            const cols = x?.cols || {};
            Object.keys(cols).forEach((k) => {
              if (k === 'len') return;
              const idx = parseInt(k, 10);
              const meta = cols[k] || {};
              if (meta.width) columnlen[idx] = meta.width;
            });
            // Merges: "c1:r1:c2:r2" (0-based)
            const merges = Array.isArray(x?.merges) ? x.merges : [];
            merges.forEach((mStr) => {
              const parts = String(mStr).split(':');
              if (parts.length !== 4) return;
              const c1 = parseInt(parts[0], 10) || 0;
              const r1 = parseInt(parts[1], 10) || 0;
              const c2 = parseInt(parts[2], 10) || c1;
              const r2 = parseInt(parts[3], 10) || r1;
              const key = `${r1}_${c1}`;
              merge[key] = {
                r: r1,
                c: c1,
                rowspan: Math.max(1, r2 - r1 + 1),
                colspan: Math.max(1, c2 - c1 + 1),
              };
            });
            return [{
              name: x?.name || 'Property',
              color: '',
              status: '1',
              order: '0',
              index: 0,
              celldata,
              config: { merge, rowlen, columnlen },
            }];
          } catch (e) {
            console.warn('convertXDataToLuckysheet failed:', e);
            return null;
          }
        };

        // Initialize Luckysheet
        if (window.luckysheet && containerRef.current) {
          console.log('Initializing Luckysheet with container:', containerRef.current);
          let sheetData = null;
          // First try LuckyExcel for highest-fidelity conversion (styles, merges, borders)
          const loadTemplateLuckyExcel = async () => {
            try {
              const resp = await fetch('/templates/multifamily.xlsx');
              if (!resp.ok) {
                console.warn('LuckyExcel template fetch failed:', resp.status);
                return null;
              }
              const buf = await resp.arrayBuffer();
              const file = new File([buf], 'multifamily.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
              return await new Promise((resolve) => {
                // Use the correct LuckyExcel API to preserve styles/merges
                LuckyExcel.transformExcelToLucky(file, (exportJson) => {
                  try {
                    if (exportJson && Array.isArray(exportJson.sheets) && exportJson.sheets.length) {
                      // Debug: verify celldata contains style keys
                      try {
                        const first = exportJson.sheets[0];
                        const hasStyles = Array.isArray(first?.celldata) && first.celldata.some(ci => ci?.v && (ci.v.bg || ci.v.fc || ci.v.bl || ci.v.it));
                        console.log('LuckyExcel celldata styles detected:', hasStyles);
                      } catch (e) {}
                      resolve(exportJson.sheets);
                    } else {
                      resolve(null);
                    }
                  } catch (e) {
                    console.warn('LuckyExcel transform error:', e);
                    resolve(null);
                  }
                });
              });
            } catch (e) {
              console.warn('LuckyExcel loadTemplate error:', e);
              return null;
            }
          };
          sheetData = await loadTemplateLuckyExcel();
          
          try {
            // Prefer server-side template conversion (Excel → x-data → Luckysheet)
            if (!sheetData) {
              const resp = await fetch('http://localhost:8010/api/spreadsheet/get-template');
              if (resp.ok) {
                const tpl = await resp.json();
                if (tpl?.success && tpl?.data) {
                  const converted = convertXDataToLuckysheet(tpl.data);
                  if (converted) sheetData = converted;
                }
              } else {
                console.warn('Template fetch failed:', resp.status);
              }
            }
          } catch (e) {
            console.warn('Error fetching template:', e);
          }
          if (!sheetData) {
            // Fallback: minimal sheet using scenario data
            sheetData = data || [{
              name: "Property Analysis",
              color: "",
              status: "1",
              order: "0",
              data: generateTemplateFromScenario(scenarioData),
              config: {
                merge: {},
                rowlen: {},
                columnlen: {},
              },
              index: 0
            }];
          }

          console.log('Sheet data:', sheetData);

          // Add custom toolbar button after initialization
          window.toggleGridLines = function() {
            const currentConfig = window.luckysheet.getConfig();
            const showGrid = currentConfig?.showGridLines !== false;
            window.luckysheet.setConfig({
              showGridLines: !showGrid
            });
            // Force refresh
            window.luckysheet.refresh();
          };

          window.luckysheet.create({
            container: 'luckysheet-container',
            title: 'Property Analysis',
            lang: 'en',
            showinfobar: false,
            allowEdit: true,
            enableAddRow: true,
            enableAddCol: true,
            userInfo: false,
            showsheetbar: true,
            showstatisticBar: true,
            sheetFormulaBar: true,
            showConfigWindowResize: true,
            forceCalculation: true,
            plugins: [],
            myFolderUrl: '/spreadsheet/',
            enableAddBackTop: false,
            showGridLines: true,
            // Set initial zoom ratio if supported by Luckysheet
            zoomRatio: 1,
            cellRightClickConfig: {
              copy: true,
              copyAs: true,
              paste: true,
              insertRow: true,
              insertColumn: true,
              deleteRow: true,
              deleteColumn: true,
              deleteCell: true,
              hideRow: true,
              hideColumn: true,
              rowHeight: true,
              columnWidth: true,
              clear: true,
              matrix: false,
              sort: true,
              filter: true,
              chart: false,
              image: false,
              link: false,
              data: true,
              cellFormat: true
            },
            data: sheetData,
            hook: {
              cellUpdated: function(r, c, oldValue, newValue, isRefresh) {
                if (onChange && !isRefresh) {
                  const allSheets = window.luckysheet.getAllSheets();
                  onChange(allSheets);
                }
              }
            }
          });

          luckysheetInstance.current = window.luckysheet;
          isInitialized.current = true;
          MaxSpreadsheetAgent.register(window.luckysheet);
          // Start backend relay listener to allow Max to drive edits
          try {
            // Direct to backend to avoid dev proxy 404s
            MaxAgentListener.start({ apiBase: 'http://localhost:8010/api', intervalMs: 1500 });
            console.log('MaxAgentListener started with sessionId:', MaxAgentListener.getSessionId());
          } catch (e) {
            console.warn('Failed to start MaxAgentListener', e);
          }
          // Load key mapping for semantic edits
          try {
            const res = await fetch('http://localhost:8010/api/spreadsheet/mapping');
            if (res.ok) {
              const data = await res.json();
              if (data?.success && Array.isArray(data?.mapping)) {
                MaxSpreadsheetAgent.setKeyMapping(data.mapping);
                console.log('Max key mapping loaded:', data.mapping.length, 'entries');
                try { window.__MaxMapping = data.mapping; } catch (_) {}
              } else {
                console.warn('Mapping response invalid');
              }
            } else {
              console.warn('Failed to load mapping:', res.status);
            }
          } catch (e) {
            console.warn('Error loading mapping', e);
          }
          console.log('Luckysheet initialized successfully!');
          
          // Debug: Check if canvas was created
          setTimeout(() => {
            const canvas = document.querySelector('#luckysheet-container canvas');
            const cells = document.querySelector('#luckysheet-cell-main');
            const gridWindow = document.querySelector('#luckysheet-grid-window-1');
            console.log('Canvas element:', canvas);
            console.log('Cell main element:', cells);
            console.log('Grid window:', gridWindow);
            console.log('Container dimensions:', containerRef.current?.getBoundingClientRect());
            
            // Force click handlers if missing
            if (cells) {
              console.log('Adding manual click handler to cells');
              cells.addEventListener('click', (e) => {
                console.log('Cell clicked!', e);
              });
              cells.style.pointerEvents = 'auto';
              cells.style.cursor = 'cell';
            }
            
            if (canvas) {
              canvas.style.pointerEvents = 'auto';
              canvas.style.cursor = 'cell';
            }
            
            // Add gridline toggle button
            setTimeout(() => {
              const toolbar = document.querySelector('.luckysheet-wa-editor');
              if (toolbar && !document.getElementById('grid-btn')) {
                const btn = document.createElement('button');
                btn.id = 'grid-btn';
                btn.innerHTML = '☷';
                btn.title = 'Toggle gridlines';
                btn.style.cssText = 'padding:6px 10px;border:none;background:transparent;cursor:pointer;font-size:16px;border-radius:4px;';
                
                let visible = true;
                btn.onclick = () => {
                  visible = !visible;
                  // Target ALL canvases in grid window
                  const canvases = document.querySelectorAll('#luckysheet-grid-window-1 canvas, #luckysheet-cell-main canvas');
                  console.log('Found canvases:', canvases.length);
                  canvases.forEach((c, i) => {
                    console.log(`Canvas ${i}:`, c.id, c.style.display);
                    if (c.id === 'luckysheetTableContent') {
                      // This is the grid canvas
                      c.style.opacity = visible ? '1' : '0';
                    }
                  });
                  btn.style.background = visible ? 'transparent' : '#e8f0fe';
                };
                
                btn.onmouseenter = () => { if(visible) btn.style.background = '#f1f3f4'; };
                btn.onmouseleave = () => { if(visible) btn.style.background = 'transparent'; };
                
                toolbar.insertBefore(btn, toolbar.firstChild);
                console.log('Grid button added');

                // Add Zoom controls (In/Out)
                const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
                window.lsZoom = window.lsZoom || { level: 1.0 };

                const applyZoom = (level) => {
                  try {
                    if (window.luckysheet && typeof window.luckysheet.setConfig === 'function') {
                      window.luckysheet.setConfig({ zoomRatio: level });
                      if (typeof window.luckysheet.refresh === 'function') {
                        window.luckysheet.refresh();
                      }
                      return true;
                    }
                  } catch (e) {
                    console.warn('Luckysheet setConfig zoom failed, falling back to CSS transform', e);
                  }
                  // Fallback: use non-standard but widely supported CSS zoom to avoid offset issues
                  const root = containerRef.current || document.getElementById('luckysheet-container');
                  if (root) {
                    root.style.zoom = String(level);
                  }
                  return false;
                };

                const updateIndicator = () => {
                  const indicator = document.getElementById('zoom-indicator');
                  if (indicator) {
                    const lvl = window.lsZoom?.level || 1.0;
                    indicator.textContent = `${Math.round(lvl * 100)}%`;
                  }
                };

                const makeZoomBtn = (id, label, title, delta) => {
                  const zbtn = document.createElement('button');
                  zbtn.id = id;
                  zbtn.innerHTML = label;
                  zbtn.title = title;
                  zbtn.style.cssText = 'margin-left:6px;padding:6px 10px;border:none;background:transparent;cursor:pointer;font-size:16px;border-radius:4px;';
                  zbtn.onclick = () => {
                    const next = clamp((window.lsZoom?.level || 1.0) + delta, 0.5, 2.0);
                    window.lsZoom.level = next;
                    applyZoom(next);
                    zbtn.style.background = '#f1f3f4';
                    setTimeout(() => { zbtn.style.background = 'transparent'; }, 150);
                  };
                  zbtn.onmouseenter = () => { zbtn.style.background = '#f1f3f4'; };
                  zbtn.onmouseleave = () => { zbtn.style.background = 'transparent'; };
                  return zbtn;
                };

                const zoomOutBtn = makeZoomBtn('zoom-out-btn', '−', 'Zoom out', -0.1);
                const zoomInBtn = makeZoomBtn('zoom-in-btn', '+', 'Zoom in', +0.1);

                toolbar.insertBefore(zoomOutBtn, toolbar.firstChild);
                toolbar.insertBefore(zoomInBtn, toolbar.firstChild);
              
                // Reset to 100%
                const resetBtn = document.createElement('button');
                resetBtn.id = 'zoom-reset-btn';
                resetBtn.innerHTML = '100%';
                resetBtn.title = 'Reset zoom to 100%';
                resetBtn.style.cssText = 'margin-left:6px;padding:6px 10px;border:none;background:transparent;cursor:pointer;font-size:12px;border-radius:4px;color:#111827;';
                resetBtn.onclick = () => {
                  window.lsZoom.level = 1.0;
                  applyZoom(1.0);
                  updateIndicator();
                  resetBtn.style.background = '#f1f3f4';
                  setTimeout(() => { resetBtn.style.background = 'transparent'; }, 150);
                };
                resetBtn.onmouseenter = () => { resetBtn.style.background = '#f1f3f4'; };
                resetBtn.onmouseleave = () => { resetBtn.style.background = 'transparent'; };

                // Live zoom indicator
                const indicator = document.createElement('span');
                indicator.id = 'zoom-indicator';
                indicator.style.cssText = 'margin-left:6px;font-size:12px;color:#6b7280;user-select:none;';
                indicator.textContent = '100%';

                toolbar.insertBefore(resetBtn, toolbar.firstChild);
                toolbar.insertBefore(indicator, toolbar.firstChild);
              
                // Update indicator on initial attach
                updateIndicator();
              
                // Patch zoom button handlers to also update the indicator
                const originalZoomIn = zoomInBtn.onclick;
                zoomInBtn.onclick = () => { originalZoomIn(); updateIndicator(); };
                const originalZoomOut = zoomOutBtn.onclick;
                zoomOutBtn.onclick = () => { originalZoomOut(); updateIndicator(); };
                console.log('Zoom buttons added');

                // Mapping Inspector: toggle highlight on mapped cells
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

                const getActiveSheetIndex = () => {
                  try {
                    if (window.luckysheet && typeof window.luckysheet.getSheet === 'function') {
                      return window.luckysheet.getSheet()?.index ?? 0;
                    }
                  } catch (_) {}
                  return 0;
                };

                const getSheetByIndex = (idx) => {
                  try {
                    const sheets = window.luckysheet.getAllSheets();
                    return sheets.find(s => (s.index ?? -1) === idx) || sheets[idx];
                  } catch (_) { return null; }
                };

                let mappingOn = false;
                const prevStyles = new Map(); // key: `${r}_${c}_${idx}` -> prevBg

                const applyMappingHighlight = (enable) => {
                  const mapping = window.__MaxMapping || [];
                  const activeIdx = getActiveSheetIndex();
                  const sheet = getSheetByIndex(activeIdx);
                  if (!sheet) return;
                  sheet.celldata = Array.isArray(sheet.celldata) ? sheet.celldata : [];

                  if (enable) {
                    let applied = 0;
                    for (let i = 0; i < mapping.length; i++) {
                      const m = mapping[i];
                      const rc = a1ToRC(m?.cell);
                      const targetSheet = (m?.sheet || '').trim();
                      // Only highlight keys for the active sheet (or unspecified sheet)
                      if (!rc) continue;
                      if (targetSheet && sheet.name && targetSheet !== sheet.name) continue;
                      const key = `${rc.r}_${rc.c}_${activeIdx}`;
                      const cell = sheet.celldata.find(c => c.r === rc.r && c.c === rc.c);
                      if (cell) {
                        const prev = cell.v?.bg ?? null;
                        prevStyles.set(key, prev);
                        cell.v = { ...(cell.v || {}), bg: '#fff59d' }; // light yellow
                      } else {
                        prevStyles.set(key, null);
                        sheet.celldata.push({ r: rc.r, c: rc.c, v: { v: '', m: '', bg: '#fff59d' } });
                      }
                      applied++;
                    }
                    if (typeof window.luckysheet.refresh === 'function') window.luckysheet.refresh();
                    return applied;
                  } else {
                    let restored = 0;
                    prevStyles.forEach((prev, key) => {
                      const [rStr, cStr, idxStr] = key.split('_');
                      const r = parseInt(rStr, 10), c = parseInt(cStr, 10), idx = parseInt(idxStr, 10);
                      if (idx !== activeIdx) return;
                      const cell = sheet.celldata.find(ci => ci.r === r && ci.c === c);
                      if (cell && cell.v) {
                        if (prev === null) {
                          // remove bg
                          const { bg, ...rest } = cell.v;
                          cell.v = rest;
                        } else {
                          cell.v.bg = prev;
                        }
                        restored++;
                      }
                    });
                    prevStyles.clear();
                    if (typeof window.luckysheet.refresh === 'function') window.luckysheet.refresh();
                    return restored;
                  }
                };

                const mapBtn = document.createElement('button');
                mapBtn.id = 'mapping-inspector-btn';
                mapBtn.innerHTML = '🗺';
                mapBtn.title = 'Highlight mapped cells (active sheet)';
                mapBtn.style.cssText = 'margin-left:6px;padding:6px 10px;border:none;background:transparent;cursor:pointer;font-size:16px;border-radius:4px;';
                mapBtn.onclick = () => {
                  mappingOn = !mappingOn;
                  const count = applyMappingHighlight(mappingOn);
                  mapBtn.style.background = mappingOn ? '#e8f0fe' : 'transparent';
                  mapBtn.title = mappingOn ? `Mapped cells highlighted: ${count}` : 'Highlight mapped cells (active sheet)';
                };
                mapBtn.onmouseenter = () => { mapBtn.style.background = '#f1f3f4'; };
                mapBtn.onmouseleave = () => { if (!mappingOn) mapBtn.style.background = 'transparent'; };

                // Expose manual toggle for debugging
                try { window.toggleMappingInspector = () => mapBtn.click(); } catch (_) {}

                toolbar.insertBefore(mapBtn, toolbar.firstChild);
                console.log('Mapping Inspector button added');
              }
            }, 1500);
          }, 500);
        } else {
          console.error('Luckysheet not available or container not ready', {
            luckysheet: typeof window.luckysheet,
            container: containerRef.current
          });
        }
      } catch (error) {
        console.error('Error loading Luckysheet:', error);
      }
    };

    initLuckysheet();

    return () => {
      // Cleanup on unmount
      if (luckysheetInstance.current && typeof luckysheetInstance.current.destroy === 'function') {
        try {
          luckysheetInstance.current.destroy();
        } catch (e) {
          console.warn('Error destroying Luckysheet:', e);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateTemplateFromScenario = (scenario) => {
    const template = [];
    const property = scenario?.property || {};
    const pricing = scenario?.pricing_financing || {};
    const pnl = scenario?.pnl || {};
    const expenses = scenario?.expenses || {};
    const unitMix = scenario?.unit_mix || [];

    // Helper to create a cell
    const cell = (value, style = {}) => ({
      v: value,
      ct: { fa: "General", t: "g" },
      m: String(value || ""),
      ...style
    });

    const headerStyle = { bg: "#8b5cf6", fc: "#ffffff", fs: 14, bl: 1 };
    const sectionStyle = { bg: "#e9d5ff", bl: 1 };
    const labelStyle = { bl: 1 };
    const inputStyle = { bg: "#f5f3ff" };

    // Title Row
    template.push([
      cell("Property Analysis Template", headerStyle),
      ...Array(19).fill(cell("", { bg: "#8b5cf6" }))
    ]);

    // Empty row
    template.push(Array(20).fill(cell("")));

    // PROPERTY INFORMATION SECTION
    template.push([
      cell("PROPERTY INFORMATION", sectionStyle),
      ...Array(19).fill(cell(""))
    ]);

    const propertyFields = [
      ["Property Name", property.property_name || ""],
      ["Address", property.address || ""],
      ["City", property.city || ""],
      ["State", property.state || ""],
      ["ZIP", property.zip || ""],
      ["Property Type", property.property_type || ""],
      ["Year Built", property.year_built || ""],
      ["Total Units", property.units || property.total_units || ""],
      ["Total Square Feet", property.total_sq_ft || property.rba_sqft || ""],
      ["Lot Size (Acres)", property.lot_size || ""],
      ["Occupancy Rate", property.occupancy_rate || property.occupancy || ""],
    ];

    propertyFields.forEach(([label, value]) => {
      template.push([
        cell(label, labelStyle),
        cell(value, inputStyle),
        ...Array(18).fill(cell(""))
      ]);
    });

    // Empty row
    template.push(Array(20).fill(cell("")));

    // PRICING & FINANCING SECTION
    template.push([
      cell("PRICING & FINANCING", sectionStyle),
      ...Array(19).fill(cell(""))
    ]);

    const pricingFields = [
      ["Purchase Price", pricing.price || pricing.purchase_price || ""],
      ["Down Payment %", pricing.down_payment_pct || ""],
      ["Loan Amount", pricing.loan_amount || ""],
      ["Interest Rate %", pricing.interest_rate || ""],
      ["Loan Term (Years)", pricing.term_years || ""],
      ["Amortization (Years)", pricing.amortization_years || ""],
      ["Closing Costs", pricing.closing_costs || ""],
      ["Assignment Fee", pricing.assignment_fee || ""],
      ["Improvements/CapEx", pricing.improvements || ""],
    ];

    pricingFields.forEach(([label, value]) => {
      template.push([
        cell(label, labelStyle),
        cell(value, inputStyle),
        ...Array(18).fill(cell(""))
      ]);
    });

    // Empty row
    template.push(Array(20).fill(cell("")));

    // INCOME SECTION
    template.push([
      cell("INCOME", sectionStyle),
      ...Array(19).fill(cell(""))
    ]);

    const incomeFields = [
      ["Gross Potential Rent", pnl.gross_potential_rent || pnl.potential_gross_income || ""],
      ["Other Income", pnl.other_income || ""],
      ["Vacancy Rate %", pnl.vacancy_rate || ""],
      ["Vacancy Loss", pnl.vacancy_loss || ""],
      ["Effective Gross Income", pnl.effective_gross_income || ""],
    ];

    incomeFields.forEach(([label, value]) => {
      template.push([
        cell(label, labelStyle),
        cell(value, inputStyle),
        ...Array(18).fill(cell(""))
      ]);
    });

    // Empty row
    template.push(Array(20).fill(cell("")));

    // EXPENSES SECTION
    template.push([
      cell("OPERATING EXPENSES", sectionStyle),
      ...Array(19).fill(cell(""))
    ]);

    const expenseFields = [
      ["Property Taxes", expenses.property_taxes || ""],
      ["Insurance", expenses.insurance || ""],
      ["Utilities", expenses.utilities || ""],
      ["Repairs & Maintenance", expenses.repairs_maintenance || ""],
      ["Property Management", expenses.property_management || ""],
      ["Landscaping", expenses.landscaping || ""],
      ["Pest Control", expenses.pest_control || ""],
      ["HOA Fees", expenses.hoa_fees || ""],
      ["Other Expenses", expenses.other || ""],
      ["Total Operating Expenses", expenses.total || ""],
    ];

    expenseFields.forEach(([label, value]) => {
      template.push([
        cell(label, labelStyle),
        cell(value, inputStyle),
        ...Array(18).fill(cell(""))
      ]);
    });

    // Empty row
    template.push(Array(20).fill(cell("")));

    // UNIT MIX SECTION
    if (unitMix.length > 0) {
      template.push([
        cell("UNIT MIX", sectionStyle),
        ...Array(19).fill(cell(""))
      ]);

      // Unit mix header
      template.push([
        cell("Unit Type", labelStyle),
        cell("# Units", labelStyle),
        cell("Sq Ft", labelStyle),
        cell("Current Rent", labelStyle),
        cell("Market Rent", labelStyle),
        ...Array(15).fill(cell(""))
      ]);

      unitMix.forEach(unit => {
        template.push([
          cell(unit.unit_type || "", inputStyle),
          cell(unit.units || "", inputStyle),
          cell(unit.unit_sf || "", inputStyle),
          cell(unit.rent_current || "", inputStyle),
          cell(unit.rent_market || unit.rent_current || "", inputStyle),
          ...Array(15).fill(cell(""))
        ]);
      });
    }

    return template;
  };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <div 
        id="luckysheet-container" 
        ref={containerRef}
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'relative',
          minHeight: '800px',
          zIndex: 1,
          pointerEvents: 'auto',
          overflow: 'hidden'
        }}
      />
    </div>
  );
};

export default LuckysheetWrapper;
