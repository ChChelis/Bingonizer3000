const cellConfigState = {
  room_id: null,
  base_room_settings: {},
  current_room_settings: {},
  current_theme: {}
};

document.addEventListener("DOMContentLoaded", initializeCellConfigurator);

/**
 * Initializes the cartela configurator page.
 */
async function initializeCellConfigurator() {
  try {
    const loadedData = await loadCellConfigData();
    const roomConfig = loadedData.room_config;
    const items = loadedData.items;
    const savedRoomSettings = loadLocalRoomSettings(roomConfig.room_id);
    const savedTheme = loadLocalThemeSettings(roomConfig.room_id);

    cellConfigState.room_id = roomConfig.room_id;
    cellConfigState.base_room_settings = getEditableRoomSettings(
      roomConfig,
      items
    );
    cellConfigState.current_room_settings = mergeRoomSettings(
      cellConfigState.base_room_settings,
      savedRoomSettings
    );
    cellConfigState.current_theme = mergeThemeSettings(
      roomConfig.theme_settings,
      savedTheme
    );

    renderCellSettingsControls();
    bindCellConfiguratorEvents();
    applyRoomTheme(cellConfigState.current_theme);
    updateCellPreview();
    updateCellConfigStatus(loadedData.used_fallback ?
      "Configuracao da cartela carregada localmente. Use o servidor para ler os JSONs." :
      "Configuracao da cartela carregada."
    );
  } catch (error) {
    updateCellConfigStatus(error.message);
    console.error(error);
  }
}

/**
 * Loads room data or falls back to local defaults when fetch is unavailable.
 *
 * @returns {Promise<object>} Cell config data.
 */
async function loadCellConfigData() {
  try {
    const roomConfig = await loadJsonFile("data/sample_room.json");
    const itemsData = await loadJsonFile(roomConfig.data_source.items_file);

    return {
      room_config: roomConfig,
      items: itemsData.items,
      used_fallback: false
    };
  } catch (error) {
    const fallbackRoomConfig = createFallbackRoomConfig();
    const savedRoomSettings = loadLocalRoomSettings(fallbackRoomConfig.room_id);

    return {
      room_config: fallbackRoomConfig,
      items: createFallbackItems(savedRoomSettings),
      used_fallback: true
    };
  }
}

/**
 * Creates minimal room config for direct local opening fallback.
 *
 * @returns {object} Fallback room config.
 */
function createFallbackRoomConfig() {
  return {
    room_id: "sample_room_001",
    board: {
      free_center: true,
      cell_padding_px: 8
    },
    content_settings: {
      allow_text: true,
      allow_numbers: false,
      allow_images: false
    },
    theme_settings: {}
  };
}

/**
 * Creates fallback items from local room settings.
 *
 * @param {object|null} savedRoomSettings - Saved room settings.
 * @returns {object[]} Fallback item list.
 */
function createFallbackItems(savedRoomSettings) {
  if (savedRoomSettings && savedRoomSettings.content_mode === "number") {
    return createNumberFallbackItems(savedRoomSettings.number_range);
  }

  return getTextItemsFromRaw(
    savedRoomSettings && savedRoomSettings.text_items_raw ?
      savedRoomSettings.text_items_raw :
      "Texto maior da cartela"
  ).map(function (label, index) {
    return {
      id: `fallback_text_${index}`,
      type: "text",
      label: label,
      image_url: null
    };
  });
}

/**
 * Creates fallback number items.
 *
 * @param {object} numberRange - Number range.
 * @returns {object[]} Number items.
 */
