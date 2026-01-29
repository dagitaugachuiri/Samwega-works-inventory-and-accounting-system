import { useMemo } from "react";

export default function StoreStockSection({ layers, layerStock, onLayerStockChange, isEditing }) {
  if (!layers || layers.length === 0) return null;

  const parsed = useMemo(() => layers.map((l) => ({ qty: parseInt(l.qty) || 1, unit: l.unit })), [layers]);

  const handleChange = (i, raw) => {
    const val = Math.max(0, parseInt(raw || 0));
    const updated = { ...layerStock };

    if (i === 0) {
      // master layer: free-form count
      updated[0] = val.toString();
    } else {
      const qtyPerSet = parsed[i].qty || 1;
      const maxLoose = Math.max(0, qtyPerSet - 1);
      // clamp to allowed loose amount (not exceeding units per above layer)
      const clamped = Math.min(val, maxLoose);
      updated[i] = clamped.toString();
    }

    onLayerStockChange(updated);
  };

  return (
    <div className="mt-6 glass-panel p-5 bg-slate-50">
      <h4 className="mb-3 text-xs font-semibold text-slate-700">Store Stock (tally)</h4>
      <div className="space-y-3">
        {layers.map((l, i) => {
          const qtyPerSet = parsed[i].qty;
          const maxLoose = i === 0 ? null : Math.max(0, qtyPerSet - 1);
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="w-44 text-sm">
                <div className="font-semibold">{i === 0 ? "Master" : i === layers.length - 1 ? "Retail" : `Layer ${i}`}</div>
                <div className="text-xs text-slate-500">{l.qty} × {l.unit}</div>
              </div>

              <div className="flex-1">
                <input
                  type="number"
                  value={layerStock[i] || "0"}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  className="input-field text-sm w-full disabled:bg-slate-100 disabled:text-slate-500"
                  disabled={isEditing}
                />
                {isEditing && i === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Stock cannot be edited directly. Use Replenish/Adjust.</p>
                )}
                {!isEditing && i > 0 && (
                  <p className="text-xs text-slate-500 mt-1">Loose (not part of full {layers[i - 1]?.unit}): max {maxLoose}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
