"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Trash2, ArrowLeft, Package, Minus, Truck, CheckCircle2, AlertCircle, Scissors } from "lucide-react";
import Link from "next/link";
import api from "../../lib/api";

const normalizeInventory = (data) => {
  const list = Array.isArray(data) ? data : (data?.data || []);
  return list.map(item => {
    let structure = item.packagingStructure;
    let subUnitsPerSupplierUnit = item.subUnitsPerSupplierUnit;

    if (structure && Array.isArray(structure)) {
      structure = structure.map(l => ({ ...l }));
      structure.forEach(layer => {
        if (layer.stock === undefined) layer.stock = 0;
      });
      if (!subUnitsPerSupplierUnit && structure.length > 1) {
        if (structure[1].qty) {
          subUnitsPerSupplierUnit = structure[1].qty;
        }
      }
    } else if (structure && !Array.isArray(structure) && structure.outer) {
      structure = [
        { unit: structure.outer.unit, stock: item.stockInSupplierUnits || 0, layerIndex: 0 },
        { unit: structure.inner.unit, stock: item.stockInSubUnits || 0, layerIndex: 1 }
      ];
    } else {
      structure = [];
      structure.push({
        unit: item.supplierUnit || 'CTN',
        stock: item.stockInSupplierUnits || 0,
        layerIndex: 0
      });
      if (item.hasSubUnits) {
        structure.push({
          unit: item.subUnitName || 'PCS',
          stock: item.stockInSubUnits || 0,
          layerIndex: 1
        });
      }
    }

    return {
      ...item,
      packagingStructure: structure,
      subUnitsPerSupplierUnit: subUnitsPerSupplierUnit || item.subUnitsPerSupplierUnit
    };
  });
};

