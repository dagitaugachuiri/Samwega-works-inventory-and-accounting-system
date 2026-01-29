"use client"
import { useState, useEffect } from "react";
import { User, Lock } from "lucide-react";
import api from "../../lib/api";

export default function SettingsPage() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCurrentUser();
    }, []);

    const fetchCurrentUser = async () => {
        try {
            setLoading(true);
            const response = await api.getCurrentUser();
            if (response.success && response.data) {
                setUser(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch user:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <div className="glass-panel px-10 py-8 text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
                    <p className="text-sm text-slate-300">Loading…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>

            <div className="glass-panel p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Profile</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                        <input type="text" defaultValue={user?.fullName} className="input-field w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                        <input type="email" defaultValue={user?.email} className="input-field w-full" />
                    </div>
                    <button className="btn-primary">Save</button>
                </div>
            </div>
        </div>
    );
}
