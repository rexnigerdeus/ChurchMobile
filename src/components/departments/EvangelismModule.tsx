// src/components/departments/EvangelismModule.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  TextInput, Modal, Linking, KeyboardAvoidingView, Platform, Image, Switch, ScrollView, Alert
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { pickImage, uploadToSupabase } from '../WebImagePicker';

interface EvangelismModuleProps {
  deptId: string;
  churchId: string;
  activeMembers: any[]; // Pour assigner le suivi à un membre
  isLeader: boolean;
}

export default function EvangelismModule({ deptId, churchId, activeMembers, isLeader }: EvangelismModuleProps) {
  const [soulsList, setSoulsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingSoul, setIsAddingSoul] = useState(false);
  const [isAssignDropdownOpen, setIsAssignDropdownOpen] = useState(false);

  const [newSoul, setNewSoul] = useState({ 
    id: '', first_name: '', last_name: '', phone: '', address: '', profession: '', assigned_to: '', photo_url: '', gender: 'Homme',
    is_baptized_candidate: false, regularity: 'Faible', observations: '', is_called: false, is_visited: false,
    integration_status: 'NONE', integration_notes: ''
  });

  useEffect(() => {
    loadSouls();
  }, [deptId]);

  async function loadSouls() {
    setLoading(true);
    const { data: soulsData, error } = await supabase
      .from('department_souls')
      .select('*')
      .eq('department_id', deptId)
      .order('created_at', { ascending: false });

    if (soulsData) {
      // On enrichit les données avec le nom du membre assigné au suivi
      const formattedSouls = soulsData.map(s => ({
        ...s,
        assigned_member: s.assigned_to 
          ? activeMembers.find(p => p.user_id === s.assigned_to)?.member.full_name 
          : null
      }));
      setSoulsList(formattedSouls);
    }
    setLoading(false);
  }

  const takePhoto = async () => {
    const picked = await pickImage({ source: 'camera', allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (picked?.uri) setNewSoul({ ...newSoul, photo_url: picked.uri });
  };

  const pickFromGallery = async () => {
    const picked = await pickImage({ source: 'gallery', allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (picked?.uri) setNewSoul({ ...newSoul, photo_url: picked.uri });
  };

  const handleAddSoul = async () => {
    if (!newSoul.first_name.trim() || !newSoul.last_name.trim()) {
      return Alert.alert("Erreur", "Le nom et prénom sont obligatoires.");
    }
    const resp = await supabase.auth.getUser();
    const user = resp?.data?.user;
    if (!user) {
      return Alert.alert('Erreur', 'Utilisateur non authentifié.');
    }

    const soulData = {
      department_id: deptId, 
      first_name: newSoul.first_name.trim(), 
      last_name: newSoul.last_name.trim(), 
      phone: newSoul.phone.trim() || null, 
      address: newSoul.address.trim() || null, 
      profession: newSoul.profession.trim() || null, 
      gender: newSoul.gender || null,
      assigned_to: newSoul.assigned_to || null, 
      photo_url: newSoul.photo_url || null,
      is_baptized_candidate: newSoul.is_baptized_candidate, 
      regularity: newSoul.regularity, 
      observations: newSoul.observations.trim() || null, 
      is_called: newSoul.is_called, 
      is_visited: newSoul.is_visited
    };

    try {
      if (newSoul.id) {
        const { error } = await supabase.from('department_souls').update(soulData).eq('id', newSoul.id);
        if (error) throw error;
        Alert.alert('Succès', 'Suivi mis à jour.');
      } else {
        const { error } = await supabase.from('department_souls').insert({ ...soulData, created_by: user.id });
        if (error) throw error;
        Alert.alert('Succès', 'Nouvelle âme enregistrée.');
      }
      setIsAddingSoul(false);
      setNewSoul({ id: '', first_name: '', last_name: '', phone: '', address: '', profession: '', assigned_to: '', photo_url: '', gender: 'Homme', is_baptized_candidate: false, regularity: 'Faible', observations: '', is_called: false, is_visited: false, integration_status: 'NONE', integration_notes: '' });
      loadSouls();
    } catch (err: any) {
      console.warn('Evangelism save error', err);
      Alert.alert('Erreur', err?.message || 'Impossible d\u2019enregistrer l\u2019âme.');
    }
  };

  const handleRequestIntegration = async (soul: any) => {
    Alert.alert(
      "Demande d'intégration",
      "Voulez-vous soumettre cette âme au pasteur pour qu'elle devienne un membre officiel de l'église ?",
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
            loadSouls();
          }
        }
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Suivi des Âmes</Text>
        <TouchableOpacity 
          style={styles.addBtn} 
          onPress={() => { 
            setNewSoul({ id: '', first_name: '', last_name: '', phone: '', address: '', profession: '', assigned_to: '', photo_url: '', gender: 'Homme', is_baptized_candidate: false, regularity: 'Faible', observations: '', is_called: false, is_visited: false, integration_status: 'NONE', integration_notes: '' }); 
            setIsAddingSoul(true); 
          }}
        >
          <Text style={styles.addBtnText}>+ Ajouter une âme</Text>
        </TouchableOpacity>
      </View>

      <FlatList 
        data={soulsList} 
        keyExtractor={item => item.id} 
        showsVerticalScrollIndicator={false} 
        ListEmptyComponent={<Text style={styles.emptyText}>Aucune âme enregistrée.</Text>} 
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              {item.photo_url ? (
                <Image source={{ uri: item.photo_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}><Text style={{fontSize: 24}}>👤</Text></View>
              )}
              <View style={styles.info}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                  <Text style={styles.name}>{item.first_name} {item.last_name}</Text>
                  <TouchableOpacity 
                    onPress={() => { setNewSoul({ ...item, gender: item.gender || 'Homme', phone: item.phone || '', address: item.address || '', profession: item.profession || '', assigned_to: item.assigned_to || '', photo_url: item.photo_url || '', regularity: item.regularity || 'Faible', observations: item.observations || '', integration_status: item.integration_status || 'NONE', integration_notes: item.integration_notes || '' }); setIsAddingSoul(true); }} 
                    style={styles.editBtn}
                  >
                    <Text style={styles.editBtnText}>✏️ Suivi</Text>
                  </TouchableOpacity>
                </View>
                
                {item.profession && <Text style={styles.detail}>💼 {item.profession}</Text>}
                {item.gender && <Text style={styles.detail}>⚧ {item.gender}</Text>}
                {item.address && <Text style={styles.detail}>📍 {item.address}</Text>}
                {item.phone && (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.phone}`)} style={{marginTop: 4}}>
                    <Text style={styles.phone}>📞 {item.phone}</Text>
                  </TouchableOpacity>
                )}
                
                {item.integration_status === 'PENDING' && (
                  <View style={styles.badgePending}><Text style={styles.badgePendingText}>⏳ En attente pasteur</Text></View>
                )}
                {item.integration_status === 'REJECTED' && (
                  <View style={styles.badgeRejected}><Text style={styles.badgeRejectedText}>❌ Intégration Refusée</Text></View>
                )}
                {item.integration_status === 'INTEGRATED' && (
                  <View style={styles.badgeSuccess}><Text style={styles.badgeSuccessText}>✅ Fidèle Officiel</Text></View>
                )}
              </View>
            </View>

            <View style={styles.badgesRow}>
              <View style={[styles.statusBadge, {backgroundColor: item.is_called ? '#dcfce3' : '#f1f5f9'}]}>
                <Text style={[styles.statusBadgeText, {color: item.is_called ? '#16a34a' : '#94a3b8'}]}>{item.is_called ? '📞 Appelé' : 'Non Appelé'}</Text>
              </View>
              <View style={[styles.statusBadge, {backgroundColor: item.is_visited ? '#dcfce3' : '#f1f5f9'}]}>
                <Text style={[styles.statusBadgeText, {color: item.is_visited ? '#16a34a' : '#94a3b8'}]}>{item.is_visited ? '🏠 Visité' : 'Non Visité'}</Text>
              </View>
              {item.is_baptized_candidate && (
                <View style={[styles.statusBadge, {backgroundColor: '#e0e7ff'}]}><Text style={[styles.statusBadgeText, {color: '#4f46e5'}]}>💧 Baptême</Text></View>
              )}
            </View>

            <View style={styles.cardBottom}>
              <Text style={styles.assignLabel}>Suivi assuré par :</Text>
              <Text style={[styles.assignText, {color: item.assigned_member ? '#0f172a' : '#ef4444'}]}>
                {item.assigned_member ? `👤 ${item.assigned_member}` : '⚠️ Non assigné'}
              </Text>
            </View>
          </View>
        )}
      />

      <Modal visible={isAddingSoul} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{newSoul.id ? 'Dossier de Suivi' : 'Enregistrer une âme'}</Text>
              <TouchableOpacity onPress={() => setIsAddingSoul(false)}><Text style={{fontSize: 24, color: '#64748b'}}>✕</Text></TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {newSoul.id && newSoul.integration_status === 'REJECTED' && (
                <View style={styles.alertBox}>
                  <Text style={styles.alertTitle}>❌ Intégration refusée par le pasteur</Text>
                  <Text style={styles.alertText}>{newSoul.integration_notes || 'Aucun motif précisé.'}</Text>
                </View>
              )}

              <View style={styles.photoContainer}>
                {newSoul.photo_url ? (
                  <Image source={{ uri: newSoul.photo_url }} style={styles.avatarLarge} />
                ) : (
                  <View style={styles.avatarLargePlaceholder}><Text style={{fontSize: 30}}>👤</Text></View>
                )}
                <View style={styles.photoBtnsRow}>
                  <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}><Text style={styles.photoBtnText}>📷 Caméra</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={pickFromGallery}><Text style={styles.photoBtnText}>🖼️ Galerie</Text></TouchableOpacity>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Identité de l'âme</Text>
              <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>Prénom *</Text>
                  <TextInput style={styles.input} value={newSoul.first_name} onChangeText={t => setNewSoul({...newSoul, first_name: t})} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>Nom *</Text>
                  <TextInput style={styles.input} value={newSoul.last_name} onChangeText={t => setNewSoul({...newSoul, last_name: t})} />
                </View>
              </View>

              <Text style={styles.inputLabel}>Téléphone</Text>
              <TextInput style={styles.input} keyboardType="phone-pad" value={newSoul.phone} onChangeText={t => setNewSoul({...newSoul, phone: t})} />
              
              <Text style={styles.inputLabel}>Adresse d'habitation</Text>
              <TextInput style={styles.input} value={newSoul.address} onChangeText={t => setNewSoul({...newSoul, address: t})} />

              <Text style={styles.inputLabel}>Genre de l'âme</Text>
              <View style={styles.toggleRow}> 
                {['Homme', 'Femme'].map((genderOption) => (
                  <TouchableOpacity
                    key={genderOption}
                    style={[styles.toggleBtn, newSoul.gender === genderOption && { backgroundColor: '#0f172a' }]}
                    onPress={() => setNewSoul({...newSoul, gender: genderOption})}
                  >
                    <Text style={[styles.toggleText, newSoul.gender === genderOption && { color: '#fff' }]}>{genderOption}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Profession / Études</Text>
              <TextInput style={styles.input} value={newSoul.profession} onChangeText={t => setNewSoul({...newSoul, profession: t})} />

              {/* 🔴 LE FAMEUX MENU DÉROULANT POUR ASSIGNER UN MEMBRE AU SUIVI */}
              <View style={{ zIndex: 10, marginTop: 10, marginBottom: 15 }}>
                <Text style={styles.inputLabel}>Assigner un membre pour le suivi</Text>
                <TouchableOpacity style={styles.dropdownSelector} onPress={() => setIsAssignDropdownOpen(!isAssignDropdownOpen)}>
                  <Text style={newSoul.assigned_to ? styles.dropdownTextSelected : styles.dropdownTextPlaceholder}>
                    {newSoul.assigned_to 
                      ? activeMembers.find(m => m.user_id === newSoul.assigned_to)?.member.full_name 
                      : "-- Choisir un membre --"}
                  </Text>
                  <Text style={{ color: '#94a3b8' }}>▼</Text>
                </TouchableOpacity>
                {isAssignDropdownOpen && (
                  <View style={styles.dropdownContainer}>
                    <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                      <TouchableOpacity style={styles.dropdownItem} onPress={() => { setNewSoul({...newSoul, assigned_to: ''}); setIsAssignDropdownOpen(false); }}>
                        <Text style={styles.dropdownItemText}>-- Personne --</Text>
                      </TouchableOpacity>
                      {activeMembers.map(m => (
                        <TouchableOpacity key={m.id} style={styles.dropdownItem} onPress={() => { setNewSoul({...newSoul, assigned_to: m.user_id}); setIsAssignDropdownOpen(false); }}>
                          <Text style={styles.dropdownItemText}>{m.member.full_name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {newSoul.id ? (
                <>
                  <Text style={[styles.sectionTitle, {marginTop: 10}]}>Journal de Suivi</Text>
                  
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Candidat au Baptême ?</Text>
                    <Switch value={newSoul.is_baptized_candidate} onValueChange={v => setNewSoul({...newSoul, is_baptized_candidate: v})} trackColor={{ true: '#4f46e5' }} />
                  </View>

                  <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15}}>
                    <View style={{alignItems: 'center'}}>
                      <Text style={{fontSize: 12, marginBottom: 5, fontWeight: 'bold', color: '#334155'}}>📞 Appelé ?</Text>
                      <Switch value={newSoul.is_called} onValueChange={v => setNewSoul({...newSoul, is_called: v})} trackColor={{ true: '#10b981' }} />
                    </View>
                    <View style={{alignItems: 'center'}}>
                      <Text style={{fontSize: 12, marginBottom: 5, fontWeight: 'bold', color: '#334155'}}>🏠 Visité ?</Text>
                      <Switch value={newSoul.is_visited} onValueChange={v => setNewSoul({...newSoul, is_visited: v})} trackColor={{ true: '#10b981' }} />
                    </View>
                  </View>

                  <Text style={styles.inputLabel}>Régularité aux cultes</Text>
                  <View style={styles.toggleRow}>
                    {['Faible', 'Moyenne', 'Bonne'].map(reg => (
                      <TouchableOpacity 
                        key={reg} 
                        style={[styles.toggleBtn, newSoul.regularity === reg && {backgroundColor: reg === 'Faible' ? '#ef4444' : reg === 'Moyenne' ? '#f59e0b' : '#10b981'}]} 
                        onPress={() => setNewSoul({...newSoul, regularity: reg})}
                      >
                        <Text style={[styles.toggleText, newSoul.regularity === reg && {color: '#fff'}]}>{reg}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Observations / Notes</Text>
                  <TextInput 
                    style={[styles.input, {height: 100, textAlignVertical: 'top'}]} 
                    multiline 
                    value={newSoul.observations} 
                    onChangeText={t => setNewSoul({...newSoul, observations: t})} 
                    placeholder="Saisissez les compte-rendus de visite ici..." 
                  />
                  
                  <View style={{marginTop: 30, marginBottom: 40, gap: 15}}>
                    <TouchableOpacity style={styles.submitBtn} onPress={handleAddSoul}>
                      <Text style={styles.submitBtnText}>Sauvegarder le Suivi</Text>
                    </TouchableOpacity>

                    {(newSoul.integration_status === 'NONE' || newSoul.integration_status === 'REJECTED' || !newSoul.integration_status) && (
                      <TouchableOpacity style={styles.integrateBtn} onPress={() => handleRequestIntegration(newSoul)}>
                        <Text style={styles.integrateBtnText}>Dossier mâture : Demander l'intégration ➔</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              ) : (
                <View style={{marginTop: 30, marginBottom: 40}}>
                  <TouchableOpacity style={styles.submitBtn} onPress={handleAddSoul}>
                    <Text style={styles.submitBtnText}>Enregistrer la nouvelle âme</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
  addBtn: { backgroundColor: '#f97316', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8', fontStyle: 'italic' },
  
  card: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#fed7aa', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', padding: 15, alignItems: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 30, marginRight: 15, backgroundColor: '#f1f5f9' },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, marginRight: 15, backgroundColor: '#ffedd5', justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  editBtn: { backgroundColor: '#fff7ed', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  editBtnText: { fontSize: 10, fontWeight: 'bold', color: '#f97316' },
  detail: { fontSize: 12, color: '#64748b', marginBottom: 2 },
  phone: { fontSize: 13, color: '#3b82f6', fontWeight: 'bold' },
  
  badgePending: { marginTop: 5, alignSelf: 'flex-start', backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgePendingText: { fontSize: 9, fontWeight: 'bold', color: '#d97706' },
  badgeRejected: { marginTop: 5, alignSelf: 'flex-start', backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeRejectedText: { fontSize: 9, fontWeight: 'bold', color: '#ef4444' },
  badgeSuccess: { marginTop: 5, alignSelf: 'flex-start', backgroundColor: '#dcfce3', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeSuccessText: { fontSize: 9, fontWeight: 'bold', color: '#16a34a' },

  badgesRow: { paddingHorizontal: 15, paddingBottom: 10, flexDirection: 'row', gap: 5 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: 'bold' },
  
  cardBottom: { backgroundColor: '#fff7ed', paddingHorizontal: 15, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assignLabel: { fontSize: 11, color: '#9a3412', fontWeight: 'bold', textTransform: 'uppercase' },
  assignText: { fontSize: 12, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 25, paddingBottom: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  
  alertBox: { backgroundColor: '#fee2e2', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#f87171' },
  alertTitle: { color: '#b91c1c', fontWeight: 'bold', fontSize: 13, marginBottom: 4 },
  alertText: { color: '#991b1b', fontSize: 12 },

  photoContainer: { alignItems: 'center', marginBottom: 20 },
  avatarLarge: { width: 80, height: 80, borderRadius: 40 },
  avatarLargePlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  photoBtnsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  photoBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  photoBtnText: { fontSize: 12, fontWeight: 'bold', color: '#475569' },

  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 10, marginTop: 10 },
  inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 15, height: 45, color: '#0f172a' },

  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 15, height: 45 },
  dropdownTextSelected: { color: '#0f172a', fontSize: 14 },
  dropdownTextPlaceholder: { color: '#94a3b8', fontSize: 14 },
  dropdownContainer: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, marginTop: 5, overflow: 'hidden', elevation: 2 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownItemText: { color: '#0f172a', fontSize: 14 },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, padding: 10, backgroundColor: '#f8fafc', borderRadius: 10 },
  switchLabel: { fontWeight: 'bold', color: '#0f172a' },

  toggleRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 15 },
  toggleBtn: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 8 },
  toggleText: { fontWeight: 'bold', color: '#64748b' },

  submitBtn: { backgroundColor: '#f97316', padding: 15, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  integrateBtn: { backgroundColor: '#0f172a', padding: 15, borderRadius: 12, alignItems: 'center' },
  integrateBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});