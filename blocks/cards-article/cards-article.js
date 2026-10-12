import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const HEADING = 'h1, h2, h3, h4, h5, h6';

/**
 * Tag the parts of an article teaser body:
 * categories paragraph (before title) | title | view link | meta (date + type link).
 * A card whose body is only a heading + CTA (no other paragraphs) is the promo tile.
 * @param {Element} li card element
 * @param {Element} body card body cell
 */
const isLinkOnly = (el) => {
  const links = el.querySelectorAll('a');
  return links.length === 1 && el.textContent.trim() === links[0].textContent.trim();
};

function decorateBody(li, body) {
  const children = [...body.children];
  const heading = body.querySelector(HEADING);
  const paragraphs = children.filter((el) => el.tagName === 'P');
  const headingIndex = heading ? children.indexOf(heading) : -1;

  // Imported promo tile: unlinked heading first, then at most one CTA paragraph.
  // Teasers always carry a linked title and/or categories before it and a meta line after.
  const isPromo = heading && !heading.querySelector('a') && headingIndex === 0
    && paragraphs.length <= 1 && paragraphs.every(isLinkOnly);
  if (isPromo) {
    li.classList.add('cards-article-promo');
    paragraphs.forEach((p) => p.classList.add('cards-article-cta'));
    return;
  }
  li.classList.add('cards-article-teaser');

  if (heading) heading.classList.add('cards-article-title');

  children.forEach((el, i) => {
    if (el.tagName !== 'P') return;
    if (headingIndex > -1 && i < headingIndex) {
      el.classList.add('cards-article-categories');
      // inline category links are text links, never buttons
      el.querySelectorAll('a.button').forEach((a) => a.classList.remove('button'));
      el.classList.remove('button-container');
    }
  });

  const after = paragraphs.filter((p) => headingIndex === -1 || children.indexOf(p) > headingIndex);
  // view link = link-only paragraph; meta = "date <a>type</a>" (text + link), else last paragraph
  const view = after.find(isLinkOnly);
  const meta = after.find((p) => p !== view && p.querySelector('a') && !isLinkOnly(p))
    || (after.length > 1 && after[after.length - 1] !== view ? after[after.length - 1] : null);

  if (view) {
    view.classList.add('cards-article-link');
    view.classList.remove('button-container');
    view.querySelectorAll('a').forEach((a) => a.classList.remove('button', 'primary', 'secondary'));
  }
  if (meta) {
    meta.classList.add('cards-article-meta');
    meta.classList.remove('button-container');
    // wrap the leading date text so it is its own flex item next to the type link
    const nodes = [...meta.childNodes];
    const firstEl = nodes.findIndex((n) => n.nodeType === Node.ELEMENT_NODE);
    const leading = nodes.slice(0, firstEl === -1 ? nodes.length : firstEl)
      .filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    if (leading.length) {
      const date = document.createElement('span');
      date.className = 'cards-article-date';
      date.textContent = leading.map((n) => n.textContent.trim()).join(' ');
      leading.forEach((n) => n.remove());
      meta.prepend(date);
    }
    const typeLink = meta.querySelector('a');
    if (typeLink) {
      typeLink.classList.remove('button', 'primary', 'secondary');
      typeLink.classList.add('cards-article-type');
    }
  }
}

/**
 * Article cards: grid of teasers (image, categories, title, view link, date + type badge),
 * with an optional promo tile (icon + heading + CTA).
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
        div.className = 'cards-article-card-image';
      } else {
        div.className = 'cards-article-card-body';
      }
    });
    const body = li.querySelector('.cards-article-card-body');
    if (body) decorateBody(li, body);
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });
  block.replaceChildren(ul);
}
