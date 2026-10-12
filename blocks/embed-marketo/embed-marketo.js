/*
 * Embed Marketo Block
 * Embeds an existing hosted Marketo Forms 2.0 form (MktoForms2) instead of rebuilding it.
 * The Marketo script is loaded lazily (after page load, when the block nears the viewport)
 * via loadScript from aem.js, so it is allowed by the page CSP ('strict-dynamic').
 *
 * Key-value block: each row is "key | value" (row order does not matter, empty rows are fine):
 *  formId        e.g. 78240 (required)
 *  munchkinId    default 005-SHS-767
 *  baseUrl       default //landing1.gehealthcare.com
 *  thankYou      rich text, replaces the form after submit
 *  fallback      optional link, shown if the Marketo script cannot load
 *  gateMessage   gated option: notice + question (rich text)
 *  gateYesLabel  gated option, default "Oui"
 *  gateNoLabel   gated option, default "Non"
 *  gateNoUrl     gated option, default https://www.gehealthcare.fr/
 *
 * Options: "gated" (professional check + marketo_success cookie + ge_redirect),
 *          "configurator" (passes ?product=<id> into a hidden Marketo field).
 */
import { loadScript } from '../../scripts/aem.js';

const DEFAULT_MUNCHKIN_ID = '005-SHS-767';
const DEFAULT_BASE_URL = '//landing1.gehealthcare.com';
const DEFAULT_NO_URL = 'https://www.gehealthcare.fr/';
const PRO_COOKIE = 'professionnal';
const PRO_BYPASS_PARAM = 'gated';
const PRO_BYPASS_VALUE = 'kPr46zZIxh78';
const SUCCESS_COOKIE = 'marketo_success';
const REDIRECT_PARAM = 'ge_redirect';
const LOAD_TIMEOUT = 10000;
const UTM_FIELDS = ['campaign', 'content', 'medium', 'source', 'term'];
// candidate hidden Marketo field names for the configurator product id
const PRODUCT_FIELDS = ['product', 'configuratorProduct', 'productInterest'];

let marketoScriptPromise;

function getCookie(name) {
  const match = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

/**
 * Normalizes the Marketo instance to a protocol-relative origin, e.g. //landing1.example.com
 * @param {string} value authored base URL
 * @returns {string}
 */
function normalizeBaseUrl(value) {
  const raw = (value || '').trim() || DEFAULT_BASE_URL;
  try {
    const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw);
    if (!/^https?:$/.test(url.protocol)) return DEFAULT_BASE_URL;
    return `//${url.host}`;
  } catch {
    return DEFAULT_BASE_URL;
  }
}

/**
 * Returns a same-origin redirect target from ?ge_redirect, or null.
 * @returns {string|null}
 */
function getSafeRedirect() {
  const target = new URLSearchParams(window.location.search).get(REDIRECT_PARAM);
  if (!target) return null;
  try {
    const url = new URL(target, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function afterPageLoad() {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', () => resolve(), { once: true });
  });
}

function whenNearViewport(el) {
  return new Promise((resolve) => {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        resolve();
      }
    }, { rootMargin: '200px' });
    observer.observe(el);
  });
}

function loadMarketoScript(baseUrl) {
  if (!marketoScriptPromise) {
    marketoScriptPromise = loadScript(`https:${baseUrl}/js/forms2/js/forms2.min.js`)
      .then(() => {
        if (!window.MktoForms2) throw new Error('MktoForms2 not available');
        return window.MktoForms2;
      });
    marketoScriptPromise.catch(() => { marketoScriptPromise = null; });
  }
  return marketoScriptPromise;
}

