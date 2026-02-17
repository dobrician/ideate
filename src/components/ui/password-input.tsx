"use client";

import { useState, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useLocale } from "@/lib/use-locale";

type PasswordInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type"
>;

/**
 * Password input with visibility toggle button.
 * Wraps shadcn Input with an eye/eye-off icon button.
 */
const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (props, ref) => {
    const [visible, setVisible] = useState(false);
    const { t } = useLocale();

    return (
      <div className="relative">
        <Input {...props} ref={ref} type={visible ? "text" : "password"} className={`pr-11 ${props.className || ""}`} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full w-11 text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
