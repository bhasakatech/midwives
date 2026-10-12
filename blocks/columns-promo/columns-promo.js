/**
 * Promo columns: image column | text column (heading + CTA).
 * Authored as an xwalk columns block (rows x columns); any column count is tolerated.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const firstRow = block.firstElementChild;
  const cols = firstRow ? [...firstRow.children] : [];
  block.classList.add(`columns-promo-${cols.length}-cols`);

  [...block.children].forEach((row) => {
    row.classList.add('columns-promo-row');
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      const isImageOnly = pic && col.textContent.trim() === ''
        && col.querySelectorAll('picture').length === 1;
      col.classList.add(isImageOnly ? 'columns-promo-img-col' : 'columns-promo-text-col');
    });
  });
}
