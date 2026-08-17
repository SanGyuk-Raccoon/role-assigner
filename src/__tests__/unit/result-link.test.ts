import { describe, expect, it } from 'vitest';
import {
  MAX_ENCODED_PAYLOAD_LENGTH,
  PayloadError,
  RESULT_PAYLOAD_VERSION,
  buildResultUrl,
  createAllResultsPayload,
  createPersonalPayload,
  createSharedPayload,
  decodeResultPayload,
  encodeResultPayload,
  isEncodedPayloadWithinLimit,
  readResultHash,
  validateResultPayload,
} from '../../result-link';

function rawBase64Url(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Buffer.from(bytes).toString('base64url');
}

const assignments = [
  { name: '철수 😀', role: '마피아 🐺' },
  { name: '영희', role: '시민' },
];

describe('결과 링크 codec', () => {
  it('개인 payload의 한국어·이모지를 패딩 없는 base64url로 왕복한다', () => {
    const payload = createPersonalPayload('role', assignments[0]);
    const encoded = encodeResultPayload(payload);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(encoded).not.toContain('=');
    expect(decodeResultPayload(encoded)).toEqual(payload);
  });

  it('전체 결과와 참가자 확인 payload를 다른 종류로 왕복한다', () => {
    const allPayload = createAllResultsPayload('role', assignments);
    const sharedPayload = createSharedPayload('role', assignments);

    expect(decodeResultPayload(encodeResultPayload(allPayload))).toEqual(allPayload);
    expect(decodeResultPayload(encodeResultPayload(sharedPayload))).toEqual(sharedPayload);
    expect(allPayload.kind).toBe('all');
    expect(sharedPayload.kind).toBe('shared');
    expect(new Set(allPayload.assignments.map((item) => item.name)).size).toBe(2);
    expect(new Set(sharedPayload.assignments.map((item) => item.name)).size).toBe(2);
  });

  it('개인 payload에는 한 참가자의 결과 외 다른 데이터가 없다', () => {
    const payload = createPersonalPayload('role', assignments[0]);
    const json = JSON.parse(Buffer.from(encodeResultPayload(payload), 'base64url').toString('utf8'));
    expect(Object.keys(json).sort()).toEqual(['assignment', 'kind', 'mode', 'v']);
    expect(Object.keys(json.assignment).sort()).toEqual(['name', 'role']);
    expect(JSON.stringify(json)).not.toContain('영희');
  });

  it('현재 base path와 hash fragment로 URL을 만든다', () => {
    const payload = createPersonalPayload('role', assignments[0]);
    const url = buildResultUrl({
      origin: 'https://example.com',
      pathname: '/role-assigner',
      search: '?from=test',
    } as Location, payload);
    expect(url).toMatch(/^https:\/\/example\.com\/role-assigner\?from=test#result=/u);
    expect(readResultHash(new URL(url).hash)).toEqual(payload);
  });

  it('20명의 최악 길이 payload도 8,192자 안에 둔다', () => {
    const worst = Array.from({ length: 20 }, (_, index) => ({
      name: `${'😀'.repeat(19)}${String.fromCodePoint(0x1f600 + index)}`,
      role: '🂠'.repeat(30),
    }));
    expect(encodeResultPayload(createAllResultsPayload('role', worst)).length)
      .toBeLessThanOrEqual(MAX_ENCODED_PAYLOAD_LENGTH);
    expect(encodeResultPayload(createSharedPayload('role', worst)).length)
      .toBeLessThanOrEqual(MAX_ENCODED_PAYLOAD_LENGTH);
  });

  it('8,192자 경계는 허용하고 8,193자는 디코딩 전에 거부한다', () => {
    expect(isEncodedPayloadWithinLimit('A'.repeat(8_192))).toBe(true);
    expect(isEncodedPayloadWithinLimit('A'.repeat(8_193))).toBe(false);
    expect(() => decodeResultPayload('A'.repeat(8_193))).toThrowError(
      expect.objectContaining<Partial<PayloadError>>({ code: 'too-long' }),
    );
  });
});

describe('엄격한 payload 검증', () => {
  it('알 수 없는 버전을 별도 오류로 거부한다', () => {
    const encoded = rawBase64Url(JSON.stringify({
      v: RESULT_PAYLOAD_VERSION + 1,
      kind: 'personal',
      mode: 'role',
      assignment: assignments[0],
    }));
    expect(() => decodeResultPayload(encoded)).toThrowError(
      expect.objectContaining<Partial<PayloadError>>({ code: 'unsupported-version' }),
    );
  });

  it.each([
    ['알 수 없는 kind', { v: 1, kind: 'other', mode: 'role', assignment: assignments[0] }],
    ['누락 필드', { v: 1, kind: 'personal', mode: 'role' }],
    ['여분 필드', { v: 1, kind: 'personal', mode: 'role', assignment: assignments[0], extra: true }],
    ['배정 여분 필드', { v: 1, kind: 'personal', mode: 'role', assignment: { ...assignments[0], extra: true } }],
    ['정규화되지 않은 이름', { v: 1, kind: 'personal', mode: 'role', assignment: { name: ' 철수 ', role: '시민' } }],
  ])('%s를 거부한다', (_label, value) => {
    expect(() => validateResultPayload(value)).toThrowError(
      expect.objectContaining<Partial<PayloadError>>({ code: 'invalid-schema' }),
    );
  });

  it('잘못된 base64url, UTF-8, JSON을 각각 거부한다', () => {
    expect(() => decodeResultPayload('a')).toThrowError(
      expect.objectContaining<Partial<PayloadError>>({ code: 'invalid-base64' }),
    );
    expect(() => decodeResultPayload('_w')).toThrowError(
      expect.objectContaining<Partial<PayloadError>>({ code: 'invalid-utf8' }),
    );
    expect(() => decodeResultPayload(rawBase64Url('{'))).toThrowError(
      expect.objectContaining<Partial<PayloadError>>({ code: 'invalid-json' }),
    );
  });

  it('중복 정규화 이름과 20명 초과 전체 결과 payload를 거부한다', () => {
    expect(() => validateResultPayload({
      v: 1,
      kind: 'all',
      mode: 'role',
      assignments: [
        { name: 'Alice', role: 'A' },
        { name: 'ＡＬＩＣＥ', role: 'B' },
      ],
    })).toThrowError(expect.objectContaining<Partial<PayloadError>>({ code: 'invalid-schema' }));

    expect(() => validateResultPayload({
      v: 1,
      kind: 'shared',
      mode: 'role',
      assignments: Array.from({ length: 21 }, (_, index) => ({ name: `P${index}`, role: '시민' })),
    })).toThrowError(expect.objectContaining<Partial<PayloadError>>({ code: 'invalid-schema' }));
  });

  it('마니또 전체 데이터 payload는 같은 참가자 집합의 단일 순환만 허용한다', () => {
    const valid = createSharedPayload('manito', [
      { name: 'A', role: 'B' },
      { name: 'B', role: 'C' },
      { name: 'C', role: 'A' },
    ]);
    expect(decodeResultPayload(encodeResultPayload(valid))).toEqual(valid);
    expect(decodeResultPayload(encodeResultPayload(createAllResultsPayload('manito', valid.assignments))))
      .toEqual(expect.objectContaining({ kind: 'all', assignments: valid.assignments }));
    expect(() => validateResultPayload({
      v: 1,
      kind: 'shared',
      mode: 'manito',
      assignments: [
        { name: 'A', role: 'A' },
        { name: 'B', role: 'B' },
      ],
    })).toThrowError(expect.objectContaining<Partial<PayloadError>>({ code: 'invalid-schema' }));
  });

  it('이름·역할 code point와 바이트 상한을 링크에서도 다시 검사한다', () => {
    expect(() => validateResultPayload({
      v: 1,
      kind: 'personal',
      mode: 'role',
      assignment: { name: '😀'.repeat(21), role: '시민' },
    })).toThrowError(PayloadError);
    expect(() => validateResultPayload({
      v: 1,
      kind: 'personal',
      mode: 'role',
      assignment: { name: '철수', role: '😀'.repeat(31) },
    })).toThrowError(PayloadError);
  });
});
