"use client";

import { X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useEffect } from "react";

export default function CustomModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = "confirm", // "confirm", "success", "error", "loading"
    confirmText = "Confirm",
    cancelText = "Cancel",
    loading = false
}) {
    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === "Escape" && isOpen && !loading) {
                onClose();
            }
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose, loading]);

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case "success":
                return <CheckCircle className="text-emerald-500" size={48} />;
            case "error":
                return <AlertCircle className="text-rose-500" size={48} />;
            case "loading":
                return <Loader2 className="text-sky-500 animate-spin" size={48} />;
            default:
                return <AlertCircle className="text-amber-500" size={48} />;
        }
    };

    const getColors = () => {
        switch (type) {
            case "success":
                return {
                    bg: "bg-emerald-50",
                    border: "border-emerald-200",
                    button: "bg-emerald-600 hover:bg-emerald-700"
                };
            case "error":
                return {
                    bg: "bg-rose-50",
                    border: "border-rose-200",
                    button: "bg-rose-600 hover:bg-rose-700"
                };
            case "loading":
                return {
                    bg: "bg-sky-50",
                    border: "border-sky-200",
                    button: "bg-sky-600 hover:bg-sky-700"
                };
            default:
                return {
                    bg: "bg-amber-50",
                    border: "border-amber-200",
                    button: "bg-amber-600 hover:bg-amber-700"
                };
        }
    };

    const colors = getColors();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={!loading ? onClose : undefined}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
                {/* Close button */}
                {!loading && type !== "loading" && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <X size={20} className="text-slate-400" />
                    </button>
                )}

                {/* Content */}
                <div className="p-6">
                    {/* Icon */}
                    <div className={`mx-auto w-16 h-16 rounded-full ${colors.bg} ${colors.border} border-2 flex items-center justify-center mb-4`}>
                        {getIcon()}
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-bold text-slate-900 text-center mb-2">
                        {title}
                    </h3>

                    {/* Message */}
                    <p className="text-sm text-slate-600 text-center mb-6">
                        {message}
                    </p>

                    {/* Actions */}
                    {type === "confirm" && !loading && (
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
                                disabled={loading}
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={onConfirm}
                                className={`flex-1 px-4 py-2.5 ${colors.button} text-white font-semibold rounded-lg transition-colors shadow-sm`}
                                disabled={loading}
                            >
                                {confirmText}
                            </button>
                        </div>
                    )}

                    {type === "loading" && (
                        <div className="text-center">
                            <div className="inline-flex items-center gap-2 text-sm text-slate-600">
                                <Loader2 className="animate-spin" size={16} />
                                <span>Processing...</span>
                            </div>
                        </div>
                    )}

                    {(type === "success" || type === "error") && (
                        <button
                            onClick={onClose}
                            className={`w-full px-4 py-2.5 ${colors.button} text-white font-semibold rounded-lg transition-colors shadow-sm`}
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
