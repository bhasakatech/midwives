const DEFAULT_API_URL = 'https://gorest.co.in/public/v2/users';
const PAGE_SIZE = 20;

/**
 * Reads the authored API URL from the first cell (link or plain text).
 * Falls back to the default endpoint when missing or not http(s).
 * @param {Element} block The block element
 * @returns {string} the API URL to fetch
 */
function getApiUrl(block) {
  const cell = block.querySelector(':scope > div > div');
  if (!cell) return DEFAULT_API_URL;
  const link = cell.querySelector('a[href]');
  const raw = (link ? link.getAttribute('href') : cell.textContent).trim();
  if (!raw) return DEFAULT_API_URL;
  try {
    const url = new URL(raw, window.location.href);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch (e) {
    // invalid URL, use default
  }
  return DEFAULT_API_URL;
}

/**
 * Picks a heading level one below the nearest preceding heading on the page.
 * @param {Element} block The block element
 * @returns {number} heading level between 2 and 6
 */
function getHeadingLevel(block) {
  const headings = [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')];
  const preceding = headings.filter(
    // eslint-disable-next-line no-bitwise
    (h) => block.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_PRECEDING,
  );
  const last = preceding[preceding.length - 1];
  if (!last) return 2;
  return Math.min(Number(last.tagName.charAt(1)) + 1, 6);
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter((part) => /^\p{L}/u.test(part))
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/**
 * Builds one user card from untrusted API data (textContent only).
 * @param {Object} user API user record
 * @param {number} level heading level
 * @returns {HTMLLIElement}
 */
function buildCard(user, level) {
  const name = String(user.name ?? '').trim() || 'Unknown user';
  const email = String(user.email ?? '').trim();
  const gender = String(user.gender ?? '').trim();
  const status = String(user.status ?? '').trim().toLowerCase();

  const li = createEl('li', 'users-card');

  const avatar = createEl('span', 'users-card-avatar', getInitials(name));
  avatar.setAttribute('aria-hidden', 'true');
  li.append(avatar);

  const body = createEl('div', 'users-card-body');
  body.append(createEl(`h${level}`, 'users-card-name', name));

  const details = createEl('dl', 'users-card-details');
  const addDetail = (label, value) => {
    const row = createEl('div', 'users-card-detail');
    row.append(createEl('dt', '', label));
    const dd = createEl('dd');
    if (value instanceof Node) dd.append(value);
    else dd.textContent = value;
    row.append(dd);
    details.append(row);
  };

  if (email) {
    const a = createEl('a', 'users-card-email', email);
    a.href = `mailto:${encodeURIComponent(email).replace(/%40/g, '@')}`;
    addDetail('Email', a);
  }
  if (gender) addDetail('Gender', gender);
  body.append(details);
  li.append(body);

  if (status) {
    const badgeClass = ['active', 'inactive'].includes(status) ? status : 'unknown';
    const badge = createEl('span', `users-card-status users-card-status-${badgeClass}`, status);
    badge.setAttribute('aria-label', `Status: ${status}`);
    li.append(badge);
  }

  return li;
}

function showMessage(container, className, text) {
  container.replaceChildren(createEl('p', `users-message ${className}`, text));
}

/**
 * Builds the URL for one page of results, keeping any authored query params.
 * @param {string} apiUrl base API URL
 * @param {number} page 1-based page number
 * @returns {string}
 */
function getPageUrl(apiUrl, page) {
  const url = new URL(apiUrl);
  url.searchParams.set('page', page);
  if (!url.searchParams.has('per_page')) url.searchParams.set('per_page', PAGE_SIZE);
  return url.href;
}

/**
 * Fetches one page of users along with the pagination info from the response headers.
 * @param {string} apiUrl base API URL
 * @param {number} page 1-based page number
 * @returns {Promise<{users: Object[], pages: number, total: number}>}
 */
async function fetchPage(apiUrl, page) {
  const resp = await fetch(getPageUrl(apiUrl, page), { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const users = Array.isArray(data) ? data.filter((u) => u && typeof u === 'object') : [];
  return {
    users,
    pages: Number(resp.headers.get('x-pagination-pages')) || page,
    total: Number(resp.headers.get('x-pagination-total')) || 0,
  };
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const apiUrl = getApiUrl(block);
  const level = getHeadingLevel(block);

  const status = createEl('div', 'users-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  block.replaceChildren(status);
  block.setAttribute('aria-busy', 'true');
  showMessage(status, 'users-loading', 'Loading users…');

  const list = createEl('ul', 'users-list');
  const footer = createEl('div', 'users-footer');
  const count = createEl('p', 'users-count');
  const loadMore = createEl('button', 'button secondary users-load-more', 'Load more');
  loadMore.type = 'button';
  footer.append(count, loadMore);

  let page = 1;
  let pages = 1;
  let total = 0;

  const render = (users) => {
    users.forEach((user) => list.append(buildCard(user, level)));
    const shown = list.children.length;
    const of = total > shown ? ` of ${total}` : '';
    count.textContent = `Showing ${shown}${of} users`;
    const added = shown > users.length ? `${users.length} more` : users.length;
    status.textContent = `${added} ${users.length === 1 ? 'user' : 'users'} loaded. Showing ${shown}${of}.`;
    loadMore.hidden = page >= pages || !users.length;
  };

  try {
    const first = await fetchPage(apiUrl, page);
    ({ pages, total } = first);

    if (!first.users.length) {
      showMessage(status, 'users-empty', 'No users found.');
      return;
    }

    status.classList.add('users-status-sr');
    block.append(list, footer);
    render(first.users);
  } catch (e) {
    showMessage(status, 'users-error', 'Sorry, users could not be loaded. Please try again later.');
    return;
  } finally {
    block.removeAttribute('aria-busy');
  }

  loadMore.addEventListener('click', async () => {
    loadMore.disabled = true;
    loadMore.textContent = 'Loading…';
    block.setAttribute('aria-busy', 'true');
    try {
      const next = await fetchPage(apiUrl, page + 1);
      page += 1;
      ({ pages } = next);
      if (next.total) ({ total } = next);
      render(next.users);
      loadMore.textContent = 'Load more';
    } catch (e) {
      status.textContent = 'Sorry, more users could not be loaded. Please try again.';
      loadMore.textContent = 'Try again';
    } finally {
      loadMore.disabled = false;
      block.removeAttribute('aria-busy');
    }
  });
}
