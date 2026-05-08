import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { getSalesStats, getSales } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Theme & UI
import { colors, spacing, borderRadius, shadows, typography } from '../theme';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';
import DatePickerModal from '../components/ui/DatePickerModal';

export default function SalesDashboardScreen({ route, navigation }) {
    const { vehicleId } = route?.params || {};
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState(null);
    const [recentSales, setRecentSales] = useState([]);
    const [filterType, setFilterType] = useState('today'); // 'today' | 'all' | 'YYYY-MM-DD'
    const [etrFilter, setEtrFilter] = useState('all');     // 'all' | 'etr' | 'nonEtr'
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Derive the isEtr param value for API calls
    const getIsEtrParam = useCallback((filter) => {
        if (filter === 'etr') return true;
        if (filter === 'nonEtr') return false;
        return undefined; // 'all' => no filter
    }, []);

    useEffect(() => {
        const checkRole = async () => {
            const userDataStr = await AsyncStorage.getItem('userData');
            if (userDataStr) {
                const user = JSON.parse(userDataStr);
                if (user.role === 'driver') {
                    console.log('🚫 Driver tried to access sales dashboard');
                    navigation.replace('Stock', { vehicleId: user.assignedVehicleId });
                    return;
                }
            }
            loadData();
        };
        checkRole();
    }, [filterType, etrFilter]);

    const loadData = async () => {
        try {
            const isEtr = getIsEtrParam(etrFilter);
            const isSpecificDate = filterType.includes('-');

            const formatDate = (d) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const now = new Date();
            const dateStr = isSpecificDate ? filterType : formatDate(now);

            const statsParams = {
                vehicleId,
                type: 'all', // Fetch all time stats to avoid needing index for specific date types
                ...(isEtr !== undefined && { isEtr })
            };

            const salesParams = {
                vehicleId,
                limit: 1000,
                // No date parameters here to avoid index requirement
                ...(isEtr !== undefined && { isEtr })
            };

            const [statsRes, salesRes] = await Promise.all([
                getSalesStats(statsParams),
                getSales(salesParams)
            ]);

            const statsData = statsRes.data || {};
            const allSalesData = salesRes.data?.sales || salesRes.sales || [];

            // Filter sales on frontend
            const filteredSales = allSalesData.filter(sale => {
                if (filterType === 'all') return true;
                const saleDate = (sale.saleDate || sale.soldAt || sale.date || '').split('T')[0];
                const targetDate = isSpecificDate ? filterType : formatDate(now);
                return saleDate === targetDate;
            });

            const salesData = filteredSales;

            // Manually sum up stats from filtered sales list for consistency
            const manualRevenue = salesData.reduce((sum, sale) => sum + (sale.grandTotal || sale.totalAmount || 0), 0);

            const manualPaymentMethods = {
                cash: { amount: 0, count: 0 },
                mpesa: { amount: 0, count: 0 },
                bank: { amount: 0, count: 0 },
                credit: { amount: 0, count: 0 }
            };

            salesData.forEach(sale => {
                const amount = sale.grandTotal || sale.totalAmount || 0;
                const method = (sale.paymentMethod || 'cash').toLowerCase();

                // If it's mixed, we should probably look at the individual payments if available
                // but the backend statsRes might still have the correct labels if we trust the breakdown
                // However, the user wants us to "add up sales totals"
                if (method === 'mixed' && sale.payments) {
                    sale.payments.forEach(p => {
                        const m = p.method === 'credit' ? 'credit' : p.method;
                        if (manualPaymentMethods[m]) {
                            manualPaymentMethods[m].amount += p.amount;
                            manualPaymentMethods[m].count += 1;
                        }
                    });
                } else if (manualPaymentMethods[method]) {
                    manualPaymentMethods[method].amount += amount;
                    manualPaymentMethods[method].count += 1;
                }
            });

            const adjustedStats = {
                ...statsData,
                totalRevenue: manualRevenue,
                paymentMethods: manualPaymentMethods,
                totalTransactions: salesData.length
            };

            setStats(adjustedStats);
            setRecentSales(salesData.slice(0, 10));
        } catch (error) {
            console.error('[Dashboard] Error loading dashboard:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const getSafeAmount = (pm) => {
        if (!pm) return 0;
        if (typeof pm === 'object' && pm.amount !== undefined) return pm.amount;
        return typeof pm === 'number' ? pm : 0;
    };

    const renderStatCard = (title, value, color, subValue) => (
        <View style={styles.statCard}>
            <AppText variant="caption" style={styles.statTitle}>{title}</AppText>
            <AppText variant="h2" style={[styles.statValue, { color }]}>{value}</AppText>
            {subValue && <AppText variant="small" style={styles.statSubValue}>{subValue}</AppText>}
        </View>
    );

    const renderSaleItem = ({ item }) => {
        const amount = item.grandTotal || item.totalAmount || 0;
        const dateStr = item.saleDate || item.soldAt || item.date || new Date().toISOString();
        const paymentMethod = item.paymentMethod || 'cash';

        return (
            <TouchableOpacity
                key={item.id}
                style={styles.saleItem}
                onPress={() => navigation.navigate('SaleDetails', { saleId: item.id })}
            >
                <View style={styles.saleHeader}>
                    <View>
                        <AppText variant="small" style={styles.saleId}>#{item.receiptNumber || item.id?.substring(0, 8) || '???'}</AppText>
                        {item.isEtr && (
                            <AppText variant="caption" style={{ color: colors.secondary, fontWeight: 'bold', fontSize: 9, marginTop: 2 }}>
                                ETR COMPLIANT
                            </AppText>
                        )}
                    </View>
                    <AppText variant="small" style={styles.saleDate}>
                        {new Date(dateStr).toLocaleDateString()}
                    </AppText>
                </View>
                <View style={styles.saleDetails}>
                    <AppText style={styles.saleItemsCount}>{(item.items?.length || 0)} items</AppText>
                    <AppText variant="bodyBold" style={styles.saleAmount}>KSh {amount.toLocaleString()}</AppText>
                </View>
                <View style={styles.saleFooter}>
                    <AppText variant="caption" style={[
                        styles.paymentMethod,
                        paymentMethod === 'mpesa' ? styles.mpesa : styles.cash
                    ]}>
                        {paymentMethod.toUpperCase()}
                    </AppText>
                    <AppText variant="small" style={styles.saleTime}>
                        {new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </AppText>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <AppText style={styles.backButton}>← Back</AppText>
                </TouchableOpacity>
                <AppText variant="h3" style={styles.headerTitle}>Sales Dashboard</AppText>
                <View style={{ width: 60 }} />
            </View>

            {/* Filter Controls */}
            <View style={styles.filterContainer}>
                {/* Period filter: Today / All Time */}
                <View style={styles.segmentControl}>
                    <TouchableOpacity
                        style={[styles.segmentButton, (filterType === 'today' || filterType.includes('-')) && styles.segmentActive]}
                        onPress={() => setShowDatePicker(true)}
                    >
                        <AppText style={[styles.segmentText, (filterType === 'today' || filterType.includes('-')) && styles.segmentTextActive]}>
                            {filterType === 'today' ? 'Today' : (filterType.includes('-') ? filterType : 'Select Date')} 📅
                        </AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.segmentButton, filterType === 'all' && styles.segmentActive]}
                        onPress={() => setFilterType('all')}
                    >
                        <AppText style={[styles.segmentText, filterType === 'all' && styles.segmentTextActive]}>All Time</AppText>
                    </TouchableOpacity>
                </View>

                {/* ETR filter: All / ETR / Non-ETR */}
                <View style={[styles.segmentControl, { marginTop: spacing.s }]}>
                    <TouchableOpacity
                        style={[styles.segmentButton, etrFilter === 'all' && styles.segmentActive]}
                        onPress={() => setEtrFilter('all')}
                    >
                        <AppText style={[styles.segmentText, etrFilter === 'all' && styles.segmentTextActive]}>All Sales</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.segmentButton, etrFilter === 'etr' && styles.etrSegmentActive]}
                        onPress={() => setEtrFilter('etr')}
                    >
                        <AppText style={[styles.segmentText, etrFilter === 'etr' && styles.etrSegmentTextActive]}>✓ ETR</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.segmentButton, etrFilter === 'nonEtr' && styles.nonEtrSegmentActive]}
                        onPress={() => setEtrFilter('nonEtr')}
                    >
                        <AppText style={[styles.segmentText, etrFilter === 'nonEtr' && styles.nonEtrSegmentTextActive]}>Non-ETR</AppText>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    {renderStatCard(
                        etrFilter === 'etr' ? 'ETR Revenue' : etrFilter === 'nonEtr' ? 'Non-ETR Revenue' : 'Total Revenue',
                        `KSh ${(stats?.totalRevenue || 0).toLocaleString()}`,
                        colors.primary,
                        `${stats?.totalItemsSold >= 0 ? stats.totalItemsSold + ' items' : stats?.totalTransactions + ' txns'}`
                    )}

                    {/* ETR Badge — shown when a filter is active */}
                    {etrFilter !== 'all' && (
                        <View style={[
                            styles.etrBadge,
                            etrFilter === 'etr' ? styles.etrBadgeGreen : styles.etrBadgeGray
                        ]}>
                            <AppText style={styles.etrBadgeText}>
                                {etrFilter === 'etr'
                                    ? '✓ Showing ETR-Compliant Sales Only'
                                    : '✗ Showing Non-ETR Sales Only'}
                            </AppText>
                        </View>
                    )}

                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: spacing.s }}>
                            {renderStatCard(
                                'Cash Sales',
                                `KSh ${getSafeAmount(stats?.paymentMethods?.cash).toLocaleString()}`,
                                colors.success
                            )}
                        </View>
                        <View style={{ flex: 1, marginLeft: spacing.s }}>
                            {renderStatCard(
                                'M-Pesa Sales',
                                `KSh ${getSafeAmount(stats?.paymentMethods?.mpesa).toLocaleString()}`,
                                colors.secondary
                            )}
                        </View>
                    </View>
                    <View style={[styles.row, { marginTop: spacing.m }]}>
                        <View style={{ flex: 1, marginRight: spacing.s }}>
                            {renderStatCard(
                                'Bank Sales',
                                `KSh ${getSafeAmount(stats?.paymentMethods?.bank).toLocaleString()}`,
                                colors.info || colors.primary
                            )}
                        </View>
                        <View style={{ flex: 1, marginLeft: spacing.s }}>
                            {renderStatCard(
                                'Debt Sales',
                                `KSh ${getSafeAmount(stats?.paymentMethods?.credit).toLocaleString()}`,
                                colors.warning || colors.orange600
                            )}
                        </View>
                    </View>
                </View>

                {/* Recent Sales */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <AppText variant="h3" style={styles.sectionTitle}>
                            {filterType === 'today' ? 'Recent Transactions' : 'Recent History'}
                        </AppText>
                        <TouchableOpacity onPress={() => navigation.navigate('SalesList', { vehicleId })}>
                            <AppText style={styles.viewAllButton}>View All</AppText>
                        </TouchableOpacity>
                    </View>
                    {recentSales.length > 0 ? (
                        recentSales.map(item => (
                            <View key={item.id} style={{ marginBottom: spacing.s }}>
                                {renderSaleItem({ item })}
                            </View>
                        ))
                    ) : (
                        <AppText style={styles.emptyText}>No sales found for this period</AppText>
                    )}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <AppButton
                    title="Record New Sale"
                    onPress={() => navigation.navigate('Sales', { vehicleId })}
                />
            </View>

            <DatePickerModal
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                onSelect={(date) => {
                    setFilterType(date);
                    setShowDatePicker(false);
                }}
                initialDate={filterType.includes('-') ? filterType : (() => {
                    const d = new Date();
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                })()}
            />
        </View >
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.m,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        color: colors.primary,
        fontWeight: '600',
    },
    headerTitle: {
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        padding: spacing.m,
    },
    statsGrid: {
        marginBottom: spacing.l,
        gap: spacing.m,
    },
    row: {
        flexDirection: 'row',
    },
    statCard: {
        backgroundColor: colors.surface,
        padding: spacing.m,
        borderRadius: borderRadius.m,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.small,
    },
    statTitle: {
        color: colors.textSecondary,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    statValue: {
        marginBottom: 2,
    },
    statSubValue: {
        color: colors.textSecondary,
    },
    section: {
        marginBottom: spacing.l,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.s,
    },
    sectionTitle: {
        color: colors.textPrimary,
    },
    viewAllButton: {
        color: colors.primary,
        fontWeight: '600',
    },
    saleItem: {
        backgroundColor: colors.surface,
        padding: spacing.m,
        borderRadius: borderRadius.m,
        borderWidth: 1,
        borderColor: colors.border,
    },
    saleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.s,
    },
    saleId: {
        color: colors.textSecondary,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    saleDate: {
        color: colors.textSecondary,
    },
    saleDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.s,
    },
    saleItemsCount: {
        color: colors.textSecondary,
    },
    saleAmount: {
        color: colors.textPrimary,
    },
    saleFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing.s,
        borderTopWidth: 1,
        borderTopColor: colors.slate100,
    },
    paymentMethod: {
        fontWeight: 'bold',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    cash: {
        backgroundColor: colors.successBg,
        color: colors.success,
    },
    mpesa: {
        backgroundColor: colors.secondaryBg,
        color: colors.secondary,
    },
    saleTime: {
        color: colors.textSecondary,
    },
    emptyText: {
        textAlign: 'center',
        color: colors.textSecondary,
        marginTop: spacing.l,
    },
    footer: {
        padding: spacing.m,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    filterContainer: {
        padding: spacing.m,
        backgroundColor: colors.surface,
        marginTop: 1,
    },
    segmentControl: {
        flexDirection: 'row',
        backgroundColor: colors.slate100,
        borderRadius: borderRadius.button,
        padding: 4,
    },
    segmentButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: borderRadius.s,
    },
    segmentActive: {
        backgroundColor: colors.white,
        ...shadows.small,
    },
    segmentText: {
        fontWeight: '600',
        color: colors.textSecondary,
    },
    segmentTextActive: {
        color: colors.primary,
    },
    // ETR filter segment styles
    etrSegmentActive: {
        backgroundColor: colors.success,
        ...shadows.small,
    },
    etrSegmentTextActive: {
        color: colors.white,
    },
    nonEtrSegmentActive: {
        backgroundColor: colors.warning || '#f59e0b',
        ...shadows.small,
    },
    nonEtrSegmentTextActive: {
        color: colors.white,
    },
    // ETR badge shown below revenue when a filter is active
    etrBadge: {
        borderRadius: borderRadius.s,
        paddingVertical: 6,
        paddingHorizontal: 10,
        alignItems: 'center',
    },
    etrBadgeGreen: {
        backgroundColor: colors.successBg || '#dcfce7',
    },
    etrBadgeGray: {
        backgroundColor: colors.slate100 || '#f1f5f9',
    },
    etrBadgeText: {
        fontWeight: '600',
        fontSize: 12,
        color: colors.textSecondary,
    },
});
