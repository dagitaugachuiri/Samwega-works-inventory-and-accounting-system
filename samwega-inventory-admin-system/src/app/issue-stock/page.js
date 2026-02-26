"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Trash2, ArrowLeft, Package, Truck, AlertCircle, Save } from "lucide-react";
import Link from "next/link";
import api from "../../lib/api";
// ErrorModal removed as per request for simpler alerts

// Helper to normalize inventory data
const normalizeInventory = (data) => {
  const list = Array.isArray(data) ? data : (data?.data || []);
  return list.map(item => {
    let structure = item.packagingStructure;

    // Standardize structure to array if not already
    if (!structure || !Array.isArray(structure)) {
      if (structure && typeof structure === 'object' && structure.outer) {
        structure = [
          { unit: structure.outer.unit, stock: null, layerIndex: 0 },
          { unit: structure.inner.unit, stock: null, layerIndex: 1 }
        ];
        if (structure.inner.contains > 1) {
          structure.push({ unit: 'PCS', stock: null, layerIndex: 2 });
        }
      } else {
        structure = [{ unit: item.supplierUnit || 'Unit', layerIndex: 0 }];
      }
    } else {
      // Clone array to avoid mutation issues
      structure = structure.map(l => ({ ...l }));
    }

    // Ensure every layer has a valid integer layerIndex
    structure = structure.map((l, i) => ({
      ...l,
      layerIndex: (l.layerIndex !== undefined && l.layerIndex !== null)
        ? parseInt(l.layerIndex)
        : i
    }));

    const totalPieces = item.stock || 0;
    structure.forEach((layer, idx) => {
      let multiplier = 1;
      for (let i = idx + 1; i < structure.length; i++) {
        multiplier *= (structure[i].qty || 1);
      }
      layer.stock = Math.floor(totalPieces / multiplier);
      layer.piecesPerUnit = multiplier;
    });

    return {
      ...item,
      packagingStructure: structure,
      stock: totalPieces
    };
  });
};

