import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(SCRIPT_DIR, '..');
const CACHE_DIR = path.join(SCRIPT_DIR, '.cache');
const REVIEW_FILE = path.join(CACHE_DIR, 'clubs.review.json');
const OVERRIDES_FILE = path.join(SCRIPT_DIR, 'club-overrides.json');
const LISTING_URL = 'https://www.svnit.ac.in/web/Student_Chapter/';
const ALLOWED_HOST = 'www.svnit.ac.in';
const USER_AGENT = 'SVNIT-ClubPortal-StudentProject';
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const CATEGORY_NAMES = new Set([
  'Technical', 'Cultural', 'Sports', 'Academic', 'Social Service', 'Literary',
]);
const EVENT_TYPES = new Set([
  'workshop', 'technical', 'cultural', 'sports', 'academic', 'other',
]);
const SOCIAL_DOMAINS = new Map([
  ['facebook.com', 'facebook'],
  ['instagram.com', 'instagram'],
  ['twitter.com', 'twitter'],
  ['x.com', 'twitter'],
  ['linkedin.com', 'linkedin'],
  ['youtube.com', 'youtube'],
  ['youtu.be', 'youtube'],
]);
const MIME_EXTENSIONS = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/svg+xml', '.svg'],
]);

let lastRequestAt = 0;
let robotsRules;

function assertAllowedUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || url.hostname !== ALLOWED_HOST) {
    throw new Error(`Refusing off-site or non-HTTPS request: ${url.href}`);
  }
  return url;
}

function isDisallowedByRobots(url, rules) {
  const pathWithQuery = `${url.pathname}${url.search}`;
  return rules.some((rule) => rule && pathWithQuery.startsWith(rule));
}

function parseRobotsRules(text) {
  let applies = false;
  const rules = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === 'user-agent') {
      applies = value === '*' || value.toLowerCase() === USER_AGENT.toLowerCase();
    } else if (applies && key === 'disallow' && value) {
      rules.push(value);
    }
  }
  return rules;
}

async function politeRequest(rawUrl, { binary = false } = {}) {
  let url = assertAllowedUrl(rawUrl);
  if (url.pathname !== '/robots.txt' && !robotsRules) {
    const robotsResponse = await politeRequest(`https://${ALLOWED_HOST}/robots.txt`);
    if (robotsResponse.status === 200) {
      robotsRules = parseRobotsRules(robotsResponse.body);
    } else if (robotsResponse.status === 404) {
      robotsRules = [];
    } else {
      throw new Error(`Could not check robots.txt (HTTP ${robotsResponse.status}); refusing to scrape.`);
    }
  }
  if (url.pathname !== '/robots.txt' && isDisallowedByRobots(url, robotsRules)) {
    throw new Error(`robots.txt disallows ${url.pathname}; refusing to scrape.`);
  }

  for (let redirectCount = 0; redirectCount <= 4; redirectCount += 1) {
    let response;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const delay = Math.max(0, 1000 - (Date.now() - lastRequestAt));
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        response = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT },
          redirect: 'manual',
          signal: AbortSignal.timeout(15000),
        });
      } catch (error) {
        lastRequestAt = Date.now();
        if (attempt === 2) throw error;
        continue;
      }
      lastRequestAt = Date.now();
      if (response.status < 500 || attempt === 2) break;
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`HTTP ${response.status} redirect did not include a Location header.`);
      url = assertAllowedUrl(new URL(location, url).href);
      if (url.pathname !== '/robots.txt' && isDisallowedByRobots(url, robotsRules)) {
        throw new Error(`robots.txt disallows redirected path ${url.pathname}; refusing to scrape.`);
      }
      continue;
    }
    return {
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      location: response.headers.get('location'),
      body: response.status === 404
        ? (binary ? Buffer.alloc(0) : '')
        : binary
          ? Buffer.from(await response.arrayBuffer())
          : await response.text(),
    };
  }
  throw new Error(`Too many redirects for ${rawUrl}`);
}

