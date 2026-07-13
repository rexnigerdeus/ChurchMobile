// src/screens/AppointmentScreen.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, FlatList
} from 'react-native';
import { supabase } from '../lib/supabase';

// 🔴 CORRECTIF : "Counseling" → "Conseil" pour la cohérence linguistique française
const TYPES = ['Conseil', 'Confession', 'Suivi spirituel', 'Prière', 'Autre'];

// ---------- Types ----------
type Pastor = {
  id: string;            // user_id du pasteur (null → pasteur principal = 'PRINCIPAL')
  name: string;          // "Pasteur Principal" si null
  role: 'CHURCH_LEADER' | 'ASSISTANT_PASTOR';
};

// On étend la disponibilité lue côté Supabase avec le pastor_id déjà présent en BDD
type Availability = {
  id: string;
  church_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
  pastor_id: string | null; // null = pasteur principal
};

// Étapes du parcours de prise de RDV
type BookingStep = 'PASTOR' | 'DATE' | 'TIME' | 'DETAILS';

export default function AppointmentScreen({ onBack }: { onBack: () => void }) {
  // Navigation interne (Onglets)
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');

  // États globaux
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [churchId, setChurchId] = useState<string | null>(null);

  // Liste des pasteurs de l'église (principal + adjoints)
  const [pastors, setPastors] = useState<Pastor[]>([]);

  // Toutes les disponibilités de l'église, regroupées par pasteur côté UI
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);

  // Formulaire
  const [selectedPastor, setSelectedPastor] = useState<Pastor | null>(null);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState(TYPES[0]);
  const [note, setNote] = useState('');

  const [step, setStep] = useState<BookingStep>('PASTOR');
  const [submitting, setSubmitting] = useState(false);

  // 🆕 Map pastor_id → name pour l'affichage de l'historique
  const [pastorNames, setPastorNames] = useState<Record<string, string>>({});
  // 🆕 Nom du pasteur principal de l'église (pour les RDV pastor_id IS NULL)
  const [principalPastorName, setPrincipalPastorName] = useState<string>('Pasteur Principal');

  // 🔄 Écouteur de changement d'onglet
  useEffect(() => {
    if (activeTab === 'NEW') {
      fetchBookingData();
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

    // Charge les noms des pasteurs présents dans l'historique (pour affichage)
    // Cas particulier : on veut aussi pouvoir afficher le nom du pasteur
    // principal (pour les RDV dont pastor_id IS NULL). On récupère donc
    // le CHURCH_LEADER de l'église en complément.
    const pastorIds = Array.from(
      new Set((data || []).map((a: any) => a.pastor_id).filter(Boolean))
    ) as string[];
    if (pastorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', pastorIds);
      const map: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { map[p.id] = p.full_name; });
      setPastorNames(map);
    } else {
      setPastorNames({});
    }

    // Récupère le nom du pasteur principal de l'église du fidèle
    // pour pouvoir l'afficher dans l'historique des RDV pastoraux.
    const { data: member } = await supabase
      .from('church_members')
      .select('church_id')
      .eq('user_id', user?.id)
      .single();
    if (member?.church_id) {
      const { data: leaderRole } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('entity_id', member.church_id)
        .eq('role', 'CHURCH_LEADER')
        .limit(1)
        .maybeSingle();
      if (leaderRole?.user_id) {
        const { data: leaderProfile } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', leaderRole.user_id)
          .maybeSingle();
        if (leaderProfile?.full_name) {
          setPrincipalPastorName(leaderProfile.full_name);
        } else {
          setPrincipalPastorName('Pasteur Principal');
        }
      } else {
        setPrincipalPastorName('Pasteur Principal');
      }
    } else {
      setPrincipalPastorName('Pasteur Principal');
    }

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
  async function fetchBookingData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Vous devez être connecté.");

      // 1. Récupère l'église du membre
      const { data: member, error: mErr } = await supabase
        .from('church_members')
        .select('church_id')
        .eq('user_id', user.id)
        .single();
      if (mErr) throw mErr;
      if (!member?.church_id) throw new Error("Impossible d'identifier votre église.");
      setChurchId(member.church_id);

      // 2. Charge les pasteurs de l'église (CHURCH_LEADER + ASSISTANT_PASTOR)
      //    On distingue bien le pasteur principal (1er CHURCH_LEADER) des adjoints.
      const { data: roles, error: rErr } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('entity_id', member.church_id)
        .in('role', ['CHURCH_LEADER', 'ASSISTANT_PASTOR']);
      if (rErr) throw rErr;

      const leaderRoles = (roles || []).filter((r: any) => r.role === 'CHURCH_LEADER');
      const assistantRoles = (roles || []).filter((r: any) => r.role === 'ASSISTANT_PASTOR');

      // Récupère les profils de TOUS les pasteurs (principal + adjoints)
      // pour afficher leurs vrais noms (ex: "Pasteur Kouassi").
      const allPastorIds = [...leaderRoles, ...assistantRoles].map((r: any) => r.user_id);
      let profiles: any[] = [];
      if (allPastorIds.length > 0) {
        const { data: p } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', allPastorIds);
        profiles = p || [];
      }
      const nameById: Record<string, string> = {};
      profiles.forEach((p) => { nameById[p.id] = p.full_name; });

      // Construire la liste : pasteur principal d'abord (id = 'PRINCIPAL'),
      // puis les adjoints triés alphabétiquement.
      const pastorsList: Pastor[] = [];
      // Le premier CHURCH_LEADER trouvé est le pasteur principal.
      const principalRole = leaderRoles[0];
      pastorsList.push({
        id: 'PRINCIPAL',
        name: principalRole ? (nameById[principalRole.user_id] || 'Pasteur Principal') : 'Pasteur Principal',
        role: 'CHURCH_LEADER',
      });
      // Si d'autres CHURCH_LEADER existent, on les affiche comme adjoints.
      leaderRoles.slice(1)
        .map((r: any) => ({
          id: r.user_id as string,
          name: nameById[r.user_id] || 'Pasteur',
          role: 'ASSISTANT_PASTOR' as const,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
        .forEach((p) => pastorsList.push(p));
      assistantRoles
        .map((r: any) => ({
          id: r.user_id as string,
          name: nameById[r.user_id] || 'Pasteur adjoint',
          role: 'ASSISTANT_PASTOR' as const,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
        .forEach((p) => pastorsList.push(p));
      setPastors(pastorsList);

      // 3. Charge toutes les disponibilités de l'église (avec leur pastor_id)
      const { data: avs, error: aErr } = await supabase
        .from('pastoral_availabilities')
        .select('*')
        .eq('church_id', member.church_id)
        .eq('is_active', true);
      if (aErr) throw aErr;
      setAvailabilities(avs || []);
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setLoading(false);
    }
  }

  // Availabilities filtrées pour le pasteur sélectionné
  const pastorAvailabilities = useMemo(() => {
    if (!selectedPastor) return [];
    return availabilities.filter((a) => {
      if (selectedPastor.id === 'PRINCIPAL') return a.pastor_id == null;
      return a.pastor_id === selectedPastor.id;
    });
  }, [availabilities, selectedPastor]);

  // À chaque changement de pasteur : (re)calcule la liste de dates
  useEffect(() => {
    if (selectedPastor) {
      generateNextDates(pastorAvailabilities);
    } else {
      setAvailableDates([]);
    }
    // On reset la sélection de date/heure si on change de pasteur
    setSelectedDate(null);
    setSelectedTime(null);
    setTimeSlots([]);
  }, [selectedPastor, pastorAvailabilities]);

  function generateNextDates(avails: Availability[]) {
    if (!avails || avails.length === 0) {
      setAvailableDates([]);
      return;
    }
    const dates: Date[] = [];
    const today = new Date();
    const activeDays = avails.map((a) => a.day_of_week);

    for (let i = 1; i <= 21; i++) {
      const d = new Date(today);
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
    const config = pastorAvailabilities.find((a) => a.day_of_week === dayOfWeek);

    if (config) {
      const slots: string[] = [];
      const [sH, sM] = config.start_time.split(':').map(Number);
      const [eH, eM] = config.end_time.split(':').map(Number);

      let currentMins = sH * 60 + sM;
      const endMins = eH * 60 + eM;
      const duration = config.slot_duration_minutes || 30;

      while (currentMins + duration <= endMins) {
        const h = Math.floor(currentMins / 60).toString().padStart(2, '0');
        const m = (currentMins % 60).toString().padStart(2, '0');
        slots.push(`${h}:${m}`);
        currentMins += duration;
      }
      setTimeSlots(slots);
    } else {
      setTimeSlots([]);
    }
  }

  async function handleSubmit() {
    if (!selectedDate || !selectedTime || !selectedPastor || !churchId) {
      return Alert.alert('Erreur', 'Veuillez compléter toutes les étapes.');
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié.');

      const dateStr = selectedDate.toISOString().split('T')[0];

      // pastor_id = null pour le pasteur principal, sinon l'user_id de l'adjoint
      const pastorIdForDb = selectedPastor.id === 'PRINCIPAL' ? null : selectedPastor.id;

      const { error } = await supabase.from('pastoral_appointments').insert({
        church_id: churchId,
        member_id: user.id,
        appointment_date: dateStr,
        appointment_time: selectedTime,
        type: selectedType,
        member_note: note,
        status: 'PENDING',
        pastor_id: pastorIdForDb,
      });

      if (error) throw error;

      Alert.alert(
        'Succès',
        `Votre demande de rendez-vous avec ${selectedPastor.name} a été envoyée.`
      );

      // Reset complet du parcours
      setSelectedPastor(null);
      setSelectedDate(null);
      setSelectedTime(null);
      setNote('');
      setStep('PASTOR');
      setActiveTab('HISTORY');
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Petite aide : nom affiché d'un pastor_id (pour l'historique)
  function getPastorLabel(pastorId: string | null) {
    if (pastorId == null) return principalPastorName;
    return pastorNames[pastorId] || 'Pasteur';
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
            onPress={() => { setActiveTab('NEW'); setStep('PASTOR'); }}
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
            {pastors.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>🧑‍⚖️</Text>
                <Text style={styles.emptyTitle}>Aucun pasteur disponible</Text>
                <Text style={styles.emptyDesc}>
                  Votre église n'a pas encore enregistré de pasteur pour prendre des rendez-vous.
                </Text>
              </View>
            ) : (
              <>
                {/* ÉTAPE 0 : CHOIX DU PASTEUR */}
                <Text style={styles.label}>1. Avec quel pasteur souhaitez-vous échanger ?</Text>
                <View style={styles.pastorList}>
                  {pastors.map((p) => {
                    const isSelected = selectedPastor?.id === p.id;
                    const isPrincipal = p.id === 'PRINCIPAL';
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.pastorCard, isSelected && styles.pastorCardActive]}
                        onPress={() => {
                          setSelectedPastor(p);
                          setStep('DATE');
                        }}
                      >
                        <View style={styles.pastorAvatar}>
                          <Text style={styles.pastorAvatarText}>
                            {isPrincipal ? '✝️' : p.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.pastorName, isSelected && styles.textWhite]}>
                            {p.name}
                          </Text>
                          <Text style={[styles.pastorRole, isSelected && styles.pastorRoleActive]}>
                            {isPrincipal ? 'Pasteur principal' : 'Pasteur adjoint'}
                          </Text>
                        </View>
                        {isSelected && <Text style={styles.pastorCheck}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Si pas encore de pasteur sélectionné → on s'arrête là */}
                {!selectedPastor && (
                  <Text style={styles.helperText}>
                    Sélectionnez un pasteur pour voir ses créneaux disponibles.
                  </Text>
                )}

                {/* ÉTAPE 1 : DATE */}
                {selectedPastor && (
                  <>
                    {pastorAvailabilities.length === 0 ? (
                      <View style={styles.emptyState}>
                        <Text style={{ fontSize: 40, marginBottom: 10 }}>📅</Text>
                        <Text style={styles.emptyTitle}>Aucun créneau défini</Text>
                        <Text style={styles.emptyDesc}>
                          {selectedPastor.name} n'a pas encore renseigné ses disponibilités.
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.label}>2. Choisissez une date</Text>
                        {availableDates.length === 0 ? (
                          <Text style={styles.helperText}>
                            Aucun créneau disponible dans les 3 prochaines semaines pour ce pasteur.
                          </Text>
                        ) : (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                            {availableDates.map((d, index) => {
                              const isSelected = selectedDate?.toDateString() === d.toDateString();
                              const days = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
                              return (
                                <TouchableOpacity
                                  key={index}
                                  style={[styles.dateCard, isSelected && styles.dateCardActive]}
                                  onPress={() => {
                                    handleSelectDate(d);
                                    setStep('TIME');
                                  }}
                                >
                                  <Text style={[styles.dateDay, isSelected && styles.textWhite]}>{days[d.getDay()]}</Text>
                                  <Text style={[styles.dateNum, isSelected && styles.textWhite]}>{d.getDate()}</Text>
                                  <Text style={[styles.dateMonth, isSelected && styles.textWhite]}>
                                    {d.toLocaleDateString('fr-FR', { month: 'short' })}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* ÉTAPE 2 : HEURE */}
                {selectedDate && (
                  <>
                    <Text style={styles.label}>3. Choisissez l'heure</Text>
                    {timeSlots.length === 0 ? (
                      <Text style={styles.helperText}>
                        Aucun horaire disponible pour cette date. Choisissez une autre date.
                      </Text>
                    ) : (
                      <View style={styles.tagsContainer}>
                        {timeSlots.map((time) => (
                          <TouchableOpacity
                            key={time}
                            style={[styles.timeTag, selectedTime === time && styles.timeTagActive]}
                            onPress={() => {
                              setSelectedTime(time);
                              setStep('DETAILS');
                            }}
                          >
                            <Text style={[styles.timeText, selectedTime === time && styles.textWhite]}>{time}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}

                {/* ÉTAPE 3 : MOTIF + NOTE + BOUTON */}
                {selectedTime && (
                  <>
                    <Text style={styles.label}>4. Motif du RDV</Text>
                    <View style={styles.tagsContainer}>
                      {TYPES.map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.typeTag, selectedType === t && styles.typeTagActive]}
                          onPress={() => setSelectedType(t)}
                        >
                          <Text style={[styles.typeText, selectedType === t && styles.textWhite]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.label}>5. Message pour le pasteur (Optionnel)</Text>
                    <TextInput
                      style={styles.inputArea}
                      placeholder="Expliquez brièvement votre besoin..."
                      multiline
                      value={note}
                      onChangeText={setNote}
                    />

                    <View style={styles.recapBox}>
                      <Text style={styles.recapTitle}>Récapitulatif</Text>
                      <Text style={styles.recapLine}>
                        <Text style={styles.recapLabel}>Pasteur : </Text>
                        {selectedPastor?.name}
                      </Text>
                      <Text style={styles.recapLine}>
                        <Text style={styles.recapLabel}>Date : </Text>
                        {selectedDate?.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </Text>
                      <Text style={styles.recapLine}>
                        <Text style={styles.recapLabel}>Heure : </Text>
                        {selectedTime}
                      </Text>
                    </View>

                    <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                      {submitting
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.submitBtnText}>Confirmer le RDV</Text>
                      }
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => {
                        setSelectedTime(null);
                        setStep('TIME');
                      }}
                    >
                      <Text style={styles.secondaryBtnText}>← Changer d'horaire</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Indicateur d'étape */}
                {selectedPastor && (
                  <View style={styles.stepIndicator}>
                    {['PASTOR', 'DATE', 'TIME', 'DETAILS'].map((s, i) => {
                      const order = ['PASTOR', 'DATE', 'TIME', 'DETAILS'];
                      const currentIdx = order.indexOf(step);
                      const thisIdx = i;
                      const isDone = thisIdx < currentIdx;
                      const isCurrent = thisIdx === currentIdx;
                      return (
                        <View
                          key={s}
                          style={[
                            styles.stepDot,
                            (isDone || isCurrent) && styles.stepDotActive,
                            isCurrent && styles.stepDotCurrent,
                          ]}
                        />
                      );
                    })}
                  </View>
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
                    <View style={{ flex: 1 }}>
                      <Text style={styles.typeText}>{item.type}</Text>
                      <Text style={styles.pastorLine}>
                        👤 {getPastorLabel(item.pastor_id)}
                      </Text>
                    </View>
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
                    <Text style={styles.successNote}>
                      {getPastorLabel(item.pastor_id)} vous attend à l'heure convenue.
                    </Text>
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  historyDate: { fontSize: 13, color: '#64748b' },
  pastorLine: { fontSize: 12, color: '#475569', marginTop: 2, fontWeight: '500' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  noteBox: { marginTop: 12, padding: 10, backgroundColor: '#fff1f2', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  noteTitle: { fontSize: 11, fontWeight: 'bold', color: '#991b1b', marginBottom: 2 },
  noteBody: { fontSize: 12, color: '#b91c1c', fontStyle: 'italic' },
  successNote: { marginTop: 10, fontSize: 12, color: '#10b981', fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8', fontStyle: 'italic' },

  // Formulaire
  emptyState: { alignItems: 'center', backgroundColor: '#fff', padding: 30, borderRadius: 16, marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 5, textAlign: 'center' },
  emptyDesc: { textAlign: 'center', color: '#64748b', lineHeight: 22 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#334155', marginTop: 25, marginBottom: 10 },
  helperText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginTop: 8 },

  // Sélecteur de pasteur
  pastorList: { gap: 10 },
  pastorCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0',
  },
  pastorCardActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  pastorAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  pastorAvatarText: { fontSize: 20, fontWeight: 'bold', color: '#4338ca' },
  pastorName: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  pastorRole: { fontSize: 12, color: '#64748b', marginTop: 2 },
  pastorRoleActive: { color: '#cbd5e1' },
  pastorCheck: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },

  // Date picker
  horizontalScroll: { flexDirection: 'row', paddingBottom: 10 },
  dateCard: { backgroundColor: '#fff', padding: 15, borderRadius: 16, alignItems: 'center', marginRight: 10, width: 70, borderWidth: 1, borderColor: '#e2e8f0' },
  dateCardActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  dateDay: { fontSize: 10, fontWeight: 'bold', color: '#64748b', marginBottom: 5 },
  dateNum: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  dateMonth: { fontSize: 10, color: '#64748b', marginTop: 2 },
  textWhite: { color: '#fff' },

  // Time + type tags
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeTag: { backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  timeTagActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  timeText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  typeTag: { backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  typeTagActive: { backgroundColor: '#0f172a' },
  typeText: { fontSize: 13, fontWeight: '500', color: '#64748b' },

  // Note
  inputArea: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, height: 100, textAlignVertical: 'top', color: '#0f172a' },

  // Récapitulatif
  recapBox: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 14, marginTop: 24, borderWidth: 1, borderColor: '#e2e8f0' },
  recapTitle: { fontSize: 12, fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  recapLine: { fontSize: 14, color: '#0f172a', marginBottom: 4 },
  recapLabel: { fontWeight: '600', color: '#64748b' },

  // Boutons
  submitBtn: { backgroundColor: '#0f172a', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  secondaryBtn: { alignItems: 'center', marginTop: 12, padding: 10 },
  secondaryBtnText: { color: '#64748b', fontSize: 13, fontWeight: '600' },

  // Indicateur d'étape
  stepIndicator: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 30, gap: 8 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#cbd5e1' },
  stepDotActive: { backgroundColor: '#10b981' },
  stepDotCurrent: { width: 24, backgroundColor: '#0f172a' },
});
