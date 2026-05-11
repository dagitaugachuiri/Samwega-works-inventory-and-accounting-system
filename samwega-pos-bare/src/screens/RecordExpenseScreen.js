import React, { useState } from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { createExpenseBatch } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

// Theme & UI
import { colors, spacing, borderRadius, shadows, typography } from '../theme';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';
import CustomAlert from '../components/ui/CustomAlert';

const EXPENSE_CATEGORIES = [
    { id: 'fuel', label: 'Fuel', icon: '⛽', color: colors.warning },
    { id: 'maintenance', label: 'Maintenance', icon: '🔧', color: colors.error },
    { id: 'salaries', label: 'Allowances / Wages', icon: '💰', color: colors.success },
    { id: 'supplies', label: 'Supplies', icon: '📦', color: colors.info },
    { id: 'meals', label: 'Meals & Water', icon: '🥤', color: colors.warning },
    { id: 'communication', label: 'Airtime/Data', icon: '📱', color: colors.info },
    { id: 'fines', label: 'Tolls / Parking / Fines', icon: '👮', color: colors.textSecondary },
    { id: 'other', label: 'Other Expenses', icon: '📋', color: colors.textSecondary },
];

export default function RecordExpenseScreen({ route, navigation }) {
    const { vehicleId } = route?.params || {};

    useEffect(() => {
        const checkRole = async () => {
            const userDataStr = await AsyncStorage.getItem('userData');
            if (userDataStr) {
                const user = JSON.parse(userDataStr);
                if (user.role === 'driver') {
                    console.log('🚫 Driver tried to access record expense screen');
                    navigation.replace('Stock', { vehicleId: user.assignedVehicleId });
                }
            }
        };
        checkRole();
    }, []);

    const [expenseAmounts, setExpenseAmounts] = useState({});
    const [globalDescription, setGlobalDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Alert State
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: null,
        loading: false,
        showCancel: false
    });

    const showAlert = (title, message, type = 'info', onConfirm = null) => {
        setAlertConfig({ visible: true, title, message, type, onConfirm });
    };

    const handleAmountChange = (catId, value) => {
        setExpenseAmounts(prev => ({
            ...prev,
            [catId]: value
        }));
    };

    const handleSubmit = async () => {
        const activeExpenses = Object.entries(expenseAmounts)
            .filter(([_, amount]) => amount && parseFloat(amount) > 0)
            .map(([catId, amount]) => ({
                category: catId,
                amount: parseFloat(amount),
                label: EXPENSE_CATEGORIES.find(c => c.id === catId)?.label
            }));

        if (activeExpenses.length === 0) {
            showAlert('No Expenses', 'Please enter at least one expense amount', 'warning');
            return;
        }

        setSubmitting(true);
        setAlertConfig({
            visible: true,
            title: 'Recording Expenses',
            message: `Recording ${activeExpenses.length} items...`,
            type: 'info',
            loading: true,
            showCancel: false
        });

        try {
            const batchPayload = {
                expenseDate: new Date().toISOString(),
                expenses: activeExpenses.map(item => ({
                    vehicleId,
                    category: item.category,
                    amount: item.amount,
                    description: globalDescription.trim() || `Recorded via mobile app`
                }))
            };

            await createExpenseBatch(batchPayload);

            setAlertConfig({
                visible: true,
                title: 'Success',
                message: 'Expenses recorded successfully',
                type: 'success',
                loading: false,
                showCancel: false,
                onConfirm: () => navigation.goBack()
            });
        } catch (error) {
            console.error('[RecordExpense] Error:', error);
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: error.response?.data?.error || 'Failed to record expenses',
                type: 'error',
                loading: false,
                showCancel: false,
                onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false }))
            });
        } finally {
            setSubmitting(false);
        }
    };

    const calculateTotal = () => {
        return Object.values(expenseAmounts).reduce((sum, amt) => {
            const val = parseFloat(amt);
            return sum + (isNaN(val) ? 0 : val);
        }, 0);
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <AppText style={styles.backButton}>← Back</AppText>
                </TouchableOpacity>
                <AppText variant="h3" style={styles.headerTitle}>Record Expense</AppText>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                <AppText style={styles.instruction}>Enter amounts for any expenses you incurred today:</AppText>

                <View style={styles.expenseList}>
                    {EXPENSE_CATEGORIES.map((cat) => (
                        <View key={cat.id} style={styles.expenseRow}>
                            <View style={[styles.rowIcon, { backgroundColor: cat.color + '15' }]}>
                                <AppText style={{ fontSize: 20 }}>{cat.icon}</AppText>
                            </View>
                            <View style={styles.rowLabelContainer}>
                                <AppText variant="bodyBold">{cat.label}</AppText>
                                <AppText variant="caption">Amount (KSh)</AppText>
                            </View>
                            <TextInput
                                style={styles.rowInput}
                                value={expenseAmounts[cat.id] || ''}
                                onChangeText={(val) => handleAmountChange(cat.id, val)}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor="#CBD5E1"
                            />
                        </View>
                    ))}
                </View>

                <View style={styles.notesSection}>
                    <AppText variant="caption" style={styles.sectionTitle}>GENERAL NOTES / DESCRIPTION</AppText>
                    <TextInput
                        style={styles.textArea}
                        value={globalDescription}
                        onChangeText={setGlobalDescription}
                        placeholder="Add any extra details (e.g. receipt numbers, locations)..."
                        placeholderTextColor="#94A3B8"
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                    />
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <View style={styles.totalSummary}>
                    <AppText style={styles.totalLabel}>TOTAL TO RECORD</AppText>
                    <AppText style={styles.totalValue}>KSh {calculateTotal().toLocaleString()}</AppText>
                </View>
                <AppButton
                    title="Record All Expenses"
                    onPress={handleSubmit}
                    loading={submitting}
                    disabled={calculateTotal() <= 0}
                />
            </View>

            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
                onConfirm={alertConfig.onConfirm}
                loading={alertConfig.loading}
                showCancel={alertConfig.showCancel}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
    section: {
        marginBottom: spacing.l,
    },
    sectionTitle: {
        color: colors.textSecondary,
        marginBottom: spacing.s,
        fontWeight: '600',
    },
    instruction: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 20,
    },
    expenseList: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 8,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 24,
    },
    expenseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    rowIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    rowLabelContainer: {
        flex: 1,
    },
    rowInput: {
        width: 100,
        height: 44,
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 12,
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
        textAlign: 'right',
    },
    notesSection: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
        marginBottom: 8,
    },
    textArea: {
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        fontSize: 15,
        color: colors.textPrimary,
        minHeight: 80,
    },
    footer: {
        padding: 20,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        marginBottom: 50,
    },
    totalSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    totalLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.primary,
    },
});
