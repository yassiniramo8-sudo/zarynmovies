ALTER TABLE public.advertisements
  ADD COLUMN IF NOT EXISTS trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.advertisements.trigger_config IS
'Timed/triggered ad config: { trigger, delaySeconds, scrollPercent, videoPercent, displayMode, autoCloseSeconds, closeButtonLockSeconds, frequency, frequencyValue, countdownSeconds }';