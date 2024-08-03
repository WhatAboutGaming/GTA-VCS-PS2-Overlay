var fs = require("fs");
var http = require("http");
var path = require("path");
var url = require("url");
var memoryjs = require("memoryjs");
var tmi = require("tmi.js");
var jsdom = require("jsdom");
var {JSDOM} = jsdom;
var moduleObject = undefined;
var processObject = undefined;
var processList = [];
var vehiclePointers = [];
var gameMemoryConfigFileName = "gta_vcs_memory.json";
var rewardsConfigFileName = "rewards_config_vcs.json";
var chatConfigFileName = "chat_config.json";
var gameMemory = JSON.parse(fs.readFileSync(gameMemoryConfigFileName, "utf8"));
var chatConfig = JSON.parse(fs.readFileSync(chatConfigFileName, "utf8"));
var rewardsConfig = JSON.parse(fs.readFileSync(rewardsConfigFileName, "utf8"));
var beybladeSfxFileName = gameMemory.beyblade_sfx_filename;
var audioFileExtension = "." + gameMemory.audio_file_extension;
var beepSoundEffectsArray = chatConfig.beep_sound_effects;
var doNotLoadArray = chatConfig.do_not_load;
var overlayPath = gameMemory.overlay_path;
overlayPath = overlayPath.replace(/({{path_separator}})+/ig, path.sep);
var overlayFilesList = fs.readdirSync(__dirname + path.sep + overlayPath);
var overlayMp3FilesOnly = overlayFilesList.filter(file => path.extname(file).toLowerCase() === audioFileExtension);
overlayMp3FilesOnly = overlayMp3FilesOnly.filter(file => file.toLowerCase() !== beybladeSfxFileName);
for (let doNotLoadArrayIndex = 0; doNotLoadArrayIndex < doNotLoadArray.length; doNotLoadArrayIndex++) {
  overlayMp3FilesOnly = overlayMp3FilesOnly.filter(file => file.toLowerCase() !== doNotLoadArray[doNotLoadArrayIndex]);
  //console.log(doNotLoadArray[doNotLoadArrayIndex]);
}
//console.log(overlayMp3FilesOnly);
var processName = gameMemory.process_name;
var gameMemoryToDisplay = [];
var gameMemoryToOverride = [];
for (let gameMemoryObjectIndex = 0; gameMemoryObjectIndex < gameMemory.memory_data.length; gameMemoryObjectIndex++) {
  if (gameMemory.memory_data[gameMemoryObjectIndex].to_override == true) {
    gameMemoryToOverride.push(gameMemory.memory_data[gameMemoryObjectIndex]);
  }
  if (gameMemory.memory_data[gameMemoryObjectIndex].to_display == true) {
    //console.log(gameMemory.memory_data[gameMemoryObjectIndex]);
    gameMemoryToDisplay.push(gameMemory.memory_data[gameMemoryObjectIndex]);
  }
}

var lastChannelName = "";
var playerPointerGlobal = {};

var characterData = [];
var controlCharacterData = [];

for (let characterDataIndex = 0; characterDataIndex < gameMemory.character_data.length; characterDataIndex++) {
  characterData[characterDataIndex] = gameMemory.character_data[characterDataIndex];
  controlCharacterData[characterDataIndex] = gameMemory.control_character_data[characterDataIndex];

  let characterRegexFlags = characterData[characterDataIndex].character_original_string.replace(/.*\/([gimy]*)$/, "$1");
  let characterRegexPattern = characterData[characterDataIndex].character_original_string.replace(new RegExp("^/(.*?)/" + characterRegexFlags + "$"), "$1");
  let characterRegexData = new RegExp(characterRegexPattern, characterRegexFlags);

  let controlCharacterRegexFlags = controlCharacterData[characterDataIndex].character_original_string.replace(/.*\/([gimy]*)$/, "$1");
  let controlCharacterRegexPattern = controlCharacterData[characterDataIndex].character_original_string.replace(new RegExp("^/(.*?)/" + controlCharacterRegexFlags + "$"), "$1");
  let controlCharacterRegexData = new RegExp(controlCharacterRegexPattern, controlCharacterRegexFlags);

  if (characterData[characterDataIndex].character_original_string === "") {
    characterData[characterDataIndex].character_original_string = "";
  }
  if (characterData[characterDataIndex].character_original_string !== "") {
    characterData[characterDataIndex].character_original_string = characterRegexData;
  }

  if (controlCharacterData[characterDataIndex].character_original_string === "") {
    controlCharacterData[characterDataIndex].character_original_string = "";
  }
  if (controlCharacterData[characterDataIndex].character_original_string !== "") {
    controlCharacterData[characterDataIndex].character_original_string = controlCharacterRegexData;
  }
}

var baseMemoryAddress = parseInt(gameMemory.base_address, 16);
var endMemoryAddress = parseInt(gameMemory.end_address, 16);

var basePointerAddress = parseInt(gameMemory.base_pointer_address, 16);
var endPointerAddress = parseInt(gameMemory.end_pointer_address, 16);

var ajaxAmpAddress = gameMemory.ajaxamp_address;
var ajaxAmpPort = gameMemory.ajaxamp_port;
var currentMusicTrackPlaying = {};
var trackPositionToLoadMillis = {};
var musicTrackStatus = {};
var cutsceneTrackStatus = {};
var realTimeMusicVolume = {};
var trackPositionToUseMillis = 0;
var trackPositionToUseMillis2 = 0;
var waitingForValidTrackId = true;
var waitingForValidPosition = true;
var waitingToPlayTrack = true;
var audioTrackIndex = -1;
var audioTrackData = {
  name: "",
  internal_name: "",
  id: -1,
  loop_track: false,
  start_from_beginning: false,
  audio_file_type: 0,
  override_by_ajaxamp: false,
  custom_volume_level: 255
};

var client = new tmi.client(chatConfig);
client.connect();

client.on("raw_message", onRawMessageHandler);
client.on("message", onMessageHandler);
client.on("connected", onConnectedHandler);

