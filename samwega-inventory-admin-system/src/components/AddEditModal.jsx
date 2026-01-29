// components/inventory/AddEditItem.jsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import ProductNameInput from "./sections/ProductNameInput";
import PackagingBuilder from "./sections/PackagingBuilder";
import CategorySelect from "./sections/CategorySelect";
import WarehouseSelect from "./sections/WarehouseSelect";
import PricingAndStockSection from "./sections/PricingAndStockSection";
import ErrorModal from "./ErrorModal";
import { isMeasurementUnit } from "@/lib/unitUtils";
import api from "@/lib/api";
import { FileText, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function AddEditItem({ item }) {
  const router = useRouter();
  const isEdit = !!item;
  const initialPackaging = Array.isArray(item?.packagingStructure)
    ? item.packagingStructure
    : [];

  const [form, setForm] = useState({
    productName: item?.productName || "",
    category: item?.category || "misc",
    buyingPricePerUnit: item?.buyingPricePerUnit || "",
    lowStockAlert: item?.lowStockAlert || "5",
    invoiceId: item?.invoiceId || "",
    warehouseId: item?.warehouseId || "",
    warehouseName: item?.warehouseName || "",
  });

  const [packagingLayers, setPackagingLayers] = useState(initialPackaging);
  const [layerPrices, setLayerPrices] = useState(() => {
    const prices = {};
    initialPackaging.forEach((layer, i) => {
      const isMeasurement = isMeasurementUnit(layer.unit);
      if (!isMeasurement) {
        prices[i] = (layer.sellingPrice != null ? layer.sellingPrice : "").toString();
      }
    });
    return prices;
  });
  const [layerStock, setLayerStock] = useState(() => {
    const stock = {};
    initialPackaging.forEach((layer, i) => {
      const isMeasurement = isMeasurementUnit(layer.unit);
      if (!isMeasurement) {
        stock[i] = (layer.stock != null ? layer.stock : "0").toString();
      }
    });
    return stock;
  });
  const [saving, setSaving] = useState(false);

  // Error modal state
  const [errorModal, setErrorModal] = useState({ open: false, title: '', message: '', details: [] });

  // Invoices state
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Fetch invoices and suppliers on mount
  useEffect(() => {
    fetchInvoicesAndSuppliers();
  }, []);

  const fetchInvoicesAndSuppliers = async () => {
    try {
      setLoadingInvoices(true);
      const [invoicesRes, suppliersRes] = await Promise.all([
        api.getInvoices(),
        api.getSuppliers()
      ]);

      // Extract data handling pagination
      const invoiceData = invoicesRes.success && invoicesRes.data
        ? (invoicesRes.data.invoices || invoicesRes.data)
        : [];
      const supplierData = suppliersRes.success && suppliersRes.data
        ? (suppliersRes.data.suppliers || suppliersRes.data)
        : [];

      // Create supplier lookup map
      const supplierMap = {};
      if (Array.isArray(supplierData)) {
        supplierData.forEach(s => {
          supplierMap[s.id] = s.name;
        });
      }

      // Merge supplier names into invoices
      const invoicesWithSuppliers = Array.isArray(invoiceData)
        ? invoiceData.map(inv => ({
          ...inv,
          supplierName: inv.supplierName || supplierMap[inv.supplierId] || "Unknown Supplier"
        }))
        : [];

      setInvoices(invoicesWithSuppliers);

      // If editing, find the selected invoice
      if (item?.invoiceId) {
        const inv = invoicesWithSuppliers.find(i => i.id === item.invoiceId);
        setSelectedInvoice(inv || null);
      }
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleInvoiceChange = (invoiceId) => {
    setForm({ ...form, invoiceId });
    const inv = invoices.find(i => i.id === invoiceId);
    setSelectedInvoice(inv || null);
  };

  const handleSave = async () => {
    if (saving) return;

    if (!form.invoiceId) {
      alert("Please select an invoice");
      return;
    }

    setSaving(true);
    const totalPieces = packagingLayers.reduce((acc, l, i) => {
      const qty = parseInt(l.qty) || 1;
      if (i === 0) return qty;
      if (isMeasurementUnit(l.unit)) return acc;
      return acc * qty;
    }, 1);

    let pricePerPieceIndex = packagingLayers.length - 1;
    while (
      pricePerPieceIndex > 0 &&
      isMeasurementUnit(packagingLayers[pricePerPieceIndex]?.unit)
    ) {
      pricePerPieceIndex -= 1;
    }

    // Get supplier name from selected invoice
    const supplier = selectedInvoice?.supplierName || "Unknown Supplier";
    const sellingPrice = parseFloat(layerPrices[pricePerPieceIndex]) || 0;
    const buyingPrice = Number(form.buyingPricePerUnit || 0);
    const stock = parseInt(layerStock[0] || 0);

    const payload = {
      productName: form.productName,
      category: form.category,
      supplier,
      invoiceId: form.invoiceId,
      warehouseId: form.warehouseId,
      warehouseName: form.warehouseName,
      buyingPrice,
      buyingPricePerUnit: buyingPrice,
      sellingPrice,
      sellingPricePerPiece: sellingPrice,
      minimumPrice: sellingPrice * 0.9, // Default minimum at 90% of selling
      stock,
      stockInSupplierUnits: stock,
      unit: packagingLayers[0]?.unit || "PCS",
      supplierUnit: packagingLayers[0]?.unit || "PCS",
      supplierUnitQuantity: totalPieces,
      lowStockAlert: Number(form.lowStockAlert) || 10,
      packagingStructure: packagingLayers.map((l, i) => {
        const isMeasurement = isMeasurementUnit(l.unit);
        return {
          qty: parseInt(l.qty),
          unit: l.unit,
          sellingPrice: isMeasurement ? null : (layerPrices[i] ? parseFloat(layerPrices[i]) : null),
          stock: isMeasurement ? null : parseInt(layerStock[i] || 0),
        };
      }),
    };

    try {
      if (isEdit) {
        await api.updateInventoryItem(item.id, payload);
      } else {
        await api.createInventoryItem(payload);
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      // Parse error response
      let errorMessage = err.message || 'An error occurred';
      let errorDetails = [];
      let isValidation = err.isValidation || (err.statusCode >= 400 && err.statusCode < 500);

      // Try to extract details from the error
      if (err.details && Array.isArray(err.details)) {
        errorDetails = err.details;
      }

      setErrorModal({
        open: true,
        title: isValidation ? 'Validation Issue' : 'Failed to Save Item',
        message: errorMessage,
        details: errorDetails,
        type: isValidation ? 'warning' : 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Validation/Error Modal */}
      <ErrorModal
        isOpen={errorModal.open}
        onClose={() => setErrorModal({ ...errorModal, open: false })}
        title={errorModal.title}
        message={errorModal.message}
        details={errorModal.details}
        type={errorModal.type || 'warning'}
      />

      <div className="w-full py-8">
        <div className="mx-auto max-w-5xl space-y-8 glass-panel px-6 py-8">

          {/* Invoice Selection Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <FileText size={16} />
                Purchase Invoice *
              </h3>
              <Link
                href="/invoices"
                className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                <ExternalLink size={12} />
                Manage Invoices
              </Link>
            </div>

            <select
              value={form.invoiceId}
              onChange={(e) => handleInvoiceChange(e.target.value)}
              className="input-field w-full"
              disabled={loadingInvoices}
            >
              <option value="">
                {loadingInvoices ? "Loading invoices..." : "Select an invoice..."}
              </option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber || inv.id} - {inv.supplierName || inv.supplier?.name || "Unknown Supplier"}
                </option>
              ))}
            </select>

            {selectedInvoice && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div>
                    <span className="text-slate-400">Supplier:</span>{" "}
                    <span className="font-medium">{selectedInvoice.supplierName || selectedInvoice.supplier?.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Date:</span>{" "}
                    <span className="font-medium">
                      {selectedInvoice.invoiceDate ? new Date(selectedInvoice.invoiceDate).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Total:</span>{" "}
                    <span className="font-medium">KES {selectedInvoice.totalAmount?.toLocaleString() || "0"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Status:</span>{" "}
                    <span className={`font-medium ${selectedInvoice.status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                      {selectedInvoice.status || "Pending"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {invoices.length === 0 && !loadingInvoices && (
              <div className="text-center py-4 text-slate-500 text-sm">
                No invoices found.{" "}
                <Link href="/invoices" className="text-sky-600 hover:underline">
                  Create one first
                </Link>
              </div>
            )}
          </div>

          <ProductNameInput
            value={form.productName}
            onChange={(v) => setForm({ ...form, productName: v })}
            onSelect={(s) => setForm({
              ...form,
              productName: s.name,
              buyingPricePerUnit: s.price,
              category: s.category || "misc",
            })}
            onPackagingDetected={setPackagingLayers}
          />

          <PackagingBuilder layers={packagingLayers} onUpdate={setPackagingLayers} />

          <CategorySelect value={form.category} onChange={(v) => setForm({ ...form, category: v })} />

          <WarehouseSelect
            value={form.warehouseId}
            onChange={(id) => setForm(f => ({ ...f, warehouseId: id }))}
            onNameChange={(name) => setForm(f => ({ ...f, warehouseName: name }))}
          />

          <PricingAndStockSection
            buyingPrice={form.buyingPricePerUnit}
            onBuyingPriceChange={(v) => setForm({ ...form, buyingPricePerUnit: v })}
            layers={packagingLayers}
            layerPrices={layerPrices}
            layerStock={layerStock}
            onLayerPriceChange={setLayerPrices}
            onLayerStockChange={setLayerStock}
            isEditing={isEdit}
          />

          <div className="flex gap-4 pt-6">
            <button
              onClick={handleSave}
              className="btn-primary flex-1 py-4 text-sm"
              disabled={saving}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  {isEdit ? "Updating..." : "Saving..."}
                </span>
              ) : (
                (isEdit ? "Update Item" : "Add to Inventory")
              )}
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="btn-ghost px-6 py-4 text-sm"
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}