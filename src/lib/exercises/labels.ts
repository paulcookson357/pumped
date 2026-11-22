import type {
  EquipmentType,
  MuscleGroup,
  TrackingType,
} from "@/lib/types/domain";

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  core: "Core",
  forearms: "Forearms",
  cardio: "Cardio",
};

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  cable: "Cable",
  bodyweight: "Bodyweight",
  kettlebell: "Kettlebell",
  smith_machine: "Smith Machine",
  cardio_machine: "Cardio Machine",
  other: "Other",
};

export const TRACKING_LABELS: Record<TrackingType, string> = {
  weight_reps: "Weight & Reps",
  bodyweight_reps: "Bodyweight Reps",
  weighted_bodyweight: "Weighted Bodyweight",
  duration: "Duration",
  cardio: "Cardio",
};

export const MUSCLE_GROUPS = Object.keys(MUSCLE_LABELS) as MuscleGroup[];
export const EQUIPMENT_TYPES = Object.keys(EQUIPMENT_LABELS) as EquipmentType[];
export const TRACKING_TYPES = Object.keys(TRACKING_LABELS) as TrackingType[];
