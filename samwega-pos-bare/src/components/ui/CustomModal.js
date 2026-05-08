import React from 'react';
import { Modal, StyleSheet, View, TouchableWithoutFeedback, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, borderRadius, spacing, shadows } from '../../theme';

const CustomModal = ({
    visible,
    onClose,
    children,
    dismissible = true
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={dismissible ? onClose : undefined}
        >
            <TouchableWithoutFeedback onPress={dismissible ? onClose : undefined}>
                <View style={styles.backdrop}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.keyboardView}
                    >
                        <TouchableWithoutFeedback>
                            <View style={styles.container}>
                                {children}
                            </View>
                        </TouchableWithoutFeedback>
                    </KeyboardAvoidingView>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: colors.modalBackdrop,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.l,
    },
    keyboardView: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    container: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.l,
        width: '100%',
        maxWidth: 400,
        ...shadows.large,
    },
});

export default CustomModal;
