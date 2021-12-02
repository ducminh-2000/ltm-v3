'use strict';

const isHttps = false;
const signalingServerPort = 3000;
const signalingServer = getSignalingServer();
const roomId = getRoomId();
const peerInfo = getPeerInfo();
const welcomeImg = '';
const leaveRoomImg = '../images/leave-room.png';
const confirmImg = '../images/image-placeholder.svg';
const camOffImg = '../images/cam-off.png';
const audioOffImg = '../images/audio-off.png';
const deleteImg = '../images/delete.png';
const messageImg = '../images/message.png';

const notifyBySound = true;
const fileSharingInput = '*';

const isWebRTCSupported = DetectRTC.isWebRTCSupported;
const isMobileDevice = DetectRTC.isMobileDevice;
const myBrowserName = DetectRTC.browser.name;

const wbImageInput = 'image/*';
const wbWidth = 800;
const wbHeight = 600;

// video cam - screen max frame rate
let videoMaxFrameRate = 30;
let screenMaxFrameRate = 30;

let leftChatAvatar;
let rightChatAvatar;

let mirotalkTheme = 'neon'; // neon - dark - forest - ghost ...
let mirotalkBtnsBar = 'vertical'; // vertical - horizontal
let swalBackground = 'rgba(0, 0, 0, 0.7)'; // black - #16171b - transparent ...
let peerGeo;
let peerConnection;
let myPeerName;
let useAudio = true;
let useVideo = true;
let camera = 'user';
let roomLocked = false;
let myVideoChange = false;
let myHandStatus = false;
let myVideoStatus = true;
let myAudioStatus = true;
let isScreenStreaming = false;
let isChatRoomVisible = false;
let isChatEmojiVisible = false;
let isButtonsVisible = false;
let isMySettingsVisible = false;
let isVideoOnFullScreen = false;
let isDocumentOnFullScreen = false;
let isVideoUrlPlayerOpen = false;
let isRecScreenSream = false;
let signalingSocket; // socket.io kết nối server
let localMediaStream; // video/audio local
let remoteMediaStream; // video/audip remote
let remoteMediaControls = false; // enable - disable peers video player controls (default false)
let peerConnections = {}; // keep track of our peer connections, indexed by peer_id == socket.io id
let chatDataChannels = {}; // keep track of our peer chat data channels
let peerMediaElements = {}; // keep track of our peer <video> tags, indexed by peer_id
let chatMessages = []; // collect chat messages to save it later if want
// let backupIceServers = [{ urls: 'stun:stun.l.google.com:19302' }]; // backup iceServers


// init audio-video
let initAudioBtn;
let initVideoBtn;
// buttons bar
let buttonsBar;
let shareRoomBtn;
let audioBtn;
let videoBtn;
let screenShareBtn;
let fullScreenBtn;
let chatRoomBtn;
let myHandBtn;
let fileShareBtn;
let leaveRoomBtn;
// chat room elements
let msgerDraggable;
let msgerHeader;
let msgerTheme;
let msgerClean;
let msgerSaveBtn;
let msgerClose;
let msgerChat;
let msgerInput;
let msgerSendBtn;
let myVideo;
let myVideoWrap;
let myVideoAvatarImage;
// name && hand video audio status
let myVideoParagraph;
let myHandStatusIcon;
let myVideoStatusIcon;
let myAudioStatusIcon;
let muteEveryoneBtn;
let hideEveryoneBtn;
/**
 * Load all Html elements by Id
 */
function getHtmlElementsById() {
    // my video
    myVideo = getId('myVideo');
    myVideoWrap = getId('myVideoWrap');
    myVideoAvatarImage = getId('myVideoAvatarImage');

    // buttons Bar
    buttonsBar = getId('buttonsBar');
    audioBtn = getId('audioBtn');
    videoBtn = getId('videoBtn');
    screenShareBtn = getId('screenShareBtn');
    fullScreenBtn = getId('fullScreenBtn');
    chatRoomBtn = getId('chatRoomBtn');
    myHandBtn = getId('myHandBtn');
    leaveRoomBtn = getId('leaveRoomBtn');
    // chat Room elements
    msgerDraggable = getId('msgerDraggable');
    msgerHeader = getId('msgerHeader');
    msgerClose = getId('msgerClose');
    msgerChat = getId('msgerChat');
    msgerInput = getId('msgerInput');
    msgerSendBtn = getId('msgerSendBtn');
    myVideoParagraph = getId('myVideoParagraph');
    myHandStatusIcon = getId('myHandStatusIcon');
    myVideoStatusIcon = getId('myVideoStatusIcon');
    myAudioStatusIcon = getId('myAudioStatusIcon');
    // room actions buttons
    muteEveryoneBtn = getId('muteEveryoneBtn');
    hideEveryoneBtn = getId('hideEveryoneBtn');
}

/**
 * Get peer info using DetecRTC
 * https://github.com/muaz-khan/DetectRTC
 * @return Obj peer info
 */
function getPeerInfo() {
    return {
        detectRTCversion: DetectRTC.version,
        isWebRTCSupported: DetectRTC.isWebRTCSupported,
        isMobileDevice: DetectRTC.isMobileDevice,
        osName: DetectRTC.osName,
        osVersion: DetectRTC.osVersion,
        browserName: DetectRTC.browser.name,
        browserVersion: DetectRTC.browser.version,
    };
}

/**
 * Get Signaling server URL
 * @return Signaling server URL
 */
function getSignalingServer() {
    return (
        'http' +
        (location.hostname == 'localhost' ? '' : 's') +
        '://' +
        location.hostname +
        (location.hostname == 'localhost' ? ':' + signalingServerPort : '')
    );
}

/**
 * Generate random Room id
 * @return Room Id
 */
function getRoomId() {
    // skip /join/
    let roomId = location.pathname.substring(6);
    // if not specified room id, create one random
    if (roomId == '') {
        roomId = makeId(12);
        const newurl = signalingServer + '/join/' + roomId;
        window.history.pushState({ url: newurl }, roomId, newurl);
    }
    return roomId;
}

/**
 * Generate random Id
 * @param {*} length
 * @returns random id
 */
