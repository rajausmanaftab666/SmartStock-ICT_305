import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Toast, type ToastTone } from "../components/Toast";

interface ToastState {
  message: string;
  tone: ToastTone;
  /** Changes on every call so repeating the same message replays the animation. */
  key: number;
}

interface ToastContextValue {
  /**
   * Tone is a required argument, never defaulted: a rule violation must never
   * be dressed up as a success.
   */
  showToast: (message: string, tone: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 3600;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const showToast = useCallback((message: string, tone: ToastTone) => {
    counter.current += 1;
    setToast({ message, tone, key: counter.current });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), VISIBLE_MS);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (message: string) => showToast(message, "success"),
      error: (message: string) => showToast(message, "error"),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Toast key={toast.key} message={toast.message} tone={toast.tone} />
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside a ToastProvider");
  return context;
}
