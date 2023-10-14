const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { prefix, token } = require("./config.json");
const { decoder, encoder, Field } = require("tetris-fumen");
const { createCanvas } = require("canvas");
const GIFEncoder = require("gifencoder");
const { http, https } = require("follow-redirects");
const fs = require("fs");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
});

const colors = {
    I: { normal: "#009999", light: "#00FFFF" },
    T: { normal: "#990099", light: "#FF00FF" },
    S: { normal: "#009900", light: "#00FF00" },
    Z: { normal: "#990000", light: "#FF0000" },
    L: { normal: "#996600", light: "#FF9900" },
    J: { normal: "#0000BB", light: "#0000FF" },
    O: { normal: "#999900", light: "#FFFF00" },
    X: { normal: "#999999", light: "#CCCCCC" },
    Empty: { normal: "#f3f3ed" },
};

function draw(fumenPage, tilesize, numrows, transparent) {
    const field = fumenPage.field;
    const operation = fumenPage.operation;

    function operationFilter(e) {
        return i == e.x && j == e.y;
    }

    if (numrows == undefined) {
        numrows = 0;
        for (i = 0; i < 10; i++) {
            for (j = 0; j < 23; j++) {
                if (field.at(i, j) != "_") {
                    numrows = Math.max(numrows, j);
                }
                if (operation != undefined && operation.positions().filter(operationFilter).length > 0) {
                    numrows = Math.max(numrows, j);
                }
            }
        }
        numrows += 2;
    }
    const width = tilesize * 10;
    const height = numrows * tilesize;

    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");

    var gridCvs = createCanvas(tilesize, tilesize);
    var gridCtx = gridCvs.getContext("2d");

    gridCtx.fillStyle = "#000000";
    if (transparent) gridCtx.fillStyle = "rgba(0, 0, 0, 0)";
    gridCtx.fillRect(0, 0, tilesize, tilesize);
    gridCtx.strokeStyle = "#333333";
    gridCtx.strokeRect(0, 0, tilesize, tilesize);
    var pattern = context.createPattern(gridCvs, "repeat");

    context.clearRect(0, 0, width, height);
    context.fillStyle = pattern;
    context.fillRect(0, 0, width, height);

    for (i = 0; i < 10; i++) {
        for (j = 0; j < numrows; j++) {
            if (field.at(i, j) != "_") {
                context.fillStyle = colors[field.at(i, j)].light;
                context.fillRect(i * tilesize + 1, height - (j + 1) * tilesize + 1, tilesize - 2, tilesize - 2);
            }
            if (operation != undefined && operation.positions().filter(operationFilter).length > 0) {
                context.fillStyle = colors[operation.type].light;
                context.fillRect(i * tilesize + 1, height - (j + 1) * tilesize + 1, tilesize - 2, tilesize - 2);
            }
        }
    }
    return canvas;
}

function drawFumens(fumenPages, tilesize, numrows, start, end, transparent, delay) {
    if (end == undefined) {
        end = fumenPages.length;
    }
    if (numrows == undefined) {
        numrows = 0;
        function operationFilter(e) {
            return i == e.x && j == e.y;
        }
        for (x = start; x < end; x++) {
            field = fumenPages[x].field;
            operation = fumenPages[x].operation;
            for (i = 0; i < 10; i++) {
                for (j = 0; j < 23; j++) {
                    if (field.at(i, j) != "_") {
                        numrows = Math.max(numrows, j);
                    }
                    if (operation != undefined && operation.positions().filter(operationFilter).length > 0) {
                        numrows = Math.max(numrows, j);
                    }
                }
            }
        }
        numrows += 2;
    }
    numrows = Math.min(23, numrows);
    const width = tilesize * 10;
    const height = numrows * tilesize;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    const encoder = new GIFEncoder(width, height);
    encoder.start();
    encoder.setRepeat(0); // 0 for repeat, -1 for no-repeat
    encoder.setDelay(500); // frame delay in ms
    if (delay != undefined) encoder.setDelay(delay);
    encoder.setQuality(1); // image quality. 10 is default.
    if (transparent) {
        encoder.setTransparent("rgba(0, 0, 0, 0)");
    }
    for (x = start; x < end; x++) {
        encoder.addFrame(draw(fumenPages[x], tilesize, numrows, transparent).getContext("2d"));
    }
    return encoder;
}