function onMessageHandler(target, tags, message, self) {
  if (self == true) {
    return;
  } // Ignore messages from the bot
  lastChannelName = target;
  //console.log(target);
  //console.log(tags);
  //console.log(message);
  //console.log(self);
  let messageType = tags["message-type"];
  let displayName = tags["display-name"];
  let username = tags["username"];
  let customRewardId = tags["custom-reward-id"];
  let msgTimestamp = tags["tmi-sent-ts"];
  let userId = tags["user-id"];
  let messageId = tags["id"];
  let messageWords = message.split(/\s+/ig);
  let messageToWrite = "";
  let finalUsername = "";
  let notifMessage = "";
  username = username.replace(/(\\s)+/ig, "");
  username = username.replace(/\s+/ig, "");
  displayName = displayName.replace(/(\\s)+/ig, "");
  displayName = displayName.replace(/\s+/ig, "");
  //username = username.replace(/(\\s)+/ig, "");
  //username = username.replace(/\s+/ig, "");
  //displayName = displayName.replace(/(\\s)+/ig, "");
  //displayName = displayName.replace(/\s+/ig, "");
  //console.log(tags);
  //console.log(target);
  //console.log("TAGS " + tags);
  //console.log(tags["custom-reward-id"]);
  //console.log(msg);
  //console.log(self);
  //console.log(tags);
  //console.log(message);
  //console.log(displayName.compareToIgnoreCase(username));
  if (messageType == "chat" || messageType == "action") {
    //console.log("MSGTIMESTAMP: " + new Date(Number(msgTimestamp)).toISOString());
    //console.log("This message is " + messageType);
    if (displayName.toUpperCase() == username.toUpperCase()) {
      //messageToWrite = displayName + ": " + message;
      finalUsername = displayName;
    }
    if (displayName.toUpperCase() != username.toUpperCase()) {
      //messageToWrite = username + ": " + message;
      finalUsername = username;
    }
    messageToWrite = message;
    let githubPrefixCheck = /^[!\"#$%&'()*+,\-./:;%=%?@\[\\\]^_`{|}~¡¦¨«¬­¯°±»½⅔¾⅝⅞∅ⁿ№★†‡‹›¿‰℅æßçñ¹⅓¼⅛²⅜³⁴₱€¢£¥—–·„“”‚‘’•√π÷×¶∆′″§Π♣♠♥♪♦∞≠≈©®™✓‛‟❛❜❝❞❟❠❮❯⹂〝〞〟＂🙶🙷🙸󠀢⍻✅✔𐄂🗸‱]*\s*(github)+|(source(\s*code)*)+/ig.test(message);
    if (githubPrefixCheck == true) {
      client.reply(target, "@" + finalUsername + " " + chatConfig.github_message + " " + chatConfig.github_repo, messageId);
    }
    let trustedUsersIndex = chatConfig.trusted_users.findIndex(element => element == userId);
    if (trustedUsersIndex >= 0) {
      // This is a trusted user
      let toggleFrameLimiterPrefixCheck = /^[!\"#$%&'()*+,\-./:;%=%?@\[\\\]^_`{|}~¡¦¨«¬­¯°±»½⅔¾⅝⅞∅ⁿ№★†‡‹›¿‰℅æßçñ¹⅓¼⅛²⅜³⁴₱€¢£¥—–·„“”‚‘’•√π÷×¶∆′″§Π♣♠♥♪♦∞≠≈©®™✓‛‟❛❜❝❞❟❠❮❯⹂〝〞〟＂🙶🙷🙸󠀢⍻✅✔𐄂🗸‱]*\s*(toggle\s*frame\s*limiter)+/ig.test(message);
      if (toggleFrameLimiterPrefixCheck == true) {
        // Uhhh do the thing to change the framelimiter in the game's memory
        if (processObject == undefined) {
          let returnMessage = "Can't toggle frame limiter, emulator is not running!";
          client.reply(target, "@" + finalUsername + " " + returnMessage, messageId);
          return returnMessage;
        }
        let playerPointer = readFromAppMemory("Player Pointer 1").current_value;
        if (playerPointer <= basePointerAddress || playerPointer >= endPointerAddress) {
          let returnMessage = "Can't toggle frame limiter, game is not running!";
          client.reply(target, "@" + finalUsername + " " + returnMessage, messageId);
          return returnMessage;
        }
        let frameLimiterValue = readFromAppMemory("Frame Limiter").current_value;
        if (frameLimiterValue != gameMemory.frame_limiter_options.frame_limiter_off) {
          writeToAppMemory("Frame Limiter", gameMemory.frame_limiter_options.frame_limiter_off);
          let returnMessage = "Disabled frame limiter!";
          writeToNotificationBox(returnMessage);
          client.reply(target, "@" + finalUsername + " " + returnMessage, messageId);
          return returnMessage;
        }
        if (frameLimiterValue == gameMemory.frame_limiter_options.frame_limiter_off) {
          writeToAppMemory("Frame Limiter", gameMemory.frame_limiter_options.frame_limiter_on);
          let returnMessage = "Enabled frame limiter!";
          writeToNotificationBox(returnMessage);
          client.reply(target, "@" + finalUsername + " " + returnMessage, messageId);
          return returnMessage;
        }
      }
    }
    if (customRewardId != undefined) {
      console.log("CUSTOM REWARD ID " + customRewardId);
      doCustomReward(finalUsername, message, target, customRewardId);
    }
    //doCustomReward(finalUsername, message, target, customRewardId);
    if (customRewardId == undefined) {
      let processedMessage = processTextForNotificationBox(messageToWrite);
      if (processedMessage.length > 0) {
        //console.log(new Date().toISOString() + " [NOTIFBOX] " + writeToNotificationBox(finalUsername + ": " + processedMessage).current_value.toString("utf16le"));
        writeToNotificationBox(finalUsername + ": " + processedMessage);
      }
    }
    //writeToNotificationBox(finalUsername + ": " + messageToWrite);
    //writeMessageToGame(finalUsername, messageToWrite);
  }
  //console.log(username);
  //console.log(tags["display-name"]);
  //console.log(finalUsername + ": " + messageToWrite);
}

function onConnectedHandler(addr, port) {
  console.log("* Connected to " + addr + ":" + port);
  client.action(chatConfig.main_channel, new Date().toISOString() + " Connected! PogChamp");
}

function onRawMessageHandler(messageCloned, message) {
  if (chatConfig.logchat == true) {
    console.log(new Date().toISOString() + " [CHAT] " + message.raw);
  }
}

function overrideGameSettings() {
  if (gameMemory.override_game_settings == false) {
    return;
  }
  // Override some game settings to specific values when player pointer changes to a valid address
  console.log(new Date().toISOString() + " Overriding game settings");
  for (let gameMemoryToOverrideIndex = 0; gameMemoryToOverrideIndex < gameMemoryToOverride.length; gameMemoryToOverrideIndex++) {
    //console.log(new Date().toISOString() + " [" + gameMemoryToOverrideIndex + "] Overriding " + gameMemoryToOverride[gameMemoryToOverrideIndex].address_name + " with " + gameMemoryToOverride[gameMemoryToOverrideIndex].value_to_override_with)
    writeToAppMemory(gameMemoryToOverride[gameMemoryToOverrideIndex].address_name, gameMemoryToOverride[gameMemoryToOverrideIndex].value_to_override_with);
    //console.log(new Date().toISOString() + " [" + gameMemoryToOverrideIndex + "] Overrode " + gameMemoryToOverride[gameMemoryToOverrideIndex].address_name + " with " + gameMemoryToOverride[gameMemoryToOverrideIndex].value_to_override_with)
  }
  /*
  writeToAppMemory("Brightness Bar Position (Settings Menu)", 1); // Turn brightness up high so twitch doesn't completely destroy the video quality of this dark game
  writeToAppMemory("Brightness (Maximum is 1280, going higher has no effect, not recommended to go higher than 436 when trails are enabled because trails make the game too bright)", 436); // Turn brightness up high so twitch doesn't completely destroy the video quality of this dark game
  writeToAppMemory("Screen Position X 1", 0); // Set screen position to center
  writeToAppMemory("Screen Position X 1 Sign (-1 = to left, 0 = center or to right)", 0); // Set screen position to center
  writeToAppMemory("Screen Position Y 1", 0); // Set screen position to center
  writeToAppMemory("Screen Position Y Sign 1 (-1 = to top, 0 = center or to bottom)", 0); // Set screen position to center
  writeToAppMemory("Screen Position X 2", 0); // Set screen position to center
  writeToAppMemory("Screen Position X Sign 2 (-1 = to left, 0 = center or to right)", 0); // Set screen position to center
  writeToAppMemory("Screen Position X Sign 3 (-1 = to left, 0 = center or to right)", 0); // Set screen position to center
  writeToAppMemory("Screen Position X Sign 4 (-1 = to left, 0 = center or to right)", 0); // Set screen position to center
  writeToAppMemory("Screen Position Y 2", 0); // Set screen position to center
  writeToAppMemory("Screen Position Y Sign 2 (-1 = to top, 0 = center or to bottom)", 0); // Set screen position to center
  writeToAppMemory("Screen Position Y Sign 3 (-1 = to top, 0 = center or to bottom)", 0); // Set screen position to center
  writeToAppMemory("Screen Position Y Sign 4 (-1 = to top, 0 = center or to bottom)", 0); // Set screen position to center
  writeToAppMemory("Wide Screen (Settings Menu)", 1); // Enable Widescreen
  writeToAppMemory("Wide Screen", 1); // Enable Widescreen
  writeToAppMemory("SFX Volume 1 (Maximum Volume)", 127); // Turn all the volumes all the way up, again because of twitch
  writeToAppMemory("SFX Volume 2 (Current Volume)", 127); // Turn all the volumes all the way up, again because of twitch
  writeToAppMemory("SFX Volume 3 (Settings Menu)", 127); // Turn all the volumes all the way up, again because of twitch
  writeToAppMemory("Music Volume 1 (Maximum Volume)", 127); // Turn all the volumes all the way up, again because of twitch
  writeToAppMemory("Music Volume 2 (Current Volume)", 127); // Turn all the volumes all the way up, again because of twitch
  writeToAppMemory("Music Volume 3 (Settings Menu)", 127); // Turn all the volumes all the way up, again because of twitch
  writeToAppMemory("Subtitles (Settings Menu)", 1); // Enable subtitles because some viewers might appreciate it
  writeToAppMemory("Subtitles", 1); // Enable subtitles because some viewers might appreciate it
  writeToAppMemory("Hud Mode (Settings Menu)", 1); // Enable HUD
  writeToAppMemory("Hud Mode", 1); // Enable HUD
  writeToAppMemory("Radar Mode (Settings Menu)", 0); // Enable Map & Blips
  writeToAppMemory("Radar Mode", 0); // Enable Map & Blips
  writeToAppMemory("Vibration (Settings Menu)", 1); // Enable Controller Vibration
  writeToAppMemory("Vibration", 1); // Enable Controller Vibration
  writeToAppMemory("Vibration (Inverted)", 0); // Enable Controller Vibration
  writeToAppMemory("Invert Look (Settings Menu, Inverted)", 0); // Invert X-Axis Look, 0 is ON for some reason
  writeToAppMemory("Invert Look (Inverted)", 0); // Invert X-Axis Look, 0 is ON for some reason
  writeToAppMemory("Controller Configuration", 0); // Use a controller configuration that's actually good for the PS2 controller
  writeToAppMemory("Controller Configuration (Settings Menu Graphics)", 0); // Use a controller configuration that's actually good for the PS2 controller
  writeToAppMemory("Controller Configuration (Settings Menu)", 0); // Use a controller configuration that's actually good for the PS2 controller
  writeToAppMemory("Controller Type (Settings Menu)", 0); // 0 = In car, 1 = On foot (This doesn't really change anything in the game, just displays how the controls are)
  writeToAppMemory("Controller Type", 0); // 0 = In car, 1 = On foot (This doesn't really change anything in the game, just displays how the controls are)
  writeToAppMemory("Trails (Settings Menu)", 1); // Enable Trails because it's Vice City, Baby!
  writeToAppMemory("Trails", 1); // Enable Trails because it's Vice City, Baby!
  writeToAppMemory("Speaker Setup (Settings Menu)", 0); // Set Sound to Stereo (0 = Stereo, 1 = Mono)
  writeToAppMemory("Speaker Setup", 0); // Set Sound to Stereo (0 = Stereo, 1 = Mono)
  writeToAppMemory("Speaker Setup (Inverted)", 1); // Set Sound to Stereo (1 = Stereo, 0 = Mono)
  */
  console.log(new Date().toISOString() + " Overrode game settings");
}

function ajaxAmpGetConsoleStatus() {
  //console.log(new Date().toISOString() + " [AJAXAMP] EXECUTING COMMAND ajaxAmpGetConsoleStatus()");
  let rawOutputData = "";

  let options = {
    hostname: ajaxAmpAddress,
    port: ajaxAmpPort,
    path: "/consolestatus.xml",
    method: "GET"
  };

  let req = http.request(options, function(res) {
    //console.log("statusCode: " + res.statusCode);
    res.on("data", function(d) {
      //console.log(JSON.parse(d.toString("utf8")));
      rawOutputData = rawOutputData + d.toString("utf8");
    });
    res.on("end", function() {
      //console.log(rawOutputData);
      let cleanedUpXml = rawOutputData.replace(/((\<\!\[CDATA\[)+|(\]+\>+)+)+/ig, " "); // idk why but this works
      cleanedUpXml = cleanedUpXml.trim();
      cleanedUpXml = cleanedUpXml.replace(/(\<+\s+)+/ig, "<");
      cleanedUpXml = cleanedUpXml.replace(/(\>+\s+)+/ig, ">");
      cleanedUpXml = cleanedUpXml.replace(/(\s+\>+)+/ig, ">");
      cleanedUpXml = cleanedUpXml.replace(/(\s+\<+)+/ig, "<");
      cleanedUpXml = cleanedUpXml.replace(/(\<+\/+\s+)+/ig, "<\/");
      cleanedUpXml = cleanedUpXml.trim();
      //console.log(cleanedUpXml);
      //let domString = cleanedUpXml;
      let dom = new JSDOM(cleanedUpXml);
      //console.log(domString);
      let ajaxAmpVolume = parseInt((dom.window.document.querySelector("volume").textContent).trim(), 10);
      let ajaxAmpShuffle = parseInt((dom.window.document.querySelector("shuffle").textContent).trim(), 10);
      let ajaxAmpRepeat = parseInt((dom.window.document.querySelector("repeat").textContent).trim(), 10);
      let ajaxAmpAlbum = (dom.window.document.querySelector("album").textContent).trim();
      let ajaxAmpArtist = (dom.window.document.querySelector("artist").textContent).trim();
      let ajaxAmpTitle = (dom.window.document.querySelector("title").textContent).trim();
      let ajaxAmpFilename = (dom.window.document.querySelector("filename").textContent).trim();
      let ajaxAmpLength = (dom.window.document.querySelector("length").textContent).trim();
      let ajaxAmpLengthMs = parseInt((dom.window.document.querySelector("lengthms").textContent).trim(), 10);
      let ajaxAmpBitrate = parseInt((dom.window.document.querySelector("bitrate").textContent).trim(), 10);
      let ajaxAmpPositionFloat = parseFloat((dom.window.document.querySelector("position").textContent).trim());
      //console.log(new Date().toISOString() + " " + ajaxAmpPositionFloat);
      //console.log((dom.window.document.querySelector("filename").textContent).trim()); // "Hello world"
      //console.log(new Date().toISOString() + " [AJAXAMP] SUCCESSFULLY EXECUTED COMMAND ajaxAmpGetConsoleStatus()");
    });
  });

  req.on("error", function(error) {
    console.log(new Date().toISOString() + " [AJAXAMP] ERROR EXECUTING COMMAND ajaxAmpGetConsoleStatus()");
    console.error(error);
  });
  req.end();
}

function ajaxAmpSetPositionMillis(positionMillisToSet) {
  //console.log(new Date().toISOString() + " [AJAXAMP] EXECUTING COMMAND ajaxAmpSetPositionMillis(positionMillisToSet = " + positionMillisToSet + ")");
  let rawOutputData = "";
  let positionFloatToSet = 0;

  let options = {
    hostname: ajaxAmpAddress,
    port: ajaxAmpPort,
    path: "/consolestatus.xml",
    method: "GET"
  };

  let req = http.request(options, function(res) {
    //console.log("statusCode: " + res.statusCode);
    res.on("data", function(d) {
      //console.log(JSON.parse(d.toString("utf8")));
      rawOutputData = rawOutputData + d.toString("utf8");
    });
    res.on("end", function() {
      //console.log(rawOutputData);
      let cleanedUpXml = rawOutputData.replace(/((\<\!\[CDATA\[)+|(\]+\>+)+)+/ig, " "); // idk why but this works
      cleanedUpXml = cleanedUpXml.trim();
      cleanedUpXml = cleanedUpXml.replace(/(\<+\s+)+/ig, "<");
      cleanedUpXml = cleanedUpXml.replace(/(\>+\s+)+/ig, ">");
      cleanedUpXml = cleanedUpXml.replace(/(\s+\>+)+/ig, ">");
      cleanedUpXml = cleanedUpXml.replace(/(\s+\<+)+/ig, "<");
      cleanedUpXml = cleanedUpXml.replace(/(\<+\/+\s+)+/ig, "<\/");
      cleanedUpXml = cleanedUpXml.trim();
      //console.log(cleanedUpXml);
      //let domString = cleanedUpXml;
      let dom = new JSDOM(cleanedUpXml);
      //console.log(cleanedUpXml);
      //console.log(domString);
      let ajaxAmpVolume = parseInt((dom.window.document.querySelector("volume").textContent).trim(), 10);
      let ajaxAmpShuffle = parseInt((dom.window.document.querySelector("shuffle").textContent).trim(), 10);
      let ajaxAmpRepeat = parseInt((dom.window.document.querySelector("repeat").textContent).trim(), 10);
      let ajaxAmpAlbum = (dom.window.document.querySelector("album").textContent).trim();
      let ajaxAmpArtist = (dom.window.document.querySelector("artist").textContent).trim();
      let ajaxAmpTitle = (dom.window.document.querySelector("title").textContent).trim();
      let ajaxAmpFilename = (dom.window.document.querySelector("filename").textContent).trim();
      let ajaxAmpLength = (dom.window.document.querySelector("length").textContent).trim();
      let ajaxAmpLengthMs = parseInt((dom.window.document.querySelector("lengthms").textContent).trim(), 10);
      let ajaxAmpBitrate = parseInt((dom.window.document.querySelector("bitrate").textContent).trim(), 10);
      let ajaxAmpPositionFloat = parseFloat((dom.window.document.querySelector("position").textContent).trim());
      positionFloatToSet = positionMillisToSet / ajaxAmpLengthMs;
      //console.log("positionMillisToSet = " + positionMillisToSet);
      //console.log("ajaxAmpLengthMs = " + ajaxAmpLengthMs);
      //console.log("SETTING POSITION TO " + positionFloatToSet);
      ajaxAmpSetPosition(positionFloatToSet);
      //ajaxAmpSetVolume(gameMemory.ajaxamp_max_volume);
      //console.log(new Date().toISOString() + " " + ajaxAmpPositionFloat);
      //console.log((dom.window.document.querySelector("filename").textContent).trim()); // "Hello world"
      //console.log(new Date().toISOString() + " [AJAXAMP] SUCCESSFULLY EXECUTED COMMAND ajaxAmpSetPositionMillis(positionMillisToSet = " + positionMillisToSet + ")");
    });
  });

  req.on("error", function(error) {
    console.log(new Date().toISOString() + " [AJAXAMP] ERROR EXECUTING COMMAND ajaxAmpSetPositionMillis(positionMillisToSet = " + positionMillisToSet + ")");
    console.error(error);
  });
  req.end();
}

function ajaxAmpToggleRepeat() {
  //console.log(new Date().toISOString() + " [AJAXAMP] EXECUTING COMMAND ajaxAmpToggleRepeat()");
  let rawOutputData = "";

  let options = {
    hostname: ajaxAmpAddress,
    port: ajaxAmpPort,
    path: "/togglerepeat",
    method: "POST"
  };

  let req = http.request(options, function(res) {
    //console.log("statusCode: " + res.statusCode);
    res.on("data", function(d) {
      //console.log(JSON.parse(d.toString("utf8")));
      rawOutputData = rawOutputData + d.toString("utf8");
    });
    res.on("end", function() {
      //console.log(rawOutputData);
      //console.log(new Date().toISOString() + " [AJAXAMP] SUCCESSFULLY EXECUTED COMMAND ajaxAmpToggleRepeat()");
    });
  });

  req.on("error", function(error) {
    console.log(new Date().toISOString() + " [AJAXAMP] ERROR EXECUTING COMMAND ajaxAmpToggleRepeat()");
    console.error(error);
  });
  req.end();
}

function ajaxAmpPlay() {
  //console.log(new Date().toISOString() + " [AJAXAMP] EXECUTING COMMAND ajaxAmpPlay()");
  let rawOutputData = "";

  let options = {
    hostname: ajaxAmpAddress,
    port: ajaxAmpPort,
    path: "/play",
    method: "POST"
  };

  let req = http.request(options, function(res) {
    //console.log("statusCode: " + res.statusCode);
    res.on("data", function(d) {
      //console.log(JSON.parse(d.toString("utf8")));
      rawOutputData = rawOutputData + d.toString("utf8");
    });
    res.on("end", function() {
      //console.log(rawOutputData);
      //console.log(new Date().toISOString() + " [AJAXAMP] SUCCESSFULLY EXECUTED COMMAND ajaxAmpPlay()");
    });
  });

  req.on("error", function(error) {
    console.log(new Date().toISOString() + " [AJAXAMP] ERROR EXECUTING COMMAND ajaxAmpPlay()");
    console.error(error);
  });
  req.end();
}

function ajaxAmpStop() {
  //console.log(new Date().toISOString() + " [AJAXAMP] EXECUTING COMMAND ajaxAmpStop()");
  let rawOutputData = "";

  let options = {
    hostname: ajaxAmpAddress,
    port: ajaxAmpPort,
    path: "/stop",
    method: "POST"
  };

  let req = http.request(options, function(res) {
    //console.log("statusCode: " + res.statusCode);
    res.on("data", function(d) {
      //console.log(JSON.parse(d.toString("utf8")));
      rawOutputData = rawOutputData + d.toString("utf8");
    });
    res.on("end", function() {
      //console.log(rawOutputData);
      //console.log(new Date().toISOString() + " [AJAXAMP] SUCCESSFULLY EXECUTED COMMAND ajaxAmpStop()");
    });
  });

  req.on("error", function(error) {
    console.log(new Date().toISOString() + " [AJAXAMP] ERROR EXECUTING COMMAND ajaxAmpStop()");
    console.error(error);
  });
  req.end();
}

function ajaxAmpPause() {
  //console.log(new Date().toISOString() + " [AJAXAMP] EXECUTING COMMAND ajaxAmpPause()");
  let rawOutputData = "";

  let options = {
    hostname: ajaxAmpAddress,
    port: ajaxAmpPort,
    path: "/pause",
    method: "POST"
  };

  let req = http.request(options, function(res) {
    //console.log("statusCode: " + res.statusCode);
    res.on("data", function(d) {
      //console.log(JSON.parse(d.toString("utf8")));
      rawOutputData = rawOutputData + d.toString("utf8");
    });
    res.on("end", function() {
      //console.log(rawOutputData);
      //console.log(new Date().toISOString() + " [AJAXAMP] SUCCESSFULLY EXECUTED COMMAND ajaxAmpPause()");
    });
  });

  req.on("error", function(error) {
    console.log(new Date().toISOString() + " [AJAXAMP] ERROR EXECUTING COMMAND ajaxAmpPause()");
    console.error(error);
  });
  req.end();
}

function ajaxAmpPlayFileAtSpecificPositionFloat(fileNameToPlay, positionToSpecifyFloat) {
  //console.log(new Date().toISOString() + " [AJAXAMP] EXECUTING COMMAND ajaxAmpPlayFileAtSpecificPositionFloat(fileNameToPlay = " + fileNameToPlay + ", positionToSpecifyFloat = " + positionToSpecifyFloat + ")");
  let rawOutputData = "";

  let options = {
    hostname: ajaxAmpAddress,
    port: ajaxAmpPort,
    path: "/playfile?filename=" + fileNameToPlay,
    method: "POST"
  };

  let req = http.request(options, function(res) {
    //console.log("statusCode: " + res.statusCode);
    res.on("data", function(d) {
      //console.log(JSON.parse(d.toString("utf8")));
      rawOutputData = rawOutputData + d.toString("utf8");
    });
    res.on("end", function() {
      //console.log(rawOutputData);
      //ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
      //ajaxAmpSetPosition(0); // Float from 0 to 1
      //ajaxAmpPause();
      ajaxAmpSetPosition(positionToSpecifyFloat);
      //console.log(new Date().toISOString() + " [AJAXAMP] SUCCESSFULLY EXECUTED COMMAND ajaxAmpPlayFileAtSpecificPositionFloat(fileNameToPlay = " + fileNameToPlay + ", positionToSpecifyFloat = " + positionToSpecifyFloat + ")");
    });
  });

  req.on("error", function(error) {
    console.log(new Date().toISOString() + " [AJAXAMP] ERROR EXECUTING COMMAND ajaxAmpPlayFileAtSpecificPositionFloat(fileNameToPlay = " + fileNameToPlay + ", positionToSpecifyFloat = " + positionToSpecifyFloat + ")");
    console.error(error);
  });
  req.end();
}

function ajaxAmpPlayFileAtSpecificPositionMillis(fileNameToPlay, positionToSpecifyMillis) {
  //console.log(new Date().toISOString() + " [AJAXAMP] EXECUTING COMMAND ajaxAmpPlayFileAtSpecificPositionMillis(fileNameToPlay = " + fileNameToPlay + ", positionToSpecifyMillis = " + positionToSpecifyMillis + ")");
  //ajaxAmpSetVolume(0);
  let rawOutputData = "";

  let options = {
    hostname: ajaxAmpAddress,
    port: ajaxAmpPort,
    path: "/playfile?filename=" + fileNameToPlay,
    method: "POST"
  };

  let req = http.request(options, function(res) {
    //console.log("statusCode: " + res.statusCode);
    res.on("data", function(d) {
      //console.log(JSON.parse(d.toString("utf8")));
      rawOutputData = rawOutputData + d.toString("utf8");
    });
    res.on("end", function() {
      //console.log(rawOutputData);
      //ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
      //ajaxAmpSetPosition(0); // Float from 0 to 1
      //ajaxAmpPause();
      ajaxAmpSetPositionMillis(positionToSpecifyMillis);
      //ajaxAmpSetVolume(gameMemory.ajaxamp_max_volume);
      //console.log(new Date().toISOString() + " [AJAXAMP] SUCCESSFULLY EXECUTED COMMAND ajaxAmpPlayFileAtSpecificPositionMillis(fileNameToPlay = " + fileNameToPlay + ", positionToSpecifyMillis = " + positionToSpecifyMillis + ")");
    });
  });

  req.on("error", function(error) {
    console.log(new Date().toISOString() + " [AJAXAMP] ERROR EXECUTING COMMAND ajaxAmpPlayFileAtSpecificPositionMillis(fileNameToPlay = " + fileNameToPlay + ", positionToSpecifyMillis = " + positionToSpecifyMillis + ")");
    console.error(error);
  });
  req.end();
}

function ajaxAmpPlayFile(fileNameToPlay) {
  //console.log(new Date().toISOString() + " [AJAXAMP] EXECUTING COMMAND ajaxAmpPlayFile(fileNameToPlay = " + fileNameToPlay + ")");
  let rawOutputData = "";

  let options = {
    hostname: ajaxAmpAddress,
    port: ajaxAmpPort,
    path: "/playfile?filename=" + fileNameToPlay,
    method: "POST"
  };

  let req = http.request(options, function(res) {
    //console.log("statusCode: " + res.statusCode);
    res.on("data", function(d) {
      //console.log(JSON.parse(d.toString("utf8")));
      rawOutputData = rawOutputData + d.toString("utf8");
    });
    res.on("end", function() {
      //console.log(rawOutputData);
      //console.log(new Date().toISOString() + " [AJAXAMP] SUCCESSFULLY EXECUTED COMMAND ajaxAmpPlayFile(fileNameToPlay = " + fileNameToPlay + ")");
    });
  });

  req.on("error", function(error) {
    console.log(new Date().toISOString() + " [AJAXAMP] ERROR EXECUTING COMMAND ajaxAmpPlayFile(fileNameToPlay = " + fileNameToPlay + ")");
    console.error(error);
  });
  req.end();
}

function ajaxAmpSetRepeat(repeatValue) {
  //console.log(new Date().toISOString() + " [AJAXAMP] EXECUTING COMMAND ajaxAmpSetRepeat(repeatValue = " + repeatValue + ")");
  // Parameter for repeat command actually unknown, need to find out, for now it is only being used to disable repeat
  let rawOutputData = "";

  let options = {
    hostname: ajaxAmpAddress,
    port: ajaxAmpPort,
    path: "/setrepeat?repeat=" + repeatValue,
    method: "POST"
  };

  let req = http.request(options, function(res) {
    //console.log("statusCode: " + res.statusCode);
    res.on("data", function(d) {
      //console.log(JSON.parse(d.toString("utf8")));
      rawOutputData = rawOutputData + d.toString("utf8");
    });
    res.on("end", function() {
      //console.log(rawOutputData);
      //console.log(new Date().toISOString() + " [AJAXAMP] SUCCESSFULLY EXECUTED COMMAND ajaxAmpSetRepeat(repeatValue = " + repeatValue + ")");
    });
  });

  req.on("error", function(error) {
    console.log(new Date().toISOString() + " [AJAXAMP] ERROR EXECUTING COMMAND ajaxAmpSetRepeat(repeatValue = " + repeatValue + ")");
    console.error(error);
  });
  req.end();
}

function ajaxAmpSetVolume(volumeByte) {
  //console.log(new Date().toISOString() + " [AJAXAMP] EXECUTING COMMAND ajaxAmpSetVolume(volumeByte = " + volumeByte + ")");
  let rawOutputData = "";

  let options = {
    hostname: ajaxAmpAddress,
    port: ajaxAmpPort,
    path: "/setvolume?level=" + volumeByte,
    method: "POST"
  };

  let req = http.request(options, function(res) {
    //console.log("statusCode: " + res.statusCode);
    res.on("data", function(d) {
      //console.log(JSON.parse(d.toString("utf8")));
      rawOutputData = rawOutputData + d.toString("utf8");
    });
    res.on("end", function() {
      //console.log(rawOutputData);
      //console.log(new Date().toISOString() + " [AJAXAMP] SUCCESSFULLY EXECUTED COMMAND ajaxAmpSetVolume(volumeByte = " + volumeByte + ")");
    });
  });

  req.on("error", function(error) {
    console.log(new Date().toISOString() + " [AJAXAMP] ERROR EXECUTING COMMAND ajaxAmpSetVolume(volumeByte = " + volumeByte + ")");
    console.error(error);
  });
  req.end();
}

function ajaxAmpSetPosition(positionFloat) {
  //console.log(new Date().toISOString() + " [AJAXAMP] EXECUTING COMMAND ajaxAmpSetPosition(positionFloat = " + positionFloat + ")");
  let rawOutputData = "";

  let options = {
    hostname: ajaxAmpAddress,
    port: ajaxAmpPort,
    path: "/setposition?pos=" + positionFloat,
    method: "POST"
  };

  let req = http.request(options, function(res) {
    //console.log("statusCode: " + res.statusCode);
    res.on("data", function(d) {
      //console.log(JSON.parse(d.toString("utf8")));
      rawOutputData = rawOutputData + d.toString("utf8");
    });
    res.on("end", function() {
      //console.log(rawOutputData);
      //console.log(new Date().toISOString() + " [AJAXAMP] SUCCESSFULLY EXECUTED COMMAND ajaxAmpSetPosition(positionFloat = " + positionFloat + ")");
    });
  });

  req.on("error", function(error) {
    console.log(new Date().toISOString() + " [AJAXAMP] ERROR EXECUTING COMMAND ajaxAmpSetPosition(positionFloat = " + positionFloat + ")");
    console.error(error);
  });
  req.end();
}

/*
setInterval(resetCounter, 0);

function resetCounter() {
  if (waitingForValidPosition == false) {
    console.log(new Date().toISOString() + " RESETTING trackPositionToUseMillis = " + trackPositionToUseMillis);
    waitingForValidPosition = true;
    //trackPositionToUseMillis = 0;
  }
}
*/

function overrideGameAudioFiles2() {
  // Alternate method for overriding game audio files
  if (gameMemory.let_ajaxamp_override_all_audio_files == false) {
    return;
  }
  /*
  if (waitingForValidPosition == true) {
    //console.log("IS THIS WORKING?");
    //trackPositionToUseMillis = -1;
  }
  */
  // Reset waitingForValidPosition after a certain period, kinda like a timeout?
  trackPositionToLoadMillis = readFromAppMemory("Position to load audio track Milliseconds");
  currentMusicTrackPlaying = readFromAppMemory("Track 2 (Changes 3rd)");
  musicTrackStatus = readFromAppMemory("Is Music Track Playing"); // Observed values are 0, 2, 63 and 80 // 0 = Not playing, 2 = Loading?, 63 and 80 = Playing // See how to make it detect when track loops // If track hasn't changed but music status changed to 63 or 80? then loop? // Track change has to be read first, then track status has to be read right after
  cutsceneTrackStatus = readFromAppMemory("Is Cutscene Track Playing"); // Observed values are 0, 1 and 2 // 0 = Not playing, 1 = Loading?, 2 = Playing
  realTimeMusicVolume = readFromAppMemory("Real Time Music Volume 1");
  if (trackPositionToLoadMillis.current_value != trackPositionToLoadMillis.old_value) {
    //console.log(new Date().toISOString() + " POSITION CHANGED FROM " + trackPositionToLoadMillis.old_value + " TO " + trackPositionToLoadMillis.current_value);
    //trackPositionToUseMillis = trackPositionToLoadMillis.current_value;
    if ((trackPositionToLoadMillis.current_value >= 2 && trackPositionToLoadMillis.current_value <= gameMemory.maximum_duration_millis) || (trackPositionToLoadMillis.old_value >= 2 && trackPositionToLoadMillis.old_value <= gameMemory.maximum_duration_millis)) {
      if (waitingForValidPosition == true) {
        //console.log(new Date().toISOString() + " AAAA Valid?");
        //console.log(new Date().toISOString() + " CURRENT POSITION " + trackPositionToLoadMillis.current_value);
        //console.log(new Date().toISOString() + " OLD POSITION " + trackPositionToLoadMillis.old_value);
        if (trackPositionToLoadMillis.current_value >= 2 && trackPositionToLoadMillis.current_value <= gameMemory.maximum_duration_millis) {
          //console.log(new Date().toISOString() + " USE CURRENT VALUE");
          trackPositionToUseMillis = trackPositionToLoadMillis.current_value;
          //console.log("CASE A");
          //waitingForValidPosition = false;
          //console.log(trackPositionToUseMillis);
        }
        if (trackPositionToLoadMillis.old_value >= 2 && trackPositionToLoadMillis.old_value <= gameMemory.maximum_duration_millis) {
          //console.log(new Date().toISOString() + " USE OLD VALUE");
          trackPositionToUseMillis = trackPositionToLoadMillis.old_value;
          //console.log("CASE B");
          //waitingForValidPosition = false;
          //console.log(trackPositionToUseMillis);
        }
      }
    }
    /*
    if ((trackPositionToLoadMillis.current_value >= 0 && trackPositionToLoadMillis.current_value < 2) || (trackPositionToLoadMillis.old_value >= 0 && trackPositionToLoadMillis.old_value < 2)) {
      if (waitingForValidPosition == true) {
        //console.log(new Date().toISOString() + " AAAA INValid?");
        //console.log(new Date().toISOString() + " CURRENT POSITION " + trackPositionToLoadMillis.current_value);
        //console.log(new Date().toISOString() + " OLD POSITION " + trackPositionToLoadMillis.old_value);
        //console.log(new Date().toISOString() + " USE 0");
        //trackPositionToUseMillis = 0;
        //console.log("CASE C");
        //waitingForValidPosition = false;
        //console.log(trackPositionToUseMillis);
      }
    }
    */
    /*
    if ((trackPositionToLoadMillis.current_value < 0) || (trackPositionToLoadMillis.old_value < 0)) {
      // This is not valid at all, best thing to do is ignore?
      if (waitingForValidPosition == true) {
        //console.log(new Date().toISOString() + " AAAA INValid?");
        //console.log(new Date().toISOString() + " CURRENT POSITION " + trackPositionToLoadMillis.current_value);
        //console.log(new Date().toISOString() + " OLD POSITION " + trackPositionToLoadMillis.old_value);
        //console.log(new Date().toISOString() + " USE 0");
        //trackPositionToUseMillis = 0;
        //console.log("CASE D");
        //waitingForValidPosition = false;
        //console.log(trackPositionToUseMillis);
      }
    }
    */
  }
  if (trackPositionToLoadMillis.current_value == trackPositionToLoadMillis.old_value) {
    if (trackPositionToLoadMillis.current_value >= 2 && trackPositionToLoadMillis.current_value <= gameMemory.maximum_duration_millis) {
      if (waitingForValidPosition == true) {
        //console.log(new Date().toISOString() + " BBBB Valid?");
        //console.log(new Date().toISOString() + " " + trackPositionToLoadMillis.current_value);
        //console.log(new Date().toISOString() + " USE CURRENT OR OLD VALUE, DOESN'T MATTER");
        trackPositionToUseMillis = trackPositionToLoadMillis.current_value;
        //console.log("CASE E");
        //waitingForValidPosition = false;
        //console.log(trackPositionToUseMillis);
      }
    }
    /*
    if (trackPositionToLoadMillis.current_value >= 0 && trackPositionToLoadMillis.current_value < 2) {
      if (waitingForValidPosition == true) {
        // Maybe this wont be used at all because most of the time, this is invalid
        //console.log(new Date().toISOString() + " BBBB INValid?");
        //console.log(new Date().toISOString() + " " + trackPositionToLoadMillis.current_value);
        //trackPositionToUseMillis = 0;
        //console.log("CASE F");
        //waitingForValidPosition = false;
        //console.log(trackPositionToUseMillis);
      }
    }
    */
    /*
    if (trackPositionToLoadMillis.current_value <= 0) {
      if (waitingForValidPosition == true) {
        //console.log("CASE G");
        // best thing to do is ignore?
        // Maybe this wont be used at all because most of the time, this is invalid
        //console.log(new Date().toISOString() + " BBBB INValid?");
        //console.log(new Date().toISOString() + " " + trackPositionToLoadMillis.current_value);
        //console.log(new Date().toISOString() + " USE 0");
        //trackPositionToUseMillis = 0;
        //waitingForValidPosition = false;
        //console.log(trackPositionToUseMillis);
      }
    }
    */
  }
  //console.log(new Date().toISOString() + " TEST A trackPositionToUseMillis = " + trackPositionToUseMillis);
  //currentMusicTrackPlaying = readFromAppMemory("Track 2 (Changes 3rd)");
  if (currentMusicTrackPlaying.current_value != currentMusicTrackPlaying.old_value) {
    // Not very consistent, but I think this is the simplest way (more consistent tha before tho I think)
    // Check track ID to see if it is valid before doing the things below
    //console.log("CASE B2");
    //console.log(new Date().toISOString() + " EEE trackPositionToUseMillis = " + trackPositionToUseMillis);
    //console.log(new Date().toISOString() + " TRACK CHANGED FROM " + currentMusicTrackPlaying.old_value + " TO " + currentMusicTrackPlaying.current_value);
    /*
    if (trackPositionToUseMillis >= 2) {
      // Might be valid (continue playing from where the game says this is) but of course I have to keep an eye on the music/cutscene playing status
      console.log("Might be valid (continue playing from where the game says this is)");
    }
    if (trackPositionToUseMillis < 2) {
      // Start playing at the beginning, but of course I have to keep an eye on the music/cutscene playing status
      console.log("Start playing at the beginning");
    }
    */
    audioTrackIndex = gameMemory.radio_data.findIndex(element => element.id == currentMusicTrackPlaying.current_value);
    if (audioTrackIndex < 0) {
      console.log(new Date().toISOString() + " The track ID " + currentMusicTrackPlaying.current_value + " does not exist, stopping Ajaxamp Music Playback");
      ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
      ajaxAmpSetPosition(0); // Float from 0 to 1
      ajaxAmpSetRepeat(0);
      ajaxAmpStop();
      //console.log("STOP PLAYBACK HERE");
      audioTrackData = {
        name: "",
        internal_name: "",
        id: -1,
        loop_track: false,
        start_from_beginning: false,
        audio_file_type: 0,
        override_by_ajaxamp: false,
        custom_volume_level: 255
      };
      waitingToPlayTrack = false;
    }
    if (audioTrackIndex >= 0) {
      audioTrackData = gameMemory.radio_data[audioTrackIndex];
      waitingToPlayTrack = true;
      console.log(new Date().toISOString() + " TRACK CHANGED FROM " + currentMusicTrackPlaying.old_value + " TO " + currentMusicTrackPlaying.current_value);
      //console.log("VALID TRACK ID");
      //console.log(audioTrackData);
      if (audioTrackData.override_by_ajaxamp == false) {
        console.log(new Date().toISOString() + " The track ID " + currentMusicTrackPlaying.current_value + " is set to not be played back, stopping Ajaxamp Music Playback");
        ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
        ajaxAmpSetPosition(0); // Float from 0 to 1
        ajaxAmpSetRepeat(0);
        ajaxAmpStop();
      }
      console.log(new Date().toISOString() + " trackPositionToUseMillis = " + trackPositionToUseMillis);
      trackPositionToUseMillis2 = trackPositionToUseMillis;
      trackPositionToUseMillis = 0;
    }
  }
  if (gameMemory.let_ajaxamp_override_volume_regardless_of_track == true) {
    if (gameMemory.let_ajaxamp_override_volume == true) {
      if (realTimeMusicVolume.current_value != realTimeMusicVolume.old_value) {
        //console.log(new Date().toISOString() + " Changing Real Time Music Volume from " + realTimeMusicVolume.old_value + " to " + realTimeMusicVolume.current_value);
        ajaxAmpSetVolume(realTimeMusicVolume.current_value);
      }
    }
  }
  if (audioTrackData.override_by_ajaxamp == true) {
    if (gameMemory.let_ajaxamp_override_volume_regardless_of_track == false) {
      if (gameMemory.let_ajaxamp_override_volume == true) {
        if (realTimeMusicVolume.current_value != realTimeMusicVolume.old_value) {
          //console.log(new Date().toISOString() + " Changing Real Time Music Volume from " + realTimeMusicVolume.old_value + " to " + realTimeMusicVolume.current_value);
          ajaxAmpSetVolume(realTimeMusicVolume.current_value);
        }
      }
    }
    /*
    if (audioTrackData.audio_file_type == 0 || audioTrackData.audio_file_type == 2) {
      if (musicTrackStatus.current_value != musicTrackStatus.old_value) {
        console.log(new Date().toISOString() + " musicTrackStatus CHANGED FROM " + musicTrackStatus.old_value + " to " + musicTrackStatus.current_value);
      }
    }
    */
    if (waitingToPlayTrack == false) {
      if (audioTrackData.audio_file_type == 1) {
        if (cutsceneTrackStatus.current_value != cutsceneTrackStatus.old_value) {
          //console.log(new Date().toISOString() + " cutsceneTrackStatus CHANGED FROM " + cutsceneTrackStatus.old_value + " to " + cutsceneTrackStatus.current_value);
          if (cutsceneTrackStatus.current_value <= 1) {
            //console.log(new Date().toISOString() + " STOP PLAYBACK HERE? cutsceneTrackStatus.current_value = " + cutsceneTrackStatus.current_value);
            //console.log(new Date().toISOString() + " I trackPositionToUseMillis2 = " + trackPositionToUseMillis2);
            //console.log(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension);
            //ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis2);
            //ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
            //ajaxAmpSetPosition(0); // Float from 0 to 1
            //ajaxAmpSetRepeat(0);
            //ajaxAmpStop();
          }
          if (cutsceneTrackStatus.current_value > 1) {
            //console.log(new Date().toISOString() + " START PLAYING CUTSCENE HERE cutsceneTrackStatus.current_value = " + cutsceneTrackStatus.current_value);
            //console.log(new Date().toISOString() + " J trackPositionToUseMillis2 = " + trackPositionToUseMillis2);
            //waitingToPlayTrack = false;
            //console.log("DID WE GET HERE????????///");
            //console.log(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension);
            if (audioTrackData.loop_track == true) {
              //ajaxAmpSetRepeat(0);
              //ajaxAmpToggleRepeat();
            }
            if (audioTrackData.start_from_beginning == false) {
              if (trackPositionToUseMillis2 < 2) {
                //console.log("PLAY TRACK FROM BEGINNING");
                //ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
                //ajaxAmpSetVolume(realTimeMusicVolume.current_value);
              }
              if (trackPositionToUseMillis2 >= 2) {
                //console.log("PLAY TRACK AT SPECIFIED POSITION");
                //ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis2);
                //ajaxAmpSetVolume(realTimeMusicVolume.current_value);
                //trackPositionToUseMillis2 = 0;
              }
            }
            if (audioTrackData.start_from_beginning == true) {
              //ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
              //ajaxAmpSetVolume(realTimeMusicVolume.current_value);
            }
          }
        }
        if (musicTrackStatus.current_value != musicTrackStatus.old_value) {
          //console.log(new Date().toISOString() + " musicTrackStatus CHANGED FROM " + musicTrackStatus.old_value + " to " + musicTrackStatus.current_value);
          if (musicTrackStatus.current_value <= 2) {
            //console.log(new Date().toISOString() + " STOP PLAYBACK HERE? musicTrackStatus.current_value = " + musicTrackStatus.current_value);
            //console.log(new Date().toISOString() + " K trackPositionToUseMillis2 = " + trackPositionToUseMillis2);
            //console.log(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension);
            //ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis2);
            //ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
            //ajaxAmpSetPosition(0); // Float from 0 to 1
            //ajaxAmpSetRepeat(0);
            //ajaxAmpStop();
          }
          if (musicTrackStatus.current_value > 2 && musicTrackStatus.old_value == 2) {
            //console.log(new Date().toISOString() + " START PLAYING MUSIC HERE musicTrackStatus.current_value = " + musicTrackStatus.current_value);
            console.log(new Date().toISOString() + " L trackPositionToUseMillis2 = " + trackPositionToUseMillis2);
            waitingToPlayTrack = false;
            //console.log("DID WE GET HERE????????///");
            //console.log(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension);
            if (audioTrackData.loop_track == true) {
              //ajaxAmpSetRepeat(0);
              //ajaxAmpToggleRepeat();
            }
            if (audioTrackData.start_from_beginning == false) {
              if (trackPositionToUseMillis2 < 2) {
                //console.log("PLAY TRACK FROM BEGINNING");
                ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
                ajaxAmpSetVolume(realTimeMusicVolume.current_value);
              }
              if (trackPositionToUseMillis2 >= 2) {
                //console.log("PLAY TRACK AT SPECIFIED POSITION");
                ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis2);
                ajaxAmpSetVolume(realTimeMusicVolume.current_value);
                trackPositionToUseMillis2 = 0;
              }
            }
            if (audioTrackData.start_from_beginning == true) {
              ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
              ajaxAmpSetVolume(realTimeMusicVolume.current_value);
            }
          }
        }
      }
      if (audioTrackData.audio_file_type == 0 || audioTrackData.audio_file_type == 2) {
        if (cutsceneTrackStatus.current_value != cutsceneTrackStatus.old_value) {
          //console.log(new Date().toISOString() + " cutsceneTrackStatus CHANGED FROM " + cutsceneTrackStatus.old_value + " to " + cutsceneTrackStatus.current_value);
          if (cutsceneTrackStatus.current_value <= 1) {
            //console.log(new Date().toISOString() + " STOP PLAYBACK HERE? cutsceneTrackStatus.current_value = " + cutsceneTrackStatus.current_value);
            //console.log(new Date().toISOString() + " M trackPositionToUseMillis2 = " + trackPositionToUseMillis2);
            //console.log(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension);
            //ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis2);
            //ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
            //ajaxAmpSetPosition(0); // Float from 0 to 1
            //ajaxAmpSetRepeat(0);
            //ajaxAmpStop();
          }
          if (cutsceneTrackStatus.current_value > 1) {
            //console.log(new Date().toISOString() + " START PLAYING CUTSCENE HERE cutsceneTrackStatus.current_value = " + cutsceneTrackStatus.current_value);
            //console.log(new Date().toISOString() + " N trackPositionToUseMillis2 = " + trackPositionToUseMillis2);
            //waitingToPlayTrack = false;
            //console.log("DID WE GET HERE????????///");
            //console.log(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension);
            if (audioTrackData.loop_track == true) {
              //ajaxAmpSetRepeat(0);
              //ajaxAmpToggleRepeat();
            }
            if (audioTrackData.start_from_beginning == false) {
              if (trackPositionToUseMillis2 < 2) {
                //console.log("PLAY TRACK FROM BEGINNING");
                //ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
                //ajaxAmpSetVolume(realTimeMusicVolume.current_value);
              }
              if (trackPositionToUseMillis2 >= 2) {
                //console.log("PLAY TRACK AT SPECIFIED POSITION");
                //ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis2);
                //ajaxAmpSetVolume(realTimeMusicVolume.current_value);
                //trackPositionToUseMillis2 = 0;
              }
            }
            if (audioTrackData.start_from_beginning == true) {
              //ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
              //ajaxAmpSetVolume(realTimeMusicVolume.current_value);
            }
          }
        }
        if (musicTrackStatus.current_value != musicTrackStatus.old_value) {
          //console.log(new Date().toISOString() + " musicTrackStatus CHANGED FROM " + musicTrackStatus.old_value + " to " + musicTrackStatus.current_value);
          if (musicTrackStatus.current_value <= 2) {
            //console.log(new Date().toISOString() + " STOP PLAYBACK HERE? musicTrackStatus.current_value = " + musicTrackStatus.current_value);
            //console.log(new Date().toISOString() + " O trackPositionToUseMillis2 = " + trackPositionToUseMillis2);
            //console.log(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension);
            //ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis2);
            //ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
            //ajaxAmpSetPosition(0); // Float from 0 to 1
            //ajaxAmpSetRepeat(0);
            //ajaxAmpStop();
          }
          if (musicTrackStatus.current_value > 2 && musicTrackStatus.old_value == 2) {
            //console.log(new Date().toISOString() + " START PLAYING MUSIC HERE musicTrackStatus.current_value = " + musicTrackStatus.current_value);
            console.log(new Date().toISOString() + " P trackPositionToUseMillis2 = " + trackPositionToUseMillis2);
            waitingToPlayTrack = false;
            //console.log("DID WE GET HERE????????///");
            //console.log(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension);
            if (audioTrackData.loop_track == true) {
              //ajaxAmpSetRepeat(0);
              //ajaxAmpToggleRepeat();
            }
            if (audioTrackData.start_from_beginning == false) {
              if (trackPositionToUseMillis2 < 2) {
                //console.log("PLAY TRACK FROM BEGINNING");
                ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
                ajaxAmpSetVolume(realTimeMusicVolume.current_value);
              }
              if (trackPositionToUseMillis2 >= 2) {
                //console.log("PLAY TRACK AT SPECIFIED POSITION");
                ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis2);
                ajaxAmpSetVolume(realTimeMusicVolume.current_value);
                trackPositionToUseMillis2 = 0;
              }
            }
            if (audioTrackData.start_from_beginning == true) {
              ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
              ajaxAmpSetVolume(realTimeMusicVolume.current_value);
            }
          }
        }
      }
    }
    if (waitingToPlayTrack == true) {
      if (audioTrackData.audio_file_type == 1) {
        if (cutsceneTrackStatus.current_value != cutsceneTrackStatus.old_value) {
          //console.log(new Date().toISOString() + " cutsceneTrackStatus CHANGED FROM " + cutsceneTrackStatus.old_value + " to " + cutsceneTrackStatus.current_value);
          if (cutsceneTrackStatus.current_value <= 1) {
            //console.log(new Date().toISOString() + " STOP PLAYBACK HERE? cutsceneTrackStatus.current_value = " + cutsceneTrackStatus.current_value);
            //console.log(new Date().toISOString() + " A trackPositionToUseMillis2 = " + trackPositionToUseMillis2);
            //console.log(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension);
            //ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis2);
            ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
            ajaxAmpSetPosition(0); // Float from 0 to 1
            ajaxAmpSetRepeat(0);
            ajaxAmpStop();
          }
          if (cutsceneTrackStatus.current_value > 1) {
            //console.log(new Date().toISOString() + " START PLAYING CUTSCENE HERE cutsceneTrackStatus.current_value = " + cutsceneTrackStatus.current_value);
            console.log(new Date().toISOString() + " B trackPositionToUseMillis2 = " + trackPositionToUseMillis2);
            waitingToPlayTrack = false;
            //console.log("DID WE GET HERE????????///");
            //console.log(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension);
            if (audioTrackData.loop_track == true) {
              //ajaxAmpSetRepeat(0);
              ajaxAmpToggleRepeat();
            }
            if (audioTrackData.start_from_beginning == false) {
              if (trackPositionToUseMillis2 < 2) {
                //console.log("PLAY TRACK FROM BEGINNING");
                ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
                ajaxAmpSetVolume(realTimeMusicVolume.current_value);
              }
              if (trackPositionToUseMillis2 >= 2) {
                //console.log("PLAY TRACK AT SPECIFIED POSITION");
                ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis2);
                ajaxAmpSetVolume(realTimeMusicVolume.current_value);
                trackPositionToUseMillis2 = 0;
              }
            }
            if (audioTrackData.start_from_beginning == true) {
              ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
              ajaxAmpSetVolume(realTimeMusicVolume.current_value);
            }
          }
        }
        if (musicTrackStatus.current_value != musicTrackStatus.old_value) {
          //console.log(new Date().toISOString() + " musicTrackStatus CHANGED FROM " + musicTrackStatus.old_value + " to " + musicTrackStatus.current_value);
          if (musicTrackStatus.current_value <= 2) {
            //console.log(new Date().toISOString() + " STOP PLAYBACK HERE? musicTrackStatus.current_value = " + musicTrackStatus.current_value);
            //console.log(new Date().toISOString() + " C trackPositionToUseMillis2 = " + trackPositionToUseMillis2);
            //console.log(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension);
            //ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis2);
            ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
            ajaxAmpSetPosition(0); // Float from 0 to 1
            ajaxAmpSetRepeat(0);
            ajaxAmpStop();
          }
          if (musicTrackStatus.current_value > 2) {
            //console.log(new Date().toISOString() + " START PLAYING MUSIC HERE musicTrackStatus.current_value = " + musicTrackStatus.current_value);
            console.log(new Date().toISOString() + " D trackPositionToUseMillis2 = " + trackPositionToUseMillis2);
            waitingToPlayTrack = false;
            //console.log("DID WE GET HERE????????///");
            //console.log(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension);
            if (audioTrackData.loop_track == true) {
              //ajaxAmpSetRepeat(0);
              ajaxAmpToggleRepeat();
            }
            if (audioTrackData.start_from_beginning == false) {
              if (trackPositionToUseMillis2 < 2) {
                //console.log("PLAY TRACK FROM BEGINNING");
                ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
                ajaxAmpSetVolume(realTimeMusicVolume.current_value);
              }
              if (trackPositionToUseMillis2 >= 2) {
                //console.log("PLAY TRACK AT SPECIFIED POSITION");
                ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis2);
                ajaxAmpSetVolume(realTimeMusicVolume.current_value);
                trackPositionToUseMillis2 = 0;
              }
            }
            if (audioTrackData.start_from_beginning == true) {
              ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
              ajaxAmpSetVolume(realTimeMusicVolume.current_value);
            }
          }
        }
      }
      if (audioTrackData.audio_file_type == 0 || audioTrackData.audio_file_type == 2) {
        if (cutsceneTrackStatus.current_value != cutsceneTrackStatus.old_value) {
          //console.log(new Date().toISOString() + " cutsceneTrackStatus CHANGED FROM " + cutsceneTrackStatus.old_value + " to " + cutsceneTrackStatus.current_value);
          if (cutsceneTrackStatus.current_value <= 1) {
            //console.log(new Date().toISOString() + " STOP PLAYBACK HERE? cutsceneTrackStatus.current_value = " + cutsceneTrackStatus.current_value);
            //console.log(new Date().toISOString() + " E trackPositionToUseMillis2 = " + trackPositionToUseMillis2);
            //console.log(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension);
            //ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis2);
            ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
            ajaxAmpSetPosition(0); // Float from 0 to 1
            ajaxAmpSetRepeat(0);
            ajaxAmpStop();
          }
          if (cutsceneTrackStatus.current_value > 1) {
            //console.log(new Date().toISOString() + " START PLAYING CUTSCENE HERE cutsceneTrackStatus.current_value = " + cutsceneTrackStatus.current_value);
            console.log(new Date().toISOString() + " F trackPositionToUseMillis2 = " + trackPositionToUseMillis2);
            waitingToPlayTrack = false;
            //console.log("DID WE GET HERE????????///");
            //console.log(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension);
            if (audioTrackData.loop_track == true) {
              //ajaxAmpSetRepeat(0);
              ajaxAmpToggleRepeat();
            }
            if (audioTrackData.start_from_beginning == false) {
              if (trackPositionToUseMillis2 < 2) {
                //console.log("PLAY TRACK FROM BEGINNING");
                ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
                ajaxAmpSetVolume(realTimeMusicVolume.current_value);
              }
              if (trackPositionToUseMillis2 >= 2) {
                //console.log("PLAY TRACK AT SPECIFIED POSITION");
                ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis2);
                ajaxAmpSetVolume(realTimeMusicVolume.current_value);
                trackPositionToUseMillis2 = 0;
              }
            }
            if (audioTrackData.start_from_beginning == true) {
              ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
              ajaxAmpSetVolume(realTimeMusicVolume.current_value);
            }
          }
        }
        if (musicTrackStatus.current_value != musicTrackStatus.old_value) {
          //console.log(new Date().toISOString() + " musicTrackStatus CHANGED FROM " + musicTrackStatus.old_value + " to " + musicTrackStatus.current_value);
          if (musicTrackStatus.current_value <= 2) {
            //console.log(new Date().toISOString() + " STOP PLAYBACK HERE? musicTrackStatus.current_value = " + musicTrackStatus.current_value);
            //console.log(new Date().toISOString() + " G trackPositionToUseMillis2 = " + trackPositionToUseMillis2);
            //console.log(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension);
            //ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis2);
            ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
            ajaxAmpSetPosition(0); // Float from 0 to 1
            ajaxAmpSetRepeat(0);
            ajaxAmpStop();
          }
          if (musicTrackStatus.current_value > 2) {
            //console.log(new Date().toISOString() + " START PLAYING MUSIC HERE musicTrackStatus.current_value = " + musicTrackStatus.current_value);
            console.log(new Date().toISOString() + " H trackPositionToUseMillis2 = " + trackPositionToUseMillis2);
            waitingToPlayTrack = false;
            //console.log("DID WE GET HERE????????///");
            //console.log(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension);
            if (audioTrackData.loop_track == true) {
              //ajaxAmpSetRepeat(0);
              ajaxAmpToggleRepeat();
            }
            if (audioTrackData.start_from_beginning == false) {
              if (trackPositionToUseMillis2 < 2) {
                //console.log("PLAY TRACK FROM BEGINNING");
                ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
                ajaxAmpSetVolume(realTimeMusicVolume.current_value);
              }
              if (trackPositionToUseMillis2 >= 2) {
                //console.log("PLAY TRACK AT SPECIFIED POSITION");
                ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis2);
                ajaxAmpSetVolume(realTimeMusicVolume.current_value);
                trackPositionToUseMillis2 = 0;
              }
            }
            if (audioTrackData.start_from_beginning == true) {
              ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
              ajaxAmpSetVolume(realTimeMusicVolume.current_value);
            }
          }
        }
      }
    }
  }
  /*
  if (waitingForValidPosition == false) {
    //console.log(new Date().toISOString() + " waitingForValidPosition = " + waitingForValidPosition);
    //console.log(new Date().toISOString() + " AAA trackPositionToUseMillis = " + trackPositionToUseMillis);
    //waitingForValidPosition = true;
  }
  */
  // I AM VERY LOST AND CONFUSED, TIMING SUCKS (but I think I made progress?)
  //waitingForValidPosition = true;
  /*
  if (trackPositionToUseMillis > 0) {
    // This block happens second (right timing?)
    //console.log(new Date().toISOString() + " BBB trackPositionToUseMillis = " + trackPositionToUseMillis);
    //console.log("CASE B1");
    if (currentMusicTrackPlaying.current_value != currentMusicTrackPlaying.old_value) {
      console.log("CASE B2");
      console.log(new Date().toISOString() + " DDD trackPositionToUseMillis = " + trackPositionToUseMillis);
      console.log(new Date().toISOString() + " TRACK CHANGED FROM " + currentMusicTrackPlaying.old_value + " TO " + currentMusicTrackPlaying.current_value);
    }
  }
  */
  /*
  if (trackPositionToUseMillis > 0) {
    // This block happens second (right timing?)
    //console.log(new Date().toISOString() + " BBB trackPositionToUseMillis = " + trackPositionToUseMillis);
    //console.log("CASE B1");
    if (currentMusicTrackPlaying.current_value != currentMusicTrackPlaying.old_value) {
      console.log("CASE B2");
      console.log(new Date().toISOString() + " DDD trackPositionToUseMillis = " + trackPositionToUseMillis);
      console.log(new Date().toISOString() + " TRACK CHANGED FROM " + currentMusicTrackPlaying.old_value + " TO " + currentMusicTrackPlaying.current_value);
    }
  }
  */
  /*
  if (currentMusicTrackPlaying.current_value != currentMusicTrackPlaying.old_value) {
    console.log("CASE B2");
    console.log(new Date().toISOString() + " EEE trackPositionToUseMillis = " + trackPositionToUseMillis);
    console.log(new Date().toISOString() + " TRACK CHANGED FROM " + currentMusicTrackPlaying.old_value + " TO " + currentMusicTrackPlaying.current_value);
  }
  */
  //console.log(new Date().toISOString() + " DDD trackPositionToLoadMillis.current_value = " + trackPositionToLoadMillis.current_value);
  /*
  if (trackPositionToUseMillis <= 0) {
    // This block happens second (right timing?)
    //console.log(new Date().toISOString() + " BBB trackPositionToUseMillis = " + trackPositionToUseMillis);
    //console.log("CASE A1");
    //trackPositionToUseMillis = 0;
    if (currentMusicTrackPlaying.current_value != currentMusicTrackPlaying.old_value) {
      //console.log("CASE A2");
      //console.log(new Date().toISOString() + " CCC trackPositionToUseMillis = " + trackPositionToUseMillis);
      //console.log(new Date().toISOString() + " TRACK CHANGED FROM " + currentMusicTrackPlaying.old_value + " TO " + currentMusicTrackPlaying.current_value);
    }
  }
  */
  //if (currentMusicTrackPlaying.current_value != currentMusicTrackPlaying.old_value) {
    // This block happens first (too early?)
    //waitingForValidPosition = true;
    //console.log(new Date().toISOString() + " FFF trackPositionToUseMillis = " + trackPositionToUseMillis);
    //console.log(new Date().toISOString() + " TRACK CHANGED FROM " + currentMusicTrackPlaying.old_value + " TO " + currentMusicTrackPlaying.current_value);
    /*
    let audioTrackIndexTest = gameMemory.radio_data.findIndex(element => element.id == currentMusicTrackPlaying.current_value);
    //console.log(gameMemory.radio_data[audioTrackIndexTest]);
    if (audioTrackIndexTest < 0) {
      //waitingForValidPosition = true;
      console.log("INVALID TRACK ID");
    }
    */
    // Reset waitingForValidPosition to true when a track ID is invalid (the track ID is not in the list of tracks) (or when the music/cutscene status changes to a specific value or something??????????/)
  //}
  /*
  musicTrackStatus = readFromAppMemory("Is Music Track Playing"); // Observed values are 0, 2, 63 and 80 // 0 = Not playing, 2 = Loading?, 63 and 80 = Playing // See how to make it detect when track loops // If track hasn't changed but music status changed to 63 or 80? then loop? // Track change has to be read first, then track status has to be read right after
  cutsceneTrackStatus = readFromAppMemory("Is Cutscene Track Playing"); // Observed values are 0, 1 and 2 // 0 = Not playing, 1 = Loading?, 2 = Playing
  if (musicTrackStatus.current_value != musicTrackStatus.old_value) {
    console.log(new Date().toISOString() + " MUSIC STATUS CHANGED FROM " + musicTrackStatus.old_value + " TO " + musicTrackStatus.current_value);
    //if (musicTrackStatus.current_value <= 2) {
      //console.log("Resetting at value <= 2");
      //waitingForValidPosition = true;
    //}
  }
  if (cutsceneTrackStatus.current_value != cutsceneTrackStatus.old_value) {
    console.log(new Date().toISOString() + " CUTSCENE STATUS CHANGED FROM " + cutsceneTrackStatus.old_value + " TO " + cutsceneTrackStatus.current_value);
    //waitingForValidPosition = true;
  }
  */
  //console.log(new Date().toISOString() + " DDD trackPositionToUseMillis = " + trackPositionToUseMillis);
}

