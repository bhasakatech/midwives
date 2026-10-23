import { getTemplateFragmentPath, fetchFragmentWithFallback } from '../../scripts/scripts.js';

// media query match that indicates desktop width (source desktop header starts at 1200px)
const isDesktop = window.matchMedia('(min-width: 1200px)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// source mobile header uses jQuery slideToggle: 400ms, "swing" easing
const SLIDE_DURATION = 400;
const SLIDE_EASING = 'cubic-bezier(0.37, 0, 0.63, 1)';

const DEFAULT_NAV = '/nav';

/**
 * Fetches the nav fragment for the current page's template (template config sheet),
 * falling back to the default nav.
 * Relative image paths are resolved against the fragment URL.
 * @returns {Promise<Element|null>} container holding the fragment sections
 */
async function fetchNavFragment() {
  const navPath = await getTemplateFragmentPath('nav', DEFAULT_NAV);
  const resp = await fetchFragmentWithFallback(navPath, DEFAULT_NAV);
  if (!resp) return null;

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
 * Shows / hides an element with a vertical slide (height animation).
 * The `is-expanded` class controls the final (CSS) state.
 * @param {Element} el element to slide
 * @param {boolean} open desired state
 * @param {boolean} [animate] animate the change (mobile only)
 */
function slide(el, open, animate = true) {
  if (!el) return;
  el.style.overflow = '';
  el.getAnimations().forEach((a) => a.cancel());
  const wasOpen = el.classList.contains('is-expanded');
  if (open) el.classList.add('is-expanded');
  if (!animate || reducedMotion.matches || wasOpen === open) {
    el.classList.toggle('is-expanded', open);
    return;
  }
  // like jQuery slideToggle: animate height and vertical padding together
  const cs = getComputedStyle(el);
  const full = { height: cs.height, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom };
  const none = { height: '0px', paddingTop: '0px', paddingBottom: '0px' };
  const frames = open ? [none, full] : [full, none];
  const anim = el.animate(frames, { duration: SLIDE_DURATION, easing: SLIDE_EASING });
  el.style.overflow = 'hidden';
  anim.onfinish = () => {
    el.style.overflow = '';
    if (!open) el.classList.remove('is-expanded');
  };
}

/**
 * Opens or closes one dropdown / accordion item.
 * @param {Element} item the .nav-drop list item
 * @param {boolean} open desired state
 */
function setDropdown(item, open) {
  item.classList.toggle('is-open', open);
  const toggle = item.querySelector(':scope > .nav-drop-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  const subList = item.querySelector(':scope > .nav-sub-menu');
  if (!isDesktop.matches) slide(subList, open);
  else if (subList) subList.classList.remove('is-expanded');
}

/**
 * Collapses every open dropdown in the nav sections.
 * @param {Element} navSections the sections container
 * @param {Element} [except] a list item to leave untouched
 */
function closeAllDropdowns(navSections, except = null) {
  if (!navSections) return;
  navSections.querySelectorAll('.nav-drop').forEach((item) => {
    if (item !== except && item.classList.contains('is-open')) setDropdown(item, false);
  });
}

/**
 * Opens / closes the mobile search bar.
 * @param {Element} nav the nav element
 * @param {boolean|null} force optional state to force
 * @param {boolean} [animate] animate the change
 */
function toggleSearch(nav, force = null, animate = true) {
  const button = nav.querySelector('.nav-search-toggle button');
  const tools = nav.querySelector('.nav-tools');
  if (!button || !tools) return;
  const open = force !== null ? force : button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  slide(tools, open, animate && !isDesktop.matches);
  if (open && !isDesktop.matches) {
    const input = tools.querySelector('input');
    if (input) input.focus({ preventScroll: true });
  }
}

/**
 * Toggles the entire (mobile) nav.
 * @param {Element} nav the nav element
 * @param {Element} navSections the sections container
 * @param {boolean|null} forceExpanded optional state to force
 * @param {boolean} [animate] animate the change
 */
function toggleMenu(nav, navSections, forceExpanded = null, animate = true) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  if (button) {
    button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
    button.setAttribute('aria-expanded', expanded || isDesktop.matches ? 'false' : 'true');
  }
  closeAllDropdowns(navSections);
  if (isDesktop.matches) {
    if (navSections) navSections.classList.remove('is-expanded');
  } else {
    slide(navSections, !expanded, animate);
  }
}

/**
 * Moves the mobile-only menu entries (authored in their own fragment section)
 * to the end of the main menu list, flagged so they are hidden on desktop.
 * @param {Element} nav the nav element
 * @param {Element} topList the main menu list
 */
function mergeMobileOnlyItems(nav, topList) {
  const navMobile = nav.querySelector('.nav-mobile');
  if (!navMobile) return;
  navMobile.querySelectorAll(':scope > ul > li').forEach((li) => {
    li.classList.add('nav-mobile-only');
    const link = li.querySelector(':scope > a');
    if (link) link.classList.add('nav-link');
    topList.append(li);
  });
  navMobile.remove();
}

/**
 * Turns the nested list of each top-level item into a dropdown (desktop) /
 * accordion (mobile) with a disclosure (chevron) button, and wires behaviour.
 * @param {Element} nav the nav element
 * @param {Element} navSections the sections container
 */
function decorateSections(nav, navSections) {
  const topList = navSections.querySelector(':scope > ul');
  if (!topList) return;
  topList.classList.add('nav-list');

  [...topList.children].forEach((item) => {
    const link = item.querySelector(':scope > a');
    if (link) link.classList.add('nav-link');
    const subList = item.querySelector(':scope > ul');
    if (!subList) return;
    subList.querySelectorAll('a').forEach((a) => a.classList.add('nav-sub-link'));

    item.classList.add('nav-drop');
    subList.classList.add('nav-sub-menu');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-drop-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    if (link) toggle.setAttribute('aria-label', link.textContent.trim());
    subList.before(toggle);

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      const open = !item.classList.contains('is-open');
      closeAllDropdowns(navSections, item);
      setDropdown(item, open);
    });

    // desktop: open on hover, close instantly on hover-out (matches source)
    item.addEventListener('mouseenter', () => {
      if (!isDesktop.matches) return;
      closeAllDropdowns(navSections, item);
      setDropdown(item, true);
    });
    item.addEventListener('mouseleave', () => {
      if (!isDesktop.matches) return;
      setDropdown(item, false);
    });

    // desktop keyboard: keep the dropdown open while focus is inside it
    item.addEventListener('focusin', () => {
      if (!isDesktop.matches) return;
      closeAllDropdowns(navSections, item);
      setDropdown(item, true);
    });
    item.addEventListener('focusout', (e) => {
      if (!isDesktop.matches || item.contains(e.relatedTarget)) return;
      setDropdown(item, false);
    });
  });

  mergeMobileOnlyItems(nav, topList);

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    const openItem = navSections.querySelector('.nav-drop.is-open');
    if (openItem && isDesktop.matches) {
      closeAllDropdowns(navSections);
      const link = openItem.querySelector(':scope > a');
      if (link) link.focus();
    } else if (!isDesktop.matches && nav.getAttribute('aria-expanded') === 'true') {
      toggleMenu(nav, navSections, false);
      nav.querySelector('.nav-hamburger button').focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (isDesktop.matches && !nav.contains(e.target)) closeAllDropdowns(navSections);
  });
}