async function parse_fumen_argument(argument) {
    // raw fumen code or a direct link with the raw fumen code in its url
    const fumen_regex = /(\[)?\d+@(.+)/;
    let match = argument.match(fumen_regex);
    if (match) return "v" + match[0];

    // redirecting link such as tinyurl
    let url = argument;

    try {
        return new Promise((resolve, reject) => {
            let client = url.startsWith('https://') ? https : undefined;
            if (client == undefined) client = url.startsWith('http://') ? http : undefined;
            if (client == undefined) resolve(undefined);
        
            const options = {
              method: 'HEAD',
              followRedirects: true,
            };
        
            const req = client.request(url, options, (res) => {
                let match = res.responseUrl.match(fumen_regex);
                if (match) resolve("v" + match[0]);
                resolve(undefined);
            });
        
            req.on('error', (error) => {
                resolve(undefined);
            });
        
            req.end();
          });
        }
    catch {return undefined;}
}

client.on("messageCreate", async function (message) {
    // console.log(message.content);
    if (message.content.startsWith(prefix)) {
        let split = message.content.split(" ");
        let command = split[0].toLowerCase();
        command = command.slice(1); // assuming prefix is legnth 1, remove prefix
        let command_arguments = split.slice(1); // not including command

        if (command == "fumen") {
            console.log(command);
            console.log(command_arguments);

            if (
                command_arguments.length == 0 ||
                command_arguments[0].toLowerCase() == "help"
            ) {
                await message.channel.send(
                    `fumen command.\nUsage: ${prefix}fumen fumen_code {size=22} {height=undefined} {page_index=0} {delay=0} {start=0} {end=undefined}\nOptional arguments are in {braces}, default usage is to just provide the fumen code.\nProviding page_index will generate a PNG of that single frame of the fumen`
                );
                // should I learn how to do a fancy embed idk
                return;
            }

            let fumen = await parse_fumen_argument(command_arguments[0]);
            if (fumen == undefined) {
                await message.channel.send("Could not parse fumen.");
                return;
            }
            console.log(fumen);

            let size = 22;
            let height = undefined;
            let page = 0;
            let start = 0;
            let end = undefined;
            let delay = 500;

            if (command_arguments.length > 1 && command_arguments[1] != "undefined")
                size = parseInt(command_arguments[1]);
            if (command_arguments.length > 2 && command_arguments[2] != "undefined")
                height = parseInt(command_arguments[2]);
            if (command_arguments.length > 3 && command_arguments[3] != "undefined")
                page = parseInt(command_arguments[3]);
            if (command_arguments.length > 4 && command_arguments[4] != "undefined")
                delay = parseInt(command_arguments[4]);
            if (command_arguments.length > 5 && command_arguments[5] != "undefined")
                start = parseInt(command_arguments[5]);
            if (command_arguments.length > 6 && command_arguments[6] != "undefined")
                end = parseInt(command_arguments[6]);

            try {
                let pages = decoder.decode(fumen);

                if (pages.length == 1 || page != 0) {
                    var canvas = draw(pages[page], size, height, false);
                    var buffer = canvas.toBuffer("image/png");
                    fs.writeFileSync("output.png", buffer);
                    await message.channel.send({ files: ["output.png"] });
                } else if (pages.length > 1) {
                    let gif = drawFumens(pages, size, height, start, end, false, delay);
                    await gif.createReadStream().pipe(fs.createWriteStream("output.gif"));
                    await gif.finish();
                    await message.channel.send({ files: ["output.gif"] });
                }
            } catch (error) {
                console.error(error);
            }
        }

        if (command == "help") {
            // idk add this command later
        }
    }
});

client.login(token);
