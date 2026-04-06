import { describe, it, expect } from 'vitest';
import {
  shuffleArray,
  createRolePool,
  assignGeneralRoles,
  validateRoleConfig,
  generateDerangement,
  assignManitoRoles,
  isValidManitoAssignment,
  RoleConfig,
  Participant,
} from '../../utils';

// Helper to create participants
const createParticipants = (names: string[]): Participant[] =>
  names.map((name, i) => ({ id: String(i + 1), name, password: 'pass' }));

describe('shuffleArray', () => {
  it('returns array with same elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(arr);
    expect(shuffled.sort()).toEqual(arr.sort());
  });

  it('does not modify original array', () => {
    const arr = [1, 2, 3];
    const original = [...arr];
    shuffleArray(arr);
    expect(arr).toEqual(original);
  });

  it('handles empty array', () => {
    expect(shuffleArray([])).toEqual([]);
  });
});

describe('createRolePool', () => {
  it('creates pool with exact role counts', () => {
    const roles: RoleConfig[] = [
      { id: '1', name: '마피아', count: 2, description: '' },
      { id: '2', name: '시민', count: 3, description: '' },
    ];
    const pool = createRolePool(roles, 5);

    expect(pool).toHaveLength(5);
    expect(pool!.filter(r => r === '마피아')).toHaveLength(2);
    expect(pool!.filter(r => r === '시민')).toHaveLength(3);
  });

  it('fills remaining spots with count=0 role', () => {
    const roles: RoleConfig[] = [
      { id: '1', name: '스파이', count: 1, description: '' },
      { id: '2', name: '시민', count: 0, description: '' },
    ];
    const pool = createRolePool(roles, 5);

    expect(pool).toHaveLength(5);
    expect(pool!.filter(r => r === '스파이')).toHaveLength(1);
    expect(pool!.filter(r => r === '시민')).toHaveLength(4);
  });

  it('returns null when roles exceed participants', () => {
    const roles: RoleConfig[] = [
      { id: '1', name: '마피아', count: 5, description: '' },
    ];
    expect(createRolePool(roles, 3)).toBeNull();
  });

  it('returns null when no remaining role to fill gap', () => {
    const roles: RoleConfig[] = [
      { id: '1', name: '마피아', count: 2, description: '' },
    ];
    expect(createRolePool(roles, 5)).toBeNull();
  });

  it('ignores roles with empty names', () => {
    const roles: RoleConfig[] = [
      { id: '1', name: '', count: 2, description: '' },
      { id: '2', name: '시민', count: 0, description: '' },
    ];
    const pool = createRolePool(roles, 3);

    expect(pool).toHaveLength(3);
    expect(pool!.every(r => r === '시민')).toBe(true);
  });
});

describe('assignGeneralRoles', () => {
  it('assigns roles to all participants', () => {
    const participants = createParticipants(['철수', '영희', '민수']);
    const roles: RoleConfig[] = [
      { id: '1', name: '늑대', count: 1, description: '' },
      { id: '2', name: '양', count: 0, description: '' },
    ];

    const result = assignGeneralRoles(participants, roles);

    expect(result).toHaveLength(3);
    expect(result!.filter(r => r.role === '늑대')).toHaveLength(1);
    expect(result!.filter(r => r.role === '양')).toHaveLength(2);
  });

  it('returns null for less than 2 participants', () => {
    const participants = createParticipants(['혼자']);
    const roles: RoleConfig[] = [
      { id: '1', name: '역할', count: 0, description: '' },
    ];

    expect(assignGeneralRoles(participants, roles)).toBeNull();
  });

  it('filters out empty name participants', () => {
    const participants: Participant[] = [
      { id: '1', name: '철수', password: 'pass' },
      { id: '2', name: '', password: 'pass' },
      { id: '3', name: '   ', password: 'pass' },
      { id: '4', name: '영희', password: 'pass' },
    ];
    const roles: RoleConfig[] = [
      { id: '1', name: '시민', count: 0, description: '' },
    ];

    const result = assignGeneralRoles(participants, roles);

    expect(result).toHaveLength(2);
    expect(result!.map(r => r.participantName)).toEqual(['철수', '영희']);
  });

  it('adds liarWord to non-liar roles', () => {
    const participants = createParticipants(['A', 'B', 'C']);
    const roles: RoleConfig[] = [
      { id: '1', name: '라이어', count: 1, description: '' },
      { id: '2', name: '시민', count: 0, description: '' },
    ];

    const result = assignGeneralRoles(participants, roles, '사과');

    const liar = result!.find(r => r.role === '라이어');
    const citizens = result!.filter(r => r.role === '시민');

    expect(liar?.extra).toBeUndefined();
    expect(citizens.every(c => c.extra === '사과')).toBe(true);
  });

  it('returns null when role count mismatches', () => {
    const participants = createParticipants(['A', 'B', 'C']);
    const roles: RoleConfig[] = [
      { id: '1', name: '역할', count: 10, description: '' },
    ];

    expect(assignGeneralRoles(participants, roles)).toBeNull();
  });
});

