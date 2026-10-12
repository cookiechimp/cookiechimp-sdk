const variable = (name: string) => `var(--cc-${name})`;

/** Tailwind preset backed entirely by the public CookieChimp CSS variables. */
const preset = {
  theme: {
    extend: {
      colors: {
        cc: {
          base: variable("color-platform-base"),
          text: variable("color-platform-text"),
          strong: variable("color-platform-strong"),
          subtle: variable("color-platform-subtle"),
          placeholder: variable("color-platform-placeholder"),
          background: variable("color-platform-background"),
          chrome: variable("color-platform-chrome"),
          muted: variable("color-platform-muted"),
          fill: variable("color-platform-fill"),
          interact: variable("color-platform-interact"),
          border: variable("color-platform-border"),
          brand: variable("color-brand-default"),
          "brand-hover": variable("color-brand-hover"),
          info: variable("color-status-info-solid"),
          success: variable("color-status-success-solid"),
          warning: variable("color-status-warning-solid"),
          danger: variable("color-status-danger-solid"),
          purple: variable("color-status-purple-solid"),
          teal: variable("color-status-teal-solid"),
        },
        banner: {
          bg: variable("banner-bg"),
          heading: variable("banner-heading"),
          text: variable("banner-text"),
          link: variable("banner-link"),
          "primary-bg": variable("banner-btn-primary-bg"),
          "primary-text": variable("banner-btn-primary-color"),
          "secondary-bg": variable("banner-btn-secondary-bg"),
          "secondary-text": variable("banner-btn-secondary-color"),
        },
      },
      fontFamily: { cc: [variable("typography-font-family")] },
      fontSize: {
        "cc-body": [
          variable("typography-body-size"),
          {
            lineHeight: variable("typography-body-line-height"),
            fontWeight: variable("typography-body-weight"),
          },
        ],
        "cc-heading": [
          variable("typography-heading-size"),
          {
            lineHeight: variable("typography-heading-line-height"),
            fontWeight: variable("typography-heading-weight"),
          },
        ],
        "cc-label": [
          variable("typography-label-size"),
          {
            lineHeight: variable("typography-label-line-height"),
            fontWeight: variable("typography-label-weight"),
          },
        ],
        "cc-small": [
          variable("typography-small-size"),
          {
            lineHeight: variable("typography-small-line-height"),
            fontWeight: variable("typography-small-weight"),
          },
        ],
        "cc-button": [
          variable("typography-button-size"),
          {
            lineHeight: variable("typography-button-line-height"),
            fontWeight: variable("typography-button-weight"),
          },
        ],
      },
      borderRadius: {
        "cc-button": variable("radius-button"),
        "cc-card": variable("radius-card"),
        "cc-pill": variable("radius-pill"),
        "cc-recall": variable("radius-recall"),
        "cc-sm": variable("radius-small"),
        "cc-lg": variable("radius-lg"),
      },
      spacing: {
        "cc-0": variable("spacing-0"),
        "cc-0.5": variable("spacing-0-5"),
        "cc-1": variable("spacing-1"),
        "cc-1.5": variable("spacing-1-5"),
        "cc-2": variable("spacing-2"),
        "cc-3": variable("spacing-3"),
        "cc-4": variable("spacing-4"),
        "cc-5": variable("spacing-5"),
        "cc-6": variable("spacing-6"),
        "cc-8": variable("spacing-8"),
        "cc-control": variable("spacing-control-height"),
        "cc-icon-button": variable("spacing-icon-button"),
      },
      boxShadow: {
        "cc-xs": variable("shadow-xs"),
        "cc-tab": variable("shadow-tab"),
        "cc-card": variable("shadow-card"),
        "cc-pressed": variable("shadow-pressed"),
        "cc-primary": variable("shadow-primary-button"),
        "cc-primary-pressed": variable("shadow-primary-pressed"),
      },
    },
  },
} as const;

export default preset;
