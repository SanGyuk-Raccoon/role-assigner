/**
 * Browser-only role assignment domain logic.
 *
 * Every function in this module is deterministic when a RandomIndex function is
 * supplied. The runtime adapter uses Web Crypto and never falls back to a
 * non-cryptographic random source.
 */

export const LIMITS = {
  minParticipants: 2,
  maxParticipants: 20,
  maxParticipantCodePoints: 20,
  maxParticipantBytes: 80,
  maxRoles: 20,
  maxRoleCodePoints: 30,
  maxRoleBytes: 120,
  maxRoleCount: 20,
} as const;

export type AssignmentMode = 'role' | 'manito';

export interface ParticipantInput {
  id: string;
  name: string;
}

export interface RoleInput {
  id: string;
  name: string;
  count: number;
}

export interface Assignment {
  name: string;
  role: string;
}

export interface NormalizedRole {
  name: string;
  count: number;
}

export type ValidationField =
  | 'participants'
  | 'roles'
  | `participant:${string}`
  | `role-name:${string}`
  | `role-count:${string}`;

export interface ValidationIssue {
  field: ValidationField;
  message: string;
}

export interface SetupValidation {
  valid: boolean;
  issues: ValidationIssue[];
  participants: string[];
  roles: NormalizedRole[];
}

export type RandomIndex = (upperExclusive: number) => number;

const textEncoder = new TextEncoder();

