// components/inventory/sections/ProductNameInput.jsx
import { useState, useEffect, useRef } from "react";
import { Package } from "lucide-react";
import { parseSupplierItem } from "@/lib/universalSupplierParser";

// Hardware, building materials, farming tools suggestions
export const PRODUCT_CATALOG = [
  // Building Materials
  { name: "Cement - Portland 50kg", price: 750, category: "Building Materials" },
  { name: "Cement - Simba 50kg", price: 720, category: "Building Materials" },
  { name: "Corrugated Iron Sheet 3m", price: 850, category: "Building Materials" },
  { name: "Corrugated Iron Sheet 2m", price: 650, category: "Building Materials" },
  { name: "Steel Rod 12mm", price: 1200, category: "Building Materials" },
  { name: "Steel Rod 10mm", price: 950, category: "Building Materials" },
  { name: "Steel Rod 8mm", price: 750, category: "Building Materials" },
  { name: "Binding Wire 2.5mm", price: 180, category: "Building Materials" },
  { name: "Barbed Wire Roll", price: 3500, category: "Building Materials" },
  { name: "Chain Link Mesh Roll", price: 4500, category: "Building Materials" },
  { name: "Building Sand Tonne", price: 1500, category: "Building Materials" },
  { name: "Ballast Tonne", price: 2000, category: "Building Materials" },
  { name: "Hardcore Tonne", price: 1200, category: "Building Materials" },
  { name: "PVC Pipe 4 inch", price: 850, category: "Building Materials" },
  { name: "PVC Pipe 3 inch", price: 650, category: "Building Materials" },
  { name: "PVC Pipe 2 inch", price: 450, category: "Building Materials" },
  { name: "PVC Pipe 1 inch", price: 280, category: "Building Materials" },
  { name: "PVC Elbow 4 inch", price: 120, category: "Building Materials" },
  { name: "PVC Tee 3 inch", price: 150, category: "Building Materials" },
  { name: "Tile Adhesive 25kg", price: 850, category: "Building Materials" },
  { name: "Wall Putty 40kg", price: 1200, category: "Building Materials" },

  // Hardware & Tools
  { name: "Hammer Claw", price: 450, category: "Hardware" },
  { name: "Hammer Ball Peen", price: 550, category: "Hardware" },
  { name: "Hammer Sledge 4lb", price: 950, category: "Hardware" },
  { name: "Pliers Combination", price: 350, category: "Hardware" },
  { name: "Pliers Long Nose", price: 380, category: "Hardware" },
  { name: "Screwdriver Set 6pcs", price: 650, category: "Hardware" },
  { name: "Screwdriver Flathead Large", price: 180, category: "Hardware" },
  { name: "Screwdriver Phillips Medium", price: 150, category: "Hardware" },
  { name: "Adjustable Wrench 10 inch", price: 750, category: "Hardware" },
  { name: "Adjustable Wrench 8 inch", price: 550, category: "Hardware" },
  { name: "Pipe Wrench 14 inch", price: 1200, category: "Hardware" },
  { name: "Spanner Set Ring 8pcs", price: 1850, category: "Hardware" },
  { name: "Socket Set 24pcs", price: 3500, category: "Hardware" },
  { name: "Tape Measure 5m", price: 280, category: "Hardware" },
  { name: "Tape Measure 7.5m", price: 380, category: "Hardware" },
  { name: "Spirit Level 24 inch", price: 650, category: "Hardware" },
  { name: "Spirit Level 48 inch", price: 950, category: "Hardware" },
  { name: "Hacksaw Frame with Blade", price: 450, category: "Hardware" },
  { name: "Hacksaw Blade 12 inch", price: 50, category: "Hardware" },
  { name: "Hand Saw 20 inch", price: 550, category: "Hardware" },
  { name: "Wood Chisel Set 4pcs", price: 850, category: "Hardware" },
  { name: "Mason Trowel", price: 280, category: "Hardware" },
  { name: "Plastering Float", price: 350, category: "Hardware" },
  { name: "Wheelbarrow Heavy Duty", price: 4500, category: "Hardware" },
  { name: "Ladder Aluminium 8ft", price: 6500, category: "Hardware" },
  { name: "Ladder Aluminium 12ft", price: 9500, category: "Hardware" },

  // Nails & Fasteners
  { name: "Nails 2 inch 1kg", price: 180, category: "Fasteners" },
  { name: "Nails 3 inch 1kg", price: 180, category: "Fasteners" },
  { name: "Nails 4 inch 1kg", price: 180, category: "Fasteners" },
  { name: "Concrete Nails 2 inch 1kg", price: 250, category: "Fasteners" },
  { name: "Roofing Nails 3 inch Box", price: 450, category: "Fasteners" },
  { name: "Wood Screws 2 inch Box 100pcs", price: 280, category: "Fasteners" },
  { name: "Self Tapping Screws 1 inch Box", price: 180, category: "Fasteners" },
  { name: "Bolts & Nuts 10mm Set", price: 25, category: "Fasteners" },
  { name: "Anchor Bolts 12mm Set", price: 80, category: "Fasteners" },

  // Paint & Finishes
  { name: "Paint Emulsion White 20L", price: 4500, category: "Paint" },
  { name: "Paint Emulsion White 4L", price: 1200, category: "Paint" },
  { name: "Paint Gloss White 4L", price: 1800, category: "Paint" },
  { name: "Wood Varnish Clear 4L", price: 2200, category: "Paint" },
  { name: "Primer White 20L", price: 3800, category: "Paint" },
  { name: "Paint Brush 4 inch", price: 180, category: "Paint" },
  { name: "Paint Brush 2 inch", price: 120, category: "Paint" },
  { name: "Paint Roller 9 inch", price: 280, category: "Paint" },
  { name: "Masking Tape 2 inch", price: 180, category: "Paint" },

  // Electrical
  { name: "Electrical Cable 2.5mm Twin 100m", price: 8500, category: "Electrical" },
  { name: "Electrical Cable 1.5mm Twin 100m", price: 5500, category: "Electrical" },
  { name: "Electrical Cable 4mm Single 100m", price: 6500, category: "Electrical" },
  { name: "Socket Single 13A", price: 180, category: "Electrical" },
  { name: "Socket Double 13A", price: 280, category: "Electrical" },
  { name: "Switch 1 Gang", price: 120, category: "Electrical" },
  { name: "Switch 2 Gang", price: 180, category: "Electrical" },
  { name: "MCB Circuit Breaker 20A", price: 450, category: "Electrical" },
  { name: "Distribution Board 6 Way", price: 1800, category: "Electrical" },
  { name: "LED Bulb 9W", price: 150, category: "Electrical" },
  { name: "LED Bulb 15W", price: 220, category: "Electrical" },
  { name: "Fluorescent Tube 4ft", price: 280, category: "Electrical" },
  { name: "Ceiling Rose", price: 80, category: "Electrical" },
  { name: "Lamp Holder", price: 50, category: "Electrical" },

  // Farming Tools
  { name: "Jembe (Hoe) Heavy Duty", price: 450, category: "Farming" },
  { name: "Jembe (Hoe) Medium", price: 350, category: "Farming" },
  { name: "Panga (Machete)", price: 380, category: "Farming" },
  { name: "Slasher", price: 450, category: "Farming" },
  { name: "Rake Garden", price: 380, category: "Farming" },
  { name: "Spade Digging", price: 550, category: "Farming" },
  { name: "Fork Digging", price: 650, category: "Farming" },
  { name: "Shears Pruning", price: 450, category: "Farming" },
  { name: "Secateurs", price: 550, category: "Farming" },
  { name: "Watering Can 10L", price: 450, category: "Farming" },
  { name: "Sprayer Knapsack 16L", price: 2500, category: "Farming" },
  { name: "Sprayer Manual 1L", price: 180, category: "Farming" },
  { name: "Wheelbarrow Farm", price: 4200, category: "Farming" },
  { name: "Tarpaulin 20x20ft", price: 2800, category: "Farming" },
  { name: "Gunny Bags Pack 50pcs", price: 2500, category: "Farming" },
  { name: "Sisal Rope Roll 100m", price: 850, category: "Farming" },
  { name: "Netting Shade 50%", price: 80, category: "Farming" },
  { name: "Polythene Sheet 500 Gauge", price: 150, category: "Farming" },

  // Plumbing
  { name: "Water Tank 1000L", price: 12000, category: "Plumbing" },
  { name: "Water Tank 500L", price: 7500, category: "Plumbing" },
  { name: "Water Tank 200L", price: 4500, category: "Plumbing" },
  { name: "Gate Valve 1 inch", price: 650, category: "Plumbing" },
  { name: "Gate Valve 2 inch", price: 1200, category: "Plumbing" },
  { name: "Ball Valve 1 inch", price: 450, category: "Plumbing" },
  { name: "Float Valve 1 inch", price: 550, category: "Plumbing" },
  { name: "PTFE Tape Roll", price: 50, category: "Plumbing" },
  { name: "Pipe Clamps 2 inch Pack", price: 150, category: "Plumbing" },
  { name: "Water Pump 0.5HP", price: 8500, category: "Plumbing" },
  { name: "Water Pump 1HP", price: 12000, category: "Plumbing" },
  { name: "Hose Pipe 1 inch 30m", price: 1800, category: "Plumbing" },
  { name: "Hose Pipe 3/4 inch 30m", price: 1200, category: "Plumbing" },
];