describe('validateRoleConfig', () => {
  it('returns error for less than 2 participants', () => {
    const roles: RoleConfig[] = [
      { id: '1', name: '시민', count: 0, description: '' },
    ];

    const result = validateRoleConfig(roles, 1);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('2명');
  });

  it('returns error when roles exceed participants', () => {
    const roles: RoleConfig[] = [
      { id: '1', name: '마피아', count: 5, description: '' },
    ];

    const result = validateRoleConfig(roles, 3);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('많습니다');
  });

  it('returns error when no remaining role to fill gap', () => {
    const roles: RoleConfig[] = [
      { id: '1', name: '마피아', count: 2, description: '' },
    ];

    const result = validateRoleConfig(roles, 5);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('나머지');
  });

  it('returns error when no valid roles exist', () => {
    const roles: RoleConfig[] = [
      { id: '1', name: '', count: 0, description: '' },
      { id: '2', name: '   ', count: 1, description: '' },
    ];

    const result = validateRoleConfig(roles, 5);

    expect(result.valid).toBe(false);
  });

  it('returns valid for proper configuration', () => {
    const roles: RoleConfig[] = [
      { id: '1', name: '마피아', count: 2, description: '' },
      { id: '2', name: '시민', count: 0, description: '' },
    ];

    expect(validateRoleConfig(roles, 6).valid).toBe(true);
  });

  it('returns valid when exact match without remaining', () => {
    const roles: RoleConfig[] = [
      { id: '1', name: '늑대', count: 1, description: '' },
      { id: '2', name: '양', count: 2, description: '' },
    ];

    expect(validateRoleConfig(roles, 3).valid).toBe(true);
  });
});

describe('real-world scenarios', () => {
  it('handles 마피아 게임 scenario', () => {
    const participants = createParticipants(['A', 'B', 'C', 'D', 'E', 'F']);
    const roles: RoleConfig[] = [
      { id: '1', name: '마피아', count: 2, description: '' },
      { id: '2', name: '경찰', count: 1, description: '' },
      { id: '3', name: '시민', count: 0, description: '' },
    ];

    const result = assignGeneralRoles(participants, roles);

    expect(result).toHaveLength(6);
    expect(result!.filter(r => r.role === '마피아')).toHaveLength(2);
    expect(result!.filter(r => r.role === '경찰')).toHaveLength(1);
    expect(result!.filter(r => r.role === '시민')).toHaveLength(3);
  });

  it('handles simple 2-team game', () => {
    const participants = createParticipants(['1', '2', '3', '4']);
    const roles: RoleConfig[] = [
      { id: '1', name: 'A팀', count: 2, description: '' },
      { id: '2', name: 'B팀', count: 2, description: '' },
    ];

    const result = assignGeneralRoles(participants, roles);

    expect(result).toHaveLength(4);
    expect(result!.filter(r => r.role === 'A팀')).toHaveLength(2);
    expect(result!.filter(r => r.role === 'B팀')).toHaveLength(2);
  });

  it('handles unicode names correctly', () => {
    const participants = createParticipants(['김철수', '이영희', 'John']);
    const roles: RoleConfig[] = [
      { id: '1', name: '플레이어', count: 0, description: '' },
    ];

    const result = assignGeneralRoles(participants, roles);

    expect(result).toHaveLength(3);
    expect(result!.map(r => r.participantName).sort()).toEqual(['John', '김철수', '이영희']);
  });

  it('handles large group (20 players)', () => {
    const names = Array.from({ length: 20 }, (_, i) => `Player${i + 1}`);
    const participants = createParticipants(names);
    const roles: RoleConfig[] = [
      { id: '1', name: '스파이', count: 3, description: '' },
      { id: '2', name: '시민', count: 0, description: '' },
    ];

    const result = assignGeneralRoles(participants, roles);

    expect(result).toHaveLength(20);
    expect(result!.filter(r => r.role === '스파이')).toHaveLength(3);
    expect(result!.filter(r => r.role === '시민')).toHaveLength(17);
  });
});

describe('generateDerangement (Sattolo algorithm)', () => {
  it('returns empty array for single element', () => {
    expect(generateDerangement([1])).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(generateDerangement([])).toEqual([]);
  });

  it('creates valid derangement for 2 elements', () => {
    const arr = ['A', 'B'];
    const derangement = generateDerangement(arr);

    expect(derangement).toHaveLength(2);
    // For 2 elements, the only valid derangement is [1, 0]
    expect(derangement[0]).toBe(1);
    expect(derangement[1]).toBe(0);
  });

  it('creates valid derangement where no element maps to itself', () => {
    const arr = ['A', 'B', 'C', 'D', 'E'];

    // Run multiple times to ensure randomness works correctly
    for (let trial = 0; trial < 20; trial++) {
      const derangement = generateDerangement(arr);

      expect(derangement).toHaveLength(arr.length);

      // Check no fixed points (no element maps to itself)
      for (let i = 0; i < arr.length; i++) {
        expect(derangement[i]).not.toBe(i);
      }

      // Check all indices are used exactly once (valid permutation)
      const sorted = [...derangement].sort((a, b) => a - b);
      expect(sorted).toEqual([0, 1, 2, 3, 4]);
    }
  });

  it('handles large arrays', () => {
    const arr = Array.from({ length: 100 }, (_, i) => `P${i}`);
    const derangement = generateDerangement(arr);

    expect(derangement).toHaveLength(100);

    // No fixed points
    for (let i = 0; i < arr.length; i++) {
      expect(derangement[i]).not.toBe(i);
    }
  });
});