function createNumberFallbackItems(numberRange) {
  const start = numberRange && Number.isFinite(Number(numberRange.start)) ?
    Math.trunc(Number(numberRange.start)) :
    1;
  const end = numberRange && Number.isFinite(Number(numberRange.end)) ?
    Math.trunc(Number(numberRange.end)) :
    75;
  const firstNumber = Math.min(start, end);
  const lastNumber = Math.max(start, end);
  const items = [];

  for (let value = firstNumber; value <= lastNumber; value++) {
    items.push({
      id: `fallback_number_${value}`,
      type: "number",
      label: String(value),
      image_url: null
    });
  }

  return items;
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
 * Renders cartela settings into controls.
 */
function renderCellSettingsControls() {
  document.getElementById("free_center_input").checked =
    cellConfigState.current_room_settings.board.free_center;
  document.getElementById("cell_padding_input").value =
    cellConfigState.current_room_settings.board.cell_padding_px;
}

/**
 * Connects cartela configurator events.
 */
function bindCellConfiguratorEvents() {
  const formElement = document.getElementById("cell_config_form");
  const resetButton = document.getElementById("reset_cell_config_button");

  formElement.addEventListener("input", handleCellConfigInput);
  formElement.addEventListener("submit", handleCellConfigSave);
  resetButton.addEventListener("click", handleCellConfigReset);
}

/**
 * Handles live cartela field changes.
 *
 * @param {InputEvent} event - Input event.
 */
function handleCellConfigInput(event) {
  const target = event.target;

  if (target.id === "free_center_input") {
    cellConfigState.current_room_settings.board.free_center = target.checked;
  }

  if (target.id === "cell_padding_input") {
    cellConfigState.current_room_settings.board.cell_padding_px =
      getValidPaddingValue(target.value);
    updateCellPreview();
  }
}

/**
 * Saves cartela settings into local room settings.
 *
 * @param {SubmitEvent} event - Submit event.
 */
function handleCellConfigSave(event) {
  event.preventDefault();

  const savedRoomSettings = loadLocalRoomSettings(cellConfigState.room_id) || {};
  const nextRoomSettings = Object.assign({}, savedRoomSettings, {
    board: Object.assign(
      {},
      savedRoomSettings.board || {},
      cellConfigState.current_room_settings.board
    )
  });

  saveLocalRoomSettings(cellConfigState.room_id, nextRoomSettings);
  updateCellConfigStatus("Configuracao da cartela salva. Recarregue o jogo para aplicar.");
}

/**
 * Resets only cartela settings to JSON base values.
 */
function handleCellConfigReset() {
  const shouldReset = confirm("Voltar a cartela para a configuracao base do JSON?");

  if (!shouldReset) {
    return;
  }

  cellConfigState.current_room_settings.board = Object.assign(
    {},
    cellConfigState.base_room_settings.board
  );

  renderCellSettingsControls();
  updateCellPreview();
  handleCellConfigSave(new Event("submit"));
  updateCellConfigStatus("Configuracao da cartela voltou ao JSON base.");
}

/**
 * Updates the individual cell preview.
 */
function updateCellPreview() {
  const previewCell = document.getElementById("single_cell_preview");
  const longestText = getLongestConfigText(getPreviewItemLabels()) ||
    "Texto maior da cartela";
  const padding = cellConfigState.current_room_settings.board.cell_padding_px;
  const size = calculatePreviewCellSize(longestText, padding);

  previewCell.textContent = longestText;
  previewCell.style.setProperty("--cell-padding", `${padding}px`);
  previewCell.style.setProperty("--cell-size", `${size}px`);
}

/**
 * Extracts editable room settings used by this page.
 *
 * @param {object} roomConfig - Loaded room configuration.
 * @param {object[]} items - Loaded bingo items.
 * @returns {object} Editable room settings.
 */
function getEditableRoomSettings(roomConfig, items) {
  return {
    board: {
      free_center: roomConfig.board.free_center,
      cell_padding_px: roomConfig.board.cell_padding_px || 8
    },
    content_mode: getBaseContentMode(roomConfig.content_settings),
    text_items_raw: getTextItemsRaw(items),
    number_range: getNumberRangeFromItems(items)
  };
}

/**
 * Merges base settings with local overrides.
 *
 * @param {object} baseSettings - Base room settings.
 * @param {object|null} localSettings - Local settings.
 * @returns {object} Merged settings.
 */
function mergeRoomSettings(baseSettings, localSettings) {
  const mergedSettings = {
    board: Object.assign({}, baseSettings.board),
    content_mode: baseSettings.content_mode,
    text_items_raw: baseSettings.text_items_raw,
    number_range: Object.assign({}, baseSettings.number_range)
  };

  if (!localSettings) {
    return mergedSettings;
  }

  mergedSettings.board = Object.assign(
    {},
    mergedSettings.board,
    localSettings.board || {}
  );

  if (localSettings.content_mode === "text" || localSettings.content_mode === "number") {
    mergedSettings.content_mode = localSettings.content_mode;
  }

  if (typeof localSettings.text_items_raw === "string") {
    mergedSettings.text_items_raw = localSettings.text_items_raw;
  }

  mergedSettings.number_range = Object.assign(
    {},
    mergedSettings.number_range,
    localSettings.number_range || {}
  );

  return mergedSettings;
}

/**
 * Gets preview labels based on room mode.
 *
 * @returns {string[]} Preview labels.
 */
function getPreviewItemLabels() {
  if (cellConfigState.current_room_settings.content_mode === "number") {
    const range = cellConfigState.current_room_settings.number_range;

    return [String(range.start), String(range.end)];
  }

  return getTextItemsFromRaw(cellConfigState.current_room_settings.text_items_raw);
}

/**
 * Gets base content mode.
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
 * Gets text items as a line-based value.
 *
 * @param {object[]} items - Loaded items.
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
 * Gets number range from loaded number items.
 *
 * @param {object[]} items - Loaded items.
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
 * Parses line-based text values.
 *
 * @param {string} textItemsRaw - One item per line.
 * @returns {string[]} Item labels.
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
 * Finds the longest text by character count.
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
 * Calculates square preview size.
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

/**
 * Gets a valid padding value.
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
 * Updates status text.
 *
 * @param {string} message - Status message.
 */
function updateCellConfigStatus(message) {
  document.getElementById("cell_config_status").textContent = message;
}

/**
 * Loads local room settings.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {object|null} Local settings.
 */
function loadLocalRoomSettings(roomId) {
  if (typeof loadRoomSettings === "function") {
    return loadRoomSettings(roomId);
  }

  return null;
}

/**
 * Saves local room settings.
 *
 * @param {string} roomId - Unique room identifier.
 * @param {object} roomSettings - Room settings.
 */
function saveLocalRoomSettings(roomId, roomSettings) {
  if (typeof saveRoomSettings === "function") {
    saveRoomSettings(roomId, roomSettings);
  }
}

/**
 * Loads local theme settings.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {object|null} Theme settings.
 */
function loadLocalThemeSettings(roomId) {
  if (typeof loadThemeSettings === "function") {
    return loadThemeSettings(roomId);
  }

  return null;
}
