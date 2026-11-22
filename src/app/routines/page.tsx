import { RoutinesClient } from "@/components/routines/RoutinesClient";
import {
  getCachedExercises,
  getCachedRoutines,
  getCachedSchedule,
  getCachedSettings,
} from "@/lib/cache/loaders";

export const dynamic = "force-dynamic";

export default async function RoutinesPage() {
  const [routinesBundle, initialExercises, scheduleBundle, initialSettings] =
    await Promise.all([
      getCachedRoutines(),
      getCachedExercises(),
      getCachedSchedule(),
      getCachedSettings(),
    ]);

  return (
    <RoutinesClient
      initialRoutines={routinesBundle.routines}
      initialRoutineExercises={routinesBundle.routineExercises}
      initialExercises={initialExercises}
      initialWeeklySplitRules={scheduleBundle.weeklySplitRules}
      initialScheduledWorkouts={scheduleBundle.scheduledWorkouts}
      initialSettings={initialSettings}
    />
  );
}
