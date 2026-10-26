import { getSiteConfigValue } from '../../scripts/scripts.js';

// custom variable in the public site configuration (/config.json) holding the
// App Builder proxy URL of a private API, e.g. .../web/midwives/proxy/basic-auth-test
const CONFIG_KEY = 'basicAuthTestUrl';

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function render(block, state, title, detail) {
  const box = createEl('div', `api-status-box api-status-${state}`);
  box.append(createEl('p', 'api-status-title', title));
  if (detail) box.append(createEl('p', 'api-status-detail', detail));
  block.querySelector('.api-status-result').replaceChildren(box);
}

/**
 * Calls a private API through the App Builder proxy and shows whether the
 * server-side credentials were accepted. The browser sends no credentials.
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const result = createEl('div', 'api-status-result');
  result.setAttribute('role', 'status');
  result.setAttribute('aria-live', 'polite');
  block.replaceChildren(result);
  block.setAttribute('aria-busy', 'true');
  render(block, 'loading', 'Checking private API…');

  const url = await getSiteConfigValue(CONFIG_KEY);
  if (!url) {
    render(block, 'error', 'Not configured', `Set "${CONFIG_KEY}" in the site configuration (public.custom).`);
    block.removeAttribute('aria-busy');
    return;
  }

  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data.authenticated === true) {
      render(block, 'ok', 'Authenticated', 'The private API accepted the credentials stored in App Builder. None were sent from this browser.');
    } else if (resp.ok) {
      render(block, 'error', 'Not authenticated', 'The private API answered but did not confirm authentication.');
    } else {
      const code = data?.error?.code ? ` (${data.error.code})` : '';
      render(block, 'error', 'Not authenticated', `The proxy answered ${resp.status}${code}.`);
    }
  } catch (e) {
    render(block, 'error', 'Request failed', 'The proxy could not be reached.');
  } finally {
    block.removeAttribute('aria-busy');
  }
}
