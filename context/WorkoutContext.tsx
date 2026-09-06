import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ExerciseItem } from '@/app/(tabs)/exercises';

export interface SetItem {
  id: number;
  type: 'C' | 'E' | 'D'; // Calentamiento, Efectiva, Drop
  previous: string;
  weight: number;
  reps: number;
  completed: boolean;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
  image?: string;
  sets: SetItem[];
}

interface WorkoutContextType {
  selectedExercises: WorkoutExercise[];
  activeExerciseIndex: number;
  activeExercise: WorkoutExercise | null;
  sessionSeconds: number;
  isSessionActive: boolean;
  addExerciseToWorkout: (exercise: ExerciseItem) => void;
  removeExerciseFromWorkout: (exerciseId: string) => void;
  isExerciseSelected: (exerciseId: string) => boolean;
  toggleExerciseSelection: (exercise: ExerciseItem) => void;
  setActiveExerciseIndex: (index: number) => void;
  nextExercise: () => void;
  previousExercise: () => void;
  addSetToActiveExercise: () => void;
  removeSetFromActiveExercise: (setId: number) => void;
  updateSetInActiveExercise: (setId: number, field: 'weight' | 'reps', value: number) => void;
  toggleSetCompletedInActiveExercise: (setId: number) => SetItem | undefined;
  startSession: () => void;
  pauseSession: () => void;
  resetSession: () => void;
  finishWorkoutSession: () => void;
  clearWorkout: () => void;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export const WorkoutProvider = ({ children }: { children: ReactNode }) => {
  const [selectedExercises, setSelectedExercises] = useState<WorkoutExercise[]>([]);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState<number>(0);
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);

  // Session Stopwatch
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isSessionActive) {
      interval = setInterval(() => {
        setSessionSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSessionActive]);

  const activeExercise = selectedExercises[activeExerciseIndex] || null;

  const isExerciseSelected = (exerciseId: string) => {
    return selectedExercises.some((item) => item.id === exerciseId);
  };

  const addExerciseToWorkout = (exercise: ExerciseItem) => {
    if (isExerciseSelected(exercise.id)) return;

    const primaryMuscle =
      exercise.primaryMuscles && exercise.primaryMuscles.length > 0
        ? exercise.primaryMuscles[0]
        : 'General';

    const IMAGE_CDN_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
    const image = exercise.images && exercise.images.length > 0 ? `${IMAGE_CDN_BASE}${exercise.images[0]}` : undefined;

    const newWorkoutExercise: WorkoutExercise = {
      id: exercise.id,
      name: exercise.name,
      primaryMuscle,
      equipment: exercise.equipment || 'Libre',
      image,
      sets: [
        { id: 1, type: 'C', previous: '12 reps', weight: 40, reps: 12, completed: false },
        { id: 2, type: 'E', previous: '10 reps', weight: 60, reps: 10, completed: false },
        { id: 3, type: 'E', previous: '8 reps', weight: 70, reps: 8, completed: false },
      ],
    };

    setSelectedExercises((prev) => [...prev, newWorkoutExercise]);
    if (!isSessionActive) {
      setIsSessionActive(true);
    }
  };

  const removeExerciseFromWorkout = (exerciseId: string) => {
    setSelectedExercises((prev) => {
      return prev.filter((item) => item.id !== exerciseId);
    });
    if (activeExerciseIndex >= selectedExercises.length - 1) {
      setActiveExerciseIndex(Math.max(0, selectedExercises.length - 2));
    }
  };

  const toggleExerciseSelection = (exercise: ExerciseItem) => {
    if (isExerciseSelected(exercise.id)) {
      removeExerciseFromWorkout(exercise.id);
    } else {
      addExerciseToWorkout(exercise);
    }
  };

  const nextExercise = () => {
    if (activeExerciseIndex < selectedExercises.length - 1) {
      setActiveExerciseIndex((prev) => prev + 1);
    }
  };

  const previousExercise = () => {
    if (activeExerciseIndex > 0) {
      setActiveExerciseIndex((prev) => prev - 1);
    }
  };

  const addSetToActiveExercise = () => {
    if (!activeExercise) return;
    const currentSets = activeExercise.sets;
    const lastSet = currentSets[currentSets.length - 1];

    const newSet: SetItem = {
      id: currentSets.length + 1,
      type: 'E',
      previous: lastSet ? `${lastSet.weight} kg × ${lastSet.reps}` : '60 kg × 10',
      weight: lastSet ? lastSet.weight : 60,
      reps: lastSet ? lastSet.reps : 10,
      completed: false,
    };

    const updatedExercises = [...selectedExercises];
    updatedExercises[activeExerciseIndex] = {
      ...activeExercise,
      sets: [...currentSets, newSet],
    };
    setSelectedExercises(updatedExercises);
  };

  const removeSetFromActiveExercise = (setId: number) => {
    if (!activeExercise) return;
    const filteredSets = activeExercise.sets.filter((s) => s.id !== setId);
    const reindexedSets = filteredSets.map((s, idx) => ({ ...s, id: idx + 1 }));

    const updatedExercises = [...selectedExercises];
    updatedExercises[activeExerciseIndex] = {
      ...activeExercise,
      sets: reindexedSets,
    };
    setSelectedExercises(updatedExercises);
  };

  const updateSetInActiveExercise = (setId: number, field: 'weight' | 'reps', value: number) => {
    if (!activeExercise) return;
    const updatedSets = activeExercise.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s));

    const updatedExercises = [...selectedExercises];
    updatedExercises[activeExerciseIndex] = {
      ...activeExercise,
      sets: updatedSets,
    };
    setSelectedExercises(updatedExercises);
  };

  const toggleSetCompletedInActiveExercise = (setId: number) => {
    if (!activeExercise) return undefined;
    let targetSet: SetItem | undefined;

    const updatedSets = activeExercise.sets.map((s) => {
      if (s.id === setId) {
        targetSet = { ...s, completed: !s.completed };
        return targetSet;
      }
      return s;
    });

    const updatedExercises = [...selectedExercises];
    updatedExercises[activeExerciseIndex] = {
      ...activeExercise,
      sets: updatedSets,
    };
    setSelectedExercises(updatedExercises);
    return targetSet;
  };

  const startSession = () => setIsSessionActive(true);
  const pauseSession = () => setIsSessionActive(false);
  const resetSession = () => {
    setSessionSeconds(0);
    setIsSessionActive(true);
  };

  const finishWorkoutSession = () => {
    setSessionSeconds(0);
    setIsSessionActive(false);
    setSelectedExercises([]);
    setActiveExerciseIndex(0);
  };

  const clearWorkout = () => {
    setSelectedExercises([]);
    setActiveExerciseIndex(0);
    setSessionSeconds(0);
    setIsSessionActive(false);
  };

  return (
    <WorkoutContext.Provider
      value={{
        selectedExercises,
        activeExerciseIndex,
        activeExercise,
        sessionSeconds,
        isSessionActive,
        addExerciseToWorkout,
        removeExerciseFromWorkout,
        isExerciseSelected,
        toggleExerciseSelection,
        setActiveExerciseIndex,
        nextExercise,
        previousExercise,
        addSetToActiveExercise,
        removeSetFromActiveExercise,
        updateSetInActiveExercise,
        toggleSetCompletedInActiveExercise,
        startSession,
        pauseSession,
        resetSession,
        finishWorkoutSession,
        clearWorkout,
      }}>
      {children}
    </WorkoutContext.Provider>
  );
};

export const useWorkout = () => {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkout debe ser utilizado dentro de un WorkoutProvider');
  }
  return context;
};
