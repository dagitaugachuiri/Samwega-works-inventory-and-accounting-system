import React from 'react';
import { View, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import AppText from '../ui/AppText';

const DashboardMetrics = ({ totalSales, targetAmount, progressPercent, period }) => {
    const remaining = Math.max(0, targetAmount - totalSales);
    const progressValue = Math.min(100, Math.max(0, progressPercent));

    // Gamification text based on progress
    const getProgressMessage = () => {
        if (progressValue >= 100) return "🚀 Amazing! Target Crushed!";
        if (progressValue >= 75) return "🔥 You're on fire! Almost there!";
        if (progressValue >= 50) return "🌟 Halfway point passed! Keep going!";
        if (progressValue >= 25) return "💪 Great start! Keep pushing!";
        return "🌱 Each sale is a step to excellence!";
    };

    // Dynamic progress color - Gold for all stages (Excellence)
    const getProgressGradient = () => {
        return ['#F59E0B', '#B45309']; // Amber-500 to Amber-700
    };

    return (
        <View style={styles.container}>
            {/* Sales Card */}
            <View style={styles.card}>
                <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                        <AppText variant="caption" style={styles.cardLabel}>
                            SALES ({period.toUpperCase()})
                        </AppText>
                        <View style={styles.iconContainer}>
                            <AppText style={styles.iconText}>💰</AppText>
                        </View>
                    </View>

                    <AppText variant="h2" style={styles.value}>
                        KSh {Math.floor(totalSales).toLocaleString()}
                    </AppText>

                    <AppText variant="small" style={styles.comparisonText}>Total Revenue</AppText>
                </View>
            </View>

            {/* Target Card */}
            <View style={styles.card}>
                <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                        <AppText variant="caption" style={styles.cardLabel}>
                            TRIP TARGET
                        </AppText>
                        <View style={styles.iconContainer}>
                            <AppText style={styles.iconText}>🎯</AppText>
                        </View>
                    </View>

                    <AppText variant="h2" style={styles.value}>
                        {progressValue.toFixed(0)}%
                    </AppText>

                    <View style={styles.targetDetails}>
                        <AppText variant="small" style={styles.gamificationText}>
                            {getProgressMessage()}
                        </AppText>

                        <View style={styles.miniProgressBarTrack}>
                            <LinearGradient
                                colors={getProgressGradient()}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.miniProgressBarFill, { width: `${progressValue}%` }]}
                            />
                        </View>

                        <AppText variant="small" style={styles.remainingText}>
                            {remaining > 0
                                ? `KSh ${remaining.toLocaleString()} to reach target`
                                : 'Target achieved!'}
                        </AppText>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: spacing.l,
        paddingVertical: spacing.m,
        gap: spacing.m,
        flexDirection: 'row',
    },
    card: {
        flex: 1, // Equal width
        borderRadius: borderRadius.card,
        backgroundColor: colors.surface,
        ...shadows.card,
        minHeight: 160,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    cardContent: {
        padding: spacing.cardPadding,
        flex: 1,
        justifyContent: 'space-between',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.s,
    },
    cardLabel: {
        color: colors.textSecondary,
        fontWeight: '700',
        letterSpacing: 1,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.slate100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconText: {
        fontSize: 18,
    },
    value: {
        color: colors.textPrimary,
        marginBottom: spacing.s,
    },
    comparisonText: {
        color: colors.textSecondary,
    },
    targetDetails: {
        gap: 8,
        marginTop: 'auto',
    },
    gamificationText: {
        color: colors.warning, // Using semantic warning color for Gold/Amber
        fontWeight: '600',
        fontStyle: 'italic',
    },
    miniProgressBarTrack: {
        height: 6,
        backgroundColor: colors.slate200,
        borderRadius: 3,
        overflow: 'hidden',
    },
    miniProgressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    remainingText: {
        color: colors.textSecondary,
    },
});

export default DashboardMetrics;
