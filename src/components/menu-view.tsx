import type { ViewState } from './room-view';

interface MenuViewProps {
  onNavigate: (view: ViewState) => void;
  onBack?: () => void;
}

export function MenuView({ onNavigate, onBack }: MenuViewProps) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-float">🎭</div>
        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 mb-2">
          개별 공개 모드
        </h2>
        <p className="text-slate-400 text-sm">각자 자신의 역할만 확인할 수 있습니다</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onNavigate('create')}
          className="group p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-cyan-500/30 hover:border-cyan-400 transition-all duration-300 text-center hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="text-4xl mb-3 group-hover:animate-wiggle">🏠</div>
          <div className="font-bold text-white">방 만들기</div>
          <div className="text-sm text-slate-400 mt-1">방을 만들고 역할을 배정하세요</div>
        </button>

        <button
          onClick={() => onNavigate('join')}
          className="group p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-pink-500/30 hover:border-pink-400 transition-all duration-300 text-center hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="text-4xl mb-3 group-hover:animate-wiggle">🚪</div>
          <div className="font-bold text-white">방 참여하기</div>
          <div className="text-sm text-slate-400 mt-1">코드로 친구의 방에 참여하세요</div>
        </button>
      </div>

      {onBack && (
        <button
          onClick={onBack}
          className="w-full py-3 rounded-xl bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-all duration-300 font-medium"
        >
          ← 전체 공개 모드로 돌아가기
        </button>
      )}
    </div>
  );
}