async function fetchAndCache(url, filename) {
  const filepath = path.join(CACHE_DIR, filename);
  try {
    return await fs.readFile(filepath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const response = await politeRequest(url);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(filepath, response.body, 'utf8');
  return response.body;
}

function slugFilename(slug) {
  return slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
}

function extractListing($) {
  const chapters = new Map();
  $('.teachers-in a[href]').each((_, anchor) => {
    const href = $(anchor).attr('href');
    const imageSrc = $(anchor).find('img').first().attr('src') || '';
    if (!href || !/test\.html(?:$|[?#])/i.test(href)) return;
    const detailUrl = new URL(href.replaceAll(' ', '%20'), LISTING_URL);
    assertAllowedUrl(detailUrl.href);
    const parts = detailUrl.pathname.split('/').filter(Boolean);
    const slug = decodeURIComponent(parts.at(-2) || '');
    if (!slug || /unnat.?bharat/i.test(slug) || /uba\.png$/i.test(imageSrc)) return;
    const logoUrl = imageSrc
      ? new URL(imageSrc.replaceAll(' ', '%20'), LISTING_URL).href
      : null;
    const existing = chapters.get(slug);
    if (!existing || (!existing.listingLogoUrl && logoUrl)) {
      chapters.set(slug, {
        slug,
        sourceUrl: detailUrl.href,
        listingLogoUrl: logoUrl,
      });
    }
  });
  return [...chapters.values()];
}

function cleanText(value) {
  return String(value || '')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeText(value) {
  return cleanText(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/\b(?:phone|mobile|telephone|tel)\s*[:#-]?\s*(?:\+?\d[\d ().-]{7,}\d)/gi, '')
    .replace(/(^|[^\d])\+?(?:\d[\s().-]*){9,14}\d(?!\d)/g, '$1')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function visibleText($, node) {
  const copy = $(node).clone();
  copy.find('script,style,noscript,svg').remove();
  return sanitizeText(copy.text());
}

function textWithParagraphs($, node) {
  const paragraphs = $(node).find('p').toArray()
    .map((paragraph) => visibleText($, paragraph))
    .filter(Boolean);
  const text = paragraphs.length ? paragraphs.join('\n\n') : visibleText($, node);
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function normalizedNameFromHeading(heading) {
  let name = cleanText(heading);
  if (/^about\b/i.test(name)) name = name.replace(/^about\b\s*/i, '').trim();
  name = name.replace(/^(?:the\s+)?chapter$/i, '').trim();
  return name || null;
}

function humanizeLogoName(url) {
  if (!url) return null;
  const basename = path.posix.basename(new URL(url).pathname).replace(/\.[^.]+$/, '');
  const humanized = basename
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return humanized || null;
}

function getAboutSection($) {
  const about = $('#about').first();
  if (about.length) {
    const inner = about.find('.home-about').first();
    return inner.length ? inner : about;
  }
  const heading = $('h1,h2,h3,h4,h5,h6').filter((_, node) => /^about\b/i.test(cleanText($(node).text()))).first();
  return heading.length ? heading.parent() : null;
}

function isEventHeading(text) {
  return /\b(events?|activities|programmes?|programs?)\b/i.test(text)
    && !/\bblogs?\b/i.test(text);
}

function eventSectionForHeading($, heading) {
  let current = $(heading).parent();
  while (current.length && !current.is('body')) {
    const id = (current.attr('id') || '').toLowerCase();
    const classes = (current.attr('class') || '').toLowerCase();
    if (/(^|[-_])(future|events?|activities|programmes?|programs?)([-_]|$)/.test(id)
      || /\bpart\b/.test(classes)) return current;
    current = current.parent();
  }
  return $(heading).parent();
}

function listItemsInSection($, section) {
  const items = [];
  $(section).find('li').each((_, item) => {
    if ($(item).parents('li').toArray().some((parent) => $(parent).closest(section).length)) return;
    items.push(item);
  });
  return items;
}

function textWithoutNestedLists($, item) {
  const copy = $(item).clone();
  const nested = copy.children('ol,ul').toArray();
  for (const list of nested) $(list).remove();
  const nestedText = nested.flatMap((list) => $(list).find('li').toArray().map((entry) => visibleText($, entry)));
  return {
    main: sanitizeText(copy.text()),
    nested: nestedText.map(sanitizeText).filter(Boolean),
  };
}

function eventTypeGuess(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const rules = [
    ['workshop', /\bworkshop|hands-on|hands on|training camp\b/, 'Explicit workshop or hands-on training language'],
    ['sports', /\bsport|tournament|match|racing|athletic|fitness\b/, 'Sports, competition, or racing language'],
    ['cultural', /\bcultural|dance|music|theatre|theater|film|cinema|drama|art exhibition\b/, 'Cultural, performing arts, or film language'],
    ['academic', /\bacademic|lecture|research|science|physics|mathematics|seminar|expert talk\b/, 'Academic, research, science, or lecture language'],
    ['technical', /\btechnical|technology|coding|programming|engineering|robotics|software|welding|design software\b/, 'Technical or engineering language'],
  ];
  const match = rules.find(([, pattern]) => pattern.test(text));
  return match
    ? { type: match[0], rationale: match[2] }
    : { type: 'other', rationale: 'No specific event-type indicator found; defaulted to other' };
}

async function readClubOverrides() {
  let contents;
  try {
    contents = await fs.readFile(OVERRIDES_FILE, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }

  const parsed = JSON.parse(contents);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('club-overrides.json must contain an object keyed by chapter slug.');
  }

  for (const [slug, override] of Object.entries(parsed)) {
    if (!override || typeof override !== 'object' || Array.isArray(override)) {
      throw new Error(`Override for ${slug} must be an object.`);
    }
    const unexpected = Object.keys(override).filter((key) => !['name', 'category', 'eventType'].includes(key));
    if (unexpected.length) {
      throw new Error(`Override for ${slug} has unsupported field(s): ${unexpected.join(', ')}.`);
    }
    if (override.name !== undefined && (typeof override.name !== 'string' || !override.name.trim())) {
      throw new Error(`Override name for ${slug} must be a non-empty string.`);
    }
    if (override.category !== undefined && !CATEGORY_NAMES.has(override.category)) {
      throw new Error(`Override category for ${slug} must be one of: ${[...CATEGORY_NAMES].join(', ')}.`);
    }
    if (override.eventType !== undefined && !EVENT_TYPES.has(override.eventType)) {
      throw new Error(`Override eventType for ${slug} must be one of: ${[...EVENT_TYPES].join(', ')}.`);
    }
  }
  return parsed;
}

function isClearlyNonProgram(text) {
  const normalized = cleanText(text).replace(/^(?:\d+[.)]\s*|[●•-]\s*)/, '');
  const firstSentence = normalized.split(/[.!?](?:\s|$)/, 1)[0];
  return normalized.length > 90
      && /^(?:(?:our|the)\s+)?(?:[\p{L}\d’'-]+\s+){0,4}(?:has|have|will|were|was|is|are|collaborated)\b/iu.test(firstSentence)
    || /^in \d{4},?\s+we will\b/i.test(normalized)
    || /^impact partner\b/i.test(normalized);
}

function titleFromText(text) {
  const candidate = cleanText(text).replace(/\s+by\s+[\p{Lu}].*$/u, '');
  const separator = /(?:\s-\s|\s–\s|:)/.exec(candidate);
  let title = (separator ? candidate.slice(0, separator.index) : candidate)
    .replace(/[.!?…]+$/, '')
    .replace(/\s*(?:[-–—:]+)\s*$/, '')
    .replace(/[“”"'‘’]/g, '')
    .replace(/\s+by\s+.+$/i, '')
    .trim();
  if (title.length > 60) title = title.replace(/^expert talk on\s+/i, '').trim();
  return title;
}

function legacyTitleFromItem($, item, main) {
  const strong = cleanText($(item).children('strong,b').first().text()
    || $(item).find('strong,b').first().text());
  const colonIndex = main.indexOf(':');
  return (strong
    ? strong.replace(/:\s*$/, '').trim()
    : colonIndex >= 0 ? main.slice(0, colonIndex).trim() : main)
    .slice(0, 150)
    .trim();
}

function eventsFromNumberedStrongItem($, item, sourceOrder, legacyTitle, seen, eventTypeOverride) {
  const strong = $(item).find('strong,b').first();
  if (!/^There were multiple workshops organized throughout the year/i.test(cleanText(strong.text()))) {
    return null;
  }

  const segments = (strong.html() || '').split(/<br\s*\/?>/i);
  const events = [];
  for (const segment of segments) {
    const text = cleanText(cheerio.load(segment).text());
    const match = text.match(/^\s*\d+[.)]\s*(.+?)(?::\s*|\s+-\s+|\s+by\s+)(.*)$/);
    if (!match) continue;

    const title = titleFromText(match[1]);
    if (!title) continue;
    const key = title.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const description = sanitizeText(match[2]);
    const guess = eventTypeOverride
      ? { type: eventTypeOverride, rationale: 'Configured override from club-overrides.json' }
      : eventTypeGuess(title, description);
    events.push({
      title,
      description,
      eventType: guess.type,
      eventTypeGuess: { type: guess.type, rationale: guess.rationale },
      sourceOrder,
      legacyTitle,
    });
  }
  return events;
}

function parseEvents($, eventTypeOverride) {
  const sections = [];
  $('h1,h2,h3,h4,h5,h6').each((_, heading) => {
    if (isEventHeading(cleanText($(heading).text()))) sections.push(eventSectionForHeading($, heading));
  });
  const sectionWithMostItems = sections
    .map((section) => ({ section, items: listItemsInSection($, section) }))
    .sort((a, b) => b.items.length - a.items.length)[0];
  if (!sectionWithMostItems?.items.length) return { events: [], excludedLegacyTitles: [] };

  const seen = new Set();
  const events = [];
  const excludedLegacyTitles = new Set();
  for (const [index, item] of sectionWithMostItems.items.entries()) {
    const { main, nested } = textWithoutNestedLists($, item);
    const legacyTitle = legacyTitleFromItem($, item, main);
    const numberedEvents = eventsFromNumberedStrongItem(
      $, item, index + 1, legacyTitle, seen, eventTypeOverride,
    );
    if (numberedEvents) {
      events.push(...numberedEvents);
      continue;
    }

    const strong = cleanText($(item).find('strong,b').first().text());
    if (isClearlyNonProgram(strong || main)) {
      if (legacyTitle) excludedLegacyTitles.add(legacyTitle);
      continue;
    }
    const linkText = cleanText($(item).find('a').first().text());
    const titleSource = strong || (linkText && linkText.length < main.length ? linkText : main);
    const title = titleFromText(titleSource).slice(0, 150).trim();
    if (!title) continue;
    const key = title.toLocaleLowerCase();
    if (seen.has(key)) {
      if (legacyTitle) excludedLegacyTitles.add(legacyTitle);
      continue;
    }
    seen.add(key);

    const titleIndex = main.toLocaleLowerCase().indexOf(title.toLocaleLowerCase());
    let description = titleIndex >= 0
      ? main.slice(titleIndex + title.length).replace(/^\s*["“”'‘’]?\s*[:：–—-]+\s*/, '')
      : '';
    if (nested.length) description = [description, ...nested].filter(Boolean).join('\n');
    const sanitizedDescription = sanitizeText(description);
    const guess = eventTypeOverride
      ? { type: eventTypeOverride, rationale: 'Configured override from club-overrides.json' }
      : eventTypeGuess(title, sanitizedDescription);
    events.push({
      title,
      description: sanitizedDescription,
      eventType: guess.type,
      eventTypeGuess: { type: guess.type, rationale: guess.rationale },
      sourceOrder: index + 1,
      legacyTitle,
    });
  }
  return { events, excludedLegacyTitles: [...excludedLegacyTitles] };
}

function guessCategory(name, slug, description, events) {
  const chapterText = `${name} ${slug} ${description}`.toLowerCase();
  const eventText = events.map((event) => `${event.title} ${event.description}`).join(' ').toLowerCase();
  const rules = [
    ['Cultural', /\bcultural|dance|music|theatre|theater|cinema|film|performing arts|spic.?macay|raag|malang|nirvana|renesa|kirdaar|artistic|painting|sculpture|photography\b/, 0.88, 'Cultural, music, film, visual-art, or performing-arts activity is indicated'],
    ['Sports', /\bsports?|athletic|football|cricket|basketball|fitness\b/, 0.90, 'Sports or athletic activity is indicated'],
    ['Literary', /\bliterary|literature|poetry|writers?|reading club\b/, 0.92, 'Literary or writing activities are explicitly indicated'],
    ['Social Service', /\bsocial service|community development|rural development|ngo|volunteer|social impact|chintan\b/, 0.88, 'Community service or social-impact activities are indicated'],
    ['Technical', /\btechnical|technology|coding|programming|engineering|robotics|automotive|welding|electronics|developer\b/, 0.82, 'Technical or engineering activity is indicated'],
    ['Academic', /\bacademic|physics|science|research|mathematics|scholastic|study circle\b/, 0.82, 'Academic or research-oriented activity is indicated'],
  ];
  const match = rules.find(([, pattern]) => pattern.test(chapterText))
    || rules.find(([, pattern]) => pattern.test(eventText));
  if (match) return { name: match[0], confidence: match[2], rationale: match[3] };
  return {
    name: 'Academic',
    confidence: 0.35,
    rationale: 'No clear category indicators found; Academic is a low-confidence provisional guess',
  };
}

function parseContacts($) {
  const contacts = [];
  const rolePattern = /\b(faculty|prof\.?|dr\.?|chair|head|secretary|treasurer|coordinator|manager|president|convener|advisor|member|lead|director|professor)\b/i;
  const addContact = (nameValue, designationValue) => {
    const name = sanitizeText(nameValue);
    const designation = sanitizeText(designationValue);
    if (!name || !designation || (rolePattern.test(name) && !/^Dr\.?\s+\S+/i.test(name))) return;
    if (/^\d[\d ().+-]*$/.test(designation)) return;
    if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(name)) return;
    if (contacts.some((contact) => contact.name.toLowerCase() === name.toLowerCase()
      && contact.designation.toLowerCase() === designation.toLowerCase())) return;
    contacts.push({
      name: name.slice(0, 100),
      designation: designation.slice(0, 100),
      isFaculty: /^(?:faculty\b|dr\.?|prof\.?)/i.test(designation),
      displayOrder: contacts.length + 1,
    });
  };
  const tables = $('#contact table').toArray();
  for (const table of tables) {
    const rows = $(table).find('tr').toArray().map((row) => {
      const cells = $(row).children('th,td').toArray().map((cell) => ({
        text: cleanText($(cell).clone().find('a[href^="mailto:"]').remove().end().text()),
        hasEmail: /mailto:/i.test($(cell).html() || '') || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test($(cell).text()),
      }));
      return cells;
    }).filter((row) => row.some((cell) => cell.text));
    let hasInlinePairs = false;
    for (const row of rows) {
      for (const cell of row) {
        const separator = cell.text.indexOf(':');
        if (separator <= 0) continue;
        const name = cell.text.slice(0, separator).trim();
        const designation = cell.text.slice(separator + 1).trim();
        if (!designation || /\d{7,}/.test(designation) || !rolePattern.test(designation)) continue;
        addContact(name, designation);
        hasInlinePairs = true;
      }
    }
    if (hasInlinePairs) continue;

    const nameRowIndex = rows.findIndex((row) => row.some((cell) => cell.text) && !row.every((cell) => cell.hasEmail));
    if (nameRowIndex < 0) continue;
    const nameRow = rows[nameRowIndex];
    let designationRow = null;
    for (let rowIndex = nameRowIndex + 1; rowIndex < Math.min(rows.length, nameRowIndex + 4); rowIndex += 1) {
      const candidate = rows[rowIndex];
      if (candidate.length && candidate.some((cell) => cell.text)
        && !candidate.every((cell) => cell.hasEmail)
        && candidate.some((cell) => rolePattern.test(cell.text))) {
        designationRow = candidate;
        break;
      }
    }

    nameRow.forEach((cell, index) => {
      const name = sanitizeText(cell.text);
      const designation = sanitizeText(designationRow?.[index]?.text || '');
      if (!cell.hasEmail) addContact(name, designation);
    });
  }
  return contacts;
}

function platformForUrl(url, anchor, $) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  for (const [domain, platform] of SOCIAL_DOMAINS) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) return platform;
  }
  const inBlogSection = $(anchor).closest('#blog,.blog,[id*="blog" i],[class*="blog" i]').length > 0;
  if (inBlogSection) return 'blog';
  const text = cleanText($(anchor).text());
  const footerOrNav = $(anchor).closest('footer,nav,[class*="footer" i],[class*="menu" i]').length > 0;
  if (footerOrNav && /\b(website|official site|homepage|home page)\b/i.test(text)) return 'website';
  return null;
}

function getClubContactEmail($, slug, name) {
  const tokens = new Set(
    `${slug} ${name}`.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 1),
  );
  const genericAliases = new Set(['info', 'contact', 'office', 'club', 'team', 'society', 'chapter']);
  const candidates = [];
  const addIfGeneric = (rawAddress) => {
    const address = rawAddress.trim().toLowerCase();
    const match = address.match(/^([a-z0-9._+-]+)@svnit\.ac\.in$/);
    if (!match) return;
    const local = match[1];
    if (genericAliases.has(local)
      || [...tokens].some((token) => local === token || local.replace(/[._+-]/g, '').includes(token))) {
      candidates.push(address);
    }
  };
  $('a[href^="mailto:"]').each((_, anchor) => {
    if ($(anchor).closest('#contact').length) return;
    addIfGeneric(($(anchor).attr('href') || '').slice(7).split('?')[0]);
  });
  const pageText = $('body').clone().find('#contact').remove().text();
  for (const match of pageText.matchAll(/\b[A-Z0-9._+-]+@svnit\.ac\.in\b/gi)) addIfGeneric(match[0]);
  return [...new Set(candidates)][0] || null;
}

function parseChapter(record, html, override = {}) {
  const $ = cheerio.load(html);
  const heading = $('.home-about h1,.home-about h2,.home-about h3,#about h1,#about h2,#about h3')
    .toArray()
    .map((node) => cleanText($(node).text()))
    .find((text) => /^about\b/i.test(text) && normalizedNameFromHeading(text));
  const aboutName = heading ? normalizedNameFromHeading(heading) : null;
  const aboutSection = getAboutSection($);
  const description = aboutSection ? textWithParagraphs($, aboutSection) : '';
  const leadName = description.match(/^([A-Z][A-Z0-9& ]{1,24})\s+(?:is|was|serves)\b/)?.[1]?.trim() || null;
  const detectedName = aboutName || leadName || humanizeLogoName(record.listingLogoUrl);
  const name = override.name || detectedName;
  const nameSource = override.name
    ? 'club-overrides.json'
    : aboutName ? 'page heading' : leadName ? 'chapter title in About text' : record.listingLogoUrl ? 'listing logo filename' : 'missing';
  const { events, excludedLegacyTitles } = parseEvents($, override.eventType);
  const categoryGuess = override.category
    ? { name: override.category, confidence: 1, rationale: 'Configured override from club-overrides.json' }
    : guessCategory(name || '', record.slug, description, events);
  const contacts = parseContacts($);
  const headerLogo = $('header img,.menu-logo img,#navbar img,.home.page > img,#about > img')
    .toArray()
    .map((image) => $(image).attr('src'))
    .find(Boolean);
  const headerLogoUrl = headerLogo
    ? new URL(headerLogo.replaceAll(' ', '%20'), record.sourceUrl).href
    : null;
  const logoUrl = record.listingLogoUrl || headerLogoUrl;
  const links = [];
  $('a[href]').each((_, anchor) => {
    const href = $(anchor).attr('href');
    if (!href || /^(?:mailto:|javascript:|#)/i.test(href)) return;
    const absolute = new URL(href.replaceAll(' ', '%20'), record.sourceUrl);
    if (!['http:', 'https:'].includes(absolute.protocol)) return;
    const platform = platformForUrl(absolute.href, anchor, $);
    if (platform) links.push({ platform, url: absolute.href });
  });
  const uniqueLinks = [...new Map(links.map((link) => [`${link.platform}:${link.url}`, link])).values()];
  const hasContactSection = $('#contact').length > 0
    || $('h1,h2,h3,h4,h5,h6').toArray().some((node) => /contact us/i.test(cleanText($(node).text())));
  const warnings = [];
  if (!aboutName) warnings.push(`Name guessed from ${nameSource}; confirm the display name.`);
  if (!name) warnings.push('No name found in heading or logo filename.');
  if (!description) warnings.push('No chapter About description found.');
  if (!events.length) warnings.push('No event list items found; prose-only event descriptions were not split or invented.');
  if (!hasContactSection) warnings.push('No Contact section found.');
  if (!contacts.length) warnings.push('No name/designation contact pairs found.');
  if (!uniqueLinks.length) warnings.push('No supported website, social, or blog links found.');
  if (!logoUrl) warnings.push('No listing or header logo URL found.');
  if (categoryGuess.confidence < 0.6) warnings.push('Category guess has low confidence.');
  if (events.some((event) => event.eventType === 'other')) warnings.push('One or more event types defaulted to other; review per-event guesses.');

  return {
    slug: record.slug,
    sourceUrl: record.sourceUrl,
    name,
    nameSource,
    nameGuessed: !aboutName && !override.name,
    tagline: null,
    description,
    categoryGuess,
    contactEmail: getClubContactEmail($, record.slug, name || ''),
    events,
    excludedLegacyTitles,
    contacts: contacts.map(({ name: contactName, designation, isFaculty }) => ({
      name: contactName,
      designation,
      isFaculty,
    })),
    links: uniqueLinks,
    listingLogoUrl: record.listingLogoUrl,
    headerLogoUrl,
    logoUrl,
    logoOk: Boolean(logoUrl && /^https:\/\/www\.svnit\.ac\.in\//i.test(logoUrl)
      && /\.(?:png|jpe?g|webp|svg)(?:[?#]|$)/i.test(logoUrl)),
    warnings,
  };
}

function applyClubOverride(club, override) {
  if (!override) return club;
  return {
    ...club,
    ...(override.name ? {
      name: override.name.trim(),
      nameSource: 'club-overrides.json',
      nameGuessed: false,
    } : {}),
    ...(override.category ? {
      categoryGuess: {
        name: override.category,
        confidence: 1,
        rationale: 'Configured override from club-overrides.json',
      },
    } : {}),
    ...(override.eventType ? {
      events: club.events.map((event) => ({
        ...event,
        eventType: override.eventType,
        eventTypeGuess: {
          type: override.eventType,
          rationale: 'Configured override from club-overrides.json',
        },
      })),
    } : {}),
  };
}

function addMonths(date, months) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function formatSqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function overlaps(start, end, otherStart, otherEnd) {
  return start < otherEnd && end > otherStart;
}

function planEvents(clubs, venues, busyEvents, importDate = new Date()) {
  const startDate = new Date(importDate);
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(startDate.getUTCDate() + 14);
  const horizon = addMonths(startDate, 11);
  const busy = busyEvents.map((event) => ({
    venueId: Number(event.venue_id),
    start: event.start_datetime instanceof Date ? event.start_datetime : new Date(event.start_datetime),
    end: event.end_datetime instanceof Date ? event.end_datetime : new Date(event.end_datetime),
  }));
  const dayUsage = new Map();
  const eventsByRound = [];
  const maxEvents = Math.max(0, ...clubs.map((club) => club.events.length));
  for (let index = 0; index < maxEvents; index += 1) {
    for (const club of clubs) {
      if (club.events[index]) eventsByRound.push({ club, event: club.events[index] });
    }
  }

  let venueOffset = 0;
  const plan = [];
  const dayCount = Math.max(1, Math.floor((horizon.getTime() - startDate.getTime()) / 86400000));
  for (const [eventIndex, item] of eventsByRound.entries()) {
    let assignment = null;
    const targetOffset = eventsByRound.length > 1
      ? Math.round(eventIndex * (dayCount - 1) / (eventsByRound.length - 1))
      : 0;
    const cursor = new Date(startDate);
    cursor.setUTCDate(cursor.getUTCDate() + targetOffset);
    while (cursor < horizon && !assignment) {
      const weekday = cursor.getUTCDay();
      const key = dateKey(cursor);
      if (weekday !== 0) {
        const used = dayUsage.get(key) || { slots: new Set(), venues: new Set() };
        const slotOptions = [
          { startHour: 10, endHour: 13 },
          { startHour: 14, endHour: 17 },
        ];
        for (const slot of slotOptions) {
          if (used.slots.has(slot.startHour)) continue;
          const start = new Date(cursor);
          start.setUTCHours(slot.startHour, 0, 0, 0);
          const end = new Date(cursor);
          end.setUTCHours(slot.endHour, 0, 0, 0);
          for (let offset = 0; offset < venues.length; offset += 1) {
            const venueIndex = (venueOffset + offset) % venues.length;
            const venue = venues[venueIndex];
            const venueId = Number(venue.venue_id);
            if (used.venues.has(venueId)) continue;
            if (busy.some((event) => event.venueId === venueId
              && overlaps(start, end, event.start, event.end))) continue;
            assignment = { start, end, venue, venueId, slot };
            venueOffset = (venueIndex + 1) % venues.length;
            break;
          }
          if (assignment) break;
        }
        if (assignment) {
          used.slots.add(assignment.slot.startHour);
          used.venues.add(assignment.venueId);
          dayUsage.set(key, used);
          busy.push({ venueId: assignment.venueId, start: assignment.start, end: assignment.end });
        }
      }
      if (!assignment) cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    if (!assignment) throw new Error(`Could not fit all events before the 11-month horizon (currently ${plan.length} assigned).`);
    plan.push({
      slug: item.club.slug,
      clubName: item.club.name,
      title: item.event.title,
      startDatetime: formatSqlDateTime(assignment.start),
      endDatetime: formatSqlDateTime(assignment.end),
      date: dateKey(assignment.start),
      venueId: assignment.venueId,
      venue: assignment.venue.name,
    });
  }
  return plan;
}

async function loadDbPools() {
  dotenv.config({ path: path.join(BACKEND_DIR, '.env') });
  return import('../src/config/db.js');
}

async function loadPlanningContext() {
  const { readPool } = await loadDbPools();
  try {
    const [venues] = await readPool.execute(
      'SELECT venue_id, name FROM venues ORDER BY venue_id',
    );
    if (!venues.length) throw new Error('No existing venues found in `venues`; cannot plan without inventing a venue.');
    const [busyEvents] = await readPool.execute(
      `SELECT venue_id, start_datetime, end_datetime
         FROM events
        WHERE status <> 'cancelled'
          AND start_datetime < DATE_ADD(NOW(), INTERVAL 12 MONTH)
          AND end_datetime > NOW()`,
    );
    const [admins] = await readPool.execute(
      "SELECT user_id FROM users WHERE role = 'admin' ORDER BY user_id LIMIT 1",
    );
    return { venues, busyEvents, adminId: admins[0]?.user_id ?? null };
  } finally {
    await readPool.end();
  }
}

function printReview(review) {
  const columns = ['slug', 'name', 'category guess', '#events', '#contacts', '#links', 'logo ok', 'warnings'];
  const rows = review.clubs.map((club) => [
    club.slug,
    club.name || '(missing)',
    `${club.categoryGuess.name} (${club.categoryGuess.confidence.toFixed(2)})`,
    String(club.events.length),
    String(club.contacts.length),
    String(club.links.length),
    club.logoOk ? 'yes' : 'no',
    club.warnings.join('; ') || '—',
  ]);
  const widths = columns.map((column, index) => Math.max(
    column.length,
    ...rows.map((row) => row[index].length),
  ));
  const printRow = (row) => console.log(`| ${row.map((value, index) => value.padEnd(widths[index])).join(' | ')} |`);
  printRow(columns);
  console.log(`|-${widths.map((width) => '-'.repeat(width)).join('-|-')}-|`);
  rows.forEach(printRow);
  console.log(`\nFirst ${Math.min(10, review.plannedEvents.length)} planned events:`);
  for (const event of review.plannedEvents.slice(0, 10)) {
    console.log(`${event.date} ${event.startDatetime.slice(11, 16)}-${event.endDatetime.slice(11, 16)} | ${event.venue} | ${event.clubName} - ${event.title}`);
  }
  console.log(`\nReview JSON: ${REVIEW_FILE}`);
  console.log(`Total chapters: ${review.clubs.length}; total events: ${review.clubs.reduce((sum, club) => sum + club.events.length, 0)}; planned: ${review.plannedEvents.length}.`);
  if (review.nameGuesses.length) {
    console.log('\nGuessed names (please review):');
    for (const guess of review.nameGuesses) console.log(`- ${guess.slug}: ${guess.name}`);
  }
  if (!review.adminId) {
    console.log('\nNo admin user was found. Before importing, run `npm run seed:users` and re-run the dry run.');
  }
}

async function runDryRun() {
  const overrides = await readClubOverrides();
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const cachedListing = await fetchAndCache(LISTING_URL, 'listing.html');
  const records = extractListing(cheerio.load(cachedListing));
  if (!records.length) throw new Error('No chapter detail links were found in the listing page.');

  const clubs = [];
  for (const record of records) {
    const html = await fetchAndCache(record.sourceUrl, `${slugFilename(record.slug)}.html`);
    clubs.push(parseChapter(record, html, overrides[record.slug]));
  }
  const planning = await loadPlanningContext();
  const plannedEvents = planEvents(clubs, planning.venues, planning.busyEvents);
  const review = {
    generatedAt: new Date().toISOString(),
    source: LISTING_URL,
    adminId: planning.adminId,
    clubs,
    nameGuesses: clubs.filter((club) => club.nameGuessed).map(({ slug, name, nameSource }) => ({
      slug, name, nameSource,
    })),
    plannedEvents,
  };
  await fs.writeFile(REVIEW_FILE, `${JSON.stringify(review, null, 2)}\n`, 'utf8');
  printReview(review);
}

async function readLogo(url, destination) {
  assertAllowedUrl(url);
  let current = url;
  for (let redirectCount = 0; redirectCount <= 4; redirectCount += 1) {
    const response = await politeRequest(current, { binary: true });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (!response.location) throw new Error(`Logo redirect did not include Location: ${current}`);
      current = assertAllowedUrl(new URL(response.location, current).href).href;
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Logo request failed with HTTP ${response.status}: ${current}`);
    }
    const contentType = response.contentType.split(';')[0].trim().toLowerCase();
    const extension = MIME_EXTENSIONS.get(contentType);
    if (!extension) throw new Error(`Unsupported logo content type "${contentType}": ${url}`);
    if (response.body.length > MAX_LOGO_BYTES) {
      throw new Error(`Logo exceeds 2 MB: ${url}`);
    }
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(`${destination}${extension}`, response.body);
    return extension;
  }
  throw new Error(`Too many logo redirects: ${url}`);
}

function categoryName(club) {
  const value = club.categoryCorrection || club.categoryGuess?.name;
  if (!CATEGORY_NAMES.has(value)) throw new Error(`Invalid category for ${club.slug}: ${value}`);
  return value;
}

async function findFreeSlot(connection, venueIds, candidate, occupiedForDay, reservedDates, horizon) {
  const baseStart = new Date(`${candidate.startDatetime.replace(' ', 'T')}Z`);
  const baseEnd = new Date(`${candidate.endDatetime.replace(' ', 'T')}Z`);
  const baseDate = new Date(`${candidate.date}T00:00:00Z`);
  const baseKey = dateKey(baseDate);
  const plannedUsage = occupiedForDay.get(baseKey) || { venues: new Set(), slots: new Set() };
  const candidateHour = baseStart.getUTCHours();
  if (!plannedUsage.venues.has(candidate.venueId) && !plannedUsage.slots.has(candidateHour)) {
    const [conflicts] = await connection.execute(
      `SELECT event_id
         FROM events
        WHERE venue_id = :venueId
          AND status <> 'cancelled'
          AND start_datetime < :endDatetime
          AND end_datetime > :startDatetime
        LIMIT 1`,
      {
        venueId: candidate.venueId,
        startDatetime: formatSqlDateTime(baseStart),
        endDatetime: formatSqlDateTime(baseEnd),
      },
    );
    if (!conflicts.length) {
      plannedUsage.venues.add(candidate.venueId);
      plannedUsage.slots.add(candidateHour);
      occupiedForDay.set(baseKey, plannedUsage);
      return {
        venueId: candidate.venueId,
        startDatetime: candidate.startDatetime,
        endDatetime: candidate.endDatetime,
      };
    }
  }

  const fallbackStart = new Date(baseDate);
  fallbackStart.setUTCDate(fallbackStart.getUTCDate() + 1);
  for (let date = fallbackStart; date < horizon; date.setUTCDate(date.getUTCDate() + 1)) {
    if (date.getUTCDay() === 0) continue;
    const key = dateKey(date);
    if (reservedDates.has(key)) continue;
    for (const slot of [{ start: 10, end: 13 }, { start: 14, end: 17 }]) {
      const start = new Date(date);
      start.setUTCHours(slot.start, 0, 0, 0);
      const end = new Date(date);
      end.setUTCHours(slot.end, 0, 0, 0);
      const used = occupiedForDay.get(key) || { venues: new Set(), slots: new Set() };
      if (used.slots.has(slot.start)) continue;
      for (const venueId of venueIds) {
        if (used.venues.has(venueId)) continue;
        const [conflicts] = await connection.execute(
          `SELECT event_id
             FROM events
            WHERE venue_id = :venueId
              AND status <> 'cancelled'
              AND start_datetime < :endDatetime
              AND end_datetime > :startDatetime
            LIMIT 1`,
          {
            venueId,
            startDatetime: formatSqlDateTime(start),
            endDatetime: formatSqlDateTime(end),
          },
        );
        if (conflicts.length) continue;
        used.venues.add(venueId);
        used.slots.add(slot.start);
        occupiedForDay.set(key, used);
        return {
          venueId,
          startDatetime: formatSqlDateTime(start),
          endDatetime: formatSqlDateTime(end),
        };
      }
    }
  }
  throw new Error(`No conflict-free venue slot found before the 11-month horizon for "${candidate.title}".`);
}

async function importReview() {
  let review;
  try {
    review = JSON.parse(await fs.readFile(REVIEW_FILE, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('Review file not found. Run `npm run scrape:clubs` first.');
    }
    throw error;
  }
  if (!Array.isArray(review.clubs) || !review.clubs.length) throw new Error('Review file has no clubs to import.');
  const overrides = await readClubOverrides();
  review.clubs = review.clubs.map((club) => applyClubOverride(club, overrides[club.slug]));

  const { readPool, writePool } = await loadDbPools();
  let venues;
  let admins;
  let busyEvents;
  try {
    [venues] = await readPool.execute('SELECT venue_id, name FROM venues ORDER BY venue_id');
    [admins] = await readPool.execute(
      "SELECT user_id FROM users WHERE role = 'admin' ORDER BY user_id LIMIT 1",
    );
    [busyEvents] = await readPool.execute(
      `SELECT venue_id, start_datetime, end_datetime
         FROM events
        WHERE status <> 'cancelled'
          AND start_datetime < DATE_ADD(NOW(), INTERVAL 12 MONTH)
          AND end_datetime > NOW()`,
    );
  } catch (error) {
    await writePool.end();
    throw error;
  } finally {
    await readPool.end();
  }
  if (!admins.length) {
    await writePool.end();
    throw new Error('No admin user exists. Run `npm run seed:users` first; no import was performed.');
  }
  if (!venues.length) {
    await writePool.end();
    throw new Error('No existing venues found; no import was performed.');
  }
  const adminId = admins[0].user_id;
  const plan = planEvents(review.clubs, venues, busyEvents);
  const planByKey = new Map(plan.map((event) => [`${event.slug}\u0000${event.title}`, event]));
  const reservedDates = new Set(plan.map((event) => event.date));
  const firstDate = new Date();
  firstDate.setUTCHours(0, 0, 0, 0);
  firstDate.setUTCDate(firstDate.getUTCDate() + 14);
  const importHorizon = addMonths(firstDate, 11);
  const occupiedForDay = new Map();
  const logoDirectory = path.join(BACKEND_DIR, 'uploads', 'logos');
  const counts = {
    clubsInserted: 0, clubsUpdated: 0, eventsInserted: 0, eventsUpdated: 0, eventsCancelled: 0,
    contacts: 0, links: 0, logosDownloaded: 0, logosReused: 0,
    contactsChanged: 0, linksChanged: 0, skipped: [],
  };

  try {
    for (const club of review.clubs) {
      if (!club.name || !club.sourceUrl) {
        counts.skipped.push(`${club.slug}: missing required name or source URL`);
        continue;
      }
      const category = categoryName(club);
      const [categoryRows] = await writePool.execute(
        'SELECT category_id FROM club_categories WHERE name = :name',
        { name: category },
      );
      if (!categoryRows.length) throw new Error(`Category "${category}" is not present in the database.`);

      let logoPath = null;
      if (club.logoUrl) {
        const base = slugFilename(club.slug);
        for (const extension of MIME_EXTENSIONS.values()) {
          try {
            await fs.access(path.join(logoDirectory, `${base}${extension}`));
            logoPath = `/uploads/logos/${base}${extension}`;
            counts.logosReused += 1;
            break;
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }
        }
        if (!logoPath) {
          const extension = await readLogo(club.logoUrl, path.join(logoDirectory, base));
          logoPath = `/uploads/logos/${base}${extension}`;
          counts.logosDownloaded += 1;
        }
      }

      const connection = await writePool.getConnection();
      try {
        await connection.beginTransaction();
        const [existingClub] = await connection.execute(
          `SELECT club_id, name, description, logo_url, website_url, contact_email, category_id, status
             FROM clubs
            WHERE source_url = :sourceUrl`,
          { sourceUrl: club.sourceUrl },
        );
        const values = {
          name: club.name.slice(0, 100),
          description: club.description || null,
          logoUrl: logoPath,
          websiteUrl: club.links.find((link) => link.platform === 'website')?.url || null,
          contactEmail: club.contactEmail || null,
          categoryId: categoryRows[0].category_id,
        };
        let clubId;
        if (!existingClub.length) {
          const [inserted] = await connection.execute(
            `INSERT INTO clubs
               (name, tagline, description, logo_url, website_url, source_url, contact_email,
                category_id, status, scraped_at)
             VALUES
               (:name, NULL, :description, :logoUrl, :websiteUrl, :sourceUrl, :contactEmail,
                :categoryId, 'active', NOW())`,
            { ...values, sourceUrl: club.sourceUrl },
          );
          clubId = inserted.insertId;
          counts.clubsInserted += 1;
        } else {
          const existing = existingClub[0];
          clubId = existing.club_id;
          const clubChanged = existing.name !== values.name
            || existing.description !== values.description
            || existing.logo_url !== values.logoUrl
            || existing.website_url !== values.websiteUrl
            || existing.contact_email !== values.contactEmail
            || Number(existing.category_id) !== Number(values.categoryId)
            || existing.status !== 'active';
          if (clubChanged) {
            await connection.execute(
              `UPDATE clubs
                  SET name = :name,
                      description = :description,
                      logo_url = :logoUrl,
                      website_url = :websiteUrl,
                      contact_email = :contactEmail,
                      category_id = :categoryId,
                      status = 'active',
                      scraped_at = NOW()
                WHERE club_id = :clubId`,
              { ...values, clubId },
            );
            counts.clubsUpdated += 1;
          }
        }

        const expectedContacts = club.contacts.map((contact, index) => ({
          name: contact.name.slice(0, 100),
          designation: contact.designation.slice(0, 100),
          isFaculty: Boolean(contact.isFaculty),
          displayOrder: index + 1,
        }));
        const [existingContacts] = await connection.execute(
          `SELECT person_name AS name, designation, is_faculty AS isFaculty, display_order AS displayOrder
             FROM club_contacts
            WHERE club_id = :clubId
            ORDER BY display_order, contact_id`,
          { clubId },
        );
        const contactsMatch = existingContacts.length === expectedContacts.length
          && expectedContacts.every((contact, index) => (
            existingContacts[index].name === contact.name
            && existingContacts[index].designation === contact.designation
            && Boolean(existingContacts[index].isFaculty) === contact.isFaculty
            && Number(existingContacts[index].displayOrder) === contact.displayOrder
          ));
        if (!contactsMatch) {
          await connection.execute('DELETE FROM club_contacts WHERE club_id = :clubId', { clubId });
          for (const contact of expectedContacts) {
            await connection.execute(
              `INSERT INTO club_contacts (club_id, person_name, designation, is_faculty, display_order)
               VALUES (:clubId, :name, :designation, :isFaculty, :displayOrder)`,
              { clubId, ...contact },
            );
          }
          counts.contactsChanged += expectedContacts.length;
        }
        counts.contacts += expectedContacts.length;

        const expectedLinks = club.links
          .map(({ platform, url }) => ({ platform, url }))
          .sort((a, b) => a.platform.localeCompare(b.platform) || a.url.localeCompare(b.url));
        const [existingLinks] = await connection.execute(
          `SELECT platform, url
             FROM club_links
            WHERE club_id = :clubId
            ORDER BY platform, url`,
          { clubId },
        );
        const sortedExistingLinks = existingLinks
          .map(({ platform, url }) => ({ platform, url }))
          .sort((a, b) => a.platform.localeCompare(b.platform) || a.url.localeCompare(b.url));
        const linksMatch = sortedExistingLinks.length === expectedLinks.length
          && expectedLinks.every((link, index) => (
            sortedExistingLinks[index].platform === link.platform && sortedExistingLinks[index].url === link.url
          ));
        if (!linksMatch) {
          await connection.execute('DELETE FROM club_links WHERE club_id = :clubId', { clubId });
          for (const link of expectedLinks) {
            await connection.execute(
              'INSERT INTO club_links (club_id, platform, url) VALUES (:clubId, :platform, :url)',
              { clubId, ...link },
            );
          }
          counts.linksChanged += expectedLinks.length;
        }
        counts.links += expectedLinks.length;

        const [existingPlaceholderEvents] = await connection.execute(
          `SELECT event_id, title, description, event_type, status
             FROM events
            WHERE club_id = :clubId AND is_placeholder = TRUE
            ORDER BY (status = 'cancelled'), event_id`,
          { clubId },
        );
        const matchedEventIds = new Set();
        const managedTitles = new Set([
          ...(club.events || []).flatMap((event) => [event.title, event.legacyTitle].filter(Boolean)),
          ...(club.excludedLegacyTitles || []),
        ]);

        for (const event of club.events) {
          const expectedDescription = event.description || null;
          const existingEvent = existingPlaceholderEvents.find((candidate) => (
            !matchedEventIds.has(candidate.event_id) && candidate.title === event.title
          )) || (event.legacyTitle && existingPlaceholderEvents.find((candidate) => (
            !matchedEventIds.has(candidate.event_id) && candidate.title === event.legacyTitle
          )));
          if (existingEvent) {
            matchedEventIds.add(existingEvent.event_id);
            const expectedEventType = EVENT_TYPES.has(event.eventType) ? event.eventType : 'other';
            const expectedTitle = event.title.slice(0, 150);
            if (existingEvent.title !== expectedTitle
                || existingEvent.description !== expectedDescription
                || existingEvent.event_type !== expectedEventType) {
              await connection.execute(
                `UPDATE events
                    SET title = :title, description = :description, event_type = :eventType
                  WHERE event_id = :eventId AND is_placeholder = TRUE`,
                {
                  title: expectedTitle,
                  description: expectedDescription,
                  eventType: expectedEventType,
                  eventId: existingEvent.event_id,
                },
              );
              counts.eventsUpdated += 1;
            }
            continue;
          }
          const candidate = planByKey.get(`${club.slug}\u0000${event.title}`);
          if (!candidate) throw new Error(`No planned placeholder date for ${club.slug}: ${event.title}`);
          const slot = await findFreeSlot(
            connection,
            venues.map((venue) => Number(venue.venue_id)),
            candidate,
            occupiedForDay,
            reservedDates,
            importHorizon,
          );
          await connection.execute(
            `INSERT INTO events
               (club_id, venue_id, title, description, event_type, start_datetime, end_datetime,
                is_tentative, is_placeholder, signup_mode, external_signup_url,
                registration_deadline, max_participants, status, created_by)
             VALUES
               (:clubId, :venueId, :title, :description, :eventType, :startDatetime, :endDatetime,
                TRUE, TRUE, 'none', NULL, NULL, NULL, 'scheduled', :createdBy)`,
            {
              clubId,
              venueId: slot.venueId,
              title: event.title.slice(0, 150),
              description: event.description || null,
              eventType: EVENT_TYPES.has(event.eventType) ? event.eventType : 'other',
              startDatetime: slot.startDatetime,
              endDatetime: slot.endDatetime,
              createdBy: adminId,
            },
          );
          counts.eventsInserted += 1;
        }

        for (const existingEvent of existingPlaceholderEvents) {
          if (matchedEventIds.has(existingEvent.event_id)
              || !managedTitles.has(existingEvent.title)
              || existingEvent.status === 'cancelled') continue;
          await connection.execute(
            `UPDATE events
                SET status = 'cancelled'
              WHERE event_id = :eventId AND is_placeholder = TRUE`,
            { eventId: existingEvent.event_id },
          );
          counts.eventsCancelled += 1;
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw new Error(`Import failed for ${club.slug}; that club's transaction was rolled back: ${error.message}`, { cause: error });
      } finally {
        connection.release();
      }
    }
  } finally {
    await writePool.end();
  }
  console.log(JSON.stringify(counts, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  const modes = args.filter((arg) => arg === '--dry-run' || arg === '--import');
  if (args.some((arg) => !['--dry-run', '--import'].includes(arg)) || modes.length > 1) {
    throw new Error('Usage: node scripts/scrape-svnit-clubs.js [--dry-run | --import]');
  }
  if (!modes.length || modes[0] === '--dry-run') {
    await runDryRun();
    return;
  }
  await importReview();
}

main().catch((error) => {
  console.error(`[scrape-svnit-clubs] ${error.message}`);
  process.exitCode = 1;
});
