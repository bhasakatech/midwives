import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  getMetadata,
  toClassName,
} from './aem.js';

// author-managed sheet mapping a page template to its fragments (columns: template, nav, footer)
const TEMPLATE_CONFIG_PATH = '/template-config.json';
let templateConfigPromise;

/**
 * Loads the template config sheet once per page view.
 * @returns {Promise<Object[]>} rows with lower-cased column names
 */
function getTemplateConfig() {
  if (!templateConfigPromise) {
    templateConfigPromise = fetch(TEMPLATE_CONFIG_PATH)
      .then((resp) => (resp.ok ? resp.json() : {}))
      .then(({ data = [] }) => data.map((row) => Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]),
      )))
      .catch(() => []);
  }
  return templateConfigPromise;
}

/**
 * Turns an authored page reference (path, AEM path or URL) into a fragment path.
 * @param {string} ref authored reference
 * @returns {string} fragment path without extension
 */
function toFragmentPath(ref) {
  return new URL(ref, window.location).pathname
    .replace(/^\/content\/midwives(?=\/)/, '')
    .replace(/\.(plain\.)?html$/, '');
}

/**
 * Resolves which fragment (e.g. nav, footer) the current page uses:
 * its template's row in the template config, otherwise the fallback.
 * @param {string} type fragment type, matches the config column
 * @param {string} fallback default fragment path
 * @returns {Promise<string>} fragment path without extension
 */
export async function getTemplateFragmentPath(type, fallback) {
  const template = toClassName(getMetadata('template'));
  if (template) {
    const rows = await getTemplateConfig();
    const ref = rows.find((row) => toClassName(row.template) === template)?.[type];
    if (ref) return toFragmentPath(ref);
  }
  return fallback;
}

/**
 * Fetches a fragment: /content{path} (local aem up) first, then {path} (EDS),
 * falling back to the default fragment when the requested one doesn't exist.
 * @param {string} path fragment path without extension
 * @param {string} fallback default fragment path
 * @returns {Promise<Response|null>} the ok response, or null
 */
export async function fetchFragmentWithFallback(path, fallback) {
  const fetchPath = async (p) => {
    let resp = await fetch(`/content${p}.plain.html`);
    if (!resp.ok) resp = await fetch(`${p}.plain.html`);
    return resp.ok ? resp : null;
  };
  const resp = await fetchPath(path);
  if (resp || path === fallback) return resp;
  return fetchPath(fallback);
}

/**
 * Gated articles (page metadata "gated: true") are only shown to visitors who
 * completed the sign-up form (cookie set by the embed-marketo "gated" block);
 * everyone else is sent to the sign-up page, as on the original site.
 * @returns {boolean} true when the visitor is being redirected
 */
function redirectIfGated() {
  if (getMetadata('gated') !== 'true') return false;
  if (document.cookie.split(';').some((c) => c.trim().startsWith('marketo_success='))) return false;
  if (window.location.hostname === 'localhost' || document.documentElement.classList.contains('adobe-ue-edit')) return false;
  const back = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/fr-fr/gated-content?ge_redirect=${encodeURIComponent(back)}`);
  return true;
}

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to?.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
export function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateButtons(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  if (redirectIfGated()) return;
  document.documentElement.lang = 'fr';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
