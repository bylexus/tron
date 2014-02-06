var express = require('express.io');
var app = express();
var path = require('path');
var _ = require('underscore');

app.http().io();
app.set('port', process.env.PORT || 3000);
app.use(express.static(path.join(__dirname, 'public')));



var GameManager = {
    games: {},

    getRoomForGame: function(gameName) {
        var room = app.io.sockets.manager.rooms['/'+gameName];
        if (!room) throw 'Room does not exist';
        return room;
    },



    createGameName: function() {
        var chars= 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
        var nameLength = 8;
        var name = '';
        for (var i = 0; i < nameLength; i++) {
            name += chars[Math.floor(Math.random()*chars.length)];
        }
        if (this.games[name]) {
            return this.createGameName();
        } else {
            this.games[name] = {};
            return name;
        }
    },

    getGame: function(gameName) {
        var game = this.games[gameName];
        if (!game) throw 'Game not found';
        else return game;
    },

    createGame: function(playerName,req) {
        var gameName = this.createGameName();
        req.io.join(gameName);
        this.games[gameName] = {
            name: gameName,
            players: [],
            boardWidth: 800,
            boardHeight: 600
        };
        this.addPlayerToGame(gameName,playerName,req);
        return this.getGame(gameName);
    },

    addPlayerToGame: function(gameName, playerName, req) {
        var player = {
            name: playerName,
            req: req
        };
        var game = this.getGame(gameName);
        game.players.push(player);
        return player;
    },

    prepareGame: function(gameName) {
        var game = this.getGame(gameName);

    },

    joinGame: function(gameName,playerName,req,callback) {

        if (!this.getRoomForGame(gameName)) {
            callback( "Game does not exists.", false);
            return;
        }
        var game = this.getGame(gameName);
        var others = game.players;
        var othersData = [];
        _.each(others, function(player) {
                othersData.push({
                    playerName: player.name
                });
                req.io.join(gameName);
                req.socket.set('playerName',playerName);
                req.socket.set('game',gameName);
                req.io.room(gameName).broadcast('playerJoined',{
                    playerName: playerName
                });
                //TODO: addPlayertogame
                callback(null,othersData);
        });
    },

    removeGame: function(gameName) {
        try {
            var game = this.getGame(gameName);
            game.players = null;
            delete this.games[gameName];
        } catch (e){}
    }
};


function resetClient(req) {
    console.log(app.io.sockets.manager.roomClients[req.socket.id]);
    var clientRooms = app.io.sockets.manager.roomClients[req.socket.id];
    for (var sKey in clientRooms) {
        if (sKey !== '') {
            console.log('Client leaves room: '+sKey);
            req.io.leave(sKey.substring(1));
        }
    }
}


app.io.route('createGame', function(req) {
    console.log('client data: ',req.data);
    resetClient(req);
    var game = GameManager.createGame(req.data.playerName,req);

    if (req.data.playerName) {
        req.socket.set('playerName',req.data.playerName);
    }
    req.socket.set('game',game.name);
    req.io.respond({
        game: game.name
    });
});

app.io.route('joinGame', function(req) {
    resetClient(req);
    if (!req.data.gameName || req.data.gameName.length < 1) {
        req.io.respond({
            success: false,
            error: "No game name delivered."
        });
        return;
    }
    var others = GameManager.joinGame(req.data.gameName,req.data.playerName,req, function(err,data){
        if (err) {
            req.io.respond({
                success: false,
                error: err
            });
        } else {
            console.log('join request successful');
            req.io.respond({
                success: true,
                others: data
            });
        }
    });
});


/**
 * Game start:
 * - master sends "request game start", with game info
 * - every player sends "ok to start" if board is set up
 * - master sends "play!"
 * - game starts
 *
 */
app.io.route('requestGameStart', function(req){
    req.socket.get('game', function(err,gameName){
        try {
            var game = GameManager.prepareGame(gameName);

        } catch (e) {}
    });
});


var cleanInt = setInterval(function() {
    console.log("Cleanup running");
    _.each(GameManager.games, function(item) {
        try {
            var room = GameManager.getRoomForGame(item.name);
        } catch (e) {
            // room does not exist, so has no more
            // clients, remove the game, too
            console.log("Cleaning up Game "+item.name);
            GameManager.removeGame(item.name);
        }
    });
},10000);




app.listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});

