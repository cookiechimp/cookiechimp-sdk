import { validPattern } from "./internal/pattern";
import type { Region, Regulation } from "./regions";

export type ServicePattern = string | RegExp;

export interface CategoryConfig {
  id: string;
  required?: boolean;
  /** Alias for required, intended for preference controls. */
  locked?: boolean;
  default?: boolean;
  label?: string;
  description?: string;
}

export interface ServiceConfig {
  id: string;
  category: string;
  name?: string;
  scripts?: readonly ServicePattern[];
  cookies?: readonly ServicePattern[];
  domains?: readonly ServicePattern[];
  default?: boolean;
}

export type CategoryInput =
  | string
  | CategoryConfig
  | {
      name: string;
      default?: boolean;
      required?: boolean;
      locked?: boolean;
      label?: string;
      description?: string;
    };

export type CategoriesInput =
  | Readonly<Record<string, boolean>>
  | readonly CategoryInput[];

export interface ConfigInput {
  categories?: CategoriesInput;
  services?: readonly ServiceConfig[];
  regulation?: Regulation | ((region: Region | null) => Regulation);
  /** Resolve a supplied region, for example with `regulationFor` from ./regions. */
  resolveRegulation?: (region: Region | null, now?: number) => Regulation;
  /** Current UTC time in milliseconds, injectable for date-based regulation rules. */
  now?: number;
  /** Country (`US`) or country-subdivision (`US-CA`) regulation overrides. */
  regions?: Readonly<Record<string, Regulation>>;
  fallbackRegulation?: Regulation;
}

export interface NormalizedCategoryConfig {
  readonly id: string;
  readonly required: boolean;
  readonly locked: boolean;
  readonly default: boolean;
  readonly label?: string;
  readonly description?: string;
}

export interface NormalizedServiceConfig {
  readonly id: string;
  readonly category: string;
  readonly name?: string;
  readonly scripts: readonly ServicePattern[];
  readonly cookies: readonly ServicePattern[];
  readonly domains: readonly ServicePattern[];
  readonly default: boolean;
}

export interface NormalizedConfig {
  readonly categories: readonly NormalizedCategoryConfig[];
  readonly services: readonly NormalizedServiceConfig[];
  readonly regulation?: Regulation | ((region: Region | null) => Regulation);
  readonly resolveRegulation?: (
    region: Region | null,
    now?: number,
  ) => Regulation;
  readonly now?: number;
  readonly regions: Readonly<Record<string, Regulation>>;
  readonly fallbackRegulation: Regulation;
}

const ID = /^[a-z0-9_-]+$/;
export const isDevelopment = () =>
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

export class ConsentConfigError extends Error {
  readonly name = "ConsentConfigError";
  constructor(readonly problems: readonly string[]) {
    super(
      `Invalid consent config:\n${problems.map((problem) => `- ${problem}`).join("\n")}`,
    );
  }
}

export function categoryRecords(
  input: CategoriesInput | undefined,
): CategoryConfig[] {
  if (!input) return [];
  if (!Array.isArray(input)) {
    return Object.entries(input).map(([id, value]) => ({ id, default: value }));
  }
  return input.map((value) => {
    if (typeof value === "string") return { id: value };
    if ("id" in value) return value;
    const { name: id, ...rest } = value;
    return { id, ...rest };
  });
}

function freezeCategory(category: CategoryConfig): NormalizedCategoryConfig {
  const required =
    category.id === "necessary" ||
    category.required === true ||
    category.locked === true;
  return Object.freeze({
    id: category.id,
    required,
    locked: required,
    default: required || category.default === true,
    ...(typeof category.label === "string" ? { label: category.label } : {}),
    ...(typeof category.description === "string"
      ? { description: category.description }
      : {}),
  });
}

