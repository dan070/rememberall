import { addDaysISO, fmtDateLong } from "../lib/date";

interface DateFieldProps {
  date: string | null;
  onChange: (date: string | null) => void;
}

/** Quick relative-date chips (Tomorrow/+2d/+5d/+30d) plus a native date
 * picker for anything else — always shows the resolved date in full so a
 * relative pick never leaves you guessing what date it actually landed on. */
export function DateField({ date, onChange }: DateFieldProps) {
  return (
    <>
      <div className="date-quickrow">
        <button type="button" className="qd" onClick={() => onChange(addDaysISO(1))}>
          Tomorrow
        </button>
        <button type="button" className="qd" onClick={() => onChange(addDaysISO(2))}>
          +2d
        </button>
        <button type="button" className="qd" onClick={() => onChange(addDaysISO(5))}>
          +5d
        </button>
        <button type="button" className="qd" onClick={() => onChange(addDaysISO(30))}>
          +30d
        </button>
        <input type="date" value={date ?? ""} onChange={(e) => onChange(e.target.value || null)} />
      </div>
      <div className="date-display">
        {date ? `Due ${fmtDateLong(date)}` : "No due date"}
        {date && (
          <button type="button" className="date-clear" onClick={() => onChange(null)}>
            clear
          </button>
        )}
      </div>
    </>
  );
}
