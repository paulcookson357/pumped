import { HistoryClient } from "@/components/history/HistoryClient";
import {
  getCachedExercises,
  getCachedRoutines,
  getCachedSettings,
  getCachedWorkouts,
} from "@/lib/cache/loaders";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const [workoutsBundle, initialExercises, routinesBundle, initialSettings] =
    await Promise.all([
      getCachedWorkouts(),
      getCachedExercises(),
      getCachedRoutines(),
      getCachedSettings(),
    ]);

  return (
    <HistoryClient
      initialWorkouts={workoutsBundle.workouts}
      initialWorkoutSets={workoutsBundle.workoutSets}
      initialExercises={initialExercises}
      initialRoutines={routinesBundle.routines}
      initialSettings={initialSettings}
    />
  );
}
