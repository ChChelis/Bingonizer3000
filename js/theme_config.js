const themeConfigState = {
  room_id: null,
  base_room_settings: {},
  current_room_settings: {},
  base_theme: {},
  current_theme: {}
};

const THEME_FIELDS = [
  { name: "page_background", label: "Fundo da pagina" },
  { name: "surface_background", label: "Fundo dos paineis" },
  { name: "text_color", label: "Texto principal" },
  { name: "muted_text_color", label: "Texto secundario" },
  { name: "subtle_text_color", label: "Texto sutil" },
  { name: "border_color", label: "Borda forte" },
  { name: "soft_border_color", label: "Borda suave" },
  { name: "status_background", label: "Fundo de status" },
  { name: "primary_color", label: "Cor principal" },
  { name: "primary_hover_color", label: "Cor principal hover" },
  { name: "primary_border_color", label: "Borda principal" },
  { name: "free_cell_background", label: "Fundo da casa livre" },
  { name: "free_cell_border", label: "Borda da casa livre" },
  { name: "modal_overlay", label: "Overlay do popup" },
  { name: "shadow_color", label: "Sombra dos paineis" },
  { name: "modal_shadow_color", label: "Sombra do popup" }
];

const MAX_LOCAL_IMAGE_FILES = 12;
const MAX_LOCAL_IMAGE_STORAGE_CHARS = 2500000;
const LOCAL_IMAGE_MAX_SIZE = 640;
const LOCAL_IMAGE_QUALITY = 0.82;

document.addEventListener("DOMContentLoaded", initializeThemeConfigurator);

/**
 * Initializes the theme configurator page.
 */
async function initializeThemeConfigurator() {
  try {
    const roomConfig = await loadJsonFile("data/sample_room.json");
    const itemsData = await loadJsonFile(roomConfig.data_source.items_file);
    const onlineRoomConfig = await loadOnlineRoomConfigIfAvailable();
    const savedRoomSettings =
      onlineRoomConfig && onlineRoomConfig.room_settings ?
        onlineRoomConfig.room_settings :
        loadLocalRoomSettings(roomConfig.room_id);
    const savedTheme =
      onlineRoomConfig && onlineRoomConfig.theme_settings ?
        onlineRoomConfig.theme_settings :
        loadLocalThemeSettings(roomConfig.room_id);

    themeConfigState.room_id = roomConfig.room_id;
    themeConfigState.base_room_settings = getEditableRoomSettings(
      roomConfig,
      itemsData.items
    );
    themeConfigState.current_room_settings = mergeRoomSettings(
      themeConfigState.base_room_settings,
      savedRoomSettings
    );
    normalizeContentModeSettings(themeConfigState.current_room_settings);
    themeConfigState.base_theme = roomConfig.theme_settings || {};
    themeConfigState.current_theme = mergeThemeSettings(
      themeConfigState.base_theme,
      savedTheme
    );

    renderRoomSettingsControls();
    renderThemeControls();
    bindThemeConfiguratorEvents();
    applyRoomTheme(themeConfigState.current_theme);
    updateRoomPreview();
    updateConfigStatus(
      onlineRoomConfig ?
        "Configuracao online carregada. O preview de tema muda em tempo real." :
        "Configuracao carregada. O preview de tema muda em tempo real."
    );
  } catch (error) {
    updateConfigStatus(error.message);
    console.error(error);
  }
}

/**
 * Loads a JSON file from the project.
 *
 * @param {string} filePath - Relative path to the JSON file.
 * @returns {Promise<object>} Parsed JSON content.
 */
async function loadJsonFile(filePath) {
  const response = await fetch(`${filePath}?cache_bust=${Date.now()}`);

  if (!response.ok) {
    throw new Error(`Could not load JSON file: ${filePath}`);
  }

  return await response.json();
}

/**
 * Renders all theme controls.
 */
function renderThemeControls() {
  const themeControlsElement = document.getElementById("theme_controls");

  themeControlsElement.innerHTML = "";

  THEME_FIELDS.forEach(function (field) {
    themeControlsElement.appendChild(createThemeControl(field));
  });
}

/**
 * Renders editable room settings into their form controls.
 */
