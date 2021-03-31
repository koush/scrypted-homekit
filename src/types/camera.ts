
import { Camera, FFMpegInput, ScryptedDevice, ScryptedDeviceType, ScryptedInterface, ScryptedMimeTypes, VideoCamera } from '@scrypted/sdk'
import { addSupportedType } from '../common'
import { AudioStreamingCodecType, AudioStreamingSamplerate, CameraController, CameraStreamingDelegate, CameraStreamingOptions, H264Level, H264Profile, PrepareStreamCallback, PrepareStreamRequest, PrepareStreamResponse, SnapshotRequest, SnapshotRequestCallback, SRTPCryptoSuites, StartStreamRequest, StreamingRequest, StreamRequestCallback, StreamRequestTypes } from 'hap-nodejs';
import { makeAccessory } from './common';

import sdk from '@scrypted/sdk';
import child_process from 'child_process';
import { ChildProcess } from 'node:child_process';
import dgram from 'dgram';
import { once } from 'events';
import debounce from 'lodash/debounce';

const { mediaManager } = sdk;

async function getPort(): Promise<dgram.Socket> {
    const ret = dgram.createSocket('udp4');
    while (true) {
        ret.bind(Math.round(10000 + Math.random() * 30000));
        await once(ret, 'listening');
        return ret;
    }
}

