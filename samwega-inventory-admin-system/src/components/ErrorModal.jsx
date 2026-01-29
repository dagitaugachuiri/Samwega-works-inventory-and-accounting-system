"use client";
import { AlertCircle, X, AlertTriangle, Info, HelpCircle } from "lucide-react";

/**
 * ErrorModal - Displays messages in a styled modal
 * Warning type uses soft, friendly colors
 */
export default function ErrorModal({
    isOpen,
    onClose,
    title = "Notice",
    message,
    type = "warning",
    details = []
}) {
    if (!isOpen) return null;

    const config = {
        error: {
            icon: AlertCircle,
            bgColor: "bg-red-50",
            iconBg: "bg-red-100",
            iconColor: "text-red-500",
            borderColor: "border-red-200",
            titleColor: "text-red-800",
            textColor: "text-red-700",
            buttonBg: "bg-red-600 hover:bg-red-700",
        },
        warning: {
            icon: HelpCircle,
            bgColor: "bg-amber-50/80",
            iconBg: "bg-amber-100",
            iconColor: "text-amber-600",
            borderColor: "border-amber-200",
            titleColor: "text-amber-900",
            textColor: "text-amber-800",
            buttonBg: "bg-amber-500 hover:bg-amber-600",
        },
        info: {
            icon: Info,
            bgColor: "bg-blue-50",
            iconBg: "bg-blue-100",
            iconColor: "text-blue-500",
            borderColor: "border-blue-200",
            titleColor: "text-blue-800",
            textColor: "text-blue-700",
            buttonBg: "bg-blue-600 hover:bg-blue-700",
        },
    };

    const { icon: Icon, bgColor, iconBg, iconColor, borderColor, titleColor, textColor, buttonBg } = config[type] || config.warning;

    // Format message to be more user-friendly for invoice validation
    const formatMessage = (msg) => {
        // Parse invoice validation message
        const invoiceMatch = msg.match(/Adding this item \((\d+)\) would exceed invoice total\. Current items total: (\d+), Invoice total: (\d+)/);
        if (invoiceMatch) {
            const [, itemCost, currentTotal, invoiceTotal] = invoiceMatch;
            return {
                main: "The item cost exceeds your invoice amount",
                bullets: [
                    `Item cost: KES ${Number(itemCost).toLocaleString()}`,
                    `Invoice total: KES ${Number(invoiceTotal).toLocaleString()}`,
                    `Available: KES ${(Number(invoiceTotal) - Number(currentTotal)).toLocaleString()}`
                ],
                tip: "Update the invoice amount or reduce the item cost to continue."
            };
        }
        return { main: msg, bullets: [], tip: null };
    };

    const formattedMessage = formatMessage(message);

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className={`${bgColor} px-6 py-5 flex items-start justify-between`}>
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full ${iconBg}`}>
                            <Icon size={24} className={iconColor} />
                        </div>
                        <div>
                            <h2 className={`text-lg font-semibold ${titleColor}`}>{title}</h2>
                            <p className={`text-sm ${textColor} mt-1 opacity-80`}>Please review the details below</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-white/50 transition-colors mt-1"
                    >
                        <X size={18} className="text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                    <p className="text-slate-700 text-sm leading-relaxed font-medium">{formattedMessage.main}</p>

                    {/* Formatted bullets */}
                    {formattedMessage.bullets.length > 0 && (
                        <ul className="mt-4 space-y-2">
                            {formattedMessage.bullets.map((bullet, idx) => (
                                <li key={idx} className="text-sm text-slate-600 flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
                                    <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                    {bullet}
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* Tip */}
                    {formattedMessage.tip && (
                        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-2">
                            <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-blue-700">{formattedMessage.tip}</p>
                        </div>
                    )}

                    {/* Additional details list */}
                    {details && details.length > 0 && (
                        <div className={`mt-4 ${bgColor} rounded-lg p-3 border ${borderColor}`}>
                            <p className={`text-xs font-medium ${titleColor} mb-2`}>Additional details:</p>
                            <ul className="space-y-1">
                                {details.map((detail, idx) => (
                                    <li key={idx} className={`text-sm ${textColor} flex items-start gap-2`}>
                                        <span className="text-xs mt-0.5">•</span>
                                        <span>
                                            {detail.field && <strong className="font-medium">{detail.field}:</strong>} {detail.message}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className={`px-6 py-2.5 rounded-lg text-white font-medium text-sm ${buttonBg} transition-colors shadow-sm`}
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
}
