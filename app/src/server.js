'use strict';
const { Server } = require('socket.io');
const http = require('http');
const express = require('express');
const path = require('path');
const app = express();

const port = process.env.PORT || 3000; 

let server = http.createServer(app);
let io = new Server().listen(server);


let channels = {}; // lưu các phòng
let sockets = {}; // người dùng mới
let peers = {}; // mảng 2 chiều lưu các người dùng theo từng phòng


// set up giao diện 
app.use(express.static(path.join(__dirname, '../../', 'public')));

// start
app.get(['/'], (req, res) => {
    res.sendFile(path.join(__dirname, '../../', 'public/view/landing.html'));
});

// new room
app.get(['/newcall'], (req, res) => {
    res.sendFile(path.join(__dirname, '../../', 'public/view/landing.html'));
});

// no room name specified to join
app.get('/join/', (req, res) => {
    res.redirect('/');
});

// join to room
app.get('/join/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../', 'public/view/client.html'));
});

/** */

// ice server truyền và nhận các ICE candidate
const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

server.listen(port,() => {
    console.log("Server running at: " + 'http://localhost:' + port);
});

io.sockets.on('connect', (socket) => {
    socket.channels = {};
    sockets[socket.id] = socket;

    /**
     * Khi 1 peer disconnect
     */
    socket.on('disconnect', () => {
        // xóa peer ngắt kêt nối ở những peer khác
        for (let channel in socket.channels) {
            removePeerFrom(channel);
        }
        // xóa peer khỏi danh sách
        delete sockets[socket.id];
    });

    /**
     * khi 1 peer join
     */
    socket.on('join', (config) => {
        // tạo peer mới khi có người join
        let channel = config.channel;
        let peer_name = config.peer_name;
        let peer_video = config.peer_video;
        let peer_audio = config.peer_audio;
        let peer_hand = config.peer_hand;

        if (channel in socket.channels) {
            return;
        }
        // no channel aka room in channels init
        if (!(channel in channels)) channels[channel] = {};

        // no channel aka room in peers init
        if (!(channel in peers)) peers[channel] = {};


        // collect peers info group by channels
        peers[channel][socket.id] = {
            peer_name: peer_name,
            peer_video: peer_video,
            peer_audio: peer_audio,
            peer_hand: peer_hand,
        };
        // thêm peer mới
        addPeerTo(channel);

        // tạo kênh
        channels[channel][socket.id] = socket;
        socket.channels[channel] = channel;
    });

    /**
     * thêm người vào phòng
     * @param {*} channel
     */
    async function addPeerTo(channel) {
        for (let id in channels[channel]) {
            // offer false
            await channels[channel][id].emit('addPeer', {
                peer_id: socket.id,
                peers: peers[channel],
                should_create_offer: false,
                iceServers: iceServers,
            });
            // offer true
            socket.emit('addPeer', {
                peer_id: id,
                peers: peers[channel],
                should_create_offer: true,
                iceServers: iceServers,
            });
        }
    }

    /**
     * 1 người rời phòng
     * @param {*} channel
     */
    async function removePeerFrom(channel) {
        if (!(channel in socket.channels)) {
            return;
        }

        delete socket.channels[channel];
        delete channels[channel][socket.id];
        delete peers[channel][socket.id];
        
        // không còn ai thì xóa phòng
        if (peers[channel].length < 1) {
            delete peers[channel];
        }

        // lặp từng máy khách và loại bỏ người vừa rời
        for (let id in channels[channel]) {
            await channels[channel][id].emit('removePeer', { peer_id: socket.id });
            socket.emit('removePeer', { peer_id: id });
        }
    }

    /**
     * gửi ice candidate tới người dùng khác
     */
    socket.on('relayICE', (config) => {
        let peer_id = config.peer_id;
        let ice_candidate = config.ice_candidate;

        sendToPeer(peer_id, sockets, 'iceCandidate', {
            peer_id: socket.id,
            ice_candidate: ice_candidate,
        });
    });

    /**
     * gửi yêu cầu kết nối tới người dùng khác
     */
    socket.on('relaySDP', (config) => {
        let peer_id = config.peer_id;
        let session_description = config.session_description;
        sendToPeer(peer_id, sockets, 'sessionDescription', {
            peer_id: socket.id,
            session_description: session_description,
        });
    });

    /**
     * bật tắt các chức năng
     */
    socket.on('peerStatus', (config) => {
        let room_id = config.room_id;
        let peer_name = config.peer_name;
        let element = config.element;
        let status = config.status;

        for (let peer_id in peers[room_id]) {
            if (peers[room_id][peer_id]['peer_name'] == peer_name) {
                switch (element) {
                    case 'video':
                        peers[room_id][peer_id]['peer_video'] = status;
                        break;
                    case 'audio':
                        peers[room_id][peer_id]['peer_audio'] = status;
                        break;
                    case 'hand':
                        peers[room_id][peer_id]['peer_hand'] = status;
                        break;
                }
            }
        }
        sendToRoom(room_id, socket.id, 'peerStatus', {
            peer_id: socket.id,
            peer_name: peer_name,
            element: element,
            status: status,
        });
    });

    /**
     * phát lại các trạng thái của local cho remote
     */
    socket.on('peerAction', (config) => {
        let room_id = config.room_id;
        let peer_name = config.peer_name;
        let peer_action = config.peer_action;
        let peer_id = config.peer_id;

        if (peer_id) {
            sendToPeer(peer_id, sockets, 'peerAction', {
                peer_name: peer_name,
                peer_action: peer_action,
            });
        } else {
            sendToRoom(room_id, socket.id, 'peerAction', {
                peer_name: peer_name,
                peer_action: peer_action,
            });
        }
    });


}); 

// gửi tới cả phòng
async function sendToRoom(room_id, socket_id, msg, config = {}) {
    for (let peer_id in channels[room_id]) {
        // bỏ qua bản thân
        if (peer_id != socket_id) {
            await channels[room_id][peer_id].emit(msg, config);
        }
    }
}

// gửi riêng 1 người
async function sendToPeer(peer_id, sockets, msg, config = {}) {
    if (peer_id in sockets) {
        await sockets[peer_id].emit(msg, config);
    }
}
