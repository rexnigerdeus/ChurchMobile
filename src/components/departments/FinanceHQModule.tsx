// src/components/departments/FinanceHQModule.tsx
// Module dédié au Département Finance HQ (niveau église locale)
// Trace les cotisations de l'église locale vers la région.
//
// Refonte UX/UI : interface aérée, cartes plus larges, espacements généreux,
// hiérarchie visuelle claire, barre de progression annuelle, actions rapides.
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';

interface FinanceHQModuleProps {
  deptId: string;
  churchId: string;
  isLeader: boolean;
}

interface Contribution {
  id: string;
  amount: number;
  period_month: number;
  period_year: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  PENDING: { label: 'En attente', color: '#b45309', bg: '#fef3c7', dot: '#f59e0b' },
  PAID:    { label: 'Payée',      color: '#15803d', bg: '#dcfce7', dot: '#16a34a' },
  OVERDUE: { label: 'En retard',  color: '#b91c1c', bg: '#fee2e2', dot: '#ef4444' },
};

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHECK'] as const;
const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Espèces', BANK_TRANSFER: 'Virement', MOBILE_MONEY: 'Mobile Money', CHECK: 'Chèque',
};

const MONTHS_LONG = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

type FilterKey = 'ALL' | 'PENDING' | 'PAID' | 'OVERDUE';

const fmtMoney = (n: number) => `${n.toLocaleString('fr-FR')} F`;

