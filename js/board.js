/**
 * Creates a playable bingo board from a list of available items.
 *
 * @param {object[]} items - Full list of available bingo items.
 * @param {number} rows - Number of board rows.
 * @param {number} columns - Number of board columns.
 * @param {boolean} freeCenter - Whether the board should include a free center cell.
 * @param {object} contentSettings - Room content selection settings.
 * @param {string} itemSignature - Signature for the available item set.
 * @returns {object} Board state containing selected items and marked cells.
 */
function createBoard(items, rows, columns, freeCenter, contentSettings, itemSignature) {
  const totalCells = rows * columns;
  const freeCenterIndex = getFreeCenterIndex(rows, columns, freeCenter);
  const requiredItems = freeCenterIndex === null ? totalCells : totalCells - 1;
  const playableItems = filterItemsByContentSettings(items, contentSettings);

  if (playableItems.length < requiredItems) {
    throw new Error("Not enough items to fill the bingo board.");
  }

  const shouldUseNumberColumns = shouldUseNumberColumnRanges(contentSettings);
  const boardItems = shouldUseNumberColumns ?
    buildNumberColumnBoardItems(playableItems, rows, columns, freeCenterIndex) :
    buildBoardItems(
      selectBoardItems(playableItems, requiredItems, contentSettings),
      totalCells,
      freeCenterIndex,
      rows,
      columns,
      false
    );
  const markedCells = boardItems.map(function () {
    return false;
  });

  if (freeCenterIndex !== null) {
    markedCells[freeCenterIndex] = true;
  }

  return {
    items: boardItems,
    victory_recorded: false,
    free_cell_index: freeCenterIndex,
    balance_types: shouldBalanceItemTypes(contentSettings),
    number_layout: shouldUseNumberColumns ? "column_ranges" : null,
    content_filters: getContentFilterState(contentSettings),
    item_signature: itemSignature,
    marked_cells: markedCells
  };
}

/**
 * Filters items according to the room content settings.
 *
 * @param {object[]} items - Full list of available bingo items.
 * @param {object} contentSettings - Room content selection settings.
 * @returns {object[]} Items allowed for the current room.
 */
function filterItemsByContentSettings(items, contentSettings) {
  return items.filter(function (item) {
    if (item.type === "text") {
      return isContentTypeAllowed(contentSettings, "allow_text");
    }

    if (item.type === "number") {
      return isContentTypeAllowed(contentSettings, "allow_numbers");
    }

    if (item.type === "image") {
      return isContentTypeAllowed(contentSettings, "allow_images");
    }

    return true;
  });
}

/**
 * Checks if a specific content type flag allows an item.
 *
 * @param {object} contentSettings - Room content selection settings.
 * @param {string} settingName - Content setting name.
 * @returns {boolean} True when the content type is allowed.
 */
function isContentTypeAllowed(contentSettings, settingName) {
  if (!contentSettings || typeof contentSettings[settingName] === "undefined") {
    return true;
  }

  return Boolean(contentSettings[settingName]);
}

/**
 * Captures the active filter flags used to create a board.
 *
 * @param {object} contentSettings - Room content selection settings.
 * @returns {object} Active content filter state.
 */
function getContentFilterState(contentSettings) {
  return {
    allow_text: isContentTypeAllowed(contentSettings, "allow_text"),
    allow_numbers: isContentTypeAllowed(contentSettings, "allow_numbers"),
    allow_images: isContentTypeAllowed(contentSettings, "allow_images")
  };
}

/**
 * Selects playable items for a board, optionally balancing available types.
 *
 * @param {object[]} items - Full list of available bingo items.
 * @param {number} requiredItems - Number of playable items needed.
 * @param {object} contentSettings - Room content selection settings.
 * @returns {object[]} Selected board items.
 */
function selectBoardItems(items, requiredItems, contentSettings) {
  if (!shouldBalanceItemTypes(contentSettings)) {
    return shuffleItems(items).slice(0, requiredItems);
  }

  return selectBalancedItems(items, requiredItems);
}

