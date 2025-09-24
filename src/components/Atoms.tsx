import React from "react";

export function Card({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 ${className}`}
        >
            {children}
        </div>
    );
}

export function CardHeader({
    title,
    subtitle,
    icon,
}: {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                {icon}
            </div>
            <div>
                <div className="font-semibold">{title}</div>
                {subtitle && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        {subtitle}
                    </div>
                )}
            </div>
        </div>
    );
}
