type DialogActionIconName = "play" | "stop" | "refresh" | "text" | "dialog" | "next" | "collapse" | "send" | "speed-fast" | "speed-slow";

export default function DialogActionIcon({ name }: { name: DialogActionIconName }): JSX.Element {
  if (name === "speed-fast" || name === "speed-slow") {
    return (
      <svg className="item-action-icon dialog-speedometer-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 17a7 7 0 0 1 14 0" />
        <path d={name === "speed-fast" ? "m12 17 4-6" : "m12 17-4-4"} />
        <circle cx="12" cy="17" r="1" />
      </svg>
    );
  }

  const commonProps = {
    className: "item-action-icon",
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  if (name === "play") {
    return (
      <svg {...commonProps}>
        <path d="M8 6v12l10-6-10-6Z" />
      </svg>
    );
  }
  if (name === "stop") {
    return (
      <svg {...commonProps}>
        <rect x="7" y="7" width="10" height="10" rx="1.5" />
      </svg>
    );
  }
  if (name === "refresh") {
    return (
      <svg {...commonProps}>
        <path d="M20 12a8 8 0 0 1-13.7 5.7" />
        <path d="M4 12A8 8 0 0 1 17.7 6.3" />
        <path d="M17 3v4h4" />
        <path d="M7 21v-4H3" />
      </svg>
    );
  }
  if (name === "text") {
    return (
      <svg {...commonProps}>
        <path d="M4 6h16v12H4z" />
        <path d="M7 10h10" />
        <path d="M7 14h6" />
      </svg>
    );
  }
  if (name === "next") {
    return (
      <svg {...commonProps}>
        <path d="M8 6l6 6-6 6" />
        <path d="M14 6l6 6-6 6" />
      </svg>
    );
  }
  if (name === "collapse") {
    return (
      <svg {...commonProps}>
        <path d="m6 15 6-6 6 6" />
      </svg>
    );
  }
  if (name === "send") {
    return (
      <svg {...commonProps}>
        <path d="M21 3 3.7 10.2a1 1 0 0 0 .1 1.9l6.6 2.2 2.2 6.6a1 1 0 0 0 1.9.1L21 3Z" />
        <path d="m10.4 14.3 4.1-4.1" />
      </svg>
    );
  }
  return (
    <svg {...commonProps}>
      <path d="M4 5h11v8H8l-4 4V5Z" />
      <path d="M13 11h7v7l-3-3h-4" />
    </svg>
  );
}
