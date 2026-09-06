import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Modal,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

interface WeightLog {
  id?: string;
  weight: number;
  recorded_at: string;
}

interface SharedRoutineItem {
  id?: string;
  partner_code: string;
  routine_title?: string;
  created_at: string;
}

export default function ProfileScreen() {
  const router = useRouter();

  const [copiedAlert, setCopiedAlert] = useState<boolean>(false);
  const [qrModalVisible, setQrModalVisible] = useState<boolean>(false);

  // Profile Data State
  const [loadingDb, setLoadingDb] = useState<boolean>(true);
  const [fullName, setFullName] = useState<string>('Atleta Kinetix');
  const [userEmail, setUserEmail] = useState<string>('');
  const [age, setAge] = useState<number>(25);
  const [height, setHeight] = useState<number>(178);
  const [weight, setWeight] = useState<number>(74.2);
  const [inviteCode, setInviteCode] = useState<string>('KNTX-9481');

  // Edit Profile Modal
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [editNameInput, setEditNameInput] = useState<string>('');
  const [editHeightInput, setEditHeightInput] = useState<string>('');
  const [editWeightInput, setEditWeightInput] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);

  // Shared Routines State
  const [sharedRoutines, setSharedRoutines] = useState<SharedRoutineItem[]>([]);
  const [partnerCodeInput, setPartnerCodeInput] = useState<string>('');
  const [linkingPartner, setLinkingPartner] = useState<boolean>(false);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);

  const fetchUserData = async () => {
    try {
      setLoadingDb(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUserEmail(user.email || '');

        // Generate unique code based on User ID
        const generatedCode = `KNTX-${user.id.slice(0, 5).toUpperCase()}`;
        setInviteCode(generatedCode);

        // 1. Fetch Profile Data
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          if (profile.full_name) setFullName(profile.full_name);
          if (profile.height) setHeight(profile.height);

          // Calculate age dynamically from birth_date or age column
          if (profile.birth_date) {
            const birthYear = new Date(profile.birth_date).getFullYear();
            if (!isNaN(birthYear) && birthYear > 1900) {
              setAge(new Date().getFullYear() - birthYear);
            }
          } else if (profile.age) {
            setAge(profile.age);
          }
        }

        // 2. Fetch Weight Logs
        const { data: logs } = await supabase
          .from('body_weight_logs')
          .select('id, weight, recorded_at')
          .eq('user_id', user.id)
          .order('recorded_at', { ascending: true });

        if (logs && logs.length > 0) {
          setWeightLogs(logs);
          setWeight(logs[logs.length - 1].weight);
        } else if (profile?.weight) {
          setWeight(profile.weight);
        }

        // 3. Fetch Shared Routines
        const { data: shared } = await supabase
          .from('shared_routines')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (shared && shared.length > 0) {
          setSharedRoutines(shared);
        }
      }
    } catch (err) {
      console.log('Error cargando perfil de Supabase:', err);
    } finally {
      setLoadingDb(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const handleOpenEditModal = () => {
    setEditNameInput(fullName);
    setEditHeightInput(String(height));
    setEditWeightInput(String(weight));
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    const numHeight = parseInt(editHeightInput, 10);
    const numWeight = parseFloat(editWeightInput);

    if (!editNameInput.trim()) {
      Alert.alert('Nombre Requerido', 'Por favor ingresa tu nombre.');
      return;
    }

    if (isNaN(numHeight) || numHeight < 100 || numHeight > 240) {
      Alert.alert('Altura Inválida', 'Por favor ingresa una altura válida en cm.');
      return;
    }

    if (isNaN(numWeight) || numWeight < 30 || numWeight > 300) {
      Alert.alert('Peso Inválido', 'Por favor ingresa un peso válido en kg.');
      return;
    }

    setSavingProfile(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // 1. Update Profiles Table
        const profileData: Record<string, any> = {
          id: user.id,
          full_name: editNameInput.trim(),
          height: numHeight,
          weight: numWeight,
          updated_at: new Date().toISOString(),
        };

        let { error: profileErr } = await supabase.from('profiles').upsert(profileData);

        if (profileErr) {
          delete profileData.weight;
          const retry = await supabase.from('profiles').upsert(profileData);
          profileErr = retry.error;
        }

        // 2. Insert new Weight log
        await supabase.from('body_weight_logs').insert({
          user_id: user.id,
          weight: numWeight,
          recorded_at: new Date().toISOString(),
        });

        if (profileErr) {
          Alert.alert('Error', profileErr.message);
        } else {
          Alert.alert('¡Perfil Actualizado!', 'Tus datos se guardaron correctamente en Supabase.');
          setFullName(editNameInput.trim());
          setHeight(numHeight);
          setWeight(numWeight);
          setEditModalVisible(false);
          fetchUserData();
        }
      }
    } catch (err: any) {
      console.error('Error guardando perfil:', err);
      Alert.alert('Error Inesperado', err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLinkPartner = async () => {
    const code = partnerCodeInput.trim().toUpperCase();
    if (!code) {
      Alert.alert('Código Requerido', 'Ingresa el código del atleta para vincular.');
      return;
    }

    setLinkingPartner(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const payload = {
          user_id: user.id,
          partner_code: code,
          routine_title: `Rutina Compartida (${code})`,
          created_at: new Date().toISOString(),
        };

        const { error: linkErr } = await supabase.from('shared_routines').insert(payload);

        if (linkErr) {
          console.error('Error vinculando rutina:', linkErr);
          Alert.alert('Error de Vinculación', linkErr.message);
        } else {
          Alert.alert('¡Atleta Vinculado!', `Te has vinculado exitosamente con el código ${code}.`);
          setPartnerCodeInput('');
          fetchUserData();
        }
      }
    } catch (err: any) {
      console.error('Excepción vinculando atleta:', err);
      Alert.alert('Error Inesperado', err.message);
    } finally {
      setLinkingPartner(false);
    }
  };

  const handleCopyCode = () => {
    setCopiedAlert(true);
    setTimeout(() => {
      setCopiedAlert(false);
    }, 2200);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas salir de tu cuenta en ANGEL?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              router.replace('/auth');
            } catch (err: any) {
              console.error('Error al cerrar sesión:', err);
              Alert.alert('Error', err.message || 'No se pudo cerrar la sesión.');
            }
          },
        },
      ]
    );
  };

  // Derive weight stats
  const latestWeight = weight;
  const initialWeight = weightLogs.length > 0 ? weightLogs[0].weight : weight;
  const weightDiff = (latestWeight - initialWeight).toFixed(1);
  const diffFormatted = parseFloat(weightDiff) <= 0 ? `${weightDiff} kg` : `+${weightDiff} kg`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Header Identity Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarCircle}>
                <MaterialCommunityIcons name="account" size={36} color={Colors.onSurface} />
              </View>
              <View style={styles.avatarOnlineDot} />
            </View>

            <View style={styles.identityTextWrap}>
              <View style={styles.nameRow}>
                <Text style={styles.athleteName}>{fullName}</Text>
                <MaterialIcons name="verified" size={18} color={Colors.primaryContainer} />
              </View>
              <Text style={styles.athleteHandle}>
                Atleta Kinetix • {age} años • {userEmail}
              </Text>
              <Text style={styles.athleteBio} numberOfLines={2}>
                Altura: {height} cm • Peso actual: {weight.toFixed(1)} kg
              </Text>
            </View>

            {/* Quick Sign Out Icon Button */}
            <Pressable style={styles.signOutHeaderBtn} onPress={handleSignOut}>
              <MaterialIcons name="logout" size={20} color={Colors.error} />
            </Pressable>
          </View>

          {/* Edit Profile Action Bar */}
          <View style={styles.tierStrip}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons name="lightning-bolt" size={16} color={Colors.tertiary} />
              <Text style={styles.tierText}>Estado Biométrico en Supabase</Text>
            </View>
            <Pressable style={styles.editProfileBtn} onPress={handleOpenEditModal}>
              <MaterialIcons name="edit" size={14} color={Colors.onPrimaryContainer} />
              <Text style={styles.editProfileBtnText}>Editar Perfil</Text>
            </Pressable>
          </View>
        </View>

        {/* 3-Column Metric Stat Cards */}
        <View style={styles.statsGrid}>
          {/* Stat 1: Weight */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardLabel}>Peso Actual</Text>
              <MaterialCommunityIcons name="scale-bathroom" size={14} color={Colors.primaryContainer} />
            </View>
            <Text style={styles.statCardVal}>
              {latestWeight.toFixed(1)} <Text style={styles.statCardUnit}>kg</Text>
            </Text>
            <View style={styles.statCardTrend}>
              <MaterialIcons name="trending-down" size={12} color={Colors.primaryContainer} />
              <Text style={styles.statCardTrendText}>{diffFormatted}</Text>
            </View>
          </View>

          {/* Stat 2: Height */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardLabel}>Altura</Text>
              <MaterialCommunityIcons name="human-male-height" size={14} color={Colors.secondary} />
            </View>
            <Text style={styles.statCardVal}>
              {height} <Text style={styles.statCardUnit}>cm</Text>
            </Text>
            <Text style={[styles.statCardTrendText, { color: Colors.secondary }]}>Calibrada</Text>
          </View>

          {/* Stat 3: Age */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardLabel}>Edad</Text>
              <MaterialCommunityIcons name="cake-variant" size={14} color={Colors.tertiary} />
            </View>
            <Text style={styles.statCardVal}>
              {age} <Text style={styles.statCardUnit}>años</Text>
            </Text>
            <Text style={[styles.statCardTrendText, { color: Colors.tertiary }]}>Autocalculada</Text>
          </View>
        </View>

        {/* Shared Routines Section */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.sectionTitle}>Rutinas Compartidas</Text>
            <MaterialIcons name="groups" size={18} color={Colors.primaryContainer} />
          </View>
          <View style={styles.syncTag}>
            <View style={styles.syncDot} />
            <Text style={styles.syncTagText}>Sincronizado</Text>
          </View>
        </View>

        {/* Active Shared Routines List */}
        {sharedRoutines.length > 0 ? (
          sharedRoutines.map((item, idx) => (
            <View key={idx} style={styles.sharedCard}>
              <View style={styles.sharedBadge}>
                <MaterialIcons name="sync" size={12} color={Colors.secondary} />
                <Text style={styles.sharedBadgeText}>Vinculación Activa</Text>
              </View>
              <Text style={styles.sharedTitle}>{item.routine_title || `Rutina ${item.partner_code}`}</Text>
              <Text style={styles.sharedFooterText}>
                Vinculado con el código: <Text style={{ color: Colors.primaryContainer, fontWeight: '800' }}>{item.partner_code}</Text>
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.sharedCard}>
            <View style={styles.sharedBadge}>
              <MaterialIcons name="info" size={12} color={Colors.primaryContainer} />
              <Text style={styles.sharedBadgeText}>Sin Vinculación Activa</Text>
            </View>
            <Text style={styles.sharedTitle}>Ingresa el código de un atleta abajo para compartir rutinas.</Text>
          </View>
        )}

        {/* Invite & Link Gym Partner Card */}
        <View style={styles.inviteCard}>
          <View style={styles.inviteHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inviteTitle}>Tu Código Único de Atleta</Text>
              <Text style={styles.inviteSub}>Comparte tu código para sincronizar cargas y rutinas</Text>
            </View>
            <View style={styles.personIconWrap}>
              <MaterialIcons name="qr-code" size={20} color={Colors.primaryContainer} />
            </View>
          </View>

          {/* Code Container */}
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>CÓDIGO DE INVITACIÓN KINETIX</Text>
            <View style={styles.codeRow}>
              <Text style={styles.codeText}>{inviteCode}</Text>
              <Pressable style={styles.copyBtn} onPress={handleCopyCode}>
                <MaterialIcons
                  name={copiedAlert ? 'check' : 'content-copy'}
                  size={18}
                  color={copiedAlert ? Colors.secondary : Colors.onSurfaceVariant}
                />
              </Pressable>
            </View>
            {copiedAlert && (
              <Text style={styles.copiedAlertText}>¡Código copiado al portapapeles!</Text>
            )}
          </View>

          {/* Partner Code Linker Input */}
          <View style={styles.linkPartnerBox}>
            <Text style={styles.codeLabel}>VINCULAR CÓDIGO DE OTRO ATLETA</Text>
            <View style={styles.linkRow}>
              <TextInput
                style={styles.linkInput}
                placeholder="Ej. KNTX-A819"
                placeholderTextColor={Colors.outline}
                value={partnerCodeInput}
                onChangeText={setPartnerCodeInput}
                autoCapitalize="characters"
              />
              <Pressable
                style={[styles.linkBtn, linkingPartner && { opacity: 0.7 }]}
                onPress={handleLinkPartner}
                disabled={linkingPartner}>
                {linkingPartner ? (
                  <ActivityIndicator color={Colors.onPrimaryContainer} size="small" />
                ) : (
                  <Text style={styles.linkBtnText}>Vincular</Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* QR Button */}
          <Pressable style={styles.qrBtn} onPress={() => setQrModalVisible(true)}>
            <MaterialIcons name="qr-code-scanner" size={18} color={Colors.primaryContainer} />
            <Text style={styles.qrBtnText}>Mostrar Código QR de Invitación</Text>
          </Pressable>
        </View>

        {/* Full-width Sign Out Button */}
        <Pressable style={styles.signOutFullBtn} onPress={handleSignOut}>
          <MaterialIcons name="logout" size={20} color={Colors.error} />
          <Text style={styles.signOutFullBtnText}>Cerrar Sesión</Text>
        </Pressable>

        {/* Edit Profile Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={editModalVisible}
          onRequestClose={() => setEditModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar Perfil Biométrico</Text>
                <Pressable onPress={() => setEditModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color={Colors.onSurface} />
                </Pressable>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NOMBRE COMPLETO</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editNameInput}
                  onChangeText={setEditNameInput}
                  placeholder="Tu Nombre"
                  placeholderTextColor={Colors.outline}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ALTURA (CM)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={editHeightInput}
                  onChangeText={setEditHeightInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PESO (KG)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={editWeightInput}
                  onChangeText={setEditWeightInput}
                />
              </View>

              <Pressable
                style={[styles.modalSaveBtn, savingProfile && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}>
                {savingProfile ? (
                  <ActivityIndicator color={Colors.onPrimaryContainer} />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Guardar Cambios en Supabase</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* QR Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={qrModalVisible}
          onRequestClose={() => setQrModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Código QR de Invitación</Text>
                <Pressable onPress={() => setQrModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color={Colors.onSurface} />
                </Pressable>
              </View>

              <View style={styles.qrBoxVisual}>
                <MaterialCommunityIcons name="qrcode" size={180} color={Colors.primaryContainer} />
                <Text style={styles.qrCodeLabel}>{inviteCode}</Text>
              </View>

              <Text style={styles.modalDesc}>
                Escanea este código desde la cámara de otro atleta Kinetix para vincular rutinas.
              </Text>

              <Pressable style={styles.modalCloseBtn} onPress={() => setQrModalVisible(false)}>
                <Text style={styles.modalCloseBtnText}>Cerrar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  profileCard: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  signOutHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${Colors.error}30`,
  },
  signOutFullBtn: {
    height: 52,
    borderRadius: Radii.xl,
    backgroundColor: `${Colors.error}15`,
    borderWidth: 1,
    borderColor: `${Colors.error}40`,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  signOutFullBtnText: {
    color: Colors.error,
    fontSize: 15,
    fontWeight: '800',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primaryContainer,
  },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryContainer,
    borderWidth: 2,
    borderColor: Colors.surfaceContainer,
  },
  identityTextWrap: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  athleteName: {
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: '800',
  },
  athleteHandle: {
    color: Colors.primaryContainer,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  athleteBio: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    marginTop: 4,
  },
  tierStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.xs,
    borderRadius: Radii.lg,
    marginTop: Spacing.md,
  },
  tierText: {
    color: Colors.onSurface,
    fontSize: 11,
    fontWeight: '700',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.full,
    gap: 4,
  },
  editProfileBtnText: {
    color: Colors.onPrimaryContainer,
    fontSize: 11,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainer,
    padding: Spacing.sm,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCardLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
  },
  statCardVal: {
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  statCardUnit: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    fontWeight: '400',
  },
  statCardTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  statCardTrendText: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: '800',
  },
  syncTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.primaryContainer}20`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryContainer,
  },
  syncTagText: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '700',
  },
  sharedCard: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.secondary}20`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  sharedBadgeText: {
    color: Colors.secondary,
    fontSize: 10,
    fontWeight: '700',
  },
  sharedTitle: {
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  sharedFooterText: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
  },
  inviteCard: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  inviteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  inviteTitle: {
    color: Colors.onSurface,
    fontSize: 15,
    fontWeight: '700',
  },
  inviteSub: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    marginTop: 2,
  },
  personIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: `${Colors.primaryContainer}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBox: {
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    marginBottom: Spacing.sm,
  },
  codeLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeText: {
    color: Colors.primaryContainer,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  copyBtn: {
    padding: 6,
  },
  copiedAlertText: {
    color: Colors.secondary,
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  linkPartnerBox: {
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    marginBottom: Spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  linkInput: {
    flex: 1,
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.md,
    height: 42,
    paddingHorizontal: Spacing.sm,
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
  },
  linkBtn: {
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBtnText: {
    color: Colors.onPrimaryContainer,
    fontSize: 13,
    fontWeight: '800',
  },
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
    paddingVertical: 10,
    borderRadius: Radii.lg,
    gap: 6,
  },
  qrBtnText: {
    color: Colors.primaryContainer,
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContent: {
    width: '100%',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: '800',
  },
  inputGroup: {
    marginBottom: Spacing.md,
    gap: 4,
  },
  inputLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.lg,
    height: 46,
    paddingHorizontal: Spacing.md,
    color: Colors.onSurface,
    fontSize: 15,
    fontWeight: '700',
  },
  modalSaveBtn: {
    backgroundColor: Colors.primaryContainer,
    height: 50,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  modalSaveBtnText: {
    color: Colors.onPrimaryContainer,
    fontSize: 15,
    fontWeight: '800',
  },
  qrBoxVisual: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  qrCodeLabel: {
    color: Colors.primaryContainer,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: Spacing.xs,
  },
  modalDesc: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  modalCloseBtn: {
    backgroundColor: Colors.surfaceContainerHigh,
    height: 44,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
  },
});
