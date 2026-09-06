import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const checkSessionAndNavigate = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        // Si no hay usuario, o es anónimo / correo temporal -> Ir a PASO 1 (Auth)
        if (!user || user.is_anonymous || user.email?.startsWith('athlete_')) {
          if (isMounted) router.replace('/auth');
          return;
        }

        // Hay usuario autenticado real -> Verificar datos biométricos
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile?.height) {
          // Biometría completa -> Ir a app principal
          if (isMounted) router.replace('/(tabs)/exercises');
        } else {
          // Falta biometría -> Ir a PASO 2 (Biometrics)
          if (isMounted) router.replace('/biometrics');
        }
      } catch (err) {
        console.warn('Error verificando estado de sesión:', err);
        if (isMounted) router.replace('/auth');
      }
    };

    checkSessionAndNavigate();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.logoBadge}>
        <MaterialCommunityIcons name="flash" size={32} color={Colors.primaryContainer} />
      </View>
      <Text style={styles.brandTitle}>ANGEL</Text>
      <Text style={styles.brandSubtitle}>KINETIC PERFORMANCE</Text>
      <ActivityIndicator size="large" color={Colors.primaryContainer} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  brandTitle: {
    color: Colors.onSurface,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandSubtitle: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 2,
  },
  loader: {
    marginTop: Spacing.xl,
  },
});
