import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
    Platform,
    Text
} from 'react-native';
import { getIssuances, confirmTransfer, getVehicleInventoryReport, getVehicleById } from '../services/api';
import ReceiptService from '../services/ReceiptService';

// Theme & UI
import { colors, spacing, borderRadius, shadows, typography } from '../theme';
import AppText from '../components/ui/AppText';
import CustomAlert from '../components/ui/CustomAlert';

// ==================== TABS COMPONENT ====================
const TabButton = ({ title, isActive, onPress }) => (
    <TouchableOpacity
        style={[styles.tabButton, isActive && styles.tabButtonActive]}
        onPress={onPress}
    >
        <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
            {title}
        </Text>
    </TouchableOpacity>
);

// ==================== INVENTORY TAB ====================
const InventoryTab = ({ vehicleId }) => {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [summary, setSummary] = useState(null);
    const [printing, setPrinting] = useState(false);
    const [vehicleInfo, setVehicleInfo] = useState(null);

    const loadInventory = useCallback(async () => {
        try {
            const response = await getVehicleInventoryReport(vehicleId);
            // Response structure: { success: true, data: { data: [...], summary: {...} } }
            // The service returns response.data, so response is { success, data: { data, summary } }
            if (response?.data?.data) {
                setInventory(response.data.data);
                setSummary(response.data.summary);
            } else if (response?.data) {
                // Fallback if structure is different
                setInventory(Array.isArray(response.data) ? response.data : []);
            }
        } catch (error) {
            console.error('Error fetching inventory report:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [vehicleId]);

    const loadVehicleInfo = useCallback(async () => {
        if (!vehicleId) return;
        try {
            const response = await getVehicleById(vehicleId);
            setVehicleInfo(response.data);
        } catch (error) {
            console.error('Error fetching vehicle info:', error);
        }
    }, [vehicleId]);

    useEffect(() => {
        loadInventory();
        loadVehicleInfo();
    }, [loadInventory, loadVehicleInfo]);

    const handlePrint = async () => {
        if (inventory.length === 0) return;
        setPrinting(true);
        try {
            const report = ReceiptService.generateInventoryReport(inventory, vehicleInfo || {});
            await ReceiptService.print(report);
        } catch (error) {
            console.error('Print failed:', error);
            // We could show an alert here, but the ReceiptService might have already shown one
        } finally {
            setPrinting(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadInventory();
    };

    const renderItem = ({ item }) => (
        <View style={styles.row}>
            <View style={[styles.cell, { flex: 4 }]}>
                <Text style={styles.cellTextPrimary}>{item.itemName}</Text>
                <Text style={styles.cellTextSecondary}>{item.itemCategory}</Text>
            </View>
            <View style={[styles.cell, { flex: 2, alignItems: 'center' }]}>
                <Text style={styles.cellText}>{item.quantityLoaded}</Text>
            </View>
            <View style={[styles.cell, { flex: 2, alignItems: 'center' }]}>
                <Text style={styles.cellText}>{item.quantitySold}</Text>
            </View>
            <View style={[styles.cell, { flex: 2, alignItems: 'center' }]}>
                <Text style={styles.cellTextBold}>{item.quantityRemaining}</Text>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.tabContent}>
            <View style={styles.printHeader}>
                <AppText variant="bodyBold">Inventory Status</AppText>
                <TouchableOpacity
                    style={[styles.printButton, printing && styles.printButtonDisabled]}
                    onPress={handlePrint}
                    disabled={printing}
                >
                    {printing ? (
                        <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                        <>
                            <Text style={styles.printIcon}>🖨️</Text>
                            <Text style={styles.printButtonText}>Print</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { flex: 4 }]}>Item Name</Text>
                <Text style={[styles.headerCell, { flex: 2, textAlign: 'center' }]}>Loaded</Text>
                <Text style={[styles.headerCell, { flex: 2, textAlign: 'center' }]}>Sold</Text>
                <Text style={[styles.headerCell, { flex: 2, textAlign: 'center' }]}>Rem.</Text>
            </View>
            <FlatList
                data={inventory}
                keyExtractor={(item) => item.itemName + item.vehicleId}
                renderItem={renderItem}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No inventory found</Text>
                    </View>
                }
            />
        </View>
    );
};

// ==================== COLLECTIONS TAB (Old Logic) ====================
const CollectionsTab = ({ vehicleId }) => {
    const [issuances, setIssuances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [collectingReceipts, setCollectingReceipts] = useState(new Set());

    // Alert State
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: null,
        loading: false
    });

    const showAlert = (title, message, type = 'info', onConfirm = null) => {
        setAlertConfig({ visible: true, title, message, type, onConfirm });
    };

    const loadIssuances = useCallback(async () => {
        try {
            const response = await getIssuances(vehicleId);
            setIssuances(response.data || []);
        } catch (error) {
            console.error('Error fetching issuances:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [vehicleId]);

    useEffect(() => {
        loadIssuances();
    }, [loadIssuances]);

    const onRefresh = () => {
        setRefreshing(true);
        loadIssuances();
    };

    const handleCollectReceipt = async (issuance) => {
        if (collectingReceipts.has(issuance.id)) return;

        showAlert(
            'Confirm Collection',
            'Are you sure you want to mark all items in this receipt as collected?',
            'warning',
            async () => {
                setAlertConfig(prev => ({
                    ...prev,
                    loading: true,
                    title: 'Collecting Items',
                    message: 'Processing collection...'
                }));

                setCollectingReceipts(prev => new Set([...prev, issuance.id]));

                try {
                    await confirmTransfer(issuance.id);
                    await loadIssuances();

                    setAlertConfig(prev => ({ ...prev, visible: false, loading: false }));
                    setTimeout(() => {
                        showAlert('Success', 'All items collected successfully!', 'success');
                    }, 200);
                } catch (error) {
                    console.error('Error confirming transfer:', error);
                    setAlertConfig(prev => ({ ...prev, visible: false, loading: false }));
                    setTimeout(() => {
                        showAlert('Error', error.response?.data?.error || 'Failed to collect items', 'error');
                    }, 200);
                } finally {
                    setCollectingReceipts(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(issuance.id);
                        return newSet;
                    });
                }
            }
        );
    };

    const renderIssuance = ({ item: issuance }) => {
        let issuanceTotal = 0;
        const allCollected = issuance.items.every(item =>
            item.layers.every(layer => layer.collected)
        );

        return (
            <View style={styles.receiptCard}>
                <View style={[styles.topBar, allCollected ? styles.topBarCollected : styles.topBarPending]} />

                <View style={styles.receiptHeader}>
                    <View>
                        <AppText variant="caption" style={styles.receiptLabel}>RECEIPT</AppText>
                        <AppText variant="small" style={styles.receiptId}>#{issuance.id.substring(0, 8)}</AppText>
                    </View>
                    <View style={styles.dateContainer}>
                        <AppText variant="bodyBold" style={styles.dateText}>
                            {new Date(issuance.issuedAt).toLocaleDateString()}
                        </AppText>
                        <AppText variant="small" style={styles.timeText}>
                            {new Date(issuance.issuedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </AppText>
                    </View>
                </View>

                <View style={[styles.tableHeader, { backgroundColor: colors.slate100 }]}>
                    <AppText variant="small" style={[styles.headerText, { flex: 1 }]}>QTY</AppText>
                    <AppText variant="small" style={[styles.headerText, { flex: 2 }]}>UNIT</AppText>
                    <AppText variant="small" style={[styles.headerText, { flex: 4 }]}>ITEM</AppText>
                    <AppText variant="small" style={[styles.headerText, { flex: 2, textAlign: 'right' }]}>TOTAL</AppText>
                </View>

                <View style={styles.itemsContainer}>
                    {issuance.items.map((item, itemIdx) =>
                        item.layers.map((layer, layerIdx) => {
                            const key = `${issuance.id}-${itemIdx}-${layerIdx}`;
                            const price = layer.sellingPrice || 0;
                            const lineTotal = price * layer.quantity;
                            issuanceTotal += lineTotal;

                            return (
                                <View key={key} style={styles.itemRow}>
                                    <AppText style={[styles.itemQty, { flex: 1 }]}>{layer.quantity}</AppText>
                                    <AppText variant="small" style={[styles.itemUnit, { flex: 2 }]} numberOfLines={1}>
                                        {layer.unit}
                                    </AppText>
                                    <AppText variant="small" style={[styles.itemName, { flex: 4 }]} numberOfLines={2}>
                                        {item.productName}
                                    </AppText>
                                    <AppText variant="small" style={[styles.itemPrice, { flex: 2 }]}>
                                        {lineTotal > 0 ? lineTotal.toLocaleString() : '-'}
                                    </AppText>
                                </View>
                            );
                        })
                    )}
                </View>

                <View style={styles.receiptFooter}>
                    <View style={styles.footerContent}>
                        <View>
                            <AppText variant="caption" style={styles.statusLabel}>Status</AppText>
                            <AppText variant="small" style={[
                                styles.statusValue,
                                issuance.status === 'collected' ? styles.statusCollected : styles.statusPending
                            ]}>
                                {issuance.status.toUpperCase()}
                            </AppText>
                        </View>
                        <View style={styles.totalContainer}>
                            <AppText variant="caption" style={styles.totalLabel}>TOTAL</AppText>
                            <AppText variant="h3" style={styles.totalValue}>KSh {issuanceTotal.toLocaleString()}</AppText>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={() => handleCollectReceipt(issuance)}
                        disabled={allCollected || collectingReceipts.has(issuance.id)}
                        style={styles.checkboxContainer}
                    >
                        {collectingReceipts.has(issuance.id) ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <View style={[
                                styles.checkbox,
                                allCollected && styles.checkboxChecked
                            ]}>
                                {allCollected && (
                                    <AppText style={styles.checkboxCheck}>✓</AppText>
                                )}
                            </View>
                        )}
                        <AppText variant="small" style={styles.checkboxLabel}>
                            {allCollected ? 'All items collected' : 'Confirm collection of all items'}
                        </AppText>
                    </TouchableOpacity>
                </View>

                <View style={styles.jaggedEdge} />
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <AppText style={styles.loadingText}>Loading issuances...</AppText>
            </View>
        );
    }

    return (
        <View style={styles.tabContent}>
            <FlatList
                data={issuances}
                keyExtractor={(item) => item.id}
                renderItem={renderIssuance}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <AppText variant="h1" style={styles.emptyIcon}>📦</AppText>
                        <AppText variant="h3" style={styles.emptyText}>No issuances found</AppText>
                        <AppText style={styles.emptySubtext}>Pull down to refresh</AppText>
                    </View>
                }
            />
            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
                onConfirm={alertConfig.onConfirm}
                loading={alertConfig.loading}
            />
        </View>
    );
};

// ==================== MAIN SCREEN ====================
export default function IssuanceConfirmationScreen({ route, navigation }) {
    const { vehicleId } = route?.params || {};
    const [activeTab, setActiveTab] = useState('collections'); // Default to Collections for workflow continuity

    useEffect(() => {
        // Update header title based on tab maybe? Or just keep generic.
        navigation.setOptions({ title: 'Stock Management' });
    }, [navigation]);

    return (
        <View style={styles.container}>
            <View style={styles.tabsContainer}>
                <TabButton
                    title="Confirm Collection"
                    isActive={activeTab === 'collections'}
                    onPress={() => setActiveTab('collections')}
                />
                <TabButton
                    title="My Inventory"
                    isActive={activeTab === 'inventory'}
                    onPress={() => setActiveTab('inventory')}
                />
            </View>

            {activeTab === 'collections' ? (
                <CollectionsTab vehicleId={vehicleId} />
            ) : (
                <InventoryTab vehicleId={vehicleId} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    tabsContainer: {
        flexDirection: 'row',
        padding: spacing.s,
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    tabButton: {
        flex: 1,
        paddingVertical: spacing.m,
        alignItems: 'center',
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    tabButtonActive: {
        borderBottomColor: colors.primary,
    },
    tabButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    tabButtonTextActive: {
        color: colors.primary,
    },
    tabContent: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: spacing.s,
        color: colors.textSecondary,
    },
    listContent: {
        paddingHorizontal: spacing.m,
        paddingBottom: 80,
    },

    // Receipt/Collection Styles
    receiptCard: {
        backgroundColor: colors.white,
        marginBottom: spacing.m,
        overflow: 'hidden',
        ...shadows.medium,
    },
    topBar: { height: 4 },
    topBarPending: { backgroundColor: colors.warning },
    topBarCollected: { backgroundColor: colors.success },
    receiptHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: spacing.m,
        backgroundColor: colors.slate100,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        borderStyle: 'dashed',
    },
    receiptLabel: { color: colors.primary, letterSpacing: 1 },
    receiptId: { color: colors.textSecondary, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    dateContainer: { alignItems: 'flex-end' },
    dateText: { color: colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    timeText: { color: colors.textSecondary, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

    tableHeader: {
        flexDirection: 'row',
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s,
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerCell: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textSecondary,
        textTransform: 'uppercase',
    },
    headerText: {
        color: colors.textSecondary,
        letterSpacing: 1,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontWeight: 'bold',
    },

    itemsContainer: { paddingVertical: 4 },
    itemRow: {
        flexDirection: 'row',
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.slate100,
        borderStyle: 'dashed',
    },
    itemQty: { color: colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold' },
    itemUnit: { color: colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    itemName: { color: colors.textSecondary },
    itemPrice: { color: colors.textPrimary, textAlign: 'right', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold' },

    receiptFooter: {
        padding: spacing.m,
        backgroundColor: colors.slate100,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    footerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: spacing.m,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.s,
        gap: spacing.s,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.white,
    },
    checkboxChecked: {
        backgroundColor: colors.success,
        borderColor: colors.success,
    },
    checkboxCheck: {
        color: colors.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
    checkboxLabel: { color: colors.textPrimary, flex: 1 },
    statusLabel: { color: colors.textSecondary, marginBottom: 4 },
    statusValue: { fontWeight: 'bold', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    statusPending: { color: colors.warning },
    statusCollected: { color: colors.success },
    totalContainer: { alignItems: 'flex-end' },
    totalLabel: { color: colors.textSecondary, letterSpacing: 1, marginBottom: 4 },
    totalValue: { color: colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    jaggedEdge: { height: 12, backgroundColor: colors.slate100 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
    emptyIcon: { fontSize: 48, marginBottom: spacing.m },
    emptyText: { color: colors.textPrimary, marginBottom: spacing.xs, fontSize: 16, fontWeight: '600' },
    emptySubtext: { color: colors.textSecondary },

    // Inventory Table Rows
    row: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.white,
    },
    cell: {
        justifyContent: 'center',
    },
    cellTextPrimary: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    cellTextSecondary: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    cellText: {
        fontSize: 14,
        color: colors.textPrimary,
    },
    cellTextBold: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.primary,
    },
    printHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.m,
        paddingHorizontal: spacing.m,
        backgroundColor: colors.slate50,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    printButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.m,
        borderRadius: borderRadius.s,
        ...shadows.small,
    },
    printButtonDisabled: {
        backgroundColor: colors.slate400,
    },
    printIcon: {
        fontSize: 16,
        marginRight: 6,
    },
    printButtonText: {
        color: colors.white,
        fontWeight: '700',
        fontSize: 14,
    }
});
