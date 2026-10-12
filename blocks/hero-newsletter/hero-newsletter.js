import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Tag panel parts: eyebrow (short leading paragraph before the main text),
 * CTA paragraph, and trailing legal small print after the CTA.
 * @param {Element} panel content panel
 */
function decoratePanel(panel) {
  const children = [...panel.children];
  const ctaIndex = children.findIndex((el) => el.querySelector('a')
    && el.textContent.trim() === el.querySelector('a').textContent.trim());

  const first = children[0];
  if (first && first.tagName === 'P' && children.length > 1 && !first.querySelector('a')
    && !first.querySelector('strong') && first.textContent.trim().length <= 40) {
    first.classList.add('hero-newsletter-eyebrow');
  }
  if (ctaIndex > -1) {
    children[ctaIndex].classList.add('hero-newsletter-cta');
    children.slice(ctaIndex + 1)
      .filter((el) => el.tagName === 'P')
      .forEach((el) => el.classList.add('hero-newsletter-legal'));
  }
  // main message: remaining content between eyebrow and CTA (imported as <p><strong>…</strong></p>)
  children.slice(0, ctaIndex > -1 ? ctaIndex : children.length)
    .filter((el) => !el.classList.contains('hero-newsletter-eyebrow'))
    .forEach((el) => el.classList.add('hero-newsletter-text'));
}

/**
 * Newsletter hero: full-bleed background photo with a right-aligned content panel.
 * Authored rows (xwalk hero model): image row (alt folded in), rich text row.
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

  const background = document.createElement('div');
  background.className = 'hero-newsletter-background';
  if (mediaCell) {
    moveInstrumentation(mediaCell, background);
    const img = mediaCell.querySelector('img');
    const optimized = createOptimizedPicture(img.src, img.alt, false, [
      { media: '(min-width: 900px)', width: '2000' },
      { width: '750' },
    ]);
    moveInstrumentation(img, optimized.querySelector('img'));
    background.append(optimized);
  }

  const inner = document.createElement('div');
  inner.className = 'hero-newsletter-inner';
  const panel = document.createElement('div');
  panel.className = 'hero-newsletter-content';
  if (contentCell) {
    moveInstrumentation(contentCell, panel);
    while (contentCell.firstChild) panel.append(contentCell.firstChild);
    decoratePanel(panel);
  }
  inner.append(panel);

  block.replaceChildren();
  if (mediaCell) block.append(background);
  else block.classList.add('hero-newsletter-no-media');
  block.append(inner);
}
