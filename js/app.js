// Main application state.
// This object keeps the current room configuration, item list and board state.
const appState = {
  room_config: null,
  items: [],
  board_state: null,
  session_state: null,
  session_timer_id: null,
  online_player_id: null,
  last_shoutout_id: null,
  online_started_at: null,
  online_status: "Online desligado"
};

// Main entry point.
// It starts the application after the HTML page is fully loaded.
document.addEventListener("DOMContentLoaded", initializeApp);

/**
 * Initializes the bingo application.
 */
async function initializeApp() {
  try {
    const roomConfig = await loadJsonFile("data/sample_room.json");
    const itemsData = await loadJsonFile(roomConfig.data_source.items_file);
    const onlineRoomConfig = await loadOnlineRoomConfigIfAvailable();

    const localRoomSettings =
      onlineRoomConfig && onlineRoomConfig.room_settings ?
        onlineRoomConfig.room_settings :
        loadRoomSettings(roomConfig.room_id);
    const localThemeSettings =
      onlineRoomConfig && onlineRoomConfig.theme_settings ?
        onlineRoomConfig.theme_settings :
        loadThemeSettings(roomConfig.room_id);

    applyRoomSettingsOverride(roomConfig, localRoomSettings);

    roomConfig.theme_settings = mergeThemeSettings(
      roomConfig.theme_settings,
      localThemeSettings
    );

    const playableItems = applyLocalConfiguredItems(
      itemsData.items,
      localRoomSettings
    );

    appState.room_config = roomConfig;
    appState.items = playableItems;

    applyRoomTheme(roomConfig.theme_settings);
    renderRoomInfo(roomConfig);
    validateRoomData(roomConfig, playableItems);
    preloadRoomAssets(
      playableItems,
      roomConfig.content_settings,
      roomConfig.audio_settings
    );
    bindInterfaceEvents();
    startGame(roomConfig, playableItems);
  } catch (error) {
    showFatalError(error);
  }
}

/**
 * Loads online room configuration when Firestore sync is enabled.
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
 * Applies local room setting overrides to a loaded room config.
 *
 * @param {object} roomConfig - Loaded room configuration.
 * @param {object|null} localRoomSettings - Locally saved room settings.
 */
function applyRoomSettingsOverride(roomConfig, localRoomSettings) {
  if (!localRoomSettings) {
    return;
  }

  if (typeof localRoomSettings.title === "string") {
    roomConfig.title = localRoomSettings.title;
  }

  if (typeof localRoomSettings.description === "string") {
    roomConfig.description = localRoomSettings.description;
  }

  if (localRoomSettings.content_mode === "text") {
    localRoomSettings.content_settings = Object.assign(
      {},
      localRoomSettings.content_settings,
      {
        allow_text: true,
        allow_numbers: false
      }
    );
  }

  if (localRoomSettings.content_mode === "number") {
    localRoomSettings.content_settings = Object.assign(
      {},
      localRoomSettings.content_settings,
      {
        allow_text: false,
        allow_numbers: true,
        allow_images: false
      }
    );
  }

  roomConfig.board = Object.assign(
    {},
    roomConfig.board,
    localRoomSettings.board || {}
  );

  roomConfig.content_settings = Object.assign(
    {},
    roomConfig.content_settings,
    localRoomSettings.content_settings || {}
  );

  roomConfig.victory_rules = Object.assign(
    {},
    roomConfig.victory_rules,
    localRoomSettings.victory_rules || {}
  );

  roomConfig.draw_settings = Object.assign(
    {},
    roomConfig.draw_settings,
    localRoomSettings.draw_settings || {}
  );
}

/**
 * Replaces locally configured item types when provided.
 *
 * @param {object[]} items - Loaded bingo items.
 * @param {object|null} localRoomSettings - Locally saved room settings.
 * @returns {object[]} Items used by the room.
 */
function applyLocalConfiguredItems(items, localRoomSettings) {
  if (!localRoomSettings) {
    return items;
  }

  let configuredItems;

  if (localRoomSettings.content_mode === "number") {
    configuredItems = applyLocalNumberItems(items, localRoomSettings);
  } else {
    configuredItems = applyLocalTextItems(items, localRoomSettings);
  }

  return applyLocalImageItems(configuredItems, localRoomSettings);
}

/**
 * Replaces text items with locally configured lines when provided.
 *
 * @param {object[]} items - Loaded bingo items.
 * @param {object} localRoomSettings - Locally saved room settings.
 * @returns {object[]} Items used by the room.
 */
function applyLocalTextItems(items, localRoomSettings) {
  if (typeof localRoomSettings.text_items_raw !== "string") {
    return items;
  }

  const textItems = parseTextItems(localRoomSettings.text_items_raw)
    .concat(parseConditionalTextItems(localRoomSettings));

  if (textItems.length === 0) {
    return items;
  }

  const nonTextItems = items.filter(function (item) {
    return item.type !== "text";
  });

  return textItems.concat(nonTextItems);
}

/**
 * Creates text items that are allowed for the current weekday.
 *
 * @param {object} localRoomSettings - Saved room settings.
 * @returns {object[]} Conditional text items.
 */
function parseConditionalTextItems(localRoomSettings) {
  if (typeof localRoomSettings.conditional_text_items_raw !== "string") {
    return [];
  }

  const allowedWeekdays = Array.isArray(localRoomSettings.conditional_text_weekdays) ?
    localRoomSettings.conditional_text_weekdays.map(Number) :
    [];

  if (!allowedWeekdays.includes(new Date().getDay())) {
    return [];
  }

  return parseTextItems(
    localRoomSettings.conditional_text_items_raw,
    "conditional_text"
  );
}

