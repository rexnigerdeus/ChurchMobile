// src/components/WebDatePicker.tsx
// Drop-in replacement cross-platform pour @react-native-community/datetimepicker.
// En web → utilise le <input type="date"> / <input type="time"> natif du navigateur.
// En mobile → délègue au DateTimePicker natif via un wrapper Modal.

import React, { useState } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';

interface WebDatePickerProps {
  value?: Date | null;
  mode?: 'date' | 'time' | 'datetime';
  display?: 'default' | 'spinner' | 'calendar' | 'clock';
  onChange: (event: any, selectedDate?: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  style?: any;
  // Accepte (et ignore) les props supplémentaires du DateTimePicker natif
  // comme `locale` ou `is24Hour` pour ne pas casser les appels existants.
  locale?: string;
  is24Hour?: boolean;
  [key: string]: any;
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
  // date
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
}: WebDatePickerProps) {
  // Web : input natif
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
        // petit style inline pour ressembler au reste
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

  // Mobile : wrapper Modal autour du DateTimePicker natif via require dynamique
  // pour éviter l'erreur d'import sur web lors du build.
  const [NativePicker, setNativePicker] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date | undefined>(value ?? undefined);

  React.useEffect(() => {
    if (!NativePicker) {
      try {
        // require dynamique pour ne pas casser le build web
        const mod = require('@react-native-community/datetimepicker');
        setNativePicker(() => mod.default);
      } catch (e) {
        console.warn('[WebDatePicker] DateTimePicker natif indisponible', e);
      }
    }
  }, []);

  if (!NativePicker) return null;

  return (
    <View>
      <TouchableOpacity
        onPress={() => { setTempDate(value ?? new Date()); setShow(true); }}
        style={[styles.button, style]}
      >
        <Text style={styles.buttonText}>
          {value
            ? mode === 'time'
              ? value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : value.toLocaleDateString('fr-FR') + (mode === 'datetime' ? ' ' + value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')
            : placeholder || (mode === 'time' ? 'Sélectionner l’heure' : 'Sélectionner la date')}
        </Text>
      </TouchableOpacity>

      <Modal visible={show} transparent animationType="slide">
        <View style={modalStyles.overlay}>
          <View style={modalStyles.sheet}>
            <View style={modalStyles.header}>
              <TouchableOpacity onPress={() => setShow(false)}><Text style={modalStyles.action}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setShow(false); if (tempDate) onChange({ type: 'set' }, tempDate); }}><Text style={modalStyles.action}>OK</Text></TouchableOpacity>
            </View>
            <NativePicker
              value={tempDate || value || new Date()}
              mode={mode}
              display={display ?? 'default'}
              onChange={(event: any, d?: Date) => {
                if (Platform.OS === 'android') {
                  setShow(false);
                  onChange(event, d);
                  return;
                }
                // iOS: onChange may be called repeatedly while spinning — keep a temp value
                if (d) setTempDate(d);
              }}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  buttonText: { color: '#0f172a', fontSize: 16, fontWeight: '500' },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  action: { color: '#2563eb', fontWeight: '600', paddingHorizontal: 8 },
});
