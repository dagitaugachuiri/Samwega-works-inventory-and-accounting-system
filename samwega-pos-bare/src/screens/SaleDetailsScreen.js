import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform
} from 'react-native';
import { getSaleById } from '../services/api';
import ReceiptService from '../services/ReceiptService';

// Theme & UI
import { colors, spacing, borderRadius, shadows, typography } from '../theme';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';
import CustomAlert from '../components/ui/CustomAlert';

export default function SaleDetailsScreen({ route, navigation }) {
    const { saleId } = route.params;
    const [sale, setSale] = useState(null);
    const [loading, setLoading] = useState(true);
    const [printing, setPrinting] = useState(false);

    // Alert state
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: null,
        loading: false,
    });

    const showAlert = (title, message, type = 'info', onConfirm = null) => {
        setAlertConfig({
            visible: true,
            title,
            message,
            type,
            onConfirm: onConfirm ? () => { setAlertConfig(prev => ({ ...prev, visible: false })); onConfirm(); } : null,
            loading: false,
        });
    };

    useEffect(() => {
        loadSaleDetails();
    }, [saleId]);

    const loadSaleDetails = async () => {
        try {
            const response = await getSaleById(saleId);
            setSale(response.data);
        } catch (error) {
            console.error('Error loading sale details:', error);
            showAlert('Error', 'Failed to load sale details', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleReprintReceipt = async () => {
        if (!sale) return;

        setPrinting(true);
        setAlertConfig({
            visible: true,
            title: 'Printing Receipt',
            message: 'Please wait...',
            type: 'info',
            loading: true,
        });

        try {
            const receiptText = ReceiptService.generateReceipt(sale);
            await new Promise(resolve => setTimeout(resolve, 3000));
            await ReceiptService.print(receiptText);

            setAlertConfig(prev => ({ ...prev, visible: false }));
            showAlert('Success', 'Receipt sent to printer', 'success');
        } catch (error) {
            console.error('Error printing receipt:', error);
            setAlertConfig(prev => ({ ...prev, visible: false }));
            showAlert('Print Error', error.message || 'Failed to print receipt. Please try again.', 'error');
        } finally {
            setPrinting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!sale) {
        return (
            <View style={styles.center}>
                <AppText style={styles.errorText}>Sale not found</AppText>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <AppText style={styles.backButton}>← Back</AppText>
                </TouchableOpacity>
                <AppText variant="h3" style={styles.headerTitle}>Sale Details</AppText>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* Sale Info Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View>
                            <AppText variant="h2" style={styles.receiptNumber}>{sale.receiptNumber || `Sale #${saleId.substring(0, 8)}`}</AppText>
                            {sale.isEtr && (
                                <AppText variant="caption" style={{ color: colors.secondary, fontWeight: 'bold', fontSize: 10, marginTop: 4 }}>
                                    ETR COMPLIANT SALE
                                </AppText>
                            )}
                        </View>
                        <View style={[styles.badge, sale.status === 'voided' ? styles.badgeVoid : styles.badgeSuccess]}>
                            <AppText variant="small" style={[styles.badgeText, sale.status === 'voided' ? styles.textVoid : styles.textSuccess]}>
                                {sale.status?.toUpperCase() || 'COMPLETED'}
                            </AppText>
                        </View>
                    </View>
                    <AppText style={styles.date}>
                        {new Date(sale.soldAt || sale.createdAt).toLocaleString()}
                    </AppText>
                    {sale.customerName && (
                        <View style={styles.customerInfo}>
                            <AppText style={styles.label}>Customer:</AppText>
                            <AppText variant="bodyBold" style={styles.value}>{sale.customerName}</AppText>
                        </View>
                    )}
                </View>

                {/* Items List */}
                <AppText variant="h3" style={styles.sectionTitle}>Items</AppText>
                <View style={styles.card}>
                    {sale.items?.map((item, index) => (
                        <View key={index} style={styles.itemRow}>
                            <View style={styles.itemInfo}>
                                <AppText style={styles.itemName}>{item.productName}</AppText>
                                <AppText variant="small" style={styles.itemUnit}>
                                    {item.quantity} x KSh {item.unitPrice?.toLocaleString()} ({item.unit})
                                </AppText>
                            </View>
                            <AppText variant="bodyBold" style={styles.itemTotal}>
                                KSh {(item.totalPrice || 0).toLocaleString()}
                            </AppText>
                        </View>
                    ))}
                </View>

                {/* Payment Breakdown */}
                <AppText variant="h3" style={styles.sectionTitle}>Payment</AppText>
                <View style={styles.card}>
                    <View style={styles.summaryRow}>
                        <AppText style={styles.summaryLabel}>Subtotal</AppText>
                        <AppText variant="bodyBold" style={styles.summaryValue}>KSh {(sale.subtotal || 0).toLocaleString()}</AppText>
                    </View>
                    <View style={[styles.summaryRow, styles.totalRow]}>
                        <AppText variant="h2" style={styles.totalLabel}>Total Paid</AppText>
                        <AppText variant="h2" style={styles.totalValue}>KSh {(sale.grandTotal || 0).toLocaleString()}</AppText>
                    </View>

                    {sale.payments && sale.payments.length > 0 ? (
                        <View style={styles.paymentMethods}>
                            {sale.payments.map((p, i) => (
                                <AppText key={i} style={styles.paymentMethod}>
                                    {p.method.toUpperCase()}: KSh {p.amount.toLocaleString()}
                                </AppText>
                            ))}
                        </View>
                    ) : (
                        <AppText style={styles.paymentMethod}>
                            {sale.paymentMethod?.toUpperCase()}: KSh {(sale.grandTotal || 0).toLocaleString()}
                        </AppText>
                    )}
                </View>

                <View style={{ height: 20 }} />

                {/* Reprint Button */}
                <AppButton
                    title="🖨️ Reprint Receipt"
                    variant="primary"
                    onPress={handleReprintReceipt}
                    loading={printing}
                    disabled={printing}
                />

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Alert Modal */}
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
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.card,
        padding: spacing.cardPadding,
        marginBottom: spacing.l,
        ...shadows.card,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.s,
    },
    receiptNumber: {
        color: colors.textPrimary,
    },
    date: {
        color: colors.textSecondary,
        marginBottom: spacing.m,
    },
    customerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: spacing.m,
        borderTopWidth: 1,
        borderTopColor: colors.slate100,
    },
    label: {
        color: colors.textSecondary,
        marginRight: spacing.s,
    },
    value: {
        color: colors.textPrimary,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadius.s,
    },
    badgeSuccess: {
        backgroundColor: colors.successBg,
    },
    badgeVoid: {
        backgroundColor: colors.errorBg,
    },
    badgeText: {
        fontWeight: 'bold',
    },
    textSuccess: {
        color: colors.success,
    },
    textVoid: {
        color: colors.error,
    },
    sectionTitle: {
        color: colors.textPrimary,
        marginBottom: spacing.m,
        marginLeft: 4,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.s,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate100,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        color: colors.textPrimary,
        marginBottom: 4,
    },
    itemUnit: {
        color: colors.textSecondary,
    },
    itemTotal: {
        color: colors.textPrimary,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.s,
    },
    summaryLabel: {
        color: colors.textSecondary,
    },
    summaryValue: {
        color: colors.textPrimary,
    },
    totalRow: {
        marginTop: spacing.s,
        paddingTop: spacing.m,
        borderTopWidth: 1,
        borderTopColor: colors.slate100,
    },
    totalLabel: {
        color: colors.textPrimary,
    },
    totalValue: {
        color: colors.primary,
    },
    paymentMethods: {
        marginTop: spacing.m,
        backgroundColor: colors.slate100,
        padding: spacing.m,
        borderRadius: borderRadius.m,
    },
    paymentMethod: {
        color: colors.textSecondary,
        marginBottom: 4,
        fontWeight: '500',
    },
    errorText: {
        color: colors.error,
    }
});
