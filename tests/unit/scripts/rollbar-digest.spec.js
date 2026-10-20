import { describe, expect, it } from 'vitest';
// scripts/ is outside src/, so the `@` alias does not reach it.
import {
  clusterItems,
  collectDigest,
  collectionRetryDelayMs,
  compareVersions,
  condenseTelemetry,
  findBrokenReason,
  findRetryReason,
  flagCluster,
  isNoise,
  isSensitiveKey,
  normalizeTitle,
  parseVersion,
  platformOf,
  redact,
  redactException,
  renderDigest,
  selectVersionsForPlatform,
  toItem
} from '../../../scripts/rollbar-digest.js';

const NOW = Date.parse('2026-10-20T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const makeItem = (overrides = {}) => ({
  id: '1',
  counter: 1,
  version: '98.3.1',
  environment: 'android 12 - sm-a125m - webview 155.0.8059.43',
  platform: 'android',
  title: 'TypeError: boom',
  context: '',
  level: 'critical',
  occurrences: 1,
  firstSeen: NOW - 2 * DAY,
  lastSeen: NOW - DAY,
  ...overrides
});

const makeConfig = () => ({
  timezone: 'Europe/Rome',
  dashboardBaseUrl: 'https://app.rollbar.com/a/cgps-group/fix/item/epicollect5-mobile-app',
  noisePatterns: ['user denied'],
  attention: {
    newSinceDays: 7,
    minEnvironments: 2,
    minOccurrences: 5,
    integrityKeywords: ['migratedb', 'save media']
  }
});

const makeDigest = (overrides = {}) => ({
  generatedAt: NOW,
  project: { id: 1, name: 'epicollect5-mobile-app' },
  lines: 2,
  sample: {
    requestedDays: 14,
    pages: 3,
    occurrences: 10,
    instances: 12,
    throttled: 2,
    oldest: NOW - 10 * DAY,
    newest: NOW - DAY,
    unknownPlatform: 0
  },
  attempts: 1,
  retryReason: null,
  platforms: [],
  ignoredVersions: [],
  localVersionNote: null,
  maxTriaged: 5,
  clusters: [],
  unversioned: [],
  ...overrides
});

describe('parseVersion / compareVersions', () => {
  it('parses and orders versions numerically', () => {
    expect(parseVersion('98.5.1')).toEqual({ major: 98, minor: 5, patch: 1 });
    expect(parseVersion('n/a')).toBeNull();
    expect(compareVersions('98.3.2', '98.3.10')).toBeLessThan(0);
    expect(compareVersions('98.10.0', '98.9.9')).toBeGreaterThan(0);
  });
});

describe('platformOf', () => {
  it('reads the platform from the environment prefix', () => {
    expect(platformOf('android 12 - sm-a125m - webview 155')).toBe('android');
    expect(platformOf('iOS 26.5.2 - iPhone17,2 - WebView 26.5.2')).toBe('ios');
    expect(platformOf('unknown')).toBe('unknown');
    expect(platformOf('')).toBe('unknown');
    expect(platformOf('windows 10 - chrome 130')).toBe('other');
  });
});

describe('normalizeTitle', () => {
  it('merges titles that differ only by ids and long numbers', () => {
    expect(normalizeTitle('Uncaught (in promise) TypeError: boom 12345'))
      .toBe(normalizeTitle('TypeError: boom 98765'));
    expect(normalizeTitle('row 2f1c8d0e-1111-2222-3333-444455556666 failed'))
      .toBe('row <uuid> failed');
  });

  it('keeps short numbers, which carry meaning', () => {
    expect(normalizeTitle('status 401')).not.toBe(normalizeTitle('status 500'));
  });
});

