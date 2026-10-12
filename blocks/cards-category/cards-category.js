import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Category cards: title (heading) shown above an illustration, then description and a
 * "learn more" link. Authored per card as image cell + rich text cell; the heading is
 * visually moved above the image with CSS order so the authored DOM stays intact.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) {
        div.className = 'cards-category-card-image';
      } else {
        div.className = 'cards-category-card-body';
      }
    });

    const body = li.querySelector('.cards-category-card-body');
    if (body) {
      const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading) heading.classList.add('cards-category-title');
      const paras = [...body.children].filter((el) => el.tagName === 'P');
      const last = paras[paras.length - 1];
      if (last && last.querySelector('a') && last.textContent.trim() === last.querySelector('a').textContent.trim()) {
        last.classList.add('cards-category-link');
        last.classList.remove('button-container');
        last.querySelectorAll('a').forEach((a) => a.classList.remove('button', 'primary', 'secondary'));
      }
      paras.filter((p) => !p.classList.contains('cards-category-link'))
        .forEach((p) => p.classList.add('cards-category-desc'));
    }
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });
  block.replaceChildren(ul);
}
