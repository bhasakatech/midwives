import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Category banner: text column (h1 + intro paragraphs) | decorative illustration.
 * Authored rows (xwalk hero model): image row (alt folded in), rich text row.
 * Either row may be missing; extra empty rows are ignored.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  let mediaCell = null;
  let contentCell = null;

  [...block.children].forEach((row) => {
    const cell = row.firstElementChild || row;
    const hasText = cell.textContent.trim() !== '';
    const isImageOnly = !hasText && cell.querySelector('picture');
    if (isImageOnly && !mediaCell) mediaCell = cell;
    else if (hasText && !contentCell) contentCell = cell;
  });

  const content = document.createElement('div');
  content.className = 'hero-category-content';
  if (contentCell) {
    moveInstrumentation(contentCell, content);
    while (contentCell.firstChild) content.append(contentCell.firstChild);
    // drop spacer paragraphs (source uses <p>&nbsp;</p> between intro paragraphs)
    content.querySelectorAll(':scope > p').forEach((p) => {
      if (!p.textContent.trim() && !p.querySelector('picture, img')) p.remove(); // trim() strips &nbsp;
    });
  }

  const media = document.createElement('div');
  media.className = 'hero-category-media';
  if (mediaCell) {
    moveInstrumentation(mediaCell, media);
    const img = mediaCell.querySelector('picture img');
    if (img) {
      const optimized = createOptimizedPicture(img.src, img.alt, true, [
        { media: '(min-width: 900px)', width: '750' },
        { width: '600' },
      ]);
      moveInstrumentation(img, optimized.querySelector('img'));
      // decorative illustration: empty alt is intentional
      if (!img.alt) optimized.querySelector('img').setAttribute('alt', '');
      media.append(optimized);
    }
  }

  block.replaceChildren(content);
  if (media.firstChild) block.append(media);
  else block.classList.add('hero-category-no-media');
}
