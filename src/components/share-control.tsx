'use client';

import { useId, useRef, useState } from 'react';

type ShareState = 'idle' | 'sharing' | 'shared' | 'fallback' | 'copied' | 'manual';

interface ShareControlProps {
  url: string | null;
  label: string;
  shareTitle: string;
  disabledReason?: string;
  compact?: boolean;
}

function shareFailureReason(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return '시스템 공유 권한이 허용되지 않았습니다.';
  }
  return '시스템 공유를 열지 못했습니다.';
}

export function ShareControl({
  url,
  label,
  shareTitle,
  disabledReason,
  compact = false,
}: ShareControlProps) {
  const [state, setState] = useState<ShareState>('idle');
  const [message, setMessage] = useState('');
  const manualInputRef = useRef<HTMLInputElement>(null);
  const manualInputId = useId();

  const showManualCopy = (reason: string) => {
    setMessage(`${reason} 아래 링크를 선택해 직접 복사해주세요.`);
    setState('manual');
    window.requestAnimationFrame(() => {
      manualInputRef.current?.focus();
      manualInputRef.current?.select();
    });
  };

  const handleShare = async () => {
    if (!url) {
      setMessage(disabledReason ?? '링크를 만들 수 없습니다. 입력 길이를 줄여주세요.');
      setState('fallback');
      return;
    }

    const shareData = { title: shareTitle, url };
    let canUseSystemShare = (
      typeof navigator.share === 'function'
      && typeof navigator.canShare === 'function'
    );
    if (canUseSystemShare) {
      try {
        canUseSystemShare = navigator.canShare({ url });
      } catch {
        canUseSystemShare = false;
      }
    }

    if (!canUseSystemShare) {
      setMessage('이 브라우저는 시스템 공유를 지원하지 않습니다. 링크 복사를 사용해주세요.');
      setState('fallback');
      return;
    }

    setState('sharing');
    setMessage('시스템 공유 창을 여는 중입니다.');
    try {
      await navigator.share(shareData);
      setState('shared');
      setMessage('공유를 완료했습니다.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setState('idle');
        setMessage('');
        return;
      }
      setState('fallback');
      setMessage(`${shareFailureReason(error)} 링크 복사를 사용해주세요.`);
    }
  };

  const handleCopy = async () => {
    if (!url) {
      setMessage(disabledReason ?? '링크를 만들 수 없습니다. 입력 길이를 줄여주세요.');
      return;
    }
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      showManualCopy('클립보드 복사를 지원하지 않는 브라우저입니다.');
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      setMessage('링크를 복사했습니다.');
    } catch {
      showManualCopy('클립보드 권한이 거부되었거나 복사에 실패했습니다.');
    }
  };

  const needsCopyAction = state === 'fallback' || state === 'manual' || state === 'copied';

  return (
    <div className={`ra-share-control ${compact ? 'ra-share-control-compact' : ''}`}>
      <div className="ra-share-buttons">
        <button
          type="button"
          onClick={handleShare}
          disabled={state === 'sharing' || !url}
          className={compact ? 'ra-btn-tertiary' : 'ra-btn-secondary'}
        >
          <span aria-hidden="true">↗</span>
          {state === 'sharing' ? '공유 창 여는 중' : label}
        </button>
        {needsCopyAction && url && (
          <button type="button" onClick={handleCopy} className="ra-btn-tertiary">
            <span aria-hidden="true">⧉</span>
            {state === 'copied' ? '다시 복사' : '링크 복사'}
          </button>
        )}
      </div>

      {!url && disabledReason && (
        <p className="ra-field-error" role="alert">{disabledReason}</p>
      )}

      {state === 'manual' && url && (
        <div className="mt-3">
          <label className="block text-xs font-bold text-slate-300" htmlFor={manualInputId}>
            직접 복사할 전체 링크
          </label>
          <input
            ref={manualInputRef}
            id={manualInputId}
            type="text"
            readOnly
            value={url}
            onClick={(event) => event.currentTarget.select()}
            className="ra-manual-link"
          />
        </div>
      )}

      <p className="ra-live-message" aria-live="polite" aria-atomic="true">
        {message}
      </p>
    </div>
  );
}
