import type { ButtonHTMLAttributes, ReactNode } from "react";

import { useI18n } from "../i18n";

interface DangerousButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  children: ReactNode;
  onConfirm: () => void | Promise<void>;
  skipConfirmation?: boolean;
}

export default function DangerousButton({
  children,
  className = "",
  disabled = false,
  onConfirm,
  skipConfirmation = false,
  type = "button",
  ...props
}: DangerousButtonProps): JSX.Element {
  const { t } = useI18n();

  const handleClick = (): void => {
    if (!skipConfirmation && typeof window !== "undefined" && !window.confirm(t("common.confirmDangerousAction"))) {
      return;
    }
    void onConfirm();
  };

  return (
    <button
      {...props}
      type={type}
      className={className}
      disabled={disabled}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}
