/*
 * Copyright (C) 2016-2020 Kano Computing Ltd.
 * License: http://www.gnu.org/licenses/gpl-2.0.txt GNU General Public License v2
 */

import { EventEmitter, IDisposable } from '@kano/common/index.js';
import { ILightboardFrame, LIGHTBOARD_WIDTH, LIGHTBOARD_HEIGHT, rgbToRgb565 } from '../modules/lightboard/lightboard.js';

// Web Serial API type declarations (not included in older TypeScript)
declare global {
    interface Navigator {
        serial: {
            requestPort(options?: { filters?: Array<{ usbVendorId: number }> }): Promise<any>;
        };
    }
}

/**
 * Connection state for the Pixel Kit
 */
export enum PixelKitConnectionState {
    Disconnected = 'disconnected',
    Connecting = 'connecting',
    Connected = 'connected',
    Error = 'error',
}

/**
 * Pixel Kit RPC commands
 * Based on the Kano Pixel Kit firmware protocol
 */
const RPC_COMMANDS = {
    GET_DEVICE_INFO: 'get-device-info',
    STREAM_FRAME: 'stream-frame',
    SET_NAME: 'set-name',
    GET_NAME: 'get-name',
    GET_BATTERY: 'get-battery-status',
};

/**
 * PixelKitDevice provides USB serial communication with the Kano Pixel Kit
 * using the Web Serial API
 */
export class PixelKitDevice implements IDisposable {
    private port: any = null;
    private reader: any = null;
    private writer: any = null;
    private readBuffer: string = '';
    private _connectionState: PixelKitConnectionState = PixelKitConnectionState.Disconnected;

    // Events
    private _onConnectionStateChange = new EventEmitter<PixelKitConnectionState>();
    get onConnectionStateChange() { return this._onConnectionStateChange.event; }

    private _onMessage = new EventEmitter<any>();
    get onMessage() { return this._onMessage.event; }

    private _onError = new EventEmitter<Error>();
    get onError() { return this._onError.event; }

    get connectionState() { return this._connectionState; }
    get isConnected() { return this._connectionState === PixelKitConnectionState.Connected; }

    /**
     * Check if Web Serial API is available
     */
    static isSupported(): boolean {
        return 'serial' in navigator;
    }

    /**
     * Request user to select a serial port and connect
     */
    async connect(): Promise<boolean> {
        if (!PixelKitDevice.isSupported()) {
            this._onError.fire(new Error('Web Serial API is not supported in this browser. Please use Chrome or Edge.'));
            return false;
        }

        try {
            this.setConnectionState(PixelKitConnectionState.Connecting);

            // Request port from user
            // Filter for common USB-to-serial chip vendor IDs (FTDI, CP210x, CH340)
            this.port = await navigator.serial.requestPort({
                filters: [
                    { usbVendorId: 0x0403 }, // FTDI
                    { usbVendorId: 0x10C4 }, // CP210x (Silicon Labs)
                    { usbVendorId: 0x1A86 }, // CH340
                    { usbVendorId: 0x303A }, // Espressif (ESP32)
                ]
            });

            // Open the port with Pixel Kit settings
            await this.port.open({
                baudRate: 115200,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                flowControl: 'none',
            });

            // Setup reader and writer
            if (this.port.readable) {
                this.reader = this.port.readable.getReader();
                this.startReading();
            }

            if (this.port.writable) {
                this.writer = this.port.writable.getWriter();
            }

            this.setConnectionState(PixelKitConnectionState.Connected);
            return true;

        } catch (error) {
            console.error('Failed to connect to Pixel Kit:', error);
            this.setConnectionState(PixelKitConnectionState.Error);
            this._onError.fire(error as Error);
            return false;
        }
    }

    /**
     * Disconnect from the Pixel Kit
     */
    async disconnect(): Promise<void> {
        try {
            if (this.reader) {
                await this.reader.cancel();
                this.reader.releaseLock();
                this.reader = null;
            }

            if (this.writer) {
                this.writer.releaseLock();
                this.writer = null;
            }

            if (this.port) {
                await this.port.close();
                this.port = null;
            }

            this.setConnectionState(PixelKitConnectionState.Disconnected);
        } catch (error) {
            console.error('Error disconnecting:', error);
            this._onError.fire(error as Error);
        }
    }

