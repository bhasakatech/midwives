const TYPE_LINK = 'a[href*="/fr-fr/article-type/"]';
const ALL_VALUE = 'all';
let idCounter = 0;

/**
 * Finds the first cards-article block following this block within the same section.
 * @param {Element} block The filter block
 * @returns {Element|null}
 */
function findCardsBlock(block) {
  const section = block.closest('.section');
  if (!section) return null;
  const start = block.closest('.filter-article-wrapper') || block;
  let el = start.nextElementSibling;
  while (el) {
    const cards = el.matches('.cards-article') ? el : el.querySelector('.cards-article');
    if (cards) return cards;
    el = el.nextElementSibling;
  }
  return null;
}

/**
 * Normalises a type link to a stable key (last path segment of its href).
 * @param {HTMLAnchorElement} a
 * @returns {string}
 */
function typeKey(a) {
  try {
    const { pathname } = new URL(a.getAttribute('href'), window.location.href);
    const segments = pathname.split('/'); // trailing slash yields an empty last segment
    return segments.reverse().find((s) => s) || '';
  } catch {
    return '';
  }
}

/**
 * Card items: decorated (ul > li) or, before cards-article has decorated, its raw rows.
 * @param {Element} cards
 * @returns {Element[]}
 */
function cardItems(cards) {
  const lis = cards.querySelectorAll(':scope > ul > li');
  return lis.length ? [...lis] : [...cards.querySelectorAll(':scope > div')];
}

/**
 * Hides (hidden attribute) every card whose type does not match; cards stay in the DOM.
 * @param {Element} cards
 * @param {string} value
 */
function applyFilter(cards, value) {
  cardItems(cards).forEach((item) => {
    if (!value || value === ALL_VALUE) {
      item.hidden = false;
      return;
    }
    const keys = [...item.querySelectorAll(TYPE_LINK)].map(typeKey);
    item.hidden = !keys.includes(value);
  });
}

/**
 * Article-type filter: label + select built from the type badges of the next cards-article block.
 * Authored: one cell — label paragraph, optional placeholder paragraph.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const paragraphs = [...block.querySelectorAll('p')]
    .map((p) => p.textContent.trim()).flatMap((t) => (t ? [t] : []));
  const fallback = block.textContent.trim();
  const labelText = paragraphs[0] || fallback || 'Filtrer les articles par';
  const placeholderText = paragraphs[1] || '';

  const cards = findCardsBlock(block);
  const types = new Map();
  if (cards) {
    cards.querySelectorAll(TYPE_LINK).forEach((a) => {
      const key = typeKey(a);
      const text = a.textContent.trim();
      if (key && text && !types.has(key)) types.set(key, text);
    });
  }

  if (!cards || !types.size) {
    block.replaceChildren();
    block.hidden = true;
    const wrapper = block.closest('.filter-article-wrapper');
    if (wrapper) wrapper.hidden = true;
    return;
  }

  idCounter += 1;
  const id = `filter-article-select-${idCounter}`;

  const label = document.createElement('label');
  label.className = 'filter-article-label';
  label.htmlFor = id;
  label.textContent = labelText;

  const select = document.createElement('select');
  select.className = 'filter-article-select';
  select.id = id;
  if (cards.id) select.setAttribute('aria-controls', cards.id);

  if (placeholderText) {
    const placeholder = new Option(placeholderText, '', true, true);
    placeholder.disabled = true;
    select.append(placeholder);
  }
  select.append(new Option('Tous', ALL_VALUE, !placeholderText, !placeholderText));
  types.forEach((text, key) => select.append(new Option(text, key)));

  select.addEventListener('change', () => applyFilter(cards, select.value));

  // cards-article decorates after this block (sections load blocks in order) and rebuilds its
  // children, so re-apply the active filter whenever its item list changes.
  const observer = new MutationObserver(() => {
    if (select.value && select.value !== ALL_VALUE) applyFilter(cards, select.value);
  });
  observer.observe(cards, { childList: true });

  const control = document.createElement('div');
  control.className = 'filter-article-control';
  control.append(select);

  block.replaceChildren(label, control);
}
