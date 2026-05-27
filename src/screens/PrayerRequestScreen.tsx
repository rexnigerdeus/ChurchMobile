// src/screens/PrayerRequestScreen.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, FlatList, Switch
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function PrayerRequestScreen({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');
  const [loading, setLoading] = useState(false);
  const [prayers, setPrayers] = useState<any[]>([]);
  
  // États du formulaire
  const [submitting, setSubmitting] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    if (activeTab === 'HISTORY') fetchMyPrayers();
  }, [activeTab]);

  async function fetchMyPrayers() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('pastoral_prayer_requests')
      .select('*')
      .eq('member_id', user?.id)
      .order('created_at', { ascending: false });
    
    setPrayers(data || []);
    setLoading(false);
  }

  async function handleSubmit() {
    if (!subject.trim() || !body.trim()) {
      return Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 🔴 CORRECTION ICI : On cherche l'église depuis le profil CRM du membre, pas dans le Staff !
      const { data: member } = await supabase.from('church_members').select('church_id').eq('user_id', user?.id).single();

      if (!member?.church_id) throw new Error("Impossible d'identifier votre église locale.");

      const { error } = await supabase.from('pastoral_prayer_requests').insert({
        church_id: member.church_id,
        member_id: user?.id,
        subject,
        body,
        is_anonymous: isAnonymous,
        status: 'PENDING'
      });

      if (error) throw error;

      Alert.alert('Envoyé', 'Votre requête a été transmise au bureau pastoral.');
      
      // Réinitialisation et bascule
      setSubject('');
      setBody('');
      setIsAnonymous(false);
      setActiveTab('HISTORY');

    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PENDING': return { color: '#f59e0b', bg: '#fef3c7', label: 'En attente' };
      case 'PRAYED': return { color: '#3b82f6', bg: '#eff6ff', label: 'Prié' };
      case 'ANSWERED': return { color: '#10b981', bg: '#d1fae5', label: 'Exaucé' };
      default: return { color: '#64748b', bg: '#f1f5f9', label: status };
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>⬅ Accueil</Text></TouchableOpacity>
          <Text style={styles.headerTitle}>Requêtes de Prière</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* ONGLETS */}
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, activeTab === 'NEW' && styles.tabActive]} onPress={() => setActiveTab('NEW')}>
            <Text style={[styles.tabText, activeTab === 'NEW' && styles.tabTextActive]}>Nouvelle Requête</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'HISTORY' && styles.tabActive]} onPress={() => setActiveTab('HISTORY')}>
            <Text style={[styles.tabText, activeTab === 'HISTORY' && styles.tabTextActive]}>Mes Sujets</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#0f172a" /></View>
        ) : activeTab === 'NEW' ? (
          
          /* ONGLET 1 : FORMULAIRE */
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Sujet de la prière</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ex: Guérison, Examen, Famille..." 
              value={subject}
              onChangeText={setSubject}
            />

            <Text style={styles.label}>Détails de votre requête</Text>
            <TextInput 
              style={styles.inputArea} 
              placeholder="Décrivez votre besoin pour que nous puissions prier avec précision..." 
              multiline 
              value={body}
              onChangeText={setBody}
            />

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchTitle}>Garder l'anonymat</Text>
                <Text style={styles.switchDesc}>Le pasteur verra la requête mais pas votre nom.</Text>
              </View>
              <Switch 
                value={isAnonymous} 
                onValueChange={setIsAnonymous}
                trackColor={{ false: '#e2e8f0', true: '#0f172a' }}
              />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Soumettre la requête</Text>}
            </TouchableOpacity>
          </ScrollView>

        ) : (

          /* ONGLET 2 : HISTORIQUE */
          <FlatList
            data={prayers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={<Text style={styles.emptyText}>Aucune requête de prière soumise.</Text>}
            renderItem={({ item }) => {
              const style = getStatusStyle(item.status);
              return (
                <View style={styles.historyCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.typeText}>{item.subject}</Text>
                    <View style={[styles.badge, { backgroundColor: style.bg }]}>
                      <Text style={[styles.badgeText, { color: style.color }]}>{style.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.historyBody}>{item.body}</Text>
                  <Text style={styles.historyDate}>
                    {new Date(item.created_at).toLocaleDateString('fr-FR')} {item.is_anonymous && ' • Anonyme'}
                  </Text>
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
  tabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#0f172a', fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#334155', marginTop: 15, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 16, color: '#0f172a' },
  inputArea: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, height: 120, textAlignVertical: 'top', fontSize: 16, color: '#0f172a' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginTop: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  switchTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  switchDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  submitBtn: { backgroundColor: '#0f172a', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 30 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  historyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  typeText: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', flex: 1 },
  historyBody: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 10 },
  historyDate: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 10 },
  badgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8', fontStyle: 'italic' }
});