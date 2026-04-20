import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger } from '@/lib/logger';

describe('logger', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('emits level, route, method, status, latency, jtiHash8', () => {
    const sink = vi.fn();
    const log = createLogger({ sink });
    log.info({ route: '/api/projects', method: 'POST', status: 201, latencyMs: 42, jti: 'abcdefghij1234567890x' });
    expect(sink).toHaveBeenCalledOnce();
    const e = sink.mock.calls[0]![0] as Record<string, unknown>;
    expect(e.level).toBe('info');
    expect(e.route).toBe('/api/projects');
    expect(e.method).toBe('POST');
    expect(e.status).toBe(201);
    expect(e.latencyMs).toBe(42);
    expect((e.jtiHash8 as string).length).toBe(8);
  });

  it('never logs req body, filenames, or project names', () => {
    const sink = vi.fn();
    const log = createLogger({ sink });
    log.info({ route: '/api/x', method: 'POST', status: 200, latencyMs: 1, jti: 'abcdefghij1234567890x',
      body: 'secret', filename: 'eia-plan.pdf', projectName: '강원풍력',
    });
    const e = sink.mock.calls[0]![0] as Record<string, unknown>;
    expect(e).not.toHaveProperty('body');
    expect(e).not.toHaveProperty('filename');
    expect(e).not.toHaveProperty('projectName');
  });

  it('masks IP to /24', () => {
    const sink = vi.fn();
    const log = createLogger({ sink });
    log.info({ route: '/x', method: 'GET', status: 200, latencyMs: 1, jti: 'abcdefghij1234567890x', ip: '203.0.113.77' });
    expect((sink.mock.calls[0]![0] as Record<string, unknown>).ip).toBe('203.0.113.0/24');
  });

  it('error entries include error name and message only', () => {
    const sink = vi.fn();
    const log = createLogger({ sink });
    const err = new Error('boom'); err.stack = 'STACK-DETAIL';
    log.error({ route: '/x', method: 'GET', status: 500, latencyMs: 1, jti: 'abcdefghij1234567890x', error: err });
    const e = sink.mock.calls[0]![0] as Record<string, unknown>;
    expect(e.errorName).toBe('Error');
    expect(e.errorMessage).toBe('boom');
    expect(JSON.stringify(e)).not.toContain('STACK-DETAIL');
  });
});