// key-value rows: accepted key spellings (normalized: lowercase, alphanumerics only)
const KEYS = {
  formId: ['formid', 'marketoformid', 'form'],
  munchkinId: ['munchkinid', 'munchkin', 'accountid'],
  baseUrl: ['baseurl', 'marketobaseurl', 'instance'],
  thankYou: ['thankyou', 'thankyoumessage', 'successmessage', 'success'],
  fallback: ['fallback', 'fallbacklink', 'fallbackurl'],
  gateMessage: ['gatemessage', 'gate', 'professionalcheck', 'professionalchecktext'],
  gateYesLabel: ['gateyeslabel', 'yeslabel', 'yes'],
  gateNoLabel: ['gatenolabel', 'nolabel', 'no'],
  gateNoUrl: ['gatenourl', 'nourl'],
};

const normalizeKey = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Reads the key-value rows (key cell | value cell) into a map of field name -> value cell.
 * @param {Element} block
 * @returns {Object<string, Element>}
 */
function readRows(block) {
  const cells = {};
  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    if (!keyCell || !valueCell) return;
    const key = normalizeKey(keyCell.textContent);
    const field = Object.keys(KEYS).find((name) => KEYS[name].includes(key));
    if (field && !cells[field]) cells[field] = valueCell;
  });
  return cells;
}

const textOf = (cell) => (cell ? cell.textContent.trim() : '');

function linkOf(cell) {
  if (!cell) return null;
  const a = cell.querySelector('a[href]');
  if (a) return { href: a.href, text: a.textContent.trim() || a.href };
  const text = cell.textContent.trim();
  return text ? { href: text, text } : null;
}

function readConfig(block) {
  const cells = readRows(block);
  const munchkinRaw = textOf(cells.munchkinId);
  return {
    formId: textOf(cells.formId).replace(/\D/g, ''),
    munchkinId: /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/i.test(munchkinRaw) ? munchkinRaw : DEFAULT_MUNCHKIN_ID,
    baseUrl: normalizeBaseUrl(textOf(cells.baseUrl)),
    thankYou: cells.thankYou || null,
    fallback: linkOf(cells.fallback),
    gateText: cells.gateMessage || null,
    yesLabel: textOf(cells.gateYesLabel) || 'Oui',
    noLabel: textOf(cells.gateNoLabel) || 'Non',
    noUrl: linkOf(cells.gateNoUrl)?.href || DEFAULT_NO_URL,
  };
}

/**
 * Sets a Marketo field value only if the form actually has that field.
 */
function setFieldIfPresent(form, name, value) {
  const formEl = form.getFormElem()[0];
  if (formEl && formEl.querySelector(`[name="${name}"]`)) {
    form.vals({ [name]: value });
    return true;
  }
  return false;
}

function prefillHiddenFields(form, block) {
  const params = new URLSearchParams(window.location.search);
  UTM_FIELDS.forEach((key) => {
    const value = params.get(`utm_${key}`);
    if (value) setFieldIfPresent(form, `utm${key}`, value);
  });
  if (block.classList.contains('configurator')) {
    const product = params.get('product');
    if (product && /^[\w-]{1,64}$/.test(product)) {
      PRODUCT_FIELDS.some((name) => setFieldIfPresent(form, name, product));
    }
  }
}

function showThankYou(block, formWrap, thanks) {
  formWrap.hidden = true;
  if (thanks.childElementCount || thanks.textContent.trim()) {
    thanks.hidden = false;
    thanks.focus();
  }
}

function handleSuccess(block, formWrap, thanks) {
  if (typeof window.digitalMarketoSubmit === 'function') {
    try { window.digitalMarketoSubmit(); } catch { /* analytics must not block success */ }
  }
  block.dispatchEvent(new CustomEvent('embed-marketo:success', { bubbles: true }));

  if (block.classList.contains('gated')) {
    setCookie(SUCCESS_COOKIE, '1', 365);
    const redirect = getSafeRedirect();
    if (redirect) {
      window.location.assign(redirect);
      return;
    }
  }
  showThankYou(block, formWrap, thanks);
}

