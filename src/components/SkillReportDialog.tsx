import { Button } from "./ui/button";
import { useI18n } from "../lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Textarea } from "./ui/textarea";

type SkillReportDialogProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  reportReason: string;
  reportError: string | null;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function SkillReportDialog({
  isOpen,
  isSubmitting,
  reportReason,
  reportError,
  onReasonChange,
  onCancel,
  onSubmit,
}: SkillReportDialogProps) {
  const { t } = useI18n();
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("skillDetail.report.title")}</DialogTitle>
          <DialogDescription>
            {t("skillDetail.report.description")}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <Textarea
            aria-label={t("skillDetail.report.reasonLabel")}
            placeholder={t("skillDetail.report.placeholder")}
            value={reportReason}
            onChange={(event) => onReasonChange(event.target.value)}
            rows={5}
            disabled={isSubmitting}
            className="min-h-[120px]"
          />
          {reportError ? (
            <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
              {reportError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (!isSubmitting) onCancel();
              }}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
              {isSubmitting ? t("skillDetail.report.submitting") : t("skillDetail.report.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
