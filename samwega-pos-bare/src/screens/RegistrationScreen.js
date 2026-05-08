import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import { register } from '../services/api';
import CustomAlert from '../components/ui/CustomAlert';

export default function RegistrationScreen({ navigation }) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [role, setRole] = useState('sales_rep'); // 'sales_rep' or 'driver'
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: null
    });

    const showAlert = (title, message, type = 'info', onConfirm = null) => {
        setAlertConfig({ visible: true, title, message, type, onConfirm });
    };

    const handleRegister = async () => {
        if (!username || !email || !password || !confirmPassword) {
            showAlert('Error', 'Please fill in all required fields', 'warning');
            return;
        }

        if (password !== confirmPassword) {
            showAlert('Error', 'Passwords do not match', 'warning');
            return;
        }

        if (password.length < 6) {
            showAlert('Error', 'Password must be at least 6 characters', 'warning');
            return;
        }

        setLoading(true);
        try {
            const response = await register(email, password, username, phone, role);

            if (response.success) {
                showAlert(
                    'Registration Successful',
                    'Your account has been created. Please wait for admin verification.',
                    'success',
                    () => navigation.replace('WaitingVerification', { email, username })
                );
            }
        } catch (error) {
            showAlert('Error', error.response?.data?.error || 'Registration failed', 'error');
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

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Brand */}
                <View style={styles.brandSection}>
                    <View style={styles.logoCircle}>
                        <Text style={styles.logoText}>S</Text>
                    </View>
                    <Text style={styles.brandName}>Create Account</Text>
                    <Text style={styles.tagline}>Join Samwega Field Sales</Text>
                </View>

                {/* Form */}
                <View style={styles.formSection}>
                    <TextInput
                        style={styles.input}
                        placeholder="Full name"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="words"
                        placeholderTextColor="#9CA3AF"
                    />

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
                        placeholder="Phone number (optional)"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        placeholderTextColor="#9CA3AF"
                    />

                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={[styles.input, styles.inputWithIcon]}
                            placeholder="Password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            placeholderTextColor="#9CA3AF"
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowPassword(!showPassword)}
                        >
                            <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show Password '}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={[styles.input, styles.inputWithIcon]}
                            placeholder="Confirm password"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            placeholderTextColor="#9CA3AF"
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                            <Text style={styles.eyeText}>{showConfirmPassword ? 'Hide' : 'Show Password '}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Role Selection */}
                    <View style={styles.roleContainer}>
                        <Text style={styles.roleLabel}>Register as:</Text>
                        <View style={styles.roleTabs}>
                            <TouchableOpacity
                                style={[styles.roleTab, role === 'sales_rep' && styles.roleTabActive]}
                                onPress={() => setRole('sales_rep')}
                            >
                                <Text style={[styles.roleTabText, role === 'sales_rep' && styles.roleTabTextActive]}>Sales Rep</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.roleTab, role === 'driver' && styles.roleTabActive]}
                                onPress={() => setRole('driver')}
                            >
                                <Text style={[styles.roleTabText, role === 'driver' && styles.roleTabTextActive]}>Driver</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.registerButton, loading && styles.registerButtonDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#1D4ED8" />
                        ) : (
                            <Text style={styles.registerButtonText}>Create Account</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                        <Text style={styles.footerLink}>Sign in</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
                onConfirm={alertConfig.onConfirm}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingVertical: 48,
        justifyContent: 'center',
    },

    // Brand Section
    brandSection: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#EFF6FF', // Light Blue
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    logoText: {
        fontSize: 32,
        fontWeight: '700',
        color: '#1D4ED8', // Dark Blue
    },
    brandName: {
        fontSize: 24,
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
    passwordContainer: {
        marginBottom: 16,
        position: 'relative',
        justifyContent: 'center',
    },
    inputWithIcon: {
        marginBottom: 0,
        paddingRight: 60,
    },
    eyeIcon: {
        position: 'absolute',
        right: 16,
        height: '100%',
        justifyContent: 'center',
    },
    eyeText: {
        color: '#6B7280',
        fontSize: 14,
        fontWeight: '600',
    },
    registerButton: {
        height: 52,
        backgroundColor: '#EFF6FF', // Light Blue
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    registerButtonDisabled: {
        opacity: 0.7,
    },
    registerButtonText: {
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
    // Role Selector Styles
    roleContainer: {
        marginBottom: 20,
    },
    roleLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    roleTabs: {
        flexDirection: 'row',
        gap: 12,
    },
    roleTab: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    roleTabActive: {
        backgroundColor: '#EFF6FF',
        borderColor: '#1D4ED8',
    },
    roleTabText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    roleTabTextActive: {
        color: '#1D4ED8',
        fontWeight: '700',
    },
});
