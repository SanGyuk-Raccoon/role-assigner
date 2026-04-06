'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { isMultiplayerConfigured, checkServerHealth, RoomError, RoomErrorType } from '@/room-manager';

const RoleAssignerRoom = dynamic(() => import('@/components/room-view'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

type RevealMode = 'public' | 'private';
type ViewState = 'setup' | 'shuffling' | 'result';

interface RoleConfig {
  id: string;
  name: string;
  count: number;
}

interface Participant {
  id: string;
  name: string;
}

interface AssignedRole {
  participantName: string;
  role: string;
  revealed: boolean;
}

// Confetti particle component
function Confetti({ active }: { active: boolean }) {
  const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA'];

  if (!active) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="absolute w-3 h-3 rounded-full"
          style={{
            backgroundColor: colors[i % colors.length],
            left: `${Math.random() * 100}%`,
            top: '-20px',
            animation: `fall ${1.5 + Math.random()}s linear forwards`,
            animationDelay: `${Math.random() * 0.5}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function RoleAssigner() {
  const [revealMode, setRevealMode] = useState<RevealMode>('public');
  const [isMultiplayerReady, setIsMultiplayerReady] = useState(false);
  const [viewState, setViewState] = useState<ViewState>('setup');

  // Server check state
  const [isCheckingServer, setIsCheckingServer] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverErrorType, setServerErrorType] = useState<RoomErrorType | null>(null);
  const [showServerError, setShowServerError] = useState(false);
  const [roles, setRoles] = useState<RoleConfig[]>([
    { id: '1', name: '', count: 1 },
  ]);
  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', name: '' },
    { id: '2', name: '' },
  ]);
  const [assignedRoles, setAssignedRoles] = useState<AssignedRole[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);
  const [validationErrorMessage, setValidationErrorMessage] = useState('');
  const [showCopied, setShowCopied] = useState(false);

  // Track initial IDs for staggered animation (only on first render)
  const initialParticipantIds = useRef<Set<string>>(new Set(['1', '2']));
  const initialRoleIds = useRef<Set<string>>(new Set(['1']));

  useEffect(() => {
    setIsMultiplayerReady(isMultiplayerConfigured());
  }, []);

  // Handle entering private mode with server health check
  const handleEnterPrivateMode = async () => {
    setIsCheckingServer(true);
    setServerError(null);
    setServerErrorType(null);

    try {
      await checkServerHealth();
      setRevealMode('private');
    } catch (err) {
      if (err instanceof RoomError) {
        setServerErrorType(err.type);
        // Translate error message
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
        setServerError(errorTypeMap[err.type] || '알 수 없는 오류가 발생했습니다');
      } else {
        setServerError('알 수 없는 오류가 발생했습니다');
      }
      setShowServerError(true);
    } finally {
      setIsCheckingServer(false);
    }
  };

  const addParticipant = () => {
    setParticipants([...participants, { id: Date.now().toString(), name: '' }]);
  };

  const removeParticipant = (id: string) => {
    if (participants.length > 2) {
      setParticipants(participants.filter(p => p.id !== id));
    }
  };

  const updateParticipant = (id: string, value: string) => {
    setParticipants(participants.map(p => p.id === id ? { ...p, name: value } : p));
  };

  const addRole = () => {
    setRoles([...roles, { id: Date.now().toString(), name: '', count: 1 }]);
  };

  const resetParticipants = () => {
    setParticipants([
      { id: Date.now().toString(), name: '' },
      { id: (Date.now() + 1).toString(), name: '' },
    ]);
  };

  const resetRoles = () => {
    setRoles([{ id: Date.now().toString(), name: '', count: 1 }]);
  };

  const removeRole = (id: string) => {
    if (roles.length > 1) {
      setRoles(roles.filter(r => r.id !== id));
    }
  };

  const updateRole = (id: string, field: keyof RoleConfig, value: string | number) => {
    setRoles(roles.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const assignRoles = useCallback(() => {
    const validParticipants = participants.filter(p => p.name.trim());

    if (validParticipants.length < 2) {
      setValidationErrorMessage('최소 2명 이상의 참가자가 필요합니다');
      setShowValidationError(true);
      return;
    }

    const rolePool: string[] = [];

    roles.forEach(role => {
      if (role.count > 0 && role.name.trim()) {
        for (let i = 0; i < role.count; i++) {
          rolePool.push(role.name);
        }
      }
    });

    const remainingRole = roles.find(r => r.count === 0);
    const remainingCount = validParticipants.length - rolePool.length;

    if (remainingCount > 0 && remainingRole && remainingRole.name.trim()) {
      for (let i = 0; i < remainingCount; i++) {
        rolePool.push(remainingRole.name);
      }
    } else if (remainingCount > 0) {
      setValidationErrorMessage('역할 수와 참가자 수가 맞지 않습니다');
      setShowValidationError(true);
      return;
    }

    if (rolePool.length !== validParticipants.length) {
      setValidationErrorMessage('역할 수와 참가자 수가 맞지 않습니다');
      setShowValidationError(true);
      return;
    }

    // Start shuffling animation
    setViewState('shuffling');

    // Simulate shuffling for dramatic effect
    setTimeout(() => {
      const shuffledRoles = shuffleArray(rolePool);
      const assigned = validParticipants.map((p, i) => ({
        participantName: p.name,
        role: shuffledRoles[i],
        revealed: false,
      }));

      setAssignedRoles(assigned);
      setViewState('result');
      setShowConfetti(true);

      // Auto-reveal with staggered animation
      assigned.forEach((_, idx) => {
        setTimeout(() => {
          setAssignedRoles(prev =>
            prev.map((r, i) => i === idx ? { ...r, revealed: true } : r)
          );
        }, 300 + idx * 200);
      });

      setTimeout(() => setShowConfetti(false), 3000);
    }, 1500);
  }, [participants, roles]);

  const resetGame = () => {
    setViewState('setup');
    setAssignedRoles([]);
  };

  const reassign = () => {
    setAssignedRoles([]);
    assignRoles();
  };

  const shareResult = async () => {
    const resultText = assignedRoles
      .map((r) => `👤 ${r.participantName} → 🎭 ${r.role}`)
      .join('\n');

    const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const shareText = `🎭 역할 배정 완료!\n\n${resultText}\n\n무료 역할 배정기로 마피아, 마니또 게임을 더 재밌게!\n🔗 ${siteUrl}/role-assigner`;

    try {
      await navigator.clipboard.writeText(shareText);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = shareText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  // Private mode (multiplayer)
  if (revealMode === 'private') {
    return (
      <div className="ra-container">
        <RoleAssignerRoom onBack={() => setRevealMode('public')} />
      </div>
    );
  }

  // Shuffling animation screen
  if (viewState === 'shuffling') {
    return (
      <div className="ra-container flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          {/* Spinning cards */}
          <div className="flex gap-4 mb-8">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-20 h-28 rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 shadow-2xl animate-float"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="w-full h-full rounded-xl bg-slate-900/50 backdrop-blur flex items-center justify-center">
                  <span className="text-3xl">🎴</span>
                </div>
              </div>
            ))}
          </div>

          {/* Loading text */}
          <div className="text-center">
            <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 animate-pulse">
              섞는 중...
            </p>
            <div className="flex justify-center gap-1 mt-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full bg-pink-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Result screen (public mode)
  if (viewState === 'result') {
    return (
      <div className="ra-container">
        <Confetti active={showConfetti} />

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block animate-bounce-in">
            <span className="text-6xl drop-shadow-lg">🎉</span>
          </div>
          <h2 className="mt-4 text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500">
            역할 배정 완료!
          </h2>
        </div>

        {/* Results Grid */}
        <div className={`grid gap-3 mb-8 ${
          assignedRoles.length <= 4
            ? 'grid-cols-1'
            : assignedRoles.length <= 8
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-2 sm:grid-cols-3'
        }`}>
          {assignedRoles.map((role, index) => (
            <div
              key={index}
              className={`relative overflow-hidden rounded-2xl transition-all duration-500 ${
                role.revealed ? 'animate-reveal' : 'opacity-0 scale-95'
              }`}
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-cyan-500/20" />
              <div className={`relative bg-slate-800/90 backdrop-blur-sm border border-white/10 rounded-2xl ${
                assignedRoles.length > 4 ? 'p-3' : 'p-4'
              }`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-pink-500/30 ${
                    assignedRoles.length > 4 ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base'
                  }`}>
                    {role.participantName.charAt(0).toUpperCase()}
                  </div>
                  <span className={`font-bold text-white truncate ${
                    assignedRoles.length > 4 ? 'text-sm' : 'text-base'
                  }`}>
                    {role.participantName}
                  </span>
                </div>
                <div className={`w-full rounded-xl bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 shadow-lg shadow-orange-500/30 text-center ${
                  assignedRoles.length > 4 ? 'px-3 py-1.5' : 'px-4 py-2'
                }`}>
                  <span className={`font-black text-white ${
                    assignedRoles.length > 4 ? 'text-sm' : 'text-base'
                  }`}>
                    {role.role}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Share Button */}
        <button
          onClick={shareResult}
          className="w-full mb-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold hover:from-emerald-600 hover:to-cyan-600 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
        >
          {showCopied ? (
            <>
              <span>✓</span>
              복사됨!
            </>
          ) : (
            <>
              <span>📋</span>
              결과 공유하기
            </>
          )}
        </button>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={resetGame}
            className="flex-1 ra-btn-secondary"
          >
            <span className="mr-2">🔄</span>
            새 게임
          </button>
          <button
            onClick={reassign}
            className="flex-1 ra-btn-primary"
          >
            <span className="mr-2">🎲</span>
            다시 배정
          </button>
        </div>
      </div>
    );
  }

  // Setup screen (public mode)
  return (
    <>
      {/* Server Error Modal */}
      {showServerError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowServerError(false)}
          />
          <div className="relative w-full max-w-sm animate-pop">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-red-500/30 shadow-2xl shadow-red-500/10 overflow-hidden">
              <div className="bg-red-500/10 px-6 py-8 text-center">
                <div className="text-6xl mb-4 animate-bounce-in">🔌</div>
                <h3 className="text-xl font-bold text-white">{serverError}</h3>
                <p className="text-sm text-slate-400 mt-2">잠시 후 다시 시도해주세요</p>
              </div>
              <div className="p-4 space-y-3">
                <button
                  onClick={() => {
                    setShowServerError(false);
                    handleEnterPrivateMode();
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold hover:from-pink-600 hover:to-purple-600 transition-all active:scale-[0.98]"
                >
                  🔄 다시 시도
                </button>
                <button
                  onClick={() => setShowServerError(false)}
                  className="w-full py-3 rounded-xl bg-slate-700/50 text-slate-300 font-medium hover:bg-slate-700 transition-all"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validation Error Modal */}
      {showValidationError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowValidationError(false)}
          />
          <div className="relative w-full max-w-sm animate-pop">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-orange-500/30 shadow-2xl shadow-orange-500/10 overflow-hidden">
              <div className="bg-orange-500/10 px-6 py-8 text-center">
                <div className="text-6xl mb-4 animate-bounce-in">⚠️</div>
                <h3 className="text-xl font-bold text-white">{validationErrorMessage}</h3>
                <p className="text-sm text-slate-400 mt-2">입력 내용을 확인하고 다시 시도해주세요</p>
              </div>
              <div className="p-4">
                <button
                  onClick={() => setShowValidationError(false)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold hover:from-pink-600 hover:to-purple-600 transition-all active:scale-[0.98]"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="ra-container">
        {/* Hero Title */}
        <div className="text-center mb-8 pt-4">
          <h1 className="text-4xl sm:text-5xl font-black mb-2">
            <span className="mr-2">🎭</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400">
              역할 뽑기
            </span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">마피아, 마니또 역할을 실시간으로 몰래 뽑아보세요!</p>
        </div>

        {/* Mode Switch - only show if multiplayer is available */}
      {isMultiplayerReady && (
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1.5 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 shadow-xl">
            <button
              onClick={() => setRevealMode('public')}
              className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                revealMode === 'public'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg shadow-pink-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              전체 공개
            </button>
            <button
              onClick={handleEnterPrivateMode}
              disabled={isCheckingServer}
              className="px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 text-slate-400 hover:text-white disabled:opacity-50 flex items-center gap-2"
            >
              {isCheckingServer && (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
              )}
              개별 공개
            </button>
          </div>
        </div>
      )}

      {/* Participants Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👥</span>
            <h3 className="text-xl font-black text-white">
              참가자
              <span className="ml-2 px-2 py-1 text-sm rounded-lg bg-pink-500/20 text-pink-400">
                {participants.filter(p => p.name.trim()).length}명
              </span>
            </h3>
          </div>
          <button
            onClick={resetParticipants}
            className="w-9 h-9 rounded-xl bg-slate-800/50 text-slate-500 hover:text-pink-400 hover:bg-slate-700 transition-all duration-200 flex items-center justify-center"
            title="Reset"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className={`grid gap-3 ${
          participants.length <= 4
            ? 'grid-cols-1'
            : participants.length <= 8
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-2 sm:grid-cols-3'
        }`}>
          {participants.map((p, index) => {
            const isInitial = initialParticipantIds.current.has(p.id);
            return (
            <div
              key={p.id}
              className={`group flex gap-2 ${isInitial ? '' : 'animate-pop'}`}
              style={isInitial ? { animationDelay: `${index * 0.03}s` } : undefined}
            >
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updateParticipant(p.id, e.target.value)}
                  placeholder={`참가자 ${index + 1}`}
                  className={`ra-input w-full shadow-inner ${participants.length > 4 ? 'py-2.5 text-sm' : ''}`}
                />
              </div>
              {participants.length > 2 && (
                <button
                  onClick={() => removeParticipant(p.id)}
                  className={`rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-300 flex items-center justify-center active:scale-90 ${
                    participants.length > 4 ? 'w-10 h-10 text-base' : 'w-12 h-12 text-xl'
                  }`}
                >
                  ✕
                </button>
              )}
            </div>
          );})}
        </div>

        <button
          onClick={addParticipant}
          className="w-full mt-3 py-3 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/50 text-slate-500 hover:border-pink-500/50 hover:text-pink-400 hover:bg-pink-500/5 transition-all duration-300 font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <span className="text-lg">＋</span>
          참가자 추가
        </button>
      </div>

      {/* Roles Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎭</span>
            <h3 className="text-xl font-black text-white">역할 설정</h3>
          </div>
          <button
            onClick={resetRoles}
            className="w-9 h-9 rounded-xl bg-slate-800/50 text-slate-500 hover:text-cyan-400 hover:bg-slate-700 transition-all duration-200 flex items-center justify-center"
            title="Reset"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className={`grid gap-3 ${
          roles.length <= 3
            ? 'grid-cols-1'
            : 'grid-cols-1 sm:grid-cols-2'
        }`}>
          {roles.map((role, index) => {
            const isInitial = initialRoleIds.current.has(role.id);
            return (
            <div
              key={role.id}
              className={`group flex gap-2 ${isInitial ? '' : 'animate-pop'}`}
              style={isInitial ? { animationDelay: `${index * 0.03}s` } : undefined}
            >
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={role.name}
                  onChange={(e) => updateRole(role.id, 'name', e.target.value)}
                  placeholder="역할 이름"
                  className={`ra-input w-full shadow-inner ${roles.length > 3 ? 'py-2.5 text-sm' : ''}`}
                />
              </div>
              <div className="flex items-center bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-hidden shrink-0">
                <button
                  onClick={() => updateRole(role.id, 'count', Math.max(0, role.count - 1))}
                  className={`bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors font-bold ${
                    roles.length > 3 ? 'w-8 h-10 text-base' : 'w-10 h-12 text-lg'
                  }`}
                >
                  −
                </button>
                <div className={`flex items-center justify-center border-x-2 border-slate-800/50 ${
                  roles.length > 3 ? 'w-10 h-10' : 'w-12 h-12'
                }`}>
                  <span className={`font-bold text-white ${roles.length > 3 ? 'text-base' : 'text-lg'}`}>{role.count}</span>
                </div>
                <button
                  onClick={() => updateRole(role.id, 'count', role.count + 1)}
                  className={`bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors font-bold ${
                    roles.length > 3 ? 'w-8 h-10 text-base' : 'w-10 h-12 text-lg'
                  }`}
                >
                  +
                </button>
              </div>
              {roles.length > 1 && (
                <button
                  onClick={() => removeRole(role.id)}
                  className={`shrink-0 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-300 flex items-center justify-center active:scale-90 ${
                    roles.length > 3 ? 'w-10 h-10 text-base' : 'w-12 h-12 text-xl'
                  }`}
                >
                  ✕
                </button>
              )}
            </div>
          );})}
        </div>

        <p className="text-xs text-slate-500 pl-1 mt-3 flex items-center gap-2">
          <span>💡</span>
          * 0명으로 설정하면 나머지 인원이 해당 역할로 배정됩니다
        </p>

        <button
          onClick={addRole}
          className="w-full mt-3 py-3 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/50 text-slate-500 hover:border-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/5 transition-all duration-300 font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <span className="text-lg">＋</span>
          역할 추가
        </button>
      </div>

      {/* Assign Button */}
      <button
        onClick={assignRoles}
        className="ra-btn-primary w-full text-lg py-5"
      >
        <span className="mr-3 text-2xl">🎲</span>
        역할 배정하기
        <span className="ml-3 text-2xl">🎲</span>
      </button>

      {/* Guide Section */}
      <section className="mt-12 bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-slate-700/50 p-6 space-y-6">
        {/* Why */}
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
            <span>💭</span> 만든 이유
          </h2>
          <p className="text-slate-300 leading-relaxed">마피아 게임할 때 역할 정하기가 너무 귀찮았어요. 쪽지 쓰고, 접고, 섞고... 그래서 만들었습니다. 이제 폰 하나로 1초만에 역할 배정 끝!</p>
        </div>

        {/* Features */}
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
            <span>✨</span> 주요 기능
          </h3>
          <ul className="space-y-2 text-slate-300">
            <li>⚡ 실시간 동기화 - 방장이 배정하면 즉시 모두에게 전달</li>
            <li>🤫 완벽한 비밀 유지 - 절대 남의 역할을 볼 수 없음</li>
            <li>🎯 스마트 자동 배정 - 인원수 맞추기 귀찮을 때 0명 설정!</li>
          </ul>
        </div>

        {/* How to use */}
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
            <span>🎮</span> 사용 방법
          </h3>
          <div className="space-y-3">
            <div className="bg-slate-700/50 rounded-xl p-3">
              <p className="text-cyan-400 font-medium mb-1">🌐 전체 공개</p>
              <p className="text-slate-400 text-sm">한 화면에서 모든 결과 공개. 스파이 게임 아닐 때, 빠르게 역할만 정하고 싶을 때!</p>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-3">
              <p className="text-pink-400 font-medium mb-1">🤫 개별 공개 (추천!)</p>
              <p className="text-slate-400 text-sm">각자 폰으로 접속해서 본인 역할만 몰래 확인. 마피아, 스파이, 라이어 게임 필수!</p>
            </div>
          </div>
        </div>

        {/* Tip */}
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
          <p className="text-cyan-400 font-medium mb-1">💡 팁</p>
          <p className="text-cyan-300/80 text-sm">역할 수를 0으로 설정하면 나머지 인원이 자동 배정됩니다. 예: 마피아 2명, 시민 0명 → 나머지 전원 시민!</p>
        </div>
      </section>
      </div>
    </>
  );
}
