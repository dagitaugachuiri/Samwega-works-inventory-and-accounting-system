import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';
import AppButton from './AppButton';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export default function DatePickerModal({ visible, onClose, onSelect, initialDate }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);

    useEffect(() => {
        if (visible) {
            if (initialDate) {
                const date = new Date(initialDate);
                // check for invalid date
                if (!isNaN(date.getTime())) {
                    setCurrentDate(date);
                    setSelectedDate(initialDate);
                } else {
                    setCurrentDate(new Date());
                    setSelectedDate(null);
                }
            } else {
                setCurrentDate(new Date());
                setSelectedDate(null);
            }
        }
    }, [visible, initialDate]);

    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year, month) => {
        return new Date(year, month, 1).getDay();
    };

    const generateDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);

        const days = [];

        // Empty slots for days before the 1st
        for (let i = 0; i < firstDay; i++) {
            days.push({ id: `empty-${i}`, day: null });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            days.push({ id: dateStr, day: i, date: dateStr });
        }

        return days;
    };

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleSelectDay = (date) => {
        setSelectedDate(date);
    };

    const handleConfirm = () => {
        if (selectedDate) {
            onSelect(selectedDate);
            onClose();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
                            <Text style={styles.navText}>{'<'}</Text>
                        </TouchableOpacity>
                        <Text style={styles.monthYearText}>
                            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </Text>
                        <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
                            <Text style={styles.navText}>{'>'}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Week Days Header */}
                    <View style={styles.weekDays}>
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                            <Text key={index} style={styles.weekDayText}>{day}</Text>
                        ))}
                    </View>

                    {/* Days Grid */}
                    <View style={styles.calendarGrid}>
                        {generateDays().map((item, index) => (
                            <TouchableOpacity
                                key={item.id}
                                style={[
                                    styles.dayCell,
                                    !item.day && styles.emptyCell,
                                    item.date === selectedDate && styles.selectedDayCell
                                ]}
                                onPress={() => item.day && handleSelectDay(item.date)}
                                disabled={!item.day}
                            >
                                {item.day && (
                                    <Text style={[
                                        styles.dayText,
                                        item.date === selectedDate && styles.selectedDayText
                                    ]}>
                                        {item.day}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <AppButton
                            title="Cancel"
                            variant="ghost"
                            onPress={onClose}
                            style={{ flex: 1, marginRight: 8 }}
                        />
                        <AppButton
                            title="Set Date"
                            variant="primary"
                            onPress={handleConfirm}
                            disabled={!selectedDate}
                            style={{ flex: 1, marginLeft: 8 }}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.m,
    },
    container: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.card,
        padding: spacing.m,
        ...colors.shadows?.medium,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.m,
    },
    monthYearText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    navButton: {
        padding: 8,
    },
    navText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.primary,
    },
    weekDays: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 8,
    },
    weekDayText: {
        width: 40,
        textAlign: 'center',
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    dayCell: {
        width: '14.28%', // 100% / 7
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: borderRadius.round,
    },
    emptyCell: {
        backgroundColor: 'transparent',
    },
    selectedDayCell: {
        backgroundColor: colors.primary,
    },
    dayText: {
        fontSize: 14,
        color: colors.textPrimary,
    },
    selectedDayText: {
        color: colors.white,
        fontWeight: 'bold',
    },
    actions: {
        flexDirection: 'row',
        marginTop: spacing.m,
    }
});
