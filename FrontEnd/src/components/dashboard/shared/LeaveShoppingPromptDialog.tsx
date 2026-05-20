import { Button } from '@/components/ui/button';

interface LeaveShoppingPromptDialogProps {
  open: boolean;
  boughtCount: number;
  onConvertNow: () => void;
  onLeaveAnyway: () => void;
}

export default function LeaveShoppingPromptDialog({
  open,
  boughtCount,
  onConvertNow,
  onLeaveAnyway,
}: LeaveShoppingPromptDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border bg-bg p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Hold on — shopping not finished?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You have {boughtCount} bought {boughtCount === 1 ? 'item' : 'items'} that haven't been logged as an expense yet. Convert them now or leave them on the list?
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onLeaveAnyway}>
            Leave anyway
          </Button>
          <Button onClick={onConvertNow}>Convert now</Button>
        </div>
      </div>
    </div>
  );
}
