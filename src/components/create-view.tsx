import type { RoleConfig } from '../room-manager';

interface CreateViewProps {
  hostName: string;
  onHostNameChange: (value: string) => void;
  manitoMode: boolean;
  onManitoModeToggle: () => void;
  roles: RoleConfig[];
  onAddRole: () => void;
  onRemoveRole: (id: string) => void;
  onUpdateRole: (id: string, field: keyof RoleConfig, value: string | number) => void;
  onCreateRoom: () => void;
  onBack: () => void;
  isLoading: boolean;
}

export function CreateView({
  hostName, onHostNameChange,
  manitoMode, onManitoModeToggle,
  roles, onAddRole, onRemoveRole, onUpdateRole,
  onCreateRoom, onBack, isLoading,
}: CreateViewProps) {
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
        <div className="text-5xl mb-2">🏠</div>
        <h2 className="text-2xl font-black text-white">방 만들기</h2>
      </div>

      {/* Host name */}
      <div>
        <label className="block text-lg font-bold text-slate-200 mb-2">이름</label>
        <input
          type="text"
          value={hostName}
          onChange={(e) => onHostNameChange(e.target.value)}
          placeholder="참여하실 이름을 입력하세요"
          className="ra-input w-full"
        />
      </div>

      {/* Roles with Manito Toggle */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-lg font-bold text-slate-200">역할 설정</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">🎁 마니또</span>
            <button
              onClick={onManitoModeToggle}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                manitoMode ? 'bg-gradient-to-r from-pink-500 to-purple-500' : 'bg-slate-600'
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                  manitoMode ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
            <div className="relative group">
              <button
                className="w-5 h-5 rounded-full bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white text-xs font-bold transition-colors"
              >
                ?
              </button>
              <div className="absolute right-0 bottom-full mb-2 w-56 p-3 bg-slate-900 rounded-xl border border-slate-700 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <p className="text-xs text-slate-300 leading-relaxed">참가자끼리 1:1로 비밀 친구를 배정해요. 자기 자신은 절대 배정되지 않아요!</p>
                <div className="absolute bottom-0 right-4 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900 border-r border-b border-slate-700"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Role inputs - hidden when manito mode */}
        {!manitoMode && (
        <div className="space-y-3">
          {roles.map((role, index) => (
            <div key={role.id} className="flex gap-3 animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
              <input
                type="text"
                value={role.name}
                onChange={(e) => onUpdateRole(role.id, 'name', e.target.value)}
                placeholder="역할 이름"
                className="ra-input flex-1"
              />
              <div className="flex items-center gap-0">
                <button
                  onClick={() => onUpdateRole(role.id, 'count', Math.max(0, role.count - 1))}
                  className="w-10 h-12 rounded-l-xl bg-slate-700 text-white hover:bg-slate-600 transition-colors font-bold"
                >
                  −
                </button>
                <div className="w-12 h-12 bg-slate-800 flex items-center justify-center border-y border-slate-700">
                  <span className="font-bold text-white">{role.count}</span>
                </div>
                <button
                  onClick={() => onUpdateRole(role.id, 'count', role.count + 1)}
                  className="w-10 h-12 rounded-r-xl bg-slate-700 text-white hover:bg-slate-600 transition-colors font-bold"
                >
                  +
                </button>
                <span className="text-xs text-slate-500 w-6 ml-2">명</span>
              </div>
              {roles.length > 1 && (
                <button
                  onClick={() => onRemoveRole(role.id)}
                  className="w-12 h-12 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <span>💡</span>
            * 0명으로 설정하면 나머지 인원이 해당 역할로 배정됩니다
          </p>
          <button
            onClick={onAddRole}
            className="w-full py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 hover:border-cyan-500 hover:text-cyan-400 transition-all font-bold flex items-center justify-center gap-2"
          >
            <span>➕</span>
            역할 추가
          </button>
        </div>
        )}
      </div>

      <button
        onClick={onCreateRoom}
        disabled={isLoading}
        className="ra-btn-primary w-full"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            생성 중...
          </span>
        ) : (
          <>🚀 방 만들기</>
        )}
      </button>
    </div>
  );
}