function makeId(length) {
    let result = '';
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

/**
 * Check if there is peer connections
 * @return true, false otherwise
 */
function thereIsPeerConnections() {
    if (Object.keys(peerConnections).length === 0) return false;
    return true;
}

/**
 * khởi tạo socket bên client
 */
function initClientPeer() {

    if (!isWebRTCSupported) {
        userLog('error', 'This browser seems not supported WebRTC!');
        return;
    }

    console.log('Connecting to signaling server');
    signalingSocket = io(signalingServer);

    // on receiving data from signaling server...
    signalingSocket.on('connect', handleConnect);
    signalingSocket.on('addPeer', handleAddPeer);
    signalingSocket.on('sessionDescription', handleSessionDescription);
    signalingSocket.on('iceCandidate', handleIceCandidate);
    // signalingSocket.on('peerName', handlePeerName);
    signalingSocket.on('peerStatus', handlePeerStatus);
    signalingSocket.on('peerAction', handlePeerAction);
    signalingSocket.on('disconnect', handleDisconnect);
    signalingSocket.on('removePeer', handleRemovePeer);
} 

async function sendToServer(msg, config = {}) {
    await signalingSocket.emit(msg, config);
}

/**
 * Connected to Signaling Server. Once the user has given us access to their
 * microphone/cam, join the channel and start peering up
 */
function handleConnect() {
    console.log('Connected to signaling server');
    if (localMediaStream) joinToChannel();
    else
        setupLocalMedia(() => {
            whoAreYou();
        });
}

/**
 * set your name for the conference
 */
function whoAreYou() {
    Swal.fire({
        allowOutsideClick: false,
        allowEscapeKey: false,
        background: swalBackground,
        position: 'center',
        imageAlt: 'mirotalk-name',
        // ảnh khi join
        imageUrl: welcomeImg,
        title: 'Enter your name',
        input: 'text',
        html: `<br>
        <div style="overflow: hidden;">
            <button id="initAudioBtn" class="fas fa-microphone" onclick="handleAudio(event, true)"></button>
            <button id="initVideoBtn" class="fas fa-video" onclick="handleVideo(event, true)"></button>
        </div>`,
        confirmButtonText: `Join meeting`,
        inputValidator: (value) => {
            if (!value) return 'Please enter your name';

            document.body.style.backgroundImage = 'none';
            myVideoWrap.style.display = 'inline';
            logStreamSettingsInfo('localMediaStream', localMediaStream);
            attachMediaStream(myVideo, localMediaStream);
            resizeVideos();

            myPeerName = value;
            myVideoParagraph.innerHTML = myPeerName + ' (me)';
            setPeerAvatarImgName('myVideoAvatarImage', myPeerName);
            setPeerChatAvatarImgName('right', myPeerName);
            joinToChannel();
        },
    }).then(() => {
    });

    if (isMobileDevice) return;

    initAudioBtn = getId('initAudioBtn');
    initVideoBtn = getId('initVideoBtn');
}

/**
 * join to chennel and send some peer info
 */
function joinToChannel() {
    console.log('join to channel', roomId);
    sendToServer('join', {
        channel: roomId,
        peer_info: peerInfo,
        peer_geo: peerGeo,
        peer_name: myPeerName,
        peer_video: myVideoStatus,
        peer_audio: myAudioStatus,
        peer_hand: myHandStatus,
        peer_rec: isRecScreenSream,
    });
}

/**
 * When we join a group, our signaling server will send out 'addPeer' events to each pair of users in the group (creating a fully-connected graph of users,
 * ie if there are 6 people in the channel you will connect directly to the other 5, so there will be a total of 15 connections in the network).
 *
 * @param {*} config
 */
function handleAddPeer(config) {
    // console.log("addPeer", JSON.stringify(config));

    let peer_id = config.peer_id;
    let peers = config.peers;
    let should_create_offer = config.should_create_offer;
    let iceServers = config.iceServers;

    if (peer_id in peerConnections) {
        // This could happen if the user joins multiple channels where the other peer is also in.
        console.log('Already connected to peer', peer_id);
        return;
    }

    // if (!iceServers) iceServers = backupIceServers;
    console.log('iceServers', iceServers[0]);

    // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection
    peerConnection = new RTCPeerConnection({ iceServers: iceServers });
    peerConnections[peer_id] = peerConnection;

    handleOnIceCandidate(peer_id);
    handleOnTrack(peer_id, peers);
    handleAddTracks(peer_id);
    handleRTCDataChannels(peer_id);
    if (should_create_offer) handleRtcOffer(peer_id);
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onicecandidate
 *
 * @param {*} peer_id
 */
function handleOnIceCandidate(peer_id) {
    peerConnections[peer_id].onicecandidate = (event) => {
        if (!event.candidate) return;
        sendToServer('relayICE', {
            peer_id: peer_id,
            ice_candidate: {
                sdpMLineIndex: event.candidate.sdpMLineIndex,
                candidate: event.candidate.candidate,
            },
        });
    };
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/ontrack
 *
 * @param {*} peer_id
 * @param {*} peers
 */
function handleOnTrack(peer_id, peers) {
    peerConnections[peer_id].ontrack = (event) => {
        console.log('handleOnTrack', event);
        if (event.track.kind === 'video') {
            loadRemoteMediaStream(event.streams[0], peers, peer_id);
        }
    };
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTrack
 *
 * @param {*} peer_id
 */
function handleAddTracks(peer_id) {
    localMediaStream.getTracks().forEach((track) => {
        peerConnections[peer_id].addTrack(track, localMediaStream);
    });
}

/**
 * Secure RTC Data Channel
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/ondatachannel
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/onmessage
 *
 * @param {*} peer_id
 */
function handleRTCDataChannels(peer_id) {
    peerConnections[peer_id].ondatachannel = (event) => {
        console.log('handleRTCDataChannels ' + peer_id, event);
        event.channel.onmessage = (msg) => {
            switch (event.channel.label) {
                case 'mirotalk_chat_channel':
                    try {
                        let dataMessage = JSON.parse(msg.data);
                        handleDataChannelChat(dataMessage);
                    } catch (err) {
                        console.error('handleDataChannelChat', err);
                    }
                    break;
                case 'mirotalk_file_sharing_channel':
                    try {
                        let dataFile = msg.data;
                        handleDataChannelFileSharing(dataFile);
                    } catch (err) {
                        console.error('handleDataChannelFS', err);
                    }
                    break;
            }
        };
    };
    createChatDataChannel(peer_id);
}

/**
 * Only one side of the peer connection should create the offer, the signaling server picks one to be the offerer.
 * The other user will get a 'sessionDescription' event and will create an offer, then send back an answer 'sessionDescription' to us
 *
 * @param {*} peer_id
 */
function handleRtcOffer(peer_id) {
    console.log('Creating RTC offer to', peer_id);
    // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createOffer
    peerConnections[peer_id]
        .createOffer()
        .then((local_description) => {
            console.log('Local offer description is', local_description);
            // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/setLocalDescription
            peerConnections[peer_id]
                .setLocalDescription(local_description)
                .then(() => {
                    sendToServer('relaySDP', {
                        peer_id: peer_id,
                        session_description: local_description,
                    });
                    console.log('Offer setLocalDescription done!');
                })
                .catch((err) => {
                    console.error('[Error] offer setLocalDescription', err);
                    userLog('error', 'Offer setLocalDescription failed ' + err);
                });
        })
        .catch((err) => {
            console.error('[Error] sending offer', err);
        });
}

/**
 * Peers exchange session descriptions which contains information about their audio / video settings and that sort of stuff. First
 * the 'offerer' sends a description to the 'answerer' (with type "offer"), then the answerer sends one back (with type "answer").
 *
 * @param {*} config
 */
function handleSessionDescription(config) {
    console.log('Remote Session Description', config);

    let peer_id = config.peer_id;
    let remote_description = config.session_description;

    // https://developer.mozilla.org/en-US/docs/Web/API/RTCSessionDescription
    let description = new RTCSessionDescription(remote_description);

    // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/setRemoteDescription
    peerConnections[peer_id]
        .setRemoteDescription(description)
        .then(() => {
            console.log('setRemoteDescription done!');
            if (remote_description.type == 'offer') {
                console.log('Creating answer');
                // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createAnswer
                peerConnections[peer_id]
                    .createAnswer()
                    .then((local_description) => {
                        console.log('Answer description is: ', local_description);
                        // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/setLocalDescription
                        peerConnections[peer_id]
                            .setLocalDescription(local_description)
                            .then(() => {
                                sendToServer('relaySDP', {
                                    peer_id: peer_id,
                                    session_description: local_description,
                                });
                                console.log('Answer setLocalDescription done!');
                            })
                            .catch((err) => {
                                console.error('[Error] answer setLocalDescription', err);
                                userLog('error', 'Answer setLocalDescription failed ' + err);
                            });
                    })
                    .catch((err) => {
                        console.error('[Error] creating answer', err);
                    });
            } // end [if type offer]
        })
        .catch((err) => {
            console.error('[Error] setRemoteDescription', err);
        });
}

/**
 * The offerer will send a number of ICE Candidate blobs to the answerer so they
 * can begin trying to find the best path to one another on the net.
 *
 * @param {*} config
 */
function handleIceCandidate(config) {
    let peer_id = config.peer_id;
    let ice_candidate = config.ice_candidate;
    // https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate
    peerConnections[peer_id].addIceCandidate(new RTCIceCandidate(ice_candidate)).catch((err) => {
        console.error('[Error] addIceCandidate', err);
    });
}

/**
 * Disconnected from Signaling Server. Tear down all of our peer connections
 * and remove all the media divs when we disconnect from signaling server
 */
function handleDisconnect() {
    console.log('Disconnected from signaling server');
    for (let peer_id in peerMediaElements) {
        document.body.removeChild(peerMediaElements[peer_id].parentNode);
        resizeVideos();
    }
    for (let peer_id in peerConnections) {
        peerConnections[peer_id].close();
        msgerRemovePeer(peer_id);
    }
    chatDataChannels = {};
    fileDataChannels = {};
    peerConnections = {};
    peerMediaElements = {};
}

/**
 * Khi 1 peer rời khỏi kênh (hoặc bị ngắt kết nối khỏi máy chủ), các peer khác sẽ nhận được thông báo 'removePeer'
 * yêu cầu bỏ rác các kênh truyền thông mà đã mở cho peer đó. Nếu chính peer này đã rời khỏi kênh,
 * họ cũng sẽ nhận được removePeers. Nếu ứng dụng khách này bị ngắt kết nối, họ sẽ không nhận được removePeers, mà là
 * signal_socket.on ('disconnect') sẽ bắt đầu và hủy bỏ tất cả các phiên ngang hàng.
 *
 * @param {*} config
 */
function handleRemovePeer(config) {
    console.log('Signaling server said to remove peer:', config);

    let peer_id = config.peer_id;

    if (peer_id in peerMediaElements) {
        document.body.removeChild(peerMediaElements[peer_id].parentNode);
        resizeVideos();
    }
    if (peer_id in peerConnections) peerConnections[peer_id].close();

    msgerRemovePeer(peer_id);

    delete chatDataChannels[peer_id];
    delete fileDataChannels[peer_id];
    delete peerConnections[peer_id];
    delete peerMediaElements[peer_id];
}


/**
 * Set buttons bar position
 * @param {*} position vertical / horizontal
 */
function setButtonsBarPosition(position) {
    if (!position || isMobileDevice) return;

    mirotalkBtnsBar = position;
    switch (mirotalkBtnsBar) {
        case 'vertical':
            let btnsLeft = mirotalkTheme === 'ghost' ? '5px' : '20px';
            document.documentElement.style.setProperty('--btns-top', '50%');
            document.documentElement.style.setProperty('--btns-right', '0px');
            document.documentElement.style.setProperty('--btns-left', btnsLeft);
            document.documentElement.style.setProperty('--btns-margin-left', '0px');
            document.documentElement.style.setProperty('--btns-width', '40px');
            document.documentElement.style.setProperty('--btns-flex-direction', 'column');
            break;
        case 'horizontal':
            document.documentElement.style.setProperty('--btns-top', '95%');
            document.documentElement.style.setProperty('--btns-right', '25%');
            document.documentElement.style.setProperty('--btns-left', '50%');
            document.documentElement.style.setProperty('--btns-margin-left', '-300px');
            document.documentElement.style.setProperty('--btns-width', '600px');
            document.documentElement.style.setProperty('--btns-flex-direction', 'row');
            break;
        default:
            console.log('No position found');
    }
}

/**
 * Setup local media stuff. Ask user for permission to use the computers microphone and/or camera,
 * attach it to an <audio> or <video> tag if they give us access.
 * https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
 *
 * @param {*} callback
 * @param {*} errorback
 */
function setupLocalMedia(callback) {
    const constraints = {
        audio: true,
        video: true,
    };

    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        loadLocalMedia(stream);
        if (callback) callback();
    });
}

/**
 * Load Local Media Stream obj
 * @param {*} stream
 */
function loadLocalMedia(stream) {
    console.log('Access granted to audio/video');
    // hide loading div
    getId('loadingDiv').style.display = 'none';

    localMediaStream = stream;

    // local video elemets
    const videoWrap = document.createElement('div');
    const localMedia = document.createElement('video');

    // handle my peer name video audio status
    const myStatusMenu = document.createElement('div');
    const myCountTimeImg = document.createElement('i');
    const myCountTime = document.createElement('p');
    const myVideoParagraphImg = document.createElement('i');
    const myVideoParagraph = document.createElement('h4');
    const myHandStatusIcon = document.createElement('button');
    const myVideoStatusIcon = document.createElement('button');
    const myAudioStatusIcon = document.createElement('button');
    const myVideoFullScreenBtn = document.createElement('button');
    const myVideoAvatarImage = document.createElement('img');

    // menu Status
    myStatusMenu.setAttribute('id', 'myStatusMenu');
    myStatusMenu.className = 'statusMenu';

    // session time
    myCountTimeImg.setAttribute('id', 'countTimeImg');
    myCountTime.setAttribute('id', 'countTime');
    tippy(myCountTime, {
        content: 'Session Time',
    });
    // my peer name
    myVideoParagraphImg.setAttribute('id', 'myVideoParagraphImg');
    myVideoParagraphImg.className = 'fas fa-user';
    myVideoParagraph.setAttribute('id', 'myVideoParagraph');
    myVideoParagraph.className = 'videoPeerName';
    tippy(myVideoParagraph, {
        content: 'My name',
    });
    // my hand status element
    myHandStatusIcon.setAttribute('id', 'myHandStatusIcon');
    myHandStatusIcon.className = 'fas fa-hand-paper pulsate';
    myHandStatusIcon.style.setProperty('color', 'rgb(0, 255, 0)');
    tippy(myHandStatusIcon, {
        content: 'My hand is RAISED',
    });
    // my video status element
    myVideoStatusIcon.setAttribute('id', 'myVideoStatusIcon');
    myVideoStatusIcon.className = 'fas fa-video';
    tippy(myVideoStatusIcon, {
        content: 'My video is ON',
    });
    // my audio status element
    myAudioStatusIcon.setAttribute('id', 'myAudioStatusIcon');
    myAudioStatusIcon.className = 'fas fa-microphone';
    tippy(myAudioStatusIcon, {
        content: 'My audio is ON',
    });
    // my video full screen mode
    myVideoFullScreenBtn.setAttribute('id', 'myVideoFullScreenBtn');
    myVideoFullScreenBtn.className = 'fas fa-expand';
    tippy(myVideoFullScreenBtn, {
        content: 'Full screen mode',
    });
    // my video avatar image
    myVideoAvatarImage.setAttribute('id', 'myVideoAvatarImage');
    myVideoAvatarImage.className = 'videoAvatarImage pulsate';

    // add elements to myStatusMenu div
    myStatusMenu.appendChild(myCountTimeImg);
    myStatusMenu.appendChild(myCountTime);
    myStatusMenu.appendChild(myVideoParagraphImg);
    myStatusMenu.appendChild(myVideoParagraph);
    myStatusMenu.appendChild(myHandStatusIcon);
    myStatusMenu.appendChild(myVideoStatusIcon);
    myStatusMenu.appendChild(myAudioStatusIcon);
    myStatusMenu.appendChild(myVideoFullScreenBtn);

    // hand display none on default menad is raised == false
    myHandStatusIcon.style.display = 'none';

    localMedia.setAttribute('id', 'myVideo');
    localMedia.setAttribute('playsinline', true);
    localMedia.className = 'mirror';
    localMedia.autoplay = true;
    localMedia.muted = true;
    localMedia.volume = 0;
    localMedia.controls = false;

    videoWrap.className = 'video';
    videoWrap.setAttribute('id', 'myVideoWrap');

    // add elements to video wrap div
    videoWrap.appendChild(myStatusMenu);
    videoWrap.appendChild(myVideoAvatarImage);
    videoWrap.appendChild(localMedia);

    document.body.appendChild(videoWrap);
    videoWrap.style.display = 'none';

    getHtmlElementsById();
    manageLeftButtons();
    handleBodyOnMouseMove();
    handleVideoPlayerFs('myVideo', 'myVideoFullScreenBtn');
}

/**
 * Load Remote Media Stream obj
 * @param {*} stream
 * @param {*} peers
 * @param {*} peer_id
 */
function loadRemoteMediaStream(stream, peers, peer_id) {
    // get data from peers obj
    let peer_name = peers[peer_id]['peer_name'];
    let peer_video = peers[peer_id]['peer_video'];
    let peer_audio = peers[peer_id]['peer_audio'];
    let peer_hand = peers[peer_id]['peer_hand'];
    let peer_rec = peers[peer_id]['peer_rec'];

    remoteMediaStream = stream;

    /** setup giao diện */

    // remote video elements
    const remoteVideoWrap = document.createElement('div');
    const remoteMedia = document.createElement('video');

    // handle peers name video audio status
    const remoteStatusMenu = document.createElement('div');
    const remoteVideoParagraphImg = document.createElement('i');
    const remoteVideoParagraph = document.createElement('h4');
    const remoteHandStatusIcon = document.createElement('button');
    const remoteVideoStatusIcon = document.createElement('button');
    const remoteAudioStatusIcon = document.createElement('button');
    const remotePeerKickOut = document.createElement('button');
    const remoteVideoFullScreenBtn = document.createElement('button');
    const remoteVideoAvatarImage = document.createElement('img');

    // menu Status
    remoteStatusMenu.setAttribute('id', peer_id + '_menuStatus');
    remoteStatusMenu.className = 'statusMenu';

    // remote peer name element
    remoteVideoParagraphImg.setAttribute('id', peer_id + '_nameImg');
    remoteVideoParagraphImg.className = 'fas fa-user';
    remoteVideoParagraph.setAttribute('id', peer_id + '_name');
    remoteVideoParagraph.className = 'videoPeerName';
    tippy(remoteVideoParagraph, {
        content: 'Participant name',
    });
    const peerVideoText = document.createTextNode(peers[peer_id]['peer_name']);
    remoteVideoParagraph.appendChild(peerVideoText);
    // remote hand status element
    remoteHandStatusIcon.setAttribute('id', peer_id + '_handStatus');
    remoteHandStatusIcon.style.setProperty('color', 'rgb(0, 255, 0)');
    remoteHandStatusIcon.className = 'fas fa-hand-paper pulsate';
    tippy(remoteHandStatusIcon, {
        content: 'Participant hand is RAISED',
    });
    // remote video status element
    remoteVideoStatusIcon.setAttribute('id', peer_id + '_videoStatus');
    remoteVideoStatusIcon.className = 'fas fa-video';
    tippy(remoteVideoStatusIcon, {
        content: 'Participant video is ON',
    });
    // remote audio status element
    remoteAudioStatusIcon.setAttribute('id', peer_id + '_audioStatus');
    remoteAudioStatusIcon.className = 'fas fa-microphone';
    tippy(remoteAudioStatusIcon, {
        content: 'Participant audio is ON',
    });
    // remote peer kick out
    remotePeerKickOut.setAttribute('id', peer_id + '_kickOut');
    remotePeerKickOut.className = 'fas fa-sign-out-alt';
    tippy(remotePeerKickOut, {
        content: 'Kick out',
    });
    // remote video full screen mode
    remoteVideoFullScreenBtn.setAttribute('id', peer_id + '_fullScreen');
    remoteVideoFullScreenBtn.className = 'fas fa-expand';
    tippy(remoteVideoFullScreenBtn, {
        content: 'Full screen mode',
    });
    // my video avatar image
    remoteVideoAvatarImage.setAttribute('id', peer_id + '_avatar');
    remoteVideoAvatarImage.className = 'videoAvatarImage pulsate';

    // add elements to remoteStatusMenu div
    remoteStatusMenu.appendChild(remoteVideoParagraphImg);
    remoteStatusMenu.appendChild(remoteVideoParagraph);
    remoteStatusMenu.appendChild(remoteHandStatusIcon);
    remoteStatusMenu.appendChild(remoteVideoStatusIcon);
    remoteStatusMenu.appendChild(remoteAudioStatusIcon);
    remoteStatusMenu.appendChild(remotePeerKickOut);
    remoteStatusMenu.appendChild(remoteVideoFullScreenBtn);

    remoteMedia.setAttribute('id', peer_id + '_video');
    remoteMedia.setAttribute('playsinline', true);
    remoteMedia.mediaGroup = 'remotevideo';
    remoteMedia.autoplay = true;
    isMobileDevice ? (remoteMediaControls = false) : (remoteMediaControls = remoteMediaControls);
    remoteMedia.controls = remoteMediaControls;
    peerMediaElements[peer_id] = remoteMedia;

    remoteVideoWrap.className = 'video';

    // add elements to videoWrap div
    remoteVideoWrap.appendChild(remoteStatusMenu);
    remoteVideoWrap.appendChild(remoteVideoAvatarImage);
    remoteVideoWrap.appendChild(remoteMedia);

    document.body.appendChild(remoteVideoWrap);

    /** */

    // attachMediaStream is a part of the adapter.js library
    attachMediaStream(remoteMedia, remoteMediaStream);
    // resize video elements
    resizeVideos();
    // handle video full screen mode
    handleVideoPlayerFs(peer_id + '_video', peer_id + '_fullScreen', peer_id);
    // refresh remote peers avatar name
    setPeerAvatarImgName(peer_id + '_avatar', peer_name);
    // refresh remote peers hand icon status and title
    setPeerHandStatus(peer_id, peer_name, peer_hand);
    // refresh remote peers video icon status and title
    setPeerVideoStatus(peer_id, peer_video);
    // refresh remote peers audio icon status and title
    setPeerAudioStatus(peer_id, peer_audio);
    // handle remote peers audio on-off
    handlePeerAudioBtn(peer_id);
    // handle remote peers video on-off
    handlePeerVideoBtn(peer_id);
    // show status menu
    toggleClassElements('statusMenu', 'inline');
    // notify if peer started to recording own screen + audio
}

/**
 * Log stream settings info
 * @param {*} name
 * @param {*} stream
 */
function logStreamSettingsInfo(name, stream) {
    console.log(name, {
        video: {
            label: stream.getVideoTracks()[0].label,
            settings: stream.getVideoTracks()[0].getSettings(),
        },
        audio: {
            label: stream.getAudioTracks()[0].label,
            settings: stream.getAudioTracks()[0].getSettings(),
        },
    });
}

/**
 * Resize video elements
 */
function resizeVideos() {
    const numToString = ['', 'one', 'two', 'three', 'four', 'five', 'six'];
    const videos = document.querySelectorAll('.video');
    document.querySelectorAll('.video').forEach((v) => {
        v.className = 'video ' + numToString[videos.length];
    });
}

/**
 * Refresh video - chat image avatar on name changes
 * https://eu.ui-avatars.com/
 *
 * @param {*} videoAvatarImageId element
 * @param {*} peerName
 */
function setPeerAvatarImgName(videoAvatarImageId, peerName) {
    let videoAvatarImageElement = getId(videoAvatarImageId);
    // default img size 64 max 512
    let avatarImgSize = isMobileDevice ? 128 : 256;
    videoAvatarImageElement.setAttribute(
        'src',
        avatarApiUrl + '?name=' + peerName + '&size=' + avatarImgSize + '&background=random&rounded=true',
    );
}

/**
 * Set Chat avatar image by peer name
 * @param {*} avatar left/right
 * @param {*} peerName my/friends
 */
function setPeerChatAvatarImgName(avatar, peerName) {
    let avatarImg = avatarApiUrl + '?name=' + peerName + '&size=32' + '&background=random&rounded=true';

    switch (avatar) {
        case 'left':
            // console.log("Set Friend chat avatar image");
            leftChatAvatar = avatarImg;
            break;
        case 'right':
            // console.log("Set My chat avatar image");
            rightChatAvatar = avatarImg;
            break;
    }
}

/**
 * On video player click, go on full screen mode ||
 * On button click, go on full screen mode.
 * Press Esc to exit from full screen mode, or click again.
 *
 * @param {*} videoId
 * @param {*} videoFullScreenBtnId
 * @param {*} peer_id
 */
function handleVideoPlayerFs(videoId, videoFullScreenBtnId, peer_id = null) {
    let videoPlayer = getId(videoId);
    let videoFullScreenBtn = getId(videoFullScreenBtnId);

    // handle Chrome Firefox Opera Microsoft Edge videoPlayer ESC
    videoPlayer.addEventListener('fullscreenchange', (e) => {
        // if Controls enabled, or document on FS do nothing
        if (videoPlayer.controls || isDocumentOnFullScreen) return;
        let fullscreenElement = document.fullscreenElement;
        if (!fullscreenElement) {
            videoPlayer.style.pointerEvents = 'auto';
            isVideoOnFullScreen = false;
            // console.log("Esc FS isVideoOnFullScreen", isVideoOnFullScreen);
        }
    });

    // handle Safari videoPlayer ESC
    videoPlayer.addEventListener('webkitfullscreenchange', (e) => {
        // if Controls enabled, or document on FS do nothing
        if (videoPlayer.controls || isDocumentOnFullScreen) return;
        let webkitIsFullScreen = document.webkitIsFullScreen;
        if (!webkitIsFullScreen) {
            videoPlayer.style.pointerEvents = 'auto';
            isVideoOnFullScreen = false;
            // console.log("Esc FS isVideoOnFullScreen", isVideoOnFullScreen);
        }
    });

    // on button click go on FS mobile/desktop
    videoFullScreenBtn.addEventListener('click', (e) => {
        gotoFS();
    });

    // on video click go on FS
    videoPlayer.addEventListener('click', (e) => {
        // not mobile on click go on FS or exit from FS
        if (!isMobileDevice) {
            gotoFS();
        } else {
            // mobile on click exit from FS, for enter use videoFullScreenBtn
            if (isVideoOnFullScreen) handleFSVideo();
        }
    });

    function gotoFS() {
        // handle remote peer video fs
        if (peer_id !== null) {
            let remoteVideoStatusBtn = getId(peer_id + '_videoStatus');
            if (remoteVideoStatusBtn.className === 'fas fa-video') {
                handleFSVideo();
            } else {
                showMsg();
            }
        } else {
            // handle local video fs
            if (myVideoStatusIcon.className === 'fas fa-video') {
                handleFSVideo();
            } else {
                showMsg();
            }
        }
    }

    function showMsg() {
        userLog('toast', 'Full screen mode work when video is on');
    }

    function handleFSVideo() {
        // if Controls enabled, or document on FS do nothing
        if (videoPlayer.controls || isDocumentOnFullScreen) return;

        if (!isVideoOnFullScreen) {
            if (videoPlayer.requestFullscreen) {
                // Chrome Firefox Opera Microsoft Edge
                videoPlayer.requestFullscreen();
            } else if (videoPlayer.webkitRequestFullscreen) {
                // Safari request full screen mode
                videoPlayer.webkitRequestFullscreen();
            } else if (videoPlayer.msRequestFullscreen) {
                // IE11 request full screen mode
                videoPlayer.msRequestFullscreen();
            }
            isVideoOnFullScreen = true;
            videoPlayer.style.pointerEvents = 'none';
            // console.log("Go on FS isVideoOnFullScreen", isVideoOnFullScreen);
        } else {
            if (document.exitFullscreen) {
                // Chrome Firefox Opera Microsoft Edge
                document.exitFullscreen();
            } else if (document.webkitCancelFullScreen) {
                // Safari exit full screen mode ( Not work... )
                document.webkitCancelFullScreen();
            } else if (document.msExitFullscreen) {
                // IE11 exit full screen mode
                document.msExitFullscreen();
            }
            isVideoOnFullScreen = false;
            videoPlayer.style.pointerEvents = 'auto';
            // console.log("Esc FS isVideoOnFullScreen", isVideoOnFullScreen);
        }
    }
}


/**
 * Handle WebRTC left buttons
 */
function manageLeftButtons() {
    setAudioBtn();
    setVideoBtn();
    setScreenShareBtn();
    setFullScreenBtn();
    setChatRoomBtn();
    setMyHandBtn();
    setLeaveRoomBtn();
    showButtonsBarAndMenu();
}

/**
 * Audio mute - unmute button click event
 */
function setAudioBtn() {
    audioBtn.addEventListener('click', (e) => {
        handleAudio(e, false);
    });
}

/**
 * Video hide - show button click event
 */
function setVideoBtn() {
    videoBtn.addEventListener('click', (e) => {
        handleVideo(e, false);
    });
}

/**
 * Check if i can share the screen, if yes show button else hide it
 */
function setScreenShareBtn() {
    if (!isMobileDevice && (navigator.getDisplayMedia || navigator.mediaDevices.getDisplayMedia)) {
        screenShareBtn.addEventListener('click', (e) => {
            toggleScreenSharing();
        });
    } else {
        screenShareBtn.style.display = 'none';
    }
}

/**
 * Full screen button click event
 */
function setFullScreenBtn() {
    if (DetectRTC.browser.name != 'Safari') {
        // detect esc from full screen mode
        document.addEventListener('fullscreenchange', (e) => {
            let fullscreenElement = document.fullscreenElement;
            if (!fullscreenElement) {
                fullScreenBtn.className = 'fas fa-expand-alt';
                isDocumentOnFullScreen = false;
                // only for desktop
                if (!isMobileDevice) {
                    tippy(fullScreenBtn, {
                        content: 'VIEW full screen',
                        placement: 'right-start',
                    });
                }
            }
        });
        fullScreenBtn.addEventListener('click', (e) => {
            toggleFullScreen();
        });
    } else {
        fullScreenBtn.style.display = 'none';
    }
}

/**
 * Chat room buttons click event
 */
function setChatRoomBtn() {
    // adapt chat room size for mobile
    // setChatRoomForMobile();

    // open hide chat room
    chatRoomBtn.addEventListener('click', (e) => {
        if (!isChatRoomVisible) {
            showChatRoomDraggable();
        } else {
            hideChatRoomAndEmojiPicker();
            e.target.className = 'fas fa-comment';
        }
    });

    // close chat room - show left button and status menu if hide
    msgerClose.addEventListener('click', (e) => {
        hideChatRoomAndEmojiPicker();
        showButtonsBarAndMenu();
    });

    // Execute a function when the user releases a key on the keyboard
    msgerInput.addEventListener('keyup', (e) => {
        // Number 13 is the "Enter" key on the keyboard
        if (e.keyCode === 13) {
            e.preventDefault();
            msgerSendBtn.click();
        }
    });

    // chat send msg
    msgerSendBtn.addEventListener('click', (e) => {
        // prevent refresh page
        e.preventDefault();
        sendChatMessage();
    });
}

/**
 * Set my hand button click event
 */
function setMyHandBtn() {
    myHandBtn.addEventListener('click', async (e) => {
        setMyHandStatus();
    });
}

/**
 * Leave room button click event
 */
function setLeaveRoomBtn() {
    leaveRoomBtn.addEventListener('click', (e) => {
        leaveRoom();
    });
}

/**
 * Handle left buttons - status menù show - hide on body mouse move
 */
function handleBodyOnMouseMove() {
    document.body.addEventListener('mousemove', (e) => {
        showButtonsBarAndMenu();
    });
}

/**
 * Refresh Local media audio video in - out
 */
function refreshLocalMedia() {
    // some devices can't swap the video track, if already in execution.
    stopLocalVideoTrack();
    stopLocalAudioTrack();

    navigator.mediaDevices.getUserMedia(getAudioVideoConstraints()).then(gotStream).then(gotDevices).catch(handleError);
}

/**
 * Get audio - video constraints
 * @returns constraints
 */
function getAudioVideoConstraints() {
    const constraints = {
        audio: true,
        video: true,
    };
    return constraints;
}


/**
 * Got Stream and append to local media
 * @param {*} stream
 */
function gotStream(stream) {
    refreshMyStreamToPeers(stream, true);
    refreshMyLocalStream(stream, true);
    if (myVideoChange) {
        setMyVideoStatusTrue();
        if (isMobileDevice) myVideo.classList.toggle('mirror');
    }
    // Refresh button list in case labels have become available
    return navigator.mediaDevices.enumerateDevices();
}

/**
 * Get audio-video Devices and show it to select box
 * https://webrtc.github.io/samples/src/content/devices/input-output/
 * https://github.com/webrtc/samples/tree/gh-pages/src/content/devices/input-output
 * @param {*} deviceInfos
 */
function gotDevices(deviceInfos) {
    // Handles being called several times to update labels. Preserve values.
    const values = selectors.map((select) => select.value);
    selectors.forEach((select) => {
        while (select.firstChild) {
            select.removeChild(select.firstChild);
        }
    });
    // check devices
    for (let i = 0; i !== deviceInfos.length; ++i) {
        const deviceInfo = deviceInfos[i];
        // console.log("device-info ------> ", deviceInfo);
        const option = document.createElement('option');
        option.value = deviceInfo.deviceId;

        switch (deviceInfo.kind) {
            case 'videoinput':
                option.text = `📹 ` + deviceInfo.label || `📹 camera ${videoSelect.length + 1}`;
                videoSelect.appendChild(option);
                break;

            case 'audioinput':
                option.text = `🎤 ` + deviceInfo.label || `🎤 microphone ${audioInputSelect.length + 1}`;
                audioInputSelect.appendChild(option);
                break;

            case 'audiooutput':
                option.text = `🔈 ` + deviceInfo.label || `🔈 speaker ${audioOutputSelect.length + 1}`;
                audioOutputSelect.appendChild(option);
                break;

            default:
                console.log('Some other kind of source/device: ', deviceInfo);
        }
    } // end for devices

    selectors.forEach((select, selectorIndex) => {
        if (Array.prototype.slice.call(select.childNodes).some((n) => n.value === values[selectorIndex])) {
            select.value = values[selectorIndex];
        }
    });
}

/**
 * Handle getUserMedia error
 * @param {*} err
 */
function handleError(err) {
    console.log('navigator.MediaDevices.getUserMedia error: ', err);
    switch (err.name) {
        case 'OverconstrainedError':
            userLog(
                'error',
                "GetUserMedia: Your device doesn't support the selected video quality or fps, please select the another one.",
            );
            break;
        default:
            userLog('error', 'GetUserMedia error ' + err);
    }
    // https://blog.addpipe.com/common-getusermedia-errors/
}

/**
 * AttachMediaStream stream to element
 * @param {*} element
 * @param {*} stream
 */
function attachMediaStream(element, stream) {
    //console.log("DEPRECATED, attachMediaStream will soon be removed.");
    console.log('Success, media stream attached');
    element.srcObject = stream;
}

/**
 * Show left buttons & status menù for 10 seconds on body mousemove
 * if mobile and chatroom open do nothing return
 * if mobile and mySettings open do nothing return
 */
function showButtonsBarAndMenu() {
    if (isButtonsVisible || (isMobileDevice && isChatRoomVisible) || (isMobileDevice && isMySettingsVisible)) return;
    toggleClassElements('statusMenu', 'inline');
    buttonsBar.style.display = 'flex';
    isButtonsVisible = true;
    setTimeout(() => {
        toggleClassElements('statusMenu', 'none');
        buttonsBar.style.display = 'none';
        isButtonsVisible = false;
    }, 10000);
}

/**
 * Handle Audio ON - OFF
 * @param {*} e event
 * @param {*} init bool true/false
 */
function handleAudio(e, init) {
    // https://developer.mozilla.org/en-US/docs/Web/API/MediaStream/getAudioTracks
    localMediaStream.getAudioTracks()[0].enabled = !localMediaStream.getAudioTracks()[0].enabled;
    myAudioStatus = localMediaStream.getAudioTracks()[0].enabled;
    e.target.className = 'fas fa-microphone' + (myAudioStatus ? '' : '-slash');
    if (init) {
        audioBtn.className = 'fas fa-microphone' + (myAudioStatus ? '' : '-slash');
        if (!isMobileDevice) {
            tippy(initAudioBtn, {
                content: myAudioStatus ? 'Click to audio OFF' : 'Click to audio ON',
                placement: 'top',
            });
        }
    }
    setMyAudioStatus(myAudioStatus);
}

/**
 * Handle Video ON - OFF
 * @param {*} e event
 * @param {*} init bool true/false
 */
function handleVideo(e, init) {
    // https://developer.mozilla.org/en-US/docs/Web/API/MediaStream/getVideoTracks
    localMediaStream.getVideoTracks()[0].enabled = !localMediaStream.getVideoTracks()[0].enabled;
    myVideoStatus = localMediaStream.getVideoTracks()[0].enabled;
    e.target.className = 'fas fa-video' + (myVideoStatus ? '' : '-slash');
    if (init) {
        videoBtn.className = 'fas fa-video' + (myVideoStatus ? '' : '-slash');
        if (!isMobileDevice) {
            tippy(initVideoBtn, {
                content: myVideoStatus ? 'Click to video OFF' : 'Click to video ON',
                placement: 'top',
            });
        }
    }
    setMyVideoStatus(myVideoStatus);
}

/**
 * Stop Local Video Track
 */
function stopLocalVideoTrack() {
    localMediaStream.getVideoTracks()[0].stop();
}

/**
 * Stop Local Audio Track
 */
function stopLocalAudioTrack() {
    localMediaStream.getAudioTracks()[0].stop();
}

/**
 * Enable - disable screen sharing
 * https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia
 */
function toggleScreenSharing() {
    const constraints = {
        video: { frameRate: { max: screenMaxFrameRate } },
    }; 

    let screenMediaPromise;

    if (!isScreenStreaming) {
        // on screen sharing start
        screenMediaPromise = navigator.mediaDevices.getDisplayMedia(constraints);
    } else {
        // on screen sharing stop
        screenMediaPromise = navigator.mediaDevices.getUserMedia(getAudioVideoConstraints());
    }
    screenMediaPromise
        .then((screenStream) => {
            // stop cam video track on screen share
            stopLocalVideoTrack();
            isScreenStreaming = !isScreenStreaming;
            refreshMyStreamToPeers(screenStream);
            refreshMyLocalStream(screenStream);
            myVideo.classList.toggle('mirror');
            setScreenSharingStatus(isScreenStreaming);
        })
        .catch((err) => {
            console.error('[Error] Unable to share the screen', err);
            userLog('error', 'Unable to share the screen ' + err);
        });
}

/**
 * Set Screen Sharing Status
 * @param {*} status
 */
function setScreenSharingStatus(status) {
    screenShareBtn.className = status ? 'fas fa-stop-circle' : 'fas fa-desktop';
    // only for desktop
    if (!isMobileDevice) {
        tippy(screenShareBtn, {
            content: status ? 'STOP screen sharing' : 'START screen sharing',
            placement: 'right-start',
        });
    }
}

/**
 * set myVideoStatus true
 */
function setMyVideoStatusTrue() {
    if (myVideoStatus) return;
    // Put video status alredy ON
    localMediaStream.getVideoTracks()[0].enabled = true;
    myVideoStatus = true;
    videoBtn.className = 'fas fa-video';
    myVideoStatusIcon.className = 'fas fa-video';
    myVideoAvatarImage.style.display = 'none';
    emitPeerStatus('video', myVideoStatus);
    // only for desktop
    if (!isMobileDevice) {
        tippy(videoBtn, {
            content: 'Click to video OFF',
            placement: 'right-start',
        });
    }
}

/**
 * Enter - esc on full screen mode
 * https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
 */
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        fullScreenBtn.className = 'fas fa-compress-alt';
        isDocumentOnFullScreen = true;
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
            fullScreenBtn.className = 'fas fa-expand-alt';
            isDocumentOnFullScreen = false;
        }
    }
    // only for desktop
    if (!isMobileDevice) {
        tippy(fullScreenBtn, {
            content: isDocumentOnFullScreen ? 'EXIT full screen' : 'VIEW full screen',
            placement: 'right-start',
        });
    }
}

