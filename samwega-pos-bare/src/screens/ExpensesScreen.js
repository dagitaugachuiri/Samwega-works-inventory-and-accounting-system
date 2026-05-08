import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Platform,
    TextInput,
    Text
} from 'react-native';
import { getExpenses, getExpensesByCategory } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Theme & UI
import { colors, spacing, borderRadius, shadows, typography } from '../theme';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';

export default function ExpensesScreen({ route, navigation }) {
    const { vehicleId } = route?.params || {};
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expenses, setExpenses] = useState([]);
    const [categoryStats, setCategoryStats] = useState(null);
    const [filterType, setFilterType] = useState('today'); // 'today' | 'all'

    useEffect(() => {
        const checkRole = async () => {
            const userDataStr = await AsyncStorage.getItem('userData');
            if (userDataStr) {
                const user = JSON.parse(userDataStr);
                if (user.role === 'driver') {
                    console.log('🚫 Driver tried to access expenses screen');
                    navigation.replace('Stock', { vehicleId: user.assignedVehicleId });
                    return;
                }
            }
            loadData();
        };
        checkRole();
    }, [filterType]);

    const loadData = async () => {
        try {
            const startDate = filterType === 'today' ? new Date().toISOString().split('T')[0] : undefined;
            const endDate = filterType === 'today' ? new Date().toISOString().split('T')[0] : undefined;

            const params = {
                vehicleId,
                limit: 20,
                startDate
            };

            const categoryParams = {
                vehicleId,
                startDate: startDate || '2020-01-01',
                endDate: endDate || new Date().toISOString().split('T')[0]
            };

            const [expensesRes, categoryRes] = await Promise.all([
                getExpenses(params),
                getExpensesByCategory(categoryParams)
            ]);

            setExpenses(expensesRes.data?.expenses || []);
            setCategoryStats(categoryRes.data || {});
        } catch (error) {
            console.error('[Expenses] Error loading expenses:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const calculateTotalExpenses = () => {
        return expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    };

    const renderStatCard = (title, value, color) => (
        <View style={[styles.statCard, { borderLeftColor: color }]}>
            <Text variant="caption" style={styles.statTitle}>{title}</Text>
            <Text variant="h2" style={[styles.statValue, { color }]}>KSh {value.toLocaleString()}</Text>
        </View>
    );

    const renderExpenseItem = (expense) => {
        const dateStr = expense.expenseDate || expense.createdAt || new Date().toISOString();
        const categoryColors = {
            fuel: colors.warning,
            allowances: colors.success,
            repairs: colors.error,
            car_wash: colors.info,
            tolls: colors.secondary,
            parking: '#ec4899',
            misc: colors.textSecondary
        };

        return (
            <View key={expense.id} style={styles.expenseItem}>
                <View style={styles.expenseHeader}>
                    <View style={[styles.categoryBadge, { backgroundColor: categoryColors[expense.category] || colors.textSecondary }]}>
                        <AppText variant="small" style={styles.categoryText}>{expense.category.toUpperCase()}</AppText>
                    </View>
                    <AppText variant="small" style={styles.expenseDate}>
                        {new Date(dateStr).toLocaleDateString()}
                    </AppText>
                </View>
                <AppText variant="body" style={styles.expenseDescription}>{expense.description || 'No description'}</AppText>
                <View style={styles.expenseFooter}>
                    <AppText variant="bodyBold" style={styles.expenseAmount}>KSh {expense.amount.toLocaleString()}</AppText>
                    <AppText variant="small" style={styles.expenseTime}>
                        {new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </AppText>
                </View>
            </View>
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
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.hderContent}>
                    <AppText style={styles.greeting}>Expenses</AppText>
                    <AppText style={styles.vehicleInfo}>Track Your Costs</AppText>
                </View>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <AppText style={styles.logoutText}>Back </AppText>
                </TouchableOpacity>
            </View>


            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1D4ED8" />}
                showsVerticalScrollIndicator={false}
            >
                {/* Stats Card with Period Filter */}
                <View style={styles.statCard}>
                    {/* Period Filter Tabs */}
                    <View style={styles.periodTabs}>
                        <TouchableOpacity
                            style={[styles.periodTab, filterType === 'today' && styles.periodTabActive]}
                            onPress={() => setFilterType('today')}
                        >
                            <AppText style={[styles.periodTabText, filterType === 'today' && styles.periodTabTextActive]}>Today </AppText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.periodTab, filterType === 'all' && styles.periodTabActive]}
                            onPress={() => setFilterType('all')}
                        >
                            <AppText style={[styles.periodTabText, filterType === 'all' && styles.periodTabTextActive]}>All Time</AppText>
                        </TouchableOpacity>
                    </View>

                    <View>
                        <AppText style={styles.statLabel}>Total Expenses</AppText>
                        <AppText style={styles.statValue}>KSh {calculateTotalExpenses().toLocaleString()}</AppText>
                    </View>


                </View>

                {/* Recent Expenses */}
                <View style={styles.section}>
                    <AppText variant="h3" style={styles.sectionTitle}>
                        {filterType === 'today' ? 'Recent Expenses' : 'Expense History'}
                    </AppText>
                    {expenses.length > 0 ? (
                        expenses.map(renderExpenseItem)
                    ) : (
                        <AppText style={styles.emptyText}>No expenses found for this period</AppText>
                    )}
                </View>
            </ScrollView>

            {/* Floating Action Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('RecordExpense', { vehicleId })}
            >
                <AppText style={styles.fabText}>+ Add Expense</AppText>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F1F5F9',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    greeting: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 5,
    },
    vehicleInfo: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 2,
    },
    logoutText: {
        fontSize: 14,
        color: '#1D4ED8',
        fontWeight: '600',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },

    // Stats Card
    statCard: {
        backgroundColor: '#EFF6FF',
        borderRadius: 16,
        padding: 20,
        paddingTop: 0,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#b5bfd3ff',
    },
    statLabel: {
        fontSize: 14,
        color: '#1D4ED8',
        fontWeight: '700',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    statValue: {
        fontSize: 20,
        color: '#1E3A8A',
        fontWeight: ' bold',
        marginBottom: 36,
    },
    statsRow: {
        flexDirection: 'row',
        marginTop: 8,
    },
    statCardSmall: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    statLabelSmall: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 4,
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    statValueSmall: {
        fontSize: 20,
        color: '#1E293B',
        fontWeight: 'bold',
    },

    // Period Tabs
    periodTabs: {
        flexDirection: 'row',
        paddingTop: 10,
        paddingBottom: 8,
        gap: 8,
    },
    periodTab: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    periodTabActive: {
        // backgroundColor: '#789cffff',
        borderColor: '#1D4ED8',
    },
    periodTabText: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '600',
    },
    periodTabTextActive: {
        color: '#0756a9ff',
    },

    // Expense Items
    section: {
        marginBottom: spacing.l,
    },
    sectionTitle: {
        color: '#1E293B',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    expenseItem: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 8,
    },
    expenseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    categoryBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    categoryText: {
        fontWeight: 'bold',
        color: '#FFFFFF',
        fontSize: 10,
    },
    expenseDate: {
        color: '#64748B',
        fontSize: 12,
    },
    expenseDescription: {
        color: '#1E293B',
        marginBottom: 12,
        fontSize: 14,
    },
    expenseFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    expenseAmount: {
        color: '#DC2626',
        fontWeight: 'bold',
        fontSize: 16,
    },
    expenseTime: {
        color: '#64748B',
        fontSize: 12,
    },
    emptyText: {
        textAlign: 'center',
        color: '#64748B',
        marginTop: 32,
        fontSize: 14,
    },

    // Floating Action Button
    fab: {
        position: 'absolute',
        bottom: 60,
        left: 20,
        right: 20,
        height: 56,
        backgroundColor: '#5796f6ff',
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#708a79ff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    fabText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
