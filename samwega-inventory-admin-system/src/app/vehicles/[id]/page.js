"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, Package, Truck, Printer, Receipt, Calendar, TrendingUp, AlertCircle, FileText, Plus } from "lucide-react";
import Link from "next/link";
import api from "../../../lib/api";
import CustomModal from "../../../components/ui/CustomModal";

export default function VehicleDetailsDashboard() {
  const [vehicleId, setVehicleId] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFilter, setDateFilter] = "";

  // Modal state
  const [modal, setModal] = useState({
    isOpen: false,
    type: "confirm",
    title: "",
    message: "",
    onConfirm: null,
    loading: false
  });

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
    setModal({
      isOpen: true,
      type: "confirm",
      title: "Approve Transfer?",
      message: "Stock will be deducted from main inventory and added to vehicle inventory. This action cannot be undone.",
      onConfirm: async () => {
        // Show loading state
        setModal(prev => ({ ...prev, type: "loading", title: "Approving Transfer", message: "Please wait while we process the transfer..." }));

        try {
          await api.request(`/transfers/${transferId}/approve`, { method: 'POST' });

          // Refresh transfers
          const transfersRes = await api.request(`/transfers?vehicleId=${vehicleId}`, { method: 'GET' });
          const transfersList = transfersRes?.data?.transfers || transfersRes?.transfers || [];
          setTransfers(transfersList);

          // Show success
          setModal({
            isOpen: true,
            type: "success",
            title: "Transfer Approved!",
            message: "Stock has been successfully deducted from inventory and added to the vehicle.",
            onConfirm: null
          });
        } catch (err) {
          console.error("Error approving transfer", err);

          // Show error
          setModal({
            isOpen: true,
            type: "error",
            title: "Approval Failed",
            message: err.response?.data?.error || err.message || "Failed to approve transfer. Please try again.",
            onConfirm: null
          });
        }
      },
      loading: false
    });
  };

  const handleConfirmTransfer = async (transferId) => {
    setModal({
      isOpen: true,
      type: "confirm",
      title: "Confirm Collection?",
      message: "Mark this transfer as collected by the sales representative?",
      onConfirm: async () => {
        // Show loading state
        setModal(prev => ({ ...prev, type: "loading", title: "Confirming Collection", message: "Please wait..." }));

        try {
          await api.request(`/transfers/${transferId}/confirm`, { method: 'POST' });

          // Refresh transfers
          const transfersRes = await api.request(`/transfers?vehicleId=${vehicleId}`, { method: 'GET' });
          const transfersList = transfersRes?.data?.transfers || transfersRes?.transfers || [];
          setTransfers(transfersList);

          // Show success
          setModal({
            isOpen: true,
            type: "success",
            title: "Collection Confirmed!",
            message: "Transfer has been marked as collected successfully.",
            onConfirm: null
          });
        } catch (err) {
          console.error("Error confirming transfer", err);

          // Show error
          setModal({
            isOpen: true,
            type: "error",
            title: "Confirmation Failed",
            message: err.response?.data?.error || err.message || "Failed to confirm collection. Please try again.",
            onConfirm: null
          });
        }
      },
      loading: false
    });
  };

  const getPrice = (item, layer) => {
    // 1. Try finding by ID first
    let inventoryItem = null;
    if (item.inventoryId) {
      inventoryItem = inventory.find(i => i.id === item.inventoryId || i._id === item.inventoryId);
    }

    // 2. Fallback to name
    if (!inventoryItem && item.productName) {
      inventoryItem = inventory.find(i => i.productName?.trim().toLowerCase() === item.productName?.trim().toLowerCase());
    }

    if (!inventoryItem) return 0;

    // 3. Determine Base Price (Price Per Smallest Unit/Piece)
    // Priority: sellingPricePerUnit -> sellingPrice (calc) -> buyingPricePerUnit -> buyingPrice (calc)
    let basePrice = parseFloat(inventoryItem.sellingPricePerUnit) || 0;

    // If no per-unit selling price, derive from Selling Price (Layer 0)
    if (!basePrice && inventoryItem.sellingPrice > 0) {
      const structure = inventoryItem.packagingStructure;
      if (Array.isArray(structure) && structure.length > 0) {
        let piecesInLayer0 = 1;
        for (let i = 1; i < structure.length; i++) {
          piecesInLayer0 *= (structure[i].qty || 1);
        }
        basePrice = inventoryItem.sellingPrice / piecesInLayer0;
      } else {
        basePrice = parseFloat(inventoryItem.sellingPrice) || 0;
      }
    }

    // Fallback to Buying Price if Selling Price is 0/Missing
    if (basePrice === 0) {
      let costPrice = parseFloat(inventoryItem.buyingPricePerUnit) || 0;
      if (!costPrice && inventoryItem.buyingPrice > 0) {
        const structure = inventoryItem.packagingStructure;
        if (Array.isArray(structure) && structure.length > 0) {
          let piecesInLayer0 = 1;
          for (let i = 1; i < structure.length; i++) {
            piecesInLayer0 *= (structure[i].qty || 1);
          }
          costPrice = inventoryItem.buyingPrice / piecesInLayer0;
        } else {
          costPrice = parseFloat(inventoryItem.buyingPrice) || 0;
        }
      }
      basePrice = costPrice;
    }

    // 4. Convert basePrice to requested unit
    let multiplier = 1;
    const structure = inventoryItem.packagingStructure;
    const unit = layer.unit;
    const layerIndex = layer.layerIndex;

    // Helper for fuzzy unit matching
    const normalize = (u) => {
      if (!u) return "";
      const s = u.toLowerCase().trim();
      if (s === 'pcs' || s === 'piece' || s === 'pieces' || s === 'pc') return 'piece';
      if (s === 'ctn' || s === 'carton' || s === 'box' || s === 'boxes') return 'carton';
      return s;
    };

    if (Array.isArray(structure) && structure.length > 0) {
      // Resolve layer index
      let idx = layerIndex;

      // If no valid numeric index, try matching by unit name
      if ((typeof idx !== 'number' || idx < 0) && unit) {
        // 1. Exact match
        idx = structure.findIndex(l => l.unit?.toLowerCase() === unit?.toLowerCase());

        // 2. Fuzzy match
        if (idx === -1) {
          const normUnit = normalize(unit);
          idx = structure.findIndex(l => normalize(l.unit) === normUnit);
        }
      }

      // 3. Fallback: If unit looks like "piece" but not found, assume Base Unit (last layer)
      if ((idx === -1 || idx === undefined) && normalize(unit) === 'piece') {
        idx = structure.length - 1;
      }
      // 4. Fallback: If unit looks like "carton" but not found, assume Top Layer (0)?
      if ((idx === -1 || idx === undefined) && normalize(unit) === 'carton') {
        idx = 0;
      }

      // If we found a valid layer index
      if (typeof idx === 'number' && idx >= 0 && idx < structure.length) {
        // Calculate pieces in this specific layer
        let piecesInThisLayer = 1;
        for (let i = idx + 1; i < structure.length; i++) {
          piecesInThisLayer *= (structure[i].qty || 1);
        }
        multiplier = piecesInThisLayer;
      }
    }

    return basePrice * multiplier;
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
        if (item.layers && item.layers.length > 0) {
          item.layers.forEach(layer => {
            const price = getPrice(item, layer);
            const total = price * layer.quantity;
            acc.issued += total;
            if (transfer.status === 'collected') {
              acc.collected += total;
            } else {
              acc.pending += total;
            }
          });
        }
        // Fallback for items without layers
        else if (item.quantity) {
          const layer = { unit: item.unit || '', quantity: item.quantity, layerIndex: -1 };
          const price = getPrice(item, layer);
          const total = price * item.quantity;
          acc.issued += total;
          if (transfer.status === 'collected') {
            acc.collected += total;
          } else {
            acc.pending += total;
          }
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
    <>
      <div className="space-y-6">

        {/* Standard Navigation Header */}
        <div className="flex items-center justify-between gap-4 text-slate-900 mb-4 print:hidden">
          <div>

            <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
              {vehicle.vehicleName}
              <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                {vehicle.vehicleNumber || vehicle.registrationNumber}
              </span>
            </h1>
            <p className="text-xs text-slate-500">Sales Rep: {vehicle.assignedUserName || vehicle.salesTeamMember || "N/A"}</p>
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

        {/* Transfers List (Table) */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
              <tr>
                <th className="px-4 py-3 w-32">Date</th>
                <th className="px-4 py-3 w-32">Transfer</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 w-24">Quantity</th>
                <th className="px-4 py-3 w-24 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransfers.length > 0 ? (
                filteredTransfers.map((transfer) => {
                  let transferTotal = 0;
                  // Calculate total beforehand and prepare renderer
                  if (transfer.items) {
                    transfer.items.forEach(item => {
                      if (item.layers && item.layers.length > 0) {
                        item.layers.forEach((layer) => {
                          const price = getPrice(item, layer);
                          transferTotal += price * layer.quantity;
                        });
                      } else if (item.quantity) {
                        // Fallback
                        const layer = { unit: item.unit || '', quantity: item.quantity, layerIndex: -1 };
                        const price = getPrice(item, layer);
                        transferTotal += price * item.quantity;
                      }
                    });
                  }

                  return (
                    <tr key={transfer.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-600 align-top">
                        <div className="font-medium text-slate-900">{new Date(transfer.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs text-slate-400">{new Date(transfer.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 align-top">
                        {transfer.transferNumber || transfer.id?.substring(0, 8)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="space-y-1">
                          {transfer.items?.map((item, idx) => (
                            <div key={idx} className="text-xs text-slate-700 h-6 flex items-center">
                              <span className="font-medium truncate">{item.productName}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="space-y-1">
                          {transfer.items?.map((item, idx) => (
                            <div key={idx} className="text-xs text-slate-500 h-6 flex items-center">
                              {item.layers && item.layers.length > 0 ? (
                                item.layers.map(l => `${l.quantity} ${l.unit}`).join(', ')
                              ) : (
                                // Fallback display
                                `${item.quantity || '-'} ${item.unit || ''}`
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize
                          ${transfer.status === 'collected' ? 'bg-emerald-100 text-emerald-700' :
                            transfer.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'}`}>
                          {transfer.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Package className="mx-auto mb-3 text-slate-300" size={32} />
                    <p>No transfers found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Modal */}
      <CustomModal
        isOpen={modal.isOpen}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        loading={modal.loading}
        confirmText="Approve"
        cancelText="Cancel"
      />
    </>
  );
}