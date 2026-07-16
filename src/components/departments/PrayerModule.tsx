// src/components/departments/PrayerModule.tsx
// Module dédié au Département Intercession et Prière
// Gestion des requêtes de prière du département (distinct du pastoral global)
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { supabase } from '../../lib/supabase';

interface PrayerModuleProps {
  deptId: string;
  isLeader: boolean;
  activeMembers: any[];
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:  { label: 'En attente', color: '#f59e0b', bg: '#fef3c7' },
  PRAYING:  { label: 'En prière',  color: '#3b82f6', bg: '#dbeafe' },
  ANSWERED: { label: 'Exaucée',    color: '#16a34a', bg: '#dcfce7' },
};

export default function PrayerModule({ deptId, isLeader, activeMembers }: PrayerModuleProps) {
  const [prayers, setPrayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<string>('ALL');
  const [newPrayer, setNewPrayer] = useState({ subject: '', body: '', is_urgent: false, is_anonymous: false });

  useEffect(() => { loadPrayers(); }, [deptId]);

  async function loadPrayers() {
    setLoading(true);
    const { data, error } = await supabase
      .from('department_prayer_requests')
      .select('*')
      .eq('department_id', deptId)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[PrayerModule] load error:', error.message);
    }
    setPrayers(data || []);
    setLoading(false);
  }

  const handleAdd = async () => {
    if (!newPrayer.subject.trim() || !newPrayer.body.trim())
      return Alert.alert('Erreur', 'Sujet et description sont obligatoires.');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('department_prayer_requests').insert({
      department_id: deptId,
      member_id: user?.id,
      subject: newPrayer.subject.trim(),
      body: newPrayer.body.trim(),
      is_urgent: newPrayer.is_urgent,
      is_anonymous: newPrayer.is_anonymous,
    });
    if (error) return Alert.alert('Erreur', error.message);
    setIsAdding(false);
    setNewPrayer({ subject: '', body: '', is_urgent: false, is_anonymous: false });
    loadPrayers();
  };

  const cycleStatus = async (prayer: any) => {
    if (!isLeader) return;
    const next = prayer.status === 'PENDING' ? 'PRAYING' : prayer.status === 'PRAYING' ? 'ANSWERED' : 'PENDING';
    await supabase.from('department_prayer_requests').update({ status: next }).eq('id', prayer.id);
    loadPrayers();
  };

  const handleDelete = (prayer: any) => {
    if (!isLeader) return;
    Alert.alert('Supprimer', `Supprimer la requête « ${prayer.subject} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('department_prayer_requests').delete().eq('id', prayer.id);
        loadPrayers();
      }},
    ]);
  };

  const filtered = filter === 'ALL' ? prayers : prayers.filter(p => p.status === filter);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#6366f1" /></View>;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.hubSubtitle}>Requêtes de Prière</Text>
        {isLeader && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setIsAdding(true)}>
            <Text style={styles.addBtnText}>+ Requête</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <TouchableOpacity style={filter === 'ALL' ? styles.pillActive : styles.pill} onPress={() => setFilter('ALL')}>
          <Text style={filter === 'ALL' ? styles.pillActiveText : styles.pillText}>Toutes ({prayers.length})</Text>
        </TouchableOpacity>
        {Object.entries(STATUS_LABELS).map(([key, val]) => {
          const count = prayers.filter(p => p.status === key).length;
          return (
            <TouchableOpacity key={key} style={filter === key ? styles.pillActive : styles.pill} onPress={() => setFilter(key)}>
              <Text style={filter === key ? styles.pillActiveText : styles.pillText}>{val.label} ({count})</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucune requête de prière.</Text>}
        renderItem={({ item }) => {
          const st = STATUS_LABELS[item.status] || STATUS_LABELS.PENDING;
          return (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {item.is_urgent && <Text style={styles.urgentBadge}>🔥 URGENT</Text>}
                    <Text style={styles.cardTitle}>{item.subject}</Text>
                  </View>
                  <Text style={styles.cardDate}>🗓 {new Date(item.created_at).toLocaleDateString('fr-FR')}</Text>
                  <Text style={styles.cardBody}>{item.body}</Text>
                  {item.answer_notes && (
                    <Text style={styles.answerNotes}>✅ {item.answer_notes}</Text>
                  )}
                </View>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.statusBadge, { backgroundColor: st.bg }]}
                    onPress={() => cycleStatus(item)}
                  >
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                  </TouchableOpacity>
                  {isLeader && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                      <Text style={styles.deleteBtnText}>🗑</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Modale d'ajout */}
      <Modal visible={isAdding} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouvelle Requête de Prière</Text>
            <TextInput
              style={styles.input}
              placeholder="Sujet (ex: Guérison de...)"
              value={newPrayer.subject}
              onChangeText={v => setNewPrayer({ ...newPrayer, subject: v })}
            />
            <TextInput
              style={[styles.input, { height: 100 }]}
              placeholder="Détails de la requête..."
              value={newPrayer.body}
              onChangeText={v => setNewPrayer({ ...newPrayer, body: v })}
              multiline
              textAlignVertical="top"
            />
            <View style={{ flexDirection: 'row', gap: 10, marginVertical: 10 }}>
              <TouchableOpacity
                style={[styles.toggleBtn, newPrayer.is_urgent && { backgroundColor: '#ef4444' }]}
                onPress={() => setNewPrayer({ ...newPrayer, is_urgent: !newPrayer.is_urgent })}
              >
                <Text style={[styles.toggleText, newPrayer.is_urgent && { color: '#fff' }]}>🔥 Urgent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, newPrayer.is_anonymous && { backgroundColor: '#6366f1' }]}
                onPress={() => setNewPrayer({ ...newPrayer, is_anonymous: !newPrayer.is_anonymous })}
              >
                <Text style={[styles.toggleText, newPrayer.is_anonymous && { color: '#fff' }]}>🙈 Anonyme</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAdding(false)}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleAdd}>
                <Text style={styles.confirmBtnText}>Publier</Text>
              </TouchableOpacity>
            </View>
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
  addBtn: { backgroundColor: '#6366f1', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  filterRow: { paddingHorizontal: 20, marginBottom: 12, paddingBottom: 5 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8 },
  pillActive: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#6366f1', marginRight: 8 },
  pillText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  pillActiveText: { fontSize: 12, color: '#fff', fontWeight: 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginHorizontal: 20, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', flexShrink: 1 },
  cardDate: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  cardBody: { fontSize: 13, color: '#475569', marginTop: 8, lineHeight: 20 },
  answerNotes: { fontSize: 12, color: '#16a34a', marginTop: 8, fontStyle: 'italic' },
  urgentBadge: { backgroundColor: '#fee2e2', color: '#ef4444', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#0f172a', textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 10 },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontWeight: 'bold' },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#6366f1', alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: 'bold' },
});