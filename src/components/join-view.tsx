interface JoinViewProps {
  joinCode: string;
  onJoinCodeChange: (value: string) => void;
  joinName: string;
  onJoinNameChange: (value: string) => void;
  onJoinRoom: () => void;
  onBack: () => void;
  isLoading: boolean;
}

export function JoinView({
  joinCode, onJoinCodeChange,
  joinName, onJoinNameChange,
  onJoinRoom, onBack, isLoading,
}: JoinViewProps) {
  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        뒤로
      </button>

      <div className="text-center">
        <div className="text-5xl mb-2">🚪</div>
        <h2 className="text-2xl font-black text-white">방 참여하기</h2>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-300 mb-2">방 코드</label>
        <input
          type="text"
          value={joinCode}
          onChange={(e) => onJoinCodeChange(e.target.value.toUpperCase())}
          placeholder="ABCD12"
          maxLength={6}
          className="ra-input w-full text-center text-3xl font-mono tracking-[0.3em] uppercase"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-300 mb-2">이름</label>
        <input
          type="text"
          value={joinName}
          onChange={(e) => onJoinNameChange(e.target.value)}
          placeholder="참여하실 이름을 입력하세요"
          className="ra-input w-full"
        />
      </div>

      <button
        onClick={onJoinRoom}
        disabled={isLoading}
        className="ra-btn-primary w-full"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            참여 중...
          </span>
        ) : (
          <>🎮 참여하기</>
        )}
      </button>
    </div>
  );
}
