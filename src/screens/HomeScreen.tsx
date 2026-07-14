// src/screens/HomeScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import ProfileScreen from './ProfileScreen';

type Tab = 'FEED' | 'DEPTS' | 'PROFILE';

export default function HomeScreen({ 
  onNavigateToAppointment, 
  onNavigateToPrayer, 
  onNavigateToPastor, 
  onNavigateToSecretariat, 
  onNavigateToFinance,
  onNavigateToSubGroup,
  onNavigateToDepartment // 🔴 NOUVEAU
}: any) {
  const [activeTab, setActiveTab] = useState<Tab>('FEED');
  const [userName, setUserName] = useState('Fidèle');
  const [myRole, setMyRole] = useState('MEMBER');

  useEffect(() => {
    async function initUser() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user?.id).single();
      if (roleData) setMyRole(roleData.role);

      let fetchedName = '';
      const { data: crm } = await supabase.from('church_members').select('full_name').eq('user_id', user?.id).single();
      if (crm?.full_name) fetchedName = crm.full_name;
      else {
        const { data: authProfile } = await supabase.from('user_profiles').select('full_name').eq('id', user?.id).single();
        if (authProfile) fetchedName = authProfile.full_name;
      }
      if (fetchedName) {
        const nameParts = fetchedName.split(' ');
        setUserName(['Mme', 'M.', 'Mr', 'Mme.'].includes(nameParts[0]) && nameParts.length > 1 ? nameParts[1] : nameParts[0]);
      }
    }
    initUser();
  }, []);

  const FeedView = () => {
    const [loadingFeed, setLoadingFeed] = useState(true);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [programs, setPrograms] = useState<any[]>([]);

    useEffect(() => {
      async function loadFeed() {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: role } = await supabase.from('user_roles').select('entity_id').eq('user_id', user?.id).single();
        const { data: crm } = await supabase.from('church_members').select('church_id').eq('user_id', user?.id).single();
        const churchId = role?.entity_id || crm?.church_id;

        if (churchId) {
          // Annonces récentes uniquement (publiées il y a moins de 30 jours).
          // On ne montre pas les "annonces passées" : une annonce vieille
          // de plus d'un mois n'a plus de valeur informative pour le
          // fidèle qui ouvre l'app aujourd'hui.
          // → Filtre : created_at > now() - 30 jours
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString()
          const { data: ann } = await supabase
            .from('church_announcements')
            .select('*')
            .eq('church_id', churchId)
            .gt('created_at', thirtyDaysAgo)
            .order('created_at', { ascending: false })
            .limit(3)
          setAnnouncements(ann || [])

          // Programmes à venir (ponctuels + occurrences matérialisées
          // depuis les templates récurrents). Les deux types vivent dans
          // la même table `church_programs` (cf. RPC materialize_*) →
          // une seule requête suffit pour tout afficher de façon
          // cohérente. On filtre :
          //   - is_archived = false : exclut les programmes passés
          //                          archivés par l'admin
          //   - start_at >= now     : on ne montre que le futur
          // Tri : start_at ASC → du plus proche au plus loin.
          const { data: prog } = await supabase
            .from('church_programs')
            .select('*')
            .eq('church_id', churchId)
            .eq('is_archived', false)
            .gte('start_at', new Date().toISOString())
            .order('start_at', { ascending: true })
            .limit(10)
          setPrograms(prog || [])
        }
        setLoadingFeed(false)
      }
      loadFeed()
    }, [])

    // Format court : ex. "dim. 14 juil., 09:00"
    const formatDate = (date: string) => new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

    // Détecte si un programme est une occurrence d'un template récurrent.
    // Heuristique : on considère récurrent tout programme qui n'a PAS
    // de description ET qui a un location == 'Temple principal' (valeur
    // par défaut posée par le formulaire de récurrence) ET dont la
    // catégorie n'est pas "Événement".
    // → Si l'admin a posé un event "exceptionnel" (Séminaire, Événement)
    //   ou renseigné une description, on l'affiche comme ponctuel.
    function isRecurringOccurrence(p: any): boolean {
      if (p.description && p.description.trim().length > 0) return false
      const punctualCats = ['Événement', 'Séminaire']
      if (punctualCats.includes(p.category)) return false
      return true
    }

    return (
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <Text style={styles.welcomeText}>Bonjour {userName} ! 👋</Text>
        <View style={{ marginTop: 5, paddingBottom: 20 }}>
          {myRole === 'CHURCH_LEADER' && (<TouchableOpacity style={[styles.adminBtn, { backgroundColor: '#3b82f6' }]} onPress={onNavigateToPastor}><Text style={styles.adminBtnText}>👔 Espace Pastoral</Text></TouchableOpacity>)}
          {myRole === 'SECRETARY' && (<TouchableOpacity style={[styles.adminBtn, { backgroundColor: '#8b5cf6' }]} onPress={onNavigateToSecretariat}><Text style={styles.adminBtnText}>🗂️ Espace Secrétariat</Text></TouchableOpacity>)}
          {myRole === 'FINANCE_MANAGER' && (<TouchableOpacity style={[styles.adminBtn, { backgroundColor: '#10b981' }]} onPress={onNavigateToFinance}><Text style={styles.adminBtnText}>💰 Espace Finances</Text></TouchableOpacity>)}
          {/* Le bouton Département renvoie désormais à l'onglet avec les cartes pour être plus clair */}
          {myRole === 'DEPARTMENT_LEADER' && (<TouchableOpacity style={[styles.adminBtn, { backgroundColor: '#f59e0b' }]} onPress={() => setActiveTab('DEPTS')}><Text style={styles.adminBtnText}>👥 Gestion Départements</Text></TouchableOpacity>)}
        </View>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={onNavigateToAppointment}><Text style={styles.quickIcon}>📅</Text><Text style={styles.quickLabel}>Prendre RDV</Text></TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={onNavigateToPrayer}><Text style={styles.quickIcon}>🙏</Text><Text style={styles.quickLabel}>Sujet de Prière</Text></TouchableOpacity>
        </View>
        {loadingFeed ? ( <ActivityIndicator size="small" color="#0f172a" style={{ marginVertical: 20 }} /> ) : (
          <>
            <Text style={styles.sectionTitle}>Actualités de l'Église</Text>
            {announcements.length === 0 ? (<Text style={styles.emptyText}>Aucune annonce.</Text>) : (announcements.map(ann => (<View key={ann.id} style={styles.announcementCard}>{ann.is_pinned && <Text style={styles.pinnedBadge}>📌 Épinglé</Text>}<Text style={styles.announcementTitle}>{ann.title}</Text><Text style={styles.announcementBody} numberOfLines={3}>{ann.body}</Text><Text style={styles.dateText}>{new Date(ann.created_at).toLocaleDateString('fr-FR')}</Text></View>)))}
            <Text style={styles.sectionTitle}>Planning des réunions</Text>
            {programs.length === 0 ? (<Text style={styles.emptyText}>Aucun programme.</Text>) : (<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingBottom: 10 }}>{programs.map(prog => {
              const isRecurring = isRecurringOccurrence(prog)
              return (
                <View key={prog.id} style={styles.programCard}>
                  <View style={styles.programHeaderRow}>
                    <Text style={styles.programCategory}>{prog.category || 'Événement'}</Text>
                    {isRecurring && (
                      <View style={styles.recurringBadge}>
                        <Text style={styles.recurringBadgeText}>🔁 Récurrent</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.programTitle} numberOfLines={1}>{prog.title}</Text>
                  <Text style={styles.programTime}>⏱ {formatDate(prog.start_at)}</Text>
                  <Text style={styles.programLocation}>📍 {prog.location}</Text>
                </View>
              )
            })}</ScrollView>)}
          </>
        )}
      </ScrollView>
    );
  };

  const DepartmentsView = () => {
    const [loading, setLoading] = useState(true);
    const [departments, setDepartments] = useState<any[]>([]);
    const [myRequests, setMyRequests] = useState<any[]>([]);
    
    // Groupes (Adjanor)
    const [ledGroups, setLedGroups] = useState<any[]>([]);
    const [memberGroups, setMemberGroups] = useState<any[]>([]); 
    
    // Départements (Joël & Membres)
    const [ledDepts, setLedDepts] = useState<any[]>([]);
    const [memberDepts, setMemberDepts] = useState<any[]>([]);

    useEffect(() => { loadDepts(); }, []);

    async function loadDepts() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: role } = await supabase.from('user_roles').select('entity_id').eq('user_id', user?.id).single();
      const { data: crm } = await supabase.from('church_members').select('church_id').eq('user_id', user?.id).single();
      const churchId = role?.entity_id || crm?.church_id;

      if (churchId) {
        const { data: depts } = await supabase.from('church_departments').select('*').eq('church_id', churchId);
        setDepartments(depts || []);

        const { data: reqs } = await supabase.from('department_members').select('*').eq('user_id', user?.id);
        const allRequests = reqs || [];
        setMyRequests(allRequests);

        // 1. Groupes du membre
        const { data: myGroups } = await supabase.from('department_groups').select('*').eq('leader_id', user?.id);
        setLedGroups(myGroups || []);

        const approvedSubGroupIds = allRequests.filter(r => r.status === 'APPROVED' && r.sub_group_id).map(r => r.sub_group_id);
        if (approvedSubGroupIds.length > 0) {
          const { data: memGroups } = await supabase.from('department_groups').select('*').in('id', approvedSubGroupIds);
          setMemberGroups((memGroups || []).filter(g => g.leader_id !== user?.id));
        }

        // 2. Départements du membre
        const { data: myDeptRoles } = await supabase.from('user_roles').select('*').eq('user_id', user?.id).eq('role', 'DEPARTMENT_LEADER');
        const ledDeptIds = (myDeptRoles || []).map(r => r.department_id);
        setLedDepts(ledDeptIds);

        const approvedDeptIds = allRequests.filter(r => r.status === 'APPROVED' && !ledDeptIds.includes(r.department_id)).map(r => r.department_id);
        setMemberDepts(approvedDeptIds);
      }
      setLoading(false);
    }

    async function handleJoin(deptId: string, deptName: string, existingRequestId?: string) {
      Alert.alert('Rejoindre', `Envoyer une demande pour : ${deptName} ?`, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (existingRequestId) { await supabase.from('department_members').update({ status: 'PENDING', updated_at: new Date().toISOString() }).eq('id', existingRequestId);
            } else { await supabase.from('department_members').insert({ department_id: deptId, user_id: user?.id, status: 'PENDING' }); }
            Alert.alert('Succès', 'Demande envoyée.'); loadDepts();
        }}
      ]);
    }

    if (loading) return <ActivityIndicator style={{marginTop: 50}} color="#0f172a" />;

    return (
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionTitle, { marginLeft: 20, marginTop: 20 }]}>Vos Accès</Text>
        
        <FlatList
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          data={departments}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={{ marginBottom: 20 }}>
              {/* CARTES DÉPARTEMENTS */}
              {ledDepts.map(deptId => {
                const dept = departments.find(d => d.id === deptId);
                if(!dept) return null;
                return (
                  <TouchableOpacity key={`led_d_${dept.id}`} style={styles.accessCardLeader} onPress={() => onNavigateToDepartment && onNavigateToDepartment(dept.id)}>
                    <View><Text style={styles.accessCardLeaderTitle}>👑 {dept.custom_name || dept.name}</Text><Text style={styles.accessCardLeaderSub}>Gérer le département</Text></View><Text style={styles.accessCardLeaderTitle}>➔</Text>
                  </TouchableOpacity>
                )
              })}
              {memberDepts.map(deptId => {
                const dept = departments.find(d => d.id === deptId);
                if(!dept) return null;
                return (
                  <TouchableOpacity key={`mem_d_${dept.id}`} style={styles.accessCardMember} onPress={() => onNavigateToDepartment && onNavigateToDepartment(dept.id)}>
                    <View><Text style={styles.accessCardMemberTitle}>👥 {dept.custom_name || dept.name}</Text><Text style={styles.accessCardMemberSub}>Mon département</Text></View><Text style={styles.accessCardMemberTitle}>➔</Text>
                  </TouchableOpacity>
                )
              })}

              {/* CARTES GROUPES */}
              {ledGroups.map(group => (
                <TouchableOpacity key={`led_g_${group.id}`} style={styles.accessCardLeader} onPress={() => onNavigateToSubGroup && onNavigateToSubGroup(group.id)}>
                  <View><Text style={styles.accessCardLeaderTitle}>👑 {group.name}</Text><Text style={styles.accessCardLeaderSub}>Gérer mon sous-groupe</Text></View><Text style={styles.accessCardLeaderTitle}>➔</Text>
                </TouchableOpacity>
              ))}
              {memberGroups.map(group => (
                <TouchableOpacity key={`mem_g_${group.id}`} style={styles.accessCardMember} onPress={() => onNavigateToSubGroup && onNavigateToSubGroup(group.id)}>
                  <View><Text style={styles.accessCardMemberTitle}>🎵 {group.name}</Text><Text style={styles.accessCardMemberSub}>Mon sous-groupe</Text></View><Text style={styles.accessCardMemberTitle}>➔</Text>
                </TouchableOpacity>
              ))}
              
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Tous les départements locaux</Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.emptyText}>Aucun département local.</Text>}
          renderItem={({ item }) => {
            const request = myRequests.find(r => r.department_id === item.id);
            const displayName = item.custom_name || item.name || 'Département';
            
            let canReapply = false;
            let nextTryDate = null;
            if (request && request.status === 'REJECTED') {
               const rejectDate = new Date(request.updated_at || request.created_at);
               nextTryDate = new Date(rejectDate.getTime() + 7 * 24 * 60 * 60 * 1000);
               canReapply = new Date() >= nextTryDate;
            }

            return (
              <View style={styles.deptCard}>
                <View style={{ flex: 1, paddingRight: 10 }}><Text style={styles.deptName}>{displayName}</Text><Text style={styles.deptDesc}>{item.description || "Département"}</Text></View>
                {!request || canReapply ? ( <TouchableOpacity style={styles.joinBtn} onPress={() => handleJoin(item.id, displayName, request?.id)}><Text style={styles.joinBtnText}>{canReapply ? 'Réessayer' : '+ Rejoindre'}</Text></TouchableOpacity>
                ) : request.status === 'PENDING' ? ( <Text style={styles.statusPending}>⏳ Attente</Text>
                ) : request.status === 'APPROVED' ? ( <Text style={styles.statusApproved}>✅ Membre</Text>
                ) : ( <View style={{ alignItems: 'flex-end' }}><Text style={styles.statusRejected}>❌ Refusé</Text><Text style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>Dispo {nextTryDate?.toLocaleDateString('fr-FR')}</Text></View> )}
              </View>
            );
          }}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topHeader}><Text style={styles.headerTitle}>Revival Culture</Text></View>
      <View style={{ flex: 1 }}>
        {activeTab === 'FEED' && <FeedView />}
        {activeTab === 'DEPTS' && <DepartmentsView />}
        {activeTab === 'PROFILE' && <ProfileScreen />}
      </View>
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('FEED')}><Text style={[styles.navIcon, activeTab === 'FEED' && styles.navIconActive]}>🏠</Text><Text style={[styles.navText, activeTab === 'FEED' && styles.navTextActive]}>Accueil</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('DEPTS')}><Text style={[styles.navIcon, activeTab === 'DEPTS' && styles.navIconActive]}>👥</Text><Text style={[styles.navText, activeTab === 'DEPTS' && styles.navTextActive]}>Départements</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('PROFILE')}><Text style={[styles.navIcon, activeTab === 'PROFILE' && styles.navIconActive]}>👤</Text><Text style={[styles.navText, activeTab === 'PROFILE' && styles.navTextActive]}>Profil</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  topHeader: { paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  scrollArea: { flex: 1, padding: 20 },
  welcomeText: { fontSize: 24, fontWeight: 'bold', color: '#0f172a', marginBottom: 10 },
  quickActions: { flexDirection: 'row', gap: 15, marginBottom: 30 },
  quickBtn: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  quickIcon: { fontSize: 24, marginBottom: 5 },
  quickLabel: { fontSize: 13, fontWeight: '600', color: '#334155' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginTop: 10, marginBottom: 10 },
  emptyText: { fontStyle: 'italic', color: '#94a3b8', marginBottom: 20 },
  
  accessCardLeader: { backgroundColor: '#0f172a', padding: 15, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  accessCardLeaderTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  accessCardLeaderSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  
  accessCardMember: { backgroundColor: '#3b82f6', padding: 15, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  accessCardMemberTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  accessCardMemberSub: { color: '#bfdbfe', fontSize: 12, marginTop: 2 },

  announcementCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  pinnedBadge: { alignSelf: 'flex-start', backgroundColor: '#fee2e2', color: '#ef4444', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
  announcementTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  announcementBody: { fontSize: 13, color: '#475569', lineHeight: 20 },
  dateText: { fontSize: 10, color: '#94a3b8', marginTop: 8, textAlign: 'right' },
  programCard: { backgroundColor: '#0f172a', padding: 16, borderRadius: 16, width: 240, marginRight: 15 },
  programHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  programCategory: { color: '#38bdf8', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  recurringBadge: { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: '#38bdf8', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  recurringBadgeText: { color: '#38bdf8', fontSize: 9, fontWeight: 'bold' },
  programTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  programTime: { color: '#cbd5e1', fontSize: 12, marginBottom: 4 },
  programLocation: { color: '#94a3b8', fontSize: 11 },
  adminBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  adminBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  deptCard: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deptName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  deptDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  joinBtn: { backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  joinBtnText: { color: '#0f172a', fontSize: 12, fontWeight: 'bold' },
  statusPending: { fontSize: 12, color: '#f59e0b', fontWeight: 'bold' },
  statusApproved: { fontSize: 12, color: '#10b981', fontWeight: 'bold' },
  statusRejected: { fontSize: 12, color: '#ef4444', fontWeight: 'bold' },
  bottomNav: { flexDirection: 'row', backgroundColor: '#fff', paddingBottom: 25, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon: { fontSize: 20, opacity: 0.5 },
  navIconActive: { opacity: 1 },
  navText: { fontSize: 10, color: '#64748b', marginTop: 4, fontWeight: '500' },
  navTextActive: { color: '#0f172a', fontWeight: 'bold' }
});