// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen({
  onNavigateToRegister
}: {
  onNavigateToRegister: () => void
}) {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // 👁️ État pour le masque
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Erreur', error.message);
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email) {
      Alert.alert('Email requis', 'Saisissez votre email ci-dessus, puis appuyez sur "Mot de passe oublié" pour recevoir un lien de réinitialisation.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://mon-eglise.vercel.app/',
    });
    setLoading(false);
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      Alert.alert(
        'Email envoyé',
        'Si un compte existe pour cet email, un lien de réinitialisation vient de lui être envoyé. Vérifiez votre boîte mail (et vos spams). Le lien s\'ouvrira sur la plateforme web où vous pourrez définir un nouveau mot de passe, valable aussi sur l\'app mobile.'
      );
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>⛪</Text>
          <Text style={styles.title}>Connexion</Text>
          <Text style={styles.subtitle}>Espace Fidèle & Staff</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="votre@email.com"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Mot de passe</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              secureTextEntry={!showPassword} // 👈 Masque dynamique
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity 
              style={styles.eyeButton} 
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={{ fontSize: 18 }}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Se connecter</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleForgotPassword} disabled={loading} style={{ marginTop: 15, alignItems: 'center' }}>
            <Text style={{ color: '#64748b', fontSize: 13 }}>Mot de passe oublié ?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onNavigateToRegister} style={{ marginTop: 25, alignItems: 'center' }}>
            <Text style={{ color: '#64748b' }}>Pas encore membre ? <Text style={{ color: '#0f172a', fontWeight: 'bold' }}>S'inscrire</Text></Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', padding: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoText: { fontSize: 60, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#0f172a' },
  subtitle: { fontSize: 16, color: '#64748b', marginTop: 5 },
  formContainer: { backgroundColor: '#fff', padding: 24, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 16, color: '#0f172a', marginBottom: 20 },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, marginBottom: 20 },
  passwordInput: { flex: 1, padding: 15, fontSize: 16, color: '#0f172a' },
  eyeButton: { padding: 10, marginRight: 5 },
  loginButton: { backgroundColor: '#0f172a', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});