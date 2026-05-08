// Design System Colors
const palette = {
    // Primary (Blue)
    blue700: '#1D4ED8',
    blue600: '#2563EB',
    blue50: '#EFF6FF',

    // Neutrals
    white: '#FFFFFF',
    gray50: '#F9FAFB',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray700: '#374151',
    gray900: '#111827',
    black: '#000000',

    // Semantic
    success: '#10B981',
    successLight: '#D1FAE5',
    error: '#EF4444',
    errorLight: '#FEE2E2',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    info: '#3B82F6',
    infoLight: '#DBEAFE',
};

export const colors = {
    // Primary
    primary: palette.blue700,
    primaryDark: palette.blue700,
    primaryLight: palette.blue50,

    // Backgrounds
    background: palette.white,
    surface: palette.white,
    backgroundAlt: palette.gray50,

    // Text
    textPrimary: palette.gray900,
    textSecondary: palette.gray500,
    textMuted: palette.gray400,
    textInverted: palette.white,

    // Borders
    border: palette.gray200,
    borderStrong: palette.gray400,

    // Status
    success: palette.success,
    successBg: palette.successLight,
    error: palette.error,
    errorBg: palette.errorLight,
    warning: palette.warning,
    warningBg: palette.warningLight,
    info: palette.info,
    infoBg: palette.infoLight,

    // Button specific (Light Theme Force)
    buttonPrimary: palette.blue50, // #EFF6FF
    buttonText: palette.blue700,   // #1D4ED8

    // Utility
    white: palette.white,
    black: palette.black,
    overlay: 'rgba(0, 0, 0, 0.5)',
    modalBackdrop: 'rgba(0, 0, 0, 0.5)',

    // Legacy compatibility
    slate50: palette.gray50,
    slate100: palette.gray100,
    slate200: palette.gray200,
    slate400: palette.gray400,
    secondary: palette.blue600,
    secondaryBg: palette.blue50,
    palette,
};

export const spacing = {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 48,
    screenPadding: 20,
    cardPadding: 16,
};

export const borderRadius = {
    none: 0,
    s: 4,
    m: 8,
    l: 12,
    xl: 16,
    round: 9999,
    button: 12,
    card: 12,
    input: 12,
};

export const typography = {
    h1: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.textPrimary,
        lineHeight: 34,
    },
    h2: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.textPrimary,
        lineHeight: 28,
    },
    h3: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.textPrimary,
        lineHeight: 24,
    },
    body: {
        fontSize: 16,
        fontWeight: '400',
        color: colors.textPrimary,
        lineHeight: 22,
    },
    bodyBold: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        lineHeight: 22,
    },
    caption: {
        fontSize: 14,
        fontWeight: '400',
        color: colors.textSecondary,
        lineHeight: 18,
    },
    small: {
        fontSize: 13,
        fontWeight: '400',
        color: colors.textSecondary,
        lineHeight: 16,
    },
};

export const shadows = {
    none: {},
    small: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    medium: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    large: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
};

export default {
    colors,
    spacing,
    borderRadius,
    typography,
    shadows,
};
