import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { loginSchema } from "@shared";
import { ApiError } from "../../api/client";
import { authApi } from "../../api/auth";
import { useAuth } from "../../hooks/useAuth";
import { landingPathFor } from "../../navigation";

/** S1 — the only public screen. */
export function LoginPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Sign in · SmartStock";
  }, []);

  // Someone who is already signed in has no business on the login screen.
  if (!isLoading && user)
    return <Navigate to={landingPathFor(user.role)} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const { user: signedIn, redirect_to } = await authApi.login(parsed.data);
      // Seed the cache so the shell renders without a second round trip.
      queryClient.setQueryData(["auth", "me"], signedIn);
      navigate(redirect_to, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.fields)
        setFieldErrors(error.fields);
      // A failed sign-in always gets the same message, whatever went wrong.
      setFormError(
        error instanceof ApiError && error.status === 401
          ? "Invalid email or password."
          : error instanceof ApiError
            ? error.message
            : "Something went wrong. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <aside className="login__hero">
        <div className="login__brand">
          <span className="login__logo" aria-hidden="true">
            S
          </span>
          <span className="login__wordmark">SmartStock</span>
        </div>

        <div className="login__pitch">
          <h1 className="login__headline">
            Stock ordering and inventory management, one ledger deep.
          </h1>
          <p className="login__lede">
            Every balance change is backed by a movement record. Orders move
            draft → approved → shipped → received, with the right person on each
            step.
          </p>
          <div className="login__stats">
            {/* <Stat value="4" label="Roles" />
            <Stat value="7" label="Requirements" />
            <Stat value="22" label="Screens" /> */}
          </div>
        </div>

        <span className="login__footnote">
          {/* ICT302 Software Development Project 1 · Assessment 3 */}
        </span>
      </aside>

      <div className="login__panel">
        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <div className="login__intro">
            <h2 className="login__title">Sign in</h2>
            <p className="page-subtitle">Use your SmartStock account.</p>
          </div>

          {formError && (
            <div className="login__error" role="alert">
              {formError}
            </div>
          )}

          <div className="login__fields">
            <div className="field">
              <label className="field__label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                className={`input${fieldErrors.email ? " input--error" : ""}`}
                value={email}
                autoComplete="username"
                placeholder="you@smartstock.io"
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFormError(null);
                }}
              />
              {fieldErrors.email && (
                <span className="field__error">{fieldErrors.email}</span>
              )}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="login-password">
                Password
              </label>
              <div className="login__password">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  className={`input${fieldErrors.password ? " input--error" : ""}`}
                  value={password}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setFormError(null);
                  }}
                />
                <button
                  type="button"
                  className="login__reveal"
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {fieldErrors.password && (
                <span className="field__error">{fieldErrors.password}</span>
              )}
            </div>

            <button
              type="submit"
              className="btn btn--primary login__submit"
              disabled={submitting}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </div>

          {import.meta.env.DEV && (
            <DemoAccounts
              onPick={(demoEmail) => {
                setEmail(demoEmail);
                setPassword("demo1234");
                setFormError(null);
                setFieldErrors({});
              }}
            />
          )}
        </form>
      </div>
    </div>
  );
}

const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@smartstock.io" },
  { label: "Staff", email: "staff@smartstock.io" },
  { label: "Manager", email: "manager@smartstock.io" },
  { label: "Supplier", email: "dana@harbourline.com.au" },
];

/** Development convenience only — stripped from a production build. */
function DemoAccounts({ onPick }: { onPick: (email: string) => void }) {
  return (
    <div className="login__demo">
      <span className="login__demo-title">
        Demo accounts · password demo1234
      </span>
      <div className="login__demo-chips">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            className="login__chip"
            onClick={() => onPick(account.email)}
          >
            {account.label}
          </button>
        ))}
      </div>
    </div>
  );
}
