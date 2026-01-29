"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from "lucide-react";

let alertIdCounter = 0;

// Alert types: success, error, warning, info
export function useAlert() {
    const [alerts, setAlerts] = useState([]);

    const showAlert = (message, type = "info", duration = 4000) => {
        const id = alertIdCounter++;
        const alert = { id, message, type, duration };

        setAlerts(prev => [...prev, alert]);

        if (duration > 0) {
            setTimeout(() => {
                setAlerts(prev => prev.filter(a => a.id !== id));
            }, duration);
        }

        return id;
    };

    const hideAlert = (id) => {
        setAlerts(prev => prev.filter(a => a.id !== id));
    };

    const success = (message, duration) => showAlert(message, "success", duration);
    const error = (message, duration) => showAlert(message, "error", duration);
    const warning = (message, duration) => showAlert(message, "warning", duration);
    const info = (message, duration) => showAlert(message, "info", duration);

    return { alerts, success, error, warning, info, hideAlert };
}

export default function AlertContainer({ alerts, onClose }) {
    if (!alerts || alerts.length === 0) return null;

    const getIcon = (type) => {
        switch (type) {
            case "success":
                return <CheckCircle className="w-5 h-5" />;
            case "error":
                return <AlertCircle className="w-5 h-5" />;
            case "warning":
                return <AlertTriangle className="w-5 h-5" />;
            default:
                return <Info className="w-5 h-5" />;
        }
    };

    const getColors = (type) => {
        switch (type) {
            case "success":
                return "bg-green-50 border-green-200 text-green-800";
            case "error":
                return "bg-red-50 border-red-200 text-red-800";
            case "warning":
                return "bg-amber-50 border-amber-200 text-amber-800";
            default:
                return "bg-blue-50 border-blue-200 text-blue-800";
        }
    };

    return (
        <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-md">
            {alerts.map((alert) => (
                <div
                    key={alert.id}
                    className={`${getColors(alert.type)} border rounded-lg px-4 py-3 shadow-lg flex items-start gap-3 animate-slide-in-right`}
                >
                    <div className="flex-shrink-0 mt-0.5">{getIcon(alert.type)}</div>
                    <p className="flex-1 text-sm font-medium">{alert.message}</p>
                    <button
                        onClick={() => onClose(alert.id)}
                        className="flex-shrink-0 hover:opacity-70 transition-opacity"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
