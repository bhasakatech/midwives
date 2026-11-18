// add delayed functionality here
import { loadScript } from './aem.js';
// eslint-disable-next-line import/no-cycle
import { getSiteConfigValue } from './scripts.js';

/**
 * Hotjar — site ID comes from the site configuration (public.custom.hotjarId),
 * so admins can change or remove it (removing it switches Hotjar off) without
 * a code change. Only loaded once the visitor has given cookie consent.
 */
const HOTJAR_CONFIG_KEY = 'hotjarId';
const HOTJAR_SNIPPET_VERSION = 6;
const hotjarIdPromise = getSiteConfigValue(HOTJAR_CONFIG_KEY);

async function loadHotjar() {
  // eslint-disable-next-line no-underscore-dangle
  if (window.hj && window._hjSettings) return;
  const hjid = String((await hotjarIdPromise) ?? '').trim();
  if (!/^\d+$/.test(hjid)) return;
  window.hj = window.hj || function hj(...args) { (window.hj.q = window.hj.q || []).push(args); };
  // eslint-disable-next-line no-underscore-dangle
  window._hjSettings = { hjid: Number(hjid), hjsv: HOTJAR_SNIPPET_VERSION };
  await loadScript(`https://static.hotjar.com/c/hotjar-${hjid}.js?sv=${HOTJAR_SNIPPET_VERSION}`, { async: '' });
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
    priorConsentCallback: () => {
      // eslint-disable-next-line no-console
      loadHotjar().catch((e) => console.warn('Hotjar failed to load', e));
    },
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
