const http = require("http")
const express = require("express");
const app = express();
const cors = require('cors');
const socketIo = require("socket.io");
const fs = require("fs");
const PORT = process.env.PORT || '8080';

const server = http.Server(app).listen(PORT);
const io = socketIo(server, {origins:'*:*'});
const clients = {};

console.log('listening on port', PORT);

// to allow CORS
io.origins('*:*');

// enable CORS
app.use(cors());

// Serve static resources
app.use(express.static(__dirname + "/../client/"));
app.use(express.static(__dirname + "/../node_modules/"));

app.get("/", (req, res) => {
    const stream = fs.createReadStream(__dirname + "/../client/index.html");
    stream.pipe(res);
});

var games = {}; // opponent: scoket.id of the opponent, symbol = "X" | "O", socket: player's socket
var unmatched;

// When a client connects
io.on("connection", function(socket) {
    let id = socket.id;
    const token = socket.handshake.query.gameId;
    const character = socket.handshake.query.character;

    console.log(`${socket.id} playing as ${character}`);
    clients[socket.id] = socket;

    socket.on("disconnect", () => {// Bind event for that socket (player)
        console.log("Client disconnected. ID: ", socket.id);
        delete clients[socket.id];
        socket.broadcast.emit("clientdisconnect", socket.id);
    });

    join(socket, character); // Fill 'players' data structure

    if (opponentOf(socket)) { // If the current player has an opponent the game can begin

        // console.log( ' > ', games[socket.id].socket.id );
        // console.log(' > ', games[opponentOf(socket).id].socket.id );
        console.log( '(1) =', games[socket.id].character);
        console.log( '(2) =', games[opponentOf(socket).id].character);
        socket.emit("game.begin", { // Send the game.begin event to the player
            symbol: games[socket.id].symbol,
            gameId: socket.id,
            player: games[socket.id].character,
            opponent: games[opponentOf(socket).id].character
        });

        opponentOf(socket).emit("game.begin", { // Send the game.begin event to the opponent
            symbol: games[opponentOf(socket).id].symbol,
            gameId: socket.id,
            player: games[opponentOf(socket).id].character,
            opponent: games[socket.id].character
        });
    }


    // Event for when any player makes a move
    socket.on("make.move", function(data) {
        if (!opponentOf(socket)) {
            // This shouldn't be possible since if a player doens't have an opponent the game board is disabled
            return;
        }

        // Validation of the moves can be done here

        socket.emit("move.made", data); // Emit for the player who made the move
        opponentOf(socket).emit("move.made", data); // Emit for the opponent
    });

    // Event to inform player that the opponent left
    socket.on('disconnect', function() {
        if (opponentOf(socket)) {
        opponentOf(socket).emit("opponent.left");
        }
    });

    socket.on('new.game', () => {
        io.emit('request.new.game', '');
        io.emit('notify', 'Se ha comenzado un nuevo juego.');
    });
});


function join(socket, character) {
    console.log(`${character} from game ${socket.id}`);
    // console.log('how many games do we have?', players.length);

    games[socket.id] = {
        opponent: unmatched,
        symbol: "X",
        socket: socket,
        character: character
    };
    // console.log('player 1 !', character);

    // If 'unmatched' is defined it contains the socket.id of the player who was waiting for an opponent
    // then, the current socket is player #2
    if (unmatched) { 
        // console.log('player 2');
        games[socket.id].symbol = "O";
        games[unmatched].opponent = socket.id;
        // games[unmatched].character = character;
        unmatched = null;
        // console.log('player 2 !', character, unmatched);
    } else { //If 'unmatched' is not define it means the player (current socket) is waiting for an opponent (player #1)
        // console.log('player 1');
        unmatched = socket.id;
        //games[socket.id]['character'] = character;
        // console.log('this is unmatched!!', socket.id);
    }
}

function opponentOf(socket) {
    // console.log('opponentOf socket', socket);
    if (!games[socket.id].opponent) {
        return;
    }
    return games[games[socket.id].opponent].socket;
}