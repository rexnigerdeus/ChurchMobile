// src/components/WebDatePicker.tsx
// Drop-in replacement cross-platform pour @react-native-community/datetimepicker.
// En web → utilise le <input type="date"> / <input type="time"> natif du navigateur.
// En mobile → bottom sheet Modal avec picker natif en mode "spinner" (roue)
//             + boutons Annuler/Confirmer pour une UX propre sur iOS et Android.

import React, { useState, useEffect } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions, ActivityIndicator, Alert } from 'react-native';

interface WebDatePickerProps {
  value?: Date | null;
  mode?: 'date' | 'time' | 'datetime';
  display?: 'default' | 'spinner' | 'calendar' | 'clock' | 'compact' | 'inline';
  onChange: (event: any, selectedDate?: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  style?: any;
  locale?: string;
  is24Hour?: boolean;
  label?: string;
  [key: string]: any;
}

function formatDate(d: Date, mode: string): string {
  if (mode === 'time') {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  if (mode === 'datetime') {
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + ' a ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function toInputValue(d: Date | null | undefined, mode: 'date' | 'time' | 'datetime'): string {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  if (mode === 'time') return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (mode === 'datetime') {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromInputValue(s: string, mode: 'date' | 'time' | 'datetime'): Date {
  if (mode === 'time') {
    const [h, m] = s.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }
  if (mode === 'datetime') return new Date(s);
  const [y, mo, da] = s.split('-').map(Number);
  return new Date(y, mo - 1, da);
}

export default function WebDatePicker({
  value,
  mode = 'date',
  display,
  onChange,
  minimumDate,
  maximumDate,
  placeholder,
  style,
  is24Hour = true,
  label,
}: WebDatePickerProps) {
  // WEB : input natif
  if (Platform.OS === 'web') {
    const inputType = mode === 'time' ? 'time' : mode === 'datetime' ? 'datetime-local' : 'date';
    return (
      <input
        type={inputType}
        value={toInputValue(value, mode)}
        min={minimumDate ? toInputValue(minimumDate, mode) : undefined}
        max={maximumDate ? toInputValue(maximumDate, mode) : undefined}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            onChange({ type: 'set' }, undefined);
            return;
          }
          const d = fromInputValue(v, mode);
          onChange({ type: 'set' }, d);
        }}
        style={{
          padding: 12,
          fontSize: 16,
          borderRadius: 10,
          border: '1px solid #cbd5e1',
          backgroundColor: '#f8fafc',
          color: '#0f172a',
          width: '100%',
          fontFamily: 'inherit',
          outline: 'none',
          appearance: 'none',
          boxSizing: 'border-box',
          marginBottom: 8,
          ...(style || {}),
        }}
      />
    );
  }

  // MOBILE : bottom sheet Modal avec picker natif
  const [NativePicker, setNativePicker] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date | undefined>(value ?? undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!NativePicker) {
      try {
        const mod = require('@react-native-community/datetimepicker');
        setNativePicker(() => mod.default);
      } catch (e) {
        console.warn('[WebDatePicker] DateTimePicker natif indisponible', e);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (value) setTempDate(value);
  }, [value]);

  const handleConfirm = () => {
    setShow(false);
    if (tempDate) onChange({ type: 'set' }, tempDate);
  };

  const handleCancel = () => {
    setShow(false);
    setTempDate(value ?? undefined);
  };

  if (loading) {
    return (
      <View style={[styles.button, style, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="small" color="#64748b" />
      </View>
    );
  }

  if (!NativePicker) {
    return (
      <TouchableOpacity
        style={[styles.button, style]}
        onPress={() => Alert.alert('Indisponible', 'Le selecteur de date nest pas disponible sur cet appareil.')}
      >
        <Text style={styles.buttonText}>
          {value ? formatDate(value, mode) : placeholder || 'Selectionner'}
        </Text>
      </TouchableOpacity>
    );
  }

  const iosDisplay = display ?? 'spinner';

  return (
    <View>
      <TouchableOpacity
        onPress={() => { setTempDate(value ?? new Date()); setShow(true); }}
        style={[styles.button, style]}
        activeOpacity={0.7}
      >
        <View style={styles.buttonContent}>
          <Text style={styles.buttonIcon}>
            {mode === 'time' ? '🕐' : mode === 'datetime' ? '📅' : '🗓️'}
          </Text>
          <Text style={styles.buttonText}>
            {value
              ? formatDate(value, mode)
              : placeholder || (mode === 'time' ? 'Selectionner lheure' : 'Selectionner la date')}
          </Text>
        </View>
      </TouchableOpacity>

      <Modal visible={show} transparent animationType="slide" onRequestClose={handleCancel}>
        <View style={modalStyles.overlay}>
          <TouchableOpacity style={modalStyles.overlayTouchable} activeOpacity={1} onPress={handleCancel} />
          <View style={modalStyles.sheet}>
            <View style={modalStyles.header}>
              <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={modalStyles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <Text style={modalStyles.title}>
                {label || (mode === 'time' ? 'Choisir lheure' : mode === 'datetime' ? 'Date et heure' : 'Choisir la date')}
              </Text>
              <TouchableOpacity onPress={handleConfirm} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={modalStyles.confirmText}>OK</Text>
              </TouchableOpacity>
            </View>

            {tempDate && (
              <View style={modalStyles.previewContainer}>
                <Text style={modalStyles.previewText}>
                  {formatDate(tempDate, mode)}
                </Text>
              </View>
            )}

            <View style={modalStyles.pickerContainer}>
              <NativePicker
                value={tempDate || value || new Date()}
                mode={mode}
                display={iosDisplay}
                locale="fr-FR"
                is24Hour={is24Hour}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                textColor="#0f172a"
                accentColor="#2563eb"
                themeVariant="light"
                onChange={(event: any, d?: Date) => {
                  if (Platform.OS === 'android') {
                    if (event.type === 'set' && d) {
                      setTempDate(d);
                      setShow(false);
                      onChange(event, d);
                    } else if (event.type === 'dismissed') {
                      setShow(false);
                    }
                    return;
                  }
                  if (d) setTempDate(d);
                }}
              />
            </View>

            {Platform.OS === 'ios' && (
              <TouchableOpacity style={modalStyles.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
                <Text style={modalStyles.confirmBtnText}>Confirmer</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#f8fafc',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    minHeight: 50,
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonIcon: {
    fontSize: 18,
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 1,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  overlayTouchable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  cancelText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '700',
  },
  previewContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 10,
  },
  previewText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  pickerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  confirmBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
