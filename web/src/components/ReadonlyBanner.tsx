import "./ReadonlyBanner.css";

interface ReadonlyBannerProps {
  onReturn: () => void;
}

export function ReadonlyBanner({ onReturn }: ReadonlyBannerProps) {
  return (
    <div id="readonlyBanner">
      <span>📁 Viewing an archived paper — read-only</span>
      <button onClick={onReturn}>Back to current paper →</button>
    </div>
  );
}