export function normalizeDisplayValue(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

export function createLookupKey(value: string): string {
  return normalizeDisplayValue(value).normalize('NFKC').toLowerCase();
}

export function codePointLength(value: string): number {
  return [...value].length;
}

export function utf8ByteLength(value: string): number {
  return textEncoder.encode(value).byteLength;
}

export interface LimitedDisplayInput {
  value: string;
  exceeded: boolean;
}

export function limitDisplayInput(
  value: string,
  maxCodePoints: number,
  maxBytes: number,
): LimitedDisplayInput {
  const normalized = normalizeDisplayValue(value);
  if (
    codePointLength(normalized) <= maxCodePoints
    && utf8ByteLength(normalized) <= maxBytes
  ) {
    return { value, exceeded: false };
  }

  const accepted: string[] = [];
  let acceptedBytes = 0;

  for (const point of normalized) {
    const pointBytes = utf8ByteLength(point);
    if (accepted.length >= maxCodePoints || acceptedBytes + pointBytes > maxBytes) break;
    accepted.push(point);
    acceptedBytes += pointBytes;
  }

  return { value: accepted.join(''), exceeded: true };
}

function validateBoundedText(
  value: string,
  label: string,
  maxCodePoints: number,
  maxBytes: number,
): string | null {
  if (!value) return `${label}을 입력해주세요.`;

  const points = codePointLength(value);
  if (points > maxCodePoints) {
    return `${label}은 ${maxCodePoints}자 이하여야 합니다. 현재 ${points}자입니다.`;
  }

  const bytes = utf8ByteLength(value);
  if (bytes > maxBytes) {
    return `${label}은 UTF-8 ${maxBytes}바이트 이하여야 합니다. 현재 ${bytes}바이트입니다.`;
  }

  return null;
}

export function validateSetup(
  mode: AssignmentMode,
  participantInputs: ParticipantInput[],
  roleInputs: RoleInput[],
): SetupValidation {
  const issues: ValidationIssue[] = [];
  const participants = participantInputs.map((participant) => normalizeDisplayValue(participant.name));

  if (participantInputs.length < LIMITS.minParticipants) {
    issues.push({ field: 'participants', message: '참가자는 최소 2명이 필요합니다.' });
  }
  if (participantInputs.length > LIMITS.maxParticipants) {
    issues.push({ field: 'participants', message: '참가자는 최대 20명까지 입력할 수 있습니다.' });
  }

  const participantKeys = new Map<string, string>();
  participantInputs.forEach((participant, index) => {
    const displayName = participants[index];
    const textError = validateBoundedText(
      displayName,
      '참가자 이름',
      LIMITS.maxParticipantCodePoints,
      LIMITS.maxParticipantBytes,
    );

    if (textError) {
      issues.push({ field: `participant:${participant.id}`, message: textError });
      return;
    }

    const key = createLookupKey(displayName);
    if (participantKeys.has(key)) {
      issues.push({
        field: `participant:${participant.id}`,
        message: `“${displayName}” 이름이 중복됩니다. 서로 다른 이름을 입력해주세요.`,
      });
      return;
    }
    participantKeys.set(key, participant.id);
  });

  const roles: NormalizedRole[] = roleInputs.map((role) => ({
    name: normalizeDisplayValue(role.name),
    count: role.count,
  }));

  if (mode === 'role') {
    if (roleInputs.length === 0) {
      issues.push({ field: 'roles', message: '역할을 최소 1개 입력해주세요.' });
    }
    if (roleInputs.length > LIMITS.maxRoles) {
      issues.push({ field: 'roles', message: '역할은 최대 20개까지 입력할 수 있습니다.' });
    }

    const roleKeys = new Set<string>();
    roleInputs.forEach((role, index) => {
      const normalizedRole = roles[index];
      const textError = validateBoundedText(
        normalizedRole.name,
        '역할 이름',
        LIMITS.maxRoleCodePoints,
        LIMITS.maxRoleBytes,
      );

      if (textError) {
        issues.push({ field: `role-name:${role.id}`, message: textError });
      } else {
        const key = createLookupKey(normalizedRole.name);
        if (roleKeys.has(key)) {
          issues.push({
            field: `role-name:${role.id}`,
            message: `“${normalizedRole.name}” 역할이 중복됩니다.`,
          });
        } else {
          roleKeys.add(key);
        }
      }

      if (
        !Number.isInteger(normalizedRole.count)
        || normalizedRole.count < 0
        || normalizedRole.count > LIMITS.maxRoleCount
      ) {
        issues.push({
          field: `role-count:${role.id}`,
          message: '역할 인원은 0명부터 20명 사이의 정수여야 합니다.',
        });
      }
    });

    const validCounts = roles.every(
      (role) => Number.isInteger(role.count) && role.count >= 0 && role.count <= LIMITS.maxRoleCount,
    );
    if (validCounts) {
      const remainderRoles = roles.filter((role) => role.count === 0);
      const fixedCount = roles.reduce((sum, role) => sum + (role.count > 0 ? role.count : 0), 0);

      if (remainderRoles.length > 1) {
        const remainderIndexes = roles
          .map((role, index) => (role.count === 0 ? index : -1))
          .filter((index) => index >= 0);
        const secondRemainder = roleInputs[remainderIndexes[1]];
        issues.push({
          field: secondRemainder ? `role-count:${secondRemainder.id}` : 'roles',
          message: '0명(나머지) 역할은 하나만 설정할 수 있습니다.',
        });
      }

      if (fixedCount > participants.length) {
        issues.push({ field: 'roles', message: '지정한 역할 인원 합계가 참가자 수보다 많습니다.' });
      } else if (fixedCount < participants.length && remainderRoles.length === 0) {
        issues.push({
          field: 'roles',
          message: '남은 참가자를 배정하려면 역할 하나를 0명(나머지)으로 설정해주세요.',
        });
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    participants,
    roles: mode === 'role' ? roles : [],
  };
}

export function createRolePool(roles: NormalizedRole[], participantCount: number): string[] {
  const pool: string[] = [];
  let remainderRole: string | null = null;

  for (const role of roles) {
    if (role.count === 0) {
      remainderRole = role.name;
      continue;
    }
    for (let index = 0; index < role.count; index += 1) {
      pool.push(role.name);
    }
  }

  if (pool.length < participantCount && remainderRole) {
    while (pool.length < participantCount) pool.push(remainderRole);
  }

  if (pool.length !== participantCount) {
    throw new Error('검증되지 않은 역할 구성이 전달되었습니다.');
  }

  return pool;
}

function checkedRandomIndex(randomIndex: RandomIndex, upperExclusive: number): number {
  const value = randomIndex(upperExclusive);
  if (!Number.isInteger(value) || value < 0 || value >= upperExclusive) {
    throw new RangeError(`난수 인덱스는 0 이상 ${upperExclusive} 미만이어야 합니다.`);
  }
  return value;
}

export function fisherYates<T>(values: readonly T[], randomIndex: RandomIndex): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = checkedRandomIndex(randomIndex, index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function sattolo<T>(values: readonly T[], randomIndex: RandomIndex): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = checkedRandomIndex(randomIndex, index);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function assign(
  mode: AssignmentMode,
  participants: readonly string[],
  roles: readonly NormalizedRole[],
  randomIndex: RandomIndex,
): Assignment[] {
  if (participants.length < LIMITS.minParticipants || participants.length > LIMITS.maxParticipants) {
    throw new Error('검증되지 않은 참가자 구성이 전달되었습니다.');
  }

  if (mode === 'manito') {
    const targets = sattolo(participants, randomIndex);
    return participants.map((name, index) => ({ name, role: targets[index] }));
  }

  const pool = createRolePool([...roles], participants.length);
  const shuffledRoles = fisherYates(pool, randomIndex);
  return participants.map((name, index) => ({ name, role: shuffledRoles[index] }));
}

export function createCryptoRandomIndex(
  cryptoSource: Pick<Crypto, 'getRandomValues'> | undefined = globalThis.crypto,
): RandomIndex {
  if (!cryptoSource || typeof cryptoSource.getRandomValues !== 'function') {
    throw new Error('이 브라우저는 안전한 역할 섞기를 지원하지 않습니다. 최신 브라우저에서 다시 시도해주세요.');
  }

  return (upperExclusive: number): number => {
    if (!Number.isInteger(upperExclusive) || upperExclusive < 1 || upperExclusive > 0x1_0000_0000) {
      throw new RangeError('난수 범위가 올바르지 않습니다.');
    }
    if (upperExclusive === 1) return 0;

    const range = 0x1_0000_0000;
    const acceptedLimit = Math.floor(range / upperExclusive) * upperExclusive;
    const values = new Uint32Array(1);
    let value: number;
    do {
      cryptoSource.getRandomValues(values);
      value = values[0];
    } while (value >= acceptedLimit);

    return value % upperExclusive;
  };
}

export function isSingleCycleManito(assignments: readonly Assignment[]): boolean {
  if (assignments.length < LIMITS.minParticipants) return false;

  const indexByName = new Map(assignments.map((assignment, index) => [createLookupKey(assignment.name), index]));
  const visited = new Set<number>();
  let current = 0;

  for (let step = 0; step < assignments.length; step += 1) {
    if (visited.has(current)) return false;
    visited.add(current);
    const next = indexByName.get(createLookupKey(assignments[current].role));
    if (next === undefined || next === current) return false;
    current = next;
  }

  return current === 0 && visited.size === assignments.length;
}
