// components/inventory/sections/PricingAndStockSection.jsx
import { useEffect, useState } from "react";
import LayerCard from "../ui/LayerCard";
import StockSummaryCard from "../ui/StockSummaryCard";
import StoreStockSection from "./StoreStockSection";
import { Package } from "lucide-react";
import { isMeasurementUnit } from "@/lib/unitUtils";

export default function PricingAndStockSection({
  buyingPrice,
  onBuyingPriceChange,
  layers,
  layerPrices,
  layerStock,
  onLayerPriceChange,
  onLayerStockChange,
  isEditing,
}) {
  const [autoCalcEnabled, setAutoCalcEnabled] = useState(false);
  // Returns number of innermost pieces contained in one unit of the layer at `index`.
  // This multiplies only the inner layers (index+1 .. last), so the innermost layer returns 1.
  const getCumulativeQtyUpTo = (index) => {
    if (!layers || index < 0 || index >= layers.length) return 1;
    let acc = 1;
    for (let i = index + 1; i < layers.length; i++) {
      const l = layers[i];
      if (isMeasurementUnit(l.unit)) continue;
      const qty = parseInt(l.qty) || 1;
      acc *= qty;
    }
    return acc;
  };

  // Auto-normalize stock whenever layers or stock changes
  useEffect(() => {
    if (layers.length < 2) return;

    const newStock = { ...layerStock };
    let changed = false;
    for (let i = layers.length - 1; i > 0; i--) {
      if (isMeasurementUnit(layers[i].unit)) continue; // don't auto-normalize based on measurement units
      const qtyPerSet = parseInt(layers[i].qty) || 1;
      const current = parseInt(newStock[i] || 0);
      if (current >= qtyPerSet) {
        const sets = Math.floor(current / qtyPerSet);
        const remainder = current % qtyPerSet;
        newStock[i - 1] = (parseInt(newStock[i - 1] || 0) + sets).toString();
        newStock[i] = remainder.toString();
        changed = true;
      }
    }
    // Only update if normalization produced changes
    const same = Object.keys(newStock).length === Object.keys(layerStock).length &&
      Object.keys(newStock).every(k => (newStock[k] || "").toString() === (layerStock[k] || "").toString());
    if (!same) onLayerStockChange(newStock);
  }, [layers, layerStock]);

  // Auto-calculate subsequent layer prices based on master unit selling price
  // Runs when auto-calc is toggled, the master selling price changes, or layers change.
  // Avoids causing an update loop by not calling onLayerPriceChange when values are identical.
  useEffect(() => {
    if (!autoCalcEnabled || !layerPrices[0] || layers.length <= 1) return;

    const totalPiecesPerMaster = getCumulativeQtyUpTo(0);
    const masterSellingPrice = parseFloat(layerPrices[0]) || 0;
    const sellingPerPiece = totalPiecesPerMaster > 0 ? masterSellingPrice / totalPiecesPerMaster : 0;

    const newPrices = { ...layerPrices };
    for (let i = 1; i < layers.length; i++) {
      if (isMeasurementUnit(layers[i].unit)) continue;
      const cumulativeQty = getCumulativeQtyUpTo(i);
      // For innermost (retail) layer: price is per piece
      if (i === layers.length - 1) {
        newPrices[i] = sellingPerPiece.toFixed(2);
      } else {
        // For inner pack layers: price is per unit of that layer
        newPrices[i] = (sellingPerPiece * cumulativeQty).toFixed(2);
      }
    }

    // Compare newPrices to existing layerPrices (only for indices we modify) to avoid unnecessary updates
    let changed = false;
    for (let i = 1; i < layers.length; i++) {
      const oldVal = (layerPrices[i] || "").toString();
      const newVal = (newPrices[i] || "").toString();
      if (oldVal !== newVal) {
        changed = true;
        break;
      }
    }

    if (changed) onLayerPriceChange(newPrices);
    // only depend on auto-calc, master price and layers to avoid loop when derived prices change
  }, [autoCalcEnabled, layerPrices[0], layers]);

  if (layers.length === 0) return null;

  return (
    <div className="glass-panel p-6">
      <h3 className="mb-6 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Package className="text-sky-600" size={18} /> Pricing & Stock
      </h3>

      {/* Supplier Price */}
      <div className="mb-6 glass-panel p-5 bg-slate-50">
        <h4 className="mb-3 text-xs font-semibold text-red-700">Supplier price ({layers[0]?.unit})</h4>
        <input
          type="number"
          value={buyingPrice}
          onChange={(e) => onBuyingPriceChange(e.target.value)}
          onWheel={(e) => e.target.blur()}
          className="input-field text-base font-semibold"
          placeholder="0.00"
        />
      </div>

      {/* Layer Cards (pricing only) */}
      <div className="space-y-4">
        {layers.map((layer, i) => (
          <LayerCard
            key={i}
            layer={layer}
            index={i}
            totalLayers={layers.length}
            cumulativeQty={getCumulativeQtyUpTo(i)}
            // total pieces contained in one master unit
            totalPiecesPerMaster={getCumulativeQtyUpTo(0)}
            buyingPrice={buyingPrice}
            price={layerPrices[i] || ""}
            onPriceChange={(v) => onLayerPriceChange({ ...layerPrices, [i]: v })}
            // Only pass auto-calc controls to the master layer
            {...(i === 0 ? { autoCalcEnabled, onToggleAutoCalc: () => setAutoCalcEnabled((s) => !s) } : {})}
          />
        ))}
      </div>

      {/* Store Stock section: separate from pricing */}
      <StoreStockSection layers={layers} layerStock={layerStock} onLayerStockChange={onLayerStockChange} isEditing={isEditing} />

      <StockSummaryCard
        layerStock={layerStock}
        getCumulativeQtyUpTo={getCumulativeQtyUpTo}
        unit={layers[layers.length - 1]?.unit || "PCS"}
        layers={layers}
      />
    </div>
  );
}