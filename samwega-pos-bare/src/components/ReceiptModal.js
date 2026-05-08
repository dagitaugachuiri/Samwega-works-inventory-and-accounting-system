import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Alert,
    Platform
} from 'react-native';

const ReceiptModal = ({ visible, onClose, onPrint, receiptText }) => {
    console.log(`[ReceiptModal] Rendered. Visible: ${visible}, TextLen: ${receiptText ? receiptText.length : 0}`);

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { minHeight: 400 }]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Receipt Preview</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.previewContainer}>
                        <ScrollView contentContainerStyle={styles.scrollContent}>
                            <Text style={styles.receiptText}>
                                {receiptText || "No receipt text generated."}
                            </Text>
                        </ScrollView>
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={onClose}
                        >
                            <Text style={styles.cancelButtonText}>Close</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.printButton]}
                            onPress={onPrint}
                        >
                            <Text style={styles.printButtonText}>🖨️ Print Receipt</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    closeButton: {
        padding: 8,
    },
    closeButtonText: {
        fontSize: 18,
        color: '#6B7280',
    },
    previewContainer: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        padding: 16,
    },
    scrollContent: {
        flexGrow: 1,
        minHeight: 200, // Force height
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    scrollContent: {
        flexGrow: 1,
        padding: 16,
    },
    receiptText: {
        fontSize: 16,
        color: '#000000',
        lineHeight: 24,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    footer: {
        flexDirection: 'row',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 12,
        backgroundColor: 'white',
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#F3F4F6',
    },
    cancelButtonText: {
        color: '#4B5563',
        fontWeight: '600',
    },
    printButton: {
        backgroundColor: '#0EA5E9',
    },
    printButtonText: {
        color: 'white',
        fontWeight: '600',
    },
});

export default ReceiptModal;