export default function IssueStockUnified() {
  const router = useRouter();

  // Data State
  const [vehicles, setVehicles] = useState([]);
  const [inventory, setInventory] = useState([]);

  // Mode & Selection
  const [transferMode, setTransferMode] = useState('issue'); // 'issue' | 'return'
  const [selectedVehicle, setSelectedVehicle] = useState("");

  // Issue Mode State
  const [issuedItems, setIssuedItems] = useState([]); // Items to issue

  // Return Mode State
  const [returnItems, setReturnItems] = useState([]); // Items in vehicle to return

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  // Fetch Initial Data (Vehicles & Main Inventory)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vehiclesRes, inventoryRes, userRes] = await Promise.all([
          api.getVehicles(),
          api.getInventory(),
          api.getCurrentUser()
        ]);

        if (userRes.success) {
          if (userRes.data.role === 'accountant') {
            router.push('/dashboard');
            return;
          }
          setUser(userRes.data);
        }

        const vList = vehiclesRes?.data?.vehicles || vehiclesRes?.vehicles || vehiclesRes?.data || [];
        setVehicles(Array.isArray(vList) ? vList : []);

        const normalized = normalizeInventory(inventoryRes);
        setInventory(normalized);

      } catch (err) {
        console.error("Failed to load data:", err);
        setError("Failed to load required data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

  const loadVehicleInventory = useCallback(async () => {
    // Wait for inventory to load first to ensure we can calculate structure
    if (inventory.length === 0 || !selectedVehicle) return;

    setLoading(true);
    try {
      console.log(`[FE] Fetching inventory for vehicle: ${selectedVehicle}`);
      const res = await api.getVehicleInventory(selectedVehicle);
      const items = res.data?.items || res.items || res?.data || [];
      console.log('[FE] Raw Vehicle Inventory Items:', items);

      // Initialize return items with normalized data
      const mapped = items.map(item => {
        // Find corresponding item in main inventory to get structure
        const mainItem = inventory.find(inv => inv.id === item.inventoryId || inv.id === item.id);

        let calculatedStock = 0;
        // Calculate stock from layers if available
        if (item.layers && Array.isArray(item.layers) && mainItem?.packagingStructure) {
          item.layers.forEach(layer => {
            const structLayer = mainItem.packagingStructure.find(l => l.layerIndex === layer.layerIndex);
            // piecesPerUnit is calculated in normalizeInventory
            const multiplier = structLayer?.piecesPerUnit || 1;
            calculatedStock += (layer.quantity || 0) * multiplier;
          });
        } else {
          // Fallback to existing property if layers or main item not found
          calculatedStock = item.quantity !== undefined ? item.quantity : (item.stock || 0);
        }

        return {
          ...item,
          productName: item.productName || mainItem?.productName || 'Unknown', // Ensure name
          returnQty: '',
          stock: calculatedStock,
          maxReturn: calculatedStock,
          unit: item.unit || mainItem?.packagingStructure?.[0]?.unit || 'Pieces'
        };
      });

      console.log('[FE] Mapped Vehicle Inventory:', mapped);
      setReturnItems(mapped);
    } catch (e) {
      console.error("Failed to load vehicle inventory", e);
      setReturnItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedVehicle, inventory]);

  // Fetch Vehicle Inventory when in Return Mode
  useEffect(() => {
    if (transferMode === 'return' && selectedVehicle) {
      loadVehicleInventory();
    } else {
      setReturnItems([]);
    }
  }, [transferMode, selectedVehicle, loadVehicleInventory]);

  // Search Logic (Issue Mode)
  useEffect(() => {
    if (transferMode === 'issue' && searchQuery.trim().length > 1) {
      const term = searchQuery.toLowerCase();
      const filtered = inventory.filter(
        (item) =>
          item.productName?.toLowerCase().includes(term) ||
          item.category?.toLowerCase().includes(term)
      ).slice(0, 5);
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, inventory, transferMode]);

  // Handlers - Issue Mode
  const handleAddIssueItem = (item) => {
    const defaultLayer = item.packagingStructure.find(l => l.stock > 0) || item.packagingStructure[0];
    const initialLayerIndex = defaultLayer.layerIndex !== undefined ? defaultLayer.layerIndex : 0;

    const newItem = {
      internalId: Date.now(),
      inventoryId: item.id,
      productName: item.productName,
      category: item.category,
      packagingStructure: item.packagingStructure,
      selectedLayerIndex: initialLayerIndex,
      quantity: 1,
      maxStock: defaultLayer.stock,
      unit: defaultLayer.unit
    };

    setIssuedItems(prev => [...prev, newItem]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleUpdateIssueRow = (id, field, value) => {
    setIssuedItems(prev => prev.map(row => {
      if (row.internalId !== id) return row;

      if (field === 'quantity') {
        return { ...row, quantity: parseInt(value) || 0 };
      }

      if (field === 'unit') {
        const layerIndex = parseInt(value);
        const layer = row.packagingStructure.find(l => l.layerIndex === layerIndex);
        return {
          ...row,
          selectedLayerIndex: layerIndex,
          unit: layer.unit,
          maxStock: layer.stock,
          quantity: 1
        };
      }
      return row;
    }));
  };

  const handleRemoveIssueRow = (id) => {
    setIssuedItems(prev => prev.filter(r => r.internalId !== id));
  };

  // Handlers - Return Mode
  const handleUpdateReturnQty = (inventoryId, value) => {
    setReturnItems(prev => prev.map(item => {
      if (item.inventoryId === inventoryId || item.id === inventoryId) { // handle id vs inventoryId mismatch if any
        return { ...item, returnQty: value === '' ? '' : parseInt(value) };
      }
      return item;
    }));
  };

  const handleIssueSubmit = async () => {
    if (!selectedVehicle) return alert("Please select a vehicle.");
    if (issuedItems.length === 0) return alert("Please add items to issue.");

    for (const item of issuedItems) {
      if (item.quantity <= 0) return alert(`Invalid quantity for ${item.productName}`);
      if (item.quantity > item.maxStock) return alert(`Insufficient stock for ${item.productName} (${item.unit}). Max: ${item.maxStock}`);
    }

    setSubmitting(true);
    try {
      const itemMap = new Map();
      issuedItems.forEach(row => {
        if (!itemMap.has(row.inventoryId)) {
          itemMap.set(row.inventoryId, { inventoryId: row.inventoryId, layers: [] });
        }
        const entry = itemMap.get(row.inventoryId);
        const existingLayer = entry.layers.find(l => l.layerIndex === row.selectedLayerIndex);

        if (existingLayer) {
          existingLayer.quantity += row.quantity;
        } else {
          entry.layers.push({
            layerIndex: row.selectedLayerIndex ?? 0,
            quantity: row.quantity,
            unit: row.unit
          });
        }
      });

      const payload = {
        vehicleId: selectedVehicle,
        items: Array.from(itemMap.values())
      };

      await api.createTransfer(payload); // Updated API method call

      alert("Stock has been successfully issued to the vehicle.");
      // Optional: Refresh or redirect
      // router.push(`/vehicles/${selectedVehicle}`);
      setIssuedItems([]);
      setSelectedVehicle(""); // Reset selection to force "fresh" state
    } catch (e) {
      console.error("Issue failed", e);
      alert("Failed to issue stock: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnSubmit = async () => {
    if (!selectedVehicle) return alert("Please select a vehicle.");
    const itemsToReturn = returnItems.filter(i => i.returnQty && i.returnQty > 0);

    if (itemsToReturn.length === 0) return alert("Please enter quantities to return.");

    // Validate
    for (const item of itemsToReturn) {
      if (item.returnQty > item.maxReturn) {
        return alert(`Return quantity for ${item.productName} exceeds vehicle stock (${item.maxReturn}).`);
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        vehicleId: selectedVehicle,
        items: itemsToReturn.map(item => ({
          inventoryId: item.inventoryId || item.id,
          quantity: parseInt(item.returnQty),
          unit: item.unit,
          layerIndex: item.layerIndex || 0
        }))
      };

      await api.returnStock(payload);

      alert("Stock successfully returned to inventory.");
      // Refresh return list
      await loadVehicleInventory();
    } catch (e) {
      console.error("Return failed", e);
      alert("Failed to return stock: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !vehicles.length) return <div className="p-10 text-center text-slate-500">Loading...</div>;

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Transfer Stock</h1>
            <p className="text-slate-500 text-sm">Manage vehicle inventory transfers</p>
          </div>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => { setTransferMode('issue'); setSelectedVehicle(''); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${transferMode === 'issue'
            ? 'bg-white shadow text-slate-900'
            : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          Issue to Vehicle
        </button>
        <button
          onClick={() => { setTransferMode('return'); setSelectedVehicle(''); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${transferMode === 'return'
            ? 'bg-white shadow text-slate-900'
            : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          Return from Vehicle
        </button>
      </div>

      {/* Vehicle Selection */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 w-full">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">
          {transferMode === 'issue' ? 'Select Target Vehicle' : 'Select Source Vehicle'}
        </h2>
        <div className="max-w-md">
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="w-full h-10 px-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 text-sm bg-white"
          >
            <option value="">-- Choose Vehicle --</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.vehicleName} ({v.registrationNumber})</option>
            ))}
          </select>
        </div>
      </div>

      {/* ISSUE MODE UI */}
      {transferMode === 'issue' && selectedVehicle && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Search Bar */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 relative z-20">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search item to add..."
                className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 text-sm"
              />
              {/* Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden z-30">
                  {searchResults.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleAddIssueItem(item)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 flex justify-between items-center group"
                    >
                      <div>
                        <div className="font-medium text-slate-800 text-sm">{item.productName}</div>
                        <div className="text-xs text-slate-500">{item.category}</div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        Stock: {item.packagingStructure[0]?.stock} {item.packagingStructure[0]?.unit}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 w-[30%]">Product</th>
                  <th className="px-4 py-3 w-[20%]">Unit</th>
                  <th className="px-4 py-3 w-[15%]">Available</th>
                  <th className="px-4 py-3 w-[15%]">Issue Qty</th>
                  <th className="px-4 py-3 w-[10%] text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issuedItems.map((row) => (
                  <tr key={row.internalId} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-900">{row.productName}</td>
                    <td className="px-4 py-2">
                      <select
                        value={row.selectedLayerIndex}
                        onChange={(e) => handleUpdateIssueRow(row.internalId, 'unit', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-slate-600"
                      >
                        {row.packagingStructure.map(layer => (
                          <option key={layer.layerIndex} value={layer.layerIndex}>{layer.unit}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-slate-500">{row.maxStock}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="1"
                        max={row.maxStock}
                        value={row.quantity}
                        onChange={(e) => handleUpdateIssueRow(row.internalId, 'quantity', e.target.value)}
                        className="w-20 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-center focus:outline-none focus:border-slate-400"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button onClick={() => handleRemoveIssueRow(row.internalId)} className="text-slate-400 hover:text-rose-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {issuedItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      <Package size={40} className="mx-auto mb-3 opacity-50" />
                      <p>No items added yet. Use search above.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleIssueSubmit}
              disabled={submitting || issuedItems.length === 0}
              className="bg-slate-900 text-white px-8 py-3 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {submitting ? 'Issuing...' : <><Save size={18} /> Confirm Issue</>}
            </button>
          </div>
        </div>
      )}

      {/* RETURN MODE UI */}
      {transferMode === 'return' && selectedVehicle && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm flex gap-2">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            <p>You are viewing items currently loaded in the vehicle. Enter quantities to return back to the main inventory.</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 w-[40%]">Product</th>
                    <th className="px-4 py-3 w-[20%]">Unit</th>
                    <th className="px-4 py-3 w-[20%] text-center">In Vehicle</th>
                    <th className="px-4 py-3 w-[20%] text-center">Return Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnItems.map((item) => (
                    <tr key={item.inventoryId || item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{item.productName}</td>
                      <td className="px-4 py-2 text-slate-600">{item.unit}</td>
                      <td className="px-4 py-2 text-center font-medium">{item.stock}</td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          max={item.maxReturn}
                          value={item.returnQty}
                          placeholder="0"
                          onChange={(e) => handleUpdateReturnQty(item.inventoryId || item.id, e.target.value)}
                          className="w-24 bg-white border border-slate-200 rounded px-2 py-1 text-center focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                        />
                      </td>
                    </tr>
                  ))}
                  {returnItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                        <Truck size={40} className="mx-auto mb-3 opacity-50" />
                        <p>No items found in this vehicle.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleReturnSubmit}
              disabled={submitting || !returnItems.some(i => i.returnQty > 0)}
              className="bg-emerald-600 text-white px-8 py-3 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm shadow-emerald-200"
            >
              {submitting ? 'Processing...' : <><Save size={18} /> Confirm Return</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}