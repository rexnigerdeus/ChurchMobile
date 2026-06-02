// src/components/departments/FinanceModule.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator 
} from 'react-native';
import { supabase } from '../../lib/supabase';

interface FinanceModuleProps {
  deptId: string;
  isLeader: boolean;
  activeMembers: any[];
}

export default function FinanceModule({ deptId, isLeader, activeMembers }: FinanceModuleProps) {
  const [finances, setFinances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingFinance, setIsAddingFinance] = useState(false);
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [newFinance, setNewFinance] = useState({ 
    type: 'INCOME', category: 'Mensuelle', amount: '', motif: '', member_id: '' 
  });

  useEffect(() => {
    loadFinances();
  }, [deptId]);

  async function loadFinances() {
    setLoading(true);
    const { data: rawFinances } = await supabase
      .from('department_finances')
      .select('*')
      .eq('department_id', deptId)
      .order('created_at', { ascending: false });

    if (rawFinances) {
      setFinances(rawFinances.map(fin => ({ 
        ...fin, 
        member: fin.member_id ? { full_name: activeMembers.find(p => p.user_id === fin.member_id)?.member.full_name || 'Inconnu' } : null 
      })));
    }
    setLoading(false);
  }

  const handleAddFinance = async () => {
    if (!newFinance.amount || isNaN(Number(newFinance.amount))) return Alert.alert("Erreur", "Montant invalide.");
    if (newFinance.type === 'EXPENSE' && !newFinance.motif.trim()) return Alert.alert("Erreur", "Le motif est requis.");
    
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('department_finances').insert({ 
      department_id: deptId, 
      type: newFinance.type, 
      category: newFinance.type === 'INCOME' ? newFinance.category : 'Dépense', 
      amount: Number(newFinance.amount), 
      motif: newFinance.motif.trim() || null, 
      member_id: newFinance.member_id || null, 
      created_by: user?.id 
    });

    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      setIsAddingFinance(false); 
      setNewFinance({ type: 'INCOME', category: 'Mensuelle', amount: '', motif: '', member_id: '' }); 
      loadFinances();
    }
  };

  // Calculs Financiers
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthFinances = finances.filter(f => {
    const d = new Date(f.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  
  const monthIncome = monthFinances.filter(f => f.type === 'INCOME').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const monthExpense = monthFinances.filter(f => f.type === 'EXPENSE').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const balance = finances.reduce((acc, curr) => curr.type === 'INCOME' ? acc + (Number(curr.amount) || 0) : acc - (Number(curr.amount) || 0), 0);

  if (!isLeader) return <View style={styles.centered}><Text style={styles.emptyText}>Accès réservé au responsable.</Text></View>;

  return (
    <View style={{ flex: 1 }}>
      {loading ? <ActivityIndicator size="small" color="#10b981" /> : (
        <>
          <View style={[styles.balanceCard, { backgroundColor: balance >= 0 ? '#0f172a' : '#ef4444' }]}>
            <Text style={styles.balanceLabel}>Montant en Caisse</Text>
            <Text style={styles.balanceAmount}>{balance.toLocaleString('fr-FR')} FCFA</Text>
          </View>

          <View style={styles.analyticsBox}>
            <Text style={styles.analyticsHeader}>Bilan de ce mois</Text>
            <View style={styles.analyticsRow}>
              <View style={styles.analyticsStat}>
                <Text style={styles.analyticsLabel}>Entrées</Text>
                <Text style={[styles.analyticsValue, {color: '#10b981'}]}>+{monthIncome.toLocaleString()}</Text>
              </View>
              <View style={styles.analyticsDivider} />
              <View style={styles.analyticsStat}>
                <Text style={styles.analyticsLabel}>Sorties</Text>
                <Text style={[styles.analyticsValue, {color: '#ef4444'}]}>-{monthExpense.toLocaleString()}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.listHeader}>
            <Text style={styles.title}>Historique des transactions</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => setIsAddingFinance(true)}>
              <Text style={styles.addBtnText}>+ Opération</Text>
            </TouchableOpacity>
          </View>

          <FlatList 
            data={finances} 
            keyExtractor={item => item.id} 
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.emptyText}>Aucune transaction enregistrée.</Text>} 
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.iconWrapper}>
                  <Text style={{ fontSize: 20 }}>{item.type === 'INCOME' ? '📥' : '💸'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.category}>{item.category}</Text>
                  {item.member && <Text style={styles.memberText}>Par : {item.member.full_name}</Text>}
                  <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString('fr-FR')}</Text>
                </View>
                <Text style={[styles.amount, { color: item.type === 'INCOME' ? '#10b981' : '#ef4444' }]}>
                  {item.type === 'INCOME' ? '+' : '-'}{item.amount}
                </Text>
              </View>
          )}/>
        </>
      )}

      {/* Modale d'ajout */}
      <Modal visible={isAddingFinance} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Nouvelle Transaction</Text>
              <TouchableOpacity onPress={() => setIsAddingFinance(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.toggleRow}>
                <TouchableOpacity style={[styles.toggleBtn, newFinance.type === 'INCOME' && styles.activeIn]} onPress={() => setNewFinance({...newFinance, type: 'INCOME'})}>
                  <Text style={[styles.toggleText, newFinance.type === 'INCOME' && { color: '#fff' }]}>📥 Entrée</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleBtn, newFinance.type === 'EXPENSE' && styles.activeOut]} onPress={() => setNewFinance({...newFinance, type: 'EXPENSE'})}>
                  <Text style={[styles.toggleText, newFinance.type === 'EXPENSE' && { color: '#fff' }]}>💸 Sortie</Text>
                </TouchableOpacity>
              </View>

              {newFinance.type === 'INCOME' && (
                <View style={styles.categoryRow}>
                  {['Mensuelle', 'Régionale', 'Événement local'].map(cat => (
                    <TouchableOpacity key={cat} style={[styles.catPill, newFinance.category === cat && styles.catPillActive]} onPress={() => setNewFinance({...newFinance, category: cat})}>
                      <Text style={[styles.catPillText, newFinance.category === cat && { color: '#fff' }]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.inputLabel}>Montant *</Text>
              <TextInput style={styles.input} keyboardType="numeric" onChangeText={t => setNewFinance({...newFinance, amount: t})} />
              
              <Text style={styles.inputLabel}>Motif</Text>
              <TextInput style={styles.input} onChangeText={t => setNewFinance({...newFinance, motif: t})} />

              {newFinance.type === 'INCOME' && (
                <View style={{ zIndex: 10 }}>
                  <Text style={styles.inputLabel}>Payé par (Optionnel)</Text>
                  <TouchableOpacity style={styles.dropdownSelector} onPress={() => setIsMemberDropdownOpen(!isMemberDropdownOpen)}>
                    <Text style={newFinance.member_id ? styles.dropdownTextSelected : styles.dropdownTextPlaceholder}>
                      {newFinance.member_id ? activeMembers.find(m => m.user_id === newFinance.member_id)?.member.full_name : "-- Anonyme --"}
                    </Text>
                    <Text style={{ color: '#94a3b8' }}>▼</Text>
                  </TouchableOpacity>
                  {isMemberDropdownOpen && (
                    <View style={styles.dropdownContainer}>
                      <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => { setNewFinance({...newFinance, member_id: ''}); setIsMemberDropdownOpen(false); }}>
                          <Text style={styles.dropdownItemText}>-- Anonyme --</Text>
                        </TouchableOpacity>
                        {activeMembers.map(m => (
                          <TouchableOpacity key={m.id} style={styles.dropdownItem} onPress={() => { setNewFinance({...newFinance, member_id: m.user_id}); setIsMemberDropdownOpen(false); }}>
                            <Text style={styles.dropdownItemText}>{m.member.full_name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              <View style={{marginTop: 30, marginBottom: 40}}>
                <TouchableOpacity style={[styles.submitBtn, {backgroundColor: '#10b981'}]} onPress={handleAddFinance}>
                  <Text style={styles.submitBtnText}>Valider l'opération</Text>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8', fontStyle: 'italic' },
  title: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  addBtn: { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  
  balanceCard: { padding: 20, borderRadius: 20, alignItems: 'center', marginBottom: 20, elevation: 2 },
  balanceLabel: { color: '#cbd5e1', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 },
  balanceAmount: { color: '#fff', fontSize: 32, fontWeight: 'bold' },

  analyticsBox: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  analyticsHeader: { fontSize: 12, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 10 },
  analyticsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  analyticsStat: { alignItems: 'center', flex: 1 },
  analyticsLabel: { fontSize: 11, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  analyticsValue: { fontSize: 16, fontWeight: 'bold' },
  analyticsDivider: { width: 1, height: 30, backgroundColor: '#e2e8f0' },

  card: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center' },
  iconWrapper: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  category: { fontWeight: 'bold', fontSize: 14, color: '#0f172a' },
  memberText: { fontSize: 12, color: '#3b82f6', marginTop: 2, fontWeight: '600' },
  dateText: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
  amount: { fontSize: 16, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 25, paddingBottom: 20, maxHeight: '90%' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 5, marginTop: 15 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 15, height: 45, color: '#0f172a' },

  toggleRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 20 },
  toggleBtn: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 8 },
  toggleText: { fontWeight: 'bold', color: '#64748b' },
  activeIn: { backgroundColor: '#10b981' },
  activeOut: { backgroundColor: '#ef4444' },

  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  catPill: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  catPillActive: { backgroundColor: '#0f172a' },
  catPillText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },

  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 15, height: 45 },
  dropdownTextSelected: { color: '#0f172a', fontSize: 14 },
  dropdownTextPlaceholder: { color: '#94a3b8', fontSize: 14 },
  dropdownContainer: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, marginTop: 5, overflow: 'hidden', elevation: 2 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownItemText: { color: '#0f172a', fontSize: 14 },

  submitBtn: { padding: 15, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});