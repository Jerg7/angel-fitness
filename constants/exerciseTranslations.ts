export const BODY_PART_TRANSLATIONS: Record<string, string> = {
  'waist': 'Abdomen / Core',
  'upper legs': 'Piernas (Cuádriceps/Isquios)',
  'lower legs': 'Pantorrillas',
  'chest': 'Pecho',
  'back': 'Espalda',
  'upper arms': 'Brazos',
  'shoulders': 'Hombros',
  'cardio': 'Cardio',
  'neck': 'Cuello',
};

export const TARGET_TRANSLATIONS: Record<string, string> = {
  'abs': 'Abdominales',
  'biceps': 'Bíceps',
  'triceps': 'Tríceps',
  'glutes': 'Glúteos',
  'lats': 'Dorsales',
  'quads': 'Cuádriceps',
  'hamstrings': 'Isquiosurales',
  'calves': 'Pantorrillas',
  'pectorals': 'Pectorales',
  'delts': 'Deltoides',
  'traps': 'Trapecios',
  'forearms': 'Antebrazos',
  'adductors': 'Aductores',
  'abductors': 'Abductores',
  'cardiovascular system': 'Sistema Cardiovascular',
  'levator scapulae': 'Elevador de la escápula',
  'upper back': 'Espalda Alta',
  'spine': 'Columna / Espinal',
};

export const EQUIPMENT_TRANSLATIONS: Record<string, string> = {
  'body weight': 'Peso corporal',
  'barbell': 'Barra',
  'dumbbell': 'Mancuerna',
  'cable': 'Polea / Cable',
  'band': 'Banda elástica',
  'kettlebell': 'Pesa rusa',
  'machine': 'Máquina',
  'assisted': 'Asistido',
  'medicine ball': 'Balón medicinal',
  'smith machine': 'Máquina Smith',
  'weighted': 'Con peso',
  'stability ball': 'Pelota de estabilidad',
  'ez barbell': 'Barra EZ',
  'bosu ball': 'Bosu',
  'resistance band': 'Banda de resistencia',
  'roller': 'Rodillo',
  'rope': 'Cuerda',
  'skiergometer': 'Ergómetro de esquí',
  'sled ergometer': 'Trineo / Ergómetro',
  'stationary bike': 'Bicicleta estática',
  'stepmill stairs': 'Escaladora / Stepmill',
  'tire': 'Neumático / Rueda',
  'trap bar': 'Barra Hexagonal',
  'wheel roller': 'Rueda abdominal',
};

export function translateBodyPart(bodyPart: string): string {
  if (!bodyPart) return 'General';
  const key = bodyPart.toLowerCase().trim();
  return BODY_PART_TRANSLATIONS[key] || bodyPart.charAt(0).toUpperCase() + bodyPart.slice(1);
}

export function translateTarget(target: string): string {
  if (!target) return 'General';
  const key = target.toLowerCase().trim();
  return TARGET_TRANSLATIONS[key] || target.charAt(0).toUpperCase() + target.slice(1);
}

export function translateEquipment(equipment: string): string {
  if (!equipment) return 'General';
  const key = equipment.toLowerCase().trim();
  return EQUIPMENT_TRANSLATIONS[key] || equipment.charAt(0).toUpperCase() + equipment.slice(1);
}

export const BODY_PART_FILTERS: Array<{ id: string; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'waist', label: 'Abdomen' },
  { id: 'chest', label: 'Pecho' },
  { id: 'back', label: 'Espalda' },
  { id: 'upper arms', label: 'Brazos' },
  { id: 'shoulders', label: 'Hombros' },
  { id: 'upper legs', label: 'Piernas' },
  { id: 'lower legs', label: 'Pantorrillas' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'neck', label: 'Cuello' },
];