describe('selectVersionsForPlatform', () => {
  it('keeps the newest version and two minor lines behind it', () => {
    const seen = [
      { version: '98.5.1', occurrences: 1, lastSeen: NOW },
      { version: '98.3.1', occurrences: 234, lastSeen: NOW },
      { version: '98.3.2', occurrences: 4, lastSeen: NOW },
      { version: '98.0.0', occurrences: 680, lastSeen: NOW },
      { version: '88.9.8', occurrences: 189, lastSeen: NOW }
    ];

    const selection = selectVersionsForPlatform(seen, 2);

    expect(selection.newest.version).toBe('98.5.1');
    expect(selection.window).toEqual(['98.5', '98.4', '98.3']);
    expect(selection.selected.map((entry) => entry.version)).toEqual(['98.5.1', '98.3.2', '98.3.1']);
    expect(selection.ignored.map((entry) => entry.version)).toEqual(['98.0.0', '88.9.8']);
  });

  it('does not slide back onto an old build when nothing newer reports', () => {
    const selection = selectVersionsForPlatform([
      { version: '98.3.2', occurrences: 4, lastSeen: NOW },
      { version: '98.0.0', occurrences: 103, lastSeen: NOW }
    ], 2);

    expect(selection.selected.map((entry) => entry.version)).toEqual(['98.3.2']);
    expect(selection.ignored.map((entry) => entry.version)).toEqual(['98.0.0']);
  });

  it('handles a platform with no versions', () => {
    expect(selectVersionsForPlatform([], 2)).toEqual({ newest: null, window: [], selected: [], ignored: [] });
  });
});

describe('isNoise', () => {
  it('matches the suppressed camera/permission messages case-insensitively', () => {
    expect(isNoise('Error: User denied access to camera', ['user denied'])).toBe(true);
    expect(isNoise('CameraPreview.start failed: Camera permission denied', ['camera permission denied'])).toBe(true);
    expect(isNoise('TypeError: boom', ['user denied'])).toBe(false);
  });
});

describe('toItem', () => {
  it('turns the "cc:<context>" hash into a context and derives the platform', () => {
    const item = toItem({
      id: '42',
      counter: 7,
      environment: 'ios 26.5.2 - iphone17,2 - webview 26.5.2',
      title: 'Error: boom',
      hash: 'cc:photoTake capture failed',
      total_occurrences: 3,
      first_occurrence_timestamp: 100,
      last_occurrence_timestamp: 200
    }, '98.3.2');

    expect(item.context).toBe('photoTake capture failed');
    expect(item.platform).toBe('ios');
    expect(item.version).toBe('98.3.2');
    expect(item.firstSeen).toBe(100000);
  });
});

describe('clusterItems', () => {
  it('merges one issue reported from several environments and platforms', () => {
    const clusters = clusterItems([
      makeItem({ id: '1', environment: 'android 12 - a', occurrences: 2, firstSeen: NOW - 3 * DAY, lastSeen: NOW - 2 * DAY }),
      makeItem({ id: '2', environment: 'android 15 - b', occurrences: 3, firstSeen: NOW - 9 * DAY, lastSeen: NOW - DAY }),
      makeItem({ id: '3', environment: 'ios 26.5 - c', platform: 'ios', version: '98.3.2', occurrences: 1 })
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].items).toHaveLength(3);
    expect(clusters[0].environments).toHaveLength(3);
    expect(clusters[0].occurrences).toBe(6);
    expect(clusters[0].firstSeen).toBe(NOW - 9 * DAY);
    expect(clusters[0].lastSeen).toBe(NOW - DAY);
    expect(clusters[0].platforms).toEqual({ android: 2, ios: 1 });
    expect(clusters[0].versions).toEqual(['98.3.2', '98.3.1']);
  });
});