function renderRoomSettingsControls() {
  document.getElementById("room_title_input").value =
    themeConfigState.current_room_settings.title;
  document.getElementById("room_description_input").value =
    themeConfigState.current_room_settings.description;
  document.getElementById("timer_enabled_input").checked =
    themeConfigState.current_room_settings.draw_settings.enabled;
  document.getElementById("requires_ready_input").checked =
    themeConfigState.current_room_settings.draw_settings.requires_all_players_ready;
  document.getElementById("timer_mode_fixed_input").checked =
    themeConfigState.current_room_settings.draw_settings.timer_mode === "fixed";
  document.getElementById("timer_mode_random_input").checked =
    themeConfigState.current_room_settings.draw_settings.timer_mode === "random";
  document.getElementById("ready_target_input").value =
    themeConfigState.current_room_settings.draw_settings.ready_target;
  document.getElementById("timer_seconds_input").value =
    themeConfigState.current_room_settings.draw_settings.interval_seconds;
  document.getElementById("timer_min_seconds_input").value =
    themeConfigState.current_room_settings.draw_settings.random_min_seconds;
  document.getElementById("timer_max_seconds_input").value =
    themeConfigState.current_room_settings.draw_settings.random_max_seconds;
  document.getElementById("quiet_hours_enabled_input").checked =
    themeConfigState.current_room_settings.draw_settings.quiet_hours_enabled;
  document.getElementById("quiet_start_input").value =
    themeConfigState.current_room_settings.draw_settings.quiet_start;
  document.getElementById("quiet_end_input").value =
    themeConfigState.current_room_settings.draw_settings.quiet_end;
  document.getElementById("penalty_items_input").value =
    themeConfigState.current_room_settings.draw_settings.penalty_items_raw;
  document.getElementById("penalty_last_count_input").value =
    themeConfigState.current_room_settings.draw_settings.penalty_last_count;
  document.getElementById("text_items_input").value =
    themeConfigState.current_room_settings.text_items_raw;
  document.getElementById("number_range_start_input").value =
    themeConfigState.current_room_settings.number_range.start;
  document.getElementById("number_range_end_input").value =
    themeConfigState.current_room_settings.number_range.end;

  document.getElementById("content_mode_text_input").checked =
    themeConfigState.current_room_settings.content_mode === "text";
  document.getElementById("content_mode_number_input").checked =
    themeConfigState.current_room_settings.content_mode === "number";
  document.getElementById("allow_images_input").checked =
    themeConfigState.current_room_settings.content_settings.allow_images;

  updateContentModeVisibility();
  renderImageItemsPreview();

  document.getElementById("victory_line_input").checked =
    themeConfigState.current_room_settings.victory_rules.line;
  document.getElementById("victory_column_input").checked =
    themeConfigState.current_room_settings.victory_rules.column;
  document.getElementById("victory_diagonal_input").checked =
    themeConfigState.current_room_settings.victory_rules.diagonal;
  document.getElementById("victory_full_board_input").checked =
    themeConfigState.current_room_settings.victory_rules.full_board;
}

/**
 * Creates one theme control row.
 *
 * @param {object} field - Theme field metadata.
 * @returns {HTMLDivElement} Theme control element.
 */
function createThemeControl(field) {
  const controlElement = document.createElement("div");
  const labelElement = document.createElement("label");
  const inputsElement = document.createElement("div");
  const textInput = document.createElement("input");
  const colorInput = document.createElement("input");
  const value = themeConfigState.current_theme[field.name] || "";

  controlElement.className = "theme_control";
  labelElement.className = "theme_label";
  labelElement.textContent = field.label;
  labelElement.setAttribute("for", field.name);
  inputsElement.className = "theme_inputs";

  textInput.id = field.name;
  textInput.className = "theme_text_input";
  textInput.type = "text";
  textInput.value = value;
  textInput.setAttribute("data-theme-field", field.name);

  colorInput.className = "theme_color_input";
  colorInput.type = "color";
  colorInput.value = isHexColor(value) ? normalizeHexColor(value) : "#000000";
  colorInput.disabled = !isHexColor(value);
  colorInput.setAttribute("data-theme-color-field", field.name);

  inputsElement.appendChild(textInput);
  inputsElement.appendChild(colorInput);
  controlElement.appendChild(labelElement);
  controlElement.appendChild(inputsElement);

  return controlElement;
}

/**
 * Connects configurator UI events.
 */
function bindThemeConfiguratorEvents() {
  const configForm = document.getElementById("config_form");
  const resetConfigButton = document.getElementById("reset_config_button");
  const clearImageItemsButton = document.getElementById("clear_image_items_button");

  configForm.addEventListener("input", handleConfigInput);
  configForm.addEventListener("change", handleConfigChange);
  configForm.addEventListener("submit", handleConfigSave);
  resetConfigButton.addEventListener("click", handleConfigReset);
  clearImageItemsButton.addEventListener("click", handleClearImageItems);
}

/**
 * Handles all live config field changes.
 *
 * @param {InputEvent} event - Input event.
 */
function handleConfigInput(event) {
  handleRoomSettingsInput(event);
  handleThemeInput(event);
}

/**
 * Handles config changes that need file or checkbox-specific behavior.
 *
 * @param {Event} event - Change event.
 */
function handleConfigChange(event) {
  handleRoomSettingsInput(event);
  updateContentModeVisibility();

  if (event.target.id === "image_items_input") {
    handleImageItemsChange(event);
  }
}

/**
 * Handles room settings field changes.
 *
 * @param {InputEvent} event - Input event.
 */
