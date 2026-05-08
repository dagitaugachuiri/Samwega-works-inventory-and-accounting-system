import React from 'react';
import { View, StyleSheet } from 'react-native';

const LoadingSkeleton = ({ variant = 'default', style }) => {
    if (variant === 'statCard') {
        return (
            <View style={[styles.statCard, style]}>
                <View style={styles.statLabelSkeleton} />
                <View style={styles.statValueSkeleton} />
            </View>
        );
    }

    if (variant === 'statCardSmall') {
        return (
            <View style={[styles.statCardSmall, style]}>
                <View style={styles.statLabelSmallSkeleton} />
                <View style={styles.statValueSmallSkeleton} />
            </View>
        );
    }

    if (variant === 'actionCard') {
        return (
            <View style={[styles.actionCard, style]}>
                <View style={styles.actionIconSkeleton} />
                <View style={styles.actionLabelSkeleton} />
            </View>
        );
    }

    // Default
    return (
        <View style={[styles.default, style]} />
    );
};

const styles = StyleSheet.create({
    default: {
        height: 20,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
    },
    statCard: {
        backgroundColor: '#E5E7EB',
        borderRadius: 16,
        padding: 20,
        marginBottom: 12,
    },
    statLabelSkeleton: {
        width: '40%',
        height: 14,
        backgroundColor: '#D1D5DB',
        borderRadius: 4,
        marginBottom: 8,
    },
    statValueSkeleton: {
        width: '60%',
        height: 28,
        backgroundColor: '#D1D5DB',
        borderRadius: 4,
    },
    statCardSmall: {
        flex: 1,
        backgroundColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
    },
    statLabelSmallSkeleton: {
        width: '60%',
        height: 13,
        backgroundColor: '#D1D5DB',
        borderRadius: 4,
        marginBottom: 6,
    },
    statValueSmallSkeleton: {
        width: '45%',
        height: 18,
        backgroundColor: '#D1D5DB',
        borderRadius: 4,
    },
    actionCard: {
        width: '25%',
        paddingHorizontal: 6,
        alignItems: 'center',
    },
    actionIconSkeleton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E5E7EB',
        marginBottom: 6,
    },
    actionLabelSkeleton: {
        width: 50,
        height: 13,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
    },
});

export default LoadingSkeleton;
