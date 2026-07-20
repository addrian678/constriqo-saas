import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  fullWidth?: boolean;
  large?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = "primary",
  fullWidth,
  large,
  icon,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const classes = [
    "button",
    `button-${variant}`,
    fullWidth ? "button-full" : "",
    large ? "button-large" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} {...props}>
      {icon}
      {children}
    </button>
  );
}
