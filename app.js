'use strict'

const Telegram = require('telegram-node-bot')
const TelegramBaseController = Telegram.TelegramBaseController
const tg = new Telegram.Telegram('TELEGRAM BOT TOKEN')
const ADMIN_ID = 'TELEGRAM ADMIN CHAT ID'
const ADMIN_NAME = 'TELEGRAM ADMIN NAME'

var send_event_to_admin = function(event_msg) {
    if (ADMIN_ID) {
        tg.api.sendMessage(ADMIN_ID, 'GAMIN_BOT_LOG: '+event_msg);
    }
}

send_event_to_admin('started');

var express = require('express');
var YQL = require('yql');
const fs = require('fs');

var app = express();

var latest_data = {};
var list_of_chats = {};
var minutes = 2, the_interval = minutes * 60 * 1000;
var get_data_type = 'article';

fs.readFile('data/list_of_chats.txt', (err, data) => {
  if (err) throw err;
  if (data.length != 0) {
      list_of_chats = JSON.parse(data);
  }
});

fs.readFile('data/latest_data.txt', (err, data) => {
  if (err) throw err;
  if (data.length != 0) {
      latest_data = JSON.parse(data);
  }
  setInterval(function() {
            get_data();
        }, the_interval);
});

var get_data = function() {
    var query_string = '';
    if (get_data_type == 'article') {
        query_string = 'SELECT * FROM html WHERE (url="http://gamin.me/posts?show=long" and xpath="//article")';
    }
    else if (get_data_type == 'micro') {
        query_string = 'SELECT * FROM html WHERE (url="http://gamin.me/posts?show=micro" and xpath="//article")';
    }
    else if (get_data_type == 'game_db') {
        query_string = 'SELECT * FROM html WHERE (url="http://gamin.me/games?show=no_posts" and xpath="//article")';
    }
    new YQL.exec(query_string, function(response) {
	if (response.error) {
            console.log("Example #1... Error: " + response.error.description);
	}
	else {
            if (response.query.results) {
                find_new_data(response.query.results.article,get_data_type);
                if (get_data_type == 'article') {get_data_type = 'micro';}
                else if (get_data_type == 'micro') {get_data_type = 'game_db';}
                else if (get_data_type == 'game_db') {get_data_type = 'article';}
            }
	}
    });
};

var find_new_data = function(raw_arr,data_type) {
    if (!latest_data[data_type] || latest_data[data_type].toString() != raw_arr[0].id.toString()) {
        latest_data[data_type] = raw_arr[0].id.toString();
        fs.writeFile('data/latest_data.txt', JSON.stringify(latest_data));
        send_new_message_to_all(data_type);
    }
};

var send_new_message_to_all = function(type) {
    var message = "empty";
    var latest_id = latest_data[type].split('_')[1];
    if (type == 'article') {
        message = "Новая статья на Гамине. Ура!: gamin.me/posts/"+latest_id;
    }
    else if (type == 'micro') {
        message = "Свежий микропост: gamin.me/posts/"+latest_id;
    }
    if (type == 'game_db') {
        message = "Новая игра в базе Гамина: gamin.me/games/"+latest_id;
    }
    if (list_of_chats && Object.keys(list_of_chats).length > 0) {
        for (var chatId in list_of_chats) {
            var can_send = true;
            if (type == 'article' && !list_of_chats[chatId].post) {can_send = false;}
            else if (type == 'micro' && !list_of_chats[chatId].micro) {can_send = false;}
            else if (type == 'game_db' && !list_of_chats[chatId].game_db) {can_send = false;}
            if (can_send) {tg.api.sendMessage(chatId,message);}
        }
        send_event_to_admin('new message:[['+message+']]sended to '+Object.keys(list_of_chats).length+' chat rooms');
    }
}

class PingController extends TelegramBaseController {
    /**
     * @param {Scope} $
     */
    pingHandler($) {
        $.sendMessage('Я тут пытаюсь работать, вообще то!')
    }
    
    get routes() {
        return {
            '/ping': 'pingHandler'
        }
    }
}

class OtherwiseController extends TelegramBaseController {
    handle($) {
        //$.sendMessage('Привет!')
    }
}

class StartController extends TelegramBaseController {
    handle($) {
        if (Object.keys(list_of_chats).length < 25) {
            var chat_id = $.chatId;
            if (list_of_chats[chat_id]) {
                $.sendMessage("Этот чат уже добавлен в список рассылки. Когда появится что-нибудь новенькое, я напишу. Обещаю!");
            }
            else {
                list_of_chats[chat_id] = {post: true, micro: true, game_db: true};
                fs.writeFile('data/list_of_chats.txt', JSON.stringify(list_of_chats));
                $.sendMessage("Привет! Я добавил этот чат в список рассылки!");
                send_event_to_admin('new chatId added to list:'+chat_id);
                if (list_of_chats.length == 25) {
                    send_event_to_admin('CHAT LIST FULL!!!');
                }
                var latest_id = latest_data['article'].split('_')[1];
                $.sendMessage("Вот последний пост из базы:");
                $.sendMessage("gamin.me/posts/"+latest_id);
            } 
        }
        else {
            $.sendMessage("Извини! Список рассылки заполнен, напиши "+ADMIN_NAME+", пусть посмотрит, что можно сделать.");
        }
    }
}

tg.router
    .when('/ping', new PingController())
    .when('/start', new StartController())
    .otherwise(new OtherwiseController())