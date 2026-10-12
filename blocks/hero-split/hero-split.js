import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Split hero: text column (wordmark, heading, description, CTA) | photo column.
 * Authored rows (xwalk hero model): image row (alt folded in), rich text row.
 * Either row may be missing; extra empty rows are ignored.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  let mediaCell = null;
  let contentCell = null;

  [...block.children].forEach((row) => {
    const cell = row.firstElementChild || row;
    const isText = cell.textContent.trim() !== '';
    const isImageOnly = !isText && cell.querySelectorAll('picture').length === 1;
    if (isImageOnly && !mediaCell) mediaCell = cell;
    else if (isText && !contentCell) contentCell = cell;
  });

  const content = document.createElement('div');
  content.className = 'hero-split-content';
  if (contentCell) {
    moveInstrumentation(contentCell, content);
    while (contentCell.firstChild) content.append(contentCell.firstChild);
    // imported shape: <p><picture/></p> (wordmark) <h1/> <p>description</p> <p><a/></p>
    const children = [...content.children];
    const headingIndex = children.findIndex((el) => /^H[1-6]$/.test(el.tagName));
    children.forEach((el, i) => {
      const isImageOnly = el.querySelector('picture') && el.textContent.trim() === '';
      const link = el.tagName === 'P' ? el.querySelector('a') : null;
      if (isImageOnly && (headingIndex === -1 || i < headingIndex)) {
        // leading inline image (brand wordmark) before the heading
        el.classList.add('hero-split-logo');
      } else if (link && el.textContent.trim() === link.textContent.trim()) {
        el.classList.add('hero-split-cta');
      }
    });
  }

  const media = document.createElement('div');
  media.className = 'hero-split-media';
  if (mediaCell) {
    moveInstrumentation(mediaCell, media);
    const pic = mediaCell.querySelector('picture');
    const img = pic.querySelector('img');
    const optimized = createOptimizedPicture(img.src, img.alt, true, [
      { media: '(min-width: 900px)', width: '1200' },
      { width: '750' },
    ]);
    moveInstrumentation(img, optimized.querySelector('img'));
    media.append(optimized);
  }

  block.replaceChildren(content);
  if (mediaCell) block.append(media);
  else block.classList.add('hero-split-no-media');
}
