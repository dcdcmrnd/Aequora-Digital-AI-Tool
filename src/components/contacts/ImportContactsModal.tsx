"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useContacts } from "@/hooks/useContacts";
import {
  autoMapHeaders,
  buildContactsFromMapping,
  IMPORT_FIELDS,
  type HeaderMapping,
  type ImportFieldKey,
} from "@/lib/importContacts";

const NONE = "__none__";

interface ImportContactsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportContactsModal({ open, onClose }: ImportContactsModalProps) {
  const { importContacts } = useContacts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<HeaderMapping>({});

  function reset() {
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/contacts/parse-spreadsheet", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't read this file.");
        reset();
        return;
      }
      setHeaders(data.headers);
      setRows(data.rows);
      setMapping(autoMapHeaders(data.headers));
    } catch {
      toast.error("Couldn't read this file.");
      reset();
    } finally {
      setUploading(false);
    }
  }

  const contacts = buildContactsFromMapping(rows, mapping);
  const hasNameMapping = !!mapping.name || !!mapping.firstName;

  function handleImport() {
    if (contacts.length === 0) return;
    importContacts.mutate(contacts, {
      onSuccess: () => {
        reset();
        onClose();
      },
    });
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import Contacts" size="lg">
      <div className="space-y-4 p-6">
        {headers.length === 0 ? (
          <div className="rounded-card border border-dashed border-border p-8 text-center">
            <Upload className="mx-auto mb-2 size-6 text-text-muted" />
            <p className="text-text-secondary mb-3 text-sm">Upload an Excel (.xlsx, .xls) or CSV file of contacts</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
              id="import-file-input"
            />
            <Button type="button" variant="secondary" loading={uploading} onClick={() => fileInputRef.current?.click()}>
              {fileName ?? "Choose File"}
            </Button>
          </div>
        ) : (
          <>
            <div>
              <p className="text-text-secondary mb-2 text-xs font-medium">
                Match your file's columns to contact fields ({rows.length} row{rows.length === 1 ? "" : "s"} found)
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {IMPORT_FIELDS.map((field) => (
                  <label key={field.key} className="block space-y-1">
                    <span className="text-text-secondary text-xs">{field.label}</span>
                    <Select
                      value={mapping[field.key] ?? NONE}
                      onValueChange={(v) =>
                        setMapping((prev) => ({ ...prev, [field.key]: v === NONE ? undefined : v }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Not mapped" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— Not mapped —</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                ))}
              </div>
            </div>

            {!hasNameMapping && (
              <p className="text-danger text-xs">
                Map at least a Full Name or First Name column so contacts have a name.
              </p>
            )}

            <div>
              <p className="text-text-secondary mb-1.5 text-xs font-medium">
                Preview ({contacts.length} contact{contacts.length === 1 ? "" : "s"} will be imported)
              </p>
              <div className="max-h-48 overflow-y-auto rounded-card border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-surface-secondary text-text-secondary sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Email</th>
                      <th className="px-3 py-2 text-left font-medium">Company</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.slice(0, 5).map((c, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="text-text-primary px-3 py-2">{c.name}</td>
                        <td className="text-text-primary px-3 py-2">{c.email || "—"}</td>
                        <td className="text-text-primary px-3 py-2">{c.company || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          {headers.length > 0 && (
            <Button
              type="button"
              onClick={handleImport}
              loading={importContacts.isPending}
              disabled={contacts.length === 0 || !hasNameMapping}
            >
              Import {contacts.length} Contact{contacts.length === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
