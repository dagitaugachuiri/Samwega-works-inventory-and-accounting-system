// components/inventory/ui/LayerCard.jsx
import { isMeasurementUnit } from "@/lib/unitUtils";
import { Zap } from "lucide-react";

export default function LayerCard({ layer, index, totalLayers, cumulativeQty, buyingPrice, price, onPriceChange, totalPiecesPerMaster, autoCalcEnabled, onToggleAutoCalc }) {
  const isOutermost = index === 0;
  const isInnermost = index === totalLayers - 1;
  const isMeasurement = isMeasurementUnit(layer.unit);

  return (
    <div className={`glass-panel relative p-6 ${isMeasurement ? "opacity-75 border-slate-300" : ""
      }`}>
      <div className={`absolute -top-3 left-6 px-4 py-1 rounded-full text-xs font-semibold ${isOutermost ? "bg-sky-600 text-white" : isInnermost ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
        }`}>
        {isOutermost ? "Master Unit" : isInnermost ? "Retail Piece" : "Inner Pack"}
        {isMeasurement && " (Measurement Only)"}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="text-center lg:text-left">
          <p className="text-2xl font-bold text-slate-900">{layer.qty} <span className="text-lg">{layer.unit}</span></p>

          {isMeasurement && (
            <p className="text-xs text-slate-400 mt-1 italic">Measurement unit - not used for stock/pricing</p>
          )}
        </div>

        {!isMeasurement && (
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700">Selling Price{isInnermost ? " (per piece)" : ""}</label>
                {isOutermost && typeof onToggleAutoCalc === "function" && (
                  <button
                    onClick={onToggleAutoCalc}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-xs font-semibold ${autoCalcEnabled ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
                  >
                    <Zap size={12} />
                    {autoCalcEnabled ? "Auto" : "Auto Off"}
                  </button>
                )}
              </div>
              <input
                type="number"
                value={price}
                onChange={(e) => onPriceChange(e.target.value)}
                onWheel={(e) => e.target.blur()}
                className="input-field text-base font-semibold"
                placeholder="0.00"
              />
              {price && buyingPrice && cumulativeQty > 0 && totalPiecesPerMaster > 0 && (
                <p className="text-xs text-emerald-700 mt-2">
                  {(() => {
                    const parsedPrice = parseFloat(price) || 0;
                    const sellingPerPiece = isInnermost ? parsedPrice : parsedPrice / (cumulativeQty || 1);
                    const buyingPerPiece = (parseFloat(buyingPrice) || 0) / (totalPiecesPerMaster || 1);
                    const profitPerPiece = sellingPerPiece - buyingPerPiece;
                    return `Profit: KSh ${profitPerPiece.toFixed(2)}/pc`;
                  })()}
                </p>
              )}
            </div>
          </>
        )}
        {isMeasurement && (
          <div className="lg:col-span-2 flex items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-sm text-slate-500 text-center">
              This layer is a measurement unit and does not affect stock or pricing calculations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}