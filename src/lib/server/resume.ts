// Parser + normaliser for the structured resume editor (v1.1). The form
// serialises a ResumeData object into a JSON string in the `resume_data`
// hidden input; this helper validates, trims, and drops empty entries.
//
// Shape:
//   {
//     credits:  [{ show, role, company, director?, year?, notes? }],
//     training: [{ title, institution, year?, notes? }],
//     skills:   [{ category, items }],
//   }

export type ResumeCredit = {
  show: string;
  role: string;
  company: string;
  director?: string;
  year?: string;
  notes?: string;
};

export type ResumeTraining = {
  title: string;
  institution: string;
  year?: string;
  notes?: string;
};

export type ResumeSkill = {
  category: string;
  items: string;
};

export type ResumeData = {
  credits: ResumeCredit[];
  training: ResumeTraining[];
  skills: ResumeSkill[];
};

const MAX_PER_SECTION = 200;
const MAX_FIELD = 200;
const MAX_NOTES = 400;

export function emptyResume(): ResumeData {
  return { credits: [], training: [], skills: [] };
}

function trim(v: unknown, max = MAX_FIELD): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function trimOptional(v: unknown, max = MAX_FIELD): string | undefined {
  const t = trim(v, max);
  return t.length > 0 ? t : undefined;
}

export function parseResumeData(raw: unknown): ResumeData {
  if (typeof raw !== "string" || !raw) return emptyResume();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyResume();
  }
  if (!parsed || typeof parsed !== "object") return emptyResume();
  const obj = parsed as Record<string, unknown>;

  const creditsIn = Array.isArray(obj.credits) ? obj.credits : [];
  const trainingIn = Array.isArray(obj.training) ? obj.training : [];
  const skillsIn = Array.isArray(obj.skills) ? obj.skills : [];

  const credits: ResumeCredit[] = creditsIn
    .slice(0, MAX_PER_SECTION)
    .map((c: unknown) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        show: trim(o.show),
        role: trim(o.role),
        company: trim(o.company),
        director: trimOptional(o.director),
        year: trimOptional(o.year, 60),
        notes: trimOptional(o.notes, MAX_NOTES),
      };
    })
    // Drop entries where every visible field is empty - these are leftover
    // "Add credit" rows the user never filled in.
    .filter(
      (c) =>
        c.show || c.role || c.company || c.director || c.year || c.notes,
    );

  const training: ResumeTraining[] = trainingIn
    .slice(0, MAX_PER_SECTION)
    .map((t: unknown) => {
      const o = (t ?? {}) as Record<string, unknown>;
      return {
        title: trim(o.title),
        institution: trim(o.institution),
        year: trimOptional(o.year, 60),
        notes: trimOptional(o.notes, MAX_NOTES),
      };
    })
    .filter((t) => t.title || t.institution || t.year || t.notes);

  const skills: ResumeSkill[] = skillsIn
    .slice(0, MAX_PER_SECTION)
    .map((s: unknown) => {
      const o = (s ?? {}) as Record<string, unknown>;
      return {
        category: trim(o.category),
        items: trim(o.items, MAX_NOTES),
      };
    })
    .filter((s) => s.category || s.items);

  return { credits, training, skills };
}

/** Stable equality check used by the trust-gate diff. */
export function resumeDataEquals(
  a: ResumeData | null | undefined,
  b: ResumeData | null | undefined,
): boolean {
  return JSON.stringify(a ?? emptyResume()) === JSON.stringify(b ?? emptyResume());
}

/** True if any section has at least one entry; used to decide whether to
 *  render the resume block on the public profile. */
export function resumeIsEmpty(r: ResumeData | null | undefined): boolean {
  if (!r) return true;
  return (
    (!r.credits || r.credits.length === 0) &&
    (!r.training || r.training.length === 0) &&
    (!r.skills || r.skills.length === 0)
  );
}
