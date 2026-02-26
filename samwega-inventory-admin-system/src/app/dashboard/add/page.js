"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Trash2, Save, Search,
  FileText, Package, AlertCircle, CheckCircle,
  ChevronRight, Calendar, DollarSign
} from 'lucide-react';
import api from '@/lib/api';
import { PRODUCT_CATALOG } from '@/components/sections/ProductNameInput';

export default function BulkAddItemPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  // -- State --
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Data
  const [suppliers, setSuppliers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [existingItems, setExistingItems] = useState([]);

  // Step 1: Invoice Form
  const [invoiceForm, setInvoiceForm] = useState({
    supplierId: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    totalAmount: '',
    status: 'unpaid'
  });
  const [createdInvoice, setCreatedInvoice] = useState(null);
  const [showExistingSelect, setShowExistingSelect] = useState(false);

  // Step 2: Items Form
  const [formData, setFormData] = useState({
    invoiceId: '',
    warehouseId: '',
    items: []
  });

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  // -- Effects --
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [suppliersRes, warehousesRes, inventoryRes, invoicesRes, userRes] = await Promise.all([
        api.getSuppliers(),
        api.getWarehouses(),
        api.getInventory(),
        api.getInvoices({ limit: 50 }),
        api.getCurrentUser()
      ]);

      if (userRes.success) {
        if (userRes.data.role === 'accountant') {
          router.push('/dashboard');
          return;
        }
        setUser(userRes.data);
      }

      // Suppliers
      const supplierData = suppliersRes.success && suppliersRes.data
        ? (suppliersRes.data.suppliers || suppliersRes.data)
        : [];
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);

      // Invoices
      const invoiceData = invoicesRes.success && invoicesRes.data
        ? (invoicesRes.data.invoices || invoicesRes.data)
        : [];
      const supplierMap = {};
      if (Array.isArray(supplierData)) supplierData.forEach(s => supplierMap[s.id] = s.name);

      const sortedInvoices = Array.isArray(invoiceData) ? invoiceData.map(inv => ({
        ...inv,
        supplierName: inv.supplierName || supplierMap[inv.supplierId] || "Unknown"
      })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
      setInvoices(sortedInvoices);

      // Warehouses
      const warehouseData = warehousesRes.success && warehousesRes.data
        ? (Array.isArray(warehousesRes.data) ? warehousesRes.data : (warehousesRes.data.warehouses || []))
        : [];
      setWarehouses(warehouseData);
      if (warehouseData.length > 0) {
        setFormData(prev => ({ ...prev, warehouseId: warehouseData[0].id }));
      }

      // Inventory for suggestions
      let combined = [];
      if (inventoryRes.success && inventoryRes.data) {
        combined = [...inventoryRes.data];
      }
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
      console.error("Failed to load initial data", e);
      setErrorMessage("Failed to load required data. Please refresh.");
    }
  };

  // -- Handlers: Step 1 --

  const handleCreateInvoice = async () => {
    setErrorMessage(null);
    if (!invoiceForm.supplierId) return setErrorMessage("Please select a supplier.");
    if (!invoiceForm.invoiceNumber) return setErrorMessage("Invoice Number is required.");
    if (!invoiceForm.totalAmount) return setErrorMessage("Total Amount is required.");

    setLoading(true);
    try {
      // Find supplier name
      const supplier = suppliers.find(s => s.id === invoiceForm.supplierId);

      const payload = {
        supplierId: invoiceForm.supplierId,
        supplierName: supplier ? supplier.name : 'Unknown',
        invoiceNumber: invoiceForm.invoiceNumber,
        invoiceDate: invoiceForm.invoiceDate,
        totalAmount: parseFloat(invoiceForm.totalAmount),
        status: invoiceForm.status
      };

      const res = await api.createInvoice(payload);

      if (res.success || res.data) {
        const newInvoice = res.data || res;
        setCreatedInvoice(newInvoice);
        setFormData(prev => ({ ...prev, invoiceId: newInvoice.id || newInvoice._id })); // handle different ID formats
        setStep(2);
      } else {
        throw new Error("Failed to create invoice");
      }
    } catch (e) {
      console.error("Invoice creation failed", e);
      setErrorMessage(e.message || "Failed to create invoice. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUseExistingInvoice = (invoiceId) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (inv) {
      setCreatedInvoice(inv);
      setFormData(prev => ({ ...prev, invoiceId: inv.id }));
      setStep(2);
    }
  };

  // -- Handlers: Step 2 --

  const addItemRow = (baseItem = null) => {
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
    setFormData(prev => ({ ...prev, items: prev.items.filter(item => item.id !== id) }));
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

  const handleSaveItems = async () => {
    if (!formData.warehouseId) {
      setErrorMessage("Please select a warehouse.");
      return;
    }
    if (formData.items.length === 0) {
      setErrorMessage("Please add at least one item.");
      return;
    }

    // Basic Validations
    for (const item of formData.items) {
      if (!item.productName || !item.productName.trim()) return setErrorMessage("All items must have a name.");
      if (parseInt(item.quantity) <= 0) return setErrorMessage(`Invalid quantity for ${item.productName}`);
    }

    setLoading(true);
    try {
      const selectedWarehouse = warehouses.find(w => w.id === formData.warehouseId);
      const warehouseName = selectedWarehouse ? selectedWarehouse.name : '';
      const supplierName = createdInvoice ? createdInvoice.supplierName : '';

      for (const item of formData.items) {
        if (item.isExisting && item.existingId) {
          await api.replenishItem(item.existingId, {
            quantity: parseInt(item.quantity),
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
            warehouseName: warehouseName,
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
      setErrorMessage(e.message || "Failed to save items.");
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6 font-sans">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Add Inventory</h1>
            <p className="text-slate-500 text-sm">Step {step} of 2: {step === 1 ? 'Create Invoice' : 'Receive Items'}</p>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5" size={18} />
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {/* STEP 1: CREATE INVOICE */}
      {step === 1 && (
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-slate-900 flex items-center gap-2">
                <FileText className="text-slate-400" size={20} />
                {showExistingSelect ? 'Select Existing Invoice' : 'Invoice Details'}
              </h2>
              <button
                onClick={() => setShowExistingSelect(!showExistingSelect)}
                className="text-sm font-medium text-sky-600 hover:text-sky-700 underline"
              >
                {showExistingSelect ? 'Create New Invoice' : 'Use Existing Invoice'}
              </button>
            </div>

            {showExistingSelect ? (
              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Select Invoice to Add Items To</label>
                  <select
                    onChange={(e) => handleUseExistingInvoice(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-200 bg-white"
                    defaultValue=""
                  >
                    <option value="" disabled>-- Choose Invoice --</option>
                    {invoices.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} - {inv.supplierName} ({new Date(inv.invoiceDate).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Supplier</label>
                    <select
                      value={invoiceForm.supplierId}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, supplierId: e.target.value }))}
                      className="w-full h-10 px-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 text-sm bg-white"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Invoice Number</label>
                    <input
                      type="text"
                      value={invoiceForm.invoiceNumber}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      placeholder="e.g. INV-2024-001"
                      className="w-full h-10 px-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="date"
                        value={invoiceForm.invoiceDate}
                        onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
                        className="w-full h-10 pl-10 pr-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Total Amount</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="number"
                        value={invoiceForm.totalAmount}
                        onChange={(e) => setInvoiceForm(prev => ({ ...prev, totalAmount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full h-10 pl-10 pr-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Status</label>
                    <select
                      value={invoiceForm.status}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full h-10 px-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 text-sm bg-white"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                      <option value="partial">Partial</option>
                    </select>
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleCreateInvoice}
                    disabled={loading}
                    className="bg-slate-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {loading ? 'Creating...' : <>Proceed to Add Items <ChevronRight size={16} /></>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: ADD ITEMS */}
      {step === 2 && (
        <div className="space-y-6">

          {/* Context Header */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-slate-500 block text-xs uppercase tracking-wider mb-0.5">Supplier</span>
                <span className="font-semibold text-slate-900">{createdInvoice?.supplierName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs uppercase tracking-wider mb-0.5">Invoice #</span>
                <span className="font-semibold text-slate-900">{createdInvoice?.invoiceNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs uppercase tracking-wider mb-0.5">Amount</span>
                <span className="font-semibold text-slate-900">KES {createdInvoice?.totalAmount?.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-md border border-slate-100">
                <Package size={16} className="text-slate-400" />
                <select
                  value={formData.warehouseId}
                  onChange={(e) => setFormData(prev => ({ ...prev, warehouseId: e.target.value }))}
                  className="bg-transparent border-none text-sm font-medium text-slate-700 outline-none cursor-pointer w-40"
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={async () => {
                  const name = prompt("Enter new warehouse name:");
                  if (name) {
                    try {
                      // Simple implementation: 'Main' as default location or adapt per backend.
                      // Adjust 'Main' if backend requires specific location string.
                      const res = await api.createWarehouse({ name, location: 'Main' });
                      if (res.success || res.data) {
                        const wRes = await api.getWarehouses();
                        const wData = wRes.success && wRes.data
                          ? (Array.isArray(wRes.data) ? wRes.data : (wRes.data.warehouses || []))
                          : [];
                        setWarehouses(wData);
                        const newWah = wData.find(w => w.name === name);
                        if (newWah) setFormData(prev => ({ ...prev, warehouseId: newWah.id }));
                      }
                    } catch (e) {
                      alert("Failed to create warehouse");
                    }
                  }
                }}
                className="p-2 hover:bg-slate-100 rounded-md text-slate-600 border border-slate-200 transaction-colors"
                title="Add New Warehouse"
              >
                <Plus size={16} />
              </button>
              <button
                onClick={async () => {
                  if (!formData.warehouseId) return alert("Select a warehouse to edit");
                  const current = warehouses.find(w => w.id === formData.warehouseId);
                  const newName = prompt("Rename warehouse:", current?.name);
                  if (newName && newName !== current?.name) {
                    alert("Edit functionality requires backend implementation. (For now, create new)");
                  }
                }}
                className="p-2 hover:bg-slate-100 rounded-md text-slate-600 border border-slate-200 transaction-colors"
                title="Edit Selected Warehouse"
              >
                <FileText size={16} />
              </button>
            </div>
          </div>

          {/* Add Item Bar */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 relative z-20">
            <div className="relative max-w-md mr-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    addItemRow();
                  }
                }}
                placeholder="Search item to add..."
                className="w-full pl-11 pr-20 py-2.5 rounded-lg border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => addItemRow()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-3 py-1 rounded text-xs font-medium"
                >
                  Add
                </button>
              )}

              {/* Search Results */}
              {showResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden z-30">
                  {searchResults.map(item => (
                    <button
                      key={item.id}
                      onClick={() => addItemRow(item)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 flex justify-between items-center group"
                    >
                      <div>
                        <div className="font-medium text-slate-800 text-sm">{item.productName}</div>
                        <div className="text-xs text-slate-500">{item.category}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-slate-900">KES {item.sellingPrice}</div>
                      </div>
                    </button>
                  ))}
                  {searchResults.length === 0 && (
                    <div className="p-3 text-xs text-slate-400 text-center">No results. Press enter to add new.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Main Items Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-[25%] pl-6">Product</th>
                    <th className="px-4 py-3 w-[15%]">Category</th>
                    <th className="px-4 py-3 w-[10%]">Qty</th>
                    <th className="px-4 py-3 w-[10%]">Unit</th>
                    <th className="px-4 py-3 w-[15%]">Buying</th>
                    <th className="px-4 py-3 w-[15%]">Selling</th>
                    <th className="px-4 py-3 w-[10%] text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {formData.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 pl-6">
                        <input
                          type="text"
                          value={item.productName}
                          onChange={(e) => updateItemRow(item.id, 'productName', e.target.value)}
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-medium placeholder-slate-400"
                          placeholder="Item Name"
                          readOnly={item.isExisting}
                        />
                        {item.isExisting && <span className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5"><CheckCircle size={8} /> Existing</span>}
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={item.category}
                          onChange={(e) => updateItemRow(item.id, 'category', e.target.value)}
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-slate-600"
                          disabled={item.isExisting}
                        >
                          <option value="misc">Misc</option>
                          <option value="sweets">Sweets</option>
                          <option value="juice">Juice</option>
                          <option value="biscuits">Biscuits</option>
                          <option value="baking ingredients">Baking</option>
                          <option value="seasoning / mchuzi mix">Seasoning</option>
                          <option value="household">Household</option>
                          <option value="Building Materials">Building</option>
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
                          className="w-full bg-transparent border-b border-transparent focus:border-sky-500 focus:ring-0 p-0 text-sm text-center"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => updateItemRow(item.id, 'unit', e.target.value)}
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm"
                          list="unit-suggestions"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={item.buyingPrice}
                          onChange={(e) => updateItemRow(item.id, 'buyingPrice', e.target.value)}
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={item.sellingPrice}
                          onChange={(e) => updateItemRow(item.id, 'sellingPrice', e.target.value)}
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-slate-900"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => removeRow(item.id)} className="text-slate-400 hover:text-rose-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {formData.items.length === 0 && (
                    <tr className="border-b-0">
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <Package size={40} className="mx-auto mb-3 text-slate-200" />
                        <p className="text-slate-400 text-sm">No items added yet.</p>
                        <p className="text-slate-300 text-xs">Use the search bar below to begin.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                if (confirm('Cancel all items?')) {
                  setStep(1);
                  setFormData(prev => ({ ...prev, items: [] }));
                  setCreatedInvoice(null);
                }
              }}
              className="px-6 py-2.5 text-slate-500 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveItems}
              disabled={loading}
              className="bg-emerald-600 text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 shadow-sm shadow-emerald-200 transition-all"
            >
              {loading ? 'Saving...' : <><Save size={16} className="inline mr-2" /> Save Receipt</>}
            </button>
          </div>
        </div>
      )}

      {/* Datalist for Units */}
      <datalist id="unit-suggestions">
        <option value="PCS" />
        <option value="KG" />
        <option value="L" />
        <option value="Box" />
        <option value="Set" />
        <option value="Roll" />
      </datalist>

    </div>
  );
}
