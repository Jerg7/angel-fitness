import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Vibration,
  Linking,
} from 'react-native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type RunningMode = 'libre' | 'objetivo' | 'caco';
type CacoPhase = 'caminar' | 'correr';

interface Coord {
  latitude: number;
  longitude: number;
}

// Calculate Haversine distance between two coordinates in kilometers
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function RunningScreen() {
  const [runningMode, setRunningMode] = useState<RunningMode>('caco');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [totalSeconds, setTotalSeconds] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // GPS Telemetry
  const [coords, setCoords] = useState<Coord[]>([]);
  const [distance, setDistance] = useState<number>(0.0);
  const [calories, setCalories] = useState<number>(0);
  const [gpsStatus, setGpsStatus] = useState<string>('Esperando GPS...');
  const [savingSession, setSavingSession] = useState<boolean>(false);

  // CACO (Caminar-Correr) Interval Engine Config
  const [cacoModalVisible, setCacoModalVisible] = useState<boolean>(false);
  const [totalIntervals, setTotalIntervals] = useState<number>(6);
  const [walkMinutes, setWalkMinutes] = useState<number>(2);
  const [runMinutes, setRunMinutes] = useState<number>(3);

  // Live CACO State
  const [currentInterval, setCurrentInterval] = useState<number>(1);
  const [cacoPhase, setCacoPhase] = useState<CacoPhase>('correr');
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState<number>(3 * 60);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Request GPS Permissions on Mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setGpsStatus('Permiso GPS Denegado');
          Alert.alert(
            'Permiso de Ubicación Necesario',
            'Habilita el permiso de ubicación para rastrear la distancia real y ritmo con el GPS.'
          );
        } else {
          setGpsStatus('GPS 5G • Listo');
        }
      } catch (err) {
        console.warn('Error solicitando permisos de ubicación:', err);
      }
    })();
  }, []);

  // GPS Watcher Effect
  useEffect(() => {
    let isSubscribed = true;

    const startGpsTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1500,
            distanceInterval: 3,
          },
          (loc) => {
            if (!isSubscribed) return;
            const { latitude, longitude } = loc.coords;

            setCoords((prev) => {
              if (prev.length > 0) {
                const last = prev[prev.length - 1];
                const addedDist = getHaversineDistance(last.latitude, last.longitude, latitude, longitude);
                if (addedDist > 0.002) { // 2 meters threshold to avoid noise
                  setDistance((d) => parseFloat((d + addedDist).toFixed(2)));
                  setCalories((c) => Math.round(c + addedDist * 65));
                }
              }
              return [...prev, { latitude, longitude }];
            });
            setGpsStatus('GPS Activo • Conectado');
          }
        );
      } catch (err) {
        console.warn('Error iniciando rastreo GPS:', err);
      }
    };

    if (isRunning) {
      startGpsTracking();
    } else if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }

    return () => {
      isSubscribed = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, [isRunning]);

  // Main Live Stopwatch & CACO Interval Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning) {
      interval = setInterval(() => {
        setTotalSeconds((prev) => prev + 1);

        // CACO Countdown Logic
        if (runningMode === 'caco') {
          setPhaseSecondsLeft((prevPhaseSec) => {
            if (prevPhaseSec <= 1) {
              // Trigger vibration feedback on transition
              Vibration.vibrate([0, 400, 200, 400]);

              if (cacoPhase === 'caminar') {
                setCacoPhase('correr');
                return runMinutes * 60;
              } else {
                setCacoPhase('caminar');
                setCurrentInterval((i) => Math.min(totalIntervals, i + 1));
                return walkMinutes * 60;
              }
            }
            return prevPhaseSec - 1;
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, runningMode, cacoPhase, walkMinutes, runMinutes, totalIntervals]);

  // Calculate live pace (min/km)
  const calculatePace = () => {
    if (distance <= 0 || totalSeconds <= 0) return '0:00';
    const paceInSecondsPerKm = Math.round(totalSeconds / distance);
    const paceMins = Math.floor(paceInSecondsPerKm / 60);
    const paceSecs = paceInSecondsPerKm % 60;
    return `${paceMins}:${String(paceSecs).padStart(2, '0')}`;
  };

  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatPhaseTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleToggleRunning = () => {
    if (isLocked) return;
    setIsRunning((prev) => !prev);
  };

  const handleResetRunning = () => {
    if (isLocked) return;
    Alert.alert(
      'Reiniciar Cronómetro',
      '¿Deseas reiniciar la distancia GPS, tiempo e intervalos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reiniciar',
          style: 'destructive',
          onPress: () => {
            setIsRunning(false);
            setTotalSeconds(0);
            setDistance(0.0);
            setCalories(0);
            setCoords([]);
            setCurrentInterval(1);
            setCacoPhase('correr');
            setPhaseSecondsLeft(runMinutes * 60);
          },
        },
      ]
    );
  };

  const handleOpenMusic = async () => {
    try {
      const spotifySupported = await Linking.canOpenURL('spotify://');
      if (spotifySupported) {
        await Linking.openURL('spotify://');
      } else {
        const appleMusicSupported = await Linking.canOpenURL('music://');
        if (appleMusicSupported) {
          await Linking.openURL('music://');
        } else {
          await Linking.openURL('https://open.spotify.com');
        }
      }
    } catch {
      await Linking.openURL('https://open.spotify.com');
    }
  };

  const handleFinishRun = async () => {
    if (totalSeconds === 0 && distance === 0) {
      Alert.alert('Sesión Vacía', 'Inicia el cronómetro para registrar una carrera.');
      return;
    }

    setIsRunning(false);
    setSavingSession(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { error: dbErr } = await supabase.from('running_sessions').insert({
          user_id: user.id,
          distance_km: distance,
          duration_seconds: totalSeconds,
          calories: calories,
          mode: runningMode,
          created_at: new Date().toISOString(),
        });

        if (dbErr) {
          console.error('Error insertando en running_sessions:', dbErr);
          Alert.alert('Error al Guardar', `No se pudo guardar la carrera en Supabase: ${dbErr.message}`);
        } else {
          Alert.alert('¡Carrera Guardada!', `Se registraron ${distance.toFixed(2)} km en Supabase.`);
          // Reset after saving
          setTotalSeconds(0);
          setDistance(0.0);
          setCalories(0);
          setCoords([]);
          setCurrentInterval(1);
        }
      }
    } catch (err: any) {
      console.error('Excepción guardando carrera:', err);
      Alert.alert('Error de Red', err.message || 'No se pudo comunicar con Supabase.');
    } finally {
      setSavingSession(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Brand & Status */}
        <View style={styles.header}>
          <View style={styles.headerBrand}>
            <View style={styles.brandBadge}>
              <MaterialCommunityIcons name="run" size={20} color={Colors.primaryContainer} />
            </View>
            <View>
              <Text style={styles.brandTitle}>ANGEL RUNNING</Text>
              <Text style={styles.brandSub}>GPS REAL & TELEMETRÍA EN VIVO</Text>
            </View>
          </View>
          <View style={styles.gpsSignalBox}>
            <View style={[styles.pulseDot, !isRunning && { backgroundColor: Colors.onSurfaceVariant }]} />
            <Text style={styles.gpsSignalText}>{gpsStatus}</Text>
          </View>
        </View>

        {/* Mode Selector Chips */}
        <View style={styles.modeSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeScroll}>
            <Pressable
              style={[styles.modeChip, runningMode === 'libre' && styles.modeChipSelected]}
              onPress={() => setRunningMode('libre')}>
              <Text style={[styles.modeChipText, runningMode === 'libre' && styles.modeChipTextSelected]}>
                LIBRE
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeChip, runningMode === 'objetivo' && styles.modeChipSelected]}
              onPress={() => setRunningMode('objetivo')}>
              <Text style={[styles.modeChipText, runningMode === 'objetivo' && styles.modeChipTextSelected]}>
                OBJETIVO
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeChip, runningMode === 'caco' && styles.modeChipSelected]}
              onPress={() => {
                setRunningMode('caco');
                setCacoModalVisible(true);
              }}>
              {runningMode === 'caco' && <View style={styles.chipActiveDot} />}
              <Text style={[styles.modeChipText, runningMode === 'caco' && styles.modeChipTextSelected]}>
                INTERVALOS / CACO
              </Text>
              <MaterialIcons name="settings" size={14} color={runningMode === 'caco' ? Colors.onPrimaryContainer : Colors.onSurfaceVariant} />
            </Pressable>
          </ScrollView>
        </View>

        {/* CACO Phase Banner Indicator */}
        {runningMode === 'caco' && (
          <View style={styles.cacoBanner}>
            <View style={styles.cacoLeft}>
              <View style={[styles.cacoPhaseCircle, cacoPhase === 'correr' ? { backgroundColor: Colors.primaryContainer } : { backgroundColor: Colors.tertiary }]}>
                <MaterialCommunityIcons
                  name={cacoPhase === 'correr' ? 'run-fast' : 'walk'}
                  size={20}
                  color={Colors.onPrimaryContainer}
                />
              </View>
              <View>
                <Text style={styles.cacoPhaseTag}>
                  INTERVALO {currentInterval} DE {totalIntervals} • FASE DE {cacoPhase.toUpperCase()}
                </Text>
                <Text style={styles.cacoPhaseCountdown}>{formatPhaseTime(phaseSecondsLeft)}</Text>
              </View>
            </View>
            <Pressable style={styles.configBtn} onPress={() => setCacoModalVisible(true)}>
              <Text style={styles.configBtnText}>Ajustar</Text>
            </Pressable>
          </View>
        )}

        {/* GPS Map Visual Canvas Card */}
        <View style={styles.mapCard}>
          <View style={styles.mapBackground}>
            <MaterialCommunityIcons name="map-marker-path" size={110} color={`${Colors.primaryContainer}15`} />
          </View>

          <View style={styles.mapTopOverlay}>
            <View style={styles.elevationBadge}>
              <MaterialCommunityIcons name="satellite-variant" size={14} color={Colors.primaryContainer} />
              <Text style={styles.elevationText}>{coords.length} Puntos GPS</Text>
            </View>
            <View style={styles.northCompass}>
              <Text style={styles.compassText}>N</Text>
            </View>
          </View>

          {/* Center Live Pin */}
          <View style={styles.centerPinWrap}>
            <View style={[styles.pinPulse, isRunning && { backgroundColor: `${Colors.primaryContainer}40` }]} />
            <View style={styles.pinCircle}>
              <MaterialCommunityIcons
                name={runningMode === 'caco' && cacoPhase === 'caminar' ? 'walk' : 'run'}
                size={18}
                color={Colors.onPrimaryContainer}
              />
            </View>
            <View style={styles.pinLabel}>
              <Text style={styles.pinLabelText}>
                {isRunning ? (cacoPhase === 'caminar' ? 'Caminando' : 'Corriendo') : 'En Pausa'}
              </Text>
            </View>
          </View>

          {/* Bottom Distance Overlay */}
          <View style={styles.mapBottomPin}>
            <MaterialIcons name="flag" size={16} color={Colors.primaryContainer} />
            <Text style={styles.mapDistanceVal}>{distance.toFixed(2)}</Text>
            <Text style={styles.mapDistanceUnit}>km</Text>
          </View>
        </View>

        {/* Primary Dynamic Live Telemetry HUD */}
        <View style={styles.telemetryHUD}>
          {/* Active Elapsed Timer Box */}
          <View style={styles.timerCard}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.pulseDot, !isRunning && { backgroundColor: Colors.onSurfaceVariant }]} />
                <Text style={styles.hudLabel}>{isRunning ? 'TIEMPO TOTAL EN MARCHA' : 'TIEMPO PAUSADO'}</Text>
              </View>
              <Text style={styles.displayTimer}>{formatTime(totalSeconds)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.intervalSub}>
                {runningMode === 'caco' ? `Intervalo ${currentInterval}/${totalIntervals}` : 'Modo Libre'}
              </Text>
              <Text style={styles.intervalTitle}>
                {runningMode === 'caco' ? (cacoPhase === 'correr' ? 'Trote' : 'Caminata') : 'Carrera'}
              </Text>
            </View>
          </View>

          {/* 2-Column Real GPS Telemetry Grid */}
          <View style={styles.hudGrid}>
            {/* Real Distance */}
            <View style={styles.hudBox}>
              <View style={styles.hudBoxHeader}>
                <Text style={styles.hudBoxLabel}>DISTANCIA GPS REAL</Text>
                <MaterialCommunityIcons name="ruler" size={14} color={Colors.primaryContainer} />
              </View>
              <Text style={styles.hudBoxBigVal}>{distance.toFixed(2)}</Text>
              <Text style={styles.hudBoxUnit}>km acumulados</Text>
            </View>

            {/* Real Pace */}
            <View style={styles.hudBox}>
              <View style={styles.hudBoxHeader}>
                <Text style={styles.hudBoxLabel}>RITMO MEDIO REAL</Text>
                <MaterialIcons name="speed" size={14} color={Colors.primaryContainer} />
              </View>
              <Text style={styles.hudBoxBigVal}>{calculatePace()}</Text>
              <Text style={styles.hudBoxUnit}>min/km</Text>
            </View>
          </View>

          {/* Secondary Micro-metrics */}
          <View style={styles.microMetricsRow}>
            {/* Calories */}
            <View style={styles.microBox}>
              <View style={styles.microIconWrap}>
                <MaterialCommunityIcons name="fire" size={18} color={Colors.primaryContainer} />
              </View>
              <View>
                <Text style={styles.microLabel}>Calorías Estimadas</Text>
                <Text style={styles.microVal}>
                  {calories} <Text style={styles.microUnit}>kcal</Text>
                </Text>
              </View>
            </View>

            {/* GPS Telemetry Badge */}
            <View style={styles.microBox}>
              <View style={styles.microIconWrap}>
                <MaterialCommunityIcons name="map-marker-distance" size={18} color={Colors.secondary} />
              </View>
              <View>
                <Text style={styles.microLabel}>Precisión GPS</Text>
                <Text style={styles.microVal}>
                  {coords.length > 0 ? 'Alta (HDOP)' : 'Calibrando'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Music App Deep Link Bar */}
        <Pressable style={styles.audioBar} onPress={handleOpenMusic}>
          <View style={styles.audioLeft}>
            <View style={styles.audioIconBox}>
              <MaterialCommunityIcons name="music-clef-treble" size={20} color={Colors.primaryContainer} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.audioTrackName}>Abrir Reproductor de Música</Text>
              <Text style={styles.audioArtist}>Spotify / Apple Music</Text>
            </View>
          </View>
          <MaterialIcons name="open-in-new" size={20} color={Colors.primaryContainer} />
        </Pressable>

        {/* Tactical Floating Action Bar */}
        <View style={styles.actionBar}>
          {/* Flank Left: Reset */}
          <Pressable
            style={[styles.actionBtnSide, isLocked && styles.actionBtnDisabled]}
            onPress={handleResetRunning}>
            <MaterialIcons name="refresh" size={22} color={Colors.primaryContainer} />
            <View style={{ alignItems: 'flex-start' }}>
              <Text style={styles.actionBtnLabel}>REINICIAR</Text>
              <Text style={styles.actionBtnVal}>Reset</Text>
            </View>
          </Pressable>

          {/* Master Pause / Play Button */}
          <Pressable
            style={[
              styles.actionBtnMaster,
              !isRunning && styles.actionBtnMasterPaused,
              isLocked && styles.actionBtnDisabled,
            ]}
            onPress={handleToggleRunning}>
            <MaterialIcons
              name={isRunning ? 'pause' : 'play-arrow'}
              size={32}
              color={Colors.onPrimaryContainer}
            />
            <Text style={styles.masterBtnText}>{isRunning ? 'PAUSA' : 'INICIAR'}</Text>
          </Pressable>

          {/* Flank Right: Lock Touch Shield */}
          <Pressable style={styles.actionBtnSide} onPress={() => setIsLocked((prev) => !prev)}>
            <MaterialIcons
              name={isLocked ? 'lock' : 'lock-open'}
              size={22}
              color={isLocked ? Colors.primaryContainer : Colors.onSurfaceVariant}
            />
            <View style={{ alignItems: 'flex-start' }}>
              <Text style={styles.actionBtnLabel}>CONTROL</Text>
              <Text style={[styles.actionBtnVal, isLocked && { color: Colors.primaryContainer }]}>
                {isLocked ? 'Bloqueado' : 'Bloqueo'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Finish Run Primary CTA */}
        <View style={styles.finishRunSection}>
          <Pressable
            style={[styles.finishRunBtn, savingSession && { opacity: 0.7 }]}
            onPress={handleFinishRun}
            disabled={savingSession}>
            {savingSession ? (
              <ActivityIndicator color={Colors.onPrimaryContainer} />
            ) : (
              <>
                <MaterialIcons name="flag" size={20} color={Colors.onPrimaryContainer} />
                <Text style={styles.finishRunBtnText}>Finalizar y Guardar Carrera</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* CACO Configuration Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={cacoModalVisible}
          onRequestClose={() => setCacoModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Configurar CACO (Caminar-Correr)</Text>
                <Pressable onPress={() => setCacoModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color={Colors.onSurface} />
                </Pressable>
              </View>

              <Text style={styles.modalDesc}>
                Personaliza la estructura de intervalos para alternar caminata y trote con alertas de vibración.
              </Text>

              {/* Total Intervals Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NÚMERO DE INTERVALOS TOTALES</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={String(totalIntervals)}
                  onChangeText={(val) => setTotalIntervals(Math.max(1, parseInt(val, 10) || 1))}
                />
              </View>

              {/* Walk Minutes */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DURACIÓN DE CAMINATA (MINUTOS)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={String(walkMinutes)}
                  onChangeText={(val) => setWalkMinutes(Math.max(1, parseInt(val, 10) || 1))}
                />
              </View>

              {/* Run Minutes */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DURACIÓN DE TROTE / CARRERA (MINUTOS)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={String(runMinutes)}
                  onChangeText={(val) => setRunMinutes(Math.max(1, parseInt(val, 10) || 1))}
                />
              </View>

              <Pressable
                style={styles.saveCacoBtn}
                onPress={() => {
                  setPhaseSecondsLeft(runMinutes * 60);
                  setCacoPhase('correr');
                  setCurrentInterval(1);
                  setCacoModalVisible(false);
                }}>
                <Text style={styles.saveCacoBtnText}>Aplicar Configuración CACO</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandBadge: {
    width: 36,
    height: 36,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  brandTitle: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  brandSub: {
    color: Colors.primaryContainer,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  gpsSignalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radii.full,
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryContainer,
  },
  gpsSignalText: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '700',
  },
  modeSection: {
    marginBottom: Spacing.md,
  },
  modeScroll: {
    gap: 8,
  },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceContainerHigh,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeChipSelected: {
    backgroundColor: Colors.primaryContainer,
  },
  chipActiveDot: {
    width: 6,
    height: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.onPrimaryContainer,
  },
  modeChipText: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
  },
  modeChipTextSelected: {
    color: Colors.onPrimaryContainer,
    fontWeight: '800',
  },
  cacoBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  cacoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cacoPhaseCircle: {
    width: 38,
    height: 38,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cacoPhaseTag: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '800',
  },
  cacoPhaseCountdown: {
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  configBtn: {
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
  },
  configBtnText: {
    color: Colors.onSurface,
    fontSize: 11,
    fontWeight: '700',
  },
  mapCard: {
    height: 180,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radii.xl,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapBackground: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapTopOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  elevationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(38, 42, 52, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    gap: 4,
  },
  elevationText: {
    color: Colors.onSurface,
    fontSize: 11,
    fontWeight: '700',
  },
  northCompass: {
    width: 28,
    height: 28,
    borderRadius: Radii.full,
    backgroundColor: 'rgba(38, 42, 52, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassText: {
    color: Colors.primaryContainer,
    fontSize: 11,
    fontWeight: '900',
  },
  centerPinWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinPulse: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: Radii.full,
    backgroundColor: `${Colors.primaryContainer}20`,
  },
  pinCircle: {
    width: 32,
    height: 32,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinLabel: {
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
    marginTop: 6,
  },
  pinLabelText: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '700',
  },
  mapBottomPin: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(38, 42, 52, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.lg,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  mapDistanceVal: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: '800',
  },
  mapDistanceUnit: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
  },
  telemetryHUD: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  timerCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hudLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '700',
  },
  displayTimer: {
    color: Colors.onSurface,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  intervalSub: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
  },
  intervalTitle: {
    color: Colors.primaryContainer,
    fontSize: 14,
    fontWeight: '800',
  },
  hudGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  hudBox: {
    flex: 1,
    backgroundColor: Colors.surfaceContainer,
    padding: Spacing.md,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  hudBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  hudBoxLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 9,
    fontWeight: '800',
  },
  hudBoxBigVal: {
    color: Colors.onSurface,
    fontSize: 24,
    fontWeight: '900',
  },
  hudBoxUnit: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    marginTop: -2,
  },
  microMetricsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  microBox: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.sm,
    borderRadius: Radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  microIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  microLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
  },
  microVal: {
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  microUnit: {
    fontSize: 10,
    color: Colors.onSurfaceVariant,
    fontWeight: '400',
  },
  audioBar: {
    backgroundColor: Colors.surfaceContainerHigh,
    padding: Spacing.md,
    borderRadius: Radii.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  audioLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  audioIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioTrackName: {
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  audioArtist: {
    color: Colors.primaryContainer,
    fontSize: 11,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  actionBtnSide: {
    flex: 1,
    height: 52,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radii.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 9,
    fontWeight: '700',
  },
  actionBtnVal: {
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnMaster: {
    flex: 1.5,
    height: 56,
    backgroundColor: Colors.primaryContainer,
    borderRadius: Radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnMasterPaused: {
    backgroundColor: Colors.secondary,
  },
  masterBtnText: {
    color: Colors.onPrimaryContainer,
    fontSize: 16,
    fontWeight: '800',
  },
  finishRunSection: {
    marginTop: Spacing.xs,
  },
  finishRunBtn: {
    height: 52,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  finishRunBtnText: {
    color: Colors.onPrimaryContainer,
    fontSize: 16,
    fontWeight: '800',
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
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: '800',
  },
  modalDesc: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.sm,
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
    fontSize: 16,
    fontWeight: '700',
  },
  saveCacoBtn: {
    backgroundColor: Colors.primaryContainer,
    height: 50,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  saveCacoBtnText: {
    color: Colors.onPrimaryContainer,
    fontSize: 15,
    fontWeight: '800',
  },
});
