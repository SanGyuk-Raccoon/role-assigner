import { NextRequest, NextResponse } from 'next/server';
import { getAdminDatabase } from '@/lib/firebase-admin';

/**
 * Sattolo's algorithm: generates a random derangement (no fixed points)
 */
function generateDerangement(length: number): number[] {
  if (length < 2) return [];
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createRolePool(
  roles: { name: string; count: number }[],
  participantCount: number
): string[] | null {
  const rolePool: string[] = [];

  roles.forEach((role) => {
    if (role.count > 0 && role.name.trim()) {
      for (let i = 0; i < role.count; i++) {
        rolePool.push(role.name);
      }
    }
  });

  const remainingRoles = roles.filter((r) => r.count === 0 && r.name.trim());
  const remainingCount = participantCount - rolePool.length;

  if (remainingCount > 0) {
    if (remainingRoles.length > 0) {
      for (let i = 0; i < remainingCount; i++) {
        const randomIndex = Math.floor(Math.random() * remainingRoles.length);
        rolePool.push(remainingRoles[randomIndex].name);
      }
    } else {
      return null;
    }
  } else if (remainingCount < 0) {
    return null;
  }

  return rolePool;
}

export async function POST(request: NextRequest) {
  try {
    const { roomCode, hostId } = await request.json();

    if (!roomCode || !hostId) {
      return NextResponse.json(
        { error: 'Missing roomCode or hostId' },
        { status: 400 }
      );
    }

    const db = getAdminDatabase();
    const roomRef = db.ref(`role-assigner/${roomCode}`);
    const snapshot = await roomRef.get();
    const room = snapshot.val();

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (room.hostId !== hostId) {
      return NextResponse.json(
        { error: 'Only the host can assign roles' },
        { status: 403 }
      );
    }

    if (room.status !== 'waiting') {
      return NextResponse.json(
        { error: 'Roles have already been assigned' },
        { status: 400 }
      );
    }

    const participants = room.participants || {};
    const participantEntries = Object.entries(participants);

    if (participantEntries.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 participants required' },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};

    if (room.manitoMode) {
      // Manito mode: Sattolo's algorithm
      const derangement = generateDerangement(participantEntries.length);
      participantEntries.forEach(([pId, _], i) => {
        const targetEntry = participantEntries[derangement[i]];
        const targetName = (targetEntry[1] as any).name;
        updates[`role-assigner/${roomCode}/participants/${pId}/assignedRole`] = targetName;
        updates[`role-assigner/${roomCode}/participants/${pId}/hasViewed`] = false;
      });
    } else {
      // Normal mode: assign from role pool
      const rolePool = createRolePool(room.roles || [], participantEntries.length);
      if (!rolePool) {
        return NextResponse.json(
          { error: 'Role configuration does not match participant count' },
          { status: 400 }
        );
      }

      const shuffledRoles = shuffleArray(rolePool);
      const shuffledEntries = shuffleArray(participantEntries);

      shuffledEntries.forEach(([pId, _], i) => {
        updates[`role-assigner/${roomCode}/participants/${pId}/assignedRole`] = shuffledRoles[i];
        updates[`role-assigner/${roomCode}/participants/${pId}/hasViewed`] = false;
      });
    }

    updates[`role-assigner/${roomCode}/status`] = 'completed';

    await db.ref().update(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Role assignment error:', error);
    return NextResponse.json(
      { error: 'Server error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
