import React, { useState, useEffect } from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Switch,
} from 'react-native';
import { getVehicleInventory, recordSale, searchCustomers, createCustomer, patchSaleDebtLink } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReceiptService from '../services/ReceiptService';

const BANKS = [
    'Equity',
    'Old KCB',
    'New KCB',
    'Old Absa',
    'New Absa',
    'Family'
];

// Theme & UI
import { colors, spacing, borderRadius, shadows, typography } from '../theme';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';
import CustomAlert from '../components/ui/CustomAlert';
import CustomModal from '../components/ui/CustomModal';

export default function SalesScreen({ route, navigation }) {
    const { vehicleId, vehicleName } = route?.params || {};

    // Customer state
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [customerSuggestions, setCustomerSuggestions] = useState([]);
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
    const [searchingCustomers, setSearchingCustomers] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerSectionCollapsed, setCustomerSectionCollapsed] = useState(false);
    const [paymentSectionCollapsed, setPaymentSectionCollapsed] = useState(false);

    // New customer modal
    const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
    const [newCustomer, setNewCustomer] = useState({
        customerName: '',
        customerPhone: '',
        storeName: '',
        customerIdNumber: ''
    });
    const [creatingCustomer, setCreatingCustomer] = useState(false);

    // Product search state
    const [productSearchQuery, setProductSearchQuery] = useState('');
    const [productSuggestions, setProductSuggestions] = useState([]);
    const [showProductSuggestions, setShowProductSuggestions] = useState(false);

    // Inventory & items state
    const [inventory, setInventory] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // Payment state
    const [payments, setPayments] = useState({
        cash: '',
        mpesa: '',
        bank: '',
        debt: '',
        bankName: ''
    });
    const [showBankModal, setShowBankModal] = useState(false);

    // Other state
    const [isEtr, setIsEtr] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Custom Alert State
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: null,
        confirmText: 'OK',
        cancelText: 'Cancel',
        loading: false,
    });

    const showAlert = (title, message, type = 'info', onConfirm = null, confirmText = 'OK') => {
        setAlertConfig({
            visible: true,
            title,
            message,
            type,
            onConfirm: onConfirm ? () => { setAlertConfig(prev => ({ ...prev, visible: false })); onConfirm(); } : null,
            confirmText,
            cancelText: 'Cancel'
        });
    };

    useEffect(() => {
        const checkRole = async () => {
            const userDataStr = await AsyncStorage.getItem('userData');
            if (userDataStr) {
                const user = JSON.parse(userDataStr);
                if (user.role === 'driver') {
                    console.log('🚫 Driver tried to access sales screen');
                    navigation.replace('Stock', { vehicleId: user.assignedVehicleId });
                    return;
                }
            }
            loadInventory();
        };
        checkRole();
    }, []);

    // Debounced customer search
    useEffect(() => {
        const delaySearch = setTimeout(() => {
            if (customerSearchQuery.length >= 2 && !selectedCustomer) {
                searchForCustomers(customerSearchQuery);
            } else {
                setCustomerSuggestions([]);
                setShowCustomerSuggestions(false);
            }
        }, 300);

        return () => clearTimeout(delaySearch);
    }, [customerSearchQuery, selectedCustomer]);

    // Filter products as user types
    useEffect(() => {
        if (productSearchQuery.length >= 2) {
            const query = productSearchQuery.toLowerCase();
            const filtered = inventory.filter(item => {
                const name = (item.productName || item.name || '').toLowerCase();
                const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
                return name.includes(query) && qty > 0;
            }).slice(0, 10);

            setProductSuggestions(filtered);
            setShowProductSuggestions(true);
        } else {
            setProductSuggestions([]);
            setShowProductSuggestions(false);
        }
    }, [productSearchQuery, inventory]);

    const searchForCustomers = async (query) => {
        setSearchingCustomers(true);
        try {
            const response = await searchCustomers(query);
            const customers = response.data?.customers || [];
            setCustomerSuggestions(customers);
            setShowCustomerSuggestions(true);
        } catch (error) {
            console.error('Error searching customers:', error);
        } finally {
            setSearchingCustomers(false);
        }
    };

    const selectCustomer = (customer) => {
        setSelectedCustomer(customer);
        setCustomerSearchQuery('');
        setShowCustomerSuggestions(false);
        setCustomerSuggestions([]);
        setCustomerSectionCollapsed(true);
    };

    const clearCustomerSelection = () => {
        setSelectedCustomer(null);
        setCustomerSearchQuery('');
        setCustomerSectionCollapsed(false);
    };

    const handleCreateNewCustomer = async () => {
        if (!newCustomer.customerName.trim()) {
            showAlert('Missing Name', 'Please enter customer name', 'warning');
            return;
        }

        setCreatingCustomer(true);
        try {
            const response = await createCustomer(newCustomer);
            const customer = response.data || response;

            setSelectedCustomer(customer);
            setShowNewCustomerModal(false);
            setCustomerSectionCollapsed(true);
            setNewCustomer({ customerName: '', customerPhone: '', storeName: '', customerIdNumber: '' });

            showAlert('Success', 'Customer created successfully', 'success');
        } catch (error) {
            console.error('Error creating customer:', error);
            showAlert('Error', error.response?.data?.error || 'Failed to create customer', 'error');
        } finally {
            setCreatingCustomer(false);
        }
    };

    const loadInventory = async () => {
        try {
            setLoading(true);
            const response = await getVehicleInventory(vehicleId);

            // Handle various response structures robustly
            let rawData = [];
            if (Array.isArray(response)) {
                rawData = response;
            } else if (response.data && Array.isArray(response.data)) {
                rawData = response.data;
            } else if (response.inventory && Array.isArray(response.inventory)) {
                rawData = response.inventory;
            } else if (response.success && response.data) {
                if (Array.isArray(response.data)) rawData = response.data;
            }

            console.log('[SalesScreen] Loading inventory items:', rawData.length);
            const processedInventory = [];

            rawData.forEach(item => {
                if (item.layers && item.layers.length > 0) {
                    item.layers.forEach(layer => {
                        processedInventory.push({
                            ...item,
                            unit: layer.unit,
                            quantity: typeof layer.quantity === 'number' ? layer.quantity : parseFloat(layer.quantity) || 0,
                            layerIndex: layer.layerIndex,
                            sellingPrice: parseFloat(layer.sellingPrice || item.sellingPrice || 0),
                            packagingStructure: item.layers,
                            uniqueId: `${item.inventoryId || item.id}-${layer.unit || layer.layerIndex}`
                        });
                    });
                } else {
                    processedInventory.push({
                        ...item,
                        quantity: typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0,
                        sellingPrice: parseFloat(item.sellingPrice || 0),
                        uniqueId: `${item.inventoryId || item.id}`
                    });
                }
            });
            console.log('[SalesScreen] Processed inventory:', processedInventory.length);
            setInventory(processedInventory);
        } catch (error) {
            console.error('Error fetching inventory:', error);
            showAlert('Error', 'Failed to load inventory', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectProduct = (product) => {
        // Check if already added
        const existing = selectedItems.find(i => i.uniqueId === product.uniqueId);
        if (existing) {
            showAlert('Already Added', 'This item is already in your list', 'warning');
            return;
        }

        // Add new item row
        setSelectedItems([...selectedItems, {
            ...product,
            salesQuantity: '1',
            unitPrice: product.sellingPrice?.toString() || '',
            key: product.uniqueId
        }]);

        setProductSearchQuery('');
        setShowProductSuggestions(false);
    };

    const handleUpdateItemQuantity = (itemKey, quantity) => {
        setSelectedItems(selectedItems.map(item =>
            item.key === itemKey ? { ...item, salesQuantity: quantity } : item
        ));
    };

    const handleUpdateItemPrice = (itemKey, price) => {
        setSelectedItems(selectedItems.map(item =>
            item.key === itemKey ? { ...item, unitPrice: price } : item
        ));
    };

    const handleRemoveItem = (itemKey) => {
        setSelectedItems(selectedItems.filter(item => item.key !== itemKey));
    };

    const calculateItemTotal = (item) => {
        const price = parseFloat(item.unitPrice) || 0;
        const qty = parseFloat(item.salesQuantity) || 0;
        return price * qty;
    };

    const calculateSubtotal = () => {
        return selectedItems.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    };

    const calculateOtherPayments = () => {
        const cash = parseFloat(payments.cash) || 0;
        const mpesa = parseFloat(payments.mpesa) || 0;
        const bank = parseFloat(payments.bank) || 0;
        return cash + mpesa + bank;
    };

    const calculateDebt = () => {
        const subtotal = calculateSubtotal();
        const otherPayments = calculateOtherPayments();
        const remaining = subtotal - otherPayments;
        return remaining > 0 ? remaining : 0;
    };

    const calculateTotalPayment = () => {
        return calculateOtherPayments() + calculateDebt();
    };

    const getPaymentMethod = () => {
        const cash = parseFloat(payments.cash) || 0;
        const mpesa = parseFloat(payments.mpesa) || 0;
        const bank = parseFloat(payments.bank) || 0;
        const debt = calculateDebt();

        const activeMethods = [];
        if (cash > 0) activeMethods.push(['cash', cash]);
        if (mpesa > 0) activeMethods.push(['mpesa', mpesa]);
        if (bank > 0) activeMethods.push(['bank', bank]);
        if (debt > 0) activeMethods.push(['debt', debt]);

        if (activeMethods.length === 0) return 'cash';
        if (activeMethods.length === 1) return activeMethods[0][0] === 'debt' ? 'credit' : activeMethods[0][0];
        return 'mixed';
    };

    const updatePayment = (method, amount) => {
        setPayments(prev => ({
            ...prev,
            [method]: amount
        }));

        // If bank amount is entered and no bank selected, show modal
        if (method === 'bank' && amount && parseFloat(amount) > 0 && !payments.bankName) {
            setShowBankModal(true);
        }
    };

    const validateSale = () => {
        if (!selectedCustomer) {
            showAlert('Missing Customer', 'Please select or create a customer', 'warning');
            return false;
        }
        if (selectedItems.length === 0) {
            showAlert('No Items', 'Please add at least one item', 'warning');
            return false;
        }

        // Validate each item
        for (const item of selectedItems) {
            const qty = parseFloat(item.salesQuantity);
            const price = parseFloat(item.unitPrice);

            if (!item.salesQuantity || isNaN(qty) || qty <= 0) {
                showAlert('Invalid Quantity', `Please enter a valid quantity for ${item.productName}`, 'warning');
                return false;
            }

            if (qty > item.quantity) {
                showAlert('Insufficient Stock', `Only ${item.quantity} ${item.unit} available for ${item.productName}`, 'warning');
                return false;
            }

            if (!item.unitPrice || isNaN(price) || price <= 0) {
                showAlert('Invalid Price', `Please enter a valid price for ${item.productName}`, 'warning');
                return false;
            }
        }

        const subtotal = calculateSubtotal();
        const totalPayment = calculateTotalPayment();
        const debt = calculateDebt();

        // Require ID number for credit sales
        if (debt > 0 && !selectedCustomer.customerIdNumber) {
            showAlert('ID Required', 'Customer ID number is required for credit sales. Please update customer details.', 'warning');
            return false;
        }

        if (totalPayment <= 0) {
            showAlert('No Payment', 'Subtotal must be greater than 0', 'warning');
            return false;
        }

        // Validate bank selection if bank payment is used
        const bankAmount = parseFloat(payments.bank) || 0;
        if (bankAmount > 0 && (!payments.bankName || payments.bankName.trim() === '')) {
            showAlert('Bank Required', 'Please select a bank for the bank payment', 'warning');
            setShowBankModal(true);
            return false;
        }

        return true;
    };

    const handleSubmitSale = async () => {
        if (!validateSale()) return;

        setSubmitting(true);
        try {
            const subtotal = calculateSubtotal();
            const paymentMethod = getPaymentMethod();

            const saleItems = selectedItems.map(item => {
                // Normalize unit for backend validation (must be carton, box, or piece)
                let unit = item.unit ? item.unit.toLowerCase() : 'piece';
                if (unit === 'pcs' || unit === 'pieces') unit = 'piece';
                else if (unit === 'boxes') unit = 'box';
                else if (unit === 'cartons') unit = 'carton';

                return {
                    inventoryId: item.inventoryId,
                    productName: item.productName,
                    layerIndex: item.layerIndex,
                    unit: unit,
                    quantity: parseFloat(item.salesQuantity),
                    unitPrice: parseFloat(item.unitPrice),
                    totalPrice: calculateItemTotal(item)
                };
            });

            const paymentRecords = [];
            const cash = parseFloat(payments.cash) || 0;
            const mpesa = parseFloat(payments.mpesa) || 0;
            const bank = parseFloat(payments.bank) || 0;
            const debt = calculateDebt();

            if (cash > 0) paymentRecords.push({ method: 'cash', amount: cash });
            if (mpesa > 0) paymentRecords.push({ method: 'mpesa', amount: mpesa });
            if (bank > 0) paymentRecords.push({
                method: 'bank',
                amount: bank,
                bankName: payments.bankName
            });
            if (debt > 0) paymentRecords.push({ method: 'credit', amount: debt });

            const saleData = {
                vehicleId,
                items: saleItems,
                customerName: selectedCustomer.customerName,
                customerPhone: selectedCustomer.customerPhone || null,
                storeName: selectedCustomer.storeName || null,
                customerId: selectedCustomer.id || null,
                customerIdNumber: selectedCustomer.customerIdNumber || null,
                subtotal,
                taxAmount: 0,
                discountAmount: 0,
                grandTotal: subtotal,
                paymentMethod,
                bankName: bank > 0 ? payments.bankName : undefined,
                payments: paymentRecords,
                isEtr,
                notes: ''
            };

            const response = await recordSale(saleData);

            let completeSale = response;
            if (response.data) completeSale = response.data;
            else if (response.sale) completeSale = response.sale;

            if (!completeSale) throw new Error('Invalid response from server');

            // Debt creation is now handled automatically by the backend in recordSale
            
            let receiptText = '';
            try {
                receiptText = ReceiptService.generateReceipt(completeSale);
            } catch (e) {
                receiptText = `Receipt Generation Failed\n\nRef: ${completeSale.id}`;
            }

            setSubmitting(false);

            // Print confirmation
            setAlertConfig({
                visible: true,
                title: 'Sale Completed',
                message: 'Sale recorded successfully. Print receipt?',
                type: 'success',
                confirmText: 'Print',
                cancelText: 'Done',
                loading: false,
                onConfirm: async () => {
                    setAlertConfig(prev => ({ ...prev, loading: true }));

                    try {
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        await ReceiptService.print(receiptText);

                        setAlertConfig(prev => ({ ...prev, visible: false }));
                        resetSale();
                    } catch (err) {
                        showAlert('Print Error', 'Failed to send to printer', 'error');
                    } finally {
                        setAlertConfig(prev => ({ ...prev, loading: false }));
                    }
                },
                onClose: () => {
                    setAlertConfig(prev => ({ ...prev, visible: false }));
                    resetSale();
                }
            });

        } catch (error) {
            setSubmitting(false);
            console.error('Sale submission error:', error);

            // Extract error message from various possible locations
            let errorMsg = 'Failed to record sale';

            if (error.response?.data?.error) {
                errorMsg = error.response.data.error;
            } else if (error.response?.data?.message) {
                errorMsg = error.response.data.message;
            } else if (error.message) {
                errorMsg = error.message;
            }

            // Make stock errors more user-friendly
            if (errorMsg.includes('Insufficient stock')) {
                // Extract product name and details
                const match = errorMsg.match(/Insufficient stock for (.+?) at layer/);
                const productName = match ? match[1] : 'this product';
                errorMsg = `⚠️ Not enough stock for ${productName}.\n\nPlease refresh inventory or reduce quantity.`;
            } else if (errorMsg.toLowerCase().includes('price') && (errorMsg.toLowerCase().includes('below') || errorMsg.toLowerCase().includes('minimum'))) {
                // Sanitize price minimum error messages to hide the actual threshold
                errorMsg = '⚠️ The entered price is below the allowed minimum for this item.';
            }

            showAlert('Sale Error', errorMsg, 'error');
        }
    };

    const resetSale = () => {
        setIsEtr(false);
        setSelectedItems([]);
        setPayments({ cash: '', mpesa: '', bank: '', debt: '', bankName: '' });
        clearCustomerSelection();
        loadInventory();
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <AppText style={styles.loadingText}>Loading inventory...</AppText>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <AppText style={styles.backButton}>← Back</AppText>
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                    <AppText variant="h3" style={styles.headerTitle}>New Sale</AppText>
                    {vehicleName === 'WORKSHOP' && (
                        <View style={styles.workshopBadge}>
                            <AppText style={styles.workshopBadgeText}>WORKSHOP MODE: No price limits</AppText>
                        </View>
                    )}
                </View>
                <TouchableOpacity onPress={resetSale}>
                    <AppText style={styles.resetButton}>Reset</AppText>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                {/* Customer Section */}
                <View style={styles.section}>
                    <TouchableOpacity
                        style={styles.sectionHeader}
                        onPress={() => selectedCustomer && setCustomerSectionCollapsed(!customerSectionCollapsed)}
                    >
                        <AppText variant="caption" style={styles.sectionTitle}>
                            {selectedCustomer ? '✓ CUSTOMER SELECTED' : '1. SELECT CUSTOMER'}
                        </AppText>
                        {selectedCustomer && (
                            <AppText style={styles.collapseIcon}>
                                {customerSectionCollapsed ? '▼' : '▲'}
                            </AppText>
                        )}
                    </TouchableOpacity>

                    {!customerSectionCollapsed && (
                        <>
                            {selectedCustomer ? (
                                <View style={styles.selectedCustomerCard}>
                                    <View style={styles.selectedCustomerInfo}>
                                        <AppText style={styles.selectedCustomerName}>
                                            {selectedCustomer.customerName}
                                        </AppText>
                                        {selectedCustomer.storeName && (
                                            <AppText variant="small" style={styles.selectedCustomerDetail}>
                                                {selectedCustomer.storeName}
                                            </AppText>
                                        )}
                                        {selectedCustomer.customerPhone && (
                                            <AppText variant="small" style={styles.selectedCustomerDetail}>
                                                {selectedCustomer.customerPhone}
                                            </AppText>
                                        )}
                                        {selectedCustomer.customerIdNumber && (
                                            <AppText variant="small" style={styles.selectedCustomerDetail}>
                                                ID: {selectedCustomer.customerIdNumber}
                                            </AppText>
                                        )}
                                    </View>
                                    <TouchableOpacity onPress={clearCustomerSelection}>
                                        <AppText style={styles.changeButton}>Change</AppText>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    <View style={styles.customerSearchContainer}>
                                        <TextInput
                                            style={styles.searchInput}
                                            placeholder="Search by name or phone..."
                                            value={customerSearchQuery}
                                            onChangeText={setCustomerSearchQuery}
                                            placeholderTextColor={colors.slate400}
                                        />
                                        {searchingCustomers && (
                                            <ActivityIndicator style={styles.searchIndicator} size="small" color={colors.primary} />
                                        )}
                                    </View>

                                    {showCustomerSuggestions && customerSuggestions.length > 0 && (
                                        <View style={styles.suggestionsContainer}>
                                            <FlatList
                                                data={customerSuggestions}
                                                keyExtractor={(item) => item.id}
                                                renderItem={({ item }) => (
                                                    <TouchableOpacity
                                                        style={styles.suggestionItem}
                                                        onPress={() => selectCustomer(item)}
                                                    >
                                                        <AppText style={styles.suggestionName}>{item.customerName}</AppText>
                                                        <AppText variant="caption" style={styles.suggestionDetails}>
                                                            {item.storeName ? `${item.storeName} • ` : ''}{item.customerPhone || 'No phone'}
                                                        </AppText>
                                                    </TouchableOpacity>
                                                )}
                                                scrollEnabled={false}
                                            />
                                        </View>
                                    )}

                                    <TouchableOpacity
                                        style={styles.newCustomerButton}
                                        onPress={() => setShowNewCustomerModal(true)}
                                    >
                                        <AppText style={styles.newCustomerButtonText}>+ Add New Customer</AppText>
                                    </TouchableOpacity>
                                </>
                            )}
                        </>
                    )}
                </View>

                <View style={[styles.section, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm || 12 }]}>
                    <View style={{ flex: 1 }}>
                        <AppText variant="caption" style={[styles.sectionTitle, { marginBottom: 4 }]}>ETR CHECK</AppText>
                        <AppText variant="small" style={{ color: isEtr ? colors.emerald600 : colors.slate400 }}>
                            {isEtr ? '✓ ETR SALE' : 'NOT ETR'}
                        </AppText>
                    </View>
                    <TouchableOpacity
                        style={[styles.checkbox, isEtr && styles.checkboxChecked]}
                        onPress={() => setIsEtr(!isEtr)}
                        activeOpacity={0.7}
                    >
                        {isEtr && <AppText style={styles.checkboxCheck}>✓</AppText>}
                    </TouchableOpacity>
                </View>

                {/* Items Section */}
                {selectedCustomer && (
                    <View style={styles.section}>
                        <AppText variant="caption" style={styles.sectionTitle}>2. ADD ITEMS</AppText>

                        {/* Product Search */}
                        <View style={styles.productSearchContainer}>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search products to add..."
                                value={productSearchQuery}
                                onChangeText={setProductSearchQuery}
                                placeholderTextColor={colors.slate400}
                            />
                        </View>

                        {showProductSuggestions && productSuggestions.length > 0 && (
                            <View style={styles.suggestionsContainer}>
                                <FlatList
                                    data={productSuggestions}
                                    keyExtractor={(item) => item.uniqueId}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.productSuggestionItem}
                                            onPress={() => handleSelectProduct(item)}
                                        >
                                            <View style={styles.productSuggestionInfo}>
                                                <AppText style={styles.productSuggestionName}>{item.productName}</AppText>
                                                <AppText variant="caption" style={styles.productSuggestionDetails}>
                                                    {item.unit} • Stock: {item.quantity} • KSh {item.sellingPrice}
                                                </AppText>
                                            </View>
                                            <AppText style={styles.addIcon}>+</AppText>
                                        </TouchableOpacity>
                                    )}
                                    scrollEnabled={false}
                                />
                            </View>
                        )}

                        {/* Items Table */}
                        {selectedItems.length > 0 && (
                            <>
                                {/* Table Header */}
                                <View style={styles.tableHeader}>
                                    <AppText variant="caption" style={[styles.tableHeaderText, { flex: 4 }]}>ITEM</AppText>
                                    <AppText variant="caption" style={[styles.tableHeaderText, { flex: 1 }]}>QTY</AppText>
                                    <AppText variant="caption" style={[styles.tableHeaderText, { flex: 1.5 }]}>PRICE</AppText>
                                    <AppText variant="caption" style={[styles.tableHeaderText, { flex: 1.5 }]}>TOTAL</AppText>
                                    <View style={{ width: 30 }} />
                                </View>

                                {/* Table Rows */}
                                {selectedItems.map((item) => (
                                    <View key={item.key} style={styles.tableRow}>
                                        <View style={{ flex: 4 }}>
                                            <AppText variant="small" style={styles.tableCell} numberOfLines={2}>
                                                {item.productName}
                                            </AppText>
                                            <AppText variant="caption" style={styles.tableUnitText}>
                                                {item.unit}
                                            </AppText>
                                        </View>
                                        <TextInput
                                            style={[styles.tableInput, { flex: 1 }]}
                                            value={item.salesQuantity}
                                            onChangeText={(text) => handleUpdateItemQuantity(item.key, text)}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor={colors.slate400}
                                        />
                                        <TextInput
                                            style={[styles.tableInput, { flex: 1.5 }]}
                                            value={item.unitPrice}
                                            onChangeText={(text) => handleUpdateItemPrice(item.key, text)}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor={colors.slate400}
                                        />
                                        <AppText variant="small" style={[styles.tableCell, { flex: 1.5, fontWeight: 'bold' }]}>
                                            {calculateItemTotal(item).toLocaleString()}
                                        </AppText>
                                        <TouchableOpacity onPress={() => handleRemoveItem(item.key)} style={styles.removeButton}>
                                            <AppText style={styles.removeButtonText}>×</AppText>
                                        </TouchableOpacity>
                                    </View>
                                ))}

                                {/* Subtotal */}
                                <View style={styles.subtotalRow}>
                                    <AppText style={styles.subtotalLabel}>Subtotal</AppText>
                                    <AppText variant="h3" style={styles.subtotalValue}>
                                        KSh {calculateSubtotal().toLocaleString()}
                                    </AppText>
                                </View>
                            </>
                        )}
                    </View>
                )}

                {/* Payment Section */}
                {selectedItems.length > 0 && (
                    <View style={styles.section}>
                        <TouchableOpacity
                            style={styles.sectionHeader}
                            onPress={() => setPaymentSectionCollapsed(!paymentSectionCollapsed)}
                        >
                            <AppText variant="caption" style={styles.sectionTitle}>
                                {calculateTotalPayment() > 0 ? '✓ PAYMENT ENTERED' : '3. PAYMENT'}
                            </AppText>
                            <AppText style={styles.collapseIcon}>
                                {paymentSectionCollapsed ? '▼' : '▲'}
                            </AppText>
                        </TouchableOpacity>

                        {!paymentSectionCollapsed && (
                            <>
                                <AppText variant="small" style={styles.paymentHint}>Enter amount for each payment method used</AppText>

                                <View style={styles.paymentGrid}>
                                    <View style={styles.paymentItem}>
                                        <AppText style={styles.paymentLabel}>💵 Cash</AppText>
                                        <TextInput
                                            style={styles.paymentInput}
                                            value={payments.cash}
                                            onChangeText={(text) => updatePayment('cash', text)}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor={colors.slate400}
                                        />
                                    </View>

                                    <View style={styles.paymentItem}>
                                        <AppText style={styles.paymentLabel}>📱 M-Pesa</AppText>
                                        <TextInput
                                            style={styles.paymentInput}
                                            value={payments.mpesa}
                                            onChangeText={(text) => updatePayment('mpesa', text)}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor={colors.slate400}
                                        />
                                    </View>

                                    <View style={styles.paymentItem}>
                                        <AppText style={styles.paymentLabel}>🏦 Bank</AppText>
                                        <TextInput
                                            style={[styles.paymentInput, payments.bankName ? { borderColor: colors.primary, borderWidth: 1.5 } : null]}
                                            value={payments.bank}
                                            onChangeText={(text) => updatePayment('bank', text)}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor={colors.slate400}
                                        />
                                        {payments.bankName ? (
                                            <TouchableOpacity
                                                style={styles.selectedBankBadge}
                                                onPress={() => setShowBankModal(true)}
                                            >
                                                <AppText style={styles.selectedBankText}>{payments.bankName}</AppText>
                                            </TouchableOpacity>
                                        ) : (
                                            parseFloat(payments.bank) > 0 && (
                                                <TouchableOpacity
                                                    style={[styles.selectedBankBadge, { backgroundColor: colors.error + '15' }]}
                                                    onPress={() => setShowBankModal(true)}
                                                >
                                                    <AppText style={[styles.selectedBankText, { color: colors.error }]}>Select Bank *</AppText>
                                                </TouchableOpacity>
                                            )
                                        )}
                                    </View>

                                    <View style={styles.paymentItem}>
                                        <AppText style={styles.paymentLabel}>📝 Debt </AppText>
                                        <View style={[styles.paymentInput, styles.paymentInputReadonly]}>
                                            <AppText style={styles.paymentInputText}>
                                                {calculateDebt().toLocaleString()}
                                            </AppText>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.paymentSummary}>
                                    {calculateOtherPayments() > 0 && (
                                        <AppText style={styles.paymentSummaryText}>
                                            Paid: KSh {calculateOtherPayments().toLocaleString()}
                                        </AppText>
                                    )}
                                    {calculateDebt() > 0 && (
                                        <AppText style={[styles.paymentSummaryText, { color: colors.warning }]}>
                                            Debt: KSh {calculateDebt().toLocaleString()}
                                        </AppText>
                                    )}
                                    <AppText style={[styles.paymentSummaryText, { fontWeight: 'bold', marginTop: spacing.xs }]}>
                                        Total: KSh {calculateTotalPayment().toLocaleString()}
                                    </AppText>
                                </View>
                            </>
                        )}
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Footer */}
            {selectedItems.length > 0 && (
                <View style={styles.footer}>
                    <View style={styles.totalContainer}>
                        <AppText style={styles.totalLabel}>Total </AppText>
                        <AppText variant="h2" style={styles.totalValue}>KSh {calculateSubtotal().toLocaleString()}</AppText>
                    </View>
                    <TouchableOpacity
                        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                        onPress={handleSubmitSale}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color={colors.white} />
                        ) : (
                            <AppText style={styles.submitButtonText}>Complete Sale</AppText>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* New Customer Modal */}
            <CustomModal
                visible={showNewCustomerModal}
                onClose={() => setShowNewCustomerModal(false)}
            >
                <AppText variant="h2" centered style={styles.modalTitle}>Add New Customer</AppText>

                <TextInput
                    style={styles.modalInput}
                    placeholder="Customer Name *"
                    value={newCustomer.customerName}
                    onChangeText={(text) => setNewCustomer(prev => ({ ...prev, customerName: text }))}
                    placeholderTextColor={colors.slate400}
                />

                <TextInput
                    style={styles.modalInput}
                    placeholder="Phone Number"
                    value={newCustomer.customerPhone}
                    onChangeText={(text) => setNewCustomer(prev => ({ ...prev, customerPhone: text }))}
                    keyboardType="phone-pad"
                    placeholderTextColor={colors.slate400}
                />

                <TextInput
                    style={styles.modalInput}
                    placeholder="Store Name"
                    value={newCustomer.storeName}
                    onChangeText={(text) => setNewCustomer(prev => ({ ...prev, storeName: text }))}
                    placeholderTextColor={colors.slate400}
                />

                <TextInput
                    style={styles.modalInput}
                    placeholder="ID Number (Required for credit)"
                    value={newCustomer.customerIdNumber}
                    onChangeText={(text) => setNewCustomer(prev => ({ ...prev, customerIdNumber: text }))}
                    keyboardType="numeric"
                    placeholderTextColor={colors.slate400}
                />

                <View style={styles.modalButtons}>
                    <AppButton
                        title="Cancel"
                        variant="ghost"
                        onPress={() => setShowNewCustomerModal(false)}
                        disabled={creatingCustomer}
                        style={{ flex: 1 }}
                    />
                    <View style={{ width: spacing.m }} />
                    <AppButton
                        title="Create"
                        variant="primary"
                        onPress={handleCreateNewCustomer}
                        loading={creatingCustomer}
                        disabled={creatingCustomer}
                        style={{ flex: 1 }}
                    />
                </View>
            </CustomModal>

            {/* Bank Selection Modal */}
            <CustomModal
                visible={showBankModal}
                onClose={() => setShowBankModal(false)}
            >
                <AppText variant="h2" centered style={styles.modalTitle}>Select Bank</AppText>
                <View style={styles.bankGrid}>
                    {BANKS.map(bank => (
                        <TouchableOpacity
                            key={bank}
                            style={[
                                styles.bankOption,
                                payments.bankName === bank && styles.bankOptionSelected
                            ]}
                            onPress={() => {
                                setPayments(prev => ({ ...prev, bankName: bank }));
                                setShowBankModal(false);
                            }}
                        >
                            <AppText style={[
                                styles.bankOptionText,
                                payments.bankName === bank && styles.bankOptionTextSelected
                            ]}>
                                {bank}
                            </AppText>
                        </TouchableOpacity>
                    ))}
                </View>
                <AppButton
                    title="Close"
                    variant="ghost"
                    onPress={() => setShowBankModal(false)}
                    style={{ marginTop: spacing.m }}
                />
            </CustomModal>

            {/* Alert Modal */}
            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => {
                    if (alertConfig.onClose) {
                        alertConfig.onClose();
                    } else {
                        setAlertConfig(prev => ({ ...prev, visible: false }));
                    }
                }}
                onConfirm={alertConfig.onConfirm}
                confirmText={alertConfig.confirmText}
                cancelText={alertConfig.cancelText}
                loading={alertConfig.loading}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    loadingText: {
        marginTop: spacing.m,
        color: colors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.m,
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        ...shadows.sm,
    },
    backButton: {
        color: colors.primary,
        fontSize: 16,
    },
    headerTitle: {
        color: colors.textPrimary,
    },
    resetButton: {
        color: colors.error,
        fontSize: 14,
    },
    content: {
        flex: 1,
    },
    section: {
        backgroundColor: colors.white,
        marginTop: spacing.m,
        padding: spacing.m,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.border,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.m,
    },
    sectionTitle: {
        color: colors.primary,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    collapseIcon: {
        color: colors.slate400,
        fontSize: 12,
    },
    customerSearchContainer: {
        position: 'relative',
        marginBottom: spacing.m,
    },
    searchInput: {
        backgroundColor: colors.slate50,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.m,
        padding: spacing.m,
        fontSize: 15,
        color: colors.textPrimary,
    },
    searchIndicator: {
        position: 'absolute',
        right: spacing.m,
        top: spacing.m,
    },
    suggestionsContainer: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.m,
        marginBottom: spacing.m,
        maxHeight: 200,
        zIndex: 1000,
        elevation: 5,
    },
    suggestionItem: {
        padding: spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    suggestionName: {
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    suggestionDetails: {
        color: colors.textSecondary,
    },
    newCustomerButton: {
        backgroundColor: colors.primary,
        padding: spacing.m,
        borderRadius: borderRadius.m,
        alignItems: 'center',
    },
    newCustomerButtonText: {
        color: colors.white,
        fontWeight: 'bold',
    },
    selectedCustomerCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.success + '15',
        padding: spacing.m,
        borderRadius: borderRadius.m,
        borderWidth: 1,
        borderColor: colors.success,
    },
    selectedCustomerInfo: {
        flex: 1,
    },
    selectedCustomerName: {
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    selectedCustomerDetail: {
        color: colors.textSecondary,
        marginTop: 2,
    },
    changeButton: {
        color: colors.primary,
        fontWeight: 'bold',
    },
    productSearchContainer: {
        marginBottom: spacing.m,
    },
    productSuggestionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    productSuggestionInfo: {
        flex: 1,
    },
    productSuggestionName: {
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    productSuggestionDetails: {
        color: colors.textSecondary,
    },
    addIcon: {
        fontSize: 24,
        color: colors.primary,
        fontWeight: 'bold',
    },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.slate100,
        padding: spacing.s,
        borderRadius: borderRadius.s,
        marginTop: spacing.m,
        marginBottom: spacing.xs,
    },
    tableHeaderText: {
        fontWeight: 'bold',
        color: colors.textSecondary,
        fontSize: 11,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.s,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    tableCell: {
        color: colors.textPrimary,
        paddingHorizontal: 4,
    },
    tableUnitText: {
        color: colors.textSecondary,
        fontSize: 11,
        paddingHorizontal: 4,
        marginTop: 2,
    },
    tableInput: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.s,
        padding: spacing.xs,
        fontSize: 14,
        color: colors.textPrimary,
        textAlign: 'center',
        marginHorizontal: 2,
    },
    removeButton: {
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeButtonText: {
        fontSize: 24,
        color: colors.error,
        fontWeight: 'bold',
    },
    subtotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.m,
        paddingTop: spacing.m,
        borderTopWidth: 2,
        borderTopColor: colors.border,
    },
    subtotalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    subtotalValue: {
        color: colors.primary,
    },
    paymentHint: {
        color: colors.textSecondary,
        marginBottom: spacing.m,
    },
    paymentGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -spacing.xs,
    },
    paymentItem: {
        width: '50%',
        padding: spacing.xs,
    },
    paymentLabel: {
        marginBottom: spacing.xs,
        color: colors.textPrimary,
        fontSize: 14,
    },
    paymentInput: {
        backgroundColor: colors.slate50,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.s,
        padding: spacing.s,
        fontSize: 16,
        color: colors.textPrimary,
    },
    paymentSummary: {
        marginTop: spacing.m,
        padding: spacing.m,
        backgroundColor: colors.slate50,
        borderRadius: borderRadius.m,
    },
    paymentSummaryText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    paymentWarning: {
        marginTop: spacing.xs,
        color: colors.warning,
        fontSize: 14,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.m,
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        ...shadows.lg,
    },
    totalContainer: {
        flex: 1,
    },
    totalLabel: {
        color: colors.textSecondary,
        fontSize: 14,
    },
    totalValue: {
        color: colors.primary,
    },
    submitButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.l,
        paddingVertical: spacing.m,
        borderRadius: borderRadius.m,
        marginLeft: spacing.m,
        ...shadows.md,
    },
    submitButtonDisabled: {
        backgroundColor: colors.slate400,
    },
    submitButtonText: {
        color: colors.white,
        fontWeight: 'bold',
        fontSize: 16,
    },
    modalTitle: {
        marginBottom: spacing.l,
        color: colors.textPrimary,
    },
    modalInput: {
        backgroundColor: colors.slate50,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.m,
        padding: spacing.m,
        marginBottom: spacing.m,
        fontSize: 15,
        color: colors.textPrimary,
    },
    modalButtons: {
        flexDirection: 'row',
        marginTop: spacing.m,
    },
    checkbox: {
        width: 28,
        height: 28,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: colors.slate300,
        backgroundColor: colors.white,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: colors.emerald600,
        borderColor: colors.emerald600,
    },
    checkboxCheck: {
        color: colors.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    bankGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -spacing.xs,
    },
    bankOption: {
        width: '46%',
        margin: '2%',
        padding: spacing.m,
        backgroundColor: colors.slate50,
        borderRadius: borderRadius.m,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    bankOptionSelected: {
        backgroundColor: colors.primary + '15',
        borderColor: colors.primary,
    },
    bankOptionText: {
        fontWeight: '600',
        color: colors.textPrimary,
    },
    bankOptionTextSelected: {
        color: colors.primary,
    },
    selectedBankBadge: {
        marginTop: 4,
        backgroundColor: colors.primary + '15',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    selectedBankText: {
        fontSize: 11,
        color: colors.primary,
        fontWeight: 'bold',
    },
    resetButton: {
        fontSize: 16,
        color: colors.rose500,
        fontWeight: '600',
    },
    workshopBadge: {
        backgroundColor: colors.amber100,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 2,
    },
    workshopBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.amber800,
        textTransform: 'uppercase',
    },
});