describe('flagCluster', () => {
  const options = { now: NOW, ...makeConfig().attention };

  it('flags a recent issue seen across environments', () => {
    const [cluster] = clusterItems([
      makeItem({ id: '1', environment: 'android 12 - a' }),
      makeItem({ id: '2', environment: 'android 15 - b' })
    ]);

    expect(flagCluster(cluster, options)).toEqual(['new', 'env:2']);
  });

  it('leaves a one-off, old, single-environment issue unflagged', () => {
    const [cluster] = clusterItems([
      makeItem({ firstSeen: NOW - 20 * DAY, lastSeen: NOW - 18 * DAY })
    ]);

    expect(flagCluster(cluster, options)).toEqual([]);
  });

  it('flags data-integrity paths even on a single occurrence', () => {
    const [cluster] = clusterItems([makeItem({ title: 'Error: migrateDB failed' })]);

    expect(flagCluster(cluster, options)).toContain('data-integrity');
  });

  it('flags the same issue on both platforms', () => {
    const [cluster] = clusterItems([
      makeItem({ id: '1', environment: 'android 12 - a' }),
      makeItem({ id: '2', environment: 'ios 26.5 - b', platform: 'ios' })
    ]);

    expect(flagCluster(cluster, options)).toContain('cross-platform');
  });
});

describe('condenseTelemetry', () => {
  it('collapses repeated events and never carries input values', () => {
    const events = [
      { type: 'log', level: 'log', timestamp_ms: 1, body: { message: 'Got location' } },
      { type: 'log', level: 'log', timestamp_ms: 2, body: { message: 'Got location' } },
      {
        type: 'dom',
        level: 'info',
        timestamp_ms: 3,
        body: { type: 'rollbar-input-event', subtype: 'number', element: 'input.question', value: '208' }
      },
      { type: 'error', level: 'critical', timestamp_ms: 4, body: { message: 'photoTake capture failed' } }
    ];

    const condensed = condenseTelemetry(events);

    expect(condensed).toHaveLength(3);
    expect(condensed[0].repeat).toBe(2);
    expect(condensed[1].detail).toContain('number');
    expect(JSON.stringify(condensed)).not.toContain('208');
  });
});

