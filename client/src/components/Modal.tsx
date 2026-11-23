import { useEffect, useRef } from 'react';

export interface ModalSummaryLine {
  label: string;
  value: string;
}

interface ModalProps {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  /** A mandatory free-text reason, e.g. rejecting a purchase order. */
  reason?: {
    label: string;
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
  };
  /** "47 → 87 case" style lines shown before confirming. */
  summary?: ModalSummaryLine[];
}

/**
 * Confirmation dialog for destructive or irreversible actions. Escape and a
 * backdrop click both cancel; focus moves into the dialog on open so keyboard
 * users are not left behind on the page underneath.
 */
export function Modal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  tone = 'primary',
  busy = false,
  reason,
  summary,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="stack" style={{ gap: 6 }}>
          <span className="modal__title">{title}</span>
          <span className="modal__body">{body}</span>
        </div>

        {reason && (
          <div className="field">
            <label className="field__label" htmlFor="modal-reason">
              {reason.label}
              <span className="field__required" aria-hidden="true">
                *
              </span>
            </label>
            <textarea
              id="modal-reason"
              className={`textarea${reason.error ? ' input--error' : ''}`}
              rows={3}
              value={reason.value}
              placeholder={reason.placeholder}
              onChange={(event) => reason.onChange(event.target.value)}
            />
            {reason.error && <span className="field__error">{reason.error}</span>}
          </div>
        )}

        {summary && summary.length > 0 && (
          <div className="modal__summary">
            {summary.map((line) => (
              <div key={line.label} className="modal__summary-row">
                <span>{line.label}</span>
                <span className="success-text" style={{ fontWeight: 500 }}>
                  {line.value}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn--danger-solid' : 'btn--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
