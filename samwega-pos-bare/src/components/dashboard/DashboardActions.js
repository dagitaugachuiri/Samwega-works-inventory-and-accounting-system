import React from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import AppText from '../ui/AppText';

const DashboardActions = ({ onNewSale, onSalesDashboard, onIssuances, onExpenses, onRefresh }) => {
    const scaleAnim = React.useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        Animated.loop(
            Animated.timing(scaleAnim, {
                toValue: 1.5,
                duration: 1500,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    return (
        <View style={styles.container}>
            <AppText variant="h2" style={styles.sectionTitle}>Quick Actions</AppText>

            {/* Primary CTA - Record Sale */}
            <TouchableOpacity
                onPress={onNewSale}
                activeOpacity={0.85}
                style={styles.primaryButtonContainer}
            >
                <LinearGradient
                    colors={[colors.palette.primary600, colors.palette.primary900]} // Theme Indigo Gradient
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryButton}
                >
                    <View style={styles.primaryContent}>
                        <View style={styles.iconWrapper}>
                            <Animated.View style={[styles.ripple, {
                                transform: [{ scale: scaleAnim }],
                                opacity: scaleAnim.interpolate({ inputRange: [1, 1.5], outputRange: [0.6, 0] })
                            }]} />
                            <View style={styles.plusIconContainer}>
                                <AppText style={styles.plusIcon}>+</AppText>
                            </View>
                        </View>
                        <AppText variant="h3" style={styles.primaryText}>Record Sale</AppText>
                    </View>
                </LinearGradient>
            </TouchableOpacity>

            {/* Secondary Actions - 2x2 Grid */}
            <View style={styles.gridContainer}>
                {/* Row 1 */}
                <View style={styles.gridRow}>
                    {/* Report */}
                    <TouchableOpacity
                        style={styles.gridButton}
                        onPress={onSalesDashboard}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: colors.palette.primary50 }]}>
                            <AppText style={styles.iconEmoji}>📊</AppText>
                        </View>
                        <AppText style={styles.gridButtonText}>Sales </AppText>
                    </TouchableOpacity>

                    {/* Stock */}
                    <TouchableOpacity
                        style={styles.gridButton}
                        onPress={onIssuances}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: colors.successBg }]}>
                            <AppText style={styles.iconEmoji}>📦</AppText>
                        </View>
                        <AppText style={styles.gridButtonText}>Stock</AppText>
                    </TouchableOpacity>
                </View>

                {/* Row 2 */}
                <View style={styles.gridRow}>
                    {/* Expenses */}
                    <TouchableOpacity
                        style={styles.gridButton}
                        onPress={onExpenses}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: colors.warningBg }]}>
                            <AppText style={styles.iconEmoji}>💰</AppText>
                        </View>
                        <AppText style={styles.gridButtonText}>Expenses</AppText>
                    </TouchableOpacity>

                    {/* Sync */}
                    <TouchableOpacity
                        style={styles.gridButton}
                        onPress={onRefresh}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: colors.slate100 }]}>
                            <AppText style={styles.iconEmoji}>🔄</AppText>
                        </View>
                        <AppText style={styles.gridButtonText}>Sync</AppText>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: spacing.l,
        paddingVertical: spacing.l,
    },
    sectionTitle: {
        marginBottom: spacing.m,
    },

    // Primary CTA
    primaryButtonContainer: {
        marginBottom: spacing.l,
        borderRadius: borderRadius.button,
        ...shadows.medium,
    },
    primaryButton: {
        paddingVertical: spacing.l,
        paddingHorizontal: spacing.l,
        borderRadius: borderRadius.button,
        minHeight: 64, // Slightly taller for impact
        justifyContent: 'center',
    },
    primaryContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
    },
    iconWrapper: {
        position: 'relative',
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ripple: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    plusIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    plusIcon: {
        color: colors.white,
        fontSize: 24,
        fontWeight: '600',
        marginTop: -2,
    },
    primaryText: {
        color: colors.white,
    },

    // 2x2 Grid
    gridContainer: {
        gap: spacing.m,
    },
    gridRow: {
        flexDirection: 'row',
        gap: spacing.m,
    },
    gridButton: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.card,
        padding: spacing.l,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 140,
        ...shadows.card,
        borderWidth: 1,
        borderColor: colors.border,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.m,
    },
    iconEmoji: {
        fontSize: 24,
    },
    gridButtonText: {
        fontWeight: '600',
        color: colors.textPrimary,
    },
});

export default DashboardActions;
