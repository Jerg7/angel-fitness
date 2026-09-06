import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const router = useRouter();

  const [isSignUp, setIsSignUp] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);

  // Form Fields
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  
  // Birth date inputs
  const [day, setDay] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [year, setYear] = useState<string>('');

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Campos incompletos', 'Por favor ingresa tu correo electrónico y contraseña.');
      return;
    }

    if (isSignUp) {
      if (!fullName.trim()) {
        Alert.alert('Nombre requerido', 'Por favor ingresa tu nombre completo.');
        return;
      }

      const numDay = parseInt(day, 10);
      const numMonth = parseInt(month, 10);
      const numYear = parseInt(year, 10);

      if (
        isNaN(numDay) || numDay < 1 || numDay > 31 ||
        isNaN(numMonth) || numMonth < 1 || numMonth > 12 ||
        isNaN(numYear) || numYear < 1920 || numYear > new Date().getFullYear()
      ) {
        Alert.alert('Fecha inválida', 'Por favor ingresa una fecha de nacimiento válida (Día, Mes, Año).');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        // Formatear fecha YYYY-MM-DD
        const formattedDay = day.padStart(2, '0');
        const formattedMonth = month.padStart(2, '0');
        const birthDateStr = `${year}-${formattedMonth}-${formattedDay}`;

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });

        if (error) {
          Alert.alert('Error de Registro', error.message);
          setLoading(false);
          return;
        }

        const user = data.user;
        if (user) {
          // Prepare profile data with fallback for missing schema columns
          const numYear = parseInt(year, 10);
          const computedAge = !isNaN(numYear) ? new Date().getFullYear() - numYear : 25;

          const profilePayload: Record<string, any> = {
            id: user.id,
            full_name: fullName.trim(),
            birth_date: birthDateStr,
            age: computedAge,
            updated_at: new Date().toISOString(),
          };

          let { error: profileError } = await supabase.from('profiles').upsert(profilePayload);

          if (profileError && profileError.message?.includes('birth_date')) {
            // Fallback if birth_date column doesn't exist in Supabase DB schema
            delete profilePayload.birth_date;
            const retry = await supabase.from('profiles').upsert(profilePayload);
            profileError = retry.error;
          }

          if (profileError && profileError.message?.includes('full_name')) {
            // Fallback if full_name column doesn't exist in Supabase DB schema
            delete profilePayload.full_name;
            const retry2 = await supabase.from('profiles').upsert(profilePayload);
            profileError = retry2.error;
          }

          if (profileError) {
            console.warn('Advertencia al guardar perfil en Supabase:', profileError);
          }

          // Redirigir a evaluación biométrica (PASO 2)
          router.replace('/biometrics');
        } else {
          Alert.alert('Registro Iniciado', 'Por favor revisa tu correo electrónico para confirmar la cuenta.');
        }
      } else {
        // Iniciar Sesión
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });

        if (error) {
          Alert.alert('Error de Inicio de Sesión', error.message);
          setLoading(false);
          return;
        }

        if (data.user) {
          // Check profile completion to decide route
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profile?.height) {
            router.replace('/(tabs)/exercises');
          } else {
            router.replace('/biometrics');
          }
        }
      }
    } catch (err: any) {
      console.error('Error en autenticación:', err);
      Alert.alert('Error Inesperado', err.message || 'Ocurrió un error al procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          
          {/* Header Brand */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <MaterialCommunityIcons name="flash" size={24} color={Colors.primaryContainer} />
              </View>
              <View>
                <Text style={styles.brandTitle}>ANGEL</Text>
                <Text style={styles.brandSubtitle}>KINETIC PERFORMANCE</Text>
              </View>
            </View>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>PASO 1 DE 4</Text>
            </View>
          </View>

          {/* Title Banner */}
          <View style={styles.headingSection}>
            <Text style={styles.mainTitle}>
              {isSignUp ? 'Crear Cuenta Athletic' : 'Bienvenido de Nuevo'}
            </Text>
            <Text style={styles.mainDescription}>
              {isSignUp
                ? 'Ingresa tus datos de rendimiento para registrar tu perfil biométrico.'
                : 'Accede a tus rutinas y telemetría de entrenamiento.'}
            </Text>
          </View>

          {/* Mode Switcher Tabs */}
          <View style={styles.tabContainer}>
            <Pressable
              style={[styles.tabBtn, isSignUp && styles.tabBtnActive]}
              onPress={() => setIsSignUp(true)}>
              <Text style={[styles.tabText, isSignUp && styles.tabTextActive]}>Crear Cuenta</Text>
            </Pressable>
            <Pressable
              style={[styles.tabBtn, !isSignUp && styles.tabBtnActive]}
              onPress={() => setIsSignUp(false)}>
              <Text style={[styles.tabText, !isSignUp && styles.tabTextActive]}>Iniciar Sesión</Text>
            </Pressable>
          </View>

          {/* Form Container */}
          <View style={styles.formContainer}>
            {isSignUp && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NOMBRE COMPLETO</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="person" size={20} color={Colors.onSurfaceVariant} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. Alexander Vance"
                    placeholderTextColor={Colors.outline}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>CORREO ELECTRÓNICO</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="email" size={20} color={Colors.onSurfaceVariant} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="atleta@angel.app"
                  placeholderTextColor={Colors.outline}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>CONTRASEÑA</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="lock" size={20} color={Colors.onSurfaceVariant} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••••••"
                  placeholderTextColor={Colors.outline}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            {isSignUp && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>FECHA DE NACIMIENTO</Text>
                <View style={styles.dateRow}>
                  <View style={[styles.inputWrapper, { flex: 1 }]}>
                    <TextInput
                      style={[styles.input, { textAlign: 'center' }]}
                      placeholder="DD"
                      placeholderTextColor={Colors.outline}
                      value={day}
                      onChangeText={setDay}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  <Text style={styles.dateSeparator}>/</Text>
                  <View style={[styles.inputWrapper, { flex: 1 }]}>
                    <TextInput
                      style={[styles.input, { textAlign: 'center' }]}
                      placeholder="MM"
                      placeholderTextColor={Colors.outline}
                      value={month}
                      onChangeText={setMonth}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  <Text style={styles.dateSeparator}>/</Text>
                  <View style={[styles.inputWrapper, { flex: 1.4 }]}>
                    <TextInput
                      style={[styles.input, { textAlign: 'center' }]}
                      placeholder="AAAA"
                      placeholderTextColor={Colors.outline}
                      value={year}
                      onChangeText={setYear}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Primary Submit Button */}
            <Pressable
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleAuth}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color={Colors.onPrimaryContainer} />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>
                    {isSignUp ? 'Registrar y Continuar' : 'Iniciar Sesión'}
                  </Text>
                  <MaterialIcons name="arrow-forward" size={20} color={Colors.onPrimaryContainer} />
                </>
              )}
            </Pressable>
          </View>

          {/* Footer Security Badge */}
          <View style={styles.securityRow}>
            <MaterialIcons name="security" size={14} color={Colors.primaryContainer} />
            <Text style={styles.securityText}>Encriptación de grado atlético • Supabase Auth</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  brandTitle: {
    color: Colors.onSurface,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  headingSection: {
    marginBottom: Spacing.lg,
  },
  mainTitle: {
    color: Colors.onSurface,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  mainDescription: {
    color: Colors.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLow,
    padding: 4,
    borderRadius: Radii.lg,
    marginBottom: Spacing.lg,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: Radii.md,
  },
  tabBtnActive: {
    backgroundColor: Colors.surfaceBright,
    borderWidth: 1,
    borderColor: Colors.activeBorderTranslucent,
  },
  tabText: {
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.onSurface,
    fontWeight: '800',
  },
  formContainer: {
    gap: Spacing.md,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 15,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateSeparator: {
    color: Colors.outline,
    fontSize: 18,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: Colors.primaryContainer,
    height: 54,
    borderRadius: Radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: Colors.onPrimaryContainer,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.xl,
  },
  securityText: {
    color: Colors.outline,
    fontSize: 12,
  },
});
