"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
    Home,
    Users,
    FileText,
    BarChart,
    Wallet,
    Calculator,
    Truck,
    LogOut,
    Settings,
    Package,
    ShoppingCart,
    ArrowRightLeft,
    Contact,
    PlusCircle
} from "lucide-react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = () => {
        api.logout();
        router.push("/login");
    };

    const menuItems = [
        { name: "Inventory", href: "/dashboard", icon: Package },
        { name: "Add Stock", href: "/dashboard/add", icon: PlusCircle },
        { name: "Transfer Stock", href: "/issue-stock", icon: ArrowRightLeft },
        { name: "Sales", href: "/sales-dashboard", icon: ShoppingCart },
        { name: "Vehicles", href: "/vehicles", icon: Truck },
        { name: "Sales Team", href: "/sales-team", icon: Contact },
        { name: "Suppliers", href: "/suppliers", icon: Users },
        { name: "Invoices", href: "/invoices", icon: FileText },
        { name: "Expenses", href: "/expenses", icon: Wallet },
        { name: "Accounting", href: "/accounting", icon: Calculator },
        { name: "Reports", href: "/reports", icon: BarChart },
    ];

    const isActive = (path) => {
        if (path === "/dashboard" && pathname === "/dashboard") return true;
        if (path !== "/dashboard" && pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <aside
            className="
                group hidden lg:flex flex-col
                h-screen sticky top-0
                border-r border-slate-200 bg-white text-slate-900
                w-[64px] hover:w-64
                transition-[width] duration-200 ease-in-out
                overflow-hidden z-30
            "
        >
            {/* Brand */}
            <div className="flex h-16 items-center border-b border-slate-100 px-4 shrink-0 overflow-hidden">
                {/* Logo icon — always visible */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-600 shadow-sm shadow-sky-200">
                    <span className="text-sm font-bold text-white">S</span>
                </div>
                {/* Text — hidden when collapsed, shown on hover */}
                <div className="ml-3 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75 whitespace-nowrap overflow-hidden">
                    <span className="text-sm font-bold tracking-wide text-slate-900">SAMWEGA</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">WORKS LTD</span>
                </div>
            </div>

            {/* Menu */}
            <div className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                {menuItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            title={item.name}
                            className={`
                                flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium
                                transition-colors overflow-hidden whitespace-nowrap
                                ${active
                                    ? "bg-sky-50 text-sky-700"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                }
                            `}
                        >
                            {/* Icon — always visible, always same position */}
                            <item.icon size={18} className="shrink-0" />

                            {/* Label — hidden when collapsed */}
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75">
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </div>

            {/* Footer / Logout */}
            <div className="border-t border-slate-100 p-2 shrink-0">
                <button
                    onClick={handleLogout}
                    title="Logout"
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors overflow-hidden whitespace-nowrap"
                >
                    <LogOut size={18} className="shrink-0" />
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75">
                        Logout
                    </span>
                </button>
            </div>
        </aside>
    );
}
