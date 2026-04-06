import type { Room, RoomParticipant } from '../room-manager';

interface ResultViewProps {
  room: Room;
  participantId: string;
  participants: RoomParticipant[];
  isHost: boolean;
  showRole: boolean;
  isRevealing: boolean;
  onRevealRole: () => void;
  onNewGame: () => void;
  onLeaveRoom: () => void;
  onReset: () => void;
  isLoading: boolean;
}

export function ResultView({
  room, participantId, participants, isHost,
  showRole, isRevealing, onRevealRole,
  onNewGame, onLeaveRoom, onReset, isLoading,
}: ResultViewProps) {
  const myRole = room.participants?.[participantId];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-bounce-in">🎭</div>
        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500">
          역할이 배정되었습니다!
        </h2>
      </div>

      {!showRole ? (
        <div className="text-center">
          <div className="relative p-8 bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border-2 border-pink-500/30 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/10" />
            <div className="relative">
              <p className="text-slate-300 mb-6">아래 버튼을 눌러 역할을 확인하세요</p>
              <button
                onClick={onRevealRole}
                disabled={isRevealing}
                className="ra-btn-primary px-10 py-5 text-xl mx-auto"
              >
                {isRevealing ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    🔮 역할 확인하기
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : myRole ? (
        <div className="text-center animate-reveal">
          <div className="p-10 bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border-2 border-pink-500/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-cyan-500/20" />
            <div className="relative">
              {room.manitoMode ? (
                <>
                  <p className="text-slate-400 text-sm mb-3">마니또 대상</p>
                  <p className="text-5xl font-black">
                    <span>🎁 </span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500">
                      {myRole.assignedRole}
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-slate-400 text-sm mb-3">{myRole.name}님의 역할은</p>
                  <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500">
                    {myRole.assignedRole}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Show who has viewed (host only) */}
      {isHost && (
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
          <h3 className="font-bold text-white mb-4">확인 현황</h3>
          <div className="space-y-2">
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl"
              >
                <span className="text-white font-medium">{p.name}</span>
                <span className={`text-sm px-3 py-1 rounded-lg ${
                  p.hasViewed
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-slate-600 text-slate-400'
                }`}>
                  {p.hasViewed ? '✓ 확인함' : '미확인'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Host: Replay & New Game buttons, Participant: Leave Room button */}
      {isHost ? (
        <div className="space-y-3">
          <button
            onClick={onNewGame}
            disabled={isLoading}
            className="ra-btn-primary w-full"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                🔄 다시하기
              </span>
            )}
          </button>
          <button onClick={onReset} className="ra-btn-secondary w-full">
            🏠 새 게임
          </button>
        </div>
      ) : (
        <button onClick={onLeaveRoom} className="ra-btn-secondary w-full">
          👋 방 나가기
        </button>
      )}
    </div>
  );
}