export default function IssueStockUnified() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [search, setSearch] = useState("");
  const [issuedItems, setIssuedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch vehicles and inventory
  useEffect(() => {
    const fetchData = async () => {
      // Fetch vehicles
      try {
        const vehiclesResponse = await api.getVehicles();
        // Response is: { success, message, data: { vehicles: [...], pagination: {...} } }
        const vList = vehiclesResponse?.data?.vehicles || vehiclesResponse?.vehicles || vehiclesResponse?.data || [];
        setVehicles(Array.isArray(vList) ? vList : []);
      } catch (err) {
        console.error("Failed to fetch vehicles:", err);
      }

      // Fetch inventory
      try {
        const inventoryData = await api.getInventory();
        const normalizedInventory = normalizeInventory(inventoryData);
        setInventory(normalizedInventory);
        setFilteredInventory(normalizedInventory);
      } catch (err) {
        console.error("Failed to fetch inventory:", err);
        setError(err.message);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  // Search filter
  useEffect(() => {
    if (search.trim()) {
      const term = search.toLowerCase();
      const filtered = inventory.filter(
        (item) =>
          item.productName?.toLowerCase().includes(term) ||
          item.category?.toLowerCase().includes(term)
      );
      setFilteredInventory(filtered);
    } else {
      setFilteredInventory(inventory);
    }
  }, [search, inventory]);

  // --- CART LOGIC ---

  const getCartItem = (inventoryId) => {
    return issuedItems.find(i => i.inventoryId === inventoryId);
  };

  const getLayerInCart = (inventoryId, layerIndex) => {
    const item = getCartItem(inventoryId);
    if (!item) return null;
    return item.layers.find(l => l.layerIndex === layerIndex);
  };

  const handleUpdateQuantity = (item, layerIndex, delta) => {
    const layer = item.packagingStructure[layerIndex];
    const existingItemIndex = issuedItems.findIndex(i => i.inventoryId === item.id);

    let newItems = [...issuedItems];

    if (existingItemIndex === -1) {
      // Item not in cart, add it if delta > 0
      if (delta > 0) {
        newItems.push({
          inventoryId: item.id,
          productName: item.productName,
          layers: [{
            layerIndex,
            unit: layer.unit,
            quantity: delta,
            maxQty: layer.stock || 0
          }]
        });
      }
    } else {
      // Item exists
      const existingItem = newItems[existingItemIndex];
      const existingLayerIndex = existingItem.layers.findIndex(l => l.layerIndex === layerIndex);

      if (existingLayerIndex === -1) {
        // Layer not in cart, add it if delta > 0
        if (delta > 0) {
          existingItem.layers.push({
            layerIndex,
            unit: layer.unit,
            quantity: delta,
            maxQty: layer.stock || 0
          });
        }
      } else {
        // Layer exists, update qty
        const currentQty = existingItem.layers[existingLayerIndex].quantity;
        const newQty = currentQty + delta;

        if (newQty <= 0) {
          // Remove layer
          existingItem.layers.splice(existingLayerIndex, 1);
          // If no layers left, remove item
          if (existingItem.layers.length === 0) {
            newItems.splice(existingItemIndex, 1);
          }
        } else {
          // Update qty (respect max)
          existingItem.layers[existingLayerIndex].quantity = Math.min(newQty, layer.stock || 0);
        }
      }
    }

    setIssuedItems(newItems);
  };

  const handleSetQuantity = (item, layerIndex, quantity) => {
    const inventoryItem = inventory.find(i => i.id === item.inventoryId);
    if (!inventoryItem) return;

    const layer = inventoryItem.packagingStructure[layerIndex];
    const maxStock = layer.stock || 0;
    const newQty = Math.max(0, Math.min(quantity, maxStock));

    let newItems = [...issuedItems];
    const existingItemIndex = newItems.findIndex(i => i.inventoryId === item.inventoryId);

    if (existingItemIndex !== -1) {
      const existingItem = newItems[existingItemIndex];
      const existingLayerIndex = existingItem.layers.findIndex(l => l.layerIndex === layerIndex);

      if (existingLayerIndex !== -1) {
        if (newQty <= 0) {
          existingItem.layers.splice(existingLayerIndex, 1);
          if (existingItem.layers.length === 0) {
            newItems.splice(existingItemIndex, 1);
          }
        } else {
          existingItem.layers[existingLayerIndex].quantity = newQty;
        }
      }
    }
    setIssuedItems(newItems);
  };

  const handleBreakUnit = async (item) => {
    const masterUnit = item.packagingStructure[0]?.unit || 'Unit';
    if (!confirm(`Are you sure you want to break 1 ${masterUnit} of ${item.productName}?`)) return;

    try {
      await api.request(`/inventory/${item.id}/break`, {
        method: 'POST',
        body: JSON.stringify({ quantity: 1 })
      });

      // Refresh inventory
      const invData = await api.getInventory();
      const normalizedInventory = normalizeInventory(invData);

      setInventory(normalizedInventory);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemoveItem = (inventoryId) => {
    setIssuedItems(issuedItems.filter(i => i.inventoryId !== inventoryId));
  };

  const getTotalQuantity = () => {
    return issuedItems.reduce((sum, item) =>
      sum + item.layers.reduce((layerSum, layer) => layerSum + layer.quantity, 0), 0
    );
  };

  const handleSubmitIssuance = async () => {
    if (!selectedVehicle) {
      alert("Please select a vehicle");
      return;
    }
    if (issuedItems.length === 0) {
      alert("Please select at least one item");
      return;
    }

    setSubmitting(true);

    // Helper to normalize unit names to match backend validator
    const normalizeUnit = (unit, layerIndex) => {
      if (!unit) {
        // Default based on layer index
        return layerIndex === 0 ? 'carton' : layerIndex === 1 ? 'box' : 'piece';
      }
      const unitLower = unit.toLowerCase();
      if (unitLower.includes('carton') || unitLower.includes('ctn')) return 'carton';
      if (unitLower.includes('box') || unitLower.includes('pack')) return 'box';
      if (unitLower.includes('piece') || unitLower.includes('pcs') || unitLower.includes('unit')) return 'piece';
      // Default based on layer
      return layerIndex === 0 ? 'carton' : layerIndex === 1 ? 'box' : 'piece';
    };

    try {
      const payload = {
        vehicleId: selectedVehicle,
        items: issuedItems.map(item => ({
          inventoryId: item.inventoryId,
          layers: item.layers.map(l => ({
            layerIndex: l.layerIndex,
            quantity: l.quantity,
            unit: normalizeUnit(l.unit, l.layerIndex)
          }))
        }))
      };

      console.log("Submitting transfer payload:", payload);

      await api.request('/transfers', {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Success
      setIssuedItems([]);
      setSearch("");
      alert("Stock issued successfully!");
      router.push(`/vehicles/${selectedVehicle}`);
    } catch (err) {
      console.error("Error submitting issuance", err);
      alert(`Failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-sky-600" />
          <p className="text-sm text-slate-500">Loading data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="btn-ghost text-xs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Issue Stock</h1>
            <p className="text-xs text-slate-500">Quickly issue items to vehicles</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">

        {/* LEFT COLUMN: Vehicle Selection (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4 h-full overflow-hidden">
          <div className="glass-panel p-4 flex-1 flex flex-col overflow-hidden">
            <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Truck size={16} className="text-sky-600" />
              Select Vehicle
            </h2>
            <div className="overflow-y-auto space-y-2 pr-2 flex-1">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  onClick={() => setSelectedVehicle(v.id)}
                  className={`cursor-pointer rounded-lg border p-3 transition-all ${selectedVehicle === v.id
                    ? "border-sky-600 bg-sky-50 ring-1 ring-sky-600"
                    : "border-slate-200 bg-white hover:border-sky-300"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 text-sm">{v.vehicleName}</span>
                    {selectedVehicle === v.id && <CheckCircle2 className="text-sky-600" size={16} />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-mono">{v.registrationNumber}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: Inventory Browser (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4 h-full overflow-hidden">
          <div className="glass-panel p-4 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Package size={16} className="text-sky-600" />
                Inventory
              </h2>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs focus:border-sky-500 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto pr-2 flex-1 space-y-3">
              {filteredInventory.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">{item.productName}</h3>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{item.category}</p>
                    </div>
                    {item.packagingStructure && item.packagingStructure.length > 1 && item.subUnitsPerSupplierUnit > 0 && (
                      <button
                        onClick={() => handleBreakUnit(item)}
                        className="text-xs flex items-center gap-1 text-amber-600 hover:text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200"
                        title="Break 1 Master Unit into Sub Units"
                      >
                        <Scissors size={12} />
                        Break {item.packagingStructure[0].unit}
                      </button>
                    )}
                  </div>

                  {/* Quick Add Layers */}
                  <div className="flex flex-wrap gap-2">
                    {item.packagingStructure.map((layer, idx) => {
                      const isMeasurement = /\b(KG|G|ML|L)\b/.test(layer.unit?.toUpperCase() || "");
                      if (isMeasurement || layer.stock === null) return null;

                      const cartLayer = getLayerInCart(item.id, idx);
                      const qtyInCart = cartLayer ? cartLayer.quantity : 0;
                      const maxStock = layer.stock || 0;

                      return (
                        <div key={idx} className={`flex items-center rounded-md border text-xs ${qtyInCart > 0 ? 'border-sky-200 bg-sky-50' : 'border-slate-200 bg-slate-50'}`}>
                          <div className="px-2 py-1.5 border-r border-inherit">
                            <span className="font-bold text-slate-700">{maxStock}</span>
                            <span className="text-slate-500 ml-1">{layer.unit}</span>
                          </div>

                          {qtyInCart === 0 ? (
                            <button
                              onClick={() => handleUpdateQuantity(item, idx, 1)}
                              disabled={maxStock === 0}
                              className="px-3 py-1.5 font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Add
                            </button>
                          ) : (
                            <div className="flex items-center">
                              <button
                                onClick={() => handleUpdateQuantity(item, idx, -1)}
                                className="px-2 py-1.5 hover:bg-sky-200 text-sky-700 transition-colors"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="w-6 text-center font-bold text-sky-800">{qtyInCart}</span>
                              <button
                                onClick={() => handleUpdateQuantity(item, idx, 1)}
                                disabled={qtyInCart >= maxStock}
                                className="px-2 py-1.5 hover:bg-sky-200 text-sky-700 disabled:opacity-50 transition-colors"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {filteredInventory.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm">
                  No items found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Cart & Action (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4 h-full overflow-hidden">
          <div className="glass-panel p-4 flex-1 flex flex-col overflow-hidden border-2 border-sky-100">
            <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                To Issue
              </span>
              <span className="bg-sky-100 text-sky-700 text-xs font-bold px-2 py-0.5 rounded-full">{issuedItems.length}</span>
            </h2>

            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              {issuedItems.length > 0 ? (
                issuedItems.map((item) => (
                  <div key={item.inventoryId} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-slate-900 line-clamp-1">{item.productName}</span>
                      <button onClick={() => handleRemoveItem(item.inventoryId)} className="text-rose-400 hover:text-rose-600">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {item.layers.map((l, i) => (
                        <div key={i} className="flex justify-between items-center text-xs bg-slate-50 px-2 py-1 rounded">
                          <span className="text-slate-600">{l.unit}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 text-[10px]">x</span>
                            <input
                              type="number"
                              min="1"
                              value={l.quantity}
                              onChange={(e) => handleSetQuantity(item, l.layerIndex, parseInt(e.target.value) || 0)}
                              className="w-12 text-right font-mono font-bold text-slate-900 bg-transparent border-b border-slate-300 focus:border-sky-500 focus:outline-none p-0"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs text-center p-4 border-2 border-dashed border-slate-100 rounded-lg">
                  <Package size={32} className="mb-2 opacity-50" />
                  <p>Select items from the inventory list to add them here.</p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-slate-500">Total Units</span>
                <span className="text-lg font-bold text-slate-900">{getTotalQuantity()}</span>
              </div>

              {!selectedVehicle && (
                <div className="mb-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  <AlertCircle size={14} />
                  Select a vehicle first
                </div>
              )}

              <button
                onClick={handleSubmitIssuance}
                disabled={submitting || !selectedVehicle || issuedItems.length === 0}
                className="w-full btn-primary py-3 text-sm font-bold shadow-lg shadow-sky-200 disabled:shadow-none"
              >
                {submitting ? "Issuing..." : "Confirm Issue"}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}