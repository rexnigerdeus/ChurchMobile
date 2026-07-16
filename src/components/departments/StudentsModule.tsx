// src/components/departments/StudentsModule.tsx
// Module dédié au Département des Élèves, Étudiants et Insertion professionnelle
// Suivi scolaire, académique et accompagnement à l'insertion pro
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { supabase } from '../../lib/supabase';

interface StudentsModuleProps {
  deptId: string;
  isLeader: boolean;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  STUDENT:    { label: 'Étudiant',     color: '#3b82f6' },
  GRADUATE:   { label: 'Diplômé',      color: '#8b5cf6' },
  JOB_SEEKER:{ label: 'En recherche',  color: '#f59e0b' },
  EMPLOYED:   { label: 'Employé',     color: '#16a34a' },
};

const INSERTION_LABELS: Record<string, string> = {
  NONE: 'Aucune', INTERNSHIP: 'Stage', EMPLOYED: 'Employé', MENTORED: 'Mentoré',
};

export default function StudentsModule({ deptId, isLeader }: StudentsModuleProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [newStudent, setNewStudent] = useState({
    first_name: '', last_name: '', level: '', school_name: '', field_of_study: '',
    academic_year: '', status: 'STUDENT', phone: '',
  });

  useEffect(() => { loadStudents(); }, [deptId]);

  async function loadStudents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('department_students')
      .select('*')
      .eq('department_id', deptId)
      .order('created_at', { ascending: false });
    if (error) console.warn('[StudentsModule] load error:', error.message);
    setStudents(data || []);
    setLoading(false);
  }

  const handleAdd = async () => {
    if (!newStudent.first_name.trim() || !newStudent.last_name.trim())
      return Alert.alert('Erreur', 'Nom et prénom sont obligatoires.');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('department_students').insert({
      department_id: deptId,
      first_name: newStudent.first_name.trim(),
      last_name: newStudent.last_name.trim(),
      level: newStudent.level.trim() || null,
      school_name: newStudent.school_name.trim() || null,
      field_of_study: newStudent.field_of_study.trim() || null,
      academic_year: newStudent.academic_year.trim() || null,
      status: newStudent.status,
      phone: newStudent.phone.trim() || null,
      created_by: user?.id,
    });
    if (error) return Alert.alert('Erreur', error.message);
    setIsAdding(false);
    setNewStudent({ first_name: '', last_name: '', level: '', school_name: '', field_of_study: '', academic_year: '', status: 'STUDENT', phone: '' });
    loadStudents();
  };

  const cycleStatus = async (student: any) => {
    if (!isLeader) return;
    const order = ['STUDENT', 'GRADUATE', 'JOB_SEEKER', 'EMPLOYED'];
    const idx = order.indexOf(student.status);
    const next = order[(idx + 1) % order.length];
    await supabase.from('department_students').update({ status: next }).eq('id', student.id);
    loadStudents();
  };

  const handleDelete = (student: any) => {
    if (!isLeader) return;
    Alert.alert('Supprimer', `Supprimer ${student.first_name} ${student.last_name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('department_students').delete().eq('id', student.id);
        loadStudents();
      }},
    ]);
  };

  const filtered = filter === 'ALL' ? students : students.filter(s => s.status === filter);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#0ea5e9" /></View>;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.hubSubtitle}>Suivi Scolaire & Insertion</Text>
        {isLeader && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setIsAdding(true)}>
            <Text style={styles.addBtnText}>+ Étudiant</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <TouchableOpacity style={filter === 'ALL' ? styles.pillActive : styles.pill} onPress={() => setFilter('ALL')}>
          <Text style={filter === 'ALL' ? styles.pillActiveText : styles.pillText}>Tous ({students.length})</Text>
        </TouchableOpacity>
        {Object.entries(STATUS_LABELS).map(([key, val]) => {
          const count = students.filter(s => s.status === key).length;
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
        ListEmptyComponent={<Text style={styles.emptyText}>Aucun étudiant enregistré.</Text>}
        renderItem={({ item }) => {
          const st = STATUS_LABELS[item.status] || STATUS_LABELS.STUDENT;
          return (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.cardName}>{item.first_name} {item.last_name}</Text>
                  {item.level && <Text style={styles.cardInfo}>🎓 {item.level}</Text>}
                  {item.school_name && <Text style={styles.cardInfo}>🏫 {item.school_name}</Text>}
                  {item.field_of_study && <Text style={styles.cardInfo}>📚 {item.field_of_study}</Text>}
                  {item.academic_year && <Text style={styles.cardInfo}>📅 Année: {item.academic_year}</Text>}
                  {item.phone && <Text style={styles.cardInfo}>📞 {item.phone}</Text>}
                  {item.insertion_status && item.insertion_status !== 'NONE' && (
                    <Text style={styles.insertionBadge}>💼 Insertion: {INSERTION_LABELS[item.insertion_status] || item.insertion_status}</Text>
                  )}
                </View>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.statusBadge, { backgroundColor: st.color + '20' }]}
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

      <Modal visible={isAdding} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
              <Text style={styles.modalTitle}>Nouvel Étudiant / Jeune Pro</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Prénom *" value={newStudent.first_name} onChangeText={v => setNewStudent({ ...newStudent, first_name: v })} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Nom *" value={newStudent.last_name} onChangeText={v => setNewStudent({ ...newStudent, last_name: v })} />
              </View>
              <TextInput style={styles.input} placeholder="Niveau (ex: L3, BTS, Master...)" value={newStudent.level} onChangeText={v => setNewStudent({ ...newStudent, level: v })} />
              <TextInput style={styles.input} placeholder="Établissement" value={newStudent.school_name} onChangeText={v => setNewStudent({ ...newStudent, school_name: v })} />
              <TextInput style={styles.input} placeholder="Filière / Domaine" value={newStudent.field_of_study} onChangeText={v => setNewStudent({ ...newStudent, field_of_study: v })} />
              <TextInput style={styles.input} placeholder="Année académique (ex: 2026-2027)" value={newStudent.academic_year} onChangeText={v => setNewStudent({ ...newStudent, academic_year: v })} />
              <TextInput style={styles.input} placeholder="Téléphone" value={newStudent.phone} onChangeText={v => setNewStudent({ ...newStudent, phone: v })} keyboardType="phone-pad" />
              <Text style={styles.label}>Statut</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {Object.entries(STATUS_LABELS).map(([key, val]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.statusOption, newStudent.status === key && { backgroundColor: val.color }]}
                    onPress={() => setNewStudent({ ...newStudent, status: key })}
                  >
                    <Text style={[styles.statusOptionText, newStudent.status === key && { color: '#fff' }]}>{val.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
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
  addBtn: { backgroundColor: '#0ea5e9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  filterRow: { paddingHorizontal: 20, marginBottom: 12, paddingBottom: 5 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8 },
  pillActive: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#0ea5e9', marginRight: 8 },
  pillText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  pillActiveText: { fontSize: 12, color: '#fff', fontWeight: 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginHorizontal: 20, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardName: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 6 },
  cardInfo: { fontSize: 13, color: '#475569', marginTop: 3 },
  insertionBadge: { fontSize: 12, color: '#0ea5e9', fontWeight: 'bold', marginTop: 8, backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', overflow: 'hidden' },
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
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#0ea5e9', alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: 'bold' },
});