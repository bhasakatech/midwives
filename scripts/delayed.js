// add delayed functionality here
import { loadScript } from './aem.js';

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
    priorConsentCallback: () => {},
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
