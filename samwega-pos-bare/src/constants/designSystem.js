// Design System Constants
// Premium color palette, typography, spacing for the POS dashboard

export const Colors = {
    // Primary - Indigo
    primary: '#6366F1',
    primaryDark: '#4F46E5',
    primaryLight: '#EEF2FF',

    // Secondary - Emerald (Success, Revenue)
    secondary: '#10B981',
    secondaryLight: '#D1FAE5',
    secondaryDark: '#059669',

    // Accent - Amber (Warnings, Targets)
    accent: '#F59E0B',
    accentLight: '#FEF3C7',
    accentDark: '#FB923C',

    // Semantic
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    // Revenue gradient
    revenueStart: '#10B981',
    revenueEnd: '#059669',

    // Target gradient
    targetStart: '#F59E0B',
    targetEnd: '#FB923C',

    // Stock
    stock: '#3B82F6',

    // Expenses
    expenses: '#F43F5E',

    // Neutrals
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',
    border: '#E2E8F0',
    background: '#F8FAFC',
    cardBackground: '#FFFFFF',

    // Gradient backgrounds
    headerGradientStart: '#6366F1',
    headerGradientEnd: '#8B5CF6',

    // Category colors for actions
    reportGradientStart: '#3B82F6',
    reportGradientEnd: '#2563EB',
    stockGradientStart: '#8B5CF6',
    stockGradientEnd: '#7C3AED',
    expensesGradientStart: '#F43F5E',
    expensesGradientEnd: '#E11D48',
    syncGradientStart: '#64748B',
    syncGradientEnd: '#475569',
};

export const Typography = {
    // Display (Vehicle Number)
    display: {
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -0.5,
    },

    // Heading 1 (Section Titles)
    h1: {
        fontSize: 22,
        fontWeight: '700',
        lineHeight: 30.8,
    },

    // Heading 2 (Card Labels)
    h2: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // Body Large (Metric Values)
    bodyLarge: {
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: -0.5,
    },

    // Body (Default)
    body: {
        fontSize: 15,
        fontWeight: '500',
        lineHeight: 21,
    },

    // Caption (Subtexts)
    caption: {
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16.8,
    },

    // Micro (Timestamps)
    micro: {
        fontSize: 11,
        fontWeight: '400',
        lineHeight: 15.4,
    },
};

export const Spacing = {
    // Container
    containerPadding: 24,

    // Cards
    cardPadding: 20,
    cardGap: 16,

    // Sections
    sectionGap: 24,

    // List
    listItemSpacing: 1,

    // Buttons
    buttonPadding: 16,
};

export const BorderRadius = {
    card: 16,
    button: 12,
    icon: 10,
    small: 8,
    large: 20,
};

export const Shadows = {
    // Elevated (Headers, Primary CTAs)
    elevated: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 8,
    },

    // Card (Regular cards)
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },

    // Small (Subtle elevation)
    small: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },

    // Large (Modals, Drawers)
    large: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 32,
        elevation: 12,
    },
};

export const IconSizes = {
    small: 20,
    medium: 24,
    large: 32,
    xlarge: 56,
};

export const TouchTargets = {
    minimum: 44,
};

export const Gradients = {
    // Revenue card
    revenue: {
        colors: [Colors.revenueStart, Colors.revenueEnd],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },

    // Target card
    target: {
        colors: [Colors.targetStart, Colors.targetEnd],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },

    // Header
    header: {
        colors: [Colors.headerGradientStart, Colors.headerGradientEnd],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 },
    },

    // Primary button
    primaryButton: {
        colors: [Colors.primary, Colors.primaryDark],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
};
