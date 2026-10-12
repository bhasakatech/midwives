/**
 * Fetches the footer fragment. Metadata-independent dual fetch:
 * /content/footer.plain.html (local aem up) first, then /footer.plain.html (DA/EDS).
 * Relative image paths are resolved against the fragment URL.
 * @returns {Promise<Element|null>} container holding the fragment sections
 */
async function fetchFooterFragment() {
  // metadata-independent: /content first (localhost), then root (DA/EDS prod)
  let resp = await fetch('/content/footer.plain.html');
  if (!resp.ok) resp = await fetch('/footer.plain.html');
  if (!resp.ok) return null;

  const container = document.createElement('div');
  container.innerHTML = await resp.text();
  container.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (src && !/^(https?:|data:|\/)/.test(src)) {
      img.src = new URL(src, resp.url).href;
    }
  });
  return container;
}

/**
 * Returns true when the element only contains a single link wrapping an image.
 * @param {Element} el element to inspect
 * @returns {boolean}
 */
function isImageLink(el) {
  const link = el.querySelector(':scope > a');
  return !!link && el.children.length === 1 && !!link.querySelector('img')
    && link.textContent.trim() === '';
}

/**
 * Adds classes to a fragment section based on the kind of content it holds.
 * @param {Element} section top-level section of the fragment
 */
function decorateSection(section) {
  section.classList.add('footer-section');
  if (section.querySelector('ul, ol')) {
    section.classList.add('footer-section-menu');
  } else if (section.querySelector('a')) {
    section.classList.add('footer-section-links');
  } else {
    section.classList.add('footer-section-text');
  }

  section.querySelectorAll(':scope > ul, :scope > ol').forEach((list) => list.classList.add('footer-menu'));
  section.querySelectorAll(':scope > p').forEach((p) => {
    if (isImageLink(p)) p.classList.add('footer-logo');
  });
}

/**
 * Opens the consent-manager preference center when one is loaded on the page.
 * Supports the Evidon site notice (window.evidon.notice.showOptions).
 * @returns {boolean} true if a preference center was opened
 */
function openConsentPreferences() {
  const showOptions = window.evidon?.notice?.showOptions;
  if (typeof showOptions !== 'function') return false;
  showOptions.call(window.evidon.notice);
  return true;
}

/**
 * Links authored with href="#" are consent-preference triggers: they never
 * navigate and open the consent manager's preference center if it is present.
 * @param {Element} root footer root
 */
function decorateConsentLinks(root) {
  root.querySelectorAll('a[href="#"]').forEach((link) => {
    link.setAttribute('role', 'button');
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openConsentPreferences();
    });
  });
}

/**
 * Hardens links that open in a new tab.
 * @param {Element} root footer root
 */
function decorateExternalLinks(root) {
  root.querySelectorAll('a[target="_blank"]').forEach((link) => {
    link.rel = 'noopener noreferrer';
  });
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const fragment = await fetchFooterFragment();
  block.textContent = '';
  if (!fragment) return;

  const inner = document.createElement('div');
  inner.className = 'footer-inner';
  [...fragment.children].forEach((section) => {
    decorateSection(section);
    inner.append(section);
  });

  decorateConsentLinks(inner);
  decorateExternalLinks(inner);
  block.append(inner);
}
