import type { ReactNode } from "react";

export function Panel({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <section className="panel">
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}
