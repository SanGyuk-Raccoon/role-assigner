import type { Room, RoleConfig, RoomParticipant } from '../room-manager';

interface LobbyViewProps {
  room: Room;
  participantId: string;
  participants: RoomParticipant[];
  isHost: boolean;
  isLoading: boolean;
  // Room actions
  onCopyCode: () => void;
  onAssignRoles: () => void;
  onDeleteRoom: () => void;
  onLeaveRoom: () => void;
  // Name editing
  isEditingName: boolean;
  editingNameValue: string;
  onStartEditName: () => void;
  onSaveName: () => void;
  onCancelEditName: () => void;
  onEditingNameChange: (value: string) => void;
  // Role editing
  isEditingRoles: boolean;
  editingRoles: RoleConfig[];
  onStartEditRoles: () => void;
  onSaveRoles: () => void;
  onCancelEditRoles: () => void;
  onAddEditingRole: () => void;
  onRemoveEditingRole: (id: string) => void;
  onUpdateEditingRole: (id: string, field: keyof RoleConfig, value: string | number) => void;
}

export function LobbyView({
  room, participantId, participants, isHost, isLoading,
  onCopyCode, onAssignRoles, onDeleteRoom, onLeaveRoom,
  isEditingName, editingNameValue, onStartEditName, onSaveName, onCancelEditName, onEditingNameChange,
  isEditingRoles, editingRoles, onStartEditRoles, onSaveRoles, onCancelEditRoles,
  onAddEditingRole, onRemoveEditingRole, onUpdateEditingRole,
}: LobbyViewProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-5xl mb-3 animate-float">🏠</div>
        <h2 className="text-2xl font-black text-white mb-2">대기실</h2>
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-slate-800 border border-slate-700">
          <span className="text-slate-400 text-sm">방 코드:</span>
          <button
            onClick={onCopyCode}
            className="font-mono text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400 hover:from-pink-400 hover:to-cyan-400 transition-all flex items-center gap-2"
          >
            {room.code}
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Participants list */}
      <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white flex items-center gap-2">
            참가자
            <span className="px-2 py-0.5 text-sm rounded-lg bg-pink-500/20 text-pink-400">
              {participants.length}
            </span>
          </h3>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            대기 중
          </div>
        </div>

        <div className="space-y-2">
          {participants.map((p, index) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all animate-slide-up ${
                p.id === participantId
                  ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30'
                  : 'bg-slate-700/50'
              }`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-lg shadow-lg shrink-0">
                {p.isHost ? '👑' : '😎'}
              </div>

              {/* Name editing for current participant */}
              {p.id === participantId && isEditingName ? (
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={editingNameValue}
                    onChange={(e) => onEditingNameChange(e.target.value)}
                    className="ra-input flex-1 py-2 text-sm"
                    autoFocus
                  />
                  <button
                    onClick={onSaveName}
                    disabled={isLoading || !editingNameValue.trim()}
                    className="px-3 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white transition-all disabled:opacity-50"
                  >
                    ✓
                  </button>
                  <button
                    onClick={onCancelEditName}
                    className="px-3 py-2 rounded-lg bg-slate-600 text-slate-300 hover:bg-slate-500 transition-all"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-bold text-white flex-1 truncate">
                    {p.name}
                    {p.id === participantId && (
                      <span className="text-slate-400 text-sm font-normal ml-2">(나)</span>
                    )}
                  </span>
                  {p.id === participantId && (
                    <button
                      onClick={onStartEditName}
                      className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-700 transition-all"
                      title="이름 수정"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </>
              )}

              {p.isHost && !isEditingName && (
                <span className="text-xs px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 shrink-0">HOST</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Roles section */}
      {room.manitoMode ? (
        <div className="bg-gradient-to-br from-pink-900/30 to-purple-900/30 rounded-2xl p-6 border border-pink-500/30">
          <div className="text-center">
            <div className="text-5xl mb-3">🎁</div>
            <h3 className="font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
              마니또
            </h3>
            <p className="text-slate-400 text-sm mt-2">참가자끼리 1:1 비밀 친구 배정</p>
          </div>
        </div>
      ) : isHost ? (
        <HostRoleEditor
          room={room}
          isEditingRoles={isEditingRoles}
          editingRoles={editingRoles}
          isLoading={isLoading}
          onStartEdit={onStartEditRoles}
          onSave={onSaveRoles}
          onCancel={onCancelEditRoles}
          onAddRole={onAddEditingRole}
          onRemoveRole={onRemoveEditingRole}
          onUpdateRole={onUpdateEditingRole}
        />
      ) : (
        <ParticipantRoleCards roles={room.roles} />
      )}

      {/* Host controls */}
      {isHost ? (
        <div className="space-y-3">
          <button
            onClick={onAssignRoles}
            disabled={isLoading || participants.length < 2}
            className="ra-btn-primary w-full"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                배정 중...
              </span>
            ) : (
              <>🎲 역할 배정하기</>
            )}
          </button>
          {participants.length < 2 && (
            <p className="text-sm text-center text-slate-500">최소 2명 이상이 필요합니다</p>
          )}
          <button
            onClick={onDeleteRoom}
            className="ra-btn-secondary w-full text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-400"
          >
            🗑️ 방 삭제하기
          </button>
        </div>
      ) : (
        <div className="text-center space-y-3">
          <p className="text-slate-400 text-sm">호스트가 역할을 배정할 때까지 기다려주세요</p>
          <button onClick={onLeaveRoom} className="ra-btn-secondary">
            👋 방 나가기
          </button>
        </div>
      )}
    </div>
  );
}

// --- Sub-components for lobby ---

interface HostRoleEditorProps {
  room: Room;
  isEditingRoles: boolean;
  editingRoles: RoleConfig[];
  isLoading: boolean;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onAddRole: () => void;
  onRemoveRole: (id: string) => void;
  onUpdateRole: (id: string, field: keyof RoleConfig, value: string | number) => void;
}

function HostRoleEditor({
  room, isEditingRoles, editingRoles, isLoading,
  onStartEdit, onSave, onCancel,
  onAddRole, onRemoveRole, onUpdateRole,
}: HostRoleEditorProps) {
  return (
    <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-white flex items-center gap-2">
          🎭 역할 설정
        </h3>
        {!isEditingRoles && (
          <button
            onClick={onStartEdit}
            className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-700 transition-all"
            title="역할 수정"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>

      {isEditingRoles ? (
        <div className="space-y-3">
          {editingRoles.map((role) => (
            <div key={role.id} className="flex gap-2 animate-slide-up">
              <input
                type="text"
                value={role.name}
                onChange={(e) => onUpdateRole(role.id, 'name', e.target.value)}
                placeholder="역할 이름"
                className="ra-input flex-1 py-2 text-sm"
              />
              <div className="flex items-center gap-0">
                <button
                  onClick={() => onUpdateRole(role.id, 'count', Math.max(0, role.count - 1))}
                  className="w-8 h-10 rounded-l-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors font-bold text-sm"
                >
                  −
                </button>
                <div className="w-10 h-10 bg-slate-800 flex items-center justify-center border-y border-slate-700">
                  <span className="font-bold text-white text-sm">{role.count}</span>
                </div>
                <button
                  onClick={() => onUpdateRole(role.id, 'count', role.count + 1)}
                  className="w-8 h-10 rounded-r-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors font-bold text-sm"
                >
                  +
                </button>
              </div>
              {editingRoles.length > 1 && (
                <button
                  onClick={() => onRemoveRole(role.id)}
                  className="w-10 h-10 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
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
            className="w-full py-2 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 hover:border-cyan-500 hover:text-cyan-400 transition-all text-sm font-bold"
          >
            ➕ 역할 추가
          </button>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onSave}
              disabled={isLoading}
              className="flex-1 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white transition-all font-bold disabled:opacity-50"
            >
              {isLoading ? '...' : '✓ 저장'}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 py-2 rounded-lg bg-slate-600 text-slate-300 hover:bg-slate-500 transition-all font-bold"
            >
              ✕ 취소
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {room.roles.filter(r => r.name.trim()).map((role) => (
            <div
              key={role.id}
              className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl"
            >
              <span className="text-white font-medium">{role.name}</span>
              <span className="text-sm px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-400">
                {role.count === 0 ? '나머지' : `${role.count}명`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ParticipantRoleCardsProps {
  roles: RoleConfig[];
}

function ParticipantRoleCards({ roles }: ParticipantRoleCardsProps) {
  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl p-4 border border-purple-500/30">
      <h3 className="font-bold text-white flex items-center gap-2 mb-4">
        <span className="animate-pulse">✨</span>
        가능한 역할들
        <span className="animate-pulse">✨</span>
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {roles.filter(r => r.name.trim()).map((role, index) => (
          <div
            key={role.id}
            className="group relative p-4 rounded-xl bg-gradient-to-br from-purple-900/50 to-pink-900/50 border border-purple-500/30 hover:border-pink-400/50 transition-all duration-300 hover:scale-[1.02] cursor-default overflow-hidden animate-slide-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <div className="absolute -inset-1 bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="relative text-center">
              <div className="text-2xl mb-2">
                {['🎭', '🃏', '🎪', '🌟', '💫', '🔮'][index % 6]}
              </div>
              <p className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-purple-300 text-sm">
                {role.name}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                ×{role.count === 0 ? '?' : role.count}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 text-center mt-3 flex items-center justify-center gap-1">
        <span>🎲</span>
        곧 당신의 역할이 배정됩니다!
      </p>
    </div>
  );
}
