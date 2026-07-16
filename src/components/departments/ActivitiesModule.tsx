// src/components/departments/ActivitiesModule.tsx
// Module générique pour les départements Femmes, Hommes et Jeunesse
// Gestion des activités, rencontres et réunions du département
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { supabase } from '../../lib/supabase';
import DateTimePicker from '../WebDatePicker';

interface ActivitiesModuleProps {
  deptId: string;
  isLeader: boolean;
  deptName: string;
}

export default function ActivitiesModule({ deptId, isLeader, deptName }: ActivitiesModuleProps) {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [dateObj, setDateObj] = useState<Date | undefined>(undefined);
  const [newMeeting, setNewMeeting] = useState({
    title: '', date: '', location: '', description: '', attendance: '',
  });

  useEffect(() => { loadMeetings(); }, [deptId]);

  async function loadMeetings() {
    setLoading(true);
    const { data, error } = await supabase
      .from('department_activities')
      .select('*')
      .eq('department_id', deptId)
      .order('activity_date', { ascending: false });
    if (error) console.warn('[ActivitiesModule] load error:', error.message);
    setMeetings(data || []);
    setLoading(false);
  }

  const handleAdd = async () => {
    if (!newMeeting.title.trim() || !newMeeting.date)
      return Alert.alert('Erreur', 'Titre et date sont obligatoires.');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('department_activities').insert({
      department_id: deptId,
      title: newMeeting.title.trim(),
      activity_date: newMeeting.date,
      location: newMeeting.location.trim() || null,
      description: newMeeting.description.trim() || null,
      attendance: parseInt(newMeeting.attendance) || null,
      created_by: user?.id,
    });
    if (error) return Alert.alert('Erreur', error.message);
    setIsAdding(false);
    setNewMeeting({ title: '', date: '', location: '', description: '', attendance: '' });
    setDateObj(undefined);
    loadMeetings();
  };

  const handleDelete = (m: any) => {
    if (!isLeader) return;
    Alert.alert('Supprimer', `Supprimer la rencontre « ${m.title} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('department_activities').delete().eq('id', m.id);
        loadMeetings();
      }},
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#14b8a6" /></View>;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.hubSubtitle}>Rencontres & Activités</Text>
        {isLeader && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setIsAdding(true)}>
            <Text style={styles.addBtnText}>+ Rencontre</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={meetings}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucune rencontre enregistrée pour {deptName}.</Text>}
        renderItem={({ item }) => {
          const d = new Date(item.activity_date);
          const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          return (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardDate}>🗓 {dateStr}</Text>
                  {item.location && <Text style={styles.cardInfo}>📍 {item.location}</Text>}
                  {item.description && <Text style={styles.cardInfo}>📝 {item.description}</Text>}
                  {item.attendance != null && <Text style={styles.cardInfo}>👥 Présence: {item.attendance}</Text>}
                </View>
                {isLeader && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      <Modal visible={isAdding} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
              <Text style={styles.modalTitle}>Nouvelle Rencontre</Text>
              <TextInput style={styles.input} placeholder="Titre (ex: Réunion mensuelle...)" value={newMeeting.title} onChangeText={v => setNewMeeting({ ...newMeeting, title: v })} />
              <Text style={styles.label}>Date de la rencontre</Text>
              <DateTimePicker value={dateObj} onChange={(d: Date) => {
                setDateObj(d);
                setNewMeeting({ ...newMeeting, date: d.toISOString() });
              }} />
              <TextInput style={styles.input} placeholder="Lieu" value={newMeeting.location} onChangeText={v => setNewMeeting({ ...newMeeting, location: v })} />
              <TextInput style={[styles.input, { height: 80 }]} placeholder="Description / Ordre du jour" value={newMeeting.description} onChangeText={v => setNewMeeting({ ...newMeeting, description: v })} multiline textAlignVertical="top" />
              <TextInput style={styles.input} placeholder="Présence estimée" value={newMeeting.attendance} onChangeText={v => setNewMeeting({ ...newMeeting, attendance: v })} keyboardType="numeric" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAdding(false)}>
                  <Text style={styles.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleAdd}>
                  <Text style={styles.confirmBtnText}>Enregistrer</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  hubSubtitle: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15, marginTop: 10 },
  addBtn: { backgroundColor: '#14b8a6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginHorizontal: 20, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  cardDate: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  cardInfo: { fontSize: 13, color: '#475569', marginTop: 6 },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#0f172a', textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 6 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontWeight: 'bold' },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#14b8a6', alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: 'bold' },
});