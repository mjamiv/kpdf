type StatusBarProps = {
  status: string;
};

export default function StatusBar({ status }: StatusBarProps) {
  return (
    <footer className="status-line">
      <span>{status}</span>
    </footer>
  );
}