addSupportedType({
    type: ScryptedDeviceType.Camera,
    probe: (device: ScryptedDevice & VideoCamera & Camera) => {
        if (!device.interfaces.includes(ScryptedInterface.VideoCamera))
            return;

        interface Session {
            request: PrepareStreamRequest;
            videossrc: number;
            audiossrc: number;
            cp: ChildProcess;
            videoReturn: dgram.Socket;
            audioReturn: dgram.Socket;
        }
        const sessions = new Map<string, Session>();

        let lastPicture = 0;
        let picture: Buffer;


        function killSession(sessionID: string) {
            const session = sessions.get(sessionID);

            if (!session)
                return;

            sessions.delete(sessionID);
            session.cp.kill();
            session.videoReturn.close();
            session.audioReturn.close();
        }

        const delegate: CameraStreamingDelegate = {
            async handleSnapshotRequest(request: SnapshotRequest, callback: SnapshotRequestCallback) {
                try {
                    if (device.interfaces.includes(ScryptedInterface.Camera)) {
                        const media = await device.takePicture();
                        const jpeg = await mediaManager.convertMediaObjectToBuffer(media, 'image/jpeg');
                        callback(null, jpeg);
                        return;
                    }
                    if (lastPicture + 60000 > Date.now()) {
                        callback(null, picture);
                        return;
                    }

                    lastPicture = Date.now();
                    callback(null, picture);

                    try {
                        // begin a refresh
                        const media = await device.getVideoStream();
                        picture = await mediaManager.convertMediaObjectToBuffer(media, 'image/jpeg');
                    }
                    catch (e) {
                    }
                }
                catch (e) {
                    console.error('snapshot error', e);
                    callback(e);
                }
            },
            async prepareStream(request: PrepareStreamRequest, callback: PrepareStreamCallback) {

                const videossrc = CameraController.generateSynchronisationSource();
                const audiossrc = CameraController.generateSynchronisationSource();

                const session: Session = {
                    request,
                    videossrc,
                    audiossrc,
                    cp: null,
                    videoReturn: await getPort(),
                    audioReturn: await getPort(),
                }
                sessions.set(request.sessionID, session);

                const response: PrepareStreamResponse = {
                    addressOverride: '192.168.2.7',
                    video: {
                        srtp_key: request.video.srtp_key,
                        srtp_salt: request.video.srtp_salt,
                        port: session.videoReturn.address().port,
                        ssrc: videossrc,
                    },
                    audio: {
                        srtp_key: request.audio.srtp_key,
                        srtp_salt: request.audio.srtp_salt,
                        port: session.audioReturn.address().port,
                        ssrc: audiossrc,
                    }
                }
                callback(null, response);
            },
            async handleStreamRequest(request: StreamingRequest, callback: StreamRequestCallback) {
                console.log(request);
                if (request.type === StreamRequestTypes.STOP) {
                    killSession(request.sessionID);
                    callback();
                    return;
                }

                const session = sessions.get(request.sessionID);

                if (!session) {
                    callback(new Error('unknown session'));
                    return;
                }
                if (request.type === StreamRequestTypes.RECONFIGURE) {
                    // stop for restart
                }

                session.videoReturn.on('data', () => debounce(() => {
                    controller.forceStopStreamingSession(request.sessionID);
                    killSession(request.sessionID);
                }, 60000));

                try {
                    const media = await device.getVideoStream();
                    const ffmpegInput = JSON.parse((await mediaManager.convertMediaObjectToBuffer(media, ScryptedMimeTypes.FFmpegInput)).toString()) as FFMpegInput;

                    const videoKey = Buffer.concat([session.request.video.srtp_key, session.request.video.srtp_salt]);
                    const audioKey = Buffer.concat([session.request.audio.srtp_key, session.request.audio.srtp_salt]);
                    const args: string[] = [];
                    args.push(...ffmpegInput.inputArguments);
                    args.push(
                        "-an", '-sn', '-dn',
                        "-vcodec", "copy",
                        '-pix_fmt', 'yuv420p',
                        '-color_range', 'mpeg',
                        "-f", "rawvideo",

                        "-b:v", "132k",
                        "-bufsize", "132k",
                        "-maxrate", "132k",
                        "-payload_type", (request as StartStreamRequest).video.pt.toString(),
                        "-ssrc", session.videossrc.toString(),
                        "-f", "rtp",
                        "-srtp_out_suite", session.request.video.srtpCryptoSuite === SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80 ?
                        "AES_CM_128_HMAC_SHA1_80" : "AES_CM_256_HMAC_SHA1_80",
                        "-srtp_out_params", videoKey.toString('base64'),
                        `srtp://${session.request.targetAddress}:${session.request.video.port}?rtcpport=${session.request.video.port}&pkt_size=1316`
                    )

                    const codec = (request as StartStreamRequest).audio.codec;
                    if (codec === AudioStreamingCodecType.OPUS || codec === AudioStreamingCodecType.AAC_ELD) {
                        console.log('acodec', codec);
                        args.push(
                            "-vn", '-sn', '-dn',
                            '-acodec', ...(codec === AudioStreamingCodecType.OPUS ? 
                                ['libopus', '-application', 'lowdelay'] : 
                                ['libfdk_aac', '-profile:a', 'aac_eld']),
                            '-flags', '+global_header',
                            '-f', 'null',
                            '-ar', `${(request as StartStreamRequest).audio.sample_rate}k`,
                            '-b:a', `${(request as StartStreamRequest).audio.max_bit_rate}k`,
                            '-ac', `${(request as StartStreamRequest).audio.channel}`,
                            "-payload_type",
                            (request as StartStreamRequest).audio.pt.toString(),
                            "-ssrc", session.audiossrc.toString(),
                            "-f", "rtp",
                            "-srtp_out_suite", session.request.audio.srtpCryptoSuite === SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80 ?
                            "AES_CM_128_HMAC_SHA1_80" : "AES_CM_256_HMAC_SHA1_80",
                            "-srtp_out_params", audioKey.toString('base64'),
                            `srtp://${session.request.targetAddress}:${session.request.audio.port}?rtcpport=${session.request.audio.port}&pkt_size=188`
                        )
                    }
                    else {
                        console.warn('unknown audio codec', request);
                    }

                    console.log(args);

                    const cp = child_process.spawn('ffmpeg', args, {
                        // stdio: 'ignore',
                    });
                    cp.stdout.on('data', data => console.log(data.toString()));
                    cp.stderr.on('data', data => console.error(data.toString()));

                    session.cp = cp;

                    callback();
                }
                catch (e) {
                    callback(e);
                }
            },
        };
        const streamingOptions: CameraStreamingOptions = {
            video: {
                codec: {
                    levels: [H264Level.LEVEL3_1, H264Level.LEVEL3_2, H264Level.LEVEL4_0],
                    profiles: [H264Profile.MAIN],
                },
                resolutions: [
                    [1280, 720, 15],
                    [1920, 1080, 15],
                ]
            },
            audio: {
                codecs: [
                    {
                        type: AudioStreamingCodecType.OPUS,
                        samplerate: AudioStreamingSamplerate.KHZ_24,
                        bitrate: 0,
                        audioChannels: 1,
                    },
                    {
                        type: AudioStreamingCodecType.AAC_ELD,
                        samplerate: AudioStreamingSamplerate.KHZ_24,
                        bitrate: 0,
                        audioChannels: 1,
                    }
                ]
            },
            supportedCryptoSuites: [
                // not supported by ffmpeg
                // SRTPCryptoSuites.AES_CM_256_HMAC_SHA1_80,
                SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80,
                SRTPCryptoSuites.NONE,
            ]
        }
        const controller = new CameraController({
            cameraStreamCount: 2,
            delegate,
            streamingOptions,
        });

        const accessory = makeAccessory(device);
        accessory.configureController(controller);

        return accessory;
    }
});
