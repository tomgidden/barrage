const mqttPrefix = 'barrage-game-';
const mqttBroker = "wss://test.mosquitto.org:8081";
const mqttEventName = 'playerKeypress';

let mqttClient = mqtt.connect(mqttBroker);
let mqttTopic;

const mqttAllowedKeyCodes = new Set([
  8, 13, 43, 44, 45, 46, 48, 127, 188, 189, 190,
  49, 50, 51, 52, 53, 54, 55, 56, 57
]);

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
        console.log(`Got state query`);
        await waitForNotBusy();

        const stateJson = JSON.stringify(getGameState());

        console.log(`Sending state...`);

        mqttClient.publish(
          `${mqttTopic}/${mqttClient.options.clientId}/state`,
          stateJson,
          { qos: 1 }
        );
        break;

      case 'keypress':
        // Get the keycode
        const { key } = JSON.parse(message);

        // and verify that it's in our accepted list
        if (mqttAllowedKeyCodes.has(key)) {

          // Okay, so send it out locally, so any input handlers can get it.
          const ev = new CustomEvent(mqttEventName, { detail: key });
          document.dispatchEvent(ev);
        }
        break;
    }
  });

mqttUpdateChannel();

window.addEventListener('popstate', mqttUpdateChannel);
window.addEventListener('keydown', mqttKeydown);

function mqttUpdateChannel() {

  // See if the window hash has a game ID
  let m = window.location.hash.match(/game-([\w\-]+)/);
  if (m) {

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

      // Unsubscribe to the old game
      if (mqttTopic !== undefined)
        mqttClient.unsubscribe(`${oldMqttTopic}/#`);

      // Subscribe to the new game
      mqttTopic = `${mqttPrefix}${m[1]}`;
      mqttClient.subscribe(`${mqttTopic}/#`);

      // and request an update.
      mqttSendStateQuery();

    }, 500);
  }
}

function mqttSendStateQuery()
{
  console.log(`Sending state query`);
  if (mqttTopic)
    mqttClient.publish(`${mqttTopic}/${mqttClient.options.clientId}/state_query`, '', { qos: 1 });
}

function mqttKeydown(event) {
  const key = event.keyCode;

  if (mqttAllowedKeyCodes.has(key)) {

    // Dispatch an event locally, so we can pick it up as if it were a normal key-down
    // event
    const ev = new CustomEvent(mqttEventName, { detail: key });
    document.dispatchEvent(ev);

    // and send it on MQTT for multiplayer.
    if (mqttClient && mqttTopic) {
      mqttClient.publish(
        `${mqttTopic}/${mqttClient.options.clientId}/keypress`,
        JSON.stringify({ key }),
        { qos: 1 }
      );
    }
  }
}
