import { useId, type ReactNode } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface BaseProps {
  label: string;
  required?: boolean;
  hint?: string;
  /** Renders the hint in amber — used where a hint explains a restriction. */
  hintTone?: 'muted' | 'warning';
  error?: string;
  /** Spans both columns of the two-column form grid. */
  wide?: boolean;
  disabled?: boolean;
}

type InputProps = BaseProps & {
  kind?: 'text' | 'password' | 'email' | 'number' | 'date';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  autoComplete?: string;
};

type SelectProps = BaseProps & {
  kind: 'select';
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
};

type TextareaProps = BaseProps & {
  kind: 'textarea';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

type ToggleProps = BaseProps & {
  kind: 'toggle';
  value: boolean;
  onChange: (value: boolean) => void;
  toggleLabel: string;
};

type FormFieldProps = InputProps | SelectProps | TextareaProps | ToggleProps;

/**
 * One field, one label, one error line. Errors are the `fields` map the API
 * returns, so a server-side rule failure lands on exactly the input that broke
 * it rather than in a generic banner.
 */
export function FormField(props: FormFieldProps) {
  const id = useId();
  const { label, required, hint, hintTone = 'muted', error, wide } = props;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={`field${wide ? ' field--wide' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && (
          <span className="field__required" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <Control id={id} describedBy={describedBy} invalid={Boolean(error)} {...props} />

      {hint && !error && (
        <span
          id={`${id}-hint`}
          className={`field__hint${hintTone === 'warning' ? ' field__hint--warning' : ''}`}
        >
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function Control(
  props: FormFieldProps & { id: string; describedBy?: string; invalid: boolean }
): ReactNode {
  const { id, describedBy, invalid, disabled } = props;
  const errorClass = invalid ? ' input--error' : '';

  if (props.kind === 'select') {
    return (
      <select
        id={id}
        className={`select${errorClass}`}
        value={props.value}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (props.kind === 'textarea') {
    return (
      <textarea
        id={id}
        className={`textarea${errorClass}`}
        value={props.value}
        rows={props.rows ?? 3}
        placeholder={props.placeholder}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onChange={(event) => props.onChange(event.target.value)}
      />
    );
  }

  if (props.kind === 'toggle') {
    return (
      <button
        id={id}
        type="button"
        className="toggle"
        role="switch"
        aria-checked={props.value}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => props.onChange(!props.value)}
      >
        <span className={`toggle__track${props.value ? ' toggle__track--on' : ''}`}>
          <span className="toggle__knob" />
        </span>
        <span className="toggle__label">{props.toggleLabel}</span>
      </button>
    );
  }

  return (
    <input
      id={id}
      type={props.kind ?? 'text'}
      className={`input${errorClass}${props.readOnly ? ' input--readonly' : ''}`}
      value={props.value}
      placeholder={props.placeholder}
      readOnly={props.readOnly}
      disabled={disabled}
      autoComplete={props.autoComplete}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      onChange={(event) => props.onChange(event.target.value)}
    />
  );
}
