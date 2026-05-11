import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    StatusBar,
    Platform,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getIssuances, getSales, getSalesStats, getVehicleInventory, getVehicleById, getInventory } from '../services/api';
import { useFocusEffect } from '@react-navigation/native';
import CustomAlert from '../components/ui/CustomAlert';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import DatePickerModal from '../components/ui/DatePickerModal';

export default function StockScreen({ route, navigation }) {
    const { vehicleId: paramVehicleId, vehicleName: paramVehicleName } = route?.params || {};
    const [vehicleId, setVehicleId] = useState(paramVehicleId);
    const [vehicleName, setVehicleName] = useState(paramVehicleName);
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [userName, setUserName] = useState('');
    const [role, setRole] = useState('sales_rep');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState('today'); // 'today', 'all', or 'YYYY-MM-DD'
    const [periodLoading, setPeriodLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [stats, setStats] = useState({
        totalStock: 0,
        totalSalesAmount: 0,
        salesTarget: 0,
    });
    const [recentSales, setRecentSales] = useState([]);
    const [pendingIssuances, setPendingIssuances] = useState(0);
    const [logoutAlertVisible, setLogoutAlertVisible] = useState(false);

    useEffect(() => {
        const initVehicle = async () => {
            console.log('🚀 initVehicle called, vehicleId:', vehicleId);

            // Always fetch userData to determine role and other info
            const userDataStr = await AsyncStorage.getItem('userData');
            let user = null;
            if (userDataStr) {
                user = JSON.parse(userDataStr);
                setRole(user.role || 'sales_rep');
                setUserName(user.username || user.name || 'Sales Rep');
                console.log("User Role set to:", user.role || 'sales_rep');
            }

            if (!vehicleId) {
                console.log('📱 vehicleId not set, using from userData...');
                if (user) {
                    setVehicleId(user.assignedVehicleId);
                    setVehicleName(user.assignedVehicleName || 'My Vehicle');
                } else {
                    console.warn('⚠️ No userData found in AsyncStorage');
                }
            } else {
                console.log('✅ vehicleId already set:', vehicleId);
            }
        };
        initVehicle();
    }, [vehicleId]);

    useEffect(() => {
        if (vehicleId) loadData();
    }, [vehicleId, selectedPeriod]); // Reload when period changes

    useFocusEffect(
        useCallback(() => {
            if (vehicleId) loadData();
        }, [vehicleId])
    );


    const getDateRangeForPeriod = (period) => {
        const now = new Date();

        const formatDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        if (period === 'today') {
            const dateStr = formatDate(now);
            return {
                startDate: dateStr,
                endDate: dateStr
            };
        } else if (period === 'week') {
            // Get start of current week (Sunday)
            const dayOfWeek = now.getDay();
            const startOfWeek = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
            return {
                startDate: formatDate(startOfWeek),
                endDate: formatDate(now)
            };
        } else if (period && period.includes('-')) {
            // Specific date in YYYY-MM-DD format
            return {
                startDate: period,
                endDate: period
            };
        } else {
            // alltime - no date range
            return {};
        }
    };

    const loadData = async () => {
        if (!vehicleId) return;

        // Set period loading if not initial load
        if (!loading) setPeriodLoading(true);

        try {
            const dateRange = getDateRangeForPeriod(selectedPeriod);
            console.log('==================== SALES DEBUG ====================');
            console.log('Selected Period:', selectedPeriod);
            console.log('Date Range:', dateRange);
            console.log('Vehicle ID:', vehicleId);

            const results = await Promise.allSettled([
                getVehicleInventory(vehicleId),
                getSalesStats({
                    vehicleId,
                    type: (selectedPeriod === 'today' || selectedPeriod === 'all') ? selectedPeriod : 'all',
                    ...(selectedPeriod.includes('-') && { startDate: selectedPeriod, endDate: selectedPeriod })
                }),
                getIssuances(vehicleId),
                getSales({
                    vehicleId,
                    limit: 1000
                }),
                getVehicleById(vehicleId),
                getInventory({ limit: 1000 }),
            ]);

            const [inventoryResult, statsResult, issuancesResult, salesResult, vehicleResult, productsResult] = results;

            console.log('Stats API Result:', statsResult);
            if (statsResult.status === 'fulfilled') {
                console.log('Stats Data:', statsResult.value);
            } else {
                console.error('Stats Error:', statsResult.reason);
            }

            console.log('Sales API Result:', salesResult);
            if (salesResult.status === 'fulfilled') {
                console.log('Recent Sales Data:', salesResult.value);
            } else {
                console.error('Sales Error:', salesResult.reason);
            }

            const priceMap = {};
            if (productsResult.status === 'fulfilled') {
                const productsData = productsResult.value?.data || productsResult.value?.items || productsResult.value || [];
                const productsList = Array.isArray(productsData) ? productsData : (productsData.items || []);
                productsList.forEach(p => {
                    if (p.id) priceMap[p.id] = p.sellingPrice || p.unitPrice || 0;
                    if (p.productName) priceMap[p.productName] = p.sellingPrice || p.unitPrice || 0;
                });
            }

            if (vehicleResult.status === 'fulfilled') {
                const vehicleData = vehicleResult.value?.data || vehicleResult.value;
                if (vehicleData) {
                    setVehicleName(vehicleData.vehicleName || 'My Vehicle');
                    setVehicleNumber(vehicleData.registrationNumber || vehicleData.vehicleNumber || '');

                    // Get stored sales target (set at 95% of inventory value during collection)
                    const salesTarget = vehicleData.currentSalesTarget || 0;
                    setStats(prev => ({ ...prev, salesTarget }));
                }
            }

            if (inventoryResult.status === 'fulfilled') {
                const data = inventoryResult.value?.data || inventoryResult.value || [];
                const items = Array.isArray(data) ? data : [];

                const totalStock = items.reduce((sum, item) => {
                    const itemQty = item.layers?.reduce((lSum, layer) => lSum + (layer.quantity || 0), 0) || item.quantity || 0;
                    return sum + itemQty;
                }, 0);


                setStats(prev => ({ ...prev, totalStock }));
            }

            if (issuancesResult.status === 'fulfilled') {
                const data = issuancesResult.value?.data || issuancesResult.value || [];
                const pending = (Array.isArray(data) ? data : []).filter(i => i.status === 'pending').length;
                setPendingIssuances(pending);
            }

            if (salesResult.status === 'fulfilled') {
                const responseData = salesResult.value;
                let allSalesData = [];
                if (responseData?.data?.sales) allSalesData = responseData.data.sales;
                else if (Array.isArray(responseData?.data)) allSalesData = responseData.data;
                else if (responseData?.sales) allSalesData = responseData.sales;

                const dateRange = getDateRangeForPeriod(selectedPeriod);
                const startStr = dateRange.startDate;
                const endStr = dateRange.endDate;

                // Filter sales by date on frontend to avoid needing backend index
                const filteredSales = (Array.isArray(allSalesData) ? allSalesData : []).filter(sale => {
                    if (selectedPeriod === 'all') return true;
                    const saleDate = (sale.saleDate || sale.soldAt || sale.createdAt || '').split('T')[0];
                    if (!startStr) return true;
                    return saleDate >= startStr && saleDate <= (endStr || startStr);
                });

                setRecentSales(filteredSales.slice(0, 5));

                // Manually sum up revenue from filtered list
                const manualTotalRevenue = filteredSales.reduce((sum, sale) => {
                    return sum + (sale.grandTotal || sale.totalAmount || 0);
                }, 0);

                console.log(`[Dashboard] Manual total revenue for ${selectedPeriod} (filtered locally):`, manualTotalRevenue);
                setStats(prev => ({ ...prev, totalSalesAmount: manualTotalRevenue }));
            }

        } catch (error) {
            console.error('[Dashboard] Error loading data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setPeriodLoading(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleLogout = () => setLogoutAlertVisible(true);

    const confirmLogout = async () => {
        setLogoutAlertVisible(false);
        await AsyncStorage.clear();
        navigation.replace('Login');
    };

    const formatCurrency = (amount) => `KSh ${Math.floor(amount || 0).toLocaleString()}`;

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
                <View style={styles.header}>
                    <View>
                        <LoadingSkeleton style={{ width: 120, height: 20, marginBottom: 4 }} />
                        <LoadingSkeleton style={{ width: 80, height: 14 }} />
                    </View>
                </View>
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    <View style={styles.statsContainer}>
                        <LoadingSkeleton variant="statCard" />
                        <View style={styles.statsRow}>
                            <LoadingSkeleton variant="statCardSmall" style={{ marginRight: 8 }} />
                            <LoadingSkeleton variant="statCardSmall" style={{ marginLeft: 8 }} />
                        </View>
                    </View>
                    <View style={styles.section}>
                        <LoadingSkeleton style={{ width: 120, height: 17, marginBottom: 12 }} />
                        <View style={styles.actionsGrid}>
                            <LoadingSkeleton variant="actionCard" />
                            <LoadingSkeleton variant="actionCard" />
                            <LoadingSkeleton variant="actionCard" />
                            <LoadingSkeleton variant="actionCard" />
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    }

    if (!vehicleId) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.errorTitle}>No Vehicle Assigned</Text>
                <Text style={styles.errorText}>Contact your administrator to get assigned.</Text>
                <TouchableOpacity style={styles.logoutButtonAlt} onPress={handleLogout}>
                    <Text style={styles.logoutButtonAltText}>Sign Out</Text>
                </TouchableOpacity>
                <CustomAlert
                    visible={logoutAlertVisible}
                    title="Logout"
                    message="Are you sure you want to logout?"
                    onClose={() => setLogoutAlertVisible(false)}
                    onConfirm={confirmLogout}
                    confirmText="Logout"
                    type="warning"
                />
            </View>
        );
    }

    const renderSalesDashboard = () => (
        <>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hello, {userName}</Text>
                    <Text style={styles.vehicleInfo}>{vehicleNumber || vehicleName}</Text>
                </View>
                <TouchableOpacity onPress={handleLogout}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1D4ED8" />}
                showsVerticalScrollIndicator={false}
            >
                {/* Stats Cards */}
                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        {/* Period Filter Tabs */}
                        <View style={styles.periodTabs}>
                            <TouchableOpacity
                                style={[styles.periodTab, (selectedPeriod === 'today' || selectedPeriod.includes('-')) && styles.periodTabActive]}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text style={[styles.periodTabText, (selectedPeriod === 'today' || selectedPeriod.includes('-')) && styles.periodTabTextActive]}>
                                    {selectedPeriod === 'today' ? 'Today' : (selectedPeriod.includes('-') ? selectedPeriod : 'Select Date')} 📅
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.periodTab, selectedPeriod === 'all' && styles.periodTabActive]}
                                onPress={() => setSelectedPeriod('all')}
                            >
                                <Text style={[styles.periodTabText, selectedPeriod === 'all' && styles.periodTabTextActive]}>All Time </Text>
                            </TouchableOpacity>
                        </View>
                        <View>
                            <Text style={styles.statLabel}>Total Sales</Text>
                            {periodLoading ? (
                                <ActivityIndicator color="#1D4ED8" size="small" style={{ marginVertical: 8 }} />
                            ) : (
                                <Text style={styles.statValue}>{formatCurrency(stats.totalSalesAmount)}</Text>
                            )}
                        </View>

                    </View>
                    <View style={styles.statCardSmall}>
                        <Text style={styles.statLabelSmall}>Stock Items</Text>
                        <Text style={styles.statValueSmall}>{stats.totalStock}</Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.actionsGrid}>
                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => navigation.navigate('SalesDashboard', { vehicleId })}
                        >
                            <Text style={styles.actionIcon}>📊</Text>
                            <Text style={styles.actionLabel}>Sales </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => navigation.navigate('Expenses', { vehicleId })}
                        >
                            <Text style={styles.actionIcon}>💳</Text>
                            <Text style={styles.actionLabel}>Expenses</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => navigation.navigate('Reports', { vehicleId })}
                        >
                            <Text style={styles.actionIcon}>📄</Text>
                            <Text style={styles.actionLabel}>Reports</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => navigation.navigate('CustomerDebts')}
                        >
                            <Text style={styles.actionIcon}>💰</Text>
                            <Text style={styles.actionLabel}>Debts</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Recent Sales */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Sales</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('SalesList', { vehicleId })}>
                            <Text style={styles.viewAllLink}>View all</Text>
                        </TouchableOpacity>
                    </View>
                    {recentSales.length > 0 ? (
                        recentSales.map((sale, index) => (
                            <TouchableOpacity
                                key={sale.id || index}
                                style={styles.saleItem}
                                onPress={() => navigation.navigate('SaleDetails', { saleId: sale.id })}
                            >
                                <View>
                                    <Text style={styles.saleCustomer}>{sale.customerName || 'Walk-in Customer'}</Text>
                                    <Text style={styles.saleDate}>
                                        {new Date(sale.saleDate || sale.createdAt).toLocaleDateString()}
                                    </Text>
                                </View>
                                <Text style={styles.saleAmount}>{formatCurrency(sale.grandTotal || sale.totalAmount)}</Text>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No recent sales</Text>
                    )}
                </View>
            </ScrollView>

            {/* Floating Action Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('Sales', { vehicleId, vehicleName })}
                activeOpacity={0.9}
            >
                <Text style={styles.fabIcon}>+</Text>
                <Text style={styles.fabText}>New Sale</Text>
            </TouchableOpacity>
        </>
    );

    const renderDriverDashboard = () => (
        <>
            {/* Dark Header */}
            <View style={styles.driverHeader}>
                <View>
                    <Text style={styles.driverGreeting}>Driver Portal</Text>
                    <View style={styles.vehicleBadge}>
                        <Text style={styles.vehicleBadgeText}>{vehicleNumber || 'NO PLATE'}</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.driverLogout} onPress={handleLogout}>
                    <Text style={styles.driverLogoutText}>Sign Out</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
                showsVerticalScrollIndicator={false}
            >
                {/* Collection Alert */}
                {pendingIssuances > 0 && (
                    <TouchableOpacity
                        style={styles.collectionAlert}
                        onPress={() => navigation.navigate('IssuanceConfirmation', { vehicleId })}
                    >
                        <View style={styles.alertIconContainer}>
                            <Text style={styles.alertEmoji}>🚨</Text>
                        </View>
                        <View style={styles.alertContent}>
                            <Text style={styles.alertTitle}>New Collection Ready</Text>
                            <Text style={styles.alertSubtitle}>{pendingIssuances} pending stock transfers</Text>
                        </View>
                        <Text style={styles.alertArrow}>→</Text>
                    </TouchableOpacity>
                )}

                {/* Primary Vehicle Stats */}
                <View style={styles.driverStatsRow}>
                    <View style={styles.driverStatCard}>
                        <Text style={styles.driverStatLabel}>CURRENT LOAD</Text>
                        <Text style={styles.driverStatValue}>{stats.totalStock || 0}</Text>
                        <Text style={styles.driverStatUnit}>units in vehicle</Text>
                    </View>
                    <View style={[styles.driverStatCard, { backgroundColor: '#F8FAFB', marginLeft: 12 }]}>
                        <Text style={styles.driverStatLabel}>DRIVER</Text>
                        <Text style={[styles.driverStatValue, { fontSize: 18, color: '#475569' }]} numberOfLines={1}>
                            {userName || 'Active Driver'}
                        </Text>
                        <Text style={styles.driverStatUnit} numberOfLines={1}>
                            {vehicleName || 'Assigned Vehicle'}
                        </Text>
                    </View>
                </View>

                <View style={styles.utilitySection}>
                    <Text style={styles.utilityTitle}>Vehicle Management</Text>
                    <View style={styles.utilityGrid}>
                        <TouchableOpacity
                            style={styles.utilityButton}
                            onPress={() => navigation.navigate('IssuanceConfirmation', { vehicleId })}
                        >
                            <View style={[styles.utilityIconBg, { backgroundColor: '#FEF3C7' }]}>
                                <Text style={styles.utilityEmoji}>📦</Text>
                            </View>
                            <Text style={styles.utilityLabel}>Confirm{"\n"}Collection</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Info Card */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>Safety Reminder</Text>
                    <Text style={styles.infoText}>
                        Always ensure your vehicle is securely locked before leaving. Verify all items during collection to ensure stock accuracy.
                    </Text>
                </View>
            </ScrollView>
        </>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            <View style={{ flex: 1 }}>
                {role === 'driver' ? renderDriverDashboard() : renderSalesDashboard()}
            </View>

            <DatePickerModal
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                onSelect={(date) => {
                    setSelectedPeriod(date);
                    setShowDatePicker(false);
                }}
                initialDate={selectedPeriod.includes('-') ? selectedPeriod : (() => {
                    const d = new Date();
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                })()}
            />

            <CustomAlert
                visible={logoutAlertVisible}
                title="Logout"
                message="Are you sure you want to logout?"
                onClose={() => setLogoutAlertVisible(false)}
                onConfirm={confirmLogout}
                confirmText="Logout"
                type="warning"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 24,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    errorText: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
    },
    logoutButtonAlt: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    logoutButtonAltText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#EF4444',
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    greeting: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    vehicleInfo: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    logoutText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#EF4444',
    },

    // Scroll
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },

    // Period Tabs
    periodTabs: {
        flexDirection: 'row',
        // paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 8,
        gap: 8,
    },
    periodTab: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
    },
    periodTabActive: {
        backgroundColor: '#EFF6FF',
        borderColor: '#1D4ED8',
    },
    periodTabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    periodTabTextActive: {
        color: '#1D4ED8',
    },

    // Stats
    statsContainer: {
        padding: 20,
    },
    statCard: {
        backgroundColor: '#1D4ED8', // Kept Dark (assuming stats text works or we change it) - Wait, white text is broken.
        // Changing to Light for safety
        backgroundColor: '#EFF6FF', // Light Blue
        borderRadius: 16,
        padding: 20,
        paddingTop: 0,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#b5bfd3ff',
    },

    statLabel: {
        fontSize: 14,
        color: '#1D4ED8', // Dark Blue
        marginBottom: 4,
    },
    statValue: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1D4ED8', // Dark Blue
    },
    statsRow: {
        flexDirection: 'row',
    },
    statCardSmall: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    statLabelSmall: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 4,
    },
    statValueSmall: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },

    // Section
    section: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    viewAllLink: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1D4ED8',
    },

    // Actions Grid
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -6,
    },
    actionCard: {
        width: '25%',
        paddingHorizontal: 6,
        alignItems: 'center',
        position: 'relative',
    },
    actionIcon: {
        fontSize: 28,
        marginBottom: 6,
    },
    actionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: '15%',
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    // Sales List
    saleItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    saleCustomer: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    saleDate: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    saleAmount: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D4ED8',
    },
    emptyText: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        paddingVertical: 24,
    },

    // FAB
    fab: {
        position: 'absolute',
        bottom: 24,
        left: 20,
        right: 20,
        height: 56,
        backgroundColor: '#e8a30eff', // Light Green
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#708a79ff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        color: '#fff',
    },
    fabIcon: {
        fontSize: 24,
        fontWeight: '600',
        color: '#fff',
        marginRight: 8,
    },
    fabText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#fff',
    },
    // Driver specific styles
    driverHeader: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 24,
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    driverGreeting: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    vehicleBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        marginTop: 6,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    vehicleBadgeText: {
        color: '#1E293B',
        fontSize: 24,
        fontWeight: '800',
    },
    driverLogout: {
        paddingBottom: 4,
    },
    driverLogoutText: {
        color: '#F87171',
        fontSize: 14,
        fontWeight: '700',
    },
    collectionAlert: {
        margin: 20,
        padding: 16,
        backgroundColor: '#FFFBEB', // Light Amber
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FDE68A',
        flexDirection: 'row',
        alignItems: 'center',
    },
    alertIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#F59E0B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    alertEmoji: {
        fontSize: 24,
    },
    alertContent: {
        flex: 1,
        marginLeft: 16,
    },
    alertTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#92400E',
    },
    alertSubtitle: {
        fontSize: 13,
        color: '#B45309',
        marginTop: 2,
    },
    alertArrow: {
        fontSize: 20,
        color: '#F59E0B',
        fontWeight: '700',
    },
    driverStatsRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 24,
        paddingTop: 50,
    },
    driverStatCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        ...shadows.small,
    },
    driverStatLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
        letterSpacing: 0.5,
    },
    driverStatValue: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1E293B',
        marginVertical: 4,
    },
    driverStatUnit: {
        fontSize: 12,
        color: '#94A3B8',
    },
    utilitySection: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    utilityTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 16,
    },
    utilityGrid: {
        flexDirection: 'row',
    },
    utilityButton: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    utilityIconBg: {
        width: 50,
        height: 50,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    utilityEmoji: {
        fontSize: 24,
    },
    utilityLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
        textAlign: 'center',
        lineHeight: 18,
    },
    infoCard: {
        marginHorizontal: 20,
        padding: 20,
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 4,
    },
    infoText: {
        fontSize: 13,
        color: '#64748B',
        lineHeight: 20,
    },
});