/**
 * Replaces number items with a locally configured range.
 *
 * @param {object[]} items - Loaded bingo items.
 * @param {object} localRoomSettings - Locally saved room settings.
 * @returns {object[]} Items used by the room.
 */
function applyLocalNumberItems(items, localRoomSettings) {
  const numberItems = createNumberItemsFromRange(localRoomSettings.number_range);

  if (numberItems.length === 0) {
    return items;
  }

  const nonNumberItems = items.filter(function (item) {
    return item.type !== "number" && item.type !== "text";
  });

  return numberItems.concat(nonNumberItems);
}

/**
 * Replaces image items with locally submitted images when provided.
 *
 * @param {object[]} items - Loaded bingo items.
 * @param {object} localRoomSettings - Locally saved room settings.
 * @returns {object[]} Items used by the room.
 */
function applyLocalImageItems(items, localRoomSettings) {
  if (
    !Array.isArray(localRoomSettings.image_items) ||
    localRoomSettings.image_items.length === 0
  ) {
    return items;
  }

  const nonImageItems = items.filter(function (item) {
    return item.type !== "image";
  });
  const imageItems = localRoomSettings.image_items.map(function (item, index) {
    return {
      id: item.id || `local_image_${String(index + 1).padStart(3, "0")}`,
      type: "image",
      label: item.label || `Imagem ${index + 1}`,
      image_url: item.image_url || null
    };
  });

  return nonImageItems.concat(imageItems);
}

/**
 * Creates number items from a numeric range.
 *
 * @param {object} numberRange - Number range settings.
 * @returns {object[]} Number bingo items.
 */
function createNumberItemsFromRange(numberRange) {
  if (!numberRange) {
    return [];
  }

  const start = Math.trunc(Number(numberRange.start));
  const end = Math.trunc(Number(numberRange.end));

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return [];
  }

  const firstNumber = Math.min(start, end);
  const lastNumber = Math.max(start, end);
  const numberItems = [];

  for (let value = firstNumber; value <= lastNumber; value++) {
    numberItems.push({
      id: `local_number_${value}`,
      type: "number",
      label: String(value),
      image_url: null
    });
  }

  return numberItems;
}

/**
 * Converts a line-based text item list into bingo item objects.
 *
 * @param {string} textItemsRaw - One text item per line.
 * @returns {object[]} Text bingo items.
 */
