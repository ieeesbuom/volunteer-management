"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import type { VolunteerProfileDetails } from "@/features/volunteers/types";
import { volunteerProfileDetailsSchema } from "@/features/volunteers/lib/profile-details";

const FACULTIES_AND_DEPARTMENTS: Record<string, string[]> = {
  "Faculty of Engineering": [
    "Department of Chemical and Process Engineering",
    "Department of Civil Engineering",
    "Department of Computer Science and Engineering",
    "Department of Earth Resources Engineering",
    "Department of Electrical Engineering",
    "Department of Electronic and Telecommunication Engineering",
    "Department of Materials Science and Engineering",
    "Department of Mathematics",
    "Department of Mechanical Engineering",
    "Department of Textile and Apparel Engineering",
    "Department of Transport Management and Logistics Engineering",
  ],
  "Faculty of Architecture": [
    "Department of Architecture",
    "Department of Building Economics",
    "Department of Facilities Management",
    "Department of Integrated Design",
    "Department of Town and Country Planning",
  ],
  "Faculty of Information Technology": [
    "Department of Computational Mathematics",
    "Department of Information Technology",
    "Department of Interdisciplinary Studies",
  ],
  "Faculty of Business": [
    "Department of Decision Sciences",
    "Department of Industrial Management",
    "Department of Languages",
    "Department of Management of Technology",
  ],
  "Faculty of Medicine": [
    "Department of Anatomy",
    "Department of Biochemistry and Clinical Chemistry",
    "Department of Community Medicine and Family Medicine",
    "Department of Medical Education",
    "Department of Medical Technology",
    "Department of Medicine and Mental Health",
    "Department of Microbiology and Parasitology",
    "Department of Obstetrics and Gynecology",
    "Department of Pathology and Forensic Medicine",
    "Department of Pediatrics and Neonatology",
    "Department of Pharmacology",
    "Department of Physiology",
    "Department of Surgery and Anesthesia",
  ],
};

