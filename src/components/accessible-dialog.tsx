'use client';

import {
  ReactNode,
  RefObject,
  useEffect,
  useId,
  useRef,
} from 'react';

interface AccessibleDialogProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement>;
  closeLabel?: string;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function AccessibleDialog({
  open,
  title,
  description,
  children,
  onClose,
  initialFocusRef,
  closeLabel = '닫기',
}: AccessibleDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTarget = initialFocusRef?.current
      ?? dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ?? dialogRef.current;
    window.requestAnimationFrame(() => focusTarget?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => !element.hasAttribute('hidden'));

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const opener = openerRef.current;
      window.requestAnimationFrame(() => {
        if (opener?.isConnected) opener.focus();
      });
    };
  }, [initialFocusRef, open]);

  if (!open) return null;

  return (
    <div
      className="ra-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="ra-dialog"
      >
        <div className="ra-dialog-heading">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-black text-white break-words">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-300">
                {description}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="ra-icon-button" aria-label={closeLabel}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
