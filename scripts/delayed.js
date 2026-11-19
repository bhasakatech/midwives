// add delayed functionality here
import { loadScript } from './aem.js';
// eslint-disable-next-line import/no-cycle
import { getSiteConfigValue } from './scripts.js';
// eslint-disable-next-line import/no-cycle
import initExitPopup from './exit-popup.js';

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
 * Settings come from the site configuration (public.custom.cookieConsent); any missing
 * or invalid value falls back to the defaults below (the source site's setup):
 *
 * "cookieConsent": { "enabled": true, "companyId": "8523", "settingsDomain": "gehealthcare",
 *                    "test": false, "brandColor": "#6022A6" }
 *
 * - enabled: false removes the banner; scripts that wait for consent then never load
 * - test: true loads Evidon's test settings (non-production testing)
 * - testDomain: e.g. "midwives.gehealthcare.com/fr-fr/" — only on preview hosts (localhost,
 *   *.aem.page, *.aem.live), Evidon is told the page is on that domain so the real banner
 *   shows for testing. Never applied on any other host; remove it to switch it off.
 * Banner texts, categories and languages are managed in the Evidon/Crownpeak console.
 * Evidon only shows the banner on domains registered in GE's account (gehealthcare.*),
 * so on preview hosts the API loads but shows no dialog unless testDomain is set.
 */
const COOKIE_CONSENT_CONFIG_KEY = 'cookieConsent';
const EVIDON_DEFAULTS = {
  companyId: '8523',
  settingsDomain: 'gehealthcare',
  brandColor: '#6022A6',
};
const EVIDON_CDN = 'https://c.evidon.com/';

function getEvidonSettings(config) {
  const cfg = config && typeof config === 'object' ? config : {};
  const pick = (key, pattern) => {
    const value = String(cfg[key] ?? '').trim();
    return pattern.test(value) ? value : EVIDON_DEFAULTS[key];
  };
  return {
    enabled: isEnabled(cfg.enabled),
    test: cfg.test === true || String(cfg.test).toLowerCase() === 'true',
    companyId: pick('companyId', /^\d+$/),
    settingsDomain: pick('settingsDomain', /^[a-z0-9.-]+$/i),
    brandColor: pick('brandColor', /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i),
    testDomain: /^[a-z0-9.-]+\.[a-z]{2,}(?:\/[\w\-/]*)?$/i.test(String(cfg.testDomain ?? '').trim())
      ? String(cfg.testDomain).trim() : null,
  };
}

/**
 * "Préférences de cookies" links reopen the Evidon preferences window (as on the source,
 * where the footer link calls evidon.notice.showOptions()). Authors link to
 * #cookie-preferences; a "#" link whose text mentions cookies works too.
 */
function initCookiePreferenceLinks() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest?.('a[href]');
    if (!link) return;
    const href = link.getAttribute('href').trim();
    const isPrefsLink = href.endsWith('#cookie-preferences')
      || (href === '#' && /cookie/i.test(link.textContent));
    if (!isPrefsLink || typeof window.evidon?.notice?.showOptions !== 'function') return;
    e.preventDefault();
    window.evidon.notice.showOptions();
  });
}

const isPreviewHost = (host) => host === 'localhost' || /\.aem\.(page|live)$/.test(host);

/**
 * Testing only: makes Evidon treat a preview page as being on a registered GE domain.
 * Waits for Evidon to have read its settings, then switches the domain (Evidon then
 * reloads the matching settings and shows the banner).
 */
async function applyEvidonTestDomain(testDomain) {
  for (let i = 0; i < 50; i += 1) {
    const notice = window.evidon?.notice;
    if (notice?.settings && typeof notice.setDomain === 'function') {
      notice.setDomain(testDomain);
      // eslint-disable-next-line no-console
      console.info(`Evidon test mode: banner shown as on ${testDomain}`);
      return;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, 200); });
  }
}

async function loadEvidon() {
  if (window.evidon?.notice) return;
  const {
    enabled, test, companyId, settingsDomain, brandColor, testDomain,
  } = getEvidonSettings(await getSiteConfigValue(COOKIE_CONSENT_CONFIG_KEY));
  if (!enabled) return;
  initCookiePreferenceLinks();
  const noticeCdn = `${EVIDON_CDN}sitenotice/`;

  window.evidon = {
    id: Number(companyId),
    test,
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
  style.textContent = `.slideron{ background-color: ${brandColor} !important; }`
    + `.evidon-prefdiag-message a{ color: ${brandColor} !important; }`;
  document.head.append(style);

  const attrs = (id) => ({ id, charset: 'utf-8' });
  // the site-notice tag is loaded synchronously first on the source; keep that order
  await loadScript(`${noticeCdn}evidon-sitenotice-tag.js`, attrs('evidon-notice'));
  await Promise.all([
    loadScript(`${EVIDON_CDN}geo/country.js`, attrs('evidon-location')),
    loadScript(`${noticeCdn}${companyId}/snthemes.js`, attrs('evidon-themes')),
    loadScript(
      `${noticeCdn}${companyId}/${settingsDomain}${test ? '/test' : ''}/settingsV2.js`,
      attrs('evidon-settings'),
    ),
  ]);
  if (testDomain && isPreviewHost(window.location.hostname)) {
    await applyEvidonTestDomain(testDomain);
  }
}

// eslint-disable-next-line no-console
loadEvidon().catch((e) => console.warn('Evidon consent failed to load', e));
loadConfiguredScripts();
// eslint-disable-next-line no-console
initExitPopup().catch((e) => console.warn('exit popup failed', e));
