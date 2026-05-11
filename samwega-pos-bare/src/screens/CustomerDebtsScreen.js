import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    StatusBar,
    SafeAreaView,
    Keyboard,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme';
import DebtService from '../services/DebtService';

export default function CustomerDebtsScreen({ navigation }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [debts, setDebts] = useState([]);
    const [searched, setSearched] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        
        Keyboard.dismiss();
        setLoading(true);
        setSearched(true);
        
        try {
            // Check if input looks like a phone number or name
            const isPhone = /^\d+$/.test(searchQuery.replace(/\s/g, ''));
            const params = isPhone 
                ? { phoneNumber: searchQuery.replace(/\s/g, '') } 
                : { name: searchQuery.trim() };
            
            const results = await DebtService.fetchCustomerDebts(params);
            
            // Only show unpaid/partial debts as requested ("list all the unpaid debts")
            const unpaidDebts = results
                .filter(d => d.status !== 'paid' && d.status !== 'deleted')
                .sort((a, b) => {
                    const dateA = new Date(a.createdAt?.seconds * 1000 || a.createdAt || a.dateIssued?.seconds * 1000 || a.dateIssued || 0);
                    const dateB = new Date(b.createdAt?.seconds * 1000 || b.createdAt || b.dateIssued?.seconds * 1000 || b.dateIssued || 0);
                    return dateB - dateA; // Newest at top, oldest at bottom
                });
            setDebts(unpaidDebts);
        } catch (error) {
            console.error('Search debts error:', error);
        } finally {
            setLoading(false);
        }
    };

    const totalUnpaidAmount = debts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);

    const formatCurrency = (amount) => `KSh ${Math.floor(amount || 0).toLocaleString()}`;
    
    const formatDate = (dateObj) => {
        if (!dateObj) return 'N/A';
        const seconds = dateObj.seconds || dateObj._seconds;
        if (seconds) return new Date(seconds * 1000).toLocaleDateString();
        return new Date(dateObj).toLocaleDateString();
    };

    const renderDebtItem = ({ item }) => (
        <View style={styles.debtCard}>
            <View style={styles.debtHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.debtCode}>{item.debtCode || 'NO CODE'}</Text>
                    <Text style={styles.customerName}>{item.storeOwner?.name || 'Unknown Customer'}</Text>
                    <Text style={styles.customerPhone}>{item.storeOwner?.phoneNumber || 'No Phone'}</Text>
                    {item.store?.name && (
                        <Text style={styles.storeName}>{item.store.name}</Text>
                    )}
                </View>
                <View style={[styles.statusBadge, item.status === 'overdue' ? styles.statusOverdue : styles.statusUnpaid]}>
                    <Text style={styles.statusText}>{(item.status || 'unpaid').toUpperCase().replace('_', ' ')}</Text>
                </View>
            </View>
            
            <View style={styles.debtDetails}>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date Issued:</Text>
                    <Text style={styles.detailValue}>{formatDate(item.createdAt || item.dateIssued)}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Amount:</Text>
                    <Text style={styles.detailValue}>{formatCurrency(item.amount || item.totalAmount)}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Paid Amount:</Text>
                    <Text style={[styles.detailValue, { color: '#10B981' }]}>{formatCurrency(item.paidAmount)}</Text>
                </View>
                <View style={[styles.detailRow, styles.remainingRow]}>
                    <Text style={styles.remainingLabel}>Remaining:</Text>
                    <Text style={styles.remainingValue}>{formatCurrency(item.remainingAmount)}</Text>
                </View>
            </View>
            
            {item.description && (
                <Text style={styles.description}>{item.description}</Text>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Customer Debts</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name or phone number"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                        placeholderTextColor="#9CA3AF"
                    />
                    <TouchableOpacity 
                        style={styles.searchButton} 
                        onPress={handleSearch}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                            <Text style={styles.searchButtonText}>Search</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {searched && !loading && (
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Total Unpaid</Text>
                            <Text style={styles.summaryValue}>{formatCurrency(totalUnpaidAmount)}</Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Count</Text>
                            <Text style={styles.summaryValue}>{debts.length}</Text>
                        </View>
                    </View>
                )}

                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#1D4ED8" />
                        <Text style={styles.loadingText}>Fetching debts...</Text>
                    </View>
                ) : searched && debts.length === 0 ? (
                    <View style={styles.centerContainer}>
                        <Text style={styles.emptyText}>No unpaid debts found for this customer.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={debts}
                        renderItem={renderDebtItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backButtonText: {
        fontSize: 24,
        color: '#111827',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    searchInput: {
        flex: 1,
        height: 50,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 15,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        ...shadows.sm,
    },
    searchButton: {
        marginLeft: 10,
        width: 80,
        height: 50,
        backgroundColor: '#1D4ED8',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.md,
    },
    searchButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    summaryCard: {
        flexDirection: 'row',
        backgroundColor: '#1D4ED8',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        ...shadows.lg,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 13,
        color: '#DBEAFE',
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    summaryDivider: {
        width: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        marginHorizontal: 10,
    },
    listContent: {
        paddingBottom: 20,
    },
    debtCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        ...shadows.sm,
    },
    debtHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    debtCode: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    customerName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginTop: 2,
    },
    customerPhone: {
        fontSize: 12,
        color: '#6B7280',
    },
    storeName: {
        fontSize: 12,
        color: '#9CA3AF',
        fontStyle: 'italic',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusUnpaid: {
        backgroundColor: '#FEF3C7',
    },
    statusOverdue: {
        backgroundColor: '#FEE2E2',
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#92400E',
    },
    debtDetails: {
        marginBottom: 8,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    detailLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    remainingRow: {
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    remainingLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    remainingValue: {
        fontSize: 16,
        fontWeight: '800',
        color: '#EF4444',
    },
    description: {
        fontSize: 13,
        color: '#6B7280',
        fontStyle: 'italic',
        marginTop: 4,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 50,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 15,
        color: '#6B7280',
    },
    emptyText: {
        fontSize: 15,
        color: '#9CA3AF',
        textAlign: 'center',
    },
});
