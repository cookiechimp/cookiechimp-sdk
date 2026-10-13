"use client";

import type {
  Gvl,
  GvlVendor,
  TcfChoices,
  TcfController,
} from "@cookiechimp/core/tcf";
import {
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export type TcfVendorController = Pick<
  TcfController,
  "gvl" | "model" | "setChoices" | "subscribe"
>;

export interface TcfLabels {
  title: string;
  purposes: string;
  specialFeatures: string;
  vendors: string;
  search: string;
  consent: string;
  legitimateInterest: string;
  acceptAll: string;
  rejectAll: string;
  save: string;
  saved: string;
  empty: string;
  details: string;
  close: string;
  consentPurposes: string;
  legIntPurposes: string;
  specialPurposes: string;
  features: string;
  dataCategories: string;
  retention: string;
  /** "{days}" is replaced with the number of days. */
  retentionDays: string;
  standardRetention: string;
  privacyPolicy: string;
  legIntClaim: string;
  storage: string;
  /** "{days}" is replaced with the number of days. */
  cookieMaxAge: string;
  cookieSession: string;
  cookieRefresh: string;
  noCookies: string;
  nonCookieAccess: string;
  storageDisclosure: string;
}
const defaults: TcfLabels = {
  title: "Partners and purposes",
  purposes: "Purposes",
  specialFeatures: "Special features",
  vendors: "Vendors",
  search: "Search vendors",
  consent: "Consent",
  legitimateInterest: "Legitimate interest",
  acceptAll: "Accept all",
  rejectAll: "Reject all",
  save: "Save choices",
  saved: "Choices saved",
  empty: "No vendors match",
  details: "Details",
  close: "Close details",
  consentPurposes: "Purposes (consent)",
  legIntPurposes: "Purposes (legitimate interest)",
  specialPurposes: "Special purposes",
  features: "Features",
  dataCategories: "Data categories",
  retention: "Data retention",
  retentionDays: "{days} days",
  standardRetention: "Standard retention",
  privacyPolicy: "Privacy policy",
  legIntClaim: "Legitimate interest claim",
  storage: "Device storage",
  cookieMaxAge: "Cookies stored for up to {days} days",
  cookieSession: "Cookies without a fixed expiry",
  cookieRefresh: "Cookie expiry is refreshed on use",
  noCookies: "Does not use cookies",
  nonCookieAccess: "Uses other device storage or access methods",
  storageDisclosure: "Storage disclosure",
};

export interface TcfVendorListProps {
  controller: TcfVendorController;
  /** Visible vendor list height in pixels. */
  height?: number;
  /** Fixed vendor row height in pixels, used for windowing. */
  rowHeight?: number;
  labels?: Partial<TcfLabels>;
  onSaved?: () => void;
}

/** Purposes that may use legitimate interest under TCF v2.2 and later. */
const LI_PURPOSES = new Set([2, 7, 8, 9, 10, 11]);
const OVERSCAN = 4;
const sortIds = (set: Iterable<number>) => [...set].sort((a, b) => a - b);

interface Draft {
  purposes: Set<number>;
  vendors: Set<number>;
  specialFeatures: Set<number>;
  purposeObjections: Set<number>;
  vendorObjections: Set<number>;
}

function useModel(controller: TcfVendorController) {
  return useSyncExternalStore(
    controller.subscribe,
    () => controller.model,
    () => null,
  );
}

const dayText = (template: string, days: number) =>
  template.replace("{days}", String(days));

function VendorDetails({
  vendor,
  gvl,
  language,
  labels: l,
}: {
  vendor: GvlVendor;
  gvl: Gvl;
  language: string;
  labels: TcfLabels;
}) {
  const named = (
    title: string,
    list: number[] | undefined,
    source: Gvl["purposes"],
    fallback: string,
    retention?: Record<string, number>,
  ): ReactNode =>
    list?.length ? (
      <div className="cc-tcf__detail">
        <h5>{title}</h5>
        <ul>
          {list.map((id) => (
            <li key={id}>
              {source?.[id]?.name ?? `${fallback} ${id}`}
              {retention?.[id] !== undefined &&
                ` (${l.retention}: ${dayText(l.retentionDays, retention[id] as number)})`}
            </li>
          ))}
        </ul>
      </div>
    ) : null;
  const r = vendor.dataRetention;
  const url =
    vendor.urls?.find((u) => u.langId === language) ?? vendor.urls?.[0];
  const age = vendor.cookieMaxAgeSeconds;
  return (
    <>
      {named(
        l.consentPurposes,
        vendor.purposes,
        gvl.purposes,
        "Purpose",
        r?.purposes,
      )}
      {named(
        l.legIntPurposes,
        vendor.legIntPurposes,
        gvl.purposes,
        "Purpose",
        r?.purposes,
      )}
      {named(
        l.specialPurposes,
        vendor.specialPurposes,
        gvl.specialPurposes,
        "Special purpose",
        r?.specialPurposes,
      )}
      {named(l.features, vendor.features, gvl.features, "Feature")}
      {named(
        l.specialFeatures,
        vendor.specialFeatures,
        gvl.specialFeatures,
        "Special feature",
      )}
      {named(
        l.dataCategories,
        vendor.dataDeclaration,
        gvl.dataCategories,
        "Data category",
      )}
      {r?.stdRetention !== undefined && (
        <p className="cc-tcf__detail">
          {l.standardRetention}: {dayText(l.retentionDays, r.stdRetention)}
        </p>
      )}
      <div className="cc-tcf__detail">
        <h5>{l.storage}</h5>
        <ul>
          {vendor.usesCookies === false ? (
            <li>{l.noCookies}</li>
          ) : vendor.usesCookies ? (
            <li>
              {typeof age === "number" && age > 0
                ? dayText(l.cookieMaxAge, Math.ceil(age / 86400))
                : l.cookieSession}
            </li>
          ) : null}
          {vendor.usesCookies && vendor.cookieRefresh && (
            <li>{l.cookieRefresh}</li>
          )}
          {vendor.usesNonCookieAccess && <li>{l.nonCookieAccess}</li>}
          {vendor.deviceStorageDisclosureUrl && (
            <li>
              <a
                href={vendor.deviceStorageDisclosureUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {l.storageDisclosure}
              </a>
            </li>
          )}
        </ul>
      </div>
      {url && (
        <p className="cc-tcf__detail cc-tcf__links">
          <a href={url.privacy} target="_blank" rel="noopener noreferrer">
            {l.privacyPolicy}
          </a>
          {url.legIntClaim && (
            <a href={url.legIntClaim} target="_blank" rel="noopener noreferrer">
              {l.legIntClaim}
            </a>
          )}
        </p>
      )}
    </>
  );
}

function toggle(set: Set<number>, id: number, on: boolean): Set<number> {
  const next = new Set(set);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

/**
 * TCF vendor and purpose choices with a windowed vendor list. Render it
 * inside `CookiePreferences` (as children) or anywhere in the provider tree.
 */
export function TcfVendorList({
  controller,
  height = 320,
  rowHeight = 48,
  labels,
  onSaved,
}: TcfVendorListProps) {
  const l = { ...defaults, ...labels };
  const model = useModel(controller);
  const gvl = controller.gvl;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [saved, setSaved] = useState(false);
  /** Vendor whose row holds focus; it stays mounted while scrolled away. */
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<number | null>(null);
  const uid = useId();
  const panelId = `${uid}-details`;
  const headingId = `${uid}-details-heading`;

  useEffect(() => {
    if (!model) return setDraft(null);
    const disclosed = model.disclosedVendors;
    setDraft({
      purposes: new Set(model.purposeConsents),
      vendors: new Set(model.vendorConsents),
      specialFeatures: new Set(model.specialFeatureOptins),
      purposeObjections: new Set(
        [...LI_PURPOSES].filter(
          (id) => !model.purposeLegitimateInterests.has(id),
        ),
      ),
      vendorObjections: new Set(
        [...disclosed].filter(
          (id) =>
            !model.vendorLegitimateInterests.has(id) &&
            (gvl?.vendors[id]?.legIntPurposes.length ?? 0) > 0,
        ),
      ),
    });
  }, [model, gvl]);

  const vendors = useMemo(() => {
    if (!gvl || !model) return [];
    const needle = query.trim().toLowerCase();
    return sortIds(model.disclosedVendors)
      .map((id) => gvl.vendors[id])
      .filter(
        (v) =>
          v &&
          (!needle || (v.name ?? `#${v.id}`).toLowerCase().includes(needle)),
      )
      .map((v) => v as NonNullable<typeof v>);
  }, [gvl, model, query]);

  useEffect(() => {
    if (openId !== null) panelRef.current?.focus();
    else if (returnFocus.current !== null) {
      const id = returnFocus.current;
      returnFocus.current = null;
      viewportRef.current
        ?.querySelector<HTMLButtonElement>(`[data-cc-vendor-details="${id}"]`)
        ?.focus();
    }
  }, [openId]);

  if (!gvl || !model || !draft) return null;
  const purposeIds = Object.keys(gvl.purposes ?? {}).length
    ? sortIds(Object.keys(gvl.purposes ?? {}).map(Number))
    : Array.from({ length: 11 }, (_, i) => i + 1);
  const featureIds = sortIds(
    Object.keys(gvl.specialFeatures ?? {}).map(Number),
  );
  const update = (patch: Partial<Draft>) => {
    setSaved(false);
    setDraft({ ...draft, ...patch });
  };
  const save = (next: Draft) => {
    const choices: TcfChoices = {
      purposes: sortIds(next.purposes),
      vendors: sortIds(next.vendors),
      specialFeatures: sortIds(next.specialFeatures),
      purposeObjections: sortIds(next.purposeObjections),
      vendorObjections: sortIds(next.vendorObjections),
    };
    if (controller.setChoices(choices)) {
      setSaved(true);
      onSaved?.();
    }
  };
  const all = (on: boolean) => {
    const disclosed = sortIds(model.disclosedVendors);
    const withLi = disclosed.filter(
      (id) => (gvl.vendors[id]?.legIntPurposes.length ?? 0) > 0,
    );
    const next: Draft = {
      purposes: new Set(on ? purposeIds : []),
      vendors: new Set(on ? disclosed : []),
      specialFeatures: new Set(on ? featureIds : []),
      purposeObjections: new Set(
        on ? [] : purposeIds.filter((id) => LI_PURPOSES.has(id)),
      ),
      vendorObjections: new Set(on ? [] : withLi),
    };
    setDraft(next);
    save(next);
  };

  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const last = Math.min(
    vendors.length,
    Math.ceil((scrollTop + height) / rowHeight) + OVERSCAN,
  );
  const rows: number[] = [];
  for (let i = first; i < last; i++) rows.push(i);
  for (const id of [focusedId, openId]) {
    if (id === null) continue;
    const i = vendors.findIndex((v) => v.id === id);
    if (i >= 0 && (i < first || i >= last) && !rows.includes(i)) rows.push(i);
  }
  rows.sort((a, b) => a - b);
  const openVendor =
    openId === null ? undefined : vendors.find((v) => v.id === openId);
  const closeDetails = () => {
    returnFocus.current = openId;
    setOpenId(null);
  };
  const purposeName = (id: number) =>
    gvl.purposes?.[id]?.name ?? `Purpose ${id}`;

  return (
    <section className="cc-tcf" aria-label={l.title} data-cc-part="tcf">
      <h3 className="cc-tcf__heading">{l.purposes}</h3>
      <ul className="cc-tcf__purposes">
        {purposeIds.map((id) => (
          <li key={id} className="cc-tcf__purpose">
            <span className="cc-tcf__name">{purposeName(id)}</span>
            <label>
              <input
                type="checkbox"
                checked={draft.purposes.has(id)}
                onChange={(e) =>
                  update({
                    purposes: toggle(draft.purposes, id, e.target.checked),
                  })
                }
              />
              {l.consent}
            </label>
            {LI_PURPOSES.has(id) && (
              <label>
                <input
                  type="checkbox"
                  checked={!draft.purposeObjections.has(id)}
                  onChange={(e) =>
                    update({
                      purposeObjections: toggle(
                        draft.purposeObjections,
                        id,
                        !e.target.checked,
                      ),
                    })
                  }
                />
                {l.legitimateInterest}
              </label>
            )}
          </li>
        ))}
      </ul>
      {featureIds.length > 0 && (
        <>
          <h3 className="cc-tcf__heading">{l.specialFeatures}</h3>
          <ul className="cc-tcf__purposes">
            {featureIds.map((id) => (
              <li key={id} className="cc-tcf__purpose">
                <label>
                  <input
                    type="checkbox"
                    checked={draft.specialFeatures.has(id)}
                    onChange={(e) =>
                      update({
                        specialFeatures: toggle(
                          draft.specialFeatures,
                          id,
                          e.target.checked,
                        ),
                      })
                    }
                  />
                  {gvl.specialFeatures?.[id]?.name ?? `Special feature ${id}`}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3 className="cc-tcf__heading">
        {l.vendors} ({model.disclosedVendors.size})
      </h3>
      <input
        type="search"
        className="cc-tcf__search"
        aria-label={l.search}
        placeholder={l.search}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setScrollTop(0);
        }}
      />
      <div
        className="cc-tcf__viewport"
        ref={viewportRef}
        style={{ height, overflowY: "auto", position: "relative" }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        data-cc-part="tcf-vendors"
      >
        {vendors.length === 0 ? (
          <p className="cc-tcf__empty">{l.empty}</p>
        ) : (
          <ul
            aria-label={l.vendors}
            style={{
              height: vendors.length * rowHeight,
              margin: 0,
              padding: 0,
              position: "relative",
            }}
          >
            {rows.map((index) => {
              const vendor = vendors[index] as GvlVendor;
              const name = vendor.name ?? `Vendor ${vendor.id}`;
              return (
                <li
                  key={vendor.id}
                  className="cc-tcf__vendor"
                  aria-setsize={vendors.length}
                  aria-posinset={index + 1}
                  onFocus={() => setFocusedId(vendor.id)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node))
                      setFocusedId((id) => (id === vendor.id ? null : id));
                  }}
                  style={{
                    position: "absolute",
                    top: index * rowHeight,
                    height: rowHeight,
                    left: 0,
                    right: 0,
                  }}
                >
                  <span className="cc-tcf__name">{name}</span>
                  {vendor.purposes.length > 0 && (
                    <label>
                      <input
                        type="checkbox"
                        aria-label={`${l.consent}: ${name}`}
                        checked={draft.vendors.has(vendor.id)}
                        onChange={(e) =>
                          update({
                            vendors: toggle(
                              draft.vendors,
                              vendor.id,
                              e.target.checked,
                            ),
                          })
                        }
                      />
                      {l.consent}
                    </label>
                  )}
                  {vendor.legIntPurposes.length > 0 && (
                    <label>
                      <input
                        type="checkbox"
                        aria-label={`${l.legitimateInterest}: ${name}`}
                        checked={!draft.vendorObjections.has(vendor.id)}
                        onChange={(e) =>
                          update({
                            vendorObjections: toggle(
                              draft.vendorObjections,
                              vendor.id,
                              !e.target.checked,
                            ),
                          })
                        }
                      />
                      {l.legitimateInterest}
                    </label>
                  )}
                  <button
                    type="button"
                    className="cc-tcf__more"
                    data-cc-vendor-details={vendor.id}
                    aria-label={`${l.details}: ${name}`}
                    aria-expanded={openId === vendor.id}
                    aria-controls={panelId}
                    onClick={() =>
                      openId === vendor.id
                        ? closeDetails()
                        : setOpenId(vendor.id)
                    }
                  >
                    {l.details}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {openVendor && (
        <section
          id={panelId}
          ref={panelRef}
          tabIndex={-1}
          aria-labelledby={headingId}
          className="cc-tcf__details"
          data-cc-part="tcf-vendor-details"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              closeDetails();
            }
          }}
        >
          <h4 id={headingId} className="cc-tcf__heading">
            {openVendor.name ?? `Vendor ${openVendor.id}`}
          </h4>
          <VendorDetails
            vendor={openVendor}
            gvl={gvl}
            language={model.consentLanguage.toLowerCase()}
            labels={l}
          />
          <button
            type="button"
            className="cc-button cc-button--secondary"
            onClick={closeDetails}
          >
            {l.close}
          </button>
        </section>
      )}
      <div className="cc-actions">
        <button
          type="button"
          className="cc-button cc-button--secondary"
          onClick={() => all(false)}
        >
          {l.rejectAll}
        </button>
        <button
          type="button"
          className="cc-button cc-button--secondary"
          onClick={() => save(draft)}
        >
          {l.save}
        </button>
        <button
          type="button"
          className="cc-button cc-button--primary"
          onClick={() => all(true)}
        >
          {l.acceptAll}
        </button>
      </div>
      <p role="status" className="cc-tcf__status">
        {saved ? l.saved : ""}
      </p>
    </section>
  );
}
