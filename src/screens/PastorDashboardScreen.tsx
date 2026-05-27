// src/screens/PastorDashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  ActivityIndicator, Alert, ScrollView, TextInput 
} from 'react-native';
import { supabase } from '../lib/supabase';

type Tab = 'RDV' | 'PRAYERS' | 'FOLLOWUP';

export default function PastorDashboardScreen({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('RDV');
  const [loading, setLoading] = useState(true);
  
  // Données
  const [appointments, setAppointments] = useState<any[]>([]);
  const [prayers, setPrayers] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: role } = await supabase.from('user_roles').select('entity_id').eq('user_id', user?.id).single();

    if (activeTab === 'RDV') {
      const { data } = await supabase
        .from('pastoral_appointments')
        .select(`*, member:user_profiles!pastoral_appointments_member_id_fkey(full_name)`)
        .eq('church_id', role.entity_id)
        .eq('status', 'PENDING')
        .order('appointment_date', { ascending: true });
      setAppointments(data || []);
    } else if (activeTab === 'PRAYERS') {
      const { data } = await supabase
        .from('pastoral_prayer_requests')
        .select(`*, member:user_profiles!pastoral_prayer_requests_member_id_fkey(full_name)`)
        .eq('church_id', role.entity_id)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });
      setPrayers(data || []);
    } else if (activeTab === 'FOLLOWUP') {
      const { data } = await supabase
        .from('church_members')
        .select('id, full_name')
        .eq('church_id', role.entity_id)
        .ilike('full_name', `%${search}%`)
        .limit(10);
      setMembers(data || []);
    }
    setLoading(false);
  }

  // ACTIONS
  async function handleUpdateAppointment(id: string, status: 'APPROVED' | 'REJECTED') {
    const { error } = await supabase.from('pastoral_appointments').update({ status }).eq('id', id);
    if (!error) loadData();
  }

  async function handleUpdatePrayer(id: string, status: 'PRAYED' | 'ANSWERED') {
    const { error } = await supabase.from('pastoral_prayer_requests').update({ status }).eq('id', id);
    if (!error) loadData();
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>⬅ Accueil</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Bureau Pastoral</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* TABS */}
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'RDV' && styles.tabActive]} onPress={() => setActiveTab('RDV')}>
          <Text style={[styles.tabText, activeTab === 'RDV' && styles.tabTextActive]}>RDV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'PRAYERS' && styles.tabActive]} onPress={() => setActiveTab('PRAYERS')}>
          <Text style={[styles.tabText, activeTab === 'PRAYERS' && styles.tabTextActive]}>Prières</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'FOLLOWUP' && styles.tabActive]} onPress={() => setActiveTab('FOLLOWUP')}>
          <Text style={[styles.tabText, activeTab === 'FOLLOWUP' && styles.tabTextActive]}>Suivi</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0f172a" style={{ marginTop: 50 }} />
      ) : (
        <View style={{ flex: 1 }}>
          
          {/* VUE RENDEZ-VOUS */}
          {activeTab === 'RDV' && (
            <FlatList
              data={appointments}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={styles.emptyText}>Aucun RDV en attente.</Text>}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{item.member?.full_name}</Text>
                  <Text style={styles.cardSub}>{item.type} • {new Date(item.appointment_date).toLocaleDateString()} à {item.appointment_time.slice(0,5)}</Text>
                  <View style={styles.rowActions}>
                    <TouchableOpacity style={styles.btnApprove} onPress={() => handleUpdateAppointment(item.id, 'APPROVED')}><Text style={styles.btnText}>Valider</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.btnReject} onPress={() => handleUpdateAppointment(item.id, 'REJECTED')}><Text style={styles.btnText}>Refuser</Text></TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}

          {/* VUE PRIÈRES */}
          {activeTab === 'PRAYERS' && (
            <FlatList
              data={prayers}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={styles.emptyText}>Aucune requête en attente.</Text>}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{item.is_anonymous ? 'Fidèle Anonyme' : item.member?.full_name}</Text>
                  <Text style={styles.cardBody}>"{item.body}"</Text>
                  <TouchableOpacity style={styles.btnPray} onPress={() => handleUpdatePrayer(item.id, 'PRAYED')}><Text style={styles.btnText}>🙏 Marquer comme prié</Text></TouchableOpacity>
                </View>
              )}
            />
          )}

          {/* VUE SUIVI (Simplifiée pour mobile) */}
          {activeTab === 'FOLLOWUP' && (
            <View style={{ flex: 1 }}>
              <TextInput style={styles.searchBar} placeholder="Chercher un membre..." value={search} onChangeText={(t) => {setSearch(t); loadData();}} />
              <FlatList
                data={members}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.memberItem}>
                    <Text style={styles.memberName}>{item.full_name}</Text>
                    <Text style={styles.memberAction}>Voir dossier ➔</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  backBtn: { color: '#64748b', fontWeight: 'bold' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#fff', elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#0f172a' },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontWeight: 'bold', fontSize: 16, color: '#0f172a' },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 4 },
  cardBody: { fontSize: 13, fontStyle: 'italic', color: '#475569', marginVertical: 10 },
  rowActions: { flexDirection: 'row', gap: 10, marginTop: 15 },
  btnApprove: { flex: 1, backgroundColor: '#10b981', padding: 10, borderRadius: 8, alignItems: 'center' },
  btnReject: { flex: 1, backgroundColor: '#ef4444', padding: 10, borderRadius: 8, alignItems: 'center' },
  btnPray: { backgroundColor: '#3b82f6', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  btnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8' },
  searchBar: { backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 15 },
  memberItem: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 8 },
  memberName: { fontWeight: '600' },
  memberAction: { fontSize: 12, color: '#3b82f6' }
});