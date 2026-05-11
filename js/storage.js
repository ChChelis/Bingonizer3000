/**
 * Builds a unique local storage key for a room.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {string} Local storage key.
 */
function buildStorageKey(roomId) {
  return `bingo_room_${roomId}`;
}

/**
 * Builds a unique local storage key for a room victory history.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {string} Local storage key.
 */
function buildVictoryHistoryKey(roomId) {
  return `bingo_room_${roomId}_victory_history`;
}

/**
 * Builds a local storage key for room theme overrides.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {string} Local storage key.
 */
function buildThemeSettingsKey(roomId) {
  return `bingo_room_${roomId}_theme_settings`;
}

/**
 * Builds a local storage key for room setting overrides.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {string} Local storage key.
 */
function buildRoomSettingsKey(roomId) {
  return `bingo_room_${roomId}_room_settings`;
}

/**
 * Builds a local storage key for local room session simulation.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {string} Local storage key.
 */
function buildRoomSessionKey(roomId) {
  return `bingo_room_${roomId}_session`;
}

/**
 * Saves the current board state in the browser local storage.
 *
 * @param {string} roomId - Unique room identifier.
 * @param {object} boardState - Current board state.
 */
function saveBoardState(roomId, boardState) {
  const storageKey = buildStorageKey(roomId);
  const serializedBoardState = JSON.stringify(createPersistedBoardState(boardState));

  localStorage.setItem(storageKey, serializedBoardState);
}

/**
 * Creates a compact board state for localStorage.
 * Image data is kept in room settings and reconnected when the game loads.
 *
 * @param {object} boardState - Current board state.
 * @returns {object} Compact board state.
 */
function createPersistedBoardState(boardState) {
  return Object.assign({}, boardState, {
    items: boardState.items.map(function (item) {
      return {
        id: item.id,
        type: item.type,
        label: item.label,
        image_url: item.type === "image" ? null : item.image_url
      };
    })
  });
}

/**
 * Loads a saved board state from local storage.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {object|null} Saved board state or null.
 */
function loadBoardState(roomId) {
  const storageKey = buildStorageKey(roomId);
  const serializedBoardState = localStorage.getItem(storageKey);

  if (!serializedBoardState) {
    return null;
  }

  return JSON.parse(serializedBoardState);
}

/**
 * Removes a saved board state from local storage.
 *
 * @param {string} roomId - Unique room identifier.
 */
function clearBoardState(roomId) {
  const storageKey = buildStorageKey(roomId);

  localStorage.removeItem(storageKey);
}

/**
 * Loads the local victory history for a room.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {object[]} Saved victory records.
 */
function loadVictoryHistory(roomId) {
  const storageKey = buildVictoryHistoryKey(roomId);
  const serializedVictoryHistory = localStorage.getItem(storageKey);

  if (!serializedVictoryHistory) {
    return [];
  }

  return JSON.parse(serializedVictoryHistory);
}

/**
 * Saves a victory record in the local history for a room.
 *
 * @param {string} roomId - Unique room identifier.
 * @param {object} victoryRecord - Victory data to persist.
 */
function saveVictoryRecord(roomId, victoryRecord) {
  const storageKey = buildVictoryHistoryKey(roomId);
  const victoryHistory = loadVictoryHistory(roomId);

  victoryHistory.push(victoryRecord);

  localStorage.setItem(storageKey, JSON.stringify(victoryHistory));
}

/**
 * Clears the local victory history for a room.
 *
 * @param {string} roomId - Unique room identifier.
 */
function clearVictoryHistory(roomId) {
  const storageKey = buildVictoryHistoryKey(roomId);

  localStorage.removeItem(storageKey);
}

/**
 * Saves local theme overrides for a room.
 *
 * @param {string} roomId - Unique room identifier.
 * @param {object} themeSettings - Theme settings to persist.
 */
function saveThemeSettings(roomId, themeSettings) {
  const storageKey = buildThemeSettingsKey(roomId);

  localStorage.setItem(storageKey, JSON.stringify(themeSettings));
}

/**
 * Loads local theme overrides for a room.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {object|null} Saved theme settings or null.
 */
function loadThemeSettings(roomId) {
  const storageKey = buildThemeSettingsKey(roomId);
  const serializedThemeSettings = localStorage.getItem(storageKey);

  if (!serializedThemeSettings) {
    return null;
  }

  return JSON.parse(serializedThemeSettings);
}

/**
 * Clears local theme overrides for a room.
 *
 * @param {string} roomId - Unique room identifier.
 */
function clearThemeSettings(roomId) {
  const storageKey = buildThemeSettingsKey(roomId);

  localStorage.removeItem(storageKey);
}

/**
 * Saves local room setting overrides.
 *
 * @param {string} roomId - Unique room identifier.
 * @param {object} roomSettings - Room settings to persist.
 */
function saveRoomSettings(roomId, roomSettings) {
  const storageKey = buildRoomSettingsKey(roomId);

  localStorage.setItem(storageKey, JSON.stringify(roomSettings));
}

/**
 * Loads local room setting overrides.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {object|null} Saved room settings or null.
 */
function loadRoomSettings(roomId) {
  const storageKey = buildRoomSettingsKey(roomId);
  const serializedRoomSettings = localStorage.getItem(storageKey);

  if (!serializedRoomSettings) {
    return null;
  }

  return JSON.parse(serializedRoomSettings);
}

/**
 * Clears local room setting overrides.
 *
 * @param {string} roomId - Unique room identifier.
 */
function clearRoomSettings(roomId) {
  const storageKey = buildRoomSettingsKey(roomId);

  localStorage.removeItem(storageKey);
}

/**
 * Saves the local room session state.
 *
 * @param {string} roomId - Unique room identifier.
 * @param {object} sessionState - Local session state.
 */
function saveRoomSession(roomId, sessionState) {
  const storageKey = buildRoomSessionKey(roomId);

  localStorage.setItem(storageKey, JSON.stringify(sessionState));
}

/**
 * Loads the local room session state.
 *
 * @param {string} roomId - Unique room identifier.
 * @returns {object|null} Local session state or null.
 */
function loadRoomSession(roomId) {
  const storageKey = buildRoomSessionKey(roomId);
  const serializedSession = localStorage.getItem(storageKey);

  if (!serializedSession) {
    return null;
  }

  return JSON.parse(serializedSession);
}
