"use client"
import { useState, useEffect, useRef } from "react";
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, TrendingUp, LogIn, FileText, PackagePlus } from "lucide-react";
import Link from "next/link";
import api from "../../lib/api";
import ReplenishModal from "../../components/ReplenishModal";

export default function Dashboard() {
  const fetchedRef = useRef(false);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    lowStock: 0,
    totalValue: 0,
    expectedRevenue: 0
  });

  // Replenish modal state
  const [replenishModal, setReplenishModal] = useState({ open: false, item: null });

  // Fetch inventory from backend
  useEffect(() => {
    // Prevent multiple fetches in development (React Strict Mode)
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    fetchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const response = await api.getInventory();
      if (response.success && response.data) {
        setItems(response.data);
        calculateStats(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch inventory:", error);
      // Check if it's an auth error
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        setAuthError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (inventoryData) => {
    const lowStock = inventoryData.filter(item => item.stock <= item.reorderLevel).length;
    const totalValue = inventoryData.reduce((sum, item) => sum + (item.stock * item.buyingPrice), 0);
    const expectedRevenue = inventoryData.reduce((sum, item) => sum + (item.stock * item.sellingPrice), 0);

    setStats({
      total: inventoryData.length,
      lowStock,
      totalValue: Math.round(totalValue),
      expectedRevenue: Math.round(expectedRevenue)
    });
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = !search ||
      item.productName?.toLowerCase().includes(search.toLowerCase()) ||
      item.category?.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = category === "all" || item.category === category;

    const matchesStock = stockFilter === "all" ||
      (stockFilter === "low" && item.stock <= item.reorderLevel) ||
      (stockFilter === "out" && item.stock === 0);

    return matchesSearch && matchesCategory && matchesStock;
  });

  const handleDelete = async (id, productName) => {
    if (!confirm(`Delete "${productName}"?`)) return;

    try {
      await api.deleteInventoryItem(id);
      fetchInventory(); // Refresh list
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete item");
    }
  };

  if (authError) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="glass-panel px-10 py-8 text-center">
          <LogIn size={40} className="mx-auto mb-4 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Please Sign In</h2>
          <p className="text-sm text-slate-600 mb-4">You need to login to access the dashboard</p>
          <Link href="/login" className="btn-primary">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="glass-panel px-10 py-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
          <p className="text-sm text-slate-300">Loading inventory…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex w-full flex-col gap-6">
        {/* Top heading */}
        <div className="flex items-center justify-between gap-4 text-slate-900">
          <div>
            <h1 className="text-2xl font-semibold">Inventory</h1>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Link href="/invoices" className="btn-ghost text-xs flex items-center">
              <FileText className="mr-1 h-4 w-4" />
              Add Invoice
            </Link>
            <Link href="/dashboard/add" className="btn-primary text-xs">
              <Plus className="mr-1 h-4 w-4" />
              New item
            </Link>
            <Link href="/issue-stock" className="btn-ghost text-xs">
              Issue Stock
            </Link>
            <Link href="/vehicles" className="btn-ghost text-xs">
              Vehicles
            </Link>
            <Link href="/sales-team" className="btn-ghost text-xs">
              Sales Team
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="glass-panel flex flex-col justify-between px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-600">
              Total items
            </p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-4xl font-semibold text-slate-900">
                {stats.total}
              </p>
              <Package size={24} className="text-sky-400/80" />
            </div>
          </div>

          <div className="glass-panel flex flex-col justify-between px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-600">
              Low stock
            </p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-4xl font-semibold text-amber-700">
                {stats.lowStock}
              </p>
              <AlertTriangle size={24} className="text-amber-300/80" />
            </div>
          </div>

          <div className="glass-panel flex flex-col justify-between px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-600">
              Stock value
            </p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-2xl font-semibold text-emerald-700">
                KSh {stats.totalValue.toLocaleString()}
              </p>
              <TrendingUp size={24} className="text-emerald-300/80" />
            </div>
          </div>

          <div className="glass-panel flex flex-col justify-between px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-600">
              Expected revenue
            </p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-2xl font-semibold text-violet-700">
                KSh {stats.expectedRevenue.toLocaleString()}
              </p>
              <TrendingUp size={24} className="text-violet-300/80" />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="glass-panel px-5 py-5 text-slate-900 text-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by name or category"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-9 text-xs"
              />
            </div>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field h-10 max-w-[170px] text-xs"
            >
              <option value="all">All categories</option>
              <option value="sweets">Sweets</option>
              <option value="juice">Juice</option>
              <option value="biscuits">Biscuits</option>
              <option value="baking ingredients">Baking ingredients</option>
              <option value="seasoning / mchuzi mix">Seasoning</option>
              <option value="household">Household</option>
              <option value="misc">Others</option>
            </select>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="input-field h-10 max-w-[150px] text-xs"
            >
              <option value="all">All stock</option>
              <option value="low">Low only</option>
              <option value="out">Out of stock</option>
            </select>
          </div>

          {(search || category !== "all" || stockFilter !== "all") && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-slate-400">Filters:</span>
              {search && (
                <span className="chip">
                  Search: <span className="ml-1 text-slate-100">{search}</span>
                </span>
              )}
              {category !== "all" && (
                <span className="chip">Category: {category}</span>
              )}
              {stockFilter !== "all" && (
                <span className="chip">Stock: {stockFilter}</span>
              )}
              <button
                onClick={() => {
                  setSearch(""); setCategory("all"); setStockFilter("all");
                }}
                className="text-[11px] text-slate-400 underline underline-offset-2"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing{" "}
            <span className="font-semibold text-slate-900">{filteredItems.length}</span>{" "}
            of {stats.total} items
          </span>
        </div>

        {/* Table */}
        <div className="glass-panel overflow-hidden text-slate-900 text-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Stock</th>
                  <th className="px-4 py-3 text-right">Buying Price</th>
                  <th className="px-4 py-3 text-right">Selling Price</th>
                  <th className="px-4 py-3 text-right">Profit</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => {
                    const isLowStock = item.stock <= item.reorderLevel;
                    const isOutOfStock = item.stock === 0;
                    const profit = item.sellingPrice - item.buyingPrice;
                    const profitMargin = item.buyingPrice > 0 ? ((profit / item.buyingPrice) * 100).toFixed(0) : 0;

                    return (
                      <tr
                        key={item.id}
                        className={
                          isOutOfStock
                            ? "bg-rose-50"
                            : isLowStock
                              ? "bg-amber-50"
                              : "hover:bg-slate-50 transition-colors"
                        }
                      >
                        {/* PRODUCT NAME & CATEGORY */}
                        <td className="px-4 py-3 align-top">
                          <div className="mb-1 text-sm font-semibold text-slate-900">{item.productName}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="text-[11px] text-slate-400">{item.supplier}</div>
                            {isOutOfStock && (
                              <span className="ml-1 text-[11px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded">Out of stock</span>
                            )}
                            {!isOutOfStock && isLowStock && (
                              <span className="ml-1 text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded">Low stock</span>
                            )}
                          </div>
                        </td>

                        {/* STOCK */}
                        <td className="px-4 py-3 align-top">
                          <div className="text-lg font-semibold text-slate-900">{item.stock}</div>
                        </td>

                        {/* BUYING PRICE */}
                        <td className="px-4 py-3 align-top text-right">
                          <div className="text-lg font-semibold text-slate-900">KSh {item.buyingPrice.toLocaleString()}</div>
                        </td>

                        {/* SELLING PRICE */}
                        <td className="px-4 py-3 align-top text-right">
                          <div className="text-lg font-semibold text-emerald-700">KSh {item.sellingPrice.toLocaleString()}</div>
                        </td>

                        {/* PROFIT */}
                        <td className="px-4 py-3 align-top text-right">
                          <div className={`inline-flex flex-col items-end px-2 py-1 rounded text-xs font-semibold ${profit >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
                            {profit >= 0 ? '+' : ''}{profitMargin}%
                          </div>
                          <div className="text-[12px] text-slate-600 mt-1">KSh {profit.toFixed(2)}</div>
                        </td>

                        {/* ACTIONS */}
                        <td className="px-4 py-3 align-top text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setReplenishModal({ open: true, item })}
                              className="btn-success p-2 rounded"
                              title="Add Stock"
                            >
                              <PackagePlus size={14} />
                            </button>
                            <Link
                              href={`/dashboard/${item.id}`}
                              className="btn-ghost p-2 rounded text-xs"
                            >
                              View
                            </Link>
                            <Link
                              href={`/dashboard/${item.id}/edit`}
                              className="btn-ghost p-2 rounded"
                            >
                              <Edit size={14} />
                            </Link>
                            <button
                              onClick={() => handleDelete(item.id, item.productName)}
                              className="btn-danger p-2 rounded"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-[12px] text-slate-400">
                      {search || category !== "all" || stockFilter !== "all" ? (
                        <>
                          <p className="mb-2">No items match your filters.</p>
                          <button
                            onClick={() => { setSearch(""); setCategory("all"); setStockFilter("all"); }}
                            className="text-sky-300 underline underline-offset-2"
                          >
                            Clear filters
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="mb-2">No items yet.</p>
                          <Link
                            href="/dashboard/add"
                            className="text-sky-300 underline underline-offset-2"
                          >
                            Add your first item
                          </Link>
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Replenish Modal */}
      <ReplenishModal
        isOpen={replenishModal.open}
        onClose={() => setReplenishModal({ open: false, item: null })}
        item={replenishModal.item}
        onSuccess={() => {
          fetchInventory();
          setReplenishModal({ open: false, item: null });
        }}
      />
    </>
  );
}
