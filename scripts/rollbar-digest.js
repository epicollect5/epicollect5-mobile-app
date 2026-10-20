#!/usr/bin/env node
// Weekly digest of the Rollbar issues on the app versions still in production.
//
// The versions are discovered from Rollbar itself, not from a list kept in the
// repo: occurrences carry `client.javascript.code_version` and an environment
// string, so a version can only appear if someone is still running it. For each
// platform the newest version seen wins, and every version within
// `minorLinesBehind` minor lines of it is in scope. Versions older than that are
// reported as a count only: most of their issues are already fixed, so listing
// them is noise.
//
// Output is Markdown on stdout (or JSON with --json). Nothing is written to
// disk and nothing is changed in Rollbar.
//
// Usage:
//   node scripts/rollbar-digest.js [options]
//
//     --days <n>          discovery window in days (default: config.sampleDays)
//     --lines <n>         minor lines behind the newest version (default: 2)
//     --platform <name>   restrict to android / ios, repeatable
//     --evidence <ids>    print the evidence pack for one or more item ids
//                         (comma separated), for triaging an issue
//     --json              machine-readable output
//     --now <iso>         pretend "now" is this instant (tests/debugging)
//     --config <path>     config file (default: scripts/rollbar-digest.config.json)
//
// Token: ROLLBAR_READ_TOKEN, read from the environment or from .env.local at the
// repo root (gitignored). It needs the `read` scope; the post-only tokens the
// app uses cannot read the API.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_BASE = 'https://api.rollbar.com/api/1';
const DAY_MS = 24 * 60 * 60 * 1000;
const ITEMS_PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// Pure helpers (exported for the tests)
// ---------------------------------------------------------------------------

const VERSION_PATTERN = /^(\d+)\.(\d+)(?:\.(\d+))?/;

export const parseVersion = (version) => {
  const match = VERSION_PATTERN.exec(String(version ?? '').trim());
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3] ?? 0)
  };
};

// 98.5.1 < 98.5.2 < 98.6.0
export const compareVersions = (a, b) => {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return -1;
  }
  if (!right) {
    return 1;
  }
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
};

export const compareVersionsDesc = (a, b) => compareVersions(b, a);

const minorIndex = (version) => {
  const parsed = parseVersion(version);
  return parsed ? parsed.major * 1000 + parsed.minor : null;
};

// "android 12 - sm-a125m - webview 155" -> "android". Rollbar stores the
// environment built at src/services/utilities/rollbar-service.js (platform, OS
// version, device model, WebView version) lowercased; anything before init()
// is the literal "unknown".
export const platformOf = (environment) => {
  const value = String(environment ?? '').trim().toLowerCase();
  if (!value || value === 'unknown') {
    return 'unknown';
  }
  const first = value.split(/\s+/)[0];
  if (first === 'android' || first === 'ios') {
    return first;
  }
  return 'other';
};

// Group titles that differ only by ids, uuids or long numbers. Short numbers
// are kept: "status 401" and "status 500" are different problems.
export const normalizeTitle = (title) => {
  return String(title ?? '')
    .trim()
    .toLowerCase()
    .replace(/^uncaught \(in promise\)\s+/, '')
    .replace(/^uncaught\s+/, '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<uuid>')
    .replace(/\b[0-9a-f]{16,}\b/g, '<id>')
    .replace(/\b\d{4,}\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim();
};

// Rollbar telemetry is whatever the app logged, so it carries whatever the
// app had in memory: a real Google access token and idToken turned up in a
// login log, next to the user's email. Everything this script prints or hands
// to a model goes through here first.
//
// Two shapes have to be masked: a key/value pair in free text ("password":"x",
// password=x) and a property of an object. The pair pattern also has to match
// a quoted JSON key, and it must not fire on a word that merely ends in a
// sensitive one ("monkey"), so the key starts on a non-word boundary.
const SENSITIVE_KEY_NAMES = new Set([
  'key', 'token', 'accesstoken', 'refreshtoken', 'idtoken', 'authtoken',
  'sessiontoken', 'apikey', 'secret', 'clientsecret', 'password', 'passwd',
  'pwd', 'authorization', 'otp', 'pin', 'credential', 'credentials', 'privatekey'
]);

const normalizeKey = (key) => String(key ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const isSensitiveKey = (key) => SENSITIVE_KEY_NAMES.has(normalizeKey(key));

// An exception carries its message in plain text, and that message can hold
// whatever the app was working on when it threw.
export const redactException = (exception) => {
  if (!exception || typeof exception !== 'object') {
    return exception;
  }
  return { ...exception, message: redact(exception.message) };
};

const SENSITIVE_ASSIGNMENT = /(?<![A-Za-z0-9])((?:access|auth|id|refresh|session|api)?[_-]?(?:token|key|secret|password|passwd|pwd|authorization|otp|pin|credential)s?)("?\s*[:=]\s*)("[^"]*"|'[^']*'|Bearer\s+[A-Za-z0-9._~+/=-]+|[^\s"',}\]]+)/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]*/g;
const GOOGLE_TOKEN = /\bya29\.[A-Za-z0-9._-]{10,}/g;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const LONG_BLOB = /\b[A-Za-z0-9_-]{40,}\b/g;

