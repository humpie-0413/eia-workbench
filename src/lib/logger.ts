type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogInput {
  route: string;
  method: string;
  status: number;
  latencyMs: number;
  jti: string;
  ip?: string;
  error?: Error;
  // Any other key is silently dropped.
  [_: string]: unknown;
}

interface LogEntry {
  level: Level;
  ts: string;
  route: string;
  method: string;
  status: number;
  latencyMs: number;
  jtiHash8: string;
  ip?: string;
  errorName?: string;
  errorMessage?: string;
}

function maskIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) return `${m[1]}.${m[2]}.${m[3]}.0/24`;
  return undefined;
}

function hash8(jti: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < jti.length; i++) {
    h ^= jti.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 8);
}

function build(level: Level, i: LogInput): LogEntry {
  const entry: LogEntry = {
    level,
    ts: new Date().toISOString(),
    route: i.route,
    method: i.method,
    status: i.status,
    latencyMs: i.latencyMs,
    jtiHash8: hash8(i.jti)
  };
  const ip = maskIp(i.ip);
  if (ip !== undefined) entry.ip = ip;
  if (i.error) {
    entry.errorName = i.error.name;
    entry.errorMessage = i.error.message;
  }
  return entry;
}

export interface Logger {
  debug(i: LogInput): void;
  info(i: LogInput): void;
  warn(i: LogInput): void;
  error(i: LogInput): void;
}

export function createLogger(opts: { sink?: (e: LogEntry) => void } = {}): Logger {
  const sink = opts.sink ?? ((e) => console.log(JSON.stringify(e)));
  return {
    debug: (i) => sink(build('debug', i)),
    info: (i) => sink(build('info', i)),
    warn: (i) => sink(build('warn', i)),
    error: (i) => sink(build('error', i))
  };
}

export const logger = createLogger();
