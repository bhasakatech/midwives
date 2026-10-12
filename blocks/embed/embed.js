/*
 * Embed Block
 * Responsive, lazy-loaded YouTube / Vimeo (or generic) iframe embed, authored as a link
 * with an optional placeholder image. Based on the Block Collection embed block.
 * https://www.aem.live/developer/block-collection/embed
 */

function getYoutubeId(url) {
  if (url.hostname.includes('youtu.be')) return url.pathname.split('/')[1] || '';
  const v = url.searchParams.get('v');
  if (v) return v;
  // /embed/<id>, /shorts/<id>, /live/<id>
  const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/);
  return match ? match[1] : '';
}

function getVimeoId(url) {
  const match = url.pathname.match(/(?:\/video)?\/(\d+)/);
  return match ? match[1] : '';
}

const EMBEDS_CONFIG = [
  {
    type: 'youtube',
    match: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
    src: (url, autoplay) => {
      const id = getYoutubeId(url);
      if (!id) return url.href;
      const params = new URLSearchParams({ rel: '0' });
      const start = url.searchParams.get('t') || url.searchParams.get('start');
      if (start && /^\d+s?$/.test(start)) params.set('start', parseInt(start, 10));
      if (autoplay) {
        params.set('autoplay', '1');
        params.set('mute', '1');
      }
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params}`;
    },
    allow: 'autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope',
    title: 'YouTube',
  },
  {
    type: 'vimeo',
    match: ['vimeo.com'],
    src: (url, autoplay) => {
      const id = getVimeoId(url);
      if (!id) return url.href;
      return `https://player.vimeo.com/video/${id}${autoplay ? '?muted=1&autoplay=1' : ''}`;
    },
    allow: 'autoplay; fullscreen; picture-in-picture',
    title: 'Vimeo',
  },
];

/**
 * Finds the embed URL: an authored link, or a plain-text URL (xwalk text field).
 * @param {Element} block The block element
 * @returns {URL|null}
 */
function findUrl(block) {
  const link = block.querySelector('a[href]');
  const candidates = link ? [link.href] : [];
  block.querySelectorAll('div, p').forEach((el) => {
    const text = el.textContent.trim();
    if (/^https?:\/\/\S+$/.test(text)) candidates.push(text);
  });
  const found = candidates.find((c) => {
    try {
      return !!new URL(c);
    } catch {
      return false;
    }
  });
  return found ? new URL(found) : null;
}

function loadEmbed(block, url, title, autoplay = false) {
  if (block.classList.contains('embed-is-loaded')) return;
  const config = EMBEDS_CONFIG.find((c) => c.match.some((m) => url.hostname.includes(m)));

  const frameWrap = document.createElement('div');
  frameWrap.className = 'embed-frame';
  const iframe = document.createElement('iframe');
  iframe.src = config ? config.src(url, autoplay) : url.href;
  iframe.loading = 'lazy';
  iframe.allowFullscreen = true;
  iframe.setAttribute('allow', config ? config.allow : 'encrypted-media; fullscreen');
  iframe.title = title || `${config ? config.title : url.hostname} video`;
  frameWrap.append(iframe);

  block.replaceChildren(frameWrap);
  if (config) block.classList.add(`embed-${config.type}`);
  block.classList.add('embed-is-loaded');
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const url = findUrl(block);
  if (!url) return;

  const placeholder = block.querySelector('picture');
  const link = block.querySelector('a[href]');
  const linkText = link ? link.textContent.trim() : '';
  // use the link text as accessible title unless it is just the URL
  const title = linkText && !/^https?:\/\//.test(linkText) ? linkText : '';

  block.textContent = '';

  if (placeholder) {
    const wrapper = document.createElement('div');
    wrapper.className = 'embed-placeholder';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'embed-placeholder-play';
    button.setAttribute('aria-label', title ? `Play video: ${title}` : 'Play video');
    wrapper.append(placeholder, button);
    wrapper.addEventListener('click', () => loadEmbed(block, url, title, true));
    block.append(wrapper);
  } else {
    // reserve the 16:9 space until the iframe is loaded
    block.classList.add('embed-pending');
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        block.classList.remove('embed-pending');
        loadEmbed(block, url, title);
      }
    });
    observer.observe(block);
  }
}
