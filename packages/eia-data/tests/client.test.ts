import { describe, it, expect } from 'vitest';
import { PortalClient } from '../src/client';
import { MissingServiceKeyError, loadServiceKey } from '../src/auth';
import { isPortalSuccess, PORTAL_SUCCESS_CODE } from '../src/types/common';

describe('PortalClient — 스캐폴딩 (실제 호출 없음)', () => {
  it('SERVICE_KEY 가 없으면 MissingServiceKeyError 를 던진다', () => {
    expect(() => new PortalClient({})).toThrow(MissingServiceKeyError);
  });

  it('SERVICE_KEY 가 공백만 있으면 MissingServiceKeyError 를 던진다', () => {
    expect(() => new PortalClient({ SERVICE_KEY: '   ' })).toThrow(MissingServiceKeyError);
  });

  it('SERVICE_KEY 가 있으면 buildUrl 로 URL 을 생성할 수 있다', () => {
    const client = new PortalClient({ SERVICE_KEY: 'test-key-placeholder' });
    const url = client.buildUrl({
      path: '/1480000/ExampleService/getExample',
      query: { pageNo: 1, numOfRows: 10 }
    });
    expect(url).toContain('apis.data.go.kr');
    expect(url).toContain('/1480000/ExampleService/getExample');
    expect(url).toContain('serviceKey=test-key-placeholder');
    expect(url).toContain('pageNo=1');
    expect(url).toContain('numOfRows=10');
  });

  it('call() 은 미구현 — 다음 feature 에서 채움', async () => {
    const client = new PortalClient({ SERVICE_KEY: 'test-key-placeholder' });
    await expect(client.call({ path: '/test/endpoint' })).rejects.toThrow(/not implemented/);
  });

  it('baseUrl / timeoutMs / retries 기본값을 제공한다', () => {
    const client = new PortalClient({ SERVICE_KEY: 'k' });
    expect(client.baseUrl).toBe('https://apis.data.go.kr');
    expect(client.timeoutMs).toBe(10_000);
    expect(client.retries).toBe(1);
  });

  it('옵션으로 기본값을 override 할 수 있다', () => {
    const client = new PortalClient(
      { SERVICE_KEY: 'k' },
      { baseUrl: 'https://example.test', timeoutMs: 5_000, retries: 3 }
    );
    expect(client.baseUrl).toBe('https://example.test');
    expect(client.timeoutMs).toBe(5_000);
    expect(client.retries).toBe(3);
  });
});

describe('loadServiceKey', () => {
  it('trim 된 값을 반환한다', () => {
    expect(loadServiceKey({ SERVICE_KEY: '  abc  ' })).toBe('abc');
  });
});

describe('isPortalSuccess', () => {
  it("resultCode '00' 이면 true", () => {
    const res = {
      response: { header: { resultCode: PORTAL_SUCCESS_CODE, resultMsg: 'NORMAL SERVICE' } }
    };
    expect(isPortalSuccess(res)).toBe(true);
  });

  it("resultCode 가 '00' 이 아니면 false", () => {
    const res = {
      response: { header: { resultCode: '99', resultMsg: 'UNKNOWN ERROR' } }
    };
    expect(isPortalSuccess(res)).toBe(false);
  });
});