describe('redact', () => {
  // Shape only, deliberately: a real credential or a real address must never
  // end up in this repository, not even inside a fixture that proves they are
  // removed.
  const FAKE_GOOGLE_TOKEN = 'ya29.a0FAKEfakefakefakefakefakefakefakefakefakefakefakefake';
  const FAKE_JWT = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IkZBS0UiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.ZmFrZXNpZ25hdHVyZQ';

  it('removes the Google credentials and email a login log can leak', () => {
    const log = `{"accessToken":"${FAKE_GOOGLE_TOKEN}","expires":1791981831,`
      + '"email":"user@example.com",'
      + `"idToken":"${FAKE_JWT}"}`;

    const redacted = redact(log);

    expect(redacted).not.toContain('ya29.');
    expect(redacted).not.toContain('user@example.com');
    expect(redacted).not.toContain('accessToken":"ya29');
    expect(redacted).not.toContain('idToken":"eyJ');
    expect(redacted).toMatch(/<redacted/);
    expect(redacted).toContain('<redacted-email>');
  });

  it('redacts bearer headers, jwt, emails and long opaque blobs', () => {
    expect(redact('Authorization: Bearer abcdef1234567890')).toBe('Authorization: Bearer <redacted>');
    expect(redact('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijkl')).toBe('<redacted-jwt>');
    expect(redact('user@example.com')).toBe('<redacted-email>');
    expect(redact('blob ' + 'a'.repeat(45))).toBe('blob <redacted-blob>');
    expect(redact('password=hunter2')).toBe('password=<redacted>');
  });

  it('masks a short secret behind a quoted JSON key', () => {
    expect(redact('{"password":"hunter2"}')).toBe('{"password":"<redacted>"}');
    expect(redact('{"apiKey":"abc123","ok":"fine"}')).toBe('{"apiKey":"<redacted>","ok":"fine"}');
  });

  it('masks a sensitive property of an object', () => {
    const redacted = redact({ password: 'hunter2', note: 'ok', credentials: { user: 'x' } });

    expect(redacted.password).toBe('<redacted>');
    expect(redacted.note).toBe('ok');
    expect(redacted.credentials).toBe('<redacted>');
  });

  it('does not mask a word that merely ends in a sensitive one', () => {
    expect(redact('{"monkey":"banana"}')).toBe('{"monkey":"banana"}');
    expect(isSensitiveKey('monkey')).toBe(false);
    expect(isSensitiveKey('password')).toBe(true);
    expect(isSensitiveKey('apiKey')).toBe(true);
    expect(isSensitiveKey('api_key')).toBe(true);
    expect(isSensitiveKey('context')).toBe(false);
  });

  it('masks an exception message', () => {
    const redacted = redactException({
      class: 'TypeError',
      message: 'failed for user@example.com'
    });

    expect(redacted.message).toBe('failed for <redacted-email>');
    expect(redacted.class).toBe('TypeError');
  });

  it('leaves ordinary diagnostic text alone', () => {
    expect(redact('should log user out')).toBe('should log user out');
    expect(redact('dismiss dialog called')).toBe('dismiss dialog called');
    expect(redact('photoTake capture failed')).toBe('photoTake capture failed');
  });

  it('walks objects and arrays so nested payloads are covered too', () => {
    const redacted = redact({
      context: 'login',
      credentials: { accessToken: FAKE_GOOGLE_TOKEN, email: 'user@example.com' },
      list: ['someone@example.com']
    });

    // A sensitive property is masked whole, so a secret under an innocent
    // name inside it cannot survive either.
    expect(redacted.credentials).toBe('<redacted>');
    expect(redacted.list[0]).toBe('<redacted-email>');
    expect(redacted.context).toBe('login');
  });

  it('keeps secrets out of the telemetry timeline', () => {
    const condensed = condenseTelemetry([
      {
        type: 'log',
        level: 'log',
        timestamp_ms: 1,
        body: { message: `{"accessToken":"${FAKE_GOOGLE_TOKEN}"}` }
      }
    ]);

    expect(JSON.stringify(condensed)).not.toContain('ya29.');
    expect(condensed[0].detail).toMatch(/<redacted/);
  });
});

