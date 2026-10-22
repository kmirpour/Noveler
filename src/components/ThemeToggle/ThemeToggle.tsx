import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '../../stores/editorStore';
import { Coffee, Sun, Moon, TreePine, Compass } from 'lucide-react';
import './ThemeToggle.css';

export function ThemeToggle() {
  const { theme, cycleTheme } = useEditorStore(
    useShallow((s) => ({ theme: s.theme, cycleTheme: s.cycleTheme }))
  );

  const getIcon = () => {
    switch (theme) {
      case 'sepia':
        return <Coffee size={15} />;
      case 'light':
        return <Sun size={15} />;
      case 'dark':
        return <Moon size={15} />;
      case 'forest':
        return <TreePine size={15} />;
      case 'nord':
        return <Compass size={15} />;
    }
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="theme-toggle-btn"
      title={`Current Theme: ${theme.toUpperCase()} (Click to cycle)`}
    >
      {getIcon()}
      <span className="theme-label">{theme.toUpperCase()}</span>
    </button>
  );
}
