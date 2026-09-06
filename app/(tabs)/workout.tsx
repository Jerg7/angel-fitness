import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useWorkout, SetItem } from '@/context/WorkoutContext';
import { ExerciseItem } from './exercises';

const EXERCISES_JSON_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

type ViewTab = 'active' | 'history';

interface HistoricalSession {
  id: string;
  duration_seconds: number;
  total_volume: number;
  created_at: string;
  sets?: {
    exercise_name: string;
    set_number: number;
    weight: number;
    reps: number;
  }[];
}

export default function WorkoutScreen() {
  const router = useRouter();
  const {
    selectedExercises,
    activeExerciseIndex,
    activeExercise,
    sessionSeconds,
    isSessionActive,
    addExerciseToWorkout,
    removeExerciseFromWorkout,
    nextExercise,
    previousExercise,
    addSetToActiveExercise,
    removeSetFromActiveExercise,
    updateSetInActiveExercise,
    toggleSetCompletedInActiveExercise,
    finishWorkoutSession,
    clearWorkout,
  } = useWorkout();

  const [activeTab, setActiveTab] = useState<ViewTab>('active');

  // Rest Timer
  const [restSeconds, setRestSeconds] = useState<number>(0);
  const [isRestActive, setIsRestActive] = useState<boolean>(false);

  // Quick Exercise Picker Modal
  const [exerciseModalVisible, setExerciseModalVisible] = useState<boolean>(false);
  const [catalogExercises, setCatalogExercises] = useState<ExerciseItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Finish Summary Modal
  const [finishModalVisible, setFinishModalVisible] = useState<boolean>(false);
  const [summaryData, setSummaryData] = useState<{
    duration: number;
    volume: number;
    completedSets: number;
    progressComparison: string;
  } | null>(null);
  const [savingSession, setSavingSession] = useState<boolean>(false);

  // History Tab States
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [historicalSessions, setHistoricalSessions] = useState<HistoricalSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Rest countdown effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRestActive && restSeconds > 0) {
      interval = setInterval(() => {
        setRestSeconds((prev) => {
          if (prev <= 1) {
            setIsRestActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRestActive, restSeconds]);

  // Load Catalog for quick modal
  useEffect(() => {
    if (exerciseModalVisible && catalogExercises.length === 0) {
      fetchCatalog();
    }
  }, [exerciseModalVisible]);

  const fetchCatalog = async () => {
    try {
      setLoadingCatalog(true);
      const res = await fetch(EXERCISES_JSON_URL);
      if (res.ok) {
        const data: ExerciseItem[] = await res.json();
        setCatalogExercises(data);
      }
    } catch (err) {
      console.warn('Error cargando catálogo para modal:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Filter exercises for modal
  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return catalogExercises.slice(0, 30);
    const q = searchQuery.toLowerCase().trim();
    return catalogExercises
      .filter(
        (ex) =>
          ex.name?.toLowerCase().includes(q) ||
          ex.equipment?.toLowerCase().includes(q) ||
          ex.primaryMuscles?.some((m) => m.toLowerCase().includes(q))
      )
      .slice(0, 40);
  }, [catalogExercises, searchQuery]);

  // Fetch History for selected date
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistoryForDate(selectedDate);
    }
  }, [activeTab, selectedDate]);

  const fetchHistoryForDate = async (targetDate: Date) => {
    try {
      setLoadingHistory(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHistoricalSessions([]);
        return;
      }

      // Format ISO start and end of selected day
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch sessions for day
      const { data: sessions, error: sessErr } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false });

      if (sessErr) {
        console.warn('Error fetching workout_sessions:', sessErr.message);
      }

      // Fetch sets for day
      const { data: setLogs, error: setErr } = await supabase
        .from('workout_set_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: true });

      if (setErr) {
        console.warn('Error fetching workout_set_logs:', setErr.message);
      }

      if (sessions && sessions.length > 0) {
        const enriched = sessions.map((s) => ({
          ...s,
          sets: (setLogs || []).filter((sl) => sl.session_id === s.id || Math.abs(new Date(sl.created_at).getTime() - new Date(s.created_at).getTime()) < 3600000),
        }));
        setHistoricalSessions(enriched);
      } else if (setLogs && setLogs.length > 0) {
        // Fallback session grouping by hour if workout_sessions not created
        const fallbackSession: HistoricalSession = {
          id: 'fb-1',
          duration_seconds: 2400,
          total_volume: setLogs.reduce((acc, curr) => acc + (curr.weight * curr.reps), 0),
          created_at: setLogs[0].created_at,
          sets: setLogs,
        };
        setHistoricalSessions([fallbackSession]);
      } else {
        setHistoricalSessions([]);
      }
    } catch (err) {
      console.error('Error cargando historial de entrenamiento:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Formatting helpers
  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatRest = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const addRestTime = () => {
    setRestSeconds((prev) => prev + 30);
    setIsRestActive(true);
  };
  const skipRestTime = () => {
    setRestSeconds(0);
    setIsRestActive(false);
  };

  const handleToggleSet = (setId: number) => {
    const updatedSet = toggleSetCompletedInActiveExercise(setId);
    if (updatedSet?.completed) {
      setRestSeconds(90);
      setIsRestActive(true);
    }
  };

  const calculateWorkoutStats = () => {
    let totalVol = 0;
    let compSets = 0;

    selectedExercises.forEach((ex) => {
      ex.sets.forEach((s) => {
        if (s.completed) {
          totalVol += s.weight * s.reps;
          compSets += 1;
        }
      });
    });

    return { totalVol, compSets };
  };

  const handleOpenFinishModal = async () => {
    const { totalVol, compSets } = calculateWorkoutStats();

    if (compSets === 0 && selectedExercises.length > 0) {
      Alert.alert(
        'Sin Series Completadas',
        'Marca al menos una serie como completada (✔) para registrar el volumen levantado.'
      );
      return;
    }

    // Compare with historical average in Supabase
    let progressStr = '¡Gran esfuerzo en esta sesión!';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prevLogs } = await supabase
          .from('workout_set_logs')
          .select('weight, reps')
          .eq('user_id', user.id)
          .limit(20);

        if (prevLogs && prevLogs.length > 0) {
          const avgPrevWeight = prevLogs.reduce((acc, curr) => acc + curr.weight, 0) / prevLogs.length;
          const currentAvgWeight = totalVol / (compSets || 1);
          const diff = currentAvgWeight - avgPrevWeight;
          if (diff > 0) {
            progressStr = `+${diff.toFixed(1)} kg promedio de carga vs sesiones anteriores 🚀`;
          } else if (diff < 0) {
            progressStr = `Carga media de ${currentAvgWeight.toFixed(1)} kg mantenida de forma constante 🔥`;
          }
        }
      }
    } catch (err) {
      console.log('Error consultando histórico comparativo:', err);
    }

    setSummaryData({
      duration: sessionSeconds,
      volume: totalVol,
      completedSets: compSets,
      progressComparison: progressStr,
    });
    setFinishModalVisible(true);
  };

  const handleConfirmFinishSession = async () => {
    setSavingSession(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user && summaryData) {
        // 1. Insert workout_sessions record
        let sessionId: string | null = null;
        const sessionPayload = {
          user_id: user.id,
          duration_seconds: summaryData.duration,
          total_volume: summaryData.volume,
          created_at: new Date().toISOString(),
        };

        const { data: sessionRes, error: sessErr } = await supabase
          .from('workout_sessions')
          .insert(sessionPayload)
          .select('id')
          .single();

        if (!sessErr && sessionRes) {
          sessionId = sessionRes.id;
        }

        // 2. Insert workout_set_logs records for completed sets
        const setsToInsert: any[] = [];
        selectedExercises.forEach((ex) => {
          ex.sets.forEach((s) => {
            if (s.completed) {
              setsToInsert.push({
                user_id: user.id,
                session_id: sessionId,
                exercise_name: ex.name,
                set_number: s.id,
                weight: s.weight,
                reps: s.reps,
                completed: true,
                created_at: new Date().toISOString(),
              });
            }
          });
        });

        if (setsToInsert.length > 0) {
          const { error: setsErr } = await supabase.from('workout_set_logs').insert(setsToInsert);
          if (setsErr) {
            // Retry inserting into set_logs fallback if workout_set_logs schema doesn't exist
            await supabase.from('set_logs').insert(setsToInsert);
          }
        }
      }

      finishWorkoutSession();
      setFinishModalVisible(false);
      Alert.alert('¡Entrenamiento Guardado!', 'La sesión se registró exitosamente en Supabase.');
    } catch (err: any) {
      console.error('Error guardando sesión:', err);
      Alert.alert('Error al Guardar', err.message || 'Ocurrió un error al guardar la sesión.');
    } finally {
      setSavingSession(false);
    }
  };

  // Generate Date Strip for History (last 7 days)
  const generateDateStrip = () => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d);
    }
    return dates;
  };
  const dateStrip = generateDateStrip();

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  const { totalVol, compSets } = calculateWorkoutStats();
  const currentSets = activeExercise ? activeExercise.sets : [];
  const nextExerciseItem = selectedExercises[activeExerciseIndex + 1] || null;
  const prevExerciseItem = selectedExercises[activeExerciseIndex - 1] || null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Main Tab Segmented Controller */}
        <View style={styles.tabSegmentContainer}>
          <Pressable
            style={[styles.tabSegmentBtn, activeTab === 'active' && styles.tabSegmentBtnActive]}
            onPress={() => setActiveTab('active')}>
            <MaterialCommunityIcons
              name="dumbbell"
              size={16}
              color={activeTab === 'active' ? Colors.onPrimaryContainer : Colors.onSurfaceVariant}
            />
            <Text style={[styles.tabSegmentText, activeTab === 'active' && styles.tabSegmentTextActive]}>
              Entrenamiento Activo
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabSegmentBtn, activeTab === 'history' && styles.tabSegmentBtnActive]}
            onPress={() => setActiveTab('history')}>
            <MaterialIcons
              name="calendar-today"
              size={16}
              color={activeTab === 'history' ? Colors.onPrimaryContainer : Colors.onSurfaceVariant}
            />
            <Text style={[styles.tabSegmentText, activeTab === 'history' && styles.tabSegmentTextActive]}>
              Historial de Sesiones
            </Text>
          </Pressable>
        </View>

        {activeTab === 'active' ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Live Session Header Card */}
            <View style={styles.liveHeaderCard}>
              <View style={styles.liveTopRow}>
                <View style={styles.liveTagRow}>
                  <View style={[styles.livePulseDot, !isSessionActive && { backgroundColor: Colors.onSurfaceVariant }]} />
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveBadgeText}>{isSessionActive ? 'EN VIVO' : 'EN ESPERA'}</Text>
                  </View>
                </View>
                <Pressable style={styles.addExHeaderBtn} onPress={() => setExerciseModalVisible(true)}>
                  <MaterialIcons name="add" size={16} color={Colors.primaryContainer} />
                  <Text style={styles.addExHeaderBtnText}>+ Agregar Ejercicio</Text>
                </Pressable>
              </View>

              <View style={styles.routineTitleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routineName}>
                    {selectedExercises.length > 0
                      ? `Rutina Kinetix (${selectedExercises.length} ej.)`
                      : 'Sesión Vacía'}
                  </Text>
                  <Text style={styles.routineMeta}>
                    {selectedExercises.length > 0
                      ? `Ejercicio ${activeExerciseIndex + 1} de ${selectedExercises.length}`
                      : 'Presiona + Agregar Ejercicio para empezar'}
                  </Text>
                </View>

                <View style={styles.timerBox}>
                  <MaterialIcons name="timer" size={16} color={Colors.primaryContainer} />
                  <Text style={styles.timerText}>{formatTime(sessionSeconds)}</Text>
                </View>
              </View>

              {/* Sub-stats Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>VOLUMEN</Text>
                  <Text style={styles.statVal}>
                    {Math.round(totalVol)} <Text style={styles.statUnit}>kg</Text>
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>SERIES</Text>
                  <Text style={[styles.statVal, { color: Colors.primaryContainer }]}>
                    {compSets}
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>EJERCICIOS</Text>
                  <Text style={[styles.statVal, { color: Colors.secondary }]}>
                    {selectedExercises.length}
                  </Text>
                </View>
              </View>
            </View>

            {/* Rest Timer Active Banner */}
            {isRestActive && (
              <View style={styles.restBanner}>
                <View style={styles.restLeft}>
                  <View style={styles.restCircle}>
                    <MaterialCommunityIcons name="timer-sand" size={20} color={Colors.primaryContainer} />
                  </View>
                  <View>
                    <Text style={styles.restLabel}>DESCANSO ACTIVO</Text>
                    <Text style={styles.restCountdown}>{formatRest(restSeconds)}</Text>
                  </View>
                </View>
                <View style={styles.restActions}>
                  <Pressable style={styles.restBtn} onPress={addRestTime}>
                    <Text style={styles.restBtnText}>+30s</Text>
                  </Pressable>
                  <Pressable style={styles.skipBtn} onPress={skipRestTime}>
                    <Text style={styles.skipBtnText}>Saltar</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Empty State vs Active Exercise */}
            {selectedExercises.length === 0 ? (
              <View style={styles.emptyWorkoutCard}>
                <MaterialCommunityIcons name="dumbbell" size={54} color={Colors.outline} />
                <Text style={styles.emptyTitle}>Tu entrenamiento está vacío</Text>
                <Text style={styles.emptySub}>
                  Agrega ejercicios desde el catálogo para iniciar el seguimiento en tiempo real.
                </Text>
                <Pressable style={styles.emptyAddBtn} onPress={() => setExerciseModalVisible(true)}>
                  <MaterialIcons name="add" size={20} color={Colors.onPrimaryContainer} />
                  <Text style={styles.emptyAddBtnText}>+ Agregar Ejercicio</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* Active Exercise Card */}
                <View style={styles.exerciseCard}>
                  <View style={styles.exerciseCardHeader}>
                    <View style={styles.exerciseInfo}>
                      <Text style={styles.exerciseStepText}>
                        EJERCICIO {activeExerciseIndex + 1} DE {selectedExercises.length}
                      </Text>
                      <Text style={styles.exerciseTitle}>
                        {activeExercise ? activeExercise.name : ''}
                      </Text>
                      <Text style={styles.exerciseSubtitle}>
                        {activeExercise ? `${activeExercise.equipment} • ${activeExercise.primaryMuscle}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => activeExercise && removeExerciseFromWorkout(activeExercise.id)}>
                      <MaterialIcons name="delete-outline" size={22} color={Colors.error} />
                    </Pressable>
                  </View>

                  {/* Sets Table */}
                  <View style={styles.setsTable}>
                    {/* Table Header */}
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.thCell, { flex: 2 }]}>SERIE</Text>
                      <Text style={[styles.thCell, { flex: 3.5, textAlign: 'center' }]}>PESO (KG)</Text>
                      <Text style={[styles.thCell, { flex: 3, textAlign: 'center' }]}>REPS</Text>
                      <Text style={[styles.thCell, { flex: 2.5, textAlign: 'center' }]}>ESTADO</Text>
                      <Text style={[styles.thCell, { flex: 1.5, textAlign: 'right' }]} />
                    </View>

                    {/* Set Rows */}
                    {currentSets.map((item) => {
                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.tableRow,
                            item.completed && styles.tableRowCompleted,
                          ]}>
                          {/* Set Number & Type */}
                          <View style={[styles.tdCell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                            <View style={[styles.setNumCircle, item.completed && styles.setNumCircleDone]}>
                              <Text style={[styles.setNumText, item.completed && styles.setNumTextDone]}>
                                {item.id}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.setTypeBadge,
                                item.type === 'C' ? { color: Colors.tertiary } : { color: Colors.secondary },
                              ]}>
                              {item.type}
                            </Text>
                          </View>

                          {/* Weight Input */}
                          <View style={[styles.tdCell, { flex: 3.5, alignItems: 'center' }]}>
                            <TextInput
                              style={styles.cellInput}
                              keyboardType="numeric"
                              value={String(item.weight)}
                              onChangeText={(val) =>
                                updateSetInActiveExercise(item.id, 'weight', parseFloat(val) || 0)
                              }
                            />
                          </View>

                          {/* Reps Input */}
                          <View style={[styles.tdCell, { flex: 3, alignItems: 'center' }]}>
                            <TextInput
                              style={styles.cellInput}
                              keyboardType="numeric"
                              value={String(item.reps)}
                              onChangeText={(val) =>
                                updateSetInActiveExercise(item.id, 'reps', parseInt(val, 10) || 0)
                              }
                            />
                          </View>

                          {/* Complete Checkbox */}
                          <View style={[styles.tdCell, { flex: 2.5, alignItems: 'center' }]}>
                            <Pressable
                              style={[styles.checkBtn, item.completed && styles.checkBtnDone]}
                              onPress={() => handleToggleSet(item.id)}>
                              <MaterialIcons
                                name={item.completed ? 'check' : 'radio-button-unchecked'}
                                size={18}
                                color={item.completed ? Colors.onPrimaryContainer : Colors.outline}
                              />
                            </Pressable>
                          </View>

                          {/* Delete Set */}
                          <View style={[styles.tdCell, { flex: 1.5, alignItems: 'flex-end' }]}>
                            <Pressable onPress={() => removeSetFromActiveExercise(item.id)}>
                              <MaterialIcons name="close" size={18} color={Colors.outline} />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Quick Append Set Button */}
                  <Pressable style={styles.addSetBtn} onPress={addSetToActiveExercise}>
                    <MaterialIcons name="add-circle-outline" size={20} color={Colors.primaryContainer} />
                    <Text style={styles.addSetBtnText}>Agregar Serie (+)</Text>
                  </Pressable>
                </View>

                {/* Exercise Navigation Controls */}
                <View style={styles.exerciseNavRow}>
                  {prevExerciseItem ? (
                    <Pressable style={styles.navBtn} onPress={previousExercise}>
                      <MaterialIcons name="arrow-back" size={18} color={Colors.onSurface} />
                      <Text style={styles.navBtnText}>Anterior</Text>
                    </Pressable>
                  ) : (
                    <View style={{ flex: 1 }} />
                  )}

                  {nextExerciseItem ? (
                    <Pressable style={[styles.navBtn, styles.navBtnPrimary]} onPress={nextExercise}>
                      <Text style={styles.navBtnTextPrimary}>Siguiente Ejercicio</Text>
                      <MaterialIcons name="arrow-forward" size={18} color={Colors.onPrimaryContainer} />
                    </Pressable>
                  ) : (
                    <View style={{ flex: 1 }} />
                  )}
                </View>

                {/* Add Another Exercise Button */}
                <Pressable style={styles.addMoreExBtn} onPress={() => setExerciseModalVisible(true)}>
                  <MaterialIcons name="playlist-add" size={20} color={Colors.primaryContainer} />
                  <Text style={styles.addMoreExBtnText}>+ Agregar Más Ejercicios a la Rutina</Text>
                </Pressable>

                {/* Finish Workout CTA */}
                <View style={styles.finishSection}>
                  <Pressable style={styles.finishBtn} onPress={handleOpenFinishModal}>
                    <MaterialIcons name="check-circle" size={22} color={Colors.onPrimaryContainer} />
                    <Text style={styles.finishBtnText}>Finalizar Entrenamiento</Text>
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        ) : (
          /* History View with Calendar */
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Weekly Date Selector Strip */}
            <View style={styles.historyCalendarCard}>
              <View style={styles.historyHeader}>
                <MaterialIcons name="event" size={20} color={Colors.primaryContainer} />
                <Text style={styles.historyHeaderTitle}>Seleccionar Fecha</Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStripScroll}>
                {dateStrip.map((d, idx) => {
                  const isSelected = isSameDay(d, selectedDate);
                  const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
                  const dayNum = d.getDate();

                  return (
                    <Pressable
                      key={idx}
                      style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                      onPress={() => setSelectedDate(d)}>
                      <Text style={[styles.dateChipDay, isSelected && styles.dateChipDaySelected]}>
                        {dayName}
                      </Text>
                      <Text style={[styles.dateChipNum, isSelected && styles.dateChipNumSelected]}>
                        {dayNum}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Selected Date Session Details */}
            <View style={styles.historySessionList}>
              <View style={styles.historyListHeader}>
                <Text style={styles.historyListTitle}>
                  Sesiones del {selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </View>

              {loadingHistory ? (
                <ActivityIndicator color={Colors.primaryContainer} style={{ marginVertical: Spacing.xl }} />
              ) : historicalSessions.length === 0 ? (
                <View style={styles.emptyHistoryBox}>
                  <MaterialIcons name="fitness-center" size={40} color={Colors.outline} />
                  <Text style={styles.emptyHistoryText}>No hay registros para este día</Text>
                </View>
              ) : (
                historicalSessions.map((sess) => (
                  <View key={sess.id} style={styles.historyCard}>
                    <View style={styles.historyCardHeader}>
                      <View style={styles.historyCardBadge}>
                        <MaterialCommunityIcons name="trophy-award" size={16} color={Colors.primaryContainer} />
                        <Text style={styles.historyCardBadgeText}>COMPLETADA</Text>
                      </View>
                      <Text style={styles.historyCardTime}>
                        {new Date(sess.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>

                    <View style={styles.historyMetricsRow}>
                      <View style={styles.historyMetricBox}>
                        <Text style={styles.historyMetricLabel}>DURACIÓN</Text>
                        <Text style={styles.historyMetricVal}>{formatTime(sess.duration_seconds)}</Text>
                      </View>
                      <View style={styles.historyMetricBox}>
                        <Text style={styles.historyMetricLabel}>VOLUMEN TOTAL</Text>
                        <Text style={[styles.historyMetricVal, { color: Colors.primaryContainer }]}>
                          {Math.round(sess.total_volume)} kg
                        </Text>
                      </View>
                      <View style={styles.historyMetricBox}>
                        <Text style={styles.historyMetricLabel}>SERIES</Text>
                        <Text style={[styles.historyMetricVal, { color: Colors.secondary }]}>
                          {sess.sets ? sess.sets.length : 0}
                        </Text>
                      </View>
                    </View>

                    {/* Breakdown of sets */}
                    {sess.sets && sess.sets.length > 0 && (
                      <View style={styles.setsBreakdownList}>
                        <Text style={styles.breakdownTitle}>Desglose de Ejercicios:</Text>
                        {sess.sets.map((s, sIdx) => (
                          <View key={sIdx} style={styles.breakdownRow}>
                            <Text style={styles.breakdownExName}>{s.exercise_name}</Text>
                            <Text style={styles.breakdownSetData}>
                              Serie {s.set_number}: <Text style={{ color: Colors.onSurface, fontWeight: '700' }}>{s.weight} kg × {s.reps} reps</Text>
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}

        {/* Quick Exercise Selector Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={exerciseModalVisible}
          onRequestClose={() => setExerciseModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Agregar Ejercicio</Text>
                <Pressable onPress={() => setExerciseModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color={Colors.onSurface} />
                </Pressable>
              </View>

              {/* Search Bar */}
              <View style={styles.modalSearchBox}>
                <MaterialIcons name="search" size={20} color={Colors.onSurfaceVariant} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Buscar ejercicio o músculo..."
                  placeholderTextColor={Colors.outline}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {loadingCatalog ? (
                <ActivityIndicator color={Colors.primaryContainer} style={{ marginVertical: Spacing.xl }} />
              ) : (
                <FlatList
                  data={filteredCatalog}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.modalExItem}
                      onPress={() => {
                        addExerciseToWorkout(item);
                        setExerciseModalVisible(false);
                      }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalExName}>{item.name}</Text>
                        <Text style={styles.modalExSub}>
                          {item.equipment || 'Libre'} • {item.primaryMuscles?.[0] || 'General'}
                        </Text>
                      </View>
                      <MaterialIcons name="add-circle-outline" size={24} color={Colors.primaryContainer} />
                    </Pressable>
                  )}
                  style={{ maxHeight: 350 }}
                />
              )}
            </View>
          </View>
        </Modal>

        {/* Workout Finish Summary Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={finishModalVisible}
          onRequestClose={() => setFinishModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.summaryModalContent}>
              <View style={styles.summaryHeader}>
                <MaterialCommunityIcons name="trophy-variant" size={48} color={Colors.primaryContainer} />
                <Text style={styles.summaryTitle}>¡Entrenamiento Completado!</Text>
                <Text style={styles.summarySub}>Resumen de telemetría de la sesión Kinetix</Text>
              </View>

              {summaryData && (
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryBoxLabel}>DURACIÓN TOTAL</Text>
                    <Text style={styles.summaryBoxVal}>{formatTime(summaryData.duration)}</Text>
                  </View>

                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryBoxLabel}>VOLUMEN TOTAL</Text>
                    <Text style={[styles.summaryBoxVal, { color: Colors.primaryContainer }]}>
                      {Math.round(summaryData.volume)} kg
                    </Text>
                  </View>

                  <View style={styles.summaryBoxFull}>
                    <Text style={styles.summaryBoxLabel}>SERIES COMPLETADAS</Text>
                    <Text style={[styles.summaryBoxVal, { color: Colors.secondary }]}>
                      {summaryData.completedSets} series efectivas
                    </Text>
                  </View>

                  <View style={styles.progressComparisonCard}>
                    <MaterialCommunityIcons name="chart-line-variant" size={18} color={Colors.tertiary} />
                    <Text style={styles.progressComparisonText}>
                      {summaryData.progressComparison}
                    </Text>
                  </View>
                </View>
              )}

              <Pressable
                style={[styles.saveSessionBtn, savingSession && { opacity: 0.7 }]}
                onPress={handleConfirmFinishSession}
                disabled={savingSession}>
                {savingSession ? (
                  <ActivityIndicator color={Colors.onPrimaryContainer} />
                ) : (
                  <Text style={styles.saveSessionBtnText}>Guardar en Supabase</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  tabSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLow,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    padding: 4,
    borderRadius: Radii.lg,
    gap: 4,
  },
  tabSegmentBtn: {
    flex: 1,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.md,
    gap: 6,
  },
  tabSegmentBtnActive: {
    backgroundColor: Colors.primaryContainer,
  },
  tabSegmentText: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '700',
  },
  tabSegmentTextActive: {
    color: Colors.onPrimaryContainer,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxl,
  },
  liveHeaderCard: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  liveTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  liveTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryContainer,
  },
  liveBadge: {
    backgroundColor: `${Colors.primaryContainer}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  liveBadgeText: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '800',
  },
  addExHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    gap: 2,
  },
  addExHeaderBtnText: {
    color: Colors.primaryContainer,
    fontSize: 11,
    fontWeight: '700',
  },
  routineTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  routineName: {
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: '800',
  },
  routineMeta: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    marginTop: 2,
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radii.md,
    gap: 6,
  },
  timerText: {
    color: Colors.primaryContainer,
    fontSize: 16,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.xs,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  statLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '700',
  },
  statVal: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  statUnit: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    fontWeight: '400',
  },
  restBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  restLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  restCircle: {
    width: 40,
    height: 40,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '700',
  },
  restCountdown: {
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: '800',
  },
  restActions: {
    flexDirection: 'row',
    gap: 6,
  },
  restBtn: {
    backgroundColor: Colors.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
  },
  restBtnText: {
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: '600',
  },
  skipBtn: {
    backgroundColor: `${Colors.primaryContainer}20`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
  },
  skipBtnText: {
    color: Colors.primaryContainer,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyWorkoutCard: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  emptyTitle: {
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: '800',
    marginTop: Spacing.md,
  },
  emptySub: {
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  emptyAddBtn: {
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: Radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyAddBtnText: {
    color: Colors.onPrimaryContainer,
    fontSize: 14,
    fontWeight: '800',
  },
  exerciseCard: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseStepText: {
    color: Colors.primaryContainer,
    fontSize: 11,
    fontWeight: '800',
  },
  exerciseTitle: {
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  exerciseSubtitle: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
  },
  setsTable: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  thCell: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '800',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderTranslucent,
  },
  tableRowCompleted: {
    backgroundColor: `${Colors.primaryContainer}10`,
  },
  tdCell: {},
  setNumCircle: {
    width: 22,
    height: 22,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumCircleDone: {
    backgroundColor: Colors.primaryContainer,
  },
  setNumText: {
    color: Colors.onSurface,
    fontSize: 11,
    fontWeight: '700',
  },
  setNumTextDone: {
    color: Colors.onPrimaryContainer,
  },
  setTypeBadge: {
    fontSize: 11,
    fontWeight: '800',
  },
  cellInput: {
    width: 54,
    height: 32,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radii.md,
    color: Colors.onSurface,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 13,
  },
  checkBtn: {
    width: 32,
    height: 32,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnDone: {
    backgroundColor: Colors.primaryContainer,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
    paddingVertical: 10,
    borderRadius: Radii.lg,
    gap: 6,
  },
  addSetBtnText: {
    color: Colors.primaryContainer,
    fontSize: 14,
    fontWeight: '700',
  },
  exerciseNavRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  navBtn: {
    flex: 1,
    height: 44,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  navBtnPrimary: {
    backgroundColor: Colors.primaryContainer,
  },
  navBtnText: {
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  navBtnTextPrimary: {
    color: Colors.onPrimaryContainer,
    fontSize: 13,
    fontWeight: '800',
  },
  addMoreExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainer,
    paddingVertical: 12,
    borderRadius: Radii.xl,
    gap: 8,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  addMoreExBtnText: {
    color: Colors.primaryContainer,
    fontSize: 14,
    fontWeight: '800',
  },
  finishSection: {
    marginTop: Spacing.xs,
  },
  finishBtn: {
    height: 52,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  finishBtnText: {
    color: Colors.onPrimaryContainer,
    fontSize: 16,
    fontWeight: '800',
  },
  historyCalendarCard: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  historyHeaderTitle: {
    color: Colors.onSurface,
    fontSize: 15,
    fontWeight: '700',
  },
  dateStripScroll: {
    gap: 8,
  },
  dateChip: {
    width: 50,
    height: 64,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateChipSelected: {
    backgroundColor: Colors.primaryContainer,
  },
  dateChipDay: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '700',
  },
  dateChipDaySelected: {
    color: Colors.onPrimaryContainer,
  },
  dateChipNum: {
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  dateChipNumSelected: {
    color: Colors.onPrimaryContainer,
  },
  historySessionList: {
    gap: Spacing.md,
  },
  historyListHeader: {
    marginBottom: 4,
  },
  historyListTitle: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyHistoryBox: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  emptyHistoryText: {
    color: Colors.onSurfaceVariant,
    fontSize: 14,
    marginTop: Spacing.md,
  },
  historyCard: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  historyCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.primaryContainer}20`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  historyCardBadgeText: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '800',
  },
  historyCardTime: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
  },
  historyMetricsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  historyMetricBox: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.xs,
    borderRadius: Radii.md,
  },
  historyMetricLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 9,
    fontWeight: '700',
  },
  historyMetricVal: {
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  setsBreakdownList: {
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.sm,
    borderRadius: Radii.lg,
    gap: 4,
  },
  breakdownTitle: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownExName: {
    color: Colors.onSurface,
    fontSize: 12,
  },
  breakdownSetData: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
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
    padding: Spacing.md,
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
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.sm,
    height: 44,
    gap: 8,
    marginBottom: Spacing.md,
  },
  modalSearchInput: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 14,
  },
  modalExItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderTranslucent,
  },
  modalExName: {
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
  },
  modalExSub: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    marginTop: 2,
  },
  summaryModalContent: {
    width: '100%',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
    alignItems: 'center',
  },
  summaryHeader: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  summaryTitle: {
    color: Colors.onSurface,
    fontSize: 22,
    fontWeight: '900',
    marginTop: Spacing.sm,
  },
  summarySub: {
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    marginTop: 2,
  },
  summaryGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  summaryBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    alignItems: 'center',
  },
  summaryBoxFull: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    alignItems: 'center',
  },
  summaryBoxLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '700',
  },
  summaryBoxVal: {
    color: Colors.onSurface,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  progressComparisonCard: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressComparisonText: {
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  saveSessionBtn: {
    width: '100%',
    height: 52,
    backgroundColor: Colors.primaryContainer,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveSessionBtnText: {
    color: Colors.onPrimaryContainer,
    fontSize: 16,
    fontWeight: '800',
  },
});
