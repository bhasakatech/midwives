/*
 * Newsletter exit popup ("Inscrivez-vous !"), migrated from the source site's
 * exit-popup.js + cookieSet.js. Shown once per page view, after a delay, to visitors who:
 *  - have not confirmed they are a healthcare professional (cookie professionnal=isPro),
 *  - have made a choice in the Evidon cookie banner (cookie _evidon_consent_cookie),
 *  - have not used one of the popup buttons in the last 180 days.
 * Closing it with the overlay or Escape only hides it for the current page (as on the source).
 *
 * Texts and timing come from the site configuration (public.custom.exitPopup); any missing
 * or invalid value falls back to the source site's values below:
 *
 * "exitPopup": { "enabled": true, "delaySeconds": 120, "title": "Inscrivez-vous !",
 *                "text": "...", "subscribeLabel": "...", "subscribeUrl": "/fr-fr/inscription/",
 *                "dismissLabel": "Non merci" }
 */
import { loadCSS } from './aem.js';
// eslint-disable-next-line import/no-cycle
import { getSiteConfigValue } from './scripts.js';

const CONFIG_KEY = 'exitPopup';
const PRO_COOKIE = 'professionnal';
const CONSENT_COOKIE = '_evidon_consent_cookie';
const DISMISSED_COOKIE = 'exitpopup_dismissed';
const DISMISSED_DAYS = 180;

const DEFAULTS = {
  delaySeconds: 120,
  title: 'Inscrivez-vous !',
  text: 'Et recevez gratuitement de nouveaux conseils et astuces pour vous accompagner dans votre activité de sage femme.',
  subscribeLabel: 'S’abonner à la newsletter',
  subscribeUrl: '/fr-fr/inscription/',
  dismissLabel: 'Non merci',
};

function getCookie(name) {
  const match = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

const textOr = (value, fallback) => (typeof value === 'string' && value.trim() ? value.trim() : fallback);

function toUrl(value) {
  try {
    const url = new URL(textOr(value, DEFAULTS.subscribeUrl), window.location.origin);
    if (/^https?:$/.test(url.protocol)) return url;
  } catch (e) {
    // invalid URL: use the default below
  }
  return new URL(DEFAULTS.subscribeUrl, window.location.origin);
}

function readConfig(config) {
  const cfg = config && typeof config === 'object' ? config : {};
  const delay = Number(cfg.delaySeconds);
  return {
    enabled: cfg.enabled !== false && String(cfg.enabled).toLowerCase() !== 'false',
    delaySeconds: Number.isFinite(delay) && delay >= 0 ? delay : DEFAULTS.delaySeconds,
    title: textOr(cfg.title, DEFAULTS.title),
    text: textOr(cfg.text, DEFAULTS.text),
    subscribeLabel: textOr(cfg.subscribeLabel, DEFAULTS.subscribeLabel),
    subscribeUrl: toUrl(cfg.subscribeUrl),
    dismissLabel: textOr(cfg.dismissLabel, DEFAULTS.dismissLabel),
  };
}

const samePath = (a, b) => a.replace(/\/$/, '') === b.replace(/\/$/, '');

function canShow(config) {
  if (!config.enabled) return false;
  if (getCookie(PRO_COOKIE) === 'isPro' || getCookie(DISMISSED_COOKIE)) return false;
  if (!getCookie(CONSENT_COOKIE)) return false;
  if (document.documentElement.classList.contains('adobe-ue-edit')) return false;
  // no point inviting visitors to the page they are already on
  const { subscribeUrl } = config;
  return !(subscribeUrl.origin === window.location.origin
    && samePath(subscribeUrl.pathname, window.location.pathname));
}

function buildPopup(config) {
  const dialog = document.createElement('dialog');
  dialog.className = 'exit-popup';
  dialog.setAttribute('aria-labelledby', 'exit-popup-title');
  // focusable, so it can take the focus itself when it opens (see showPopup)
  dialog.tabIndex = -1;

  const content = document.createElement('div');
  content.className = 'exit-popup-content';

  const title = document.createElement('h2');
  title.id = 'exit-popup-title';
  title.className = 'exit-popup-title';
  title.textContent = config.title;

  const text = document.createElement('p');
  text.className = 'exit-popup-text';
  text.textContent = config.text;

  const actions = document.createElement('div');
  actions.className = 'exit-popup-actions';

  const dismissForGood = () => setCookie(DISMISSED_COOKIE, '1', DISMISSED_DAYS);

  const subscribe = document.createElement('a');
  subscribe.className = 'button secondary';
  subscribe.href = config.subscribeUrl.href;
  subscribe.textContent = config.subscribeLabel;
  subscribe.addEventListener('click', dismissForGood);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'button accent';
  dismiss.textContent = config.dismissLabel;
  dismiss.addEventListener('click', () => {
    dismissForGood();
    dialog.close();
  });

  actions.append(subscribe, dismiss);
  content.append(title, text, actions);
  dialog.append(content);

  // a click on the overlay (outside the content) closes the popup for this page only
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());
  return dialog;
}

async function showPopup(config) {
  // re-check: the visitor may have answered the pro question or the banner meanwhile
  if (!canShow(config)) return;
  await loadCSS(`${window.hlx?.codeBasePath || ''}/styles/exit-popup.css`);
  if (document.querySelector('dialog[open]')) return;
  const dialog = buildPopup(config);
  document.body.append(dialog);
  dialog.showModal();
  // focus the popup rather than its first button (keyboard users tab to the buttons from here)
  dialog.focus();
}

export default async function initExitPopup() {
  const config = readConfig(await getSiteConfigValue(CONFIG_KEY));
  if (!config.enabled) return;
  // the delay counts from the start of the page view, as on the source
  const wait = Math.max(0, config.delaySeconds * 1000 - performance.now());
  window.setTimeout(() => {
    // eslint-disable-next-line no-console
    showPopup(config).catch((e) => console.warn('exit popup failed', e));
  }, wait);
}
