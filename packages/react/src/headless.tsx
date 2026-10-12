"use client";

import {
  type ButtonHTMLAttributes,
  createContext,
  type HTMLAttributes,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  useBanner,
  useConsent,
  useConsentActions,
  useHeadlessContext,
  usePreferences,
  useRegion,
} from "./index";

const dev = () =>
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";
function required<T>(value: T | null, name: string): T | null {
  if (value) return value;
  const message = `CookieChimp ${name} must be used within its Root.`;
  if (dev()) throw new Error(message);
  console.warn(message);
  return null;
}

type RootProps = HTMLAttributes<HTMLDivElement> & { modal?: boolean };
type PartProps = HTMLAttributes<HTMLElement> & { children?: ReactNode };
type ActionProps = ButtonHTMLAttributes<HTMLButtonElement>;
const BannerContext = createContext<{
  title: string;
  description: string;
} | null>(null);

function BannerRoot({ modal = false, children, ...props }: RootProps) {
  const banner = useBanner();
  const title = useId();
  const description = useId();
  if (!banner.open) return null;
  return (
    <BannerContext.Provider value={{ title, description }}>
      <div
        {...props}
        role="dialog"
        aria-modal={modal || undefined}
        aria-labelledby={title}
        aria-describedby={description}
        data-cc-part="banner"
        data-cc-state="open"
      >
        {children}
      </div>
    </BannerContext.Provider>
  );
}
function BannerTitle(props: PartProps) {
  const context = required(useContext(BannerContext), "Banner.Title");
  return <h2 {...props} id={context?.title} data-cc-part="banner-title" />;
}
function BannerDescription(props: PartProps) {
  const context = required(useContext(BannerContext), "Banner.Description");
  return (
    <p {...props} id={context?.description} data-cc-part="banner-description" />
  );
}
function BannerAction({
  action,
  part,
  ...props
}: ActionProps & { action: "accept" | "reject"; part: string }) {
  required(useContext(BannerContext), `Banner.${part}`);
  const actions = useConsentActions();
  return (
    <button
      type="button"
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented)
          (action === "accept" ? actions.acceptAll : actions.rejectAll)();
      }}
      data-cc-part={`banner-${part}`}
    />
  );
}
function BannerCustomize(props: ActionProps) {
  required(useContext(BannerContext), "Banner.Customize");
  const preferences = usePreferences();
  const provider = useHeadlessContext();
  return (
    <button
      type="button"
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) {
          if (provider)
            provider.preferencesTrigger.current = event.currentTarget;
          preferences.show();
        }
      }}
      data-cc-part="banner-customize"
    />
  );
}

