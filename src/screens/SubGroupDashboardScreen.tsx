// src/screens/SubGroupDashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, 
  ScrollView, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, Linking 
} from 'react-native';
import { supabase } from '../lib/supabase';
import DateTimePicker from '../components/WebDatePicker';

type ViewState = 'HUB' | 'MEMBERS' | 'SONGS' | 'FINANCES' | 'ANNOUNCEMENTS' | 'PLANNING';

export default function SubGroupDashboardScreen({ groupId, onBack }: { groupId: string, onBack: () => void }) {
  const [currentView, setCurrentView] = useState<ViewState>('HUB');
  const [loading, setLoading] = useState(true);
  const [isLeader, setIsLeader] = useState(false);
  
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [myTeam, setMyTeam] = useState<any[]>([]);
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);

  // États Chants
  const [songs, setSongs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingSong, setIsAddingSong] = useState(false);
  const [newSong, setNewSong] = useState({ title: '', key: '', url: '' });

  // États Finances
  const [finances, setFinances] = useState<any[]>([]);
  const [isAddingFinance, setIsAddingFinance] = useState(false);
  const [newFinance, setNewFinance] = useState({ type: 'INCOME', category: 'Cotisation', amount: '', motif: '', member_id: '' });
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);

  // États Planning
  const [plannings, setPlannings] = useState<any[]>([]);
  const [churchPrograms, setChurchPrograms] = useState<any[]>([]);
  const [isAddingPlanning, setIsAddingPlanning] = useState(false);
  const [selectedChurchProgram, setSelectedChurchProgram] = useState<any>(null);
  const [dateObj, setDateObj] = useState<Date | undefined>(undefined);
  const [newPlanning, setNewPlanning] = useState({ title: '', date: '', time: '' });

  // États Annonces
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isAddingAnnouncement, setIsAddingAnnouncement] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });

  useEffect(() => {
    if (groupId) {
      loadGroupData();
    }
  }, [groupId]);

  async function loadGroupData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    try {
      const { data: group } = await supabase.from('department_groups').select('*').eq('id', groupId).single();
      
      if (group) {
        setIsLeader(group.leader_id === user?.id);
        
        let deptName = 'Département';
        const { data: dept } = await supabase.from('church_departments').select('name, custom_name, church_id').eq('id', group.department_id).single();
        if (dept) deptName = dept.custom_name || dept.name;

        setGroupInfo({ ...group, departmentName: deptName, church_id: dept?.church_id });

        // 1. Membres
        const { data: deptMembers } = await supabase.from('department_members').select('*').eq('department_id', group.department_id).eq('status', 'APPROVED');
        if (deptMembers) {
          const userIds = deptMembers.map(m => m.user_id);
          const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds);
          const formatted = deptMembers.map(m => ({ 
            ...m, 
            member: { full_name: profiles?.find(p => p.id === m.user_id)?.full_name || 'Fidèle' } 
          }));
          setMyTeam(formatted.filter(m => m.sub_group_id === groupId));
          setAvailableMembers(formatted.filter(m => m.sub_group_id !== groupId));
        }

        // 2. Chants (Groupe + Département)
        const { data: songsData } = await supabase.from('department_songs')
          .select('*')
          .or(`group_id.eq.${groupId},and(department_id.eq.${group.department_id},group_id.is.null)`)
          .order('title', { ascending: true });
        setSongs(songsData || []);

        // 3. Finances (Uniquement le groupe)
        const { data: rawFinances } = await supabase.from('department_finances')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false });
          
        if (rawFinances) {
          const payerIds = rawFinances.map(f => f.member_id).filter(id => id);
          const { data: profs } = await supabase.from('user_profiles').select('id, full_name').in('id', payerIds);
          setFinances(rawFinances.map(fin => ({ 
            ...fin, 
            member: fin.member_id ? { full_name: profs?.find(p => p.id === fin.member_id)?.full_name || 'Inconnu' } : null 
          })));
        }

        // 4. Planning (Groupe + Département pour tous)
        const { data: rawPlannings } = await supabase.from('department_plannings')
          .select('*')
          .or(`group_id.eq.${groupId},and(department_id.eq.${group.department_id},concerns_all.eq.true)`)
          .order('event_date', { ascending: true });
        setPlannings(rawPlannings || []);

        if (dept?.church_id) {
          const { data: cPrograms } = await supabase.from('church_programs').select('*').eq('church_id', dept.church_id);
          setChurchPrograms((cPrograms || []).filter(cp => !rawPlannings?.some(rp => rp.church_program_id === cp.id)));
        }

        // 5. Annonces
        const { data: rawAnns } = await supabase.from('department_announcements')
          .select('*')
          .or(`group_id.eq.${groupId},and(department_id.eq.${group.department_id},concerns_all.eq.true)`)
          .order('created_at', { ascending: false });
        setAnnouncements(rawAnns || []);
      }
    } catch (err) { 
      console.log("Erreur lors du chargement des données du sous-groupe:", err); 
    }
    setLoading(false);
  }

  // --- ACTIONS ---

  const handleToggleMember = async (memberId: string, currentGroupId: string | null) => {
    const { error } = await supabase.from('department_members')
      .update({ sub_group_id: currentGroupId === groupId ? null : groupId })
      .eq('id', memberId);
    if (error) Alert.alert("Erreur", error.message); 
    else loadGroupData(); 
  };

  const handleAddSong = async () => {
    if (!newSong.title.trim()) return Alert.alert("Erreur", "Le titre est obligatoire.");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('department_songs').insert({ 
      department_id: groupInfo.department_id, 
      group_id: groupId, 
      title: newSong.title.trim(), 
      musical_key: newSong.key.trim() || null, 
      video_url: newSong.url.trim() || null, 
      created_by: user?.id 
    });
    if (error) Alert.alert('Erreur', error.message);
    else { setIsAddingSong(false); setNewSong({ title: '', key: '', url: '' }); loadGroupData(); }
  };

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) return Alert.alert("Erreur", "Sujet et message obligatoires.");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('department_announcements').insert({ 
      department_id: groupInfo.department_id, 
      group_id: groupId, 
      title: newAnnouncement.title, 
      content: newAnnouncement.content, 
      concerns_all: false, 
      created_by: user?.id 
    });
    if (error) Alert.alert('Erreur', error.message);
    else { setIsAddingAnnouncement(false); setNewAnnouncement({ title: '', content: '' }); loadGroupData(); }
  };

  const handleAddPlanning = async (isChurch: boolean, churchProg?: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    let eventDateStr = '';
    
    if (isChurch && churchProg) {
      eventDateStr = churchProg.date || churchProg.created_at;
    } else {
      if (!newPlanning.title || !newPlanning.date || !newPlanning.time) return Alert.alert("Erreur", "Toutes les infos sont requises.");
      const dateObjParsed = new Date(`${newPlanning.date}T${newPlanning.time}:00`);
      if (isNaN(dateObjParsed.getTime())) return Alert.alert("Erreur", "Date invalide.");
      eventDateStr = dateObjParsed.toISOString();
    }

    const { error } = await supabase.from('department_plannings').insert({ 
        department_id: groupInfo.department_id, 
        group_id: groupId, 
        title: isChurch ? churchProg.title : newPlanning.title, 
        event_date: eventDateStr, 
        is_church_event: isChurch, 
        concerns_all: false, 
        created_by: user?.id,
        church_program_id: isChurch ? churchProg.id : null
    });

    if (error) Alert.alert('Erreur', error.message);
    else { setIsAddingPlanning(false); setSelectedChurchProgram(null); setNewPlanning({ title: '', date: '', time: '' }); loadGroupData(); }
  };

  const handleAddFinance = async () => {
    if (!newFinance.amount || isNaN(Number(newFinance.amount))) return Alert.alert("Erreur", "Montant invalide.");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('department_finances').insert({ 
      department_id: groupInfo.department_id, 
      group_id: groupId, 
      type: newFinance.type, 
      category: newFinance.type === 'INCOME' ? newFinance.category : 'Dépense', 
      amount: Number(newFinance.amount), 
      motif: newFinance.motif.trim() || null, 
      member_id: newFinance.member_id || null, 
      created_by: user?.id 
    });
    
    if (error) Alert.alert('Erreur', error.message);
    else { setIsAddingFinance(false); setNewFinance({ type: 'INCOME', category: 'Cotisation', amount: '', motif: '', member_id: '' }); loadGroupData(); }
  };

  // Variables calculées
  const filteredSongs = songs.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || (s.musical_key && s.musical_key.toLowerCase().includes(searchQuery.toLowerCase())));
  const balance = finances.reduce((acc, curr) => curr.type === 'INCOME' ? acc + (Number(curr.amount) || 0) : acc - (Number(curr.amount) || 0), 0);

  // --- VUES DU HUB ---

  const HubMenu = () => (
    <ScrollView contentContainerStyle={styles.hubGrid} showsVerticalScrollIndicator={false}>
      
      {/* 🔴 Cacher la section Membres et Finances si ce n'est pas le leader */}
      {isLeader && (
        <>
          <Text style={styles.hubSubtitle}>Gestion du Groupe ({groupInfo?.name})</Text>
          <View style={styles.row}>
            <HubCard title="Membres & Recrutement" count={myTeam.length} icon="👥" color="#3b82f6" onPress={() => setCurrentView('MEMBERS')} />
            <HubCard title="Caisse du Groupe" count={finances.length} icon="💰" color="#10b981" onPress={() => setCurrentView('FINANCES')} />
          </View>
        </>
      )}

      {/* Le titre s'adapte si l'utilisateur est un simple membre (il affiche le nom du groupe ici) */}
      <Text style={styles.hubSubtitle}>Vie du groupe { !isLeader ? `(${groupInfo?.name})` : '' }</Text>
      <View style={styles.row}>
        <HubCard title="Répertoire" count={songs.length} icon="🎵" color="#8b5cf6" onPress={() => setCurrentView('SONGS')} />
        <HubCard title="Annonces" count={announcements.length} icon="📢" color="#ec4899" onPress={() => setCurrentView('ANNOUNCEMENTS')} />
      </View>
      <View style={styles.row}>
        <HubCard title="Planning" count={plannings.length} icon="📅" color="#06b6d4" onPress={() => setCurrentView('PLANNING')} />
        <View style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* HEADER DYNAMIQUE */}
      <View style={styles.header}>
        <TouchableOpacity onPress={currentView === 'HUB' ? onBack : () => setCurrentView('HUB')}>
          <Text style={styles.backBtn}>⬅ {currentView === 'HUB' ? 'Accueil' : 'Retour'}</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{groupInfo?.name || 'Groupe...'}</Text>
          <Text style={{ fontSize: 10, color: '#64748b' }}>{groupInfo?.departmentName}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>
      ) : (
        <View style={{ flex: 1 }}>
          {currentView === 'HUB' && <HubMenu />}

          {/* VUE MEMBRES (Uniquement accessible pour le leader via le HubMenu, mais on la garde protégée par isLeader au cas où) */}
          {currentView === 'MEMBERS' && isLeader && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>👑 Mon Équipe ({myTeam.length})</Text>
              </View>
              
              {myTeam.length === 0 ? (
                <Text style={styles.emptyText}>Aucun membre dans le groupe.</Text>
              ) : (
                myTeam.map(item => (
                  <View key={item.id} style={styles.memberCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{item.member.full_name}</Text>
                      <Text style={{ fontSize: 11, color: '#10b981', fontWeight: 'bold' }}>Dans votre groupe</Text>
                    </View>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => handleToggleMember(item.id, item.sub_group_id)}>
                      <Text style={styles.removeBtnText}>Retirer</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <View style={[styles.sectionHeader, { marginTop: 30 }]}>
                <Text style={styles.sectionHeaderText}>🔍 Recruter dans le département</Text>
              </View>
              {availableMembers.map(item => (
                <View key={item.id} style={[styles.memberCard, { backgroundColor: '#f8fafc' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{item.member.full_name}</Text>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>{item.sub_group_id ? "Dans un autre groupe" : "Sans groupe"}</Text>
                  </View>
                  <TouchableOpacity style={styles.addBtn} onPress={() => handleToggleMember(item.id, item.sub_group_id)}>
                    <Text style={styles.addBtnText}>+ Ajouter</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}

          {/* VUE FINANCES (Uniquement accessible pour le leader) */}
          {currentView === 'FINANCES' && isLeader && (
            <View style={{ flex: 1 }}>
              <View style={[styles.balanceCard, { backgroundColor: balance >= 0 ? '#0f172a' : '#ef4444' }]}>
                <Text style={styles.balanceLabel}>Caisse du Groupe</Text>
                <Text style={styles.balanceAmount}>{balance.toLocaleString('fr-FR')} FCFA</Text>
              </View>
              
              <View style={styles.financeHeader}>
                <Text style={styles.hubSubtitle}>Transactions</Text>
                <TouchableOpacity style={styles.addFinanceBtn} onPress={() => setIsAddingFinance(true)}>
                  <Text style={styles.addFinanceBtnText}>+ Opération</Text>
                </TouchableOpacity>
              </View>
              
              <FlatList 
                data={finances} 
                keyExtractor={item => item.id} 
                ListEmptyComponent={<Text style={styles.emptyText}>Aucune transaction enregistrée.</Text>}
                renderItem={({ item }) => (
                  <View style={styles.financeCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.financeCategory}>{item.category}</Text>
                      <Text style={styles.financeMember}>{item.member?.full_name || 'Anonyme'}</Text>
                    </View>
                    <Text style={[styles.financeAmount, { color: item.type === 'INCOME' ? '#10b981' : '#ef4444' }]}>
                      {item.type === 'INCOME' ? '+' : '-'}{item.amount}
                    </Text>
                  </View>
                )}
              />
            </View>
          )}

          {/* VUE CHANTS (Accessible à tous) */}
          {currentView === 'SONGS' && (
            <View style={{ flex: 1 }}>
              <View style={styles.songHeader}>
                <TextInput style={styles.searchInput} placeholder="Rechercher..." value={searchQuery} onChangeText={setSearchQuery} />
                <TouchableOpacity style={styles.addSongBtn} onPress={() => setIsAddingSong(true)}>
                  <Text style={styles.addSongBtnText}>+ Chant</Text>
                </TouchableOpacity>
              </View>
              <FlatList 
                data={filteredSongs} 
                keyExtractor={item => item.id} 
                ListEmptyComponent={<Text style={styles.emptyText}>Aucun chant trouvé.</Text>}
                renderItem={({ item }) => (
                  <View style={styles.songCard}>
                    <View style={{flex: 1}}>
                      <Text style={styles.songTitle}>{item.title}</Text>
                      <View style={styles.keyBadge}>
                        <Text style={styles.keyBadgeText}>{item.musical_key || 'N/A'}</Text>
                      </View>
                    </View>
                    {item.video_url && (
                      <TouchableOpacity style={styles.playBtn} onPress={() => openVideo(item.video_url)}>
                        <Text style={styles.playBtnText}>▶️ Écouter</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              />
            </View>
          )}

          {/* VUE ANNONCES (Lecture seule pour membre simple, ajout pour leader) */}
          {currentView === 'ANNOUNCEMENTS' && (
            <View style={{ flex: 1 }}>
              <View style={styles.financeHeader}>
                <Text style={styles.hubSubtitle}>Communiqués</Text>
                {isLeader && (
                  <TouchableOpacity style={[styles.addFinanceBtn, {backgroundColor: '#ec4899'}]} onPress={() => setIsAddingAnnouncement(true)}>
                    <Text style={styles.addFinanceBtnText}>+ Publier</Text>
                  </TouchableOpacity>
                )}
              </View>
              <FlatList 
                data={announcements} 
                keyExtractor={item => item.id} 
                ListEmptyComponent={<Text style={styles.emptyText}>Aucune annonce.</Text>}
                renderItem={({ item }) => (
                  <View style={styles.announcementCard}>
                    <Text style={styles.announcementTitle}>{item.title}</Text>
                    <Text style={styles.announcementBody}>{item.content}</Text>
                    <Text style={styles.announcementTarget}>{item.group_id ? "Pour le groupe" : "Département (Global)"}</Text>
                  </View>
                )}
              />
            </View>
          )}

          {/* VUE PLANNING (Lecture seule pour membre simple, ajout pour leader) */}
          {currentView === 'PLANNING' && (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <View style={styles.financeHeader}>
                <Text style={styles.hubSubtitle}>Agenda</Text>
                {isLeader && (
                  <TouchableOpacity style={[styles.addFinanceBtn, {backgroundColor: '#06b6d4'}]} onPress={() => setIsAddingPlanning(true)}>
                    <Text style={styles.addFinanceBtnText}>+ Événement</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isLeader && churchPrograms.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 10 }}>⛪ Événements Église Disponibles</Text>
                  {churchPrograms.map(cp => (
                    <TouchableOpacity key={cp.id} style={styles.churchProgCard} onPress={() => { setSelectedChurchProgram(cp); handleAddPlanning(true, cp); }}>
                      <Text style={{color: '#4f46e5', fontWeight: 'bold'}}>{cp.title}</Text>
                      <Text style={{fontSize: 10, color: '#64748b'}}>Cliquez pour y faire participer votre groupe</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 10 }}>📅 Vos Événements</Text>
              {plannings.length === 0 ? <Text style={styles.emptyText}>Rien de prévu.</Text> : (
                plannings.map(item => (
                  <View key={item.id} style={styles.planningCard}>
                    <Text style={styles.planningTitle}>{item.title}</Text>
                    <Text style={styles.planningTime}>{new Date(item.event_date).toLocaleString('fr-FR')}</Text>
                    <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                      {item.group_id ? "Organisé par votre groupe" : "Événement global (Département)"}
                    </Text>
                  </View>
                ))
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </View>
      )}

      {/* --- MODALES --- */}

      {/* Modale Finance */}
      <Modal visible={isAddingFinance} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContentBottom}>
            <Text style={styles.modalTitle}>Nouvelle transaction</Text>
            
            <View style={styles.financeToggleRow}>
              <TouchableOpacity style={[styles.financeToggleBtn, newFinance.type === 'INCOME' && styles.financeToggleActiveIn]} onPress={() => setNewFinance({...newFinance, type: 'INCOME'})}>
                <Text style={[styles.financeToggleText, newFinance.type === 'INCOME' && { color: '#fff' }]}>📥 Entrée</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.financeToggleBtn, newFinance.type === 'EXPENSE' && styles.financeToggleActiveOut]} onPress={() => setNewFinance({...newFinance, type: 'EXPENSE'})}>
                <Text style={[styles.financeToggleText, newFinance.type === 'EXPENSE' && { color: '#fff' }]}>💸 Sortie</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Montant (FCFA) *</Text>
            <TextInput style={styles.formInput} keyboardType="numeric" placeholder="Ex: 2000" onChangeText={t => setNewFinance({...newFinance, amount: t})} />
            
            <Text style={styles.inputLabel}>Motif / Description</Text>
            <TextInput style={styles.formInput} placeholder="Ex: Achat pupitre" onChangeText={t => setNewFinance({...newFinance, motif: t})} />

            {newFinance.type === 'INCOME' && (
              <View style={{ zIndex: 10 }}>
                <Text style={styles.inputLabel}>Payé par (Optionnel)</Text>
                <TouchableOpacity style={styles.dropdownSelector} onPress={() => setIsMemberDropdownOpen(!isMemberDropdownOpen)}>
                  <Text style={newFinance.member_id ? styles.dropdownTextSelected : styles.dropdownTextPlaceholder}>
                    {newFinance.member_id ? myTeam.find(m => m.user_id === newFinance.member_id)?.member.full_name : "-- Sélectionner un membre --"}
                  </Text>
                  <Text style={{ color: '#94a3b8' }}>▼</Text>
                </TouchableOpacity>
                {isMemberDropdownOpen && (
                  <View style={styles.dropdownContainer}>
                    <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                      <TouchableOpacity style={styles.dropdownItem} onPress={() => { setNewFinance({...newFinance, member_id: ''}); setIsMemberDropdownOpen(false); }}>
                        <Text style={styles.dropdownItemText}>-- Anonyme --</Text>
                      </TouchableOpacity>
                      {myTeam.map(m => (
                        <TouchableOpacity key={m.id} style={styles.dropdownItem} onPress={() => { setNewFinance({...newFinance, member_id: m.user_id}); setIsMemberDropdownOpen(false); }}>
                          <Text style={styles.dropdownItemText}>{m.member.full_name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setIsAddingFinance(false)}><Text style={styles.modalBtnCancelText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSubmit} onPress={handleAddFinance}><Text style={styles.modalBtnSubmitText}>Valider</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modale Chant */}
      <Modal visible={isAddingSong} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContentBottom}>
            <Text style={styles.modalTitle}>Nouveau Chant</Text>
            <Text style={styles.inputLabel}>Titre *</Text>
            <TextInput style={styles.formInput} placeholder="Ex: Hosanna" onChangeText={t => setNewSong({...newSong, title: t})} />
            <Text style={styles.inputLabel}>Gamme</Text>
            <TextInput style={styles.formInput} placeholder="Ex: Do Majeur" onChangeText={t => setNewSong({...newSong, key: t})} />
            <Text style={styles.inputLabel}>Lien YouTube</Text>
            <TextInput style={styles.formInput} placeholder="https://youtube.com/..." autoCapitalize="none" onChangeText={t => setNewSong({...newSong, url: t})} />
            
            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setIsAddingSong(false)}><Text style={styles.modalBtnCancelText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnSubmit, { backgroundColor: '#8b5cf6' }]} onPress={handleAddSong}><Text style={styles.modalBtnSubmitText}>Ajouter</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modale Annonce */}
      <Modal visible={isAddingAnnouncement} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContentBottom}>
            <Text style={styles.modalTitle}>Communiqué au groupe</Text>
            <Text style={styles.inputLabel}>Sujet *</Text>
            <TextInput style={styles.formInput} placeholder="Ex: Réunion" onChangeText={t => setNewAnnouncement({...newAnnouncement, title: t})} />
            <Text style={styles.inputLabel}>Message *</Text>
            <TextInput style={[styles.formInput, {height: 80, textAlignVertical: 'top'}]} placeholder="Détails..." multiline onChangeText={t => setNewAnnouncement({...newAnnouncement, content: t})} />
            
            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setIsAddingAnnouncement(false)}><Text style={styles.modalBtnCancelText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnSubmit, { backgroundColor: '#ec4899' }]} onPress={handleAddAnnouncement}><Text style={styles.modalBtnSubmitText}>Publier</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modale Planning */}
      <Modal visible={isAddingPlanning} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlayBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContentBottom}>
            <Text style={styles.modalTitle}>Créer un Événement Interne</Text>
            <Text style={styles.inputLabel}>Titre *</Text>
            <TextInput style={styles.formInput} placeholder="Ex: Répétition" onChangeText={t => setNewPlanning({...newPlanning, title: t})} />
            
            <View style={{flexDirection: 'row', gap: 10}}>
              <View style={{flex: 1}}>
                <Text style={styles.inputLabel}>Date *</Text>
                <DateTimePicker
                  value={dateObj}
                  mode="date"
                  style={styles.formInput}
                  placeholder="Sélectionner la date"
                  onChange={(e, date) => {
                    if (date) {
                      setDateObj(date);
                      setNewPlanning({...newPlanning, date: date.toISOString().split('T')[0]});
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
                  onChange={(e, date) => {
                    if (date) {
                      setDateObj(date);
                      setNewPlanning({...newPlanning, time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`});
                    }
                  }}
                />
              </View>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setIsAddingPlanning(false)}><Text style={styles.modalBtnCancelText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnSubmit, { backgroundColor: '#06b6d4' }]} onPress={() => handleAddPlanning(false)}><Text style={styles.modalBtnSubmitText}>Programmer</Text></TouchableOpacity>
            </View>
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
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  backBtn: { color: '#64748b', fontWeight: 'bold', width: 60 },
  hubSubtitle: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 15, marginTop: 10 },
  hubGrid: { paddingBottom: 30 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  card: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 20, elevation: 2, alignItems: 'center', height: 130, justifyContent: 'space-between' },
  cardTitle: { fontSize: 12, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },
  countBadge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10 },
  countText: { color: '#fff', fontWeight: 'bold', fontSize: 11 },
  
  sectionHeader: { backgroundColor: '#e2e8f0', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 15 },
  sectionHeaderText: { fontSize: 12, fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' },
  memberCard: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  memberName: { fontWeight: 'bold', fontSize: 14, color: '#0f172a' },
  addBtn: { backgroundColor: '#eff6ff', padding: 8, borderRadius: 8 },
  addBtnText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 11 },
  removeBtn: { backgroundColor: '#fef2f2', padding: 8, borderRadius: 8 },
  removeBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 11 },
  emptyText: { textAlign: 'center', marginTop: 20, color: '#94a3b8', fontStyle: 'italic' },

  balanceCard: { padding: 20, borderRadius: 20, alignItems: 'center', marginBottom: 20 },
  balanceLabel: { color: '#cbd5e1', fontSize: 12 },
  balanceAmount: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  financeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addFinanceBtn: { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addFinanceBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  financeCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  financeCategory: { fontWeight: 'bold', fontSize: 14, color: '#0f172a' },
  financeMember: { fontSize: 12, color: '#64748b' },
  financeAmount: { fontWeight: 'bold', fontSize: 16 },

  songHeader: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  searchInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 15, height: 45 },
  addSongBtn: { backgroundColor: '#8b5cf6', paddingHorizontal: 15, justifyContent: 'center', borderRadius: 12, height: 45 },
  addSongBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  songCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e2e8f0' },
  songTitle: { fontWeight: 'bold', fontSize: 15, color: '#0f172a' },
  keyBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginTop: 4 },
  keyBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
  playBtn: { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  playBtnText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 12 },

  announcementCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#ec4899', elevation: 1 },
  announcementTitle: { fontWeight: 'bold', fontSize: 15, color: '#0f172a', marginBottom: 5 },
  announcementBody: { fontSize: 13, color: '#475569', lineHeight: 20 },
  announcementTarget: { fontSize: 10, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' },

  planningCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  planningTitle: { fontWeight: 'bold', fontSize: 15, color: '#0f172a' },
  planningTime: { fontSize: 12, color: '#4f46e5', fontWeight: '600', marginTop: 4 },
  churchProgCard: { backgroundColor: '#eef2ff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#c7d2fe' },

  financeToggleRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 20 },
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

  modalOverlayBottom: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalContentBottom: { backgroundColor: '#fff', padding: 25, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 5, marginTop: 10 },
  formInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 15, height: 45, color: '#0f172a', justifyContent: 'center' },
  modalActionsRow: { flexDirection: 'row', gap: 10, marginTop: 30 },
  modalBtnCancel: { flex: 1, backgroundColor: '#f1f5f9', padding: 15, borderRadius: 12, alignItems: 'center' },
  modalBtnCancelText: { color: '#64748b', fontWeight: 'bold', fontSize: 14 },
  modalBtnSubmit: { flex: 1, backgroundColor: '#3b82f6', padding: 15, borderRadius: 12, alignItems: 'center' },
  modalBtnSubmitText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});