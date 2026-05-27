// src/screens/FinanceScreen.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, FlatList 
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function FinanceScreen({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  
  // États du formulaire
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Dîme');
  const [eventName, setEventName] = useState('');
  const [description, setDescription] = useState('');

  const incomeCategories = ['Dîme', 'Offrande', 'Action de grâce', 'Don'];
  const expenseCategories = ['Loyer/Électricité', 'Équipement', 'Social', 'Honoraires'];
  const currentCategories = type === 'INCOME' ? incomeCategories : expenseCategories;

  useEffect(() => {
    fetchEntries();
  }, []);

  async function fetchEntries() {
    setLoading(true);
    const { data } = await supabase
      .from('financial_entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setEntries(data || []);
    setLoading(false);
  }

  const totals = entries.reduce((acc, curr) => {
    if (curr.type === 'INCOME') acc.income += Number(curr.amount);
    else acc.expense += Number(curr.amount);
    return acc;
  }, { income: 0, expense: 0 });

  async function handleSave() {
    if (!amount || isNaN(Number(amount))) return Alert.alert('Erreur', 'Montant invalide');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: role } = await supabase.from('user_roles').select('entity_id').eq('user_id', user?.id).single();

      const entryData = {
        amount: Number(amount),
        type,
        category,
        event_name: eventName,
        description,
        updated_at: new Date().toISOString(),
        updated_by: user?.id
      };

      if (editingId) {
        // 🔴 CORRECTION : On récupère l'ancienne valeur
        const { data: oldEntry } = await supabase.from('financial_entries').select('*').eq('id', editingId).single();
        
        // 🔴 CORRECTION : On enregistre dans la table d'audit pour le Web !
        await supabase.from('financial_audit_logs').insert({
          entry_id: editingId,
          changed_by: user?.id,
          old_amount: oldEntry.amount,
          new_amount: entryData.amount,
          old_data: oldEntry,
          action_type: 'UPDATE'
        });

        // On met à jour avec le flag is_modified
        await supabase.from('financial_entries').update({ ...entryData, is_modified: true }).eq('id', editingId);
      } else {
        await supabase.from('financial_entries').insert({ ...entryData, church_id: role.entity_id, created_by: user?.id, is_modified: false });
      }

      Alert.alert('Succès', 'Transaction enregistrée');
      resetForm();
      fetchEntries();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setAmount('');
    setEventName('');
    setDescription('');
    setCategory(type === 'INCOME' ? 'Dîme' : 'Loyer/Électricité');
    setView('LIST');
  }

  function startEdit(item: any) {
    setEditingId(item.id);
    setAmount(item.amount.toString());
    setType(item.type);
    setCategory(item.category);
    setEventName(item.event_name || '');
    setDescription(item.description || '');
    setView('FORM');
  }

  if (view === 'FORM') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={resetForm}><Text style={styles.backBtn}>✕ Annuler</Text></TouchableOpacity>
            <Text style={styles.headerTitle}>{editingId ? 'Modifier' : 'Nouvelle saisie'}</Text>
          </View>

          <View style={styles.toggleContainer}>
            <TouchableOpacity style={[styles.toggleBtn, type === 'INCOME' && styles.activeInc]} onPress={() => { setType('INCOME'); setCategory('Dîme'); }}>
                <Text style={type === 'INCOME' && {fontWeight:'bold'}}>Entrée (+)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, type === 'EXPENSE' && styles.activeExp]} onPress={() => { setType('EXPENSE'); setCategory('Loyer/Électricité'); }}>
                <Text style={type === 'EXPENSE' && {fontWeight:'bold'}}>Sortie (-)</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Montant (FCFA) *</Text>
          <TextInput style={styles.inputLarge} keyboardType="numeric" placeholder="0" value={amount} onChangeText={setAmount} />
          
          <Text style={styles.label}>Catégorie *</Text>
          <View style={styles.tagsContainer}>
            {currentCategories.map(cat => (
              <TouchableOpacity key={cat} style={[styles.tag, category === cat && styles.tagActive]} onPress={() => setCategory(cat)}>
                <Text style={[styles.tagText, category === cat && styles.tagTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Événement (Optionnel)</Text>
          <TextInput style={styles.input} placeholder="Ex: Culte de dimanche..." value={eventName} onChangeText={setEventName} />

          <Text style={styles.label}>Description (Optionnel)</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Motif de la transaction..." multiline value={description} onChangeText={setDescription} />
          
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Confirmer</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>⬅ Accueil</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Finances</Text>
        <TouchableOpacity onPress={() => setView('FORM')} style={styles.addBtn}><Text style={styles.addBtnText}>+ Saisir</Text></TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Entrées</Text>
          <Text style={[styles.statValue, {color: '#10b981'}]}>{totals.income.toLocaleString()} F</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Sorties</Text>
          <Text style={[styles.statValue, {color: '#ef4444'}]}>{totals.expense.toLocaleString()} F</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Historique récent</Text>
      
      {loading && entries.length === 0 ? <ActivityIndicator style={{marginTop: 20}} /> : (
        <FlatList 
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.entryRow} onPress={() => startEdit(item)}>
              <View>
                <Text style={styles.entryCategory}>{item.category} {item.is_modified && "⚠️"}</Text>
                <Text style={styles.entryDate}>{item.event_name ? item.event_name + ' • ' : ''}{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.entryAmount, {color: item.type === 'INCOME' ? '#10b981' : '#ef4444'}]}>
                {item.type === 'INCOME' ? '+' : '-'} {item.amount.toLocaleString()}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  backBtn: { color: '#64748b', fontWeight: 'bold' },
  addBtn: { backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  statLabel: { fontSize: 10, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontWeight: 'bold', marginTop: 5 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#334155', marginBottom: 15 },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  entryCategory: { fontWeight: 'bold', fontSize: 14, color: '#0f172a' },
  entryDate: { fontSize: 10, color: '#64748b', marginTop: 2 },
  entryAmount: { fontWeight: 'bold', fontSize: 14 },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 10, padding: 4, marginBottom: 20 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeInc: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  activeExp: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 10 },
  inputLarge: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 24, fontWeight: 'bold', color: '#0f172a', marginBottom: 10 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 14, color: '#0f172a', marginBottom: 10 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  tag: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  tagActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  tagText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  tagTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: '#0f172a', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});