function parseTextItems(textItemsRaw, idPrefix) {
  const prefix = idPrefix || "local_text";

  return textItemsRaw
    .split(/\r?\n/)
    .map(function (label) {
      return label.trim();
    })
    .filter(function (label) {
      return label.length > 0;
    })
    .map(function (label, index) {
      return {
        id: `${prefix}_${String(index + 1).padStart(3, "0")}`,
        type: "text",
        label: label,
        image_url: null
      };
    });
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
 * Preloads visual assets used by the room without blocking gameplay.
 *
 * @param {object[]} items - Loaded bingo items.
 * @param {object} contentSettings - Room content selection settings.
 * @param {object} audioSettings - Room audio settings.
 */
function preloadRoomAssets(items, contentSettings, audioSettings) {
  preloadAllowedImages(items, contentSettings).then(function (summary) {
    if (summary.failed_images.length > 0) {
      console.warn("Some images failed to preload:", summary.failed_images);
    }

    console.log("Image preload summary:", summary);
  });

  preloadConfiguredSounds(audioSettings).then(function (summary) {
    if (summary.failed_sounds.length > 0) {
      console.warn("Some sounds failed to preload:", summary.failed_sounds);
    }

    console.log("Sound preload summary:", summary);
  });
}

/**
 * Connects HTML buttons to application actions.
 */
function bindInterfaceEvents() {
  const newBoardButton = document.getElementById("new_board_button");
  const clearHistoryButton = document.getElementById("clear_history_button");
  const readyButton = document.getElementById("ready_button");
  const simulateReadyButton = document.getElementById("simulate_ready_button");
  const notifyPermissionButton = document.getElementById("notify_permission_button");
  const victoryModal = document.getElementById("victory_modal");
  const victoryModalCloseButton = document.getElementById("victory_modal_close_button");

  newBoardButton.addEventListener("click", handleNewBoardRequest);
  clearHistoryButton.addEventListener("click", handleClearHistoryRequest);
  readyButton.addEventListener("click", handleReadyConfirmation);
  simulateReadyButton.addEventListener("click", handleSimulatedReadyConfirmation);
  notifyPermissionButton.addEventListener("click", requestBrowserNotifications);
  victoryModalCloseButton.addEventListener("click", closeVictoryModal);
  victoryModal.addEventListener("click", handleVictoryModalOverlayClick);
  document.addEventListener("keydown", handleDocumentKeydown);
}

/**
 * Handles the player request to generate a new board.
 */
function handleNewBoardRequest() {
  const shouldCreateNewBoard = confirm(
    "Gerar uma nova cartela apagará as marcações atuais. Deseja continuar?"
  );

  if (!shouldCreateNewBoard) {
    return;
  }

  appState.board_state = createBoard(
    appState.items,
    appState.room_config.board.rows,
    appState.room_config.board.columns,
    appState.room_config.board.free_center,
    appState.room_config.content_settings,
    getItemsSignature(appState.items)
  );

  saveBoardState(appState.room_config.room_id, appState.board_state);

  renderCurrentBoard();
  updateVictoryStatus(false);

  console.log("New board generated:", appState.board_state);
}

/**
 * Handles the player request to clear local victory history.
 */
function handleClearHistoryRequest() {
  const shouldClearHistory = confirm(
    "Limpar o historico local de vitorias desta sala?"
  );

  if (!shouldClearHistory) {
    return;
  }

  clearVictoryHistory(appState.room_config.room_id);
  renderVictoryHistory();
}

/**
 * Renders the room title and description.
 *
 * @param {object} roomConfig - Loaded room configuration.
 */
function renderRoomInfo(roomConfig) {
  const roomTitleElement = document.getElementById("room_title");
  const roomDescriptionElement = document.getElementById("room_description");

  roomTitleElement.textContent = roomConfig.title;
  roomDescriptionElement.textContent = roomConfig.description;
}

/**
 * Validates whether the room has enough data to create a board.
 *
 * @param {object} roomConfig - Loaded room configuration.
 * @param {object[]} items - Loaded bingo items.
 */
function validateRoomData(roomConfig, items) {
  const totalCells = roomConfig.board.rows * roomConfig.board.columns;
  const freeCenterIndex = getFreeCenterIndex(
    roomConfig.board.rows,
    roomConfig.board.columns,
    roomConfig.board.free_center
  );
  const requiredItems = freeCenterIndex === null ? totalCells : totalCells - 1;
  const playableItems = filterItemsByContentSettings(
    items,
    roomConfig.content_settings
  );
  const boardStatusElement = document.getElementById("board_status");

  if (playableItems.length < requiredItems) {
    throw new Error(
      `The room has ${playableItems.length} allowed items, but the board needs ${requiredItems} playable items.`
    );
  }

  if (playableItems.length === requiredItems) {
    boardStatusElement.textContent =
      `Cartela criada com ${totalCells} casas. A sala tem exatamente ${playableItems.length} itens permitidos.`;
    return;
  }

  if (playableItems.length < requiredItems * 2) {
    boardStatusElement.textContent =
      `Cartela criada com ${totalCells} casas. A sala tem ${playableItems.length} itens permitidos; funciona, mas ha pouca variacao.`;
    return;
  }

  boardStatusElement.textContent =
    `Cartela criada com ${totalCells} casas usando ${playableItems.length} itens permitidos.`;
}

/**
 * Starts the bingo game by loading a saved board or creating a new one.
 *
 * @param {object} roomConfig - Loaded room configuration.
 * @param {object[]} items - Loaded bingo items.
 */
function startGame(roomConfig, items) {
  const savedBoardState = loadBoardState(roomConfig.room_id);

  if (savedBoardState && isSavedBoardCompatible(savedBoardState, roomConfig, items)) {
    appState.board_state = rehydrateBoardStateItems(savedBoardState, items);
  } else {
    appState.board_state = createBoard(
      items,
      roomConfig.board.rows,
      roomConfig.board.columns,
      roomConfig.board.free_center,
      roomConfig.content_settings,
      getItemsSignature(items)
    );

    saveBoardState(roomConfig.room_id, appState.board_state);
  }

  renderCurrentBoard();
  updateVictoryStatus(false);
  renderVictoryHistory();
  startRoomSession(roomConfig);
}

/**
 * Starts the local room session simulation.
 *
 * @param {object} roomConfig - Loaded room configuration.
 */
function startRoomSession(roomConfig) {
  appState.session_state = loadRoomSession(roomConfig.room_id) ||
    createInitialRoomSession();

  normalizeRoomSessionState();
  appState.online_player_id = getCurrentOnlinePlayerId();
  renderRoomSession();
  resumeSessionTimerIfNeeded();
  initializeOnlineRoomSession(roomConfig);
}

/**
 * Creates the initial local room session state.
 *
 * @returns {object} Room session state.
 */
function createInitialRoomSession() {
  return {
    round: 1,
    ready_count: 0,
    ready_players: {},
    player_ready: false,
    local_last_count: 0,
    latest_penalty: null,
    drawn_numbers: [],
    current_draw: null,
    timer_started_at: null,
    timer_ends_at: null
  };
}

/**
 * Keeps older saved local sessions compatible with the current session shape.
 */
function normalizeRoomSessionState() {
  if (!Array.isArray(appState.session_state.drawn_numbers)) {
    appState.session_state.drawn_numbers = [];
  }

  if (
    !appState.session_state.ready_players ||
    typeof appState.session_state.ready_players !== "object"
  ) {
    appState.session_state.ready_players = {};
  }

  if (typeof appState.session_state.current_draw === "undefined") {
    appState.session_state.current_draw = null;
  }

  if (typeof appState.session_state.local_last_count !== "number") {
    appState.session_state.local_last_count = 0;
  }

  if (isNumberDrawMode() && appState.session_state.current_draw === null) {
    drawNextNumber();
    saveRoomSession(appState.room_config.room_id, appState.session_state);
  }
}

/**
 * Starts online synchronization for the room when configured.
 *
 * @param {object} roomConfig - Loaded room config.
 */
function initializeOnlineRoomSession(roomConfig) {
  if (!window.BingoOnline) {
    setOnlineStatus("Online desligado");
    return;
  }

  appState.online_started_at = Date.now();

  window.BingoOnline.startOnlineRoom({
    room_id: roomConfig.room_id,
    initial_session: appState.session_state,
    onRemoteSession: handleRemoteRoomSession,
    onShoutout: handleOnlineShoutout,
    onStatus: setOnlineStatus
  });
}

/**
 * Shows an online shoutout sent by the room organizer.
 *
 * @param {object} shoutout - Online shoutout payload.
 */
function handleOnlineShoutout(shoutout) {
  if (!shoutout || !shoutout.id || shoutout.id === appState.last_shoutout_id) {
    return;
  }

  if (
    shoutout.sent_at &&
    appState.online_started_at &&
    new Date(shoutout.sent_at).getTime() < appState.online_started_at
  ) {
    appState.last_shoutout_id = shoutout.id;
    return;
  }

  appState.last_shoutout_id = shoutout.id;
  setOnlineStatus(`Aviso: ${shoutout.message}`);
  sendShoutoutNotification(shoutout.message);
}

/**
 * Applies a remote room session snapshot.
 *
 * @param {object} remoteSession - Remote session state.
 */
function handleRemoteRoomSession(remoteSession) {
  if (!remoteSession) {
    return;
  }

  appState.session_state = Object.assign({}, createInitialRoomSession(), remoteSession);
  normalizeRoomSessionState();
  appState.session_state.player_ready =
    Boolean(appState.session_state.ready_players[appState.online_player_id]);
  appState.session_state.ready_count = countReadyPlayers(appState.session_state);
  saveRoomSession(appState.room_config.room_id, appState.session_state);
  renderRoomSession();
  resumeSessionTimerIfNeeded();
}

/**
 * Updates the online status shown in the game.
 *
 * @param {string} statusText - Status text.
 */
function setOnlineStatus(statusText) {
  appState.online_status = statusText;
  renderRoomSession();
}

/**
 * Checks if a saved board matches the current room board settings.
 *
 * @param {object} boardState - Saved board state.
 * @param {object} roomConfig - Loaded room configuration.
 * @param {object[]} items - Items available for the room.
 * @returns {boolean} True when the board can be reused.
 */
function isSavedBoardCompatible(boardState, roomConfig, items) {
  const totalCells = roomConfig.board.rows * roomConfig.board.columns;
  const expectedFreeCenterIndex = getFreeCenterIndex(
    roomConfig.board.rows,
    roomConfig.board.columns,
    roomConfig.board.free_center
  );
  const expectedBalanceTypes = Boolean(
    roomConfig.content_settings &&
    roomConfig.content_settings.mixed_content &&
    roomConfig.content_settings.balance_types
  );
  const expectedContentFilters = getContentFilterState(roomConfig.content_settings);
  const expectedNumberLayout = isNumberContentMode(roomConfig.content_settings) ?
    "column_ranges" :
    null;

  return (
    boardState.items.length === totalCells &&
    boardState.marked_cells.length === totalCells &&
    boardState.free_cell_index === expectedFreeCenterIndex &&
    boardState.balance_types === expectedBalanceTypes &&
    boardState.number_layout === expectedNumberLayout &&
    areContentFiltersEqual(boardState.content_filters, expectedContentFilters) &&
    boardState.item_signature === getItemsSignature(items)
  );
}

/**
 * Creates a stable signature for the item set currently available to the room.
 *
 * @param {object[]} items - Items available for the room.
 * @returns {string} Item signature.
 */
function getItemsSignature(items) {
  return items.map(function (item) {
    return `${item.id}:${item.type}:${item.label}:${getImageSignature(item.image_url)}`;
  }).join("|");
}

/**
 * Reconnects compact saved board items with their full current item data.
 *
 * @param {object} boardState - Saved board state.
 * @param {object[]} items - Current full item list.
 * @returns {object} Board state ready to render.
 */
function rehydrateBoardStateItems(boardState, items) {
  const itemsById = items.reduce(function (mappedItems, item) {
    mappedItems[item.id] = item;

    return mappedItems;
  }, {});

  return Object.assign({}, boardState, {
    items: boardState.items.map(function (savedItem) {
      return Object.assign({}, savedItem, itemsById[savedItem.id] || {});
    })
  });
}

/**
 * Creates a short image signature without storing large data URLs in the board.
 *
 * @param {string|null} imageUrl - Image URL or local data URL.
 * @returns {string} Short image signature.
 */
function getImageSignature(imageUrl) {
  if (!imageUrl) {
    return "";
  }

  if (imageUrl.indexOf("data:") !== 0) {
    return imageUrl;
  }

  return `data:${imageUrl.length}:${createStringHash(imageUrl)}`;
}

/**
 * Creates a small deterministic hash for local signatures.
 *
 * @param {string} value - String to hash.
 * @returns {string} Hash string.
 */
function createStringHash(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return String(hash);
}

/**
 * Compares the filters used by a saved board with the current room filters.
 *
 * @param {object} savedFilters - Filter state stored in the board.
 * @param {object} expectedFilters - Current room filter state.
 * @returns {boolean} True when filters match.
 */
function areContentFiltersEqual(savedFilters, expectedFilters) {
  if (!savedFilters) {
    return false;
  }

  return (
    savedFilters.allow_text === expectedFilters.allow_text &&
    savedFilters.allow_numbers === expectedFilters.allow_numbers &&
    savedFilters.allow_images === expectedFilters.allow_images
  );
}

/**
 * Handles the local player confirming the current board review.
 */
function handleReadyConfirmation() {
  const drawSettings = appState.room_config.draw_settings || {};

  if (!drawSettings.enabled) {
    return;
  }

  if (appState.session_state.player_ready) {
    return;
  }

  appState.session_state.player_ready = true;
  appState.session_state.ready_players[appState.online_player_id] = true;
  appState.session_state.ready_count = countReadyPlayers(appState.session_state);

  if (appState.session_state.ready_count >= getReadyTarget(drawSettings)) {
    recordLocalLastConfirmation();
  }

  persistRoomSession();
  renderRoomSession();

  if (shouldStartSessionTimer()) {
    startSessionTimer();
  }
}

/**
 * Simulates another player confirming the board in the offline prototype.
 */
function handleSimulatedReadyConfirmation() {
  const drawSettings = appState.room_config.draw_settings || {};

  if (!drawSettings.enabled || isSessionTimerActive()) {
    return;
  }

  const simulatedPlayerId = `simulated_${appState.session_state.ready_count + 1}`;

  appState.session_state.ready_players[simulatedPlayerId] = true;
  appState.session_state.ready_count = Math.min(
    getReadyTarget(drawSettings),
    countReadyPlayers(appState.session_state)
  );
  persistRoomSession();
  renderRoomSession();

  if (shouldStartSessionTimer()) {
    startSessionTimer();
  }
}

/**
 * Tracks when the local player is the last one to confirm.
 */
function recordLocalLastConfirmation() {
  const drawSettings = appState.room_config.draw_settings || {};
  const penaltyThreshold = getPenaltyLastCount(drawSettings);
  const penaltyItems = getPenaltyItems(drawSettings);

  if (penaltyItems.length === 0) {
    return;
  }

  appState.session_state.local_last_count += 1;

  if (appState.session_state.local_last_count < penaltyThreshold) {
    return;
  }

  appState.session_state.latest_penalty =
    penaltyItems[Math.floor(Math.random() * penaltyItems.length)];
  appState.session_state.local_last_count = 0;
  alert(`Prenda sorteada: ${appState.session_state.latest_penalty}`);
}

/**
 * Checks if the configured confirmation target has been reached.
 *
 * @returns {boolean} True when the timer should start.
 */
function shouldStartSessionTimer() {
  const drawSettings = appState.room_config.draw_settings || {};
  const readyTarget = getReadyTarget(drawSettings);

  if (!drawSettings.requires_all_players_ready) {
    return appState.session_state.ready_count >= 1;
  }

  return appState.session_state.ready_count >= readyTarget;
}

/**
 * Starts the countdown to the next local round.
 */
function startSessionTimer() {
  const now = Date.now();
  const durationSeconds = getTimerSeconds(appState.room_config.draw_settings);

  appState.session_state.timer_started_at = now;
  appState.session_state.timer_ends_at = now + durationSeconds * 1000;
  appState.session_state.current_timer_seconds = durationSeconds;
  persistRoomSession();
  resumeSessionTimerIfNeeded();
  renderRoomSession();
}

/**
 * Restores an active countdown after reload.
 */
function resumeSessionTimerIfNeeded() {
  clearSessionTimer();

  if (
    appState.session_state &&
    appState.session_state.timer_ends_at &&
    Date.now() >= appState.session_state.timer_ends_at
  ) {
    completeSessionTimer();
    return;
  }

  if (!isSessionTimerActive()) {
    renderRoomSession();
    return;
  }

  appState.session_timer_id = window.setInterval(function () {
    if (!isSessionTimerActive()) {
      completeSessionTimer();
      return;
    }

    renderRoomSession();
  }, 1000);

  renderRoomSession();
}

/**
 * Clears the active countdown interval.
 */
function clearSessionTimer() {
  if (appState.session_timer_id) {
    window.clearInterval(appState.session_timer_id);
    appState.session_timer_id = null;
  }
}

/**
 * Checks whether a local room countdown is still active.
 *
 * @returns {boolean} True when the countdown is active.
 */
function isSessionTimerActive() {
  return Boolean(
    appState.session_state &&
    appState.session_state.timer_ends_at &&
    Date.now() < appState.session_state.timer_ends_at
  );
}

/**
 * Completes the local round timer and opens the next round.
 */
function completeSessionTimer() {
  clearSessionTimer();

  appState.session_state.round += 1;
  appState.session_state.ready_count = 0;
  appState.session_state.ready_players = {};
  appState.session_state.player_ready = false;
  appState.session_state.timer_started_at = null;
  appState.session_state.timer_ends_at = null;
  appState.session_state.current_timer_seconds = null;
  drawNextNumber();
  persistRoomSession();
  renderRoomSession();
  sendRoundNotification();
}

/**
 * Requests browser notification permission.
 */
function requestBrowserNotifications() {
  if (!("Notification" in window)) {
    alert("Este navegador nao suporta notificacoes.");
    return;
  }

  Notification.requestPermission().then(function () {
    renderRoomSession();
  });
}

/**
 * Sends a browser notification when the next round is ready.
 */
function sendRoundNotification() {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  if (isNotificationQuietTime(appState.room_config.draw_settings)) {
    return;
  }

  new Notification(appState.room_config.title, {
    body: "Proxima rodada liberada. Entre, confira e marque sua cartela."
  });
}

/**
 * Sends or displays a manual room shoutout.
 *
 * @param {string} message - Shoutout message.
 */
function sendShoutoutNotification(message) {
  if (
    "Notification" in window &&
    Notification.permission === "granted" &&
    !isNotificationQuietTime(appState.room_config.draw_settings)
  ) {
    new Notification(appState.room_config.title, {
      body: message
    });
    return;
  }

  window.alert(message);
}

/**
 * Renders the local room session panel.
 */
function renderRoomSession() {
  const sessionPanel = document.getElementById("room_session_panel");
  const roundStatus = document.getElementById("session_round_status");
  const drawStatus = document.getElementById("session_draw_status");
  const readyStatus = document.getElementById("session_ready_status");
  const timerStatus = document.getElementById("session_timer_status");
  const onlineStatus = document.getElementById("session_online_status");
  const readyButton = document.getElementById("ready_button");
  const simulateReadyButton = document.getElementById("simulate_ready_button");
  const notifyPermissionButton = document.getElementById("notify_permission_button");
  const drawSettings = appState.room_config.draw_settings || {};

  sessionPanel.hidden = !isNumberDrawMode();

  if (!isNumberDrawMode() || !appState.session_state) {
    return;
  }

  roundStatus.textContent = `Rodada ${appState.session_state.round}`;
  drawStatus.textContent = getDrawStatusText();
  readyStatus.textContent =
    getReadyStatusText(drawSettings);
  timerStatus.textContent = getSessionTimerText();
  onlineStatus.textContent = appState.online_status;
  readyButton.disabled = appState.session_state.player_ready || isSessionTimerActive();
  readyButton.textContent = appState.session_state.player_ready ?
    "Cartela conferida" :
    "Conferi minha cartela";
  simulateReadyButton.disabled =
    isOnlineSyncEnabled() ||
    isSessionTimerActive() ||
    appState.session_state.ready_count >= getReadyTarget(drawSettings);
  simulateReadyButton.hidden = isOnlineSyncEnabled();

  notifyPermissionButton.hidden =
    !("Notification" in window) || Notification.permission === "granted";
}

/**
 * Persists the room session locally and online when enabled.
 */
function persistRoomSession() {
  saveRoomSession(appState.room_config.room_id, appState.session_state);

  if (window.BingoOnline) {
    window.BingoOnline.saveOnlineRoomSession(appState.session_state);
  }
}

/**
 * Counts ready players in a session.
 *
 * @param {object} sessionState - Session state.
 * @returns {number} Ready player count.
 */
function countReadyPlayers(sessionState) {
  return Object.keys(sessionState.ready_players || {}).filter(function (playerId) {
    return Boolean(sessionState.ready_players[playerId]);
  }).length;
}

/**
 * Gets a stable online player id.
 *
 * @returns {string} Player id.
 */
function getCurrentOnlinePlayerId() {
  if (window.BingoOnline) {
    return window.BingoOnline.getOnlinePlayerId();
  }

  return "local_player";
}

/**
 * Checks if online sync is currently enabled.
 *
 * @returns {boolean} True when online sync is enabled.
 */
function isOnlineSyncEnabled() {
  return Boolean(window.BingoOnline && window.BingoOnline.isOnlineSyncEnabled());
}

/**
 * Gets the current timer text for the session panel.
 *
 * @returns {string} Timer text.
 */
function getSessionTimerText() {
  if (!appState.session_state.timer_ends_at) {
    const quietSuffix = isNotificationQuietTime(appState.room_config.draw_settings) ?
      " Alertas bloqueados agora." :
      "";

    return `Timer aguardando conferencias.${quietSuffix}`;
  }

  const remainingSeconds = Math.max(
    0,
    Math.ceil((appState.session_state.timer_ends_at - Date.now()) / 1000)
  );

  return `Proxima rodada em ${remainingSeconds}s`;
}

/**
 * Builds the ready status text including local penalty state.
 *
 * @param {object} drawSettings - Room draw settings.
 * @returns {string} Ready status text.
 */
function getReadyStatusText(drawSettings) {
  const penaltyItems = getPenaltyItems(drawSettings);
  const penaltyText = penaltyItems.length > 0 ?
    ` Ultimos atrasos: ${appState.session_state.local_last_count}/${getPenaltyLastCount(drawSettings)}.` :
    "";

  return `Conferencias: ${appState.session_state.ready_count}/${getReadyTarget(drawSettings)}.${penaltyText}`;
}

/**
 * Builds the current draw status text.
 *
 * @returns {string} Draw status text.
 */
function getDrawStatusText() {
  if (appState.session_state.current_draw === null) {
    return "Numero sorteado: fim dos numeros";
  }

  return `Numero sorteado: ${appState.session_state.current_draw}`;
}

/**
 * Checks if the current room is in numeric draw mode.
 *
 * @returns {boolean} True when draw controls should appear.
 */
function isNumberDrawMode() {
  return Boolean(
    appState.room_config &&
    appState.room_config.draw_settings &&
    appState.room_config.draw_settings.enabled &&
    isNumberContentMode(appState.room_config.content_settings)
  );
}

/**
 * Checks if content settings represent a numeric-only bingo room.
 *
 * @param {object} contentSettings - Room content settings.
 * @returns {boolean} True when only numbers are enabled.
 */
function isNumberContentMode(contentSettings) {
  return Boolean(
    contentSettings &&
    contentSettings.allow_numbers &&
    !contentSettings.allow_text &&
    !contentSettings.allow_images
  );
}

/**
 * Draws the next not-yet-drawn room number.
 */
function drawNextNumber() {
  const availableNumbers = getAvailableDrawNumbers();

  if (availableNumbers.length === 0) {
    appState.session_state.current_draw = null;
    return;
  }

  const drawnNumber = availableNumbers[
    Math.floor(Math.random() * availableNumbers.length)
  ];

  appState.session_state.current_draw = drawnNumber;
  appState.session_state.drawn_numbers.push(drawnNumber);
}

/**
 * Gets number labels that have not been drawn yet.
 *
 * @returns {number[]} Available numbers.
 */
function getAvailableDrawNumbers() {
  const alreadyDrawn = new Set(appState.session_state.drawn_numbers || []);

  return appState.items
    .filter(function (item) {
      return item.type === "number";
    })
    .map(function (item) {
      return Number(item.label);
    })
    .filter(function (numberValue) {
      return Number.isFinite(numberValue) && !alreadyDrawn.has(numberValue);
    });
}

/**
 * Gets the configured ready target.
 *
 * @param {object} drawSettings - Room draw settings.
 * @returns {number} Ready target.
 */
function getReadyTarget(drawSettings) {
  const readyTarget = Number(drawSettings.ready_target);

  if (!Number.isFinite(readyTarget) || readyTarget < 1) {
    return 1;
  }

  return Math.trunc(readyTarget);
}

/**
 * Gets the configured timer duration.
 *
 * @param {object} drawSettings - Room draw settings.
 * @returns {number} Timer duration in seconds.
 */
function getTimerSeconds(drawSettings) {
  if (drawSettings && drawSettings.timer_mode === "random") {
    const minSeconds = Number(drawSettings.random_min_seconds);
    const maxSeconds = Number(drawSettings.random_max_seconds);
    const minimum = Number.isFinite(minSeconds) ? Math.max(1, Math.trunc(minSeconds)) : 15;
    const maximum = Number.isFinite(maxSeconds) ? Math.max(minimum, Math.trunc(maxSeconds)) : 90;

    return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
  }

  const timerSeconds = Number(drawSettings && drawSettings.interval_seconds);

  if (!Number.isFinite(timerSeconds) || timerSeconds < 1) {
    return 30;
  }

  return Math.trunc(timerSeconds);
}

/**
 * Gets the configured penalty threshold.
 *
 * @param {object} drawSettings - Room draw settings.
 * @returns {number} Penalty threshold.
 */
function getPenaltyLastCount(drawSettings) {
  const penaltyLastCount = Number(drawSettings && drawSettings.penalty_last_count);

  if (!Number.isFinite(penaltyLastCount) || penaltyLastCount < 1) {
    return 3;
  }

  return Math.trunc(penaltyLastCount);
}

/**
 * Gets configured penalty options.
 *
 * @param {object} drawSettings - Room draw settings.
 * @returns {string[]} Penalty options.
 */
function getPenaltyItems(drawSettings) {
  if (!drawSettings || !Array.isArray(drawSettings.penalty_items)) {
    return [];
  }

  return drawSettings.penalty_items.filter(function (item) {
    return typeof item === "string" && item.trim().length > 0;
  });
}

/**
 * Checks if notifications are blocked by the configured quiet period.
 *
 * @param {object} drawSettings - Room draw settings.
 * @returns {boolean} True when notifications should be muted.
 */
function isNotificationQuietTime(drawSettings) {
  if (!drawSettings || !drawSettings.quiet_hours_enabled) {
    return false;
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = getMinutesFromTime(drawSettings.quiet_start || "22:00");
  const endMinutes = getMinutesFromTime(drawSettings.quiet_end || "08:00");

  if (startMinutes === endMinutes) {
    return false;
  }

  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }

  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

/**
 * Converts HH:mm to minutes from midnight.
 *
 * @param {string} timeValue - Time value.
 * @returns {number} Minutes from midnight.
 */
function getMinutesFromTime(timeValue) {
  const parts = String(timeValue).split(":");
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

/**
 * Renders the current board using the application state.
 */
function renderCurrentBoard() {
  const boardElement = document.getElementById("bingo_board");

  renderBoard(
    boardElement,
    appState.board_state,
    appState.room_config,
    handleCellToggle
  );
}

/**
 * Handles a player clicking on a board cell.
 *
 * @param {number} cellIndex - Index of the clicked board cell.
 */
function handleCellToggle(cellIndex) {
  toggleCell(appState.board_state, cellIndex);

  saveBoardState(appState.room_config.room_id, appState.board_state);

  console.log("Cell toggled:", cellIndex);
  console.log("Saved board state:", appState.board_state);
  console.log(
    "LocalStorage value:",
    localStorage.getItem(`bingo_room_${appState.room_config.room_id}`)
  );

  renderCurrentBoard();
  updateVictoryStatus(true);
}

/**
 * Checks victory rules and updates the interface.
 *
 * @param {boolean} shouldRecordVictory - Whether this check can write history.
 */
function updateVictoryStatus(shouldRecordVictory) {
  const victoryStatusElement = document.getElementById("victory_status");
  const roomConfig = appState.room_config;
  const boardState = appState.board_state;

  const result = checkVictory(
    boardState.marked_cells,
    roomConfig.board.rows,
    roomConfig.board.columns,
    roomConfig.victory_rules
  );

  victoryStatusElement.textContent = result.message;

  if (result.has_victory) {
    victoryStatusElement.classList.add("is_victory");
    recordVictoryIfNeeded(result, shouldRecordVictory);
  } else {
    victoryStatusElement.classList.remove("is_victory");
  }
}

/**
 * Saves a local victory record once for the current board.
 *
 * @param {object} victoryResult - Result returned by the victory rules.
 * @param {boolean} shouldRecordVictory - Whether this check can write history.
 */
function recordVictoryIfNeeded(victoryResult, shouldRecordVictory) {
  const roomConfig = appState.room_config;
  const boardState = appState.board_state;

  if (!shouldRecordVictory || boardState.victory_recorded) {
    return;
  }

  const victoryRecord = {
    won_at: new Date().toISOString(),
    room: {
      id: roomConfig.room_id,
      title: roomConfig.title
    },
    victory_type: victoryResult.victory_type,
    marked_cells_count: countPlayerMarkedCells(boardState)
  };

  saveVictoryRecord(roomConfig.room_id, victoryRecord);

  boardState.victory_recorded = true;
  saveBoardState(roomConfig.room_id, boardState);
  renderVictoryHistory();
  openVictoryModal(victoryRecord);

  console.log("Victory saved:", victoryRecord);
}

/**
 * Opens the victory popup with the latest victory summary.
 *
 * @param {object} victoryRecord - Saved victory data.
 */
function openVictoryModal(victoryRecord) {
  const victoryModal = document.getElementById("victory_modal");
  const victoryModalSummary = document.getElementById("victory_modal_summary");
  const victoryModalCloseButton = document.getElementById("victory_modal_close_button");

  victoryModalSummary.textContent =
    `${formatVictoryType(victoryRecord.victory_type)} com ${victoryRecord.marked_cells_count} casas marcadas.`;

  victoryModal.hidden = false;
  victoryModalCloseButton.focus();
  playConfiguredVictorySound();
}

/**
 * Plays the room victory sound when configured.
 */
function playConfiguredVictorySound() {
  playVictorySound(appState.room_config.audio_settings).catch(function (error) {
    console.warn("Could not play victory sound:", error);
  });
}

/**
 * Closes the victory popup.
 */
function closeVictoryModal() {
  const victoryModal = document.getElementById("victory_modal");

  victoryModal.hidden = true;
}

/**
 * Closes the victory popup when the overlay itself is clicked.
 *
 * @param {MouseEvent} event - Click event.
 */
function handleVictoryModalOverlayClick(event) {
  if (event.target.id === "victory_modal") {
    closeVictoryModal();
  }
}

/**
 * Handles keyboard shortcuts used by the page.
 *
 * @param {KeyboardEvent} event - Keyboard event.
 */
function handleDocumentKeydown(event) {
  const victoryModal = document.getElementById("victory_modal");

  if (event.key === "Escape" && !victoryModal.hidden) {
    closeVictoryModal();
  }
}

/**
 * Renders the saved local victory history.
 */
function renderVictoryHistory() {
  const victoryHistoryElement = document.getElementById("victory_history");
  const roomConfig = appState.room_config;
  const victoryHistory = loadVictoryHistory(roomConfig.room_id);

  victoryHistoryElement.innerHTML = "";

  if (victoryHistory.length === 0) {
    const emptyMessage = document.createElement("p");

    emptyMessage.className = "history_empty";
    emptyMessage.textContent = "Nenhuma vit\u00f3ria registrada nesta sala ainda.";

    victoryHistoryElement.appendChild(emptyMessage);
    return;
  }

  const historyList = document.createElement("ul");
  const recentHistory = victoryHistory.slice().reverse();

  historyList.className = "history_list";

  recentHistory.forEach(function (victoryRecord) {
    historyList.appendChild(createVictoryHistoryItem(victoryRecord));
  });

  victoryHistoryElement.appendChild(historyList);
}

/**
 * Creates one visual entry for the victory history.
 *
 * @param {object} victoryRecord - Saved victory data.
 * @returns {HTMLLIElement} Victory history item.
 */
function createVictoryHistoryItem(victoryRecord) {
  const historyItem = document.createElement("li");
  const titleElement = document.createElement("p");
  const roomElement = document.createElement("p");
  const markedCellsElement = document.createElement("p");

  historyItem.className = "history_item";
  titleElement.className = "history_item_title";
  roomElement.className = "history_item_meta";
  markedCellsElement.className = "history_item_meta";

  titleElement.textContent =
    `${formatVictoryType(victoryRecord.victory_type)} - ${formatVictoryDate(victoryRecord.won_at)}`;

  roomElement.textContent = `Sala: ${victoryRecord.room.title}`;
  markedCellsElement.textContent =
    `Casas marcadas: ${victoryRecord.marked_cells_count}`;

  historyItem.appendChild(titleElement);
  historyItem.appendChild(roomElement);
  historyItem.appendChild(markedCellsElement);

  return historyItem;
}

/**
 * Converts an internal victory type into a readable label.
 *
 * @param {string} victoryType - Internal victory type.
 * @returns {string} Human-readable victory type.
 */
function formatVictoryType(victoryType) {
  const victoryTypeLabels = {
    line: "Vit\u00f3ria por linha",
    column: "Vit\u00f3ria por coluna",
    diagonal: "Vit\u00f3ria por diagonal",
    full_board: "Vit\u00f3ria por cartela cheia"
  };

  return victoryTypeLabels[victoryType] || "Vit\u00f3ria";
}

/**
 * Formats an ISO date string for the current browser locale.
 *
 * @param {string} dateValue - ISO date string.
 * @returns {string} Formatted date.
 */
function formatVictoryDate(dateValue) {
  const victoryDate = new Date(dateValue);

  return victoryDate.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

/**
 * Counts how many board cells were marked by the player.
 *
 * @param {object} boardState - Current board state.
 * @returns {number} Total player-marked cells.
 */
function countPlayerMarkedCells(boardState) {
  return boardState.marked_cells.filter(function (isMarked, cellIndex) {
    return isMarked && boardState.free_cell_index !== cellIndex;
  }).length;
}

/**
 * Shows a fatal error message in the interface.
 *
 * @param {Error} error - Error object thrown during app initialization.
 */
function showFatalError(error) {
  const boardStatusElement = document.getElementById("board_status");
  const victoryStatusElement = document.getElementById("victory_status");

  boardStatusElement.textContent = "Erro ao carregar o jogo.";
  victoryStatusElement.textContent = error.message;

  console.error(error);
}