function handleRoomSettingsInput(event) {
  const target = event.target;

  if (target.id === "room_title_input") {
    themeConfigState.current_room_settings.title = target.value;
    updateRoomPreview();
  }

  if (target.id === "room_description_input") {
    themeConfigState.current_room_settings.description = target.value;
    updateRoomPreview();
  }

  if (target.id === "text_items_input") {
    themeConfigState.current_room_settings.text_items_raw = target.value;
    updateCellPreview();
  }

  if (target.name === "content_mode") {
    setContentMode(target.value);
  }

  if (target.id === "number_range_start_input") {
    themeConfigState.current_room_settings.number_range.start =
      getValidIntegerValue(target.value, 1);
    updateCellPreview();
  }

  if (target.id === "number_range_end_input") {
    themeConfigState.current_room_settings.number_range.end =
      getValidIntegerValue(target.value, 75);
    updateCellPreview();
  }

  updateCheckboxSetting(target, "timer_enabled_input", "draw_settings", "enabled");
  updateCheckboxSetting(
    target,
    "requires_ready_input",
    "draw_settings",
    "requires_all_players_ready"
  );
  updateCheckboxSetting(
    target,
    "quiet_hours_enabled_input",
    "draw_settings",
    "quiet_hours_enabled"
  );

  if (target.id === "ready_target_input") {
    themeConfigState.current_room_settings.draw_settings.ready_target =
      getClampedIntegerValue(target.value, 1, 50, 1);
  }

  if (target.id === "timer_seconds_input") {
    themeConfigState.current_room_settings.draw_settings.interval_seconds =
      getClampedIntegerValue(target.value, 5, 3600, 30);
  }

  if (target.name === "timer_mode") {
    themeConfigState.current_room_settings.draw_settings.timer_mode = target.value;
    updateContentModeVisibility();
  }

  if (target.id === "timer_min_seconds_input") {
    themeConfigState.current_room_settings.draw_settings.random_min_seconds =
      getClampedIntegerValue(target.value, 5, 3600, 15);
  }

  if (target.id === "timer_max_seconds_input") {
    themeConfigState.current_room_settings.draw_settings.random_max_seconds =
      getClampedIntegerValue(target.value, 5, 3600, 90);
  }

  if (target.id === "quiet_start_input") {
    themeConfigState.current_room_settings.draw_settings.quiet_start =
      getValidTimeValue(target.value, "22:00");
  }

  if (target.id === "quiet_end_input") {
    themeConfigState.current_room_settings.draw_settings.quiet_end =
      getValidTimeValue(target.value, "08:00");
  }

  if (target.id === "penalty_items_input") {
    themeConfigState.current_room_settings.draw_settings.penalty_items_raw = target.value;
  }

  if (target.id === "penalty_last_count_input") {
    themeConfigState.current_room_settings.draw_settings.penalty_last_count =
      getClampedIntegerValue(target.value, 1, 50, 3);
  }

  updateCheckboxSetting(target, "allow_images_input", "content_settings", "allow_images");

  if (target.id === "allow_images_input") {
    updateContentModeVisibility();
  }

  updateCheckboxSetting(target, "victory_line_input", "victory_rules", "line");
  updateCheckboxSetting(target, "victory_column_input", "victory_rules", "column");
  updateCheckboxSetting(target, "victory_diagonal_input", "victory_rules", "diagonal");
  updateCheckboxSetting(target, "victory_full_board_input", "victory_rules", "full_board");
}

/**
 * Handles live theme field changes.
 *
 * @param {InputEvent} event - Input event.
 */
function handleThemeInput(event) {
  const textField = event.target.getAttribute("data-theme-field");
  const colorField = event.target.getAttribute("data-theme-color-field");

  if (textField) {
    updateThemeValue(textField, event.target.value);
    syncColorInput(textField, event.target.value);
    return;
  }

  if (colorField) {
    updateThemeValue(colorField, event.target.value);
    syncTextInput(colorField, event.target.value);
  }
}

/**
 * Updates one theme value and reapplies the live preview.
 *
 * @param {string} fieldName - Theme field name.
 * @param {string} value - Theme value.
 */
function updateThemeValue(fieldName, value) {
  themeConfigState.current_theme[fieldName] = value.trim();
  applyRoomTheme(themeConfigState.current_theme);
}

/**
 * Saves the current theme override.
 *
 * @param {SubmitEvent} event - Submit event.
 */
function handleConfigSave(event) {
  event.preventDefault();

  try {
    const normalizedRoomSettings = normalizeContentModeSettings(
      themeConfigState.current_room_settings
    );

    saveLocalRoomSettings(themeConfigState.room_id, normalizedRoomSettings);
    saveLocalThemeSettings(themeConfigState.room_id, themeConfigState.current_theme);
    updateConfigStatus("Configuracao salva localmente. Recarregue o jogo para aplicar.");
    saveOnlineRoomConfigIfAvailable(
      normalizedRoomSettings,
      themeConfigState.current_theme
    );
  } catch (error) {
    updateConfigStatus(
      "Nao foi possivel salvar. Reduza a quantidade ou o tamanho das imagens."
    );
    console.error(error);
  }
}

/**
 * Loads online room configuration when available.
 *
 * @returns {Promise<object|null>} Online room config or null.
 */
async function loadOnlineRoomConfigIfAvailable() {
  if (
    !window.BingoOnline ||
    !window.BingoOnline.isOnlineSyncEnabled() ||
    !window.BingoOnline.loadOnlineRoomConfig
  ) {
    return null;
  }

  try {
    return await window.BingoOnline.loadOnlineRoomConfig();
  } catch (error) {
    console.warn("Could not load online room config:", error);
    return null;
  }
}

/**
 * Saves room configuration online when Firestore sync is enabled.
 *
 * @param {object} roomSettings - Room settings.
 * @param {object} themeSettings - Theme settings.
 */
function saveOnlineRoomConfigIfAvailable(roomSettings, themeSettings) {
  if (
    !window.BingoOnline ||
    !window.BingoOnline.isOnlineSyncEnabled() ||
    !window.BingoOnline.saveOnlineRoomConfig
  ) {
    return;
  }

  window.BingoOnline.saveOnlineRoomConfig(
    themeConfigState.room_id,
    roomSettings,
    themeSettings
  ).then(function () {
    updateConfigStatus("Configuracao salva localmente e online.");
  }).catch(function (error) {
    updateConfigStatus("Configuracao local salva, mas o envio online falhou.");
    console.error(error);
  });
}

/**
 * Keeps text and number filters synchronized with the selected content mode.
 *
 * @param {object} roomSettings - Editable room settings.
 * @returns {object} Normalized room settings.
 */
