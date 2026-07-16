'use client';

import { useCallback } from 'react';
import { Mic, MicOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonStyles } from '@/components/ui/Button';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { toast } from '@/components/ui/toast';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  append?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export function VoiceInputButton({
  onTranscript,
  append = true,
  className,
  size = 'md',
  disabled = false,
}: VoiceInputButtonProps) {
  const handleResult = useCallback(
    (text: string) => {
      if (append) {
        onTranscript(text);
      } else {
        onTranscript(text);
      }
    },
    [onTranscript, append]
  );

  const handleError = useCallback((error: string) => {
    toast.error(error);
  }, []);

  const { isListening, isSupported, transcript, toggle } = useVoiceInput({
    onResult: handleResult,
    onError: handleError,
    continuous: false,
  });

  if (!isSupported) {
    return null;
  }

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
        title={isListening ? 'Stop voice input' : 'Start voice input'}
        className={cn(
          buttonStyles({ variant: isListening ? 'danger' : 'ghost', size }),
          isListening && 'animate-pulse'
        )}
      >
        {isListening ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>

      {isListening && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-border bg-surface-elevated p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
            <span className="text-xs font-bold text-foreground">Listening...</span>
          </div>
          {transcript && (
            <p className="mt-2 text-xs text-foreground-muted line-clamp-2">{transcript}</p>
          )}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={toggle}
              className={buttonStyles({ variant: 'ghost', size: 'sm' })}
            >
              <X className="h-3 w-3" /> Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface VoiceTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
}

export function VoiceTextArea({
  value,
  onChange,
  placeholder,
  className,
  rows = 4,
  disabled = false,
}: VoiceTextAreaProps) {
  const handleTranscript = useCallback(
    (text: string) => {
      const newValue = value ? `${value} ${text}` : text;
      onChange(newValue);
    },
    [value, onChange]
  );

  return (
    <div className={cn('relative', className)}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 pr-12 text-sm text-foreground placeholder:text-foreground-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
      />
      <div className="absolute right-2 top-2">
        <VoiceInputButton
          onTranscript={handleTranscript}
          append={true}
          size="sm"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

interface VoiceCommandButtonProps {
  onCommand: (command: string) => void;
  className?: string;
  disabled?: boolean;
}

export function VoiceCommandButton({
  onCommand,
  className,
  disabled = false,
}: VoiceCommandButtonProps) {
  const handleResult = useCallback(
    (text: string) => {
      onCommand(text.toLowerCase().trim());
    },
    [onCommand]
  );

  const handleError = useCallback((error: string) => {
    toast.error(error);
  }, []);

  const { isListening, isSupported, toggle } = useVoiceInput({
    onResult: handleResult,
    onError: handleError,
    continuous: false,
  });

  if (!isSupported) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || isListening}
      aria-label={isListening ? 'Listening for command...' : 'Voice command'}
      title="Voice command (speak a command)"
      className={cn(
        buttonStyles({ variant: 'ghost', size: 'sm' }),
        isListening && 'animate-pulse text-danger',
        className
      )}
    >
      {isListening ? (
        <>
          <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
          <span className="sr-only">Listening...</span>
        </>
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
}