function overrideGameAudioFiles() {
  // Will not work consistently with newer versions of PCSX2, recommended version is PCSX2 1.6.0 on Windows
  if (gameMemory.let_ajaxamp_override_all_audio_files == false) {
    return;
  }
  playerPointerGlobal = readFromAppMemory("Player Pointer 1");
  if (playerPointerGlobal.current_value <= basePointerAddress || playerPointerGlobal.current_value >= endPointerAddress) {
    return;
  }
  trackPositionToLoadMillis = readFromAppMemory("Position to load audio track Milliseconds");
  if (trackPositionToLoadMillis.current_value != trackPositionToLoadMillis.old_value) {
    //currentMusicTrackPlaying = readFromAppMemory("Track 2 (Changes 3rd)");
    if (trackPositionToLoadMillis.current_value >= 0) {
      //console.log(new Date().toISOString() + " POSITION Changed from " + trackPositionToLoadMillis.old_value + " to " + trackPositionToLoadMillis.current_value);
      currentMusicTrackPlaying = readFromAppMemory("Track 2 (Changes 3rd)");
      //console.log(currentMusicTrackPlaying.current_value);
      if (currentMusicTrackPlaying.current_value != currentMusicTrackPlaying.old_value) {
        //console.log(new Date().toISOString() + " Track changed bruh from " + currentMusicTrackPlaying.old_value + " to " + currentMusicTrackPlaying.current_value);
        //console.log(new Date().toISOString() + " POSITION Changed from " + trackPositionToLoadMillis.old_value + " to " + trackPositionToLoadMillis.current_value);
        audioTrackIndex = gameMemory.radio_data.findIndex(element => element.id == currentMusicTrackPlaying.current_value);
        //console.log(audioTrackIndex);
        if (audioTrackIndex < 0) {
          //console.log("AAA Invalid track index, set winamp volume to 0 and pause (NOT STOP) playback");
          // Reset all volume levels to default levels
          //console.log("RESETTING ALL VOLUME LEVELS A");
          
          writeToAppMemory("SFX Volume 1 (Maximum Volume)", 127);
          writeToAppMemory("SFX Volume 2 (Current Volume)", 127);
          writeToAppMemory("SFX Volume 3 (Settings Menu)", 127)
          writeToAppMemory("Music Volume 1 (Maximum Volume)", 127);
          writeToAppMemory("Music Volume 2 (Current Volume)", 127);
          writeToAppMemory("Music Volume 3 (Settings Menu)", 127);
          
          ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
          ajaxAmpSetPosition(0); // Float from 0 to 1
          ajaxAmpSetRepeat(0);
          ajaxAmpStop();
          audioTrackData = {
            name: "",
            internal_name: "",
            id: -1,
            loop_track: false,
            start_from_beginning: false,
            audio_file_type: 0,
            override_by_ajaxamp: false,
            custom_volume_level: 255
          };
          waitingToPlayTrack = false;
        }
        if (audioTrackIndex >= 0) {
          //console.log(audioTrackIndex);
          audioTrackData = gameMemory.radio_data[audioTrackIndex];
          //console.log("audioTrackData A");
          //console.log(audioTrackData);
          //console.log(new Date().toISOString() + " AAA POSITION Changed from " + trackPositionToLoadMillis.old_value + " to " + trackPositionToLoadMillis.current_value);
          if (trackPositionToLoadMillis.old_value < 0) {
            // Invalid value, fall back to other value
            if (trackPositionToLoadMillis.current_value < 0) {
              // This one is also invalid, so what do we do know? Start at 0
              //console.log("AAA Old value isn't valid, current value isn't valid either");
              trackPositionToUseMillis = 0;
              waitingToPlayTrack = true;
            }
            if (trackPositionToLoadMillis.current_value >= 0) {
              // Valid?
              //console.log("AAA Old value isn't valid, but current value might be");
              trackPositionToUseMillis = trackPositionToLoadMillis.current_value;
              waitingToPlayTrack = true;
            }
          }
          if (trackPositionToLoadMillis.old_value >= 0) {
            // Valid
            if (trackPositionToLoadMillis.current_value < 0) {
              // Not valid
              //console.log("AAA Old value is valid, but current value isn't valid");
              trackPositionToUseMillis = trackPositionToLoadMillis.old_value;
              waitingToPlayTrack = true;
            }
            if (trackPositionToLoadMillis.current_value >= 0) {
              //console.log("AAA Old value and current values are valid");
              if ((trackPositionToLoadMillis.current_value - trackPositionToLoadMillis.old_value) > 0) {
                // Use current value
                //console.log("USE CURRENT POSITION A");
                trackPositionToUseMillis = trackPositionToLoadMillis.current_value;
                waitingToPlayTrack = true;
              }
              if ((trackPositionToLoadMillis.current_value - trackPositionToLoadMillis.old_value) <= 0) {
                // Use old value
                //console.log("USE OLD POSITION A");
                trackPositionToUseMillis = trackPositionToLoadMillis.old_value;
                waitingToPlayTrack = true;
              }
              // Both are valid? Oh shit what do we do know? Pick the highest value only if the difference is higher than 1000ms, if difference is lower than 1000ms, pick the lowest value(?)
              // If both are equal, then uh, pick whatever
            }
          }
        }
      }
      /*
      let audioTrackIndex = gameMemory.radio_data.findIndex(element => element.id == currentMusicTrackPlaying.current_value);
      //console.log(audioTrackIndex);
      if (audioTrackIndex >= 0) {
        //console.log(audioTrackIndex);
        console.log(gameMemory.radio_data[audioTrackIndex]);
      }
      */
    }
    //console.log(new Date().toISOString() + " Load at position " + trackPositionToLoadMillis.current_value +  " ?????");
  }
  currentMusicTrackPlaying = readFromAppMemory("Track 2 (Changes 3rd)");
  if (currentMusicTrackPlaying.current_value != currentMusicTrackPlaying.old_value) {
    //console.log(new Date().toISOString() + " Track changed bruh from " + currentMusicTrackPlaying.old_value + " to " + currentMusicTrackPlaying.current_value);
    //console.log(new Date().toISOString() + " POSITION Changed from " + trackPositionToLoadMillis.old_value + " to " + trackPositionToLoadMillis.current_value);
    audioTrackIndex = gameMemory.radio_data.findIndex(element => element.id == currentMusicTrackPlaying.current_value);
    //console.log(audioTrackIndex);
    if (audioTrackIndex < 0) {
      //console.log("BBB Invalid track index, set winamp volume to 0 and pause (NOT STOP) playback");
      // Reset all volume levels to default levels
      //console.log("RESETTING ALL VOLUME LEVELS B");
      
      writeToAppMemory("SFX Volume 1 (Maximum Volume)", 127);
      writeToAppMemory("SFX Volume 2 (Current Volume)", 127);
      writeToAppMemory("SFX Volume 3 (Settings Menu)", 127)
      writeToAppMemory("Music Volume 1 (Maximum Volume)", 127);
      writeToAppMemory("Music Volume 2 (Current Volume)", 127);
      writeToAppMemory("Music Volume 3 (Settings Menu)", 127);
      
      ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
      ajaxAmpSetPosition(0); // Float from 0 to 1
      ajaxAmpSetRepeat(0);
      ajaxAmpStop();
      audioTrackData = {
        name: "",
        internal_name: "",
        id: -1,
        loop_track: false,
        start_from_beginning: false,
        audio_file_type: 0,
        override_by_ajaxamp: false,
        custom_volume_level: 255
      };
      waitingToPlayTrack = false;
    }
    if (audioTrackIndex >= 0) {
      //console.log(audioTrackIndex);
      audioTrackData = gameMemory.radio_data[audioTrackIndex];
      //console.log("audioTrackData B");
      //console.log(audioTrackData);
      //console.log(new Date().toISOString() + " BBB POSITION Changed from " + trackPositionToLoadMillis.old_value + " to " + trackPositionToLoadMillis.current_value);
      if (trackPositionToLoadMillis.old_value < 0) {
        // Invalid value, fall back to other value
        if (trackPositionToLoadMillis.current_value < 0) {
          // This one is also invalid, so what do we do know? Start at 0
          //console.log("BBB Old value isn't valid, current value isn't valid either");
          trackPositionToUseMillis = 0;
          waitingToPlayTrack = true;
        }
        if (trackPositionToLoadMillis.current_value >= 0) {
          // Valid?
          //console.log("BBB Old value isn't valid, but current value might be");
          trackPositionToUseMillis = trackPositionToLoadMillis.current_value;
          waitingToPlayTrack = true;
        }
      }
      if (trackPositionToLoadMillis.old_value >= 0) {
        // Valid
        if (trackPositionToLoadMillis.current_value < 0) {
          // Not valid
          //console.log("BBB Old value is valid, but current value isn't valid");
          trackPositionToUseMillis = trackPositionToLoadMillis.old_value;
          waitingToPlayTrack = true;
        }
        if (trackPositionToLoadMillis.current_value >= 0) {
          //console.log("BBB Old value and current values are valid");
          if ((trackPositionToLoadMillis.current_value - trackPositionToLoadMillis.old_value) > 0) {
            // Use current value
            //console.log("USE CURRENT POSITION B");
            trackPositionToUseMillis = trackPositionToLoadMillis.current_value;
            waitingToPlayTrack = true;
          }
          if ((trackPositionToLoadMillis.current_value - trackPositionToLoadMillis.old_value) <= 0) {
            // Use old value
            //console.log("USE OLD POSITION B");
            trackPositionToUseMillis = trackPositionToLoadMillis.old_value;
            waitingToPlayTrack = true;
          }
          // Both are valid? Oh shit what do we do know? Pick the highest value only if the difference is higher than 1000ms, if difference is lower than 1000ms, pick the lowest value(?)
          // If both are equal, then uh, pick whatever
        }
      }
    }
  }
  musicTrackStatus = readFromAppMemory("Is Music Track Playing"); // Observed values are 0, 2, 63 and 80 // 0 = Not playing, 2 = Loading?, 63 and 80 = Playing // See how to make it detect when track loops // If track hasn't changed but music status changed to 63 or 80? then loop? // Track change has to be read first, then track status has to be read right after
  cutsceneTrackStatus = readFromAppMemory("Is Cutscene Track Playing"); // Observed values are 0, 1 and 2 // 0 = Not playing, 1 = Loading?, 2 = Playing
  if (musicTrackStatus.current_value != musicTrackStatus.old_value) {
    //console.log(new Date().toISOString() + " status changed from " + musicTrackStatus.old_value + " to " + musicTrackStatus.current_value);
    if (musicTrackStatus.current_value <= 2) {
      if (waitingToPlayTrack == true) {
        //console.log("Track is not ready yet, pause, mute winamp and jump to position 0");
        // Reset all volume levels to default levels
        //console.log("RESETTING ALL VOLUME LEVELS C");
        
        writeToAppMemory("SFX Volume 1 (Maximum Volume)", 127);
        writeToAppMemory("SFX Volume 2 (Current Volume)", 127);
        writeToAppMemory("SFX Volume 3 (Settings Menu)", 127)
        writeToAppMemory("Music Volume 1 (Maximum Volume)", 127);
        writeToAppMemory("Music Volume 2 (Current Volume)", 127);
        writeToAppMemory("Music Volume 3 (Settings Menu)", 127);
        
        ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
        ajaxAmpSetPosition(0); // Float from 0 to 1
        ajaxAmpSetRepeat(0);
        ajaxAmpStop();
      }
    }
    if (musicTrackStatus.current_value > 2) {
      if (musicTrackStatus.old_value == 2) {
        if (waitingToPlayTrack == false) {
          if (currentMusicTrackPlaying.current_value == currentMusicTrackPlaying.old_value) {
            //console.log(new Date().toISOString() + " status changed from " + musicTrackStatus.old_value + " to " + musicTrackStatus.current_value);
            //console.log(new Date().toISOString() + " Track changed bruh from " + currentMusicTrackPlaying.old_value + " to " + currentMusicTrackPlaying.current_value);
            //console.log("Track looped??????????????????????");
            if (audioTrackData.override_by_ajaxamp == true) {
              if (audioTrackData.loop_track == true) {
                ajaxAmpPlay();
              }
            }
          }
        }
      }
      //console.log("TRACK STATUS CHANGED TO VALID POSITION, TRY TO LOOP TRACK HERE?");
      //console.log(new Date().toISOString() + " status changed from " + musicTrackStatus.old_value + " to " + musicTrackStatus.current_value);
      if (waitingToPlayTrack == true) {
        if (audioTrackData.override_by_ajaxamp == true) {
          if (audioTrackData.audio_file_type == 0 || audioTrackData.audio_file_type == 2) {
            // 0 is music, 2 is cutscene, cutscene uses music volume
            // Change the music volumes, and leave sfx volumes at default levels
            //console.log("MUTING MUSIC VOLUME LEVELS AND SETTING SFX TO DEFAULT LEVELS A");
            writeToAppMemory("SFX Volume 1 (Maximum Volume)", 127);
            writeToAppMemory("SFX Volume 2 (Current Volume)", 127);
            writeToAppMemory("SFX Volume 3 (Settings Menu)", 127)
            writeToAppMemory("Music Volume 1 (Maximum Volume)", 1);
            writeToAppMemory("Music Volume 2 (Current Volume)", 0);
            writeToAppMemory("Music Volume 3 (Settings Menu)", 1);
          }
          if (audioTrackData.audio_file_type == 1) {
            // 1 is sfx, sfx uses sfx volume, obviously
            // Change the sfx volumes, and leave music volumes at default levels
            //console.log("MUTING SFX VOLUME LEVELS AND SETTING MUSIC TO DEFAULT LEVELS A");
            writeToAppMemory("SFX Volume 1 (Maximum Volume)", 1);
            writeToAppMemory("SFX Volume 2 (Current Volume)", 0);
            writeToAppMemory("SFX Volume 3 (Settings Menu)", 1);
            writeToAppMemory("Music Volume 1 (Maximum Volume)", 1);
            writeToAppMemory("Music Volume 2 (Current Volume)", 0);
            writeToAppMemory("Music Volume 3 (Settings Menu)", 1);
          }
          //console.log(new Date().toISOString() + " Start playing the track " + currentMusicTrackPlaying.current_value + " at position " + trackPositionToUseMillis);
          //console.log("This is music track");
          //console.log("audioTrackData C");
          //console.log(audioTrackData);
          if (audioTrackData.loop_track == true) {
            ajaxAmpToggleRepeat();
          }
          //ajaxAmpSetVolume(0);
          if (audioTrackData.start_from_beginning == true) {
            ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
            //ajaxAmpSetVolume(gameMemory.ajaxamp_max_volume);
          }
          if (audioTrackData.start_from_beginning == false) {
            ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis);
          }
          //ajaxAmpSetPositionMillis(trackPositionToUseMillis);
          //ajaxAmpSetVolume(gameMemory.ajaxamp_max_volume);
          //ajaxAmpPlay();
          waitingToPlayTrack = false;
        }
      }
    }
  }
  if (cutsceneTrackStatus.current_value != cutsceneTrackStatus.old_value) {
    //console.log(new Date().toISOString() + " status changed from " + cutsceneTrackStatus.old_value + " to " + cutsceneTrackStatus.current_value);
    if (cutsceneTrackStatus.current_value <= 1) {
      if (waitingToPlayTrack == true) {
        //console.log("Track is not ready yet, pause, mute winamp and jump to position 0");
        // Reset all volume levels to default levels
        //console.log("RESETTING ALL VOLUME LEVELS D");
        
        writeToAppMemory("SFX Volume 1 (Maximum Volume)", 127);
        writeToAppMemory("SFX Volume 2 (Current Volume)", 127);
        writeToAppMemory("SFX Volume 3 (Settings Menu)", 127)
        writeToAppMemory("Music Volume 1 (Maximum Volume)", 127);
        writeToAppMemory("Music Volume 2 (Current Volume)", 127);
        writeToAppMemory("Music Volume 3 (Settings Menu)", 127);
        
        ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
        ajaxAmpSetPosition(0); // Float from 0 to 1
        ajaxAmpSetRepeat(0);
        ajaxAmpStop();
      }
    }
    if (cutsceneTrackStatus.current_value > 1) {
      if (waitingToPlayTrack == true) {
        if (audioTrackData.override_by_ajaxamp == true) {
          if (audioTrackData.audio_file_type == 0 || audioTrackData.audio_file_type == 2) {
            // 0 is music, 2 is cutscene, cutscene uses music volume
            // Change the music volumes, and leave sfx volumes at default levels
            //console.log("MUTING MUSIC VOLUME LEVELS AND SETTING SFX TO DEFAULT LEVELS B");
            writeToAppMemory("SFX Volume 1 (Maximum Volume)", 127);
            writeToAppMemory("SFX Volume 2 (Current Volume)", 127);
            writeToAppMemory("SFX Volume 3 (Settings Menu)", 127);
            writeToAppMemory("Music Volume 1 (Maximum Volume)", 1);
            writeToAppMemory("Music Volume 2 (Current Volume)", 0);
            writeToAppMemory("Music Volume 3 (Settings Menu)", 1);
          }
          if (audioTrackData.audio_file_type == 1) {
            // 1 is sfx, sfx uses sfx volume, obviously
            // Change the sfx volumes, and leave music volumes at default levels
            //console.log("MUTING SFX VOLUME LEVELS AND SETTING MUSIC TO DEFAULT LEVELS B");
            writeToAppMemory("SFX Volume 1 (Maximum Volume)", 1);
            writeToAppMemory("SFX Volume 2 (Current Volume)", 0);
            writeToAppMemory("SFX Volume 3 (Settings Menu)", 1);
            writeToAppMemory("Music Volume 1 (Maximum Volume)", 1);
            writeToAppMemory("Music Volume 2 (Current Volume)", 0);
            writeToAppMemory("Music Volume 3 (Settings Menu)", 1);
          }
          //console.log(new Date().toISOString() + " Start playing the track " + currentMusicTrackPlaying.current_value + " at position " + trackPositionToUseMillis);
          //console.log("This is cutscene track");
          //console.log("audioTrackData D");
          //console.log(audioTrackData);
          if (audioTrackData.loop_track == true) {
            ajaxAmpToggleRepeat();
          }
          //ajaxAmpSetVolume(0);
          if (audioTrackData.start_from_beginning == true) {
            ajaxAmpPlayFile(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension));
            //ajaxAmpSetVolume(gameMemory.ajaxamp_max_volume);
          }
          if (audioTrackData.start_from_beginning == false) {
            ajaxAmpPlayFileAtSpecificPositionMillis(encodeURI(gameMemory.path_to_audio_library.replace(/({{path_separator}})+/ig, path.sep) + path.sep + audioTrackData.internal_name + audioFileExtension), trackPositionToUseMillis);
          }
          //ajaxAmpSetPositionMillis(trackPositionToUseMillis);
          //ajaxAmpSetVolume(gameMemory.ajaxamp_max_volume);
          //ajaxAmpPlay();
          waitingToPlayTrack = false;
        }
      }
    }
  }
  if (audioTrackData.override_by_ajaxamp == true) {
    if (waitingToPlayTrack == true) {
      //console.log(new Date().toISOString() + " RESETTING ALL VOLUME LEVELS E");
      writeToAppMemory("SFX Volume 1 (Maximum Volume)", 127);
      writeToAppMemory("SFX Volume 2 (Current Volume)", 127);
      writeToAppMemory("SFX Volume 3 (Settings Menu)", 127);
      writeToAppMemory("Music Volume 1 (Maximum Volume)", 1);
      writeToAppMemory("Music Volume 2 (Current Volume)", 0);
      writeToAppMemory("Music Volume 3 (Settings Menu)", 1);
    }
    if (waitingToPlayTrack == false) {
      //console.log(new Date().toISOString() + " adjust volume levels so there's no music coming from the game?");
      if (audioTrackData.audio_file_type == 0) {
        //console.log(new Date().toISOString() + " MUSIC");
        writeToAppMemory("SFX Volume 1 (Maximum Volume)", 127);
        writeToAppMemory("SFX Volume 2 (Current Volume)", 127);
        writeToAppMemory("SFX Volume 3 (Settings Menu)", 127);
        writeToAppMemory("Music Volume 1 (Maximum Volume)", 1);
        writeToAppMemory("Music Volume 2 (Current Volume)", 0);
        writeToAppMemory("Music Volume 3 (Settings Menu)", 1);
      }
      if (audioTrackData.audio_file_type == 1) {
        //console.log(new Date().toISOString() + " SFX");
        writeToAppMemory("SFX Volume 1 (Maximum Volume)", 1);
        writeToAppMemory("SFX Volume 2 (Current Volume)", 0);
        writeToAppMemory("SFX Volume 3 (Settings Menu)", 1);
        writeToAppMemory("Music Volume 1 (Maximum Volume)", 1);
        writeToAppMemory("Music Volume 2 (Current Volume)", 0);
        writeToAppMemory("Music Volume 3 (Settings Menu)", 1);
      }
      if (audioTrackData.audio_file_type == 2) {
        //console.log(new Date().toISOString() + " CUTSCENE");
        writeToAppMemory("SFX Volume 1 (Maximum Volume)", 127);
        writeToAppMemory("SFX Volume 2 (Current Volume)", 127);
        writeToAppMemory("SFX Volume 3 (Settings Menu)", 127);
        writeToAppMemory("Music Volume 1 (Maximum Volume)", 1);
        writeToAppMemory("Music Volume 2 (Current Volume)", 0);
        writeToAppMemory("Music Volume 3 (Settings Menu)", 1);
      }
    }
  }
  //ajaxAmpGetConsoleStatus();
}

