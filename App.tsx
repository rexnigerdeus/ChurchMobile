// App.tsx
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ActivityIndicator, View, Platform, ScrollView, StyleSheet } from 'react-native';
import { supabase } from './src/lib/supabase';
import { storage } from './src/lib/storage';
import { useResponsive } from './src/hooks/useResponsive';
import { useRegisterServiceWorker } from './src/hooks/useRegisterServiceWorker';
import { injectPwaMeta } from './src/lib/pwa-meta';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import FinanceScreen from './src/screens/FinanceScreen';
import ForceChangePasswordScreen from './src/screens/ForceChangePasswordScreen';
import AppointmentScreen from './src/screens/AppointmentScreen';
import PrayerRequestScreen from './src/screens/PrayerRequestScreen';
import PastorDashboardScreen from './src/screens/PastorDashboardScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import SecretariatDashboardScreen from './src/screens/SecretariatDashboardScreen';
import DepartmentDashboardScreen from './src/screens/DepartmentDashboardScreen';
import SubGroupDashboardScreen from './src/screens/SubGroupDashboardScreen';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [authView, setAuthView] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'HOME' | 'FINANCE' | 'APPOINTMENT' | 'PRAYER_REQUEST' | 'PASTOR_DASHBOARD' | 'SECRETARIAT_DASHBOARD' | 'DEPARTMENT_DASHBOARD' | 'SUBGROUP_DASHBOARD'>('HOME');
  
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { handleSession(session); });
    supabase.auth.onAuthStateChange((_event, session) => { handleSession(session); });
  }, []);

  async function handleSession(currentSession: any) {
    setSession(currentSession);
    if (currentSession) {
      // Lecture parallèle du rôle ET du flag must_change_password (flag
      // serveur unifié web + mobile, partagé via le même backend Supabase).
      const [rolesRes, profileRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', currentSession.user.id).single(),
        supabase.from('user_profiles').select('must_change_password').eq('id', currentSession.user.id).single(),
      ]);
      const role = rolesRes.data?.role || null;
      const mustChange = profileRes.data?.must_change_password === true;
      setUserRole(role);
      setNeedsPasswordChange(mustChange);
      if (mustChange) {
        // On persiste le flag local pour qu'il survive à un reload,
        // mais la source de vérité reste la colonne serveur.
        await storage.setItem('needsPasswordChange', 'true');
      } else {
        await storage.removeItem('needsPasswordChange');
      }

      // 🔴 LOGIQUE DE BYPASS : Redirection directe pour le pasteur
      if (role === 'CHURCH_LEADER') {
        setCurrentView('PASTOR_DASHBOARD');
      } else {
        setCurrentView('HOME');
      }
    } else {
      setUserRole(null);
      setNeedsPasswordChange(false);
      await storage.removeItem('needsPasswordChange');
      setCurrentView('HOME');
    }
    setIsReady(true);
  }

  const handlePasswordChanged = async () => { setNeedsPasswordChange(false); await storage.removeItem('needsPasswordChange'); };

  const { isLargeScreen, contentMaxWidth, horizontalPadding } = useResponsive();
  useRegisterServiceWorker();

  useEffect(() => {
    injectPwaMeta();
  }, []);

  if (!isReady) return (<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#0f172a" /></View>);

  // Sur grand écran (web/desktop/tablette) on centre le contenu mobile-first dans
  // un conteneur ScrollView pour reproduire l'expérience d'un téléphone.
  const Screen = !session ? (
    authView === 'LOGIN' ? <LoginScreen onNavigateToRegister={() => setAuthView('REGISTER')} /> : <RegisterScreen onNavigateToLogin={() => setAuthView('LOGIN')} />
  ) : needsPasswordChange ? (
    <ForceChangePasswordScreen onPasswordChanged={handlePasswordChanged} />
  ) : currentView === 'FINANCE' ? (
    <FinanceScreen onBack={() => setCurrentView('HOME')} />
  ) : currentView === 'DEPARTMENT_DASHBOARD' && selectedDeptId ? (
    <DepartmentDashboardScreen onBack={() => setCurrentView('HOME')} deptId={selectedDeptId} />
  ) : currentView === 'SUBGROUP_DASHBOARD' && selectedGroupId ? (
    <SubGroupDashboardScreen onBack={() => setCurrentView('HOME')} groupId={selectedGroupId} />
  ) : currentView === 'APPOINTMENT' ? (
    <AppointmentScreen onBack={() => setCurrentView('HOME')} />
  ) : currentView === 'PRAYER_REQUEST' ? (
    <PrayerRequestScreen onBack={() => setCurrentView('HOME')} />
  ) : currentView === 'PASTOR_DASHBOARD' ? (
    <PastorDashboardScreen onBack={() => setCurrentView('HOME')} />
  ) : currentView === 'SECRETARIAT_DASHBOARD' ? (
    <SecretariatDashboardScreen onBack={() => setCurrentView('HOME')} />
  ) :
  (
    <HomeScreen
      userRole={userRole}
      onNavigateToAppointment={() => setCurrentView('APPOINTMENT')}
      onNavigateToPrayer={() => setCurrentView('PRAYER_REQUEST')}
      onNavigateToPastor={() => setCurrentView('PASTOR_DASHBOARD')}
      onNavigateToSecretariat={() => setCurrentView('SECRETARIAT_DASHBOARD')}
      onNavigateToFinance={() => setCurrentView('FINANCE')}
      onNavigateToSubGroup={(id: string) => { setSelectedGroupId(id); setCurrentView('SUBGROUP_DASHBOARD'); }}
      onNavigateToDepartment={(id: string) => { setSelectedDeptId(id); setCurrentView('DEPARTMENT_DASHBOARD'); }}
    />
  );

  // En mobile natif, on rend l'écran plein pot. En web on centre dans un "phone frame".
  if (Platform.OS === 'web' && isLargeScreen) {
    return (
      <View style={styles.webShell}>
        <ScrollView contentContainerStyle={styles.webScroll}>
          <View
            style={[
              styles.phoneFrame,
              {
                maxWidth: contentMaxWidth,
                paddingHorizontal: horizontalPadding,
              },
            ]}
          >
            {Screen}
            <StatusBar style="auto" />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {Screen}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  webShell: {
    flex: 1,
    backgroundColor: '#e2e8f0', // fond gris clair pour faire ressortir le "phone"
    minHeight: '100vh' as any,
  },
  webScroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 24,
  },
  phoneFrame: {
    flex: 1,
    backgroundColor: '#f8fafc',
    minHeight: 600,
    borderRadius: 16,
    overflow: 'hidden',
    // Ombre légère pour donner l'effet "phone"
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    // @ts-ignore - web only
    boxShadow: '0 4px 24px rgba(15, 23, 42, 0.08)',
  },
});