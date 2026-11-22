import { ExerciseProgressClient } from "@/components/exercises/ExerciseProgressClient";
import {
  getCachedExercises,
  getCachedSettings,
  getCachedWorkouts,
  getExerciseProgress,
} from "@/lib/cache/loaders";

export const dynamic = "force-dynamic";

export default async function ExerciseProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [exercises, workoutsBundle, initialProgress, initialSettings] =
    await Promise.all([
      getCachedExercises(),
      getCachedWorkouts(),
      getExerciseProgress(id),
      getCachedSettings(),
    ]);

  const initialExercise = exercises.find((e) => e.id === id) ?? null;

  return (
    <ExerciseProgressClient
      exerciseId={id}
      initialExercise={initialExercise}
      initialProgress={initialProgress}
      initialWorkouts={workoutsBundle.workouts}
      initialWorkoutSets={workoutsBundle.workoutSets}
      initialSettings={initialSettings}
    />
  );
}
