
"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Trash2, Save, Search,
  FileText, Package, AlertCircle, CheckCircle
} from 'lucide-react';
import api from '@/lib/api';
import { PRODUCT_CATALOG } from '@/components/sections/ProductNameInput';

export default function BulkAddItemPage() {
  const router = useRouter();

  // -- State --
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [warehouses, setWarehouses] = useState([]);

  const [formData, setFormData] = useState({
    invoiceId: '',
    warehouseId: '',
    items: []
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [saving, setSaving] = useState(false);
  const [existingItems, setExistingItems] = useState([]); // For suggestions
  const [errorMessage, setErrorMessage] = useState(null); // For displaying errors

  // -- Effects --
  useEffect(() => {
    fetchInvoices();
    fetchInventoryForSearch();
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const res = await api.getWarehouses();
      if (res.success && res.data) {
        // Handle both array and object with warehouses property
        const warehouseData = Array.isArray(res.data) ? res.data : (res.data.warehouses || []);
        setWarehouses(warehouseData);
        // Default to first warehouse if available
        if (warehouseData.length > 0) {
          setFormData(prev => ({ ...prev, warehouseId: warehouseData[0].id }));
        }
      }
    } catch (e) {
      console.error("Failed to load warehouses", e);
      setWarehouses([]); // Ensure it's always an array
    }
  };

  // Fetch Invoices and Suppliers
  const fetchInvoices = async () => {
    try {
      setLoadingInvoices(true);
      const [invoicesRes, suppliersRes] = await Promise.all([
        api.getInvoices(),
        api.getSuppliers()
      ]);

      // Extract data
      const invoiceData = invoicesRes.success && invoicesRes.data
        ? (invoicesRes.data.invoices || invoicesRes.data)
        : [];
      const supplierData = suppliersRes.success && suppliersRes.data
        ? (suppliersRes.data.suppliers || suppliersRes.data)
        : [];

      // Create supplier map
      const supplierMap = {};
      if (Array.isArray(supplierData)) {
        supplierData.forEach(s => supplierMap[s.id] = s.name);
      }

      // Merge and Sort
      const sorted = invoiceData.map(inv => ({
        ...inv,
        supplierName: inv.supplierName || supplierMap[inv.supplierId] || "Unknown Supplier"
      })).sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );

      setInvoices(sorted);
    } catch (e) {
      console.error("Failed to fetch invoices", e);
    } finally {
      setLoadingInvoices(false);
    }
  };

  // Fetch Inventory for auto-complete
  const fetchInventory = async () => {
    try {
      const res = await api.getInventory();
      let combined = [];

      // 1. Add Existing Inventory
      if (res.success && res.data) {
        combined = [...res.data];
      }

      // 2. Add Catalog Items (that aren't already in inventory)
      const existingNames = new Set(combined.map(i => i.productName.toLowerCase()));

      const catalogItems = PRODUCT_CATALOG.filter(c => !existingNames.has(c.name.toLowerCase())).map((c, i) => ({
        id: `cat-${i}`,
        productName: c.name,
        category: c.category || 'misc',
        buyingPrice: c.price,
        sellingPrice: Math.round(c.price * 1.3),
        unit: 'PCS',
        stock: 0,
        isCatalog: true
      }));

      setExistingItems([...combined, ...catalogItems]);

    } catch (e) {
      console.error("Failed to load inventory for suggestions", e);
    }
  };

  const fetchInventoryForSearch = fetchInventory;

  // -- Handlers --

  const handleInvoiceChange = (id) => {
    setFormData(prev => ({ ...prev, invoiceId: id }));
  };

  const addItemRow = (baseItem = null) => {
    // Clear any previous errors when user makes changes
    setErrorMessage(null);

    const newItem = {
      id: Date.now(),
      productName: baseItem ? baseItem.productName : searchQuery,
      category: baseItem ? baseItem.category : 'misc',
      quantity: 1,
      unit: baseItem ? baseItem.unit : 'PCS',
      buyingPrice: baseItem ? baseItem.buyingPrice : 0,
      sellingPrice: baseItem ? baseItem.sellingPrice : 0,
      stock: baseItem ? baseItem.stock : 0,
      isExisting: !!baseItem && !baseItem.isCatalog,
      existingId: (baseItem && !baseItem.isCatalog) ? baseItem.id : null
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));

    setSearchQuery('');
    setShowResults(false);
  };

  const updateItemRow = (id, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  };

  const removeRow = (id) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length > 1) {
      const filtered = existingItems.filter(item =>
        item.productName.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);
      setSearchResults(filtered);
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  };

  const handleSaveAll = async () => {
    if (!formData.invoiceId) {
      alert("Please select an invoice first.");
      return;
    }
    if (!formData.warehouseId) {
      alert("Please select a warehouse.");
      return;
    }
    if (formData.items.length === 0) {
      alert("Please add at least one item.");
      return;
    }

    // Validate all items
    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];

      if (!item.productName || item.productName.trim() === '') {
        alert(`Item ${i + 1}: Product name is required.`);
        return;
      }

      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        alert(`Item ${i + 1} (${item.productName}): Quantity must be greater than 0.`);
        return;
      }

      const buyingPrice = parseFloat(item.buyingPrice);
      if (isNaN(buyingPrice) || buyingPrice < 0) {
        alert(`Item ${i + 1} (${item.productName}): Buying price must be a valid number.`);
        return;
      }

      const sellingPrice = parseFloat(item.sellingPrice);
      if (isNaN(sellingPrice) || sellingPrice < 0) {
        alert(`Item ${i + 1} (${item.productName}): Selling price must be a valid number.`);
        return;
      }
    }

    setSaving(true);

    try {
      // Get the selected invoice details to find supplier
      const selectedInvoice = invoices.find(i => i.id === formData.invoiceId);
      const supplierName = selectedInvoice?.supplierName || "Unknown Supplier";

      // Process each item
      const promises = formData.items.map(item => {
        const payload = {
          productName: item.productName,
          category: item.category,
          invoiceId: formData.invoiceId,
          supplier: supplierName,

          // Price & Stock
          buyingPrice: parseFloat(item.buyingPrice),
          buyingPricePerUnit: parseFloat(item.buyingPrice),
          sellingPrice: parseFloat(item.sellingPrice),
          sellingPricePerPiece: parseFloat(item.sellingPrice),
          stock: parseInt(item.quantity),
          stockInSupplierUnits: parseInt(item.quantity),
          unit: item.unit,
          supplierUnit: item.unit,
          supplierUnitQuantity: parseInt(item.quantity), // Simplification: 1:1

          // Defaults for required fields
          lowStockAlert: 10,
          warehouseId: formData.warehouseId
        };

        if (item.isExisting && item.existingId) {
          return api.updateInventoryItem(item.existingId, {
            ...payload,
          });
        }

        return api.createInventoryItem(payload);
      });
      // Legacy execute
      for (const item of formData.items) {
        if (item.isExisting && item.existingId) {
          await api.replenishItem(item.existingId, {
            quantityAdded: parseInt(item.quantity),
            buyingPrice: parseFloat(item.buyingPrice),
            sellingPrice: parseFloat(item.sellingPrice),
            invoiceId: formData.invoiceId,
            supplier: supplierName
          });
        } else {
          await api.createInventoryItem({
            ...item,
            stock: parseInt(item.quantity),
            buyingPrice: parseFloat(item.buyingPrice),
            sellingPrice: parseFloat(item.sellingPrice),
            invoiceId: formData.invoiceId,
            supplier: supplierName,
            warehouseId: formData.warehouseId,
            packagingStructure: [{
              qty: 1,
              unit: item.unit,
              stock: parseInt(item.quantity),
              sellingPrice: parseFloat(item.sellingPrice)
            }]
          });
        }
      }

      router.push('/dashboard');
      router.refresh();

    } catch (e) {
      console.error("Bulk save failed", e);

      // Extract error message from API response
      let errorMsg = "Failed to save items. Please check your entries and try again.";

      if (e.message) {
        errorMsg = e.message;
      } else if (e.response?.data?.message) {
        errorMsg = e.response.data.message;
      } else if (e.response?.data?.error) {
        errorMsg = e.response.data.error;
      }

      setErrorMessage(errorMsg);

      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="text-slate-600" size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Add Inventory</h1>
            <p className="text-slate-500 text-sm">Receive items against an invoice</p>
          </div>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="btn-primary flex items-center gap-2 px-6 py-2.5"
        >
          {saving ? 'Saving...' : <><Save size={18} /> Save All Items</>}
        </button>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="glass-panel p-4 bg-red-50 border-l-4 border-red-500">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-1">Unable to Save Items</h3>
              <p className="text-sm text-red-800">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-600 hover:text-red-800 transition-colors"
              aria-label="Dismiss error"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Invoice Selection */}
      <div className="glass-panel p-6 grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Select Purchase Invoice <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={formData.invoiceId}
              onChange={(e) => handleInvoiceChange(e.target.value)}
              className="input-field pl-10 w-full"
              disabled={loadingInvoices}
            >
              <option value="">-- Select Invoice --</option>
              {invoices.map((inv, index) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber || inv.id} - {inv.supplierName}
                  {inv.totalAmount ? ` - KES ${inv.totalAmount.toLocaleString()}` : ''}
                  {index === 0 ? ' [NEWEST]' : ''}
                </option>
              ))}
            </select>
          </div>
          {invoices.length === 0 && !loadingInvoices && (
            <p className="text-xs text-amber-600 mt-2">
              No invoices found. <Link href="/invoices" className="underline">Create one first.</Link>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Select Warehouse <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={formData.warehouseId}
              onChange={(e) => setFormData(prev => ({ ...prev, warehouseId: e.target.value }))}
              className="input-field pl-10 w-full"
            >
              <option value="">-- Select Warehouse --</option>
              {Array.isArray(warehouses) && warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name || wh.id}
                </option>
              ))}
            </select>
          </div>
          {warehouses.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">
              No warehouses found. Please create one first.
            </p>
          )}
        </div>
      </div>

      {/* Selected Invoice Details */}
      {formData.invoiceId && (
        <div className="glass-panel p-6">
          {(() => {
            const inv = invoices.find(i => i.id === formData.invoiceId);
            if (!inv) return null;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 block mb-1">Supplier:</span>
                  <span className="font-medium text-slate-900">{inv.supplierName}</span>
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">Date:</span>
                  <span className="font-medium text-slate-900">{new Date(inv.invoiceDate).toLocaleDateString()}</span>
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">Total Amount:</span>
                  <span className="font-medium text-slate-900">KES {inv.totalAmount?.toLocaleString()}</span>
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">Status:</span>
                  <span className={`font-medium ${inv.status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                    {inv.status}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Items Table */}
      <div className="glass-panel">
        <div className="overflow-x-auto rounded-t-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600 w-[25%]">Product Name</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-[15%]">Category</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-[10%]">Qty</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-[10%]">Unit</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-[15%]">Buying Price</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-[15%]">Selling Price</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-[10%] text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {formData.items.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={item.productName}
                      onChange={(e) => updateItemRow(item.id, 'productName', e.target.value)}
                      className="input-field py-1 h-9 text-sm font-medium"
                      readOnly={item.isExisting} // Lock name if existing
                    />
                    {item.isExisting && <span className="text-[10px] text-emerald-600 flex items-center gap-1 mt-1"><CheckCircle size={10} /> Existing Item</span>}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={item.category}
                      onChange={(e) => updateItemRow(item.id, 'category', e.target.value)}
                      className="input-field py-1 h-9 text-sm"
                      disabled={item.isExisting} // Lock category if existing
                    >
                      <option value="misc">Misc</option>
                      <option value="sweets">Sweets</option>
                      <option value="juice">Juice</option>
                      <option value="biscuits">Biscuits</option>
                      <option value="baking ingredients">Baking</option>
                      <option value="seasoning / mchuzi mix">Seasoning</option>
                      <option value="household">Household</option>
                      <option value="Building Materials">Building Materials</option>
                      <option value="Hardware">Hardware</option>
                      <option value="Electrical">Electrical</option>
                      <option value="Plumbing">Plumbing</option>
                      <option value="Farming">Farming</option>
                      <option value="Fasteners">Fasteners</option>
                      <option value="Paint">Paint</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItemRow(item.id, 'quantity', e.target.value)}
                      className="input-field py-1 h-9 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItemRow(item.id, 'unit', e.target.value)}
                      className="input-field py-1 h-9 text-sm"
                      list="unit-suggestions"
                    />
                    <datalist id="unit-suggestions">
                      <option value="PCS" />
                      <option value="KG" />
                      <option value="L" />
                      <option value="Box" />
                      <option value="Set" />
                      <option value="Roll" />
                    </datalist>
                  </td>
                  <td className="px-4 py-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">KES</span>
                      <input
                        type="number"
                        min="0"
                        value={item.buyingPrice}
                        onChange={(e) => updateItemRow(item.id, 'buyingPrice', e.target.value)}
                        className="input-field pl-8 py-1 h-9 text-sm"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">KES</span>
                      <input
                        type="number"
                        min="0"
                        value={item.sellingPrice}
                        onChange={(e) => updateItemRow(item.id, 'sellingPrice', e.target.value)}
                        className="input-field pl-8 py-1 h-9 text-sm"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => removeRow(item.id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}

              {/* No Items State */}
              {formData.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Package size={48} className="mx-auto mb-3 opacity-20" />
                    <p>No items added yet. Use the search bar below to add items.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add Row / Search Area */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 rounded-b-xl">
          <div className="max-w-xl mx-auto relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    addItemRow(); // Add as NEW item
                  }
                }}
                placeholder="Search for an item to add, or type a new name and press Enter..."
                className="input-field w-full pl-11 py-3 shadow-sm border-slate-300 focus:border-sky-500 focus:ring-sky-500"
              />

              {searchQuery && (
                <button
                  onClick={() => addItemRow()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary px-3 py-1.5 text-xs rounded-md"
                >
                  <Plus size={14} className="mr-1 inline" /> Add New
                </button>
              )}
            </div>

            {/* Search Suggestions - Dropping UP to avoid clipping */}
            {showResults && (
              <div className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-xl shadow-xl border border-slate-100 divide-y divide-slate-100 z-50 overflow-hidden">
                {searchResults.map(item => (
                  <button
                    key={item.id}
                    onClick={() => addItemRow(item)}
                    className="w-full text-left px-4 py-3 hover:bg-sky-50 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{item.productName}</div>
                      <div className="text-xs text-slate-500">{item.category} • In Stock: {item.stock} {item.unit}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-slate-900">KES {item.sellingPrice?.toLocaleString()}</div>
                      <span className="text-xs text-sky-600 opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
                    </div>
                  </button>
                ))}
                {searchResults.length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-500 italic">
                    No existing items found. Press Enter to add "{searchQuery}" as a new item.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