/** Validate and canonicalise all supported local configuration shorthands. */
export function normalizeConfig(input: ConfigInput): NormalizedConfig {
  const development = isDevelopment();
  const sourceCategories = categoryRecords(input.categories);
  const categories = sourceCategories.some(({ id }) => id === "necessary")
    ? sourceCategories
    : [{ id: "necessary", required: true }, ...sourceCategories];
  const services = input.services ?? [];
  const problems: string[] = [];
  let invalid = false;
  const regulations = new Set(["gdpr", "ccpa", "none"]);
  if (
    input.regulation !== undefined &&
    typeof input.regulation !== "function" &&
    !regulations.has(input.regulation)
  ) {
    invalid = true;
    if (development)
      problems.push(`regulation "${input.regulation}" is invalid`);
  }
  if (
    input.fallbackRegulation !== undefined &&
    !regulations.has(input.fallbackRegulation)
  ) {
    invalid = true;
    if (development)
      problems.push(
        `fallback regulation "${input.fallbackRegulation}" is invalid`,
      );
  }
  const validRegions: Record<string, Regulation> = {};
  for (const [key, value] of Object.entries(input.regions ?? {})) {
    if (!/^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/.test(key) || !regulations.has(value)) {
      invalid = true;
      if (development) problems.push(`region override "${key}" is invalid`);
    } else validRegions[key] = value;
  }
  const categoryIds = new Set<string>();
  const validCategories = categories.filter((category) => {
    if (typeof category.id !== "string" || !ID.test(category.id)) {
      invalid = true;
      if (development) problems.push(`category id "${category.id}" is invalid`);
      return false;
    }
    if (categoryIds.has(category.id)) {
      invalid = true;
      if (development) problems.push(`duplicate category id "${category.id}"`);
      return false;
    }
    categoryIds.add(category.id);
    return true;
  });
  const serviceIds = new Set<string>();
  const validServices = services.filter((service) => {
    let valid = true;
    if (typeof service.id !== "string" || !ID.test(service.id)) {
      invalid = true;
      valid = false;
      if (development) problems.push(`service id "${service.id}" is invalid`);
    }
    if (serviceIds.has(service.id)) {
      invalid = true;
      valid = false;
      if (development) problems.push(`duplicate service id "${service.id}"`);
    }
    serviceIds.add(service.id);
    if (!categoryIds.has(service.category)) {
      invalid = true;
      valid = false;
      if (development)
        problems.push(
          `service "${service.id}" references unknown category "${service.category}"`,
        );
    }
    for (const kind of ["scripts", "cookies", "domains"] as const) {
      const values = service[kind];
      if (values && !Array.isArray(values)) {
        invalid = true;
        valid = false;
        if (development)
          problems.push(`service "${service.id}" has invalid ${kind}`);
        continue;
      }
      for (const pattern of values ?? [])
        if (!validPattern(pattern)) {
          invalid = true;
          valid = false;
          if (development)
            problems.push(
              `service "${service.id}" has invalid ${kind} pattern`,
            );
        }
    }
    return valid;
  });
  if (invalid) {
    if (development) throw new ConsentConfigError(Object.freeze(problems));
    console.warn("CookieChimp ignored invalid consent configuration entries");
  }

  const normalCategories = validCategories.map(freezeCategory);
  const necessary = normalCategories.find(
    ({ id }) => id === "necessary",
  ) as NormalizedCategoryConfig;
  const orderedCategories = [
    necessary,
    ...normalCategories.filter(({ id }) => id !== "necessary"),
  ];
  return Object.freeze({
    categories: Object.freeze(orderedCategories),
    services: Object.freeze(
      validServices.map((service) =>
        Object.freeze({
          id: service.id,
          category: service.category,
          ...(typeof service.name === "string" ? { name: service.name } : {}),
          scripts: Object.freeze([...(service.scripts ?? [])]),
          cookies: Object.freeze([...(service.cookies ?? [])]),
          domains: Object.freeze([...(service.domains ?? [])]),
          default: service.default === true,
        }),
      ),
    ),
    ...(typeof input.regulation === "function" ||
    regulations.has(input.regulation ?? "")
      ? { regulation: input.regulation }
      : {}),
    ...(typeof input.resolveRegulation === "function"
      ? { resolveRegulation: input.resolveRegulation }
      : {}),
    ...(typeof input.now === "number" && Number.isFinite(input.now)
      ? { now: input.now }
      : {}),
    regions: Object.freeze(validRegions),
    fallbackRegulation: regulations.has(input.fallbackRegulation ?? "")
      ? (input.fallbackRegulation as Regulation)
      : "gdpr",
  });
}
