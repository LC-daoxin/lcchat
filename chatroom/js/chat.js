/**
 * Created by lince on 17/6/3.
 */
$(function(){
    var COLORS = [
        '#e21400', '#91580f', '#f8a700', '#f78b00',
        '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
        '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
    ];
    var FADE_TIME = 200;// ms 隐藏时间
    var TYPING_TIMER_LENGTH = 400; // ms 输入停止时间
    var $window = $(window);
    var $messages = $('#historyMsg');
    var $nicknameInput = $(".usernameInput");//用户输入名
    var username;
    var connected = false;//连接
    var typing = false;//输入状态
    var lastTypingTime;
    var $currentInput = $nicknameInput.focus();
    var $inputMessage = $('#messageInput');//输入信息
    var $loginPage = $("#loginWrapper");

    var socket = io();
    //连接到服务器
    socket.on('connect', function() {
        $("#info").hide();
        $("#loginbox").show();
    });
    //当服务器发送'nameExisted'
    socket.on('nameExisted', function() {
        username = "";
        $('.title').html('该用户名已被占用，请重新命名!');
    });
    //当服务器发送'login', 显示用户登录在聊天群上
    socket.on('login', function (data) {
        connected = true;
        $loginPage.fadeOut();//登录页隐藏
        //$loginPage.off('click');//移除登录页点击事件
        $(".wrapper").show();
        $currentInput = $inputMessage.focus();
        // 显示Welcome
        var message = "Welcome to LC-Chat";
        document.title = 'LC-chat | ' + data.username;
        log(message, {
            prepend: true
        });
        addParticipantsMessage(data);
    });
    // 当服务器发送'user joined', 显示用户登录在聊天群上
    socket.on('user joined', function (data) {
        log(data.username + ' joined');
        addParticipantsMessage(data);
    });
    //当服务器发送'user left', 显示用户登录在聊天群上
    socket.on('user left', function (data) {
        log(data.username + ' left');
        addParticipantsMessage(data);
        removeChatTyping(data);
    });
    //断开连接
    socket.on('disconnect', function () {
        log('已与服务器断开连接');
    });
    //重新连接
    socket.on('reconnect', function () {
        log('已与服务器重新连接');
        if (username) {
            socket.emit('add user', username);
        }
    });
    //当服务器发送'new message', 更新聊天记录
    socket.on('new message', function (data) {
        addChatMessage(data);
    });
    //当服务器发送'audio', 更新聊天记录
    socket.on('audio', function (data) {
        addaudio(data)
    });
    //语音显示
    function addaudio(data){
        var blob = new Blob([data.message], { 'type' : 'audio/wav' });//var blob = new Blob([data], { 'type' : 'audio/wav; codecs=opus' });
        var audio = document.createElement('audio');
        audio.src = window.URL.createObjectURL(blob);
        audio.setAttribute("controls", 'controls');
        var $usernameDiv = $('<span class="username"/>')
            .html(data.username + " ")
            .attr("data-name",data.username)
            .css('color', getUsernameColor(data.username));
        if($(".usernameInput").val().trim() == data.username){
            $usernameDiv.css({"float":"right","padding-left":"10px"});
            $(audio).css("float","right");
        }
        var $messageDiv = $('<li class="message"/>')
            .data('username', data.username)
            .append($usernameDiv, audio);
        addMessageElement($messageDiv);
    }
    //当服务器发送'typing',显示正在输入
    socket.on('typing', function (data) {
        addChatTyping(data);
    });

    //当服务器发送'stop typing',清空正在输入
    socket.on('stop typing', function (data) {
        removeChatTyping(data);
    });
    socket.on('reconnect_error', function () {
        log('尝试重新连接失败!');
    });

    // 设置用户名
    function setUsername () {
        username = $nicknameInput.val().trim();

        // 如果用户名有效
        if (username) {
            // 告诉服务器你的用户名
            socket.emit('add user', username);
        }
    }
    $window.keydown(function (event) {
        // 自动获取焦点，除ctrl、alt、meta按键
        if (!(event.ctrlKey || event.metaKey || event.altKey)) {
            $currentInput.focus();
        }
        // 回车时
        if (event.which === 13) {//event.keyCode
            if (username) {
                sendMessage();
                socket.emit('stop typing');
                typing = false;
            } else {
                setUsername();
            }
        }
    });
    $inputMessage.on('input', function() {
        updateTyping();
    });
    // 发送日志信息
    function log (message, options) {
        var $el = $('<li>').addClass('log').text(message);
        addMessageElement($el, options);
    }
    // 将新消息添加到聊天群并滚动到底部
    function addMessageElement (el, options) {
        var $el = $(el);
        if (!options) {
            options = {};
        }
        if (typeof options.fade === 'undefined') {
            options.fade = true;
        }
        if (typeof options.prepend === 'undefined') {
            options.prepend = false;
        }

        // 应用选项
        if (options.fade) {
            $el.hide().fadeIn(FADE_TIME);
        }
        if (options.prepend) {
            $messages.prepend($el);//开头插入
        } else {
            $messages.append($el);//结尾插入
        }
        $messages[0].scrollTop = $messages[0].scrollHeight;
    }
    //用户在线数量显示
    function addParticipantsMessage (data) {
        var message = '';
        if (data.numUsers === 1) {
            message += "当前在线人数： 1 人";
        } else {
            message += "当前在线人数：" + data.numUsers + " 人";
        }
        $("#status").html(message);
    }
    // 发送一条聊天信息
    function sendMessage () {
        var message = $inputMessage.val().trim();
        // 如果信息不为空且连接为true
        if (message && connected) {
            $inputMessage.val('');//清空输入框
            addChatMessage({
                username: username,
                message: message
            });
            // 向服务器发送'new message'
            socket.emit('new message', message);
        }
    }
    //将聊天信息添加到列表中
    function addChatMessage (data, options) {
        //如果有一个“X正在打字”，不会将信息淡入
        var $typingMessages = getTypingMessages(data);
        options = options || {};
        if ($typingMessages.length !== 0) {
            options.fade = false;
            $typingMessages.remove();
        }
        data.message = showEmoji(data.message);//识别表情，转换为图片
        var $usernameDiv = $('<span class="username"/>')
            .html(data.username + " ")
            .attr("data-name",data.username)
            .css('color', getUsernameColor(data.username));
        var $messageBodyDiv = $('<span class="messageBody">')
            .html(data.message);
        //本人聊天记录靠右
        if($(".usernameInput").val().trim() == data.username){
            $usernameDiv.css({"float":"right","padding-left":"10px"});
            $messageBodyDiv.css("float","right");
        }
        var typingClass = data.typing ? 'typing' : '';
        var $messageDiv = $('<li class="message"/>')
            .data('username', data.username)
            .addClass(typingClass)
            .append($usernameDiv, $messageBodyDiv);
        addMessageElement($messageDiv, options);
    }
    // 添加用户正在输入显示
    function addChatTyping (data) {
        data.typing = true;
        data.message = 'is typing';
        addChatMessage(data);
    }

    // 移除用户正在输入显示
    function removeChatTyping (data) {
        getTypingMessages(data).fadeOut(function () {
            $(this).remove();
        });
    }
    //获取用户“x输入”消息
    function getTypingMessages (data) {
        return $('.typing.message').filter(function (i) {
            return $(this).data('username') === data.username;//给正在输入的信息添加对应的用户名
        });
    }
    // 更新输入状态
    function updateTyping () {
        if (connected) {
            if (!typing) {
                typing = true;
                socket.emit('typing');
            }
            lastTypingTime = (new Date()).getTime();

            setTimeout(function () { //400ms执行判断
                var typingTimer = (new Date()).getTime();
                var timeDiff = typingTimer - lastTypingTime;
                if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
                    socket.emit('stop typing');
                    typing = false;
                }
            }, TYPING_TIMER_LENGTH);
        }
    }
    // 给用户名设置不同颜色
    function getUsernameColor (username) {
        var hash = 12;
        var index = Math.abs(username.length % hash);
        return COLORS[index];
    }
    //表情
    initialEmoji();
    var $emojiWrapper = $("#emojiWrapper");
    $(document).on("click","#emoji",function (e) {
        if($emojiWrapper.css("display") == 'none'){
            $emojiWrapper.css("display","block");
        }else{
            $emojiWrapper.css("display","none");
        }
        e.stopPropagation();//阻止当前事件在DOM树上冒泡
    });
    document.getElementById('emojiWrapper').addEventListener('click', function(e) {
        var target = e.target;
        if (target.nodeName.toLowerCase() == 'img') {
            var messageInput = document.getElementById('messageInput');
            messageInput.focus();
            messageInput.value = messageInput.value + '[emoji:' + target.title + ']';
        }
        e.stopPropagation();
    }, false);
    function initialEmoji() {
        var emojiContainer = document.getElementById('emojiWrapper'),
            docFragment = document.createDocumentFragment();
        for (var i = 69; i > 0; i--) {
            var emojiItem = document.createElement('img');
            emojiItem.src = '../image/emoji/' + i + '.gif';
            emojiItem.title = i;
            docFragment.appendChild(emojiItem);
        }
        emojiContainer.appendChild(docFragment);
    }
    //把emoji替换成图片
    function showEmoji (msg){
        var match, result = msg,
            reg = /\[emoji:\d+\]/g,
            emojiIndex,
            totalEmojiNum = document.getElementById('emojiWrapper').children.length;
        while (match = reg.exec(msg)) {
            emojiIndex = match[0].slice(7, -1);
            if (emojiIndex > totalEmojiNum) {
                result = result.replace(match[0], '[X]');
            } else {
                result = result.replace(match[0], '<img class="emoji" src="../image/emoji/' + emojiIndex + '.gif" />');
            }
        }
        return result;
    }
    //清空聊天记录
    $("#clearBtn").on("click",function(){
        $messages.html("");
    });
    //发送照片
    document.getElementById('sendImage').addEventListener('change', function() {
        if (this.files.length != 0) {
            var file = this.files[0],
                reader = new FileReader();
            if (!reader) {
                log('浏览器不支持fileReader!');
                this.value = '';
                return;
            }
            var filepath=$("#sendImage").val();
            var extStart=filepath.lastIndexOf(".");
            var ext=filepath.substring(extStart,filepath.length).toUpperCase();
            if(ext!=".BMP"&&ext!=".PNG"&&ext!=".GIF"&&ext!=".JPG"&&ext!=".JPEG"){
                log('图片限于png,gif,jpeg,jpg格式!');
                return;
            }
            //图片大小
            var dom = document.getElementById("sendImage");
            var fileSize = dom.files[0].size;
            file_size = fileSize / 1024;
            socket.emit('file_size', file_size);//告诉后台文件大小
            if(BrowserType() == "Safari"){
                if(file_size >= 350){
                    log('Base64 DataURL传输图片，Safari限制大小350kb！');
                    return;
                }
            }
            if(BrowserType() < 9){
                log('Base64 DataURL传输图片，浏览器版本不支持！');
                return;
            }
            reader.readAsDataURL(file);
            reader.onload = function(e) {
                this.value = '';
                var messageInput = document.getElementById('messageInput');
                messageInput.focus();
                messageInput.value = messageInput.value + '<img class="imgCss" style="float:bottom" src="' + e.target.result + '"/>';
                sendMessage();
                socket.emit('stop typing');
                typing = false;
            };
        }
    }, false);
    //判断当前浏览器类型
    function BrowserType()
    {
        var userAgent = navigator.userAgent; //取得浏览器的userAgent字符串
        var isIE = userAgent.indexOf("compatible") > -1 && userAgent.indexOf("MSIE") > -1 && !isOpera; //判断是否IE浏览器
        var isEdge = userAgent.indexOf("Windows NT 6.1; Trident/7.0;") > -1 && !isIE; //判断是否IE的Edge浏览器
        var isFF = userAgent.indexOf("Firefox") > -1; //判断是否Firefox浏览器
        var isSafari = userAgent.indexOf("Safari") > -1 && userAgent.indexOf("Chrome") == -1; //判断是否Safari浏览器
        var isChrome = userAgent.indexOf("Chrome") > -1 && userAgent.indexOf("Safari") > -1; //判断Chrome浏览器
        if (isIE)
        {
            var reIE = new RegExp("MSIE (\\d+\\.\\d+);");
            reIE.test(userAgent);
            var fIEVersion = parseFloat(RegExp["$1"]);
            if(fIEVersion == 7)
            { return 7;}
            else if(fIEVersion == 8)
            { return 8;}
            else if(fIEVersion == 9)
            { return 9;}
            else if(fIEVersion == 10)
            { return 10;}
            else if(fIEVersion == 11)
            { return 11;}
            else
            { return 0}//IE版本过低
        }//isIE end
        if (isFF) {  return "FF";}
        if (isSafari) {  return "Safari";}
        if (isChrome) { return "Chrome";}
        if (isEdge) { return "Edge";}
    }
    //判断电脑还是手机
    function IsPC() {
        var userAgentInfo = navigator.userAgent;
        var Agents = ["Android", "iPhone",
            "SymbianOS", "Windows Phone",
            "iPad", "iPod"];
        var flag = true;
        for (var v = 0; v < Agents.length; v++) {
            if (userAgentInfo.indexOf(Agents[v]) > 0) {
                flag = false;
                break;
            }
        }
        return flag;
    }

    /* 音频 */
    var recorder;
    var audio = document.querySelector('audio');
    var $play = $("#startRecording");
    //阻止触发系统事件
    //$play.ontouchstart = function(e) { e.preventDefault(); };
    $play.mousedown(function(){
        startRecording();
    });
    //停止录音，获取录音，向服务器发送语音信息
    $play.mouseup(function(){
        stopRecord();
        //obtainRecord();
        //playRecord();
        var message = recorder.getBlob();
        addaudio({
            username: username,
            message: message
        });
        socket.emit('audio', message);//向服务器发送
    });
    function startRecording() { //开始录音
        HZRecorder.get(function (rec) {
            recorder = rec;
            recorder.start();
        });
    }
    function obtainRecord(){ //获取录音
        var record = recorder.getBlob();
        console.log(record);
        debugger;
    }
    function stopRecord(){ //停止录音
        recorder.stop();
    }
    function playRecord(){ //播放录音
        recorder.play(audio);
    }
    //兼容
    window.URL = window.URL || window.webkitURL;
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;//navigator.mediaDevices.getUserMedia

    var HZRecorder = function (stream, config) {
        config = config || {};
        config.sampleBits = config.sampleBits || 8;      //采样数位 8, 16
        config.sampleRate = config.sampleRate || (44100 / 6);   //采样率(1/6 44100)

        //创建一个音频环境对象
        audioContext = window.AudioContext || window.webkitAudioContext;
        var context = new audioContext();

        //将声音输入这个对像
        var audioInput = context.createMediaStreamSource(stream);

        //设置音量节点
        var volume = context.createGain();
        audioInput.connect(volume);

        //创建缓存，用来缓存声音
        var bufferSize = 4096;

        // 创建声音的缓存节点，createScriptProcessor方法的
        // 第二个和第三个参数指的是输入和输出都是双声道。
        var recorder = context.createScriptProcessor(bufferSize, 2, 2);

        var audioData = {
            size: 0          //录音文件长度
            , buffer: []     //录音缓存
            , inputSampleRate: context.sampleRate    //输入采样率
            , inputSampleBits: 16       //输入采样数位 8, 16
            , outputSampleRate: config.sampleRate    //输出采样率
            , oututSampleBits: config.sampleBits       //输出采样数位 8, 16
            , input: function (data) {
                this.buffer.push(new Float32Array(data));
                this.size += data.length;
            }
            , compress: function () { //合并压缩
                //合并
                var data = new Float32Array(this.size);
                var offset = 0;
                for (var i = 0; i < this.buffer.length; i++) {
                    data.set(this.buffer[i], offset);
                    offset += this.buffer[i].length;
                }
                //压缩
                var compression = parseInt(this.inputSampleRate / this.outputSampleRate);
                var length = data.length / compression;
                var result = new Float32Array(length);
                var index = 0, j = 0;
                while (index < length) {
                    result[index] = data[j];
                    j += compression;
                    index++;
                }
                return result;
            }
            , encodeWAV: function () {
                var sampleRate = Math.min(this.inputSampleRate, this.outputSampleRate);
                var sampleBits = Math.min(this.inputSampleBits, this.oututSampleBits);
                var bytes = this.compress();
                var dataLength = bytes.length * (sampleBits / 8);
                var buffer = new ArrayBuffer(44 + dataLength);
                var data = new DataView(buffer);

                var channelCount = 1;//单声道
                var offset = 0;

                var writeString = function (str) {
                    for (var i = 0; i < str.length; i++) {
                        data.setUint8(offset + i, str.charCodeAt(i));
                    }
                };

                // 资源交换文件标识符
                writeString('RIFF'); offset += 4;
                // 下个地址开始到文件尾总字节数,即文件大小-8
                data.setUint32(offset, 36 + dataLength, true); offset += 4;
                // WAV文件标志
                writeString('WAVE'); offset += 4;
                // 波形格式标志
                writeString('fmt '); offset += 4;
                // 过滤字节,一般为 0x10 = 16
                data.setUint32(offset, 16, true); offset += 4;
                // 格式类别 (PCM形式采样数据)
                data.setUint16(offset, 1, true); offset += 2;
                // 通道数
                data.setUint16(offset, channelCount, true); offset += 2;
                // 采样率,每秒样本数,表示每个通道的播放速度
                data.setUint32(offset, sampleRate, true); offset += 4;
                // 波形数据传输率 (每秒平均字节数) 单声道×每秒数据位数×每样本数据位/8
                data.setUint32(offset, channelCount * sampleRate * (sampleBits / 8), true); offset += 4;
                // 快数据调整数 采样一次占用字节数 单声道×每样本的数据位数/8
                data.setUint16(offset, channelCount * (sampleBits / 8), true); offset += 2;
                // 每样本数据位数
                data.setUint16(offset, sampleBits, true); offset += 2;
                // 数据标识符
                writeString('data'); offset += 4;
                // 采样数据总数,即数据总大小-44
                data.setUint32(offset, dataLength, true); offset += 4;
                // 写入采样数据
                if (sampleBits === 8) {
                    for (var i = 0; i < bytes.length; i++, offset++) {
                        var s = Math.max(-1, Math.min(1, bytes[i]));
                        var val = s < 0 ? s * 0x8000 : s * 0x7FFF;
                        val = parseInt(255 / (65535 / (val + 32768)));
                        data.setInt8(offset, val, true);
                    }
                } else {
                    for (var i = 0; i < bytes.length; i++, offset += 2) {
                        var s = Math.max(-1, Math.min(1, bytes[i]));
                        data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                    }
                }

                return new Blob([data], { type: 'audio/wav' });
            }
        };

        //开始录音
        this.start = function () {
            audioInput.connect(recorder);
            recorder.connect(context.destination);
        };

        //停止
        this.stop = function () {
            recorder.disconnect();
        };

        //获取音频文件
        this.getBlob = function () {
            this.stop();
            return audioData.encodeWAV();
        };

        //回放
        this.play = function (audio) {
            audio.src = window.URL.createObjectURL(this.getBlob());
        };
        //音频采集
        recorder.onaudioprocess = function (e) {
            audioData.input(e.inputBuffer.getChannelData(0));
            //record(e.inputBuffer.getChannelData(0));
        };

    };
    //抛出异常
    HZRecorder.throwError = function (message) {
        throw new function () { this.toString = function () { return message; };};
    };
    //是否支持录音
    HZRecorder.canRecording = (navigator.getUserMedia != null);
    //获取录音机
    HZRecorder.get = function (callback, config) {
        if (callback) {
            if (navigator.getUserMedia) {
                navigator.getUserMedia(
                    { audio: true } //只启用音频
                    , function (stream) {
                        var rec = new HZRecorder(stream, config);
                        callback(rec);
                    }
                    , function (error) {
                        switch (error.code || error.name) {
                            case 'PERMISSION_DENIED':
                            case 'PermissionDeniedError':
                                log('用户拒绝提供信息。');
                                HZRecorder.throwError('用户拒绝提供信息。');
                                break;
                            case 'NOT_SUPPORTED_ERROR':
                            case 'NotSupportedError':
                                log('浏览器不支持硬件设备');
                                HZRecorder.throwError('浏览器不支持硬件设备。');
                                break;
                            case 'MANDATORY_UNSATISFIED_ERROR':
                            case 'MandatoryUnsatisfiedError':
                                log('无法发现指定的硬件设备');
                                HZRecorder.throwError('无法发现指定的硬件设备。');
                                break;
                            default:
                                log('无法打开麦克风。');
                                HZRecorder.throwError('无法打开麦克风。异常信息:' + (error.code || error.name));
                                break;
                        }
                    });
            } else {
                log('当前浏览器不支持录音功能');
                HZRecorder.throwErr('当前浏览器不支持录音功能。'); return;
            }
        }
    };
    window.HZRecorder = HZRecorder;
});