/**
 * Refresh my stream changes to connected peers in the room
 * @param {*} stream
 * @param {*} localAudioTrackChange true or false(default)
 */
function refreshMyStreamToPeers(stream, localAudioTrackChange = false) {
    if (!thereIsPeerConnections()) return;

    // refresh my stream to peers
    for (let peer_id in peerConnections) {
        // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/getSenders
        let videoSender = peerConnections[peer_id]
            .getSenders()
            .find((s) => (s.track ? s.track.kind === 'video' : false));
        // https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/replaceTrack
        videoSender.replaceTrack(stream.getVideoTracks()[0]);

        if (localAudioTrackChange) {
            let audioSender = peerConnections[peer_id]
                .getSenders()
                .find((s) => (s.track ? s.track.kind === 'audio' : false));
            // https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/replaceTrack
            audioSender.replaceTrack(stream.getAudioTracks()[0]);
        }
    }
}

/**
 * Refresh my local stream
 * @param {*} stream
 * @param {*} localAudioTrackChange true or false(default)
 */
function refreshMyLocalStream(stream, localAudioTrackChange = false) {
    stream.getVideoTracks()[0].enabled = true;

    // enable audio
    if (localAudioTrackChange && myAudioStatus === false) {
        audioBtn.className = 'fas fa-microphone';
        setMyAudioStatus(true);
        myAudioStatus = true;
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/MediaStream
    const newStream = new MediaStream([
        stream.getVideoTracks()[0],
        localAudioTrackChange ? stream.getAudioTracks()[0] : localMediaStream.getAudioTracks()[0],
    ]);
    localMediaStream = newStream;

    // log newStream devices
    logStreamSettingsInfo('refreshMyLocalStream', localMediaStream);

    // attachMediaStream is a part of the adapter.js library
    attachMediaStream(myVideo, localMediaStream); // newstream

    // on toggleScreenSharing video stop
    stream.getVideoTracks()[0].onended = () => {
        if (isScreenStreaming) toggleScreenSharing();
    };

    /**
     * When you stop the screen sharing, on default i turn back to the webcam with video stream ON.
     * If you want the webcam with video stream OFF, just disable it with the button (click to video OFF),
     * before to stop the screen sharing.
     */
    if (myVideoStatus === false) localMediaStream.getVideoTracks()[0].enabled = false;
}

/**
 * Create Chat Room Data Channel
 * @param {*} peer_id
 */
function createChatDataChannel(peer_id) {
    chatDataChannels[peer_id] = peerConnections[peer_id].createDataChannel('mirotalk_chat_channel');
    chatDataChannels[peer_id].onopen = (event) => {
        console.log('chatDataChannels created', event);
    };
}

/**
 * Set the chat room on full screen mode for mobile
 */
// function setChatRoomForMobile() {
//     if (isMobileDevice) {
//         document.documentElement.style.setProperty('--msger-height', '99%');
//         document.documentElement.style.setProperty('--msger-width', '99%');
//     } else {
//         // make chat room draggable for desktop
//         dragElement(msgerDraggable, msgerHeader);
//     }
// }

/**
 * Show msger draggable on center screen position
 */
function showChatRoomDraggable() {
    if (isMobileDevice) {
        buttonsBar.style.display = 'none';
        isButtonsVisible = false;
    }
    chatRoomBtn.className = 'fas fa-comment-slash';
    msgerDraggable.style.top = '50%';
    msgerDraggable.style.left = '50%';
    msgerDraggable.style.display = 'flex';
    isChatRoomVisible = true;
    // only for desktop
    if (!isMobileDevice) {
        tippy(chatRoomBtn, {
            content: 'CLOSE the chat',
            placement: 'right-start',
        });
    }
}

/**
 * Hide chat room and emoji picker
 */
function hideChatRoomAndEmojiPicker() {
    msgerDraggable.style.display = 'none';
    chatRoomBtn.className = 'fas fa-comment';
    isChatRoomVisible = false;
    isChatEmojiVisible = false;
    // only for desktop
    if (!isMobileDevice) {
        tippy(chatRoomBtn, {
            content: 'OPEN the chat',
            placement: 'right-start',
        });
    }
}

/**
 * Send Chat messages to peers in the room
 */
function sendChatMessage() {
    if (!thereIsPeerConnections()) {
        userLog('info', "Can't send message, no participants in the room");
        msgerInput.value = '';
        return;
    }

    const msg = msgerInput.value;
    // empity msg or
    if (!msg) return;

    emitMsg(myPeerName, 'toAll', msg, false);
    appendMessage(myPeerName, rightChatAvatar, 'right', msg, false);
    msgerInput.value = '';
}

/**
 * handle Incoming Data Channel Chat Messages
 * @param {*} dataMessage
 */
function handleDataChannelChat(dataMessage) {
    if (!dataMessage) return;

    let msgFrom = dataMessage.from;
    let msgTo = dataMessage.to;
    let msg = dataMessage.msg;
    let msgPrivate = dataMessage.privateMsg;

    // private message but not for me return
    if (msgPrivate && msgTo != myPeerName) return;

    console.log('handleDataChannelChat', dataMessage);
    // chat message for me also
    if (!isChatRoomVisible) {
        showChatRoomDraggable();
        chatRoomBtn.className = 'fas fa-comment-slash';
    }
    // playSound('chatMessage');
    setPeerChatAvatarImgName('left', msgFrom);
    appendMessage(msgFrom, leftChatAvatar, 'left', msg, msgPrivate);
}

/**
 * Append Message to msger chat room
 * @param {*} from
 * @param {*} img
 * @param {*} side
 * @param {*} msg
 * @param {*} privateMsg
 */
function appendMessage(from, img, side, msg, privateMsg) {
    let time = getFormatDate(new Date());
    // collect chat msges to save it later
    chatMessages.push({
        time: time,
        from: from,
        msg: msg,
        privateMsg: privateMsg,
    });

    // check if i receive a private message
    let msgBubble = privateMsg ? 'private-msg-bubble' : 'msg-bubble';

    // console.log("chatMessages", chatMessages);
    let cMsg = detectUrl(msg);
    const msgHTML = `
	<div class="msg ${side}-msg">
		<div class="msg-img" style="background-image: url('${img}')"></div>
		<div class=${msgBubble}>
            <div class="msg-info">
                <div class="msg-info-name">${from}</div>
                <div class="msg-info-time">${time}</div>
            </div>
            <div class="msg-text">${cMsg}</div>
        </div>
	</div>
    `;
    msgerChat.insertAdjacentHTML('beforeend', msgHTML);
    msgerChat.scrollTop += 500;
}
/**
 * Remove participant from chat room lists
 * @param {*} peer_id
 */
function msgerRemovePeer(peer_id) {
    let msgerPrivateDiv = getId(peer_id + '_pMsgDiv');
    if (msgerPrivateDiv) {
        let peerToRemove = msgerPrivateDiv.firstChild;
        while (peerToRemove) {
            msgerPrivateDiv.removeChild(peerToRemove);
            peerToRemove = msgerPrivateDiv.firstChild;
        }
        msgerPrivateDiv.remove();
    }
}

/**
 * Detect url from text and make it clickable
 * Detect also if url is a img to create preview of it
 * @param {*} text
 * @returns html
 */
function detectUrl(text) {
    let urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => {
        if (isImageURL(text)) return '<p><img src="' + url + '" alt="img" width="200" height="auto"/></p>';
        return '<a id="chat-msg-a" href="' + url + '" target="_blank">' + url + '</a>';
    });
}

