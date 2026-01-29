"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, AlertTriangle, TrendingUp } from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export default function ItemDetailsPage() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;

    // Try to restore from sessionStorage if navigated from dashboard
    if (typeof window !== "undefined") {
      try {
        const cached = window.sessionStorage.getItem("itemDetails");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id?.toString() === id.toString()) {
            setItem(parsed);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error("Failed to restore cached item details", e);
      }
    }

    const fetchItem = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/inventory/${id}`);
        if (!res.ok) {
          throw new Error(`Failed to load item (status ${res.status})`);
        }
        const data = await res.json();
        setItem(data);
      } catch (err) {
        setError(err.message || "Failed to load item");
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [id]);

  const calculateTotalPieces = (itemData) => {
    if (!itemData) return 0;

    // Prefer packagingStructure when available (handles loose/master units)
    if (Array.isArray(itemData.packagingStructure) && itemData.packagingStructure.length > 0) {
      const layers = itemData.packagingStructure;

      const isMeasurement = (u) => {
        try { return /\b(KG|G|ML|L)\b/.test((u||'').toString().toUpperCase()); } catch { return false; }
      };

      const piecesPerLayer = (index) => {
        // product of qty of inner layers (index+1 .. end), skipping measurement units
        let acc = 1;
        for (let i = index + 1; i < layers.length; i++) {
          const l = layers[i];
          if (!l) continue;
          if (isMeasurement(l.unit)) continue;
          acc *= parseInt(l.qty) || 1;
        }
        return acc;
      };

      let total = 0;
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (!layer) continue;
        if (isMeasurement(layer.unit)) continue;
        const stock = parseInt(layer.stock) || 0;
        const multiplier = piecesPerLayer(i);
        total += stock * multiplier;
      }

      return total;
    }

    // Fallback to legacy supplier/sub-unit fields
    if (itemData.supplierUnit === "UNIT") return itemData.stockInSupplierUnits;

    const fullUnitPieces = (itemData.stockInSupplierUnits || 0) * (itemData.supplierUnitQuantity || 1);
    const subUnitPieces =
      itemData.hasSubUnits && itemData.stockInSubUnits
        ? (itemData.stockInSubUnits || 0) * (itemData.piecesPerSubUnit || 1)
        : 0;

    return fullUnitPieces + subUnitPieces;
  };

  const calculateProfit = (itemData) => {
    if (
      !itemData?.buyingPricePerUnit ||
      !itemData?.sellingPricePerPiece ||
      !itemData?.supplierUnitQuantity
    )
      return null;
    const costPerPiece =
      itemData.buyingPricePerUnit / itemData.supplierUnitQuantity;
    const profitPerPiece = itemData.sellingPricePerPiece - costPerPiece;
    const profitMargin = ((profitPerPiece / costPerPiece) * 100).toFixed(0);
    return {
      profitPerPiece: profitPerPiece.toFixed(2),
      profitMargin,
    };
  };

  const getPiecesPerSupplierUnit = (itemData) => {
    if (!itemData) return 1;
    if (Array.isArray(itemData.packagingStructure) && itemData.packagingStructure.length > 0) {
      const layers = itemData.packagingStructure;
      const isMeasurement = (u) => {
        try { return /\b(KG|G|ML|L)\b/.test((u||'').toString().toUpperCase()); } catch { return false; }
      };
      // product of qty of inner layers (index 1 .. end)
      let acc = 1;
      for (let i = 1; i < layers.length; i++) {
        const l = layers[i];
        if (!l) continue;
        if (isMeasurement(l.unit)) continue;
        acc *= parseInt(l.qty) || 1;
      }
      return acc || 1;
    }
    return itemData.supplierUnitQuantity || 1;
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-slate-500">Loading item details…</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-medium text-rose-600">
          {error || "Item not found"}
        </p>
        <Link
          href="/dashboard"
          className="btn-ghost inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft size={14} />
          Back to inventory
        </Link>
      </div>
    );
  }

  const totalPieces = calculateTotalPieces(item);
  const profit = calculateProfit(item);
  const isLowStock = item.stockInSupplierUnits <= item.lowStockAlert;
  const isOutOfStock = item.stockInSupplierUnits === 0;

  // compute derived UI values
  const piecesPerSupplierUnit = getPiecesPerSupplierUnit(item);
  const profitPerMasterUnit = (() => {
    if (!item) return null;
    // Get supplier unit selling price: from packagingStructure[0] or fallback calculation
    let supplierUnitSellingPrice = null;
    const pkg = Array.isArray(item.packagingStructure) ? item.packagingStructure : null;
    if (pkg && pkg.length > 0) {
      supplierUnitSellingPrice = pkg[0]?.sellingPrice ?? null;
    }
    if (!supplierUnitSellingPrice && item.sellingPricePerPiece && item.supplierUnitQuantity) {
      supplierUnitSellingPrice = item.sellingPricePerPiece * item.supplierUnitQuantity;
    }
    // Calculate profit: my selling price per supplier unit - supplier cost per supplier unit
    if (supplierUnitSellingPrice != null && item.buyingPricePerUnit != null) {
      return Number(supplierUnitSellingPrice) - Number(item.buyingPricePerUnit);
    }
    return null;
  })();

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="btn-ghost inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft size={14} />
            Back
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {item.productName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="chip px-3 py-1 text-xs">
                Category: {item.category}
              </span>
              {isOutOfStock && (
                <span className="pill-badge-red text-[11px]">
                  Out of stock
                </span>
              )}
              {!isOutOfStock && isLowStock && (
                <span className="pill-badge-amber text-[11px]">
                  Low stock
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/${item.id}/edit`}
            className="btn-primary text-xs"
            onClick={() => {
              try {
                if (typeof window !== 'undefined') {
                  window.sessionStorage.setItem('editItem', JSON.stringify(item));
                }
              } catch (e) {
                console.error('Failed to cache editItem', e);
              }
            }}
          >
            Edit item
          </Link>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="glass-panel flex flex-col justify-between px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Stock in store
          </p>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <p className="text-3xl font-semibold text-slate-900">
                {item.stockInSupplierUnits}
              </p>
              <p className="text-xs text-slate-500">
                {item.supplierUnit || "CTN"}
              </p>
            </div>
            <Package size={24} className="text-sky-500/80" />
          </div>
        </div>

        <div className="glass-panel flex flex-col justify-between px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-600">
            Sellable pieces
          </p>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-2xl font-semibold text-slate-900">
              {totalPieces.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="glass-panel flex flex-col justify-between px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-600">
            Profit per piece
          </p>
          <div className="mt-2 flex items-end justify-between">
            {profit ? (
              <>
                <div>
                  <p className="text-xl font-semibold text-emerald-700">
                    KSh {profit.profitPerPiece}
                  </p>
                  <p className="text-xs text-slate-500">
                    Margin: +{profit.profitMargin}%
                  </p>
                </div>
                <TrendingUp size={24} className="text-emerald-400/80" />
              </>
            ) : (
              <p className="text-xs text-slate-500">
                Add supplier & retail price to see profit.
              </p>
            )}
          </div>
        </div>

        <div className="glass-panel flex flex-col justify-between px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-600">
            Profit per {item.supplierUnit || 'master'}
          </p>
          <div className="mt-2 flex items-end justify-between">
            {profitPerMasterUnit != null ? (
              <>
                <div>
                  <p className="text-xl font-semibold text-violet-700">
                    KSh {Number(profitPerMasterUnit).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}
                  </p>
                  <p className="text-xs text-slate-500">({piecesPerSupplierUnit} pieces)</p>
                </div>
                <TrendingUp size={24} className="text-violet-400/80" />
              </>
            ) : (
              <p className="text-xs text-slate-500">Add supplier & retail price to see profit.</p>
            )}
          </div>
        </div>
        {/* add profit per master unit also*/}
      </div>

      {/* Layout: left = pricing/stock, right = packaging & raw fields */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Left: prices & alerts */}
        <div className="md:col-span-2 space-y-4">
          <div className="glass-panel bg-white px-4 py-4">
            <h2 className="mb-3 text-lg font-semibold text-slate-800">
              Pricing
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Supplier price</p>
                <p className="text-2xl font-semibold text-rose-900">
                  KSh {(item.buyingPricePerUnit || 0).toLocaleString()}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    per {item.supplierUnit || "CTN"}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">My price per {item.supplierUnit || "CTN"}</p>
                <p className="text-base font-semibold text-emerald-700">
                  {
                    (() => {
                      // Prefer a supplier-unit level price saved in packagingStructure (outermost layer)
                      const pkg = Array.isArray(item.packagingStructure) ? item.packagingStructure : null;
                      let supplierUnitPrice = null;
                      if (pkg && pkg.length > 0) {
                        supplierUnitPrice = pkg[0]?.sellingPrice ?? null;
                      }
                      // Fallback: derive from sellingPricePerPiece * supplierUnitQuantity
                      if (!supplierUnitPrice && item.sellingPricePerPiece && item.supplierUnitQuantity) {
                        supplierUnitPrice = item.sellingPricePerPiece * item.supplierUnitQuantity;
                      }
                      if (supplierUnitPrice != null) {
                        return `KSh ${Number(supplierUnitPrice).toLocaleString()}`;
                      }
                      return "-";
                    })()
                  }
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">My price per piece</p>
                <p className="text-base font-semibold text-emerald-700">
                  KSh {(item.sellingPricePerPiece || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Low stock alert</p>
                <p className="text-base font-semibold text-slate-900">
                  {item.lowStockAlert} {item.supplierUnit || "CTN"}
                </p>
              </div>
            </div>
          </div>

          {/* <div className="glass-panel px-4 py-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">
              Stock breakdown
            </h2>
            <div className="space-y-2 text-sm">
              <p className="text-xs text-slate-500">
                Supplier units in store:
              </p>
              <p className="text-base font-semibold text-slate-900">
                {item.stockInSupplierUnits} {item.supplierUnit || "CTN"}
              </p>
              {item.hasSubUnits && (
                <>
                  <p className="mt-2 text-xs text-slate-500">
                    Sub-units in store:
                  </p>
                  <p className="text-base font-semibold text-slate-900">
                    {item.stockInSubUnits} {item.subUnitName}
                  </p>
                </>
              )}
              {isLowStock && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700 ring-1 ring-amber-200">
                  <AlertTriangle size={14} />
                  <span>
                    Low stock: below {item.lowStockAlert}{" "}
                    {item.supplierUnit || "CTN"}
                  </span>
                </div>
              )}
            </div>
          </div> */}
        </div>

        {/* Right: packaging structure & raw data */}
        <div className="space-y-4">
          <div className="glass-panel px-4 py-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">
              Packaging structure
            </h2>
            {Array.isArray(item.packagingStructure) &&
            item.packagingStructure.length > 0 ? (
              <div className="space-y-2 text-sm">
                {item.packagingStructure.map((layer, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <div>
                      <p className="text-xs font-medium text-slate-700">
                        Layer {idx + 1}
                      </p>
                      <p className="text-sm text-slate-900">
                        {layer.qty} {layer.unit}
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                      {layer.sellingPrice != null && (
                        <p>
                          Price: KSh{" "}
                          {Number(layer.sellingPrice).toLocaleString()}
                        </p>
                      )}
                      {layer.stock != null && (
                        <p>Stock: {layer.stock}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No packaging structure recorded for this item.
              </p>
            )}
          </div>

          {/* <div className="glass-panel px-4 py-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">
              Other details
            </h2>
            <dl className="space-y-1 text-xs text-slate-600">
              <div className="flex justify-between gap-3">
                <dt>Supplier unit quantity</dt>
                <dd className="font-medium text-slate-900">
                  {item.supplierUnitQuantity}
                </dd>
              </div>
              {item.subUnitName && (
                <div className="flex justify-between gap-3">
                  <dt>Sub-unit name</dt>
                  <dd className="font-medium text-slate-900">
                    {item.subUnitName}
                  </dd>
                </div>
              )}
              {item.piecesPerSubUnit && (
                <div className="flex justify-between gap-3">
                  <dt>Pieces per sub-unit</dt>
                  <dd className="font-medium text-slate-900">
                    {item.piecesPerSubUnit}
                  </dd>
                </div>
              )}
            </dl>
          </div> */}
        </div>
      </div>
    </div>
  );
}