export const redact = (value) => {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (typeof value === 'object') {
    // A sensitive property is masked whole: recursing into it would keep any
    // secret sitting under an innocent-looking name.
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      isSensitiveKey(key) ? '<redacted>' : redact(entry)
    ]));
  }
  return String(value)
    .replace(JWT, '<redacted-jwt>')
    .replace(GOOGLE_TOKEN, '<redacted-token>')
    .replace(SENSITIVE_ASSIGNMENT, (_match, key, separator, secret) => {
      const quote = secret.startsWith('"') ? '"' : (secret.startsWith('\'') ? '\'' : '');
      const body = quote ? secret.slice(1, -1) : secret;
      const kind = /^Bearer\b/i.test(body) ? 'Bearer <redacted>' : '<redacted>';
      return `${key}${separator}${quote}${kind}${quote}`;
    })
    .replace(BEARER, 'Bearer <redacted>')
    .replace(EMAIL, '<redacted-email>')
    .replace(LONG_BLOB, '<redacted-blob>');
};

export const isNoise = (title, patterns = []) => {
  const value = String(title ?? '').toLowerCase();
  return patterns.some((pattern) => value.includes(String(pattern).toLowerCase()));
};

// The in-scope versions for one platform: the newest version seen, plus every
// version within `behind` minor lines of it. A QA-failed release simply
// contributes nothing, which is why this is computed from what reported rather
// than from an arithmetic release list.
export const selectVersionsForPlatform = (seen, behind = 2) => {
  const valid = seen.filter((entry) => parseVersion(entry.version));
  if (!valid.length) {
    return { newest: null, window: [], selected: [], ignored: [] };
  }

  const newest = valid.reduce((best, entry) => compareVersions(entry.version, best.version) > 0 ? entry : best);
  const newestIndex = minorIndex(newest.version);
  const lowestIndex = newestIndex - Math.max(0, behind);
  const inWindow = (entry) => {
    const index = minorIndex(entry.version);
    return index !== null && index >= lowestIndex && index <= newestIndex;
  };

  const window = [];
  for (let index = newestIndex; index >= lowestIndex; index -= 1) {
    window.push(`${Math.floor(index / 1000)}.${index % 1000}`);
  }

  return {
    newest,
    window,
    selected: valid.filter(inWindow).sort((a, b) => compareVersionsDesc(a.version, b.version)),
    ignored: valid.filter((entry) => !inWindow(entry)).sort((a, b) => compareVersionsDesc(a.version, b.version))
  };
};

// Normalise an item returned by /items so the rest of the script (and the
// tests) never has to know the API field names.
export const toItem = (raw, version = null) => {
  const hash = String(raw.hash ?? '');
  return {
    id: String(raw.id),
    counter: raw.counter,
    projectId: raw.project_id,
    projectSlug: raw.project_slug ?? null,
    version,
    // An item can be returned by more than one version query, because it was
    // seen on more than one build. The first version is the primary one;
    // `versions` keeps the full list.
    versions: version ? [version] : [],
    environment: String(raw.environment ?? 'unknown'),
    platform: platformOf(raw.environment),
    title: String(raw.title ?? ''),
    // Rollbar sets hash to "cc:<custom context>" when the app reports with a
    // context (see rollbar-service.js), which is far better than the title for
    // locating the code path.
    context: hash.startsWith('cc:') ? hash.slice(3) : '',
    level: raw.level ?? null,
    occurrences: Number(raw.total_occurrences ?? raw.occurrences_count ?? 0),
    firstSeen: Number(raw.first_occurrence_timestamp ?? 0) * 1000,
    lastSeen: Number(raw.last_occurrence_timestamp ?? 0) * 1000
  };
};

export const clusterItems = (items = []) => {
  const clusters = new Map();

  for (const item of items) {
    const key = normalizeTitle(item.title);
    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = {
        key,
        titles: new Map(),
        items: [],
        environments: new Set(),
        platforms: {},
        versions: new Set(),
        occurrences: 0,
        firstSeen: Number.POSITIVE_INFINITY,
        lastSeen: 0
      };
      clusters.set(key, cluster);
    }

    cluster.items.push(item);
    cluster.titles.set(item.title, (cluster.titles.get(item.title) ?? 0) + 1);
    cluster.environments.add(item.environment);
    cluster.platforms[item.platform] = (cluster.platforms[item.platform] ?? 0) + 1;
    for (const version of item.versions ?? (item.version ? [item.version] : [])) {
      cluster.versions.add(version);
    }
    cluster.occurrences += item.occurrences;
    if (item.firstSeen) {
      cluster.firstSeen = Math.min(cluster.firstSeen, item.firstSeen);
    }
    cluster.lastSeen = Math.max(cluster.lastSeen, item.lastSeen);
  }

  return [...clusters.values()].map((cluster) => {
    const title = [...cluster.titles.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];

    return {
      key: cluster.key,
      title,
      context: cluster.items.find((item) => item.context)?.context ?? '',
      items: cluster.items,
      environments: [...cluster.environments],
      platforms: cluster.platforms,
      versions: [...cluster.versions].sort(compareVersionsDesc),
      occurrences: cluster.occurrences,
      firstSeen: Number.isFinite(cluster.firstSeen) ? cluster.firstSeen : 0,
      lastSeen: cluster.lastSeen
    };
  });
};

export const flagCluster = (cluster, options) => {
  const {
    now,
    newSinceDays = 7,
    minEnvironments = 2,
    minOccurrences = 5,
    integrityKeywords = []
  } = options;
  const flags = [];

  if (cluster.firstSeen && cluster.firstSeen >= now - newSinceDays * DAY_MS) {
    flags.push('new');
  }
  if (cluster.environments.length >= minEnvironments) {
    flags.push(`env:${cluster.environments.length}`);
  }
  if (cluster.occurrences >= minOccurrences) {
    flags.push(`occ:${cluster.occurrences}`);
  }

  const haystack = `${cluster.title} ${cluster.context}`.toLowerCase();
  if (integrityKeywords.some((keyword) => haystack.includes(String(keyword).toLowerCase()))) {
    flags.push('data-integrity');
  }

  const platforms = Object.keys(cluster.platforms).filter((name) => cluster.platforms[name] > 0);
  if (platforms.includes('android') && platforms.includes('ios')) {
    flags.push('cross-platform');
  }

  return flags;
};

