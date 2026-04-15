'use client';

import { useEffect, useState } from 'react';

type Props = {
  message: string;
  duration?: number;
  onClose: () => void;
};

export default function Toast({ message, duration = 3000, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Wait for fade out animation
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: 'var(--bg)',
        border: '1px solid var(--accent)',
        borderRadius: '8px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 10000,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        fontFamily: 'var(--font-mono)',
        fontSize: '13px',
        color: 'var(--text-primary)',
      }}
    >
      {message}
    </div>
  );
}