export function ProfileDetailsForm({
  initialDetails,
}: {
  initialDetails: VolunteerProfileDetails | null;
}) {
  const [isEditing, setIsEditing] = useState(!initialDetails);
  const [batchYear, setBatchYear] = useState(initialDetails?.batchYear ?? "");
  const [bio, setBio] = useState(initialDetails?.bio ?? "");
  const [department, setDepartment] = useState(initialDetails?.department ?? "");
  const [faculty, setFaculty] = useState(initialDetails?.faculty ?? "");
  const [headline, setHeadline] = useState(initialDetails?.headline ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(initialDetails?.linkedinUrl ?? "");
  const [skills, setSkills] = useState(initialDetails?.skills ?? "");
  const [status, setStatus] = useState("");
  const [universityIndex, setUniversityIndex] = useState(
    initialDetails?.universityIndex ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleFacultyChange = (newFaculty: string) => {
    setFaculty(newFaculty);
    setDepartment("");
  };

  const availableDepartments = faculty ? (FACULTIES_AND_DEPARTMENTS[faculty] ?? []) : [];

  async function saveDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    setFieldErrors({});

    const validation = volunteerProfileDetailsSchema.safeParse({
      batchYear,
      bio,
      department,
      faculty,
      headline,
      linkedinUrl,
      skills,
      universityIndex,
    });

    if (!validation.success) {
      setSaving(false);
      const errors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const path = issue.path[0];
        if (typeof path === "string") {
          errors[path] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    try {
      const response = await fetch("/api/volunteers/me", {
        body: JSON.stringify(validation.data),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Profile update failed.");
      }

      setStatus("Saved.");
      setIsEditing(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Profile update failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <div className="space-y-4 rounded-2xl border border-border-subtle bg-surface-raised p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <ReadOnlyField label="University Index" value={universityIndex} />
          <ReadOnlyField label="Batch / Year" value={batchYear} />
          <ReadOnlyField label="Faculty" value={faculty} />
          <ReadOnlyField label="Department" value={department} />
        </div>
        {headline && <ReadOnlyField label="Headline" value={headline} />}
        {linkedinUrl && (
          <ReadOnlyField
            label="LinkedIn Profile"
            value={
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium cursor-pointer"
              >
                {linkedinUrl}
              </a>
            }
          />
        )}
        {skills && <ReadOnlyField label="Skills" value={skills} />}
        {bio && <ReadOnlyField label="Bio" value={bio} />}

        <div className="flex pt-4">
          <button
            onClick={() => {
              setIsEditing(true);
              setStatus("");
            }}
            className={buttonClasses({ variant: "secondary" })}
            type="button"
          >
            Edit Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={saveDetails}>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="University Index" error={fieldErrors.universityIndex}>
          <input
            className="min-h-[38px] w-full rounded-md border border-border-default bg-surface px-3 text-[14px] text-text-primary outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_hsl(216_79%_36%/_0.12)]"
            maxLength={40}
            onChange={(event) => setUniversityIndex(event.target.value)}
            required
            value={universityIndex}
          />
        </Field>
        <Field label="Batch / Year" error={fieldErrors.batchYear}>
          <select
            className="min-h-[38px] w-full rounded-md border border-border-default bg-surface px-3 text-[14px] text-text-primary outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_hsl(216_79%_36%/_0.12)] cursor-pointer"
            onChange={(event) => setBatchYear(event.target.value)}
            required
            value={batchYear}
          >
            <option value="" disabled>Select Batch</option>
            {["B21", "B22", "B23", "B24", "B25"].map((batch) => (
              <option key={batch} value={batch}>
                {batch}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Faculty" error={fieldErrors.faculty}>
          <select
            className="min-h-[38px] w-full rounded-md border border-border-default bg-surface px-3 text-[14px] text-text-primary outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_hsl(216_79%_36%/_0.12)] cursor-pointer"
            onChange={(event) => handleFacultyChange(event.target.value)}
            required
            value={faculty}
          >
            <option value="" disabled>Select Faculty</option>
            {Object.keys(FACULTIES_AND_DEPARTMENTS).map((fac) => (
              <option key={fac} value={fac}>
                {fac}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Department" error={fieldErrors.department}>
          <select
            className="min-h-[38px] w-full rounded-md border border-border-default bg-surface px-3 text-[14px] text-text-primary outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_hsl(216_79%_36%/_0.12)] cursor-pointer"
            onChange={(event) => setDepartment(event.target.value)}
            required
            value={department}
            disabled={!faculty}
          >
            <option value="" disabled>
              {faculty ? "Select Department" : "Select Faculty First"}
            </option>
            {availableDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Headline" error={fieldErrors.headline}>
        <input
          className="min-h-[38px] w-full rounded-md border border-border-default bg-surface px-3 text-[14px] text-text-primary outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_hsl(216_79%_36%/_0.12)]"
          maxLength={160}
          onChange={(event) => setHeadline(event.target.value)}
          value={headline}
        />
      </Field>
      <Field label="LinkedIn URL" error={fieldErrors.linkedinUrl}>
        <input
          className="min-h-[38px] w-full rounded-md border border-border-default bg-surface px-3 text-[14px] text-text-primary outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_hsl(216_79%_36%/_0.12)]"
          maxLength={240}
          onChange={(event) => setLinkedinUrl(event.target.value)}
          placeholder="https://www.linkedin.com/in/..."
          value={linkedinUrl}
        />
      </Field>
      <Field label="Skills" error={fieldErrors.skills}>
        <textarea
          className="min-h-24 w-full resize-y rounded-md border border-border-default bg-surface px-3 py-2 text-[14px] text-text-primary outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_hsl(216_79%_36%/_0.12)]"
          maxLength={500}
          onChange={(event) => setSkills(event.target.value)}
          value={skills}
        />
      </Field>
      <Field label="Bio" error={fieldErrors.bio}>
        <textarea
          className="min-h-36 w-full resize-y rounded-md border border-border-default bg-surface px-3 py-2 text-[14px] text-text-primary outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_hsl(216_79%_36%/_0.12)]"
          maxLength={1200}
          onChange={(event) => setBio(event.target.value)}
          value={bio}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button className={buttonClasses()} disabled={saving} type="submit">
          <Save className="size-4" aria-hidden="true" />
          {saving ? "Saving" : "Save Profile"}
        </button>
        {initialDetails && (
          <button
            type="button"
            onClick={() => {
              setUniversityIndex(initialDetails.universityIndex ?? "");
              setBatchYear(initialDetails.batchYear ?? "");
              setFaculty(initialDetails.faculty ?? "");
              setDepartment(initialDetails.department ?? "");
              setHeadline(initialDetails.headline ?? "");
              setLinkedinUrl(initialDetails.linkedinUrl ?? "");
              setSkills(initialDetails.skills ?? "");
              setBio(initialDetails.bio ?? "");
              setIsEditing(false);
              setStatus("");
              setFieldErrors({});
            }}
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary cursor-pointer"
          >
            Cancel
          </button>
        )}
        {status ? (
          <p
            className={`text-sm ${
              status === "Saved."
                ? "text-success font-medium"
                : "rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-danger"
            }`}
          >
            {status}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  children,
  error,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">{label}</span>
        {children}
      </label>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1 border-b border-border-subtle pb-3 last:border-0 last:pb-0">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <div className="text-[14px] text-text-primary whitespace-pre-wrap font-medium">{value}</div>
    </div>
  );
}
