'use client';

import { useEffect, useId, useRef, useState } from 'react';

type CopyState = 'idle' | 'copying' | 'copied' | 'manual';

interface ShareControlProps {
  url: string | null;
  label: string;
  disabledReason?: string;
  compact?: boolean;
}

export function ShareControl({
  url,
  label,
  disabledReason,
  compact = false,
}: ShareControlProps) {
  const [state, setState] = useState<CopyState>('idle');
  const [message, setMessage] = useState('');
  const manualInputRef = useRef<HTMLInputElement>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const manualInputId = useId();

  const clearCopiedTimer = () => {
    if (copiedTimerRef.current === null) return;
    window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = null;
  };

  useEffect(() => () => {
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
  }, []);

  const showManualCopy = (reason: string) => {
    setMessage(`${reason} 아래 링크를 선택해 직접 복사해주세요.`);
    setState('manual');
    window.requestAnimationFrame(() => {
      manualInputRef.current?.focus();
      manualInputRef.current?.select();
    });
  };

  const handleCopy = async () => {
    clearCopiedTimer();
    if (!url) {
      setMessage(disabledReason ?? '링크를 만들 수 없습니다. 입력 길이를 줄여주세요.');
      return;
    }
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      showManualCopy('클립보드 복사를 지원하지 않는 브라우저입니다.');
      return;
    }

    setState('copying');
    setMessage('링크를 복사하는 중입니다.');
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      setMessage('링크를 복사했습니다.');
      copiedTimerRef.current = window.setTimeout(() => {
        copiedTimerRef.current = null;
        setState('idle');
        setMessage('');
      }, 2_000);
    } catch {
      showManualCopy('클립보드 권한이 거부되었거나 복사에 실패했습니다.');
    }
  };

  const buttonLabel = state === 'copying'
    ? '링크 복사 중'
    : state === 'copied'
      ? '복사 완료'
      : label;

  return (
    <div className={`ra-share-control ${compact ? 'ra-share-control-compact' : ''}`}>
      <div className="ra-share-buttons">
        <button
          type="button"
          onClick={handleCopy}
          disabled={state === 'copying' || !url}
          aria-label={buttonLabel}
          className={compact ? 'ra-btn-tertiary' : 'ra-btn-secondary'}
        >
          <span className="ra-copy-button-content" aria-hidden="true">
            <span className={state === 'idle' || state === 'manual' ? '' : 'invisible'}>
              <span>⧉</span>
              {label}
            </span>
            <span className={state === 'copying' ? '' : 'invisible'}>링크 복사 중</span>
            <span className={state === 'copied' ? '' : 'invisible'}>✓ 복사 완료</span>
          </span>
        </button>
      </div>

      {!url && disabledReason && (
        <p className="ra-field-error" role="alert">{disabledReason}</p>
      )}

      {state === 'manual' && url && (
        <div className="mt-3">
          <label className="block text-xs font-bold text-slate-300" htmlFor={manualInputId}>
            직접 복사할 결과 링크
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

      <p
        className={state === 'manual' ? 'ra-live-message' : 'sr-only'}
        aria-live="polite"
        aria-atomic="true"
      >
        {message}
      </p>
    </div>
  );
}
