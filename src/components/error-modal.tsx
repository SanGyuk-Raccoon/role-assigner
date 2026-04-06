import type { RoomErrorType } from '../room-manager';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorType: RoomErrorType | null;
  errorMessage: string;
  onRetry?: () => void;
}

export function ErrorModal({ isOpen, onClose, errorType, errorMessage, onRetry }: ErrorModalProps) {
  if (!isOpen) return null;

  const isConnectionErr = errorType && ['CONNECTION_FAILED', 'CONNECTION_TIMEOUT', 'SERVER_ERROR'].includes(errorType);
  const isRateLimited = errorType === 'RATE_LIMITED';
  const isRoomNotFound = errorType === 'ROOM_NOT_FOUND';

  const getIcon = () => {
    if (isConnectionErr) return '🔌';
    if (isRateLimited) return '🚦';
    if (isRoomNotFound) return '🔍';
    if (errorType === 'ROOM_FULL') return '👥';
    if (errorType === 'NAME_TAKEN') return '✏️';
    if (errorType === 'ROOM_EXPIRED') return '⏰';
    return '⚠️';
  };

  const getHint = () => {
    if (isConnectionErr) return '잠시 후 다시 시도해주세요';
    if (isRateLimited) return '잠시 후 다시 시도해주세요';
    if (isRoomNotFound) return '방 코드가 올바른지 확인해주세요';
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm animate-pop">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-red-500/30 shadow-2xl shadow-red-500/10 overflow-hidden">
          {/* Header */}
          <div className="bg-red-500/10 px-6 py-8 text-center">
            <div className="text-6xl mb-4 animate-bounce-in">{getIcon()}</div>
            <h3 className="text-xl font-bold text-white">{errorMessage}</h3>
            {getHint() && (
              <p className="text-sm text-slate-400 mt-2">{getHint()}</p>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 space-y-3">
            {(isConnectionErr || isRateLimited) && onRetry && (
              <button
                onClick={() => {
                  onClose();
                  onRetry();
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold hover:from-pink-600 hover:to-purple-600 transition-all active:scale-[0.98]"
              >
                🔄 다시 시도
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-slate-700/50 text-slate-300 font-medium hover:bg-slate-700 transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RoomDeletedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RoomDeletedModal({ isOpen, onClose }: RoomDeletedModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-full max-w-sm animate-pop">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-purple-500/30 shadow-2xl shadow-purple-500/10 overflow-hidden">
          <div className="bg-purple-500/10 px-6 py-8 text-center">
            <div className="text-6xl mb-4 animate-bounce-in">👋</div>
            <h3 className="text-xl font-bold text-white">호스트가 방을 삭제했습니다</h3>
            <p className="text-sm text-slate-400 mt-2">방이 종료되어 더 이상 참여할 수 없어요</p>
          </div>

          <div className="p-4">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold hover:from-pink-600 hover:to-purple-600 transition-all active:scale-[0.98]"
            >
              메뉴로 돌아가기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({ isOpen, onClose, onConfirm }: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-sm animate-pop">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-red-500/30 shadow-2xl shadow-red-500/10 overflow-hidden">
          <div className="bg-red-500/10 px-6 py-8 text-center">
            <div className="text-6xl mb-4">🗑️</div>
            <h3 className="text-xl font-bold text-white">방 삭제하기</h3>
            <p className="text-sm text-slate-400 mt-2">모든 참가자가 나가게 됩니다. 정말 삭제하시겠습니까?</p>
          </div>

          <div className="p-4 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-slate-700 text-white font-bold hover:bg-slate-600 transition-all active:scale-[0.98]"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold hover:from-red-600 hover:to-red-700 transition-all active:scale-[0.98]"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
