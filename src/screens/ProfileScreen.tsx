// src/screens/ProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [profile, setProfile] = useState<any>({});
  const [isSystemProfile, setIsSystemProfile] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    
    // 1. On cherche d'abord dans le CRM des fidèles
    const { data: crmData } = await supabase.from('church_members').select('*').eq('user_id', user?.id).single();
    
    if (crmData) {
      setProfile(crmData);
    } else {
      // 2. S'il n'y est pas (ex: Pasteur), on cherche dans son profil système (Auth)
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
      // Mise à jour du profil système (Pasteur/Admin)
      const { error } = await supabase.from('user_profiles').update({ full_name: profile.full_name }).eq('id', profile.id);
      setUpdating(false);
      if (!error) Alert.alert("Succès", "Profil système mis à jour !");
    } else {
      // Mise à jour du profil fidèle
      const { error } = await supabase.from('church_members').update({
        full_name: profile.full_name,
        phone: profile.phone,
        profession: profile.profession,
        address: profile.address
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Mon Profil</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Nom complet</Text>
        <TextInput style={styles.input} value={profile.full_name} onChangeText={(t) => setProfile({...profile, full_name: t})} />

        {!isSystemProfile && (
          <>
            <Text style={styles.label}>Téléphone</Text>
            <TextInput style={styles.input} keyboardType="phone-pad" value={profile.phone} onChangeText={(t) => setProfile({...profile, phone: t})} />

            <Text style={styles.label}>Profession</Text>
            <TextInput style={styles.input} value={profile.profession} onChangeText={(t) => setProfile({...profile, profession: t})} />

            <Text style={styles.label}>Adresse Géographique</Text>
            <TextInput style={styles.input} multiline value={profile.address} onChangeText={(t) => setProfile({...profile, address: t})} />
          </>
        )}

        <TouchableOpacity style={styles.btn} onPress={handleUpdate} disabled={updating}>
          {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Mettre à jour</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0f172a', marginBottom: 20, marginTop: 20 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  label: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 5, marginTop: 15 },
  input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a' },
  btn: { backgroundColor: '#0f172a', padding: 15, borderRadius: 10, marginTop: 30, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  logoutBtn: { marginTop: 30, padding: 15, alignItems: 'center' },
  logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 }
});