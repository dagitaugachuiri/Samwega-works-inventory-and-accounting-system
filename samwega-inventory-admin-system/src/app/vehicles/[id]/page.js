"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft, CheckCircle2, Clock, Package, Truck,
  Printer, Receipt, Calendar, TrendingUp, AlertCircle,
  FileText, Plus, Wallet, ShoppingCart, Info, List, User
} from "lucide-react";
import Link from "next/link";
import api from "../../../lib/api";
import CustomModal from "../../../components/ui/CustomModal";

export default function VehicleDetailsDashboard() {
  const [vehicleId, setVehicleId] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [vehicleInventory, setVehicleInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFilter, setDateFilter] = useState("");
  const [activeTab, setActiveTab] = useState("issuances");

  // Modal state
  const [modal, setModal] = useState({
    isOpen: false,
    type: "confirm",
    title: "",
    message: "",
    onConfirm: null,
    loading: false
  });

  // Fetch initial data
  useEffect(() => {
    const id = window.location.pathname.split('/').pop();
    setVehicleId(id);
  }, []);

  useEffect(() => {
    if (!vehicleId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [vehicleRes, transfersRes, inventoryRes, salesRes, expensesRes, vInventoryRes] = await Promise.all([
          api.getVehicleById(vehicleId),
          api.getTransfers({ vehicleId }),
          api.getInventory(),
          api.getSales({ vehicleId }),
          api.getExpenses({ vehicleId }),
          api.getVehicleInventoryReport({ vehicleId })
        ]);

        setVehicle(vehicleRes?.data || vehicleRes);
        setTransfers(transfersRes?.data?.transfers || transfersRes?.transfers || []);
        const invList = inventoryRes?.data || inventoryRes || [];
        setInventory(Array.isArray(invList) ? invList : []);
        setSales(salesRes?.data?.sales || salesRes?.sales || []);
        setExpenses(expensesRes?.data?.expenses || expensesRes?.expenses || []);
        const invData = vInventoryRes?.data?.data || vInventoryRes?.data || vInventoryRes || [];
        setVehicleInventory(Array.isArray(invData) ? invData : []);
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [vehicleId]);

  // Helper to calculate multiplier (matching backend logic)
  const calculateMultiplier = (structure, layerIndex) => {
    if (!structure) return 1;
    if (Array.isArray(structure)) {
      if (layerIndex >= structure.length) return 1;
      let multiplier = 1;
      for (let i = layerIndex + 1; i < structure.length; i++) {
        multiplier *= (structure[i].qty || 1);
      }
      return multiplier;
    }
    // Legacy object format
    if (layerIndex === 0) return (structure.cartonSize || 1) * (structure.packetSize || 1);
    if (layerIndex === 1) return structure.packetSize || 1;
    return 1;
  };

  // Filter transfers, sales, expenses by date
  const filteredTransfers = transfers.filter(t => !dateFilter || new Date(t.createdAt).toISOString().split('T')[0] === dateFilter);
  const filteredSales = sales.filter(s => !dateFilter || new Date(s.createdAt).toISOString().split('T')[0] === dateFilter);
  const filteredExpenses = expenses.filter(e => !dateFilter || new Date(e.createdAt).toISOString().split('T')[0] === dateFilter);

  // Stats calculation
  const stats = {
    issued: filteredTransfers.reduce((acc, t) => {
      const transferValue = (t.items || []).reduce((itemAcc, item) => {
        const invItem = inventory.find(i => i.id === item.inventoryId || i.productName === item.productName);
        if (!invItem) return itemAcc;

        const buyingPrice = invItem.buyingPrice || 0;
        const itemValue = (item.layers || []).reduce((layerAcc, layer) => {
          const multiplier = calculateMultiplier(invItem.packagingStructure, layer.layerIndex);
          return layerAcc + ((layer.quantity || 0) * multiplier * buyingPrice);
        }, 0);

        return itemAcc + itemValue;
      }, 0);
      return acc + transferValue;
    }, 0),
    collected: filteredSales.reduce((acc, s) => acc + (s.grandTotal || 0), 0),
    expenses: filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0),
    profit: 0
  };
  stats.profit = stats.collected - stats.issued - stats.expenses;

  if (loading) {
    return (
      <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" />
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Loading Vehicle Data</p>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-3">
        <AlertCircle className="text-rose-500" size={32} />
        <p className="text-sm font-medium text-slate-600">{error || "Vehicle not found"}</p>
        <Link href="/vehicles" className="text-xs text-sky-600 hover:underline">Back to Fleet</Link>
      </div>
    );
  }

  return (
    <div className="   py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 pb-6">
          <Link href="/vehicles" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              {vehicle.vehicleName}
              <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200 uppercase">
                {vehicle.vehicleNumber}
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
              <User size={14} /> Assigned to: <span className="font-medium text-slate-700">{vehicle.assignedUserName || "No driver assigned"}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
            />
          </div>
          <button onClick={() => window.print()} className="btn-ghost flex items-center gap-2 text-xs">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Stats Hero */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Sales" value={stats.collected} icon={ShoppingCart} color="emerald" />
        <StatCard title="Total Issued" value={stats.issued} icon={Package} color="blue" />
        <StatCard title="Total Expenses" value={stats.expenses} icon={Wallet} color="rose" />
        <StatCard title="Margin" value={stats.profit} icon={TrendingUp} color={stats.profit >= 0 ? "emerald" : "rose"} />
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto no-scrollbar">
        <TabButton id="sales" label="Sales" icon={ShoppingCart} activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton id="inventory" label="Vehicle Inventory" icon={Package} activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton id="expenses" label="Expenses" icon={Wallet} activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton id="issuances" label="Issuances" icon={List} activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Tab Content */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm min-h-[400px]">
        {activeTab === "sales" && <SalesTab sales={filteredSales} />}
        {activeTab === "inventory" && <InventoryTab inventory={vehicleInventory} />}
        {activeTab === "expenses" && <ExpensesTab expenses={filteredExpenses} />}
        {activeTab === "issuances" && <IssuancesTab transfers={filteredTransfers} />}
      </div>

      {/* Modal */}
      <CustomModal
        isOpen={modal.isOpen}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        loading={modal.loading}
      />
    </div>
  );
}

// --- Sub-components ---

function StatCard({ title, value, icon: Icon, color }) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    slate: "bg-slate-50 text-slate-600 border-slate-100",
  };
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={`p-3 rounded-full border ${colors[color] || colors.slate}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        <p className={`text-xl font-bold ${value < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
          KES {Math.abs(value).toLocaleString()}
          {value < 0 && <span className="ml-1 text-sm font-normal">(Loss)</span>}
        </p>
      </div>
    </div>
  );
}

