import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Strip EDS auto-button decoration from caption links (they are text links, not buttons).
 * @param {Element} body card body cell
 */
function unbutton(body) {
  body.querySelectorAll('.button-container').forEach((p) => p.classList.remove('button-container'));
  body.querySelectorAll('a.button').forEach((a) => a.classList.remove('button', 'primary', 'secondary'));
}

/**
 * Media cards: grid of tiles, each = thumbnail image (optionally linked) + caption link.
 * When the caption carries a link and the image does not, the caption link is stretched
 * over the whole card so the tile is clickable with a single focusable link.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const ul = document.createElement('ul');

  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);

    [...li.children].forEach((div) => {
      const pictures = div.querySelectorAll('picture');
      const isImage = pictures.length === 1 && div.textContent.trim() === '';
      div.className = isImage ? 'cards-media-card-image' : 'cards-media-card-body';
      if (!isImage && !div.textContent.trim() && !div.children.length) div.remove();
    });

    const body = li.querySelector('.cards-media-card-body');
    if (body) {
      unbutton(body);
      const caption = body.querySelector('a[href]');
      if (caption) caption.classList.add('cards-media-caption');
      const image = li.querySelector('.cards-media-card-image');
      const imageLinked = image && image.querySelector('a[href]');
      if (caption && !imageLinked) li.classList.add('cards-media-card-linked');
    }

    // a linked image is a duplicate of the caption link for assistive tech
    li.querySelectorAll('.cards-media-card-image a[href]').forEach((a) => {
      const captionLink = li.querySelector('.cards-media-caption');
      if (captionLink && captionLink.href === a.href) {
        a.setAttribute('tabindex', '-1');
        a.setAttribute('aria-hidden', 'true');
      }
    });

    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });

  block.replaceChildren(ul);
}
