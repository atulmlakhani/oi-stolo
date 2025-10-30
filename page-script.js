; (() => {
    if (window.__OI_HIGHLIGHTER_OBSERVER__) { try { window.__OI_HIGHLIGHTER_OBSERVER__.disconnect(); } catch { } }
    if (window.__OI_HIGHLIGHTER_INTERVAL__) { try { clearInterval(window.__OI_HIGHLIGHTER_INTERVAL__); } catch { } }

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
        #light-mode-tabulator{height: auto !important}
      `;
            document.head.appendChild(style);
        }

        const getTable = () => root.querySelector('.tabulator-table');
        const norm = s => (s || '').trim().toUpperCase();
        const isSC = s => ['SC', 'SU'].includes(norm(s));
        const num = s => { const v = parseFloat((s || '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(v) ? v : NaN; };
        const cellText = (row, field, which = 'first') => {
            const cells = row.querySelectorAll(`.tabulator-cell[tabulator-field="${field}"]`);
            if (!cells.length) return '';
            const el = which === 'last' ? cells[cells.length - 1] : cells[0];
            return el.textContent.trim();
        };
        const cellEl = (row, field, which = 'first') => {
            const cells = row.querySelectorAll(`.tabulator-cell[tabulator-field="${field}"]`);
            if (!cells.length) return null;
            return which === 'last' ? cells[cells.length - 1] : cells[0];
        };
        const pad2 = s => (String(s).length === 1 ? '0' + s : String(s));
        const normTime = t => {
            const m = (t || '').match(/^(\d{1,2}):(\d{2})$/);
            return m ? `${pad2(m[1])}:${m[2]}` : (t || '').trim();
        };

        const apply = async () => {
            const table = getTable();
            if (!table) return;
            const rows = table.querySelectorAll('.tabulator-row');

            table.querySelectorAll('.oi-cell-green-dark').forEach(el => el.classList.remove('oi-cell-green-dark'));
            table.querySelectorAll('.oi-cell-red-dark').forEach(el => el.classList.remove('oi-cell-red-dark'));

            rows.forEach(row => {
                row.classList.remove('oi-green', 'oi-red', 'oi-yellow', 'oi-hidden');

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

            let timeRow = null;
            for (const r of rows) {
                const t = normTime(cellText(r, 'time', 'first')) || normTime(cellText(r, 'time', 'last'));
                if (t === '09:15') { timeRow = r; break; }
            }

            if (!timeRow) {
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
                                if (t === '09:15') { timeRow = r; break; }
                            }
                        }
                    }
                } catch { }
            }

            if (timeRow) {
                const cCh = num(cellText(timeRow, 'call.total_oi'));
                const pCh = num(cellText(timeRow, 'put.total_oi'));
                if (Number.isFinite(cCh) && Number.isFinite(pCh)) {
                    if (cCh < pCh) {
                        const cOI = cellEl(timeRow, 'call.oi'); if (cOI) cOI.classList.add('oi-cell-green-dark');
                    } else {
                        const pOI = cellEl(timeRow, 'put.oi'); if (pOI) pOI.classList.add('oi-cell-red-dark');
                    }
                }
            }

            table.querySelectorAll('.tabulator-row').forEach(row => {
                const colored = row.classList.contains('oi-green') || row.classList.contains('oi-red') || row.classList.contains('oi-yellow');
                const cellColored = row.querySelector('.oi-cell-green-dark, .oi-cell-red-dark');
                if (!colored && !cellColored) row.classList.add('oi-hidden');
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