/**
 * Checks if the board should be filled with ordered number items.
 *
 * @param {object} contentSettings - Room content selection settings.
 * @returns {boolean} True when only numbers should fill the board.
 */
function shouldUseNumberColumnRanges(contentSettings) {
  return Boolean(
    contentSettings &&
    contentSettings.allow_numbers &&
    !contentSettings.allow_text &&
    !contentSettings.allow_images
  );
}

/**
 * Builds a number board using one range slice per column.
 *
 * @param {object[]} items - Full list of available bingo items.
 * @param {number} rows - Number of board rows.
 * @param {number} columns - Number of board columns.
 * @param {number|null} freeCenterIndex - Free center cell index, when enabled.
 * @returns {object[]} Items in board order.
 */
function buildNumberColumnBoardItems(items, rows, columns, freeCenterIndex) {
  const sortedNumberItems = items
    .slice()
    .sort(function (firstItem, secondItem) {
      return Number(firstItem.label) - Number(secondItem.label);
    });
  const boardItems = new Array(rows * columns);

  for (let column = 0; column < columns; column++) {
    const rangeItems = getNumberItemsForColumn(sortedNumberItems, column, columns);
    const neededInColumn = getPlayableCellsInColumn(rows, columns, column, freeCenterIndex);

    if (rangeItems.length < neededInColumn) {
      throw new Error("Not enough numbers to fill one bingo column.");
    }

    const selectedColumnItems = shuffleItems(rangeItems)
      .slice(0, neededInColumn)
      .sort(function (firstItem, secondItem) {
        return Number(firstItem.label) - Number(secondItem.label);
      });
    let selectedIndex = 0;

    for (let row = 0; row < rows; row++) {
      const cellIndex = row * columns + column;

      if (cellIndex === freeCenterIndex) {
        boardItems[cellIndex] = {
          id: "free_center",
          type: "free",
          label: "Casa livre",
          image_url: null
        };
        continue;
      }

      boardItems[cellIndex] = selectedColumnItems[selectedIndex];
      selectedIndex++;
    }
  }

  return boardItems;
}

/**
 * Gets the range slice that belongs to one number board column.
 *
 * @param {object[]} sortedNumberItems - Number items sorted ascending.
 * @param {number} column - Column index.
 * @param {number} columns - Total columns.
 * @returns {object[]} Number items for the column.
 */
function getNumberItemsForColumn(sortedNumberItems, column, columns) {
  const startIndex = Math.floor(column * sortedNumberItems.length / columns);
  const endIndex = Math.floor((column + 1) * sortedNumberItems.length / columns);

  return sortedNumberItems.slice(startIndex, endIndex);
}

/**
 * Counts playable cells in one column.
 *
 * @param {number} rows - Number of rows.
 * @param {number} columns - Number of columns.
 * @param {number} column - Column index.
 * @param {number|null} freeCenterIndex - Free center index.
 * @returns {number} Playable cell count.
 */
function getPlayableCellsInColumn(rows, columns, column, freeCenterIndex) {
  let playableCells = rows;

  for (let row = 0; row < rows; row++) {
    if (row * columns + column === freeCenterIndex) {
      playableCells--;
    }
  }

  return playableCells;
}

/**
 * Checks whether item type balancing is enabled for the room.
 *
 * @param {object} contentSettings - Room content selection settings.
 * @returns {boolean} True when balancing should be used.
 */
function shouldBalanceItemTypes(contentSettings) {
  return Boolean(
    contentSettings &&
    contentSettings.mixed_content &&
    contentSettings.balance_types
  );
}

/**
 * Selects items while guaranteeing one item from each available type when possible.
 *
 * @param {object[]} items - Full list of available bingo items.
 * @param {number} requiredItems - Number of playable items needed.
 * @returns {object[]} Selected board items.
 */