describe('collectDigest', () => {
  const occurrence = (version, environment) => ({
    timestamp: Math.floor((NOW - DAY) / 1000),
    data: {
      client: { javascript: { code_version: version } },
      environment,
      body: { message: { body: 'boom' } }
    }
  });

  const item = (id, version, environment) => ({
    id: String(id),
    counter: id,
    environment,
    title: 'TypeError: boom',
    hash: 'cc:photoTake capture failed',
    total_occurrences: 1,
    first_occurrence_timestamp: Math.floor((NOW - 2 * DAY) / 1000),
    last_occurrence_timestamp: Math.floor((NOW - DAY) / 1000)
  });

  const stubClient = ({ occurrences = [], items = [] } = {}) => ({
    listInstances: async ({ page }) => (page === 1 ? { instances: occurrences } : { instances: [] }),
    listItems: async () => ({ items, total_count: items.length })
  });

  it('returns a collection the retry decision can read', async () => {
    const client = stubClient({
      occurrences: [occurrence('98.3.1', 'android 12 - pixel - webview 155')],
      items: [item(1, '98.3.1', 'android 12 - pixel - webview 155')]
    });

    const collection = await collectDigest(client, {
      projectId: 1,
      now: NOW,
      days: 14,
      linesBehind: 2,
      pageSize: 100,
      maxSamplePages: 4,
      maxPagesPerVersion: 2
    });

    // The shape is the contract: findRetryReason reads sample.instances, so a
    // mismatch here silently retries a healthy week forever.
    expect(collection.sample.instances).toBe(1);
    expect(collection.sample.occurrences).toBe(1);
    expect(collection.platforms.map((platform) => platform.name)).toEqual(['android']);
    expect(collection.items).toHaveLength(1);
    expect(findRetryReason(collection)).toBeNull();
  });

  it('asks for a retry when the sample came back empty', async () => {
    const client = stubClient({ occurrences: [], items: [] });

    const collection = await collectDigest(client, {
      projectId: 1,
      now: NOW,
      days: 14,
      linesBehind: 2,
      pageSize: 100,
      maxSamplePages: 4,
      maxPagesPerVersion: 2
    });

    expect(findRetryReason(collection)).toMatch(/sample came back empty/);
  });

  it('leaves occurrences older than the window out of the counts', async () => {
    const inside = occurrence('98.3.1', 'android 12 - pixel - webview 155');
    const outside = { ...occurrence('98.0.0', 'android 10 - other - webview 150') };
    outside.timestamp = Math.floor((NOW - 20 * DAY) / 1000);

    const client = stubClient({
      occurrences: [inside, outside],
      items: [item(1, '98.3.1', 'android 12 - pixel - webview 155')]
    });

    const collection = await collectDigest(client, {
      projectId: 1,
      now: NOW,
      days: 14,
      linesBehind: 2,
      pageSize: 100,
      maxSamplePages: 4,
      maxPagesPerVersion: 2
    });

    // The old record must not select its version or inflate a count.
    expect(collection.sample.instances).toBe(1);
    expect(collection.platforms[0].selected.map((entry) => entry.version)).toEqual(['98.3.1']);
  });

  it('keeps the other platform out when a platform was asked for', async () => {
    const client = stubClient({
      occurrences: [
        occurrence('98.3.1', 'android 12 - pixel - webview 155'),
        { ...occurrence('98.3.1', 'ios 26.5 - iphone17,2 - webview 26.5.2') }
      ],
      items: [
        item(1, '98.3.1', 'android 12 - pixel - webview 155'),
        { ...item(2, '98.3.1', 'ios 26.5 - iphone17,2 - webview 26.5.2'), platform: 'ios' }
      ]
    });

    const collection = await collectDigest(client, {
      projectId: 1,
      now: NOW,
      days: 14,
      linesBehind: 2,
      onlyPlatforms: ['android'],
      pageSize: 100,
      maxSamplePages: 4,
      maxPagesPerVersion: 2
    });

    expect(collection.items).toHaveLength(1);
    expect(collection.items[0].platform).toBe('android');
  });
});

describe('findBrokenReason', () => {
  const platformWith = (occurrences) => ({
    name: 'android',
    selected: [{ version: '98.3.1', occurrences, lastSeen: NOW }]
  });

  it('calls a stream of occurrences with no items a broken collection', () => {
    expect(findBrokenReason({
      platforms: [platformWith(240)],
      items: []
    })).toMatch(/no items came back/);
  });

  it('does not call a resolved-away issue broken', () => {
    expect(findBrokenReason({
      platforms: [platformWith(4)],
      items: []
    })).toBeNull();
  });

  it('does not call a quiet week broken', () => {
    expect(findBrokenReason({ platforms: [], items: [] })).toBeNull();
  });

  it('is the part of the retry reason that survives a successful retry', () => {
    const broken = { sample: { instances: 240, occurrences: 240 }, platforms: [platformWith(240)], items: [] };

    expect(findRetryReason(broken)).toMatch(/no items came back/);
    expect(findRetryReason({ sample: { instances: 0 }, platforms: [], items: [] })).toMatch(/sample came back empty/);
  });
});

