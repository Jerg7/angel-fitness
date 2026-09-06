export interface ExerciseDBItem {
  id: string;
  name: string;
  target: string;
  bodyPart: string;
  equipment: string;
  gifUrl: string;
  instructions: string[];
  secondaryMuscles?: string[];
}

export type BodyPartFilter =
  | 'todos'
  | 'waist'
  | 'upper legs'
  | 'lower legs'
  | 'chest'
  | 'back'
  | 'upper arms'
  | 'shoulders'
  | 'cardio'
  | 'neck';
