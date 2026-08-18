import type { BubbleState } from "../lib/types";

interface StateToggleProps {
  state: BubbleState;
  onChange: (state: BubbleState) => void;
}

/** Two independent toggle buttons, not a 3-way slider: pressing one
 * deactivates the other; pressing whichever is already active turns it
 * off, landing back on "live" — unlabeled, the default, no button lit. */
export function StateToggle({ state, onChange }: StateToggleProps) {
  function press(target: "done" | "cancelled") {
    onChange(state === target ? "live" : target);
  }

  return (
    <div className="toggle2">
      <div className={`tbtn done ${state === "done" ? "active done" : ""}`} onClick={() => press("done")}>
        Done ⁄
      </div>
      <div className={`tbtn cancelled ${state === "cancelled" ? "active cancelled" : ""}`} onClick={() => press("cancelled")}>
        Cancelled ✕
      </div>
    </div>
  );
}
