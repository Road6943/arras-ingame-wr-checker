// ==UserScript==
// @name         Arras In-Game WR Checker/WRA Bot Alternative
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  You can use this to check recrds in-game, or when the wra bot goes down at the end of each month
// @author       Road
// @match        https://arras.io
// @grant        none
// ==/UserScript==

// TODO: replace alerts with non-intrusive popups, and replace prompts similarly, maybe with doc.createElement input

// userscripts aren't allowed on discord, so you'd need to use this elsewhere
// it does work on arras, though, so you can check a record mid game (I'll replace the alerts and prompts with non intrusive dialogs later)

const recordsURL = "https://spreadsheets.google.com/feeds/cells/1HDQtELScci0UlVR4ESnvhM6V8bgAtNX8GI3pzq7cG8M/1/public/basic?range=G5:I5&alt=json";
const gamemodesURL = "https://spreadsheets.google.com/feeds/cells/1HDQtELScci0UlVR4ESnvhM6V8bgAtNX8GI3pzq7cG8M/1/public/basic?range=F5:F5&alt=json";
// taken from efrost's bot code
const shorthands = {
    FFA: "FFA",
    MAZE: "Maze",
    "2TDM": "2TDM",
    "2MAZE": "Maze 2TDM",
    "4TDM": "4TDM",
    "4MAZE": "Maze 4TDM",
    "O4MAZE": "Open Maze 4TDM",
    PTDM: "Portal 4TDM",
    DOM: "Domination (All)",
    MOT: "Mothership",
    PMOT: "Portal Mothership",
    OTDM: "Open 3/4 TDM",
}


async function getGamemodesData(gamemodesURL) {
    let response = await fetch(gamemodesURL);
    let data = await response.json();

    data = data.feed.entry
        .map(item => item.content.$t) // look at the json returned in order to make sense of this stuff
        .shift() // array only has 1 element, so set data to that element (the string of an array)
        .slice(1, -1) // remove the [ at the beginning and the ] at the end
        .split(",") // turn string into array again
        .map(item => item.slice(1,-1)) // JSON adds extra "" around everything, so remove them
        ;

    return data;
}

async function getRecordsData(recordsURL) {
    let response = await fetch(recordsURL);
    let data = await response.json();

    data = data.feed.entry
            .map(item => item.content.$t) // look at the json returned in order to make sense of this stuff
            .join("") // sheets has max char limit per cell, so this recombines the split up data into one giant string again
            .slice(2, -2) // remove the [[ at the beginning and ]] at the end
            .split("],[") // make each sheet row into an array row
            .map(row => row.split(",")) // split each array row into another array, representing each cell in that row
            .map(row => row.map(cell => // JSON returns extra "" around every string, so this removes them and also converts the score cells into ints
            cell.includes(`"`) ? cell.slice(1,-1) : parseInt(cell, 10)
            ))
            ;

    return data;
}

function normalizeName(name) {
    return name
            .trim() // "  Auto Tri-Angle  " --> "AutoTri-Angle"
            .toLowerCase() // "Auto Tri-Angle" --> "auto tri-angle"
            .replace(/-/gi, "") // "auto tri-angle" --> "auto triangle" (uses regex to remove all dashes)
            .replace(/\//gi, "") // "open 3/4 tdm (all)" --> "open 34 tdm (all)" == uses regex to remove forward slash
            .replace(/\(/gi, "") // "open 34 tdm (all)" --> "open 34 tdm all)" == uses regex to remove opening parenthesis
            .replace(/\)/gi, "") // "open 34 tdm all)" --> "open 34 tdm all" == uses regex to remove closing parenthesis
            .replace(/ /gi, "") // "open 34 tdm all" --> "open34tdmall" == uses regex to remove spaces
            ;                   // "auto triangle" --> "autotriangle" (uses regex to remove all spaces)
}

// 123456 --> 123.46k, and 1234567 --> 1.23mil
// also here's the spreadsheet's custom number format formula for comparison:
// [<999999]0.00,"k";[<999999999]0.00,,"mil"
function formatScore(score) {
  if (score >= 1e6) {
    return (score / 1e6).toFixed(2) + "mil";
  }
  else {
    return (score / 1000).toFixed(2) + "k";
  }
}

async function getRecord() {
    const recordsData = await getRecordsData(recordsURL);
    const gamemodesData = await getGamemodesData(gamemodesURL);

    // make message to prompt user with
    let msg = "Enter the name of a tank followed by a gamemode shorthand. The gamemode shorthand must be the final word in your input. The shorthands are shown below:\n\n";
    for (const shorthand in shorthands) {
        msg += `${shorthand}:   ${shorthands[shorthand]}\n`;
    }
    msg += "\nFor example, a valid input would be\nOcto Tank 2TDM";

    // turn user input into a tank and gamemode
    let query = prompt(msg);
    query = query.trim().split(/ +/); // splits by all whitespaces
    let queryGamemode = query.pop();
    const queryTank = query.join("");

    // get tank row
    const tanks = recordsData.map(row => normalizeName(row[1]));
    const tankRowIndex = tanks.findIndex(tank => tank === normalizeName(queryTank));
    if (tankRowIndex === -1) {
        alert(`Sorry, I could not find the tank named ${queryTank}`);
        return;
    }

    // get gamemode column
    if (queryGamemode === "" || queryGamemode === NaN || typeof queryGamemode !== "string") {
        alert("Sorry, an invalid gamemode name was entered!");
        return;
    }
    queryGamemode = queryGamemode.toUpperCase();

    // ensure an actual shorthand was entered
    if (!shorthands.hasOwnProperty(queryGamemode)) {
        alert(`Sorry, you have not entered a valid gamemode shorthand name!`);
        return;
    }
    queryGamemode = shorthands[queryGamemode];

    const gamemodes = recordsData[0];
    let gamemodeColumnIndex = -1;
    // findIndex is glitching out, so I'm using a for loop instead
    for (let i = 0; i < gamemodes.length; i++) {
        if (gamemodes[i] === "" || gamemodes[i] === NaN) continue;
        if (typeof gamemodes[i] !== "string") continue;

        if (normalizeName(gamemodes[i]) === normalizeName(queryGamemode)) {
            gamemodeColumnIndex = i;
            break;
        }
    }
    if (gamemodeColumnIndex === -1) {
        alert(`Sorry, I could not find the gamemode named ${queryGamemode}`);
        return;
    }

    const score = recordsData[tankRowIndex][gamemodeColumnIndex - 1];
    const name = recordsData[tankRowIndex][gamemodeColumnIndex];
    const proofLink = recordsData[tankRowIndex][gamemodeColumnIndex + 1];

    const tankImage = recordsData[tankRowIndex][0];
    const tank = recordsData[tankRowIndex][1];
    const gm = recordsData[0][gamemodeColumnIndex];

    const wrMsg = `The current record for ${tank} in ${gm} is:\n\n${formatScore(score)} by ${name}\n\n${proofLink}`;

    alert(wrMsg);
}

(function() {
    'use strict';

    document.addEventListener("keydown", evt => {
        if (evt.key === '{') { // dont use anything on a number key because it also hits the stat upgrades
            getRecord();
        }
    })
})();
