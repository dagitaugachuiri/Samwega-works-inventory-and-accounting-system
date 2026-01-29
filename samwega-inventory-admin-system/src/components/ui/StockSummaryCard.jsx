// components/inventory/ui/StockSummaryCard.jsx
import { isMeasurementUnit } from "@/lib/unitUtils";

export default function StockSummaryCard({ layerStock, getCumulativeQtyUpTo, unit, layers }) {
  // Only count layers that are NOT measurement units
  const totalPieces = Object.keys(layerStock).reduce((sum, key) => {
    const i = parseInt(key);
    // Skip measurement unit layers
    if (layers && layers[i] && isMeasurementUnit(layers[i].unit)) {
      return sum;
    }
    // For the innermost layer (retail pieces) the stock is already in pieces and should not be multiplied again
    const isInnermost = layers && i === layers.length - 1;
    const multiplier = isInnermost ? 1 : getCumulativeQtyUpTo(i);
    return sum + (parseInt(layerStock[i] || 0) * (multiplier || 0));
  }, 0);

  // Get the last non-measurement unit for display
  let displayUnit = unit;
  if (layers && layers.length > 0) {
    for (let i = layers.length - 1; i >= 0; i--) {
      if (!isMeasurementUnit(layers[i].unit)) {
        displayUnit = layers[i].unit;
        break;
      }
    }
  }

  return (
    <div className="glass-panel p-6 text-center mt-6 bg-emerald-50 border-emerald-200">
      <p className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">Total Pieces Currently in Stock</p>
      <p className="text-4xl font-bold text-emerald-900 mt-3">
        {totalPieces.toLocaleString()} <span className="text-2xl">{displayUnit}</span>
      </p>
      {totalPieces > 0 && (
        <p className="mt-2 text-xs text-emerald-700">Auto-normalized across all layers</p>
      )}
    </div>
  );
}