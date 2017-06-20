/**
 * Created by lince on 17/6/3.
 */
var express = require("express");
var app = express();
var server = require("http").createServer(app);
var io = require("socket.io")(server);
var port = process.env.PORT || 3000;
var users = [];
server.listen(port,function(){
    console.log('Server listening at port %d', port); //服务启动后开始监听端口3000
});
//路由地址
app.use(express.static(__dirname + '/chatroom'));
//Chatroom
var numUsers = 0;//用户数量

io.on('connection', function (socket) {
    var addedUser = false;
    // 当客户端发出“添加用户”时，侦听并执行
    socket.on('add user', function (username) {
        if (addedUser) return;
        if (users.indexOf(username) > -1) {
            socket.emit('nameExisted');
        } else {
            users.push(username);
            // 将用户名储存
            socket.username = username;
            ++numUsers;
            addedUser = true;
            socket.emit('login', {
                username: socket.username,
                numUsers: numUsers
            });
            // 广播给所有连接的客户端
            socket.broadcast.emit('user joined', {
                username: socket.username,
                numUsers: numUsers
            });
        }
    });
    // 监听用户断开连接
    socket.on('disconnect', function () {
        users.splice(users.indexOf(socket.username), 1);//删除用户组里断开的该用户
        if (addedUser) {
            --numUsers;

            // 广播给所有连接的客户端，有用户离开
            socket.broadcast.emit('user left', {
                username: socket.username,
                numUsers: numUsers
            });
        }
    });

    socket.on('new message', function (data) {
        socket.broadcast.emit('new message', {
            username: socket.username,
            message: data
        });
    });
    //语音信息
    socket.on('audio', function (data) {
        socket.broadcast.emit('audio', {
            username: socket.username,
            message: data
        });
    });

    socket.on('typing', function () {
        socket.broadcast.emit('typing', {
            username: socket.username
        });
    });

    socket.on('stop typing', function () {
        socket.broadcast.emit('stop typing', {
            username: socket.username
        });
    });
    //后台图片大小显示
    socket.on('file_size', function (data) {
        console.log(data+"kb");
    });


});
