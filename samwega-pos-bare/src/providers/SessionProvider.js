import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import sessionManager from '../utils/sessionManager';
import SessionExpiredModal from '../components/SessionExpiredModal';

const SessionProvider = ({ children, navigation }) => {
    const [showSessionExpired, setShowSessionExpired] = useState(false);

    useEffect(() => {
        // Listen for session expired events
        const handleSessionExpired = () => {
            console.log('[SessionProvider] Session expired event received');
            setShowSessionExpired(true);
        };

        sessionManager.on('sessionExpired', handleSessionExpired);

        // Cleanup listener on unmount
        return () => {
            sessionManager.off('sessionExpired', handleSessionExpired);
        };
    }, []);

    const handleRelogin = async () => {
        try {
            // Clear stored credentials
            await AsyncStorage.removeItem('userToken');
            await AsyncStorage.removeItem('userData');

            // Reset session manager
            sessionManager.resetSession();

            // Hide modal
            setShowSessionExpired(false);

            // Navigate to login screen
            navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });
        } catch (error) {
            console.error('[SessionProvider] Error during relogin:', error);
        }
    };

    return (
        <>
            {children}
            <SessionExpiredModal
                visible={showSessionExpired}
                onRelogin={handleRelogin}
            />
        </>
    );
};

export default SessionProvider;
