import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PanelProps {
    /** Small uppercase label rendered above the title. */
    eyebrow?: string;
    /** Panel heading. */
    title: string;
    /** Optional supporting copy shown under the title. */
    description?: string;
    /** Optional element pinned to the top-right of the panel header. */
    action?: ReactNode;
    className?: string;
    children: ReactNode;
}

/**
 * Surface used by every dashboard tile — a card with a thin accent rule,
 * an editorial header block, and a content well.
 */
export function Panel({ eyebrow, title, description, action, className, children }: PanelProps) {
    return (
        <section
            className={cn(
                "flex flex-col gap-400 rounded-2xl border border-border bg-card p-500 shadow-[0_1px_2px_rgba(16,18,43,0.04),0_12px_32px_-24px_rgba(16,18,43,0.45)]",
                className,
            )}
        >
            <header className="flex items-start justify-between gap-400">
                <div className="flex flex-col gap-100">
                    {eyebrow ? (
                        <span className="font-base text-[length:var(--text-100)] font-semibold uppercase tracking-[0.14em] text-primary">
                            {eyebrow}
                        </span>
                    ) : null}
                    <h2 className="font-heading text-[length:var(--text-400)] font-semibold leading-400 text-card-foreground">
                        {title}
                    </h2>
                    {description ? (
                        <p className="text-[length:var(--text-200)] leading-200 text-muted-foreground">
                            {description}
                        </p>
                    ) : null}
                </div>
                {action}
            </header>
            <div className="flex-1">{children}</div>
        </section>
    );
}

/** Skeleton placeholder matching the shape of a chart. */
export function PanelSkeleton({ height }: { height: number }) {
    return (
        <div
            className="flex w-full animate-pulse flex-col justify-end gap-200 rounded-xl bg-muted p-400"
            style={{ height }}
            aria-hidden="true"
        >
            <div className="h-[18%] w-[92%] rounded-md bg-accent" />
            <div className="h-[18%] w-[74%] rounded-md bg-accent" />
            <div className="h-[18%] w-[58%] rounded-md bg-accent" />
            <div className="h-[18%] w-[36%] rounded-md bg-accent" />
        </div>
    );
}

/** Destructive banner used when a query fails. */
export function PanelError({ message }: { message: string }) {
    return (
        <div
            role="alert"
            className="rounded-xl border border-destructive bg-destructive/10 p-400 text-[length:var(--text-200)] leading-300 text-destructive"
        >
            {message}
        </div>
    );
}

/** Centered muted message used when a query succeeds but returns nothing. */
export function PanelEmpty({ height }: { height: number }) {
    return (
        <div
            className="flex w-full items-center justify-center rounded-xl border border-dashed border-border text-[length:var(--text-200)] text-muted-foreground"
            style={{ height }}
        >
            No profit recorded for this selection.
        </div>
    );
}
