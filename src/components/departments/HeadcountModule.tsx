// src/components/departments/HeadcountModule.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator 
} from 'react-native';
import { supabase } from '../../lib/supabase';
import DateTimePicker from '../WebDatePicker';

interface HeadcountModuleProps {
  deptId: string;
  churchId: string;
  isLeader: boolean;
}

export default function HeadcountModule({ deptId, churchId, isLeader }: HeadcountModuleProps) {
  const [headcounts, setHeadcounts] = useState<any[]>([]);
  const [allChurchPrograms, setAllChurchPrograms] = useState<any[]>([]);
  const [totalChurchMembers, setTotalChurchMembers] = useState(1);
  const [loading, setLoading] = useState(true);
  
  const [isAddingHeadcount, setIsAddingHeadcount] = useState(false);
  const [editingHeadcountId, setEditingHeadcountId] = useState<string | null>(null);
  const [isProgramDropdownOpen, setIsProgramDropdownOpen] = useState(false);
  const [newHeadcount, setNewHeadcount] = useState({ 
    church_program_id: '', event_title: '', event_date: '', men_count: '', women_count: '', children_count: '' 
  });
  
  const [dateObj, setDateObj] = useState<Date | undefined>(undefined);

  useEffect(() => {
    loadData();
  }, [deptId]);

  async function loadData() {
    setLoading(true);
    
    // Total fidèles pour calculs
    if (churchId) {
      const { count } = await supabase.from('church_members').select('*', { count: 'exact', head: true }).eq('church_id', churchId).eq('status', 'APPROVED');
      setTotalChurchMembers(count || 1);
    }

    // Programmes et Rapports
    const [cProgramsRes, hcRes] = await Promise.all([
      supabase.from('church_programs').select('*').eq('church_id', churchId).order('created_at', { ascending: false }),
      supabase.from('department_headcounts').select('*').eq('department_id', deptId).order('event_date', { ascending: false })
    ]);

    setAllChurchPrograms(cProgramsRes.data || []);
    setHeadcounts(hcRes.data || []);
    setLoading(false);
  }

  const handleAddHeadcount = async () => {
    if (!newHeadcount.church_program_id) return Alert.alert("Erreur", "Veuillez sélectionner un programme.");
    if (!newHeadcount.event_date) return Alert.alert("Erreur", "La date est requise.");
    
    const targetDate = newHeadcount.event_date.split('T')[0];
    const otherHeadcounts = headcounts.filter(h => h.id !== editingHeadcountId);
    
    // Limite 4 événements
    const sameDateEvents = otherHeadcounts.filter(h => h.event_date.split('T')[0] === targetDate);
    if (sameDateEvents.length >= 4) {
      return Alert.alert("Limite atteinte", "Vous avez atteint la limite de 4 événements saisis pour cette même date.");
    }
    
    // Anti-doublon
    const duplicateEvent = sameDateEvents.find(h => h.church_program_id === newHeadcount.church_program_id);
    if (duplicateEvent) {
      return Alert.alert("Doublon", "Un rapport existe déjà pour ce programme à cette date exacte. Modifiez-le depuis la liste.");
    }

    const m = parseInt(newHeadcount.men_count) || 0;
    const w = parseInt(newHeadcount.women_count) || 0;
    const c = parseInt(newHeadcount.children_count) || 0;
    const total = m + w + c;
    const { data: { user } } = await supabase.auth.getUser();
    
    const payload = {
      department_id: deptId, 
      event_title: newHeadcount.event_title, 
      event_date: newHeadcount.event_date, 
      church_program_id: newHeadcount.church_program_id,
      men_count: m, women_count: w, children_count: c, total_count: total, 
      created_by: user?.id
    };

    if (editingHeadcountId) {
      await supabase.from('department_headcounts').update(payload).eq('id', editingHeadcountId);
    } else {
      await supabase.from('department_headcounts').insert(payload);
    }

    setIsAddingHeadcount(false);
    setEditingHeadcountId(null);
    setNewHeadcount({ church_program_id: '', event_title: '', event_date: '', men_count: '', women_count: '', children_count: '' });
    loadData();
  };

  // Analytiques
  const avgAttendance = headcounts.length > 0 ? Math.round(headcounts.reduce((acc, h) => acc + h.total_count, 0) / headcounts.length) : 0;
  const maxAttendanceEver = Math.max(...headcounts.map(h => h.total_count), 1);
  const retentionRate = Math.min(Math.round((avgAttendance / totalChurchMembers) * 100), 100);

  return (
    <View style={{ flex: 1 }}>
      {loading ? <ActivityIndicator size="small" color="#14b8a6" /> : (
        <>
          <View style={styles.analyticsBox}>
            <View style={styles.analyticsRow}>
              <View style={styles.analyticsStat}>
                <Text style={styles.analyticsLabel}>Moyenne</Text>
                <Text style={styles.analyticsValue}>{avgAttendance}</Text>
              </View>
              <View style={styles.analyticsDivider} />
              <View style={styles.analyticsStat}>
                <Text style={styles.analyticsLabel}>Rétention</Text>
                <Text style={[styles.analyticsValue, {color: retentionRate > 80 ? '#10b981' : '#f59e0b'}]}>{retentionRate}%</Text>
              </View>
              <View style={styles.analyticsDivider} />
              <View style={styles.analyticsStat}>
                <Text style={styles.analyticsLabel}>Max Atteint</Text>
                <Text style={styles.analyticsValue}>{maxAttendanceEver}</Text>
              </View>
            </View>
            <Text style={styles.statFooter}>Basé sur un total déclaré de {totalChurchMembers} fidèles</Text>
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.title}>Rapports de présence</Text>
            {isLeader && (
              <TouchableOpacity 
                style={styles.addBtn} 
                onPress={() => { 
                  setEditingHeadcountId(null); 
                  setNewHeadcount({ church_program_id: '', event_title: '', event_date: '', men_count: '', women_count: '', children_count: '' }); 
                  setIsAddingHeadcount(true); 
                }}
              >
                <Text style={styles.addBtnText}>+ Rapport</Text>
              </TouchableOpacity>
            )}
          </View>

          <FlatList 
            data={headcounts} 
            keyExtractor={item => item.id} 
            showsVerticalScrollIndicator={false} 
            ListEmptyComponent={<Text style={styles.emptyText}>Aucun rapport enregistré.</Text>} 
            renderItem={({ item }) => {
              const hcDate = new Date(item.event_date);
              const fillPercentage = Math.min((item.total_count / maxAttendanceEver) * 100, 100);
              
              return (
                <View style={styles.card}>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateDay}>{hcDate.getDate()}</Text>
                    <Text style={styles.dateMonth}>{hcDate.toLocaleString('fr-FR', { month: 'short' }).toUpperCase()}</Text>
                  </View>
                  
                  <View style={{ flex: 1 }}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                      <Text style={styles.cardTitle}>{item.event_title}</Text>
                      {isLeader && (
                        <TouchableOpacity onPress={() => {
                          setEditingHeadcountId(item.id);
                          setNewHeadcount({ 
                            church_program_id: item.church_program_id, event_title: item.event_title, 
                            event_date: item.event_date.split('T')[0], men_count: item.men_count.toString(), 
                            women_count: item.women_count.toString(), children_count: item.children_count.toString() 
                          });
                          setIsAddingHeadcount(true);
                        }}>
                          <Text style={{fontSize: 11, color: '#14b8a6', fontWeight: 'bold'}}>✏️ Modifier</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    
                    <View style={styles.statsRow}>
                      <Text style={{fontSize: 12, fontWeight: 'bold', color: '#3b82f6'}}>👨 {item.men_count}</Text>
                      <Text style={{fontSize: 12, fontWeight: 'bold', color: '#ec4899'}}>👩 {item.women_count}</Text>
                      <Text style={{fontSize: 12, fontWeight: 'bold', color: '#f59e0b'}}>🧸 {item.children_count}</Text>
                    </View>
                    
                    <View style={styles.progressBarContainer}>
                      <View style={{flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden'}}>
                        <View style={{height: '100%', width: `${fillPercentage}%`, backgroundColor: fillPercentage > 80 ? '#10b981' : '#14b8a6', borderRadius: 4}} />
                      </View>
                      <Text style={styles.progressText}>{item.total_count}</Text>
                    </View>
                  </View>
                </View>
              )
            }}
          />
        </>
      )}

      {/* Modale d'ajout/modification */}
      <Modal visible={isAddingHeadcount} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{editingHeadcountId ? 'Modifier le Rapport' : 'Nouveau Rapport'}</Text>
              <TouchableOpacity onPress={() => { setIsAddingHeadcount(false); setEditingHeadcountId(null); }}>
                <Text style={{fontSize: 24, color: '#64748b'}}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Date de l'événement *</Text>
              <DateTimePicker
                value={dateObj}
                mode="date"
                style={styles.input}
                placeholder="Sélectionner la date"
                onChange={(e, d) => {
                  if (d) {
                    setDateObj(d);
                    setNewHeadcount({...newHeadcount, event_date: d.toISOString().split('T')[0]});
                  }
                }}
              />

              <View style={{ zIndex: 10 }}>
                <Text style={styles.inputLabel}>Programme de l'église *</Text>
                <TouchableOpacity style={styles.dropdownSelector} onPress={() => setIsProgramDropdownOpen(!isProgramDropdownOpen)}>
                  <Text style={newHeadcount.church_program_id ? styles.dropdownTextSelected : styles.dropdownTextPlaceholder}>
                    {newHeadcount.church_program_id ? newHeadcount.event_title : "-- Sélectionner un programme --"}
                  </Text>
                  <Text style={{ color: '#94a3b8' }}>▼</Text>
                </TouchableOpacity>
                {isProgramDropdownOpen && (
                  <View style={styles.dropdownContainer}>
                    <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                      {allChurchPrograms.length === 0 && <Text style={{padding: 10, color: '#ef4444', fontSize: 12}}>Aucun programme disponible.</Text>}
                      {allChurchPrograms.map(cp => (
                        <TouchableOpacity key={cp.id} style={styles.dropdownItem} onPress={() => { 
                          setNewHeadcount({...newHeadcount, church_program_id: cp.id, event_title: cp.title}); 
                          setIsProgramDropdownOpen(false); 
                        }}>
                          <Text style={styles.dropdownItemText}>{cp.title}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <Text style={[styles.inputLabel, {marginTop: 20}]}>Détails du dénombrement</Text>
              <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}><Text style={styles.inputLabel}>👨 Hommes</Text><TextInput style={styles.input} keyboardType="numeric" value={newHeadcount.men_count} placeholder="0" onChangeText={t => setNewHeadcount({...newHeadcount, men_count: t})} /></View>
                <View style={{flex: 1}}><Text style={styles.inputLabel}>👩 Femmes</Text><TextInput style={styles.input} keyboardType="numeric" value={newHeadcount.women_count} placeholder="0" onChangeText={t => setNewHeadcount({...newHeadcount, women_count: t})} /></View>
                <View style={{flex: 1}}><Text style={styles.inputLabel}>🧸 Enfants</Text><TextInput style={styles.input} keyboardType="numeric" value={newHeadcount.children_count} placeholder="0" onChangeText={t => setNewHeadcount({...newHeadcount, children_count: t})} /></View>
              </View>

              <View style={{marginTop: 30, marginBottom: 40}}>
                <TouchableOpacity style={[styles.submitBtn, {backgroundColor: '#14b8a6'}]} onPress={handleAddHeadcount}>
                  <Text style={styles.submitBtnText}>{editingHeadcountId ? 'Mettre à jour le rapport' : 'Enregistrer le rapport'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8', fontStyle: 'italic' },
  title: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  addBtn: { backgroundColor: '#14b8a6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  
  analyticsBox: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 2 },
  analyticsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  analyticsStat: { alignItems: 'center', flex: 1 },
  analyticsLabel: { fontSize: 11, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  analyticsValue: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  analyticsDivider: { width: 1, height: 30, backgroundColor: '#e2e8f0' },
  statFooter: { fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 10, fontStyle: 'italic' },

  card: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'flex-start' },
  dateBox: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', width: 60, marginRight: 15, borderWidth: 1, borderColor: '#ccfbf1' },
  dateDay: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  dateMonth: { fontSize: 10, fontWeight: 'bold', color: '#64748b', marginTop: 2 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', flex: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8 },
  progressBarContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  progressText: { fontSize: 12, fontWeight: 'bold', color: '#0f172a', marginLeft: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 25, paddingBottom: 20, maxHeight: '90%' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 5, marginTop: 15 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 15, height: 45, color: '#0f172a', justifyContent: 'center' },
  
  iosPickerContainer: { backgroundColor: '#f1f5f9', borderRadius: 12, marginTop: 15, overflow: 'hidden' },
  iosPickerHeader: { flexDirection: 'row', justifyContent: 'flex-end', padding: 10, backgroundColor: '#e2e8f0' },
  iosPickerDoneText: { fontWeight: 'bold', color: '#0f172a', fontSize: 15 },

  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 15, height: 45 },
  dropdownTextSelected: { color: '#0f172a', fontSize: 14 },
  dropdownTextPlaceholder: { color: '#94a3b8', fontSize: 14 },
  dropdownContainer: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, marginTop: 5, overflow: 'hidden', elevation: 2 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownItemText: { color: '#0f172a', fontSize: 14 },

  submitBtn: { padding: 15, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});