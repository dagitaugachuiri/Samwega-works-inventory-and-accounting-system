import React from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';
import AppText from '../ui/AppText';

const DashboardHeader = ({ vehicleName, vehicleNumber, onLogout, period, onPeriodChange }) => {
    // Animation for period indicator
    const slideAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: period === 'today' ? 0 : period === 'week' ? 1 : 2,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [period]);

    const getPeriodLabel = (p) => {
        switch (p) {
            case 'today': return 'Today ';
            case 'week': return 'Week';
            case 'month': return 'Month';
            default: return 'Period';
        }
    };

    const getIndicatorPosition = () => {
        return slideAnim.interpolate({
            inputRange: [0, 1, 2],
            outputRange: [4, 75, 146], // Adjusted for new tab width
        });
    };

    return (
        <View style={styles.headerContainer}>
            <View style={styles.statusBarPlaceholder} />
            <View style={styles.headerContent}>

                {/* Left Side: Vehicle Info */}
                <View style={styles.vehicleInfo}>
                    <AppText variant="h1" style={styles.vehicleNumber}>
                        {vehicleNumber || '--'}
                    </AppText>
                    <View style={styles.badgeRow}>
                        <View style={styles.vehicleBadge}>
                            <AppText variant="small" style={styles.vehicleNameLabel}>
                                {vehicleName || 'Vehicle Inventory'}
                            </AppText>
                        </View>
                    </View>
                </View>

                {/* Right Side: Logout Button */}
                <TouchableOpacity onPress={onLogout} style={styles.logoutButton} activeOpacity={0.7}>
                    <AppText style={styles.logoutIcon}>⎋</AppText>
                </TouchableOpacity>
            </View>

            {/* Period Selector */}
            <View style={styles.periodSelector}>
                <Animated.View
                    style={[
                        styles.activeIndicator,
                        { transform: [{ translateX: getIndicatorPosition() }] }
                    ]}
                />
                {['today', 'week', 'month'].map((p) => (
                    <TouchableOpacity
                        key={p}
                        style={styles.periodTab}
                        onPress={() => onPeriodChange(p)}
                        activeOpacity={0.7}
                    >
                        <AppText
                            variant="small"
                            style={[
                                styles.periodText,
                                period === p && styles.periodTextActive
                            ]}
                        >
                            {getPeriodLabel(p)}
                        </AppText>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    headerContainer: {
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.l,
        paddingBottom: spacing.m,
        paddingTop: spacing.s,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    statusBarPlaceholder: {
        height: 5,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.m,
    },
    vehicleInfo: {
        justifyContent: 'center',
    },
    vehicleNumber: {
        color: colors.textPrimary,
        letterSpacing: -1,
    },
    badgeRow: {
        flexDirection: 'row',
        marginTop: 4,
    },
    vehicleBadge: {
        backgroundColor: colors.slate100,
        paddingHorizontal: spacing.s,
        paddingVertical: 2,
        borderRadius: borderRadius.s,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    vehicleNameLabel: {
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontSize: 10,
    },
    logoutButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.slate100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoutIcon: {
        fontSize: 18,
        color: colors.textPrimary,
        fontWeight: 'bold',
    },
    periodSelector: {
        flexDirection: 'row',
        backgroundColor: colors.slate100,
        borderRadius: borderRadius.l,
        padding: 4,
        height: 40,
        position: 'relative',
        width: 220, // Constrain width or let it flex
    },
    periodTab: {
        width: 70, // Fixed width for easier math
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    periodText: {
        color: colors.textSecondary,
        fontWeight: '500',
    },
    periodTextActive: {
        color: colors.primary,
        fontWeight: '600',
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 4,
        left: 0,
        width: 70,
        height: 32,
        backgroundColor: colors.white,
        borderRadius: borderRadius.m,
        zIndex: 1,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
});

export default DashboardHeader;