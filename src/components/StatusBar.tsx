type StatusBarProps = {
  status: string;
};

export default function StatusBar({ status }: StatusBarProps) {
  return (
    <footer className="status-line" role="status" aria-live="polite">
      <span>{status}</span>
    </footer>
  );
}