function normalizeContentModeSettings(roomSettings) {
  roomSettings.content_settings.allow_text = roomSettings.content_mode === "text";
  roomSettings.content_settings.allow_numbers =
    roomSettings.content_mode === "number";

  if (roomSettings.content_mode === "number") {
    roomSettings.content_settings.allow_images = false;
  }

  roomSettings.draw_settings.enabled = roomSettings.content_mode === "number" &&
    Boolean(roomSettings.draw_settings.enabled);
  roomSettings.draw_settings.mode = "timer";
  roomSettings.draw_settings.penalty_items = getTextItemsFromRaw(
    roomSettings.draw_settings.penalty_items_raw || ""
  );

  return roomSettings;
}

/**
 * Reads submitted image files and stores them as local image items.
 *
 * @param {Event} event - File input change event.
 */
function handleImageItemsChange(event) {
  const imageInput = event.target;
  const files = Array.from(imageInput.files || []).filter(function (file) {
    return file.type.indexOf("image/") === 0;
  }).slice(0, MAX_LOCAL_IMAGE_FILES);

  if (files.length === 0) {
    return;
  }

  Promise.all(files.map(readImageFileAsItem)).then(function (imageItems) {
    if (!canStoreLocalImageItems(imageItems)) {
      imageInput.value = "";
      updateConfigStatus(
        "As imagens ainda ficaram grandes demais para o armazenamento local."
      );
      return;
    }

    themeConfigState.current_room_settings.image_items = imageItems;
    renderImageItemsPreview();
    updateConfigStatus(
      `${imageItems.length} imagem(ns) pronta(s). Salve a configuracao para usar no jogo.`
    );
  }).catch(function (error) {
    updateConfigStatus("Nao foi possivel carregar uma das imagens.");
    console.error(error);
  });
}

/**
 * Clears locally submitted image items from the current configurator state.
 */
function handleClearImageItems() {
  const imageInput = document.getElementById("image_items_input");

  themeConfigState.current_room_settings.image_items = [];
  imageInput.value = "";
  renderImageItemsPreview();
  updateConfigStatus("Imagens removidas da configuracao atual.");
}

/**
 * Resets the saved config override.
 */
function handleConfigReset() {
  const shouldReset = confirm("Voltar para a configuracao base definida no JSON?");

  if (!shouldReset) {
    return;
  }

  clearLocalRoomSettings(themeConfigState.room_id);
  clearLocalThemeSettings(themeConfigState.room_id);
  themeConfigState.current_room_settings = cloneRoomSettings(
    themeConfigState.base_room_settings
  );
  themeConfigState.current_theme = Object.assign({}, themeConfigState.base_theme);
  renderRoomSettingsControls();
  renderThemeControls();
  applyRoomTheme(themeConfigState.current_theme);
  updateRoomPreview();
  updateConfigStatus("Configuracao local removida. O preview voltou ao JSON base.");
}

/**
 * Updates a color picker when the text field receives a valid hex color.
 *
 * @param {string} fieldName - Theme field name.
 * @param {string} value - Theme value.
 */
function syncColorInput(fieldName, value) {
  const colorInput = document.querySelector(`[data-theme-color-field="${fieldName}"]`);

  if (!colorInput) {
    return;
  }

  colorInput.disabled = !isHexColor(value);

  if (isHexColor(value)) {
    colorInput.value = normalizeHexColor(value);
  }
}

/**
 * Updates a text input from the color picker.
 *
 * @param {string} fieldName - Theme field name.
 * @param {string} value - Theme value.
 */
function syncTextInput(fieldName, value) {
  const textInput = document.querySelector(`[data-theme-field="${fieldName}"]`);

  if (textInput) {
    textInput.value = value;
  }
}

/**
 * Checks whether a value is a full six-digit hex color.
 *
 * @param {string} value - Color value.
 * @returns {boolean} True when value is a valid hex color.
 */
function isHexColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

/**
 * Normalizes a hex color to lowercase.
 *
 * @param {string} value - Hex color value.
 * @returns {string} Normalized hex color.
 */
function normalizeHexColor(value) {
  return value.toLowerCase();
}

/**
 * Updates the configurator status text.
 *
 * @param {string} message - Status message.
 */
function updateConfigStatus(message) {
  const statusElement = document.getElementById("config_status");

  statusElement.textContent = message;
}

/**
 * Loads local theme settings using the shared storage helper when available.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {object|null} Saved theme settings or null.
 */
function loadLocalThemeSettings(roomId) {
  if (typeof loadThemeSettings === "function") {
    return loadThemeSettings(roomId);
  }

  return readThemeSettingsFallback(roomId);
}

/**
 * Saves local theme settings using the shared storage helper when available.
 *
 * @param {string} roomId - Unique room identifier.
 * @param {object} themeSettings - Theme settings to persist.
 */
function saveLocalThemeSettings(roomId, themeSettings) {
  if (typeof saveThemeSettings === "function") {
    saveThemeSettings(roomId, themeSettings);
    return;
  }

  localStorage.setItem(
    buildThemeSettingsKeyFallback(roomId),
    JSON.stringify(themeSettings)
  );
}

/**
 * Clears local theme settings using the shared storage helper when available.
 *
 * @param {string} roomId - Unique room identifier.
 */
function clearLocalThemeSettings(roomId) {
  if (typeof clearThemeSettings === "function") {
    clearThemeSettings(roomId);
    return;
  }

  localStorage.removeItem(buildThemeSettingsKeyFallback(roomId));
}

/**
 * Reads theme settings directly from localStorage as a fallback.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {object|null} Saved theme settings or null.
 */
function readThemeSettingsFallback(roomId) {
  const serializedThemeSettings = localStorage.getItem(
    buildThemeSettingsKeyFallback(roomId)
  );

  if (!serializedThemeSettings) {
    return null;
  }

  return JSON.parse(serializedThemeSettings);
}

