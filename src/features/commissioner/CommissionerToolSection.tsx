import type { ReactNode } from "react";
export default function CommissionerToolSection({ title, children }: { title: string; children: ReactNode }) {
  return <details className="commissioner-tool"><summary>{title}</summary><div className="commissioner-tool__content">{children}</div></details>;
}
