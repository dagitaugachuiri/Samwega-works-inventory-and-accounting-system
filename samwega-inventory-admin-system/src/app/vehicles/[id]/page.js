"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, Package, Truck, Printer, Receipt, Calendar, TrendingUp, AlertCircle } from "lucide-react";
import Link from "next/link";
import api from "../../../lib/api";

export default function VehicleDetailsDashboard() {
  const [vehicleId, setVehicleId] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFilter, setDateFilter] = useState("");

  // Fetch vehicle, transfers, and inventory
  useEffect(() => {
    if (!vehicleId) {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id') || window.location.pathname.split('/').pop();
      setVehicleId(id);
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch vehicle details
        const vehicleRes = await api.request(`/vehicles/${vehicleId}`, { method: 'GET' });
        const vehicleData = vehicleRes?.data || vehicleRes;
        setVehicle(vehicleData);

        // Fetch transfers for this vehicle
        try {
          const transfersRes = await api.request(`/transfers?vehicleId=${vehicleId}`, { method: 'GET' });
          const transfersList = transfersRes?.data?.transfers || transfersRes?.transfers || [];
          setTransfers(transfersList);
        } catch (e) {
          console.warn("Could not fetch transfers:", e);
          setTransfers([]);
        }

        // Fetch inventory for pricing
        try {
          const inventoryRes = await api.getInventory();
          const inventoryList = inventoryRes?.data || inventoryRes || [];
          setInventory(Array.isArray(inventoryList) ? inventoryList : []);
        } catch (e) {
          console.warn("Could not fetch inventory:", e);
          setInventory([]);
        }
      } catch (err) {
        console.error("Failed to fetch data", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [vehicleId]);

  const handleApproveTransfer = async (transferId) => {
    if (!confirm("Approve this transfer? Stock will be deducted from main inventory and added to vehicle inventory.")) {
      return;
    }
    try {
      await api.request(`/transfers/${transferId}/approve`, { method: 'POST' });
      // Refresh transfers
      const transfersRes = await api.request(`/transfers?vehicleId=${vehicleId}`, { method: 'GET' });
      const transfersList = transfersRes?.data?.transfers || transfersRes?.transfers || [];
      setTransfers(transfersList);
      alert("Transfer approved! Stock has been deducted from inventory.");
    } catch (err) {
      console.error("Error approving transfer", err);
      alert(`Failed to approve: ${err.message}`);
    }
  };

  const handleConfirmTransfer = async (transferId) => {
    try {
      await api.request(`/transfers/${transferId}/confirm`, { method: 'POST' });
      // Refresh transfers
      const transfersRes = await api.request(`/transfers?vehicleId=${vehicleId}`, { method: 'GET' });
      const transfersList = transfersRes?.data?.transfers || transfersRes?.transfers || [];
      setTransfers(transfersList);
      alert("Transfer confirmed successfully!");
    } catch (err) {
      console.error("Error confirming transfer", err);
      alert(`Failed: ${err.message}`);
    }
  };

  const getPrice = (productName, unit) => {
    const item = inventory.find(i => i.productName === productName);
    if (!item || !item.packagingStructure) return 0;

    const layer = item.packagingStructure.find(l => l.unit === unit);
    if (layer && layer.sellingPrice) return parseFloat(layer.sellingPrice);

    if (unit?.toLowerCase().includes("piece") || unit?.toLowerCase().includes("pc")) {
      return parseFloat(item.sellingPricePerPiece) || 0;
    }

    return 0;
  };

  // Filter and Stats Logic
  const filteredTransfers = transfers.filter(t => {
    if (!dateFilter) return true;
    const transferDate = new Date(t.createdAt).toISOString().split('T')[0];
    return transferDate === dateFilter;
  });

  const stats = filteredTransfers.reduce((acc, transfer) => {
    if (transfer.items) {
      transfer.items.forEach(item => {
        if (item.layers) {
          item.layers.forEach(layer => {
            const price = getPrice(item.productName, layer.unit);
            const total = price * layer.quantity;
            acc.issued += total;
            if (layer.collected) {
              acc.collected += total;
            } else {
              acc.pending += total;
            }
          });
        }
      });
    }
    return acc;
  }, { issued: 0, collected: 0, pending: 0 });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-sky-600" />
          <p className="text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 gap-3">
        <p className="text-sm font-medium text-rose-600">{error || "Vehicle not found"}</p>
        <button
          onClick={() => window.history.back()}
          className="btn-ghost text-xs"
        >
          <ArrowLeft className="inline-block mr-2" size={14} />
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="mx-auto max-w-[1600px] space-y-6">

        {/* Top Navigation & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-4">
            <Link href="/vehicles" className="btn-ghost text-xs text-slate-600 hover:text-slate-900">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                {vehicle.vehicleName}
                <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  {vehicle.registrationNumber}
                </span>
              </h1>
              <p className="text-xs text-slate-500">Sales Rep: {vehicle.salesTeamMember || "N/A"}</p>
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
            {dateFilter && (
              <button
                onClick={() => setDateFilter("")}
                className="text-xs text-slate-500 hover:text-rose-600 underline"
              >
                Clear
              </button>
            )}
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            <button onClick={() => window.print()} className="btn-ghost text-xs text-slate-600 hover:text-slate-900">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </button>
          </div>
        </div>

        {/* Stats Hero */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Issued</p>
              <p className="text-2xl font-bold text-slate-900">KSh {stats.issued.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
              <Package size={24} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Collected</p>
              <p className="text-2xl font-bold text-emerald-700">KSh {stats.collected.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
              <CheckCircle2 size={24} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pending Collection</p>
              <p className="text-2xl font-bold text-amber-600">KSh {stats.pending.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
              <Clock size={24} />
            </div>
          </div>
        </div>

        {/* Transfers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {filteredTransfers.length > 0 ? (
            filteredTransfers.map((transfer) => {
              let transferTotal = 0;

              return (
                <div key={transfer.id} className="bg-white shadow-lg shadow-slate-200/50 border border-slate-200 rounded-none relative overflow-hidden font-mono text-sm">
                  {/* Receipt Top Edge Decoration */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-blue-500"></div>

                  {/* Receipt Header */}
                  <div className="p-4 border-b border-dashed border-slate-200 bg-slate-50/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 text-sky-700 mb-1">
                          <Receipt size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Transfer</span>
                        </div>
                        <p className="text-[10px] text-slate-400">#{transfer.transferNumber || transfer.id?.substring(0, 8)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-900">
                          {new Date(transfer.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {new Date(transfer.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Grid Header */}
                  <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-slate-100 text-[9px] uppercase font-bold text-slate-500 tracking-wider border-b border-slate-200">
                    <div className="col-span-1 text-center">Qty</div>
                    <div className="col-span-2">Unit</div>
                    <div className="col-span-6">Item</div>
                    <div className="col-span-3 text-right">Total</div>
                  </div>

                  {/* Items Grid */}
                  <div className="divide-y divide-dashed divide-slate-100">
                    {transfer.items?.map((item) => (
                      item.layers?.map((layer, lIdx) => {
                        const price = getPrice(item.productName, layer.unit);
                        const lineTotal = price * layer.quantity;
                        transferTotal += lineTotal;

                        return (
                          <div key={`${item.inventoryId}-${lIdx}`} className="grid grid-cols-12 gap-1 px-4 py-2 items-center hover:bg-slate-50 transition-colors">
                            <div className="col-span-1 text-center font-bold text-slate-900">{layer.quantity}</div>
                            <div className="col-span-2 text-slate-500 truncate text-[10px]">{layer.unit}</div>
                            <div className="col-span-6 font-medium text-slate-800 truncate text-[11px]" title={item.productName}>{item.productName}</div>
                            <div className="col-span-3 text-right font-bold text-slate-900">{price > 0 ? lineTotal.toLocaleString() : '-'}</div>
                          </div>
                        );
                      })
                    ))}
                  </div>

                  {/* Receipt Footer */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200">
                    <div className="flex justify-between items-end">
                      <div className="text-[10px] text-slate-500 space-y-2">
                        <p>Status: <span className={`font-semibold uppercase ${transfer.status === 'collected' ? 'text-emerald-600' : transfer.status === 'approved' ? 'text-sky-600' : 'text-amber-600'}`}>{transfer.status}</span></p>
                        {transfer.status === 'pending' && (
                          <button
                            onClick={() => handleApproveTransfer(transfer.id)}
                            className="px-3 py-1.5 bg-amber-600 text-white text-[10px] rounded hover:bg-amber-700 font-semibold"
                          >
                            ✓ Approve Transfer
                          </button>
                        )}
                        {transfer.status === 'approved' && (
                          <button
                            onClick={() => handleConfirmTransfer(transfer.id)}
                            className="px-3 py-1.5 bg-sky-600 text-white text-[10px] rounded hover:bg-sky-700 font-semibold"
                          >
                            ✓ Confirm Collection
                          </button>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Total</p>
                        <p className="text-lg font-bold text-slate-900">KSh {transferTotal.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Receipt jagged bottom */}
                  <div className="h-3 bg-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-2 bg-[linear-gradient(45deg,transparent_33.333%,#ffffff_33.333%,#ffffff_66.667%,transparent_66.667%),linear-gradient(-45deg,transparent_33.333%,#ffffff_33.333%,#ffffff_66.667%,transparent_66.667%)] bg-[length:10px_16px] bg-[position:0_0]"></div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-16 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <Package className="mx-auto mb-3 text-slate-300" size={48} />
              <p className="text-slate-500">No transfers found {dateFilter ? "for this date" : ""}.</p>
              {dateFilter && (
                <button onClick={() => setDateFilter("")} className="text-sky-600 hover:underline mt-2 text-sm">
                  Clear date filter
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}