// "Nothing to report" is the one output that cannot be told apart from a
// healthy week, so a collection that looks broken is retried before it is
// reported. These are the shapes that mean the API misbehaved, not the app
// being quiet.
export const findRetryReason = ({ sample, versionEvidence } = {}) => {
  // The occurrence sample came back empty. The app cannot have zero errors
  // and zero sampled occurrences at the same time.
  if (!sample?.instances) {
    return 'the occurrence sample came back empty';
  }

  return findBrokenReason({ versionEvidence });
};

// The subset of the above that cannot be a quiet week: a version had a stream
// of occurrences, yet its item query returned nothing at all — neither active
// nor resolved. A collection in this state is not a report about the app, it
// is a broken API contract, and publishing it would call the failure a quiet
// week.
export const findBrokenReason = ({ versionEvidence = [] } = {}) => {
  for (const entry of versionEvidence) {
    if (entry.sampled >= 20 && entry.active === 0 && entry.resolved === 0) {
      return `${entry.sampled} occurrences were sampled for version ${entry.version} but no active or resolved items came back`;
    }
  }

  return null;
};

// Backoff between collection attempts: long enough for a rate limit to clear,
// short enough that a slow week does not turn into a long one.
export const collectionRetryDelayMs = (attempt) => Math.min(5000 * 2 ** attempt, 60000);

// One representative occurrence reduced to what a code-level triage needs.
// Input values are dropped on purpose: Rollbar telemetry records the value
// typed into form fields, which for this app is user research data.
export const condenseTelemetry = (events = [], limit = 30) => {
  const mapped = events.map((event) => {
    const body = event.body ?? {};
    let detail = '';

    if (typeof body === 'string') {
      detail = body;
    } else if (body.message) {
      detail = String(body.message);
    } else if (body.subtype) {
      const element = String(body.element ?? '').split('>').pop().trim();
      detail = `${body.subtype}${element ? ` ${element.slice(0, 80)}` : ''}`;
    } else {
      detail = String(event.type ?? '');
    }

    return {
      time: event.timestamp_ms ? new Date(event.timestamp_ms).toISOString() : null,
      type: event.type ?? null,
      level: event.level ?? null,
      detail: redact(detail)
    };
  });

  // "Got location" repeated every second for a minute says nothing the first
  // line does not; collapse runs so the error stays inside the window.
  const collapsed = [];
  for (const event of mapped) {
    const previous = collapsed[collapsed.length - 1];
    if (previous && previous.type === event.type && previous.level === event.level && previous.detail === event.detail) {
      previous.repeat += 1;
      previous.time = event.time;
    } else {
      collapsed.push({ ...event, repeat: 1 });
    }
  }

  return collapsed.slice(-limit);
};

const formatDate = (ms, timeZone) => {
  if (!ms) {
    return 'n/a';
  }
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(ms));
};

const formatDay = (ms, timeZone) => {
  if (!ms) {
    return 'n/a';
  }
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: 'short'
  }).format(new Date(ms));
};

const plural = (count, singular, pluralForm = `${singular}s`) => {
  return `${count} ${count === 1 ? singular : pluralForm}`;
};

const itemUrl = (config, item) => {
  return item.counter && config.dashboardBaseUrl ? `${config.dashboardBaseUrl}/${item.counter}` : null;
};

const toJsonItem = (item) => ({
  id: item.id,
  counter: item.counter,
  version: item.version,
  versions: item.versions ?? (item.version ? [item.version] : []),
  environment: item.environment,
  platform: item.platform,
  title: redact(item.title),
  context: redact(item.context),
  level: item.level,
  occurrences: item.occurrences,
  firstSeen: item.firstSeen ? new Date(item.firstSeen).toISOString() : null,
  lastSeen: item.lastSeen ? new Date(item.lastSeen).toISOString() : null
});

const toJsonCluster = (cluster) => ({
  key: redact(cluster.key),
  title: redact(cluster.title),
  context: redact(cluster.context),
  flags: cluster.flags,
  noise: cluster.noise,
  occurrences: cluster.occurrences,
  environments: cluster.environments.length,
  platforms: cluster.platforms,
  versions: cluster.versions,
  firstSeen: cluster.firstSeen ? new Date(cluster.firstSeen).toISOString() : null,
  lastSeen: cluster.lastSeen ? new Date(cluster.lastSeen).toISOString() : null,
  items: cluster.items.map(toJsonItem)
});

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// Rollbar answers a throttled request with either a seconds-to-wait header or
// the epoch second the limit resets at. Honour both, so a retry does not just
// run into the same wall.
const retryDelayMs = (response, attempt = 0) => {
  if (response) {
    const reset = Number(response.headers.get('x-rate-limit-reset'));
    if (Number.isFinite(reset) && reset > 0) {
      const untilReset = reset * 1000 - Date.now();
      if (untilReset > 0) {
        return Math.min(untilReset, 120000);
      }
    }
    const seconds = Number(response.headers.get('x-rate-limit-remaining-seconds') ?? response.headers.get('retry-after') ?? 5);
    return Math.min(Math.max(Number.isFinite(seconds) ? seconds : 5, 1), 60) * 1000;
  }

  // No response at all: the connection failed. Back off on its own.
  return Math.min(5000 * 2 ** attempt, 60000);
};

