import { describe, expect, it, vi } from 'vitest';
import {
  Assignment,
  LIMITS,
  ParticipantInput,
  RoleInput,
  assign,
  codePointLength,
  createCryptoRandomIndex,
  createLookupKey,
  createRolePool,
  fisherYates,
  isSingleCycleManito,
  normalizeDisplayValue,
  sattolo,
  utf8ByteLength,
  validateSetup,
} from '../../utils';

const participants = (names: string[]): ParticipantInput[] =>
  names.map((name, index) => ({ id: `p-${index}`, name }));

const roles = (values: Array<[string, number]>): RoleInput[] =>
  values.map(([name, count], index) => ({ id: `r-${index}`, name, count }));

const zeroIndex = () => 0;

describe('문자열 정규화와 제한', () => {
  it('앞뒤 공백을 제거하고 연속된 Unicode 공백을 하나로 합친다', () => {
    expect(normalizeDisplayValue('  김\t 철수\n님  ')).toBe('김 철수 님');
  });

  it('조회 키에 NFKC와 locale-independent 소문자를 적용한다', () => {
    expect(createLookupKey('  ＡＬＩＣＥ  ')).toBe('alice');
    expect(createLookupKey('Alice')).toBe('alice');
  });

  it('Unicode code point와 UTF-8 바이트를 각각 센다', () => {
    expect(codePointLength('가😀')).toBe(2);
    expect(utf8ByteLength('가😀')).toBe(7);
  });

  it('참가자 이름 20 code point·80바이트 경계를 허용하고 초과를 거부한다', () => {
    const allowed = validateSetup('manito', participants(['😀'.repeat(20), '친구']), []);
    const tooLong = validateSetup('manito', participants(['😀'.repeat(21), '친구']), []);
    expect(allowed.valid).toBe(true);
    expect(tooLong.issues.some((issue) => issue.field === 'participant:p-0')).toBe(true);
  });

  it('역할 이름 30 code point·120바이트 경계를 허용하고 초과를 거부한다', () => {
    const allowed = validateSetup('role', participants(['A', 'B']), roles([['😀'.repeat(30), 0]]));
    const tooLong = validateSetup('role', participants(['A', 'B']), roles([['😀'.repeat(31), 0]]));
    expect(allowed.valid).toBe(true);
    expect(tooLong.issues.some((issue) => issue.field === 'role-name:r-0')).toBe(true);
  });
});

describe('설정 검증', () => {
  it('참가자는 2명부터 20명까지 허용한다', () => {
    const twenty = participants(Array.from({ length: 20 }, (_, index) => `참가자 ${index}`));
    const twentyOne = participants(Array.from({ length: 21 }, (_, index) => `참가자 ${index}`));
    expect(validateSetup('manito', twenty, []).valid).toBe(true);
    expect(validateSetup('manito', twentyOne, []).issues).toContainEqual({
      field: 'participants',
      message: '참가자는 최대 20명까지 입력할 수 있습니다.',
    });
    expect(validateSetup('manito', participants(['혼자']), []).valid).toBe(false);
  });

  it('빈 이름과 표시 정규화 후 중복 이름을 거부한다', () => {
    const empty = validateSetup('manito', participants(['', '친구']), []);
    const duplicate = validateSetup('manito', participants(['Alice', ' ＡＬＩＣＥ ']), []);
    expect(empty.issues.some((issue) => issue.field === 'participant:p-0')).toBe(true);
    expect(duplicate.issues.some((issue) => issue.field === 'participant:p-1')).toBe(true);
  });

  it('역할은 최대 20개이며 빈 이름과 정규화 중복을 거부한다', () => {
    const tooManyRoles = roles(Array.from({ length: 21 }, (_, index) => [`역할 ${index}`, index === 0 ? 0 : 1]));
    expect(validateSetup('role', participants(['A', 'B']), tooManyRoles).issues).toContainEqual({
      field: 'roles',
      message: '역할은 최대 20개까지 입력할 수 있습니다.',
    });
    expect(validateSetup('role', participants(['A', 'B']), roles([['', 0]])).valid).toBe(false);
    expect(validateSetup('role', participants(['A', 'B']), roles([['시민', 1], ['  시민 ', 1]])).valid).toBe(false);
  });

  it('역할 인원은 0–20 사이 정수만 허용한다', () => {
    for (const count of [-1, 1.5, 21, Number.NaN]) {
      const result = validateSetup('role', participants(['A', 'B']), roles([['시민', count]]));
      expect(result.issues.some((issue) => issue.field === 'role-count:r-0')).toBe(true);
    }
  });

  it('0명 역할은 하나만 허용한다', () => {
    const result = validateSetup('role', participants(['A', 'B']), roles([['시민', 0], ['마피아', 0]]));
    expect(result.issues.some((issue) => issue.message.includes('하나만'))).toBe(true);
  });

  it('양수 역할 합계의 초과와 나머지 역할 없는 부족을 거부한다', () => {
    const over = validateSetup('role', participants(['A', 'B']), roles([['시민', 3]]));
    const short = validateSetup('role', participants(['A', 'B', 'C']), roles([['마피아', 1], ['시민', 1]]));
    expect(over.issues.some((issue) => issue.message.includes('많습니다'))).toBe(true);
    expect(short.issues.some((issue) => issue.message.includes('0명'))).toBe(true);
  });

  it('0명 역할로 남은 인원을 정확히 채운다', () => {
    expect(createRolePool([{ name: '마피아', count: 1 }, { name: '시민', count: 0 }], 4))
      .toEqual(['마피아', '시민', '시민', '시민']);
  });
});

