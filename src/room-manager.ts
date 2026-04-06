/**
 * Room manager for multiplayer role-assigner
 * Uses Firebase Realtime Database for real-time synchronization
 */

import {
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  onDisconnect,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '@/lib/firebase';
import {
  logNetworkError,
  logRoomError,
  logServerError,
  logValidationError,
  type ErrorCategory,
} from '@/lib/error-logger';

// Types
export type RoomStatus = 'waiting' | 'assigning' | 'completed';

export interface RoomParticipant {
  id: string;
  name: string;
  joinedAt: number;
  isHost: boolean;
  assignedRole?: string;
  hasViewed?: boolean;
  online?: boolean;
}

export interface RoleConfig {
  id: string;
  name: string;
  count: number;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  roles: RoleConfig[];
  participants: Record<string, RoomParticipant>;
  status: RoomStatus;
  createdAt: number;
  expiresAt: number;
  manitoMode?: boolean;
}

// Error types for better handling
export type RoomErrorType =
  | 'CONNECTION_FAILED'
  | 'CONNECTION_TIMEOUT'
  | 'JOIN_TIMEOUT'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ROOM_EXPIRED'
  | 'NAME_TAKEN'
  | 'NOT_ACCEPTING'
  | 'SERVER_ERROR'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

// Map error types to categories for logging
const ERROR_CATEGORY_MAP: Record<RoomErrorType, ErrorCategory> = {
  CONNECTION_FAILED: 'network',
  CONNECTION_TIMEOUT: 'network',
  JOIN_TIMEOUT: 'network',
  ROOM_NOT_FOUND: 'room',
  ROOM_FULL: 'room',
  ROOM_EXPIRED: 'room',
  NAME_TAKEN: 'validation',
  NOT_ACCEPTING: 'room',
  SERVER_ERROR: 'server',
  RATE_LIMITED: 'server',
  UNKNOWN: 'unknown',
};

export class RoomError extends Error {
  public readonly category: ErrorCategory;

  constructor(
    public type: RoomErrorType,
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RoomError';
    this.category = ERROR_CATEGORY_MAP[type];
    this.logError();
  }

  private logError(): void {
    const logContext = {
      errorType: this.type,
      ...this.context,
    };

    switch (this.category) {
      case 'network':
        logNetworkError(this.type, this.message, logContext);
        break;
      case 'room':
        logRoomError(this.type, this.message, logContext);
        break;
      case 'validation':
        logValidationError(this.type, this.message, logContext);
        break;
      case 'server':
        logServerError(this.type, this.message, logContext);
        break;
      default:
        logServerError(this.type, this.message, logContext);
    }
  }
}

// Constants
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const ROOM_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_PARTICIPANTS = 20;

// State
let currentRoomCode: string | null = null;
let currentParticipantId: string | null = null;
let currentIsHost = false;
let roomUnsubscribe: Unsubscribe | null = null;
const stateListeners = new Set<(room: Room | null) => void>();
const errorListeners = new Set<(error: string) => void>();
const deleteListeners = new Set<() => void>();

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return code;
}