/**
 * Check if url passed is a image
 * @param {*} url
 * @returns true/false
 */
function isImageURL(url) {
    return url.match(/\.(jpeg|jpg|gif|png|tiff|bmp)$/) != null;
}

/**
 * Format data h:m:s
 * @param {*} date
 */
function getFormatDate(date) {
    const time = date.toTimeString().split(' ')[0];
    return `${time}`;
}

/**
 * Send message over Secure dataChannels
 * @param {*} from
 * @param {*} to
 * @param {*} msg
 * @param {*} privateMsg true/false
 */
function emitMsg(from, to, msg, privateMsg) {
    if (!msg) return;

    let chatMessage = {
        from: from,
        to: to,
        msg: msg,
        privateMsg: privateMsg,
    };
    console.log('Send msg', chatMessage);

    // Send chat msg through RTC Data Channels
    for (let peer_id in chatDataChannels) {
        if (chatDataChannels[peer_id].readyState === 'open')
            chatDataChannels[peer_id].send(JSON.stringify(chatMessage));
    }
}

/**
 * Handle html tab settings
 * https://www.w3schools.com/howto/howto_js_tabs.asp
 *
 * @param {*} evt
 * @param {*} tabName
 */
function openTab(evt, tabName) {
    let i, tabcontent, tablinks;
    tabcontent = getEcN('tabcontent');
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = 'none';
    }
    tablinks = getEcN('tablinks');
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(' active', '');
    }
    getId(tabName).style.display = 'block';
    evt.currentTarget.className += ' active';
}