function doTimedAction() {
  //
}

function doCustomReward(username, message, channelName, customRewardId) {
  let notifMessage = "";
  if (customRewardId == undefined) {
    return;
  }
  if (customRewardId != undefined) {
    let customRewardIndex = rewardsConfig.rewards.findIndex(element => element.custom_reward_id == customRewardId);
    if (customRewardIndex <= -1) {
      return;
    }
    if (customRewardIndex > -1) {
      //console.log(rewardsConfig.rewards[customRewardIndex].custom_reward_id);
    }
  }
}

function invertNumberSign(number) {
  if (number >= 0) {
    number = -Math.abs(number);
    return number;
  }
  if (number < 0) {
    number = Math.abs(number);
    return number;
  }
}

function convertRadiansToDegrees(rad) {
  return (rad * (180 / Math.PI));
}

function convertDegreesToRadians(deg) {
  return (deg * (Math.PI / 180));
}

function turnRadiansAround(rad) {
  if (rad >= 0 && rad <= Math.PI) {
    return rad - Math.PI;
  }
  if (rad <= -0 && rad >= -Math.PI) {
    return rad + Math.PI;
  }
}

setInterval(checkIfAppExists, 0);

function checkIfAppExists() {
  if (processName == "") {
    return;
  }
  processList = memoryjs.getProcesses();
  moduleObject = processList.find(element => element.szExeFile == processName);

  //I spent way too long on the pieces of code below figuring out how to do it in the least hacky way possible
  //because I was tired as fuck and was calling a function that doesn't exist, closeProcess(processObject.handle) instead of memoryjs.closeProcess(processObject.handle)
  //I think it works pretty well
  if (moduleObject == undefined) {
    // Check if the module obtained from the list is undefined
    if (processObject != undefined) {
      // If the processObject was previously open, then we close it
      memoryjs.closeProcess(processObject.handle);
      processObject = undefined;
      gameMemoryToDisplay = [];
      gameMemoryToOverride = [];
      characterData = [];
      controlCharacterData = [];
      io.sockets.emit("game_memory_to_display", gameMemoryToDisplay);
      console.log("Process closed");
    }
    return;
  }
  if (moduleObject != undefined) {
    // Check if the module obtained from the list isn't undefined
    if (processObject == undefined) {
      // If the processObject was never opened, we open it
      gameMemory = JSON.parse(fs.readFileSync(gameMemoryConfigFileName, "utf8"));
      chatConfig = JSON.parse(fs.readFileSync(chatConfigFileName, "utf8"));
      rewardsConfig = JSON.parse(fs.readFileSync(rewardsConfigFileName, "utf8"));
      ajaxAmpAddress = gameMemory.ajaxamp_address;
      ajaxAmpPort = gameMemory.ajaxamp_port;
      beybladeSfxFileName = gameMemory.beyblade_sfx_filename;
      audioFileExtension = "." + gameMemory.audio_file_extension;
      beepSoundEffectsArray = chatConfig.beep_sound_effects;
      doNotLoadArray = chatConfig.do_not_load;
      overlayPath = gameMemory.overlay_path;
      overlayPath = overlayPath.replace(/({{path_separator}})+/ig, path.sep);
      baseMemoryAddress = parseInt(gameMemory.base_address, 16);
      endMemoryAddress = parseInt(gameMemory.end_address, 16);
      basePointerAddress = parseInt(gameMemory.base_pointer_address, 16);
      endPointerAddress = parseInt(gameMemory.end_pointer_address, 16);
      overlayFilesList = fs.readdirSync(__dirname + path.sep + overlayPath);
      overlayMp3FilesOnly = overlayFilesList.filter(file => path.extname(file).toLowerCase() === audioFileExtension);
      overlayMp3FilesOnly = overlayMp3FilesOnly.filter(file => file.toLowerCase() !== beybladeSfxFileName);
      for (let doNotLoadArrayIndex = 0; doNotLoadArrayIndex < doNotLoadArray.length; doNotLoadArrayIndex++) {
        overlayMp3FilesOnly = overlayMp3FilesOnly.filter(file => file.toLowerCase() !== doNotLoadArray[doNotLoadArrayIndex]);
        //console.log(doNotLoadArray[doNotLoadArrayIndex]);
      }
      //console.log(overlayMp3FilesOnly);
      processObject = memoryjs.openProcess(processName);
      for (let gameMemoryObjectIndex = 0; gameMemoryObjectIndex < gameMemory.memory_data.length; gameMemoryObjectIndex++) {
        if (gameMemory.memory_data[gameMemoryObjectIndex].to_override == true) {
          gameMemoryToOverride.push(gameMemory.memory_data[gameMemoryObjectIndex]);
        }
        if (gameMemory.memory_data[gameMemoryObjectIndex].to_display == true) {
          //console.log(gameMemory.memory_data[gameMemoryObjectIndex]);
          gameMemoryToDisplay.push(gameMemory.memory_data[gameMemoryObjectIndex]);
        }
      }
      for (let characterDataIndex = 0; characterDataIndex < gameMemory.character_data.length; characterDataIndex++) {
        characterData[characterDataIndex] = gameMemory.character_data[characterDataIndex];
        controlCharacterData[characterDataIndex] = gameMemory.control_character_data[characterDataIndex];

        let characterRegexFlags = characterData[characterDataIndex].character_original_string.replace(/.*\/([gimy]*)$/, "$1");
        let characterRegexPattern = characterData[characterDataIndex].character_original_string.replace(new RegExp("^/(.*?)/" + characterRegexFlags + "$"), "$1");
        let characterRegexData = new RegExp(characterRegexPattern, characterRegexFlags);

        let controlCharacterRegexFlags = controlCharacterData[characterDataIndex].character_original_string.replace(/.*\/([gimy]*)$/, "$1");
        let controlCharacterRegexPattern = controlCharacterData[characterDataIndex].character_original_string.replace(new RegExp("^/(.*?)/" + controlCharacterRegexFlags + "$"), "$1");
        let controlCharacterRegexData = new RegExp(controlCharacterRegexPattern, controlCharacterRegexFlags);

        if (characterData[characterDataIndex].character_original_string === "") {
          characterData[characterDataIndex].character_original_string = "";
        }
        if (characterData[characterDataIndex].character_original_string !== "") {
          characterData[characterDataIndex].character_original_string = characterRegexData;
        }

        if (controlCharacterData[characterDataIndex].character_original_string === "") {
          controlCharacterData[characterDataIndex].character_original_string = "";
        }
        if (controlCharacterData[characterDataIndex].character_original_string !== "") {
          controlCharacterData[characterDataIndex].character_original_string = controlCharacterRegexData;
        }
      }
      let mp3FilesListObject = {
        mp3_files_list: overlayMp3FilesOnly,
        beyblade_filename: beybladeSfxFileName
      };
      //console.log(gameMemoryToDisplay);
      io.sockets.emit("mp3_files_list_object", mp3FilesListObject);
      io.sockets.emit("game_memory_to_display", gameMemoryToDisplay);
      console.log("Process opened");
    }
    playerPointerGlobal = readFromAppMemory("Player Pointer 1");
    if (playerPointerGlobal.current_value <= basePointerAddress || playerPointerGlobal.current_value >= endPointerAddress) {
      return;
    }
    if (playerPointerGlobal.current_value != playerPointerGlobal.old_value) {
      if (gameMemory.let_ajaxamp_override_all_audio_files == true) {
        ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
        ajaxAmpSetPosition(0); // Float from 0 to 1
        ajaxAmpSetRepeat(0);
        ajaxAmpStop();
        //ajaxAmpSetPosition(0.25);
        //ajaxAmpGetConsoleStatus();
      }
      if (playerPointerGlobal.current_value >= basePointerAddress && playerPointerGlobal.current_value <= endPointerAddress) {
        console.log(new Date().toISOString() + " Player Pointer now changed to a valid address");
        if (gameMemory.override_game_settings == true) {
          overrideGameSettings();
        }
        if (gameMemory.let_ajaxamp_override_all_audio_files == true) {
          ajaxAmpSetVolume(0); // Volume is 8 bit-unsigned integer 0-255
          ajaxAmpSetPosition(0); // Float from 0 to 1
          ajaxAmpSetRepeat(0);
          ajaxAmpStop();
          //ajaxAmpSetPosition(0.25);
          //ajaxAmpGetConsoleStatus();
        }
      }
    }
    if (gameMemory.let_ajaxamp_override_all_audio_files == true) {
      //overrideGameAudioFiles();
      overrideGameAudioFiles2();
    }
    /*
    let testVar1 = playerPointerGlobal;
    let testVar2 = readFromAppMemory("Vehicle Pointer");
    let testVar3 = readFromAppMemory("Track 1 (Changes 1st, modify this to change tracks)");
    let testVar5 = readFromAppMemory("Track 2 (Changes 3rd)");
    let testVar6 = readFromAppMemory("Track 3 (Changes 2nd)");
    let testVar4 = readFromAppMemory("Position to load audio track Milliseconds");
    if (testVar4.current_value != testVar4.old_value) {
      console.log("A Track position changed from " + testVar4.old_value + " to " + testVar4.current_value);
    }
    if (testVar3.current_value != testVar3.old_value) {
      console.log("B Track 1 changed from " + testVar3.old_value + " to " + testVar3.current_value);
      console.log("B Track position changed from " + testVar4.old_value + " to " + testVar4.current_value);
    }
    if (testVar5.current_value != testVar5.old_value) {
      console.log("C Track 2 changed from " + testVar5.old_value + " to " + testVar5.current_value);
      console.log("C Track position changed from " + testVar4.old_value + " to " + testVar4.current_value);
    }
    if (testVar6.current_value != testVar6.old_value) {
      console.log("D Track 3 changed from " + testVar6.old_value + " to " + testVar6.current_value);
      console.log("D Track position changed from " + testVar4.old_value + " to " + testVar4.current_value);
    }
    */
    //
    //console.log(readFromAppPointer("Vehicle Pointer", "Vehicle Position X").current_value + "," + readFromAppPointer("Vehicle Pointer", "Vehicle Position Y").current_value + "," + readFromAppPointer("Vehicle Pointer", "Vehicle Position Z").current_value)
    //console.log(readFromAppPointer("Vehicle Pointer", "Vehicle Health").current_value + " " + readFromAppPointer("Vehicle Pointer", "Vehicle ID").current_value);
    //let vehiclePointer = readFromAppMemory("Vehicle Pointer").current_value;
    //let playerPointer = playerPointerGlobal.current_value;
    //let testVar = vehiclePointers.findIndex(element => element == vehiclePointer);
    //console.log(readFromAppPointer("Vehicle Pointer", "Vehicle Position Z").current_value);
    //console.log(readFromAppPointer("Vehicle Pointer", "Vehicle ID").current_value);
    /*
    let vehiclePointerPool = readFromAppBuffer("Vehicle pool", getMemoryDataSize("Vehicle pool")).current_value;
    let vehiclePointerSize = 4;
    let totalVehiclesInPool = getMemoryDataSize("Vehicle pool") / vehiclePointerSize;
    for (let vehicleInPoolIndex = 0; vehicleInPoolIndex < totalVehiclesInPool; vehicleInPoolIndex++) {
      //let vehiclePointerOutput = vehiclePointerPool[(vehiclePointerToRead * vehiclePointerSize) + 0];
      let vehiclePointerToRead = vehicleInPoolIndex;
      let vehiclePointerOutput = (vehiclePointerPool[(vehiclePointerToRead * vehiclePointerSize) + 3] << 24) | (vehiclePointerPool[(vehiclePointerToRead * vehiclePointerSize) + 2] << 16) | (vehiclePointerPool[(vehiclePointerToRead * vehiclePointerSize) + 1] << 8) | (vehiclePointerPool[(vehiclePointerToRead * vehiclePointerSize) + 0]);
      if (vehiclePointerOutput > 0) {
        //console.log("vehiclePointerToRead = " + vehiclePointerToRead.toString().padStart(2, "0") + " , vehiclePointerOutput = 0x" + vehiclePointerOutput.toString("16").toUpperCase().padStart(8, "0"));
        let vehicleIdOffset = parseInt(readFromAppMemory("Vehicle ID").offset, 16);
        let gameBaseAddress = baseMemoryAddress;
        //let vehicleIdAddress = vehiclePointerOutput + gameBaseAddress + vehicleIdOffset;
        let vehicleId = readFromCustomMemoryAddress(vehiclePointerOutput + gameBaseAddress, vehicleIdOffset, "byte", undefined);
        let vehicleIdToFind = gameMemory.vehicle_data.findIndex(element => element.id == vehicleId);
        //console.log(vehicleId);
        //console.log(vehicleIdToFind);
        
        if (vehiclePointerToRead == 56) {
          console.log(vehiclePointerToRead);
          console.log(vehicleId);
        }
        
        //console.log(vehiclePointerToRead);
        //console.log(vehicleId);
        //vehicleId = vehiclePointerOutput + baseMemoryAddress;
        //console.log(vehicleIdAddress.toString("16").toUpperCase().padStart(8, "0"));
        if (vehicleIdToFind >= 1) {
          //console.log("vehiclePointerToRead = " + vehiclePointerToRead.toString().padStart(2, "0") + " , vehiclePointerOutput = 0x" + vehiclePointerOutput.toString("16").toUpperCase().padStart(8, "0"));
          console.log(vehiclePointerToRead.toString().padStart(2, "0") + " = " + gameMemory.vehicle_data[vehicleIdToFind].name);
        }
        //console.log(parseInt(readFromAppMemory("Vehicle ID").offset, 16));
      }
    }
    */
    for (let gameMemoryToDisplayIndex = 0; gameMemoryToDisplayIndex < gameMemoryToDisplay.length; gameMemoryToDisplayIndex++) {
      let objectToReadFromMemory = readFromAppMemory(gameMemoryToDisplay[gameMemoryToDisplayIndex].address_name);
      if (objectToReadFromMemory.current_value !== objectToReadFromMemory.old_value) {
        //console.log("Data updated at gameMemoryToDisplayIndex = " + gameMemoryToDisplayIndex);
        //console.log(objectToReadFromMemory);
        if (objectToReadFromMemory.address_name === "Times you've been wasted" || objectToReadFromMemory.address_name === "Times you've been busted") {
          let memoryValueDelta = objectToReadFromMemory.current_value - objectToReadFromMemory.old_value;
          //console.log("memoryValueDelta = " + memoryValueDelta);
          if (objectToReadFromMemory.old_value >= 0) {
            if (memoryValueDelta === 1) {
              io.sockets.emit("play_sound", "Random");
              //console.log("This is a valid change, all good to go");
              //console.log(objectToReadFromMemory.current_value + " " + objectToReadFromMemory.old_value);
            }
            /*
            if (memoryValueDelta !== 1) {
              console.log("This is NOT a valid change, ignoring");
              console.log(objectToReadFromMemory.current_value + " " + objectToReadFromMemory.old_value);
            }
            */
          }
        }
        io.sockets.emit("game_memory_to_display_to_update", objectToReadFromMemory, gameMemoryToDisplayIndex);
      }
    }
    //console.log(readFromAppPointer("Vehicle Pointer", "Vehicle Health").current_value)
    //console.log(readFromAppPointer("Player Pointer 1", "Player Health").current_value)
    /*
    if (playerPointer >= basePointerAddress && playerPointer <= endPointerAddress) {
      writeToAppMemory("Brightness", 512);
    }
    */
    //console.log(vehiclePointer);
    //console.log(testVar);
    /*
    if (testVar == -1) {
      if (vehiclePointer >= basePointerAddress && vehiclePointer <= endPointerAddress) {
        vehiclePointers.push(vehiclePointer);
        console.log(vehiclePointers);
        console.log(vehiclePointers.length);
      }
    }
    */
    //doTimedAction();
    return;
  }
}