export default function ProductNameInput({ value, onChange, onSelect, onPackagingDetected }) {
  const [suggestions] = useState(PRODUCT_CATALOG);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  // Filter suggestions
  const filtered = value && value.length > 1
    ? suggestions
      .filter(item => item.name.toLowerCase().includes(value.toLowerCase()))
      .slice(0, 8)
    : [];

  // Auto-detect packaging from name
  useEffect(() => {
    const parsed = parseSupplierItem(value);
    if (parsed?.packagingStructure?.layers >= 2) {
      const layers = [];
      const s = parsed.packagingStructure;

      if (s.layers === 3) {
        layers.push({ qty: s.outer.quantity, unit: s.outer.unit });
        layers.push({ qty: s.middle.quantity, unit: s.middle.unit });
        layers.push({ qty: s.inner.quantity, unit: s.inner.unit });
      } else if (s.layers === 2) {
        layers.push({ qty: s.outer.quantity, unit: s.outer.unit });
        layers.push({ qty: s.inner.quantity, unit: s.inner.unit });
      }

      onPackagingDetected(layers);
    }
  }, [value, onPackagingDetected]);

  const handleSelect = (item) => {
    onChange(item.name);
    onSelect(item);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <div className="glass-panel p-6 relative">
      <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Package size={18} className="text-sky-600" />
        Product Name
      </label>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        className="input-field text-sm py-3"
        placeholder="Type to search products..."
      />

      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto glass-panel shadow-lg left-0 right-0">
          {filtered.map((item, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(item)}
              className="w-full border-b px-4 py-3 text-left text-sm text-slate-800 last:border-b-0 hover:bg-slate-50"
            >
              <div className="font-bold text-gray-800">{item.name}</div>
              <div className="text-sm text-gray-600">KES {item.price.toLocaleString()} • {item.category}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}