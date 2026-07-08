// TODO: shadcn migration pilot
import { zhCN } from '../../i18n/strings';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function AutosaveRecoveryDialog({ onRestore, onDiscard }: { onRestore(): void; onDiscard(): void }) {
  return (
    <Dialog open>
      <DialogContent className="sm:max-w-sm" data-testid="autosave-recovery-dialog">
        <DialogHeader>
          <DialogTitle>{zhCN.autosaveRecovery.title}</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onDiscard} data-testid="autosave-discard-button">
            {zhCN.autosaveRecovery.discard}
          </Button>
          <Button onClick={onRestore} data-testid="autosave-restore-button">
            {zhCN.autosaveRecovery.restore}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