/**
 * Builds the fallback localStorage key for theme settings.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {string} Local storage key.
 */
function buildThemeSettingsKeyFallback(roomId) {
  return `bingo_room_${roomId}_theme_settings`;
}

/**
 * Extracts editable room settings from the full room config.
 *
 * @param {object} roomConfig - Loaded room configuration.
 * @param {object[]} items - Loaded bingo items.
 * @returns {object} Editable room settings.
 */
function getEditableRoomSettings(roomConfig, items) {
  return {
    title: roomConfig.title,
    description: roomConfig.description,
    board: {
      free_center: roomConfig.board.free_center,
      cell_padding_px: roomConfig.board.cell_padding_px || 8
    },
    content_mode: getBaseContentMode(roomConfig.content_settings),
    text_items_raw: getTextItemsRaw(items),
    number_range: getNumberRangeFromItems(items),
    image_items: getImageItemsFromLoadedItems(items),
    draw_settings: {
      enabled: Boolean(roomConfig.draw_settings && roomConfig.draw_settings.enabled),
      mode: "timer",
      timer_mode: getBaseTimerMode(roomConfig.draw_settings),
      interval_seconds: getBaseTimerSeconds(roomConfig.draw_settings),
      random_min_seconds: getBaseRandomMinSeconds(roomConfig.draw_settings),
      random_max_seconds: getBaseRandomMaxSeconds(roomConfig.draw_settings),
      requires_all_players_ready: Boolean(
        roomConfig.draw_settings &&
        roomConfig.draw_settings.requires_all_players_ready
      ),
      ready_target: getBaseReadyTarget(roomConfig.draw_settings),
      quiet_hours_enabled: Boolean(
        roomConfig.draw_settings &&
        roomConfig.draw_settings.quiet_hours_enabled
      ),
      quiet_start: getBaseQuietTime(roomConfig.draw_settings, "quiet_start", "22:00"),
      quiet_end: getBaseQuietTime(roomConfig.draw_settings, "quiet_end", "08:00"),
      penalty_items_raw: getBasePenaltyItemsRaw(roomConfig.draw_settings),
      penalty_last_count: getBasePenaltyLastCount(roomConfig.draw_settings)
    },
    content_settings: {
      allow_text: roomConfig.content_settings.allow_text,
      allow_numbers: roomConfig.content_settings.allow_numbers,
      allow_images: roomConfig.content_settings.allow_images
    },
    victory_rules: {
      line: roomConfig.victory_rules.line,
      column: roomConfig.victory_rules.column,
      diagonal: roomConfig.victory_rules.diagonal,
      full_board: roomConfig.victory_rules.full_board
    }
  };
}

/**
 * Merges base room settings with local overrides.
 *
 * @param {object} baseSettings - Settings from room JSON.
 * @param {object|null} localSettings - Locally saved settings.
 * @returns {object} Merged room settings.
 */
function mergeRoomSettings(baseSettings, localSettings) {
  const mergedSettings = cloneRoomSettings(baseSettings);

  if (!localSettings) {
    return mergedSettings;
  }

  if (typeof localSettings.title === "string") {
    mergedSettings.title = localSettings.title;
  }

  if (typeof localSettings.description === "string") {
    mergedSettings.description = localSettings.description;
  }

  if (typeof localSettings.text_items_raw === "string") {
    mergedSettings.text_items_raw = localSettings.text_items_raw;
  }

  if (Array.isArray(localSettings.image_items)) {
    mergedSettings.image_items = localSettings.image_items.slice();
  }

  if (localSettings.content_mode === "text" || localSettings.content_mode === "number") {
    mergedSettings.content_mode = localSettings.content_mode;
  }

  mergedSettings.number_range = Object.assign(
    {},
    mergedSettings.number_range,
    localSettings.number_range || {}
  );

  mergedSettings.board = Object.assign(
    {},
    mergedSettings.board,
    localSettings.board || {}
  );

  mergedSettings.draw_settings = Object.assign(
    {},
    mergedSettings.draw_settings,
    localSettings.draw_settings || {}
  );

  mergedSettings.content_settings = Object.assign(
    {},
    mergedSettings.content_settings,
    localSettings.content_settings || {}
  );
  mergedSettings.victory_rules = Object.assign(
    {},
    mergedSettings.victory_rules,
    localSettings.victory_rules || {}
  );

  return mergedSettings;
}

/**
 * Clones room settings.
 *
 * @param {object} roomSettings - Room settings.
 * @returns {object} Cloned room settings.
 */
function cloneRoomSettings(roomSettings) {
  return {
    title: roomSettings.title,
    description: roomSettings.description,
    board: Object.assign({}, roomSettings.board),
    content_mode: roomSettings.content_mode,
    text_items_raw: roomSettings.text_items_raw,
    number_range: Object.assign({}, roomSettings.number_range),
    image_items: roomSettings.image_items.slice(),
    draw_settings: Object.assign({}, roomSettings.draw_settings),
    content_settings: Object.assign({}, roomSettings.content_settings),
    victory_rules: Object.assign({}, roomSettings.victory_rules)
  };
}

/**
 * Updates one checkbox-backed setting.
 *
 * @param {HTMLElement} target - Event target.
 * @param {string} inputId - Checkbox input id.
 * @param {string} groupName - Settings group name.
 * @param {string} settingName - Setting name.
 */
function updateCheckboxSetting(target, inputId, groupName, settingName) {
  if (target.id !== inputId) {
    return;
  }

  themeConfigState.current_room_settings[groupName][settingName] = target.checked;
}

/**
 * Updates text in the preview from room settings.
 */
