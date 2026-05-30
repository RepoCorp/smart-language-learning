import { useEffect, useRef, useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";

const DANGEROUS_BUTTON_ARMED_EVENT = "dangerous-button-armed";

interface DangerousButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  children: ReactNode;
  onConfirm: () => void | Promise<void>;
}

export default function DangerousButton({
  children,
  className = "",
  disabled = false,
  onConfirm,
  type = "button",
  ...props
}: DangerousButtonProps): JSX.Element {
  const [armed, setArmed] = useState<boolean>(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (disabled) {
      setArmed(false);
    }
  }, [disabled]);

  useEffect(() => {
    if (!armed) {
      return;
    }

    const disarm = (): void => setArmed(false);
    const handlePointerDown = (event: PointerEvent): void => {
      if (buttonRef.current?.contains(event.target as Node)) {
        return;
      }
      disarm();
    };
    const handleFocusIn = (event: FocusEvent): void => {
      if (buttonRef.current?.contains(event.target as Node)) {
        return;
      }
      disarm();
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        disarm();
      }
    };
    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        disarm();
      }
    };
    const handleAnotherButtonArmed = (event: Event): void => {
      if (event.target === buttonRef.current) {
        return;
      }
      disarm();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener(DANGEROUS_BUTTON_ARMED_EVENT, handleAnotherButtonArmed);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener(DANGEROUS_BUTTON_ARMED_EVENT, handleAnotherButtonArmed);
    };
  }, [armed]);

  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (!armed) {
      event.preventDefault();
      setArmed(true);
      buttonRef.current?.dispatchEvent(new CustomEvent(DANGEROUS_BUTTON_ARMED_EVENT, { bubbles: true }));
      return;
    }
    setArmed(false);
    void onConfirm();
  };

  return (
    <button
      {...props}
      ref={buttonRef}
      type={type}
      className={`${className} ${armed ? "dangerous-button-armed" : ""}`.trim()}
      disabled={disabled}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}
