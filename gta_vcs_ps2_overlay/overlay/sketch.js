var socket;
var soundEffects = [];
var beyBladeSoundEffect;
var hourlyBeepSoundEffects = [0, 0];
var secondaryBeepSoundEffects = [0, 0];
var gameMemoryToDisplay = [];
var textToDisplay = "";
var valueToDisplay = 0;
var currentValueToDisplay = 0;
var textTransparency = 255; // range from 0 to 255
var secondCurrent = 0;
var secondOld = 0;
var minuteCurrent = 0;
var minuteOld = 0;
var hourCurrent = 0;
var hourOld = 0;
var mp3FilesListObject = {
  mp3_files_list: [],
  beyblade_filename: ""
};
var beepSoundEffectsArray = [
  {
    enabled: false,
    file_names: [
      "watch_beep_1.mp3",
      "watch_beep_2.mp3" 
    ],
    type: "hourly"
  },
  {
    enabled: false,
    file_names: [
      "watch_beep_1_short.mp3",
      "watch_beep_2_short.mp3" 
    ],
    type: "secondary"
  }
];
var enableHourlyBeeps = false;
var enableSecondaryBeeps = false;
function preload() {
  font = loadFont("VCREAS_3.0.ttf"); // Pixel perfect font, set to 20 points for crispy pixel perfectness, mono font
  font2 = loadFont("Pricedown.ttf"); // GTA font, not mono
  soundFormats("mp3");
  // For now the sound effects are hardcoded, maybe a better way would be to just look for all files that have the mp3 extension (Done, this is done on server side, then the server sends the list to the overlay when the overlay connects to the server, which then loads the MP3 files)
  /*
  beyBladeSoundEffect = loadSound("beyblade.mp3");
  soundEffects.push(loadSound("bing_bong.mp3"));
  soundEffects.push(loadSound("Taco_Bell_Bong.mp3"));
  soundEffects.push(loadSound("we_got_him.mp3"));
  soundEffects.push(loadSound("price_is_right_horn.mp3"));
  soundEffects.push(loadSound("fail_sound.mp3"));
  soundEffects.push(loadSound("bruh.mp3"));
  soundEffects.push(loadSound("nelson_haha.mp3"));
  soundEffects.push(loadSound("sad_trombone.mp3"));
  soundEffects.push(loadSound("nice_job_dick_face.mp3"));
  soundEffects.push(loadSound("smb_death.mp3"));
  soundEffects.push(loadSound("smb_game_over.mp3"));
  soundEffects.push(loadSound("smb_death_game_over.mp3"));
  soundEffects.push(loadSound("smb_death_game_over_short.mp3"));
  soundEffects.push(loadSound("pretty_stupid.mp3"));
  */
  // Uncomment the block below if for some reason you want to hardload the beep sound effects (idk why you would do that tho because the server already sends the list of beep sound effects and tells the overlay to load the files)
  /*
  //console.log(beepSoundEffectsArray);
  for (let beepSoundEffectsArrayIndex = 0; beepSoundEffectsArrayIndex < beepSoundEffectsArray.length; beepSoundEffectsArrayIndex++) {
    //console.log(beepSoundEffectsArray[beepSoundEffectsArrayIndex]);
    if (beepSoundEffectsArray[beepSoundEffectsArrayIndex].type == "hourly") {
      enableHourlyBeeps = beepSoundEffectsArray[beepSoundEffectsArrayIndex].enabled;
      //console.log(enableHourlyBeeps);
      //console.log("HOURLY WOOOOOOOO");
      for (let hourlyBeepSoundEffectsIndex = 0; hourlyBeepSoundEffectsIndex < beepSoundEffectsArray[beepSoundEffectsArrayIndex].file_names.length; hourlyBeepSoundEffectsIndex++) {
        hourlyBeepSoundEffects[hourlyBeepSoundEffectsIndex] = loadSound(beepSoundEffectsArray[beepSoundEffectsArrayIndex].file_names[hourlyBeepSoundEffectsIndex]);
        //console.log("Found the hourly file " + beepSoundEffectsArray[beepSoundEffectsArrayIndex].file_names[hourlyBeepSoundEffectsIndex]);
      }
    }
    if (beepSoundEffectsArray[beepSoundEffectsArrayIndex].type == "secondary") {
      enableSecondaryBeeps = beepSoundEffectsArray[beepSoundEffectsArrayIndex].enabled;
      //console.log(enableSecondaryBeeps);
      //console.log("SECONDARY WOOOOOOOO");
      for (let secondaryBeepSoundEffectsIndex = 0; secondaryBeepSoundEffectsIndex < beepSoundEffectsArray[beepSoundEffectsArrayIndex].file_names.length; secondaryBeepSoundEffectsIndex++) {
        secondaryBeepSoundEffects[secondaryBeepSoundEffectsIndex] = loadSound(beepSoundEffectsArray[beepSoundEffectsArrayIndex].file_names[secondaryBeepSoundEffectsIndex]);
        //console.log("Found the secondary file " + beepSoundEffectsArray[beepSoundEffectsArrayIndex].file_names[secondaryBeepSoundEffectsIndex]);
      }
    }
  }
  */
}
function setup() {
  noSmooth();
  frameRate(60);
  createCanvas(1920, 1080);
  background("#00000000");
  socket = io.connect();
  socket.on("play_sound", function(data) {
    //console.log(new Date().toISOString() + " " + data);
    if (data == "Beyblade") {
      beyBladeSoundEffect.play();
    }
    if (data == "Random") {
      let randomSoundEffectIndex = Math.floor(Math.random() * soundEffects.length);
      //console.log("randomSoundEffectIndex = " + randomSoundEffectIndex);
      soundEffects[randomSoundEffectIndex].play();
    }
  });
  socket.on("game_memory_to_display_to_update", function(data, index) {
    //let gameMemoryToDisplayIndex = gameMemoryToDisplay.findIndex(element => element.address_name == data.address_name);
    let gameMemoryToDisplayIndex = index;
    //console.log("Received updated data");
    if (gameMemoryToDisplayIndex < 0) {
      console.log("Invalid index, ignoring");
    }
    if (gameMemoryToDisplayIndex >= 0) {
      //console.log("Valid index");
      //console.log("Received updated data");
      gameMemoryToDisplay[gameMemoryToDisplayIndex] = data;
      //console.log("Received updated data gameMemoryToDisplayIndex = " + gameMemoryToDisplayIndex);
      //console.log(gameMemoryToDisplay[gameMemoryToDisplayIndex]);
    }
  });
  socket.on("game_memory_to_display", function(data) {
    //console.log("Received new array");
    gameMemoryToDisplay = data;
    //console.log(gameMemoryToDisplay);
  });
  socket.on("mp3_files_list_object", function(data) {
    //console.log("Received MP3 files list");
    mp3FilesListObject = data;
    //console.log(mp3FilesListObject);
    beyBladeSoundEffect = loadSound(mp3FilesListObject.beyblade_filename);
    for (let mp3FilesListIndex = 0; mp3FilesListIndex < mp3FilesListObject.mp3_files_list.length; mp3FilesListIndex++) {
      //console.log(mp3FilesListObject.mp3_files_list[mp3FilesListIndex]);
      soundEffects[mp3FilesListIndex] = loadSound(mp3FilesListObject.mp3_files_list[mp3FilesListIndex]); // Todo: ignore files that are the beep sound effects (DONE) (remove the files from the array on server side before sending array to overlay? or maybe make a "do not load" array in the config file and use that instead?) (DONE, I used the "do not load" idea, and all I had to do was filter the files out using the filter function on server side (move the config from game memory to chat_config) (DONE))
    }
  });
  socket.on("beep_sound_effects_array", function(data) {
    //console.log("Received beep_sound_effects_array");
    beepSoundEffectsArray = data;
    //console.log(beepSoundEffectsArray);
    for (let beepSoundEffectsArrayIndex = 0; beepSoundEffectsArrayIndex < beepSoundEffectsArray.length; beepSoundEffectsArrayIndex++) {
      //console.log(beepSoundEffectsArray[beepSoundEffectsArrayIndex]);
      if (beepSoundEffectsArray[beepSoundEffectsArrayIndex].type == "hourly") {
        enableHourlyBeeps = beepSoundEffectsArray[beepSoundEffectsArrayIndex].enabled;
        //console.log(enableHourlyBeeps);
        //console.log("HOURLY WOOOOOOOO");
        for (let hourlyBeepSoundEffectsIndex = 0; hourlyBeepSoundEffectsIndex < beepSoundEffectsArray[beepSoundEffectsArrayIndex].file_names.length; hourlyBeepSoundEffectsIndex++) {
          hourlyBeepSoundEffects[hourlyBeepSoundEffectsIndex] = loadSound(beepSoundEffectsArray[beepSoundEffectsArrayIndex].file_names[hourlyBeepSoundEffectsIndex]);
          //console.log("Found the hourly file " + beepSoundEffectsArray[beepSoundEffectsArrayIndex].file_names[hourlyBeepSoundEffectsIndex]);
        }
      }
      if (beepSoundEffectsArray[beepSoundEffectsArrayIndex].type == "secondary") {
        enableSecondaryBeeps = beepSoundEffectsArray[beepSoundEffectsArrayIndex].enabled;
        //console.log(enableSecondaryBeeps);
        //console.log("SECONDARY WOOOOOOOO");
        for (let secondaryBeepSoundEffectsIndex = 0; secondaryBeepSoundEffectsIndex < beepSoundEffectsArray[beepSoundEffectsArrayIndex].file_names.length; secondaryBeepSoundEffectsIndex++) {
          secondaryBeepSoundEffects[secondaryBeepSoundEffectsIndex] = loadSound(beepSoundEffectsArray[beepSoundEffectsArrayIndex].file_names[secondaryBeepSoundEffectsIndex]);
          //console.log("Found the secondary file " + beepSoundEffectsArray[beepSoundEffectsArrayIndex].file_names[secondaryBeepSoundEffectsIndex]);
        }
      }
    }
  });
}

