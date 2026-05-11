/**
 * Preloads image assets used by allowed room items.
 *
 * @param {object[]} items - Full list of available bingo items.
 * @param {object} contentSettings - Room content selection settings.
 * @returns {Promise<object>} Preload summary.
 */
function preloadAllowedImages(items, contentSettings) {
  const imageUrls = getAllowedImageUrls(items, contentSettings);
  const preloadTasks = imageUrls.map(preloadImage);

  return Promise.allSettled(preloadTasks).then(function (results) {
    const failedImages = results
      .filter(function (result) {
        return result.status === "rejected";
      })
      .map(function (result) {
        return result.reason;
      });

    return {
      total_images: imageUrls.length,
      loaded_images: imageUrls.length - failedImages.length,
      failed_images: failedImages
    };
  });
}

/**
 * Preloads audio assets configured for the room.
 *
 * @param {object} audioSettings - Room audio settings.
 * @returns {Promise<object>} Preload summary.
 */
function preloadConfiguredSounds(audioSettings) {
  const soundUrls = getEnabledSoundUrls(audioSettings);
  const preloadTasks = soundUrls.map(preloadSound);

  return Promise.allSettled(preloadTasks).then(function (results) {
    const failedSounds = results
      .filter(function (result) {
        return result.status === "rejected";
      })
      .map(function (result) {
        return result.reason;
      });

    return {
      total_sounds: soundUrls.length,
      loaded_sounds: soundUrls.length - failedSounds.length,
      failed_sounds: failedSounds
    };
  });
}

/**
 * Gets unique image URLs from items allowed by current content settings.
 *
 * @param {object[]} items - Full list of available bingo items.
 * @param {object} contentSettings - Room content selection settings.
 * @returns {string[]} Unique image URLs.
 */
function getAllowedImageUrls(items, contentSettings) {
  const playableItems = filterItemsByContentSettings(items, contentSettings);
  const imageUrls = playableItems
    .filter(function (item) {
      return item.type === "image" && item.image_url;
    })
    .map(function (item) {
      return item.image_url;
    });

  return Array.from(new Set(imageUrls));
}

/**
 * Preloads one image URL.
 *
 * @param {string} imageUrl - Image URL to preload.
 * @returns {Promise<string>} Loaded image URL.
 */
function preloadImage(imageUrl) {
  return new Promise(function (resolve, reject) {
    const image = new Image();

    image.onload = function () {
      resolve(imageUrl);
    };

    image.onerror = function () {
      reject(imageUrl);
    };

    image.src = imageUrl;
  });
}

/**
 * Gets unique sound URLs when audio is enabled.
 *
 * @param {object} audioSettings - Room audio settings.
 * @returns {string[]} Unique sound URLs.
 */
function getEnabledSoundUrls(audioSettings) {
  if (!audioSettings || !audioSettings.enabled) {
    return [];
  }

  const soundUrls = [
    audioSettings.draw_sound,
    audioSettings.victory_sound
  ].filter(function (soundUrl) {
    return Boolean(soundUrl);
  });

  return Array.from(new Set(soundUrls));
}

/**
 * Preloads one sound URL.
 *
 * @param {string} soundUrl - Sound URL to preload.
 * @returns {Promise<string>} Loaded sound URL.
 */
function preloadSound(soundUrl) {
  return new Promise(function (resolve, reject) {
    const audio = new Audio();

    audio.preload = "auto";

    audio.oncanplaythrough = function () {
      resolve(soundUrl);
    };

    audio.onerror = function () {
      reject(soundUrl);
    };

    audio.src = soundUrl;
    audio.load();
  });
}

/**
 * Plays the configured victory sound when audio is enabled.
 *
 * @param {object} audioSettings - Room audio settings.
 * @returns {Promise<void>} Playback result.
 */
function playVictorySound(audioSettings) {
  if (!audioSettings || !audioSettings.enabled || !audioSettings.victory_sound) {
    return Promise.resolve();
  }

  return playSound(audioSettings.victory_sound);
}

/**
 * Plays one sound URL from the beginning.
 *
 * @param {string} soundUrl - Sound URL to play.
 * @returns {Promise<void>} Playback result.
 */
function playSound(soundUrl) {
  const audio = new Audio(soundUrl);

  audio.currentTime = 0;

  return audio.play();
}
