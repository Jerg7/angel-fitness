import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Gender = 'hombre' | 'mujer' | 'otro';

export default function BiometricsScreen() {
  const router = useRouter();

  const [gender, setGender] = useState<Gender>('hombre');
  const [height, setHeight] = useState<number>(178);
  const [weight, setWeight] = useState<number>(74.2);
  const [age, setAge] = useState<number>(26);

  const [saving, setSaving] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);

  // Load existing profile & weight log from Supabase if present
  useEffect(() => {
    let isMounted = true;
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || user.is_anonymous || user.email?.startsWith('athlete_')) {
          if (isMounted) router.replace('/auth');
          return;
        }

        // Fetch profile with select('*') to safely avoid missing column errors
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile && isMounted) {
          if (profile.height) setHeight(profile.height);
          if (profile.gender) setGender(profile.gender as Gender);

          if (profile.birth_date) {
            const birthYear = new Date(profile.birth_date).getFullYear();
            if (!isNaN(birthYear) && birthYear > 1900) {
              setAge(new Date().getFullYear() - birthYear);
            }
          } else if (profile.age) {
            setAge(profile.age);
          }
        }

        // Fetch latest weight log
        const { data: weightLogs } = await supabase
          .from('body_weight_logs')
          .select('weight')
          .eq('user_id', user.id)
          .order('recorded_at', { ascending: false })
          .limit(1);

        if (weightLogs && weightLogs.length > 0 && isMounted) {
          setWeight(weightLogs[0].weight);
        }
      } catch (err) {
        console.log('Error cargando datos de Supabase:', err);
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    };

    loadUserData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Calculate BMI
  const heightInMeters = height / 100;
  const bmiRaw = weight / (heightInMeters * heightInMeters);
  const bmi = isNaN(bmiRaw) || bmiRaw <= 0 ? 0 : parseFloat(bmiRaw.toFixed(1));

  // Determine Category & Color
  const getBmiCategory = (val: number) => {
    if (val < 18.5) {
      return {
        label: 'Bajo peso',
        color: Colors.bmiUnderweight,
        badgeText: 'ZONA BAJA • NUTRICIÓN REQUERIDA',
      };
    } else if (val <= 24.9) {
      return {
        label: 'Peso saludable',
        color: Colors.bmiNormal,
        badgeText: 'ZONA ÓPTIMA • PESO SALUDABLE',
      };
    } else if (val <= 29.9) {
      return {
        label: 'Sobrepeso',
        color: Colors.bmiOverweight,
        badgeText: 'ZONA MODERADA • SOBREPESO LEVE',
      };
    } else {
      return {
        label: 'Obesidad',
        color: Colors.bmiObesity,
        badgeText: 'ZONA ELEVADA • CONTROL RECOMENDADO',
      };
    }
  };

  const bmiInfo = getBmiCategory(bmi);

  // Approximate Basal Metabolic Rate
  const bmr = Math.round(
    gender === 'mujer'
      ? 655 + 9.6 * weight + 1.8 * height - 4.7 * age
      : 66 + 13.7 * weight + 5.0 * height - 6.8 * age
  );

  // Approximate Body Fat estimation
  const bodyFat = Math.max(
    8,
    Math.min(45, (1.2 * bmi + 0.23 * age - (gender === 'hombre' ? 16.2 : 5.4)).toFixed(1) as any)
  );

  const handleSaveAndContinue = async () => {
    setSaving(true);
    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();

      if (userErr || !user) {
        Alert.alert('Error de Autenticación', 'No existe una sesión activa de usuario.');
        setSaving(false);
        return;
      }

      // 1. Upsert Profile Data (height, weight, gender, age)
      const profileData: Record<string, any> = {
        id: user.id,
        height: height,
        weight: weight,
        gender: gender,
        age: age,
        updated_at: new Date().toISOString(),
      };

      let { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData);

      if (profileError) {
        // Retry without weight column if profiles schema doesn't include it
        delete profileData.weight;
        const retryRes = await supabase.from('profiles').upsert(profileData);
        profileError = retryRes.error;
      }

      if (profileError) {
        console.error('Error al guardar perfil:', profileError);
        Alert.alert('Error al guardar perfil', profileError.message);
        setSaving(false);
        return;
      }

      // 2. Insert Body Weight Log
      const { error: weightError } = await supabase
        .from('body_weight_logs')
        .insert({
          user_id: user.id,
          weight: weight,
          recorded_at: new Date().toISOString(),
        });

      if (weightError) {
        console.error('Error al guardar registro de peso:', weightError);
        Alert.alert('Error al guardar peso', weightError.message);
        setSaving(false);
        return;
      }

      // Success -> navigate to exercises
      router.replace('/(tabs)/exercises');
    } catch (err: any) {
      console.error('Excepción guardando en Supabase:', err);
      Alert.alert('Error Inesperado', err.message || 'No se pudo completar el guardado.');
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primaryContainer} />
          <Text style={styles.loadingText}>Cargando parámetros biométricos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="flash" size={20} color={Colors.primaryContainer} />
            </View>
            <Text style={styles.brandTitle}>ANGEL</Text>
            <Text style={styles.brandSubtitle}>KINETIC</Text>
          </View>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>PASO 2 DE 2</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>EVALUACIÓN BIOMÉTRICA</Text>
            <Text style={styles.progressPercent}>Paso 2 de 2 • 100%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>
        </View>

        {/* Title & Description */}
        <View style={styles.headingSection}>
          <Text style={styles.mainTitle}>Evaluación Biométrica</Text>
          <Text style={styles.mainDescription}>
            Personaliza tu índice metabólico y volumen óptimo de entrenamiento.
          </Text>
        </View>

        {/* Core Calibration Accent Banner */}
        <View style={styles.accentBanner}>
          <View style={styles.accentIconWrap}>
            <MaterialCommunityIcons name="lightning-bolt" size={24} color={Colors.primaryContainer} />
          </View>
          <View style={styles.accentTextWrap}>
            <Text style={styles.accentTitle}>Calibración Kinetix Core</Text>
            <Text style={styles.accentSub}>Precisión biomecánica basada en tus parámetros basales.</Text>
          </View>
        </View>

        {/* Gender Selector */}
        <View style={styles.sectionContainer}>
          <Text style={styles.fieldLabel}>GÉNERO BIOLÓGICO</Text>
          <View style={styles.genderRow}>
            {(['hombre', 'mujer', 'otro'] as Gender[]).map((g) => {
              const isSelected = gender === g;
              return (
                <Pressable
                  key={g}
                  style={[styles.genderBtn, isSelected && styles.genderBtnSelected]}
                  onPress={() => setGender(g)}>
                  {isSelected && <View style={styles.activeDot} />}
                  <Text style={[styles.genderText, isSelected && styles.genderTextSelected]}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Numeric Biometric Controls */}
        <View style={styles.biometricGrid}>
          {/* Height */}
          <View style={styles.bioCard}>
            <View style={styles.bioCardHeader}>
              <Text style={styles.bioCardLabel}>ALTURA</Text>
              <MaterialCommunityIcons name="human-male-height" size={16} color={Colors.primaryContainer} />
            </View>
            <View style={styles.bioValueWrap}>
              <Text style={styles.bioValue}>{height}</Text>
              <Text style={styles.bioUnit}>cm</Text>
            </View>
            <View style={styles.counterBtnRow}>
              <Pressable
                style={styles.counterBtn}
                onPress={() => setHeight((prev) => Math.max(120, prev - 1))}>
                <MaterialIcons name="remove" size={16} color={Colors.onSurface} />
              </Pressable>
              <Pressable
                style={styles.counterBtn}
                onPress={() => setHeight((prev) => Math.min(230, prev + 1))}>
                <MaterialIcons name="add" size={16} color={Colors.onSurface} />
              </Pressable>
            </View>
          </View>

          {/* Weight */}
          <View style={styles.bioCard}>
            <View style={styles.bioCardHeader}>
              <Text style={styles.bioCardLabel}>PESO</Text>
              <MaterialCommunityIcons name="scale-bathroom" size={16} color={Colors.secondary} />
            </View>
            <View style={styles.bioValueWrap}>
              <Text style={styles.bioValue}>{weight.toFixed(1)}</Text>
              <Text style={[styles.bioUnit, { color: Colors.primaryContainer }]}>kg</Text>
            </View>
            <View style={styles.counterBtnRow}>
              <Pressable
                style={styles.counterBtn}
                onPress={() => setWeight((prev) => Math.max(35, parseFloat((prev - 0.5).toFixed(1))))}>
                <MaterialIcons name="remove" size={16} color={Colors.onSurface} />
              </Pressable>
              <Pressable
                style={styles.counterBtn}
                onPress={() => setWeight((prev) => Math.min(200, parseFloat((prev + 0.5).toFixed(1))))}>
                <MaterialIcons name="add" size={16} color={Colors.onSurface} />
              </Pressable>
            </View>
          </View>

          {/* Age (Auto-calculada desde fecha de nacimiento) */}
          <View style={styles.bioCard}>
            <View style={styles.bioCardHeader}>
              <Text style={styles.bioCardLabel}>EDAD</Text>
              <MaterialCommunityIcons name="cake-variant" size={16} color={Colors.tertiary} />
            </View>
            <View style={styles.bioValueWrap}>
              <Text style={styles.bioValue}>{age}</Text>
              <Text style={styles.bioUnit}>años</Text>
            </View>
            <View style={{ height: 32, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: Colors.outline, fontSize: 10, textAlign: 'center' }}>Autocalculada</Text>
            </View>
          </View>
        </View>

        {/* Dynamic BMI & Telemetry Gauge Card */}
        <View style={styles.bmiGaugeCard}>
          <View style={styles.bmiGaugeHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons name="scale" size={18} color={Colors.primaryContainer} />
              <Text style={styles.fieldLabel}>ÍNDICE DE MASA CORPORAL</Text>
            </View>
            <View style={styles.liveTag}>
              <Text style={styles.liveTagText}>TELEMETRÍA EN VIVO</Text>
            </View>
          </View>

          {/* Center Metric Display */}
          <View style={styles.bmiMetricCenter}>
            <Text style={styles.bmiNumber}>{bmi}</Text>
            <Text style={styles.bmiMetricSub}>IMC CALCULADO</Text>

            {/* Dynamic Status Pill */}
            <View style={[styles.bmiStatusPill, { backgroundColor: `${bmiInfo.color}20` }]}>
              <View style={[styles.bmiStatusDot, { backgroundColor: bmiInfo.color }]} />
              <Text style={[styles.bmiStatusText, { color: bmiInfo.color }]}>
                {bmiInfo.label} • {bmiInfo.badgeText}
              </Text>
            </View>
          </View>

          {/* Color Breakdown Scale Strip */}
          <View style={styles.scaleStrip}>
            <View
              style={[
                styles.scaleItem,
                bmi < 18.5 && { backgroundColor: `${Colors.bmiUnderweight}30`, borderColor: Colors.bmiUnderweight, borderWidth: 1 },
              ]}>
              <Text style={[styles.scaleTitle, bmi < 18.5 && { color: Colors.bmiUnderweight, fontWeight: '700' }]}>
                Bajo
              </Text>
              <Text style={styles.scaleRange}>&lt; 18.5</Text>
            </View>

            <View
              style={[
                styles.scaleItem,
                bmi >= 18.5 && bmi <= 24.9 && { backgroundColor: `${Colors.bmiNormal}30`, borderColor: Colors.bmiNormal, borderWidth: 1 },
              ]}>
              <Text style={[styles.scaleTitle, bmi >= 18.5 && bmi <= 24.9 && { color: Colors.bmiNormal, fontWeight: '700' }]}>
                Normal
              </Text>
              <Text style={styles.scaleRange}>18.5 - 24.9</Text>
            </View>

            <View
              style={[
                styles.scaleItem,
                bmi >= 25.0 && bmi <= 29.9 && { backgroundColor: `${Colors.bmiOverweight}30`, borderColor: Colors.bmiOverweight, borderWidth: 1 },
              ]}>
              <Text style={[styles.scaleTitle, bmi >= 25.0 && bmi <= 29.9 && { color: Colors.bmiOverweight, fontWeight: '700' }]}>
                Sobrepeso
              </Text>
              <Text style={styles.scaleRange}>25 - 29.9</Text>
            </View>

            <View
              style={[
                styles.scaleItem,
                bmi >= 30.0 && { backgroundColor: `${Colors.bmiObesity}30`, borderColor: Colors.bmiObesity, borderWidth: 1 },
              ]}>
              <Text style={[styles.scaleTitle, bmi >= 30.0 && { color: Colors.bmiObesity, fontWeight: '700' }]}>
                Obesidad
              </Text>
              <Text style={styles.scaleRange}>&gt; 30.0</Text>
            </View>
          </View>

          {/* Secondary Telemetry Output */}
          <View style={styles.telemetryRow}>
            <View style={styles.telemetryBox}>
              <View style={styles.telemetryBoxHeader}>
                <MaterialCommunityIcons name="water" size={14} color={Colors.tertiary} />
                <Text style={styles.telemetryBoxLabel}>Grasa Corporal</Text>
              </View>
              <Text style={styles.telemetryBoxVal}>{bodyFat}%</Text>
              <Text style={[styles.telemetryBoxSub, { color: Colors.tertiary }]}>Estimación basal</Text>
            </View>

            <View style={styles.telemetryBox}>
              <View style={styles.telemetryBoxHeader}>
                <MaterialCommunityIcons name="fire" size={14} color={Colors.secondary} />
                <Text style={styles.telemetryBoxLabel}>Metabolismo Basal</Text>
              </View>
              <Text style={styles.telemetryBoxVal}>
                {bmr.toLocaleString()} <Text style={styles.unitSmall}>kcal</Text>
              </Text>
              <Text style={[styles.telemetryBoxSub, { color: Colors.secondary }]}>TMB calculada</Text>
            </View>
          </View>
        </View>

        {/* Primary CTA Button */}
        <View style={styles.ctaSection}>
          <Pressable
            style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
            onPress={handleSaveAndContinue}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator color={Colors.onPrimaryContainer} />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Guardar y Continuar</Text>
                <MaterialIcons name="arrow-forward" size={20} color={Colors.onPrimaryContainer} />
              </>
            )}
          </Pressable>
          <View style={styles.securityRow}>
            <MaterialIcons name="lock" size={12} color={Colors.primaryContainer} />
            <Text style={styles.securityText}>Sincronizado con Supabase Cloud DB</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    marginTop: Spacing.md,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  brandTitle: {
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  brandSubtitle: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  stepBadge: {
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  stepBadgeText: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  progressContainer: {
    marginBottom: Spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    color: Colors.primaryContainer,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  progressPercent: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radii.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primaryContainer,
    borderRadius: Radii.full,
  },
  headingSection: {
    marginBottom: Spacing.md,
  },
  mainTitle: {
    color: Colors.onSurface,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  mainDescription: {
    color: Colors.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 20,
  },
  accentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainer,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
    gap: Spacing.sm,
  },
  accentIconWrap: {
    width: 42,
    height: 42,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentTextWrap: {
    flex: 1,
  },
  accentTitle: {
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
  },
  accentSub: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    marginTop: 2,
  },
  sectionContainer: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  genderRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLow,
    padding: 4,
    borderRadius: Radii.lg,
    gap: 4,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.md,
    flexDirection: 'row',
    gap: 6,
  },
  genderBtnSelected: {
    backgroundColor: Colors.surfaceBright,
    borderColor: Colors.activeBorderTranslucent,
    borderWidth: 1,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryContainer,
  },
  genderText: {
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    fontWeight: '600',
  },
  genderTextSelected: {
    color: Colors.onSurface,
  },
  biometricGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  bioCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainer,
    padding: Spacing.sm,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
    justifyContent: 'space-between',
  },
  bioCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bioCardLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  bioValueWrap: {
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  bioValue: {
    color: Colors.onSurface,
    fontSize: 22,
    fontWeight: '800',
  },
  bioUnit: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    marginTop: -2,
  },
  counterBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bmiGaugeCard: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  bmiGaugeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  liveTag: {
    backgroundColor: `${Colors.primaryContainer}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  liveTagText: {
    color: Colors.primaryContainer,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  bmiMetricCenter: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  bmiNumber: {
    color: Colors.onSurface,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1,
  },
  bmiMetricSub: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  bmiStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    marginTop: 10,
  },
  bmiStatusDot: {
    width: 8,
    height: 8,
    borderRadius: Radii.full,
  },
  bmiStatusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scaleStrip: {
    flexDirection: 'row',
    gap: 6,
    marginTop: Spacing.md,
    backgroundColor: Colors.surfaceContainerLow,
    padding: 6,
    borderRadius: Radii.lg,
  },
  scaleItem: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: Radii.md,
  },
  scaleTitle: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '500',
  },
  scaleRange: {
    color: Colors.outline,
    fontSize: 9,
    marginTop: 2,
  },
  telemetryRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  telemetryBox: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerHigh,
    padding: Spacing.xs,
    borderRadius: Radii.md,
  },
  telemetryBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  telemetryBoxLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
  },
  telemetryBoxVal: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  unitSmall: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    fontWeight: '400',
  },
  telemetryBoxSub: {
    fontSize: 10,
    marginTop: 2,
  },
  ctaSection: {
    marginTop: Spacing.xs,
  },
  primaryBtn: {
    height: 52,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    elevation: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: Colors.onPrimaryContainer,
    fontSize: 16,
    fontWeight: '800',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  securityText: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
  },
});
