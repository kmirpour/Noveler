import { useEffect, useRef, useState } from 'react';
import { useDialogStore } from '../../services/dialogs';
import './DialogHost.css';

/** Shows queued confirm / prompt dialogs one at a time. */
export function DialogHost() {
  const request = useDialogStore((s) => s.queue[0]);
  const shift = useDialogStore((s) => s.shift);
  const [value, setValue] = useState('');
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!request) return;
    if (request.kind === 'prompt') {
      setValue(request.defaultValue ?? '');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    } else {
      setTimeout(() => confirmRef.current?.focus(), 0);
    }
  }, [request]);

  if (!request) return null;

  const cancel = () => {
    if (request.kind === 'confirm') request.resolve(false);
    else request.resolve(null);
    shift();
  };

  const accept = () => {
    if (request.kind === 'confirm') request.resolve(true);
    else request.resolve(value);
    shift();
  };

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
      onKeyDownCapture={(e) => {
        // Handled here so Escape closes this dialog rather than whatever is underneath it.
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cancel();
        }
      }}
    >
      <form
        className="dialog-box"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={request.message ? 'dialog-message' : undefined}
        onSubmit={(e) => {
          e.preventDefault();
          accept();
        }}
      >
        <h2 id="dialog-title" className="dialog-title">
          {request.title}
        </h2>
        {request.message && (
          <p id="dialog-message" className="dialog-message">
            {request.message}
          </p>
        )}
        {request.kind === 'prompt' && (
          <input
            ref={inputRef}
            type="text"
            className="dialog-input"
            value={value}
            placeholder={request.placeholder}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        <div className="dialog-actions">
          <button type="button" className="dialog-btn" onClick={cancel}>
            {(request.kind === 'confirm' && request.cancelLabel) || 'Cancel'}
          </button>
          <button
            ref={confirmRef}
            type="submit"
            className={`dialog-btn primary ${request.kind === 'confirm' && request.danger ? 'danger' : ''}`}
          >
            {request.confirmLabel || 'OK'}
          </button>
        </div>
      </form>
    </div>
  );
}
