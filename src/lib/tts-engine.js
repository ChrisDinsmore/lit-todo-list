export class TTSEngine {
    constructor() {
        this.worker = null;
        this.isReady = false;
        this.readyPromise = null;
        this.sampleRate = 22050; // default for espeak-ng
    }

    async init() {
        if (this.readyPromise) return this.readyPromise;

        console.log('TTS: Initializing worker...');
        this.readyPromise = new Promise((resolve, reject) => {
            try {
                const workerUrl = new URL('/lib/espeak-ng/espeakng.worker.js', window.location.href).href;
                this.worker = new Worker(workerUrl);

                const timeout = setTimeout(() => {
                    reject(new Error('TTS Worker initialization timed out'));
                }, 10000);

                this.worker.onmessage = async (e) => {
                    if (e.data === 'ready') {
                        console.log('TTS: Worker ready');
                        clearTimeout(timeout);

                        try {
                            const voices = await this.listVoices();
                            const voice = voices.find(v => v.identifier === 'en-us') || voices[0];
                            if (voice) {
                                console.log(`TTS: Selecting voice: ${voice.name} (${voice.identifier})`);
                                await this.setVoice(voice.identifier);
                            }
                        } catch (err) {
                            console.warn('TTS: Voice setup failed', err);
                        }

                        this.isReady = true;
                        resolve();
                    }
                };

                this.worker.onerror = (e) => {
                    console.error('TTS: Worker error:', e);
                    clearTimeout(timeout);
                    reject(e);
                };
            } catch (err) {
                console.error('TTS: Failed to create worker:', err);
                reject(err);
            }
        });

        return this.readyPromise;
    }

    async listVoices() {
        return this._callMethod('list_voices', []);
    }

    async setVoice(identifier) {
        return this._callMethod('set_voice', [identifier]);
    }

    async _callMethod(method, args) {
        return new Promise((resolve, reject) => {
            const callbackId = method + '_' + Math.random().toString(36).substr(2, 9);
            const listener = (e) => {
                if (e.data && e.data.callback === callbackId) {
                    this.worker.removeEventListener('message', listener);
                    resolve(e.data.result ? e.data.result[0] : undefined);
                }
            };
            this.worker.addEventListener('message', listener);
            this.worker.postMessage({ method, args, callback: callbackId });
        });
    }

    async synthesize(text) {
        if (!text || text.trim().length === 0) return { buffer: new ArrayBuffer(0), events: [] };

        console.log(`TTS: Synthesizing "${text.substring(0, 30)}..."`);
        await this.init();

        return new Promise((resolve) => {
            const callbackId = 'synth_' + Math.random().toString(36).substr(2, 9);
            const chunks = [];

            const listener = (e) => {
                if (e.data && e.data.callback === callbackId) {
                    if (e.data.result && e.data.result[0] instanceof ArrayBuffer) {
                        const buffer = e.data.result[0];
                        if (buffer.byteLength > 0) {
                            chunks.push(new Float32Array(buffer));
                        }
                    }

                    if (e.data.done) {
                        this.worker.removeEventListener('message', listener);

                        if (chunks.length === 0) {
                            console.error('TTS: Synthesis returned no data');
                            resolve({ buffer: new ArrayBuffer(0), events: [] });
                            return;
                        }

                        const totalSamples = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                        const combined = new Float32Array(totalSamples);
                        let offset = 0;
                        for (const chunk of chunks) {
                            combined.set(chunk, offset);
                            offset += chunk.length;
                        }

                        console.log(`TTS: Synthesis complete, total samples: ${totalSamples}`);
                        resolve({ buffer: combined.buffer, events: [] });
                    }
                }
            };

            this.worker.addEventListener('message', listener);
            this.worker.postMessage({ method: 'synthesize', args: [text], callback: callbackId });
        });
    }

    // Helper to convert the buffer returned by espeak-ng to a WAV Blob
    createWavBlob(buffer) {
        const samples = new Float32Array(buffer);
        console.log(`TTS: Encoding ${samples.length} samples (${(samples.length / (this.sampleRate * 2)).toFixed(2)}s) to WAV`);
        const wavBuffer = this.encodeWAV(samples, this.sampleRate);
        return new Blob([wavBuffer], { type: 'audio/wav' });
    }

    encodeWAV(samples, sampleRate) {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        const writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        /* RIFF identifier */
        writeString(view, 0, 'RIFF');
        /* file length */
        view.setUint32(4, 36 + samples.length * 2, true);
        /* RIFF type */
        writeString(view, 8, 'WAVE');
        /* format chunk identifier */
        writeString(view, 12, 'fmt ');
        /* format chunk length */
        view.setUint32(16, 16, true);
        /* sample format (PCM) */
        view.setUint16(20, 1, true);
        /* channel count (stereo in this espeak-ng build) */
        view.setUint16(22, 2, true);
        /* sample rate */
        view.setUint32(24, sampleRate, true);
        /* byte rate (sample rate * block align) */
        view.setUint32(28, sampleRate * 4, true);
        /* block align (channel count * bytes per sample) */
        view.setUint16(32, 4, true);
        /* bits per sample */
        view.setUint16(34, 16, true);
        /* data chunk identifier */
        writeString(view, 36, 'data');
        /* data chunk length */
        view.setUint32(40, samples.length * 2, true);

        // Write samples
        let offset = 44;
        for (let i = 0; i < samples.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return buffer;
    }
}
