"use client";

import { useState, useEffect } from "react";
import { Warehouse, Plus, Check, X } from "lucide-react";
import api from "@/lib/api";

export default function WarehouseSelect({ value, onChange, onNameChange }) {
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newWarehouseName, setNewWarehouseName] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchWarehouses();
    }, []);

    const fetchWarehouses = async () => {
        try {
            setLoading(true);
            const response = await api.getWarehouses({ isActive: true });
            if (response.success) {
                const data = response.data.warehouses || response.data;
                setWarehouses(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Failed to fetch warehouses:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newWarehouseName.trim()) return;

        try {
            setCreating(true);
            setError(null);
            const response = await api.createWarehouse({ name: newWarehouseName });
            if (response.success) {
                const newWarehouse = response.data;
                setWarehouses((prev) => [...prev, newWarehouse]);
                // Select the newly created warehouse
                onChange(newWarehouse.id);
                if (onNameChange) onNameChange(newWarehouse.name);

                setIsCreating(false);
                setNewWarehouseName("");
            }
        } catch (error) {
            console.error("Failed to create warehouse:", error);
            setError("Failed to create. Name might likely exist.");
        } finally {
            setCreating(false);
        }
    };

    const handleSelectChange = (e) => {
        const id = e.target.value;
        onChange(id);

        // Find name and bubble it up if needed
        const selected = warehouses.find(w => w.id === id);
        if (selected && onNameChange) {
            onNameChange(selected.name);
        }
    };

    return (
        <div className="glass-panel p-5 bg-slate-50">
            <h3 className="mb-3 text-xs font-semibold text-slate-700 flex items-center gap-2">
                <Warehouse size={14} className="text-purple-600" />
                Warehouse Location
            </h3>

            {isCreating ? (
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={newWarehouseName}
                            onChange={(e) => {
                                setNewWarehouseName(e.target.value);
                                setError(null);
                            }}
                            placeholder="Warehouse Name (e.g., Main Store)"
                            className={`input-field w-full text-sm ${error ? 'border-red-300 focus:ring-red-200' : ''}`}
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreate())}
                        />
                        {error && <p className="absolute -bottom-5 left-0 text-[10px] text-red-500">{error}</p>}
                    </div>
                    <button
                        onClick={handleCreate}
                        disabled={creating || !newWarehouseName.trim()}
                        className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        type="button"
                    >
                        {creating ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Check size={16} />
                        )}
                    </button>
                    <button
                        onClick={() => setIsCreating(false)}
                        className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                        type="button"
                    >
                        <X size={16} />
                    </button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <select
                            value={value || ""}
                            onChange={handleSelectChange}
                            className="input-field w-full appearance-none pr-8 text-sm"
                            disabled={loading}
                        >
                            <option value="">-- Select Warehouse --</option>
                            {warehouses.map((w) => (
                                <option key={w.id} value={w.id}>
                                    {w.name}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors flex items-center gap-1 font-medium text-xs whitespace-nowrap"
                        type="button"
                    >
                        <Plus size={14} />
                        New
                    </button>
                </div>
            )}

            {loading && <p className="text-xs text-slate-400 mt-1">Loading warehouses...</p>}
        </div>
    );
}
