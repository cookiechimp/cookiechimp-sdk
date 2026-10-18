import type { ReactNode } from "react";
import { normalizeOptions, type Options } from "./platform-config";

export function StyleControls({
  value,
  onChange,
}: {
  value: Options;
  onChange(value: Options): void;
}) {
  const update = (patch: Partial<Options>) =>
    onChange(normalizeOptions({ ...value, ...patch }));
  const select = (
    key: keyof Options,
    label: string,
    values: string[],
  ): ReactNode => (
    <label key={key}>
      {label}
      <select
        aria-label={label}
        value={String(value[key])}
        onChange={(event) => update({ [key]: event.target.value })}
      >
        {values.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
  const check = (key: keyof Options, label: string) => (
    <label key={key} className="platform-demo__check">
      <input
        type="checkbox"
        checked={value[key] === true}
        onChange={(event) => update({ [key]: event.target.checked })}
      />
      {label}
    </label>
  );
  return (
    <div className="platform-demo__settings">
      <fieldset className="platform-demo__styles">
        <legend>Layout &amp; appearance</legend>
        {select("layout", "Banner layout", ["box", "cloud", "bar"])}
        {select(
          "position",
          "Banner position",
          value.layout === "bar"
            ? ["top center", "bottom center"]
            : [
                "top left",
                "top center",
                "top right",
                "middle left",
                "middle center",
                "middle right",
                "bottom left",
                "bottom center",
                "bottom right",
              ],
        )}
        {select(
          "placement",
          "Button placement",
          value.layout === "cloud"
            ? ["stacked", "inline"]
            : value.layout === "bar"
              ? ["inline", "wide"]
              : ["stacked", "inline", "wide"],
        )}
        {select("panel", "Preferences layout", [
          "box",
          "bar left",
          "bar right",
        ])}
        {select("theme", "Color scheme", ["auto", "light", "dark"])}
        {select("radius", "Corner radius", [
          "0px",
          "8px",
          "1rem",
          "2em",
          "10%",
        ])}
        {check("equal", "Equal accept/reject styling")}
        {check("swap", "Swap banner buttons")}
        {check("motion", "Animate interactions")}
        {check("logo", "Show demo company logo")}
      </fieldset>
      <details>
        <summary>Consent &amp; language</summary>
        <fieldset className="platform-demo__styles">
          <legend className="visually-hidden">Consent &amp; language</legend>
          {select("mode", "Consent mode", ["opt-in", "opt-out"])}
          {select("locale", "Language", ["en", "de", "ar"])}
          {select("control", "Consent controls", [
            "category_and_services",
            "category_only",
          ])}
          {check("services", "Show service and cookie details")}
          {check("force", "Require interaction")}
          {check("recall", "Show floating privacy button")}
          {select("recallPosition", "Privacy button position", [
            "bottom_left",
            "bottom_right",
          ])}
        </fieldset>
      </details>
      <details>
        <summary>Buttons &amp; footer</summary>
        <fieldset className="platform-demo__styles">
          <legend className="visually-hidden">Buttons &amp; footer</legend>
          {check("accept", "Show banner accept")}
          {check("reject", "Show banner reject")}
          {check("preferences", "Show banner preferences")}
          {check("close", "Show banner close")}
          {check("panelAccept", "Show preferences accept")}
          {check("panelReject", "Show preferences reject")}
          {check("save", "Show save preferences")}
          {check("footer", "Show custom footer")}
          {check("branding", "Show powered-by link")}
        </fieldset>
      </details>
      <details>
        <summary>Custom colors</summary>
        {(["colors", "darkColors"] as const).map((palette) => (
          <fieldset
            className="platform-demo__styles platform-demo__colors"
            key={palette}
          >
            <legend>
              {palette === "colors" ? "Light palette" : "Dark palette"}
            </legend>
            {Object.entries(value[palette]).map(([key, color]) => (
              <label key={key}>
                {key.replaceAll("_", " ")}
                <input
                  type="color"
                  aria-label={`${palette === "colors" ? "Light" : "Dark"} ${key}`}
                  value={color}
                  onChange={(event) =>
                    update({
                      [palette]: {
                        ...value[palette],
                        [key]: event.target.value,
                      },
                    })
                  }
                />
              </label>
            ))}
          </fieldset>
        ))}
      </details>
    </div>
  );
}
