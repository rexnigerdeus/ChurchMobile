// src/components/departments/FamilyModule.tsx
// Module dédié au Département de la Famille
// Suivi des foyers, accompagnement conjugal et activités familiales
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { supabase } from '../../lib/supabase';
import DateTimePicker from '../WebDatePicker';

interface FamilyModuleProps {
  deptId: string;
  isLeader: boolean;
}

const MARRIAGE_LABELS: Record<string, string> = {
  MARRIED: 'Marié(e)', ENGAGED: 'Fiancé(e)', COUNSELING: 'Suivi conjugal', SINGLE_PARENT: 'Parent célibataire',
};

const SPIRITUAL_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Actif', color: '#16a34a' },
  INACTIVE: { label: 'Inactif', color: '#94a3b8' },
  COUNSELING: { label: 'Suivi', color: '#f59e0b' },
  NEW: { label: 'Nouveau', color: '#3b82f6' },
};

export default function FamilyModule({ deptId, isLeader }: FamilyModuleProps) {
  const [families, setFamilies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [dateObj, setDateObj] = useState<Date | undefined>(undefined);
  const [newFamily, setNewFamily] = useState({
    family_name: '', spouse1_name: '', spouse2_name: '', spouse1_phone: '', spouse2_phone: '',
    marriage_date: '', marriage_status: 'MARRIED', children_count: '', address: '', spiritual_status: 'ACTIVE', notes: '',
  });

  useEffect(() => { loadFamilies(); }, [deptId]);

  async function loadFamilies() {
    setLoading(true);
    const { data, error } = await supabase
      .from('department_families')
      .select('*')
      .eq('department_id', deptId)
      .order('created_at', { ascending: false });
    if (error) console.warn('[FamilyModule] load error:', error.message);
    setFamilies(data || []);
    setLoading(false);
  }

  const handleAdd = async () => {
    if (!newFamily.family_name.trim())
      return Alert.alert('Erreur', 'Le nom de la famille est obligatoire.');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('department_families').insert({
      department_id: deptId,
      family_name: newFamily.family_name.trim(),
      spouse1_name: newFamily.spouse1_name.trim() || null,
      spouse2_name: newFamily.spouse2_name.trim() || null,
      spouse1_phone: newFamily.spouse1_phone.trim() || null,
      spouse2_phone: newFamily.spouse2_phone.trim() || null,
      marriage_date: newFamily.marriage_date || null,
      marriage_status: newFamily.marriage_status,
      children_count: parseInt(newFamily.children_count) || 0,
      address: newFamily.address.trim() || null,
      spiritual_status: newFamily.spiritual_status,
      notes: newFamily.notes.trim() || null,
      created_by: user?.id,
    });
    if (error) return Alert.alert('Erreur', error.message);
    setIsAdding(false);
    setNewFamily({ family_name: '', spouse1_name: '', spouse2_name: '', spouse1_phone: '', spouse2_phone: '', marriage_date: '', marriage_status: 'MARRIED', children_count: '', address: '', spiritual_status: 'ACTIVE', notes: '' });
    setDateObj(undefined);
    loadFamilies();
  };

  const cycleSpiritual = async (fam: any) => {
    if (!isLeader) return;
    const order = ['ACTIVE', 'NEW', 'COUNSELING', 'INACTIVE'];
    const idx = order.indexOf(fam.spiritual_status);
    const next = order[(idx + 1) % order.length];
    await supabase.from('department_families').update({ spiritual_status: next }).eq('id', fam.id);
    loadFamilies();
  };

  const handleDelete = (fam: any) => {
    if (!isLeader) return;
    Alert.alert('Supprimer', `Supprimer la famille « ${fam.family_name} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('department_families').delete().eq('id', fam.id);
        loadFamilies();
      }},
    ]);
  };

  const filtered = filter === 'ALL' ? families : families.filter(f => f.spiritual_status === filter);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#ec4899" /></View>;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.hubSubtitle}>Registre des Familles</Text>
        {isLeader && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setIsAdding(true)}>
            <Text style={styles.addBtnText}>+ Famille</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <TouchableOpacity style={filter === 'ALL' ? styles.pillActive : styles.pill} onPress={() => setFilter('ALL')}>
          <Text style={filter === 'ALL' ? styles.pillActiveText : styles.pillText}>Toutes ({families.length})</Text>
        </TouchableOpacity>
        {Object.entries(SPIRITUAL_LABELS).map(([key, val]) => {
          const count = families.filter(f => f.spiritual_status === key).length;
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
        ListEmptyComponent={<Text style={styles.emptyText}>Aucune famille enregistrée.</Text>}
        renderItem={({ item }) => {
          const sp = SPIRITUAL_LABELS[item.spiritual_status] || SPIRITUAL_LABELS.ACTIVE;
          return (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.cardName}>👨‍👩‍👧‍👦 {item.family_name}</Text>
                  <View style={[styles.marriageBadge, { backgroundColor: '#fce7f3' }]}>
                    <Text style={[styles.marriageText, { color: '#be185d' }]}>{MARRIAGE_LABELS[item.marriage_status] || item.marriage_status}</Text>
                  </View>
                  {item.spouse1_name && <Text style={styles.cardInfo}>👤 {item.spouse1_name}{item.spouse2_name ? ` & ${item.spouse2_name}` : ''}</Text>}
                  {item.spouse1_phone && <Text style={styles.cardInfo}>📞 {item.spouse1_phone}</Text>}
                  {item.marriage_date && <Text style={styles.cardInfo}>💍 Mariage: {new Date(item.marriage_date).toLocaleDateString('fr-FR')}</Text>}
                  {item.children_count > 0 && <Text style={styles.cardInfo}>👶 Enfants: {item.children_count}</Text>}
                  {item.address && <Text style={styles.cardInfo}>📍 {item.address}</Text>}
                  {item.notes && <Text style={styles.cardNotes}>📝 {item.notes}</Text>}
                </View>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.statusBadge, { backgroundColor: sp.color + '20' }]}
                    onPress={() => cycleSpiritual(item)}
                  >
                    <Text style={[styles.statusText, { color: sp.color }]}>{sp.label}</Text>
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

      <Modal visible={isAdding} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
              <Text style={styles.modalTitle}>Nouvelle Famille</Text>
              <TextInput style={styles.input} placeholder="Nom de la famille *" value={newFamily.family_name} onChangeText={v => setNewFamily({ ...newFamily, family_name: v })} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Conjoint 1" value={newFamily.spouse1_name} onChangeText={v => setNewFamily({ ...newFamily, spouse1_name: v })} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Conjoint 2" value={newFamily.spouse2_name} onChangeText={v => setNewFamily({ ...newFamily, spouse2_name: v })} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Tél. Conjoint 1" value={newFamily.spouse1_phone} onChangeText={v => setNewFamily({ ...newFamily, spouse1_phone: v })} keyboardType="phone-pad" />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Tél. Conjoint 2" value={newFamily.spouse2_phone} onChangeText={v => setNewFamily({ ...newFamily, spouse2_phone: v })} keyboardType="phone-pad" />
              </View>
              <Text style={styles.label}>Date du mariage</Text>
              <DateTimePicker value={dateObj} onChange={(d: Date) => {
                setDateObj(d);
                setNewFamily({ ...newFamily, marriage_date: d.toISOString().split('T')[0] });
              }} />
              <TextInput style={styles.input} placeholder="Nombre d'enfants" value={newFamily.children_count} onChangeText={v => setNewFamily({ ...newFamily, children_count: v })} keyboardType="numeric" />
              <TextInput style={styles.input} placeholder="Adresse" value={newFamily.address} onChangeText={v => setNewFamily({ ...newFamily, address: v })} multiline />
              <Text style={styles.label}>Statut matrimonial</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {Object.entries(MARRIAGE_LABELS).map(([key, label]) => (
                  <TouchableOpacity key={key} style={[styles.statusOption, newFamily.marriage_status === key && { backgroundColor: '#ec4899' }]} onPress={() => setNewFamily({ ...newFamily, marriage_status: key })}>
                    <Text style={[styles.statusOptionText, newFamily.marriage_status === key && { color: '#fff' }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>État spirituel</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {Object.entries(SPIRITUAL_LABELS).map(([key, val]) => (
                  <TouchableOpacity key={key} style={[styles.statusOption, newFamily.spiritual_status === key && { backgroundColor: val.color }]} onPress={() => setNewFamily({ ...newFamily, spiritual_status: key })}>
                    <Text style={[styles.statusOptionText, newFamily.spiritual_status === key && { color: '#fff' }]}>{val.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={[styles.input, { height: 70 }]} placeholder="Notes (suivi, observations...)" value={newFamily.notes} onChangeText={v => setNewFamily({ ...newFamily, notes: v })} multiline textAlignVertical="top" />
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
  addBtn: { backgroundColor: '#ec4899', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  filterRow: { paddingHorizontal: 20, marginBottom: 12, paddingBottom: 5 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8 },
  pillActive: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#ec4899', marginRight: 8 },
  pillText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  pillActiveText: { fontSize: 12, color: '#fff', fontWeight: 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginHorizontal: 20, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardName: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 6 },
  marriageBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6, overflow: 'hidden' },
  marriageText: { fontSize: 11, fontWeight: 'bold' },
  cardInfo: { fontSize: 13, color: '#475569', marginTop: 3 },
  cardNotes: { fontSize: 12, color: '#64748b', marginTop: 6, fontStyle: 'italic' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#0f172a', textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 6 },
  statusOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9' },
  statusOptionText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontWeight: 'bold' },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#ec4899', alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: 'bold' },
});