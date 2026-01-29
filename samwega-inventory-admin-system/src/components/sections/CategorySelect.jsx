// components/inventory/sections/CategorySelect.jsx
export default function CategorySelect({ value, onChange }) {
  const options = [
    "Sweets & Chocolates",
    "Juice & Drinks",
    "Biscuits & Snacks",
    "Baking Ingredients",
    "Seasoning / Mchuzi Mix",
    "Household & Cleaning",
    "Others",
  ];

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>

      <input
        list="category-options"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field text-sm"
        placeholder="Choose or type a category"
      />

      <datalist id="category-options">
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </div>
  );
}