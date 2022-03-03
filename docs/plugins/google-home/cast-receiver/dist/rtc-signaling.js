export async function startRTCSignalingSession(session, offer, console, createSetup, setRemoteDescription, addIceCandidate) {
    try {
        const setup = await createSetup();
        // console.log('offer', offer?.sdp, 'rtc setup', setup);
        if (!offer) {
            console.log('session.createLocalDescription');
            const offer = await session.createLocalDescription('offer', setup, addIceCandidate);
            console.log('rtc offer received');
            const answer = await setRemoteDescription(offer);
            console.log('rtc answer received');
            await session.setRemoteDescription(answer, setup);
            console.log('session.setRemoteDescription done');
        }
        else {
            console.log('session.setRemoteDescription');
            await session.setRemoteDescription(offer, setup);
            console.log('session.createLocalDescription');
            const answer = await session.createLocalDescription('answer', setup, addIceCandidate);
            console.log('rtc answer received');
            await setRemoteDescription(answer);
            console.log('session.setRemoteDescription done');
        }
    }
    catch (e) {
        console.error('RTC signaling failed', e);
        throw e;
    }
}
export class BrowserSignalingSession {
    pc;
    hasSetup = false;
    options = {
        capabilities: {
            audio: RTCRtpReceiver.getCapabilities?.('audio') || {
                codecs: undefined,
                headerExtensions: undefined,
            },
            video: RTCRtpReceiver.getCapabilities?.('video') || {
                codecs: undefined,
                headerExtensions: undefined,
            },
        }
    };
    constructor(pc, cleanup) {
        this.pc = pc;
        const checkConn = () => {
            console.log('iceConnectionState state', pc.iceConnectionState);
            console.log('connectionState', pc.connectionState);
            if (pc.iceConnectionState === 'disconnected'
                || pc.iceConnectionState === 'failed'
                || pc.iceConnectionState === 'closed') {
                cleanup();
            }
            if (pc.connectionState === 'closed'
                || pc.connectionState === 'disconnected'
                || pc.connectionState === 'failed') {
                cleanup();
            }
        };
        pc.addEventListener('connectionstatechange', checkConn);
        pc.addEventListener('iceconnectionstatechange', checkConn);
    }
    async getOptions() {
        return this.options;
    }
    createPeerConnection(setup) {
        if (this.hasSetup)
            return;
        this.hasSetup = true;
        if (setup.datachannel)
            this.pc.createDataChannel(setup.datachannel.label, setup.datachannel.dict);
        this.pc.addTransceiver('audio', setup.audio);
        this.pc.addTransceiver('video', setup.video);
    }
    async createLocalDescription(type, setup, sendIceCandidate) {
        this.createPeerConnection(setup);
        const gatheringPromise = new Promise(resolve => this.pc.onicegatheringstatechange = () => {
            if (this.pc.iceGatheringState === 'complete')
                resolve(undefined);
        });
        if (sendIceCandidate) {
            this.pc.onicecandidate = ev => {
                if (ev.candidate) {
                    console.log("local candidate", ev.candidate);
                    sendIceCandidate(JSON.parse(JSON.stringify(ev.candidate)));
                }
            };
        }
        const toDescription = (init) => {
            return {
                type: init.type,
                sdp: init.sdp,
            };
        };
        if (type === 'offer') {
            let offer = await this.pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
            });
            const set = this.pc.setLocalDescription(offer);
            if (sendIceCandidate)
                return toDescription(offer);
            await set;
            await gatheringPromise;
            offer = await this.pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
            });
            return toDescription(offer);
        }
        else {
            let answer = await this.pc.createAnswer();
            const set = this.pc.setLocalDescription(answer);
            if (sendIceCandidate)
                return toDescription(answer);
            await set;
            await gatheringPromise;
            answer = this.pc.currentLocalDescription || answer;
            return toDescription(answer);
        }
    }
    async setRemoteDescription(description, setup) {
        await this.pc.setRemoteDescription(description);
    }
    async addIceCandidate(candidate) {
        console.log("remote candidate", candidate);
        await this.pc.addIceCandidate(candidate);
    }
    async endSession() {
    }
}
//# sourceMappingURL=rtc-signaling.js.map