describe('findRetryReason', () => {
  const platformWith = (occurrences) => ({
    name: 'android',
    selected: [{ version: '98.3.1', occurrences, lastSeen: NOW }]
  });

  it('retries when the occurrence sample came back empty', () => {
    const reason = findRetryReason({
      sample: { instances: 0, occurrences: 0 },
      platforms: [],
      items: []
    });

    expect(reason).toMatch(/sample came back empty/);
  });

  it('retries when errors were sampled but no items came back', () => {
    const reason = findRetryReason({
      sample: { instances: 240, occurrences: 240 },
      platforms: [platformWith(240)],
      items: []
    });

    expect(reason).toMatch(/no items came back/);
  });

  it('does not retry a genuinely quiet week', () => {
    expect(findRetryReason({
      sample: { instances: 0, occurrences: 0 },
      platforms: [],
      items: []
    })).toBeTruthy();

    // A quiet week still has boot errors: they arrive without a version.
    expect(findRetryReason({
      sample: { instances: 12, occurrences: 0 },
      platforms: [],
      items: []
    })).toBeNull();
  });

  it('does not retry when a small number of items was resolved away', () => {
    expect(findRetryReason({
      sample: { instances: 4, occurrences: 4 },
      platforms: [platformWith(4)],
      items: []
    })).toBeNull();
  });

  it('does not retry a healthy collection', () => {
    expect(findRetryReason({
      sample: { instances: 240, occurrences: 240 },
      platforms: [platformWith(240)],
      items: [{ id: '1' }]
    })).toBeNull();
  });
});

describe('collectionRetryDelayMs', () => {
  it('backs off and stays bounded', () => {
    expect(collectionRetryDelayMs(0)).toBe(5000);
    expect(collectionRetryDelayMs(1)).toBe(10000);
    expect(collectionRetryDelayMs(2)).toBe(20000);
    expect(collectionRetryDelayMs(10)).toBe(60000);
  });
});

describe('renderDigest', () => {
  const clusters = [
    {
      ...clusterItems([makeItem({ id: '1', environment: 'android 12 - a' }), makeItem({ id: '2', environment: 'android 15 - b' })])[0],
      flags: ['new', 'env:2'],
      noise: false
    },
    {
      ...clusterItems([makeItem({ id: '3', title: 'Error: User denied access to camera' })])[0],
      flags: [],
      noise: true
    }
  ];

  it('prints the versions in scope, the ignored tail and the attention list', () => {
    const digest = makeDigest({
      platforms: [{
        name: 'android',
        newest: { version: '98.5.1', occurrences: 1, lastSeen: NOW },
        window: ['98.5', '98.4', '98.3'],
        selected: [
          { version: '98.5.1', occurrences: 1, lastSeen: NOW - 5 * DAY },
          { version: '98.3.1', occurrences: 234, lastSeen: NOW - DAY }
        ]
      }],
      ignoredVersions: [{ version: '98.0.0', total: 680, platforms: { android: 577, ios: 103 } }],
      clusters
    });

    const output = renderDigest(digest, makeConfig());

    expect(output).toContain('| android | 98.5.1 | 98.5.1, 98.3.1 | 1, 234 |');
    expect(output).toContain('`98.0.0` (680 — android 577, ios 103)');
    expect(output).toContain('## Needs attention (1)');
    expect(output).toContain('## Suppressed as noise (1)');
    expect(output).toContain('- Error: User denied access to camera — 1 item, 1 environment');
    expect(output).toContain('flags: new, env:2');
  });

  it('warns that no occurrences is not the same as healthy', () => {
    const digest = makeDigest({
      sample: { requestedDays: 14, pages: 1, occurrences: 0, instances: 0, throttled: 0, oldest: null, newest: null, unknownPlatform: 0 },
      platforms: [{ name: 'android', newest: null, window: [], selected: [] }]
    });

    expect(renderDigest(digest, makeConfig())).toContain('No versioned occurrences');
  });

  it('says how many times it had to collect before it trusted the result', () => {
    const digest = makeDigest({
      attempts: 2,
      retryReason: 'the occurrence sample came back empty'
    });

    const output = renderDigest(digest, makeConfig());

    expect(output).toContain('Collected 2 times');
    expect(output).toContain('the occurrence sample came back empty');
  });
});
