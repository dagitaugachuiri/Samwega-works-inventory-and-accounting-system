"use client";

import { ArrowUp, ArrowDown, ExternalLink } from "lucide-react";

export default function KPICard({
    title,
    value,
    change,
    icon: Icon,
    color = "sky"
}) {
    const isPositive = change > 0;
    const isNeutral = change === 0 || change === undefined;

    const colors = {
        sky: "bg-sky-50 text-sky-600 border-sky-100",
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        amber: "bg-amber-50 text-amber-600 border-amber-100",
        rose: "bg-rose-50 text-rose-600 border-rose-100",
        violet: "bg-violet-50 text-violet-600 border-violet-100",
    };

    const theme = colors[color] || colors.sky;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-slate-300 transition-colors">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>

                    {change !== undefined && (
                        <div className={`flex items-center mt-2 text-xs font-medium ${isPositive ? "text-emerald-600" : isNeutral ? "text-slate-500" : "text-rose-600"
                            }`}>
                            {isPositive ? <ArrowUp size={12} className="mr-1" /> : isNeutral ? null : <ArrowDown size={12} className="mr-1" />}
                            {Math.abs(change)}% {isNeutral ? "" : "vs last period"}
                        </div>
                    )}
                </div>

                {Icon && (
                    <div className={`p-3 rounded-lg ${theme}`}>
                        <Icon size={20} />
                    </div>
                )}
            </div>
        </div>
    );
}
