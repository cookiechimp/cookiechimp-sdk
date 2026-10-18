import bundle from "../../../packages/core/src/fixtures/platform-offline-bundle.json";

type Colors = {
  bg: string;
  heading_color: string;
  text_color: string;
  link_color: string;
  btn_primary_bg: string;
  btn_primary_color: string;
  btn_secondary_bg: string;
  btn_secondary_color: string;
};
export type Options = {
  layout: string;
  position: string;
  placement: string;
  panel: string;
  theme: string;
  radius: string;
  equal: boolean;
  swap: boolean;
  force: boolean;
  motion: boolean;
  mode: string;
  locale: string;
  control: string;
  services: boolean;
  recall: boolean;
  recallPosition: string;
  accept: boolean;
  reject: boolean;
  preferences: boolean;
  close: boolean;
  save: boolean;
  panelAccept: boolean;
  panelReject: boolean;
  footer: boolean;
  branding: boolean;
  logo: boolean;
  view: string;
  colors: Colors;
  darkColors: Colors;
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
  motion: true,
  mode: "opt-in",
  locale: "en",
  control: "category_and_services",
  services: true,
  recall: true,
  recallPosition: "bottom_right",
  accept: true,
  reject: true,
  preferences: true,
  close: false,
  save: true,
  panelAccept: true,
  panelReject: true,
  footer: true,
  branding: true,
  logo: false,
  view: "banner",
  colors: {
    bg: "#ffffff",
    heading_color: "#161c2b",
    text_color: "#475169",
    link_color: "#2b5cf2",
    btn_primary_bg: "#2b5cf2",
    btn_primary_color: "#ffffff",
    btn_secondary_bg: "#eef2ff",
    btn_secondary_color: "#233e9b",
  },
  darkColors: {
    bg: "#171a1c",
    heading_color: "#ffffff",
    text_color: "#b7c0cc",
    link_color: "#a6beff",
    btn_primary_bg: "#dce6ff",
    btn_primary_color: "#172d67",
    btn_secondary_bg: "#292e36",
    btn_secondary_color: "#e8edfa",
  },
};
const choices: Partial<Record<keyof Options, string[]>> = {
  layout: ["box", "cloud", "bar"],
  position: [
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
  placement: ["stacked", "inline", "wide"],
  panel: ["box", "bar left", "bar right"],
  theme: ["light", "dark", "auto"],
  radius: ["0px", "8px", "1rem", "2em", "10%"],
  mode: ["opt-in", "opt-out"],
  locale: ["en", "de", "ar"],
  control: ["category_and_services", "category_only"],
  recallPosition: ["bottom_left", "bottom_right"],
  view: ["banner", "preferences"],
};
export function normalizeOptions(input: Partial<Options>): Options {
  const next = structuredClone(defaultOptions);
  for (const key of Object.keys(defaultOptions) as (keyof Options)[]) {
    if (key === "colors" || key === "darkColors") {
      for (const color of Object.keys(next[key]) as (keyof Colors)[]) {
        const value = input[key]?.[color];
        if (typeof value === "string" && /^#[\da-f]{6}$/i.test(value))
          next[key][color] = value;
      }
    } else {
      const value = input[key];
      if (typeof next[key] === "boolean" && typeof value === "boolean")
        Object.assign(next, { [key]: value });
      else if (typeof value === "string" && choices[key]?.includes(value))
        Object.assign(next, { [key]: value });
    }
  }
  if (next.layout === "cloud" && next.placement === "wide")
    next.placement = "stacked";
  if (next.layout === "bar") {
    if (next.placement === "stacked") next.placement = "inline";
    next.position = next.position.startsWith("top")
      ? "top center"
      : "bottom center";
  }
  return next;
}
export function readOptions() {
  try {
    return normalizeOptions(
      JSON.parse(
        new URLSearchParams(window.location.search).get("options") ?? "{}",
      ),
    );
  } catch {
    return structuredClone(defaultOptions);
  }
}
export const presets: {
  id: string;
  name: string;
  detail: string;
  group: string;
  options: Partial<Options>;
}[] = [
  {
    id: "box-stacked",
    name: "Box / stacked",
    detail: "Compact notice, vertical actions",
    group: "Layouts",
    options: { placement: "stacked" },
  },
  {
    id: "box-inline",
    name: "Box / inline",
    detail: "Equal actions, preferences below",
    group: "Layouts",
    options: {},
  },
  {
    id: "box-wide",
    name: "Box / wide",
    detail: "A wider notice with actions in a row",
    group: "Layouts",
    options: { placement: "wide", position: "bottom center" },
  },
  {
    id: "cloud-stacked",
    name: "Cloud / stacked",
    detail: "Wide notice, stacked actions",
    group: "Layouts",
    options: {
      layout: "cloud",
      placement: "stacked",
      position: "bottom center",
    },
  },
  {
    id: "cloud-inline",
    name: "Cloud / inline",
    detail: "Wide notice with grouped actions",
    group: "Layouts",
    options: { layout: "cloud", position: "top center" },
  },
  {
    id: "bar-inline",
    name: "Bar / inline",
    detail: "Full-width notice, grouped actions",
    group: "Layouts",
    options: { layout: "bar", position: "bottom center" },
  },
  {
    id: "bar-wide",
    name: "Bar / wide",
    detail: "Full-width notice, horizontal actions",
    group: "Layouts",
    options: { layout: "bar", placement: "wide", position: "top center" },
  },
  {
    id: "vendors",
    name: "Vendor choices",
    detail: "Category and vendor details in a side panel",
    group: "Experiences",
    options: { panel: "bar right", view: "preferences" },
  },
  {
    id: "categories",
    name: "Categories only",
    detail: "Category choices with service disclosures",
    group: "Experiences",
    options: { control: "category_only", view: "preferences" },
  },
  {
    id: "dark",
    name: "Dark side panel",
    detail: "Dark palette and full-height preferences",
    group: "Experiences",
    options: { theme: "dark", panel: "bar left", view: "preferences" },
  },
  {
    id: "opt-out",
    name: "Opt-out notice",
    detail: "Optional categories enabled initially",
    group: "Experiences",
    options: { mode: "opt-out", equal: false },
  },
  {
    id: "rtl",
    name: "Arabic / RTL",
    detail: "Localized copy and right-to-left controls",
    group: "Experiences",
    options: { locale: "ar", panel: "bar right", view: "preferences" },
  },
  {
    id: "branding",
    name: "Your branding",
    detail: "Demo logo, green palette, rounded buttons",
    group: "Experiences",
    options: {
      logo: true,
      radius: "1rem",
      colors: {
        ...defaultOptions.colors,
        btn_primary_bg: "#12684a",
        btn_secondary_bg: "#e5f3ec",
        btn_secondary_color: "#12684a",
        link_color: "#12684a",
      },
    },
  },
  {
    id: "minimal",
    name: "Minimal notice",
    detail: "Preferences and dismiss controls",
    group: "Experiences",
    options: { accept: false, reject: false, close: true, footer: false },
  },
  {
    id: "forced",
    name: "Require a choice",
    detail: "Page interaction stays inside the notice",
    group: "Experiences",
    options: { force: true, position: "middle center" },
  },
  {
    id: "no-motion",
    name: "Without animation",
    detail: "The same consent flow, with motion disabled",
    group: "Experiences",
    options: { motion: false, view: "preferences" },
  },
];
export function buildDemoBundle(options: Options, origin: string) {
  const result = structuredClone(bundle);
  for (const banner of Object.values(result.banners)) {
    Object.assign(banner.gui_options, {
      layout: options.layout,
      position: options.position,
      button_placement: options.placement,
      equal_weight_buttons: options.equal,
      swap_buttons: options.swap,
    });
    Object.assign(banner.preferences_gui_options, {
      layout: options.panel.startsWith("bar") ? "bar" : "box",
      position: options.panel.endsWith("left") ? "left" : "right",
      equal_weight_buttons: options.equal,
      control_level: options.control,
      show_services: options.services,
      show_floating_icon: options.recall,
      floating_icon_position: options.recallPosition,
    });
    Object.assign(banner.theme, {
      dark_mode: options.theme,
      modal_border_radius: options.radius,
      btn_border_radius: options.radius,
      colors: options.colors,
      dark_colors: options.darkColors,
      logo_url_light: options.logo ? `${origin}/demo-logo-light.svg` : null,
      logo_url_dark: options.logo ? `${origin}/demo-logo-dark.svg` : null,
    });
    Object.assign(banner.buttons, {
      show_accept_btn: options.accept,
      show_accept_necessary_btn: options.reject,
      show_preferences_btn: options.preferences,
      show_close_btn: options.close,
    });
    Object.assign(banner.preferences_buttons, {
      show_accept_btn: options.panelAccept,
      show_accept_necessary_btn: options.panelReject,
      show_save_preferences_btn: options.save,
    });
    Object.assign(banner.footer, {
      enabled: options.footer,
      show_powered_by: options.branding,
    });
    banner.force_consent = options.force;
    banner.consent_mode = options.mode;
  }
  // These are ordinary platform translation keys, shared by model and widget.
  const ar = {
    consent_modal: {
      title: "خصوصيتك تهمنا",
      description:
        "نستخدم ملفات تعريف الارتباط الأساسية لتشغيل الموقع. يمكنك اختيار السماح بالتحليلات والتسويق أو رفضهما.",
      additional_description:
        "يمكنك تغيير اختياراتك في أي وقت من إعدادات الخصوصية.",
      accept_btn: "قبول الكل",
      reject_btn: "رفض الاختياري",
      preferences_btn: "إدارة التفضيلات",
      close_btn: "إغلاق",
      footer: `<a href="https://cookiechimp.com/privacy.php">سياسة الخصوصية</a>`,
    },
    preferences_modal: {
      title: "إعدادات الخصوصية",
      description:
        "اختر الفئات ومزودي الخدمات الذين تسمح لهم باستخدام بياناتك. افتح كل قسم لمعرفة التفاصيل ثم احفظ اختياراتك.",
      accept_btn: "قبول الكل",
      reject_btn: "رفض الاختياري",
      save_btn: "حفظ التفضيلات",
      close_btn: "إغلاق",
      more_info_title: "حول هذا المثال",
      more_info:
        "هذا مثال تفاعلي يستخدم مزودي خدمات حقيقيين. لا يتم تحميل أي أدوات تحليل أو إعلانات. يمكنك تغيير اختياراتك في أي وقت.",
    },
    privacy_policy_url: "https://cookiechimp.com/privacy.php",
  };
  for (const [id, banner] of Object.entries(result.banners)) {
    Object.assign(result.translations[id as keyof typeof result.translations], {
      ar,
    });
    if (!banner.available_languages.includes("ar"))
      banner.available_languages.push("ar");
  }
  for (const category of result.categories)
    Object.assign(category.translations, {
      ar: {
        name: {
          essential: "الأساسية",
          analytics: "التحليلات",
          marketing: "التسويق",
        }[category.slug as "essential" | "analytics" | "marketing"],
        description:
          category.slug === "essential"
            ? "ضرورية لتشغيل الموقع وحفظ اختيارات الخصوصية ولا يمكن تعطيلها."
            : "هذه الفئة اختيارية. يمكنك الموافقة عليها أو اختيار مزودي الخدمات بشكل منفصل.",
      },
    });
  return result;
}
