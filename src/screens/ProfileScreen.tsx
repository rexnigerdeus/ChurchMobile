// src/screens/ProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, Image } from 'react-native';
import { supabase } from '../lib/supabase';
import { pickImage, uploadToSupabase } from '../components/WebImagePicker';
import DateTimePicker from '../components/WebDatePicker';

const MARITAL_STATUSES = ['Célibataire', 'Marié(e)', 'Concubinage', 'Veuf/Veuve', 'Divorcé(e)'];
const PROFILE_PHOTOS_BUCKET = 'profile-photos';

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [profile, setProfile] = useState<any>({});
  const [isSystemProfile, setIsSystemProfile] = useState(false);
  // Section changement de mot de passe
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: crmData } = await supabase.from('church_members').select('*').eq('user_id', user?.id).maybeSingle();

    if (crmData) {
      // Si la fiche membre n'a pas de photo mais que user_profiles en a une, on l'utilise
      const { data: userData } = await supabase.from('user_profiles').select('photo_url').eq('id', user?.id).maybeSingle();
      setProfile({
        ...crmData,
        photo_url: crmData.photo_url || userData?.photo_url || null,
      });
    } else {
      const { data: authData } = await supabase.from('user_profiles').select('*').eq('id', user?.id).maybeSingle();
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
      const { error } = await supabase.from('user_profiles').update({
        full_name: profile.full_name,
        photo_url: profile.photo_url,
      }).eq('id', profile.id);
      setUpdating(false);
      if (!error) Alert.alert("Succès", "Profil système mis à jour !");
      else Alert.alert("Erreur", error.message);
    } else {
      const { error } = await supabase.from('church_members').update({
        full_name: profile.full_name,
        phone: profile.phone,
        profession: profile.profession,
        address: profile.address,
        gender: profile.gender,
        birth_date: profile.birth_date,
        marital_status: profile.marital_status,
        photo_url: profile.photo_url
      }).eq('id', profile.id);
      setUpdating(false);
      if (!error) Alert.alert("Succès", "Profil mis à jour !");
      else Alert.alert("Erreur", error.message);
    }
  }

  async function handleUploadPhoto() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const picked = await pickImage({ source: 'gallery', allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (!picked?.uri) return;

    setUpdating(true);
    try {
      // On tente d'abord l'upload directement. Si le bucket n'existe
      // pas, l'upload renverra une erreur explicite. On évite d'appeler
      // createBucket() côté client : seuls les admins (service_role)
      // ont ce droit, donc la création auto échouait avec une erreur
      // RLS qui masquait la vraie cause.
      const fileName = `${user.id}/${Date.now()}.jpg`;
      let publicUrl: string;
      try {
        publicUrl = await uploadToSupabase(supabase, PROFILE_PHOTOS_BUCKET, fileName, picked);
      } catch (uploadErr: any) {
        const msg = uploadErr?.message || 'inconnu';
        const isRls = /row-level security|policy/i.test(msg);
        const isBucketMissing = /bucket|not found|404|does not exist/i.test(msg);
        if (isBucketMissing) {
          throw new Error(
            `Le bucket "${PROFILE_PHOTOS_BUCKET}" est introuvable côté serveur. ` +
            `Vérifiez que la migration 20260625_profile_photos_bucket.sql ` +
            `a bien été appliquée (Dashboard → SQL Editor).`
          );
        }
        if (isRls) {
          throw new Error(
            `Upload refusé par les politiques RLS.\n\n` +
            `Cause probable : la migration 20260708_profile_photos_rls_fix.sql ` +
            `n'a pas été appliquée. Exécutez-la dans Supabase → SQL Editor.\n\n` +
            `Détail technique : ${msg}`
          );
        }
        throw new Error(`Échec de l'upload : ${msg}`);
      }

      // Stocker l'URL dans la bonne table
      let stored = false;
      const storeErrors: string[] = [];

      // 1) Cas normal : le fidèle a une fiche church_members → on y stocke la photo
      if (!isSystemProfile && profile.id) {
        const { error: updateError } = await supabase.from('church_members')
          .update({ photo_url: publicUrl }).eq('id', profile.id);
        if (!updateError) {
          stored = true;
        } else {
          storeErrors.push(`church_members: ${updateError.message}`);
        }
      }

      // 2) Toujours tenter aussi user_profiles (permet au pasteur sans fiche membre d'avoir une photo)
      const { error: userPhotoError } = await supabase.from('user_profiles')
        .update({ photo_url: publicUrl }).eq('id', user.id);
      if (!userPhotoError) {
        stored = true;
      } else {
        storeErrors.push(`user_profiles: ${userPhotoError.message}`);
      }

      if (!stored) {
        throw new Error(
          "L'upload a réussi mais l'URL n'a pas pu être sauvegardée.\n\n" +
          `Détails :\n${storeErrors.join('\n')}\n\n` +
          "Vérifiez que la migration 20260625_user_profiles_photo_url.sql a été appliquée."
        );
      }

      // On force la mise à jour du state en créant un nouvel objet
      // ET on ajoute un cache-buster (?t=) à l'URL publique pour
      // éviter que iOS / React Native serve une version cachée
      // (l'upsert peut garder l'ancienne image si le navigateur
      // met l'URL en cache HTTP).
      const photoUrlWithCacheBuster = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
      setProfile((prev: any) => ({ ...prev, photo_url: photoUrlWithCacheBuster }));
      Alert.alert('Succès', 'Photo de profil mise à jour !');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || "Impossible d'uploader la photo.");
    }
    setUpdating(false);
  }

  async function handleLogout() {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' ? window.confirm('Voulez-vous vraiment vous déconnecter ?') : false;
      if (!confirmed) return;
      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert('Erreur', error.message || 'Impossible de se déconnecter.');
      }
      return;
    }

    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Oui', onPress: async () => await supabase.auth.signOut(), style: 'destructive' }
    ]);
  }

  // Changement de mot de passe volontaire (depuis le profil connecté).
  // Met à jour Supabase Auth puis clear le flag must_change_password
  // côté serveur (même backend partagé avec le web).
  async function handleChangePassword() {
    if (newPassword.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      Alert.alert('Erreur', error.message);
      setChangingPassword(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('user_profiles')
        .update({ must_change_password: false })
        .eq('id', user.id);
    }
    setNewPassword('');
    Alert.alert('Succès', 'Votre mot de passe a été mis à jour avec succès !');
    setChangingPassword(false);
  }

  if (loading) return <ActivityIndicator size="large" color="#0f172a" style={{marginTop: 50}} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {/* Photo de profil */}
      <View style={styles.photoContainer}>
        {profile.photo_url ? (
          <Image
            key={profile.photo_url}
            source={{ uri: profile.photo_url }}
            style={styles.profilePhoto}
            onError={(e) => console.warn('[ProfileScreen] image load error', e.nativeEvent?.error)}
            onLoad={() => console.log('[ProfileScreen] image loaded ok', profile.photo_url)}
          />
        ) : (
          <View style={styles.profilePhotoPlaceholder}>
            <Text style={styles.profilePhotoPlaceholderText}>
              {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <TouchableOpacity style={styles.photoBtn} onPress={handleUploadPhoto} disabled={updating}>
          {updating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.photoBtnText}>📷 Changer la photo</Text>}
        </TouchableOpacity>
      </View>

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
            <DateTimePicker
              value={profile.birth_date ? new Date(profile.birth_date) : undefined}
              mode="date"
              display="default"
              maximumDate={new Date()}
              style={styles.input}
              placeholder="Sélectionner une date"
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  setProfile({...profile, birth_date: selectedDate.toISOString().split('T')[0]});
                }
              }}
            />

            <Text style={styles.label}>Téléphone</Text>
            <TextInput style={styles.input} keyboardType="phone-pad" value={profile.phone} onChangeText={(t) => setProfile({...profile, phone: t})} />

            <Text style={[styles.sectionTitle, {marginTop: 20}]}>Informations Sociales</Text>

            <Text style={styles.label}>État Civil</Text>
            <View style={styles.chipsContainer}>
              {MARITAL_STATUSES.map((status) => (
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

      {/* Section Sécurité : changement de mot de passe */}
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={styles.sectionTitle}>Sécurité</Text>
        <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
          Définissez un nouveau mot de passe (minimum 6 caractères).
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Nouveau mot de passe"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TouchableOpacity
          style={[styles.btn, { marginTop: 8 }]}
          onPress={handleChangePassword}
          disabled={changingPassword || newPassword.length < 6}
        >
          {changingPassword
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Changer mon mot de passe</Text>}
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
  title: { fontSize: 26, fontWeight: 'bold', color: '#0f172a', marginBottom: 20, marginTop: 10 },

  // Photo de profil
  photoContainer: { alignItems: 'center', marginBottom: 10, marginTop: 30 },
  profilePhoto: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#e2e8f0' },
  profilePhotoPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#e2e8f0' },
  profilePhotoPlaceholderText: { fontSize: 40, fontWeight: 'bold', color: '#64748b' },
  photoBtn: { marginTop: 12, backgroundColor: '#0f172a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  photoBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
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