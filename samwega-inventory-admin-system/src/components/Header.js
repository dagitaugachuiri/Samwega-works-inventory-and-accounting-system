'use client';

import { LogOut, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";

export default function Header() {
  const router = useRouter();

  const handleLogout = () => {
    // Clear JWT token
    api.logout();
    // Redirect to login
    router.push("/login");
  };

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-8 text-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md shadow-sky-300/60">
            <span className="text-xs font-semibold text-white">S</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.25em] text-slate-400">
              Samwega
            </span>
            <span className="text-sm font-medium text-slate-900">
              Inventory & Accounting System
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">

          <Link
            href="/dashboard"
            className="btn-ghost hidden text-xs font-medium lg:inline-flex items-center gap-1"
          >
            <Home size={14} />
            Dashboard
          </Link>
          <Link
            href="/suppliers"
            className="btn-ghost hidden text-xs font-medium lg:inline-flex"
          >
            Suppliers
          </Link>
          <Link
            href="/invoices"
            className="btn-ghost hidden text-xs font-medium lg:inline-flex"
          >
            Invoices
          </Link>
          <Link
            href="/reports"
            className="btn-ghost hidden text-xs font-medium lg:inline-flex"
          >
            Reports
          </Link>
          <Link
            href="/sales-dashboard"
            className="btn-ghost hidden text-xs font-medium lg:inline-flex"
          >
            Sales Dashboard
          </Link>
          <button
            onClick={handleLogout}
            className="btn-ghost flex items-center gap-1 text-xs font-medium"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}