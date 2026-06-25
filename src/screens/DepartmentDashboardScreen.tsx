// src/screens/DepartmentDashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  ActivityIndicator, Alert, ScrollView, TextInput, Modal, Linking,
  KeyboardAvoidingView, Platform, Image, Dimensions, Switch
} from 'react-native';
import { supabase } from '../lib/supabase';
import { pickImage, uploadToSupabase } from '../components/WebImagePicker';
import DateTimePicker from '../components/WebDatePicker';

import EvangelismModule from '../components/departments/EvangelismModule';
import FinanceModule from '../components/departments/FinanceModule';
import HeadcountModule from '../components/departments/HeadcountModule';

const { width } = Dimensions.get('window');

type ViewState = 'HUB' | 'PENDING' | 'MEMBERS' | 'SONGS' | 'FINANCES' | 'PLANNING' | 'ANNOUNCEMENTS' | 'CHILDREN' | 'SOULS' | 'PROJECTS' | 'EQUIPMENTS' | 'HEADCOUNTS';

export default function DepartmentDashboardScreen({ deptId, onBack }: { deptId: string, onBack: () => void }) {
  const [currentView, setCurrentView] = useState<ViewState>('HUB');
  const [loading, setLoading] = useState(true);
  const [isLeader, setIsLeader] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [isChoirDept, setIsChoirDept] = useState(false);
  const [isChildrenDept, setIsChildrenDept] = useState(false);
  const [isEvangelismDept, setIsEvangelismDept] = useState(false);
  const [isMediaDept, setIsMediaDept] = useState(false);
  const [isUsherDept, setIsUsherDept] = useState(false);
  const [hasSubGroups, setHasSubGroups] = useState(false);
  
  const [deptInfo, setDeptInfo] = useState<any>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeMembers, setActiveMembers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [totalChurchMembers, setTotalChurchMembers] = useState(0); // 🔴 STATS
  
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMember, setSelectedMember] = useState<any>(null); 
  const [memberFilter, setMemberFilter] = useState('Tous'); // 🔴 FILTRE GROUPES

  const [songs, setSongs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingSong, setIsAddingSong] = useState(false);
  const [newSong, setNewSong] = useState({ title: '', key: '', url: '' });

  const [finances, setFinances] = useState<any[]>([]);
  const [isAddingFinance, setIsAddingFinance] = useState(false);
  const [newFinance, setNewFinance] = useState({ type: 'INCOME', category: 'Mensuelle', amount: '', motif: '', member_id: '' });
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [isAssignDropdownOpen, setIsAssignDropdownOpen] = useState(false);

  const [plannings, setPlannings] = useState<any[]>([]);
  const [churchPrograms, setChurchPrograms] = useState<any[]>([]);
  const [allChurchPrograms, setAllChurchPrograms] = useState<any[]>([]); 
  const [planningRoles, setPlanningRoles] = useState<any[]>([]);
  const [isAddingPlanning, setIsAddingPlanning] = useState(false);
  const [selectedChurchProgram, setSelectedChurchProgram] = useState<any>(null);
  
  const [dateObj, setDateObj] = useState<Date | undefined>(undefined);
  const [newPlanning, setNewPlanning] = useState({ title: '', date: '', time: '', description: '', is_church_event: false, concerns_all: true, selected_groups: [] as string[] });

  const [isAssigningRole, setIsAssigningRole] = useState(false);
  const [selectedPlanningId, setSelectedPlanningId] = useState('');
  const [newRole, setNewRole] = useState({ user_id: '', role_name: '' });

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isAddingAnnouncement, setIsAddingAnnouncement] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', concerns_all: true, selected_groups: [] as string[] });

  const [childrenList, setChildrenList] = useState<any[]>([]);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [childFilter, setChildFilter] = useState('Tous');
  const [newChild, setNewChild] = useState({ first_name: '', last_name: '', class_id: '', parent_name: '', parent_phone: '' });
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);

  const [soulsList, setSoulsList] = useState<any[]>([]);
  const [isAddingSoul, setIsAddingSoul] = useState(false);
  const [newSoul, setNewSoul] = useState({ 
    id: '', first_name: '', last_name: '', phone: '', address: '', profession: '', assigned_to: '', photo_url: '',
    is_baptized_candidate: false, regularity: 'Faible', observations: '', is_called: false, is_visited: false,
    integration_status: 'NONE', integration_notes: ''
  });
  const [isSoulAssignDropdownOpen, setIsSoulAssignDropdownOpen] = useState(false);

  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', assigned_to: '', deadline: '' });

  const [equipments, setEquipments] = useState<any[]>([]);
  const [equipmentNeeds, setEquipmentNeeds] = useState<any[]>([]);
  const [equipmentTab, setEquipmentTab] = useState<'INVENTORY' | 'NEEDS'>('INVENTORY');
  const [isAddingEq, setIsAddingEq] = useState(false);
  const [newEq, setNewEq] = useState({ name: '', category: 'Vidéo', condition: 'BON' });
  const [isAddingEqNeed, setIsAddingEqNeed] = useState(false);
  const [newEqNeed, setNewEqNeed] = useState({ item_name: '', priority: 'MOYENNE' });

  const [headcounts, setHeadcounts] = useState<any[]>([]);
  const [isAddingHeadcount, setIsAddingHeadcount] = useState(false);
  const [editingHeadcountId, setEditingHeadcountId] = useState<string | null>(null); // 🔴 MODIFICATION
  const [isProgramDropdownOpen, setIsProgramDropdownOpen] = useState(false);
  const [newHeadcount, setNewHeadcount] = useState({ church_program_id: '', event_title: '', event_date: '', men_count: '', women_count: '', children_count: '' });

  useEffect(() => {
    if (deptId) loadInitialData(true);
  }, [deptId]);

  // 🚀 OPTIMISATION : Requêtes parallèles massives pour un chargement instantané
  async function loadInitialData(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      
      const { data: dept } = await supabase.from('church_departments').select('*').eq('id', deptId).single();
      
      let isChoir = false; let isChild = false; let isEvang = false; let isMedia = false; let isUsher = false;

      if (dept) {
        const dName = dept.custom_name || dept.name;
        setDeptInfo({ id: dept.id, name: dName, church_id: dept.church_id });
        const lowered = dName.toLowerCase();
        isChoir = !!lowered.match(/chorale|louange|mystic/);
        isChild = !!lowered.match(/enfant|ecodim|dimanche/);
        isEvang = !!lowered.match(/évangélisation|evangelisation|gagnants|âmes|mission/);
        isMedia = !!lowered.match(/multimédia|multimedia|technique|sonorisation|communication|media/);
        isUsher = !!lowered.match(/ordre|accueil|protocole|huissier/);
        
        setIsChoirDept(isChoir); setIsChildrenDept(isChild); setIsEvangelismDept(isEvang); setIsMediaDept(isMedia); setIsUsherDept(isUsher);
        setHasSubGroups(isChoir || isUsher);

        // 🔴 Récupération du total des fidèles pour les analytiques
        if (dept.church_id) {
          const { count } = await supabase.from('church_members').select('*', { count: 'exact', head: true }).eq('church_id', dept.church_id).eq('status', 'APPROVED');
          setTotalChurchMembers(count || 1);
        }
      }

      // Parallélisation des requêtes de base
      const [
        roleDataRes, groupsRes, allReqsRes, rawPlanningsRes, rawPlanGroupsRes, 
        rawFinancesRes, cProgramsRes, rawAnnsRes, rawAnnGroupsRes
      ] = await Promise.all([
        supabase.from('user_roles').select('*').eq('user_id', user?.id).eq('role', 'DEPARTMENT_LEADER').eq('department_id', deptId).maybeSingle(),
        supabase.from('department_groups').select('*').eq('department_id', deptId).order('created_at', { ascending: true }),
        supabase.from('department_members').select('*').eq('department_id', deptId).in('status', ['PENDING', 'APPROVED']),
        supabase.from('department_plannings').select('*').eq('department_id', deptId).order('event_date', { ascending: true }),
        supabase.from('department_planning_groups').select('*'),
        supabase.from('department_finances').select('*').eq('department_id', deptId).order('created_at', { ascending: false }),
        dept?.church_id ? supabase.from('church_programs').select('*').eq('church_id', dept.church_id) : Promise.resolve({ data: [] }),
        supabase.from('department_announcements').select('*').eq('department_id', deptId).order('created_at', { ascending: false }),
        supabase.from('department_announcement_groups').select('*')
      ]);

      setIsLeader(!!roleDataRes.data);
      setGroups(groupsRes.data || []);

      let activeMembs: any[] = [];
      if (allReqsRes.data) {
        const userIds = allReqsRes.data.map((r: any) => r.user_id);
        const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds);
        
        // 🔴 PRÉSERVATION : Les pendingRequests sont bien les demandes d'adhésion au département !
        const pending = allReqsRes.data.filter((r: any) => r.status === 'PENDING').map((r: any) => ({ ...r, member: { full_name: profiles?.find(p => p.id === r.user_id)?.full_name || 'Fidèle' } }));
        const approved = allReqsRes.data.filter((r: any) => r.status === 'APPROVED').map((r: any) => ({ ...r, member: { full_name: profiles?.find(p => p.id === r.user_id)?.full_name || 'Fidèle' } }));
        
        setPendingRequests(pending); 
        setActiveMembers(approved); 
        activeMembs = approved;
      }

      const formattedPlannings = rawPlanningsRes.data?.map((p: any) => ({ ...p, assigned_groups: p.concerns_all ? [] : rawPlanGroupsRes.data?.filter((pg: any) => pg.planning_id === p.id).map((pg: any) => pg.group_id) })) || [];
      setPlannings(formattedPlannings);

      // Parallélisation des modules spécifiques
      const modulePromises: Promise<any>[] = [];
      if (isMedia) {
        const planIds = formattedPlannings.map((p: any) => p.id);
        modulePromises.push(planIds.length > 0 ? supabase.from('department_planning_roles').select('*').in('planning_id', planIds).then(r=>({k:'pRoles', d:r.data})) : Promise.resolve({k:'pRoles', d:[]}));
        modulePromises.push(supabase.from('department_projects').select('*').eq('department_id', deptId).order('created_at', { ascending: false }).then(r=>({k:'projs', d:r.data})));
        modulePromises.push(supabase.from('department_equipments').select('*').eq('department_id', deptId).then(r=>({k:'eqs', d:r.data})));
        modulePromises.push(supabase.from('department_equipment_needs').select('*').eq('department_id', deptId).then(r=>({k:'eqNeeds', d:r.data})));
      }
      if (isUsher) modulePromises.push(supabase.from('department_headcounts').select('*').eq('department_id', deptId).order('event_date', { ascending: false }).then(r=>({k:'hc', d:r.data})));
      if (isChild) modulePromises.push(supabase.from('department_children').select('*').eq('department_id', deptId).order('first_name', { ascending: true }).then(r=>({k:'children', d:r.data})));
      if (isEvang) modulePromises.push(supabase.from('department_souls').select('*').eq('department_id', deptId).order('created_at', { ascending: false }).then(r=>({k:'souls', d:r.data})));
      if (isChoir) modulePromises.push(supabase.from('department_songs').select('*').eq('department_id', deptId).order('title', { ascending: true }).then(r=>({k:'songs', d:r.data})));

      const moduleResults = await Promise.all(modulePromises);
      for (const res of moduleResults) {
          switch(res.k) {
            case 'pRoles': setPlanningRoles(res.d?.map((pr: any) => ({ ...pr, member_name: activeMembs.find(m => m.user_id === pr.user_id)?.member.full_name || 'Membre' })) || []); break;
            case 'projs': {
              setProjects(res.d || []);
              if (res.d && res.d.length > 0) {
                  if (!selectedProjectId) setSelectedProjectId(res.d[0].id);
                  const { data: tsks } = await supabase.from('department_tasks').select('*').in('project_id', res.d.map((p: any) => p.id));
                  setTasks(tsks?.map((t: any) => ({ ...t, assigned_name: activeMembs.find(m => m.user_id === t.assigned_to)?.member.full_name || 'Non assigné' })) || []);
              }
              break;
            }
            case 'eqs': setEquipments(res.d || []); break;
            case 'eqNeeds': setEquipmentNeeds(res.d || []); break;
            case 'hc': setHeadcounts(res.d || []); break;
            case 'children': setChildrenList(res.d || []); break;
            case 'souls': setSoulsList(res.d?.map((s: any) => ({ ...s, assigned_member: s.assigned_to ? activeMembs.find(p => p.user_id === s.assigned_to)?.member.full_name : null })) || []); break;
            case 'songs': setSongs(res.d || []); break;
          }
      }

      setFinances(rawFinancesRes.data?.map((fin: any) => ({ ...fin, member: fin.member_id ? { full_name: activeMembs.find(p => p.user_id === fin.member_id)?.member.full_name || 'Inconnu' } : null })) || []);
      
      if (dept?.church_id) {
          const sortedPrograms = (cProgramsRes.data || []).sort((a: any, b: any) => new Date(a.date || a.start_time || a.created_at).getTime() - new Date(b.date || b.start_time || b.created_at).getTime());
          setAllChurchPrograms(sortedPrograms); 
          setChurchPrograms(sortedPrograms.filter((cp: any) => !formattedPlannings.some((dp: any) => dp.church_program_id === cp.id))); 
      }
      setAnnouncements(rawAnnsRes.data?.map((a: any) => ({ ...a, assigned_groups: a.concerns_all ? [] : rawAnnGroupsRes.data?.filter((ag: any) => ag.announcement_id === a.id).map((ag: any) => ag.group_id) })) || []);

    } catch(e) { console.log(e); }
    if (showSpinner) setLoading(false);
  }

  // --- ACTIONS DE BASE (Préservées à 100%) ---
  const handleStatusUpdate = async (id: string, status: 'APPROVED' | 'REJECTED') => { 
    setPendingRequests(prev => prev.filter(r => r.id !== id));
    await supabase.from('department_members').update({ status, updated_at: new Date().toISOString() }).eq('id', id); 
    loadInitialData(false); 
  };
  
  const handleRemoveMemberFromDept = async (id: string) => { 
    Alert.alert("Exclure", "Voulez-vous retirer ce membre ?", [ 
      { text: "Annuler", style: "cancel" }, 
      { text: "Oui", style: 'destructive', onPress: async () => { 
        setActiveMembers(prev => prev.filter(m => m.id !== id));
        await supabase.from('department_members').delete().eq('id', id); 
        setSelectedMember(null); 
        loadInitialData(false); 
      }} 
    ]); 
  };

  const handleCreateGroup = async () => { 
    if (!newGroupName.trim()) return; 
    setCreatingGroup(true); 
    const { error } = await supabase.from('department_groups').insert({ department_id: deptId, name: newGroupName.trim() }); 
    setCreatingGroup(false); 
    setNewGroupName(''); 
    if(error) Alert.alert("Erreur", error.message); 
    else { loadInitialData(false); } 
  };

  // 🔴 NOUVEAU : Contrôles stricts pour Dénombrement (Max 4/jour, Anti-doublon, Modification)
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
      return Alert.alert("Doublon", "Un rapport existe déjà pour ce programme à cette date exacte. Veuillez le modifier.");
    }

    const m = parseInt(newHeadcount.men_count) || 0;
    const w = parseInt(newHeadcount.women_count) || 0;
    const c = parseInt(newHeadcount.children_count) || 0;
    const total = m + w + c;
    const { data: { user } } = await supabase.auth.getUser();
    
    const payload = {
      department_id: deptId, event_title: newHeadcount.event_title, event_date: newHeadcount.event_date, church_program_id: newHeadcount.church_program_id,
      men_count: m, women_count: w, children_count: c, total_count: total, created_by: user?.id
    };

    if (editingHeadcountId) {
      await supabase.from('department_headcounts').update(payload).eq('id', editingHeadcountId);
    } else {
      await supabase.from('department_headcounts').insert(payload);
    }

    setIsAddingHeadcount(false);
    setEditingHeadcountId(null);
    setNewHeadcount({ church_program_id: '', event_title: '', event_date: '', men_count: '', women_count: '', children_count: '' });
    loadInitialData(false);
  };

  // --- ACTIONS ÂMES (Intégration) ---
  const handleRequestIntegration = async (soul: any) => {
    Alert.alert(
      "Demande d'intégration",
      "Soumettre cette âme au pasteur pour qu'elle devienne membre officiel ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Oui, soumettre", 
          onPress: async () => {
            await supabase.from('department_souls').update({
              integration_status: 'PENDING',
              integration_notes: 'En attente de validation pastorale'
            }).eq('id', soul.id);
            Alert.alert('Succès', 'La demande a été transmise au pasteur.');
            setIsAddingSoul(false);
            loadInitialData(false);
          }
        }
      ]
    );
  };

  // --- AUTRES ACTIONS PRESERVEES ---
  const takePhoto = async () => {
    const picked = await pickImage({ source: 'camera', allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (picked?.uri) setNewSoul({ ...newSoul, photo_url: picked.uri });
  };
  const pickFromGallery = async () => {
    const picked = await pickImage({ source: 'gallery', allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (picked?.uri) setNewSoul({ ...newSoul, photo_url: picked.uri });
  };
  const handleAddSoul = async () => {
    if (!newSoul.first_name.trim() || !newSoul.last_name.trim()) return Alert.alert("Erreur", "Le nom et prénom sont obligatoires.");
    const { data: { user } } = await supabase.auth.getUser();
    const soulData = {
      department_id: deptId, first_name: newSoul.first_name.trim(), last_name: newSoul.last_name.trim(), phone: newSoul.phone.trim() || null, address: newSoul.address.trim() || null, profession: newSoul.profession.trim() || null, assigned_to: newSoul.assigned_to || null, photo_url: newSoul.photo_url || null,
      is_baptized_candidate: newSoul.is_baptized_candidate, regularity: newSoul.regularity, observations: newSoul.observations.trim() || null, is_called: newSoul.is_called, is_visited: newSoul.is_visited
    };
    if (newSoul.id) { await supabase.from('department_souls').update(soulData).eq('id', newSoul.id); } 
    else { await supabase.from('department_souls').insert({ ...soulData, created_by: user?.id }); }
    setIsAddingSoul(false); loadInitialData(false);
  };
  const handleAddFinance = async () => {
    if (!newFinance.amount || isNaN(Number(newFinance.amount))) return Alert.alert("Erreur", "Montant invalide.");
    if (newFinance.type === 'EXPENSE' && !newFinance.motif.trim()) return Alert.alert("Erreur", "Le motif est requis.");
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('department_finances').insert({ department_id: deptId, type: newFinance.type, category: newFinance.type === 'INCOME' ? newFinance.category : 'Dépense', amount: Number(newFinance.amount), motif: newFinance.motif.trim() || null, member_id: newFinance.member_id || null, created_by: user?.id });
    setIsAddingFinance(false); setNewFinance({ type: 'INCOME', category: 'Mensuelle', amount: '', motif: '', member_id: '' }); loadInitialData(false); 
  };
  const handleAddSong = async () => { if (!newSong.title.trim()) return Alert.alert("Erreur", "Le titre est obligatoire."); const { data: { user } } = await supabase.auth.getUser(); await supabase.from('department_songs').insert({ department_id: deptId, title: newSong.title.trim(), musical_key: newSong.key.trim() || null, video_url: newSong.url.trim() || null, created_by: user?.id }); setIsAddingSong(false); setNewSong({ title: '', key: '', url: '' }); loadInitialData(false); };
  const openVideo = (url: string) => { if (url) Linking.openURL(url.startsWith('http') ? url : `https://${url}`).catch(() => Alert.alert("Erreur", "Lien invalide.")); };
  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) return Alert.alert("Erreur", "Titre et contenu obligatoires.");
    const { data: { user } } = await supabase.auth.getUser();
    const concernsAll = hasSubGroups ? newAnnouncement.concerns_all : true;
    const { data: annData, error: annError } = await supabase.from('department_announcements').insert({ department_id: deptId, title: newAnnouncement.title.trim(), content: newAnnouncement.content.trim(), concerns_all: concernsAll, created_by: user?.id }).select().single();
    if (annError) return Alert.alert('Erreur', annError.message);
    if (annData && !concernsAll && newAnnouncement.selected_groups.length > 0) {
      const inserts = newAnnouncement.selected_groups.map(gId => ({ announcement_id: annData.id, group_id: gId }));
      await supabase.from('department_announcement_groups').insert(inserts);
    }
    setIsAddingAnnouncement(false); setNewAnnouncement({ title: '', content: '', concerns_all: true, selected_groups: [] }); loadInitialData(false);
  };
  const handleAddPlanning = async (isJoiningChurchProgram: boolean = false, autoChurchProg?: any) => {
    if (!isJoiningChurchProgram && (!newPlanning.title.trim() || !newPlanning.date || !newPlanning.time)) return Alert.alert("Erreur", "Requis.");
    const { data: { user } } = await supabase.auth.getUser();
    let eventDateIso = new Date().toISOString(); let eventTitle = newPlanning.title.trim(); let churchProgramId = null;
    const programToJoin = autoChurchProg || selectedChurchProgram;

    if (isJoiningChurchProgram && programToJoin) {
      eventTitle = programToJoin.title; eventDateIso = programToJoin.date || programToJoin.start_time || programToJoin.created_at; churchProgramId = programToJoin.id;
    } else {
      const dateObjParsed = new Date(`${newPlanning.date}T${newPlanning.time}:00`);
      if (isNaN(dateObjParsed.getTime())) return Alert.alert("Erreur", "Date invalide.");
      eventDateIso = dateObjParsed.toISOString();
    }
    const concernsAll = hasSubGroups ? newPlanning.concerns_all : true;
    const { data: planData, error: planError } = await supabase.from('department_plannings').insert({ department_id: deptId, title: eventTitle, event_date: eventDateIso, description: newPlanning.description.trim() || null, is_church_event: isJoiningChurchProgram ? true : newPlanning.is_church_event, church_program_id: churchProgramId, concerns_all: concernsAll, created_by: user?.id }).select().single();
    if (planError) return Alert.alert('Erreur', planError.message);
    if (planData && !concernsAll && newPlanning.selected_groups.length > 0) {
      const inserts = newPlanning.selected_groups.map(gId => ({ planning_id: planData.id, group_id: gId }));
      await supabase.from('department_planning_groups').insert(inserts);
    }
    setIsAddingPlanning(false); setSelectedChurchProgram(null); setNewPlanning({ title: '', date: '', time: '', description: '', is_church_event: false, concerns_all: true, selected_groups: [] }); loadInitialData(false);
  };
  const handleAddChild = async () => {
    if (!newChild.first_name.trim() || !newChild.last_name.trim() || !newChild.class_id) return Alert.alert("Erreur", "Nom, prénom et classe requis.");
    const { data: { user } } = await supabase.auth.getUser();
    const selectedClass = groups.find(g => g.id === newChild.class_id);
    const { error } = await supabase.from('department_children').insert({ department_id: deptId, class_id: newChild.class_id, class_name: selectedClass?.name || 'Général', first_name: newChild.first_name.trim(), last_name: newChild.last_name.trim(), parent_name: newChild.parent_name.trim() || null, parent_phone: newChild.parent_phone.trim() || null, created_by: user?.id });
    if (error) Alert.alert("Erreur", error.message);
    else { setIsAddingChild(false); setNewChild({ first_name: '', last_name: '', class_id: '', parent_name: '', parent_phone: '' }); loadInitialData(false); }
  };
  const handleAddProject = async () => { if (!newProject.name.trim()) return; const { data: { user } } = await supabase.auth.getUser(); await supabase.from('department_projects').insert({ department_id: deptId, name: newProject.name.trim(), description: newProject.description.trim(), created_by: user?.id }); setIsAddingProject(false); setNewProject({ name: '', description: '' }); loadInitialData(false); };
  const handleAddTask = async () => {
    if (!newTask.title.trim() || !selectedProjectId) return Alert.alert("Erreur", "Titre requis.");
    await supabase.from('department_tasks').insert({ project_id: selectedProjectId, title: newTask.title.trim(), assigned_to: newTask.assigned_to || null, deadline: newTask.deadline || null });
    setIsAddingTask(false); setNewTask({ title: '', assigned_to: '', deadline: '' }); loadInitialData(false);
  };
  const cycleTaskStatus = async (task: any) => {
    if (!isLeader && task.assigned_to !== currentUserId) return Alert.alert("Refusé", "Vous ne pouvez modifier que les tâches qui vous sont assignées.");
    const nextStatus = task.status === 'TODO' ? 'IN_PROGRESS' : task.status === 'IN_PROGRESS' ? 'DONE' : 'TODO';
    await supabase.from('department_tasks').update({ status: nextStatus }).eq('id', task.id); loadInitialData(false);
  };
  const handleAddEq = async () => { if(!newEq.name.trim()) return Alert.alert("Erreur", "Nom requis."); await supabase.from('department_equipments').insert({ department_id: deptId, name: newEq.name.trim(), category: newEq.category, condition: newEq.condition }); setIsAddingEq(false); setNewEq({ name: '', category: 'Vidéo', condition: 'BON' }); loadInitialData(false); };
  const handleAddEqNeed = async () => { if(!newEqNeed.item_name.trim()) return Alert.alert("Erreur", "Nom requis."); await supabase.from('department_equipment_needs').insert({ department_id: deptId, item_name: newEqNeed.item_name.trim(), priority: newEqNeed.priority }); setIsAddingEqNeed(false); setNewEqNeed({ item_name: '', priority: 'MOYENNE' }); loadInitialData(false); };
  const cycleEqCondition = async (eq: any) => { const nextCond = eq.condition === 'BON' ? 'EN PANNE' : eq.condition === 'EN PANNE' ? 'EN REPARATION' : 'BON'; await supabase.from('department_equipments').update({ condition: nextCond }).eq('id', eq.id); loadInitialData(false); };
  const toggleEqAvailability = async (eq: any) => { await supabase.from('department_equipments').update({ is_available: !eq.is_available }).eq('id', eq.id); loadInitialData(false); };
  const handleAssignRole = async () => {
    if (!newRole.user_id || !newRole.role_name.trim() || !selectedPlanningId) return Alert.alert("Erreur", "Membre et rôle requis.");
    const { error } = await supabase.from('department_planning_roles').insert({ planning_id: selectedPlanningId, user_id: newRole.user_id, role_name: newRole.role_name.trim() });
    if (error) Alert.alert("Erreur", "Rôle déjà assigné.");
    setIsAssigningRole(false); setNewRole({ user_id: '', role_name: '' }); loadInitialData(false);
  };

  // 🔴 CALCULS PARESSEUX
  const filteredActiveMembers = memberFilter === 'Tous' ? activeMembers : activeMembers.filter(m => m.sub_group_id === memberFilter);
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthFinances = finances.filter(f => { const d = new Date(f.created_at); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
  const monthIncome = monthFinances.filter(f=>f.type==='INCOME').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const monthExpense = monthFinances.filter(f=>f.type==='EXPENSE').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const balance = finances.reduce((acc, curr) => curr.type === 'INCOME' ? acc + (Number(curr.amount) || 0) : acc - (Number(curr.amount) || 0), 0);
  
  const filteredChildren = currentView === 'CHILDREN' ? (childFilter === 'Tous' ? childrenList : childrenList.filter(c => c.class_id === childFilter)) : [];
  const projectTasks = currentView === 'PROJECTS' ? tasks.filter(t => t.project_id === selectedProjectId) : [];

  const avgAttendance = headcounts.length > 0 ? Math.round(headcounts.reduce((acc, h) => acc + h.total_count, 0) / headcounts.length) : 0;
  const maxAttendanceEver = Math.max(...headcounts.map(h => h.total_count), 1);
  const retentionRate = totalChurchMembers > 0 ? Math.min(Math.round((avgAttendance / totalChurchMembers) * 100), 100) : 0;

  const KanbanColumn = ({ title, status, color }: {title:string, status:string, color:string}) => (
    <View style={styles.kanbanCol}>
      <View style={[styles.kanbanColHeader, { borderBottomColor: color }]}><Text style={styles.kanbanColTitle}>{title}</Text></View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {projectTasks.filter(t => t.status === status).map(t => {
          const isOverdue = t.deadline && new Date(t.deadline) < new Date() && t.status !== 'DONE';
          return (
            <TouchableOpacity key={t.id} style={styles.kanbanCard} onPress={() => cycleTaskStatus(t)}>
              <Text style={styles.kTaskTitle}>{t.title}</Text>
              {t.deadline && ( <Text style={[styles.kTaskDeadline, isOverdue ? {color: '#ef4444', fontWeight: 'bold'} : {}]}>⏳ {new Date(t.deadline).toLocaleDateString('fr-FR')}</Text> )}
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, alignItems: 'center'}}>
                <Text style={styles.kTaskAssignee}>👤 {t.assigned_name}</Text>
                <Text style={{fontSize: 10, color: color, fontWeight: 'bold'}}>{status === 'TODO' ? 'À FAIRE' : status === 'IN_PROGRESS' ? 'EN COURS' : 'TERMINÉ'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const HubMenu = () => (
    <ScrollView contentContainerStyle={styles.hubGrid} showsVerticalScrollIndicator={false}>
      {isLeader && (
        <>
          <Text style={styles.hubSubtitle}>Administration ({deptInfo?.name})</Text>
          <View style={styles.row}>
            <HubCard title="Candidatures" count={pendingRequests.length} icon="📩" color="#f59e0b" onPress={() => setCurrentView('PENDING')} />
            <HubCard title={hasSubGroups ? "Membres & Groupes" : "Membres"} count={activeMembers.length} icon="👥" color="#3b82f6" onPress={() => setCurrentView('MEMBERS')} />
          </View>
        </>
      )}
      {isMediaDept && (
        <>
          <Text style={styles.hubSubtitle}>Gestion Multimédia</Text>
          <View style={styles.row}>
            <HubCard title="Projets & Tâches" count={projects.length} icon="📋" color="#8b5cf6" onPress={() => setCurrentView('PROJECTS')} />
            <HubCard title="Matériel & Régie" count={equipments.length} icon="📷" color="#10b981" onPress={() => setCurrentView('EQUIPMENTS')} />
          </View>
        </>
      )}
      {isUsherDept && (
        <>
          <Text style={styles.hubSubtitle}>Logistique & Rapports</Text>
          <View style={styles.row}>
            <HubCard title="Dénombrement" count={headcounts.length} icon="📊" color="#14b8a6" onPress={() => setCurrentView('HEADCOUNTS')} />
            <View style={{ flex: 1 }} />
          </View>
        </>
      )}
      {isChildrenDept && (
        <>
          <Text style={styles.hubSubtitle}>Registre de l'école du dimanche</Text>
          <View style={styles.row}>
            <HubCard title="Liste des Enfants" count={childrenList.length} icon="🧸" color="#f43f5e" onPress={() => setCurrentView('CHILDREN')} />
            <View style={{ flex: 1 }} />
          </View>
        </>
      )}
      {isEvangelismDept && (
        <>
          <Text style={styles.hubSubtitle}>Mission & Suivi</Text>
          <View style={styles.row}>
            <HubCard title="Nouvelles Âmes" count={soulsList.length} icon="🕊️" color="#f97316" onPress={() => setCurrentView('SOULS')} />
            <View style={{ flex: 1 }} />
          </View>
        </>
      )}
      <Text style={styles.hubSubtitle}>Vie du département {!isLeader && `(${deptInfo?.name})`}</Text>
      <View style={styles.row}>
        <HubCard title={isMediaDept ? "Agenda & Rôles" : "Planning"} count={plannings.length} icon="📅" color="#06b6d4" onPress={() => setCurrentView('PLANNING')} />
        <HubCard title="Annonces" count={announcements.length} icon="📢" color="#ec4899" onPress={() => setCurrentView('ANNOUNCEMENTS')} />
      </View>
      {isChoirDept && (
        <View style={styles.row}>
          <HubCard title="Répertoire" count={songs.length} icon="🎵" color="#8b5cf6" onPress={() => setCurrentView('SONGS')} />
          {isLeader ? <HubCard title="Finances" count={finances.length} icon="💰" color="#10b981" onPress={() => setCurrentView('FINANCES')} /> : <View style={{ flex: 1 }} />}
        </View>
      )}
      {!isChoirDept && isLeader && (
        <View style={styles.row}>
          <HubCard title="Finances" count={finances.length} icon="💰" color="#10b981" onPress={() => setCurrentView('FINANCES')} />
          <View style={{ flex: 1 }} />
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={currentView === 'HUB' ? onBack : () => setCurrentView('HUB')}><Text style={styles.backBtn}>⬅ {currentView === 'HUB' ? 'Accueil' : 'Retour'}</Text></TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{deptInfo?.name || 'Chargement...'}</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? <View style={styles.centered}><ActivityIndicator size="large" color="#0f172a" /></View> : (
        <View style={{ flex: 1 }}>
          {currentView === 'HUB' && <HubMenu />}

          {/* 🔴 VUE CANDIDATURES (Flex-box corrigé) */}
          {currentView === 'PENDING' && isLeader && (
            <View style={{ flex: 1 }}>
              <Text style={styles.hubSubtitle}>Demandes d'adhésion ({pendingRequests.length})</Text>
              <FlatList 
                data={pendingRequests} 
                keyExtractor={item => item.id} 
                showsVerticalScrollIndicator={false} 
                ListEmptyComponent={<Text style={styles.emptyText}>Aucune candidature en attente.</Text>} 
                renderItem={({ item }) => (
                  <View style={[styles.memberItem, { flexDirection: 'column', alignItems: 'stretch' }]}>
                    <View style={{ marginBottom: 12 }}>
                      <Text style={styles.memberName}>{item.member.full_name}</Text>
                      <Text style={styles.memberRole}>Souhaite rejoindre le département</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity style={[styles.assignBtn, {flex: 1, backgroundColor: '#dcfce3', alignItems: 'center'}]} onPress={() => handleStatusUpdate(item.id, 'APPROVED')}>
                        <Text style={{fontSize: 12, fontWeight: 'bold', color: '#16a34a'}}>Accepter</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.assignBtn, {flex: 1, backgroundColor: '#fee2e2', alignItems: 'center'}]} onPress={() => handleStatusUpdate(item.id, 'REJECTED')}>
                        <Text style={{fontSize: 12, fontWeight: 'bold', color: '#ef4444'}}>Refuser</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )} 
              />
            </View>
          )}

          {/* 🔴 VUE DÉNOMBREMENT AVEC ANALYTIQUES ET MODIFICATION */}
          {currentView === 'HEADCOUNTS' && (
            <HeadcountModule deptId={deptId} churchId={deptInfo?.church_id} isLeader={isLeader} />
          )}

          {/* 🔴 VUE MEMBRES AVEC SOUS-GROUPES (Pillules) */}
          {currentView === 'MEMBERS' && isLeader && (
            <View style={{ flex: 1 }}>
              {hasSubGroups && (
                <View style={styles.groupCreationCard}>
                  <Text style={styles.groupCreationTitle}>Créer un sous-groupe (Pupitre, Équipe...)</Text>
                  <View style={styles.groupRow}>
                    <TextInput style={styles.groupInput} placeholder="Ex: Soprano, Logistique..." value={newGroupName} onChangeText={setNewGroupName} />
                    <TouchableOpacity style={styles.groupBtn} onPress={handleCreateGroup}><Text style={styles.groupBtnText}>Ajouter</Text></TouchableOpacity>
                  </View>
                </View>
              )}
              
              <Text style={styles.hubSubtitle}>Membres du département</Text>
              
              {hasSubGroups && groups.length > 0 && (
                <View style={{ marginBottom: 15 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingBottom: 5 }}>
                    <TouchableOpacity style={memberFilter === 'Tous' ? styles.classPillActive : styles.classPill} onPress={() => setMemberFilter('Tous')}>
                      <Text style={memberFilter === 'Tous' ? styles.classPillActiveText : styles.classPillText}>Tous</Text>
                    </TouchableOpacity>
                    {groups.map(g => (
                      <TouchableOpacity key={g.id} style={memberFilter === g.id ? styles.classPillActive : styles.classPill} onPress={() => setMemberFilter(g.id)}>
                        <Text style={memberFilter === g.id ? styles.classPillActiveText : styles.classPillText}>{g.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <FlatList
                data={filteredActiveMembers}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={styles.emptyText}>Aucun membre trouvé dans ce groupe.</Text>}
                renderItem={({ item }) => {
                const ledGroup = groups.find(g => g.leader_id === item.user_id);
                const assignedGroup = groups.find(g => g.id === item.sub_group_id);
                return (
                  <View style={[styles.memberItem, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                    <TouchableOpacity
                      style={{ flex: 1, paddingRight: 10 }}
                      onPress={() => setSelectedMember(item)}
                    >
                      <Text style={styles.memberName}>{item.member.full_name}</Text>
                      {hasSubGroups && <Text style={styles.memberRole}>{ledGroup ? `👑 Responsable : ${ledGroup.name}` : assignedGroup ? `👥 Appartient à : ${assignedGroup.name}` : 'Membre simple'}</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.memberExcludeBtn}
                      onPress={() => handleRemoveMemberFromDept(item.id)}
                    >
                      <Text style={styles.memberExcludeBtnText}>✕ Exclure</Text>
                    </TouchableOpacity>
                  </View>
                );
              }}/>
            </View>
          )}

          {/* 🔴 VUE FINANCES AVEC BILAN */}
          {currentView === 'FINANCES' && (
            <FinanceModule deptId={deptId} isLeader={isLeader} activeMembers={activeMembers} />
          )}

          {/* AUTRES VUES INCHANGÉES... */}
          {currentView === 'PROJECTS' && (
            <View style={{ flex: 1 }}>
              <View style={styles.financeHeader}>
                <Text style={styles.hubSubtitle}>Gestion de Projets</Text>
                {isLeader && <TouchableOpacity style={[styles.addFinanceBtn, {backgroundColor: '#8b5cf6'}]} onPress={() => setIsAddingProject(true)}><Text style={styles.addFinanceBtnText}>+ Projet</Text></TouchableOpacity>}
              </View>
              <View style={{ marginBottom: 15 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingBottom: 5 }}>
                  {projects.length === 0 && <Text style={{color: '#94a3b8', fontStyle: 'italic'}}>Aucun projet en cours.</Text>}
                  {projects.map(p => (
                    <TouchableOpacity key={p.id} style={selectedProjectId === p.id ? styles.classPillActiveP : styles.classPillP} onPress={() => setSelectedProjectId(p.id)}><Text style={selectedProjectId === p.id ? styles.classPillActiveText : styles.classPillText}>{p.name}</Text></TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              {selectedProjectId && (
                <View style={{ flex: 1 }}>
                  {isLeader && <TouchableOpacity style={styles.createTaskBtn} onPress={() => setIsAddingTask(true)}><Text style={styles.createTaskBtnText}>+ Nouvelle tâche pour ce projet</Text></TouchableOpacity>}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex: 1}}>
                    <KanbanColumn title="📌 À Faire" status="TODO" color="#f59e0b" />
                    <KanbanColumn title="⏳ En Cours" status="IN_PROGRESS" color="#3b82f6" />
                    <KanbanColumn title="✅ Terminé" status="DONE" color="#10b981" />
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {currentView === 'EQUIPMENTS' && (
            <View style={{ flex: 1 }}>
              <View style={styles.financeHeader}>
                <Text style={styles.hubSubtitle}>Matériel Régie</Text>
                <TouchableOpacity style={[styles.addFinanceBtn, {backgroundColor: '#10b981'}]} onPress={() => equipmentTab === 'INVENTORY' ? setIsAddingEq(true) : setIsAddingEqNeed(true)}><Text style={styles.addFinanceBtnText}>{equipmentTab === 'INVENTORY' ? '+ Équipement' : '+ Besoin'}</Text></TouchableOpacity>
              </View>
              <View style={{flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 15}}>
                <TouchableOpacity style={[styles.financeToggleBtn, equipmentTab === 'INVENTORY' && {backgroundColor: '#10b981'}]} onPress={() => setEquipmentTab('INVENTORY')}><Text style={[styles.financeToggleText, equipmentTab === 'INVENTORY' && {color: '#fff'}]}>Inventaire</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.financeToggleBtn, equipmentTab === 'NEEDS' && {backgroundColor: '#f59e0b'}]} onPress={() => setEquipmentTab('NEEDS')}><Text style={[styles.financeToggleText, equipmentTab === 'NEEDS' && {color: '#fff'}]}>Besoins</Text></TouchableOpacity>
              </View>
              {equipmentTab === 'INVENTORY' ? (
                <FlatList data={equipments} keyExtractor={item => item.id} showsVerticalScrollIndicator={false} ListEmptyComponent={<Text style={styles.emptyText}>Aucun matériel.</Text>} renderItem={({ item }) => (
                  <View style={styles.listCard}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                      <View><Text style={styles.memberName}>{item.name}</Text><Text style={{fontSize: 12, color: '#64748b'}}>{item.category}</Text></View>
                      <TouchableOpacity style={[styles.eqAvailBtn, {backgroundColor: item.is_available ? '#dcfce3' : '#fee2e2'}]} onPress={() => toggleEqAvailability(item)}><Text style={{fontSize: 10, fontWeight: 'bold', color: item.is_available ? '#16a34a' : '#ef4444'}}>{item.is_available ? '✅ DISPO' : '❌ UTILISÉ'}</Text></TouchableOpacity>
                    </View>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 10}}>
                      <Text style={{fontSize: 12, color: '#94a3b8', marginRight: 10}}>État :</Text>
                      <TouchableOpacity style={[styles.eqCondBtn, item.condition === 'BON' ? {backgroundColor: '#dcfce3'} : item.condition === 'EN PANNE' ? {backgroundColor: '#fee2e2'} : {backgroundColor: '#fef3c7'}]} onPress={() => cycleEqCondition(item)}><Text style={[styles.eqCondText, item.condition === 'BON' ? {color: '#16a34a'} : item.condition === 'EN PANNE' ? {color: '#ef4444'} : {color: '#d97706'}]}>{item.condition}</Text></TouchableOpacity>
                    </View>
                  </View>
                )}/>
              ) : (
                <FlatList data={equipmentNeeds} keyExtractor={item => item.id} showsVerticalScrollIndicator={false} ListEmptyComponent={<Text style={styles.emptyText}>Aucun besoin remonté.</Text>} renderItem={({ item }) => (
                  <View style={styles.listCard}><Text style={styles.memberName}>{item.item_name}</Text><View style={{flexDirection: 'row', gap: 10, marginTop: 5}}><Text style={{fontSize: 11, color: '#64748b'}}>Priorité: {item.priority}</Text><Text style={{fontSize: 11, color: '#f59e0b', fontWeight: 'bold'}}>{item.status}</Text></View></View>
                )}/>
              )}
            </View>
          )}

          {currentView === 'SOULS' && (
            <EvangelismModule 
              deptId={deptId} 
              churchId={deptInfo?.church_id} 
              activeMembers={activeMembers} 
              isLeader={isLeader} 
            />
          )}

          {currentView === 'CHILDREN' && (
            <View style={{ flex: 1 }}>
              {isLeader && (
                <View style={styles.groupCreationCard}>
                  <Text style={styles.groupCreationTitle}>Créer une classe (Ex: Juniors, Ados...)</Text>
                  <View style={styles.groupRow}>
                    <TextInput style={styles.groupInput} placeholder="Nom de la classe" value={newGroupName} onChangeText={setNewGroupName} />
                    <TouchableOpacity style={[styles.groupBtn, {backgroundColor: '#f43f5e'}]} onPress={handleCreateGroup}><Text style={styles.groupBtnText}>Créer</Text></TouchableOpacity>
                  </View>
                </View>
              )}
              <View style={styles.financeHeader}>
                <Text style={styles.hubSubtitle}>Registre des enfants</Text>
                <TouchableOpacity style={[styles.addFinanceBtn, { backgroundColor: '#f43f5e' }]} onPress={() => setIsAddingChild(true)}><Text style={styles.addFinanceBtnText}>+ Inscrire</Text></TouchableOpacity>
              </View>
              {groups.length > 0 && (
                <View style={{ marginBottom: 15 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingBottom: 5 }}>
                    <TouchableOpacity style={childFilter === 'Tous' ? styles.classPillActive : styles.classPill} onPress={() => setChildFilter('Tous')}><Text style={childFilter === 'Tous' ? styles.classPillActiveText : styles.classPillText}>Tous</Text></TouchableOpacity>
                    {groups.map(g => (<TouchableOpacity key={g.id} style={childFilter === g.id ? styles.classPillActive : styles.classPill} onPress={() => setChildFilter(g.id)}><Text style={childFilter === g.id ? styles.classPillActiveText : styles.classPillText}>{g.name}</Text></TouchableOpacity>))}
                  </ScrollView>
                </View>
              )}
              <FlatList data={filteredChildren} keyExtractor={item => item.id} showsVerticalScrollIndicator={false} ListEmptyComponent={<Text style={styles.emptyText}>Aucun enfant.</Text>} renderItem={({ item }) => {
                  const className = groups.find(g => g.id === item.class_id)?.name || item.class_name;
                  return (
                    <View style={styles.newChildCard}>
                      <View style={styles.newChildTop}>
                        <View style={styles.childAvatar}><Text style={{fontSize: 24}}>👦🏽</Text></View>
                        <View style={{flex: 1}}>
                          <Text style={styles.newChildName}>{item.first_name} {item.last_name}</Text>
                          <View style={styles.childClassBadge}><Text style={styles.childClassText}>{className}</Text></View>
                        </View>
                      </View>
                    </View>
                  )
                }}
              />
            </View>
          )}

          {currentView === 'PLANNING' && (
             <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
               <View style={styles.financeHeader}>
                 <Text style={styles.hubSubtitle}>{isMediaDept ? "Agenda & Postes" : "Agenda & Événements"}</Text>
                 {isLeader && <TouchableOpacity style={[styles.addFinanceBtn, { backgroundColor: '#06b6d4' }]} onPress={() => setIsAddingPlanning(true)}><Text style={styles.addFinanceBtnText}>+ Ajouter</Text></TouchableOpacity>}
               </View>
               <Text style={styles.sectionTitle}>📅 Notre Planning</Text>
               {plannings.length === 0 ? <Text style={styles.emptyText}>Aucun événement programmé.</Text> : plannings.map(item => (<View key={item.id} style={styles.planningCard}><Text style={styles.planningTitle}>{item.title}</Text></View>))}
               <View style={{ height: 40 }} />
             </ScrollView>
          )}

          {currentView === 'ANNOUNCEMENTS' && (
             <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
               <View style={styles.financeHeader}>
                 <Text style={styles.hubSubtitle}>Communiqués Officiels</Text>
                 {isLeader && <TouchableOpacity style={[styles.addFinanceBtn, { backgroundColor: '#ec4899' }]} onPress={() => setIsAddingAnnouncement(true)}><Text style={styles.addFinanceBtnText}>+ Annonce</Text></TouchableOpacity>}
               </View>
               {announcements.length === 0 ? <Text style={styles.emptyText}>Aucune annonce publiée.</Text> : announcements.map(item => (<View key={item.id} style={[styles.planningCard, {borderLeftWidth: 4, borderLeftColor: '#ec4899', flexDirection: 'column'}]}><Text style={[styles.planningTitle, {color: '#ec4899'}]}>{item.title}</Text><Text style={{fontSize: 13, color: '#475569', marginTop: 10}}>{item.content}</Text></View>))}
             </ScrollView>
          )}

          {currentView === 'SONGS' && isLeader && isChoirDept && (
            <View style={{ flex: 1 }}><View style={styles.songHeader}><TextInput style={styles.searchInput} placeholder="🔍 Rechercher un chant..." value={searchQuery} onChangeText={setSearchQuery} /><TouchableOpacity style={styles.addSongBtn} onPress={() => setIsAddingSong(true)}><Text style={styles.addSongBtnText}>+ Chant</Text></TouchableOpacity></View><FlatList data={filteredSongs} keyExtractor={item => item.id} ListEmptyComponent={<Text style={styles.emptyText}>{searchQuery ? "Aucun résultat." : "Répertoire vide."}</Text>} renderItem={({ item }) => (<View style={styles.songCard}><View style={styles.songInfo}><Text style={styles.songTitle}>{item.title}</Text>{item.musical_key && (<View style={styles.keyBadge}><Text style={styles.keyBadgeText}>Gamme: {item.musical_key}</Text></View>)}</View>{item.video_url && (<TouchableOpacity style={styles.playBtn} onPress={() => openVideo(item.video_url)}><Text style={styles.playBtnText}>▶️ Écouter</Text></TouchableOpacity>)}</View>)}/></View>
          )}

        </View>
      )}

      {/* --- MODALES --- */}

      {/* 🔴 MODALE DE GESTION DES MEMBRES (Mise à jour pour assigner les groupes) */}
      <Modal visible={!!selectedMember && currentView === 'MEMBERS' && hasSubGroups} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Gestion : {selectedMember?.member?.full_name}</Text>
            <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.6, width: '100%' }} showsVerticalScrollIndicator={false}>
              
              <Text style={[styles.sectionTitle, {alignSelf: 'flex-start', marginLeft: 10}]}>Appartient au sous-groupe :</Text>
              <TouchableOpacity style={[styles.modalOption, !selectedMember?.sub_group_id && {borderColor: '#3b82f6', backgroundColor: '#eff6ff'}]} onPress={async () => {
                await supabase.from('department_members').update({ sub_group_id: null }).eq('id', selectedMember.id);
                setSelectedMember(null); loadInitialData(false);
              }}>
                <Text style={styles.modalOptionText}>Aucun groupe spécifique</Text>
              </TouchableOpacity>
              {groups.map(g => {
                const isAssigned = g.id === selectedMember?.sub_group_id;
                return (
                  <TouchableOpacity key={g.id} style={[styles.modalOption, isAssigned && {borderColor: '#3b82f6', backgroundColor: '#eff6ff'}]} onPress={async () => {
                    await supabase.from('department_members').update({ sub_group_id: g.id }).eq('id', selectedMember.id);
                    setSelectedMember(null); loadInitialData(false);
                  }}>
                    <Text style={[styles.modalOptionText, isAssigned && {color: '#3b82f6', fontWeight: 'bold'}]}>{g.name}</Text>
                  </TouchableOpacity>
                );
              })}

              <Text style={[styles.sectionTitle, {alignSelf: 'flex-start', marginLeft: 10, marginTop: 15}]}>Responsabilité (Direction) :</Text>
              <TouchableOpacity style={styles.modalOption} onPress={async () => { 
                await supabase.from('department_groups').update({ leader_id: null }).eq('leader_id', selectedMember.user_id); 
                setSelectedMember(null); loadInitialData(false); 
              }}>
                <Text style={styles.modalOptionText}>❌ Retirer de la direction</Text>
              </TouchableOpacity>
              {groups.map(g => { 
                const isAlreadyLeader = g.leader_id === selectedMember?.user_id; 
                return (
                  <TouchableOpacity key={g.id} style={[styles.modalOption, isAlreadyLeader && { borderColor: '#10b981', backgroundColor: '#ecfdf5' }]} onPress={async () => { 
                    await supabase.from('department_groups').update({ leader_id: selectedMember.user_id }).eq('id', g.id); 
                    setSelectedMember(null); loadInitialData(false); 
                  }}>
                    <Text style={[styles.modalOptionText, isAlreadyLeader ? { color: '#10b981', fontWeight: 'bold' } : { color: '#0f172a', fontWeight: 'bold' }]}>{isAlreadyLeader ? `✅ Dirige ${g.name}` : `👑 Nommer chef de ${g.name}`}</Text>
                  </TouchableOpacity>
                ); 
              })}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setSelectedMember(null)}><Text style={styles.modalCancelText}>Annuler</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modale Dénombrement (Modifiée pour supporter l'édition) */}
      <Modal visible={isAddingHeadcount} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalContentBottom, {maxHeight: '90%'}]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{editingHeadcountId ? 'Modifier le Rapport' : 'Nouveau Rapport'}</Text>
              <TouchableOpacity onPress={() => { setIsAddingHeadcount(false); setEditingHeadcountId(null); }}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              
              <View style={{flexDirection: 'row', gap: 10, marginBottom: 15}}>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>Date de l'événement *</Text>
                  <DateTimePicker
                    value={dateObj}
                    mode="date"
                    style={styles.formInput}
                    placeholder="Sélectionner la date"
                    onChange={(e, d) => {
                      if (d) {
                        setDateObj(d);
                        setNewHeadcount({...newHeadcount, event_date: d.toISOString().split('T')[0]});
                      }
                    }}
                  />
                </View>
              </View>

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
                <View style={{flex: 1}}><Text style={styles.inputLabel}>👨 Hommes</Text><TextInput style={styles.formInput} keyboardType="numeric" value={newHeadcount.men_count} placeholder="0" onChangeText={t => setNewHeadcount({...newHeadcount, men_count: t})} /></View>
                <View style={{flex: 1}}><Text style={styles.inputLabel}>👩 Femmes</Text><TextInput style={styles.formInput} keyboardType="numeric" value={newHeadcount.women_count} placeholder="0" onChangeText={t => setNewHeadcount({...newHeadcount, women_count: t})} /></View>
                <View style={{flex: 1}}><Text style={styles.inputLabel}>🧸 Enfants</Text><TextInput style={styles.formInput} keyboardType="numeric" value={newHeadcount.children_count} placeholder="0" onChangeText={t => setNewHeadcount({...newHeadcount, children_count: t})} /></View>
              </View>

              <View style={[styles.modalActionsRow, { marginBottom: 30 }]}><TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#14b8a6'}]} onPress={handleAddHeadcount}><Text style={styles.modalBtnSubmitText}>{editingHeadcountId ? 'Mettre à jour' : 'Enregistrer'}</Text></TouchableOpacity></View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Reste des modales basiques du fichier d'origine */}
      <Modal visible={isAddingSoul} transparent animationType="slide"><KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[styles.modalContentBottom, {maxHeight: '90%'}]}><View style={styles.modalHeaderRow}><Text style={styles.modalTitle}>{newSoul.id ? 'Suivi et Profil' : 'Enregistrer une âme'}</Text><TouchableOpacity onPress={() => setIsAddingSoul(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity></View><ScrollView showsVerticalScrollIndicator={false}><View style={{ alignItems: 'center', marginBottom: 20 }}>{newSoul.photo_url ? (<Image source={{ uri: newSoul.photo_url }} style={styles.soulAvatar} />) : (<View style={styles.soulAvatarPlaceholder}><Text style={{fontSize: 30}}>👤</Text></View>)}</View><Text style={styles.sectionTitle}>Identité</Text><View style={{flexDirection: 'row', gap: 10}}><View style={{flex: 1}}><Text style={styles.inputLabel}>Prénom *</Text><TextInput style={styles.formInput} value={newSoul.first_name} onChangeText={t => setNewSoul({...newSoul, first_name: t})} /></View><View style={{flex: 1}}><Text style={styles.inputLabel}>Nom *</Text><TextInput style={styles.formInput} value={newSoul.last_name} onChangeText={t => setNewSoul({...newSoul, last_name: t})} /></View></View><Text style={styles.inputLabel}>Téléphone</Text><TextInput style={styles.formInput} keyboardType="phone-pad" value={newSoul.phone} onChangeText={t => setNewSoul({...newSoul, phone: t})} />{newSoul.id ? (<><Text style={[styles.sectionTitle, {marginTop: 20}]}>Journal de Suivi</Text><View style={{marginTop: 30, marginBottom: 40, gap: 15}}><TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#f97316'}]} onPress={handleAddSoul}><Text style={styles.modalBtnSubmitText}>Sauvegarder le Suivi</Text></TouchableOpacity>{(newSoul.integration_status === 'NONE' || newSoul.integration_status === 'REJECTED' || !newSoul.integration_status) && (<TouchableOpacity style={{backgroundColor: '#0f172a', padding: 15, borderRadius: 12, alignItems: 'center'}} onPress={() => handleRequestIntegration(newSoul)}><Text style={{color: '#fff', fontWeight: 'bold', fontSize: 14}}>Dossier mâture : Demander l'intégration ➔</Text></TouchableOpacity>)}</View></>) : (<View style={[styles.modalActionsRow, {marginBottom: 40, marginTop: 20}]}><TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#f97316'}]} onPress={handleAddSoul}><Text style={styles.modalBtnSubmitText}>Enregistrer la nouvelle âme</Text></TouchableOpacity></View>)}</ScrollView></View></KeyboardAvoidingView></Modal>
      <Modal visible={isAddingFinance} transparent animationType="slide"><KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[styles.modalContentBottom, {maxHeight: '85%'}]}><View style={styles.modalHeaderRow}><Text style={styles.modalTitle}>Transaction</Text><TouchableOpacity onPress={() => setIsAddingFinance(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity></View><ScrollView><View style={styles.financeToggleRow}><TouchableOpacity style={[styles.financeToggleBtn, newFinance.type === 'INCOME' && styles.financeToggleActiveIn]} onPress={() => setNewFinance({...newFinance, type: 'INCOME'})}><Text style={[styles.financeToggleText, newFinance.type === 'INCOME' && { color: '#fff' }]}>📥 Entrée</Text></TouchableOpacity><TouchableOpacity style={[styles.financeToggleBtn, newFinance.type === 'EXPENSE' && styles.financeToggleActiveOut]} onPress={() => setNewFinance({...newFinance, type: 'EXPENSE'})}><Text style={[styles.financeToggleText, newFinance.type === 'EXPENSE' && { color: '#fff' }]}>💸 Sortie</Text></TouchableOpacity></View>{newFinance.type === 'INCOME' && (<View style={styles.financeCategoryRow}>{['Mensuelle', 'Régionale', 'Événement local'].map(cat => (<TouchableOpacity key={cat} style={[styles.catPill, newFinance.category === cat && styles.catPillActive]} onPress={() => setNewFinance({...newFinance, category: cat})}><Text style={[styles.catPillText, newFinance.category === cat && { color: '#fff' }]}>{cat}</Text></TouchableOpacity>))}</View>)}<Text style={styles.inputLabel}>Montant *</Text><TextInput style={styles.formInput} keyboardType="numeric" onChangeText={t => setNewFinance({...newFinance, amount: t})} /><Text style={styles.inputLabel}>Motif</Text><TextInput style={styles.formInput} onChangeText={t => setNewFinance({...newFinance, motif: t})} /><View style={[styles.modalActionsRow, {marginBottom: 30}]}><TouchableOpacity style={styles.modalBtnSubmit} onPress={handleAddFinance}><Text style={styles.modalBtnSubmitText}>Valider</Text></TouchableOpacity></View></ScrollView></View></KeyboardAvoidingView></Modal>
      <Modal visible={isAddingProject} transparent animationType="slide"><KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[styles.modalContentBottom, {maxHeight: '85%'}]}><View style={styles.modalHeaderRow}><Text style={styles.modalTitle}>Nouveau Projet</Text><TouchableOpacity onPress={() => setIsAddingProject(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity></View><ScrollView><Text style={styles.inputLabel}>Nom du projet *</Text><TextInput style={styles.formInput} placeholder="Ex: Culte de Pâques" onChangeText={t => setNewProject({...newProject, name: t})} /><Text style={styles.inputLabel}>Description</Text><TextInput style={styles.formInput} placeholder="Objectif..." onChangeText={t => setNewProject({...newProject, description: t})} /><View style={[styles.modalActionsRow, {marginBottom: 30}]}><TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#8b5cf6'}]} onPress={handleAddProject}><Text style={styles.modalBtnSubmitText}>Créer</Text></TouchableOpacity></View></ScrollView></View></KeyboardAvoidingView></Modal>

      {/* === MODALE : INSCRIRE UN ENFANT === */}
      <Modal visible={isAddingChild} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalContentBottom, {maxHeight: '85%'}]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Inscrire un enfant</Text>
              <TouchableOpacity onPress={() => { setIsAddingChild(false); setIsClassDropdownOpen(false); }}>
                <Text style={{fontSize: 24, color: '#64748b'}}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>Prénom *</Text>
                  <TextInput style={styles.formInput} placeholder="Ex: Jean" value={newChild.first_name} onChangeText={t => setNewChild({...newChild, first_name: t})} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>Nom *</Text>
                  <TextInput style={styles.formInput} placeholder="Ex: Dupont" value={newChild.last_name} onChangeText={t => setNewChild({...newChild, last_name: t})} />
                </View>
              </View>

              <Text style={styles.inputLabel}>Classe *</Text>
              <TouchableOpacity
                style={styles.dropdownSelector}
                onPress={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
              >
                <Text style={newChild.class_id ? styles.dropdownTextSelected : styles.dropdownTextPlaceholder}>
                  {newChild.class_id
                    ? groups.find(g => g.id === newChild.class_id)?.name || 'Classe sélectionnée'
                    : (groups.length === 0 ? '⚠️ Créez d\'abord une classe ci-dessus' : '-- Choisir une classe --')}
                </Text>
                <Text style={{color: '#94a3b8'}}>▼</Text>
              </TouchableOpacity>
              {isClassDropdownOpen && (
                <View style={styles.dropdownContainer}>
                  {groups.length === 0 ? (
                    <Text style={{padding: 12, color: '#ef4444', fontSize: 12}}>
                      Aucune classe. Créez-en une d'abord dans le formulaire "Créer une classe" ci-dessus.
                    </Text>
                  ) : (
                    groups.map(g => (
                      <TouchableOpacity
                        key={g.id}
                        style={styles.dropdownItem}
                        onPress={() => { setNewChild({...newChild, class_id: g.id}); setIsClassDropdownOpen(false); }}
                      >
                        <Text style={styles.dropdownItemText}>{g.name}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}

              <Text style={styles.inputLabel}>Parent / Tuteur</Text>
              <TextInput style={styles.formInput} placeholder="Nom du parent" value={newChild.parent_name} onChangeText={t => setNewChild({...newChild, parent_name: t})} />

              <Text style={styles.inputLabel}>Téléphone parent</Text>
              <TextInput style={styles.formInput} placeholder="+221 77 ..." keyboardType="phone-pad" value={newChild.parent_phone} onChangeText={t => setNewChild({...newChild, parent_phone: t})} />

              <View style={[styles.modalActionsRow, {marginBottom: 30}]}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setIsAddingChild(false); setIsClassDropdownOpen(false); }}>
                  <Text style={styles.modalBtnCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#f43f5e'}]} onPress={handleAddChild}>
                  <Text style={styles.modalBtnSubmitText}>Inscrire</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* === MODALE : AJOUTER UN CHANT === */}
      <Modal visible={isAddingSong} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalContentBottom, {maxHeight: '70%'}]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Nouveau Chant</Text>
              <TouchableOpacity onPress={() => setIsAddingSong(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.inputLabel}>Titre *</Text>
              <TextInput style={styles.formInput} placeholder="Ex: Mon rocher" value={newSong.title} onChangeText={t => setNewSong({...newSong, title: t})} />
              <Text style={styles.inputLabel}>Tonalité</Text>
              <TextInput style={styles.formInput} placeholder="Ex: La Majeur" value={newSong.key} onChangeText={t => setNewSong({...newSong, key: t})} />
              <Text style={styles.inputLabel}>Lien YouTube (optionnel)</Text>
              <TextInput style={styles.formInput} placeholder="https://..." autoCapitalize="none" value={newSong.url} onChangeText={t => setNewSong({...newSong, url: t})} />
              <View style={[styles.modalActionsRow, {marginBottom: 30}]}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setIsAddingSong(false)}>
                  <Text style={styles.modalBtnCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#8b5cf6'}]} onPress={handleAddSong}>
                  <Text style={styles.modalBtnSubmitText}>Ajouter</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* === MODALE : AJOUTER UNE ANNONCE === */}
      <Modal visible={isAddingAnnouncement} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalContentBottom, {maxHeight: '85%'}]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Nouvelle Annonce</Text>
              <TouchableOpacity onPress={() => setIsAddingAnnouncement(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.inputLabel}>Titre *</Text>
              <TextInput style={styles.formInput} placeholder="Ex: Répétition samedi" value={newAnnouncement.title} onChangeText={t => setNewAnnouncement({...newAnnouncement, title: t})} />
              <Text style={styles.inputLabel}>Contenu *</Text>
              <TextInput style={[styles.formInput, {height: 120, paddingTop: 12}]} placeholder="Détails de l'annonce..." multiline value={newAnnouncement.content} onChangeText={t => setNewAnnouncement({...newAnnouncement, content: t})} />

              {hasSubGroups && (
                <>
                  <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 15, marginBottom: 10}}>
                    <Switch
                      value={newAnnouncement.concerns_all}
                      onValueChange={v => setNewAnnouncement({...newAnnouncement, concerns_all: v})}
                    />
                    <Text style={{marginLeft: 10, color: '#475569', fontSize: 13, fontWeight: '500'}}>Concerne tous les groupes</Text>
                  </View>
                  {!newAnnouncement.concerns_all && groups.length > 0 && (
                    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10}}>
                      {groups.map(g => {
                        const sel = newAnnouncement.selected_groups.includes(g.id);
                        return (
                          <TouchableOpacity
                            key={g.id}
                            onPress={() => {
                              const next = sel
                                ? newAnnouncement.selected_groups.filter(x => x !== g.id)
                                : [...newAnnouncement.selected_groups, g.id];
                              setNewAnnouncement({...newAnnouncement, selected_groups: next});
                            }}
                            style={{
                              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                              backgroundColor: sel ? '#0f172a' : '#fff',
                              borderWidth: 1, borderColor: sel ? '#0f172a' : '#e2e8f0',
                            }}
                          >
                            <Text style={{color: sel ? '#fff' : '#475569', fontSize: 12, fontWeight: '500'}}>{g.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

              <View style={[styles.modalActionsRow, {marginBottom: 30}]}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setIsAddingAnnouncement(false)}>
                  <Text style={styles.modalBtnCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtnSubmit} onPress={handleAddAnnouncement}>
                  <Text style={styles.modalBtnSubmitText}>Publier</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* === MODALE : AJOUTER UN PLANNING === */}
      <Modal visible={isAddingPlanning} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalContentBottom, {maxHeight: '85%'}]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Nouveau Planning</Text>
              <TouchableOpacity onPress={() => { setIsAddingPlanning(false); }}>
                <Text style={{fontSize: 24, color: '#64748b'}}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.inputLabel}>Titre *</Text>
              <TextInput style={styles.formInput} placeholder="Ex: Répétition générale" value={newPlanning.title} onChangeText={t => setNewPlanning({...newPlanning, title: t})} />

              <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>Date *</Text>
                <DateTimePicker
                  value={dateObj}
                  mode="date"
                  style={styles.formInput}
                  placeholder="Sélectionner la date"
                  onChange={(e, d) => {
                    if (d) {
                      setDateObj(d);
                      setNewPlanning({...newPlanning, date: d.toISOString().split('T')[0]});
                    }
                  }}
                />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.inputLabel}>Heure *</Text>
                <DateTimePicker
                  value={dateObj}
                  mode="time"
                  style={styles.formInput}
                  placeholder="Sélectionner l’heure"
                  onChange={(e, d) => {
                    if (d) {
                      setDateObj(d);
                      const hh = String(d.getHours()).padStart(2, '0');
                      const mm = String(d.getMinutes()).padStart(2, '0');
                      setNewPlanning({...newPlanning, time: `${hh}:${mm}`});
                    }
                  }}
                />
              </View>
            </View>

              {hasSubGroups && (
                <>
                  <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 15, marginBottom: 10}}>
                    <Switch
                      value={newPlanning.concerns_all}
                      onValueChange={v => setNewPlanning({...newPlanning, concerns_all: v})}
                    />
                    <Text style={{marginLeft: 10, color: '#475569', fontSize: 13, fontWeight: '500'}}>Concerne tous les groupes</Text>
                  </View>
                  {!newPlanning.concerns_all && groups.length > 0 && (
                    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10}}>
                      {groups.map(g => {
                        const sel = newPlanning.selected_groups.includes(g.id);
                        return (
                          <TouchableOpacity
                            key={g.id}
                            onPress={() => {
                              const next = sel
                                ? newPlanning.selected_groups.filter(x => x !== g.id)
                                : [...newPlanning.selected_groups, g.id];
                              setNewPlanning({...newPlanning, selected_groups: next});
                            }}
                            style={{
                              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                              backgroundColor: sel ? '#0f172a' : '#fff',
                              borderWidth: 1, borderColor: sel ? '#0f172a' : '#e2e8f0',
                            }}
                          >
                            <Text style={{color: sel ? '#fff' : '#475569', fontSize: 12, fontWeight: '500'}}>{g.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

              <View style={[styles.modalActionsRow, {marginBottom: 30}]}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setIsAddingPlanning(false)}>
                  <Text style={styles.modalBtnCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtnSubmit} onPress={() => handleAddPlanning(false)}>
                  <Text style={styles.modalBtnSubmitText}>Créer</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* === MODALE : AJOUTER UNE TÂCHE === */}
      <Modal visible={isAddingTask} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalContentBottom, {maxHeight: '80%'}]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Nouvelle Tâche</Text>
              <TouchableOpacity onPress={() => { setIsAddingTask(false); }}>
                <Text style={{fontSize: 24, color: '#64748b'}}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.inputLabel}>Titre *</Text>
              <TextInput style={styles.formInput} placeholder="Ex: Réserver la salle" value={newTask.title} onChangeText={t => setNewTask({...newTask, title: t})} />

              <Text style={styles.inputLabel}>Assigné à</Text>
              <TouchableOpacity
                style={styles.dropdownSelector}
                onPress={() => setIsAssignDropdownOpen(!isAssignDropdownOpen)}
              >
                <Text style={newTask.assigned_to ? styles.dropdownTextSelected : styles.dropdownTextPlaceholder}>
                  {newTask.assigned_to
                    ? activeMembers.find(m => m.user_id === newTask.assigned_to)?.member?.full_name || 'Membre'
                    : '-- Non assigné --'}
                </Text>
                <Text style={{color: '#94a3b8'}}>▼</Text>
              </TouchableOpacity>
              {isAssignDropdownOpen && (
                <View style={styles.dropdownContainer}>
                  <TouchableOpacity style={styles.dropdownItem} onPress={() => { setNewTask({...newTask, assigned_to: ''}); setIsAssignDropdownOpen(false); }}>
                    <Text style={[styles.dropdownItemText, {fontStyle: 'italic'}]}>-- Non assigné --</Text>
                  </TouchableOpacity>
                  {activeMembers.map(m => (
                    <TouchableOpacity
                      key={m.user_id}
                      style={styles.dropdownItem}
                      onPress={() => { setNewTask({...newTask, assigned_to: m.user_id}); setIsAssignDropdownOpen(false); }}
                    >
                      <Text style={styles.dropdownItemText}>{m.member?.full_name || 'Membre'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.inputLabel}>Échéance</Text>
              <View style={{marginTop: 8}}>
                <DateTimePicker
                  value={newTask.deadline ? new Date(newTask.deadline) : undefined}
                  mode="date"
                  display="default"
                  style={styles.formInput}
                  placeholder="Sélectionner la date"
                  onChange={(e, d) => {
                    if (d) { setDateObj(d); setNewTask({...newTask, deadline: d.toISOString().split('T')[0]}); }
                  }}
                />
              </View>

              <View style={[styles.modalActionsRow, {marginBottom: 30}]}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setIsAddingTask(false)}>
                  <Text style={styles.modalBtnCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtnSubmit} onPress={handleAddTask}>
                  <Text style={styles.modalBtnSubmitText}>Créer</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* === MODALE : AJOUTER UN ÉQUIPEMENT === */}
      <Modal visible={isAddingEq} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalContentBottom, {maxHeight: '70%'}]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Nouvel Équipement</Text>
              <TouchableOpacity onPress={() => setIsAddingEq(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.inputLabel}>Nom *</Text>
              <TextInput style={styles.formInput} placeholder="Ex: Caméra Sony A7" value={newEq.name} onChangeText={t => setNewEq({...newEq, name: t})} />
              <Text style={styles.inputLabel}>Catégorie</Text>
              <View style={{flexDirection: 'row', gap: 8, flexWrap: 'wrap'}}>
                {['Vidéo', 'Son', 'Éclairage', 'Divers'].map(cat => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setNewEq({...newEq, category: cat})}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
                      backgroundColor: newEq.category === cat ? '#0f172a' : '#fff',
                      borderWidth: 1, borderColor: newEq.category === cat ? '#0f172a' : '#e2e8f0',
                    }}
                  >
                    <Text style={{color: newEq.category === cat ? '#fff' : '#475569', fontSize: 12, fontWeight: '500'}}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>État</Text>
              <View style={{flexDirection: 'row', gap: 8, flexWrap: 'wrap'}}>
                {[{k: 'BON', c: '#10b981'}, {k: 'EN PANNE', c: '#ef4444'}, {k: 'EN REPARATION', c: '#f59e0b'}].map(s => (
                  <TouchableOpacity
                    key={s.k}
                    onPress={() => setNewEq({...newEq, condition: s.k})}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
                      backgroundColor: newEq.condition === s.k ? s.c : '#fff',
                      borderWidth: 1, borderColor: newEq.condition === s.k ? s.c : '#e2e8f0',
                    }}
                  >
                    <Text style={{color: newEq.condition === s.k ? '#fff' : '#475569', fontSize: 12, fontWeight: '500'}}>{s.k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.modalActionsRow, {marginBottom: 30}]}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setIsAddingEq(false)}>
                  <Text style={styles.modalBtnCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtnSubmit} onPress={handleAddEq}>
                  <Text style={styles.modalBtnSubmitText}>Ajouter</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* === MODALE : BESOIN D'ÉQUIPEMENT === */}
      <Modal visible={isAddingEqNeed} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalContentBottom, {maxHeight: '60%'}]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Nouveau Besoin</Text>
              <TouchableOpacity onPress={() => setIsAddingEqNeed(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.inputLabel}>Article *</Text>
              <TextInput style={styles.formInput} placeholder="Ex: Câble HDMI 5m" value={newEqNeed.item_name} onChangeText={t => setNewEqNeed({...newEqNeed, item_name: t})} />
              <Text style={styles.inputLabel}>Priorité</Text>
              <View style={{flexDirection: 'row', gap: 8, flexWrap: 'wrap'}}>
                {[{k: 'FAIBLE', c: '#94a3b8'}, {k: 'MOYENNE', c: '#f59e0b'}, {k: 'HAUTE', c: '#ef4444'}].map(p => (
                  <TouchableOpacity
                    key={p.k}
                    onPress={() => setNewEqNeed({...newEqNeed, priority: p.k})}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
                      backgroundColor: newEqNeed.priority === p.k ? p.c : '#fff',
                      borderWidth: 1, borderColor: newEqNeed.priority === p.k ? p.c : '#e2e8f0',
                    }}
                  >
                    <Text style={{color: newEqNeed.priority === p.k ? '#fff' : '#475569', fontSize: 12, fontWeight: '500'}}>{p.k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.modalActionsRow, {marginBottom: 30}]}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setIsAddingEqNeed(false)}>
                  <Text style={styles.modalBtnCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtnSubmit} onPress={handleAddEqNeed}>
                  <Text style={styles.modalBtnSubmitText}>Soumettre</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const HubCard = ({ title, count, icon, color, onPress }: any) => (
  <TouchableOpacity style={[styles.card, { borderTopColor: color, borderTopWidth: 4 }]} onPress={onPress}>
    <Text style={{fontSize: 24}}>{icon}</Text>
    <Text style={styles.cardTitle}>{title}</Text>
    <View style={[styles.countBadge, { backgroundColor: color }]}><Text style={styles.countText}>{count}</Text></View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 30 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', flex: 1, textAlign: 'center' },
  backBtn: { color: '#64748b', fontWeight: 'bold', width: 80 },
  hubSubtitle: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15, marginTop: 10 },
  hubGrid: { paddingBottom: 30 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 15 },
  card: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, alignItems: 'center', height: 135, justifyContent: 'space-between' },
  cardTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },
  countBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  countText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 10, marginTop: 15, letterSpacing: 0.5 },
  planningCard: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'flex-start' },
  planningDateBox: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', width: 60, marginRight: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  planningDateDay: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  planningDateMonth: { fontSize: 10, fontWeight: 'bold', color: '#64748b', marginTop: 2 },
  planningTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', flex: 1 },

  // STYLES ANALYTIQUES
  analyticsBox: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 2 },
  analyticsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  analyticsStat: { alignItems: 'center', flex: 1 },
  analyticsLabel: { fontSize: 11, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  analyticsValue: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  analyticsDivider: { width: 1, height: 30, backgroundColor: '#e2e8f0' },

  datePickerBtn: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 15, height: 45, justifyContent: 'center' },
  iosPickerContainer: { backgroundColor: '#f1f5f9', borderRadius: 12, marginTop: 15, overflow: 'hidden' },
  iosPickerHeader: { flexDirection: 'row', justifyContent: 'flex-end', padding: 10, backgroundColor: '#e2e8f0' },
  iosPickerDoneText: { fontWeight: 'bold', color: '#0f172a', fontSize: 15 },

  modalOverlayBottom: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalContentBottom: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 25, paddingBottom: 20, maxHeight: '90%' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 5, marginTop: 10 },
  formInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 15, height: 45, color: '#0f172a', justifyContent: 'center' },
  modalActionsRow: { flexDirection: 'row', gap: 10, marginTop: 30 },
  modalBtnCancel: { flex: 1, backgroundColor: '#f1f5f9', padding: 15, borderRadius: 12, alignItems: 'center' },
  modalBtnCancelText: { color: '#64748b', fontWeight: 'bold', fontSize: 14 },
  modalBtnSubmit: { flex: 1, backgroundColor: '#8b5cf6', padding: 15, borderRadius: 12, alignItems: 'center' },
  modalBtnSubmitText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  balanceCard: { padding: 20, borderRadius: 20, alignItems: 'center', marginBottom: 20, elevation: 5 },
  balanceLabel: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 },
  balanceAmount: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  financeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addFinanceBtn: { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addFinanceBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  financeCard: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center' },
  financeIconWrapper: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  financeCategory: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  financeMember: { fontSize: 12, color: '#3b82f6', marginTop: 2, fontWeight: '600' },
  financeDate: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
  financeAmount: { fontSize: 16, fontWeight: 'bold' },
  financeToggleRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 20, marginTop: 5 },
  financeToggleBtn: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 8 },
  financeToggleActiveIn: { backgroundColor: '#10b981' },
  financeToggleActiveOut: { backgroundColor: '#ef4444' },
  financeToggleText: { fontWeight: 'bold', color: '#64748b' },

  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 15, height: 45 },
  dropdownTextSelected: { color: '#0f172a', fontSize: 14 },
  dropdownTextPlaceholder: { color: '#94a3b8', fontSize: 14 },
  dropdownContainer: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, marginTop: 5, overflow: 'hidden', elevation: 2 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownItemText: { color: '#0f172a', fontSize: 14 },

  songHeader: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  searchInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 15, height: 45 },
  addSongBtn: { backgroundColor: '#8b5cf6', paddingHorizontal: 15, justifyContent: 'center', borderRadius: 12, height: 45 },
  addSongBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  songCard: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  
  memberItem: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  memberName: { fontWeight: 'bold', fontSize: 15, color: '#0f172a' },
  memberRole: { fontSize: 12, color: '#64748b', marginTop: 4, fontStyle: 'italic' },
  memberExcludeBtn: { backgroundColor: '#fef2f2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca' },
  memberExcludeBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 12 },
  assignBtn: { paddingVertical: 8, borderRadius: 8, marginTop: 5 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8', fontStyle: 'italic' },
  
  groupCreationCard: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  groupCreationTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginBottom: 10 },
  groupInput: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 15, height: 45, color: '#0f172a' },
  groupRow: { flexDirection: 'row', gap: 10 },
  groupBtn: { backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, borderRadius: 10, height: 45 },
  groupBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  classPill: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  classPillActive: { backgroundColor: '#3b82f6', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  classPillText: { color: '#64748b', fontSize: 12, fontWeight: 'bold' },
  classPillActiveText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  classPillP: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  classPillActiveP: { backgroundColor: '#8b5cf6', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  kanbanCol: { width: width * 0.75, marginRight: 15, backgroundColor: '#f8fafc', borderRadius: 16, padding: 10, height: '100%' },
  kanbanColHeader: { borderBottomWidth: 2, paddingBottom: 8, marginBottom: 10 },
  kanbanColTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  kanbanCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', width: '100%', borderRadius: 20, padding: 20, alignItems: 'center' },
  modalOption: { width: '100%', padding: 15, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  modalOptionText: { fontSize: 15, color: '#475569', fontWeight: '500' },
  modalCancel: { marginTop: 10, padding: 15 },
  modalCancelText: { color: '#ef4444', fontWeight: 'bold', fontSize: 15 },

  newChildCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  newChildTop: { flexDirection: 'row', padding: 15, alignItems: 'center' },
  childAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  newChildName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  childClassBadge: { alignSelf: 'flex-start', backgroundColor: '#ffe4e6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  childClassText: { fontSize: 10, fontWeight: 'bold', color: '#e11d48' },

  soulCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#fed7aa', overflow: 'hidden' },
  soulCardTop: { flexDirection: 'row', padding: 15, alignItems: 'center' },
  soulAvatar: { width: 60, height: 60, borderRadius: 30, marginRight: 15, backgroundColor: '#f1f5f9' },
  soulAvatarPlaceholder: { width: 60, height: 60, borderRadius: 30, marginRight: 15, backgroundColor: '#ffedd5', justifyContent: 'center', alignItems: 'center' },
  soulInfo: { flex: 1 },
  soulName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  soulEditBtn: { backgroundColor: '#fff7ed', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  soulEditBtnText: { fontSize: 10, fontWeight: 'bold', color: '#f97316' },
  soulDetail: { fontSize: 12, color: '#64748b', marginBottom: 2 },
  soulPhone: { fontSize: 13, color: '#3b82f6', fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: 'bold' },
  photoBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  photoBtnText: { fontSize: 12, fontWeight: 'bold', color: '#475569' }
});