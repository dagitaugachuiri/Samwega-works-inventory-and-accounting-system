import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, shadows } from '../theme';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';
import CustomAlert from '../components/ui/CustomAlert';
import { getSales, getExpenses, getIssuances } from '../services/api';
import DatePickerModal from '../components/ui/DatePickerModal';
import { useState, useEffect } from 'react';

export default function ReportsScreen({ navigation, route }) {
    const { vehicleId } = route.params || {};
    const [role, setRole] = useState('sales_rep');

    useEffect(() => {
        const getRole = async () => {
            const userData = await AsyncStorage.getItem('userData');
            if (userData) {
                const user = JSON.parse(userData);
                setRole(user.role || 'sales_rep');
            }
        };
        getRole();
    }, []);

    // Date States
    const [salesDate, setSalesDate] = useState({ start: '', end: '' });
    const [expensesDate, setExpensesDate] = useState({ start: '', end: '' });
    const [inventoryDate, setInventoryDate] = useState({ start: '', end: '' });

    // Date Picker State
    const [pickerVisible, setPickerVisible] = useState(false);
    const [activeField, setActiveField] = useState(null); // { type: 'sales'|'expenses'|'inventory', field: 'start'|'end' }

    // Loading States
    const [loadingSales, setLoadingSales] = useState(false);
    const [loadingExpenses, setLoadingExpenses] = useState(false);
    const [loadingInventory, setLoadingInventory] = useState(false);

    // Report Results
    const [salesReport, setSalesReport] = useState(null);
    const [expensesReport, setExpensesReport] = useState(null);
    const [inventoryReport, setInventoryReport] = useState(null);

    // Alert
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showAlert = (title, message, type = 'info') => {
        setAlertConfig({ visible: true, title, message, type });
    };

    const openPicker = (type, field) => {
        setActiveField({ type, field });
        setPickerVisible(true);
    };

    const handleDateSelect = (date) => {
        if (!activeField) return;

        const { type, field } = activeField;

        /* eslint-disable indent */
        switch (type) {
            case 'sales':
                setSalesDate(prev => ({ ...prev, [field]: date }));
                break;
            case 'expenses':
                setExpensesDate(prev => ({ ...prev, [field]: date }));
                break;
            case 'inventory':
                setInventoryDate(prev => ({ ...prev, [field]: date }));
                break;
        }
        /* eslint-enable indent */
    };

    const handleGenerateSales = async () => {
        setLoadingSales(true);
        try {
            // Fetch detailed sales data using getSales instead of getSalesStats
            const params = {
                vehicleId,
                // No dates defaults to all time in backend or we can be explicit if needed
                limit: 1000 // Ensure we get a good amount if paginated
            };

            const response = await getSales(params);
            console.log('Sales API Response:', JSON.stringify(response, null, 2));
            const salesData = response.data?.sales || response.sales || [];
            console.log('Extracted Sales Data:', salesData.length, 'sales found');

            // Flatten sales into line items
            const lineItems = [];
            let grandTotal = 0;

            salesData.forEach(sale => {
                if (sale.items && Array.isArray(sale.items)) {
                    sale.items.forEach(item => {
                        lineItems.push({
                            date: sale.saleDate,
                            receipt: sale.receiptNumber,
                            customer: sale.customerName || 'Walk-in',
                            itemName: item.productName,
                            itemCode: item.shortCode || item.inventoryId?.substring(0, 6) || 'N/A',
                            quantity: item.quantity,
                            amount: item.totalPrice
                        });
                        grandTotal += (item.totalPrice || 0);
                    });
                }
            });

            const reportData = {
                lineItems,
                grandTotal,
                totalTransactions: salesData.length,
                vehicleId
            };

            console.log('Navigating to preview with:', {
                lineItemsCount: lineItems.length,
                grandTotal,
                totalTransactions: salesData.length
            });

            // Navigate to preview screen
            navigation.navigate('ReportPreview', {
                reportData,
                reportType: 'sales',
                dateRange: {
                    start: 'All Time',
                    end: 'Present'
                }
            });

        } catch (error) {
            console.error(error);
            showAlert('Error', 'Failed to generate sales report', 'error');
        } finally {
            setLoadingSales(false);
        }
    };

    const handleGenerateExpenses = async () => {
        setLoadingExpenses(true);
        try {
            const params = {
                vehicleId,
                limit: 1000
            };

            const response = await getExpenses(params);
            console.log('Expenses API Response:', JSON.stringify(response, null, 2));
            const expensesData = response.data?.expenses || response.expenses || [];
            console.log('Extracted Expenses Data:', expensesData.length, 'expenses found');

            // Format expenses into line items
            const lineItems = [];
            let grandTotal = 0;

            expensesData.forEach(expense => {
                lineItems.push({
                    date: expense.expenseDate || expense.createdAt,
                    category: expense.category || 'N/A',
                    description: expense.description || expense.notes || 'No description',
                    amount: parseFloat(expense.amount) || 0
                });
                grandTotal += (parseFloat(expense.amount) || 0);
            });

            const reportData = {
                lineItems,
                grandTotal,
                totalTransactions: expensesData.length,
                vehicleId
            };

            console.log('Navigating to expenses preview with:', {
                lineItemsCount: lineItems.length,
                grandTotal,
                totalTransactions: expensesData.length
            });

            // Navigate to preview screen
            navigation.navigate('ReportPreview', {
                reportData,
                reportType: 'expenses',
                dateRange: {
                    start: 'All Time',
                    end: 'Present'
                }
            });

        } catch (error) {
            console.error(error);
            showAlert('Error', 'Failed to generate expenses report', 'error');
        } finally {
            setLoadingExpenses(false);
        }
    };

    const handleGenerateInventory = async () => {
        setLoadingInventory(true);
        try {
            const response = await getIssuances(vehicleId);
            const allIssuances = response.data || response || [];

            const filtered = allIssuances;

            // Format inventory/issuances into line items
            const lineItems = [];

            filtered.forEach(issuance => {
                if (issuance.items && Array.isArray(issuance.items)) {
                    issuance.items.forEach(item => {
                        lineItems.push({
                            date: issuance.issueDate || issuance.createdAt,
                            itemName: item.productName || 'Unknown',
                            itemCode: item.shortCode || item.inventoryId?.substring(0, 6) || 'N/A',
                            quantity: item.quantity || 0,
                            status: issuance.status || 'N/A'
                        });
                    });
                }
            });

            const reportData = {
                lineItems,
                totalTransactions: filtered.length,
                vehicleId
            };

            // Navigate to preview screen
            navigation.navigate('ReportPreview', {
                reportData,
                reportType: 'inventory',
                dateRange: {
                    start: inventoryDate.start || 'All time',
                    end: inventoryDate.end || 'Present'
                }
            });

        } catch (error) {
            console.error(error);
            showAlert('Error', 'Failed to generate inventory report', 'error');
        } finally {
            setLoadingInventory(false);
        }
    };

    // Reusable Date Trigger Component
    const DateTrigger = ({ label, value, onPress, placeholder = "Select Date" }) => (
        <View style={styles.dateInputWrapper}>
            <AppText variant="caption" style={styles.inputLabel}>{label}</AppText>
            <TouchableOpacity
                style={styles.inputTrigger}
                onPress={onPress}
            >
                <Text style={[styles.inputText, !value && styles.placeholderText]}>
                    {value || placeholder}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const ReportSection = ({ title, dateState, type, onGenerate, loading, result }) => (
        <View style={styles.section}>
            <AppText variant="h3" style={styles.sectionTitle}>{title}</AppText>



            <AppButton
                title={`Generate ${title}`}
                onPress={onGenerate}
                loading={loading}
                variant="outline"
                style={styles.generateButton}
            />

            {/* Results Display */}
            {result && (
                <View style={styles.resultContainer}>
                    {type === 'sales' && result.lineItems && (
                        <>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderText, { width: 70 }]}>Date</Text>
                                <Text style={[styles.tableHeaderText, { width: 60 }]}>Receipt</Text>
                                <Text style={[styles.tableHeaderText, { width: 70 }]}>Customer</Text>
                                <Text style={[styles.tableHeaderText, { width: 80 }]}>Item</Text>
                                <Text style={[styles.tableHeaderText, { width: 50 }]}>Code</Text>
                                <Text style={[styles.tableHeaderText, { width: 35 }]}>Qty</Text>
                                <Text style={[styles.tableHeaderText, { width: 60, textAlign: 'right' }]}>Amount</Text>
                            </View>

                            <ScrollView style={styles.tableBody} nestedScrollEnabled>
                                {result.lineItems.map((item, index) => (
                                    <View key={index} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { width: 70 }]} numberOfLines={1}>
                                            {new Date(item.date).toLocaleDateString('en-GB').substring(0, 5)}
                                        </Text>
                                        <Text style={[styles.tableCell, { width: 60 }]} numberOfLines={1}>
                                            {item.receipt.substring(item.receipt.length - 6)}
                                        </Text>
                                        <Text style={[styles.tableCell, { width: 70 }]} numberOfLines={1}>
                                            {item.customer.substring(0, 10)}
                                        </Text>
                                        <Text style={[styles.tableCell, { width: 80 }]} numberOfLines={1}>
                                            {item.itemName.substring(0, 12)}
                                        </Text>
                                        <Text style={[styles.tableCell, { width: 50 }]} numberOfLines={1}>
                                            {item.itemCode}
                                        </Text>
                                        <Text style={[styles.tableCell, { width: 35 }]}>
                                            {item.quantity}
                                        </Text>
                                        <Text style={[styles.tableCell, { width: 60, textAlign: 'right' }]}>
                                            {item.amount.toLocaleString()}
                                        </Text>
                                    </View>
                                ))}
                            </ScrollView>

                            <View style={styles.tableSummary}>
                                <Text style={styles.summaryLabel}>Total Items: {result.lineItems.length}</Text>
                                <Text style={styles.summaryLabel}>Transactions: {result.totalTransactions}</Text>
                                <Text style={styles.summaryTotal}>TOTAL: KSh {result.grandTotal.toLocaleString()}</Text>
                            </View>
                        </>
                    )}

                    {type === 'expenses' && result.lineItems && (
                        <>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderText, { width: 70 }]}>Date</Text>
                                <Text style={[styles.tableHeaderText, { width: 80 }]}>Category</Text>
                                <Text style={[styles.tableHeaderText, { width: 120 }]}>Description</Text>
                                <Text style={[styles.tableHeaderText, { width: 70, textAlign: 'right' }]}>Amount</Text>
                            </View>

                            <ScrollView style={styles.tableBody} nestedScrollEnabled>
                                {result.lineItems.map((item, index) => (
                                    <View key={index} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { width: 70 }]} numberOfLines={1}>
                                            {new Date(item.date).toLocaleDateString('en-GB').substring(0, 5)}
                                        </Text>
                                        <Text style={[styles.tableCell, { width: 80 }]} numberOfLines={1}>
                                            {item.category.substring(0, 12)}
                                        </Text>
                                        <Text style={[styles.tableCell, { width: 120 }]} numberOfLines={1}>
                                            {item.description.substring(0, 20)}
                                        </Text>
                                        <Text style={[styles.tableCell, { width: 70, textAlign: 'right' }]}>
                                            {item.amount.toLocaleString()}
                                        </Text>
                                    </View>
                                ))}
                            </ScrollView>

                            <View style={styles.tableSummary}>
                                <Text style={styles.summaryLabel}>Total Expenses: {result.totalTransactions}</Text>
                                <Text style={styles.summaryTotal}>TOTAL: KSh {result.grandTotal.toLocaleString()}</Text>
                            </View>
                        </>
                    )}

                    {type === 'inventory' && (
                        <>
                            <View style={styles.resultRow}>
                                <AppText style={styles.resultLabel}>Stock Issuances:</AppText>
                                <AppText style={styles.resultValue}>{result.count || 0}</AppText>
                            </View>
                            {result.items?.slice(0, 3).map((item, i) => (
                                <View key={i} style={styles.miniItem}>
                                    <AppText variant="caption">{new Date(item.issueDate || item.createdAt).toLocaleDateString()}</AppText>
                                    <AppText variant="caption" style={{ fontWeight: 'bold' }}>{item.status}</AppText>
                                </View>
                            ))}
                        </>
                    )}
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Reports</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {role !== 'driver' && (
                    <ReportSection
                        title="Sales Report"
                        type="sales"
                        dateState={salesDate}
                        onGenerate={handleGenerateSales}
                        loading={loadingSales}
                        result={salesReport}
                    />
                )}

                <ReportSection
                    title="Expense Report"
                    type="expenses"
                    dateState={expensesDate}
                    onGenerate={handleGenerateExpenses}
                    loading={loadingExpenses}
                    result={expensesReport}
                />



                <View style={{ height: 40 }} />
            </ScrollView>

            <DatePickerModal
                visible={pickerVisible}
                onClose={() => setPickerVisible(false)}
                onSelect={handleDateSelect}
                initialDate={activeField &&
                    (activeField.type === 'sales' ? salesDate[activeField.field]
                        : activeField.type === 'expenses' ? expensesDate[activeField.field]
                            : inventoryDate[activeField.field])
                }
            />

            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.m,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    backButton: {
        padding: 4,
    },
    backButtonText: {
        fontSize: 16,
        color: colors.primary,
        fontWeight: '600',
    },
    content: {
        padding: spacing.m,
    },
    section: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.m,
        padding: spacing.m,
        marginBottom: spacing.m,
        ...shadows.small,
    },
    sectionTitle: {
        marginBottom: spacing.m,
        fontWeight: 'bold',
    },
    dateRow: {
        flexDirection: 'row',
        gap: spacing.m,
        marginBottom: spacing.m,
    },
    dateInputWrapper: {
        flex: 1,
        gap: 4,
    },
    inputLabel: {
        color: colors.textSecondary,
    },
    inputTrigger: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.button,
        paddingHorizontal: 12,
        paddingVertical: 12, // Increased for touch target
        backgroundColor: colors.background,
    },
    inputText: {
        color: colors.textPrimary,
        fontSize: 16,
    },
    placeholderText: {
        color: colors.textMuted,
    },
    generateButton: {
        marginTop: 4,
    },
    resultContainer: {
        marginTop: spacing.m,
        padding: spacing.m,
        backgroundColor: colors.slate50,
        borderRadius: borderRadius.button,
        borderWidth: 1,
        borderColor: colors.border,
    },
    resultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    resultLabel: {
        color: colors.textSecondary,
        fontWeight: '600',
    },
    resultValue: {
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    miniItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: colors.slate200,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: colors.primary,
        padding: 8,
        borderRadius: borderRadius.s,
        marginBottom: 4,
    },
    tableHeaderText: {
        color: colors.white,
        fontSize: 10,
        fontWeight: 'bold',
    },
    tableBody: {
        maxHeight: 300,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 6,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
    },
    tableCell: {
        fontSize: 9,
        color: colors.textPrimary,
    },
    tableSummary: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 2,
        borderTopColor: colors.primary,
    },
    summaryLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    summaryTotal: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.primary,
        marginTop: 4,
    }
});
