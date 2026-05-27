// src/screens/AppointmentScreen.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, FlatList 
} from 'react-native';
import { supabase } from '../lib/supabase';

const TYPES = ['Counseling', 'Confession', 'Suivi spirituel', 'Prière', 'Autre'];

export default function AppointmentScreen({ onBack }: { onBack: () => void }) {
  // Navigation interne (Onglets)
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');

  // États globaux
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  
  // États de Réservation
  const [submitting, setSubmitting] = useState(false);
  const [availabilities, setAvailabilities] = useState<any[]>([]);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  
  // États du Formulaire
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState(TYPES[0]);
  const [note, setNote] = useState('');

  // 🔄 Écouteur de changement d'onglet
  useEffect(() => {
    if (activeTab === 'NEW') {
      fetchAvailabilities();
    } else {
      fetchHistory();
    }
  }, [activeTab]);

  // ==========================================
  // LOGIQUE DE L'HISTORIQUE
  // ==========================================
  async function fetchHistory() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('pastoral_appointments')
      .select('*')
      .eq('member_id', user?.id)
      .order('created_at', { ascending: false });
    
    setAppointments(data || []);
    setLoading(false);
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PENDING': return { color: '#f59e0b', bg: '#fef3c7', label: 'En attente' };
      case 'APPROVED': return { color: '#10b981', bg: '#d1fae5', label: 'Confirmé' };
      case 'REJECTED': return { color: '#ef4444', bg: '#fee2e2', label: 'Annulé' };
      case 'COMPLETED': return { color: '#6366f1', bg: '#e0e7ff', label: 'Terminé' };
      default: return { color: '#64748b', bg: '#f1f5f9', label: status };
    }
  };

  // ==========================================
  // LOGIQUE DE RÉSERVATION
  // ==========================================
  async function fetchAvailabilities() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    // CORRECTION : On cherche l'église du membre dans church_members, pas dans user_roles
    const { data: member } = await supabase.from('church_members').select('church_id').eq('user_id', user?.id).single();

    if (member?.church_id) {
      const { data } = await supabase
        .from('pastoral_availabilities')
        .select('*')
        .eq('church_id', member.church_id)
        .eq('is_active', true);
      
      setAvailabilities(data || []);
      generateNextDates(data || []);
    }
    setLoading(false);
  }

  function generateNextDates(avails: any[]) {
    if (!avails || avails.length === 0) return;
    
    let dates: Date[] = [];
    let today = new Date();
    const activeDays = avails.map(a => a.day_of_week);

    for (let i = 1; i <= 21; i++) {
      let d = new Date(today);
      d.setDate(today.getDate() + i);
      if (activeDays.includes(d.getDay())) {
        dates.push(d);
      }
    }
    setAvailableDates(dates);
  }

  function handleSelectDate(date: Date) {
    setSelectedDate(date);
    setSelectedTime(null);
    const dayOfWeek = date.getDay();
    const config = availabilities.find(a => a.day_of_week === dayOfWeek);
    
    if (config) {
      const slots = [];
      let [sH, sM] = config.start_time.split(':').map(Number);
      let [eH, eM] = config.end_time.split(':').map(Number);
      
      let currentMins = sH * 60 + sM;
      let endMins = eH * 60 + eM;
      const duration = config.slot_duration_minutes || 30;

      while (currentMins + duration <= endMins) {
        let h = Math.floor(currentMins / 60).toString().padStart(2, '0');
        let m = (currentMins % 60).toString().padStart(2, '0');
        slots.push(`${h}:${m}`);
        currentMins += duration;
      }
      setTimeSlots(slots);
    }
  }

  async function handleSubmit() {
    if (!selectedDate || !selectedTime) {
      return Alert.alert('Erreur', 'Veuillez choisir une date et une heure.');
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // CORRECTION : On utilise l'ID de l'église du membre
      const { data: member } = await supabase.from('church_members').select('church_id').eq('user_id', user?.id).single();

      if (!member?.church_id) {
        throw new Error("Impossible d'identifier votre église.");
      }

      const dateStr = selectedDate.toISOString().split('T')[0];

      const { error } = await supabase.from('pastoral_appointments').insert({
        church_id: member.church_id,
        member_id: user?.id,
        appointment_date: dateStr,
        appointment_time: selectedTime,
        type: selectedType,
        member_note: note,
        status: 'PENDING'
      });

      if (error) throw error;

      Alert.alert('Succès', 'Votre demande de rendez-vous a été envoyée.');
      
      // On réinitialise le formulaire et on bascule sur l'onglet Historique
      setSelectedDate(null);
      setSelectedTime(null);
      setNote('');
      setActiveTab('HISTORY');

    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ==========================================
  // RENDU VISUEL
  // ==========================================
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>⬅ Accueil</Text></TouchableOpacity>
          <Text style={styles.headerTitle}>Rendez-vous</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* ONGLETS UNIFIÉS */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'NEW' && styles.tabActive]} 
            onPress={() => setActiveTab('NEW')}
          >
            <Text style={[styles.tabText, activeTab === 'NEW' && styles.tabTextActive]}>Prendre RDV</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'HISTORY' && styles.tabActive]} 
            onPress={() => setActiveTab('HISTORY')}
          >
            <Text style={[styles.tabText, activeTab === 'HISTORY' && styles.tabTextActive]}>Mon Historique</Text>
          </TouchableOpacity>
        </View>

        {/* CHARGEMENT GLOBAL */}
        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#0f172a" /></View>
        ) : activeTab === 'NEW' ? (
          
          /* ONGLET 1 : FORMULAIRE DE NOUVEAU RDV */
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {availabilities.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>📅</Text>
                <Text style={styles.emptyTitle}>Agenda indisponible</Text>
                <Text style={styles.emptyDesc}>Le bureau pastoral n'a pas encore configuré ses jours de réception. Veuillez réessayer plus tard.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.label}>1. Choisissez une date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                  {availableDates.map((d, index) => {
                    const isSelected = selectedDate?.toDateString() === d.toDateString();
                    const days = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
                    return (
                      <TouchableOpacity 
                        key={index} 
                        style={[styles.dateCard, isSelected && styles.dateCardActive]}
                        onPress={() => handleSelectDate(d)}
                      >
                        <Text style={[styles.dateDay, isSelected && styles.textWhite]}>{days[d.getDay()]}</Text>
                        <Text style={[styles.dateNum, isSelected && styles.textWhite]}>{d.getDate()}</Text>
                        <Text style={[styles.dateMonth, isSelected && styles.textWhite]}>
                          {d.toLocaleDateString('fr-FR', { month: 'short' })}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>

                {selectedDate && (
                  <>
                    <Text style={styles.label}>2. Choisissez l'heure</Text>
                    <View style={styles.tagsContainer}>
                      {timeSlots.map(time => (
                        <TouchableOpacity 
                          key={time} 
                          style={[styles.timeTag, selectedTime === time && styles.timeTagActive]}
                          onPress={() => setSelectedTime(time)}
                        >
                          <Text style={[styles.timeText, selectedTime === time && styles.textWhite]}>{time}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.label}>3. Motif du RDV</Text>
                    <View style={styles.tagsContainer}>
                      {TYPES.map(t => (
                        <TouchableOpacity 
                          key={t} 
                          style={[styles.typeTag, selectedType === t && styles.typeTagActive]}
                          onPress={() => setSelectedType(t)}
                        >
                          <Text style={[styles.typeText, selectedType === t && styles.textWhite]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.label}>4. Message pour le pasteur (Optionnel)</Text>
                    <TextInput 
                      style={styles.inputArea} 
                      placeholder="Expliquez brièvement votre besoin..." 
                      multiline 
                      value={note}
                      onChangeText={setNote}
                    />

                    <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                      {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Confirmer le RDV</Text>}
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </ScrollView>

        ) : (

          /* ONGLET 2 : HISTORIQUE DES RDV */
          <FlatList
            data={appointments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Vous n'avez pas encore de demandes.</Text>
            }
            renderItem={({ item }) => {
              const style = getStatusStyle(item.status);
              return (
                <View style={styles.historyCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.typeText}>{item.type}</Text>
                    <View style={[styles.badge, { backgroundColor: style.bg }]}>
                      <Text style={[styles.badgeText, { color: style.color }]}>{style.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.historyDate}>
                    📅 {new Date(item.appointment_date).toLocaleDateString('fr-FR')} à {item.appointment_time.slice(0, 5)}
                  </Text>

                  {item.status === 'REJECTED' && item.pastor_note && (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteTitle}>Motif du refus :</Text>
                      <Text style={styles.noteBody}>{item.pastor_note}</Text>
                    </View>
                  )}

                  {item.status === 'APPROVED' && (
                    <Text style={styles.successNote}>Le pasteur vous attend à l'heure convenue.</Text>
                  )}
                </View>
              );
            }}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  backBtn: { color: '#64748b', fontWeight: 'bold' },
  
  // Onglets
  tabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#0f172a', fontWeight: 'bold' },

  // Historique
  historyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  historyDate: { fontSize: 13, color: '#64748b' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  noteBox: { marginTop: 12, padding: 10, backgroundColor: '#fff1f2', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  noteTitle: { fontSize: 11, fontWeight: 'bold', color: '#991b1b', marginBottom: 2 },
  noteBody: { fontSize: 12, color: '#b91c1c', fontStyle: 'italic' },
  successNote: { marginTop: 10, fontSize: 12, color: '#10b981', fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8', fontStyle: 'italic' },

  // Formulaire
  emptyState: { alignItems: 'center', backgroundColor: '#fff', padding: 30, borderRadius: 16, marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 5 },
  emptyDesc: { textAlign: 'center', color: '#64748b', lineHeight: 22 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#334155', marginTop: 25, marginBottom: 10 },
  horizontalScroll: { flexDirection: 'row', paddingBottom: 10 },
  dateCard: { backgroundColor: '#fff', padding: 15, borderRadius: 16, alignItems: 'center', marginRight: 10, width: 70, borderWidth: 1, borderColor: '#e2e8f0' },
  dateCardActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  dateDay: { fontSize: 10, fontWeight: 'bold', color: '#64748b', marginBottom: 5 },
  dateNum: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  dateMonth: { fontSize: 10, color: '#64748b', marginTop: 2 },
  textWhite: { color: '#fff' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeTag: { backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  timeTagActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  timeText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  typeTag: { backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  typeTagActive: { backgroundColor: '#0f172a' },
  typeText: { fontSize: 13, fontWeight: '500', color: '#64748b' },
  inputArea: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, height: 100, textAlignVertical: 'top', color: '#0f172a' },
  submitBtn: { backgroundColor: '#0f172a', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 30 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});