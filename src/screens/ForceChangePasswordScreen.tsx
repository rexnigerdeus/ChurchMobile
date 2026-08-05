// src/screens/ForceChangePasswordScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

export default function ForceChangePasswordScreen({ onPasswordChanged }: { onPasswordChanged: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleUpdatePassword() {
    if (newPassword.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setLoading(true);
    // 1. Met à jour le mot de passe dans Supabase Auth
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      Alert.alert('Erreur', error.message);
      setLoading(false);
      return;
    }

    // 2. Clear le flag must_change_password côté serveur (même backend
    //    partagé avec le web). Utilise le client authentifié (RLS).
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('user_profiles')
        .update({ must_change_password: false })
        .eq('id', user.id);
    }

    Alert.alert('Succès', 'Votre mot de passe a été mis à jour de manière sécurisée !');
    onPasswordChanged(); // On signale à l'App qu'il peut accéder au Dashboard
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Sécurisez votre compte</Text>
      <Text style={styles.subtitle}>
        Vous utilisez actuellement un mot de passe temporaire. Pour des raisons de sécurité, veuillez définir votre propre mot de passe avant de continuer.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Nouveau mot de passe"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleUpdatePassword} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enregistrer et Continuer</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', padding: 24 },
  icon: { fontSize: 50, textAlign: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 30, lineHeight: 22 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 20 },
  button: { backgroundColor: '#0f172a', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});