//The functions below were written to make my life easy, they may not look pretty but they do help a lot

function checkIfValueChanged(addressName) {
  let memoryIndex = gameMemory.memory_data.findIndex(element => element.address_name == addressName);
  if (memoryIndex == -1) {
    return "Invalid memory name";
  }
  //gameMemory.memory_data[memoryIndex].current_value = readFromCustomMemoryAddress(parseInt(gameMemory.memory_data[memoryIndex].memory_address, 16), baseMemoryAddress, gameMemory.memory_data[memoryIndex].data_type, memoryIndex);
  if (gameMemory.memory_data[memoryIndex].current_value != gameMemory.memory_data[memoryIndex].old_value) {
    //console.log(gameMemory.memory_data[memoryIndex].address_name + " Value changed " + gameMemory.memory_data[memoryIndex].current_value + " Old " + gameMemory.memory_data[memoryIndex].old_value);
  }
  //console.log(gameMemory.memory_data[memoryIndex].address_name + " H " + gameMemory.memory_data[memoryIndex].current_value + " Old " + gameMemory.memory_data[memoryIndex].old_value)
  gameMemory.memory_data[memoryIndex].old_value = gameMemory.memory_data[memoryIndex].current_value;
  return gameMemory.memory_data[memoryIndex];
}

function processTextForNotificationBox(message) {
  let processedMessage = message;
  processedMessage = processedMessage.normalize("NFD").replace(/[\u007E-\uFFFF]+/ig, "");
  processedMessage = processedMessage.substring(0, 255);
  processedMessage = processedMessage.trim();
  processedMessage = processedMessage.replace(/\s+/ig, " ");
  processedMessage = processedMessage.replace(/[\u0000-\u001F]+/ig, "");
  processedMessage = processedMessage.replace(/[\u007E-\uFFFF]+/ig, "");
  for (let characterDataIndex = 0; characterDataIndex < characterData.length; characterDataIndex++) {
    if (characterData[characterDataIndex].is_enabled == true) {
      if (characterData[characterDataIndex].description != "Unused") {
        processedMessage = processedMessage.replace(characterData[characterDataIndex].character_original_string, characterData[characterDataIndex].character_replacement_string);
      }
    }
    if (controlCharacterData[characterDataIndex].is_enabled == true) {
      if (controlCharacterData[characterDataIndex].description != "Unused") {
        processedMessage = processedMessage.replace(controlCharacterData[characterDataIndex].character_original_string, controlCharacterData[characterDataIndex].character_replacement_string);
      }
    }
  }
  processedMessage = processedMessage.substring(0, 255);
  processedMessage = processedMessage.trim();
  return processedMessage;
}

