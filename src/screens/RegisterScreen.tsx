// src/screens/RegisterScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';

export default function RegisterScreen({ onNavigateToLogin }: { onNavigateToLogin: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [churchCode, setChurchCode] = useState('');
  const [gender, setGender] = useState('M'); // 🔴 NOUVEAU : État pour le genre (Par défaut M)
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

async function handleRegister() {
    if (!fullName || !email || !password || !churchCode) {
      return Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
    }
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      // 🔴 1. BLOCAGE STRICT ANTI-DOUBLON
      // On appelle la fonction SQL is_email_registered pour être sûr
      const { data: emailExists, error: rpcError } = await supabase.rpc('is_email_registered', { p_email: cleanEmail });
      
      if (rpcError) throw new Error("Erreur de vérification du compte. Veuillez réessayer.");
      
      if (emailExists) {
        // On bloque ici et on ne passe jamais à l'étape signUp
        return Alert.alert(
          'Compte existant', 
          'Cet email est déjà utilisé. Veuillez vous connecter ou contacter votre pasteur.'
        );
      }

      // 2. Vérifier si le code de l'église existe
      const { data: church, error: churchError } = await supabase
        .from('churches')
        .select('id, community_id')
        .ilike('church_code', churchCode.trim())
        .single();

      if (churchError || !church) throw new Error("Code Église invalide. Vérifiez auprès de votre pasteur.");

      // 3. Créer le compte utilisateur
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (authError) throw new Error(authError.message);

      // 4. Gestion des profils
      if (authData.user) {
        // ... (le reste du code d'insertion profil et liaison CRM reste identique)
        await supabase.from('user_profiles').insert({
          id: authData.user.id,
          full_name: fullName,
          email: cleanEmail,
          community_id: church.community_id
        });

        const { data: isLinked } = await supabase.rpc('link_member_to_auth', {
          p_email: cleanEmail,
          p_user_id: authData.user.id,
          p_church_id: church.id
        });

        if (!isLinked) {
          await supabase.from('church_members').insert({
            church_id: church.id,
            user_id: authData.user.id,
            full_name: fullName,
            email: cleanEmail,
            gender: gender, 
            status: 'APPROVED'
          });
        }
      }

      Alert.alert('Félicitations !', 'Votre compte a été créé. Vous pouvez maintenant y accéder.');
      
    } catch (e: any) {
      Alert.alert('Information', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>🕊️</Text>
          <Text style={styles.title}>Rejoindre mon Église</Text>
          <Text style={styles.subtitle}>Créez votre compte fidèle</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Code de l'Église *</Text>
          <TextInput
            style={[styles.input, { textTransform: 'uppercase', fontWeight: 'bold' }]}
            placeholder="Ex: GRACE2026"
            autoCapitalize="characters"
            value={churchCode}
            onChangeText={setChurchCode}
          />

          <Text style={styles.label}>Nom et Prénom *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Jean Dupont"
            value={fullName}
            onChangeText={setFullName}
          />

          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            placeholder="votre@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          {/* 🔴 NOUVEAU : Sélection du genre */}
          <Text style={styles.label}>Genre *</Text>
          <View style={styles.genderRow}>
            <TouchableOpacity 
              style={[styles.genderBtn, gender === 'M' && styles.genderBtnActive]} 
              onPress={() => setGender('M')}
            >
              <Text style={[styles.genderText, gender === 'M' && styles.genderTextActive]}>Masculin</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.genderBtn, gender === 'F' && styles.genderBtnActive]} 
              onPress={() => setGender('F')}
            >
              <Text style={[styles.genderText, gender === 'F' && styles.genderTextActive]}>Féminin</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Mot de passe *</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
              <Text style={{ fontSize: 18 }}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.registerButtonText}>S'inscrire</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={onNavigateToLogin} style={styles.loginLink}>
            <Text style={{ color: '#64748b' }}>Déjà un compte ? <Text style={{ color: '#0f172a', fontWeight: 'bold' }}>Se connecter</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f8fafc', justifyContent: 'center', padding: 24, paddingVertical: 50 },
  logoContainer: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
  logoText: { fontSize: 50, marginBottom: 10 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#0f172a' },
  subtitle: { fontSize: 15, color: '#64748b', marginTop: 5 },
  formContainer: { backgroundColor: '#fff', padding: 24, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 15, color: '#0f172a', marginBottom: 16 },
  
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  genderBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', backgroundColor: '#f8fafc' },
  genderBtnActive: { borderColor: '#0f172a', backgroundColor: '#0f172a' },
  genderText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  genderTextActive: { color: '#fff' },

  passwordWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, marginBottom: 20 },
  passwordInput: { flex: 1, padding: 15, fontSize: 15, color: '#0f172a' },
  eyeButton: { padding: 10, marginRight: 5 },
  registerButton: { backgroundColor: '#0f172a', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  registerButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  loginLink: { marginTop: 25, alignItems: 'center' }
});