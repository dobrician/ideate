import { useState, useCallback, FormEvent } from "react";
import { getSafeRedirect } from "@/app/auth/login/page";

type AuthMode = "magic-link" | "password";

interface TranslateFn {
  (key: string, vars?: Record<string, string | number>): string;
}

export function useLoginForm(t: TranslateFn, redirect: string | null) {
  const [mode, setMode] = useState<AuthMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateEmail = useCallback(
    (v: string) => {
      if (!v.trim()) return t("auth.emailRequired");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return t("auth.emailInvalid");
      return undefined;
    },
    [t]
  );

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "email") {
      setFieldErrors((prev) => ({ ...prev, email: validateEmail(email) }));
    } else if (field === "password") {
      setFieldErrors((prev) => ({
        ...prev,
        password: !password ? t("auth.passwordRequired") : undefined,
      }));
    }
  }

  async function handleMagicLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const emailErr = validateEmail(email);
    setFieldErrors({ email: emailErr });
    setTouched({ email: true });
    if (emailErr) return;

    setIsLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || t("common.errorOccurred"));
        return;
      }
      setSuccess(true);
      setEmail("");
    } catch {
      setError(t("common.errorOccurred"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const emailErr = validateEmail(email);
    const passwordErr = !password ? t("auth.passwordRequired") : undefined;
    setFieldErrors({ email: emailErr, password: passwordErr });
    setTouched({ email: true, password: true });
    if (emailErr || passwordErr) return;

    setIsLoading(true);
    setError("");
    setNeedsVerification(false);
    setResendSuccess(false);

    try {
      const response = await fetch("/api/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "EMAIL_NOT_VERIFIED") {
          setNeedsVerification(true);
          setError(t("auth.verifyEmailFirst"));
        } else if (response.status === 401) {
          setError(t("auth.invalidCredentials"));
        } else if (response.status === 429) {
          setError(t("auth.tooManyAttempts"));
        } else {
          setError(data.error || t("common.errorOccurred"));
        }
        return;
      }
      window.location.href = getSafeRedirect(redirect);
    } catch {
      setError(t("common.errorOccurred"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendVerification() {
    setResendLoading(true);
    setResendSuccess(false);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (response.ok) setResendSuccess(true);
    } catch {
      // silent
    } finally {
      setResendLoading(false);
    }
  }

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setError("");
  }

  return {
    mode, email, password, isLoading, error, success, needsVerification,
    resendLoading, resendSuccess, fieldErrors, touched,
    setEmail, setPassword, setError, setSuccess,
    handleBlur, handleMagicLink, handlePasswordLogin,
    handleResendVerification, switchMode,
  };
}
