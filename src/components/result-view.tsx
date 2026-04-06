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
          <div className="relative p-10 bg-slate-900/80 rounded-[2rem] border-2 border-slate-800 shadow-2xl overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
            <div className="relative">
              <p className="text-slate-400 text-sm mb-8 font-medium uppercase tracking-widest">Tap to reveal your identity</p>
              <button
                onClick={onRevealRole}
                disabled={isRevealing}
                className="ra-btn-primary px-12 py-6 text-2xl mx-auto shadow-[0_0_30px_rgba(6,182,212,0.2)] hover:shadow-[0_0_40px_rgba(6,182,212,0.4)] transition-all"
              >
                {isRevealing ? (
                  <div className="w-8 h-8 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-3">
                    🔮 역할 확인하기
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : myRole ? (
        <div className="text-center animate-reveal">
          <div className="p-12 bg-slate-900 rounded-[2rem] border-2 border-cyan-500/30 relative overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.1)]">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-slate-900 to-purple-500/10" />
            <div className="relative">
              {room.manitoMode ? (
                <>
                  <p className="text-slate-500 text-xs font-black mb-4 uppercase tracking-[0.3em]">Your Target</p>
                  <p className="text-6xl font-black">
                    <span className="block text-4xl mb-2">🎁</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-purple-300 drop-shadow-sm">
                      {myRole.assignedRole}
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-slate-500 text-xs font-black mb-4 uppercase tracking-[0.3em]">{myRole.name}&apos;s Role</p>
                  <p className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-white to-amber-400 drop-shadow-sm">
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
        <div className="bg-slate-900/40 rounded-3xl p-5 border border-slate-800/60 backdrop-blur-sm">
          <h3 className="font-bold text-slate-200 mb-5 text-sm uppercase tracking-wider">확인 현황</h3>
          <div className="space-y-2">
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3.5 bg-slate-900/50 border border-slate-800/50 rounded-2xl"
              >
                <span className="text-slate-300 font-medium">{p.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-tighter ${
                    p.hasViewed
                      ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}>
                    {p.hasViewed ? 'Revealed' : 'Hidden'}
                  </span>
                  {p.hasViewed && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
                </div>
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
