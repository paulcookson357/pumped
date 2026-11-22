-- Harden function search_path against mutable search_path lint (0011_function_search_path_mutable)
ALTER FUNCTION public.set_updated_at() SET search_path = '';
ALTER FUNCTION public.bump_sync_domain(TEXT) SET search_path = '';
ALTER FUNCTION public.get_previous_exercise_sets(UUID[]) SET search_path = '';
ALTER FUNCTION public.get_exercise_progress(UUID) SET search_path = '';
ALTER FUNCTION public.finalize_workout_stats(UUID, UUID) SET search_path = '';
