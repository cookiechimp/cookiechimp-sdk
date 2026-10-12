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
  cookies?: readonly string[];
  domains?: readonly string[];
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
  readonly cookies: readonly string[];
  readonly domains: readonly string[];
  readonly default: boolean;
}

export interface NormalizedConfig {
  readonly categories: readonly NormalizedCategoryConfig[];
  readonly services: readonly NormalizedServiceConfig[];
}

const ID = /^[a-z0-9_-]+$/;
const isDevelopment = () =>
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

function validPattern(pattern: unknown, kind: string): boolean {
  if (kind === "scripts" && pattern instanceof RegExp)
    return pattern.source.length > 0;
  return (
    typeof pattern === "string" && pattern.length > 0 && !/\s/.test(pattern)
  );
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
  const DEV = isDevelopment();
  const sourceCategories = categoryRecords(input.categories);
  const categories = sourceCategories.some(({ id }) => id === "necessary")
    ? sourceCategories
    : [{ id: "necessary", required: true }, ...sourceCategories];
  const services = input.services ?? [];
  const problems: string[] = [];
  let invalid = false;
  const categoryIds = new Set<string>();
  const validCategories = categories.filter((category) => {
    if (typeof category.id !== "string" || !ID.test(category.id)) {
      invalid = true;
      if (DEV) problems.push(`category id "${category.id}" is invalid`);
      return false;
    }
    if (categoryIds.has(category.id)) {
      invalid = true;
      if (DEV) problems.push(`duplicate category id "${category.id}"`);
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
      if (DEV) problems.push(`service id "${service.id}" is invalid`);
    }
    if (serviceIds.has(service.id)) {
      invalid = true;
      valid = false;
      if (DEV) problems.push(`duplicate service id "${service.id}"`);
    }
    serviceIds.add(service.id);
    if (!categoryIds.has(service.category)) {
      invalid = true;
      valid = false;
      if (DEV)
        problems.push(
          `service "${service.id}" references unknown category "${service.category}"`,
        );
    }
    for (const kind of ["scripts", "cookies", "domains"] as const) {
      const values = service[kind];
      if (values && !Array.isArray(values)) {
        invalid = true;
        valid = false;
        if (DEV) problems.push(`service "${service.id}" has invalid ${kind}`);
        continue;
      }
      for (const pattern of values ?? [])
        if (!validPattern(pattern, kind)) {
          invalid = true;
          valid = false;
          if (DEV)
            problems.push(
              `service "${service.id}" has invalid ${kind} pattern`,
            );
        }
    }
    return valid;
  });
  if (invalid) {
    if (DEV) throw new ConsentConfigError(Object.freeze(problems));
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
  });
}