describe('결정적 배정', () => {
  it('Fisher-Yates는 원본을 바꾸지 않고 모든 값을 보존한다', () => {
    const source = ['A', 'B', 'C', 'D'];
    const shuffled = fisherYates(source, zeroIndex);
    expect(source).toEqual(['A', 'B', 'C', 'D']);
    expect([...shuffled].sort()).toEqual([...source].sort());
    expect(shuffled).toEqual(['B', 'C', 'D', 'A']);
  });

  it('Sattolo는 단일 순환을 만들고 자기 자신을 배정하지 않는다', () => {
    const names = ['A', 'B', 'C', 'D'];
    const targets = sattolo(names, zeroIndex);
    const assignments: Assignment[] = names.map((name, index) => ({ name, role: targets[index] }));
    expect(targets.every((target, index) => target !== names[index])).toBe(true);
    expect(isSingleCycleManito(assignments)).toBe(true);
  });

  it('일반 역할은 모든 참가자에게 역할을 정확히 한 번 배정한다', () => {
    const result = assign('role', ['A', 'B', 'C', 'D'], [
      { name: '마피아', count: 1 },
      { name: '시민', count: 0 },
    ], zeroIndex);
    expect(result.map((item) => item.name)).toEqual(['A', 'B', 'C', 'D']);
    expect(result.filter((item) => item.role === '마피아')).toHaveLength(1);
    expect(result.filter((item) => item.role === '시민')).toHaveLength(3);
  });

  it('마니또는 20명도 중복·자기 배정 없이 단일 순환으로 배정한다', () => {
    const names = Array.from({ length: LIMITS.maxParticipants }, (_, index) => `P${index}`);
    const result = assign('manito', names, [], zeroIndex);
    expect(new Set(result.map((item) => item.name)).size).toBe(names.length);
    expect(new Set(result.map((item) => item.role)).size).toBe(names.length);
    expect(result.every((item) => item.name !== item.role)).toBe(true);
    expect(isSingleCycleManito(result)).toBe(true);
  });

  it('주입한 난수 인덱스 범위를 검사한다', () => {
    expect(() => fisherYates([1, 2], () => 2)).toThrow(RangeError);
  });
});

describe('Web Crypto 난수 어댑터', () => {
  it('Web Crypto가 없으면 Math.random으로 대체하지 않는다', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    expect(() => createCryptoRandomIndex(null as unknown as undefined)).toThrow('안전한 역할 섞기');
    expect(randomSpy).not.toHaveBeenCalled();
    randomSpy.mockRestore();
  });

  it('편향을 피하기 위해 허용 범위 밖 Uint32 값을 다시 뽑는다', () => {
    const values = [0xffff_ffff, 5];
    const cryptoSource = {
      getRandomValues(array: Uint32Array) {
        array[0] = values.shift() ?? 0;
        return array;
      },
    } as unknown as Pick<Crypto, 'getRandomValues'>;
    const randomIndex = createCryptoRandomIndex(cryptoSource);
    expect(randomIndex(3)).toBe(2);
    expect(values).toHaveLength(0);
  });
});