/**
 * Builds the search form. The placeholder / accessible label and the submit
 * label are read from the paragraphs authored in the tools section.
 * Searches are sent to Google restricted to this site's French section.
 * @param {Element} navTools the tools section
 * @returns {string|null} the search label text
 */
function decorateSearch(navTools) {
  const texts = [...navTools.querySelectorAll(':scope > p')].filter((p) => !p.querySelector('a, img'));
  if (!texts.length) return null;
  const labelText = texts[0].textContent.trim();
  const submitText = texts[1] ? texts[1].textContent.trim() : labelText;

  const form = document.createElement('form');
  form.className = 'nav-search';
  form.setAttribute('role', 'search');
  form.action = 'https://www.google.com/search';
  form.method = 'get';
  form.target = '_self';

  const label = document.createElement('label');
  label.className = 'nav-search-label';
  label.htmlFor = 'nav-search-input';
  label.textContent = labelText;

  const input = document.createElement('input');
  input.type = 'search';
  input.id = 'nav-search-input';
  input.name = 'q';
  input.placeholder = labelText;
  input.required = true;
  input.autocomplete = 'off';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'nav-search-submit';
  const icon = document.createElement('span');
  icon.className = 'nav-search-icon';
  icon.setAttribute('aria-hidden', 'true');
  const submitLabel = document.createElement('span');
  submitLabel.className = 'nav-search-submit-label';
  submitLabel.textContent = submitText;
  submit.append(icon, submitLabel);

  form.append(label, input, submit);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    const scope = `site:${window.location.host}/fr-fr`;
    const url = new URL(form.action);
    url.searchParams.set('q', `${scope} ${query}`);
    window.location.assign(url.href);
  });

  texts.forEach((p, i) => (i === 0 ? p.replaceWith(form) : p.remove()));
  return labelText;
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const fragment = await fetchNavFragment();
  if (!fragment) return;

  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  ['brand', 'sections', 'tools', 'mobile'].forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  if (navBrand) {
    const brandLink = navBrand.querySelector('a');
    if (brandLink) brandLink.classList.add('nav-brand-link');
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections.id = 'nav-menu';
    decorateSections(nav, navSections);
  }

  const navTools = nav.querySelector('.nav-tools');
  let searchLabel = null;
  if (navTools) {
    navTools.id = 'nav-tools';
    const utility = navTools.querySelector(':scope > ul');
    if (utility) {
      utility.classList.add('nav-utility');
      utility.querySelectorAll('a').forEach((a) => a.classList.add('nav-utility-link'));
    }
    searchLabel = decorateSearch(navTools);
  }

  // mobile search toggle (magnifier icon in the header row)
  if (searchLabel) {
    const searchToggle = document.createElement('div');
    searchToggle.className = 'nav-search-toggle';
    const searchButton = document.createElement('button');
    searchButton.type = 'button';
    searchButton.setAttribute('aria-controls', 'nav-tools');
    searchButton.setAttribute('aria-expanded', 'false');
    searchButton.setAttribute('aria-label', searchLabel);
    searchButton.innerHTML = '<span class="nav-search-icon" aria-hidden="true"></span>';
    searchButton.addEventListener('click', () => toggleSearch(nav));
    searchToggle.append(searchButton);
    if (navBrand) navBrand.after(searchToggle);
    else nav.prepend(searchToggle);
  }

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav-menu" aria-expanded="false" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');

  // viewport changes: reset mobile state when crossing the desktop breakpoint
  toggleMenu(nav, navSections, isDesktop.matches, false);
  isDesktop.addEventListener('change', () => {
    toggleMenu(nav, navSections, isDesktop.matches, false);
    toggleSearch(nav, false, false);
  });

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