function selectBalancedItems(items, requiredItems) {
  const groupedItems = groupItemsByType(items);
  const itemTypes = Object.keys(groupedItems);

  if (itemTypes.length > requiredItems) {
    return shuffleItems(items).slice(0, requiredItems);
  }

  const selectedItems = [];
  const selectedIds = new Set();

  itemTypes.forEach(function (itemType) {
    const shuffledTypeItems = shuffleItems(groupedItems[itemType]);
    const selectedItem = shuffledTypeItems[0];

    selectedItems.push(selectedItem);
    selectedIds.add(selectedItem.id);
  });

  const remainingItems = shuffleItems(items).filter(function (item) {
    return !selectedIds.has(item.id);
  });

  return shuffleItems(
    selectedItems.concat(remainingItems.slice(0, requiredItems - selectedItems.length))
  );
}

/**
 * Groups items by their content type.
 *
 * @param {object[]} items - Full list of available bingo items.
 * @returns {object} Items keyed by type.
 */
function groupItemsByType(items) {
  return items.reduce(function (groupedItems, item) {
    if (!groupedItems[item.type]) {
      groupedItems[item.type] = [];
    }

    groupedItems[item.type].push(item);

    return groupedItems;
  }, {});
}

/**
 * Builds the board item list, inserting the free center item when needed.
 *
 * @param {object[]} selectedItems - Randomly selected playable items.
 * @param {number} totalCells - Total cells on the board.
 * @param {number|null} freeCenterIndex - Free center cell index, when enabled.
 * @param {number} rows - Number of board rows.
 * @param {number} columns - Number of board columns.
 * @returns {object[]} Items in board order.
 */
function buildBoardItems(selectedItems, totalCells, freeCenterIndex, rows, columns) {
  if (freeCenterIndex === null) {
    return selectedItems;
  }

  const boardItems = new Array(totalCells);
  let selectedItemIndex = 0;

  getBoardFillIndexes(totalCells).forEach(function (cellIndex) {
    if (cellIndex === freeCenterIndex) {
      boardItems[cellIndex] = {
        id: "free_center",
        type: "free",
        label: "Casa livre",
        image_url: null
      };
      return;
    }

    boardItems[cellIndex] = selectedItems[selectedItemIndex];
    selectedItemIndex++;
  });

  return boardItems;
}

/**
 * Gets the order in which board indexes should receive playable items.
 *
 * @param {number} totalCells - Total cells on the board.
 * @returns {number[]} Board indexes in fill order.
 */
function getBoardFillIndexes(totalCells) {
  return Array.from({ length: totalCells }, function (_, index) {
    return index;
  });
}

/**
 * Gets the center index for boards that support a single free center cell.
 *
 * @param {number} rows - Number of board rows.
 * @param {number} columns - Number of board columns.
 * @param {boolean} freeCenter - Whether the free center is enabled.
 * @returns {number|null} Free center index or null.
 */
function getFreeCenterIndex(rows, columns, freeCenter) {
  if (!freeCenter) {
    return null;
  }

  if (rows % 2 === 0 || columns % 2 === 0) {
    throw new Error("Free center requires a board with odd rows and columns.");
  }

  const centerRow = Math.floor(rows / 2);
  const centerColumn = Math.floor(columns / 2);

  return centerRow * columns + centerColumn;
}

/**
 * Randomizes item order using the Fisher-Yates shuffle algorithm.
 *
 * @param {object[]} items - Original item list.
 * @returns {object[]} New shuffled item list.
 */
function shuffleItems(items) {
  const shuffledItems = items.slice();

  for (let index = shuffledItems.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));

    const temporaryItem = shuffledItems[index];
    shuffledItems[index] = shuffledItems[randomIndex];
    shuffledItems[randomIndex] = temporaryItem;
  }

  return shuffledItems;
}

/**
 * Renders the board inside the HTML container.
 *
 * @param {HTMLElement} boardElement - HTML element where the board will be rendered.
 * @param {object} boardState - Current board state.
 * @param {object} roomConfig - Current room configuration.
 * @param {Function} onCellToggle - Callback executed when a cell is clicked.
 */