    /**
     * Start reading data from the serial port
     */
    private async startReading(): Promise<void> {
        if (!this.reader) return;

        const decoder = new TextDecoder();

        try {
            while (true) {
                const { value, done } = await this.reader.read();
                if (done) break;

                if (value) {
                    this.readBuffer += decoder.decode(value);
                    this.processBuffer();
                }
            }
        } catch (error) {
            if (this._connectionState === PixelKitConnectionState.Connected) {
                console.error('Read error:', error);
                this._onError.fire(error as Error);
            }
        }
    }

    /**
     * Process incoming data buffer for complete messages
     */
    private processBuffer(): void {
        // Messages are newline-delimited JSON
        let newlineIndex: number;
        while ((newlineIndex = this.readBuffer.indexOf('\n')) !== -1) {
            const line = this.readBuffer.substring(0, newlineIndex).trim();
            this.readBuffer = this.readBuffer.substring(newlineIndex + 1);

            if (line) {
                try {
                    const message = JSON.parse(line);
                    this._onMessage.fire(message);
                } catch (e) {
                    // Not JSON, might be debug output
                    console.log('Pixel Kit:', line);
                }
            }
        }
    }

    /**
     * Send a command to the Pixel Kit
     */
    async sendCommand(command: string, params: any = {}): Promise<void> {
        if (!this.writer || !this.isConnected) {
            throw new Error('Not connected to Pixel Kit');
        }

        const message = JSON.stringify({ cmd: command, ...params }) + '\n';
        const encoder = new TextEncoder();
        await this.writer.write(encoder.encode(message));
    }

    /**
     * Send a frame to the Pixel Kit
     * Converts the frame to RGB565 format and sends it
     */
    async streamFrame(frame: ILightboardFrame): Promise<void> {
        if (!this.writer || !this.isConnected) return;

        // Convert frame to RGB565 array
        const frameData: number[] = [];
        for (let y = 0; y < LIGHTBOARD_HEIGHT; y++) {
            for (let x = 0; x < LIGHTBOARD_WIDTH; x++) {
                const row = frame.pixels[y];
                const color = (row && row[x]) ? row[x] : '#000000';
                frameData.push(rgbToRgb565(color));
            }
        }

        // Send as binary frame data
        // Format: 'F' + 256 bytes (128 * 2 bytes for RGB565)
        const buffer = new ArrayBuffer(1 + frameData.length * 2);
        const view = new DataView(buffer);
        view.setUint8(0, 0x46); // 'F' for frame

        for (let i = 0; i < frameData.length; i++) {
            view.setUint16(1 + i * 2, frameData[i], false); // Big-endian
        }

        await this.writer.write(new Uint8Array(buffer));
    }

    /**
     * Alternative: Send frame as JSON RPC (slower but more compatible)
     */
    async streamFrameRPC(frame: ILightboardFrame): Promise<void> {
        if (!this.writer || !this.isConnected) return;

        // Convert frame to flat array of RGB565 values
        const pixels: number[] = [];
        for (let y = 0; y < LIGHTBOARD_HEIGHT; y++) {
            for (let x = 0; x < LIGHTBOARD_WIDTH; x++) {
                const row = frame.pixels[y];
                const color = (row && row[x]) ? row[x] : '#000000';
                pixels.push(rgbToRgb565(color));
            }
        }

        await this.sendCommand(RPC_COMMANDS.STREAM_FRAME, { pixels });
    }

    /**
     * Get device info
     */
    async getDeviceInfo(): Promise<void> {
        await this.sendCommand(RPC_COMMANDS.GET_DEVICE_INFO);
    }

    /**
     * Set device name
     */
    async setName(name: string): Promise<void> {
        await this.sendCommand(RPC_COMMANDS.SET_NAME, { name });
    }

    /**
     * Get battery status
     */
    async getBatteryStatus(): Promise<void> {
        await this.sendCommand(RPC_COMMANDS.GET_BATTERY);
    }

    private setConnectionState(state: PixelKitConnectionState): void {
        this._connectionState = state;
        this._onConnectionStateChange.fire(state);
    }

    dispose(): void {
        this.disconnect();
    }
}

export default PixelKitDevice;
