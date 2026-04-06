/**
 * Role assigner utilities for party games
 */

export interface RoleConfig {
  id: string;
  name: string;
  count: number;
  description: string;
}

export interface Participant {
  id: string;
  name: string;
  password: string;
}

export interface AssignedRole {
  participantName: string;
  role: string;
  extra?: string;
}

/**
 * Fisher-Yates shuffle algorithm
 * Produces unbiased random permutation
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Create a role pool from role configurations
 * Roles with count > 0 are added that many times
 * Roles with count = 0 are used to fill remaining spots (randomly distributed)
 */
export function createRolePool(roles: RoleConfig[], participantCount: number): string[] | null {
  const rolePool: string[] = [];

  // Add fixed count roles
  roles.forEach(role => {
    if (role.count > 0 && role.name.trim()) {
      for (let i = 0; i < role.count; i++) {
        rolePool.push(role.name);
      }
    }
  });

  // Find all "remaining" roles (count = 0)
  const remainingRoles = roles.filter(r => r.count === 0 && r.name.trim());
  const remainingCount = participantCount - rolePool.length;

  if (remainingCount > 0) {
    if (remainingRoles.length > 0) {
      // Randomly distribute remaining participants among "remaining" roles
      for (let i = 0; i < remainingCount; i++) {
        const randomIndex = Math.floor(Math.random() * remainingRoles.length);
        rolePool.push(remainingRoles[randomIndex].name);
      }
    } else {
      // No remaining role defined but we need more roles
      return null;
    }
  } else if (remainingCount < 0) {
    // More roles defined than participants
    return null;
  }

  return rolePool;
}

/**
 * Assign roles to participants for general games (Mafia, Liar, Custom)
 */
export function assignGeneralRoles(
  participants: Participant[],
  roles: RoleConfig[],
  liarWord?: string
): AssignedRole[] | null {
  const validParticipants = participants.filter(p => p.name.trim());

  if (validParticipants.length < 2) {
    return null;
  }

  const rolePool = createRolePool(roles, validParticipants.length);
  if (!rolePool || rolePool.length !== validParticipants.length) {
    return null;
  }

  const shuffledRoles = shuffleArray(rolePool);

  return validParticipants.map((p, i) => ({
    participantName: p.name,
    role: shuffledRoles[i],
    // For Liar game: non-liar players get the word
    extra: liarWord && shuffledRoles[i] !== '라이어' ? liarWord : undefined,
  }));
}

/**
 * Validate role configuration against participant count
 */
export function validateRoleConfig(roles: RoleConfig[], participantCount: number): {
  valid: boolean;
  error?: string;
} {
  if (participantCount < 2) {
    return { valid: false, error: '최소 2명의 참가자가 필요합니다.' };
  }

  const fixedRoleCount = roles.reduce((sum, r) => sum + (r.count > 0 ? r.count : 0), 0);
  const hasRemainingRole = roles.some(r => r.count === 0 && r.name.trim());

  if (fixedRoleCount > participantCount) {
    return { valid: false, error: '역할 수가 참가자 수보다 많습니다.' };
  }

  if (fixedRoleCount < participantCount && !hasRemainingRole) {
    return { valid: false, error: '나머지 인원을 채울 역할이 없습니다.' };
  }

  const hasValidRoles = roles.some(r => r.name.trim());
  if (!hasValidRoles) {
    return { valid: false, error: '최소 하나의 역할이 필요합니다.' };
  }

  return { valid: true };
}

/**
 * Manito (Secret Santa) assignment result
 */
export interface ManitoAssignment {
  giver: string;      // 선물 주는 사람
  receiver: string;   // 선물 받는 사람 (마니또 대상)
}

/**
 * Generate a derangement using Sattolo's algorithm
 * Creates a single cycle where no element maps to itself
 * Perfect for Manito/Secret Santa assignments
 *
 * @param array - Array of items to derange
 * @returns Array of indices representing the derangement (array[i] gives to array[result[i]])
 */
export function generateDerangement<T>(array: T[]): number[] {
  const n = array.length;
  if (n < 2) return [];

  // Create index array [0, 1, 2, ..., n-1]
  const indices = Array.from({ length: n }, (_, i) => i);

  // Sattolo's algorithm: guarantees a single cycle (no fixed points)
  for (let i = n - 1; i > 0; i--) {
    // Pick random j from [0, i-1] (NOT including i)
    const j = Math.floor(Math.random() * i);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices;
}

/**
 * Assign Manito (Secret Santa) roles
 * Each participant is assigned another participant as their "manito target"
 * No one gets themselves
 *
 * @param participantNames - Array of participant names
 * @returns Array of ManitoAssignment or null if less than 2 participants
 */
export function assignManitoRoles(participantNames: string[]): ManitoAssignment[] | null {
  const validNames = participantNames.filter(name => name.trim());

  if (validNames.length < 2) {
    return null;
  }

  const derangement = generateDerangement(validNames);

  return validNames.map((giver, i) => ({
    giver,
    receiver: validNames[derangement[i]],
  }));
}

/**
 * Verify that a manito assignment is valid (no self-assignments)
 */
export function isValidManitoAssignment(assignments: ManitoAssignment[]): boolean {
  return assignments.every(a => a.giver !== a.receiver);
}
