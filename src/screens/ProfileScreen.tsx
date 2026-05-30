// src/screens/ProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [profile, setProfile] = useState<any>({});
  const [isSystemProfile, setIsSystemProfile] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: crmData } = await supabase.from('church_members').select('*').eq('user_id', user?.id).single();
    
    if (crmData) {
      setProfile(crmData);
    } else {
      const { data: authData } = await supabase.from('user_profiles').select('*').eq('id', user?.id).single();
      if (authData) {
        setProfile(authData);
        setIsSystemProfile(true);
      }
    }
    setLoading(false);
  }

  async function handleUpdate() {
    setUpdating(true);
    
    if (isSystemProfile) {
      const { error } = await supabase.from('user_profiles').update({ full_name: profile.full_name }).eq('id', profile.id);
      setUpdating(false);
      if (!error) Alert.alert("Succès", "Profil système mis à jour !");
    } else {
      const { error } = await supabase.from('church_members').update({
        full_name: profile.full_name,
        phone: profile.phone,
        profession: profile.profession,
        address: profile.address,
        gender: profile.gender,
        birth_date: profile.birth_date,
        marital_status: profile.marital_status
      }).eq('id', profile.id);
      setUpdating(false);
      if (!error) Alert.alert("Succès", "Profil mis à jour !");
    }
  }

  async function handleLogout() {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Oui', onPress: async () => await supabase.auth.signOut(), style: 'destructive' }
    ]);
  }

  if (loading) return <ActivityIndicator size="large" color="#0f172a" style={{marginTop: 50}} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Mon Profil</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Identité & Contact</Text>
        
        <Text style={styles.label}>Nom complet</Text>
        <TextInput style={styles.input} value={profile.full_name} onChangeText={(t) => setProfile({...profile, full_name: t})} />

        {!isSystemProfile && (
          <>
            <View style={{flexDirection: 'row', gap: 10}}>
              <View style={{flex: 1}}>
                <Text style={styles.label}>Genre</Text>
                <View style={styles.rowToggle}>
                  <TouchableOpacity style={[styles.toggleBtn, profile.gender === 'M' && styles.toggleActive]} onPress={() => setProfile({...profile, gender: 'M'})}>
                    <Text style={[styles.toggleText, profile.gender === 'M' && styles.toggleTextActive]}>Homme</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.toggleBtn, profile.gender === 'F' && styles.toggleActive]} onPress={() => setProfile({...profile, gender: 'F'})}>
                    <Text style={[styles.toggleText, profile.gender === 'F' && styles.toggleTextActive]}>Femme</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <Text style={styles.label}>Date de naissance</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
              <Text style={{color: profile.birth_date ? '#0f172a' : '#94a3b8'}}>{profile.birth_date || 'Sélectionner une date'}</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={profile.birth_date ? new Date(profile.birth_date) : new Date()}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setProfile({...profile, birth_date: selectedDate.toISOString().split('T')[0]});
                  }
                }}
              />
            )}

            <Text style={styles.label}>Téléphone</Text>
            <TextInput style={styles.input} keyboardType="phone-pad" value={profile.phone} onChangeText={(t) => setProfile({...profile, phone: t})} />

            <Text style={[styles.sectionTitle, {marginTop: 20}]}>Informations Sociales</Text>

            <Text style={styles.label}>État Civil</Text>
            <View style={styles.chipsContainer}>
              {['Célibataire', 'Marié(e)', 'Veuf/Veuve', 'Divorcé(e)'].map((status) => (
                <TouchableOpacity key={status} style={[styles.chip, profile.marital_status === status && styles.chipActive]} onPress={() => setProfile({...profile, marital_status: status})}>
                  <Text style={[styles.chipText, profile.marital_status === status && styles.chipTextActive]}>{status}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Profession</Text>
            <TextInput style={styles.input} value={profile.profession} onChangeText={(t) => setProfile({...profile, profession: t})} />

            <Text style={styles.label}>Adresse Géographique</Text>
            <TextInput style={styles.input} multiline value={profile.address} onChangeText={(t) => setProfile({...profile, address: t})} />

            <Text style={[styles.sectionTitle, {marginTop: 20}]}>Statut Spirituel (Lecture seule)</Text>
            <View style={styles.spiritualBox}>
              <View style={styles.spiritualItem}>
                <Text style={styles.spiritualIcon}>💧</Text>
                <Text style={styles.spiritualLabel}>Baptême d'eau</Text>
                <Text style={[styles.spiritualStatus, {color: profile.is_baptized_water ? '#10b981' : '#94a3b8'}]}>{profile.is_baptized_water ? 'Oui' : 'Non'}</Text>
              </View>
              <View style={styles.spiritualItem}>
                <Text style={styles.spiritualIcon}>🔥</Text>
                <Text style={styles.spiritualLabel}>Baptême St-Esprit</Text>
                <Text style={[styles.spiritualStatus, {color: profile.is_baptized_spirit ? '#f59e0b' : '#94a3b8'}]}>{profile.is_baptized_spirit ? 'Oui' : 'Non'}</Text>
              </View>
              <Text style={{fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 10, fontStyle: 'italic'}}>Ces informations sont gérées par le secrétariat.</Text>
            </View>
          </>
        )}

        <TouchableOpacity style={styles.btn} onPress={handleUpdate} disabled={updating}>
          {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Mettre à jour mon profil</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#0f172a', marginBottom: 20, marginTop: 30 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 5, marginTop: 15 },
  input: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a', fontSize: 14 },
  
  rowToggle: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  toggleActive: { backgroundColor: '#0f172a' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  toggleTextActive: { color: '#fff' },

  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  chipText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  chipTextActive: { color: '#3b82f6', fontWeight: 'bold' },

  spiritualBox: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  spiritualItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  spiritualIcon: { fontSize: 18, marginRight: 10 },
  spiritualLabel: { flex: 1, fontSize: 14, color: '#334155', fontWeight: '500' },
  spiritualStatus: { fontSize: 14, fontWeight: 'bold' },

  btn: { backgroundColor: '#0f172a', padding: 16, borderRadius: 12, marginTop: 30, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  logoutBtn: { marginTop: 20, padding: 15, alignItems: 'center' },
  logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 15 }
});