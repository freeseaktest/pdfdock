"use client";

/**
 * PDFDock — the AcroForm fill panel. Loads the real form fields with
 * pdf-lib, shows them with their current values, and stores the edits
 * for the save step.
 */

import { ListChecks, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useEditor } from "@/lib/editor/store";

const PLACEHOLDER = "__unset__";

export function FormsPanel({
  open,
  onOpenChange,
  loading,
}: {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  loading: boolean;
}) {
  const formFields = useEditor((s) => s.formFields);
  const formValues = useEditor((s) => s.formValues);
  const setFormValue = useEditor((s) => s.setFormValue);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="thin-scroll max-h-[82vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ListChecks className="size-4 text-primary" aria-hidden="true" />
            Form fields
          </DialogTitle>
          <DialogDescription>
            Fill the document's real form fields here — values are
            written into the PDF when you save. Tick "flatten" in the
            save dialog to make them permanent.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            <span className="text-[13px] font-semibold text-muted-foreground">
              Reading form fields…
            </span>
          </div>
        ) : formFields === null ? (
          <div className="rounded-xl border border-border bg-secondary/40 px-4 py-5 text-center">
            <p className="text-[13px] font-bold text-foreground">
              No fillable form fields
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              This PDF has no AcroForm. Use the Text tool to type
              anywhere instead — it exports as real, selectable text.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {formFields.map((field) => {
              const value = formValues[field.name] ?? field.value;
              return (
                <div key={field.name} className="flex flex-col gap-1.5">
                  <Label
                    htmlFor={`ff-${field.name}`}
                    className="text-[12px] font-bold text-foreground"
                  >
                    {field.label}
                    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {field.kind}
                    </span>
                  </Label>

                  {field.kind === "text" ? (
                    <Input
                      id={`ff-${field.name}`}
                      value={value}
                      onChange={(e) => setFormValue(field.name, e.target.value)}
                      autoComplete="off"
                      className="h-9"
                    />
                  ) : field.kind === "checkbox" ? (
                    <div className="flex items-center gap-2.5 py-1">
                      <Switch
                        checked={value === "true"}
                        onCheckedChange={(on) =>
                          setFormValue(field.name, on ? "true" : "false")
                        }
                        aria-label={field.label}
                      />
                      <span className="text-[12px] text-muted-foreground">
                        {value === "true" ? "Checked" : "Unchecked"}
                      </span>
                    </div>
                  ) : field.kind === "radio" ? (
                    <RadioGroup
                      value={value || undefined}
                      onValueChange={(v) => setFormValue(field.name, v)}
                      className="flex flex-col gap-1.5"
                    >
                      {(field.options ?? []).map((opt) => (
                        <div key={opt} className="flex items-center gap-2">
                          <RadioGroupItem value={opt} id={`ff-${field.name}-${opt}`} />
                          <Label
                            htmlFor={`ff-${field.name}-${opt}`}
                            className="cursor-pointer text-[12.5px] font-normal"
                          >
                            {opt}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <Select
                      value={value || PLACEHOLDER}
                      onValueChange={(v) =>
                        setFormValue(field.name, v === PLACEHOLDER ? "" : v)
                      }
                    >
                      <SelectTrigger id={`ff-${field.name}`} className="h-9 text-[12.5px]">
                        <SelectValue placeholder="(none)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={PLACEHOLDER} className="text-[12.5px]">
                          (none)
                        </SelectItem>
                        {(field.options ?? []).map((opt) => (
                          <SelectItem key={opt} value={opt} className="text-[12.5px]">
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                {formFields.length} field{formFields.length === 1 ? "" : "s"} ·
                changes are remembered until you close the document.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