function updateRoomPreview() {
  const titleElement = document.querySelector(".preview_room_title");
  const descriptionElement = document.querySelector(".preview_room_description");

  if (titleElement) {
    titleElement.textContent = themeConfigState.current_room_settings.title;
  }

  if (descriptionElement) {
    descriptionElement.textContent =
      themeConfigState.current_room_settings.description;
  }

  updateCellPreview();
}

/**
 * Updates the individual cell preview from text and padding settings.
 */
function updateCellPreview() {
  const previewCell = document.getElementById("single_cell_preview");

  if (!previewCell) {
    return;
  }

  const previewItems = getPreviewItemLabels();
  const longestText = getLongestConfigText(previewItems) || "Texto maior da cartela";
  const padding = themeConfigState.current_room_settings.board.cell_padding_px;
  const size = calculatePreviewCellSize(longestText, padding);

  previewCell.textContent = longestText;
  previewCell.style.setProperty("--cell-padding", `${padding}px`);
  previewCell.style.setProperty("--cell-size", `${size}px`);
}

/**
 * Loads local room settings using the shared storage helper when available.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {object|null} Saved room settings or null.
 */
function loadLocalRoomSettings(roomId) {
  if (typeof loadRoomSettings === "function") {
    return loadRoomSettings(roomId);
  }

  return readRoomSettingsFallback(roomId);
}

/**
 * Saves local room settings using the shared storage helper when available.
 *
 * @param {string} roomId - Unique room identifier.
 * @param {object} roomSettings - Room settings to persist.
 */
function saveLocalRoomSettings(roomId, roomSettings) {
  if (typeof saveRoomSettings === "function") {
    saveRoomSettings(roomId, roomSettings);
    return;
  }

  localStorage.setItem(
    buildRoomSettingsKeyFallback(roomId),
    JSON.stringify(roomSettings)
  );
}

/**
 * Clears local room settings using the shared storage helper when available.
 *
 * @param {string} roomId - Unique room identifier.
 */
function clearLocalRoomSettings(roomId) {
  if (typeof clearRoomSettings === "function") {
    clearRoomSettings(roomId);
    return;
  }

  localStorage.removeItem(buildRoomSettingsKeyFallback(roomId));
}

/**
 * Reads room settings directly from localStorage as a fallback.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {object|null} Saved room settings or null.
 */
function readRoomSettingsFallback(roomId) {
  const serializedRoomSettings = localStorage.getItem(
    buildRoomSettingsKeyFallback(roomId)
  );

  if (!serializedRoomSettings) {
    return null;
  }

  return JSON.parse(serializedRoomSettings);
}

/**
 * Builds the fallback localStorage key for room settings.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {string} Local storage key.
 */
function buildRoomSettingsKeyFallback(roomId) {
  return `bingo_room_${roomId}_room_settings`;
}

/**
 * Sets the active content mode and keeps content filters in sync.
 *
 * @param {string} contentMode - Selected content mode.
 */
function setContentMode(contentMode) {
  themeConfigState.current_room_settings.content_mode = contentMode;
  themeConfigState.current_room_settings.content_settings.allow_text =
    contentMode === "text";
  themeConfigState.current_room_settings.content_settings.allow_numbers =
    contentMode === "number";

  if (contentMode === "number") {
    themeConfigState.current_room_settings.content_settings.allow_images = false;
    document.getElementById("allow_images_input").checked = false;
  }

  updateContentModeVisibility();
  updateCellPreview();
}

/**
 * Shows the editor that matches the active content mode.
 */
function updateContentModeVisibility() {
  const textItemsSection = document.getElementById("text_items_section");
  const numberRangeSection = document.getElementById("number_range_section");
  const imageItemsSection = document.getElementById("image_items_section");
  const drawSettingsSection = document.getElementById("draw_settings_section");
  const fixedTimerSection = document.getElementById("fixed_timer_section");
  const randomTimerSection = document.getElementById("random_timer_section");
  const allowImagesInput = document.getElementById("allow_images_input");
  const allowImagesControl = allowImagesInput.closest(".check_control");
  const isNumberMode =
    themeConfigState.current_room_settings.content_mode === "number";
  const allowImages =
    Boolean(themeConfigState.current_room_settings.content_settings.allow_images);
  const isRandomTimer =
    themeConfigState.current_room_settings.draw_settings.timer_mode === "random";

  setElementHidden(textItemsSection, isNumberMode);
  setElementHidden(numberRangeSection, !isNumberMode);
  setElementHidden(allowImagesControl, isNumberMode);
  setElementHidden(drawSettingsSection, !isNumberMode);
  setElementHidden(imageItemsSection, isNumberMode || !allowImages);
  setElementHidden(fixedTimerSection, !isNumberMode || isRandomTimer);
  setElementHidden(randomTimerSection, !isNumberMode || !isRandomTimer);

  if (isNumberMode) {
    allowImagesInput.checked = false;
    themeConfigState.current_room_settings.content_settings.allow_images = false;
  }
}

/**
 * Hides an element when it exists.
 *
 * @param {HTMLElement|null} element - Element to update.
 * @param {boolean} shouldHide - Whether the element should be hidden.
 */
function setElementHidden(element, shouldHide) {
  if (element) {
    element.hidden = shouldHide;
  }
}

/**
 * Gets the base content mode from content settings.
 *
 * @param {object} contentSettings - Room content settings.
 * @returns {string} Content mode.
 */
function getBaseContentMode(contentSettings) {
  if (contentSettings.allow_numbers && !contentSettings.allow_text) {
    return "number";
  }

  return "text";
}

