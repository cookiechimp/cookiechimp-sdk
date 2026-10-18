import type { ReactNode } from "react";

type Options = {
  layout: string;
  position: string;
  placement: string;
  panel: string;
  theme: string;
  radius: string;
  equal: boolean;
  swap: boolean;
  force: boolean;
};
export const defaultOptions: Options = {
  layout: "box",
  position: "bottom right",
  placement: "inline",
  panel: "box",
  theme: "light",
  radius: "8px",
  equal: true,
  swap: false,
  force: false,
};
export function StyleControls({
  value,
  onChange,
}: {
  value: Options;
  onChange(value: Options): void;
}) {
  const update = (next: Options) => {
    if (next.layout === "cloud" && next.placement === "wide")
      next.placement = "stacked";
    if (next.layout === "bar") {
      if (next.placement === "stacked") next.placement = "inline";
      next.position = next.position.startsWith("top")
        ? "top center"
        : "bottom center";
    }
    onChange(next);
  };
  const select = (
    key: keyof Options,
    label: string,
    values: string[],
  ): ReactNode => (
    <label key={key}>
      {label}
      <select
        value={String(value[key])}
        onChange={(event) => update({ ...value, [key]: event.target.value })}
      >
        {values.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <fieldset className="platform-demo__styles">
      <legend>Try the platform styles</legend>
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
      {select("panel", "Preferences layout", ["box", "bar left", "bar right"])}
      {select("theme", "Color scheme", ["auto", "light", "dark"])}
      {select("radius", "Corner radius", ["0px", "8px", "1rem", "2em", "10%"])}
      {(["equal", "swap", "force"] as const).map((key) => (
        <label key={key} className="platform-demo__check">
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(event) =>
              update({ ...value, [key]: event.target.checked })
            }
          />
          {
            {
              equal: "Equal accept/reject styling",
              swap: "Swap banner buttons",
              force: "Require interaction",
            }[key]
          }
        </label>
      ))}
    </fieldset>
  );
}