function renderBoard(boardElement, boardState, roomConfig, onCellToggle) {
  const rows = roomConfig.board.rows;
  const columns = roomConfig.board.columns;
  const cellPadding = getCellPadding(roomConfig);
  const cellSize = calculateBoardCellSize(boardState.items, cellPadding);

  boardElement.innerHTML = "";
  boardElement.style.setProperty("--cell-padding", `${cellPadding}px`);
  boardElement.style.setProperty("--cell-size", `${cellSize}px`);
  boardElement.style.gridTemplateColumns = `repeat(${columns}, var(--cell-size))`;
  boardElement.style.gridAutoRows = "var(--cell-size)";

  boardState.items.forEach(function (item, index) {
    const cellButton = document.createElement("button");

    cellButton.type = "button";
    cellButton.className = "bingo_cell";
    cellButton.setAttribute("data_cell_index", index);
    cellButton.setAttribute("aria_pressed", "false");

    if (boardState.marked_cells[index]) {
      cellButton.classList.add("is_marked");
      cellButton.setAttribute("aria_pressed", "true");
    }

    if (boardState.free_cell_index === index) {
      cellButton.classList.add("is_free_cell");
      cellButton.disabled = true;
    }

    renderCellContent(cellButton, item);

    cellButton.addEventListener("click", function () {
      onCellToggle(index);
    });

    boardElement.appendChild(cellButton);
  });
}

/**
 * Renders the correct visual content based on item type.
 *
 * @param {HTMLButtonElement} cellButton - Cell button element.
 * @param {object} item - Bingo item data.
 */
function renderCellContent(cellButton, item) {
  if (item.type === "image" && item.image_url) {
    const imageElement = document.createElement("img");

    imageElement.src = item.image_url;
    imageElement.alt = item.label || "Bingo image item";

    cellButton.appendChild(imageElement);
    return;
  }

  cellButton.textContent = item.label;
}

/**
 * Toggles a marked cell state.
 *
 * @param {object} boardState - Current board state.
 * @param {number} cellIndex - Index of the clicked cell.
 */
function toggleCell(boardState, cellIndex) {
  if (boardState.free_cell_index === cellIndex) {
    return;
  }

  boardState.marked_cells[cellIndex] = !boardState.marked_cells[cellIndex];
}

/**
 * Gets the configured cell padding.
 *
 * @param {object} roomConfig - Current room configuration.
 * @returns {number} Cell padding in pixels.
 */
function getCellPadding(roomConfig) {
  const padding = Number(roomConfig.board.cell_padding_px);

  if (!Number.isFinite(padding) || padding < 0) {
    return 8;
  }

  return padding;
}

/**
 * Calculates a square cell size that fits the longest text item.
 *
 * @param {object[]} items - Board items.
 * @param {number} cellPadding - Cell padding in pixels.
 * @returns {number} Square cell size in pixels.
 */
function calculateBoardCellSize(items, cellPadding) {
  const textLabels = items
    .filter(function (item) {
      return item.type === "text" || item.type === "number" || item.type === "free";
    })
    .map(function (item) {
      return item.label || "";
    });

  if (textLabels.length === 0) {
    return 96;
  }

  return calculateTextCellSize(getLongestText(textLabels), cellPadding);
}

/**
 * Finds the longest text by character count.
 *
 * @param {string[]} texts - Text list.
 * @returns {string} Longest text.
 */
function getLongestText(texts) {
  return texts.reduce(function (longestText, currentText) {
    if (currentText.length > longestText.length) {
      return currentText;
    }

    return longestText;
  }, "");
}

/**
 * Measures the smallest square cell that fits a text value.
 *
 * @param {string} text - Text to fit.
 * @param {number} cellPadding - Cell padding in pixels.
 * @returns {number} Square cell size in pixels.
 */
function calculateTextCellSize(text, cellPadding) {
  const measurer = document.createElement("div");
  const minimumSize = 74;
  const maximumSize = 420;

  measurer.className = "cell_text_measurer";
  measurer.textContent = text;
  document.body.appendChild(measurer);

  for (let size = minimumSize; size <= maximumSize; size++) {
    const contentSize = size - cellPadding * 2;

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
