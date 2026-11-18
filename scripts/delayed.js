// add delayed functionality here
import { loadScript } from './aem.js';
// eslint-disable-next-line import/no-cycle
import { getSiteConfigValue } from './scripts.js';

/*
 * Configurable third-party scripts, loaded on every page in the delayed phase.
 * Managed in the site configuration (public.custom.scripts), no code change needed:
 *
 * "scripts": [
 *   { "name": "Hotjar", "type": "hotjar", "id": "2527622", "enabled": true, "consent": true },
 *   { "name": "My tag", "type": "url", "src": "https://cdn.example.com/tag.js",
 *     "enabled": true, "consent": true, "attributes": { "async": true } }
 * ]
 *
 * - type: a built-in vendor (see SCRIPT_TYPES) or "url" for any external https script
 * - enabled: false switches the script off (default true)
 * - consent: true waits for cookie consent in the Evidon banner (default true)
 * Never put secrets here: the site configuration is publicly readable.
 */
const SCRIPTS_CONFIG_KEY = 'scripts';

// attributes an external script may set (no event handlers or other arbitrary attributes)
const ALLOWED_ATTRIBUTES = ['async', 'defer', 'type', 'crossorigin', 'referrerpolicy', 'id', 'charset'];

let grantConsent;
const consentGiven = new Promise((resolve) => { grantConsent = resolve; });

const isEnabled = (value) => value !== false && String(value).toLowerCase() !== 'false';

function toHttpsUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'https:' ? url.href : null;
  } catch (e) {
    return null;
  }
}

function toScriptAttributes(attributes) {
  if (!attributes || typeof attributes !== 'object') return { async: '' };
  return Object.entries(attributes).reduce((attrs, [name, value]) => {
    const key = name.toLowerCase();
    if (ALLOWED_ATTRIBUTES.includes(key) || /^data-[a-z0-9-]+$/.test(key)) {
      if (value === true) attrs[key] = '';
      else if (value !== false && value != null) attrs[key] = String(value);
    }
    return attrs;
  }, {});
}

/** Hotjar: { "type": "hotjar", "id": "<site id>", "version": 6 } */
async function loadHotjar({ id, version = 6 }) {
  // eslint-disable-next-line no-underscore-dangle
  if (window._hjSettings) return;
  const hjid = String(id ?? '').trim();
  const hjsv = Number(version) || 6;
  if (!/^\d+$/.test(hjid)) throw new Error('missing or invalid "id"');
  window.hj = window.hj || function hj(...args) { (window.hj.q = window.hj.q || []).push(args); };
  // eslint-disable-next-line no-underscore-dangle
  window._hjSettings = { hjid: Number(hjid), hjsv };
  await loadScript(`https://static.hotjar.com/c/hotjar-${hjid}.js?sv=${hjsv}`, { async: '' });
}

/** Any external script: { "type": "url", "src": "https://...", "attributes": {...} } */
async function loadExternalScript({ src, attributes }) {
  const url = toHttpsUrl(src);
  if (!url) throw new Error('missing or non-https "src"');
  await loadScript(url, toScriptAttributes(attributes));
}

// built-in vendors; add a loader here when a vendor needs more than a script URL
const SCRIPT_TYPES = {
  hotjar: loadHotjar,
  url: loadExternalScript,
};

async function loadConfiguredScript(entry) {
  const name = entry.name || entry.type || 'script';
  const loader = SCRIPT_TYPES[String(entry.type ?? '').toLowerCase()];
  if (!loader) {
    // eslint-disable-next-line no-console
    console.warn(`scripts: unknown type "${entry.type}" for "${name}"`);
    return;
  }
  if (isEnabled(entry.consent)) await consentGiven;
  try {
    await loader(entry);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`scripts: "${name}" not loaded`, e);
  }
}

async function loadConfiguredScripts() {
  const scripts = await getSiteConfigValue(SCRIPTS_CONFIG_KEY);
  if (!Array.isArray(scripts)) return;
  scripts
    .filter((entry) => entry && typeof entry === 'object' && isEnabled(entry.enabled))
    .forEach((entry) => loadConfiguredScript(entry));
}

/**
 * Evidon (Crownpeak) cookie consent — same tag and script order as the source site.
 * Settings are published for GE's "gehealthcare" domain only, so the consent UI is
 * functional on GE's production domain; elsewhere the API loads but shows no dialog.
 */
const EVIDON_COMPANY_ID = 8523;
const EVIDON_SETTINGS_DOMAIN = 'gehealthcare';
const EVIDON_CDN = 'https://c.evidon.com/';

async function loadEvidon() {
  if (window.evidon?.notice) return;
  const noticeCdn = `${EVIDON_CDN}sitenotice/`;

  window.evidon = {
    id: EVIDON_COMPANY_ID,
    test: false,
    // fires when the visitor accepts cookies, and on later visits if they already did
    priorConsentCallback: () => grantConsent(),
    closeCallback: () => {},
    consentWithdrawnCallback: () => {},
    consentDeclinedCallback: () => {
      window.evidon.notice?.dropSuppressionCookie?.(365);
    },
  };

  // brand colors for the consent UI (as on the source)
  const style = document.createElement('style');
  style.textContent = '.slideron{ background-color: #6022A6 !important; }'
    + '.evidon-prefdiag-message a{ color: #6022A6 !important; }';
  document.head.append(style);

  const attrs = (id) => ({ id, charset: 'utf-8' });
  // the site-notice tag is loaded synchronously first on the source; keep that order
  await loadScript(`${noticeCdn}evidon-sitenotice-tag.js`, attrs('evidon-notice'));
  await Promise.all([
    loadScript(`${EVIDON_CDN}geo/country.js`, attrs('evidon-location')),
    loadScript(`${noticeCdn}${EVIDON_COMPANY_ID}/snthemes.js`, attrs('evidon-themes')),
    loadScript(
      `${noticeCdn}${EVIDON_COMPANY_ID}/${EVIDON_SETTINGS_DOMAIN}/settingsV2.js`,
      attrs('evidon-settings'),
    ),
  ]);
}

// eslint-disable-next-line no-console
loadEvidon().catch((e) => console.warn('Evidon consent failed to load', e));
loadConfiguredScripts();
