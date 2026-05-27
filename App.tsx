// App.tsx
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './src/lib/supabase';

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
  // 🔴 NOUVEAU : ID du département sélectionné
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('needsPasswordChange').then(val => { if (val === 'true') setNeedsPasswordChange(true); });
    supabase.auth.getSession().then(({ data: { session } }) => { handleSession(session); });
    supabase.auth.onAuthStateChange((_event, session) => { handleSession(session); });
  }, []);

  async function handleSession(currentSession: any) {
    setSession(currentSession);
    if (currentSession) {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', currentSession.user.id).single();
      setUserRole(data?.role || null);
    } else {
      setUserRole(null); setCurrentView('HOME');
    }
    setIsReady(true);
  }

  const handleTempLogin = async () => { setNeedsPasswordChange(true); await AsyncStorage.setItem('needsPasswordChange', 'true'); };
  const handlePasswordChanged = async () => { setNeedsPasswordChange(false); await AsyncStorage.removeItem('needsPasswordChange'); };

  if (!isReady) return (<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#0f172a" /></View>);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {!session ? (
        authView === 'LOGIN' ? <LoginScreen onTempLogin={handleTempLogin} onNavigateToRegister={() => setAuthView('REGISTER')} /> : <RegisterScreen onNavigateToLogin={() => setAuthView('LOGIN')} />
      ) : needsPasswordChange ? (
        <ForceChangePasswordScreen onPasswordChanged={handlePasswordChanged} />
      ) : currentView === 'FINANCE' ? (
        <FinanceScreen onBack={() => setCurrentView('HOME')} />
      ) : currentView === 'DEPARTMENT_DASHBOARD' && selectedDeptId ? (
        // 🔴 CORRECTION : On passe l'ID du département à l'écran
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
        // 🔴 NOUVEAU : Navigation vers un département
        onNavigateToDepartment={(id: string) => { setSelectedDeptId(id); setCurrentView('DEPARTMENT_DASHBOARD'); }}
      />
    )}
    <StatusBar style="auto" />
    </SafeAreaView>
  );
}