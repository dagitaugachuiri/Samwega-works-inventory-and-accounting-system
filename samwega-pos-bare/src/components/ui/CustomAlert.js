import React from 'react';
import { StyleSheet, View } from 'react-native';
import CustomModal from './CustomModal';
import AppText from './AppText';
import AppButton from './AppButton';
import { colors, spacing } from '../../theme';

const CustomAlert = ({
    visible,
    title,
    message,
    onClose,
    onConfirm,
    confirmText = 'OK',
    cancelText = 'Cancel',
    type = 'info', // info, success, warning, error, confirmation
    loading = false,
    showCancel = true,
}) => {

    // Determine header color/icon based on type (simplified for now)
    const getTitleColor = () => {
        if (type === 'error') return colors.error;
        if (type === 'warning') return colors.warning;
        if (type === 'success') return colors.success;
        return colors.textPrimary;
    };

    return (
        <CustomModal visible={visible} onClose={onClose} dismissible={type !== 'error'}>
            <View style={styles.content}>
                {title && (
                    <AppText variant="h3" centered style={[styles.title, { color: getTitleColor() }]}>
                        {title}
                    </AppText>
                )}

                <AppText variant="body" centered style={styles.message}>
                    {message}
                </AppText>

                <View style={styles.actions}>
                    {onConfirm && showCancel ? (
                        // Two buttons: Cancel + Confirm
                        <>
                            <AppButton
                                title={cancelText}
                                variant="ghost"
                                onPress={onClose}
                                style={styles.buttonFlex}
                                disabled={loading}
                            />
                            <View style={{ width: spacing.m }} />
                            <AppButton
                                title={confirmText}
                                variant={type === 'error' ? 'danger' : 'primary'}
                                onPress={onConfirm}
                                style={styles.buttonFlex}
                                loading={loading}
                                disabled={loading}
                            />
                        </>
                    ) : (
                        // Single button (OK)
                        <AppButton
                            title={confirmText}
                            variant={type === 'error' ? 'danger' : 'primary'}
                            onPress={onConfirm || onClose}
                            style={styles.fullWidth}
                            loading={loading}
                            disabled={loading}
                        />
                    )}
                </View>
            </View>
        </CustomModal>
    );
};

const styles = StyleSheet.create({
    content: {
        alignItems: 'center',
    },
    title: {
        marginBottom: spacing.s,
    },
    message: {
        marginBottom: spacing.l,
        color: colors.textSecondary,
    },
    actions: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'center',
    },
    buttonFlex: {
        flex: 1,
    },
    fullWidth: {
        width: '100%',
    },
});

export default CustomAlert;
