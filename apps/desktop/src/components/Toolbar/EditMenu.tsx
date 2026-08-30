import { zhCN } from '../../i18n/strings';
import { MenuDropdown, MenuItem } from './MenuDropdown';

export function EditMenu({
  open,
  onToggle,
  onSaveSnapshot,
  onOpenSnapshotHistory,
  onOpenSnapshotCompare,
}: {
  open: boolean;
  onToggle(): void;
  onSaveSnapshot(): void;
  onOpenSnapshotHistory(): void;
  onOpenSnapshotCompare(): void;
}) {
  const edit = zhCN.editMenu;
  const close = () => onToggle();
  return (
    <MenuDropdown label={zhCN.toolbar.editMenu} open={open} onToggle={onToggle} testId="toolbar-edit-menu-button">
      <MenuItem
        label={edit.saveSnapshot}
        testId="toolbar-edit-save-snapshot-menu-item"
        onClick={() => {
          close();
          onSaveSnapshot();
        }}
      />
      <MenuItem
        label={edit.snapshotHistory}
        testId="toolbar-edit-snapshot-history-menu-item"
        onClick={() => {
          close();
          onOpenSnapshotHistory();
        }}
      />
      <MenuItem
        label={edit.versionCompare}
        testId="toolbar-edit-version-compare-menu-item"
        onClick={() => {
          close();
          onOpenSnapshotCompare();
        }}
      />
    </MenuDropdown>
  );
}
