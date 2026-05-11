const THEME_VARIABLES = {
  page_background: "--page-background",
  surface_background: "--surface-background",
  text_color: "--text-color",
  muted_text_color: "--muted-text-color",
  subtle_text_color: "--subtle-text-color",
  border_color: "--border-color",
  soft_border_color: "--soft-border-color",
  status_background: "--status-background",
  primary_color: "--primary-color",
  primary_hover_color: "--primary-hover-color",
  primary_border_color: "--primary-border-color",
  free_cell_background: "--free-cell-background",
  free_cell_border: "--free-cell-border",
  modal_overlay: "--modal-overlay",
  shadow_color: "--shadow-color",
  modal_shadow_color: "--modal-shadow-color"
};

/**
 * Applies room theme settings to the page CSS variables.
 *
 * @param {object} themeSettings - Room theme settings.
 */
function applyRoomTheme(themeSettings) {
  if (!themeSettings) {
    return;
  }

  Object.keys(THEME_VARIABLES).forEach(function (settingName) {
    if (themeSettings[settingName]) {
      document.documentElement.style.setProperty(
        THEME_VARIABLES[settingName],
        themeSettings[settingName]
      );
    }
  });
}

/**
 * Merges the base room theme with a locally saved theme override.
 *
 * @param {object} baseTheme - Theme from room JSON.
 * @param {object|null} customTheme - Locally saved theme override.
 * @returns {object} Merged theme.
 */
function mergeThemeSettings(baseTheme, customTheme) {
  return Object.assign({}, baseTheme || {}, customTheme || {});
}
