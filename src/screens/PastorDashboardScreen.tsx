// src/screens/PastorDashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  ActivityIndicator, Alert, ScrollView, TextInput, Dimensions, 
  Platform, Modal, BackHandler, Linking
} from 'react-native';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

import EvangelismModule from '../components/departments/EvangelismModule';
import HeadcountModule from '../components/departments/HeadcountModule';

const { width } = Dimensions.get('window');
const DAYS_OF_WEEK = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// === VUES PRINCIPALES DU PASTEUR ===
type ViewState = 
  | 'HUB' | 'BUREAU' | 'AGENDA' | 'PRAYERS' | 'FOLLOWUP' | 'FOLLOWUP_DETAIL' 
  | 'MEMBERS' | 'FINANCES' 
  | 'DEPTS_LIST' | 'DEPT_HUB' | 'DEPT_PENDING' | 'DEPT_MEMBERS' | 'DEPT_SOULS' | 'DEPT_HEADCOUNTS' 
  | 'DEPT_FINANCES' | 'DEPT_PROJECTS' | 'DEPT_EQUIPMENTS' | 'DEPT_PLANNING' | 'DEPT_ANNOUNCEMENTS' 
  | 'DEPT_SONGS' | 'DEPT_CHILDREN';

type BureauTab = 'ANNOUNCEMENTS' | 'PROGRAMS';
type AgendaTab = 'AVAILABILITY' | 'PENDING' | 'SCHEDULED' | 'HISTORY';

