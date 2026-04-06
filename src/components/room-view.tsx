'use client';

import { useState, useEffect } from 'react';
import {
  createRoom,
  joinRoom,
  subscribeToRoom,
  assignRoles,
  markRoleViewed,
  leaveRoom,
  deleteRoom,
  disconnectRoom,
  updateParticipantName,
  updateRoomRoles,
  resetGame,
  isMultiplayerConfigured,
  Room,
  RoleConfig,
  RoomError,
  RoomErrorType,
} from '@/room-manager';
import { ErrorModal, RoomDeletedModal, DeleteConfirmModal } from '@/components/error-modal';
import { MenuView } from '@/components/menu-view';
import { CreateView } from '@/components/create-view';
import { JoinView } from '@/components/join-view';
import { LobbyView } from '@/components/lobby-view';
import { ResultView } from '@/components/result-view';

export type ViewState = 'menu' | 'create' | 'join' | 'lobby' | 'result';

interface RoleAssignerRoomProps {
  onBack?: () => void;
}

export default function RoleAssignerRoom({ onBack }: RoleAssignerRoomProps) {
  // --- Error handling ---
  const translateError = (error: unknown): string => {
    if (error instanceof RoomError) {
      const errorTypeMap: Record<RoomErrorType, string> = {
        'CONNECTION_FAILED': '서버 연결에 실패했습니다',
        'CONNECTION_TIMEOUT': '연결 시간이 초과되었습니다',
        'JOIN_TIMEOUT': '참여 시간이 초과되었습니다',
        'ROOM_NOT_FOUND': '방을 찾을 수 없습니다',
        'ROOM_FULL': '방이 가득 찼습니다 (최대 20명)',
        'ROOM_EXPIRED': '방이 만료되었습니다',
        'NAME_TAKEN': '이미 사용 중인 이름입니다',
        'NOT_ACCEPTING': '방이 더 이상 참가자를 받지 않습니다',
        'SERVER_ERROR': '서버 오류가 발생했습니다',
        'RATE_LIMITED': '서버가 일시적으로 혼잡합니다',
        'UNKNOWN': '알 수 없는 오류가 발생했습니다',
      };
      return errorTypeMap[error.type] || '알 수 없는 오류가 발생했습니다';
    }

    if (error instanceof Error) {
      const messageMap: Record<string, string> = {
        'Name already taken in this room': '이미 사용 중인 이름입니다',
        'Room not found': '방을 찾을 수 없습니다',
        'Room is full (maximum 20 participants)': '방이 가득 찼습니다 (최대 20명)',
        'Room has expired': '방이 만료되었습니다',
        'Room is no longer accepting participants': '방이 더 이상 참가자를 받지 않습니다',
      };
      return messageMap[error.message] || '알 수 없는 오류가 발생했습니다';
    }

    return '알 수 없는 오류가 발생했습니다';
  };

  const showError = (message: string, type: RoomErrorType | null = null, retry: (() => void) | null = null) => {
    setError(message);
    setErrorType(type);
    setShowErrorModal(true);
    setRetryAction(retry);
  };

  // --- State ---
  const [viewState, setViewState] = useState<ViewState>('menu');
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState<RoomErrorType | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showRoomDeletedModal, setShowRoomDeletedModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [room, setRoom] = useState<Room | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);

  const [hostName, setHostName] = useState('');
  const [manitoMode, setManitoMode] = useState(false);
  const [roles, setRoles] = useState<RoleConfig[]>([{ id: '1', name: '', count: 1 }]);

  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');

  const [showRole, setShowRole] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [isEditingRoles, setIsEditingRoles] = useState(false);
  const [editingRoles, setEditingRoles] = useState<RoleConfig[]>([]);

  // --- Effects ---
  useEffect(() => {
    setIsReady(isMultiplayerConfigured());
  }, []);

  useEffect(() => {
    if (!room?.id) return;

    const unsubscribe = subscribeToRoom(room.id, (updatedRoom) => {
      if (updatedRoom) {
        setRoom(updatedRoom);
        if (updatedRoom.status === 'completed' && viewState === 'lobby') {
          setViewState('result');
        }
        if (updatedRoom.status === 'waiting' && viewState === 'result') {
          setShowRole(false);
          setIsRevealing(false);
          setViewState('lobby');
        }
      } else {
        const wasHost = room?.hostId === participantId;
        if ((viewState === 'lobby' || viewState === 'result') && !wasHost) {
          setShowRoomDeletedModal(true);
        } else {
          handleReset();
        }
      }
    });

    return () => unsubscribe();
  }, [room?.id, room?.hostId, viewState, participantId]);

  useEffect(() => {
    const handleBeforeUnload = () => { disconnectRoom(); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      disconnectRoom();
    };
  }, []);

  // --- Handlers ---
  const handleReset = () => {
    setRoom(null);
    setParticipantId(null);
    setShowRole(false);
    setIsRevealing(false);
    setError('');
    setErrorType(null);
    setShowErrorModal(false);
    setRetryAction(null);
    setViewState('menu');
    setHostName('');
    setJoinCode('');
    setJoinName('');
    setRoles([{ id: '1', name: '', count: 1 }]);
  };

  const handleCreateRoom = async () => {
    if (!hostName.trim()) {
      showError('이름을 입력해주세요');
      return;
    }
    if (!manitoMode) {
      const validRoles = roles.filter(r => r.name.trim());
      if (validRoles.length === 0) {
        showError('역할을 하나 이상 입력해주세요');
        return;
      }
    }

    setIsLoading(true);
    setError('');
    setErrorType(null);

    try {
      const result = await createRoom(hostName, manitoMode ? [] : roles, manitoMode);
      setRoom(result.room);
      setParticipantId(result.participantId);
      setViewState('lobby');
    } catch (err) {
      const msg = translateError(err);
      showError(msg, err instanceof RoomError ? err.type : null, () => handleCreateRoom);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) { showError('방 코드를 입력해주세요'); return; }
    if (!joinName.trim()) { showError('이름을 입력해주세요'); return; }

    setIsLoading(true);
    setError('');
    setErrorType(null);

    try {
      const result = await joinRoom(joinCode, joinName);
      setRoom(result.room);
      setParticipantId(result.participantId);
      setViewState(result.room.status === 'completed' ? 'result' : 'lobby');
    } catch (err) {
      const msg = translateError(err);
      showError(msg, err instanceof RoomError ? err.type : null, () => handleJoinRoom);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignRoles = async () => {
    if (!room || !participantId) return;
    setIsLoading(true);
    setError('');
    try {
      await assignRoles(room.id, participantId);
    } catch (err: any) {
      setError(err.message || '역할 배정에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevealRole = async () => {
    if (!room || !participantId) return;
    setIsRevealing(true);
    setTimeout(() => { setShowRole(true); setIsRevealing(false); }, 800);
    try { await markRoleViewed(room.id, participantId); } catch { /* Ignore */ }
  };

  const handleLeaveRoom = async () => {
    if (!room || !participantId) return;
    try { await leaveRoom(room.id, participantId, room.code); } catch { /* Ignore */ }
    handleReset();
  };

  const handleDeleteRoom = () => {
    if (!room || !participantId) return;
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteRoom = async () => {
    if (!room || !participantId) return;
    setShowDeleteConfirmModal(false);
    try { await deleteRoom(room.id, room.code, participantId); } catch { /* Ignore */ }
    handleReset();
  };

  const handleNewGame = async () => {
    if (!room || !participantId) return;
    setIsLoading(true);
    setError('');
    try {
      await resetGame(room.id, participantId);
      setShowRole(false);
      setIsRevealing(false);
      setViewState('lobby');
    } catch (err: any) {
      setError(err.message || '역할 배정에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!room || !participantId || !editingNameValue.trim()) return;
    setIsLoading(true);
    setError('');
    setErrorType(null);
    try {
      await updateParticipantName(room.id, participantId, editingNameValue.trim());
      setIsEditingName(false);
    } catch (err) {
      const msg = translateError(err);
      showError(msg, err instanceof RoomError ? err.type : null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRoles = async () => {
    if (!room || !participantId) return;
    const validRoles = editingRoles.filter(r => r.name.trim());
    if (validRoles.length === 0) { setError('역할을 하나 이상 입력해주세요'); return; }
    setIsLoading(true);
    setError('');
    try {
      await updateRoomRoles(room.id, participantId, editingRoles);
      setIsEditingRoles(false);
    } catch (err: any) {
      setError(err.message || '역할 변경에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Derived state ---
  const currentParticipant = room?.participants?.[participantId || ''];
  const isHost = currentParticipant?.isHost ?? false;
  const participants = room?.participants ? Object.values(room.participants) : [];

  // --- Render ---
  return (
    <>
      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        errorType={errorType}
        errorMessage={error}
        onRetry={retryAction || undefined}
      />
      <RoomDeletedModal
        isOpen={showRoomDeletedModal}
        onClose={() => { setShowRoomDeletedModal(false); handleReset(); }}
      />
      <DeleteConfirmModal
        isOpen={showDeleteConfirmModal}
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={confirmDeleteRoom}
      />

      {!isReady ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4 animate-bounce">⚙️</div>
          <p className="text-slate-400">연결 중...</p>
        </div>
      ) : viewState === 'menu' ? (
        <MenuView onNavigate={setViewState} onBack={onBack} />
      ) : viewState === 'create' ? (
        <CreateView
          hostName={hostName}
          onHostNameChange={setHostName}
          manitoMode={manitoMode}
          onManitoModeToggle={() => setManitoMode(!manitoMode)}
          roles={roles}
          onAddRole={() => setRoles([...roles, { id: Date.now().toString(), name: '', count: 1 }])}
          onRemoveRole={(id) => { if (roles.length > 1) setRoles(roles.filter(r => r.id !== id)); }}
          onUpdateRole={(id, field, value) => setRoles(roles.map(r => r.id === id ? { ...r, [field]: value } : r))}
          onCreateRoom={handleCreateRoom}
          onBack={() => setViewState('menu')}
          isLoading={isLoading}
        />
      ) : viewState === 'join' ? (
        <JoinView
          joinCode={joinCode}
          onJoinCodeChange={setJoinCode}
          joinName={joinName}
          onJoinNameChange={setJoinName}
          onJoinRoom={handleJoinRoom}
          onBack={() => setViewState('menu')}
          isLoading={isLoading}
        />
      ) : viewState === 'lobby' && room ? (
        <LobbyView
          room={room}
          participantId={participantId!}
          participants={participants}
          isHost={isHost}
          isLoading={isLoading}
          onCopyCode={() => { if (room?.code) navigator.clipboard.writeText(room.code); }}
          onAssignRoles={handleAssignRoles}
          onDeleteRoom={handleDeleteRoom}
          onLeaveRoom={handleLeaveRoom}
          isEditingName={isEditingName}
          editingNameValue={editingNameValue}
          onStartEditName={() => { if (currentParticipant) { setEditingNameValue(currentParticipant.name); setIsEditingName(true); } }}
          onSaveName={handleSaveName}
          onCancelEditName={() => setIsEditingName(false)}
          onEditingNameChange={setEditingNameValue}
          isEditingRoles={isEditingRoles}
          editingRoles={editingRoles}
          onStartEditRoles={() => { if (room) { setEditingRoles([...room.roles]); setIsEditingRoles(true); } }}
          onSaveRoles={handleSaveRoles}
          onCancelEditRoles={() => setIsEditingRoles(false)}
          onAddEditingRole={() => setEditingRoles([...editingRoles, { id: Date.now().toString(), name: '', count: 1 }])}
          onRemoveEditingRole={(id) => { if (editingRoles.length > 1) setEditingRoles(editingRoles.filter(r => r.id !== id)); }}
          onUpdateEditingRole={(id, field, value) => setEditingRoles(editingRoles.map(r => r.id === id ? { ...r, [field]: value } : r))}
        />
      ) : viewState === 'result' && room && participantId ? (
        <ResultView
          room={room}
          participantId={participantId}
          participants={participants}
          isHost={isHost}
          showRole={showRole}
          isRevealing={isRevealing}
          onRevealRole={handleRevealRole}
          onNewGame={handleNewGame}
          onLeaveRoom={handleLeaveRoom}
          onReset={handleReset}
          isLoading={isLoading}
        />
      ) : null}
    </>
  );
}
