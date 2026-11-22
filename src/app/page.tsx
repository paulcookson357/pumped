import { CalendarHubClient } from "@/components/calendar/CalendarHubClient";
import {
  getCachedExercises,
  getCachedRoutines,
  getCachedSchedule,
  getCachedSettings,
  getCachedWorkouts,
} from "@/lib/cache/loaders";
import { toLocalDateString } from "@/lib/dates/localDate";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CalendarHomePage() {
  const configured = isSupabaseConfigured();
  const [
    routinesBundle,
    scheduleBundle,
    initialExercises,
    workoutsBundle,
    initialSettings,
  ] = await Promise.all([
    getCachedRoutines(),
    getCachedSchedule(),
    getCachedExercises(),
    getCachedWorkouts(),
    getCachedSettings(),
  ]);

  const serverTodayDate = toLocalDateString(new Date());

  return (
    <CalendarHubClient
      serverTodayDate={serverTodayDate}
      isConfigured={configured}
      initialRoutines={routinesBundle.routines}
      initialRoutineExercises={routinesBundle.routineExercises}
      initialExercises={initialExercises}
      initialWeeklySplitRules={scheduleBundle.weeklySplitRules}
      initialScheduledWorkouts={scheduleBundle.scheduledWorkouts}
      initialWorkouts={workoutsBundle.workouts}
      initialSettings={initialSettings}
    />
  );
}