function draw() {
  clear();
  background("#00000000");
  //console.log(new Date().toISOString() + " " + textTransparency + " " + textTransparencyStatus + " " + currentValueToDisplay);
  //console.log(socket.connected);
  let textXPosition = 10;
  let textYPosition = 700;
  secondCurrent = new Date().getUTCSeconds();
  minuteCurrent = new Date().getUTCMinutes();
  hourCurrent = new Date().getUTCHours();
  if (socket.connected == false) {
    currentValueToDisplay = 0;
    gameMemoryToDisplay = [];
  }
  if (secondCurrent != secondOld) {
    if (minuteCurrent != minuteOld) {
      if (enableSecondaryBeeps == true) {
        if (minuteCurrent == 15 || minuteCurrent == 30 || minuteCurrent == 45) {
          if (secondaryBeepSoundEffects.length > 0) {
            let randomSecondaryBeepSoundEffectIndex = Math.floor(Math.random() * secondaryBeepSoundEffects.length);
            //console.log(new Date().toISOString() + " randomSecondaryBeepSoundEffectIndex = " + randomSecondaryBeepSoundEffectIndex);
            secondaryBeepSoundEffects[randomSecondaryBeepSoundEffectIndex].play();
          }
        }
      }
      if (enableHourlyBeeps == true) {
        if (minuteCurrent == 0) {
          if (hourCurrent != hourOld) {
            if (hourlyBeepSoundEffects.length > 0) {
              let randomHourlyBeepSoundEffectIndex = Math.floor(Math.random() * hourlyBeepSoundEffects.length);
              //console.log(new Date().toISOString() + " randomHourlyBeepSoundEffectIndex = " + randomHourlyBeepSoundEffectIndex);
              hourlyBeepSoundEffects[randomHourlyBeepSoundEffectIndex].play();
            }
          }
        }
      }
    }
  }
  if (gameMemoryToDisplay.length != 0) {
    if (secondCurrent % 3 == 0) {
      if (secondCurrent != secondOld) {
        //textTransparencyStatus = -1;
        //console.log("Time changed from " + secondOld + " to " + secondCurrent);
        currentValueToDisplay++;
        if (textTransparency <= 0) {
          //currentValueToDisplay++;
          //textTransparencyStatus = 0;
        }
        if (currentValueToDisplay > gameMemoryToDisplay.length - 1) {
          currentValueToDisplay = 0;
          //console.log("Resetting counter");
        }
      }
    }
    //console.log("socket.connected = " + socket.connected);
    
    if (gameMemoryToDisplay[currentValueToDisplay].decimal_places_to_display < 0) {
      // Don't do anything
      //console.log("Test A");
      //console.log(gameMemoryToDisplay[currentValueToDisplay].decimal_places_to_display);
      valueToDisplay = gameMemoryToDisplay[currentValueToDisplay].current_value;
    }

    if (gameMemoryToDisplay[currentValueToDisplay].decimal_places_to_display >= 0) {
      //gameMemoryToDisplay[currentValueToDisplay].current_value = gameMemoryToDisplay[currentValueToDisplay].current_value.toFixed(2);
      //gameMemoryToDisplay[currentValueToDisplay].current_value = gameMemoryToDisplay[currentValueToDisplay].current_value.toFixed(gameMemoryToDisplay[currentValueToDisplay].decimal_places_to_display);
      valueToDisplay = gameMemoryToDisplay[currentValueToDisplay].current_value.toFixed(gameMemoryToDisplay[currentValueToDisplay].decimal_places_to_display);
      //console.log("Test B");
    }
    if (gameMemoryToDisplay[currentValueToDisplay].display_total == false) {
      textToDisplay = gameMemoryToDisplay[currentValueToDisplay].address_name + "\n" + gameMemoryToDisplay[currentValueToDisplay].prepend_string + valueToDisplay + gameMemoryToDisplay[currentValueToDisplay].append_string;
    }
    if (gameMemoryToDisplay[currentValueToDisplay].display_total == true) {
      textToDisplay = gameMemoryToDisplay[currentValueToDisplay].address_name + "\n" + gameMemoryToDisplay[currentValueToDisplay].prepend_string + valueToDisplay + gameMemoryToDisplay[currentValueToDisplay].append_string + "/" + gameMemoryToDisplay[currentValueToDisplay].prepend_string + gameMemoryToDisplay[currentValueToDisplay].total + gameMemoryToDisplay[currentValueToDisplay].append_string;
    }
    textFont(font2);
    textSize(72);
    strokeWeight(6);
    stroke("#000000FF");
    textAlign(LEFT, TOP);
    // Shadow
    fill("#000000FF");
    textLeading(56);
    text(textToDisplay, textXPosition + 6, textYPosition + 6);
    // Main text
    fill("#FFFFFFFF");
    textLeading(56);
    text(textToDisplay, textXPosition, textYPosition);
  }
  if (gameMemoryToDisplay.length == 0) {
    textFont(font2);
    textSize(72);
    strokeWeight(6);
    stroke("#000000FF");
    textAlign(LEFT, TOP);
    // Shadow
    fill("#000000FF");
    textLeading(56);
    text("Waiting for data", textXPosition + 6, textYPosition + 6);
    // Main text
    fill("#FFFFFFFF");
    textLeading(56);
    text("Waiting for data", textXPosition, textYPosition);
  }
  // Nothing
  textFont(font);
  textSize(60);
  strokeWeight(4);
  stroke("#000000FF");
  textAlign(LEFT, TOP);
  // Main text
  fill("#FFFFFFFF");
  textLeading(56);
  text(new Date().toISOString(), 5, 1024);
  secondOld = secondCurrent;
  minuteOld = minuteCurrent;
  hourOld = hourCurrent;
}