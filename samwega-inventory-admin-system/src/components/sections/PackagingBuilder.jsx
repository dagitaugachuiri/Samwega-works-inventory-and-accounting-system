// components/inventory/sections/PackagingBuilder.jsx
import { Package, X } from "lucide-react";
import { useEffect } from "react";
import { isMeasurementUnit } from "@/lib/unitUtils";

export default function PackagingBuilder({ layers, onUpdate }) {
  // Ensure first layer always exists and represents the supplier unit as 1 pack
  useEffect(() => {
    if (!Array.isArray(layers) || layers.length === 0) {
      onUpdate([{ qty: "1", unit: "BOXES" }]);
    }
  }, [layers, onUpdate]);

  const addLayer = () => onUpdate([...layers, { qty: "", unit: "PCS" }]);
  const updateLayer = (i, field, val) => {
    // Prevent changing the qty of the first layer (always 1)
    if (i === 0 && field === "qty") return;
    const updated = [...layers];
    updated[i][field] = field === "unit" ? val.toUpperCase() : val;
    onUpdate(updated);
  };
  const removeLayer = (i) => onUpdate(layers.filter((_, idx) => idx !== i));

  const totalPieces = layers.reduce((acc, l, i) => {
    const qty = parseInt(l.qty) || 1;
    if (i === 0) return qty;
    if (isMeasurementUnit(l.unit)) return acc; // don't multiply by measurement units like KG, ML, etc.
    return acc * qty;
  }, 1);
  const innermostUnit = layers[layers.length - 1]?.unit || "PCS";

  return (
    <div className="glass-panel p-6">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Package className="text-sky-600" /> Packaging Structure
      </h3>

      {layers.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">No packaging detected</p>
          <button
            onClick={() => onUpdate([{ qty: "", unit: "PCS" }])}
            className="btn-primary px-6 py-2 text-sm"
          >
            + Add Layer
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {layers.map((layer, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                {i > 0 && <span className="text-xl text-slate-400">×</span>}
                <input
                  type="number"
                  placeholder="Qty"
                  value={layer.qty || (i === 0 ? "1" : "")}
                  onChange={(e) => updateLayer(i, "qty", e.target.value)}
                  className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-center"
                  disabled={i === 0}
                />
                <input
                  type="text"
                  placeholder="Unit"
                  value={layer.unit}
                  onChange={(e) => updateLayer(i, "unit", e.target.value)}
                  list="units"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                {layers.length > 1 && i > 0 && (
                  <button onClick={() => removeLayer(i)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50">
                    <X size={20} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={addLayer}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <Package size={16} /> Add another layer
          </button>

          {totalPieces > 1 && (
            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-600">
              <p className="text-[11px] font-medium text-slate-500">Total sellable units per master</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {totalPieces.toLocaleString()} {innermostUnit}
              </p>
            </div>
          )}
        </>
      )}

      <datalist id="units">
        <option value="PCS" /><option value="PACKS" /><option value="BOXES" /><option value="TRAYS" />
        <option value="SACHETS" /><option value="POUCHES" /><option value="CARTONS" /><option value="BALES" />
      </datalist>
    </div>
  );
}