/**
 * Append updated peer name to video player
 * @param {*} config
 */
function handlePeerName(config) {
    let peer_id = config.peer_id;
    let peer_name = config.peer_name;
    let videoName = getId(peer_id + '_name');
    if (videoName) videoName.innerHTML = peer_name;
    // change also btn value - name on chat lists....
    let msgerPeerName = getId(peer_id + '_pMsgBtn');
    if (msgerPeerName) {
        msgerPeerName.innerHTML = `&nbsp;${peer_name}`;
        msgerPeerName.value = peer_name;
    }
    // refresh also peer video avatar name
    setPeerAvatarImgName(peer_id + '_avatar', peer_name);
}

/**
 * Send my Video-Audio-Hand... status
 * @param {*} element
 * @param {*} status
 */
function emitPeerStatus(element, status) {
    sendToServer('peerStatus', {
        room_id: roomId,
        peer_name: myPeerName,
        element: element,
        status: status,
    });
}

/**
 * Set my Hand Status and Icon
 */
function setMyHandStatus() {
    if (myHandStatus) {
        // Raise hand
        myHandStatus = false;
        if (!isMobileDevice) {
            tippy(myHandBtn, {
                content: 'RAISE your hand',
                placement: 'right-start',
            });
        } 
    } else {
        // Lower hand
        myHandStatus = true;
        if (!isMobileDevice) {
            tippy(myHandBtn, {
                content: 'LOWER your hand',
                placement: 'right-start',
            });
        }
        // playSound('raiseHand');
    }
    myHandStatusIcon.style.display = myHandStatus ? 'inline' : 'none';
    emitPeerStatus('hand', myHandStatus);
}

