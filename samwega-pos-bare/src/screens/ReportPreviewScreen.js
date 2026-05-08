import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, shadows } from '../theme';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';

export default function ReportPreviewScreen({ navigation, route }) {
    const { reportData, reportType, dateRange } = route.params || {};

    console.log('ReportPreviewScreen received:', {
        hasReportData: !!reportData,
        lineItemsCount: reportData?.lineItems?.length,
        reportType,
        dateRange
    });

    const handleDownloadPDF = async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            const baseUrl = 'http://192.168.100.5:8080/api/v1';

            const params = new URLSearchParams({
                vehicleId: reportData.vehicleId,
                startDate: dateRange.start,
                endDate: dateRange.end,
                type: 'detailed'
            }).toString();

            const url = `${baseUrl}/reports/generate/sales-pdf?${params}&token=${token}`;
            await Linking.openURL(url);
        } catch (error) {
            console.error('PDF Download Error:', error);
        }
    };

    const isExpense = reportType === 'expenses';
    const isInventory = reportType === 'inventory';

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#8fdfebff" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <AppText variant="h2" style={styles.headerTitle}>{isExpense ? "Expense Report" : isInventory ? "Inventory Report" : "Sales Report"}</AppText>
                    <AppText variant="caption" style={styles.headerSubtitle}>
                        {dateRange?.start} to {dateRange?.end}
                    </AppText>
                </View>
            </View>

            {/* Table Container */}
            <ScrollView style={styles.scrollContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View style={styles.tableWrapper}>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderText, styles.colDate]}>Date</Text>

                            {!isExpense && !isInventory && (
                                <>
                                    <Text style={[styles.tableHeaderText, styles.colReceipt]}>Receipt</Text>
                                    <Text style={[styles.tableHeaderText, styles.colCustomer]}>Customer</Text>
                                    <Text style={[styles.tableHeaderText, styles.colItem]}>Item</Text>
                                    <Text style={[styles.tableHeaderText, styles.colCode]}>Code</Text>
                                    <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
                                </>
                            )}

                            {isInventory && (
                                <>
                                    <Text style={[styles.tableHeaderText, styles.colItem]}>Item</Text>
                                    <Text style={[styles.tableHeaderText, styles.colCode]}>Code</Text>
                                    <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
                                    <Text style={[styles.tableHeaderText, styles.colStatus]}>Status</Text>
                                </>
                            )}

                            {isExpense && (
                                <>
                                    <Text style={[styles.tableHeaderText, styles.colCategory]}>Category</Text>
                                    <Text style={[styles.tableHeaderText, styles.colDescription]}>Description</Text>
                                </>
                            )}

                            {!isInventory && (
                                <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount</Text>
                            )}
                        </View>

                        {/* Table Body */}
                        {reportData?.lineItems?.map((item, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.tableRow,
                                    index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd
                                ]}
                            >
                                <Text style={[styles.tableCell, styles.colDate]}>
                                    {new Date(item.date).toLocaleDateString('en-GB')}
                                </Text>

                                {!isExpense && !isInventory && (
                                    <>
                                        <Text style={[styles.tableCell, styles.colReceipt]} numberOfLines={1}>
                                            {item.receipt}
                                        </Text>
                                        <Text style={[styles.tableCell, styles.colCustomer]} numberOfLines={1}>
                                            {item.customer}
                                        </Text>
                                        <Text style={[styles.tableCell, styles.colItem]} numberOfLines={1}>
                                            {item.itemName}
                                        </Text>
                                        <Text style={[styles.tableCell, styles.colCode]}>
                                            {item.itemCode}
                                        </Text>
                                        <Text style={[styles.tableCell, styles.colQty, styles.textCenter]}>
                                            {item.quantity}
                                        </Text>
                                        <Text style={[styles.tableCell, styles.colAmount, styles.textRight]}>
                                            {item.amount.toLocaleString()}
                                        </Text>
                                    </>
                                )}

                                {isInventory && (
                                    <>
                                        <Text style={[styles.tableCell, styles.colItem]} numberOfLines={1}>
                                            {item.itemName}
                                        </Text>
                                        <Text style={[styles.tableCell, styles.colCode]}>
                                            {item.itemCode}
                                        </Text>
                                        <Text style={[styles.tableCell, styles.colQty, styles.textCenter]}>
                                            {item.quantity}
                                        </Text>
                                        <Text style={[styles.tableCell, styles.colStatus]}>
                                            {item.status}
                                        </Text>
                                    </>
                                )}

                                {isExpense && (
                                    <>
                                        <Text style={[styles.tableCell, styles.colCategory]} numberOfLines={1}>
                                            {item.category}
                                        </Text>
                                        <Text style={[styles.tableCell, styles.colDescription]} numberOfLines={1}>
                                            {item.description}
                                        </Text>
                                        <Text style={[styles.tableCell, styles.colAmount, styles.textRight]}>
                                            {item.amount.toLocaleString()}
                                        </Text>
                                    </>
                                )}
                            </View>
                        ))}
                    </View>
                </ScrollView>

                {/* Summary Section */}
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryRow}>
                        <AppText variant="body" style={styles.summaryLabel}>Total Items:</AppText>
                        <AppText variant="body" style={styles.summaryValue}>
                            {reportData?.lineItems?.length || 0}
                        </AppText>
                    </View>
                    <View style={styles.summaryRow}>
                        <AppText variant="body" style={styles.summaryLabel}>Total Transactions:</AppText>
                        <AppText variant="body" style={styles.summaryValue}>
                            {reportData?.totalTransactions || 0}
                        </AppText>
                    </View>
                    {!isInventory && (
                        <View style={[styles.summaryRow, styles.grandTotalRow]}>
                            <AppText variant="h3" style={styles.grandTotalLabel}>GRAND TOTAL:</AppText>
                            <AppText variant="h3" style={styles.grandTotalValue}>
                                KSh {reportData?.grandTotal?.toLocaleString() || 0}
                            </AppText>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Download PDF Button */}
            {/* <View style={styles.footer}>
                <AppButton
                    title="Download PDF"
                    onPress={handleDownloadPDF}
                    variant="primary"
                />
            </View> */}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        backgroundColor: "#8fdfebff",
        paddingTop: spacing.xl,
        paddingBottom: spacing.m,
        paddingHorizontal: spacing.m,
        ...shadows.medium,
    },
    backButton: {
        marginBottom: spacing.s,
    },
    backButtonText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: '600',
    },
    headerContent: {
        alignItems: 'center',
    },
    headerTitle: {
        color: colors.white,
        marginBottom: spacing.xs,
    },
    headerSubtitle: {
        color: colors.white,
        opacity: 0.9,
    },
    scrollContainer: {
        flex: 1,
    },
    tableWrapper: {
        padding: spacing.m,
        minWidth: 700, // Ensure horizontal scroll
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: "#8fdfebff",
        paddingVertical: spacing.s,
        paddingHorizontal: spacing.xs,
        borderRadius: borderRadius.s,
        marginBottom: 2,
    },
    tableHeaderText: {
        color: colors.white,
        fontSize: 11,
        fontWeight: 'bold',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: spacing.s,
        paddingHorizontal: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
    },
    tableRowEven: {
        backgroundColor: colors.white,
    },
    tableRowOdd: {
        backgroundColor: colors.slate50,
    },
    tableCell: {
        fontSize: 10,
        color: colors.textPrimary,
    },
    // Column widths
    colDate: {
        width: 80,
    },
    colReceipt: {
        width: 100,
    },
    colCustomer: {
        width: 120,
    },
    colItem: {
        width: 150,
    },
    colCode: {
        width: 70,
    },
    colQty: {
        width: 50,
    },
    colAmount: {
        width: 80,
    },
    textCenter: {
        textAlign: 'center',
    },
    textRight: {
        textAlign: 'right',
    },
    colStatus: {
        width: 100,
    },
    colCategory: {
        width: 120,
    },
    colDescription: {
        width: 250,
    },
    summaryContainer: {
        backgroundColor: colors.white,
        margin: spacing.m,
        padding: spacing.m,
        borderRadius: borderRadius.m,
        ...shadows.small,
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
        fontWeight: '600',
    },
    grandTotalRow: {
        marginTop: spacing.s,
        paddingTop: spacing.s,
        borderTopWidth: 2,
        borderTopColor: colors.primary,
    },
    grandTotalLabel: {
        color: colors.primary,
    },
    grandTotalValue: {
        color: colors.primary,
    },
    footer: {
        padding: spacing.m,
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.slate200,
        ...shadows.medium,
    },
});
