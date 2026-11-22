import { ExerciseLibraryClient } from "@/components/exercises/ExerciseLibraryClient";
import { getCachedExercises } from "@/lib/cache/loaders";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const initialExercises = await getCachedExercises();

  return <ExerciseLibraryClient initialExercises={initialExercises} />;
}