/**
 * Set My Audio Status Icon and Title
 * @param {*} status
 */
function setMyAudioStatus(status) {
    myAudioStatusIcon.className = 'fas fa-microphone' + (status ? '' : '-slash');
    // send my audio status to all peers in the room
    emitPeerStatus('audio', status);
    tippy(myAudioStatusIcon, {
        content: status ? 'My audio is ON' : 'My audio is OFF',
    });
    // status ? playSound('on') : playSound('off');
    // only for desktop
    if (!isMobileDevice) {
        tippy(audioBtn, {
            content: status ? 'Click to audio OFF' : 'Click to audio ON',
            placement: 'right-start',
        });
    }
}

/**
 * Set My Video Status Icon and Title
 * @param {*} status
 */
function setMyVideoStatus(status) {
    // on vdeo OFF display my video avatar name
    myVideoAvatarImage.style.display = status ? 'none' : 'block';
    myVideoStatusIcon.className = 'fas fa-video' + (status ? '' : '-slash');
    // send my video status to all peers in the room
    emitPeerStatus('video', status);
    tippy(myVideoStatusIcon, {
        content: status ? 'My video is ON' : 'My video is OFF',
    });
    // status ? playSound('on') : playSound('off');
    // only for desktop
    if (!isMobileDevice) {
        tippy(videoBtn, {
            content: status ? 'Click to video OFF' : 'Click to video ON',
            placement: 'right-start',
        });
    }
}

