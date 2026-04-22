import { ReactNode } from "react";

interface SectionProps {
  background: string;
  children?: ReactNode;
}

export default function Section({ background, children }: SectionProps) {
  return <div className={`${background} relative`}>{children}</div>;
}
