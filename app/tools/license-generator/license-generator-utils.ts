import licenseList from "spdx-license-list/full";
import type {
  LicenseGeneratorState,
  LicenseOption,
  LicenseTemplateData,
} from "./license-generator-types";

type LicenseRecord = {
  name?: string;
  licenseText?: string;
  osiApproved?: boolean;
};

const LICENSE_DATA = licenseList as Record<string, LicenseRecord>;

const POPULAR_LICENSE_IDS = [
  "MIT",
  "Apache-2.0",
  "BSD-3-Clause",
  "BSD-2-Clause",
  "ISC",
  "Unlicense",
  "CC0-1.0",
  "GPL-3.0-only",
  "GPL-2.0-only",
  "LGPL-3.0-only",
  "AGPL-3.0-only",
  "MPL-2.0",
].filter((id) => Boolean(LICENSE_DATA[id]));

export const LICENSE_OPTIONS: LicenseOption[] = POPULAR_LICENSE_IDS.map(
  (id) => ({
    value: id,
    label: `${id} — ${LICENSE_DATA[id]?.name ?? id}`,
  }),
);

export function getLicenseName(licenseId: string): string {
  return LICENSE_DATA[licenseId]?.name ?? licenseId;
}

export function getLicenseText(licenseId: string): string {
  return LICENSE_DATA[licenseId]?.licenseText ?? "";
}

export function getRecommendedLicenseId(state: LicenseGeneratorState): string {
  if (state.allowProprietary === "yes") {
    if (state.patentGrant === "yes") return "Apache-2.0";
    if (state.permissiveMinimal === "no") return "BSD-3-Clause";
    return "MIT";
  }

  if (state.networkCopyleft === "yes") return "AGPL-3.0-only";
  if (state.libraryLinking === "yes") return "LGPL-3.0-only";
  if (state.fileCopyleft === "yes") return "MPL-2.0";
  return "GPL-3.0-only";
}

function replaceIfPresent(
  value: string,
  pattern: RegExp,
  replacement?: string,
): string {
  if (!replacement) return value;
  return value.replace(pattern, replacement);
}

export function applyLicenseTemplate(
  text: string,
  data: LicenseTemplateData,
): string {
  let output = text;
  const year = data.year;
  const holder = data.holder;
  const project = data.project;
  const email = data.email;
  const website = data.website;

  output = replaceIfPresent(output, /<year>|\[year\]|\(year\)|<yyyy>|\[yyyy\]/gi, year);
  output = replaceIfPresent(
    output,
    /<copyright holders?>|\[copyright holders?\]/gi,
    holder,
  );
  output = replaceIfPresent(
    output,
    /<name of copyright owner>|\[name of copyright owner\]/gi,
    holder,
  );
  output = replaceIfPresent(output, /<owner>|\[owner\]/gi, holder);
  output = replaceIfPresent(
    output,
    /<fullname>|\[fullname\]|\[name\]|\(name\)|<name>/gi,
    holder,
  );
  output = replaceIfPresent(
    output,
    /<organization>|\[organization\]/gi,
    holder,
  );
  output = replaceIfPresent(
    output,
    /<project>|\[project\]|\[project name\]|\[projectname\]/gi,
    project,
  );
  output = replaceIfPresent(output, /<email>|\[email\]/gi, email);
  output = replaceIfPresent(output, /<website>|\[website\]|\[url\]/gi, website);

  return output.trim();
}

export function buildLicenseOutput(
  licenseId: string,
  data: LicenseTemplateData,
): { text: string; missing: string[] } {
  const baseText = getLicenseText(licenseId);
  const missing: string[] = [];

  if (!data.year.trim()) missing.push("year");
  if (!data.holder.trim()) missing.push("copyright holder");

  if (!baseText) {
    return { text: "", missing: [...missing, "license text"] };
  }

  const text = applyLicenseTemplate(baseText, data);
  return { text, missing };
}
