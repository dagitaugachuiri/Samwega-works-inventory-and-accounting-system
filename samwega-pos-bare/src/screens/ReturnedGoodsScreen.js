import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getVehicleTransfers, confirmReturn } from '../services/api';

const formatDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    return isNaN(d) ? '' : d.toLocaleString();
};

export default function ReturnedGoodsScreen({ route, navigation }) {
    const { vehicleId } = route?.params || {};
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [confirmingId, setConfirmingId] = useState(null);
    const [error, setError] = useState('');

    const loadReturns = async () => {
        if (!vehicleId) {
            setLoading(false);
            return;
        }
        try {
            setError('');
            const response = await getVehicleTransfers(vehicleId, { limit: 100 });
            const list = response?.data?.transfers || response?.transfers || [];
            setReturns(list.filter((t) => t.type === 'return'));
        } catch (e) {
            setError('Could not load returns. Pull down to try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadReturns();
        }, [vehicleId])
    );

    const handleConfirm = async (transfer) => {
        setConfirmingId(transfer.id);
        try {
            await confirmReturn(transfer.id);
            await loadReturns();
        } catch (e) {
            setError(e?.response?.data?.message || e?.message || 'Could not confirm this return.');
        } finally {
            setConfirmingId(null);
        }
    };

    const renderReturn = ({ item }) => {
        const confirmed = !!item.returnConfirmedAt;

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.transferNumber}>{item.transferNumber}</Text>
                        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                    </View>
                    <View style={[styles.badge, confirmed ? styles.badgeGreen : styles.badgeAmber]}>
                        <Text style={[styles.badgeText, confirmed ? styles.badgeGreenText : styles.badgeAmberText]}>
                            {confirmed ? 'CONFIRMED' : 'NOT CONFIRMED'}
                        </Text>
                    </View>
                </View>

                {(item.items || []).map((line, idx) => (
                    <View key={`${item.id}-${idx}`} style={styles.itemRow}>
                        <Text style={styles.itemName}>{line.productName}</Text>
                        <Text style={styles.itemQty}>
                            {line.quantity} {line.unit || ''}
                        </Text>
                    </View>
                ))}

                <Text style={styles.issuedBy}>Returned by {item.issuedByName || 'Unknown'}</Text>

                {confirmed ? (
                    <Text style={styles.confirmedText}>
                        Confirmed by {item.returnConfirmedByName} on {formatDate(item.returnConfirmedAt)}
                    </Text>
                ) : (
                    <TouchableOpacity
                        style={styles.confirmButton}
                        onPress={() => handleConfirm(item)}
                        disabled={confirmingId === item.id}
                    >
                        {confirmingId === item.id ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.confirmButtonText}>Confirm return</Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color="#10B981" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.back}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Returned Goods</Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <FlatList
                data={returns}
                keyExtractor={(item) => item.id}
                renderItem={renderReturn}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            loadReturns();
                        }}
                        tintColor="#10B981"
                    />
                }
                ListEmptyComponent={<Text style={styles.empty}>No returns from this vehicle yet.</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
    header: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    back: { fontSize: 15, fontWeight: '600', color: '#64748B', marginBottom: 8 },
    title: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
    error: { color: '#EF4444', textAlign: 'center', padding: 12 },
    list: { padding: 16, paddingBottom: 40 },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 16,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    transferNumber: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
    date: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    badgeGreen: { backgroundColor: '#DCFCE7' },
    badgeAmber: { backgroundColor: '#FEF3C7' },
    badgeText: { fontSize: 10, fontWeight: '800' },
    badgeGreenText: { color: '#15803D' },
    badgeAmberText: { color: '#B45309' },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    itemName: { fontSize: 14, color: '#334155', flex: 1, marginRight: 8 },
    itemQty: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    issuedBy: { fontSize: 12, color: '#64748B', marginTop: 10 },
    confirmedText: { fontSize: 12, color: '#15803D', marginTop: 10, fontWeight: '600' },
    confirmButton: {
        marginTop: 12,
        backgroundColor: '#10B981',
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
    },
    confirmButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
    empty: { textAlign: 'center', color: '#94A3B8', marginTop: 40 },
});