type PreferencesValue = {
  staged: Record<string, boolean>;
  toggle: (id: string) => void;
  close: () => void;
  title: string;
  description: string;
};
const PreferencesContext = createContext<PreferencesValue | null>(null);
function focusable(root: HTMLElement) {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ];
}
function PreferencesRoot({
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const preferences = usePreferences();
  const provider = useHeadlessContext();
  const consent = useConsent();
  const [staged, setStaged] = useState<Record<string, boolean>>({
    ...consent.categories,
  });
  const title = useId();
  const description = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!preferences.open) return;
    setStaged({ ...consent.categories });
    const node = root.current;
    (node && focusable(node)[0])?.focus();
  }, [preferences.open, consent.categories]);
  const close = () => {
    preferences.hide();
    queueMicrotask(() => provider?.preferencesTrigger.current?.focus());
  };
  if (!preferences.open) return null;
  return (
    <PreferencesContext.Provider
      value={{
        staged,
        toggle: (id) => setStaged((value) => ({ ...value, [id]: !value[id] })),
        close,
        title,
        description,
      }}
    >
      <div
        {...props}
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title}
        aria-describedby={description}
        data-cc-part="preferences"
        data-cc-state="open"
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
          if (event.key === "Tab") {
            const items = root.current ? focusable(root.current) : [];
            const first = items[0];
            const last = items.at(-1);
            if (
              items.length &&
              ((event.shiftKey && document.activeElement === first) ||
                (!event.shiftKey && document.activeElement === last))
            ) {
              event.preventDefault();
              (event.shiftKey ? last : first)?.focus();
            }
          }
        }}
      >
        {children}
      </div>
    </PreferencesContext.Provider>
  );
}
function PreferencesTitle(props: PartProps) {
  const context = required(useContext(PreferencesContext), "Preferences.Title");
  return (
    <h2
      {...props}
      id={context?.title}
      tabIndex={-1}
      data-cc-part="preferences-title"
    />
  );
}
function PreferencesDescription(props: PartProps) {
  const context = required(
    useContext(PreferencesContext),
    "Preferences.Description",
  );
  return (
    <p
      {...props}
      id={context?.description}
      data-cc-part="preferences-description"
    />
  );
}
function Category({
  id,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { id: string }) {
  const context = required(
    useContext(PreferencesContext),
    "Preferences.Category",
  );
  const necessary = id === "necessary";
  const checked = necessary || context?.staged[id] === true;
  return (
    <div
      {...props}
      data-cc-part="preferences-category"
      data-cc-state={checked ? "on" : "off"}
    >
      <span>{children ?? id}</span>
      <button
        type="button"
        role="switch"
        aria-label={typeof children === "string" ? children : id}
        aria-checked={checked}
        disabled={necessary}
        onClick={() => context?.toggle(id)}
        data-cc-part="preferences-category-toggle"
        data-cc-state={checked ? "on" : "off"}
      />
    </div>
  );
}
function PreferenceAction({
  kind,
  ...props
}: ActionProps & { kind: "save" | "accept-all" | "reject-all" | "close" }) {
  const context = required(
    useContext(PreferencesContext),
    `Preferences.${kind}`,
  );
  const actions = useConsentActions();
  return (
    <button
      type="button"
      {...props}
      data-cc-part={`preferences-${kind}`}
      onClick={(event) => {
        props.onClick?.(event);
        if (event.defaultPrevented) return;
        if (kind === "save") actions.set({ categories: context?.staged });
        else if (kind === "accept-all") actions.acceptAll();
        else if (kind === "reject-all") actions.rejectAll();
        context?.close();
      }}
    />
  );
}

const OptOutContext = createContext<string | null>(null);
function OptOutRoot({
  category = "advertising",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { category?: string }) {
  const provider = useHeadlessContext();
  const { regulation } = useRegion();
  const state = useConsent();
  const gpc = provider?.consent.gpc === true;
  const on = gpc || state.categories[category] === false;
  if (regulation !== "ccpa") return null;
  return (
    <OptOutContext.Provider value={category}>
      <div {...props} data-cc-part="opt-out" data-cc-state={on ? "on" : "off"}>
        {children}
      </div>
    </OptOutContext.Provider>
  );
}
function OptOutToggle({
  children = "Do not sell or share my personal information",
  ...props
}: ActionProps) {
  const category =
    required(useContext(OptOutContext), "OptOut.Toggle") ?? "advertising";
  const provider = useHeadlessContext();
  const state = useConsent();
  const gpc = provider?.consent.gpc === true;
  const on = gpc || state.categories[category] === false;
  const { set } = useConsentActions();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={gpc}
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented && !gpc)
          set({ categories: { [category]: on } });
      }}
      data-cc-part="opt-out-toggle"
      data-cc-state={on ? "on" : "off"}
    >
      {children}
      {gpc && <span data-cc-part="opt-out-gpc"> (GPC honoured)</span>}
    </button>
  );
}

export const Banner = {
  Root: BannerRoot,
  Title: BannerTitle,
  Description: BannerDescription,
  AcceptAll: (props: ActionProps) => (
    <BannerAction {...props} action="accept" part="accept-all" />
  ),
  RejectAll: (props: ActionProps) => (
    <BannerAction {...props} action="reject" part="reject-all" />
  ),
  Customize: BannerCustomize,
};
export const Preferences = {
  Root: PreferencesRoot,
  Title: PreferencesTitle,
  Description: PreferencesDescription,
  Category,
  Save: (props: ActionProps) => <PreferenceAction {...props} kind="save" />,
  AcceptAll: (props: ActionProps) => (
    <PreferenceAction {...props} kind="accept-all" />
  ),
  RejectAll: (props: ActionProps) => (
    <PreferenceAction {...props} kind="reject-all" />
  ),
  Close: (props: ActionProps) => <PreferenceAction {...props} kind="close" />,
};
export const OptOut = { Root: OptOutRoot, Toggle: OptOutToggle };
