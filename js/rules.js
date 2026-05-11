/**
 * Checks if the player has completed any active victory condition.
 *
 * @param {boolean[]} markedCells - Array where each position tells if a board cell is marked.
 * @param {number} rows - Total number of board rows.
 * @param {number} columns - Total number of board columns.
 * @param {object} victoryRules - Enabled victory rules for the room.
 * @returns {object} Victory result with status and type.
 */
function checkVictory(markedCells, rows, columns, victoryRules) {
  const lineVictory = victoryRules.line && hasCompleteLine(markedCells, rows, columns);
  const columnVictory = victoryRules.column && hasCompleteColumn(markedCells, rows, columns);
  const diagonalVictory = victoryRules.diagonal && hasCompleteDiagonal(markedCells, rows, columns);
  const fullBoardVictory = victoryRules.full_board && hasFullBoard(markedCells);

  if (lineVictory) {
    return {
      has_victory: true,
      victory_type: "line",
      message: "Vitória por linha!"
    };
  }

  if (columnVictory) {
    return {
      has_victory: true,
      victory_type: "column",
      message: "Vitória por coluna!"
    };
  }

  if (diagonalVictory) {
    return {
      has_victory: true,
      victory_type: "diagonal",
      message: "Vitória por diagonal!"
    };
  }

  if (fullBoardVictory) {
    return {
      has_victory: true,
      victory_type: "full_board",
      message: "Vitória por cartela cheia!"
    };
  }

  return {
    has_victory: false,
    victory_type: null,
    message: "Nenhuma vitória ainda."
  };
}

/**
 * Checks if any horizontal row is fully marked.
 *
 * @param {boolean[]} markedCells - Marked state for each board cell.
 * @param {number} rows - Total number of rows.
 * @param {number} columns - Total number of columns.
 * @returns {boolean} True when at least one row is complete.
 */
function hasCompleteLine(markedCells, rows, columns) {
  for (let row = 0; row < rows; row++) {
    let completedCells = 0;

    for (let column = 0; column < columns; column++) {
      const cellIndex = row * columns + column;

      if (markedCells[cellIndex]) {
        completedCells++;
      }
    }

    if (completedCells === columns) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if any vertical column is fully marked.
 *
 * @param {boolean[]} markedCells - Marked state for each board cell.
 * @param {number} rows - Total number of rows.
 * @param {number} columns - Total number of columns.
 * @returns {boolean} True when at least one column is complete.
 */
function hasCompleteColumn(markedCells, rows, columns) {
  for (let column = 0; column < columns; column++) {
    let completedCells = 0;

    for (let row = 0; row < rows; row++) {
      const cellIndex = row * columns + column;

      if (markedCells[cellIndex]) {
        completedCells++;
      }
    }

    if (completedCells === rows) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if any diagonal is fully marked.
 *
 * @param {boolean[]} markedCells - Marked state for each board cell.
 * @param {number} rows - Total number of rows.
 * @param {number} columns - Total number of columns.
 * @returns {boolean} True when at least one diagonal is complete.
 */
function hasCompleteDiagonal(markedCells, rows, columns) {
  if (rows !== columns) {
    return false;
  }

  let mainDiagonalCompletedCells = 0;
  let secondaryDiagonalCompletedCells = 0;

  for (let index = 0; index < rows; index++) {
    const mainDiagonalIndex = index * columns + index;
    const secondaryDiagonalIndex = index * columns + (columns - 1 - index);

    if (markedCells[mainDiagonalIndex]) {
      mainDiagonalCompletedCells++;
    }

    if (markedCells[secondaryDiagonalIndex]) {
      secondaryDiagonalCompletedCells++;
    }
  }

  return (
    mainDiagonalCompletedCells === rows ||
    secondaryDiagonalCompletedCells === rows
  );
}

/**
 * Checks if every board cell is marked.
 *
 * @param {boolean[]} markedCells - Marked state for each board cell.
 * @returns {boolean} True when all cells are marked.
 */
function hasFullBoard(markedCells) {
  return markedCells.every(function (isMarked) {
    return isMarked;
  });
}