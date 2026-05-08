import React from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';
import AppText from './AppText';

const AppButton = ({
    title,
    onPress,
    variant = 'primary', // primary, secondary, outline, ghost, danger
    size = 'medium', // small, medium, large
    disabled = false,
    loading = false,
    icon,
    style,
    ...props
}) => {
    const getBackgroundColor = () => {
        if (disabled) return colors.slate200;
        if (variant === 'primary') return colors.buttonPrimary || colors.primaryLight; // Force Light
        if (variant === 'secondary') return colors.primaryLight;
        if (variant === 'danger') return colors.error;
        if (variant === 'outline' || variant === 'ghost') return 'transparent';
        return colors.buttonPrimary;
    };

    const getTextColor = () => {
        if (disabled) return colors.slate400;
        if (variant === 'primary' || variant === 'danger') return colors.buttonText || colors.primary; // Force Dark
        if (variant === 'secondary') return colors.primary;
        if (variant === 'outline') return colors.primary;
        if (variant === 'ghost') return colors.textSecondary;
        return colors.buttonText;
    };

    const getBorder = () => {
        if (variant === 'outline') return { borderWidth: 1, borderColor: colors.primary };
        return {};
    };

    const getPadding = () => {
        if (size === 'small') return { paddingVertical: 6, paddingHorizontal: 12 };
        if (size === 'large') return { paddingVertical: 16, paddingHorizontal: 32 };
        return { paddingVertical: 12, paddingHorizontal: 24 }; // medium
    };

    const buttonStyle = [
        styles.button,
        { backgroundColor: getBackgroundColor() },
        getBorder(),
        getPadding(),
        disabled && styles.disabled,
        style,
    ];

    return (
        <TouchableOpacity
            style={buttonStyle}
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.7}
            {...props}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <View style={styles.contentContainer}>
                    {icon && <View style={styles.iconContainer}>{icon}</View>}
                    <AppText
                        variant={size === 'small' ? 'caption' : 'bodyBold'}
                        color={getTextColor()}
                    >
                        {title}
                    </AppText>
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        borderRadius: borderRadius.button,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    disabled: {
        opacity: 0.7,
    },
    contentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        marginRight: 8,
    },
});

export default AppButton;