export default function PastorDashboardScreen({ onBack }: { onBack: () => void }) {
  const [currentView, setCurrentView] = useState<ViewState>('HUB');
  const [loading, setLoading] = useState(true);
  const [churchInfo, setChurchInfo] = useState<any>(null);
  
  // 🔴 Confirmation modale pour la sortie
  const [exitModalVisible, setExitModalVisible] = useState(false);
  
  // HUB stats
  const [stats, setStats] = useState({
    membersCount: 0,
    departmentsCount: 0,
    pendingAppts: 0,
    pendingPrayers: 0,
    totalBalance: 0,
    monthIncome: 0,
    soulsCount: 0,
    integrationPending: 0,
  });

  // Data
  const [appointments, setAppointments] = useState<any[]>([]);
  const [prayers, setPrayers] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [finances, setFinances] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [availabilities, setAvailabilities] = useState<any[]>([]);
  const [memberNotes, setMemberNotes] = useState<any[]>([]);
  
  // 🔴 DÉPARTEMENTS
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [deptPending, setDeptPending] = useState<any[]>([]);
  const [deptMembers, setDeptMembers] = useState<any[]>([]);
  const [deptGroups, setDeptGroups] = useState<any[]>([]);
  const [deptFinances, setDeptFinances] = useState<any[]>([]);
  const [deptProjects, setDeptProjects] = useState<any[]>([]);
  const [deptTasks, setDeptTasks] = useState<any[]>([]);
  const [deptSelectedProjectId, setDeptSelectedProjectId] = useState<string | null>(null);
  const [deptEquipment, setDeptEquipment] = useState<any[]>([]);
  const [deptEquipmentNeeds, setDeptEquipmentNeeds] = useState<any[]>([]);
  const [deptEquipmentTab, setDeptEquipmentTab] = useState<'INVENTORY' | 'NEEDS'>('INVENTORY');
  const [deptPlannings, setDeptPlannings] = useState<any[]>([]);
  const [deptAnnouncements, setDeptAnnouncements] = useState<any[]>([]);
  const [deptHeadcounts, setDeptHeadcounts] = useState<any[]>([]);
  const [deptSongs, setDeptSongs] = useState<any[]>([]);
  const [deptChildren, setDeptChildren] = useState<any[]>([]);
  const [deptSouls, setDeptSouls] = useState<any[]>([]);
  const [deptPlanningRoles, setDeptPlanningRoles] = useState<any[]>([]);
  
  // Détection du type de département
  const [deptType, setDeptType] = useState<{
    isChoir: boolean; isChildren: boolean; isEvangelism: boolean; isMedia: boolean; isUsher: boolean; hasSubGroups: boolean;
  }>({ isChoir: false, isChildren: false, isEvangelism: false, isMedia: false, isUsher: false, hasSubGroups: false });

  // Sub-tabs
  const [bureauTab, setBureauTab] = useState<BureauTab>('ANNOUNCEMENTS');
  const [agendaTab, setAgendaTab] = useState<AgendaTab>('PENDING');
  
  // Search
  const [search, setSearch] = useState('');
  const [followupSearch, setFollowupSearch] = useState('');
  const [selectedFollowupMember, setSelectedFollowupMember] = useState<any>(null);
  const [deptMembersFilter, setDeptMembersFilter] = useState('Tous');
  
  // Form visibility
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [showAvailabilityForm, setShowAvailabilityForm] = useState(false);
  
  // Modals
  const [noteEditorVisible, setNoteEditorVisible] = useState(false);
  const [editingNote, setEditingNote] = useState('');
  const [editingApptId, setEditingApptId] = useState<string | null>(null);
  
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingApptId, setRejectingApptId] = useState<string | null>(null);

  // Modale détail d'un département
  const [deptDetailModalVisible, setDeptDetailModalVisible] = useState(false);

  // ===================== EFFECTS =====================
  useEffect(() => { loadAllData(); }, []);
  
  useEffect(() => {
    if (selectedFollowupMember) {
      supabase.from('pastoral_spiritual_notes').select('*')
        .eq('member_id', selectedFollowupMember.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setMemberNotes(data || []));
    } else { 
      setMemberNotes([]); 
    }
  }, [selectedFollowupMember]);

  // 🔴 Bloquer le bouton retour hardware Android sur le HUB
  useEffect(() => {
    const backAction = () => {
      if (currentView === 'HUB') {
        setExitModalVisible(true);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [currentView]);

  // ===================== CHARGEMENT =====================
  async function loadAllData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: role } = await supabase.from('user_roles').select('entity_id').eq('user_id', user?.id).single();
      const churchId = role?.entity_id;
      if (!churchId) { setLoading(false); return; }

      const { data: churchData } = await supabase.from('churches').select('name').eq('id', churchId).single();
      setChurchInfo(churchData);

      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const [
        membersCountRes, deptsCountRes, apptsRes, prayersRes, 
        financesRes, membersListRes, announcementsRes, programsRes, availabilitiesRes, deptsRes, soulsRes, integRes
      ] = await Promise.all([
        supabase.from('church_members').select('*', { count: 'exact', head: true }).eq('church_id', churchId).eq('status', 'APPROVED'),
        supabase.from('church_departments').select('*').eq('church_id', churchId).order('name', { ascending: true }),
        supabase.from('pastoral_appointments').select(`*, member:user_profiles!pastoral_appointments_member_id_fkey(full_name)`).eq('church_id', churchId).order('appointment_date', { ascending: true }),
        supabase.from('pastoral_prayer_requests').select(`*, member:user_profiles!pastoral_prayer_requests_member_id_fkey(full_name)`).eq('church_id', churchId).order('created_at', { ascending: false }),
        supabase.from('financial_entries').select('*, creator:user_profiles!financial_entries_created_by_fkey(full_name)').eq('church_id', churchId).order('created_at', { ascending: false }),
        supabase.from('church_members').select('id, full_name, phone, status').eq('church_id', churchId).order('full_name', { ascending: true }),
        supabase.from('church_announcements').select('*').eq('church_id', churchId).order('created_at', { ascending: false }).limit(20),
        supabase.from('church_programs').select('*').eq('church_id', churchId).order('start_at', { ascending: true }).limit(20),
        supabase.from('pastoral_availabilities').select('*').eq('church_id', churchId).order('day_of_week', { ascending: true }),
        supabase.from('church_departments').select('id, name, custom_name').eq('church_id', churchId),
        supabase.from('department_souls').select('id, integration_status').eq('integration_status', 'PENDING'),
        supabase.from('department_souls').select('id, department_id, first_name, last_name, integration_status').eq('integration_status', 'PENDING'),
      ]);

      let balance = 0, mIncome = 0;
      if (financesRes.data) {
        financesRes.data.forEach(entry => {
          const amt = Number(entry.amount) || 0;
          if (entry.type === 'INCOME') { balance += amt; if (entry.created_at >= startOfMonth) mIncome += amt; }
          else { balance -= amt; }
        });
      }

      const pendingApptsList = apptsRes.data?.filter(a => a.status === 'PENDING') || [];
      const pendingPrayersList = prayersRes.data?.filter(p => p.status === 'PENDING') || [];

      setStats({
        membersCount: membersCountRes.count || 0,
        departmentsCount: deptsCountRes.data?.length || 0,
        pendingAppts: pendingApptsList.length,
        pendingPrayers: pendingPrayersList.length,
        totalBalance: balance,
        monthIncome: mIncome,
        soulsCount: integRes.data?.length || 0,
        integrationPending: integRes.data?.length || 0,
      });

      setAppointments(apptsRes.data || []);
      setPrayers(prayersRes.data || []);
      setFinances(financesRes.data || []);
      setMembers(membersListRes.data || []);
      setAnnouncements(announcementsRes.data || []);
      setPrograms(programsRes.data || []);
      setAvailabilities(availabilitiesRes.data || []);
      setDepartments(deptsRes.data || []);

    } catch (error) { console.error(error); }
    setLoading(false);
  }

  // ===================== CHARGEMENT DÉPARTEMENT =====================
  async function loadDepartmentData(dept: any) {
    setLoading(true);
    try {
      const deptName = (dept.custom_name || dept.name || '').toLowerCase();
      const isChoir = !!deptName.match(/chorale|louange|mystic/);
      const isChild = !!deptName.match(/enfant|ecodim|dimanche/);
      const isEvang = !!deptName.match(/évangélisation|evangelisation|gagnants|âmes|mission/);
      const isMedia = !!deptName.match(/multimédia|multimedia|technique|sonorisation|communication|media/);
      const isUsher = !!deptName.match(/ordre|accueil|protocole|huissier/);
      setDeptType({ 
        isChoir, isChildren: isChild, isEvangelism: isEvang, isMedia, isUsher,
        hasSubGroups: isChoir || isUsher
      });

      // Charger les membres du département
      const reqsRes = await supabase.from('department_members').select('*').eq('department_id', dept.id).in('status', ['PENDING', 'APPROVED']);
      
      let activeMembs: any[] = [];
      if (reqsRes.data) {
        const userIds = reqsRes.data.map((r: any) => r.user_id);
        const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds);
        
        const pending = reqsRes.data.filter((r: any) => r.status === 'PENDING').map((r: any) => ({ 
          ...r, member: { full_name: profiles?.find(p => p.id === r.user_id)?.full_name || 'Fidèle' } 
        }));
        const approved = reqsRes.data.filter((r: any) => r.status === 'APPROVED').map((r: any) => ({ 
          ...r, member: { full_name: profiles?.find(p => p.id === r.user_id)?.full_name || 'Fidèle' } 
        }));
        setDeptPending(pending);
        setDeptMembers(approved);
        activeMembs = approved;
      }

      // Charger les autres données en parallèle
      const [
        groupsRes, financesRes, projectsRes, equipmentRes, equipmentNeedsRes, 
        planningsRes, announcementsRes, headcountsRes, songsRes, childrenRes, soulsRes,
        planningGroupsRes, announcementGroupsRes
      ] = await Promise.all([
        supabase.from('department_groups').select('*').eq('department_id', dept.id).order('created_at', { ascending: true }),
        supabase.from('department_finances').select('*').eq('department_id', dept.id).order('created_at', { ascending: false }),
        supabase.from('department_projects').select('*').eq('department_id', dept.id).order('created_at', { ascending: false }),
        supabase.from('department_equipments').select('*').eq('department_id', dept.id),
        supabase.from('department_equipment_needs').select('*').eq('department_id', dept.id),
        supabase.from('department_plannings').select('*').eq('department_id', dept.id).order('event_date', { ascending: true }),
        supabase.from('department_announcements').select('*').eq('department_id', dept.id).order('created_at', { ascending: false }),
        supabase.from('department_headcounts').select('*').eq('department_id', dept.id).order('event_date', { ascending: false }),
        isChoir ? supabase.from('department_songs').select('*').eq('department_id', dept.id).order('title') : Promise.resolve({ data: [] }),
        isChild ? supabase.from('department_children').select('*').eq('department_id', dept.id).order('first_name') : Promise.resolve({ data: [] }),
        isEvang ? supabase.from('department_souls').select('*').eq('department_id', dept.id).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        supabase.from('department_planning_groups').select('*'),
        supabase.from('department_announcement_groups').select('*'),
      ]);

      setDeptGroups(groupsRes.data || []);
      setDeptFinances(financesRes.data?.map((f: any) => ({ ...f, member: f.member_id ? { full_name: activeMembs.find(p => p.user_id === f.member_id)?.member.full_name || 'Inconnu' } : null })) || []);
      setDeptProjects(projectsRes.data || []);
      setDeptEquipment(equipmentRes.data || []);
      setDeptEquipmentNeeds(equipmentNeedsRes.data || []);
      
      const planData = planningsRes.data?.map((p: any) => ({ 
        ...p, 
        assigned_groups: p.concerns_all ? [] : planningGroupsRes.data?.filter((pg: any) => pg.planning_id === p.id).map((pg: any) => pg.group_id) 
      })) || [];
      setDeptPlannings(planData);
      
      setDeptAnnouncements(announcementsRes.data?.map((a: any) => ({ 
        ...a, 
        assigned_groups: a.concerns_all ? [] : announcementGroupsRes.data?.filter((ag: any) => ag.announcement_id === a.id).map((ag: any) => ag.group_id) 
      })) || []);
      setDeptHeadcounts(headcountsRes.data || []);
      setDeptSongs(songsRes.data || []);
      setDeptChildren(childrenRes.data || []);
      setDeptSouls(soulsRes.data?.map((s: any) => ({ ...s, assigned_member: s.assigned_to ? activeMembs.find(p => p.user_id === s.assigned_to)?.member.full_name : null })) || []);

      // Charger les tâches du premier projet
      if (projectsRes.data && projectsRes.data.length > 0) {
        setDeptSelectedProjectId(projectsRes.data[0].id);
        const { data: tsks } = await supabase.from('department_tasks').select('*').in('project_id', projectsRes.data.map((p: any) => p.id));
        setDeptTasks(tsks?.map((t: any) => ({ ...t, assigned_name: activeMembs.find(m => m.user_id === t.assigned_to)?.member.full_name || 'Non assigné' })) || []);
      } else {
        setDeptSelectedProjectId(null);
        setDeptTasks([]);
      }

      // Charger les rôles de planning si multimédia
      if (isMedia && planData.length > 0) {
        const { data: roles } = await supabase.from('department_planning_roles').select('*').in('planning_id', planData.map((p: any) => p.id));
        setDeptPlanningRoles(roles?.map((r: any) => ({ ...r, member_name: activeMembs.find(m => m.user_id === r.user_id)?.member.full_name || 'Membre' })) || []);
      }

    } catch (error) { console.error(error); }
    setLoading(false);
  }

  // ===================== ACTIONS =====================
  const getChurchId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: role } = await supabase.from('user_roles').select('entity_id').eq('user_id', user?.id).single();
    return { userId: user?.id, churchId: role?.entity_id };
  };

  const updateAppointment = async (id: string, status: string, note: string = '') => {
    await supabase.from('pastoral_appointments').update({ status, pastor_note: note, updated_at: new Date().toISOString() }).eq('id', id);
    loadAllData();
  };

  const updatePrayer = async (id: string, status: 'PRAYED' | 'ANSWERED') => {
    await supabase.from('pastoral_prayer_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    loadAllData();
  };

  const createAnnouncement = async (title: string, body: string) => {
    const { userId, churchId } = await getChurchId();
    const { error } = await supabase.from('church_announcements').insert({ church_id: churchId, title, body, created_by: userId });
    if (error) Alert.alert('Erreur', error.message);
    else { setShowAnnouncementForm(false); loadAllData(); }
  };

  const createProgram = async (title: string, category: string, startAt: string, location: string) => {
    const { churchId } = await getChurchId();
    const { error } = await supabase.from('church_programs').insert({ church_id: churchId, title, category, start_at: startAt, location });
    if (error) Alert.alert('Erreur', error.message);
    else { setShowProgramForm(false); loadAllData(); }
  };

  const createAvailability = async (dayOfWeek: number, startTime: string, endTime: string, slotDuration: number) => {
    const { churchId } = await getChurchId();
    const { error } = await supabase.from('pastoral_availabilities').insert({ church_id: churchId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, slot_duration_minutes: slotDuration });
    if (error) Alert.alert('Erreur', error.message);
    else { setShowAvailabilityForm(false); loadAllData(); }
  };

  const addSpiritualNote = async (memberId: string, category: string, body: string) => {
    const { userId, churchId } = await getChurchId();
    const { error } = await supabase.from('pastoral_spiritual_notes').insert({ church_id: churchId, member_id: memberId, pastor_id: userId, category, note_body: body });
    if (error) { Alert.alert('Erreur', error.message); return; }
    const { data } = await supabase.from('pastoral_spiritual_notes').select('*').eq('member_id', memberId).order('created_at', { ascending: false });
    setMemberNotes(data || []);
  };

  // 🔴 ACTIONS VALIDATION PASTORALE (intégration des âmes)
  const handleValidateSoulIntegration = async (soul: any, approved: boolean, notes: string = '') => {
    await supabase.from('department_souls').update({ 
      integration_status: approved ? 'INTEGRATED' : 'REJECTED',
      integration_notes: notes 
    }).eq('id', soul.id);
    
    if (approved) {
      // 🔴 Créer le fidèle dans church_members
      const { churchId } = await getChurchId();
      await supabase.from('church_members').insert({
        church_id: churchId,
        user_id: soul.assigned_to || null, // On ne peut pas créer un user_profiles depuis le mobile
        full_name: `${soul.first_name} ${soul.last_name}`,
        phone: soul.phone,
        status: 'APPROVED'
      });
    }
    
    Alert.alert(approved ? '✅ Intégré' : '❌ Refusé', approved ? 'L\'âme a été intégrée comme membre officiel.' : 'La demande a été refusée.');
    loadAllData();
  };

  // 🔴 Quitter avec confirmation (déconnexion)
  const handleExit = async () => {
    setExitModalVisible(false);
    await supabase.auth.signOut();
    // L'App.tsx redirigera automatiquement vers LoginScreen
  };

  // ===================== BUREAU PASTORAL =====================
  const renderBureau = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.subTabs}>
        <TouchableOpacity onPress={() => setBureauTab('ANNOUNCEMENTS')} style={[styles.subTab, bureauTab === 'ANNOUNCEMENTS' && styles.subTabActive]}>
          <Text style={[styles.subTabText, bureauTab === 'ANNOUNCEMENTS' && styles.subTabTextActive]}>📢 Annonces</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setBureauTab('PROGRAMS')} style={[styles.subTab, bureauTab === 'PROGRAMS' && styles.subTabActive]}>
          <Text style={[styles.subTabText, bureauTab === 'PROGRAMS' && styles.subTabTextActive]}>📅 Programmes</Text>
        </TouchableOpacity>
      </View>
      {bureauTab === 'ANNOUNCEMENTS' ? renderAnnouncements() : renderPrograms()}
    </View>
  );

  const renderAnnouncements = () => (
    <FlatList
      data={announcements}
      keyExtractor={i => i.id}
      ListHeaderComponent={
        <View>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowAnnouncementForm(!showAnnouncementForm)}>
            <Text style={styles.btnPrimaryText}>{showAnnouncementForm ? '✕ Fermer' : '＋ Nouvelle annonce'}</Text>
          </TouchableOpacity>
          {showAnnouncementForm && <AnnouncementForm onSubmit={createAnnouncement} />}
          <Text style={styles.subSectionTitle}>Annonces récentes</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.emptyText}>Aucune annonce publiée.</Text>}
      renderItem={({ item }) => (
        <View style={styles.announcementCard}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardBody}>{item.body}</Text>
          <Text style={styles.cardMeta}>📅 {new Date(item.created_at).toLocaleDateString('fr-FR')} • 🕐 {new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      )}
    />
  );

  const renderPrograms = () => (
    <FlatList
      data={programs}
      keyExtractor={i => i.id}
      ListHeaderComponent={
        <View>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowProgramForm(!showProgramForm)}>
            <Text style={styles.btnPrimaryText}>{showProgramForm ? '✕ Fermer' : '＋ Nouveau programme'}</Text>
          </TouchableOpacity>
          {showProgramForm && <ProgramForm onSubmit={createProgram} />}
          <Text style={styles.subSectionTitle}>Prochains événements</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.emptyText}>Aucun programme prévu.</Text>}
      renderItem={({ item }) => {
        const isPast = new Date(item.start_at) < new Date();
        return (
          <View style={[styles.programCard, isPast && { opacity: 0.5 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSub}>🗓️ {new Date(item.start_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} à {new Date(item.start_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
              {item.location && <Text style={styles.cardSub}>📍 {item.location}</Text>}
            </View>
            <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{item.category}</Text></View>
          </View>
        );
      }}
    />
  );

  // ===================== AGENDA =====================
  const renderAgenda = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.subTabs}>
        <TouchableOpacity onPress={() => setAgendaTab('AVAILABILITY')} style={[styles.subTab, agendaTab === 'AVAILABILITY' && styles.subTabActive]}>
          <Text style={[styles.subTabText, agendaTab === 'AVAILABILITY' && styles.subTabTextActive]}>⏰ Créneaux</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setAgendaTab('PENDING')} style={[styles.subTab, agendaTab === 'PENDING' && styles.subTabActive]}>
          <Text style={[styles.subTabText, agendaTab === 'PENDING' && styles.subTabTextActive]}>⏳ Attente</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setAgendaTab('SCHEDULED')} style={[styles.subTab, agendaTab === 'SCHEDULED' && styles.subTabActive]}>
          <Text style={[styles.subTabText, agendaTab === 'SCHEDULED' && styles.subTabTextActive]}>📅 Prévus</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setAgendaTab('HISTORY')} style={[styles.subTab, agendaTab === 'HISTORY' && styles.subTabActive]}>
          <Text style={[styles.subTabText, agendaTab === 'HISTORY' && styles.subTabTextActive]}>🗄️ Passés</Text>
        </TouchableOpacity>
      </View>
      {agendaTab === 'AVAILABILITY' && renderAvailabilityTab()}
      {agendaTab === 'PENDING' && renderPendingAppointments()}
      {agendaTab === 'SCHEDULED' && renderScheduledAppointments()}
      {agendaTab === 'HISTORY' && renderHistoryAppointments()}
    </View>
  );

  const renderAvailabilityTab = () => (
    <FlatList
      data={availabilities}
      keyExtractor={i => i.id}
      ListHeaderComponent={
        <View>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowAvailabilityForm(!showAvailabilityForm)}>
            <Text style={styles.btnPrimaryText}>{showAvailabilityForm ? '✕ Fermer' : '＋ Nouveau créneau'}</Text>
          </TouchableOpacity>
          {showAvailabilityForm && <AvailabilityForm onSubmit={createAvailability} />}
          <Text style={styles.subSectionTitle}>Vos créneaux actuels</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.emptyText}>Aucun créneau configuré.</Text>}
      renderItem={({ item }) => (
        <View style={styles.availabilityCard}>
          <Text style={styles.cardTitle}>{DAYS_OF_WEEK[item.day_of_week]}</Text>
          <Text style={styles.cardSub}>🕐 {item.start_time.slice(0,5)} - {item.end_time.slice(0,5)} • ⏱️ {item.slot_duration_minutes} min</Text>
        </View>
      )}
    />
  );

  const renderPendingAppointments = () => {
    const pending = appointments.filter(a => a.status === 'PENDING');
    return (
      <FlatList
        data={pending}
        keyExtractor={i => i.id}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucune demande en attente.</Text>}
        ListHeaderComponent={pending.length > 0 && (
          <View style={[styles.alertInfoBox, { marginTop: 5, marginBottom: 15 }]}>
            <Text style={styles.alertInfoText}>📋 {pending.length} demande{pending.length > 1 ? 's' : ''} en attente</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[styles.card, { borderColor: '#f59e0b', borderWidth: 2 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <Text style={styles.cardTitle}>{item.member?.full_name || 'Fidèle'}</Text>
              <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{item.type || 'Général'}</Text></View>
            </View>
            <Text style={styles.cardSub}>🗓️ {new Date(item.appointment_date).toLocaleDateString('fr-FR')} à {item.appointment_time?.slice(0,5)}</Text>
            {item.member_note && (
              <View style={styles.memberNoteBox}>
                <Text style={styles.memberNoteText}>"{item.member_note}"</Text>
              </View>
            )}
            <View style={styles.rowActions}>
              <TouchableOpacity style={styles.btnApprove} onPress={() => updateAppointment(item.id, 'APPROVED')}>
                <Text style={styles.btnText}>✓ Accepter</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnReject} onPress={() => { setRejectingApptId(item.id); setRejectModalVisible(true); setRejectReason(''); }}>
                <Text style={styles.btnText}>✕ Refuser</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    );
  };

  const renderScheduledAppointments = () => {
    const scheduled = appointments.filter(a => a.status === 'APPROVED');
    return (
      <FlatList
        data={scheduled}
        keyExtractor={i => i.id}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucun rendez-vous à venir.</Text>}
        ListHeaderComponent={scheduled.length > 0 && (
          <View style={[styles.alertInfoBox, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', marginTop: 5, marginBottom: 15 }]}>
            <Text style={[styles.alertInfoText, { color: '#1d4ed8' }]}>📆 {scheduled.length} rendez-vous programmé{scheduled.length > 1 ? 's' : ''}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.member?.full_name}</Text>
                <Text style={styles.cardSub}>🗓️ {new Date(item.appointment_date).toLocaleDateString('fr-FR')} • ⏰ {item.appointment_time?.slice(0,5)}</Text>
              </View>
              <TouchableOpacity style={styles.btnComplete} onPress={() => updateAppointment(item.id, 'COMPLETED', item.pastor_note || '')}>
                <Text style={styles.btnText}>✓ Terminé</Text>
              </TouchableOpacity>
            </View>
            {item.pastor_note && (
              <View style={[styles.memberNoteBox, { marginTop: 12 }]}>
                <Text style={styles.memberNoteText}>📝 {item.pastor_note}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.btnSecondary} onPress={() => { setEditingApptId(item.id); setEditingNote(item.pastor_note || ''); setNoteEditorVisible(true); }}>
              <Text style={styles.btnSecondaryText}>✏️ {item.pastor_note ? 'Modifier la note' : 'Ajouter une note'}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    );
  };

  const renderHistoryAppointments = () => {
    const history = appointments.filter(a => a.status === 'COMPLETED' || a.status === 'REJECTED');
    return (
      <FlatList
        data={history}
        keyExtractor={i => i.id}
        ListEmptyComponent={<Text style={styles.emptyText}>Historique vide.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.member?.full_name}</Text>
                <Text style={styles.cardSub}>🗓️ {new Date(item.appointment_date).toLocaleDateString('fr-FR')} • ⏰ {item.appointment_time?.slice(0,5)}</Text>
                {item.pastor_note && item.status === 'COMPLETED' && (
                  <View style={styles.memberNoteBox}><Text style={styles.memberNoteText}>📝 {item.pastor_note}</Text></View>
                )}
              </View>
              <View style={[styles.statusBadge, item.status === 'COMPLETED' ? styles.badgeApproved : styles.badgeRejected]}>
                <Text style={styles.statusBadgeText}>{item.status === 'COMPLETED' ? '✓ Terminé' : '✕ Refusé'}</Text>
              </View>
            </View>
          </View>
        )}
      />
    );
  };

  // ===================== PRIERES =====================
  const renderPrayers = () => {
    const pendingPrayers = prayers.filter(p => p.status === 'PENDING');
    const historyPrayers = prayers.filter(p => p.status !== 'PENDING');
    const answeredPrayers = prayers.filter(p => p.status === 'ANSWERED');
    
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const urgentPrayersCount = pendingPrayers.filter(p => new Date(p.created_at) < threeDaysAgo).length;

    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const currentMonth = new Date().getMonth();
    const chartData = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(); d.setMonth(currentMonth - 5 + i);
      const mTarget = d.getMonth(); const yTarget = d.getFullYear();
      const count = answeredPrayers.filter(p => {
        const pDate = new Date(p.updated_at || p.created_at);
        return pDate.getMonth() === mTarget && pDate.getFullYear() === yTarget;
      }).length;
      return { label: months[mTarget], count };
    });
    const maxCount = Math.max(...chartData.map(d => d.count), 1);

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.prayerStatsRow}>
          <View style={styles.prayerStatBox}>
            <Text style={styles.prayerStatLabel}>En attente</Text>
            <Text style={[styles.prayerStatValue, { color: '#0f172a' }]}>{pendingPrayers.length}</Text>
          </View>
          <View style={[styles.prayerStatBox, urgentPrayersCount > 0 && { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
            <Text style={[styles.prayerStatLabel, urgentPrayersCount > 0 && { color: '#dc2626' }]}>+3 Jours</Text>
            <Text style={[styles.prayerStatValue, urgentPrayersCount > 0 ? { color: '#dc2626' } : { color: '#0f172a' }]}>{urgentPrayersCount}</Text>
          </View>
          <View style={styles.prayerStatBox}>
            <Text style={styles.prayerStatLabel}>Exaucés</Text>
            <Text style={[styles.prayerStatValue, { color: '#10b981' }]}>{answeredPrayers.length}</Text>
          </View>
        </View>

        <View style={styles.analyticsBox}>
          <Text style={styles.analyticsHeader}>📈 Évolution des exaucements (6 mois)</Text>
          <View style={styles.chartContainer}>
            {chartData.map((data, idx) => (
              <View key={idx} style={styles.chartCol}>
                <View style={styles.chartBarsWrap}>
                  <View style={[styles.prayerBar, { height: `${(data.count / maxCount) * 100}%` }]}>
                    {data.count > 0 && <Text style={styles.prayerBarLabel}>{data.count}</Text>}
                  </View>
                </View>
                <Text style={styles.chartLabel}>{data.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Nouveaux Sujets ({pendingPrayers.length})</Text>
        {pendingPrayers.length === 0 ? (
          <View style={styles.emptyBox}><Text style={styles.emptyText}>Aucune requête en attente.</Text></View>
        ) : (
          pendingPrayers.map(prayer => (
            <View key={prayer.id} style={[styles.card, { borderColor: '#3b82f6', borderWidth: 2 }]}>
              <Text style={styles.cardTitle}>{prayer.subject}</Text>
              <Text style={styles.cardSub}>
                Par : <Text style={{ color: '#3b82f6', fontWeight: 'bold' }}>{prayer.is_anonymous ? 'Fidèle Anonyme' : prayer.member?.full_name}</Text> • {new Date(prayer.created_at).toLocaleDateString('fr-FR')}
              </Text>
              <View style={styles.memberNoteBox}><Text style={styles.memberNoteText}>"{prayer.body}"</Text></View>
              <View style={styles.rowActions}>
                <TouchableOpacity style={[styles.btnSecondary, { flex: 1 }]} onPress={() => updatePrayer(prayer.id, 'PRAYED')}>
                  <Text style={styles.btnSecondaryText}>✓ Marquer Prié</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnApprove, { flex: 1 }]} onPress={() => updatePrayer(prayer.id, 'ANSWERED')}>
                  <Text style={styles.btnText}>✨ Exaucé</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Sujets Traités ({historyPrayers.length})</Text>
        {historyPrayers.length === 0 ? (
          <View style={styles.emptyBox}><Text style={styles.emptyText}>L'historique est vide.</Text></View>
        ) : (
          <View style={styles.analyticsBox}>
            {historyPrayers.map(prayer => (
              <View key={prayer.id} style={styles.historyPrayerItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{prayer.subject}</Text>
                  <Text style={styles.cardSub}>{prayer.is_anonymous ? 'Anonyme' : prayer.member?.full_name}</Text>
                </View>
                <View style={[styles.statusBadge, prayer.status === 'ANSWERED' ? styles.badgeApproved : { backgroundColor: '#e2e8f0' }]}>
                  <Text style={[styles.statusBadgeText, prayer.status !== 'ANSWERED' && { color: '#475569' }]}>
                    {prayer.status === 'ANSWERED' ? '✨ Exaucé' : '✓ Prié'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  // ===================== SUIVI SPIRITUEL =====================
  const renderFollowupList = () => {
    const filtered = members.filter(m => 
      m.full_name.toLowerCase().includes(followupSearch.toLowerCase()) ||
      (m.phone && m.phone.includes(followupSearch))
    );
    return (
      <View style={{ flex: 1 }}>
        <TextInput style={styles.searchInput} placeholder="🔍 Rechercher un fidèle (nom ou téléphone)..." value={followupSearch} onChangeText={setFollowupSearch} />
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          ListEmptyComponent={<Text style={styles.emptyText}>Aucun résultat.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.memberCard} onPress={() => { setSelectedFollowupMember(item); setCurrentView('FOLLOWUP_DETAIL'); }}>
              <View style={styles.memberAvatar}><Text style={{ fontWeight: 'bold', color: '#64748b' }}>{item.full_name.charAt(0)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.full_name}</Text>
                <Text style={styles.cardSub}>{item.phone || 'Pas de numéro'}</Text>
              </View>
              <Text style={{ color: '#94a3b8', fontSize: 20 }}>›</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  const renderFollowupDetail = () => {
    if (!selectedFollowupMember) return null;
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.dossierHeader}>
          <View style={styles.dossierAvatar}><Text style={styles.dossierAvatarText}>{selectedFollowupMember.full_name.charAt(0)}</Text></View>
          <View>
            <Text style={styles.dossierName}>{selectedFollowupMember.full_name}</Text>
            <Text style={styles.dossierLabel}>DOSSIER PASTORAL</Text>
          </View>
        </View>
        <View style={styles.analyticsBox}>
          <Text style={styles.analyticsHeader}>✏️ Nouvelle entrée</Text>
          <SpiritualNoteForm onSubmit={(category, body) => addSpiritualNote(selectedFollowupMember.id, category, body)} />
        </View>
        <Text style={styles.sectionTitle}>Historique ({memberNotes.length})</Text>
        {memberNotes.length === 0 ? (
          <View style={styles.emptyBox}><Text style={styles.emptyText}>Ce dossier est vide.</Text></View>
        ) : (
          <View>
            {memberNotes.map(note => (
              <View key={note.id} style={styles.timelineItem}>
                <View style={styles.timelineDot}><Text style={{ fontSize: 14 }}>✍️</Text></View>
                <View style={styles.timelineCard}>
                  <Text style={styles.timelineCategory}>{note.category}</Text>
                  <Text style={styles.timelineDate}>{new Date(note.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                  <Text style={styles.timelineBody}>{note.note_body}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  // ===================== MEMBRES =====================
  const renderMembers = () => {
    const filtered = members.filter(m => m.full_name.toLowerCase().includes(search.toLowerCase()));
    return (
      <>
        <TextInput style={styles.searchInput} placeholder="🔍 Rechercher un fidèle..." value={search} onChangeText={setSearch} />
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          ListEmptyComponent={<Text style={styles.emptyText}>Aucun membre trouvé.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.memberCard} onPress={() => { setSelectedFollowupMember(item); setCurrentView('FOLLOWUP_DETAIL'); }}>
              <View style={styles.memberAvatar}><Text style={{ fontWeight: 'bold', color: '#64748b' }}>{item.full_name.charAt(0)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.full_name}</Text>
                <Text style={styles.cardSub}>{item.phone || 'Aucun contact'} • {item.status === 'APPROVED' ? '✅ Actif' : '⏳ En attente'}</Text>
              </View>
              <Text style={{ fontSize: 10, color: '#3b82f6', fontWeight: 'bold' }}>📝 Suivi</Text>
            </TouchableOpacity>
          )}
        />
      </>
    );
  };

  // ===================== FINANCES =====================
  const renderFinances = () => {
    const totalIncome = finances.filter(e => e.type === 'INCOME').reduce((acc, curr) => acc + Number(curr.amount), 0);
    const totalExpense = finances.filter(e => e.type === 'EXPENSE').reduce((acc, curr) => acc + Number(curr.amount), 0);
    const balance = totalIncome - totalExpense;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthFinances = finances.filter(f => {
      const d = new Date(f.created_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const monthIncome = monthFinances.filter(f => f.type === 'INCOME').reduce((acc, curr) => acc + Number(curr.amount), 0);
    const monthExpense = monthFinances.filter(f => f.type === 'EXPENSE').reduce((acc, curr) => acc + Number(curr.amount), 0);

    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const chartData = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(); d.setMonth(currentMonth - 5 + i);
      const mTarget = d.getMonth(); const yTarget = d.getFullYear();
      const mEntries = finances.filter(e => {
        const eDate = new Date(e.created_at);
        return eDate.getMonth() === mTarget && eDate.getFullYear() === yTarget;
      });
      const income = mEntries.filter(e => e.type === 'INCOME').reduce((sum, e) => sum + Number(e.amount), 0);
      const expense = mEntries.filter(e => e.type === 'EXPENSE').reduce((sum, e) => sum + Number(e.amount), 0);
      return { label: months[mTarget], income, expense };
    });
    const maxChartValue = Math.max(...chartData.flatMap(d => [d.income, d.expense]), 1);

    const expenses = finances.filter(e => e.type === 'EXPENSE');
    const expenseByCategory = expenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount);
      return acc;
    }, {} as Record<string, number>);
    const topExpenses = Object.entries(expenseByCategory).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 4);

    return (
      <FlatList
        data={finances}
        keyExtractor={i => i.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucune transaction enregistrée.</Text>}
        ListHeaderComponent={
          <View style={{ paddingBottom: 15 }}>
            <View style={[styles.balanceCard, { backgroundColor: balance >= 0 ? '#0f172a' : '#ef4444' }]}>
              <Text style={styles.balanceLabel}>Solde Total Caisse</Text>
              <Text style={styles.balanceAmount}>{balance.toLocaleString('fr-FR')} FCFA</Text>
              <View style={styles.balanceStatsRow}>
                <View style={{ alignItems: 'center' }}><Text style={styles.balanceStatLabel}>Entrées</Text><Text style={styles.balanceStatIncome}>+{totalIncome.toLocaleString()} F</Text></View>
                <View style={styles.balanceStatDivider} />
                <View style={{ alignItems: 'center' }}><Text style={styles.balanceStatLabel}>Sorties</Text><Text style={styles.balanceStatExpense}>-{totalExpense.toLocaleString()} F</Text></View>
              </View>
            </View>
            <View style={styles.analyticsBox}>
              <Text style={styles.analyticsHeader}>Bilan de ce mois</Text>
              <View style={styles.analyticsRow}>
                <View style={styles.analyticsStat}><Text style={styles.analyticsLabel}>Entrées</Text><Text style={[styles.analyticsValue, { color: '#10b981' }]}>+{monthIncome.toLocaleString()}</Text></View>
                <View style={styles.analyticsDivider} />
                <View style={styles.analyticsStat}><Text style={styles.analyticsLabel}>Sorties</Text><Text style={[styles.analyticsValue, { color: '#ef4444' }]}>-{monthExpense.toLocaleString()}</Text></View>
              </View>
            </View>
            <View style={styles.analyticsBox}>
              <Text style={styles.analyticsHeader}>Évolution (6 mois)</Text>
              <View style={styles.chartContainer}>
                {chartData.map((data, idx) => (
                  <View key={idx} style={styles.chartCol}>
                    <View style={styles.chartBarsWrap}>
                      <View style={[styles.chartBarInc, { height: `${(data.income / maxChartValue) * 100}%` }]} />
                      <View style={[styles.chartBarExp, { height: `${(data.expense / maxChartValue) * 100}%` }]} />
                    </View>
                    <Text style={styles.chartLabel}>{data.label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.chartLegend}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={[styles.legendDot, { backgroundColor: '#34d399' }]} /><Text style={styles.legendText}>Entrées</Text></View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={[styles.legendDot, { backgroundColor: '#f87171' }]} /><Text style={styles.legendText}>Sorties</Text></View>
              </View>
            </View>
            <View style={styles.analyticsBox}>
              <Text style={styles.analyticsHeader}>Répartition des Dépenses</Text>
              {topExpenses.length === 0 ? <Text style={styles.emptyText}>Aucune dépense.</Text> : topExpenses.map((exp, idx) => (
                <View key={idx} style={styles.expenseBarContainer}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={styles.expenseBarLabel}>{exp.name}</Text>
                    <Text style={styles.expenseBarValue}>{exp.amount.toLocaleString()} F</Text>
                  </View>
                  <View style={styles.expenseBarBg}>
                    <View style={[styles.expenseBarFill, { width: `${(exp.amount / totalExpense) * 100}%` }]} />
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.sectionTitle}>Historique récent</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.financeCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.financeCategory}>{item.category} {item.is_modified && "⚠️"}</Text>
              <Text style={styles.financeDate}>{new Date(item.created_at).toLocaleDateString('fr-FR')}</Text>
            </View>
            <Text style={[styles.financeAmount, { color: item.type === 'INCOME' ? '#10b981' : '#ef4444' }]}>
              {item.type === 'INCOME' ? '+' : '-'} {item.amount.toLocaleString('fr-FR')}
            </Text>
          </View>
        )}
      />
    );
  };

  // ===================== 🔴 LISTE DES DÉPARTEMENTS =====================
  const renderDeptsList = () => {
    // Calculer des stats pour chaque département
    const renderDeptCard = (dept: any) => {
      // On simule les compteurs en se basant sur les variables si on a chargé le département
      const isSelected = selectedDept?.id === dept.id;
      return (
        <TouchableOpacity 
          key={dept.id} 
          style={[styles.deptCard, isSelected && { borderColor: '#f97316', backgroundColor: '#fff7ed' }]} 
          onPress={() => { setSelectedDept(dept); setCurrentView('DEPT_HUB'); loadDepartmentData(dept); }}
        >
          <View style={styles.deptIcon}>
            <Text style={{ fontSize: 24 }}>{dept.icon || '🏢'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.deptName}>{dept.custom_name || dept.name}</Text>
            <Text style={styles.deptSub}>{dept.member_count || 0} membres actifs</Text>
          </View>
          <Text style={{ fontSize: 18, color: '#94a3b8' }}>›</Text>
        </TouchableOpacity>
      );
    };

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.alertInfoBox, { marginTop: 5, marginBottom: 15 }]}>
          <Text style={styles.alertInfoText}>👁️ Mode Superviseur : Vous pouvez consulter tous les départements en lecture seule</Text>
        </View>
        
        {departments.length === 0 ? (
          <View style={styles.emptyBox}><Text style={styles.emptyText}>Aucun département dans cette église.</Text></View>
        ) : (
          departments.map(d => renderDeptCard(d))
        )}

        {/* 🔴 SECTION VALIDATION D'INTÉGRATION DES ÂMES */}
        {stats.integrationPending > 0 && (
          <>
            <Text style={styles.sectionTitle}>🔥 Demandes d'intégration d'âmes ({stats.integrationPending})</Text>
            <View style={[styles.analyticsBox, { borderColor: '#fb923c', backgroundColor: '#fff7ed' }]}>
              <Text style={styles.analyticsHeader}>Âmes en attente de validation pastorale</Text>
              <Text style={[styles.emptyText, { marginTop: 5, textAlign: 'left' }]}>
                Les départements d'évangélisation ont soumis des âmes à intégrer comme membres officiels. Vous pouvez les examiner en accédant à la vue départementale.
              </Text>
              <TouchableOpacity 
                style={[styles.btnPrimary, { marginTop: 10, backgroundColor: '#f97316' }]}
                onPress={() => {
                  // Aller au département d'évangélisation
                  const evangDept = departments.find(d => (d.custom_name || d.name || '').toLowerCase().match(/évangélisation|evangelisation|gagnants|âmes|mission/));
                  if (evangDept) {
                    setSelectedDept(evangDept);
                    setCurrentView('DEPT_SOULS');
                    loadDepartmentData(evangDept);
                  } else {
                    Alert.alert('Information', 'Aucun département d\'évangélisation trouvé.');
                  }
                }}
              >
                <Text style={styles.btnPrimaryText}>Examiner les demandes ➔</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    );
  };

  // ===================== 🔴 HUB D'UN DÉPARTEMENT (Supervision) =====================
  const renderDeptHub = () => {
    if (!selectedDept) return null;
    
    const totalIncome = deptFinances.filter(f => f.type === 'INCOME').reduce((s, f) => s + Number(f.amount), 0);
    const totalExpense = deptFinances.filter(f => f.type === 'EXPENSE').reduce((s, f) => s + Number(f.amount), 0);
    const balance = totalIncome - totalExpense;
    
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.alertInfoBox, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd', marginTop: 5, marginBottom: 15 }]}>
          <Text style={[styles.alertInfoText, { color: '#0369a1' }]}>👁️ {selectedDept.custom_name || selectedDept.name} • Vue Superviseur</Text>
        </View>

        {/* Stats rapides du département */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Membres</Text>
            <Text style={styles.statValue}>{deptMembers.length}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Candidatures</Text>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>{deptPending.length}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Solde</Text>
            <Text style={[styles.statValue, { color: balance >= 0 ? '#10b981' : '#ef4444' }]}>{balance.toLocaleString('fr-FR')} F</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Plannings</Text>
            <Text style={styles.statValue}>{deptPlannings.length}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Modules du département</Text>
        <View style={styles.gridMenu}>
          <MenuButton icon="📩" title="Candidatures" subtitle={`${deptPending.length} en attente`} onPress={() => setCurrentView('DEPT_PENDING')} />
          <MenuButton icon="👥" title="Membres" subtitle={`${deptMembers.length} actifs`} onPress={() => setCurrentView('DEPT_MEMBERS')} />
          {deptType.isEvangelism && (
            <MenuButton icon="🕊️" title="Nouvelles Âmes" subtitle="Suivi & Intégration" onPress={() => setCurrentView('DEPT_SOULS')} />
          )}
          {deptType.isUsher && (
            <MenuButton icon="📊" title="Dénombrement" subtitle="Présence" onPress={() => setCurrentView('DEPT_HEADCOUNTS')} />
          )}
          {deptType.isMedia && (
            <>
              <MenuButton icon="📋" title="Projets" subtitle={`${deptProjects.length} en cours`} onPress={() => setCurrentView('DEPT_PROJECTS')} />
              <MenuButton icon="📷" title="Matériel" subtitle="Inventaire" onPress={() => setCurrentView('DEPT_EQUIPMENTS')} />
            </>
          )}
          {deptType.isChoir && (
            <MenuButton icon="🎵" title="Répertoire" subtitle={`${deptSongs.length} chants`} onPress={() => setCurrentView('DEPT_SONGS')} />
          )}
          {deptType.isChildren && (
            <MenuButton icon="🧸" title="Enfants" subtitle={`${deptChildren.length} inscrits`} onPress={() => setCurrentView('DEPT_CHILDREN')} />
          )}
          <MenuButton icon="💰" title="Finances" subtitle="Trésorerie" onPress={() => setCurrentView('DEPT_FINANCES')} />
          <MenuButton icon="📅" title="Planning" subtitle={`${deptPlannings.length} événements`} onPress={() => setCurrentView('DEPT_PLANNING')} />
          <MenuButton icon="📢" title="Annonces" subtitle={`${deptAnnouncements.length} publiées`} onPress={() => setCurrentView('DEPT_ANNOUNCEMENTS')} />
        </View>
      </ScrollView>
    );
  };

  // 🔴 CANDIDATS DU DÉPARTEMENT
  const renderDeptPending = () => (
    <FlatList
      data={deptPending}
      keyExtractor={i => i.id}
      ListHeaderComponent={
        <View style={[styles.alertInfoBox, { marginTop: 5, marginBottom: 15 }]}>
          <Text style={styles.alertInfoText}>📩 {deptPending.length} demande{deptPending.length > 1 ? 's' : ''} d'adhésion</Text>
        </View>
      }
      ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyText}>Aucune candidature en attente.</Text></View>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{item.member.full_name}</Text>
          <Text style={styles.cardSub}>Souhaite rejoindre : {selectedDept?.custom_name || selectedDept?.name}</Text>
        </View>
      )}
    />
  );

  // 🔴 MEMBRES DU DÉPARTEMENT
  const renderDeptMembers = () => {
    const filtered = deptMembersFilter === 'Tous' ? deptMembers : deptMembers.filter(m => m.sub_group_id === deptMembersFilter);
    return (
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        ListHeaderComponent={
          <View>
            {deptType.hasSubGroups && deptGroups.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <TouchableOpacity style={deptMembersFilter === 'Tous' ? styles.classPillActive : styles.classPill} onPress={() => setDeptMembersFilter('Tous')}>
                  <Text style={deptMembersFilter === 'Tous' ? styles.classPillActiveText : styles.classPillText}>Tous</Text>
                </TouchableOpacity>
                {deptGroups.map(g => (
                  <TouchableOpacity key={g.id} style={deptMembersFilter === g.id ? styles.classPillActive : styles.classPill} onPress={() => setDeptMembersFilter(g.id)}>
                    <Text style={deptMembersFilter === g.id ? styles.classPillActiveText : styles.classPillText}>{g.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={[styles.alertInfoBox, { marginTop: 5, marginBottom: 15 }]}>
              <Text style={styles.alertInfoText}>👥 {filtered.length} membres</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyText}>Aucun membre.</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.memberAvatar}><Text style={{ fontWeight: 'bold', color: '#64748b' }}>{item.member.full_name.charAt(0)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.member.full_name}</Text>
              {(() => {
                const ledGroup = deptGroups.find(g => g.leader_id === item.user_id);
                const assignedGroup = deptGroups.find(g => g.id === item.sub_group_id);
                if (ledGroup) return <Text style={styles.cardSub}>👑 Responsable : {ledGroup.name}</Text>;
                if (assignedGroup) return <Text style={styles.cardSub}>👥 {assignedGroup.name}</Text>;
                return <Text style={styles.cardSub}>Membre simple</Text>;
              })()}
            </View>
          </View>
        )}
      />
    );
  };

  // 🔴 ÂMES DU DÉPARTEMENT (ÉVANGÉLISATION)
  const renderDeptSouls = () => {
    if (!deptType.isEvangelism) {
      return (
        <View style={styles.centered}>
          <Text style={{ fontSize: 50, marginBottom: 15 }}>🕊️</Text>
          <Text style={styles.cardTitle}>Module réservé à l'évangélisation</Text>
          <Text style={[styles.emptyText, { marginTop: 10, textAlign: 'center' }]}>Ce département n'est pas un département d'évangélisation.</Text>
        </View>
      );
    }

    const pendingIntegration = deptSouls.filter(s => s.integration_status === 'PENDING');
    
    return (
      <FlatList
        data={deptSouls}
        keyExtractor={i => i.id}
        ListHeaderComponent={
          <View>
            {pendingIntegration.length > 0 && (
              <View style={[styles.alertInfoBox, { backgroundColor: '#fff7ed', borderColor: '#fb923c', marginTop: 5, marginBottom: 15 }]}>
                <Text style={[styles.alertInfoText, { color: '#9a3412' }]}>🔥 {pendingIntegration.length} âme{pendingIntegration.length > 1 ? 's' : ''} en attente de votre validation</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyText}>Aucune âme enregistrée.</Text></View>}
        renderItem={({ item }) => (
          <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: item.integration_status === 'PENDING' ? '#f59e0b' : item.integration_status === 'INTEGRATED' ? '#10b981' : item.integration_status === 'REJECTED' ? '#ef4444' : '#e2e8f0' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.cardTitle}>{item.first_name} {item.last_name}</Text>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: item.integration_status === 'INTEGRATED' ? '#dcfce3' : item.integration_status === 'PENDING' ? '#fef3c7' : item.integration_status === 'REJECTED' ? '#fee2e2' : '#e2e8f0' }
              ]}>
                <Text style={[styles.statusBadgeText, { color: item.integration_status === 'INTEGRATED' ? '#16a34a' : item.integration_status === 'PENDING' ? '#d97706' : item.integration_status === 'REJECTED' ? '#ef4444' : '#475569' }]}>
                  {item.integration_status === 'INTEGRATED' ? '✅ Intégré' : item.integration_status === 'PENDING' ? '⏳ En attente' : item.integration_status === 'REJECTED' ? '❌ Refusé' : '• Nouveau'}
                </Text>
              </View>
            </View>
            {item.profession && <Text style={styles.cardSub}>💼 {item.profession}</Text>}
            {item.phone && <Text style={styles.cardSub}>📞 {item.phone}</Text>}
            <View style={styles.badgesRow}>
              <View style={[styles.smallBadge, { backgroundColor: item.is_called ? '#dcfce3' : '#f1f5f9' }]}>
                <Text style={[styles.smallBadgeText, { color: item.is_called ? '#16a34a' : '#94a3b8' }]}>{item.is_called ? '📞 Appelé' : 'Non appelé'}</Text>
              </View>
              <View style={[styles.smallBadge, { backgroundColor: item.is_visited ? '#dcfce3' : '#f1f5f9' }]}>
                <Text style={[styles.smallBadgeText, { color: item.is_visited ? '#16a34a' : '#94a3b8' }]}>{item.is_visited ? '🏠 Visité' : 'Non visité'}</Text>
              </View>
              {item.is_baptized_candidate && (
                <View style={[styles.smallBadge, { backgroundColor: '#e0e7ff' }]}>
                  <Text style={[styles.smallBadgeText, { color: '#4f46e5' }]}>💧 Baptême</Text>
                </View>
              )}
            </View>
            {item.assigned_member && <Text style={styles.cardSub}>👤 Suivi par : {item.assigned_member}</Text>}
            
            {/* 🔴 BOUTONS DE VALIDATION PASTORALE */}
            {item.integration_status === 'PENDING' && (
              <View style={[styles.rowActions, { marginTop: 12 }]}>
                <TouchableOpacity style={styles.btnApprove} onPress={() => handleValidateSoulIntegration(item, true)}>
                  <Text style={styles.btnText}>✅ Valider l'intégration</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnReject} onPress={() => handleValidateSoulIntegration(item, false, 'Dossier insuffisant')}>
                  <Text style={styles.btnText}>❌ Refuser</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />
    );
  };

  // 🔴 DÉNOMBREMENT (Mode lecture seule)
  const renderDeptHeadcounts = () => {
    if (!deptType.isUsher) {
      return (
        <View style={styles.centered}>
          <Text style={{ fontSize: 50, marginBottom: 15 }}>📊</Text>
          <Text style={styles.cardTitle}>Module de dénombrement</Text>
          <Text style={[styles.emptyText, { marginTop: 10 }]}>Ce département n'utilise pas le dénombrement.</Text>
        </View>
      );
    }
    return (
      <HeadcountModule 
        deptId={selectedDept.id} 
        churchId={selectedDept.church_id || churchInfo?.id} 
        isLeader={false} // 🔴 Le pasteur n'est PAS leader du département
      />
    );
  };

  // 🔴 FINANCES DU DÉPARTEMENT
  const renderDeptFinances = () => {
    const totalIncome = deptFinances.filter(f => f.type === 'INCOME').reduce((s, f) => s + Number(f.amount), 0);
    const totalExpense = deptFinances.filter(f => f.type === 'EXPENSE').reduce((s, f) => s + Number(f.amount), 0);
    const balance = totalIncome - totalExpense;
    
    return (
      <FlatList
        data={deptFinances}
        keyExtractor={i => i.id}
        ListHeaderComponent={
          <View>
            <View style={[styles.balanceCard, { backgroundColor: balance >= 0 ? '#10b981' : '#ef4444', marginTop: 10 }]}>
              <Text style={styles.balanceLabel}>Solde du département</Text>
              <Text style={styles.balanceAmount}>{balance.toLocaleString('fr-FR')} FCFA</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyText}>Aucune transaction.</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.financeCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.financeCategory}>{item.category}</Text>
              {item.member && <Text style={[styles.cardSub, { color: '#3b82f6', fontWeight: 'bold' }]}>👤 {item.member.full_name}</Text>}
              {item.motif && <Text style={styles.cardSub}>{item.motif}</Text>}
              <Text style={styles.financeDate}>{new Date(item.created_at).toLocaleDateString('fr-FR')}</Text>
            </View>
            <Text style={[styles.financeAmount, { color: item.type === 'INCOME' ? '#10b981' : '#ef4444' }]}>
              {item.type === 'INCOME' ? '+' : '-'} {item.amount.toLocaleString('fr-FR')}
            </Text>
          </View>
        )}
      />
    );
  };

  // 🔴 PROJETS & TÂCHES (Mode lecture)
  const renderDeptProjects = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>📋 Projets en cours ({deptProjects.length})</Text>
      {deptProjects.length === 0 ? (
        <View style={styles.emptyBox}><Text style={styles.emptyText}>Aucun projet.</Text></View>
      ) : deptProjects.map(p => {
        const projectTasks = deptTasks.filter(t => t.project_id === p.id);
        return (
          <View key={p.id} style={styles.analyticsBox}>
            <Text style={styles.analyticsHeader}>{p.name}</Text>
            {p.description && <Text style={styles.cardSub}>{p.description}</Text>}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Text style={[styles.smallBadge, { backgroundColor: '#e0e7ff', color: '#4f46e5' }]}>📌 {projectTasks.filter(t => t.status === 'TODO').length}</Text>
              <Text style={[styles.smallBadge, { backgroundColor: '#dbeafe', color: '#1d4ed8' }]}>⏳ {projectTasks.filter(t => t.status === 'IN_PROGRESS').length}</Text>
              <Text style={[styles.smallBadge, { backgroundColor: '#dcfce3', color: '#16a34a' }]}>✅ {projectTasks.filter(t => t.status === 'DONE').length}</Text>
            </View>
            {projectTasks.slice(0, 5).map(t => (
              <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>
                  {t.status === 'DONE' ? '✅' : t.status === 'IN_PROGRESS' ? '⏳' : '📌'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, t.status === 'DONE' && { textDecorationLine: 'line-through', color: '#94a3b8' }]}>{t.title}</Text>
                  <Text style={styles.cardSub}>👤 {t.assigned_name}</Text>
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );

  // 🔴 MATÉRIEL
  const renderDeptEquipments = () => (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginTop: 15, marginBottom: 15 }}>
        <TouchableOpacity style={[styles.financeToggleBtn, deptEquipmentTab === 'INVENTORY' && { backgroundColor: '#10b981' }]} onPress={() => setDeptEquipmentTab('INVENTORY')}>
          <Text style={[styles.financeToggleText, deptEquipmentTab === 'INVENTORY' && { color: '#fff' }]}>Inventaire ({deptEquipment.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.financeToggleBtn, deptEquipmentTab === 'NEEDS' && { backgroundColor: '#f59e0b' }]} onPress={() => setDeptEquipmentTab('NEEDS')}>
          <Text style={[styles.financeToggleText, deptEquipmentTab === 'NEEDS' && { color: '#fff' }]}>Besoins ({deptEquipmentNeeds.length})</Text>
        </TouchableOpacity>
      </View>
      
      {deptEquipmentTab === 'INVENTORY' ? (
        <FlatList
          data={deptEquipment}
          keyExtractor={i => i.id}
          ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyText}>Aucun matériel.</Text></View>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardSub}>Catégorie: {item.category}</Text>
                </View>
                <View style={[styles.smallBadge, { backgroundColor: item.is_available ? '#dcfce3' : '#fee2e2' }]}>
                  <Text style={[styles.smallBadgeText, { color: item.is_available ? '#16a34a' : '#ef4444' }]}>
                    {item.is_available ? '✅ Dispo' : '❌ Utilisé'}
                  </Text>
                </View>
              </View>
              <View style={[styles.smallBadge, { alignSelf: 'flex-start', marginTop: 8, backgroundColor: item.condition === 'BON' ? '#dcfce3' : item.condition === 'EN PANNE' ? '#fee2e2' : '#fef3c7' }]}>
                <Text style={[styles.smallBadgeText, { color: item.condition === 'BON' ? '#16a34a' : item.condition === 'EN PANNE' ? '#ef4444' : '#d97706' }]}>
                  {item.condition}
                </Text>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={deptEquipmentNeeds}
          keyExtractor={i => i.id}
          ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyText}>Aucun besoin.</Text></View>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.item_name}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 5 }}>
                <Text style={[styles.smallBadge, { backgroundColor: item.priority === 'HAUTE' ? '#fee2e2' : item.priority === 'MOYENNE' ? '#fef3c7' : '#e0e7ff' }]}>
                  <Text style={{ color: item.priority === 'HAUTE' ? '#ef4444' : item.priority === 'MOYENNE' ? '#d97706' : '#4f46e5', fontSize: 11, fontWeight: 'bold' }}>
                    Priorité: {item.priority}
                  </Text>
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );

  // 🔴 PLANNING
  const renderDeptPlanning = () => (
    <FlatList
      data={deptPlannings}
      keyExtractor={i => i.id}
      ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyText}>Aucun événement planifié.</Text></View>}
      renderItem={({ item }) => {
        const d = new Date(item.event_date);
        const roles = deptPlanningRoles.filter(r => r.planning_id === item.id);
        return (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ backgroundColor: '#f0f9ff', padding: 10, borderRadius: 12, alignItems: 'center', marginRight: 12, minWidth: 60 }}>
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0f172a' }}>{d.getDate()}</Text>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>{d.toLocaleString('fr-FR', { month: 'short' })}</Text>
                <Text style={{ fontSize: 9, color: '#3b82f6', marginTop: 2, fontWeight: 'bold' }}>{d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {item.description && <Text style={styles.cardSub}>{item.description}</Text>}
                {item.is_church_event && <View style={[styles.smallBadge, { alignSelf: 'flex-start', marginTop: 4, backgroundColor: '#dbeafe' }]}><Text style={{ color: '#1d4ed8', fontSize: 10, fontWeight: 'bold' }}>🏛️ Événement église</Text></View>}
                {!item.concerns_all && <Text style={styles.cardSub}>👥 Groupes spécifiques</Text>}
                {roles.length > 0 && (
                  <View style={{ marginTop: 8, padding: 8, backgroundColor: '#f8fafc', borderRadius: 8 }}>
                    {roles.map(r => (
                      <Text key={r.id} style={{ fontSize: 11, color: '#475569' }}>👤 {r.member_name} → {r.role_name}</Text>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
        );
      }}
    />
  );

  // 🔴 ANNONCES
  const renderDeptAnnouncements = () => (
    <FlatList
      data={deptAnnouncements}
      keyExtractor={i => i.id}
      ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyText}>Aucune annonce.</Text></View>}
      renderItem={({ item }) => (
        <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: '#ec4899' }]}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={[styles.cardSub, { marginTop: 8 }]}>{item.content}</Text>
          <Text style={styles.cardMeta}>{new Date(item.created_at).toLocaleDateString('fr-FR')}</Text>
        </View>
      )}
    />
  );

  // 🔴 CHANTS
  const renderDeptSongs = () => (
    <FlatList
      data={deptSongs}
      keyExtractor={i => i.id}
      ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyText}>Aucun chant.</Text></View>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>🎵 {item.title}</Text>
            {item.musical_key && <Text style={styles.cardSub}>🎼 Gamme: {item.musical_key}</Text>}
          </View>
          {item.video_url && (
            <TouchableOpacity style={[styles.btnSecondary, { paddingHorizontal: 10 }]} onPress={() => Linking.openURL(item.video_url.startsWith('http') ? item.video_url : `https://${item.video_url}`).catch(() => Alert.alert("Erreur", "Lien invalide."))}>
              <Text style={styles.btnSecondaryText}>▶️ Écouter</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    />
  );

  // 🔴 ENFANTS
  const renderDeptChildren = () => (
    <FlatList
      data={deptChildren}
      keyExtractor={i => i.id}
      ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyText}>Aucun enfant inscrit.</Text></View>}
      renderItem={({ item }) => {
        const className = deptGroups.find(g => g.id === item.class_id)?.name || item.class_name;
        return (
          <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: '#f43f5e' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.memberAvatar}><Text style={{ fontSize: 20 }}>👦</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.first_name} {item.last_name}</Text>
                <Text style={styles.cardSub}>🏫 {className}</Text>
                {item.parent_name && <Text style={styles.cardSub}>👨‍👩‍👧 Parent: {item.parent_name}</Text>}
                {item.parent_phone && <Text style={styles.cardSub}>📞 {item.parent_phone}</Text>}
              </View>
            </View>
          </View>
        );
      }}
    />
  );

  // ===================== HUB =====================
  const renderHub = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Fidèles Actifs</Text>
          <Text style={styles.statValue}>{stats.membersCount}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Départements</Text>
          <Text style={styles.statValue}>{stats.departmentsCount}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Alertes Pastorales</Text>
      <View style={styles.alertsContainer}>
        <TouchableOpacity style={[styles.alertCard, { backgroundColor: '#fffbeb', borderColor: '#fcd34d' }]} onPress={() => setCurrentView('AGENDA')}>
          <Text style={{ fontSize: 24, marginBottom: 5 }}>📅</Text>
          <Text style={styles.alertValue}>{stats.pendingAppts}</Text>
          <Text style={styles.alertLabel}>RDV en attente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.alertCard, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]} onPress={() => setCurrentView('PRAYERS')}>
          <Text style={{ fontSize: 24, marginBottom: 5 }}>🙏</Text>
          <Text style={[styles.alertValue, { color: '#1d4ed8' }]}>{stats.pendingPrayers}</Text>
          <Text style={[styles.alertLabel, { color: '#3b82f6' }]}>Prières requises</Text>
        </TouchableOpacity>
      </View>

      {/* 🔴 ALERTE INTÉGRATION ÂMES */}
      {stats.integrationPending > 0 && (
        <TouchableOpacity 
          style={[styles.alertCard, { backgroundColor: '#fff7ed', borderColor: '#fb923c', marginTop: 10 }]}
          onPress={() => setCurrentView('DEPTS_LIST')}
        >
          <Text style={{ fontSize: 24, marginBottom: 5 }}>🔥</Text>
          <Text style={[styles.alertValue, { color: '#ea580c' }]}>{stats.integrationPending}</Text>
          <Text style={[styles.alertLabel, { color: '#f97316' }]}>Âmes à valider</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Aperçu Financier</Text>
      <View style={styles.financeOverview}>
        <View style={styles.financeOverviewRow}>
          <View>
            <Text style={styles.financeOverviewLabel}>Solde en caisse</Text>
            <Text style={styles.financeOverviewValue}>{stats.totalBalance.toLocaleString('fr-FR')} F</Text>
          </View>
          <TouchableOpacity style={styles.financeBtn} onPress={() => setCurrentView('FINANCES')}>
            <Text style={styles.financeBtnText}>Détails ➔</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 1, backgroundColor: '#e2e8f0', marginVertical: 15 }} />
        <Text style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>Entrées ce mois-ci : <Text style={{ color: '#10b981' }}>+{stats.monthIncome.toLocaleString('fr-FR')} FCFA</Text></Text>
      </View>

      <Text style={styles.sectionTitle}>Administration Générale</Text>
      <View style={styles.gridMenu}>
        <MenuButton icon="📢" title="Bureau Pastoral" subtitle="Annonces & Programmes" onPress={() => setCurrentView('BUREAU')} />
        <MenuButton icon="📅" title="Agenda & RDV" subtitle="Créneaux & Demandes" onPress={() => setCurrentView('AGENDA')} />
        <MenuButton icon="🙏" title="Requêtes de Prière" subtitle="Intercessions" onPress={() => setCurrentView('PRAYERS')} />
        <MenuButton icon="📝" title="Suivi Spirituel" subtitle="Carnet pastoral" onPress={() => setCurrentView('FOLLOWUP')} />
        <MenuButton icon="💰" title="Finances" subtitle="Trésorerie église" onPress={() => setCurrentView('FINANCES')} />
        <MenuButton icon="👥" title="Registre des Fidèles" subtitle="Membres" onPress={() => setCurrentView('MEMBERS')} />
        <MenuButton icon="🏢" title="Supervision Départements" subtitle={`${stats.departmentsCount} départements`} onPress={() => setCurrentView('DEPTS_LIST')} />
      </View>
    </ScrollView>
  );

  // ===================== MAIN RENDER =====================
  const getHeaderTitle = () => {
    switch (currentView) {
      case 'HUB': return churchInfo?.name || 'Tableau de bord';
      case 'BUREAU': return 'Bureau Pastoral';
      case 'AGENDA': return 'Agenda & Réceptions';
      case 'PRAYERS': return 'Requêtes de Prière';
      case 'FOLLOWUP': return 'Suivi Spirituel';
      case 'FOLLOWUP_DETAIL': return 'Dossier Pastoral';
      case 'MEMBERS': return 'Registre des Fidèles';
      case 'FINANCES': return 'Gestion des Finances';
      case 'DEPTS_LIST': return 'Départements';
      case 'DEPT_HUB': return selectedDept?.custom_name || selectedDept?.name || 'Département';
      case 'DEPT_PENDING': return 'Candidatures';
      case 'DEPT_MEMBERS': return 'Membres du département';
      case 'DEPT_SOULS': return 'Suivi des Âmes';
      case 'DEPT_HEADCOUNTS': return 'Dénombrement';
      case 'DEPT_FINANCES': return 'Finances du département';
      case 'DEPT_PROJECTS': return 'Projets & Tâches';
      case 'DEPT_EQUIPMENTS': return 'Matériel';
      case 'DEPT_PLANNING': return 'Planning';
      case 'DEPT_ANNOUNCEMENTS': return 'Annonces';
      case 'DEPT_SONGS': return 'Répertoire';
      case 'DEPT_CHILDREN': return 'Enfants';
      default: return '';
    }
  };

  const handleBack = () => {
    // 🔴 Empêcher le retour vers HomeScreen
    if (currentView.startsWith('DEPT_') && currentView !== 'DEPT_HUB') {
      setCurrentView('DEPT_HUB');
    } else if (currentView === 'DEPT_HUB') {
      setCurrentView('DEPTS_LIST');
      setSelectedDept(null);
    } else if (currentView === 'DEPTS_LIST') {
      setCurrentView('HUB');
    } else if (currentView === 'FOLLOWUP_DETAIL') {
      setCurrentView('FOLLOWUP');
      setSelectedFollowupMember(null);
    } else if (currentView !== 'HUB') {
      setCurrentView('HUB');
    } else {
      // Sur le HUB : ouvrir la modale de sortie
      setExitModalVisible(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backBtn}>⬅ {currentView === 'HUB' ? 'Quitter' : 'Retour'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {currentView === 'HUB' && (
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#f97316', textTransform: 'uppercase', letterSpacing: 1 }}>Tableau de bord Pastoral</Text>
          )}
          {currentView === 'DEPT_HUB' && (
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 1 }}>👁️ Mode Superviseur</Text>
          )}
          <Text style={styles.headerTitle} numberOfLines={1}>{getHeaderTitle()}</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#f97316" /></View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
          {currentView === 'HUB' && renderHub()}
          {currentView === 'BUREAU' && renderBureau()}
          {currentView === 'AGENDA' && renderAgenda()}
          {currentView === 'PRAYERS' && renderPrayers()}
          {currentView === 'FOLLOWUP' && renderFollowupList()}
          {currentView === 'FOLLOWUP_DETAIL' && renderFollowupDetail()}
          {currentView === 'MEMBERS' && renderMembers()}
          {currentView === 'FINANCES' && renderFinances()}
          {currentView === 'DEPTS_LIST' && renderDeptsList()}
          {currentView === 'DEPT_HUB' && renderDeptHub()}
          {currentView === 'DEPT_PENDING' && renderDeptPending()}
          {currentView === 'DEPT_MEMBERS' && renderDeptMembers()}
          {currentView === 'DEPT_SOULS' && renderDeptSouls()}
          {currentView === 'DEPT_HEADCOUNTS' && renderDeptHeadcounts()}
          {currentView === 'DEPT_FINANCES' && renderDeptFinances()}
          {currentView === 'DEPT_PROJECTS' && renderDeptProjects()}
          {currentView === 'DEPT_EQUIPMENTS' && renderDeptEquipments()}
          {currentView === 'DEPT_PLANNING' && renderDeptPlanning()}
          {currentView === 'DEPT_ANNOUNCEMENTS' && renderDeptAnnouncements()}
          {currentView === 'DEPT_SONGS' && renderDeptSongs()}
          {currentView === 'DEPT_CHILDREN' && renderDeptChildren()}
        </View>
      )}

      {/* ===== MODALE DE SORTIE (DÉCONNEXION) ===== */}
      <Modal visible={exitModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 340 }]}>
            <Text style={{ fontSize: 50, textAlign: 'center', marginBottom: 10 }}>👋</Text>
            <Text style={styles.modalTitle}>Quitter le tableau pastoral ?</Text>
            <Text style={styles.modalSubtitle}>
              Vous serez déconnecté de votre espace de gestion d'église.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setExitModalVisible(false)}>
                <Text style={styles.btnSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#ef4444' }]} onPress={handleExit}>
                <Text style={styles.btnPrimaryText}>Se déconnecter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== MODALE NOTE PASTORALE ===== */}
      <Modal visible={noteEditorVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📝 Note Pastorale</Text>
            <Text style={styles.modalSubtitle}>Consignez les points de prière, conseils ou observations issus de cet entretien.</Text>
            <TextInput style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]} placeholder="Vos notes..." multiline value={editingNote} onChangeText={setEditingNote} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setNoteEditorVisible(false)}>
                <Text style={styles.btnSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={async () => {
                if (editingApptId) await updateAppointment(editingApptId, 'APPROVED', editingNote);
                setNoteEditorVisible(false);
              }}>
                <Text style={styles.btnPrimaryText}>💾 Sauvegarder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== MODALE REFUS RDV ===== */}
      <Modal visible={rejectModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✕ Refuser la demande</Text>
            <Text style={styles.modalSubtitle}>Indiquez le motif du refus qui sera visible par le fidèle.</Text>
            <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Motif du refus..." multiline value={rejectReason} onChangeText={setRejectReason} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setRejectModalVisible(false)}>
                <Text style={styles.btnSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnReject} onPress={async () => {
                if (rejectingApptId) await updateAppointment(rejectingApptId, 'REJECTED', rejectReason);
                setRejectModalVisible(false);
              }}>
                <Text style={styles.btnText}>Confirmer le refus</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ===================== SOUS-COMPOSANTS =====================
const MenuButton = ({ icon, title, subtitle, onPress }: any) => (
  <TouchableOpacity style={styles.menuCard} onPress={onPress}>
    <Text style={{ fontSize: 26, marginBottom: 6 }}>{icon}</Text>
    <Text style={styles.menuCardTitle}>{title}</Text>
    <Text style={styles.menuCardSubtitle}>{subtitle}</Text>
  </TouchableOpacity>
);

const AnnouncementForm = ({ onSubmit }: { onSubmit: (t: string, b: string) => void }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  return (
    <View style={styles.formBox}>
      <Text style={styles.label}>Titre de l'annonce</Text>
      <TextInput style={styles.input} placeholder="Ex: Grande veillée de prière" value={title} onChangeText={setTitle} />
      <Text style={styles.label}>Message</Text>
      <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Détails..." multiline value={body} onChangeText={setBody} />
      <TouchableOpacity style={styles.btnPrimary} onPress={() => { if (title && body) onSubmit(title, body); }}>
        <Text style={styles.btnPrimaryText}>📢 Publier sur l'App</Text>
      </TouchableOpacity>
    </View>
  );
};

const ProgramForm = ({ onSubmit }: { onSubmit: (t: string, c: string, s: string, l: string) => void }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Culte');
  const [startAt, setStartAt] = useState('');
  const [location, setLocation] = useState('Temple principal');
  return (
    <View style={styles.formBox}>
      <Text style={styles.label}>Titre</Text>
      <TextInput style={styles.input} placeholder="Ex: Culte dominical" value={title} onChangeText={setTitle} />
      <Text style={styles.label}>Catégorie</Text>
      <View style={styles.pickerWrap}>
        <TouchableOpacity style={styles.picker} onPress={() => Alert.alert('Catégorie', 'Choisir', [
          { text: 'Culte', onPress: () => setCategory('Culte') },
          { text: 'Prière', onPress: () => setCategory('Prière') },
          { text: 'Enseignement', onPress: () => setCategory('Enseignement') },
          { text: 'Événement', onPress: () => setCategory('Événement') },
        ])}>
          <Text style={styles.pickerText}>{category}</Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.label}>Date & Heure (format: 2025-01-15T18:30)</Text>
      <TextInput style={styles.input} placeholder="2025-01-15T18:30" value={startAt} onChangeText={setStartAt} />
      <Text style={styles.label}>Lieu</Text>
      <TextInput style={styles.input} placeholder="Temple principal" value={location} onChangeText={setLocation} />
      <TouchableOpacity style={styles.btnPrimary} onPress={() => { if (title && startAt) onSubmit(title, category, startAt, location); }}>
        <Text style={styles.btnPrimaryText}>📅 Ajouter au calendrier</Text>
      </TouchableOpacity>
    </View>
  );
};

const AvailabilityForm = ({ onSubmit }: { onSubmit: (d: number, s: string, e: string, dur: number) => void }) => {
  const [day, setDay] = useState(1);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState(30);
  return (
    <View style={styles.formBox}>
      <Text style={styles.label}>Jour de la semaine</Text>
      <View style={styles.pickerWrap}>
        <TouchableOpacity style={styles.picker} onPress={() => Alert.alert('Jour', 'Choisir', DAYS_OF_WEEK.map((d, i) => ({ text: d, onPress: () => setDay(i) })))}>
          <Text style={styles.pickerText}>{DAYS_OF_WEEK[day]}</Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>De</Text>
          <TextInput style={styles.input} placeholder="09:00" value={startTime} onChangeText={setStartTime} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>À</Text>
          <TextInput style={styles.input} placeholder="12:00" value={endTime} onChangeText={setEndTime} />
        </View>
      </View>
      <Text style={styles.label}>Durée par RDV</Text>
      <View style={styles.pickerWrap}>
        <TouchableOpacity style={styles.picker} onPress={() => Alert.alert('Durée', 'Choisir', [
          { text: '15 min', onPress: () => setDuration(15) },
          { text: '30 min', onPress: () => setDuration(30) },
          { text: '45 min', onPress: () => setDuration(45) },
          { text: '1 heure', onPress: () => setDuration(60) },
        ])}>
          <Text style={styles.pickerText}>{duration} minutes</Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.btnPrimary} onPress={() => { if (startTime && endTime) onSubmit(day, startTime, endTime, duration); }}>
        <Text style={styles.btnPrimaryText}>💾 Enregistrer le créneau</Text>
      </TouchableOpacity>
    </View>
  );
};

const SpiritualNoteForm = ({ onSubmit }: { onSubmit: (c: string, b: string) => void }) => {
  const [category, setCategory] = useState('Counseling');
  const [body, setBody] = useState('');
  return (
    <View>
      <Text style={styles.label}>Catégorie</Text>
      <View style={styles.pickerWrap}>
        <TouchableOpacity style={styles.picker} onPress={() => Alert.alert('Catégorie', 'Choisir', [
          { text: 'Counseling', onPress: () => setCategory('Counseling') },
          { text: 'Baptême', onPress: () => setCategory('Baptême') },
          { text: 'Discipline', onPress: () => setCategory('Discipline') },
          { text: 'Combat Spirituel', onPress: () => setCategory('Combat Spirituel') },
          { text: 'Autre', onPress: () => setCategory('Autre') },
        ])}>
          <Text style={styles.pickerText}>{category}</Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.label}>Note</Text>
      <TextInput style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]} placeholder="Notez les points de prière, conseils donnés ou confidences partagées..." multiline value={body} onChangeText={setBody} />
      <TouchableOpacity style={[styles.btnPrimary, { marginTop: 10 }]} onPress={() => { if (body) { onSubmit(category, body); setBody(''); } }}>
        <Text style={styles.btnPrimaryText}>＋ Ajouter au dossier</Text>
      </TouchableOpacity>
    </View>
  );
};

// ===================== STYLES =====================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20, paddingHorizontal: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#0f172a' },
  backBtn: { color: '#64748b', fontWeight: 'bold', width: 70 },
  emptyText: { textAlign: 'center', marginTop: 10, color: '#94a3b8', fontStyle: 'italic' },
  emptyBox: { padding: 25, backgroundColor: '#f1f5f9', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed', marginBottom: 15 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginTop: 25, marginBottom: 15 },
  subSectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', marginTop: 20, marginBottom: 10 },

  subTabs: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, marginTop: 15, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  subTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  subTabActive: { backgroundColor: '#0f172a' },
  subTabText: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
  subTabTextActive: { color: '#fff' },

  statsRow: { flexDirection: 'row', gap: 15, marginTop: 20 },
  statBox: { flex: 1, backgroundColor: '#fff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 5 },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#0f172a' },
  alertsContainer: { flexDirection: 'row', gap: 15 },
  alertCard: { flex: 1, padding: 15, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  alertValue: { fontSize: 24, fontWeight: 'bold', color: '#d97706' },
  alertLabel: { fontSize: 11, fontWeight: 'bold', color: '#f59e0b', marginTop: 2 },
  alertInfoBox: { backgroundColor: '#fffbeb', borderColor: '#fcd34d', borderWidth: 1, borderRadius: 12, padding: 12 },
  alertInfoText: { color: '#d97706', fontWeight: 'bold', fontSize: 12 },

  financeOverview: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
  financeOverviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  financeOverviewLabel: { fontSize: 11, color: '#cbd5e1', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  financeOverviewValue: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  financeBtn: { backgroundColor: '#f97316', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  financeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  gridMenu: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  menuCard: { width: (width - 52) / 2, backgroundColor: '#fff', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  menuCardTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginTop: 4 },
  menuCardSubtitle: { fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 2 },

  card: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontWeight: 'bold', fontSize: 15, color: '#0f172a' },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 4 },
  cardBody: { fontSize: 14, fontStyle: 'italic', color: '#334155', marginVertical: 12, backgroundColor: '#f8fafc', padding: 10, borderRadius: 8 },
  cardMeta: { fontSize: 11, color: '#94a3b8', marginTop: 8, fontWeight: '600' },

  typeBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: { fontSize: 9, fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' },
  memberNoteBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginTop: 10, borderLeftWidth: 3, borderLeftColor: '#3b82f6' },
  memberNoteText: { fontSize: 13, color: '#475569', fontStyle: 'italic' },
  rowActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btnApprove: { flex: 1, backgroundColor: '#10b981', padding: 12, borderRadius: 10, alignItems: 'center' },
  btnReject: { flex: 1, backgroundColor: '#ef4444', padding: 12, borderRadius: 10, alignItems: 'center' },
  btnComplete: { backgroundColor: '#0f172a', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  btnSecondary: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', padding: 12, borderRadius: 10, alignItems: 'center' },
  btnSecondaryText: { color: '#0f172a', fontSize: 13, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
  badgeApproved: { backgroundColor: '#10b981' },
  badgeRejected: { backgroundColor: '#ef4444' },
  smallBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  smallBadgeText: { fontSize: 10, fontWeight: 'bold' },
  badgesRow: { flexDirection: 'row', gap: 5, marginTop: 8, flexWrap: 'wrap' },

  searchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', padding: 14, borderRadius: 12, marginBottom: 12, fontSize: 14 },
  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  memberAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },

  announcementCard: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
  programCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  categoryBadge: { backgroundColor: '#0f172a', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  categoryBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  availabilityCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 4, borderLeftColor: '#3b82f6' },

  prayerStatsRow: { flexDirection: 'row', gap: 10, marginTop: 15 },
  prayerStatBox: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  prayerStatLabel: { fontSize: 10, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' },
  prayerStatValue: { fontSize: 24, fontWeight: 'bold' },
  prayerBar: { width: '60%', backgroundColor: '#10b981', borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 2, justifyContent: 'flex-start', alignItems: 'center' },
  prayerBarLabel: { fontSize: 9, color: '#0f172a', fontWeight: 'bold', position: 'absolute', top: -14 },
  historyPrayerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },

  dossierHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', padding: 20, borderRadius: 16, marginTop: 10, marginBottom: 20 },
  dossierAvatar: { width: 60, height: 60, borderRadius: 16, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  dossierAvatarText: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  dossierName: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  dossierLabel: { fontSize: 10, color: '#cbd5e1', fontWeight: 'bold', letterSpacing: 1.5, marginTop: 4 },

  timelineItem: { flexDirection: 'row', marginBottom: 15 },
  timelineDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', borderWidth: 2, borderColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 5 },
  timelineCard: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  timelineCategory: { fontSize: 10, fontWeight: 'bold', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 1 },
  timelineDate: { fontSize: 11, color: '#94a3b8', fontWeight: '600', marginTop: 4, marginBottom: 8 },
  timelineBody: { fontSize: 14, color: '#334155', lineHeight: 20 },

  formBox: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  label: { fontSize: 10, fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', padding: 12, borderRadius: 10, fontSize: 14, color: '#0f172a' },
  pickerWrap: { marginBottom: 5 },
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', padding: 12, borderRadius: 10 },
  pickerText: { fontSize: 14, color: '#0f172a' },
  pickerArrow: { fontSize: 10, color: '#94a3b8' },
  btnPrimary: { backgroundColor: '#0f172a', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 25, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 5 },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 15 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 15 },

  balanceCard: { backgroundColor: '#0f172a', padding: 25, borderRadius: 20, alignItems: 'center', marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  balanceLabel: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 },
  balanceAmount: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginBottom: 15 },
  balanceStatsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 15 },
  balanceStatLabel: { color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 2 },
  balanceStatIncome: { color: '#4ade80', fontSize: 14, fontWeight: 'bold' },
  balanceStatExpense: { color: '#f87171', fontSize: 14, fontWeight: 'bold' },
  balanceStatDivider: { width: 1, height: '100%', backgroundColor: '#334155' },

  analyticsBox: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  analyticsHeader: { fontSize: 12, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 15 },
  analyticsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  analyticsStat: { alignItems: 'flex-start', flex: 1 },
  analyticsLabel: { fontSize: 11, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  analyticsValue: { fontSize: 18, fontWeight: 'bold' },
  analyticsDivider: { width: 1, height: 30, backgroundColor: '#e2e8f0', marginHorizontal: 15 },

  chartContainer: { flexDirection: 'row', alignItems: 'flex-end', height: 130, justifyContent: 'space-between', gap: 8, paddingHorizontal: 5 },
  chartCol: { flex: 1, alignItems: 'center', height: '100%' },
  chartBarsWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', width: '100%', gap: 2, paddingBottom: 5 },
  chartBarInc: { flex: 1, backgroundColor: '#34d399', borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 2 },
  chartBarExp: { flex: 1, backgroundColor: '#f87171', borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 2 },
  chartLabel: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', gap: 15, marginTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: '#64748b', fontWeight: 'bold' },

  expenseBarContainer: { marginBottom: 12 },
  expenseBarLabel: { fontSize: 12, fontWeight: 'bold', color: '#334155' },
  expenseBarValue: { fontSize: 11, fontWeight: 'bold', color: '#94a3b8' },
  expenseBarBg: { width: '100%', height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  expenseBarFill: { height: '100%', backgroundColor: '#f97316', borderRadius: 3 },

  financeCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  financeCategory: { fontWeight: 'bold', fontSize: 15, color: '#0f172a' },
  financeDate: { fontSize: 11, color: '#64748b', marginTop: 4 },
  financeAmount: { fontWeight: 'bold', fontSize: 16 },
  financeToggleBtn: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 8 },
  financeToggleText: { fontWeight: 'bold', color: '#64748b', fontSize: 12 },

  // 🔴 DÉPARTEMENTS
  deptCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  deptIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  deptName: { fontWeight: 'bold', fontSize: 15, color: '#0f172a' },
  deptSub: { fontSize: 12, color: '#64748b', marginTop: 4 },

  // Filtres
  classPill: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  classPillActive: { backgroundColor: '#3b82f6', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  classPillText: { color: '#64748b', fontSize: 12, fontWeight: 'bold' },
  classPillActiveText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});