function TabButton({ id, label, icon: Icon, activeTab, setActiveTab }) {
  const isActive = activeTab === id;
  return (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${isActive
        ? "border-sky-600 text-sky-600 bg-sky-50/50"
        : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50"
        }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function SalesTab({ sales }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
        <tr>
          <th className="px-6 py-4 font-bold uppercase tracking-wider">Date</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider">Receipt No.</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider">Customer</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider">Items Sold</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">Qty</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Sold At (Price)</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Subtotal</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Total Amount</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {sales.length > 0 ? sales.map(s => (
          <tr key={s.id} className="hover:bg-slate-50">
            <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{new Date(s.createdAt).toLocaleDateString()}</td>
            <td className="px-6 py-4 font-mono font-medium text-slate-900 whitespace-nowrap">{s.receiptNumber || s.id.substring(0, 8)}</td>
            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{s.customerName || "Walk-in"}</td>
            <td className="px-6 py-4 text-slate-600">
              {s.items && s.items.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {s.items.map((item, idx) => (
                    <div key={idx} className="h-[2.5rem] flex items-center">
                      <span className="font-medium text-slate-900">{item.productName}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-slate-400 italic text-[10px]">No items</span>
              )}
            </td>
            <td className="px-6 py-4 text-center text-slate-600">
              {s.items && s.items.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {s.items.map((item, idx) => (
                    <div key={idx} className="h-[2.5rem] flex items-center justify-center">
                      <span className="font-mono font-bold text-sky-700">{item.quantity}</span>
                    </div>
                  ))}
                </div>
              ) : (
                "-"
              )}
            </td>
            <td className="px-6 py-4 text-right text-slate-600">
              {s.items && s.items.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {s.items.map((item, idx) => (
                    <div key={idx} className="h-[2.5rem] flex items-center justify-end">
                      <span className="font-mono">KES {(item.unitPrice || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                "-"
              )}
            </td>
            <td className="px-6 py-4 text-right text-slate-600">
              {s.items && s.items.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {s.items.map((item, idx) => (
                    <div key={idx} className="h-[2.5rem] flex items-center justify-end">
                      <span className="font-mono font-semibold text-slate-800">KES {((item.unitPrice || 0) * (item.quantity || 0)).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                "-"
              )}
            </td>
            <td className="px-6 py-4 text-right font-bold text-slate-900">KES {s.grandTotal?.toLocaleString()}</td>
          </tr>
        )) : (
          <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400">No sales records found.</td></tr>
        )}
      </tbody>
    </table>
  );
}

function InventoryTab({ inventory }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
        <tr>
          <th className="px-6 py-4 font-bold uppercase tracking-wider">Item Name</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">Opening Stock</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">Total Sold</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">Current Stock</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {inventory.length > 0 ? inventory.map((item, index) => (
          <tr key={index} className="hover:bg-slate-50">
            <td className="px-6 py-4 font-bold text-slate-900">{item.itemName}</td>
            <td className="px-6 py-4 text-center text-slate-600 font-mono">{item.quantityLoaded || 0}</td>
            <td className="px-6 py-4 text-center text-slate-600 font-mono">{item.quantitySold || 0}</td>
            <td className="px-6 py-4 text-center font-bold text-sky-700 font-mono">{item.quantityRemaining || 0}</td>
          </tr>
        )) : (
          <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">No inventory found on vehicle.</td></tr>
        )}
      </tbody>
    </table>
  );
}

function ExpensesTab({ expenses }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
        <tr>
          <th className="px-6 py-4 font-bold uppercase tracking-wider">Date</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider">Description</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider">Category</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">Status</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Amount</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {expenses.length > 0 ? expenses.map(e => (
          <tr key={e.id} className="hover:bg-slate-50">
            <td className="px-6 py-4 text-slate-600">{new Date(e.createdAt).toLocaleDateString()}</td>
            <td className="px-6 py-4 text-slate-700 font-medium">{e.description}</td>
            <td className="px-6 py-4"><span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] text-slate-500">{e.category}</span></td>
            <td className="px-6 py-4 text-center">
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${e.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                {e.status}
              </span>
            </td>
            <td className="px-6 py-4 text-right font-bold text-rose-600">KES {e.amount?.toLocaleString()}</td>
          </tr>
        )) : (
          <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No expense reports found.</td></tr>
        )}
      </tbody>
    </table>
  );
}

function IssuancesTab({ transfers }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
        <tr>
          <th className="px-6 py-4 font-bold uppercase tracking-wider">Date/Time</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider">Reference</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider">Items Issued</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">Qty</th>
          <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {transfers.length > 0 ? transfers.map(t => {
          // Flatten items and layers for display
          const isReturn = t.type === 'return' || t.status === 'returned';
          const displayItems = isReturn
            ? (t.items || []).map(item => ({
              name: `${item.productName} (${item.unit})`,
              quantity: item.quantity,
              isReturn: true
            }))
            : t.items?.flatMap(item =>
              (item.layers || []).map(layer => ({
                name: `${item.productName} (${layer.unit})`,
                quantity: layer.quantity,
                isReturn: false
              }))
            ) || [];

          return (
            <tr key={t.id} className="hover:bg-slate-50">
              <td className="px-6 py-4 text-slate-600">
                <div className="font-medium text-slate-900">{new Date(t.createdAt).toLocaleDateString()}</div>
                <div className="text-[10px] text-slate-400">{new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </td>
              <td className="px-6 py-4 font-mono text-slate-500">{t.transferNumber || t.id.substring(0, 8)}</td>
              <td className="px-6 py-4 text-slate-600">
                {displayItems.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {displayItems.map((item, idx) => (
                      <div key={idx} className="h-[2.5rem] flex items-center">
                        <span className={`font-medium ${item.isReturn ? 'text-rose-600' : 'text-slate-900'}`}>{item.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 italic text-[10px]">No items</span>
                )}
              </td>
              <td className="px-6 py-4 text-center text-slate-600">
                {displayItems.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {displayItems.map((item, idx) => (
                      <div key={idx} className="h-[2.5rem] flex items-center justify-center">
                        <span className="font-mono font-bold text-sky-700">{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  "-"
                )}
              </td>
              <td className="px-6 py-4 text-center">
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${t.status === 'collected' ? 'bg-emerald-50 text-emerald-600' :
                  t.status === 'approved' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                  {t.status}
                </span>
              </td>
            </tr>
          );
        }) : (
          <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No issuance records found.</td></tr>
        )}
      </tbody>
    </table>
  );
}
