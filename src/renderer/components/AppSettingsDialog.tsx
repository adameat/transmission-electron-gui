import { Monitor, Moon, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { InterfaceTheme } from '@shared/types';

interface AppSettingsDialogProps {
  open: boolean;
  interfaceTheme: InterfaceTheme;
  busy: boolean;
  onClose: () => void;
  onSave: (interfaceTheme: InterfaceTheme) => Promise<void>;
}

const themeOptions: Array<{ value: InterfaceTheme; label: string; icon: JSX.Element }> = [
  { value: 'system', label: 'System', icon: <Monitor size={17} aria-hidden="true" /> },
  { value: 'light', label: 'Light', icon: <Sun size={17} aria-hidden="true" /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={17} aria-hidden="true" /> }
];

export function AppSettingsDialog({ open, interfaceTheme, busy, onClose, onSave }: AppSettingsDialogProps): JSX.Element | null {
  const [draftTheme, setDraftTheme] = useState<InterfaceTheme>(interfaceTheme);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const themeOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftTheme(interfaceTheme);
    setSaving(false);
    setError('');
  }, [interfaceTheme, open]);

  if (!open) {
    return null;
  }

  function focusThemeOption(index: number): void {
    window.requestAnimationFrame(() => themeOptionRefs.current[index]?.focus());
  }

  function selectThemeOption(index: number): void {
    const option = themeOptions[(index + themeOptions.length) % themeOptions.length];
    setDraftTheme(option.value);
    focusThemeOption(themeOptions.indexOf(option));
  }

  function handleThemeKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const currentIndex = Math.max(0, themeOptions.findIndex((option) => option.value === draftTheme));

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      selectThemeOption(currentIndex + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      selectThemeOption(currentIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectThemeOption(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      selectThemeOption(themeOptions.length - 1);
    }
  }

  async function save(): Promise<void> {
    setSaving(true);
    setError('');
    try {
      await onSave(draftTheme);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }

  const disabled = busy || saving;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal app-settings-modal" role="dialog" aria-modal="true" aria-label="App settings">
        <header className="modal-header">
          <h2>Settings</h2>
          <button type="button" className="icon-button" title="Close" aria-label="Close settings" onClick={onClose} disabled={disabled}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="modal-body app-settings-body">
          <fieldset className="settings-group">
            <legend>Interface theme</legend>
            <div className="theme-options" role="radiogroup" aria-label="Interface theme" onKeyDown={handleThemeKeyDown}>
              {themeOptions.map((option, optionIndex) => (
                <button
                  key={option.value}
                  ref={(element) => {
                    themeOptionRefs.current[optionIndex] = element;
                  }}
                  type="button"
                  className={option.value === draftTheme ? 'theme-option active' : 'theme-option'}
                  role="radio"
                  aria-checked={option.value === draftTheme}
                  tabIndex={option.value === draftTheme ? 0 : -1}
                  onClick={() => setDraftTheme(option.value)}
                  disabled={disabled}
                >
                  {option.icon}
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <footer className="modal-footer">
          {error ? <p className="form-error">{error}</p> : null}
          <span className="modal-footer-spacer" />
          <button type="button" className="command-button" onClick={onClose} disabled={disabled}>
            Cancel
          </button>
          <button type="button" className="command-button primary" onClick={save} disabled={disabled}>
            Save
          </button>
        </footer>
      </section>
    </div>
  );
}
