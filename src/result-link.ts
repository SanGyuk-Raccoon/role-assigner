import {
  Assignment,
  AssignmentMode,
  LIMITS,
  codePointLength,
  createLookupKey,
  isSingleCycleManito,
  normalizeDisplayValue,
  utf8ByteLength,
} from '@/utils';

export const RESULT_PAYLOAD_VERSION = 1 as const;
export const MAX_ENCODED_PAYLOAD_LENGTH = 8_192;

export interface PersonalResultPayload {
  v: typeof RESULT_PAYLOAD_VERSION;
  kind: 'personal';
  mode: AssignmentMode;
  assignment: Assignment;
}

export interface SharedResultPayload {
  v: typeof RESULT_PAYLOAD_VERSION;
  kind: 'shared';
  mode: AssignmentMode;
  assignments: Assignment[];
}

export interface AllResultsPayload {
  v: typeof RESULT_PAYLOAD_VERSION;
  kind: 'all';
  mode: AssignmentMode;
  assignments: Assignment[];
}

export type ResultPayload = PersonalResultPayload | SharedResultPayload | AllResultsPayload;

export type PayloadErrorCode =
  | 'too-long'
  | 'invalid-base64'
  | 'invalid-utf8'
  | 'invalid-json'
  | 'unsupported-version'
  | 'invalid-schema';

export class PayloadError extends Error {
  constructor(public readonly code: PayloadErrorCode, message: string) {
    super(message);
    this.name = 'PayloadError';
  }
}

const textEncoder = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actualKeys.length === expected.length && actualKeys.every((key, index) => key === expected[index]);
}

function assertBoundedNormalizedString(
  value: unknown,
  label: string,
  maxCodePoints: number,
  maxBytes: number,
): asserts value is string {
  if (typeof value !== 'string' || !value || normalizeDisplayValue(value) !== value) {
    throw new PayloadError('invalid-schema', `${label} 형식이 올바르지 않습니다.`);
  }
  if (codePointLength(value) > maxCodePoints || utf8ByteLength(value) > maxBytes) {
    throw new PayloadError('invalid-schema', `${label} 길이가 허용 범위를 벗어났습니다.`);
  }
}

function validateAssignment(value: unknown, mode: AssignmentMode): Assignment {
  if (!isRecord(value) || !hasExactKeys(value, ['name', 'role'])) {
    throw new PayloadError('invalid-schema', '배정 결과 필드가 올바르지 않습니다.');
  }

  assertBoundedNormalizedString(
    value.name,
    '참가자 이름',
    LIMITS.maxParticipantCodePoints,
    LIMITS.maxParticipantBytes,
  );

  if (mode === 'manito') {
    assertBoundedNormalizedString(
      value.role,
      '마니또 이름',
      LIMITS.maxParticipantCodePoints,
      LIMITS.maxParticipantBytes,
    );
  } else {
    assertBoundedNormalizedString(
      value.role,
      '역할 이름',
      LIMITS.maxRoleCodePoints,
      LIMITS.maxRoleBytes,
    );
  }

  return { name: value.name, role: value.role };
}

function validateMode(value: unknown): AssignmentMode {
  if (value !== 'role' && value !== 'manito') {
    throw new PayloadError('invalid-schema', '배정 종류가 올바르지 않습니다.');
  }
  return value;
}