function writeToNotificationBox(text) {
  if (processObject == undefined) {
    return "Game is not running!";
  }
  let playerPointer = readFromAppMemory("Player Pointer 1");
  if (playerPointer.current_value <= basePointerAddress || playerPointer.current_value >= endPointerAddress) {
    //console.log("Don't do anything I guess");
    return "Game is not ready!";
  }
  text = text.substring(0, 255);
  text = text.trim();
  text = text.replace(/\s+/ig, " ");
  //text = text.replace(/[\u0000-\u001F]+/ig, "");
  //text = text.replace(/[\u007E-\uFFFF]+/ig, "");
  text = text.trim();
  text = text.substring(0, 255);
  text = text.trim();
  let textBuffer = Buffer.alloc(getMemoryDataSize("Notification Box 1"), 0);
  writeToAppBuffer("Notification Box 1", textBuffer);
  writeToAppBuffer("Notification Box 2", textBuffer);
  writeToAppBuffer("Notification Box 3", textBuffer); // I have to clear all notification boxes for the game to display repeat messages
  textBuffer.write(text, 0, getMemoryDataSize("Notification Box 1"), "utf16le");
  console.log(new Date().toISOString() + " [NOTIFBOX] " + text);
  return writeToAppBuffer("Notification Box 1", textBuffer);
}

