"use client"
import { useState, useEffect } from "react";
import { Bell, Check, Trash2, AlertTriangle, Package } from "lucide-react";
import api from "../../lib/api";

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const response = await api.getNotifications();
            if (response.success && response.data) {
                setNotifications(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsRead = async (id) => {
        try {
            await api.markNotificationAsRead(id);
            fetchNotifications();
        } catch (error) {
            console.error("Failed to mark as read:", error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await api.markAllNotificationsAsRead();
            fetchNotifications();
        } catch (error) {
            console.error("Failed to mark all as read:", error);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.deleteNotification(id);
            fetchNotifications();
        } catch (error) {
            console.error("Failed to delete notification:", error);
        }
    };

    const filteredNotifications = notifications.filter(notif => {
        if (filter === "unread") return !notif.isRead;
        if (filter === "read") return notif.isRead;
        return true;
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <div className="glass-panel px-10 py-8 text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
                    <p className="text-sm text-slate-300">Loading notifications…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
                    <p className="text-sm text-slate-500 mt-1">{unreadCount} unread notifications</p>
                </div>
                {unreadCount > 0 && (
                    <button onClick={handleMarkAllAsRead} className="btn-ghost text-xs">
                        <Check className="mr-1" size={14} />
                        Mark all as read
                    </button>
                )}
            </div>

            {/* Filter */}
            <div className="glass-panel px-5 py-3">
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter("all")}
                        className={`px-3 py-1 rounded text-xs ${filter === "all" ? "bg-sky-100 text-sky-700" : "text-slate-600 hover:bg-slate-100"
                            }`}
                    >
                        All ({notifications.length})
                    </button>
                    <button
                        onClick={() => setFilter("unread")}
                        className={`px-3 py-1 rounded text-xs ${filter === "unread" ? "bg-sky-100 text-sky-700" : "text-slate-600 hover:bg-slate-100"
                            }`}
                    >
                        Unread ({unreadCount})
                    </button>
                    <button
                        onClick={() => setFilter("read")}
                        className={`px-3 py-1 rounded text-xs ${filter === "read" ? "bg-sky-100 text-sky-700" : "text-slate-600 hover:bg-slate-100"
                            }`}
                    >
                        Read ({notifications.length - unreadCount})
                    </button>
                </div>
            </div>

            {/* Notifications List */}
            <div className="space-y-2">
                {filteredNotifications.length > 0 ? (
                    filteredNotifications.map((notif) => (
                        <div
                            key={notif.id}
                            className={`glass-panel p-4 ${!notif.isRead ? "border-l-4 border-sky-500" : ""}`}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`p-2 rounded-lg ${notif.type === "low_stock" ? "bg-amber-100" :
                                        notif.type === "reconciliation" ? "bg-sky-100" :
                                            "bg-slate-100"
                                    }`}>
                                    {notif.type === "low_stock" ? (
                                        <AlertTriangle className="text-amber-600" size={20} />
                                    ) : notif.type === "reconciliation" ? (
                                        <Bell className="text-sky-600" size={20} />
                                    ) : (
                                        <Package className="text-slate-600" size={20} />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold text-slate-900">{notif.title}</h3>
                                            <p className="text-sm text-slate-600 mt-1">{notif.message}</p>
                                            <p className="text-xs text-slate-400 mt-2">
                                                {new Date(notif.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!notif.isRead && (
                                                <button
                                                    onClick={() => handleMarkAsRead(notif.id)}
                                                    className="text-sky-600 hover:text-sky-700"
                                                    title="Mark as read"
                                                >
                                                    <Check size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(notif.id)}
                                                className="text-rose-600 hover:text-rose-700"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="glass-panel p-10 text-center">
                        <Bell className="mx-auto mb-3 text-slate-300" size={48} />
                        <p className="text-slate-500">No notifications</p>
                    </div>
                )}
            </div>
        </div>
    );
}
