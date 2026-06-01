// src/screens/DepartmentDashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  ActivityIndicator, Alert, ScrollView, TextInput, Modal, Linking,
  KeyboardAvoidingView, Platform, Image, Dimensions, Switch
} from 'react-native';
import { supabase } from '../lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';

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
  
  const [creatingGroup, setCreatingGroup] = useState(false); // 🔴 CORRECTION BUG: État manquant
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMember, setSelectedMember] = useState<any>(null); 

  const [songs, setSongs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingSong, setIsAddingSong] = useState(false);
  const [newSong, setNewSong] = useState({ title: '', key: '', url: '' });

  const [finances, setFinances] = useState<any[]>([]);
  const [isAddingFinance, setIsAddingFinance] = useState(false);
  const [newFinance, setNewFinance] = useState({ type: 'INCOME', category: 'Mensuelle', amount: '', motif: '', member_id: '' });
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);

  const [plannings, setPlannings] = useState<any[]>([]);
  const [churchPrograms, setChurchPrograms] = useState<any[]>([]);
  const [allChurchPrograms, setAllChurchPrograms] = useState<any[]>([]); 
  const [planningRoles, setPlanningRoles] = useState<any[]>([]);
  const [isAddingPlanning, setIsAddingPlanning] = useState(false);
  const [selectedChurchProgram, setSelectedChurchProgram] = useState<any>(null);
  
  const [dateObj, setDateObj] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
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
  const [showTaskDatePicker, setShowTaskDatePicker] = useState(false);

  const [equipments, setEquipments] = useState<any[]>([]);
  const [equipmentNeeds, setEquipmentNeeds] = useState<any[]>([]);
  const [equipmentTab, setEquipmentTab] = useState<'INVENTORY' | 'NEEDS'>('INVENTORY');
  const [isAddingEq, setIsAddingEq] = useState(false);
  const [newEq, setNewEq] = useState({ name: '', category: 'Vidéo', condition: 'BON' });
  const [isAddingEqNeed, setIsAddingEqNeed] = useState(false);
  const [newEqNeed, setNewEqNeed] = useState({ item_name: '', priority: 'MOYENNE' });

  const [headcounts, setHeadcounts] = useState<any[]>([]);
  const [isAddingHeadcount, setIsAddingHeadcount] = useState(false);
  const [isProgramDropdownOpen, setIsProgramDropdownOpen] = useState(false);
  const [newHeadcount, setNewHeadcount] = useState({ church_program_id: '', event_title: '', event_date: '', men_count: '', women_count: '', children_count: '' });

  useEffect(() => {
    if (deptId) loadInitialData();
  }, [deptId]);

  async function loadInitialData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
    
    try {
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
      }

      const { data: roleData } = await supabase.from('user_roles').select('*').eq('user_id', user?.id).eq('role', 'DEPARTMENT_LEADER').eq('department_id', deptId).single();
      setIsLeader(!!roleData);
      
      const { data: groupsData } = await supabase.from('department_groups').select('*').eq('department_id', deptId).order('created_at', { ascending: true });
      setGroups(groupsData || []);

      const { data: allReqs } = await supabase.from('department_members').select('*').eq('department_id', deptId).in('status', ['PENDING', 'APPROVED']);
      let activeMembs: any[] = [];
      if (allReqs) {
        const userIds = allReqs.map(r => r.user_id);
        const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds);
        const pending = allReqs.filter(r => r.status === 'PENDING').map(r => ({ ...r, member: { full_name: profiles?.find(p => p.id === r.user_id)?.full_name || 'Fidèle' } }));
        const approved = allReqs.filter(r => r.status === 'APPROVED').map(r => ({ ...r, member: { full_name: profiles?.find(p => p.id === r.user_id)?.full_name || 'Fidèle' } }));
        setPendingRequests(pending); setActiveMembers(approved); activeMembs = approved;
      }

      const { data: rawPlannings } = await supabase.from('department_plannings').select('*').eq('department_id', deptId).order('event_date', { ascending: true });
      const { data: rawPlanGroups } = await supabase.from('department_planning_groups').select('*');
      const formattedPlannings = rawPlannings?.map(p => ({ ...p, assigned_groups: p.concerns_all ? [] : rawPlanGroups?.filter(pg => pg.planning_id === p.id).map(pg => pg.group_id) })) || [];
      setPlannings(formattedPlannings);

      if (isMedia) {
        const planIds = formattedPlannings.map(p => p.id);
        if(planIds.length > 0) {
          const { data: pRoles } = await supabase.from('department_planning_roles').select('*').in('planning_id', planIds);
          setPlanningRoles(pRoles?.map(pr => ({ ...pr, member_name: activeMembs.find(m => m.user_id === pr.user_id)?.member.full_name || 'Membre' })) || []);
        }
        const { data: projs } = await supabase.from('department_projects').select('*').eq('department_id', deptId).order('created_at', { ascending: false });
        setProjects(projs || []);
        if (projs && projs.length > 0) {
          if (!selectedProjectId) setSelectedProjectId(projs[0].id);
          const { data: tsks } = await supabase.from('department_tasks').select('*').in('project_id', projs.map(p => p.id));
          setTasks(tsks?.map(t => ({ ...t, assigned_name: activeMembs.find(m => m.user_id === t.assigned_to)?.member.full_name || 'Non assigné' })) || []);
        }
        const { data: eqs } = await supabase.from('department_equipments').select('*').eq('department_id', deptId);
        setEquipments(eqs || []);
        const { data: eqNeeds } = await supabase.from('department_equipment_needs').select('*').eq('department_id', deptId);
        setEquipmentNeeds(eqNeeds || []);
      }

      if (isUsher) {
        const { data: hc } = await supabase.from('department_headcounts').select('*').eq('department_id', deptId).order('event_date', { ascending: false });
        setHeadcounts(hc || []);
      }

      if (isChild) {
        const { data: childrenData } = await supabase.from('department_children').select('*').eq('department_id', deptId).order('first_name', { ascending: true });
        setChildrenList(childrenData || []);
      }

      if (isEvang) {
        const { data: soulsData } = await supabase.from('department_souls').select('*').eq('department_id', deptId).order('created_at', { ascending: false });
        if (soulsData) {
          setSoulsList(soulsData.map(s => ({ ...s, assigned_member: s.assigned_to ? activeMembs.find(p => p.user_id === s.assigned_to)?.member.full_name : null })));
        }
      }

      if (isChoir) {
        const { data: songsData } = await supabase.from('department_songs').select('*').eq('department_id', deptId).order('title', { ascending: true });
        setSongs(songsData || []);
      }

      const { data: rawFinances } = await supabase.from('department_finances').select('*').eq('department_id', deptId).order('created_at', { ascending: false });
      setFinances(rawFinances?.map(fin => ({ ...fin, member: fin.member_id ? { full_name: activeMembs.find(p => p.user_id === fin.member_id)?.member.full_name || 'Inconnu' } : null })) || []);

      if (dept?.church_id) {
        const { data: cPrograms } = await supabase.from('church_programs').select('*').eq('church_id', dept.church_id);
        const sortedPrograms = (cPrograms || []).sort((a, b) => new Date(a.date || a.start_time || a.created_at).getTime() - new Date(b.date || b.start_time || b.created_at).getTime());
        setAllChurchPrograms(sortedPrograms); 
        setChurchPrograms(sortedPrograms.filter(cp => !formattedPlannings.some(dp => dp.church_program_id === cp.id))); 
      }

      const { data: rawAnns } = await supabase.from('department_announcements').select('*').eq('department_id', deptId).order('created_at', { ascending: false });
      const { data: rawAnnGroups } = await supabase.from('department_announcement_groups').select('*');
      setAnnouncements(rawAnns?.map(a => ({ ...a, assigned_groups: a.concerns_all ? [] : rawAnnGroups?.filter(ag => ag.announcement_id === a.id).map(ag => ag.group_id) })) || []);

    } catch(e) { console.log(e); }
    setLoading(false);
  }

  const handleStatusUpdate = async (id: string, status: 'APPROVED' | 'REJECTED') => { await supabase.from('department_members').update({ status, updated_at: new Date().toISOString() }).eq('id', id); loadInitialData(); };
  const handleRemoveMemberFromDept = async (id: string) => { Alert.alert("Exclure", "Voulez-vous retirer ce membre ?", [ { text: "Annuler", style: "cancel" }, { text: "Oui", style: 'destructive', onPress: async () => { await supabase.from('department_members').delete().eq('id', id); setSelectedMember(null); loadInitialData(); }} ]); };
  
  const handleCreateGroup = async () => { 
    if (!newGroupName.trim()) return; 
    setCreatingGroup(true); 
    const { error } = await supabase.from('department_groups').insert({ department_id: deptId, name: newGroupName.trim() }); 
    setCreatingGroup(false); 
    setNewGroupName(''); 
    if(error) Alert.alert("Erreur", error.message); 
    else { Alert.alert("Succès", "Créé avec succès !"); loadInitialData(); } 
  };

  const handleAddSong = async () => { if (!newSong.title.trim()) return Alert.alert("Erreur", "Le titre est obligatoire."); const { data: { user } } = await supabase.auth.getUser(); await supabase.from('department_songs').insert({ department_id: deptId, title: newSong.title.trim(), musical_key: newSong.key.trim() || null, video_url: newSong.url.trim() || null, created_by: user?.id }); setIsAddingSong(false); setNewSong({ title: '', key: '', url: '' }); loadInitialData(); };
  const openVideo = (url: string) => { if (url) Linking.openURL(url.startsWith('http') ? url : `https://${url}`).catch(() => Alert.alert("Erreur", "Lien invalide.")); };
  
  const handleAddFinance = async () => {
    if (!newFinance.amount || isNaN(Number(newFinance.amount))) return Alert.alert("Erreur", "Montant invalide.");
    if (newFinance.type === 'EXPENSE' && !newFinance.motif.trim()) return Alert.alert("Erreur", "Le motif est requis.");
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('department_finances').insert({ department_id: deptId, type: newFinance.type, category: newFinance.type === 'INCOME' ? newFinance.category : 'Dépense', amount: Number(newFinance.amount), motif: newFinance.motif.trim() || null, member_id: newFinance.member_id || null, created_by: user?.id });
    setIsAddingFinance(false); setNewFinance({ type: 'INCOME', category: 'Mensuelle', amount: '', motif: '', member_id: '' }); loadInitialData(); 
  };

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
    setIsAddingAnnouncement(false); setNewAnnouncement({ title: '', content: '', concerns_all: true, selected_groups: [] }); loadInitialData();
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
    setIsAddingPlanning(false); setSelectedChurchProgram(null); setNewPlanning({ title: '', date: '', time: '', description: '', is_church_event: false, concerns_all: true, selected_groups: [] }); loadInitialData();
  };

  const handleAddChild = async () => {
    if (!newChild.first_name.trim() || !newChild.last_name.trim() || !newChild.class_id) return Alert.alert("Erreur", "Nom, prénom et classe requis.");
    const { data: { user } } = await supabase.auth.getUser();
    const selectedClass = groups.find(g => g.id === newChild.class_id);
    const { error } = await supabase.from('department_children').insert({ department_id: deptId, class_id: newChild.class_id, class_name: selectedClass?.name || 'Général', first_name: newChild.first_name.trim(), last_name: newChild.last_name.trim(), parent_name: newChild.parent_name.trim() || null, parent_phone: newChild.parent_phone.trim() || null, created_by: user?.id });
    if (error) Alert.alert("Erreur", error.message);
    else { Alert.alert("Succès", "Enfant ajouté !"); setIsAddingChild(false); setNewChild({ first_name: '', last_name: '', class_id: '', parent_name: '', parent_phone: '' }); loadInitialData(); }
  };

  // --- ACTIONS ÂMES (SOULS) ---
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Désolé', 'Permission caméra requise !');
    let result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
    if (!result.canceled && result.assets[0].base64) setNewSoul({ ...newSoul, photo_url: `data:image/jpeg;base64,${result.assets[0].base64}` });
  };
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Désolé', 'Permission galerie requise !');
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
    if (!result.canceled && result.assets[0].base64) setNewSoul({ ...newSoul, photo_url: `data:image/jpeg;base64,${result.assets[0].base64}` });
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
    setIsAddingSoul(false); loadInitialData();
  };

  // 🔴 NOUVEAU : Fonction pour demander l'intégration d'une âme
  const handleRequestIntegration = async (soul: any) => {
    Alert.alert(
      "Demande d'intégration",
      "Voulez-vous soumettre cette âme au pasteur pour qu'elle devienne un membre officiel de l'église ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Oui, soumettre", 
          onPress: async () => {
            setLoading(true);
            try {
              // 1. Mettre à jour UNIQUEMENT le statut dans le département
              await supabase.from('department_souls').update({
                integration_status: 'PENDING',
                integration_notes: 'En attente de validation pastorale'
              }).eq('id', soul.id);

              Alert.alert('Succès', 'La demande a été transmise au pasteur.');
              setIsAddingSoul(false);
              loadInitialData();
            } catch (e: any) {
              Alert.alert('Erreur', e.message);
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // --- ACTIONS PROJETS / TACHES / EQ ---
  const handleAddProject = async () => { if (!newProject.name.trim()) return; const { data: { user } } = await supabase.auth.getUser(); await supabase.from('department_projects').insert({ department_id: deptId, name: newProject.name.trim(), description: newProject.description.trim(), created_by: user?.id }); setIsAddingProject(false); setNewProject({ name: '', description: '' }); loadInitialData(); };
  const handleAddTask = async () => {
    if (!newTask.title.trim() || !selectedProjectId) return Alert.alert("Erreur", "Titre requis.");
    await supabase.from('department_tasks').insert({ project_id: selectedProjectId, title: newTask.title.trim(), assigned_to: newTask.assigned_to || null, deadline: newTask.deadline || null });
    setIsAddingTask(false); setNewTask({ title: '', assigned_to: '', deadline: '' }); loadInitialData();
  };
  const cycleTaskStatus = async (task: any) => {
    if (!isLeader && task.assigned_to !== currentUserId) return Alert.alert("Refusé", "Vous ne pouvez modifier que les tâches qui vous sont assignées.");
    const nextStatus = task.status === 'TODO' ? 'IN_PROGRESS' : task.status === 'IN_PROGRESS' ? 'DONE' : 'TODO';
    await supabase.from('department_tasks').update({ status: nextStatus }).eq('id', task.id); loadInitialData();
  };
  const handleAddEq = async () => { if(!newEq.name.trim()) return Alert.alert("Erreur", "Nom requis."); await supabase.from('department_equipments').insert({ department_id: deptId, name: newEq.name.trim(), category: newEq.category, condition: newEq.condition }); setIsAddingEq(false); setNewEq({ name: '', category: 'Vidéo', condition: 'BON' }); loadInitialData(); };
  const handleAddEqNeed = async () => { if(!newEqNeed.item_name.trim()) return Alert.alert("Erreur", "Nom requis."); await supabase.from('department_equipment_needs').insert({ department_id: deptId, item_name: newEqNeed.item_name.trim(), priority: newEqNeed.priority }); setIsAddingEqNeed(false); setNewEqNeed({ item_name: '', priority: 'MOYENNE' }); loadInitialData(); };
  const cycleEqCondition = async (eq: any) => { const nextCond = eq.condition === 'BON' ? 'EN PANNE' : eq.condition === 'EN PANNE' ? 'EN REPARATION' : 'BON'; await supabase.from('department_equipments').update({ condition: nextCond }).eq('id', eq.id); loadInitialData(); };
  const toggleEqAvailability = async (eq: any) => { await supabase.from('department_equipments').update({ is_available: !eq.is_available }).eq('id', eq.id); loadInitialData(); };
  const handleAssignRole = async () => {
    if (!newRole.user_id || !newRole.role_name.trim() || !selectedPlanningId) return Alert.alert("Erreur", "Membre et rôle requis.");
    const { error } = await supabase.from('department_planning_roles').insert({ planning_id: selectedPlanningId, user_id: newRole.user_id, role_name: newRole.role_name.trim() });
    if (error) Alert.alert("Erreur", "Rôle déjà assigné.");
    setIsAssigningRole(false); setNewRole({ user_id: '', role_name: '' }); loadInitialData();
  };

  const handleAddHeadcount = async () => {
    if (!newHeadcount.church_program_id) return Alert.alert("Erreur", "Veuillez sélectionner un programme de l'église.");
    const m = parseInt(newHeadcount.men_count) || 0;
    const w = parseInt(newHeadcount.women_count) || 0;
    const c = parseInt(newHeadcount.children_count) || 0;
    const total = m + w + c;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('department_headcounts').insert({
      department_id: deptId, event_title: newHeadcount.event_title, event_date: newHeadcount.event_date, church_program_id: newHeadcount.church_program_id,
      men_count: m, women_count: w, children_count: c, total_count: total, created_by: user?.id
    });
    setIsAddingHeadcount(false);
    setNewHeadcount({ church_program_id: '', event_title: '', event_date: '', men_count: '', women_count: '', children_count: '' });
    loadInitialData();
  };

  const filteredSongs = songs.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || (s.musical_key && s.musical_key.toLowerCase().includes(searchQuery.toLowerCase())));
  const balance = finances.reduce((acc, curr) => curr.type === 'INCOME' ? acc + (Number(curr.amount) || 0) : acc - (Number(curr.amount) || 0), 0);
  const filteredChildren = childFilter === 'Tous' ? childrenList : childrenList.filter(c => c.class_id === childFilter);
  const projectTasks = tasks.filter(t => t.project_id === selectedProjectId);

  const KanbanColumn = ({ title, status, color }: {title:string, status:string, color:string}) => (
    <View style={styles.kanbanCol}>
      <View style={[styles.kanbanColHeader, { borderBottomColor: color }]}><Text style={styles.kanbanColTitle}>{title}</Text></View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {projectTasks.filter(t => t.status === status).map(t => {
          const isOverdue = t.deadline && new Date(t.deadline) < new Date() && t.status !== 'DONE';
          return (
            <TouchableOpacity key={t.id} style={styles.kanbanCard} onPress={() => cycleTaskStatus(t)}>
              <Text style={styles.kTaskTitle}>{t.title}</Text>
              {t.deadline && (
                <Text style={[styles.kTaskDeadline, isOverdue ? {color: '#ef4444', fontWeight: 'bold'} : {}]}>
                  ⏳ {new Date(t.deadline).toLocaleDateString('fr-FR')}
                </Text>
              )}
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

          {/* VUE DÉNOMBREMENT */}
          {currentView === 'HEADCOUNTS' && (
            <View style={{ flex: 1 }}>
              <View style={styles.financeHeader}>
                <Text style={styles.hubSubtitle}>Rapports de présence</Text>
                {isLeader && <TouchableOpacity style={[styles.addFinanceBtn, {backgroundColor: '#14b8a6'}]} onPress={() => setIsAddingHeadcount(true)}><Text style={styles.addFinanceBtnText}>+ Rapport</Text></TouchableOpacity>}
              </View>
              <FlatList data={headcounts} keyExtractor={item => item.id} showsVerticalScrollIndicator={false} ListEmptyComponent={<Text style={styles.emptyText}>Aucun rapport enregistré.</Text>} renderItem={({ item }) => {
                const hcDate = new Date(item.event_date);
                return (
                  <View style={styles.planningCard}>
                    <View style={[styles.planningDateBox, {borderColor: '#ccfbf1', backgroundColor: '#f0fdfa'}]}><Text style={styles.planningDateDay}>{hcDate.getDate()}</Text><Text style={styles.planningDateMonth}>{hcDate.toLocaleString('fr-FR', { month: 'short' }).toUpperCase()}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planningTitle}>{item.event_title}</Text>
                      <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8}}>
                        <Text style={{fontSize: 12, fontWeight: 'bold', color: '#3b82f6'}}>👨 {item.men_count}</Text>
                        <Text style={{fontSize: 12, fontWeight: 'bold', color: '#ec4899'}}>👩 {item.women_count}</Text>
                        <Text style={{fontSize: 12, fontWeight: 'bold', color: '#f59e0b'}}>🧸 {item.children_count}</Text>
                      </View>
                      <Text style={{fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginTop: 8, textAlign: 'right'}}>Total : {item.total_count}</Text>
                    </View>
                  </View>
                )
              }}/>
            </View>
          )}

          {/* VUES MULTIMEDIA */}
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
                  <Text style={{fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 10}}>Appuyez sur une tâche pour changer son statut</Text>
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

          {/* 🔴 VUE SUIVI DES ÂMES (EVANGELISATION) */}
          {currentView === 'SOULS' && (
            <View style={{ flex: 1 }}>
              <View style={styles.financeHeader}>
                <Text style={styles.hubSubtitle}>Suivi des Âmes</Text>
                <TouchableOpacity style={[styles.addFinanceBtn, { backgroundColor: '#f97316' }]} onPress={() => { setNewSoul({ id: '', first_name: '', last_name: '', phone: '', address: '', profession: '', assigned_to: '', photo_url: '', is_baptized_candidate: false, regularity: 'Faible', observations: '', is_called: false, is_visited: false, integration_status: 'NONE', integration_notes: '' }); setIsAddingSoul(true); }}>
                  <Text style={styles.addFinanceBtnText}>+ Ajouter une âme</Text>
                </TouchableOpacity>
              </View>
              <FlatList data={soulsList} keyExtractor={item => item.id} showsVerticalScrollIndicator={false} ListEmptyComponent={<Text style={styles.emptyText}>Aucune âme enregistrée.</Text>} renderItem={({ item }) => (
                <View style={styles.soulCard}>
                  <View style={styles.soulCardTop}>
                    {item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.soulAvatar} /> : <View style={styles.soulAvatarPlaceholder}><Text style={{fontSize: 24}}>👤</Text></View>}
                    <View style={styles.soulInfo}>
                      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Text style={styles.soulName}>{item.first_name} {item.last_name}</Text>
                        <TouchableOpacity onPress={() => { setNewSoul({ ...item, phone: item.phone || '', address: item.address || '', profession: item.profession || '', assigned_to: item.assigned_to || '', photo_url: item.photo_url || '', regularity: item.regularity || 'Faible', observations: item.observations || '', integration_status: item.integration_status || 'NONE', integration_notes: item.integration_notes || '' }); setIsAddingSoul(true); }} style={styles.soulEditBtn}><Text style={styles.soulEditBtnText}>✏️ Suivi</Text></TouchableOpacity>
                      </View>
                      <Text style={styles.soulDetail}>📍 {item.address || 'Adresse inconnue'}</Text>
                      {item.phone && <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.phone}`)} style={{marginTop: 4}}><Text style={styles.soulPhone}>📞 {item.phone}</Text></TouchableOpacity>}
                      
                      {/* BADGES D'INTÉGRATION */}
                      {item.integration_status === 'PENDING' && (
                        <View style={{marginTop: 5, alignSelf: 'flex-start', backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}}>
                          <Text style={{fontSize: 9, fontWeight: 'bold', color: '#d97706'}}>⏳ En attente pasteur</Text>
                        </View>
                      )}
                      {item.integration_status === 'REJECTED' && (
                        <View style={{marginTop: 5, alignSelf: 'flex-start', backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}}>
                          <Text style={{fontSize: 9, fontWeight: 'bold', color: '#ef4444'}}>❌ Intégration Refusée</Text>
                        </View>
                      )}
                      {item.integration_status === 'INTEGRATED' && (
                        <View style={{marginTop: 5, alignSelf: 'flex-start', backgroundColor: '#dcfce3', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}}>
                          <Text style={{fontSize: 9, fontWeight: 'bold', color: '#16a34a'}}>✅ Fidèle Officiel</Text>
                        </View>
                      )}

                    </View>
                  </View>
                  <View style={{paddingHorizontal: 15, paddingBottom: 10, flexDirection: 'row', gap: 5}}>
                    <View style={[styles.statusBadge, {backgroundColor: item.is_called ? '#dcfce3' : '#f1f5f9'}]}><Text style={[styles.statusBadgeText, {color: item.is_called ? '#16a34a' : '#94a3b8'}]}>{item.is_called ? '📞 Appelé' : 'Non Appelé'}</Text></View>
                    <View style={[styles.statusBadge, {backgroundColor: item.is_visited ? '#dcfce3' : '#f1f5f9'}]}><Text style={[styles.statusBadgeText, {color: item.is_visited ? '#16a34a' : '#94a3b8'}]}>{item.is_visited ? '🏠 Visité' : 'Non Visité'}</Text></View>
                    {item.is_baptized_candidate && <View style={[styles.statusBadge, {backgroundColor: '#e0e7ff'}]}><Text style={[styles.statusBadgeText, {color: '#4f46e5'}]}>💧 Baptême</Text></View>}
                  </View>
                  <View style={styles.soulCardBottom}>
                    <Text style={styles.soulAssignLabel}>Suivi assuré par :</Text>
                    <Text style={[styles.soulAssignText, {color: item.assigned_member ? '#0f172a' : '#ef4444'}]}>{item.assigned_member ? `👤 ${item.assigned_member}` : '⚠️ Non assigné'}</Text>
                  </View>
                </View>
              )}/>
            </View>
          )}

          {/* VUE ENFANTS */}
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
                      <View style={styles.newChildBottom}>
                        <Text style={styles.parentTitle}>Contact Parent: <Text style={{color: '#0f172a'}}>{item.parent_name || 'Inconnu'}</Text></Text>
                        {item.parent_phone && <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.parent_phone}`)}><Text style={styles.parentPhone}>📞 {item.parent_phone}</Text></TouchableOpacity>}
                      </View>
                    </View>
                  )
                }}
              />
            </View>
          )}

          {/* VUE PLANNING & ROLES */}
          {currentView === 'PLANNING' && (
            <View style={{ flex: 1 }}>
              <View style={styles.financeHeader}>
                <Text style={styles.hubSubtitle}>{isMediaDept ? "Agenda & Postes" : "Agenda & Événements"}</Text>
                {isLeader && <TouchableOpacity style={[styles.addFinanceBtn, { backgroundColor: '#06b6d4' }]} onPress={() => setIsAddingPlanning(true)}><Text style={styles.addFinanceBtnText}>+ Ajouter</Text></TouchableOpacity>}
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {isLeader && churchPrograms.length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={styles.sectionTitle}>⛪ Programmes Officiels</Text>
                    {churchPrograms.map(cp => {
                      const cpDate = new Date(cp.date || cp.start_time || cp.created_at);
                      return (
                        <View key={cp.id} style={[styles.planningCard, { borderColor: '#c7d2fe', backgroundColor: '#eef2ff' }]}>
                          <View style={[styles.planningDateBox, { backgroundColor: '#fff', borderColor: '#c7d2fe' }]}><Text style={styles.planningDateDay}>{cpDate.getDate()}</Text><Text style={styles.planningDateMonth}>{cpDate.toLocaleString('fr-FR', { month: 'short' }).toUpperCase()}</Text></View>
                          <View style={{ flex: 1 }}><Text style={styles.planningTitle}>{cp.title}</Text>
                            {isLeader && (
                              <TouchableOpacity style={styles.joinProgramBtn} onPress={() => {
                                if (hasSubGroups) { setSelectedChurchProgram(cp); } 
                                else {
                                  Alert.alert("Participer", "Ajouter cet événement à votre planning ?", [
                                    { text: "Annuler", style: "cancel" }, { text: "Oui", onPress: () => handleAddPlanning(true, cp) }
                                  ]);
                                }
                              }}>
                                <Text style={styles.joinProgramBtnText}>{hasSubGroups ? "Assigner mes groupes" : isMediaDept ? "Participer pour assigner" : "Participer"}</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )
                    })}
                  </View>
                )}
                <Text style={styles.sectionTitle}>📅 Notre Planning</Text>
                {plannings.length === 0 ? ( <Text style={styles.emptyText}>Aucun événement programmé.</Text> ) : (
                  plannings.map(item => {
                    const evDate = new Date(item.event_date);
                    const eventRoles = planningRoles.filter(pr => pr.planning_id === item.id);
                    return (
                      <View key={item.id} style={[styles.planningCard, {flexDirection: 'column'}]}>
                        <View style={{flexDirection: 'row', width: '100%'}}>
                          <View style={styles.planningDateBox}><Text style={styles.planningDateDay}>{evDate.getDate()}</Text><Text style={styles.planningDateMonth}>{evDate.toLocaleString('fr-FR', { month: 'short' }).toUpperCase()}</Text></View>
                          <View style={{ flex: 1 }}><Text style={styles.planningTitle}>{item.title}</Text><Text style={styles.planningTime}>⏰ {evDate.getHours().toString().padStart(2, '0')}:{evDate.getMinutes().toString().padStart(2, '0')}</Text>
                            {hasSubGroups && (
                              <View style={styles.planningBadgesRow}>
                                <View style={[styles.planBadge, { backgroundColor: item.is_church_event ? '#e0e7ff' : '#fef3c7' }]}><Text style={[styles.planBadgeText, { color: item.is_church_event ? '#4f46e5' : '#d97706' }]}>{item.is_church_event ? '⛪ Église' : '🎵 Interne'}</Text></View>
                                {item.concerns_all ? (<View style={[styles.planBadge, { backgroundColor: '#f1f5f9' }]}><Text style={[styles.planBadgeText, { color: '#64748b' }]}>👥 Tout le département</Text></View>) : (item.assigned_groups?.map((gId: string) => { const gName = groups.find(g => g.id === gId)?.name || 'Groupe'; return (<View key={gId} style={[styles.planBadge, { backgroundColor: '#dcfce3' }]}><Text style={[styles.planBadgeText, { color: '#16a34a' }]}>{gName}</Text></View>) }))}
                              </View>
                            )}
                          </View>
                        </View>
                        {isMediaDept && (
                          <View style={{marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9'}}>
                            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5}}>
                              <Text style={{fontSize: 11, fontWeight: 'bold', color: '#64748b'}}>POSTES & ATTRIBUTIONS</Text>
                              {isLeader && (
                                <TouchableOpacity onPress={() => { setSelectedPlanningId(item.id); setIsAssigningRole(true); }}><Text style={{fontSize: 11, fontWeight: 'bold', color: '#3b82f6'}}>+ Assigner</Text></TouchableOpacity>
                              )}
                            </View>
                            {eventRoles.length === 0 ? <Text style={{fontSize: 11, color: '#94a3b8', fontStyle: 'italic'}}>Aucun poste assigné.</Text> : (
                              eventRoles.map(pr => (
                                <View key={pr.id} style={{flexDirection: 'row', alignItems: 'center', marginVertical: 3}}>
                                  <Text style={{fontSize: 12, fontWeight: 'bold', color: '#0f172a', width: 100}}>{pr.role_name}</Text>
                                  <Text style={{fontSize: 12, color: pr.user_id === currentUserId ? '#10b981' : '#64748b', fontWeight: pr.user_id === currentUserId ? 'bold' : 'normal'}}>➔ {pr.member_name}</Text>
                                </View>
                              ))
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          )}

          {/* VUE ANNONCES */}
          {currentView === 'ANNOUNCEMENTS' && (
            <View style={{ flex: 1 }}>
              <View style={styles.financeHeader}>
                <Text style={styles.hubSubtitle}>Communiqués Officiels</Text>
                {isLeader && <TouchableOpacity style={[styles.addFinanceBtn, { backgroundColor: '#ec4899' }]} onPress={() => setIsAddingAnnouncement(true)}><Text style={styles.addFinanceBtnText}>+ Nouvelle Annonce</Text></TouchableOpacity>}
              </View>
              <FlatList data={announcements} keyExtractor={item => item.id} ListEmptyComponent={<Text style={styles.emptyText}>Aucune annonce publiée.</Text>} renderItem={({ item }) => (
                <View style={[styles.planningCard, { flexDirection: 'column', borderLeftWidth: 4, borderLeftColor: '#ec4899' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={[styles.planningTitle, { color: '#ec4899' }]}>📢 {item.title}</Text>
                    <Text style={styles.planningTime}>{new Date(item.created_at).toLocaleDateString('fr-FR')}</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: 15 }}>{item.content}</Text>
                  {hasSubGroups && (
                    <View style={styles.planningBadgesRow}>
                      <Text style={{ fontSize: 10, color: '#94a3b8', marginRight: 5, alignSelf: 'center' }}>Cible :</Text>
                      {item.concerns_all ? (<View style={[styles.planBadge, { backgroundColor: '#f1f5f9' }]}><Text style={[styles.planBadgeText, { color: '#64748b' }]}>Tous les membres</Text></View>) : (item.assigned_groups?.map((gId: string) => { const gName = groups.find(g => g.id === gId)?.name || 'Groupe'; return (<View key={gId} style={[styles.planBadge, { backgroundColor: '#fdf2f8' }]}><Text style={[styles.planBadgeText, { color: '#db2777' }]}>{gName}</Text></View>) }))}
                    </View>
                  )}
                </View>
              )}/>
            </View>
          )}
          
          {/* VUE FINANCES */}
          {currentView === 'FINANCES' && isLeader && (
            <View style={{ flex: 1 }}>
              <View style={[styles.balanceCard, { backgroundColor: balance >= 0 ? '#0f172a' : '#ef4444' }]}><Text style={styles.balanceLabel}>Solde de la Caisse</Text><Text style={styles.balanceAmount}>{balance.toLocaleString('fr-FR')} FCFA</Text></View>
              <View style={styles.financeHeader}><Text style={styles.hubSubtitle}>Historique des transactions</Text><TouchableOpacity style={styles.addFinanceBtn} onPress={() => setIsAddingFinance(true)}><Text style={styles.addFinanceBtnText}>+ Opération</Text></TouchableOpacity></View>
              <FlatList data={finances} keyExtractor={item => item.id} ListEmptyComponent={<Text style={styles.emptyText}>Aucune transaction enregistrée.</Text>} renderItem={({ item }) => (
                <View style={styles.financeCard}><View style={styles.financeIconWrapper}><Text style={{ fontSize: 20 }}>{item.type === 'INCOME' ? '📥' : '💸'}</Text></View><View style={{ flex: 1 }}><Text style={styles.financeCategory}>{item.category}</Text>{item.member && <Text style={styles.financeMember}>Par : {item.member.full_name}</Text>}<Text style={styles.financeDate}>{new Date(item.created_at).toLocaleDateString('fr-FR')}</Text></View><Text style={[styles.financeAmount, { color: item.type === 'INCOME' ? '#10b981' : '#ef4444' }]}>{item.type === 'INCOME' ? '+' : '-'}{item.amount}</Text></View>
              )}/>
            </View>
          )}

          {/* VUE CHANTS */}
          {currentView === 'SONGS' && isLeader && isChoirDept && (
            <View style={{ flex: 1 }}><View style={styles.songHeader}><TextInput style={styles.searchInput} placeholder="🔍 Rechercher un chant..." value={searchQuery} onChangeText={setSearchQuery} /><TouchableOpacity style={styles.addSongBtn} onPress={() => setIsAddingSong(true)}><Text style={styles.addSongBtnText}>+ Chant</Text></TouchableOpacity></View><FlatList data={filteredSongs} keyExtractor={item => item.id} ListEmptyComponent={<Text style={styles.emptyText}>{searchQuery ? "Aucun résultat." : "Répertoire vide."}</Text>} renderItem={({ item }) => (<View style={styles.songCard}><View style={styles.songInfo}><Text style={styles.songTitle}>{item.title}</Text>{item.musical_key && (<View style={styles.keyBadge}><Text style={styles.keyBadgeText}>Gamme: {item.musical_key}</Text></View>)}</View>{item.video_url && (<TouchableOpacity style={styles.playBtn} onPress={() => openVideo(item.video_url)}><Text style={styles.playBtnText}>▶️ Écouter</Text></TouchableOpacity>)}</View>)}/></View>
          )}

          {/* VUE MEMBRES */}
          {currentView === 'MEMBERS' && isLeader && (
            <View style={{ flex: 1 }}>
              {hasSubGroups && (
                <View style={styles.groupCreationCard}><Text style={styles.groupCreationTitle}>Créer un sous-groupe (Pupitre, Équipe...)</Text><View style={styles.groupRow}><TextInput style={styles.groupInput} placeholder="Ex: Soprano, Logistique..." value={newGroupName} onChangeText={setNewGroupName} /><TouchableOpacity style={styles.groupBtn} onPress={handleCreateGroup}><Text style={styles.groupBtnText}>Ajouter</Text></TouchableOpacity></View></View>
              )}
              <Text style={styles.hubSubtitle}>Membres actifs</Text>
              <FlatList data={activeMembers} keyExtractor={item => item.id} showsVerticalScrollIndicator={false} ListEmptyComponent={<Text style={styles.emptyText}>Aucun membre actif.</Text>} renderItem={({ item }) => { 
                const ledGroup = groups.find(g => g.leader_id === item.user_id); 
                return (
                  <TouchableOpacity style={styles.memberItem} onPress={() => {
                    if (!hasSubGroups) handleRemoveMemberFromDept(item.id);
                    else setSelectedMember(item);
                  }}>
                    <View>
                      <Text style={styles.memberName}>{item.member.full_name}</Text>
                      {hasSubGroups && <Text style={styles.memberRole}>{ledGroup ? `👑 Responsable : ${ledGroup.name}` : 'Membre simple'}</Text>}
                    </View>
                    <Text style={[styles.assignBtn, !hasSubGroups && {backgroundColor: '#fef2f2', color: '#ef4444'}]}>{hasSubGroups ? 'Gérer ➔' : 'Exclure ➔'}</Text>
                  </TouchableOpacity>
                ); 
              }}/>
            </View>
          )}

        </View>
      )}

      {/* --- MODALES --- */}
      <Modal visible={isAddingHeadcount} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalContentBottom, {maxHeight: '90%'}]}>
            <View style={styles.modalHeaderRow}><Text style={styles.modalTitle}>Rapport de Présence</Text><TouchableOpacity onPress={() => setIsAddingHeadcount(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false}>
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
                      {allChurchPrograms.length === 0 && <Text style={{padding: 10, color: '#ef4444', fontSize: 12}}>Aucun programme d'église disponible.</Text>}
                      {allChurchPrograms.map(cp => (
                        <TouchableOpacity key={cp.id} style={styles.dropdownItem} onPress={() => { 
                          setNewHeadcount({...newHeadcount, church_program_id: cp.id, event_title: cp.title, event_date: cp.date || cp.start_time || cp.created_at}); 
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
                <View style={{flex: 1}}><Text style={styles.inputLabel}>👨 Hommes</Text><TextInput style={styles.formInput} keyboardType="numeric" placeholder="0" onChangeText={t => setNewHeadcount({...newHeadcount, men_count: t})} /></View>
                <View style={{flex: 1}}><Text style={styles.inputLabel}>👩 Femmes</Text><TextInput style={styles.formInput} keyboardType="numeric" placeholder="0" onChangeText={t => setNewHeadcount({...newHeadcount, women_count: t})} /></View>
                <View style={{flex: 1}}><Text style={styles.inputLabel}>🧸 Enfants</Text><TextInput style={styles.formInput} keyboardType="numeric" placeholder="0" onChangeText={t => setNewHeadcount({...newHeadcount, children_count: t})} /></View>
              </View>

              <View style={[styles.modalActionsRow, { marginBottom: 30 }]}><TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#14b8a6'}]} onPress={handleAddHeadcount}><Text style={styles.modalBtnSubmitText}>Enregistrer le rapport</Text></TouchableOpacity></View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={isAddingPlanning} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalContentBottom, {maxHeight: '85%'}]}>
            <View style={styles.modalHeaderRow}><Text style={styles.modalTitle}>Créer un événement</Text><TouchableOpacity onPress={() => setIsAddingPlanning(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Titre de l'événement *</Text>
              <TextInput style={styles.formInput} placeholder="Ex: Réunion Extraordinaire..." onChangeText={t => setNewPlanning({...newPlanning, title: t})} />
              
              <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>Date *</Text>
                  <TouchableOpacity style={styles.formInput} onPress={() => setShowDatePicker(true)}>
                    <Text style={{color: newPlanning.date ? '#0f172a' : '#94a3b8'}}>{newPlanning.date || "Sélectionner"}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>Heure *</Text>
                  <TouchableOpacity style={styles.formInput} onPress={() => setShowTimePicker(true)}>
                    <Text style={{color: newPlanning.time ? '#0f172a' : '#94a3b8'}}>{newPlanning.time || "Sélectionner"}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {Platform.OS === 'ios' && (showDatePicker || showTimePicker) && (
                <View style={styles.iosPickerContainer}>
                  <View style={styles.iosPickerHeader}><TouchableOpacity onPress={() => { setShowDatePicker(false); setShowTimePicker(false); }}><Text style={styles.iosPickerDoneText}>OK</Text></TouchableOpacity></View>
                  <DateTimePicker value={dateObj} mode={showDatePicker ? "date" : "time"} display="spinner" locale="fr-FR" onChange={(e, d) => { if (d) { setDateObj(d); if (showDatePicker) setNewPlanning({...newPlanning, date: d.toISOString().split('T')[0]}); else setNewPlanning({...newPlanning, time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`}); } }} />
                </View>
              )}
              {Platform.OS === 'android' && showDatePicker && (<DateTimePicker value={dateObj} mode="date" onChange={(e, d) => { setShowDatePicker(false); if (d) { setDateObj(d); setNewPlanning({...newPlanning, date: d.toISOString().split('T')[0]}); } }} />)}
              {Platform.OS === 'android' && showTimePicker && (<DateTimePicker value={dateObj} mode="time" onChange={(e, d) => { setShowTimePicker(false); if (d) { setDateObj(d); setNewPlanning({...newPlanning, time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`}); } }} />)}
              
              {hasSubGroups && groups.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <Text style={styles.inputLabel}>Qui est concerné ?</Text>
                  <View style={styles.financeToggleRow}>
                    <TouchableOpacity style={[styles.financeToggleBtn, newPlanning.concerns_all && styles.toggleActiveDark]} onPress={() => setNewPlanning({...newPlanning, concerns_all: true, selected_groups: []})}><Text style={[styles.financeToggleText, newPlanning.concerns_all && {color: '#fff'}]}>Tout le département</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.financeToggleBtn, !newPlanning.concerns_all && styles.toggleActiveDark]} onPress={() => setNewPlanning({...newPlanning, concerns_all: false})}><Text style={[styles.financeToggleText, !newPlanning.concerns_all && {color: '#fff'}]}>Spécifique</Text></TouchableOpacity>
                  </View>
                  {!newPlanning.concerns_all && (
                    <View style={styles.groupCheckboxContainer}>{groups.map(g => { const isSelected = newPlanning.selected_groups.includes(g.id); return (<TouchableOpacity key={g.id} style={[styles.groupCheckbox, isSelected && styles.groupCheckboxActive]} onPress={() => setNewPlanning(prev => ({...prev, selected_groups: isSelected ? prev.selected_groups.filter(id=>id!==g.id) : [...prev.selected_groups, g.id]}))}><Text style={[styles.groupCheckboxText, isSelected && {color: '#16a34a'}]}>{isSelected ? '✓ ' : '+ '}{g.name}</Text></TouchableOpacity>)})}</View>
                  )}
                </View>
              )}
              <View style={[styles.modalActionsRow, { marginBottom: 30 }]}><TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#0f172a'}]} onPress={() => handleAddPlanning(false)}><Text style={styles.modalBtnSubmitText}>Programmer l'événement</Text></TouchableOpacity></View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!selectedChurchProgram} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalContentBottom, {maxHeight: '85%'}]}>
            <View style={styles.modalHeaderRow}><Text style={styles.modalTitle}>Assigner des groupes</Text><TouchableOpacity onPress={() => setSelectedChurchProgram(null)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{fontSize: 14, color: '#64748b', marginBottom: 20}}>Événement : <Text style={{fontWeight: 'bold', color: '#0f172a'}}>{selectedChurchProgram?.title}</Text></Text>
              {hasSubGroups && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.inputLabel}>Qui doit intervenir ?</Text>
                  <View style={styles.financeToggleRow}><TouchableOpacity style={[styles.financeToggleBtn, newPlanning.concerns_all && styles.toggleActiveIndigo]} onPress={() => setNewPlanning({...newPlanning, concerns_all: true, selected_groups: []})}><Text style={[styles.financeToggleText, newPlanning.concerns_all && { color: '#fff' }]}>Tout le département</Text></TouchableOpacity><TouchableOpacity style={[styles.financeToggleBtn, !newPlanning.concerns_all && styles.toggleActiveIndigo]} onPress={() => setNewPlanning({...newPlanning, concerns_all: false})}><Text style={[styles.financeToggleText, !newPlanning.concerns_all && { color: '#fff' }]}>Certains groupes</Text></TouchableOpacity></View>
                  {!newPlanning.concerns_all && (<View style={styles.groupCheckboxContainer}>{groups.map(g => { const isSelected = newPlanning.selected_groups.includes(g.id); return (<TouchableOpacity key={g.id} style={[styles.groupCheckbox, isSelected && styles.groupCheckboxActive]} onPress={() => setNewPlanning(prev => ({...prev, selected_groups: isSelected ? prev.selected_groups.filter(id=>id!==g.id) : [...prev.selected_groups, g.id]}))}><Text style={[styles.groupCheckboxText, isSelected && { color: '#16a34a' }]}>{isSelected ? '✓ ' : '+ '}{g.name}</Text></TouchableOpacity>)})}</View>)}
                </View>
              )}
              <View style={[styles.modalActionsRow, { marginBottom: 30 }]}><TouchableOpacity style={[styles.modalBtnSubmit, { backgroundColor: '#4f46e5' }]} onPress={() => handleAddPlanning(true)}><Text style={styles.modalBtnSubmitText}>Valider l'assignation</Text></TouchableOpacity></View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 🔴 SUIVI AMES MODAL (AVEC BOUTON D'INTÉGRATION) */}
      <Modal visible={isAddingSoul} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalContentBottom, {maxHeight: '90%'}]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{newSoul.id ? 'Suivi et Profil' : 'Enregistrer une âme'}</Text>
              <TouchableOpacity onPress={() => setIsAddingSoul(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              
              {/* Message de refus éventuel du pasteur */}
              {newSoul.id && newSoul.integration_status === 'REJECTED' && (
                <View style={{backgroundColor: '#fee2e2', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#f87171'}}>
                  <Text style={{color: '#b91c1c', fontWeight: 'bold', fontSize: 13, marginBottom: 4}}>❌ Intégration refusée par le pasteur</Text>
                  <Text style={{color: '#991b1b', fontSize: 12}}>{newSoul.integration_notes || 'Aucun motif précisé.'}</Text>
                </View>
              )}

              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                {newSoul.photo_url ? (<Image source={{ uri: newSoul.photo_url }} style={styles.soulAvatar} />) : (<View style={styles.soulAvatarPlaceholder}><Text style={{fontSize: 30}}>👤</Text></View>)}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}><Text style={styles.photoBtnText}>📷 Prendre photo</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={pickImage}><Text style={styles.photoBtnText}>🖼️ Galerie</Text></TouchableOpacity>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Identité</Text>
              <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}><Text style={styles.inputLabel}>Prénom *</Text><TextInput style={styles.formInput} value={newSoul.first_name} onChangeText={t => setNewSoul({...newSoul, first_name: t})} /></View>
                <View style={{flex: 1}}><Text style={styles.inputLabel}>Nom *</Text><TextInput style={styles.formInput} value={newSoul.last_name} onChangeText={t => setNewSoul({...newSoul, last_name: t})} /></View>
              </View>
              <Text style={styles.inputLabel}>Téléphone</Text><TextInput style={styles.formInput} keyboardType="phone-pad" value={newSoul.phone} onChangeText={t => setNewSoul({...newSoul, phone: t})} />
              
              {newSoul.id ? (
                <>
                  <Text style={[styles.sectionTitle, {marginTop: 20}]}>Journal de Suivi</Text>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, padding: 10, backgroundColor: '#f8fafc', borderRadius: 10}}>
                    <Text style={{fontWeight: 'bold', color: '#0f172a'}}>Candidat au Baptême ?</Text>
                    <Switch value={newSoul.is_baptized_candidate} onValueChange={v => setNewSoul({...newSoul, is_baptized_candidate: v})} trackColor={{ true: '#4f46e5' }} />
                  </View>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15}}>
                    <View style={{alignItems: 'center'}}><Text style={{fontSize: 12, marginBottom: 5, fontWeight: 'bold'}}>📞 Appelé ?</Text><Switch value={newSoul.is_called} onValueChange={v => setNewSoul({...newSoul, is_called: v})} trackColor={{ true: '#10b981' }} /></View>
                    <View style={{alignItems: 'center'}}><Text style={{fontSize: 12, marginBottom: 5, fontWeight: 'bold'}}>🏠 Visité ?</Text><Switch value={newSoul.is_visited} onValueChange={v => setNewSoul({...newSoul, is_visited: v})} trackColor={{ true: '#10b981' }} /></View>
                  </View>
                  <Text style={styles.inputLabel}>Régularité à l'Église</Text>
                  <View style={{flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 15}}>
                    {['Faible', 'Moyenne', 'Bonne'].map(reg => (
                      <TouchableOpacity key={reg} style={[styles.financeToggleBtn, newSoul.regularity === reg && {backgroundColor: reg === 'Faible' ? '#ef4444' : reg === 'Moyenne' ? '#f59e0b' : '#10b981'}]} onPress={() => setNewSoul({...newSoul, regularity: reg})}>
                        <Text style={[styles.financeToggleText, newSoul.regularity === reg && {color: '#fff'}]}>{reg}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.inputLabel}>Observations</Text>
                  <TextInput style={[styles.formInput, {height: 80, textAlignVertical: 'top'}]} multiline value={newSoul.observations} onChangeText={t => setNewSoul({...newSoul, observations: t})} placeholder="Notes du responsable..." />
                  
                  {/* BOUTONS D'ACTIONS (SOUL EXISTANTE) */}
                  <View style={{marginTop: 30, marginBottom: 40, gap: 15}}>
                    <TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#f97316'}]} onPress={handleAddSoul}>
                      <Text style={styles.modalBtnSubmitText}>Sauvegarder le Suivi</Text>
                    </TouchableOpacity>

                    {/* 🔴 BOUTON DEMANDE INTÉGRATION (Si pas déjà PENDING ou INTEGRATED) */}
                    {(newSoul.integration_status === 'NONE' || newSoul.integration_status === 'REJECTED' || !newSoul.integration_status) && (
                      <TouchableOpacity 
                        style={{backgroundColor: '#0f172a', padding: 15, borderRadius: 12, alignItems: 'center'}} 
                        onPress={() => handleRequestIntegration(newSoul)}
                      >
                        <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 14}}>Dossier mâture : Demander l'intégration ➔</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              ) : (
                <View style={[styles.modalActionsRow, {marginBottom: 40, marginTop: 20}]}>
                  <TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#f97316'}]} onPress={handleAddSoul}>
                    <Text style={styles.modalBtnSubmitText}>Enregistrer la nouvelle âme</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={isAddingTask} transparent animationType="slide"><KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[styles.modalContentBottom, {maxHeight: '85%'}]}><View style={styles.modalHeaderRow}><Text style={styles.modalTitle}>Nouvelle Tâche</Text><TouchableOpacity onPress={() => setIsAddingTask(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity></View><ScrollView><Text style={styles.inputLabel}>Titre *</Text><TextInput style={styles.formInput} placeholder="Ex: Monter le teaser" onChangeText={t => setNewTask({...newTask, title: t})} /><Text style={styles.inputLabel}>Deadline (Optionnel)</Text><TouchableOpacity style={styles.formInput} onPress={() => setShowTaskDatePicker(true)}><Text style={{color: newTask.deadline ? '#0f172a' : '#94a3b8'}}>{newTask.deadline || "Sélectionner une date"}</Text></TouchableOpacity>{showTaskDatePicker && (<DateTimePicker value={new Date()} mode="date" display="default" onChange={(e, d) => { setShowTaskDatePicker(false); if (d) setNewTask({...newTask, deadline: d.toISOString().split('T')[0]}); }} />)}<View style={{ zIndex: 10, marginTop: 15 }}><Text style={styles.inputLabel}>Assigner à</Text><TouchableOpacity style={styles.dropdownSelector} onPress={() => setIsMemberDropdownOpen(!isMemberDropdownOpen)}><Text style={newTask.assigned_to ? styles.dropdownTextSelected : styles.dropdownTextPlaceholder}>{newTask.assigned_to ? activeMembers.find(m => m.user_id === newTask.assigned_to)?.member.full_name : "-- Non assigné --"}</Text><Text style={{ color: '#94a3b8' }}>▼</Text></TouchableOpacity>{isMemberDropdownOpen && (<View style={styles.dropdownContainer}><ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled><TouchableOpacity style={styles.dropdownItem} onPress={() => { setNewTask({...newTask, assigned_to: ''}); setIsMemberDropdownOpen(false); }}><Text style={styles.dropdownItemText}>-- Personne --</Text></TouchableOpacity>{activeMembers.map(m => (<TouchableOpacity key={m.id} style={styles.dropdownItem} onPress={() => { setNewTask({...newTask, assigned_to: m.user_id}); setIsMemberDropdownOpen(false); }}><Text style={styles.dropdownItemText}>{m.member.full_name}</Text></TouchableOpacity>))}</ScrollView></View>)}</View><View style={[styles.modalActionsRow, {marginBottom: 30}]}><TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#3b82f6'}]} onPress={handleAddTask}><Text style={styles.modalBtnSubmitText}>Créer la tâche</Text></TouchableOpacity></View></ScrollView></View></KeyboardAvoidingView></Modal>
      <Modal visible={isAssigningRole} transparent animationType="slide"><KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[styles.modalContentBottom, {maxHeight: '85%'}]}><View style={styles.modalHeaderRow}><Text style={styles.modalTitle}>Assigner un poste</Text><TouchableOpacity onPress={() => setIsAssigningRole(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity></View><ScrollView showsVerticalScrollIndicator={false}><Text style={styles.inputLabel}>Intitulé du poste *</Text><TextInput style={styles.formInput} placeholder="Ex: Caméra 1, Régie, Son..." onChangeText={t => setNewRole({...newRole, role_name: t})} /><View style={{ zIndex: 10 }}><Text style={styles.inputLabel}>Membre à assigner *</Text><TouchableOpacity style={styles.dropdownSelector} onPress={() => setIsSoulAssignDropdownOpen(!isSoulAssignDropdownOpen)}><Text style={newRole.user_id ? styles.dropdownTextSelected : styles.dropdownTextPlaceholder}>{newRole.user_id ? activeMembers.find(m => m.user_id === newRole.user_id)?.member.full_name : "-- Choisir --"}</Text><Text style={{ color: '#94a3b8' }}>▼</Text></TouchableOpacity>{isSoulAssignDropdownOpen && (<View style={styles.dropdownContainer}><ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>{activeMembers.map(m => (<TouchableOpacity key={m.id} style={styles.dropdownItem} onPress={() => { setNewRole({...newRole, user_id: m.user_id}); setIsSoulAssignDropdownOpen(false); }}><Text style={styles.dropdownItemText}>{m.member.full_name}</Text></TouchableOpacity>))}</ScrollView></View>)}</View><View style={[styles.modalActionsRow, {marginBottom: 30}]}><TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#3b82f6'}]} onPress={handleAssignRole}><Text style={styles.modalBtnSubmitText}>Assigner</Text></TouchableOpacity></View></ScrollView></View></KeyboardAvoidingView></Modal>
      <Modal visible={isAddingProject} transparent animationType="slide"><KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[styles.modalContentBottom, {maxHeight: '85%'}]}><View style={styles.modalHeaderRow}><Text style={styles.modalTitle}>Nouveau Projet</Text><TouchableOpacity onPress={() => setIsAddingProject(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity></View><ScrollView><Text style={styles.inputLabel}>Nom du projet *</Text><TextInput style={styles.formInput} placeholder="Ex: Culte de Pâques" onChangeText={t => setNewProject({...newProject, name: t})} /><Text style={styles.inputLabel}>Description</Text><TextInput style={styles.formInput} placeholder="Objectif..." onChangeText={t => setNewProject({...newProject, description: t})} /><View style={[styles.modalActionsRow, {marginBottom: 30}]}><TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#8b5cf6'}]} onPress={handleAddProject}><Text style={styles.modalBtnSubmitText}>Créer</Text></TouchableOpacity></View></ScrollView></View></KeyboardAvoidingView></Modal>
      <Modal visible={isAddingEq} transparent animationType="slide"><KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[styles.modalContentBottom, {maxHeight: '85%'}]}><View style={styles.modalHeaderRow}><Text style={styles.modalTitle}>Ajouter au parc</Text><TouchableOpacity onPress={() => setIsAddingEq(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity></View><ScrollView><Text style={styles.inputLabel}>Nom *</Text><TextInput style={styles.formInput} placeholder="Ex: Caméra Sony" onChangeText={t => setNewEq({...newEq, name: t})} /><Text style={styles.inputLabel}>Catégorie</Text><View style={styles.financeCategoryRow}>{['Vidéo', 'Audio', 'Lumière', 'Câblage'].map(cat => (<TouchableOpacity key={cat} style={[styles.catPill, newEq.category === cat && styles.catPillActive]} onPress={() => setNewEq({...newEq, category: cat})}><Text style={[styles.catPillText, newEq.category === cat && { color: '#fff' }]}>{cat}</Text></TouchableOpacity>))}</View><View style={[styles.modalActionsRow, {marginBottom: 30}]}><TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#10b981'}]} onPress={handleAddEq}><Text style={styles.modalBtnSubmitText}>Ajouter</Text></TouchableOpacity></View></ScrollView></View></KeyboardAvoidingView></Modal>
      <Modal visible={isAddingEqNeed} transparent animationType="slide"><KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[styles.modalContentBottom, {maxHeight: '85%'}]}><View style={styles.modalHeaderRow}><Text style={styles.modalTitle}>Signaler un besoin</Text><TouchableOpacity onPress={() => setIsAddingEqNeed(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity></View><ScrollView><Text style={styles.inputLabel}>Équipement manquant *</Text><TextInput style={styles.formInput} onChangeText={t => setNewEqNeed({...newEqNeed, item_name: t})} /><Text style={styles.inputLabel}>Urgence</Text><View style={styles.financeCategoryRow}>{['BASSE', 'MOYENNE', 'HAUTE'].map(prio => (<TouchableOpacity key={prio} style={[styles.catPill, newEqNeed.priority === prio && {backgroundColor: '#f59e0b'}]} onPress={() => setNewEqNeed({...newEqNeed, priority: prio})}><Text style={[styles.catPillText, newEqNeed.priority === prio && { color: '#fff' }]}>{prio}</Text></TouchableOpacity>))}</View><View style={[styles.modalActionsRow, {marginBottom: 30}]}><TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#f59e0b'}]} onPress={handleAddEqNeed}><Text style={styles.modalBtnSubmitText}>Signaler</Text></TouchableOpacity></View></ScrollView></View></KeyboardAvoidingView></Modal>
      <Modal visible={isAddingChild} transparent animationType="slide"><KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[styles.modalContentBottom, {maxHeight: '85%'}]}><View style={styles.modalHeaderRow}><Text style={styles.modalTitle}>Inscrire un enfant</Text><TouchableOpacity onPress={() => setIsAddingChild(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity></View><ScrollView showsVerticalScrollIndicator={false}><View style={{flexDirection: 'row', gap: 10}}><View style={{flex: 1}}><Text style={styles.inputLabel}>Prénom *</Text><TextInput style={styles.formInput} onChangeText={t => setNewChild({...newChild, first_name: t})} /></View><View style={{flex: 1}}><Text style={styles.inputLabel}>Nom *</Text><TextInput style={styles.formInput} onChangeText={t => setNewChild({...newChild, last_name: t})} /></View></View><View style={{ zIndex: 10 }}><Text style={styles.inputLabel}>Classe *</Text><TouchableOpacity style={styles.dropdownSelector} onPress={() => setIsClassDropdownOpen(!isClassDropdownOpen)}><Text style={newChild.class_id ? styles.dropdownTextSelected : styles.dropdownTextPlaceholder}>{newChild.class_id ? groups.find(g => g.id === newChild.class_id)?.name : "-- Choisir --"}</Text><Text style={{ color: '#94a3b8' }}>▼</Text></TouchableOpacity>{isClassDropdownOpen && (<View style={styles.dropdownContainer}><ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>{groups.length === 0 && <Text style={{padding: 10, color: '#ef4444', fontSize: 12}}>Demandez au responsable de créer des classes.</Text>}{groups.map(g => (<TouchableOpacity key={g.id} style={styles.dropdownItem} onPress={() => { setNewChild({...newChild, class_id: g.id}); setIsClassDropdownOpen(false); }}><Text style={styles.dropdownItemText}>{g.name}</Text></TouchableOpacity>))}</ScrollView></View>)}</View><Text style={[styles.inputLabel, {marginTop: 15}]}>Parent ou Tuteur</Text><TextInput style={styles.formInput} onChangeText={t => setNewChild({...newChild, parent_name: t})} /><TextInput style={styles.formInput} keyboardType="phone-pad" onChangeText={t => setNewChild({...newChild, parent_phone: t})} /><View style={[styles.modalActionsRow, {marginBottom: 30}]}><TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#f43f5e'}]} onPress={handleAddChild}><Text style={styles.modalBtnSubmitText}>Enregistrer</Text></TouchableOpacity></View></ScrollView></View></KeyboardAvoidingView></Modal>
      <Modal visible={isAddingFinance} transparent animationType="slide"><KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[styles.modalContentBottom, {maxHeight: '85%'}]}><View style={styles.modalHeaderRow}><Text style={styles.modalTitle}>Transaction</Text><TouchableOpacity onPress={() => setIsAddingFinance(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity></View><ScrollView><View style={styles.financeToggleRow}><TouchableOpacity style={[styles.financeToggleBtn, newFinance.type === 'INCOME' && styles.financeToggleActiveIn]} onPress={() => setNewFinance({...newFinance, type: 'INCOME'})}><Text style={[styles.financeToggleText, newFinance.type === 'INCOME' && { color: '#fff' }]}>📥 Entrée</Text></TouchableOpacity><TouchableOpacity style={[styles.financeToggleBtn, newFinance.type === 'EXPENSE' && styles.financeToggleActiveOut]} onPress={() => setNewFinance({...newFinance, type: 'EXPENSE'})}><Text style={[styles.financeToggleText, newFinance.type === 'EXPENSE' && { color: '#fff' }]}>💸 Sortie</Text></TouchableOpacity></View>{newFinance.type === 'INCOME' && (<View style={styles.financeCategoryRow}>{['Mensuelle', 'Régionale', 'Événement local'].map(cat => (<TouchableOpacity key={cat} style={[styles.catPill, newFinance.category === cat && styles.catPillActive]} onPress={() => setNewFinance({...newFinance, category: cat})}><Text style={[styles.catPillText, newFinance.category === cat && { color: '#fff' }]}>{cat}</Text></TouchableOpacity>))}</View>)}<Text style={styles.inputLabel}>Montant *</Text><TextInput style={styles.formInput} keyboardType="numeric" onChangeText={t => setNewFinance({...newFinance, amount: t})} /><Text style={styles.inputLabel}>Motif</Text><TextInput style={styles.formInput} onChangeText={t => setNewFinance({...newFinance, motif: t})} /><View style={[styles.modalActionsRow, {marginBottom: 30}]}><TouchableOpacity style={styles.modalBtnSubmit} onPress={handleAddFinance}><Text style={styles.modalBtnSubmitText}>Valider</Text></TouchableOpacity></View></ScrollView></View></KeyboardAvoidingView></Modal>
      <Modal visible={isAddingAnnouncement} transparent animationType="slide"><KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[styles.modalContentBottom, {maxHeight: '85%'}]}><View style={styles.modalHeaderRow}><Text style={styles.modalTitle}>Publier une annonce</Text><TouchableOpacity onPress={() => setIsAddingAnnouncement(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity></View><ScrollView showsVerticalScrollIndicator={false}><Text style={styles.inputLabel}>Sujet *</Text><TextInput style={styles.formInput} placeholder="Ex: Réunion annulée..." onChangeText={t => setNewAnnouncement({...newAnnouncement, title: t})} /><Text style={styles.inputLabel}>Contenu *</Text><TextInput style={[styles.formInput, {height: 80, textAlignVertical: 'top'}]} multiline onChangeText={t => setNewAnnouncement({...newAnnouncement, content: t})} />{hasSubGroups && (<View style={{ marginTop: 20 }}><Text style={styles.inputLabel}>Destinataires :</Text><View style={styles.financeToggleRow}><TouchableOpacity style={[styles.financeToggleBtn, newAnnouncement.concerns_all && {backgroundColor: '#ec4899'}]} onPress={() => setNewAnnouncement({...newAnnouncement, concerns_all: true, selected_groups: []})}><Text style={[styles.financeToggleText, newAnnouncement.concerns_all && {color: '#fff'}]}>Tout le département</Text></TouchableOpacity><TouchableOpacity style={[styles.financeToggleBtn, !newAnnouncement.concerns_all && {backgroundColor: '#ec4899'}]} onPress={() => setNewAnnouncement({...newAnnouncement, concerns_all: false})}><Text style={[styles.financeToggleText, !newAnnouncement.concerns_all && {color: '#fff'}]}>Groupes spécifiques</Text></TouchableOpacity></View>{!newAnnouncement.concerns_all && (<View style={styles.groupCheckboxContainer}>{groups.map(g => { const isSelected = newAnnouncement.selected_groups.includes(g.id); return (<TouchableOpacity key={g.id} style={[styles.groupCheckbox, isSelected && {borderColor: '#db2777', backgroundColor: '#fdf2f8'}]} onPress={() => setNewAnnouncement(prev => ({...prev, selected_groups: isSelected ? prev.selected_groups.filter(id=>id!==g.id) : [...prev.selected_groups, g.id]}))}><Text style={[styles.groupCheckboxText, isSelected && {color: '#db2777'}]}>{isSelected ? '✓ ' : '+ '}{g.name}</Text></TouchableOpacity>)})}</View>)}</View>)}<View style={[styles.modalActionsRow, {marginBottom: 30}]}><TouchableOpacity style={[styles.modalBtnSubmit, {backgroundColor: '#ec4899'}]} onPress={handleAddAnnouncement}><Text style={styles.modalBtnSubmitText}>Envoyer le communiqué</Text></TouchableOpacity></View></ScrollView></View></KeyboardAvoidingView></Modal>
      <Modal visible={isAddingSong} transparent animationType="slide"><KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[styles.modalContentBottom, {maxHeight: '85%'}]}><View style={styles.modalHeaderRow}><Text style={styles.modalTitle}>Ajouter au répertoire</Text><TouchableOpacity onPress={() => setIsAddingSong(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity></View><ScrollView><Text style={styles.inputLabel}>Titre *</Text><TextInput style={styles.formInput} onChangeText={t => setNewSong({...newSong, title: t})} /><Text style={styles.inputLabel}>Gamme</Text><TextInput style={styles.formInput} onChangeText={t => setNewSong({...newSong, key: t})} /><Text style={styles.inputLabel}>Lien YouTube</Text><TextInput style={styles.formInput} autoCapitalize="none" onChangeText={t => setNewSong({...newSong, url: t})} /><View style={[styles.modalActionsRow, {marginBottom: 20}]}><TouchableOpacity style={styles.modalBtnSubmit} onPress={handleAddSong}><Text style={styles.modalBtnSubmitText}>Enregistrer</Text></TouchableOpacity></View></ScrollView></View></KeyboardAvoidingView></Modal>
      <Modal visible={!!selectedMember && currentView === 'MEMBERS' && hasSubGroups} transparent animationType="fade"><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Gestion : {selectedMember?.member?.full_name}</Text><ScrollView style={{ maxHeight: 250, width: '100%' }}><TouchableOpacity style={styles.modalOption} onPress={async () => { await supabase.from('department_groups').update({ leader_id: null }).eq('leader_id', selectedMember.user_id); setSelectedMember(null); loadInitialData(); }}><Text style={styles.modalOptionText}>❌ Retirer de la direction</Text></TouchableOpacity>{groups.map(g => { const isAlreadyLeader = g.leader_id === selectedMember?.user_id; return (<TouchableOpacity key={g.id} style={[styles.modalOption, isAlreadyLeader && { borderColor: '#10b981', backgroundColor: '#ecfdf5' }]} onPress={async () => { const { error } = await supabase.from('department_groups').update({ leader_id: selectedMember.user_id }).eq('id', g.id); setSelectedMember(null); if (!error) loadInitialData(); }}><Text style={[styles.modalOptionText, isAlreadyLeader ? { color: '#10b981', fontWeight: 'bold' } : { color: '#3b82f6', fontWeight: 'bold' }]}>{isAlreadyLeader ? `✅ Dirige ${g.name}` : `👑 Nommer chef de ${g.name}`}</Text></TouchableOpacity>); })}</ScrollView><TouchableOpacity style={styles.modalCancel} onPress={() => setSelectedMember(null)}><Text style={styles.modalCancelText}>Annuler</Text></TouchableOpacity></View></View></Modal>
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
  planningTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', flex: 1 },
  planningTime: { fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: '600' },
  planningBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  planBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  planBadgeText: { fontSize: 10, fontWeight: 'bold' },
  joinProgramBtn: { marginTop: 10, backgroundColor: '#4f46e5', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, alignSelf: 'flex-start' },
  joinProgramBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  datePickerBtn: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 15, height: 45, justifyContent: 'center' },
  datePickerText: { color: '#0f172a', fontSize: 14, fontWeight: 'bold' },
  datePickerPlaceholder: { color: '#94a3b8', fontSize: 14 },
  iosPickerContainer: { backgroundColor: '#f1f5f9', borderRadius: 12, marginTop: 15, overflow: 'hidden' },
  iosPickerHeader: { flexDirection: 'row', justifyContent: 'flex-end', padding: 10, backgroundColor: '#e2e8f0' },
  iosPickerDoneText: { fontWeight: 'bold', color: '#0f172a', fontSize: 15 },

  toggleActiveIndigo: { backgroundColor: '#4f46e5' },
  toggleActiveDark: { backgroundColor: '#0f172a' },
  groupCheckboxContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10, padding: 10, backgroundColor: '#f8fafc', borderRadius: 12 },
  groupCheckbox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  groupCheckboxActive: { borderColor: '#16a34a', backgroundColor: '#dcfce3' },
  groupCheckboxText: { fontSize: 12, color: '#64748b', fontWeight: '600' },

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
  financeToggleActiveIn: { backgroundColor: '#10b981' },
  financeToggleActiveOut: { backgroundColor: '#ef4444' },
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
  songInfo: { flex: 1, paddingRight: 10 },
  songTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 6 },
  keyBadge: { alignSelf: 'flex-start', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  keyBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
  playBtn: { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  playBtnText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 12 },
  
  listCard: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  memberName: { fontWeight: 'bold', fontSize: 15, color: '#0f172a' },
  rowActions: { flexDirection: 'row', gap: 10, marginTop: 15 },
  btnApprove: { flex: 1, backgroundColor: '#10b981', padding: 12, borderRadius: 10, alignItems: 'center' },
  btnReject: { flex: 1, backgroundColor: '#ef4444', padding: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8', fontStyle: 'italic' },
  groupCreationCard: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  groupCreationTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginBottom: 10 },
  groupInput: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 15, height: 45, color: '#0f172a' },
  groupRow: { flexDirection: 'row', gap: 10 },
  groupBtn: { backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, borderRadius: 10, height: 45 },
  groupBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  memberItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  memberRole: { fontSize: 12, color: '#64748b', marginTop: 4, fontStyle: 'italic' },
  assignBtn: { fontSize: 12, fontWeight: 'bold', color: '#3b82f6', backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
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
  newChildBottom: { backgroundColor: '#f8fafc', paddingHorizontal: 15, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  parentTitle: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
  parentPhone: { fontSize: 13, color: '#3b82f6', fontWeight: 'bold' },
  
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
  soulCardBottom: { backgroundColor: '#fff7ed', paddingHorizontal: 15, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  soulAssignLabel: { fontSize: 11, color: '#9a3412', fontWeight: 'bold', textTransform: 'uppercase' },
  soulAssignText: { fontSize: 12, fontWeight: 'bold' },
  photoBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  photoBtnText: { fontSize: 12, fontWeight: 'bold', color: '#475569' },

  classPill: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  classPillActive: { backgroundColor: '#f43f5e', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  classPillText: { color: '#64748b', fontSize: 12, fontWeight: 'bold' },
  classPillActiveText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  classPillP: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  classPillActiveP: { backgroundColor: '#8b5cf6', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  createTaskBtn: { backgroundColor: '#f1f5f9', padding: 10, borderRadius: 10, alignItems: 'center', marginBottom: 15 },
  createTaskBtnText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 12 },
  kanbanCol: { width: width * 0.75, marginRight: 15, backgroundColor: '#f8fafc', borderRadius: 16, padding: 10, height: '100%' },
  kanbanColHeader: { borderBottomWidth: 2, paddingBottom: 8, marginBottom: 10 },
  kanbanColTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  kanbanCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  kTaskTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  kTaskDeadline: { fontSize: 11, color: '#f59e0b', marginTop: 4 },
  kTaskAssignee: { fontSize: 12, color: '#64748b' },
  eqAvailBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  eqCondBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  eqCondText: { fontSize: 11, fontWeight: 'bold' },
  
  financeToggleRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 20, marginTop: 5 },
  financeToggleBtn: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 8 },
  financeToggleText: { fontWeight: 'bold', color: '#64748b' },
  financeCategoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  catPill: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', marginBottom: 5 },
  catPillActive: { backgroundColor: '#0f172a' },
  catPillText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' }
});