import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Platform
} from 'react-native';
import { getSales } from '../services/api';

// Theme & UI
import { colors, spacing, borderRadius, shadows, typography } from '../theme';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';

export default function SalesListScreen({ route, navigation }) {
    const { vehicleId } = route?.params || {};

    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [dateRange, setDateRange] = useState('week'); // 'today', 'week', 'month', 'all'
    const [isFiltered, setIsFiltered] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            loadSales(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, dateRange]);

    const loadSales = async (page = 1) => {
        try {
            setLoading(true);
            const params = {
                page,
                limit: 20,
                sortBy: 'createdAt',
                sortOrder: 'desc',
                status: 'completed',
            };

            if (vehicleId) {
                params.vehicleId = vehicleId;
            }

            if (searchQuery.trim()) {
                params.search = searchQuery.trim();
            } else {
                const now = new Date();
                let startDate = new Date();

                if (dateRange === 'today') {
                    startDate.setHours(0, 0, 0, 0);
                    params.startDate = startDate.toISOString();
                } else if (dateRange === 'week') {
                    startDate.setDate(now.getDate() - 7);
                    startDate.setHours(0, 0, 0, 0);
                    params.startDate = startDate.toISOString();
                } else if (dateRange === 'month') {
                    startDate.setMonth(now.getMonth() - 1);
                    startDate.setHours(0, 0, 0, 0);
                    params.startDate = startDate.toISOString();
                }
            }

            setIsFiltered(!!searchQuery.trim() || dateRange !== 'all');

            const response = await getSales(params);
            setSales(response.data.sales || []);
            setPagination(response.data.pagination || {});
        } catch (error) {
            console.error('Error loading sales:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadSales(1);
    };

    const handleSearch = (text) => {
        setSearchQuery(text);
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-KE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getPaymentMethodBadge = (method) => {
        const badges = {
            cash: { icon: '💵', label: 'Cash', color: colors.success },
            mpesa: { icon: '📱', label: 'M-Pesa', color: colors.secondary },
            bank: { icon: '🏦', label: 'Bank', color: colors.info },
            credit: { icon: '📝', label: 'Credit', color: colors.warning },
            mixed: { icon: '💳', label: 'Mixed', color: colors.primary },
        };
        return badges[method] || { icon: '💰', label: method, color: colors.textSecondary };
    };

    const renderSaleItem = ({ item }) => {
        const badge = getPaymentMethodBadge(item.paymentMethod);

        return (
            <TouchableOpacity
                style={styles.saleCard}
                onPress={() => navigation.navigate('SaleDetails', { saleId: item.id })}
            >
                <View style={styles.saleHeader}>
                    <View>
                        <AppText variant="caption" style={styles.receiptNumber}>{item.receiptNumber}</AppText>
                        {item.isEtr && (
                            <AppText variant="caption" style={{ color: colors.secondary, fontWeight: 'bold', fontSize: 9, marginTop: 2 }}>
                                ETR COMPLIANT
                            </AppText>
                        )}
                        <AppText variant="small" style={styles.saleDate}>{formatDate(item.saleDate)}</AppText>
                    </View>
                    <View style={styles.amountContainer}>
                        <AppText variant="h3" style={styles.amount}>KSh {item.grandTotal.toLocaleString()}</AppText>
                        <View style={[styles.badge, { backgroundColor: badge.color }]}>
                            <AppText variant="small" style={styles.badgeText}>{badge.icon} {badge.label}</AppText>
                        </View>
                    </View>
                </View>

                <View style={styles.saleDetails}>
                    <View style={styles.detailRow}>
                        <AppText variant="caption" style={styles.detailLabel}>Customer:</AppText>
                        <AppText variant="caption" style={styles.detailValue} numberOfLines={1}>
                            {item.customerName || 'Walk-in Customer'}
                        </AppText>
                    </View>
                    {item.storeName && (
                        <View style={styles.detailRow}>
                            <AppText variant="caption" style={styles.detailLabel}>Store:</AppText>
                            <AppText variant="caption" style={styles.detailValue} numberOfLines={1}>{item.storeName}</AppText>
                        </View>
                    )}
                    <View style={styles.detailRow}>
                        <AppText variant="caption" style={styles.detailLabel}>Items:</AppText>
                        <AppText variant="caption" style={styles.detailValue}>{item.items?.length || 0} item(s)</AppText>
                    </View>
                    <View style={styles.detailRow}>
                        <AppText variant="caption" style={styles.detailLabel}>Sales Rep:</AppText>
                        <AppText variant="caption" style={styles.detailValue} numberOfLines={1}>{item.salesRepName}</AppText>
                    </View>
                </View>

                {item.paymentStatus === 'pending' && (
                    <View style={styles.pendingBadge}>
                        <AppText variant="small" style={styles.pendingText}>⚠️ Payment Pending</AppText>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (loading && sales.length === 0) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <AppText style={styles.loadingText}>Loading sales...</AppText>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <AppText style={styles.backButton}>← Back</AppText>
                </TouchableOpacity>
                <AppText variant="h3" style={styles.headerTitle}>Sales History</AppText>
                <TouchableOpacity onPress={() => setShowFilters(!showFilters)}>
                    <AppText style={styles.filterButton}>{showFilters ? 'Hide Filters' : 'Filters'} {isFiltered ? '•' : ''}</AppText>
                </TouchableOpacity>
            </View>

            {/* Search & Filters */}
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search customer or receipt..."
                    value={searchQuery}
                    onChangeText={handleSearch}
                    returnKeyType="search"
                    placeholderTextColor={colors.textSecondary}
                />
            </View>

            {showFilters && (
                <View style={styles.filtersPanel}>
                    <AppText variant="caption" style={styles.filterTitle}>Filter by Date:</AppText>
                    <View style={styles.filterRow}>
                        {['today', 'week', 'month', 'all'].map((range) => (
                            <TouchableOpacity
                                key={range}
                                style={[styles.filterChip, dateRange === range && styles.filterChipActive]}
                                onPress={() => setDateRange(range)}
                            >
                                <AppText style={[styles.filterChipText, dateRange === range && styles.filterChipTextActive]}>
                                    {range === 'all' ? 'All Time' : range.charAt(0).toUpperCase() + range.slice(1)}
                                </AppText>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {/* Stats Summary */}
            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <AppText variant="caption" style={styles.statLabel}>Total Sales</AppText>
                    <AppText variant="h3" style={styles.statValue}>{pagination.total || 0}</AppText>
                </View>
                <View style={styles.statCard}>
                    <AppText variant="caption" style={styles.statLabel}>Total Amount</AppText>
                    <AppText variant="h3" style={styles.statValue}>
                        KSh {sales.reduce((sum, sale) => sum + sale.grandTotal, 0).toLocaleString()}
                    </AppText>
                </View>
            </View>

            {/* Sales List */}
            {sales.length > 0 ? (
                <FlatList
                    data={sales}
                    keyExtractor={(item) => item.id}
                    renderItem={renderSaleItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.primary}
                        />
                    }
                />
            ) : (
                <View style={styles.emptyContainer}>
                    <AppText variant="h1" style={styles.emptyIcon}>📋</AppText>
                    <AppText variant="h3" style={styles.emptyTitle}>No Sales Yet</AppText>
                    <AppText style={styles.emptySubtitle}>
                        Sales will appear here once transactions are completed
                    </AppText>
                </View>
            )}
        </View>
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
        marginTop: spacing.s,
        color: colors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        ...shadows.small,
    },
    backButton: {
        color: colors.primary,
        fontWeight: '600',
    },
    headerTitle: {
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    statsContainer: {
        flexDirection: 'row',
        padding: spacing.m,
        gap: spacing.m,
    },
    statCard: {
        flex: 1,
        backgroundColor: colors.surface,
        padding: spacing.m,
        borderRadius: borderRadius.m,
        ...shadows.small,
    },
    statLabel: {
        color: colors.textSecondary,
        marginBottom: 4,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    statValue: {
        color: colors.primaryDark,
    },
    listContent: {
        padding: spacing.m,
        paddingTop: 0,
    },
    saleCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.m,
        padding: spacing.m,
        marginBottom: spacing.m,
        ...shadows.small,
        borderWidth: 1,
        borderColor: colors.border,
    },
    saleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.s,
        paddingBottom: spacing.s,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate100,
    },
    receiptNumber: {
        color: colors.textPrimary,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    saleDate: {
        color: colors.textSecondary,
    },
    amountContainer: {
        alignItems: 'flex-end',
    },
    amount: {
        color: colors.success,
        marginBottom: 4,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: borderRadius.button,
    },
    badgeText: {
        color: colors.white,
        fontWeight: 'bold',
    },
    saleDetails: {
        gap: 4,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailLabel: {
        color: colors.textSecondary,
        flex: 1,
    },
    detailValue: {
        color: colors.textPrimary,
        flex: 2,
        textAlign: 'right',
        fontWeight: '500',
    },
    pendingBadge: {
        marginTop: spacing.s,
        paddingTop: spacing.s,
        borderTopWidth: 1,
        borderTopColor: colors.slate100,
    },
    pendingText: {
        color: colors.warning,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xxl,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: spacing.m,
    },
    emptyTitle: {
        color: colors.textPrimary,
        marginBottom: spacing.xs,
    },
    emptySubtitle: {
        color: colors.textSecondary,
        textAlign: 'center',
    },
    filterButton: {
        color: colors.primary,
        fontWeight: '600',
    },
    searchContainer: {
        padding: spacing.m,
        paddingBottom: spacing.s,
        backgroundColor: colors.surface,
    },
    searchInput: {
        backgroundColor: colors.slate100,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s,
        borderRadius: borderRadius.button,
        fontSize: 14,
        color: colors.textPrimary,
    },
    filtersPanel: {
        backgroundColor: colors.surface,
        padding: spacing.m,
        paddingTop: 0,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    filterTitle: {
        color: colors.textSecondary,
        marginBottom: spacing.s,
        marginTop: spacing.s,
        fontWeight: '600',
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.s,
    },
    filterChip: {
        paddingHorizontal: spacing.m,
        paddingVertical: 6,
        borderRadius: borderRadius.round,
        backgroundColor: colors.slate100,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterChipActive: {
        backgroundColor: colors.primaryLight,
        borderColor: colors.primary,
    },
    filterChipText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    filterChipTextActive: {
        color: colors.primary,
        fontWeight: '600',
    },
});
