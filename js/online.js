(function () {
  const PLAYER_ID_KEY = "bingo_online_player_id";

  let onlineState = {
    enabled: false,
    ready: false,
    firestore: null,
    document_reference: null,
    unsubscribe: null,
    set_doc: null,
    get_doc: null,
    on_snapshot: null,
    last_remote_session: null
  };

  /**
   * Checks whether online sync is configured.
   *
   * @returns {boolean} True when online sync is enabled.
   */
  function isOnlineSyncEnabled() {
    const config = getOnlineConfig();

    return Boolean(
      config &&
      config.enabled &&
      config.provider === "firebase" &&
      config.firebase_config &&
      config.firebase_config.apiKey &&
      config.firebase_config.projectId
    );
  }

  /**
   * Starts the online room listener.
   *
   * @param {object} options - Online start options.
   * @returns {Promise<void>} Resolves when setup is attempted.
   */
  async function startOnlineRoom(options) {
    if (!isOnlineSyncEnabled()) {
      options.onStatus("Online desligado");
      return;
    }

    try {
      const onlineRoom = await ensureOnlineRoom();

      await onlineRoom.firebase.setDoc(
        onlineRoom.document_reference,
        {
          room_id: options.room_id,
          session: options.initial_session,
          updated_at: new Date().toISOString()
        },
        { merge: true }
      );

      onlineState.unsubscribe = onlineRoom.firebase.onSnapshot(
        onlineRoom.document_reference,
        function (snapshot) {
          const data = snapshot.data();

          if (!data || !data.session) {
            return;
          }

          onlineState.last_remote_session = data.session;
          options.onRemoteSession(data.session);
        },
        function (error) {
          options.onStatus(`Online com erro: ${error.message}`);
        }
      );

      options.onStatus("Online conectado");
    } catch (error) {
      options.onStatus(`Online indisponivel: ${error.message}`);
      console.error(error);
    }
  }

  /**
   * Loads the room configuration saved online.
   *
   * @returns {Promise<object|null>} Online room config or null.
   */
  async function loadOnlineRoomConfig() {
    if (!isOnlineSyncEnabled()) {
      return null;
    }

    const onlineRoom = await ensureOnlineRoom();
    const snapshot = await onlineRoom.firebase.getDoc(onlineRoom.document_reference);
    const data = snapshot.exists() ? snapshot.data() : null;

    return data && data.config ? data.config : null;
  }

  /**
   * Saves the room configuration online.
   *
   * @param {string} roomId - Room identifier.
   * @param {object} roomSettings - Room settings.
   * @param {object} themeSettings - Theme settings.
   * @returns {Promise<void>} Resolves after Firestore accepts the write.
   */
  async function saveOnlineRoomConfig(roomId, roomSettings, themeSettings) {
    if (!isOnlineSyncEnabled()) {
      return;
    }

    const onlineRoom = await ensureOnlineRoom();

    await onlineRoom.firebase.setDoc(
      onlineRoom.document_reference,
      {
        room_id: roomId,
        config: {
          room_settings: roomSettings,
          theme_settings: themeSettings
        },
        config_updated_at: new Date().toISOString()
      },
      { merge: true }
    );
  }

  /**
   * Saves session state to the configured online room.
   *
   * @param {object} sessionState - Session state.
   */
  function saveOnlineRoomSession(sessionState) {
    if (!onlineState.ready || !onlineState.set_doc || !onlineState.document_reference) {
      return;
    }

    onlineState.set_doc(
      onlineState.document_reference,
      {
        session: sessionState,
        updated_at: new Date().toISOString()
      },
      { merge: true }
    ).catch(function (error) {
      console.error("Could not save online room session:", error);
    });
  }

  /**
   * Gets this browser's stable local player id.
   *
   * @returns {string} Player id.
   */
  function getOnlinePlayerId() {
    const savedPlayerId = localStorage.getItem(PLAYER_ID_KEY);

    if (savedPlayerId) {
      return savedPlayerId;
    }

    const playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    localStorage.setItem(PLAYER_ID_KEY, playerId);

    return playerId;
  }

  /**
   * Gets the online config object.
   *
   * @returns {object|null} Online config.
   */
  function getOnlineConfig() {
    return window.BINGO_ONLINE_CONFIG || null;
  }

  /**
   * Initializes Firebase once and keeps the shared room document reference.
   *
   * @returns {Promise<object>} Firebase helpers and room document reference.
   */
  async function ensureOnlineRoom() {
    if (onlineState.ready && onlineState.document_reference) {
      return {
        firebase: {
          setDoc: onlineState.set_doc,
          getDoc: onlineState.get_doc,
          onSnapshot: onlineState.on_snapshot
        },
        document_reference: onlineState.document_reference
      };
    }

    const firebase = await loadFirebase();
    const config = getOnlineConfig();
    const app = firebase.getApps().length > 0 ?
      firebase.getApp() :
      firebase.initializeApp(config.firebase_config);
    const firestore = firebase.getFirestore(app);
    const documentReference = firebase.doc(firestore, config.room_path);

    onlineState.enabled = true;
    onlineState.ready = true;
    onlineState.firestore = firestore;
    onlineState.document_reference = documentReference;
    onlineState.set_doc = firebase.setDoc;
    onlineState.get_doc = firebase.getDoc;
    onlineState.on_snapshot = firebase.onSnapshot;

    return {
      firebase: firebase,
      document_reference: documentReference
    };
  }

  /**
   * Loads Firebase modules from the official CDN.
   *
   * @returns {Promise<object>} Firebase helpers.
   */
  async function loadFirebase() {
    const config = getOnlineConfig();
    const sdkVersion = config.sdk_version || "10.14.1";
    const appModule = await import(
      `https://www.gstatic.com/firebasejs/${sdkVersion}/firebase-app.js`
    );
    const firestoreModule = await import(
      `https://www.gstatic.com/firebasejs/${sdkVersion}/firebase-firestore.js`
    );

    return {
      initializeApp: appModule.initializeApp,
      getApp: appModule.getApp,
      getApps: appModule.getApps,
      getFirestore: firestoreModule.getFirestore,
      doc: firestoreModule.doc,
      getDoc: firestoreModule.getDoc,
      onSnapshot: firestoreModule.onSnapshot,
      setDoc: firestoreModule.setDoc
    };
  }

  window.BingoOnline = {
    getOnlinePlayerId: getOnlinePlayerId,
    isOnlineSyncEnabled: isOnlineSyncEnabled,
    loadOnlineRoomConfig: loadOnlineRoomConfig,
    saveOnlineRoomConfig: saveOnlineRoomConfig,
    saveOnlineRoomSession: saveOnlineRoomSession,
    startOnlineRoom: startOnlineRoom
  };
}());
