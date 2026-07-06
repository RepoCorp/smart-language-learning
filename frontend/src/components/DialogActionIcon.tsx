type DialogActionIconName = "play" | "stop" | "refresh" | "text" | "dialog" | "next";

export default function DialogActionIcon({ name }: { name: DialogActionIconName }): JSX.Element {
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
  return (
    <svg {...commonProps}>
      <path d="M4 5h11v8H8l-4 4V5Z" />
      <path d="M13 11h7v7l-3-3h-4" />
    </svg>
  );
}
