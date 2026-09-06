import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  ScrollView,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useWorkout } from '@/context/WorkoutContext';
import {
  translateBodyPart,
  translateTarget,
  translateEquipment,
  BODY_PART_FILTERS,
} from '@/constants/exerciseTranslations';
import { ExerciseDBItem } from '@/types/exercise';

export interface ExerciseItem {
  id: string;
  name: string;
  target?: string;
  bodyPart?: string;
  equipment?: string | null;
  gifUrl?: string;
  instructions?: string[];
  secondaryMuscles?: string[];
  primaryMuscles?: string[];
  images?: string[];
  category?: string;
  mechanic?: string | null;
  level?: string;
}

const EXERCISES_JSON_URLS = [
  'https://raw.githubusercontent.com/mauryashiva/GymX-Fitness/main/src/data/exercises.json',
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json',
];

const IMAGE_CDN_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

export default function ExercisesScreen() {
  const router = useRouter();
  const { toggleExerciseSelection, isExerciseSelected, selectedExercises } = useWorkout();

  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');

  // Exercise Detail Modal
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [selectedExerciseDetail, setSelectedExerciseDetail] = useState<ExerciseItem | null>(null);

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    try {
      setLoading(true);
      setError(null);

      let rawData: any[] = [];
      let fetchSuccess = false;

      for (const url of EXERCISES_JSON_URLS) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            rawData = await res.json();
            if (Array.isArray(rawData) && rawData.length > 0) {
              fetchSuccess = true;
              break;
            }
          }
        } catch (e) {
          console.warn(`Error al intentar cargar desde ${url}:`, e);
        }
      }

      if (!fetchSuccess || !rawData || rawData.length === 0) {
        throw new Error('No se pudo obtener el dataset de ejercicios.');
      }
      
      // Normalize raw dataset to guarantee ExerciseDB format (gifUrl, bodyPart, target, equipment)
      const normalizedData: ExerciseItem[] = rawData.map((item: any, index: number) => {
        let rawGifUrl =
          item.gifUrl ||
          (item.images && item.images.length > 0
            ? `${IMAGE_CDN_BASE}${item.images[0]}`
            : '');

        // Reemplazar http:// por https:// automáticamente
        if (rawGifUrl && rawGifUrl.startsWith('http://')) {
          rawGifUrl = rawGifUrl.replace('http://', 'https://');
        }

        const bodyPart =
          item.bodyPart ||
          (Array.isArray(item.bodyParts) && item.bodyParts.length > 0 ? item.bodyParts[0] : item.bodyParts) ||
          item.category ||
          (item.primaryMuscles?.[0] ? item.primaryMuscles[0] : 'waist');

        const target =
          item.target ||
          (Array.isArray(item.targetMuscles) && item.targetMuscles.length > 0 ? item.targetMuscles[0] : item.targetMuscles) ||
          (item.primaryMuscles?.[0] ? item.primaryMuscles[0] : 'abs');

        const equipment =
          item.equipment ||
          (Array.isArray(item.equipments) && item.equipments.length > 0 ? item.equipments[0] : item.equipments) ||
          'body weight';

        return {
          id: item.id || item.exerciseId || String(index),
          name: item.name,
          bodyPart,
          target,
          equipment,
          gifUrl: rawGifUrl,
          primaryMuscles: item.primaryMuscles || [target],
          secondaryMuscles: item.secondaryMuscles || [],
          instructions: item.instructions || [],
          level: item.level,
          mechanic: item.mechanic,
        };
      });

      console.log('Primer ejercicio cargado:', normalizedData[0]);
      setExercises(normalizedData);
    } catch (err: any) {
      setError(err.message || 'No se pudo cargar el catálogo de ejercicios.');
    } finally {
      setLoading(false);
    }
  };

  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => {
      const queryLower = searchQuery.toLowerCase().trim();

      // Search matching across original and translated fields
      const translatedBp = translateBodyPart(ex.bodyPart || '');
      const translatedTg = translateTarget(ex.target || ex.primaryMuscles?.[0] || '');
      const translatedEq = translateEquipment(ex.equipment || '');

      const matchesQuery =
        !queryLower ||
        ex.name?.toLowerCase().includes(queryLower) ||
        ex.equipment?.toLowerCase().includes(queryLower) ||
        translatedEq.toLowerCase().includes(queryLower) ||
        ex.target?.toLowerCase().includes(queryLower) ||
        translatedTg.toLowerCase().includes(queryLower) ||
        ex.bodyPart?.toLowerCase().includes(queryLower) ||
        translatedBp.toLowerCase().includes(queryLower) ||
        ex.primaryMuscles?.some((m) => m.toLowerCase().includes(queryLower));

      let matchesCategory = true;
      if (selectedCategory !== 'todos') {
        const bodyPartLower = (ex.bodyPart || '').toLowerCase();
        const categoryLower = selectedCategory.toLowerCase();
        
        if (categoryLower === 'waist') {
          matchesCategory = bodyPartLower.includes('waist') || bodyPartLower.includes('abs') || bodyPartLower.includes('core');
        } else if (categoryLower === 'upper legs') {
          matchesCategory = bodyPartLower.includes('upper legs') || bodyPartLower.includes('quad') || bodyPartLower.includes('hamstring');
        } else if (categoryLower === 'lower legs') {
          matchesCategory = bodyPartLower.includes('lower legs') || bodyPartLower.includes('calf') || bodyPartLower.includes('calves');
        } else if (categoryLower === 'chest') {
          matchesCategory = bodyPartLower.includes('chest') || bodyPartLower.includes('pectoral');
        } else if (categoryLower === 'back') {
          matchesCategory = bodyPartLower.includes('back') || bodyPartLower.includes('lats');
        } else if (categoryLower === 'upper arms') {
          matchesCategory = bodyPartLower.includes('upper arms') || bodyPartLower.includes('arms') || bodyPartLower.includes('biceps') || bodyPartLower.includes('triceps');
        } else if (categoryLower === 'shoulders') {
          matchesCategory = bodyPartLower.includes('shoulders') || bodyPartLower.includes('delts');
        } else if (categoryLower === 'cardio') {
          matchesCategory = bodyPartLower.includes('cardio');
        } else if (categoryLower === 'neck') {
          matchesCategory = bodyPartLower.includes('neck');
        } else {
          matchesCategory = bodyPartLower.includes(categoryLower);
        }
      }

      return matchesQuery && matchesCategory;
    });
  }, [exercises, searchQuery, selectedCategory]);

  const handleGoToWorkout = () => {
    router.push('/(tabs)/workout');
  };

  const handleOpenDetailModal = (exercise: ExerciseItem) => {
    setSelectedExerciseDetail(exercise);
    setDetailModalVisible(true);
  };

  const renderExerciseCard = ({ item }: { item: ExerciseItem }) => {
    const isAdded = isExerciseSelected(item.id);
    const bodyPartEs = translateBodyPart(item.bodyPart || 'waist');
    const targetEs = translateTarget(item.target || item.primaryMuscles?.[0] || 'abs');
    const equipmentEs = translateEquipment(item.equipment || 'body weight');
    const firstInstruction = item.instructions && item.instructions.length > 0
      ? item.instructions[0]
      : 'Técnica guiada paso a paso.';

    return (
      <Pressable style={styles.cardContainer} onPress={() => handleOpenDetailModal(item)}>
        {/* Media Preview (GIF animation) */}
        <View style={styles.imageWrapper}>
          {item.gifUrl ? (
            <Image source={{ uri: item.gifUrl }} style={styles.cardImage} resizeMode="contain" />
          ) : (
            <View style={styles.placeholderImage}>
              <MaterialCommunityIcons name="dumbbell" size={40} color={Colors.outline} />
            </View>
          )}
          <View style={styles.overlayGradient} />
          
          <View style={styles.badgeTopRight}>
            <MaterialCommunityIcons name="target" size={12} color={Colors.primaryContainer} />
            <Text style={styles.badgeTopRightText}>
              {targetEs.toUpperCase()}
            </Text>
          </View>

          <View style={styles.badgeTopLeft}>
            <MaterialIcons name="visibility" size={12} color={Colors.onSurface} />
            <Text style={styles.badgeTopLeftText}>Ver GIF & Técnica</Text>
          </View>
        </View>

        {/* Content Details */}
        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.name}
            </Text>
          </View>

          {/* Tags */}
          <View style={styles.tagRow}>
            <View style={styles.muscleTag}>
              <View style={styles.tagDot} />
              <Text style={styles.tagText}>{bodyPartEs}</Text>
            </View>
            <View style={styles.targetTag}>
              <Text style={styles.targetTagText}>{targetEs}</Text>
            </View>
            <View style={styles.equipTag}>
              <MaterialCommunityIcons name="dumbbell" size={12} color={Colors.onSurfaceVariant} />
              <Text style={styles.equipTagText}>{equipmentEs}</Text>
            </View>
          </View>

          {/* Instruction Snippet */}
          <Text style={styles.instructionSnippet} numberOfLines={2}>
            {firstInstruction}
          </Text>

          {/* Dynamic Action Bar */}
          <View style={styles.cardFooter}>
            <View style={styles.specRow}>
              <MaterialIcons name="speed" size={14} color={Colors.primaryContainer} />
              <Text style={styles.specText}>3-4 series</Text>
              <MaterialIcons name="repeat" size={14} color={Colors.primaryContainer} style={{ marginLeft: 6 }} />
              <Text style={styles.specText}>8-12 reps</Text>
            </View>

            <Pressable
              style={[styles.addBtn, isAdded && styles.addBtnSelected]}
              onPress={(e) => {
                e.stopPropagation();
                toggleExerciseSelection(item);
              }}>
              <MaterialIcons
                name={isAdded ? 'check' : 'add'}
                size={16}
                color={isAdded ? Colors.onPrimaryContainer : Colors.onSurface}
              />
              <Text style={[styles.addBtnText, isAdded && styles.addBtnSelectedText]}>
                {isAdded ? 'Añadido' : 'Añadir a Rutina'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  const isModalExAdded = selectedExerciseDetail ? isExerciseSelected(selectedExerciseDetail.id) : false;
  const selectedCategoryObj = BODY_PART_FILTERS.find((c) => c.id === selectedCategory);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={Colors.onSurfaceVariant} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por ejercicio, músculo o equipo..."
              placeholderTextColor={Colors.outline}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={18} color={Colors.onSurfaceVariant} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Horizontal Filter Chips */}
        <View style={styles.chipsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {BODY_PART_FILTERS.map((chip) => {
              const isSelected = selectedCategory === chip.id;
              return (
                <Pressable
                  key={chip.id}
                  style={[styles.chipBtn, isSelected && styles.chipBtnSelected]}
                  onPress={() => setSelectedCategory(chip.id)}>
                  {isSelected && <View style={styles.chipActiveDot} />}
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Header Indicator */}
        <View style={styles.categoryHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.pulseDot} />
            <Text style={styles.categoryTitle}>
              Ejercicios {selectedCategory !== 'todos' ? `de ${selectedCategoryObj?.label}` : ''}
            </Text>
          </View>
          <Text style={styles.countText}>{filteredExercises.length} disponibles</Text>
        </View>

        {/* Exercise Cards Stream */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={Colors.primaryContainer} />
            <Text style={styles.loadingText}>Cargando catálogo ExerciseDB con GIFs en vivo...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <MaterialIcons name="error-outline" size={40} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={fetchExercises}>
              <Text style={styles.retryBtnText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={filteredExercises}
            keyExtractor={(item) => item.id}
            renderItem={renderExerciseCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        )}

        {/* Floating Routine Basket Pill */}
        {selectedExercises.length > 0 && (
          <View style={styles.floatingBasketContainer}>
            <View style={styles.basketPill}>
              <View style={styles.basketLeft}>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{selectedExercises.length}</Text>
                </View>
                <View>
                  <Text style={styles.basketTitle}>ejercicios seleccionados</Text>
                  <Text style={styles.basketSub}>Rutina Activa Kinetic</Text>
                </View>
              </View>
              <Pressable style={styles.basketActionBtn} onPress={handleGoToWorkout}>
                <Text style={styles.basketActionText}>Ver Rutina</Text>
                <MaterialIcons name="arrow-forward" size={16} color={Colors.onPrimaryContainer} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Exercise Detail Modal with GIF Player */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={detailModalVisible}
          onRequestClose={() => setDetailModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.detailModalContainer}>
              {/* Top Header */}
              <View style={styles.modalTopHeader}>
                <View style={styles.modalHeaderBadge}>
                  <MaterialCommunityIcons name="lightning-bolt" size={14} color={Colors.primaryContainer} />
                  <Text style={styles.modalHeaderBadgeText}>EXERCISEDB BIOMECÁNICA</Text>
                </View>
                <Pressable onPress={() => setDetailModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color={Colors.onSurface} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* GIF Player Box */}
                <View style={styles.animFrameBox}>
                  {selectedExerciseDetail?.gifUrl ? (
                    <Image
                      source={{ uri: selectedExerciseDetail.gifUrl }}
                      style={styles.animImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <MaterialCommunityIcons name="dumbbell" size={60} color={Colors.outline} />
                  )}
                  <View style={styles.animTag}>
                    <View style={styles.animDot} />
                    <Text style={styles.animTagText}>ANIMACIÓN GIF 3D EN VIVO</Text>
                  </View>
                </View>

                {/* Title */}
                <Text style={styles.detailTitle}>{selectedExerciseDetail?.name}</Text>

                {/* Specs Badges */}
                <View style={styles.detailBadgesRow}>
                  <View style={styles.detailBadge}>
                    <Text style={styles.detailBadgeLabel}>Zona Corporal</Text>
                    <Text style={styles.detailBadgeVal}>
                      {translateBodyPart(selectedExerciseDetail?.bodyPart || '')}
                    </Text>
                  </View>

                  <View style={styles.detailBadge}>
                    <Text style={styles.detailBadgeLabel}>Músculo Objetivo</Text>
                    <Text style={styles.detailBadgeVal}>
                      {translateTarget(selectedExerciseDetail?.target || '')}
                    </Text>
                  </View>

                  <View style={styles.detailBadge}>
                    <Text style={styles.detailBadgeLabel}>Equipamiento</Text>
                    <Text style={styles.detailBadgeVal}>
                      {translateEquipment(selectedExerciseDetail?.equipment || '')}
                    </Text>
                  </View>
                </View>

                {/* Secondary Muscles if present */}
                {selectedExerciseDetail?.secondaryMuscles &&
                  selectedExerciseDetail.secondaryMuscles.length > 0 && (
                    <View style={styles.sectionWrap}>
                      <Text style={styles.detailSectionTitle}>Músculos Secundarios</Text>
                      <View style={styles.secondaryMusclesRow}>
                        {selectedExerciseDetail.secondaryMuscles.map((m, idx) => (
                          <View key={idx} style={styles.secMuscleChip}>
                            <Text style={styles.secMuscleChipText}>{translateTarget(m)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                {/* Step-by-Step Instructions */}
                <View style={styles.sectionWrap}>
                  <Text style={styles.detailSectionTitle}>Instrucciones Paso a Paso</Text>
                  {selectedExerciseDetail?.instructions &&
                  selectedExerciseDetail.instructions.length > 0 ? (
                    selectedExerciseDetail.instructions.map((step, sIdx) => (
                      <View key={sIdx} style={styles.stepItem}>
                        <View style={styles.stepNumCircle}>
                          <Text style={styles.stepNumText}>{sIdx + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>{step}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.stepText}>
                      Mantén la postura erguida, controla la fase excéntrica y contrae el músculo objetivo en el punto de máxima tensión.
                    </Text>
                  )}
                </View>
              </ScrollView>

              {/* Modal Bottom CTA */}
              <View style={styles.modalFooter}>
                <Pressable
                  style={[styles.modalAddBtn, isModalExAdded && styles.modalAddBtnSelected]}
                  onPress={() => {
                    if (selectedExerciseDetail) {
                      toggleExerciseSelection(selectedExerciseDetail);
                    }
                  }}>
                  <MaterialIcons
                    name={isModalExAdded ? 'check' : 'add'}
                    size={20}
                    color={Colors.onPrimaryContainer}
                  />
                  <Text style={styles.modalAddBtnText}>
                    {isModalExAdded ? 'Añadido a la Rutina' : 'Añadir a la Rutina Actual'}
                  </Text>
                </Pressable>
              </View>
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
  searchSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.sm,
    height: 48,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 14,
  },
  chipsContainer: {
    marginBottom: Spacing.sm,
  },
  chipsScroll: {
    paddingHorizontal: Spacing.md,
    gap: 8,
  },
  chipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceContainer,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipBtnSelected: {
    backgroundColor: Colors.primaryContainer,
  },
  chipActiveDot: {
    width: 6,
    height: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.onPrimaryContainer,
  },
  chipText: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: Colors.onPrimaryContainer,
    fontWeight: '800',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryContainer,
  },
  categoryTitle: {
    color: Colors.onSurface,
    fontSize: 15,
    fontWeight: '700',
  },
  countText: {
    color: Colors.primaryContainer,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 100,
    gap: Spacing.md,
  },
  cardContainer: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  imageWrapper: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.surfaceContainerLow,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0A0E17',
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayGradient: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 14, 23, 0.15)',
  },
  badgeTopRight: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(10, 14, 23, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeTopRightText: {
    color: Colors.primaryContainer,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  badgeTopLeft: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(10, 14, 23, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeTopLeftText: {
    color: Colors.onSurface,
    fontSize: 9,
    fontWeight: '700',
  },
  cardContent: {
    padding: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardTitle: {
    color: Colors.onSurface,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textTransform: 'capitalize',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  muscleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceBright,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryContainer,
  },
  tagText: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '600',
  },
  targetTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  targetTagText: {
    color: Colors.primaryContainer,
    fontSize: 11,
    fontWeight: '700',
  },
  equipTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  equipTagText: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
  },
  instructionSnippet: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderTranslucent,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  specText: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceBright,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
  },
  addBtnSelected: {
    backgroundColor: Colors.primaryContainer,
  },
  addBtnText: {
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: '700',
  },
  addBtnSelectedText: {
    color: Colors.onPrimaryContainer,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    marginTop: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  retryBtn: {
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
    marginTop: Spacing.md,
  },
  retryBtnText: {
    color: Colors.onPrimaryContainer,
    fontWeight: '700',
  },
  floatingBasketContainer: {
    position: 'absolute',
    bottom: 12,
    left: Spacing.md,
    right: Spacing.md,
    alignItems: 'center',
  },
  basketPill: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radii.full,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.activeBorderTranslucent,
    elevation: 8,
  },
  basketLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countBadge: {
    width: 28,
    height: 28,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: Colors.onPrimaryContainer,
    fontSize: 13,
    fontWeight: '800',
  },
  basketTitle: {
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: '700',
  },
  basketSub: {
    color: Colors.primaryContainer,
    fontSize: 10,
  },
  basketActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
  },
  basketActionText: {
    color: Colors.onPrimaryContainer,
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  detailModalContainer: {
    backgroundColor: Colors.surfaceContainer,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    maxHeight: '90%',
    padding: Spacing.lg,
  },
  modalTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceBright,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  modalHeaderBadgeText: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  animFrameBox: {
    width: '100%',
    height: 240,
    backgroundColor: '#0A0E17',
    borderRadius: Radii.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  animImage: {
    width: '100%',
    height: '100%',
  },
  animTag: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(10, 14, 23, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  animDot: {
    width: 6,
    height: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryContainer,
  },
  animTagText: {
    color: Colors.onSurface,
    fontSize: 9,
    fontWeight: '700',
  },
  detailTitle: {
    color: Colors.onSurface,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: Spacing.md,
    textTransform: 'capitalize',
  },
  detailBadgesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  detailBadge: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  detailBadgeLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    marginBottom: 2,
  },
  detailBadgeVal: {
    color: Colors.primaryContainer,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionWrap: {
    marginBottom: Spacing.lg,
  },
  detailSectionTitle: {
    color: Colors.onSurface,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  secondaryMusclesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  secMuscleChip: {
    backgroundColor: Colors.surfaceBright,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  secMuscleChipText: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '600',
  },
  stepItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  stepNumCircle: {
    width: 22,
    height: 22,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumText: {
    color: Colors.onPrimaryContainer,
    fontSize: 11,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 19,
  },
  modalFooter: {
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderTranslucent,
    marginTop: Spacing.xs,
  },
  modalAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryContainer,
    paddingVertical: 14,
    borderRadius: Radii.xl,
  },
  modalAddBtnSelected: {
    backgroundColor: Colors.secondary,
  },
  modalAddBtnText: {
    color: Colors.onPrimaryContainer,
    fontSize: 15,
    fontWeight: '800',
  },
});