export const createClient = (token, { maxRetries = 4, fetchImpl = fetch, sleepImpl = sleep } = {}) => {
  const stats = { requests: 0, minRemaining: null, retries: 0 };

  const request = async (path, params = {}) => {
    const url = new URL(`${API_BASE}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    for (let attempt = 0; ; attempt += 1) {
      let response;
      try {
        response = await fetchImpl(url, {
          headers: { 'X-Rollbar-Access-Token': token },
          signal: AbortSignal.timeout(60000)
        });
      } catch (error) {
        // A timeout or a dropped connection rejects before there is a status
        // to inspect, so it has to be retried here or it ends the whole run.
        if (attempt >= maxRetries) {
          throw new Error(`${path} -> ${error?.message ?? 'network error'} after ${attempt + 1} attempts`);
        }
        stats.retries += 1;
        await sleepImpl(retryDelayMs(null, attempt));
        continue;
      }

      stats.requests += 1;
      const remaining = Number(response.headers.get('x-rate-limit-remaining'));
      if (Number.isFinite(remaining)) {
        stats.minRemaining = stats.minRemaining === null ? remaining : Math.min(stats.minRemaining, remaining);
      }

      if (response.status === 429 || response.status >= 500) {
        if (attempt >= maxRetries) {
          throw new Error(`${path} -> HTTP ${response.status} after ${attempt + 1} attempts`);
        }
        stats.retries += 1;
        await sleepImpl(retryDelayMs(response));
        continue;
      }

      const body = await response.json().catch(() => null);
      if (!response.ok || !body || body.err) {
        const message = body?.message ?? response.statusText;
        throw new Error(`${path} -> HTTP ${response.status} ${message}`);
      }

      return body.result;
    }
  };

  return {
    stats,
    request,
    listProjects: () => request('/projects'),
    listItems: (params) => request('/items', params),
    listInstances: (params) => request('/instances', params),
    getItem: (itemId, projectId) => request(`/item/${itemId}`, { project_id: projectId }),
    getInstance: (instanceId, projectId) => request(`/instance/${instanceId}`, { project_id: projectId })
  };
};

// ---------------------------------------------------------------------------
// Data collection
// ---------------------------------------------------------------------------

const resolveProject = async (client, projectName) => {
  const projects = await client.listProjects();
  const project = (projects ?? []).find((entry) => entry.name === projectName);
  if (!project) {
    throw new Error(`project "${projectName}" not visible to this token`);
  }
  return project;
};

const sampleOccurrences = async (client, { projectId, now, days, pageSize, maxPages }) => {
  const floor = now - days * DAY_MS;
  const byPlatform = new Map();
  const stats = {
    pages: 0,
    occurrences: 0,
    instances: 0,
    throttled: 0,
    oldest: null,
    newest: null,
    unknownPlatform: 0
  };

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await client.listInstances({ project_id: projectId, limit: pageSize, page });
    const batch = result?.instances ?? [];
    stats.pages = page;

    if (!batch.length) {
      break;
    }

    let oldestInBatch = Number.POSITIVE_INFINITY;

    for (const instance of batch) {
      const data = instance.data ?? {};
      const timestamp = Number(instance.timestamp ?? 0) * 1000;
      if (timestamp) {
        stats.oldest = stats.oldest === null ? timestamp : Math.min(stats.oldest, timestamp);
        stats.newest = stats.newest === null ? timestamp : Math.max(stats.newest, timestamp);
        oldestInBatch = Math.min(oldestInBatch, timestamp);
      }

      // A page can straddle the cutoff. Those records still stop the
      // pagination, but they must not select a version or inflate a count:
      // the report covers the window, not everything Rollbar still holds.
      if (timestamp && timestamp < floor) {
        continue;
      }

      stats.instances += 1;

      // The SDK drops errors beyond itemsPerMinute (1 in this app) and reports
      // this message instead, so occurrence counts are a lower bound.
      const message = String(data.body?.message?.body ?? data.body?.message ?? '');
      if (message.toLowerCase().includes('item per minute limit reached')) {
        stats.throttled += 1;
      }

      const version = String(data.client?.javascript?.code_version ?? '').trim();
      const platform = platformOf(data.environment);
      if (!version || !parseVersion(version)) {
        continue;
      }
      if (platform === 'unknown' || platform === 'other') {
        stats.unknownPlatform += 1;
        continue;
      }

      if (!byPlatform.has(platform)) {
        byPlatform.set(platform, new Map());
      }
      const versions = byPlatform.get(platform);
      const entry = versions.get(version) ?? { version, occurrences: 0, lastSeen: 0 };
      entry.occurrences += 1;
      entry.lastSeen = Math.max(entry.lastSeen, timestamp);
      versions.set(version, entry);
      stats.occurrences += 1;
    }

    if (oldestInBatch <= floor || batch.length < pageSize) {
      break;
    }
  }

  return { byPlatform, stats };
};

const fetchItems = async (client, { projectId, version, maxPages, status = 'active' }) => {
  const items = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await client.listItems({
      status,
      query: version ? `code_version:"${version}"` : undefined,
      environment: version ? undefined : 'unknown',
      limit: ITEMS_PAGE_SIZE,
      page
    });
    const batch = result?.items ?? [];
    items.push(...batch.map((raw) => toItem(raw, version)));

    const total = Number(result?.total_count);
    if (batch.length < ITEMS_PAGE_SIZE || (Number.isFinite(total) && items.length >= total)) {
      break;
    }
  }

  return items;
};

// One collection pass: sample the occurrences, decide which versions are in
// scope, then fetch the items for them. Exported so the shape it returns is
// the one the retry decision is tested against.
export const collectDigest = async (client, {
  projectId,
  now,
  days,
  linesBehind,
  onlyPlatforms = [],
  noisePatterns = [],
  pageSize = 100,
  maxSamplePages = 16,
  maxPagesPerVersion = 5
}) => {
  const sample = await sampleOccurrences(client, {
    projectId,
    now,
    days,
    pageSize,
    maxPages: maxSamplePages
  });

  const platforms = [...sample.byPlatform.keys()]
    .filter((name) => !onlyPlatforms.length || onlyPlatforms.includes(name))
    .sort()
    .map((name) => {
      const seen = [...sample.byPlatform.get(name).values()];
      return { name, ...selectVersionsForPlatform(seen, linesBehind) };
    });

  const selectedVersions = [...new Set(platforms.flatMap((platform) => platform.selected.map((entry) => entry.version)))];

  // How many occurrences the sample saw for each watched version.
  const sampledByVersion = new Map();
  for (const platform of platforms) {
    for (const entry of platform.selected) {
      sampledByVersion.set(entry.version, (sampledByVersion.get(entry.version) ?? 0) + entry.occurrences);
    }
  }

  const activeByVersion = new Map();
  const itemBatches = await Promise.all(selectedVersions.map(async (version) => {
    const batch = await fetchItems(client, { projectId, version, maxPages: maxPagesPerVersion });
    activeByVersion.set(version, batch.length);
    return batch;
  }));

  // A version can have occurrences and no active items because its issues
  // were resolved. That is a quiet week, not a broken query, so ask again
  // before treating the absence as a failure.
  const resolvedByVersion = new Map();
  await Promise.all(selectedVersions.map(async (version) => {
    if (activeByVersion.get(version) > 0 || !(sampledByVersion.get(version) > 0)) {
      resolvedByVersion.set(version, 0);
      return;
    }
    const batch = await fetchItems(client, {
      projectId,
      version,
      maxPages: maxPagesPerVersion,
      status: 'resolved'
    });
    resolvedByVersion.set(version, batch.length);
  }));

  const versionEvidence = selectedVersions.map((version) => ({
    version,
    sampled: sampledByVersion.get(version) ?? 0,
    active: activeByVersion.get(version) ?? 0,
    resolved: resolvedByVersion.get(version) ?? 0
  }));

  const byId = new Map();
  for (const batch of itemBatches) {
    for (const item of batch) {
      const existing = byId.get(item.id);
      if (!existing) {
        byId.set(item.id, { ...item, versions: item.versions ?? (item.version ? [item.version] : []) });
        continue;
      }
      // The same item can come back from more than one version query: it was
      // seen on more than one build. Keep every build it was seen on, but
      // count its occurrences once.
      const versions = existing.versions ?? (existing.version ? [existing.version] : []);
      for (const version of item.versions ?? (item.version ? [item.version] : [])) {
        if (!versions.includes(version)) {
          versions.push(version);
        }
      }
      existing.versions = versions;
    }
  }
  // An item query names a version, not a platform, so a version both
  // platforms run comes back with the other platform's items on it. The
  // platform filter has to be applied to the items too, or "--platform
  // android" still reports the iOS half of a shared version.
  const items = [...byId.values()].filter((item) => {
    return !onlyPlatforms.length || onlyPlatforms.includes(item.platform);
  });

  const unversionedItems = (await fetchItems(client, {
    projectId,
    version: null,
    maxPages: maxPagesPerVersion
  })).filter((item) => !isNoise(item.title, noisePatterns));

  return { sample: sample.stats, platforms, items, unversionedItems, versionEvidence };
};

// ---------------------------------------------------------------------------
// Digest
// ---------------------------------------------------------------------------

export const renderDigest = (digest, config) => {
  const { timezone } = config;
  const lines = [];
  const platformRows = digest.platforms;
  const attention = digest.clusters.filter((cluster) => cluster.flags.length && !cluster.noise);
  const others = digest.clusters.filter((cluster) => !cluster.flags.length && !cluster.noise);
  const noise = digest.clusters.filter((cluster) => cluster.noise);

  lines.push(`# Rollbar digest — ${formatDate(digest.generatedAt, timezone)}`);
  lines.push('');
  lines.push(`Project \`${digest.project.name}\` · window: last ${digest.sample.requestedDays} days · ` +
    `versions: newest reported plus ${digest.lines} minor line${digest.lines === 1 ? '' : 's'} behind`);
  lines.push('');

  if (digest.sample.occurrences === 0) {
    const confirmed = digest.attempts > 1 ? `, confirmed across ${plural(digest.attempts, 'attempt')}` : '';
    lines.push(`**No versioned occurrences in the sample window${confirmed}.** Nothing to watch — this is not ` +
      'proof that the app is healthy: check that the app is reporting at all before concluding anything.');
    lines.push('');
  } else {
    lines.push(`Sample: ${plural(digest.sample.occurrences, 'occurrence')} over ${plural(digest.sample.pages, 'page')} ` +
      `(${formatDay(digest.sample.oldest, timezone)} → ${formatDay(digest.sample.newest, timezone)})` +
      (digest.sample.throttled
        ? ` · the SDK throttled ${digest.sample.throttled} more (itemsPerMinute=1), so counts are a lower bound`
        : ''));
    lines.push('');
  }

  if (digest.attempts > 1) {
    lines.push(`> Collected ${plural(digest.attempts, 'time')}: ${digest.retryReason ??
      'the first collection looked broken'}. The digest below is the last attempt's result.`);
    lines.push('');
  }

  lines.push('## Versions in scope');
  lines.push('');
  lines.push('| Platform | Newest reported | Watching | Occurrences | Last seen |');
  lines.push('| --- | --- | --- | --- | --- |');

  for (const row of platformRows) {
    if (!row.selected.length) {
      lines.push(`| ${row.name} | — | — | — | no occurrences in the sample window |`);
      continue;
    }
    const watching = row.selected.map((entry) => entry.version).join(', ');
    const counts = row.selected.map((entry) => entry.occurrences).join(', ');
    const lastSeen = formatDate(Math.max(...row.selected.map((entry) => entry.lastSeen)), timezone);
    lines.push(`| ${row.name} | ${row.newest.version} | ${watching} | ${counts} | ${lastSeen} |`);
  }

  lines.push('');
  if (digest.ignoredVersions.length) {
    const tail = digest.ignoredVersions.slice(0, 6).map((entry) => {
      const platforms = Object.entries(entry.platforms).map(([name, count]) => `${name} ${count}`).join(', ');
      return `\`${entry.version}\` (${entry.total}${platforms ? ` — ${platforms}` : ''})`;
    });
    lines.push(`Older versions, ignored by policy (issues already fixed): ${tail.join(' · ')}` +
      `${digest.ignoredVersions.length > 6 ? ' · …' : ''}`);
    lines.push('');
  }

  if (digest.localVersionNote) {
    lines.push(`> ${digest.localVersionNote}`);
    lines.push('');
  }

  lines.push(`## Needs attention (${attention.length})`);
  lines.push('');
  if (!attention.length) {
    lines.push(digest.sample.occurrences === 0
      ? 'There is nothing to triage: no occurrences were found at all (see above).'
      : 'Nothing crossed the thresholds. The active issues are listed below.');
    lines.push('');
  }
  attention.forEach((cluster, index) => {
    lines.push(`### ${index + 1}. ${redact(cluster.title)}`);
    lines.push('');
    const scope = [
      plural(cluster.items.length, 'item'),
      plural(cluster.environments.length, 'environment'),
      plural(cluster.occurrences, 'occurrence')
    ].join(' · ');
    lines.push(`${scope} · versions ${cluster.versions.join(', ') || 'n/a'} · ` +
      `first ${formatDay(cluster.firstSeen, timezone)} · last ${formatDay(cluster.lastSeen, timezone)} · ` +
      `flags: ${cluster.flags.join(', ')}`);
    if (cluster.context) {
      lines.push(`Context: \`${redact(cluster.context)}\``);
    }
    lines.push('');
    for (const item of cluster.items.slice(0, 5)) {
      const url = itemUrl(config, item);
      const link = url ? `[${item.counter}](${url})` : `#${item.counter}`;
      lines.push(`- ${link} · ${item.platform} · ${item.environment} · ${plural(item.occurrences, 'occ')} · ` +
        `last ${formatDate(item.lastSeen, timezone)} · id \`${item.id}\``);
    }
    if (cluster.items.length > 5) {
      lines.push(`- … ${cluster.items.length - 5} more items on the same title`);
    }
    lines.push('');
  });

  lines.push(`## Other active issues (${others.length})`);
  lines.push('');
  if (!others.length) {
    lines.push('None.');
  }
  for (const cluster of others) {
    lines.push(`- **${redact(cluster.title)}** — ${plural(cluster.items.length, 'item')} · ` +
      `${plural(cluster.environments.length, 'environment')} · ${plural(cluster.occurrences, 'occurrence')} · ` +
      `versions ${cluster.versions.join(', ') || 'n/a'} · last ${formatDay(cluster.lastSeen, timezone)}`);
  }
  lines.push('');

  lines.push(`## Suppressed as noise (${noise.length})`);
  lines.push('');
  if (!noise.length) {
    lines.push('None.');
  }
  for (const cluster of noise) {
    lines.push(`- ${redact(cluster.title)} — ${plural(cluster.items.length, 'item')}, ${plural(cluster.environments.length, 'environment')}`);
  }
  lines.push('');

  lines.push(`## Unversioned / boot errors (${digest.unversioned.length})`);
  lines.push('');
  lines.push('Reported before Rollbar was initialised, so they carry no version and no platform. ' +
    'A version-scoped query can never see them.');
  lines.push('');
  if (!digest.unversioned.length) {
    lines.push('None.');
  }
  for (const cluster of digest.unversioned) {
    lines.push(`- **${redact(cluster.title)}** — ${plural(cluster.items.length, 'item')} · ` +
      `last ${formatDay(cluster.lastSeen, timezone)} · flags: ${cluster.flags.join(', ') || 'none'}`);
  }
  lines.push('');

  lines.push('---');
  lines.push('Triage the attention items above with `node scripts/rollbar-digest.js --evidence <item id>` ' +
    `(up to ${digest.maxTriaged}) against \`origin/master\`.`);

  return lines.join('\n');
};

// ---------------------------------------------------------------------------
// Evidence pack (per-item triage)
// ---------------------------------------------------------------------------

const shortFrame = (frame) => {
  const file = String(frame.filename ?? '').replace(/^vue-source:\/\//, '');
  const method = frame.method ?? '[anonymous]';
  return `${file}:${frame.lineno ?? '?'} ${method}`;
};

const renderEvidence = (item, instance, config) => {
  const lines = [];
  const data = instance?.data ?? {};
  const trace = data.body?.trace ?? data.body?.trace_chain?.[0];
  const exception = trace?.exception ?? {};
  const frames = [...(trace?.frames ?? [])].slice(-6).reverse();
  const telemetry = condenseTelemetry(data.body?.telemetry ?? [], 25);
  const url = itemUrl(config, { counter: item.counter });

  lines.push(`## ${item.counter} — ${redact(item.title ?? exception.message ?? 'n/a')}`);
  lines.push('');
  lines.push(`version ${data.client?.javascript?.code_version ?? 'n/a'} · environment ${item.environment ?? 'n/a'} · ` +
    `level ${item.level ?? 'n/a'} · status ${item.status ?? 'n/a'}`);
  lines.push(`occurrences ${item.total_occurrences ?? 'n/a'} · ` +
    `first ${formatDate(Number(item.first_occurrence_timestamp ?? 0) * 1000, config.timezone)} · ` +
    `last ${formatDate(Number(item.last_occurrence_timestamp ?? 0) * 1000, config.timezone)}`);
  if (url) {
    lines.push(`url: ${url}`);
  }
  if (item.hash) {
    lines.push(`hash: \`${redact(item.hash)}\``);
  }
  lines.push('');

  if (exception.message) {
    lines.push(`exception: ${exception.class ?? 'Error'}: ${redact(exception.message)}`);
  }
  if (data.custom && Object.keys(data.custom).length) {
    lines.push(`custom: ${redact(JSON.stringify(data.custom)).slice(0, 800)}`);
  }
  if (data.request?.url) {
    lines.push(`request: ${redact(data.request.url)}`);
  }
  lines.push('');

  if (frames.length) {
    const mapped = frames.filter((frame) => frame.filename && frame.filename !== '(unknown)');
    if (!mapped.length) {
      lines.push('frames: none source-mapped — the error surfaced through the Capacitor bridge. ' +
        'Locate it from the title and `custom.context` below.');
    } else {
      lines.push('frames (innermost first):');
      frames.forEach((frame, index) => {
        lines.push(`${index + 1}. ${shortFrame(frame)}`);
      });
    }
  } else {
    lines.push('frames: none (not source-mapped)');
  }
  lines.push('');

  if (telemetry.length) {
    lines.push(`telemetry (last ${telemetry.length} of ${(data.body?.telemetry ?? []).length}; input values omitted):`);
    for (const event of telemetry) {
      const time = event.time ? event.time.slice(11, 19) : '--:--:--';
      const repeat = event.repeat > 1 ? ` ×${event.repeat}` : '';
      lines.push(`${time} ${event.level ?? ''} ${event.type ?? ''} ${event.detail}${repeat}`.trim());
    }
  } else {
    lines.push('telemetry: none');
  }

  return lines.join('\n');
};

// ---------------------------------------------------------------------------
// Config, env, CLI
// ---------------------------------------------------------------------------

const readEnvFile = (path) => {
  const values = {};
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return values;
  }
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) {
      continue;
    }
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
};

const loadConfig = (path) => {
  const configPath = path ? resolve(path) : join(ROOT, 'scripts', 'rollbar-digest.config.json');
  return JSON.parse(readFileSync(configPath, 'utf8'));
};

const loadToken = () => {
  if (process.env.ROLLBAR_READ_TOKEN) {
    return process.env.ROLLBAR_READ_TOKEN;
  }
  const env = readEnvFile(join(ROOT, '.env.local'));
  return env.ROLLBAR_READ_TOKEN ?? '';
};

const usage = () => {
  return [
    'Usage: node scripts/rollbar-digest.js [options]',
    '',
    '  --days <n>         discovery window in days (default: config.sampleDays)',
    '  --lines <n>        minor lines behind the newest version (default: 2)',
    '  --platform <name>  restrict to android / ios, repeatable',
    '  --evidence <ids>   evidence pack for item ids (comma separated)',
    '  --json             machine-readable output',
    '  --now <iso>        pretend "now" is this instant',
    '  --config <path>    config file',
    '  --help             this text'
  ].join('\n');
};

const main = async () => {
  const { values } = parseArgs({
    options: {
      days: { type: 'string' },
      lines: { type: 'string' },
      platform: { type: 'string', multiple: true },
      evidence: { type: 'string' },
      json: { type: 'boolean', default: false },
      now: { type: 'string' },
      config: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false }
    },
    allowPositionals: false
  });

  if (values.help) {
    console.log(usage());
    return;
  }

  const config = loadConfig(values.config);
  const token = loadToken();
  if (!token) {
    throw new Error('ROLLBAR_READ_TOKEN is not set (put it in .env.local or export it)');
  }

  const now = values.now ? Date.parse(values.now) : Date.now();
  if (!Number.isFinite(now)) {
    throw new Error(`--now is not a valid date: ${values.now}`);
  }

  const client = createClient(token);
  const project = await resolveProject(client, config.project);
  const projectId = project.id;

  if (values.evidence) {
    const ids = values.evidence.split(',').map((id) => id.trim()).filter(Boolean);
    if (!ids.length) {
      throw new Error('--evidence needs at least one item id');
    }
    const packs = [];
    for (const id of ids) {
      const item = await client.getItem(id, projectId);
      const instance = item.last_occurrence_id
        ? await client.getInstance(item.last_occurrence_id, projectId)
        : null;
      packs.push({ item, instance });
    }

    if (values.json) {
      console.log(JSON.stringify(packs.map(({ item, instance }) => ({
        // The JSON output is as public as the Markdown one: the item title,
        // its hash and the exception message can all carry user data.
        item: {
          ...item,
          title: redact(item.title),
          hash: redact(item.hash)
        },
        occurrence: instance
          ? {
            id: instance.id,
            timestamp: new Date(Number(instance.timestamp) * 1000).toISOString(),
            exception: redactException(instance.data?.body?.trace?.exception
              ?? instance.data?.body?.trace_chain?.[0]?.exception
              ?? null),
            frames: (instance.data?.body?.trace?.frames
              ?? instance.data?.body?.trace_chain?.[0]?.frames
              ?? []).slice(-6).reverse().map(shortFrame),
            custom: redact(instance.data?.custom ?? null),
            telemetry: condenseTelemetry(instance.data?.body?.telemetry ?? [], 25)
          }
          : null
      })), null, 2));
    } else {
      console.log(packs.map(({ item, instance }) => renderEvidence(item, instance, config)).join('\n\n'));
    }
    return;
  }

  const days = Number(values.days ?? config.sampleDays);
  const linesBehind = Number(values.lines ?? config.minorLinesBehind);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error('--days must be a positive number');
  }
  if (!Number.isFinite(linesBehind) || linesBehind < 0) {
    throw new Error('--lines must be zero or a positive number');
  }

  const onlyPlatforms = (values.platform ?? []).map((name) => name.toLowerCase());

  const collect = () => collectDigest(client, {
    projectId,
    now,
    days,
    linesBehind,
    onlyPlatforms,
    noisePatterns: config.noisePatterns ?? [],
    pageSize: config.samplePageSize ?? 100,
    maxSamplePages: config.maxSamplePages ?? 16,
    maxPagesPerVersion: config.maxPagesPerVersion ?? 5
  });

  // An empty digest is the one output that cannot be told apart from a healthy
  // week, so a collection that looks broken is retried before it is reported.
  // A collection that failed outright is retried too: one dropped connection
  // must not end the run.
  const maxAttempts = Math.max(1, config.maxAttempts ?? 3);
  let collection = null;
  let attempts = 0;
  let retryReason = null;
  let lastError = null;

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      collection = await collect();
      lastError = null;
    } catch (error) {
      collection = null;
      lastError = error;
    }

    if (collection) {
      const reason = findRetryReason(collection);
      if (!reason) {
        break;
      }
      // Keep the first reason: once a retry succeeds the collection is clean
      // again, and that is the interesting part to report.
      retryReason = retryReason ?? reason;
    }

    if (attempts < maxAttempts) {
      await sleep(collectionRetryDelayMs(attempts - 1));
    }
  }

  if (!collection) {
    throw lastError ?? new Error('the Rollbar API could not be read');
  }

  // Retrying is not the same as succeeding. If the collection is still
  // inconsistent, this is a broken API contract and not a report about the
  // app: publishing it would say "nothing needs attention" about a failure.
  // Fail loudly so the scheduled task can report it instead of posting an
  // empty digest.
  const broken = findBrokenReason(collection);
  if (broken) {
    throw new Error(`the Rollbar API returned an inconsistent result after ${attempts} attempt${attempts === 1 ? '' : 's'}: ${broken}`);
  }

  const { sample, platforms, items, unversionedItems } = collection;

  const flagsFor = (cluster) => flagCluster(cluster, {
    now,
    ...(config.attention ?? {})
  });

  const clusters = clusterItems(items).map((cluster) => ({
    ...cluster,
    noise: cluster.items.every((item) => isNoise(item.title, config.noisePatterns ?? [])),
    flags: []
  }));
  for (const cluster of clusters) {
    if (!cluster.noise) {
      cluster.flags = flagsFor(cluster);
    }
  }

  const unversioned = clusterItems(unversionedItems).map((cluster) => ({
    ...cluster,
    noise: false,
    flags: flagCluster(cluster, { now, ...(config.attention ?? {}) })
  }));

  const ignoredMap = new Map();
  for (const platform of platforms) {
    for (const entry of platform.ignored) {
      const current = ignoredMap.get(entry.version) ?? { version: entry.version, total: 0, platforms: {} };
      current.total += entry.occurrences;
      current.platforms[platform.name] = (current.platforms[platform.name] ?? 0) + entry.occurrences;
      ignoredMap.set(entry.version, current);
    }
  }
  const ignoredVersions = [...ignoredMap.values()].sort((a, b) => compareVersionsDesc(a.version, b.version));

  let localVersionNote = null;
  try {
    const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const newestReported = platforms
      .map((platform) => platform.newest?.version)
      .filter(Boolean)
      .sort(compareVersions)
      .pop();
    if (newestReported && compareVersions(packageJson.version, newestReported) > 0) {
      localVersionNote = `Local build is ${packageJson.version}, newer than anything reporting ` +
        `(${newestReported}). A version with no occurrences is not reporting, which is not proof it is healthy.`;
    }
  } catch {
    localVersionNote = null;
  }

  const digest = {
    generatedAt: now,
    project: { id: projectId, name: project.name },
    lines: linesBehind,
    sample: {
      requestedDays: days,
      pages: sample.pages,
      occurrences: sample.occurrences,
      instances: sample.instances,
      throttled: sample.throttled,
      oldest: sample.oldest,
      newest: sample.newest,
      unknownPlatform: sample.unknownPlatform
    },
    attempts,
    retryReason,
    platforms: platforms.map((platform) => ({
      name: platform.name,
      newest: platform.newest,
      window: platform.window,
      selected: platform.selected
    })),
    ignoredVersions,
    localVersionNote,
    maxTriaged: config.maxTriaged ?? 5,
    clusters,
    unversioned,
    stats: client.stats
  };

  if (values.json) {
    console.log(JSON.stringify({
      ...digest,
      clusters: clusters.map(toJsonCluster),
      unversioned: unversioned.map(toJsonCluster)
    }, null, 2));
    return;
  }

  console.log(renderDigest(digest, config));
};

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((error) => {
    console.error(`rollbar-digest: ${error.message}`);
    process.exit(1);
  });
}
