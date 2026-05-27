// src/screens/SecretariatDashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { supabase } from '../lib/supabase';

type Tab = 'PENDING' | 'REGISTRY' | 'AGENDA' | 'STAFF';

export default function SecretariatDashboardScreen({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('PENDING');
  const [loading, setLoading] = useState(true);
  const [churchId, setChurchId] = useState<string | null>(null);
  
  // Données
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [registryMembers, setRegistryMembers] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [availableDepts, setAvailableDepts] = useState<any[]>([]);
  
  // États secondaires
  const [search, setSearch] = useState('');
  const [rejectMotiveModal, setRejectMotiveModal] = useState<{visible: boolean, appointmentId: string | null}>({visible: false, appointmentId: null});
  const [motive, setMotive] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: role } = await supabase.from('user_roles').select('entity_id').eq('user_id', user?.id).single();

    if (activeTab === 'STAFF') {
        // Charger les membres
        const { data: members } = await supabase.from('church_members').select('id, full_name, user_id').eq('church_id', role.entity_id).eq('status', 'APPROVED').not('user_id', 'is', null);
        setStaffList(members || []);

        // Charger les départements
        const { data: depts } = await supabase.from('church_departments').select('id, name').eq('church_id', role.entity_id);
        setAvailableDepts(depts || []);
    }

    if (!role) return;
    setChurchId(role.entity_id);

    if (activeTab === 'PENDING') {
      const { data } = await supabase.from('church_members').select('*').eq('church_id', role.entity_id).eq('status', 'PENDING').order('created_at', { ascending: false });
      setPendingMembers(data || []);
    } 
    else if (activeTab === 'REGISTRY') {
      const { data } = await supabase.from('church_members').select('*').eq('church_id', role.entity_id).eq('status', 'APPROVED').ilike('full_name', `%${search}%`).limit(20);
      setRegistryMembers(data || []);
    } 
    else if (activeTab === 'AGENDA') {
      const { data } = await supabase.from('pastoral_appointments').select(`*, member:user_profiles!pastoral_appointments_member_id_fkey(full_name)`).eq('church_id', role.entity_id).order('appointment_date', { ascending: true });
      setAppointments(data || []);
    }
    else if (activeTab === 'STAFF') {
      // Charger les membres
      const { data: members } = await supabase.from('church_members').select('id, full_name, user_id').eq('church_id', role.entity_id).eq('status', 'APPROVED').not('user_id', 'is', null);
      setStaffList(members || []);
      
      // 🔴 Charger les départements disponibles pour cette église
      const { data: depts } = await supabase.from('church_departments').select('id, name').eq('church_id', role.entity_id);
      setAvailableDepts(depts || []);
    }
    setLoading(false);
  }

  // --- ACTIONS ADHÉSIONS ---
  async function handleApproveMember(id: string) {
    await supabase.from('church_members').update({ status: 'APPROVED' }).eq('id', id);
    loadData();
  }

  // --- ACTIONS AGENDA ---
  async function handleApproveAgenda(id: string) {
    await supabase.from('pastoral_appointments').update({ status: 'APPROVED', pastor_note: 'Rendez-vous confirmé par le secrétariat.' }).eq('id', id);
    loadData();
  }

  async function handleRejectAgenda() {
    if (!motive.trim()) return Alert.alert('Erreur', 'Veuillez saisir un motif.');
    if (rejectMotiveModal.appointmentId) {
      await supabase.from('pastoral_appointments').update({ status: 'REJECTED', pastor_note: motive }).eq('id', rejectMotiveModal.appointmentId);
      setRejectMotiveModal({visible: false, appointmentId: null});
      setMotive('');
      loadData();
    }
  }

  async function handlePromoteToDeptLeader(userId: string) {
    if (!userId) return Alert.alert('Erreur', 'Ce membre n\'a pas de compte connecté.');
    if (availableDepts.length === 0) return Alert.alert('Erreur', "Créez d'abord des départements sur le web.");
    
    // Créer la liste des options à afficher
    const options = availableDepts.map(dept => ({
      text: dept.name,
      onPress: async () => {
        const { error } = await supabase.from('user_roles').insert({ 
          user_id: userId, 
          role: 'DEPARTMENT_LEADER', 
          entity_id: churchId,
          department_id: dept.id // 👈 On sauvegarde le département choisi
        });
        if (error) Alert.alert('Erreur', 'Ce membre a déjà un rôle administratif.');
        else Alert.alert('Succès', `Nommé responsable de : ${dept.name}`);
      }
    }));

    Alert.alert(
      'Nommer un Responsable', 
      'Choisissez le département à lui confier :', 
      [...options, { text: 'Annuler', style: 'cancel' }]
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>⬅ Accueil</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Secrétariat</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* TABS SCROLLABLES */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={[styles.tab, activeTab === 'PENDING' && styles.tabActive]} onPress={() => setActiveTab('PENDING')}>
            <Text style={[styles.tabText, activeTab === 'PENDING' && styles.tabTextActive]}>En attente</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'REGISTRY' && styles.tabActive]} onPress={() => setActiveTab('REGISTRY')}>
            <Text style={[styles.tabText, activeTab === 'REGISTRY' && styles.tabTextActive]}>Registre</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'AGENDA' && styles.tabActive]} onPress={() => setActiveTab('AGENDA')}>
            <Text style={[styles.tabText, activeTab === 'AGENDA' && styles.tabTextActive]}>Agenda</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'STAFF' && styles.tabActive]} onPress={() => setActiveTab('STAFF')}>
            <Text style={[styles.tabText, activeTab === 'STAFF' && styles.tabTextActive]}>Staff</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#8b5cf6" style={{ marginTop: 50 }} />
      ) : (
        <View style={{ flex: 1 }}>
          
          {/* ONGLET 1 : EN ATTENTE */}
          {activeTab === 'PENDING' && (
            <FlatList data={pendingMembers} keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={styles.emptyText}>Aucune nouvelle inscription.</Text>}
              renderItem={({ item }) => (
                <View style={[styles.card, { borderLeftColor: '#f59e0b', borderLeftWidth: 4 }]}>
                  <Text style={styles.cardTitle}>{item.full_name}</Text>
                  <Text style={styles.cardSub}>{item.email}</Text>
                  <TouchableOpacity style={[styles.btnApprove, {marginTop: 10}]} onPress={() => handleApproveMember(item.id)}><Text style={styles.btnText}>Accepter l'inscription</Text></TouchableOpacity>
                </View>
              )}
            />
          )}

          {/* ONGLET 2 : REGISTRE */}
          {activeTab === 'REGISTRY' && (
            <View style={{ flex: 1 }}>
              <TextInput style={styles.searchBar} placeholder="Chercher un membre..." value={search} onChangeText={(t) => {setSearch(t); loadData();}} />
              <FlatList data={registryMembers} keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.memberItem}>
                    <Text style={styles.memberName}>{item.full_name}</Text>
                    <Text style={{fontSize: 10, color: '#10b981', fontWeight: 'bold'}}>ACTIF</Text>
                  </View>
                )}
              />
            </View>
          )}

          {/* ONGLET 3 : AGENDA (Avec Motif d'Annulation) */}
          {activeTab === 'AGENDA' && (
            <FlatList data={appointments} keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={styles.emptyText}>Aucun RDV dans l'agenda.</Text>}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{item.member?.full_name || 'Inconnu'}</Text>
                  <Text style={styles.cardSub}>{item.type} • {new Date(item.appointment_date).toLocaleDateString()} à {item.appointment_time.slice(0,5)}</Text>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', marginTop: 5, color: item.status === 'APPROVED' ? '#10b981' : item.status === 'REJECTED' ? '#ef4444' : '#f59e0b' }}>
                    STATUT : {item.status}
                  </Text>
                  
                  {item.status === 'PENDING' && (
                    <View style={styles.rowActions}>
                      <TouchableOpacity style={styles.btnApprove} onPress={() => handleApproveAgenda(item.id)}><Text style={styles.btnText}>Valider</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.btnReject} onPress={() => setRejectMotiveModal({visible: true, appointmentId: item.id})}><Text style={styles.btnText}>Annuler</Text></TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            />
          )}

          {/* ONGLET 4 : STAFF / DÉPARTEMENTS */}
          {activeTab === 'STAFF' && (
            <FlatList data={staffList} keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={styles.emptyText}>Aucun membre inscrit sur l'application.</Text>}
              renderItem={({ item }) => (
                <View style={styles.memberItem}>
                  <Text style={styles.memberName}>{item.full_name}</Text>
                  <TouchableOpacity style={styles.btnRole} onPress={() => handlePromoteToDeptLeader(item.user_id)}>
                    <Text style={{fontSize: 10, color: '#fff', fontWeight: 'bold'}}>+ Nommer Resp.</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}

        </View>
      )}

      {/* MODAL POUR LE MOTIF D'ANNULATION AGENDA */}
      <Modal visible={rejectMotiveModal.visible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Motif de l'annulation</Text>
            <TextInput 
              style={styles.modalInput} 
              placeholder="Ex: Le pasteur est en déplacement..." 
              multiline 
              value={motive} 
              onChangeText={setMotive} 
            />
            <View style={styles.rowActions}>
              <TouchableOpacity style={styles.btnReject} onPress={() => {setRejectMotiveModal({visible: false, appointmentId: null}); setMotive('');}}><Text style={styles.btnText}>Fermer</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnApprove} onPress={handleRejectAgenda}><Text style={styles.btnText}>Confirmer l'annulation</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  backBtn: { color: '#64748b', fontWeight: 'bold' },
  tabContainer: { backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { paddingVertical: 10, paddingHorizontal: 15, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#fff', elevation: 2 },
  tabText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#0f172a', fontWeight: 'bold' },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontWeight: 'bold', fontSize: 15, color: '#0f172a' },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 4 },
  rowActions: { flexDirection: 'row', gap: 10, marginTop: 15 },
  btnApprove: { flex: 1, backgroundColor: '#10b981', padding: 10, borderRadius: 8, alignItems: 'center' },
  btnReject: { flex: 1, backgroundColor: '#ef4444', padding: 10, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8' },
  searchBar: { backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 15 },
  memberItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  memberName: { fontWeight: '600', fontSize: 14 },
  btnRole: { backgroundColor: '#8b5cf6', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  modalInput: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', height: 100, textAlignVertical: 'top' }
});