/**
 * Gets the numeric range from existing number items.
 *
 * @param {object[]} items - Loaded bingo items.
 * @returns {object} Number range.
 */
function getNumberRangeFromItems(items) {
  const numbers = items
    .filter(function (item) {
      return item.type === "number";
    })
    .map(function (item) {
      return Number(item.label);
    })
    .filter(function (value) {
      return Number.isFinite(value);
    });

  if (numbers.length === 0) {
    return {
      start: 1,
      end: 75
    };
  }

  return {
    start: Math.min.apply(null, numbers),
    end: Math.max.apply(null, numbers)
  };
}

/**
 * Gets the base timer duration from room config.
 *
 * @param {object} drawSettings - Room draw settings.
 * @returns {number} Timer duration in seconds.
 */
function getBaseTimerSeconds(drawSettings) {
  if (!drawSettings) {
    return 30;
  }

  return getClampedIntegerValue(drawSettings.interval_seconds, 5, 3600, 30);
}

/**
 * Gets the configured timer mode.
 *
 * @param {object} drawSettings - Room draw settings.
 * @returns {string} Timer mode.
 */
function getBaseTimerMode(drawSettings) {
  if (drawSettings && drawSettings.timer_mode === "fixed") {
    return "fixed";
  }

  return "random";
}

/**
 * Gets the base minimum random timer duration.
 *
 * @param {object} drawSettings - Room draw settings.
 * @returns {number} Minimum random timer duration.
 */
function getBaseRandomMinSeconds(drawSettings) {
  if (!drawSettings) {
    return 15;
  }

  return getClampedIntegerValue(drawSettings.random_min_seconds, 5, 3600, 15);
}

/**
 * Gets the base maximum random timer duration.
 *
 * @param {object} drawSettings - Room draw settings.
 * @returns {number} Maximum random timer duration.
 */
function getBaseRandomMaxSeconds(drawSettings) {
  if (!drawSettings) {
    return 90;
  }

  return getClampedIntegerValue(drawSettings.random_max_seconds, 5, 3600, 90);
}

/**
 * Gets the base ready confirmation target from room config.
 *
 * @param {object} drawSettings - Room draw settings.
 * @returns {number} Required confirmations.
 */
function getBaseReadyTarget(drawSettings) {
  if (!drawSettings) {
    return 1;
  }

  return getClampedIntegerValue(drawSettings.ready_target, 1, 50, 1);
}

/**
 * Gets a configured quiet-hours time value.
 *
 * @param {object} drawSettings - Room draw settings.
 * @param {string} fieldName - Time field name.
 * @param {string} fallback - Fallback time.
 * @returns {string} Time value.
 */
function getBaseQuietTime(drawSettings, fieldName, fallback) {
  if (!drawSettings) {
    return fallback;
  }

  return getValidTimeValue(drawSettings[fieldName], fallback);
}

/**
 * Gets penalty options as a line-based editor value.
 *
 * @param {object} drawSettings - Room draw settings.
 * @returns {string} One penalty option per line.
 */
function getBasePenaltyItemsRaw(drawSettings) {
  if (!drawSettings || !Array.isArray(drawSettings.penalty_items)) {
    return "";
  }

  return drawSettings.penalty_items.join("\n");
}

/**
 * Gets the configured last-response penalty threshold.
 *
 * @param {object} drawSettings - Room draw settings.
 * @returns {number} Penalty threshold.
 */
function getBasePenaltyLastCount(drawSettings) {
  if (!drawSettings) {
    return 3;
  }

  return getClampedIntegerValue(drawSettings.penalty_last_count, 1, 50, 3);
}

/**
 * Converts loaded text items into the line-based editor format.
 *
 * @param {object[]} items - Loaded bingo items.
 * @returns {string} One text item per line.
 */
function getTextItemsRaw(items) {
  return items
    .filter(function (item) {
      return item.type === "text";
    })
    .map(function (item) {
      return item.label;
    })
    .join("\n");
}

/**
 * Gets loaded image items for the configurator state.
 *
 * @param {object[]} items - Loaded bingo items.
 * @returns {object[]} Image items.
 */
function getImageItemsFromLoadedItems(items) {
  return items
    .filter(function (item) {
      return item.type === "image";
    })
    .map(function (item, index) {
      return {
        id: item.id || `local_image_${String(index + 1).padStart(3, "0")}`,
        type: "image",
        label: item.label || `Imagem ${index + 1}`,
        image_url: item.image_url || null
      };
    });
}

/**
 * Renders the submitted image list in the configurator.
 */
function renderImageItemsPreview() {
  const previewElement = document.getElementById("image_items_preview");
  const imageItems = themeConfigState.current_room_settings.image_items || [];

  previewElement.innerHTML = "";

  if (imageItems.length === 0) {
    const emptyElement = document.createElement("p");

    emptyElement.className = "history_item_meta image_preview_empty";
    emptyElement.textContent = "Nenhuma imagem selecionada.";
    previewElement.appendChild(emptyElement);
    return;
  }

  imageItems.forEach(function (item) {
    previewElement.appendChild(createImagePreviewItem(item));
  });
}

/**
 * Creates one submitted image preview.
 *
 * @param {object} item - Image item.
 * @returns {HTMLDivElement} Preview element.
 */
function createImagePreviewItem(item) {
  const previewItem = document.createElement("div");
  const imageElement = document.createElement("img");
  const labelElement = document.createElement("p");

  previewItem.className = "image_preview_item";
  imageElement.src = item.image_url;
  imageElement.alt = item.label;
  labelElement.className = "history_item_meta";
  labelElement.textContent = item.label;

  previewItem.appendChild(imageElement);
  previewItem.appendChild(labelElement);

  return previewItem;
}