function writeToAppPointerBuffer(pointerName, offsetName, buffer) {
  if (processObject == undefined) {
    return "Game is not running!";
  }
  // The code below is an unreadable mess
  let pointerIndex = gameMemory.memory_data.findIndex(element => element.address_name == pointerName);
  let offsetIndex = gameMemory.memory_data.findIndex(element => element.address_name == offsetName);
  if (pointerIndex == -1 || offsetIndex == -1) {
    return "Invalid pointer name or offset name";
  }
  if (gameMemory.memory_data[pointerIndex].pointer_type == "none" || gameMemory.memory_data[offsetIndex].offset_type == "none") {
    return "Pointer address provided is not a pointer or offset address provided is not an offset";
  }
  if (gameMemory.memory_data[offsetIndex].is_writeable == false) {
    gameMemory.memory_data[offsetIndex].current_value = "This offset is marked as Read Only";
    return gameMemory.memory_data[offsetIndex];
  }
  gameMemory.memory_data[pointerIndex].current_value = readFromCustomMemoryAddress(parseInt(gameMemory.memory_data[pointerIndex].memory_address, 16), baseMemoryAddress, gameMemory.memory_data[pointerIndex].data_type, pointerIndex);
  if (gameMemory.memory_data[pointerIndex].current_value == 0) {
    gameMemory.memory_data[offsetIndex].memory_address = "0x0";
    gameMemory.memory_data[offsetIndex].current_value = -1;
    return gameMemory.memory_data[offsetIndex];
  }
  gameMemory.memory_data[offsetIndex].memory_address = "0x" + (parseInt(gameMemory.memory_data[offsetIndex].offset, 16) + gameMemory.memory_data[pointerIndex].current_value).toString(16);
  gameMemory.memory_data[offsetIndex].current_value = writeToCustomMemoryAddressBuffer(parseInt(gameMemory.memory_data[offsetIndex].memory_address, 16), baseMemoryAddress, buffer, offsetIndex);
  return gameMemory.memory_data[offsetIndex];
}

function readFromAppPointerBuffer(pointerName, offsetName, size) {
  if (processObject == undefined) {
    return "Game is not running!";
  }
  // The code below is an unreadable mess
  let pointerIndex = gameMemory.memory_data.findIndex(element => element.address_name == pointerName);
  let offsetIndex = gameMemory.memory_data.findIndex(element => element.address_name == offsetName);
  if (pointerIndex == -1 || offsetIndex == -1) {
    return "Invalid pointer name or offset name";
  }
  if (gameMemory.memory_data[pointerIndex].pointer_type == "none" || gameMemory.memory_data[offsetIndex].offset_type == "none") {
    return "Pointer address provided is not a pointer or offset address provided is not an offset";
  }
  gameMemory.memory_data[pointerIndex].current_value = readFromCustomMemoryAddress(parseInt(gameMemory.memory_data[pointerIndex].memory_address, 16), baseMemoryAddress, gameMemory.memory_data[pointerIndex].data_type, pointerIndex);
  if (gameMemory.memory_data[pointerIndex].current_value == 0) {
    gameMemory.memory_data[offsetIndex].memory_address = "0x0";
    gameMemory.memory_data[offsetIndex].current_value = -1;
    return gameMemory.memory_data[offsetIndex];
  }
  gameMemory.memory_data[offsetIndex].memory_address = "0x" + (parseInt(gameMemory.memory_data[offsetIndex].offset, 16) + gameMemory.memory_data[pointerIndex].current_value).toString(16);
  gameMemory.memory_data[offsetIndex].current_value = readFromCustomMemoryAddressBuffer(parseInt(gameMemory.memory_data[offsetIndex].memory_address, 16), baseMemoryAddress, size, offsetIndex);
  return gameMemory.memory_data[offsetIndex];
}

function writeToAppBuffer(addressName, buffer) {
  if (processObject == undefined) {
    return "Game is not running!";
  }
  let memoryIndex = gameMemory.memory_data.findIndex(element => element.address_name == addressName);
  if (memoryIndex == -1) {
    return "Invalid memory name";
  }
  if (gameMemory.memory_data[memoryIndex].is_writeable == false) {
    gameMemory.memory_data[memoryIndex].current_value = "This address is marked as Read Only";
    return gameMemory.memory_data[memoryIndex];
  }
  gameMemory.memory_data[memoryIndex].current_value = writeToCustomMemoryAddressBuffer(parseInt(gameMemory.memory_data[memoryIndex].memory_address, 16), baseMemoryAddress, buffer, memoryIndex);
  return gameMemory.memory_data[memoryIndex];
}

