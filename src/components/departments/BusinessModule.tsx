// src/components/departments/BusinessModule.tsx
// Module dédié au Département des Hommes d'Affaires
// Réseau professionnel, entrepreneuriat et développement des compétences
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { supabase } from '../../lib/supabase';

interface BusinessModuleProps {
  deptId: string;
  isLeader: boolean;
}

const BUSINESS_TYPES: Record<string, string> = {
  BUSINESS: 'Entreprise', FREELANCE: 'Freelance', EMPLOYEE: 'Salarié', ENTREPRENEUR: 'Entrepreneur', INVESTOR: 'Investisseur',
};

export default function BusinessModule({ deptId, isLeader }: BusinessModuleProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [newMember, setNewMember] = useState({
    full_name: '', business_name: '', business_sector: '', business_type: 'BUSINESS',
    phone: '', email: '', address: '', needs: '', can_offer: '', mentorship_available: false,
  });

  useEffect(() => { loadMembers(); }, [deptId]);

  async function loadMembers() {
    setLoading(true);
    const { data, error } = await supabase
      .from('department_business_members')
      .select('*')
      .eq('department_id', deptId)
      .order('created_at', { ascending: false });
    if (error) console.warn('[BusinessModule] load error:', error.message);
    setMembers(data || []);
    setLoading(false);
  }

  const handleAdd = async () => {
    if (!newMember.full_name.trim())
      return Alert.alert('Erreur', 'Le nom est obligatoire.');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('department_business_members').insert({
      department_id: deptId,
      full_name: newMember.full_name.trim(),
      business_name: newMember.business_name.trim() || null,
      business_sector: newMember.business_sector.trim() || null,
      business_type: newMember.business_type,
      phone: newMember.phone.trim() || null,
      email: newMember.email.trim() || null,
      address: newMember.address.trim() || null,
      needs: newMember.needs.trim() || null,
      can_offer: newMember.can_offer.trim() || null,
      mentorship_available: newMember.mentorship_available,
      created_by: user?.id,
    });
    if (error) return Alert.alert('Erreur', error.message);
    setIsAdding(false);
    setNewMember({ full_name: '', business_name: '', business_sector: '', business_type: 'BUSINESS', phone: '', email: '', address: '', needs: '', can_offer: '', mentorship_available: false });
    loadMembers();
  };

  const handleDelete = (m: any) => {
    if (!isLeader) return;
    Alert.alert('Supprimer', `Supprimer ${m.full_name} du réseau ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('department_business_members').delete().eq('id', m.id);
        loadMembers();
      }},
    ]);
  };

  const toggleMentorship = async (m: any) => {
    if (!isLeader) return;
    await supabase.from('department_business_members').update({ mentorship_available: !m.mentorship_available }).eq('id', m.id);
    loadMembers();
  };

  const filtered = filter === 'ALL' ? members : members.filter(m => m.business_type === filter);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#f59e0b" /></View>;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.hubSubtitle}>Réseau Professionnel</Text>
        {isLeader && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setIsAdding(true)}>
            <Text style={styles.addBtnText}>+ Membre</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <TouchableOpacity style={filter === 'ALL' ? styles.pillActive : styles.pill} onPress={() => setFilter('ALL')}>
          <Text style={filter === 'ALL' ? styles.pillActiveText : styles.pillText}>Tous ({members.length})</Text>
        </TouchableOpacity>
        {Object.entries(BUSINESS_TYPES).map(([key, label]) => {
          const count = members.filter(m => m.business_type === key).length;
          return (
            <TouchableOpacity key={key} style={filter === key ? styles.pillActive : styles.pill} onPress={() => setFilter(key)}>
              <Text style={filter === key ? styles.pillActiveText : styles.pillText}>{label} ({count})</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucun membre du réseau enregistré.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.cardName}>{item.full_name}</Text>
                  {item.mentorship_available && <Text style={styles.mentorBadge}>🎓 Mentor</Text>}
                </View>
                <View style={[styles.typeBadge, { backgroundColor: '#fef3c7' }]}>
                  <Text style={[styles.typeText, { color: '#d97706' }]}>{BUSINESS_TYPES[item.business_type] || item.business_type}</Text>
                </View>
                {item.business_name && <Text style={styles.cardInfo}>🏢 {item.business_name}</Text>}
                {item.business_sector && <Text style={styles.cardInfo}>📊 {item.business_sector}</Text>}
                {item.phone && <Text style={styles.cardInfo}>📞 {item.phone}</Text>}
                {item.email && <Text style={styles.cardInfo}>✉️ {item.email}</Text>}
                {item.can_offer && <Text style={styles.offerText}>✅ Peut offrir: {item.can_offer}</Text>}
                {item.needs && <Text style={styles.needText}>🔍 Recherche: {item.needs}</Text>}
              </View>
              <View style={{ gap: 6 }}>
                {isLeader && (
                  <TouchableOpacity
                    style={[styles.mentorBtn, item.mentorship_available && { backgroundColor: '#dcfce7' }]}
                    onPress={() => toggleMentorship(item)}
                  >
                    <Text style={[styles.mentorBtnText, item.mentorship_available && { color: '#16a34a' }]}>
                      {item.mentorship_available ? '✅ Mentor' : '🎓 Mentor?'}
                    </Text>
                  </TouchableOpacity>
                )}
                {isLeader && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
      />

      <Modal visible={isAdding} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
              <Text style={styles.modalTitle}>Nouveau Membre du Réseau</Text>
              <TextInput style={styles.input} placeholder="Nom complet *" value={newMember.full_name} onChangeText={v => setNewMember({ ...newMember, full_name: v })} />
              <TextInput style={styles.input} placeholder="Nom de l'entreprise / activité" value={newMember.business_name} onChangeText={v => setNewMember({ ...newMember, business_name: v })} />
              <TextInput style={styles.input} placeholder="Secteur d'activité (ex: BTP, Tech...)" value={newMember.business_sector} onChangeText={v => setNewMember({ ...newMember, business_sector: v })} />
              <Text style={styles.label}>Type d'activité</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {Object.entries(BUSINESS_TYPES).map(([key, label]) => (
                  <TouchableOpacity key={key} style={[styles.statusOption, newMember.business_type === key && { backgroundColor: '#f59e0b' }]} onPress={() => setNewMember({ ...newMember, business_type: key })}>
                    <Text style={[styles.statusOptionText, newMember.business_type === key && { color: '#fff' }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Téléphone" value={newMember.phone} onChangeText={v => setNewMember({ ...newMember, phone: v })} keyboardType="phone-pad" />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Email" value={newMember.email} onChangeText={v => setNewMember({ ...newMember, email: v })} keyboardType="email-address" />
              </View>
              <TextInput style={styles.input} placeholder="Adresse" value={newMember.address} onChangeText={v => setNewMember({ ...newMember, address: v })} />
              <TextInput style={[styles.input, { height: 70 }]} placeholder="Peut offrir (compétences, services...)" value={newMember.can_offer} onChangeText={v => setNewMember({ ...newMember, can_offer: v })} multiline textAlignVertical="top" />
              <TextInput style={[styles.input, { height: 70 }]} placeholder="Recherche (besoins, partenariats...)" value={newMember.needs} onChangeText={v => setNewMember({ ...newMember, needs: v })} multiline textAlignVertical="top" />
              <TouchableOpacity
                style={[styles.toggleBtn, newMember.mentorship_available && { backgroundColor: '#16a34a' }]}
                onPress={() => setNewMember({ ...newMember, mentorship_available: !newMember.mentorship_available })}
              >
                <Text style={[styles.toggleText, newMember.mentorship_available && { color: '#fff' }]}>
                  {newMember.mentorship_available ? '✅ Disponible pour mentorat' : '🎓 Disponible pour mentorat ?'}
                </Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAdding(false)}>
                  <Text style={styles.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleAdd}>
                  <Text style={styles.confirmBtnText}>Enregistrer</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  hubSubtitle: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15, marginTop: 10 },
  addBtn: { backgroundColor: '#f59e0b', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  filterRow: { paddingHorizontal: 20, marginBottom: 12, paddingBottom: 5 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8 },
  pillActive: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f59e0b', marginRight: 8 },
  pillText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  pillActiveText: { fontSize: 12, color: '#fff', fontWeight: 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginHorizontal: 20, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardName: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  mentorBadge: { backgroundColor: '#dcfce7', color: '#16a34a', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4, marginBottom: 4, overflow: 'hidden' },
  typeText: { fontSize: 11, fontWeight: 'bold' },
  cardInfo: { fontSize: 13, color: '#475569', marginTop: 3 },
  offerText: { fontSize: 12, color: '#16a34a', marginTop: 6 },
  needText: { fontSize: 12, color: '#f59e0b', marginTop: 4 },
  mentorBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9' },
  mentorBtnText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#0f172a', textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 6 },
  statusOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9' },
  statusOptionText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontWeight: 'bold' },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f59e0b', alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: 'bold' },
});