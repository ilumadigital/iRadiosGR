import React, {useEffect, useRef, useState} from 'react';
import {CalendarDays} from 'lucide-react';
import {formatInputDate, formatLocalDateTime, parseGreekDate, parseGreekDateTime}
  from '../utils/dateTime';

// Controlled forms still receive ISO yyyy-MM-dd / yyyy-MM-ddTHH:mm values.
// Users always type and see Greek day-first notation, independent of browser locale.
export default function GreekDateInput({
  value = '', onChange, type = 'date', className = '', required = false,
  disabled = false, min, max, id, name, autoComplete, 'aria-label': ariaLabel,
  ...rest
}) {
  const withTime = type === 'datetime-local';
  const display = withTime ? formatLocalDateTime : formatInputDate;
  const parse = withTime ? parseGreekDateTime : parseGreekDate;
  const [text, setText] = useState(() => display(value));
  const [invalid, setInvalid] = useState(false);
  const pickerRef = useRef(null);
  const visibleRef = useRef(null);
  useEffect(() => {setText(display(value)); setInvalid(false);}, [value, withTime]);
  const setNative = iso => {
    setText(display(iso));
    setInvalid(false);
    visibleRef.current?.setCustomValidity('');
    onChange?.({target:{value:iso,name}});
  };
  const onTextChange = event => {
    const next = event.target.value;
    setText(next);
    const parsed = parse(next);
    if (parsed) {
      setInvalid(false);
      visibleRef.current?.setCustomValidity('');
      if (parsed !== value) onChange?.({target:{value:parsed,name}});
    } else if (!next.trim()) {
      setNative('');
    } else {
      // Do not persist a stale previous date when the user is editing a new one.
      setInvalid(true);
      visibleRef.current?.setCustomValidity('Συμπληρώστε έγκυρη ημερομηνία.');
    }
  };
  const onBlur = () => {
    const parsed = parse(text);
    setInvalid(Boolean(text.trim()) && !parsed);
    visibleRef.current?.setCustomValidity(
      text.trim() && !parsed ? 'Χρησιμοποιήστε τη μορφή ' +
      (withTime ? 'ΗΗ/ΜΜ/ΕΕΕΕ ΩΩ:ΛΛ' : 'ΗΗ/ΜΜ/ΕΕΕΕ') + '.' : ''
    );
  };
  const openPicker = () => {
    if (disabled) return;
    try { pickerRef.current?.showPicker?.(); }
    catch { pickerRef.current?.focus(); }
  };
  return <div className="relative w-full">
    <input {...rest} ref={visibleRef} id={id} name={name}
      type="text" inputMode="numeric" autoComplete={autoComplete}
      aria-label={ariaLabel} aria-invalid={invalid || undefined}
      required={required} disabled={disabled}
      placeholder={withTime ? 'ΗΗ/ΜΜ/ΕΕΕΕ ΩΩ:ΛΛ' : 'ΗΗ/ΜΜ/ΕΕΕΕ'}
      title={withTime ? 'Ημέρα/Μήνας/Έτος Ώρα:Λεπτά' : 'Ημέρα/Μήνας/Έτος'}
      value={text} onChange={onTextChange} onBlur={onBlur}
      className={className + ' pr-12'}/>
    <input ref={pickerRef} type={type} min={min} max={max} tabIndex={-1}
      aria-hidden="true" value={value || ''} disabled={disabled}
      onChange={event => setNative(event.target.value)}
      className="pointer-events-none absolute right-4 top-1/2 h-px w-px -translate-y-1/2 opacity-0"/>
    <button type="button" disabled={disabled} onClick={openPicker}
      title="Επιλογή από το ημερολόγιο" aria-label="Άνοιγμα ημερολογίου"
      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 hover:text-white disabled:opacity-40">
      <CalendarDays size={18}/>
    </button>
  </div>;
}
