import { WorkoutDetailClient } from "@/components/history/WorkoutDetailClient";
import {
  getCachedExercises,
  getCachedRoutines,
  getCachedSettings,
  getWorkoutById,
} from "@/lib/cache/loaders";

export const dynamic = "force-dynamic";

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [workoutData, initialExercises, routinesBundle, initialSettings] =
    await Promise.all([
      getWorkoutById(id),
      getCachedExercises(),
      getCachedRoutines(),
      getCachedSettings(),
    ]);

  return (
    <WorkoutDetailClient
      workoutId={id}
      initialWorkout={workoutData?.workout ?? null}
      initialSets={workoutData?.sets ?? []}
      initialExercises={initialExercises}
      initialRoutines={routinesBundle.routines}
      initialSettings={initialSettings}
    />
  );
}
