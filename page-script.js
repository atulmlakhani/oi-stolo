;(() => {
    if (window.__OI_HIGHLIGHTER_OBSERVER__) { try { window.__OI_HIGHLIGHTER_OBSERVER__.disconnect(); } catch {} }
    if (window.__OI_HIGHLIGHTER_INTERVAL__) { try { clearInterval(window.__OI_HIGHLIGHTER_INTERVAL__); } catch {} }
  
    const waitFor = (sel, { root = document, timeout = 15000, interval = 250 } = {}) => new Promise(r => {
      const t0 = Date.now(), tick = () => {
        const el = root.querySelector(sel);
        if (el) return r(el);
        if (Date.now() - t0 >= timeout) return r(null);
        setTimeout(tick, interval);
      };
      tick();
    });
  
    const findRoot = async () => {
      let el = document.querySelector('#light-mode-tabulator') || document.querySelector('.tabulator');
      if (!el) el = await waitFor('#light-mode-tabulator, .tabulator', { timeout: 15000 });
      return el;
    };
  
    const start = async () => {
      const root = await findRoot();
      if (!root) return;
  
      if (!document.getElementById('oi-row-color-styles')) {
        const style = document.createElement('style');
        style.id = 'oi-row-color-styles';
        style.textContent = `
          .oi-green{background:rgba(76,175,80,.18)!important}
          .oi-red{background:rgba(244,67,54,.18)!important}
          .oi-yellow{background:rgba(255,193,7,.22)!important}
          .oi-cell-green-dark{background:#2e7d32!important;color:#fff!important;font-weight:700!important}
          .oi-cell-red-dark{background:#b71c1c!important;color:#fff!important;font-weight:700!important}
          .oi-hidden{display:none!important}
          #light-mode-tabulator{height:auto!important}
          /* New visual cues */
        //   .oi-max-price-row{box-shadow: inset 0 0 0 2px #1b5e20 !important}
        //   .oi-min-price-row{box-shadow: inset 0 0 0 2px #bf360c !important}
          .oi-current-time-row{outline: 2px dashed #1976d2 !important}
          .oi-price-badge{font-weight:700;padding:0 6px}
        //   .oi-price-badge-max{background:#1b5e20!important;color:#fff!important}
        //   .oi-price-badge-min{background:#bf360c!important;color:#fff!important}
        `;
        document.head.appendChild(style);
      }
  
      const getTable = () => root.querySelector('.tabulator-table');
      const norm = s => (s || '').trim().toUpperCase();
      const isSC = s => ['SC','SU'].includes(norm(s));
      const num = s => { const v = parseFloat((s || '').replace(/[^0-9.\-]/g,'')); return Number.isFinite(v) ? v : NaN; };
      const cellText = (row, field, which='first') => {
        const cells = row.querySelectorAll(`.tabulator-cell[tabulator-field="${field}"]`);
        if (!cells.length) return '';
        const el = which === 'last' ? cells[cells.length-1] : cells[0];
        return el.textContent.trim();
      };
      const cellEl = (row, field, which='first') => {
        const cells = row.querySelectorAll(`.tabulator-cell[tabulator-field="${field}"]`);
        if (!cells.length) return null;
        return which === 'last' ? cells[cells.length-1] : cells[0];
      };
      const pad2 = s => (String(s).length === 1 ? '0'+s : String(s));
      const normTime = t => {
        const m = (t || '').match(/^(\d{1,2}):(\d{2})$/);
        return m ? `${pad2(m[1])}:${m[2]}` : (t || '').trim();
      };
      const timeToMinutes = t => {
        const m = (t || '').match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return -1;
        const h = parseInt(m[1],10), mi = parseInt(m[2],10);
        return h*60 + mi;
      };
  
      const apply = async () => {
        const table = getTable();
        if (!table) return;
        const rows = table.querySelectorAll('.tabulator-row');
  
        // Clear old dynamic classes
        table.querySelectorAll('.oi-cell-green-dark').forEach(el => el.classList.remove('oi-cell-green-dark'));
        table.querySelectorAll('.oi-cell-red-dark').forEach(el => el.classList.remove('oi-cell-red-dark'));
        table.querySelectorAll('.oi-max-price-row,.oi-min-price-row,.oi-current-time-row').forEach(el => {
          el.classList.remove('oi-max-price-row','oi-min-price-row','oi-current-time-row');
        });
        table.querySelectorAll('.oi-price-badge, .oi-price-badge-max, .oi-price-badge-min').forEach(el => {
          el.classList.remove('oi-price-badge','oi-price-badge-max','oi-price-badge-min');
        });
  
        rows.forEach(row => {
          row.classList.remove('oi-green','oi-red','oi-yellow','oi-hidden');
          const callBU = norm(cellText(row, 'call.build_up'));
          const putBU = norm(cellText(row, 'put.build_up'));
          const hasLU = callBU === 'LU' || putBU === 'LU';
          const hasSCorSU = isSC(callBU) || isSC(putBU);
  
          if (hasLU && hasSCorSU) {
            const luSide = callBU === 'LU' ? 'call' : (putBU === 'LU' ? 'put' : null);
            const scSide = isSC(callBU) ? 'call' : (isSC(putBU) ? 'put' : null);
            if (luSide && scSide) {
              const luChange = num(cellText(row, `${luSide}.total_oi`));
              const scChange = num(cellText(row, `${scSide}.total_oi`));
              if (Number.isFinite(luChange) && Number.isFinite(scChange)) {
                if (luChange < scChange) {
                  if (luSide === 'call') {
                    row.classList.add('oi-green');
                    const cOI = cellEl(row, 'call.oi'); if (cOI) cOI.classList.add('oi-cell-green-dark');
                  } else {
                    row.classList.add('oi-red');
                    const pOI = cellEl(row, 'put.oi'); if (pOI) pOI.classList.add('oi-cell-red-dark');
                  }
                } else {
                  row.classList.add('oi-yellow');
                }
              }
            }
          }
        });
  
        // Existing 09:15 anchor logic preserved
        let timeRow0915 = null;
        for (const r of rows) {
          const t = normTime(cellText(r, 'time', 'first')) || normTime(cellText(r, 'time', 'last'));
          if (t === '09:15') { timeRow0915 = r; break; }
        }
        if (!timeRow0915) {
          const inst = root.tabulator || root._tabulator || null;
          try {
            const rowsAPI = inst?.getRows?.();
            if (rowsAPI?.length) {
              const trg = rowsAPI.find(rr => normTime(rr.getData?.().time) === '09:15');
              if (trg?.scrollTo) {
                await trg.scrollTo();
                await new Promise(r => setTimeout(r, 200));
                const rerows = getTable()?.querySelectorAll('.tabulator-row') || [];
                for (const r of rerows) {
                  const t = normTime(cellText(r, 'time', 'first')) || normTime(cellText(r, 'time', 'last'));
                  if (t === '09:15') { timeRow0915 = r; break; }
                }
              }
            }
          } catch {}
        }
        if (timeRow0915) {
          const cCh = num(cellText(timeRow0915, 'call.total_oi'));
          const pCh = num(cellText(timeRow0915, 'put.total_oi'));
          if (Number.isFinite(cCh) && Number.isFinite(pCh)) {
            if (cCh < pCh) {
              const cOI = cellEl(timeRow0915, 'call.oi'); if (cOI) cOI.classList.add('oi-cell-green-dark');
            } else {
              const pOI = cellEl(timeRow0915, 'put.oi'); if (pOI) pOI.classList.add('oi-cell-red-dark');
            }
          }
        }
  
        // ===== NEW: Highest/Lowest Price rows (Call & Put) =====
        const priceScan = (side) => {
          let max = -Infinity, min = Infinity, maxRow = null, minRow = null, maxCell = null, minCell = null;
          rows.forEach(r => {
            const v = num(cellText(r, `${side}.price`));
            if (!Number.isFinite(v)) return;
            if (v > max) { max = v; maxRow = r; maxCell = cellEl(r, `${side}.price`); }
            if (v < min) { min = v; minRow = r; minCell = cellEl(r, `${side}.price`); }
          });
          if (maxRow) {
            maxRow.classList.add('oi-max-price-row');
            if (maxCell) { maxCell.classList.add('oi-price-badge','oi-price-badge-max'); }
          }
          if (minRow) {
            minRow.classList.add('oi-min-price-row');
            if (minCell) { minCell.classList.add('oi-price-badge','oi-price-badge-min'); }
          }
        };
        priceScan('call');
        priceScan('put');
  
        // ===== NEW: Current/latest time row =====
        let latestRow = null, latestMin = -1;
        rows.forEach(r => {
          const t = normTime(cellText(r, 'time', 'first')) || normTime(cellText(r, 'time', 'last'));
          const mins = timeToMinutes(t);
          if (mins > latestMin) { latestMin = mins; latestRow = r; }
        });
        if (latestRow) latestRow.classList.add('oi-current-time-row');
  
        // Final visibility filter: keep colored OR special rows visible
        table.querySelectorAll('.tabulator-row').forEach(row => {
          const colored = row.classList.contains('oi-green') || row.classList.contains('oi-red') || row.classList.contains('oi-yellow');
          const cellColored = row.querySelector('.oi-cell-green-dark, .oi-cell-red-dark');
          const special = row.classList.contains('oi-max-price-row') ||
                          row.classList.contains('oi-min-price-row') ||
                          row.classList.contains('oi-current-time-row') ||
                          (row === timeRow0915);
          if (!colored && !cellColored && !special) row.classList.add('oi-hidden');
        });
      };
  
      await apply();
      const obs = new MutationObserver(() => apply());
      obs.observe(root, { childList: true, subtree: true });
      window.__OI_HIGHLIGHTER_OBSERVER__ = obs;
      window.__OI_HIGHLIGHTER_INTERVAL__ = setInterval(apply, 10000);
    };
  
    start();
  })();
  