export function validateResultPayload(value: unknown): ResultPayload {
  if (!isRecord(value)) {
    throw new PayloadError('invalid-schema', '결과 payload는 객체여야 합니다.');
  }

  if (Object.prototype.hasOwnProperty.call(value, 'v') && value.v !== RESULT_PAYLOAD_VERSION) {
    throw new PayloadError('unsupported-version', '지원하지 않는 결과 링크 버전입니다.');
  }

  if (value.kind === 'personal') {
    if (!hasExactKeys(value, ['v', 'kind', 'mode', 'assignment']) || value.v !== RESULT_PAYLOAD_VERSION) {
      throw new PayloadError('invalid-schema', '개인 결과 payload 필드가 올바르지 않습니다.');
    }
    const mode = validateMode(value.mode);
    return {
      v: RESULT_PAYLOAD_VERSION,
      kind: 'personal',
      mode,
      assignment: validateAssignment(value.assignment, mode),
    };
  }

  if (value.kind === 'shared' || value.kind === 'all') {
    if (!hasExactKeys(value, ['v', 'kind', 'mode', 'assignments']) || value.v !== RESULT_PAYLOAD_VERSION) {
      throw new PayloadError('invalid-schema', '전체 결과 payload 필드가 올바르지 않습니다.');
    }
    const mode = validateMode(value.mode);
    if (
      !Array.isArray(value.assignments)
      || value.assignments.length < LIMITS.minParticipants
      || value.assignments.length > LIMITS.maxParticipants
    ) {
      throw new PayloadError('invalid-schema', '전체 결과의 참가자 수가 허용 범위를 벗어났습니다.');
    }

    const assignments = value.assignments.map((assignment) => validateAssignment(assignment, mode));
    const participantKeys = new Set<string>();
    for (const assignment of assignments) {
      const key = createLookupKey(assignment.name);
      if (participantKeys.has(key)) {
        throw new PayloadError('invalid-schema', '전체 결과에 중복된 참가자 이름이 있습니다.');
      }
      participantKeys.add(key);
    }

    if (mode === 'manito' && !isSingleCycleManito(assignments)) {
      throw new PayloadError('invalid-schema', '마니또 결과가 단일 순환 배정이 아닙니다.');
    }

    return { v: RESULT_PAYLOAD_VERSION, kind: value.kind, mode, assignments };
  }

  throw new PayloadError('invalid-schema', '알 수 없는 결과 링크 종류입니다.');
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function base64UrlToBytes(encoded: string): Uint8Array {
  if (!encoded || !/^[A-Za-z0-9_-]+$/u.test(encoded) || encoded.length % 4 === 1) {
    throw new PayloadError('invalid-base64', 'base64url 형식이 올바르지 않습니다.');
  }

  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new PayloadError('invalid-base64', 'base64url 데이터를 해석할 수 없습니다.');
  }

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytesToBase64Url(bytes) !== encoded) {
    throw new PayloadError('invalid-base64', 'base64url 데이터가 정규 형식이 아닙니다.');
  }
  return bytes;
}

export function isEncodedPayloadWithinLimit(encoded: string): boolean {
  return encoded.length <= MAX_ENCODED_PAYLOAD_LENGTH;
}

export function encodeResultPayload(payload: ResultPayload): string {
  const validated = validateResultPayload(payload);
  const encoded = bytesToBase64Url(textEncoder.encode(JSON.stringify(validated)));
  if (!isEncodedPayloadWithinLimit(encoded)) {
    throw new PayloadError('too-long', '공유 링크가 8,192자를 넘어 생성할 수 없습니다.');
  }
  return encoded;
}

export function decodeResultPayload(encoded: string): ResultPayload {
  if (!isEncodedPayloadWithinLimit(encoded)) {
    throw new PayloadError('too-long', '결과 링크가 8,192자를 넘습니다.');
  }

  const bytes = base64UrlToBytes(encoded);
  let json: string;
  try {
    json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new PayloadError('invalid-utf8', '결과 링크의 UTF-8 데이터가 올바르지 않습니다.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new PayloadError('invalid-json', '결과 링크의 JSON 데이터가 올바르지 않습니다.');
  }

  return validateResultPayload(parsed);
}

export function createPersonalPayload(
  mode: AssignmentMode,
  assignment: Assignment,
): PersonalResultPayload {
  return validateResultPayload({
    v: RESULT_PAYLOAD_VERSION,
    kind: 'personal',
    mode,
    assignment,
  }) as PersonalResultPayload;
}

export function createSharedPayload(
  mode: AssignmentMode,
  assignments: readonly Assignment[],
): SharedResultPayload {
  return validateResultPayload({
    v: RESULT_PAYLOAD_VERSION,
    kind: 'shared',
    mode,
    assignments: assignments.map((assignment) => ({ ...assignment })),
  }) as SharedResultPayload;
}

export function createAllResultsPayload(
  mode: AssignmentMode,
  assignments: readonly Assignment[],
): AllResultsPayload {
  return validateResultPayload({
    v: RESULT_PAYLOAD_VERSION,
    kind: 'all',
    mode,
    assignments: assignments.map((assignment) => ({ ...assignment })),
  }) as AllResultsPayload;
}

export function readResultHash(hash: string): ResultPayload | null {
  if (!hash) return null;
  if (!hash.startsWith('#result=')) return null;
  return decodeResultPayload(hash.slice('#result='.length));
}

export function buildResultUrl(
  location: Pick<Location, 'origin' | 'pathname' | 'search'>,
  payload: ResultPayload,
): string {
  return `${location.origin}${location.pathname}${location.search}#result=${encodeResultPayload(payload)}`;
}
