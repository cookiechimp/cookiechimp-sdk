"use client";

import {
  type ButtonHTMLAttributes,
  createContext,
  type HTMLAttributes,
  type KeyboardEvent,
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
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!banner.open || !modal) return;
    const previous = document.activeElement as HTMLElement | null;
    queueMicrotask(() => focusable(root.current as HTMLElement)[0]?.focus());
    return () => {
      queueMicrotask(() =>
        (previous?.isConnected ? previous : document.body).focus(),
      );
    };
  }, [banner.open, modal]);
  if (!banner.open) return null;
  return (
    <BannerContext.Provider value={{ title, description }}>
      <div
        {...props}
        ref={root}
        role="dialog"
        aria-modal={modal || undefined}
        aria-labelledby={title}
        aria-describedby={description}
        data-cc-part="banner"
        data-cc-state="open"
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (event.defaultPrevented || !modal) return;
          if (event.key === "Escape") {
            event.preventDefault();
            banner.hide();
          } else if (event.key === "Tab") {
            trapFocus(event, root.current);
          }
        }}
      >
        {children}
      </div>
    </BannerContext.Provider>
  );
}
function BannerTitle(props: PartProps) {
  const context = required(useContext(BannerContext), "Banner.Title");
  return (
    <h2
      {...props}
      id={context?.title}
      data-cc-part="banner-title"
      data-cc-state="open"
    />
  );
}
function BannerDescription(props: PartProps) {
  const context = required(useContext(BannerContext), "Banner.Description");
  return (
    <p
      {...props}
      id={context?.description}
      data-cc-part="banner-description"
      data-cc-state="open"
    />
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
      data-cc-state="open"
    />
  );
}
function BannerCustomize(props: ActionProps) {
  required(useContext(BannerContext), "Banner.Customize");
  const preferences = usePreferences();
  return (
    <button
      type="button"
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) {
          preferences.show();
        }
      }}
      data-cc-part="banner-customize"
      data-cc-state="open"
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
type PreferenceSelection = {
  categories: Record<string, boolean>;
  services?: Record<string, boolean>;
};
const PreferencesContext = createContext<PreferencesValue | null>(null);
function focusable(root: HTMLElement) {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((node) => !node.closest("[hidden]"));
}
function trapFocus(event: KeyboardEvent, root: HTMLElement | null) {
  const items = root ? focusable(root) : [];
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
    queueMicrotask(() => {
      queueMicrotask(() => {
        const trigger = provider?.preferencesTrigger.current;
        const fallback = document.querySelector<HTMLElement>(
          '[data-cc-part="recall"]',
        );
        (trigger?.isConnected ? trigger : (fallback ?? document.body)).focus();
      });
    });
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
            trapFocus(event, root.current);
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
      data-cc-state="open"
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
      data-cc-state="open"
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
  selection,
  ...props
}: ActionProps & {
  kind: "save" | "accept-all" | "reject-all" | "close";
  selection?: PreferenceSelection;
}) {
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
      data-cc-state="open"
      onClick={(event) => {
        props.onClick?.(event);
        if (event.defaultPrevented) return;
        if (kind === "save")
          actions.set(selection ?? { categories: context?.staged });
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
  if (regulation !== "ccpa" && !gpc) return null;
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
  gpcLabel = "GPC honoured",
  ...props
}: ActionProps & { gpcLabel?: string }) {
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
      {gpc && (
        <span data-cc-part="opt-out-gpc" data-cc-state="honoured">
          {" "}
          ({gpcLabel})
        </span>
      )}
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
  Close: (props: ActionProps) => {
    const banner = useBanner();
    return (
      <button
        type="button"
        {...props}
        data-cc-part="banner-close"
        onClick={(event) => {
          props.onClick?.(event);
          if (!event.defaultPrevented) banner.hide();
        }}
      />
    );
  },
};
export const Preferences = {
  Root: PreferencesRoot,
  Title: PreferencesTitle,
  Description: PreferencesDescription,
  Category,
  Save: (props: ActionProps & { selection?: PreferenceSelection }) => (
    <PreferenceAction {...props} kind="save" />
  ),
  AcceptAll: (props: ActionProps) => (
    <PreferenceAction {...props} kind="accept-all" />
  ),
  RejectAll: (props: ActionProps) => (
    <PreferenceAction {...props} kind="reject-all" />
  ),
  Close: (props: ActionProps) => <PreferenceAction {...props} kind="close" />,
};
export const OptOut = { Root: OptOutRoot, Toggle: OptOutToggle };