function generateParticipantId(): string {
  return `p_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function roomRef(code: string) {
  return ref(database, `role-assigner/${code}`);
}

function participantRef(code: string, participantId: string) {
  return ref(database, `role-assigner/${code}/participants/${participantId}`);
}

function notifyStateListeners(room: Room | null) {
  stateListeners.forEach((cb) => cb(room));
}

function notifyErrorListeners(error: string) {
  errorListeners.forEach((cb) => cb(error));
}

function notifyDeleteListeners() {
  deleteListeners.forEach((cb) => cb());
}

function startRoomSubscription(code: string) {
  // Clean up previous subscription
  if (roomUnsubscribe) {
    roomUnsubscribe();
  }

  roomUnsubscribe = onValue(
    roomRef(code),
    (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        notifyDeleteListeners();
        notifyStateListeners(null);
        return;
      }

      const room: Room = {
        id: code,
        code: data.code || code,
        hostId: data.hostId,
        roles: data.roles || [],
        participants: data.participants || {},
        status: data.status || 'waiting',
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
        manitoMode: data.manitoMode || false,
      };
      notifyStateListeners(room);
    },
    (error) => {
      notifyErrorListeners(error.message);
    }
  );
}

/**
 * Create a new room
 */
export async function createRoom(
  hostName: string,
  roles: RoleConfig[],
  manitoMode: boolean = false
): Promise<{ room: Room; participantId: string }> {
  const code = generateRoomCode();
  const participantId = generateParticipantId();
  const now = Date.now();

  const participant: RoomParticipant = {
    id: participantId,
    name: hostName,
    joinedAt: now,
    isHost: true,
    online: true,
  };

  const roomData = {
    code,
    hostId: participantId,
    roles,
    participants: { [participantId]: participant },
    status: 'waiting' as RoomStatus,
    createdAt: now,
    expiresAt: now + ROOM_EXPIRY_MS,
    manitoMode,
  };

  try {
    await set(roomRef(code), roomData);

    // Host disconnect removes the entire room
    await onDisconnect(roomRef(code)).remove();

    currentRoomCode = code;
    currentParticipantId = participantId;
    currentIsHost = true;

    // Start listening
    startRoomSubscription(code);

    const room: Room = { id: code, ...roomData };
    return { room, participantId };
  } catch (error) {
    console.error('[Firebase] createRoom error:', error);
    throw new RoomError(
      'CONNECTION_FAILED',
      'Failed to create room. Please try again.',
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Join an existing room
 */
export async function joinRoom(
  roomCode: string,
  participantName: string
): Promise<{ room: Room; participantId: string }> {
  const code = roomCode.toUpperCase();

  try {
    // Check if room exists
    const snapshot = await get(roomRef(code));
    const data = snapshot.val();

    if (!data) {
      throw new RoomError('ROOM_NOT_FOUND', 'Room not found');
    }

    // Check expiry
    if (data.expiresAt && data.expiresAt < Date.now()) {
      throw new RoomError('ROOM_EXPIRED', 'Room has expired');
    }

    // Check status
    if (data.status !== 'waiting') {
      throw new RoomError('NOT_ACCEPTING', 'Room is no longer accepting participants');
    }

    // Check capacity
    const participants = data.participants || {};
    if (Object.keys(participants).length >= MAX_PARTICIPANTS) {
      throw new RoomError('ROOM_FULL', 'Room is full');
    }

    // Check name taken
    const nameTaken = Object.values(participants).some(
      (p: any) => p.name === participantName
    );
    if (nameTaken) {
      throw new RoomError('NAME_TAKEN', 'Name is already taken');
    }

    const participantId = generateParticipantId();
    const participant: RoomParticipant = {
      id: participantId,
      name: participantName,
      joinedAt: Date.now(),
      isHost: false,
      online: true,
    };

    // Add participant
    await set(participantRef(code, participantId), participant);

    // Set up onDisconnect to remove participant when connection is lost
    await onDisconnect(participantRef(code, participantId)).remove();

    currentRoomCode = code;
    currentParticipantId = participantId;
    currentIsHost = false;

    // Start listening
    startRoomSubscription(code);

    const room: Room = {
      id: code,
      code: data.code || code,
      hostId: data.hostId,
      roles: data.roles || [],
      participants: { ...participants, [participantId]: participant },
      status: data.status,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
      manitoMode: data.manitoMode || false,
    };

    return { room, participantId };
  } catch (error) {
    if (error instanceof RoomError) throw error;
    throw new RoomError(
      'CONNECTION_FAILED',
      'Failed to join room. Please try again.',
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Subscribe to room updates
 */
export function subscribeToRoom(
  roomId: string,
  callback: (room: Room | null) => void
): () => void {
  stateListeners.add(callback);
  return () => {
    stateListeners.delete(callback);
  };
}

/**
 * Subscribe to errors
 */
export function subscribeToErrors(
  callback: (error: string) => void
): () => void {
  errorListeners.add(callback);
  return () => {
    errorListeners.delete(callback);
  };
}

/**
 * Subscribe to room deletion
 */
export function subscribeToDelete(callback: () => void): () => void {
  deleteListeners.add(callback);
  return () => {
    deleteListeners.delete(callback);
  };
}

/**
 * Assign roles to all participants (host only)
 * Calls server-side API route for secure role assignment
 */
export async function assignRoles(
  roomId: string,
  hostId: string
): Promise<void> {
  try {
    const response = await fetch('/api/rooms/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: currentRoomCode || roomId, hostId }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new RoomError(
        'SERVER_ERROR',
        data.error || 'Failed to assign roles'
      );
    }
  } catch (error) {
    if (error instanceof RoomError) throw error;
    throw new RoomError(
      'SERVER_ERROR',
      'Failed to assign roles. Please try again.',
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Mark role as viewed
 */
export async function markRoleViewed(
  roomId: string,
  participantId: string
): Promise<void> {
  const code = currentRoomCode || roomId;
  try {
    await update(participantRef(code, participantId), {
      hasViewed: true,
    });
  } catch (error) {
    throw new RoomError('SERVER_ERROR', 'Failed to mark role as viewed');
  }
}

/**
 * Reset game (host only)
 */
export async function resetGame(
  roomId: string,
  hostId: string
): Promise<void> {
  const code = currentRoomCode || roomId;
  try {
    const snapshot = await get(roomRef(code));
    const data = snapshot.val();
    if (!data || data.hostId !== hostId) return;

    // Reset status and clear assigned roles
    const updates: Record<string, any> = {
      [`role-assigner/${code}/status`]: 'waiting',
    };

    const participants = data.participants || {};
    for (const pId of Object.keys(participants)) {
      updates[`role-assigner/${code}/participants/${pId}/assignedRole`] = null;
      updates[`role-assigner/${code}/participants/${pId}/hasViewed`] = null;
    }

    await update(ref(database), updates);
  } catch (error) {
    throw new RoomError('SERVER_ERROR', 'Failed to reset game');
  }
}

/**
 * Update participant name
 */
export async function updateParticipantName(
  roomId: string,
  participantId: string,
  newName: string
): Promise<void> {
  const code = currentRoomCode || roomId;
  try {
    await update(participantRef(code, participantId), {
      name: newName,
    });
  } catch (error) {
    throw new RoomError('SERVER_ERROR', 'Failed to update name');
  }
}

/**
 * Update room roles (host only)
 */
export async function updateRoomRoles(
  roomId: string,
  hostId: string,
  newRoles: RoleConfig[]
): Promise<void> {
  const code = currentRoomCode || roomId;
  try {
    const snapshot = await get(roomRef(code));
    const data = snapshot.val();
    if (!data || data.hostId !== hostId) return;

    await update(roomRef(code), { roles: newRoles });
  } catch (error) {
    throw new RoomError('SERVER_ERROR', 'Failed to update roles');
  }
}

/**
 * Leave room
 */
export async function leaveRoom(
  roomId: string,
  participantId: string,
  roomCode: string
): Promise<void> {
  const code = currentRoomCode || roomCode;
  try {
    await remove(participantRef(code, participantId));
  } catch {
    // Ignore errors on leave
  }
  cleanup();
}

/**
 * Delete room (host only)
 */
export async function deleteRoom(
  roomId: string,
  roomCode: string,
  hostId: string
): Promise<void> {
  const code = currentRoomCode || roomCode;
  try {
    await remove(roomRef(code));
  } catch {
    // Ignore errors on delete
  }
  cleanup();
}

/**
 * Disconnect from current room (immediately removes from DB)
 */
export function disconnectRoom(): void {
  if (currentRoomCode && currentParticipantId) {
    if (currentIsHost) {
      // Host leaving: delete entire room
      remove(roomRef(currentRoomCode)).catch(() => {});
    } else {
      // Participant leaving: delete only their record
      remove(participantRef(currentRoomCode, currentParticipantId)).catch(() => {});
    }
  }
  cleanup();
}

function cleanup() {
  if (roomUnsubscribe) {
    roomUnsubscribe();
    roomUnsubscribe = null;
  }
  currentRoomCode = null;
  currentParticipantId = null;
  currentIsHost = false;
  stateListeners.clear();
  errorListeners.clear();
  deleteListeners.clear();
}

/**
 * Check if Firebase is configured
 */
export function isMultiplayerConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
}

/**
 * Check if Firebase is reachable
 */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const testRef = ref(database, '.info/connected');
    const snapshot = await get(testRef);
    return snapshot.val() === true;
  } catch {
    return false;
  }
}
