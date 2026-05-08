import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';

const RecentActivityList = ({ activeTab, onTabChange, sales, issuances, loading, onRefresh, refreshing, onIssuancePress }) => {

    // Components inside recent list
    const renderIssuanceItem = ({ item }) => (
        <TouchableOpacity
            style={styles.listItem}
            onPress={() => onIssuancePress(item)}
            activeOpacity={0.7}
        >
            <View style={styles.itemLeft}>
                <View style={[styles.avatarBase, styles.issuanceAvatar]}>
                    <Text style={styles.avatarIcon}>📦</Text>
                </View>
                <View>
                    <Text style={styles.itemTitle}>Stock Issuance</Text>
                    <Text style={styles.itemSubtitle}>{new Date(item.issuedAt).toLocaleDateString()}</Text>
                </View>
            </View>
            <View style={[styles.badge, item.status === 'collected' ? styles.badgeSuccess : styles.badgeWarning]}>
                <Text style={[styles.badgeText, item.status === 'collected' ? styles.textSuccess : styles.textWarning]}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
            </View>
        </TouchableOpacity>
    );

    const renderSaleItem = ({ item }) => (
        <View style={styles.listItem}>
            <View style={styles.itemLeft}>
                <View style={[styles.avatarBase, styles.saleAvatar]}>
                    <Text style={styles.avatarIcon}>💰</Text>
                </View>
                <View>
                    <Text style={styles.itemTitle}>Sale #{item.receiptNumber ? item.receiptNumber.split('-').pop() : (item.id ? item.id.substring(0, 6) : 'Unknown')}</Text>
                    <Text style={styles.itemSubtitle}>
                        {item.items?.length || 0} items • {new Date(item.saleDate || item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
            <Text style={styles.saleAmount}>+KSh {(item.grandTotal || item.totalAmount || 0).toLocaleString()}</Text>
        </View>
    );

    const data = activeTab === 'issuances' ? issuances : sales;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <View style={styles.tabs}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'issuances' && styles.activeTab]}
                        onPress={() => onTabChange('issuances')}
                    >
                        <Text style={[styles.tabText, activeTab === 'issuances' && styles.activeTabText]}>
                            Issuances
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'sales' && styles.activeTab]}
                        onPress={() => onTabChange('sales')}
                    >
                        <Text style={[styles.tabText, activeTab === 'sales' && styles.activeTabText]}>
                            Sales
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.listContainer}>
                <FlatList
                    data={data}
                    keyExtractor={(item) => item.id}
                    renderItem={activeTab === 'issuances' ? renderIssuanceItem : renderSaleItem}
                    contentContainerStyle={styles.listContent}
                    scrollEnabled={false}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyText}>No recent {activeTab}</Text>
                        </View>
                    }
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6', // gray-100
        borderRadius: 8,
        padding: 4,
    },
    tab: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    activeTab: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    tabText: {
        fontSize: 13,
        color: '#6B7280', // gray-500
        fontWeight: '500',
    },
    activeTabText: {
        color: '#111827', // gray-900
        fontWeight: '600',
    },
    listContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB', // gray-200
        overflow: 'hidden',
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatarBase: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    issuanceAvatar: {
        backgroundColor: '#FFF7ED', // orange-50
    },
    saleAvatar: {
        backgroundColor: '#ECFDF5', // emerald-50
    },
    avatarIcon: {
        fontSize: 20,
    },
    itemTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    itemSubtitle: {
        fontSize: 12,
        color: '#6B7280',
    },
    saleAmount: {
        fontSize: 14,
        fontWeight: '600',
        color: '#059669', // emerald-600
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 9999,
    },
    badgeSuccess: {
        backgroundColor: '#ECFDF5',
    },
    badgeWarning: {
        backgroundColor: '#FFFBEB',
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '500',
    },
    textSuccess: {
        color: '#059669',
    },
    textWarning: {
        color: '#D97706',
    },
    empty: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#9CA3AF',
        fontSize: 14,
    },
});

export default RecentActivityList;