/**
 * Handle peer audio - video - hand status
 * @param {*} config
 */
function handlePeerStatus(config) {
    //
    let peer_id = config.peer_id;
    let peer_name = config.peer_name;
    let element = config.element;
    let status = config.status;

    switch (element) {
        case 'video':
            setPeerVideoStatus(peer_id, status);
            break;
        case 'audio':
            setPeerAudioStatus(peer_id, status);
            break;
        case 'hand':
            setPeerHandStatus(peer_id, peer_name, status);
            break;
    }
}

/**
 * Set Participant Hand Status Icon and Title
 * @param {*} peer_id
 * @param {*} peer_name
 * @param {*} status
 */
function setPeerHandStatus(peer_id, peer_name, status) {
    let peerHandStatus = getId(peer_id + '_handStatus');
    peerHandStatus.style.display = status ? 'block' : 'none';
    if (status) {
        userLog('toast', peer_name + ' has raised the hand');
    }
}

/**
 * Set Participant Audio Status Icon and Title
 * @param {*} peer_id
 * @param {*} status
 */
function setPeerAudioStatus(peer_id, status) {
    let peerAudioStatus = getId(peer_id + '_audioStatus');
    peerAudioStatus.className = 'fas fa-microphone' + (status ? '' : '-slash');
    tippy(peerAudioStatus, {
        content: status ? 'Participant audio is ON' : 'Participant audio is OFF',
    });
}

/**
 * Mute Audio to specific user in the room
 * @param {*} peer_id
 */
function handlePeerAudioBtn(peer_id) {
    let peerAudioBtn = getId(peer_id + '_audioStatus');
    peerAudioBtn.onclick = () => {
        if (peerAudioBtn.className === 'fas fa-microphone') disablePeer(peer_id, 'audio');
    };
}

/**
 * Hide Video to specific user in the room
 * @param {*} peer_id
 */
function handlePeerVideoBtn(peer_id) {
    let peerVideoBtn = getId(peer_id + '_videoStatus');
    peerVideoBtn.onclick = () => {
        if (peerVideoBtn.className === 'fas fa-video') disablePeer(peer_id, 'video');
    };
}

/**
 * Set Participant Video Status Icon and Title
 * @param {*} peer_id
 * @param {*} status
 */
function setPeerVideoStatus(peer_id, status) {
    let peerVideoAvatarImage = getId(peer_id + '_avatar');
    let peerVideoStatus = getId(peer_id + '_videoStatus');
    peerVideoStatus.className = 'fas fa-video' + (status ? '' : '-slash');
    peerVideoAvatarImage.style.display = status ? 'none' : 'block';
    tippy(peerVideoStatus, {
        content: status ? 'Participant video is ON' : 'Participant video is OFF',
    });
}

/**
 * Emit actions to all peers in the same room except yourself
 * @param {*} peerAction muteAudio hideVideo start/stop recording ...
 */
function emitPeersAction(peerAction) {
    if (!thereIsPeerConnections()) return;

    sendToServer('peerAction', {
        room_id: roomId,
        peer_name: myPeerName,
        peer_id: null,
        peer_action: peerAction,
    });
}

/**
 * Emit actions to specified peers in the same room
 * @param {*} peer_id
 * @param {*} peerAction
 */
function emitPeerAction(peer_id, peerAction) {
    if (!thereIsPeerConnections()) return;

    sendToServer('peerAction', {
        room_id: roomId,
        peer_id: peer_id,
        peer_name: myPeerName,
        peer_action: peerAction,
    });
}

/**
 * Handle received peer actions
 * @param {*} config
 */
function handlePeerAction(config) {
    let peer_name = config.peer_name;
    let peer_action = config.peer_action;

    switch (peer_action) {
        case 'muteAudio':
            setMyAudioOff(peer_name);
            break;
        case 'hideVideo':
            setMyVideoOff(peer_name);
            break;
    }
}

/**
 * Set my Audio off and Popup the peer name that performed this action
 */
function setMyAudioOff(peer_name) {
    if (myAudioStatus === false) return;
    localMediaStream.getAudioTracks()[0].enabled = false;
    myAudioStatus = localMediaStream.getAudioTracks()[0].enabled;
    audioBtn.className = 'fas fa-microphone-slash';
    setMyAudioStatus(myAudioStatus);
    userLog('toast', peer_name + ' has disabled your audio');
}