export default function FinanceHQModule({ deptId, churchId, isLeader }: FinanceHQModuleProps) {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [regionName, setRegionName] = useState<string>('');
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [newContrib, setNewContrib] = useState({
    amount: '',
    period_month: (new Date().getMonth() + 1).toString(),
    period_year: new Date().getFullYear().toString(),
    payment_method: 'CASH' as typeof PAYMENT_METHODS[number],
    reference_number: '',
    notes: '',
  });

  useEffect(() => { loadData(); }, [deptId, churchId]);

  async function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      // 1. Trouver la région de l'église
      const { data: church } = await supabase
        .from('churches')
        .select('region_id, regions(name)')
        .eq('id', churchId)
        .single();
      if (church?.region_id) {
        setRegionId(church.region_id);
        setRegionName((church as any)?.regions?.name || '');
      }

      // 2. Charger les cotisations de cette église
      const { data, error } = await supabase
        .from('contributions')
        .select('*')
        .eq('source_type', 'CHURCH')
        .eq('source_id', churchId)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

      if (error) console.warn('[FinanceHQModule] load error:', error.message);
      setContributions((data || []) as Contribution[]);
    } catch (e) {
      console.warn('[FinanceHQModule] error:', e);
    }
    setLoading(false);
    setRefreshing(false);
  }

  // ─────────────── Calculs analytiques (mémoïsés) ───────────────
  const stats = useMemo(() => {
    const totalPaid = contributions.filter(c => c.status === 'PAID').reduce((s, c) => s + Number(c.amount), 0);
    const totalPending = contributions.filter(c => c.status === 'PENDING').reduce((s, c) => s + Number(c.amount), 0);
    const totalOverdue = contributions.filter(c => c.status === 'OVERDUE').reduce((s, c) => s + Number(c.amount), 0);

    const currentYear = new Date().getFullYear();
    const yearPaid = contributions.filter(c => c.period_year === currentYear && c.status === 'PAID');
    const yearTotal = yearPaid.reduce((s, c) => s + Number(c.amount), 0);

    const monthlyTotals: number[] = Array(12).fill(0);
    yearPaid.forEach(c => { if (c.period_month >= 1 && c.period_month <= 12) monthlyTotals[c.period_month - 1] += Number(c.amount); });

    const counts = {
      ALL: contributions.length,
      PENDING: contributions.filter(c => c.status === 'PENDING').length,
      PAID: contributions.filter(c => c.status === 'PAID').length,
      OVERDUE: contributions.filter(c => c.status === 'OVERDUE').length,
    };

    // Objectif annuel indicatif (12 mois × moyenne payée par mois, min 1)
    const paidMonthsCount = yearPaid.length;
    const monthlyAvg = paidMonthsCount > 0 ? yearTotal / paidMonthsCount : 0;
    const yearObjective = Math.max(monthlyAvg * 12, 1);
    const progressPct = Math.min(Math.round((yearTotal / yearObjective) * 100), 100);

    return { totalPaid, totalPending, totalOverdue, currentYear, yearTotal, monthlyTotals, counts, progressPct };
  }, [contributions]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return contributions;
    return contributions.filter(c => c.status === filter);
  }, [contributions, filter]);

  // ─────────────── Actions ───────────────
  const handleAdd = async () => {
    if (!newContrib.amount || isNaN(Number(newContrib.amount)))
      return Alert.alert('Montant invalide', 'Saisissez un montant numérique correct.');
    if (!regionId)
      return Alert.alert('Région introuvable', 'Aucune région n\'est rattachée à cette église.');

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('contributions').insert({
      source_type: 'CHURCH',
      source_id: churchId,
      target_type: 'REGION',
      target_id: regionId,
      amount: Number(newContrib.amount),
      period_month: parseInt(newContrib.period_month),
      period_year: parseInt(newContrib.period_year),
      status: 'PENDING',
      payment_method: newContrib.payment_method,
      reference_number: newContrib.reference_number.trim() || null,
      notes: newContrib.notes.trim() || null,
      created_by: user?.id,
    });

    if (error) return Alert.alert('Erreur', error.message);
    setIsAdding(false);
    setNewContrib({
      amount: '',
      period_month: (new Date().getMonth() + 1).toString(),
      period_year: new Date().getFullYear().toString(),
      payment_method: 'CASH',
      reference_number: '',
      notes: '',
    });
    loadData();
  };

  const markAsPaid = (contrib: Contribution) => {
    if (!isLeader) return;
    Alert.alert(
      'Confirmer le paiement',
      `Cotisation de ${fmtMoney(Number(contrib.amount))}\n${MONTHS_LONG[contrib.period_month - 1]} ${contrib.period_year}`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer le paiement', onPress: async () => {
          const { error } = await supabase.from('contributions').update({
            status: 'PAID', paid_at: new Date().toISOString(),
          }).eq('id', contrib.id);
          if (error) return Alert.alert('Erreur', error.message);
          loadData();
        }},
      ],
    );
  };

  // ─────────────── Loader initial ───────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Chargement des cotisations…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#10b981']} tintColor="#10b981" />
        }
      >
        {/* ───── En-tête + bouton ajout ───── */}
        <View style={styles.pageHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Cotisations vers la Région</Text>
            <Text style={styles.pageSubtitle}>Suivi mensuel des versements de l'église locale</Text>
          </View>
          {isLeader && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setIsAdding(true)} activeOpacity={0.8}>
              <Text style={styles.addBtnIcon}>＋</Text>
              <Text style={styles.addBtnText}>Nouvelle</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ───── Bandeau région ───── */}
        <View style={[styles.regionBanner, regionName ? styles.regionBannerOk : styles.regionBannerWarn]}>
          <View style={styles.regionBannerIconWrap}>
            <Text style={styles.regionBannerIcon}>{regionName ? '📍' : '⚠️'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.regionBannerText, { color: regionName ? '#0c4a6e' : '#b91c1c' }]}>
              {regionName
                ? `Région destinataire : ${regionName}`
                : 'Aucune région configurée pour cette église'}
            </Text>
            <Text style={[styles.regionBannerSub, { color: regionName ? '#0369a1' : '#ef4444' }]}>
              {regionName
                ? 'Les cotisations sont versées à cette région.'
                : 'Renseignez la région de l\'église pour activer les cotisations.'}
            </Text>
          </View>
        </View>

        {/* ───── Carte résumé annuelle (hero) ───── */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroLabel}>Total versé en {stats.currentYear}</Text>
              <Text style={styles.heroValue}>{fmtMoney(stats.yearTotal)}</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{stats.counts.PAID} payée{stats.counts.PAID > 1 ? 's' : ''}</Text>
            </View>
          </View>
          {/* Barre de progression annuelle */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${stats.progressPct}%` }]} />
          </View>
          <Text style={styles.progressCaption}>
            {stats.progressPct}% de l'objectif annuel estimé
          </Text>
        </View>

        {/* ───── KPIs secondaires ───── */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { borderTopColor: '#16a34a' }]}>
            <Text style={styles.kpiLabel}>Total payé</Text>
            <Text style={styles.kpiValue}>{fmtMoney(stats.totalPaid)}</Text>
          </View>
          <View style={[styles.kpiCard, { borderTopColor: '#f59e0b' }]}>
            <Text style={styles.kpiLabel}>En attente</Text>
            <Text style={styles.kpiValue}>{fmtMoney(stats.totalPending)}</Text>
          </View>
          <View style={[styles.kpiCard, { borderTopColor: '#ef4444' }]}>
            <Text style={styles.kpiLabel}>En retard</Text>
            <Text style={styles.kpiValue}>{fmtMoney(stats.totalOverdue)}</Text>
          </View>
        </View>

        {/* ───── Graphique croissance ───── */}
        {stats.yearTotal > 0 && (
          <View style={styles.growthCard}>
            <Text style={styles.growthTitle}>📈 Croissance mensuelle {stats.currentYear}</Text>
            <Text style={styles.growthSub}>Montants payés par mois (en milliers de F)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingTop: 12, paddingBottom: 4 }}>
              {stats.monthlyTotals.map((val, i) => {
                const maxVal = Math.max(...stats.monthlyTotals, 1);
                const heightPct = (val / maxVal) * 72;
                return (
                  <View key={i} style={styles.barCol}>
                    <View style={styles.barContainer}>
                      <View style={[styles.bar, { height: Math.max(heightPct, val > 0 ? 6 : 0), backgroundColor: val > 0 ? '#10b981' : '#e2e8f0' }]} />
                    </View>
                    <Text style={styles.barLabel}>{MONTHS_SHORT[i]}</Text>
                    {val > 0 && <Text style={styles.barValue}>{(val / 1000).toFixed(0)}k</Text>}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ───── Filtres ───── */}
        <Text style={styles.sectionTitle}>Historique des cotisations</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} style={{ flexGrow: 0 }}>
          {(['ALL', 'PENDING', 'PAID', 'OVERDUE'] as FilterKey[]).map(key => {
            const meta = key === 'ALL' ? null : STATUS_META[key];
            const label = key === 'ALL' ? 'Toutes' : meta!.label;
            const count = stats.counts[key];
            const active = filter === key;
            return (
              <TouchableOpacity
                key={key}
                style={active ? styles.pillActive : styles.pill}
                onPress={() => setFilter(key)}
                activeOpacity={0.7}
              >
                <Text style={active ? styles.pillActiveText : styles.pillText}>{label} ({count})</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ───── Liste ───── */}
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>🗂️</Text>
            <Text style={styles.emptyText}>Aucune cotisation {filter !== 'ALL' ? `avec le statut « ${STATUS_META[filter]?.label} »` : 'enregistrée'}.</Text>
            {isLeader && (
              <TouchableOpacity style={styles.emptyCta} onPress={() => setIsAdding(true)}>
                <Text style={styles.emptyCtaText}>＋ Enregistrer une cotisation</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {filtered.map(item => {
              const st = STATUS_META[item.status] || STATUS_META.PENDING;
              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.cardAmount}>{fmtMoney(Number(item.amount))}</Text>
                      <Text style={styles.cardPeriod}>
                        {MONTHS_LONG[item.period_month - 1]} {item.period_year}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: st.dot }]} />
                      <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>

                  {(item.payment_method || item.reference_number || item.notes) && (
                    <View style={styles.cardDivider} />
                  )}

                  {item.payment_method && (
                    <View style={styles.cardMetaRow}>
                      <Text style={styles.cardMetaIcon}>💳</Text>
                      <Text style={styles.cardMetaText}>{PAYMENT_LABELS[item.payment_method] || item.payment_method}</Text>
                    </View>
                  )}
                  {item.reference_number && (
                    <View style={styles.cardMetaRow}>
                      <Text style={styles.cardMetaIcon}>🔗</Text>
                      <Text style={styles.cardMetaText}>Réf : {item.reference_number}</Text>
                    </View>
                  )}
                  {item.notes && (
                    <View style={styles.cardMetaRow}>
                      <Text style={styles.cardMetaIcon}>📝</Text>
                      <Text style={[styles.cardMetaText, { fontStyle: 'italic' }]}>{item.notes}</Text>
                    </View>
                  )}
                  {item.paid_at && (
                    <View style={styles.cardMetaRow}>
                      <Text style={styles.cardMetaIcon}>✅</Text>
                      <Text style={[styles.cardMetaText, { color: '#15803d', fontWeight: '600' }]}>
                        Payée le {new Date(item.paid_at).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                  )}

                  {isLeader && item.status === 'PENDING' && (
                    <TouchableOpacity style={styles.markPaidBtn} onPress={() => markAsPaid(item)} activeOpacity={0.8}>
                      <Text style={styles.markPaidBtnText}>✓ Marquer comme payée</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ─────────────── Modale d'ajout ─────────────── */}
      <Modal visible={isAdding} transparent animationType="fade" onRequestClose={() => setIsAdding(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvelle cotisation</Text>
              <TouchableOpacity onPress={() => setIsAdding(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              <Text style={styles.fieldLabel}>Montant (FCFA) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex : 50 000"
                value={newContrib.amount}
                onChangeText={v => setNewContrib({ ...newContrib, amount: v })}
                keyboardType="numeric"
              />

              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Mois *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingTop: 4 }}>
                    {MONTHS_SHORT.map((m, i) => {
                      const active = parseInt(newContrib.period_month) === i + 1;
                      return (
                        <TouchableOpacity
                          key={i}
                          style={active ? styles.monthPillActive : styles.monthPill}
                          onPress={() => setNewContrib({ ...newContrib, period_month: (i + 1).toString() })}
                        >
                          <Text style={active ? styles.monthPillActiveText : styles.monthPillText}>{m}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
                <View style={{ flex: 0.5, marginLeft: 12 }}>
                  <Text style={styles.fieldLabel}>Année *</Text>
                  <TextInput
                    style={styles.input}
                    value={newContrib.period_year}
                    onChangeText={v => setNewContrib({ ...newContrib, period_year: v })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Méthode de paiement</Text>
              <View style={styles.methodRow}>
                {PAYMENT_METHODS.map(m => {
                  const active = newContrib.payment_method === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.methodChip, active && styles.methodChipActive]}
                      onPress={() => setNewContrib({ ...newContrib, payment_method: m })}
                    >
                      <Text style={[styles.methodChipText, active && styles.methodChipTextActive]}>
                        {PAYMENT_LABELS[m]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Numéro de référence / reçu</Text>
              <TextInput
                style={styles.input}
                placeholder="Optionnel"
                value={newContrib.reference_number}
                onChangeText={v => setNewContrib({ ...newContrib, reference_number: v })}
              />

              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Optionnel"
                value={newContrib.notes}
                onChangeText={v => setNewContrib({ ...newContrib, notes: v })}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.modalActions}>
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

// ─────────────── Styles ───────────────
const COLORS = {
  green: '#10b981',
  greenDark: '#059669',
  ink: '#0f172a',
  muted: '#64748b',
  lightMuted: '#94a3b8',
  border: '#e2e8f0',
  bg: '#f8fafc',
  card: '#ffffff',
};

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  loadingText: { marginTop: 12, color: COLORS.muted, fontSize: 14 },

  // En-tête de page
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: COLORS.ink, letterSpacing: -0.2 },
  pageSubtitle: { fontSize: 13, color: COLORS.muted, marginTop: 2 },

  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.green, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, shadowColor: COLORS.green, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  addBtnIcon: { color: '#fff', fontSize: 18, fontWeight: '800', marginRight: 6 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Bandeau région
  regionBanner: { marginHorizontal: 20, padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  regionBannerOk: { backgroundColor: '#e0f2fe' },
  regionBannerWarn: { backgroundColor: '#fee2e2' },
  regionBannerIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  regionBannerIcon: { fontSize: 18 },
  regionBannerText: { fontSize: 14, fontWeight: '700' },
  regionBannerSub: { fontSize: 12, marginTop: 2 },

  // Carte résumé annuelle (hero)
  heroCard: { marginHorizontal: 20, backgroundColor: COLORS.card, borderRadius: 18, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  heroLabel: { fontSize: 12, fontWeight: '700', color: COLORS.lightMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroValue: { fontSize: 24, fontWeight: '800', color: COLORS.ink, marginTop: 4 },
  heroBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  heroBadgeText: { color: '#15803d', fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.green, borderRadius: 4 },
  progressCaption: { fontSize: 11, color: COLORS.muted, marginTop: 8 },

  // KPIs
  kpiRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 14 },
  kpiCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 14, borderTopWidth: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  kpiLabel: { fontSize: 11, fontWeight: '700', color: COLORS.lightMuted, textTransform: 'uppercase' },
  kpiValue: { fontSize: 15, fontWeight: '800', color: COLORS.ink, marginTop: 6 },

  // Croissance
  growthCard: { marginHorizontal: 20, backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  growthTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  growthSub: { fontSize: 11, color: COLORS.lightMuted, marginTop: 2 },
  barCol: { alignItems: 'center', marginRight: 10 },
  barContainer: { height: 76, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 18, borderRadius: 5 },
  barLabel: { fontSize: 9, color: COLORS.muted, marginTop: 6 },
  barValue: { fontSize: 9, color: COLORS.green, fontWeight: '800', marginTop: 2 },

  // Section liste
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink, paddingHorizontal: 20, marginBottom: 10 },

  // Filtres
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: COLORS.border },
  pillActive: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.green, marginRight: 8 },
  pillText: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  pillActiveText: { fontSize: 12, color: '#fff', fontWeight: '700' },

  // Cartes cotisation
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardAmount: { fontSize: 20, fontWeight: '800', color: COLORS.ink },
  cardPeriod: { fontSize: 13, color: COLORS.muted, marginTop: 4 },
  cardDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  cardMetaIcon: { fontSize: 13, marginRight: 8, width: 18 },
  cardMetaText: { fontSize: 13, color: COLORS.muted, flex: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  markPaidBtn: { marginTop: 14, backgroundColor: '#dcfce7', paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#bbf7d0' },
  markPaidBtnText: { color: '#15803d', fontSize: 13, fontWeight: '700' },

  // État vide
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { textAlign: 'center', color: COLORS.lightMuted, fontSize: 14, lineHeight: 21 },
  emptyCta: { marginTop: 18, backgroundColor: COLORS.green, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  emptyCtaText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Modale
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: COLORS.card, borderRadius: 22, padding: 22, width: '92%', maxWidth: 420, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 15, color: COLORS.muted, fontWeight: '700' },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8, marginTop: 12 },
  fieldRow: { flexDirection: 'row' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.ink, backgroundColor: '#fff' },
  textArea: { height: 84, textAlignVertical: 'top' },

  // Sélecteur mois
  monthPill: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, backgroundColor: '#f1f5f9', marginRight: 6, marginBottom: 4 },
  monthPillActive: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, backgroundColor: COLORS.green, marginRight: 6, marginBottom: 4 },
  monthPillText: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  monthPillActiveText: { fontSize: 12, color: '#fff', fontWeight: '700' },

  // Méthodes paiement
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 11, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: 'transparent' },
  methodChipActive: { backgroundColor: '#ecfdf5', borderColor: COLORS.green },
  methodChipText: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  methodChipTextActive: { color: '#047857', fontWeight: '700' },

  // Actions modale
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { color: COLORS.muted, fontWeight: '700', fontSize: 14 },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.green, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});