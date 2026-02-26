"use client"
import { useState, useEffect } from "react";
import { User, Lock, Save, Key, AlertCircle, CheckCircle } from "lucide-react";
import api from "@/lib/api";

export default function SettingsPage() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    const [profileData, setProfileData] = useState({
        username: "",
        fullName: ""
    });

    const [passwordData, setPasswordData] = useState({
        newPassword: "",
        confirmPassword: ""
    });

    useEffect(() => {
        fetchCurrentUser();
    }, []);

    const fetchCurrentUser = async () => {
        try {
            setLoading(true);
            const response = await api.getCurrentUser();
            if (response.success && response.data) {
                setUser(response.data);
                setProfileData({
                    username: response.data.username || "",
                    fullName: response.data.fullName || ""
                });
            }
        } catch (error) {
            console.error("Failed to fetch user:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        try {
            setUpdating(true);
            setMessage({ type: "", text: "" });
            const response = await api.updateProfile(profileData);
            if (response.success) {
                setMessage({ type: "success", text: "Profile updated successfully" });
                setUser(response.data);
            }
        } catch (error) {
            setMessage({ type: "error", text: error.message || "Failed to update profile" });
        } finally {
            setUpdating(false);
        }
    };

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: "error", text: "Passwords do not match" });
            return;
        }
        if (passwordData.newPassword.length < 6) {
            setMessage({ type: "error", text: "Password must be at least 6 characters" });
            return;
        }

        try {
            setUpdating(true);
            setMessage({ type: "", text: "" });
            const response = await api.updateProfile({ password: passwordData.newPassword });
            if (response.success) {
                setMessage({ type: "success", text: "Password updated successfully" });
                setPasswordData({ newPassword: "", confirmPassword: "" });
            }
        } catch (error) {
            setMessage({ type: "error", text: error.message || "Failed to update password" });
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center p-12">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                    <p className="text-sm text-slate-500">Loading your settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="flex flex-col gap-1 mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
                <p className="text-sm text-slate-500">Manage your account and profile information.</p>
            </div>

            {message.text && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 border ${message.type === 'success'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-rose-50 border-rose-100 text-rose-700'
                    }`}>
                    {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <p className="text-sm font-medium">{message.text}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Profile Card */}
                <div className="md:col-span-1">
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm sticky top-8">
                        <div className="flex flex-col items-center text-center">
                            <div className="h-20 w-20 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mb-4">
                                <User size={40} />
                            </div>
                            <h3 className="font-bold text-slate-900">{user?.fullName || user?.username}</h3>
                            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">{user?.role?.replace('_', ' ')}</p>
                            <div className="mt-4 pt-4 border-t border-slate-100 w-full">
                                <p className="text-xs text-slate-500">Email Address</p>
                                <p className="text-sm text-slate-900 font-medium">{user?.email}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Forms */}
                <div className="md:col-span-2 flex flex-col gap-6">
                    {/* Profile Section */}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                            <User size={16} className="text-slate-500" />
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Edit Profile</h2>
                        </div>
                        <form onSubmit={handleProfileUpdate} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Username</label>
                                    <input
                                        type="text"
                                        value={profileData.username}
                                        onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                                    <input
                                        type="text"
                                        value={profileData.fullName}
                                        onChange={(e) => setProfileData(prev => ({ ...prev, fullName: e.target.value }))}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="pt-2 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={updating}
                                    className="px-6 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {updating ? <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" /> : <Save size={14} />}
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Password Section */}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                            <Key size={16} className="text-slate-500" />
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Change Password</h2>
                        </div>
                        <form onSubmit={handlePasswordUpdate} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">New Password</label>
                                    <input
                                        type="password"
                                        placeholder="Min. 6 characters"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Confirm Password</label>
                                    <input
                                        type="password"
                                        placeholder="Repeat new password"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="pt-2 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={updating}
                                    className="px-6 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {updating ? <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" /> : <Lock size={14} />}
                                    Update Password
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
