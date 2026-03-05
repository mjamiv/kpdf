import { useState, useRef, useCallback, type ReactNode } from 'react';

type TooltipProps = {
  content: string;
  shortcut?: string;
  children: ReactNode;
  delay?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
};

export default function Tooltip({ content, shortcut, children, delay = 400, position = 'bottom' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  return (
    <span className="tooltip-wrapper" onPointerEnter={show} onPointerLeave={hide} onPointerDown={hide}>
      {children}
      {visible && (
        <span className={`tooltip tooltip-${position}`} role="tooltip">
          <span className="tooltip-label">{content}</span>
          {shortcut && <kbd className="tooltip-kbd">{shortcut}</kbd>}
        </span>
      )}
    </span>
  );
}
