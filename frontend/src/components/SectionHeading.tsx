import type { ReactNode } from "react";

interface Props {
  title: string;
  color: string;
  action?: ReactNode;
}

export function SectionHeading({ title, color, action }: Props) {
  return (
    <div className="section-heading">
      <span className="section-dot" style={{ background: color }} />
      <span className="section-title">{title}</span>
      <span className="section-rule" />
      {action}
    </div>
  );
}
