import React from 'react';
import { View, Modal, StyleSheet } from 'react-native';
import AppText from './ui/AppText';
import AppButton from './ui/AppButton';
import { colors, spacing, borderRadius } from '../theme';

const SessionExpiredModal = ({ visible, onRelogin }) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Icon */}
                    <View style={styles.iconContainer}>
                        <AppText style={styles.icon}>🔒</AppText>
                    </View>

                    {/* Title */}
                    <AppText variant="h2" style={styles.title}>
                        Authentication Required
                    </AppText>

                    {/* Message */}
                    <AppText style={styles.message}>
                        You need to log in to access the system features.
                    </AppText>

                    {/* Details */}
                    <View style={styles.detailsBox}>
                        <AppText variant="small" style={styles.detailsText}>
                            💡 This may happen if:
                        </AppText>
                        <AppText variant="small" style={styles.detailsText}>
                            • Your session has been invalidated
                        </AppText>
                        <AppText variant="small" style={styles.detailsText}>
                            • Your authentication token is no longer valid
                        </AppText>
                        <AppText variant="small" style={styles.detailsText}>
                            • You logged in from another device
                        </AppText>
                    </View>

                    {/* Button */}
                    <AppButton
                        title="Sign In"
                        onPress={onRelogin}
                        variant="primary"
                        style={styles.button}
                    />
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.l,
    },
    modalContainer: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.l,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.rose50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.l,
    },
    icon: {
        fontSize: 40,
    },
    title: {
        color: colors.textPrimary,
        marginBottom: spacing.m,
        textAlign: 'center',
    },
    message: {
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.l,
        lineHeight: 22,
    },
    detailsBox: {
        backgroundColor: colors.slate50,
        borderRadius: borderRadius.m,
        padding: spacing.m,
        width: '100%',
        marginBottom: spacing.l,
        borderLeftWidth: 3,
        borderLeftColor: colors.warning,
    },
    detailsText: {
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        lineHeight: 18,
    },
    button: {
        width: '100%',
    },
});

export default SessionExpiredModal;
