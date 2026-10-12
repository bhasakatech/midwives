import { decorateIcons } from '../../scripts/aem.js';

/**
 * Converts a paragraph holding only an icon token (e.g. ":laptop:") into an icon span.
 * The aem.live pipeline usually does this, but raw/plain content may still carry the token.
 * @param {Element} col The column element
 */
function convertIconTokens(col) {
  col.querySelectorAll('p').forEach((p) => {
    const match = p.textContent.trim().match(/^:([a-z0-9-]+):$/);
    if (!match || p.children.length) return;
    const span = document.createElement('span');
    span.className = `icon icon-${match[1]}`;
    p.replaceChildren(span);
  });
  decorateIcons(col);
}

/**
 * Action columns: centered icon-over-link items (e.g. demo request, brochure download).
 * Authored as an xwalk columns block (1 row x N columns). Each column holds an
 * optional icon token (e.g. :laptop:) and a link; the icon is moved inside the link
 * so the whole item is one click target.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const firstRow = block.firstElementChild;
  const cols = firstRow ? [...firstRow.children] : [];
  block.classList.add(`columns-actions-${cols.length}-cols`);

  [...block.children].forEach((row) => {
    row.classList.add('columns-actions-row');
    [...row.children].forEach((col) => {
      col.classList.add('columns-actions-item');

      // drop empty columns (e.g. brochure link removed by the importer)
      if (col.textContent.trim() === '' && !col.querySelector('.icon, picture')) {
        col.classList.add('columns-actions-empty');
        return;
      }

      convertIconTokens(col);
      const link = col.querySelector('a[href]');
      const icon = col.querySelector('span.icon, picture');
      if (link) {
        link.classList.add('columns-actions-link');
        // links are actions, never auto-buttonized
        link.classList.remove('button', 'primary', 'secondary', 'accent');
        const wrapper = link.closest('.button-wrapper');
        if (wrapper) wrapper.classList.remove('button-wrapper');
      }

      if (icon && link && !link.contains(icon)) {
        const iconParent = icon.parentElement;
        const iconWrap = document.createElement('span');
        iconWrap.className = 'columns-actions-icon';
        iconWrap.setAttribute('aria-hidden', 'true');
        iconWrap.append(icon);
        link.prepend(iconWrap);
        // remove the now-empty paragraph that held the icon
        if (iconParent && iconParent !== col && iconParent.textContent.trim() === ''
          && !iconParent.querySelector('img, picture, span.icon')) {
          iconParent.remove();
        }
      } else if (icon) {
        icon.closest('p')?.classList.add('columns-actions-icon');
      }
    });
  });
}
