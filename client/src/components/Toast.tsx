export type ToastTone = 'success' | 'error';

interface ToastProps {
  message: string;
  tone: ToastTone;
}

/**
 * Bottom-centre pill. A green check means the action succeeded; a red
 * exclamation means it was refused. A validation failure or a broken business
 * rule is never shown with the success glyph.
 */
export function Toast({ message, tone }: ToastProps) {
  const isError = tone === 'error';
  return (
    <div className="toast" role="status" aria-live="polite">
      <span className={`toast__dot toast__dot--${isError ? 'error' : 'ok'}`} aria-hidden="true">
        {isError ? '!' : '✓'}
      </span>
      <span style={{ textWrap: 'pretty' } as React.CSSProperties}>{message}</span>
    </div>
  );
}