/**
 * Set my Video off and Popup the peer name that performed this action
 */
function setMyVideoOff(peer_name) {
    if (myVideoStatus === false) return;
    localMediaStream.getVideoTracks()[0].enabled = false;
    myVideoStatus = localMediaStream.getVideoTracks()[0].enabled;
    videoBtn.className = 'fas fa-video-slash';
    setMyVideoStatus(myVideoStatus);
    userLog('toast', peer_name + ' has disabled your video');
}

/**
 * Mute or Hide specific peer
 * @param {*} peer_id
 * @param {*} element audio/video
 */
function disablePeer(peer_id, element) {
    if (!thereIsPeerConnections()) {
        userLog('info', 'No participants detected');
        return;
    }
    Swal.fire({
        background: swalBackground,
        position: 'center',
        imageUrl: element == 'audio' ? audioOffImg : camOffImg,
        title: element == 'audio' ? 'Mute this participant?' : 'Hide this participant?',
        text:
            element == 'audio'
                ? "Once muted, you won't be able to unmute them, but they can unmute themselves at any time."
                : "Once hided, you won't be able to unhide them, but they can unhide themselves at any time.",
        showDenyButton: true,
        confirmButtonText: element == 'audio' ? `Mute` : `Hide`,
        denyButtonText: `Cancel`,
    }).then((result) => {
        if (result.isConfirmed) {
            switch (element) {
                case 'audio':
                    userLog('toast', 'Mute audio 👍');
                    emitPeerAction(peer_id, 'muteAudio');
                    break;
                case 'video':
                    userLog('toast', 'Hide video 👍');
                    emitPeerAction(peer_id, 'hideVideo');
                    break;
            }
        }
    });
}

/**
 * Send File through RTC Data Channels
 * @param {*} data fileReader e.target.result
 */
function sendFSData(data) {
    for (let peer_id in fileDataChannels) {
        if (fileDataChannels[peer_id].readyState === 'open') fileDataChannels[peer_id].send(data);
    }
}

/**
 * Opend and send Video URL to all peers in the room
 *
 */
function sendVideoUrl(peer_id = null) {
    // playSound('newMessage');

    Swal.fire({
        background: swalBackground,
        position: 'center',
        imageUrl: youtubeImg,
        title: 'Share YouTube Video',
        text: 'Past YouTube video URL',
        input: 'text',
        showCancelButton: true,
        confirmButtonText: `Share`,
    }).then((result) => {
        if (result.value) {
            if (!thereIsPeerConnections()) {
                userLog('info', 'No participants detected');
                return;
            }
            console.log('Video URL: ' + result.value);
            let config = {
                video_src: result.value,
                peer_id: peer_id,
            };
            openVideoUrlPlayer(config);
            emitVideoPlayer('open', config);
        }
    });
}
/**
 * Emit video palyer to peers
 * @param {*} video_action
 * @param {*} config
 */
function emitVideoPlayer(video_action, config = {}) {
    sendToServer('videoPlayer', {
        room_id: roomId,
        peer_name: myPeerName,
        video_action: video_action,
        video_src: config.video_src,
        peer_id: config.peer_id,
    });
}

/**
 * Handle peer kick out event button
 * @param {*} peer_id
 */
function handlePeerKickOutBtn(peer_id) {
    let peerKickOutBtn = getId(peer_id + '_kickOut');
    peerKickOutBtn.addEventListener('click', (e) => {
        kickOut(peer_id, peerKickOutBtn);
    });
}

/**
 * Kick out confirm
 * @param {*} peer_id
 * @param {*} peerKickOutBtn
 */
function kickOut(peer_id, peerKickOutBtn) {
    let pName = getId(peer_id + '_name').innerHTML;

    Swal.fire({
        background: swalBackground,
        position: 'center',
        imageUrl: confirmImg,
        title: 'Kick out ' + pName,
        text: 'Are you sure you want to kick out this participant?',
        showDenyButton: true,
        confirmButtonText: `Yes`,
        denyButtonText: `No`,
    }).then((result) => {
        if (result.isConfirmed) {
            // send peer to kick out from room
            sendToServer('kickOut', {
                room_id: roomId,
                peer_id: peer_id,
                peer_name: myPeerName,
            });
        }
    });
}

/**
 * You will be kicked out from the room and popup the peer name that performed this action
 * @param {*} config
 */
// function handleKickedOut(config) {
//     let peer_name = config.peer_name;
//     let timerInterval;
//     Swal.fire({
//         allowOutsideClick: false,
//         background: swalBackground,
//         position: 'center',
//         imageUrl: kickedOutImg,
//         title: 'Kicked out!',
//         html:
//             `<h2 style="color: red;">` +
//             `User ` +
//             peer_name +
//             `</h2> will kick out you after <b style="color: red;"></b> milliseconds.`,
//         timer: 1000,
//         timerProgressBar: true,
//         didOpen: () => {
//             Swal.showLoading();
//             timerInterval = setInterval(() => {
//                 const content = Swal.getHtmlContainer();
//                 if (content) {
//                     const b = content.querySelector('b');
//                     if (b) b.textContent = Swal.getTimerLeft();
//                 }
//             }, 100);
//         },
//         willClose: () => {
//             clearInterval(timerInterval);
//         },
//         // showClass: {
//         //     popup: 'animate__animated animate__fadeInDown',
//         // },
//         // hideClass: {
//         //     popup: 'animate__animated animate__fadeOutUp',
//         // },
//     }).then(() => {
//         window.location.href = '/newcall';
//     });
// }

/**
 * Leave the Room and create a new one
 */
function leaveRoom() {
    Swal.fire({
        background: swalBackground,
        position: 'center',
        imageAlt: 'mirotalk-leave',
        imageUrl: leaveRoomImg,
        title: 'Leave this room?',
        showDenyButton: true,
        confirmButtonText: `Yes`,
        denyButtonText: `No`,
    }).then((result) => {
        if (result.isConfirmed) window.location.href = '/newcall';
    });
}

/**
 * Make Obj draggable
 * https://www.w3schools.com/howto/howto_js_draggable.asp
 *
 * @param {*} elmnt
 * @param {*} dragObj
 */
function dragElement(elmnt, dragObj) {
    let pos1 = 0,
        pos2 = 0,
        pos3 = 0,
        pos4 = 0;
    if (dragObj) {
        // if present, the header is where you move the DIV from:
        dragObj.onmousedown = dragMouseDown;
    } else {
        // otherwise, move the DIV from anywhere inside the DIV:
        elmnt.onmousedown = dragMouseDown;
    }
    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }
    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        elmnt.style.top = elmnt.offsetTop - pos2 + 'px';
        elmnt.style.left = elmnt.offsetLeft - pos1 + 'px';
    }
    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

/**
 * Data Formated DD-MM-YYYY-H_M_S
 * https://convertio.co/it/
 * @returns data string
 */
function getDataTimeString() {
    const d = new Date();
    const date = d.toISOString().split('T')[0];
    const time = d.toTimeString().split(' ')[0];
    return `${date}-${time}`;
}

/**
 * Convert bytes to KB-MB-GB-TB
 * @param {*} bytes
 * @returns size
 */
function bytesToSize(bytes) {
    let sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes == 0) return '0 Byte';
    let i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

/**
 * Basic user logging using https://sweetalert2.github.io
 * @param {*} type
 * @param {*} message
 */
function userLog(type, message) {
    switch (type) {
        case 'error':
            Swal.fire({
                background: swalBackground,
                position: 'center',
                icon: 'error',
                title: 'Oops...',
                text: message,
            });
            // playSound('error');
            break;
        case 'info':
            Swal.fire({
                background: swalBackground,
                position: 'center',
                icon: 'info',
                title: 'Info',
                text: message,
            });
            break;
        case 'success':
            Swal.fire({
                background: swalBackground,
                position: 'center',
                icon: 'success',
                title: 'Success',
                text: message,
                showClass: {
                    popup: 'animate__animated animate__fadeInDown',
                },
                hideClass: {
                    popup: 'animate__animated animate__fadeOutUp',
                },
            });
            break;
        case 'success-html':
            Swal.fire({
                background: swalBackground,
                position: 'center',
                icon: 'success',
                title: 'Success',
                html: message,
            });
            break;
        case 'toast':
            const Toast = Swal.mixin({
                background: swalBackground,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
            });
            Toast.fire({
                icon: 'info',
                title: message,
            });
            break;
        // ......
        default:
            alert(message);
    }
}

/**
 * Show-Hide all elements grp by class name
 * @param {*} className
 * @param {*} displayState
 */
function toggleClassElements(className, displayState) {
    let elements = getEcN(className);
    for (let i = 0; i < elements.length; i++) {
        elements[i].style.display = displayState;
    }
}

/**
 * Get Html element by Id
 * @param {*} id
 */
function getId(id) {
    return document.getElementById(id);
}

/**
 * Get Html element by selector
 * @param {*} selector
 */
function getSl(selector) {
    return document.querySelector(selector);
}

/**
 * Get Html element by class name
 * @param {*} className
 */
function getEcN(className) {
    return document.getElementsByClassName(className);
}
