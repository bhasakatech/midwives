/*
 * Table Block
 * Recreates a semantic data table from authored rows.
 * The first authored row is the column header.
 * https://www.aem.live/developer/block-collection/table
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

function scrollRegionLabel() {
  const lang = (document.documentElement.lang || '').toLowerCase();
  return lang.startsWith('fr') ? 'Tableau (défilement horizontal)' : 'Table (scrolls horizontally)';
}

/**
 * Loads and decorates the table block.
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const rows = [...block.children].filter((row) => row.children.length);
  if (!rows.length) return;

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  const hasHeader = !block.classList.contains('no-header');
  let columns = 0;

  rows.forEach((row, i) => {
    const isHeader = hasHeader && i === 0;
    const tr = document.createElement('tr');
    moveInstrumentation(row, tr);

    // imported rows may lead with their item component id (table-col-N); AEM consumes it,
    // but plain-HTML previews still contain it
    const cells = [...row.children].filter((cell, ci) => !(ci === 0 && /^table-col-\d+$/.test(cell.textContent.trim())));
    columns = Math.max(columns, cells.length);
    cells.forEach((cell) => {
      const el = document.createElement(isHeader ? 'th' : 'td');
      if (isHeader) el.setAttribute('scope', 'col');
      moveInstrumentation(cell, el);
      // unwrap a single paragraph so cells keep compact table rhythm
      const only = cell.children.length === 1 ? cell.firstElementChild : null;
      if (only && only.tagName === 'P' && cell.textContent.trim() === only.textContent.trim()) {
        el.innerHTML = only.innerHTML;
      } else {
        el.innerHTML = cell.innerHTML;
      }
      tr.append(el);
    });

    (isHeader ? thead : tbody).append(tr);
  });

  if (thead.children.length) table.append(thead);
  table.append(tbody);
  table.style.setProperty('--table-columns', columns);

  const scroller = document.createElement('div');
  scroller.className = 'table-scroll';
  scroller.setAttribute('role', 'region');
  scroller.setAttribute('tabindex', '0');
  scroller.setAttribute('aria-label', scrollRegionLabel());
  scroller.append(table);

  block.replaceChildren(scroller);
}
