import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login } from '../services/api';

// Theme & UI
import { colors, spacing, borderRadius, shadows, typography } from '../theme';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';
import CustomAlert from '../components/ui/CustomAlert';

export default function WaitingVerificationScreen({ route, navigation }) {
    const { email, username } = route.params || {};
    const [checking, setChecking] = useState(false);

    // Alert State
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: null,
        confirmText: 'OK',
    });

    const showAlert = (title, message, type = 'info', onConfirm = null, confirmText = 'OK') => {
        setAlertConfig({ visible: true, title, message, type, onConfirm, confirmText });
    };

    const handleCheckStatus = async () => {
        if (!email) {
            showAlert('Error', 'Email not found', 'error');
            return;
        }

        setChecking(true);
        try {
            // Try to login to check verification status
            const password = await AsyncStorage.getItem('temp_password');
            if (!password) {
                showAlert('Error', 'Please login again', 'warning', () => navigation.replace('Login'));
                return;
            }

            const response = await login(email, password);

            if (response.user.isVerified) {
                showAlert(
                    'Verified!',
                    'Your account has been verified. You can now access the app.',
                    'success',
                    () => {
                        AsyncStorage.setItem('userToken', response.token);
                        AsyncStorage.setItem('userData', JSON.stringify(response.user));
                        navigation.replace('Stock');
                    },
                    'Continue'
                );
            } else {
                showAlert('Not Yet', 'Your account is still pending verification. Please wait for admin approval.', 'warning');
            }
        } catch (error) {
            showAlert('Error', 'Could not check status. Please try again later.', 'error');
        } finally {
            setChecking(false);
        }
    };

    const handleLogout = async () => {
        await AsyncStorage.clear();
        navigation.replace('Login');
    };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <AppText style={styles.icon}>⏳</AppText>
                </View>

                <AppText variant="h2" style={styles.title}>Waiting for Verification</AppText>
                <AppText variant="bodyBold" centered style={styles.subtitle}>
                    Hi {username || 'there'}! Your account has been created successfully.
                </AppText>
                <AppText centered style={styles.message}>
                    Please wait while an administrator verifies your account. You'll be able to access the app once verified.
                </AppText>

                <AppButton
                    title="Check Status"
                    onPress={handleCheckStatus}
                    loading={checking}
                    style={styles.button}
                />

                <AppButton
                    title="Logout"
                    variant="ghost"
                    onPress={handleLogout}
                    style={styles.logoutButton}
                />
            </View>

            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                confirmText={alertConfig.confirmText}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
                onConfirm={alertConfig.onConfirm}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.warningBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.l,
    },
    icon: {
        fontSize: 60,
    },
    title: {
        color: colors.textPrimary,
        marginBottom: spacing.m,
        textAlign: 'center',
    },
    subtitle: {
        color: colors.textPrimary,
        marginBottom: spacing.s,
    },
    message: {
        color: colors.textSecondary,
        marginBottom: spacing.xxl,
        lineHeight: 24,
    },
    button: {
        width: '100%',
        marginBottom: spacing.m,
    },
    logoutButton: {
        padding: spacing.s,
    },
});
