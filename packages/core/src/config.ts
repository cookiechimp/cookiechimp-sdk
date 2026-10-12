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

export class ConsentConfigError extends Error {
  readonly name = "ConsentConfigError";
  constructor(readonly problems: readonly string[]) {
    super(
      `Invalid consent config:\n${problems.map((problem) => `- ${problem}`).join("\n")}`,
    );
  }
}

function categoryRecords(input: CategoriesInput | undefined): CategoryConfig[] {
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
  const sourceCategories = categoryRecords(input.categories);
  const categories = sourceCategories.some(({ id }) => id === "necessary")
    ? sourceCategories
    : [{ id: "necessary", required: true }, ...sourceCategories];
  const services = input.services ?? [];
  const problems: string[] = [];
  const categoryIds = new Set<string>();
  for (const category of categories) {
    if (typeof category.id !== "string" || !ID.test(category.id))
      problems.push(`category id "${category.id}" is invalid`);
    if (categoryIds.has(category.id))
      problems.push(`duplicate category id "${category.id}"`);
    categoryIds.add(category.id);
  }
  const serviceIds = new Set<string>();
  for (const service of services) {
    if (typeof service.id !== "string" || !ID.test(service.id))
      problems.push(`service id "${service.id}" is invalid`);
    if (serviceIds.has(service.id))
      problems.push(`duplicate service id "${service.id}"`);
    serviceIds.add(service.id);
    if (!categoryIds.has(service.category))
      problems.push(
        `service "${service.id}" references unknown category "${service.category}"`,
      );
    for (const kind of ["scripts", "cookies", "domains"] as const) {
      const values = service[kind];
      if (values && !Array.isArray(values)) {
        problems.push(`service "${service.id}" has invalid ${kind}`);
        continue;
      }
      for (const pattern of values ?? [])
        if (!validPattern(pattern, kind))
          problems.push(`service "${service.id}" has invalid ${kind} pattern`);
    }
  }
  if (problems.length) throw new ConsentConfigError(Object.freeze(problems));

  const normalCategories = categories.map(freezeCategory);
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
      services.map((service) =>
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

function mergeById<T extends { id: string }>(
  ...sets: readonly (readonly T[] | undefined)[]
): T[] {
  const merged = new Map<string, T>();
  for (const set of sets)
    for (const item of set ?? [])
      merged.set(item.id, { ...merged.get(item.id), ...item });
  return [...merged.values()];
}

/** Merge local defaults, dashboard values and explicit code overrides. */
export function mergeConfig(
  defaults: ConfigInput,
  dashboard?: ConfigInput,
  override?: ConfigInput,
): NormalizedConfig {
  return normalizeConfig({
    categories: mergeById(
      categoryRecords(defaults.categories),
      categoryRecords(dashboard?.categories),
      categoryRecords(override?.categories),
    ),
    services: mergeById(
      defaults.services,
      dashboard?.services,
      override?.services,
    ),
  });
}

function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

/** Return a compact category-version key independent of declaration order. */
export function categoriesHash(config: ConfigInput | NormalizedConfig): string {
  const categories = normalizeConfig(config)
    .categories.map(({ id, required, default: enabled, label, description }) =>
      JSON.stringify([id, required, enabled, label ?? "", description ?? ""]),
    )
    .sort();
  return hashText(categories.join("|"));
}

const matcherCache = new WeakMap<
  NormalizedConfig,
  readonly [string, readonly RegExp[], readonly RegExp[], readonly RegExp[]][]
>();

function wildcard(pattern: string, host = false): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`, host ? "i" : "");
}

function matchers(config: NormalizedConfig) {
  let compiled = matcherCache.get(config);
  if (!compiled) {
    compiled = config.services.map(
      (service) =>
        [
          service.id,
          service.scripts.map((pattern) =>
            pattern instanceof RegExp
              ? new RegExp(pattern.source, pattern.flags)
              : wildcard(pattern),
          ),
          service.cookies.map((pattern) => wildcard(pattern)),
          service.domains.map((pattern) => wildcard(pattern, true)),
        ] as const,
    );
    matcherCache.set(config, compiled);
  }
  return compiled;
}

export interface ServiceMatch {
  url?: string;
  cookieName?: string;
  host?: string;
}

/** Find the first configured service matching any supplied signal. */
export function matchService(
  config: ConfigInput | NormalizedConfig,
  target: ServiceMatch,
): string | null {
  const normalized =
    "categories" in config && Object.isFrozen(config)
      ? (config as NormalizedConfig)
      : normalizeConfig(config);
  for (const [id, scripts, cookies, domains] of matchers(normalized)) {
    const { url, cookieName, host } = target;
    if (
      (url && scripts.some((pattern) => pattern.test(url))) ||
      (cookieName && cookies.some((pattern) => pattern.test(cookieName))) ||
      (host && domains.some((pattern) => pattern.test(host)))
    )
      return id;
  }
  return null;
}