describe('assignManitoRoles', () => {
  it('returns null for empty participants', () => {
    expect(assignManitoRoles([])).toBeNull();
  });

  it('returns null for single participant', () => {
    expect(assignManitoRoles(['철수'])).toBeNull();
  });

  it('returns null when all participants have empty names', () => {
    expect(assignManitoRoles(['', '   ', ''])).toBeNull();
  });

  it('assigns manito roles correctly for 2 participants', () => {
    const result = assignManitoRoles(['철수', '영희']);

    expect(result).toHaveLength(2);
    expect(result![0].giver).toBe('철수');
    expect(result![0].receiver).toBe('영희');
    expect(result![1].giver).toBe('영희');
    expect(result![1].receiver).toBe('철수');
  });

  it('never assigns anyone to themselves', () => {
    const names = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];

    // Run multiple times to ensure randomness is handled correctly
    for (let trial = 0; trial < 50; trial++) {
      const result = assignManitoRoles(names);

      expect(result).toHaveLength(5);

      // No self-assignment
      for (const assignment of result!) {
        expect(assignment.giver).not.toBe(assignment.receiver);
      }
    }
  });

  it('uses all participants as both givers and receivers', () => {
    const names = ['A', 'B', 'C', 'D'];
    const result = assignManitoRoles(names);

    const givers = result!.map(a => a.giver).sort();
    const receivers = result!.map(a => a.receiver).sort();

    expect(givers).toEqual(['A', 'B', 'C', 'D']);
    expect(receivers).toEqual(['A', 'B', 'C', 'D']);
  });

  it('filters out empty names', () => {
    const result = assignManitoRoles(['철수', '', '영희', '   ']);

    expect(result).toHaveLength(2);
    expect(result![0].giver).toBe('철수');
    expect(result![1].giver).toBe('영희');
  });

  it('handles Korean names correctly', () => {
    const names = ['김철수', '이영희', '박민수', '최지영'];
    const result = assignManitoRoles(names);

    expect(result).toHaveLength(4);
    expect(isValidManitoAssignment(result!)).toBe(true);
  });

  it('handles large group (20 people)', () => {
    const names = Array.from({ length: 20 }, (_, i) => `Player${i + 1}`);
    const result = assignManitoRoles(names);

    expect(result).toHaveLength(20);
    expect(isValidManitoAssignment(result!)).toBe(true);

    // Verify everyone receives exactly one gift
    const receiversCount = new Map<string, number>();
    for (const a of result!) {
      receiversCount.set(a.receiver, (receiversCount.get(a.receiver) || 0) + 1);
    }
    for (const count of receiversCount.values()) {
      expect(count).toBe(1);
    }
  });
});

describe('isValidManitoAssignment', () => {
  it('returns true for valid assignment', () => {
    const assignment = [
      { giver: 'A', receiver: 'B' },
      { giver: 'B', receiver: 'C' },
      { giver: 'C', receiver: 'A' },
    ];
    expect(isValidManitoAssignment(assignment)).toBe(true);
  });

  it('returns false when someone is assigned to themselves', () => {
    const assignment = [
      { giver: 'A', receiver: 'A' },  // Invalid!
      { giver: 'B', receiver: 'C' },
      { giver: 'C', receiver: 'B' },
    ];
    expect(isValidManitoAssignment(assignment)).toBe(false);
  });

  it('returns true for empty array', () => {
    expect(isValidManitoAssignment([])).toBe(true);
  });
});

describe('마니또 real-world scenarios', () => {
  it('typical office secret santa (10 people)', () => {
    const names = ['김대리', '이과장', '박부장', '최사원', '정인턴',
                   '강대리', '조과장', '윤부장', '임사원', '한인턴'];

    const result = assignManitoRoles(names);

    expect(result).toHaveLength(10);
    expect(isValidManitoAssignment(result!)).toBe(true);

    // Everyone gives and receives exactly one
    const givers = new Set(result!.map(a => a.giver));
    const receivers = new Set(result!.map(a => a.receiver));
    expect(givers.size).toBe(10);
    expect(receivers.size).toBe(10);
  });

  it('friend group manito (5 people)', () => {
    const friends = ['민수', '영희', '철수', '지영', '현우'];

    // Test multiple times for randomness
    for (let i = 0; i < 10; i++) {
      const result = assignManitoRoles(friends);

      expect(result).toHaveLength(5);
      expect(isValidManitoAssignment(result!)).toBe(true);
    }
  });

  it('minimum viable manito (2 people)', () => {
    const result = assignManitoRoles(['A', 'B']);

    expect(result).toHaveLength(2);
    // Only one possible valid assignment for 2 people
    expect(result![0]).toEqual({ giver: 'A', receiver: 'B' });
    expect(result![1]).toEqual({ giver: 'B', receiver: 'A' });
  });
});
