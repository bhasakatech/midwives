/**
 * Editorial aside columns: text column (heading + paragraphs, ~2/3) | small aside image (~1/3).
 * Authored as an xwalk columns block (rows x columns). Extra or missing columns are tolerated:
 * every column is tagged as image-only or text, and a row whose image column comes first
 * gets a modifier so the wide track follows the text.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const firstRow = block.firstElementChild;
  const cols = firstRow ? [...firstRow.children] : [];
  block.classList.add(`columns-aside-${cols.length}-cols`);

  [...block.children].forEach((row) => {
    row.classList.add('columns-aside-row');
    const rowCols = [...row.children];
    rowCols.forEach((col) => {
      const pictures = col.querySelectorAll('picture');
      const isImageOnly = pictures.length === 1 && col.textContent.trim() === '';
      col.classList.add(isImageOnly ? 'columns-aside-img-col' : 'columns-aside-text-col');
    });
    if (rowCols.length > 1 && rowCols[0].classList.contains('columns-aside-img-col')) {
      row.classList.add('columns-aside-row-img-first');
    }
  });
}
