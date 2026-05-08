import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login } from '../services/api';
import CustomAlert from '../components/ui/CustomAlert';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showAlert = (title, message, type = 'info') => {
        setAlertConfig({ visible: true, title, message, type });
    };

    const handleLogin = async () => {
        if (!email || !password) {
            showAlert('Error', 'Please enter email and password', 'warning');
            return;
        }

        setLoading(true);
        try {
            const response = await login(email, password);

            if (response.success) {
                const { user, token, firebaseToken } = response.data;
                console.log(user);

                await AsyncStorage.setItem('userToken', token);
                await AsyncStorage.setItem('firebaseToken', firebaseToken || '');
                await AsyncStorage.setItem('userData', JSON.stringify(user));
                await AsyncStorage.setItem('temp_password', password);

                if (!user.isVerified) {
                    navigation.replace('WaitingVerification', {
                        email: user.email,
                        username: user.username
                    });
                } else if (!user.assignedVehicleId) {
                    showAlert(
                        'No Vehicle Assigned',
                        'You have been verified but no vehicle has been assigned to you yet. Please contact your administrator.',
                        'warning'
                    );
                } else {
                    await AsyncStorage.setItem('vehicleId', user.assignedVehicleId);
                    navigation.replace('Stock', { vehicleId: user.assignedVehicleId });
                }
            }
        } catch (error) {
            showAlert('Error', error.response?.data?.error || 'Login failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            <View style={styles.content}>
                {/* Brand */}
                <View style={styles.brandSection}>
                    <View style={styles.logoCircle}>
                        <Text style={styles.logoText} allowFontScaling={false}>S</Text>
                    </View>
                    <Text style={styles.brandName} allowFontScaling={false}>Samwega Works Ltd</Text>
                    <Text style={styles.tagline} allowFontScaling={false}>Field POS System </Text>
                </View>

                {/* Form */}
                <View style={styles.formSection}>
                    <TextInput
                        style={styles.input}
                        placeholder="Email address"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        placeholderTextColor="#9CA3AF"
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        placeholderTextColor="#9CA3AF"
                    />

                    <TouchableOpacity
                        style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#1D4ED8" />
                        ) : (
                            <Text style={styles.loginButtonText}>Sign In</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Registration')}>
                        <Text style={styles.footerLink}>Create one</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },

    // Brand Section
    brandSection: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    logoText: {
        fontSize: 36,
        fontWeight: '700',
        color: '#1D4ED8',
    },
    brandName: {
        fontSize: 28,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    tagline: {
        fontSize: 15,
        color: '#6B7280',
    },

    // Form Section
    formSection: {
        marginBottom: 32,
    },
    input: {
        height: 52,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#111827',
        backgroundColor: '#F9FAFB',
        marginBottom: 16,
    },
    loginButton: {
        height: 52,
        backgroundColor: '#699fe6ff', // Light Blue
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    loginButtonDisabled: {
        opacity: 0.7,
    },
    loginButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1D4ED8', // Dark Blue
    },

    // Footer
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 14,
        color: '#6B7280',
    },
    footerLink: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1D4ED8',
    },
});
