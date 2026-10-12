/**
 * Product intro columns: product image column | text column
 * (eyebrow, product name heading, subtitle, description, CTA link, note).
 * Authored as an xwalk columns block (1 row x 2 columns); any column/row count is tolerated.
 * @param {Element} block The block element
 */

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

function isImageOnly(col) {
  const pics = col.querySelectorAll('picture');
  return pics.length === 1 && col.textContent.trim() === '';
}

/**
 * Tags the parts of a text column so CSS can lay them out without
 * depending on a fixed element order.
 * @param {Element} col The text column
 */
function decorateTextCol(col) {
  const children = [...col.children];
  const firstHeadingIdx = children.findIndex((el) => el.matches(HEADING_SELECTOR));

  // paragraphs before the first heading act as an eyebrow
  if (firstHeadingIdx > 0) {
    children.slice(0, firstHeadingIdx)
      .filter((el) => el.tagName === 'P' && !el.querySelector('a'))
      .forEach((el) => el.classList.add('columns-product-eyebrow'));
  }

  // the first heading is the product name, the next one (if any) the subtitle
  const headings = children.filter((el) => el.matches(HEADING_SELECTOR));
  if (headings[0]) headings[0].classList.add('columns-product-title');
  if (headings[1]) headings[1].classList.add('columns-product-subtitle');

  // a paragraph containing only a link is the CTA; paragraphs after it are notes
  let ctaFound = false;
  children.forEach((el) => {
    if (el.tagName !== 'P' || el.classList.contains('columns-product-eyebrow')) return;
    const link = el.querySelector('a[href]');
    if (link && el.textContent.trim() === link.textContent.trim()) {
      el.classList.add('columns-product-cta');
      link.classList.add('columns-product-cta-link');
      ctaFound = true;
    } else if (ctaFound) {
      el.classList.add('columns-product-note');
    }
  });
}

export default function decorate(block) {
  const firstRow = block.firstElementChild;
  const cols = firstRow ? [...firstRow.children] : [];
  block.classList.add(`columns-product-${cols.length}-cols`);

  [...block.children].forEach((row) => {
    row.classList.add('columns-product-row');
    [...row.children].forEach((col) => {
      if (isImageOnly(col)) {
        col.classList.add('columns-product-img-col');
        const img = col.querySelector('img');
        // the product image is in the first section (LCP candidate)
        if (img) img.loading = 'eager';
      } else {
        col.classList.add('columns-product-text-col');
        decorateTextCol(col);
      }
    });
  });
}
