"use client"
import { useState, useEffect, useRef } from "react";
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, TrendingUp, LogIn, FileText, PackagePlus } from "lucide-react";
import Link from "next/link";
import api from "../../lib/api";
import ReplenishModal from "../../components/ReplenishModal";
import InventoryItemModal from "../../components/InventoryItemModal";

export default function Dashboard() {
  const fetchedRef = useRef(false);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [user, setUser] = useState(null);

  // Modal states
  const [replenishModal, setReplenishModal] = useState({ open: false, item: null });
  const [editModal, setEditModal] = useState({ open: false, item: null });

  // Fetch inventory from backend
  useEffect(() => {
    // Prevent multiple fetches in development (React Strict Mode)
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    fetchInventory();
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUser = async () => {
    try {
      const res = await api.getCurrentUser();
      if (res.success) {
        setUser(res.data);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const response = await api.getInventory();
      if (response.success && response.data) {
        setItems(response.data);
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

  // Filter items
  const filteredItems = items.filter(item => {
    // Exclude 0 stock items by default as requested
    if (stockFilter === "all" && item.stock === 0) return false;

    const matchesSearch = !search ||
      item.productName?.toLowerCase().includes(search.toLowerCase()) ||
      item.category?.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = category === "all" || item.category === category;

    const matchesStock = stockFilter === "all" ||
      (stockFilter === "low" && item.stock <= item.reorderLevel) ||
      (stockFilter === "out" && item.stock === 0);

    return matchesSearch && matchesCategory && matchesStock;
  });

  // Calculate dynamic stats based on filtered items
  const stockValue = filteredItems.reduce((sum, item) => sum + (item.stock * item.buyingPrice), 0);
  const expectedRevenue = filteredItems.reduce((sum, item) => sum + (item.stock * item.sellingPrice), 0);

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
      <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" />
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Loading Inventory</p>
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
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-5 flex flex-col justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Stock value
            </p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-2xl font-bold text-slate-900">
                KSh {Math.round(stockValue).toLocaleString()}
              </p>
              <TrendingUp size={20} className="text-emerald-500" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-5 flex flex-col justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Expected revenue
            </p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-2xl font-bold text-slate-900">
                KSh {Math.round(expectedRevenue).toLocaleString()}
              </p>
              <TrendingUp size={20} className="text-violet-500" />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-4 text-slate-900 text-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full max-w-lg">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search inventory..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-4 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder:text-slate-400"
              />
            </div>
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
            of {items.length} items
          </span>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden text-slate-900 text-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Stock</th>
                  <th className="px-4 py-3 text-right">Buying Price</th>
                  <th className="px-4 py-3 text-right">Minimum Selling Price</th>
                  {/* <th className="px-4 py-3 text-right">Profit</th> */}
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
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        {/* PRODUCT NAME & CATEGORY */}
                        <td className="px-4 py-3 align-top">
                          <div className="mb-1 text-sm font-semibold text-slate-900">{item.productName}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="text-[11px] text-slate-400">{item.warehouseName || 'No Warehouse'}</div>
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

                        {/* <td className="px-4 py-3 align-top text-right">
                          <div className="text-lg font-semibold text-slate-900">KSh {profit.toFixed(2)}</div>
                        </td> */}

                        {/* ACTIONS */}
                        <td className="px-4 py-3 align-top text-center">
                          <div className="flex items-center justify-center gap-2">
                            {user?.role !== 'accountant' && (
                              <>
                                <button
                                  onClick={() => setEditModal({ open: true, item })}
                                  className="btn-ghost p-2 rounded hover:bg-slate-100 text-sky-600 transition-colors"
                                  title="Edit item"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id, item.productName)}
                                  className="btn-danger p-2 rounded"
                                  title="Delete item"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                            {user?.role === 'accountant' && (
                              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Read Only</span>
                            )}
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

      {/* Edit Item Modal */}
      <InventoryItemModal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, item: null })}
        item={editModal.item}
        onSuccess={fetchInventory}
      />
    </>
  );
}
