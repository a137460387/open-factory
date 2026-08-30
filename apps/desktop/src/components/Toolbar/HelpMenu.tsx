import { CircleHelp } from 'lucide-react';
import { zhCN } from '../../i18n/strings';
import { MenuDropdown, MenuItem } from './MenuDropdown';

export function HelpMenu({
  open,
  onToggle,
  onStartTutorial,
}: {
  open: boolean;
  onToggle(): void;
  onStartTutorial(): void;
}) {
  const t = zhCN.toolbar;
  return (
    <MenuDropdown label={t.helpMenu} open={open} onToggle={onToggle} testId="toolbar-help-menu-button">
      <MenuItem
        label={zhCN.tutorial.start}
        testId="toolbar-help-tutorial-menu-item"
        icon={<CircleHelp size={14} />}
        onClick={() => {
          onToggle();
          onStartTutorial();
        }}
      />
    </MenuDropdown>
  );
}
