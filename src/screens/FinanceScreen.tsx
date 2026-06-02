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
    const { data: { user } } = await supabase.auth.getUser();
    const { data: role } = await supabase.from('user_roles').select('entity_id').eq('user_id', user?.id).single();

    if (role?.entity_id) {
      // On récupère plus d'entrées pour avoir des statistiques mensuelles et globales précises
      const { data } = await supabase
        .from('financial_entries')
        .select('*')
        .eq('church_id', role.entity_id)
        .order('created_at', { ascending: false })
        .limit(500);
      setEntries(data || []);
    }
    setLoading(false);
  }

  // ==========================================
  // CALCULS ANALYTIQUES
  // ==========================================
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const analytics = entries.reduce((acc, curr) => {
    const amt = Number(curr.amount) || 0;
    const date = new Date(curr.created_at);
    const isCurrentMonth = date.getMonth() === currentMonth && date.getFullYear() === currentYear;

    if (curr.type === 'INCOME') {
      acc.totalIncome += amt;
      if (isCurrentMonth) acc.monthIncome += amt;
    } else {
      acc.totalExpense += amt;
      if (isCurrentMonth) acc.monthExpense += amt;
    }
    return acc;
  }, { totalIncome: 0, totalExpense: 0, monthIncome: 0, monthExpense: 0 });

  const totalBalance = analytics.totalIncome - analytics.totalExpense;

  // ==========================================
  // SAUVEGARDE ET AUDIT
  // ==========================================
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
        const { data: oldEntry } = await supabase.from('financial_entries').select('*').eq('id', editingId).single();
        
        await supabase.from('financial_audit_logs').insert({
          entry_id: editingId,
          changed_by: user?.id,
          old_amount: oldEntry.amount,
          new_amount: entryData.amount,
          old_data: oldEntry,
          action_type: 'UPDATE'
        });

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

  // ==========================================
  // VUE DU FORMULAIRE DE SAISIE
  // ==========================================
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
                <Text style={type === 'INCOME' && {fontWeight:'bold', color: '#10b981'}}>Entrée (+)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, type === 'EXPENSE' && styles.activeExp]} onPress={() => { setType('EXPENSE'); setCategory('Loyer/Électricité'); }}>
                <Text style={type === 'EXPENSE' && {fontWeight:'bold', color: '#ef4444'}}>Sortie (-)</Text>
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
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Confirmer la transaction</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ==========================================
  // VUE PRINCIPALE (DASHBOARD FINANCES)
  // ==========================================
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>⬅ Accueil</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Finances</Text>
        <TouchableOpacity onPress={() => setView('FORM')} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Saisir</Text>
        </TouchableOpacity>
      </View>

      <FlatList 
        data={entries}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* CARTE DU MONTANT EN CAISSE */}
            <View style={[styles.balanceCard, { backgroundColor: totalBalance >= 0 ? '#0f172a' : '#ef4444' }]}>
              <Text style={styles.balanceLabel}>Montant total en caisse</Text>
              <Text style={styles.balanceAmount}>{totalBalance.toLocaleString('fr-FR')} FCFA</Text>
            </View>

            {/* ENCART ANALYTIQUE (BILAN DU MOIS & GRAPHIQUE) */}
            <View style={styles.analyticsBox}>
              <Text style={styles.analyticsHeader}>Bilan de ce mois</Text>
              
              <View style={styles.analyticsRow}>
                <View style={styles.analyticsStat}>
                  <Text style={styles.analyticsLabel}>Entrées</Text>
                  <Text style={[styles.analyticsValue, {color: '#10b981'}]}>+{analytics.monthIncome.toLocaleString()}</Text>
                </View>
                <View style={styles.analyticsDivider} />
                <View style={styles.analyticsStat}>
                  <Text style={styles.analyticsLabel}>Sorties</Text>
                  <Text style={[styles.analyticsValue, {color: '#ef4444'}]}>-{analytics.monthExpense.toLocaleString()}</Text>
                </View>
              </View>

              {/* GRAPHIQUE BARRE DE PROPORTION */}
              {(analytics.monthIncome > 0 || analytics.monthExpense > 0) && (
                <View style={styles.graphContainer}>
                  <View style={[styles.graphBarInc, { flex: analytics.monthIncome || 0.1 }]} />
                  <View style={[styles.graphBarExp, { flex: analytics.monthExpense || 0.1 }]} />
                </View>
              )}
            </View>

            <Text style={styles.sectionTitle}>Historique récent</Text>
            {loading && entries.length === 0 && <ActivityIndicator style={{marginTop: 20}} color="#0f172a" />}
          </>
        }
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>Aucune transaction enregistrée.</Text> : null}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.entryRow} onPress={() => startEdit(item)}>
            <View style={styles.entryLeft}>
              {/* L'icône a été retirée ici pour plus d'espace */}
              <View>
                <Text style={styles.entryCategory}>{item.category} {item.is_modified && "⚠️"}</Text>
                <Text style={styles.entryDate}>
                  {item.event_name ? item.event_name + ' • ' : ''}{new Date(item.created_at).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            </View>
            <Text style={[styles.entryAmount, {color: item.type === 'INCOME' ? '#10b981' : '#ef4444'}]}>
              {item.type === 'INCOME' ? '+' : '-'} {item.amount.toLocaleString('fr-FR')}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  backBtn: { color: '#64748b', fontWeight: 'bold' },
  addBtn: { backgroundColor: '#0f172a', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  
  // NOUVEAUX STYLES ANALYTIQUES
  balanceCard: { padding: 25, borderRadius: 20, alignItems: 'center', marginBottom: 15, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  balanceLabel: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 },
  balanceAmount: { color: '#fff', fontSize: 36, fontWeight: 'bold' },

  analyticsBox: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 25, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  analyticsHeader: { fontSize: 12, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 15 },
  analyticsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 15 },
  analyticsStat: { alignItems: 'flex-start', flex: 1 },
  analyticsLabel: { fontSize: 11, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  analyticsValue: { fontSize: 18, fontWeight: 'bold' },
  analyticsDivider: { width: 1, height: 30, backgroundColor: '#e2e8f0', marginHorizontal: 15 },
  
  // Style Graphique à barres
  graphContainer: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  graphBarInc: { backgroundColor: '#10b981' },
  graphBarExp: { backgroundColor: '#ef4444' },

  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 15 },
  
  // Liste Historique améliorée
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  entryLeft: { flexDirection: 'row', alignItems: 'center' },
  iconWrapper: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  entryCategory: { fontWeight: 'bold', fontSize: 15, color: '#0f172a' },
  entryDate: { fontSize: 11, color: '#64748b', marginTop: 4 },
  entryAmount: { fontWeight: 'bold', fontSize: 16 },
  emptyText: { textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', marginTop: 20 },

  // Formulaire
  toggleContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 10, padding: 4, marginBottom: 20 },
  toggleBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  activeInc: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  activeExp: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 10 },
  inputLarge: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 24, fontWeight: 'bold', color: '#0f172a', marginBottom: 10 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 14, color: '#0f172a', marginBottom: 10 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  tag: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  tagActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  tagText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  tagTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: '#0f172a', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});