async function renderForm(block, config, formWrap, thanks, fallbackEl) {
  if (block.dataset.marketoState) return;
  block.dataset.marketoState = 'loading';

  const showFallback = () => {
    if (block.dataset.marketoState === 'ready') return;
    block.dataset.marketoState = 'failed';
    if (fallbackEl) fallbackEl.hidden = false;
  };
  const timer = setTimeout(showFallback, LOAD_TIMEOUT);

  try {
    const MktoForms2 = await loadMarketoScript(config.baseUrl);
    MktoForms2.loadForm(config.baseUrl, config.munchkinId, config.formId, (form) => {
      if (!form) return;
      clearTimeout(timer);
      block.dataset.marketoState = 'ready';
      if (fallbackEl) fallbackEl.hidden = true;
      prefillHiddenFields(form, block);
      form.onSuccess(() => {
        handleSuccess(block, formWrap, thanks);
        return false; // prevent the Marketo follow-up redirect
      });
    });
  } catch {
    clearTimeout(timer);
    showFallback();
  }
}

function buildGate(config, onYes) {
  const gate = document.createElement('div');
  gate.className = 'embed-marketo-gate';

  const text = document.createElement('div');
  text.className = 'embed-marketo-gate-text';
  if (config.gateText) text.append(...config.gateText.childNodes);
  gate.append(text);

  const actions = document.createElement('div');
  actions.className = 'embed-marketo-gate-actions';

  const yes = document.createElement('button');
  yes.type = 'button';
  yes.className = 'button primary';
  yes.textContent = config.yesLabel;
  yes.addEventListener('click', () => {
    setCookie(PRO_COOKIE, 'isPro', 180);
    onYes();
  });

  const no = document.createElement('a');
  no.className = 'button secondary';
  no.href = config.noUrl;
  no.textContent = config.noLabel;
  no.addEventListener('click', () => setCookie(PRO_COOKIE, 'noPro', 180));

  actions.append(yes, no);
  gate.append(actions);
  return gate;
}

function isProfessional() {
  const params = new URLSearchParams(window.location.search);
  if (params.get(PRO_BYPASS_PARAM) === PRO_BYPASS_VALUE) {
    setCookie(PRO_COOKIE, 'isPro', 180);
    return true;
  }
  return getCookie(PRO_COOKIE) === 'isPro';
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const config = readConfig(block);

  const formWrap = document.createElement('div');
  formWrap.className = 'embed-marketo-form';

  const thanks = document.createElement('div');
  thanks.className = 'embed-marketo-thanks';
  thanks.setAttribute('role', 'status');
  thanks.tabIndex = -1;
  thanks.hidden = true;
  if (config.thankYou) thanks.append(...config.thankYou.childNodes);

  let fallbackEl = null;
  if (config.fallback) {
    fallbackEl = document.createElement('p');
    fallbackEl.className = 'embed-marketo-fallback';
    const a = document.createElement('a');
    a.href = config.fallback.href;
    a.textContent = config.fallback.text;
    fallbackEl.append(a);
    fallbackEl.hidden = true;
  }

  block.textContent = '';

  if (!config.formId) {
    // nothing to embed: expose the fallback link directly (if any)
    if (fallbackEl) {
      fallbackEl.hidden = false;
      block.append(fallbackEl);
    }
    return;
  }

  const form = document.createElement('form');
  form.id = `mktoForm_${config.formId}`;
  formWrap.append(form);
  block.append(formWrap, thanks);
  if (fallbackEl) block.append(fallbackEl);

  // lazy: never during the eager phase, only after page load and near the viewport
  const start = () => afterPageLoad()
    .then(() => whenNearViewport(formWrap))
    .then(() => renderForm(block, config, formWrap, thanks, fallbackEl));

  if (block.classList.contains('gated') && !isProfessional()) {
    formWrap.hidden = true;
    const gate = buildGate(config, () => {
      gate.remove();
      formWrap.hidden = false;
      start();
    });
    block.prepend(gate);
    return;
  }

  start();
}