/**
 * Builds preview labels based on the active content mode.
 *
 * @returns {string[]} Preview item labels.
 */
function getPreviewItemLabels() {
  if (themeConfigState.current_room_settings.content_mode === "number") {
    const range = themeConfigState.current_room_settings.number_range;

    return [String(range.start), String(range.end)];
  }

  return getTextItemsFromRaw(themeConfigState.current_room_settings.text_items_raw);
}

/**
 * Parses raw text items from the textarea.
 *
 * @param {string} textItemsRaw - One text item per line.
 * @returns {string[]} Text item labels.
 */
function getTextItemsFromRaw(textItemsRaw) {
  return textItemsRaw
    .split(/\r?\n/)
    .map(function (label) {
      return label.trim();
    })
    .filter(function (label) {
      return label.length > 0;
    });
}

/**
 * Converts one submitted image file into a local bingo item.
 *
 * @param {File} file - Submitted image file.
 * @param {number} index - File index.
 * @returns {Promise<object>} Local image item.
 */
function readImageFileAsItem(file, index) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();

    reader.addEventListener("load", function () {
      resizeImageDataUrl(reader.result).then(function (resizedImageUrl) {
        resolve({
          id: `local_image_${String(index + 1).padStart(3, "0")}`,
          type: "image",
          label: getImageLabelFromFileName(file.name),
          image_url: resizedImageUrl
        });
      }).catch(reject);
    });

    reader.addEventListener("error", function () {
      reject(reader.error);
    });

    reader.readAsDataURL(file);
  });
}

/**
 * Resizes a submitted image for local storage.
 *
 * @param {string} imageUrl - Original data URL.
 * @returns {Promise<string>} Resized image data URL.
 */
function resizeImageDataUrl(imageUrl) {
  return new Promise(function (resolve, reject) {
    const image = new Image();

    image.addEventListener("load", function () {
      const canvas = document.createElement("canvas");
      const scale = Math.min(
        1,
        LOCAL_IMAGE_MAX_SIZE / Math.max(image.naturalWidth, image.naturalHeight)
      );

      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

      resolve(canvas.toDataURL("image/jpeg", LOCAL_IMAGE_QUALITY));
    });

    image.addEventListener("error", function () {
      reject(new Error("Nao foi possivel carregar a imagem."));
    });

    image.src = imageUrl;
  });
}

/**
 * Checks if image items are small enough for localStorage.
 *
 * @param {object[]} imageItems - Local image items.
 * @returns {boolean} True when the payload is within the local limit.
 */
function canStoreLocalImageItems(imageItems) {
  return JSON.stringify(imageItems).length <= MAX_LOCAL_IMAGE_STORAGE_CHARS;
}

/**
 * Turns an image filename into a readable item label.
 *
 * @param {string} fileName - Submitted filename.
 * @returns {string} Label without extension.
 */
function getImageLabelFromFileName(fileName) {
  return fileName.replace(/\.[^/.]+$/, "").trim() || "Imagem";
}

/**
 * Gets a valid padding value from form input.
 *
 * @param {string} value - Input value.
 * @returns {number} Padding value.
 */
function getValidPaddingValue(value) {
  const padding = Number(value);

  if (!Number.isFinite(padding) || padding < 0) {
    return 8;
  }

  return Math.min(padding, 40);
}

/**
 * Gets a valid integer value from form input.
 *
 * @param {string} value - Input value.
 * @param {number} fallback - Fallback value.
 * @returns {number} Integer value.
 */
function getValidIntegerValue(value, fallback) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.trunc(parsedValue);
}

/**
 * Gets an integer inside a fixed range.
 *
 * @param {string|number} value - Input value.
 * @param {number} minimum - Minimum allowed value.
 * @param {number} maximum - Maximum allowed value.
 * @param {number} fallback - Fallback value.
 * @returns {number} Clamped integer.
 */
function getClampedIntegerValue(value, minimum, maximum, fallback) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.trunc(parsedValue)));
}

/**
 * Gets a valid HH:mm time value.
 *
 * @param {string} value - Input value.
 * @param {string} fallback - Fallback value.
 * @returns {string} Time value.
 */
function getValidTimeValue(value, fallback) {
  if (/^\d{2}:\d{2}$/.test(String(value))) {
    return value;
  }

  return fallback;
}

/**
 * Finds the longest configurator text by character count.
 *
 * @param {string[]} texts - Text list.
 * @returns {string} Longest text.
 */
function getLongestConfigText(texts) {
  return texts.reduce(function (longestText, currentText) {
    if (currentText.length > longestText.length) {
      return currentText;
    }

    return longestText;
  }, "");
}

/**
 * Calculates a preview square cell size that fits a text value.
 *
 * @param {string} text - Text to fit.
 * @param {number} padding - Cell padding.
 * @returns {number} Square cell size.
 */
function calculatePreviewCellSize(text, padding) {
  const measurer = document.createElement("div");
  const minimumSize = 74;
  const maximumSize = 420;

  measurer.className = "cell_text_measurer";
  measurer.textContent = text;
  document.body.appendChild(measurer);

  for (let size = minimumSize; size <= maximumSize; size++) {
    const contentSize = size - padding * 2;

    measurer.style.width = `${contentSize}px`;

    if (
      measurer.scrollWidth <= contentSize &&
      measurer.scrollHeight <= contentSize
    ) {
      document.body.removeChild(measurer);
      return size;
    }
  }

  document.body.removeChild(measurer);
  return maximumSize;
}
