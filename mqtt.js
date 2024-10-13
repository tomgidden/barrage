const mqttPrefix = 'barrage-game-';
const mqttBroker = "wss://test.mosquitto.org:8081";

// Our  "proxy" keydown event to allow for network keypresses (multiplayer)
const keypressEventName = 'playerKeydown';

function getGameID() {
  var m = window.location?.hash?.match(/game-([\w\-]+)/);
  return m ? m[1] : undefined;
}

// 'gameID', if set, indicates that multiplayer-mode is requested.
var gameID = getGameID();

/**
 * Handle keypresses for the game, linking in with multiplayer if necessary.
 * 
 * @param {Event} event 
 */
function keypressEventHandler(event) {
  // If we're in multiplayer, then we need to deal with keypresses in a more complex
  // way, so we abstract out the normal "keydown" event.
  //
  // If we're in singleplayer, no, but we still need to get that done.  Rather than
  // putting multiplayer-checking code in the main game, we just treat it as if it's
  // all happening anyway.  As a result, our normal game listens to 'playerKeydown'
  // rather than 'keydown'.

  // Get the key.
  const key = event.keyCode;

  // Send an event to our custom version of 'keydown', so the local game can use it.
  const new_event = new CustomEvent(keypressEventName, { detail: event.keyCode });
  document.dispatchEvent(new_event);

  // If we're in multiplayer, we'll send this onto the game server as well.
  if (mqttClient && mqttTopic) {

    //Send the message.  As it's marked with our ID, we can exclude it.
    mqttClient.publish(
      `${mqttTopic}/${mqttClient.options.clientId}/keypress`,
      JSON.stringify({ key }),
      { qos: 1 }
    );
  }
}

// And listen for it.
window.addEventListener('keydown', keypressEventHandler);



// The network connection and the path we send to, based on the game ID.
var mqttClient, mqttTopic;



function mqttInit() {
  mqttClient = mqtt.connect(mqttBroker);

  mqttClient
    .on("connect", () => {
      console.log("Connected to MQTT broker");
    })

    .on("message", async (topic, message) => {
      const [chan, sender, cmd] = topic.split(/\//);

      if (chan !== `${mqttTopic}`)
        // Not for us.
        return;

      if (sender === mqttClient.options.clientId)
        // This is us. Ignore.
        return;

      switch (cmd) {
        case 'state':
          // Received state.
          return mqttReceiveState(message, true);

        case 'state_query':
          // Someone (not us) has requested the game state, so send it.
          await waitForNotBusy();

          const stateJson = JSON.stringify(getGameState());

          mqttClient.publish(
            `${mqttTopic}/${mqttClient.options.clientId}/state`,
            stateJson,
            { qos: 1 }
          );
          break;

        case 'keypress':
          // Get the keycode
          const { key } = JSON.parse(message);

          // Okay, so send it out locally, so any input handlers can get it.
          // As far as the main game is concerned, this is seen as a local keypress.
          const new_event = new CustomEvent(
            keypressEventName,
            { detail: key }
          );
          document.dispatchEvent(new_event);
          break;
      }
    });


  // Listen for change in the URL for gameID change.
  // PROBLEMATIC. DISABLED
  // window.addEventListener('popstate', mqttUpdateChannel);

  // And subscribe to the channel.
  mqttUpdateChannel();

  // And immediately request an update from the other player if they're there.
  mqttSendStateQuery();
}

function mqttUpdateChannel() {

  // See if the window hash has a game ID
  let _gameID = getGameID();

  if (_gameID && gameID !== _gameID) {
    // Yes, so start a timeout. We don't immediately set it, because the user
    // might be typing in the URL. Instead, we'll delay 500ms. Only if that
    // isn't interrupted will we unsub/resub.

    // Here, we clear a timeout if it's set (eg. they're typing)
    if (mqttUpdateChannel.timeout)
      clearTimeout(mqttUpdateChannel.timeout);

    // Copy the old channel name (the topic)
    const oldMqttTopic = mqttTopic;

    // And set the timeout to update it.
    mqttUpdateChannel.timeout = setTimeout(() => {

      // Okay, this wasn't cancelled, so we can go ahead and set the channel.
      gameID = _gameID;

      // Unsubscribe to the old game
      if (mqttTopic !== undefined)
        mqttClient.unsubscribe(`${oldMqttTopic}/#`);

      // Subscribe to the new game
      mqttTopic = `${mqttPrefix}${gameID}`;
      mqttClient.subscribe(`${mqttTopic}/#`);

      // and request an update.
      mqttSendStateQuery();

    }, 500);
  }
}

function mqttSendStateQuery() {
  console.log(`Sending state query`);
  if (mqttTopic)
    mqttClient.publish(`${mqttTopic}/${mqttClient.options.clientId}/state_query`, '', { qos: 1 });
}