function readFromAppBuffer(addressName, size) {
  if (processObject == undefined) {
    return "Game is not running!";
  }
  let memoryIndex = gameMemory.memory_data.findIndex(element => element.address_name == addressName);
  if (memoryIndex == -1) {
    return "Invalid memory name";
  }
  gameMemory.memory_data[memoryIndex].current_value = readFromCustomMemoryAddressBuffer(parseInt(gameMemory.memory_data[memoryIndex].memory_address, 16), baseMemoryAddress, size, memoryIndex);
  return gameMemory.memory_data[memoryIndex];
}

function writeToCustomMemoryAddressBuffer(address, offset, buffer, index) {
  if (processObject == undefined) {
    return "Game is not running!";
  }
  // Read and Write sync are faster than async by about 50000~60000 nanoseconds
  let valueChanged = false;
  if (index <= -1) {
    index = undefined;
  }
  if (index == undefined) {
    memoryjs.writeBuffer(processObject.handle, address + offset, buffer);
    return readFromCustomMemoryAddressBuffer(address, offset, buffer.byteLength, index);
  }
  memoryjs.writeBuffer(processObject.handle, address + offset, buffer);
  if (gameMemory.memory_data[index].current_value != gameMemory.memory_data[index].old_value) {
    //console.log(gameMemory.memory_data[index].current_value + " A " + gameMemory.memory_data[index].old_value);
    valueChanged = true;
  }
  gameMemory.memory_data[index].old_value = gameMemory.memory_data[index].current_value;
  return readFromCustomMemoryAddressBuffer(address, offset, buffer.byteLength, index); // Just doing this to make sure the memory was written correctly
}

function readFromCustomMemoryAddressBuffer(address, offset, size, index) {
  if (processObject == undefined) {
    return "Game is not running!";
  }
  // Read and Write sync are faster than async by about 50000~60000 nanoseconds
  let valueChanged = false;
  if (index <= -1) {
    index = undefined;
  }
  if (index == undefined) {
    return memoryjs.readBuffer(processObject.handle, address + offset, size);
  }
  if (gameMemory.memory_data[index].current_value != gameMemory.memory_data[index].old_value) {
    //console.log(gameMemory.memory_data[index].current_value + " B " + gameMemory.memory_data[index].old_value);
    valueChanged = true;
  }
  gameMemory.memory_data[index].old_value = gameMemory.memory_data[index].current_value;
  return memoryjs.readBuffer(processObject.handle, address + offset, size);
}

function writeToCustomMemoryAddress(address, offset, value, dataType, index) {
  if (processObject == undefined) {
    return "Game is not running!";
  }
  // Read and Write sync are faster than async by about 50000~60000 nanoseconds
  let valueChanged = false;
  if (index <= -1) {
    index = undefined;
  }
  if (index == undefined) {
    memoryjs.writeMemory(processObject.handle, address + offset, value, dataType);
    return readFromCustomMemoryAddress(address, offset, dataType, index);
  }
  memoryjs.writeMemory(processObject.handle, address + offset, value, dataType);
  if (gameMemory.memory_data[index].current_value != gameMemory.memory_data[index].old_value) {
    //console.log(gameMemory.memory_data[index].current_value + " A " + gameMemory.memory_data[index].old_value);
    valueChanged = true;
  }
  gameMemory.memory_data[index].old_value = gameMemory.memory_data[index].current_value;
  return readFromCustomMemoryAddress(address, offset, dataType, index); // Just doing this to make sure the memory was written correctly
}

function readFromCustomMemoryAddress(address, offset, dataType, index) {
  if (processObject == undefined) {
    return "Game is not running!";
  }
  // Read and Write sync are faster than async by about 50000~60000 nanoseconds
  let valueChanged = false;
  if (index <= -1) {
    index = undefined;
  }
  if (index == undefined) {
    return memoryjs.readMemory(processObject.handle, address + offset, dataType);
  }
  if (gameMemory.memory_data[index].current_value != gameMemory.memory_data[index].old_value) {
    //console.log(gameMemory.memory_data[index].current_value + " B " + gameMemory.memory_data[index].old_value);
    valueChanged = true;
  }
  gameMemory.memory_data[index].old_value = gameMemory.memory_data[index].current_value;
  return memoryjs.readMemory(processObject.handle, address + offset, dataType);
}

function writeToAppMemory(addressName, value) {
  if (processObject == undefined) {
    return "Game is not running!";
  }
  let memoryIndex = gameMemory.memory_data.findIndex(element => element.address_name == addressName);
  if (memoryIndex == -1) {
    return "Invalid memory name";
  }
  if (gameMemory.memory_data[memoryIndex].is_writeable == false) {
    gameMemory.memory_data[memoryIndex].current_value = "This address is marked as Read Only";
    return gameMemory.memory_data[memoryIndex];
  }
  gameMemory.memory_data[memoryIndex].current_value = writeToCustomMemoryAddress(parseInt(gameMemory.memory_data[memoryIndex].memory_address, 16), baseMemoryAddress, value, gameMemory.memory_data[memoryIndex].data_type, memoryIndex);
  return gameMemory.memory_data[memoryIndex];
}

function readFromAppMemory(addressName) {
  if (processObject == undefined) {
    return "Game is not running!";
  }
  let memoryIndex = gameMemory.memory_data.findIndex(element => element.address_name == addressName);
  if (memoryIndex == -1) {
    return "Invalid memory name";
  }
  gameMemory.memory_data[memoryIndex].current_value = readFromCustomMemoryAddress(parseInt(gameMemory.memory_data[memoryIndex].memory_address, 16), baseMemoryAddress, gameMemory.memory_data[memoryIndex].data_type, memoryIndex);
  return gameMemory.memory_data[memoryIndex];
}

function readFromAppPointer(pointerName, offsetName) {
  if (processObject == undefined) {
    return "Game is not running!";
  }
  // The code below is an unreadable mess
  let pointerIndex = gameMemory.memory_data.findIndex(element => element.address_name == pointerName);
  let offsetIndex = gameMemory.memory_data.findIndex(element => element.address_name == offsetName);
  if (pointerIndex == -1 || offsetIndex == -1) {
    return "Invalid pointer name or offset name";
  }
  if (gameMemory.memory_data[pointerIndex].pointer_type == "none" || gameMemory.memory_data[offsetIndex].offset_type == "none") {
    return "Pointer address provided is not a pointer or offset address provided is not an offset";
  }
  gameMemory.memory_data[pointerIndex].current_value = readFromCustomMemoryAddress(parseInt(gameMemory.memory_data[pointerIndex].memory_address, 16), baseMemoryAddress, gameMemory.memory_data[pointerIndex].data_type, pointerIndex);
  if (gameMemory.memory_data[pointerIndex].current_value == 0) {
    gameMemory.memory_data[offsetIndex].memory_address = "0x0";
    gameMemory.memory_data[offsetIndex].current_value = -1;
    return gameMemory.memory_data[offsetIndex];
  }
  gameMemory.memory_data[offsetIndex].memory_address = "0x" + (parseInt(gameMemory.memory_data[offsetIndex].offset, 16) + gameMemory.memory_data[pointerIndex].current_value).toString(16);
  gameMemory.memory_data[offsetIndex].current_value = readFromCustomMemoryAddress(parseInt(gameMemory.memory_data[offsetIndex].memory_address, 16), baseMemoryAddress, gameMemory.memory_data[offsetIndex].data_type, offsetIndex);
  return gameMemory.memory_data[offsetIndex];
}

function writeToAppPointer(pointerName, offsetName, value) {
  if (processObject == undefined) {
    return "Game is not running!";
  }
  // The code below is an unreadable mess
  let pointerIndex = gameMemory.memory_data.findIndex(element => element.address_name == pointerName);
  let offsetIndex = gameMemory.memory_data.findIndex(element => element.address_name == offsetName);
  if (pointerIndex == -1 || offsetIndex == -1) {
    return "Invalid pointer name or offset name";
  }
  if (gameMemory.memory_data[pointerIndex].pointer_type == "none" || gameMemory.memory_data[offsetIndex].offset_type == "none") {
    return "Pointer address provided is not a pointer or offset address provided is not an offset";
  }
  if (gameMemory.memory_data[offsetIndex].is_writeable == false) {
    gameMemory.memory_data[offsetIndex].current_value = "This offset is marked as Read Only";
    return gameMemory.memory_data[offsetIndex];
  }
  gameMemory.memory_data[pointerIndex].current_value = readFromCustomMemoryAddress(parseInt(gameMemory.memory_data[pointerIndex].memory_address, 16), baseMemoryAddress, gameMemory.memory_data[pointerIndex].data_type, pointerIndex);
  if (gameMemory.memory_data[pointerIndex].current_value == 0) {
    gameMemory.memory_data[offsetIndex].memory_address = "0x0";
    gameMemory.memory_data[offsetIndex].current_value = -1;
    return gameMemory.memory_data[offsetIndex];
  }
  gameMemory.memory_data[offsetIndex].memory_address = "0x" + (parseInt(gameMemory.memory_data[offsetIndex].offset, 16) + gameMemory.memory_data[pointerIndex].current_value).toString(16);
  gameMemory.memory_data[offsetIndex].current_value = writeToCustomMemoryAddress(parseInt(gameMemory.memory_data[offsetIndex].memory_address, 16), baseMemoryAddress, value, gameMemory.memory_data[offsetIndex].data_type, offsetIndex);
  return gameMemory.memory_data[offsetIndex];
}

function getMemoryDataSize(addressName) {
  if (processObject == undefined) {
    return "Game is not running!";
  }
  let memoryIndex = gameMemory.memory_data.findIndex(element => element.address_name == addressName);
  if (memoryIndex == -1) {
    return "Invalid memory name";
  }
  return gameMemory.memory_data[memoryIndex].size;
}

var server = http.createServer(handleRequest);
server.listen(chatConfig.webserver_port);

console.log("Server started on port " + chatConfig.webserver_port);

function handleRequest(req, res) {
  // What did we request?
  var pathname = req.url;

  // If blank let's ask for index.html
  if (pathname == "/") {
    pathname = "/index.html";
  }

  // Ok what's our file extension
  var ext = path.extname(pathname);

  // Map extension to file type
  var typeExt = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".ttf": "font/ttf",
    ".ico": "image/vnd.microsoft.icon",
    ".mp3": "audio/mpeg",
    ".png": "image/png",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".json": "application/json",
    ".txt": "text/plain"
  };

  // What is it?  Default to plain text
  var contentType = typeExt[ext] || "text/plain";

  // User file system module
  fs.readFile(__dirname + pathname,
    // Callback function for reading
    function(err, data) {
      // if there is an error
      if (err) {
        res.writeHead(500);
        return res.end("Error loading " + pathname);
      }
      // Otherwise, send the data, the contents of the file
      res.writeHead(200, {
        "Content-Type": contentType
      });
      res.end(data);
    }
  );
}


// WebSocket Portion
// WebSockets work with the HTTP server
//var io = require("socket.io").listen(server);
var io = require("socket.io")(server);

// Register a callback function to run when we have an individual connection
// This is run for each individual user that connects
io.sockets.on("connection",
  // We are given a websocket object in our function
  function(socket) {
    gameMemory = JSON.parse(fs.readFileSync(gameMemoryConfigFileName, "utf8"));
    chatConfig = JSON.parse(fs.readFileSync(chatConfigFileName, "utf8"));
    rewardsConfig = JSON.parse(fs.readFileSync(rewardsConfigFileName, "utf8"));
    beepSoundEffectsArray = chatConfig.beep_sound_effects;
    doNotLoadArray = chatConfig.do_not_load;
    console.log("We have a new client: " + socket.id);
    if (processObject == undefined) {
      console.log("Client connected, app NOT running");
      gameMemoryToDisplay = [];
      gameMemoryToOverride = [];
      characterData = [];
      controlCharacterData = [];
      io.sockets.emit("game_memory_to_display", gameMemoryToDisplay);
    }
    if (processObject != undefined) {
      console.log("Client connected, app running");
      gameMemory = JSON.parse(fs.readFileSync(gameMemoryConfigFileName, "utf8"));
      chatConfig = JSON.parse(fs.readFileSync(chatConfigFileName, "utf8"));
      rewardsConfig = JSON.parse(fs.readFileSync(rewardsConfigFileName, "utf8"));
      ajaxAmpAddress = gameMemory.ajaxamp_address;
      ajaxAmpPort = gameMemory.ajaxamp_port;
      beybladeSfxFileName = gameMemory.beyblade_sfx_filename;
      audioFileExtension = "." + gameMemory.audio_file_extension;
      beepSoundEffectsArray = chatConfig.beep_sound_effects;
      doNotLoadArray = chatConfig.do_not_load;
      overlayPath = gameMemory.overlay_path;
      overlayPath = overlayPath.replace(/({{path_separator}})+/ig, path.sep);
      baseMemoryAddress = parseInt(gameMemory.base_address, 16);
      endMemoryAddress = parseInt(gameMemory.end_address, 16);
      basePointerAddress = parseInt(gameMemory.base_pointer_address, 16);
      endPointerAddress = parseInt(gameMemory.end_pointer_address, 16);
      overlayFilesList = fs.readdirSync(__dirname + path.sep + overlayPath);
      overlayMp3FilesOnly = overlayFilesList.filter(file => path.extname(file).toLowerCase() === audioFileExtension);
      overlayMp3FilesOnly = overlayMp3FilesOnly.filter(file => file.toLowerCase() !== beybladeSfxFileName);
      for (let doNotLoadArrayIndex = 0; doNotLoadArrayIndex < doNotLoadArray.length; doNotLoadArrayIndex++) {
        overlayMp3FilesOnly = overlayMp3FilesOnly.filter(file => file.toLowerCase() !== doNotLoadArray[doNotLoadArrayIndex]);
        //console.log(doNotLoadArray[doNotLoadArrayIndex]);
      }
      //console.log(overlayMp3FilesOnly);
      gameMemoryToDisplay = [];
      gameMemoryToOverride = [];
      characterData = [];
      controlCharacterData = [];
      for (let gameMemoryObjectIndex = 0; gameMemoryObjectIndex < gameMemory.memory_data.length; gameMemoryObjectIndex++) {
        if (gameMemory.memory_data[gameMemoryObjectIndex].to_override == true) {
          gameMemoryToOverride.push(gameMemory.memory_data[gameMemoryObjectIndex]);
        }
        if (gameMemory.memory_data[gameMemoryObjectIndex].to_display == true) {
          //console.log(gameMemory.memory_data[gameMemoryObjectIndex]);
          gameMemoryToDisplay.push(gameMemory.memory_data[gameMemoryObjectIndex]);
        }
      }
      for (let characterDataIndex = 0; characterDataIndex < gameMemory.character_data.length; characterDataIndex++) {
        characterData[characterDataIndex] = gameMemory.character_data[characterDataIndex];
        controlCharacterData[characterDataIndex] = gameMemory.control_character_data[characterDataIndex];

        let characterRegexFlags = characterData[characterDataIndex].character_original_string.replace(/.*\/([gimy]*)$/, "$1");
        let characterRegexPattern = characterData[characterDataIndex].character_original_string.replace(new RegExp("^/(.*?)/" + characterRegexFlags + "$"), "$1");
        let characterRegexData = new RegExp(characterRegexPattern, characterRegexFlags);

        let controlCharacterRegexFlags = controlCharacterData[characterDataIndex].character_original_string.replace(/.*\/([gimy]*)$/, "$1");
        let controlCharacterRegexPattern = controlCharacterData[characterDataIndex].character_original_string.replace(new RegExp("^/(.*?)/" + controlCharacterRegexFlags + "$"), "$1");
        let controlCharacterRegexData = new RegExp(controlCharacterRegexPattern, controlCharacterRegexFlags);

        if (characterData[characterDataIndex].character_original_string === "") {
          characterData[characterDataIndex].character_original_string = "";
        }
        if (characterData[characterDataIndex].character_original_string !== "") {
          characterData[characterDataIndex].character_original_string = characterRegexData;
        }

        if (controlCharacterData[characterDataIndex].character_original_string === "") {
          controlCharacterData[characterDataIndex].character_original_string = "";
        }
        if (controlCharacterData[characterDataIndex].character_original_string !== "") {
          controlCharacterData[characterDataIndex].character_original_string = controlCharacterRegexData;
        }
      }
      let mp3FilesListObject = {
        mp3_files_list: overlayMp3FilesOnly,
        beyblade_filename: beybladeSfxFileName
      };
      //console.log(gameMemoryToDisplay);
      io.sockets.emit("mp3_files_list_object", mp3FilesListObject);
      io.sockets.emit("game_memory_to_display", gameMemoryToDisplay);
    }
    io.sockets.emit("beep_sound_effects_array", beepSoundEffectsArray);
    socket.on("disconnect", function() {
      console.log("Client has disconnected: " + socket.id);
    });
  }
);