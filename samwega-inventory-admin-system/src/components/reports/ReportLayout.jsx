"use client";

import { useState } from "react";
import { Download, RefreshCw, Filter } from "lucide-react";

export default function ReportLayout({
    title,
    description,
    filters = null,
    actions = null,
    kpiCards = null,
    chartSection = null,
    loading = false,
    onRefresh = null,
    children
}) {
    return (
        <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 md:p-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
                    {description && (
                        <p className="text-sm text-slate-500 mt-1 max-w-2xl">{description}</p>
                    )}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            disabled={loading}
                            className="p-2.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all border border-transparent hover:border-sky-100"
                            title="Refresh Data"
                        >
                            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                        </button>
                    )}
                    {actions}
                </div>
            </div>

            {/* Filters Bar */}
            {filters && (
                <div className="glass-panel p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                        <Filter size={16} />
                        <span>Filters:</span>
                    </div>
                    <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
                        {filters}
                    </div>
                </div>
            )}

            {/* Loading State Overlay */}
            {loading && !children && (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 animate-pulse">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin mb-4" />
                    <p>Loading report data...</p>
                </div>
            )}

            {/* KPI Cards Grid */}
            {kpiCards && !loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {kpiCards}
                </div>
            )}

            {/* Charts Section */}
            {chartSection && !loading && (
                <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                        {chartSection}
                    </div>
                </div>
            )}

            {/* Main Content (Usually Table) */}
            {!loading && children && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                    {children}
                </div>
            )}
        </div>
    );
}
