import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';

const AppText = ({
    children,
    variant = 'body',
    color,
    style,
    centered,
    numberOfLines,
    adjustsFontSizeToFit,
    ...props
}) => {
    const textStyle = [
        typography[variant] || typography.body,
        color && { color },
        centered && { textAlign: 'center' },
        style
    ];

    return (
        <Text
            style={textStyle}
            numberOfLines={numberOfLines}
            adjustsFontSizeToFit={adjustsFontSizeToFit}
            {...props}
        >
            {children}
        </Text>
    );
};

export default AppText;
