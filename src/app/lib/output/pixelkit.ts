/*
 * Copyright (C) 2016-2020 Kano Computing Ltd.
 * License: http://www.gnu.org/licenses/gpl-2.0.txt GNU General Public License v2
 */

import { OutputProfile } from './profile.js';
import { Output, IVisualsContext, IAudioContext, IDOMContext } from './output.js';
import { IOutputProvider } from './index.js';
import { LightboardModule, LIGHTBOARD_WIDTH, LIGHTBOARD_HEIGHT, ILightboardFrame } from '../modules/lightboard/lightboard.js';
import { PixelKitDevice, PixelKitConnectionState } from '../devices/pixel-kit.js';
import { EventEmitter, IDisposable } from '@kano/common/index.js';
import { Microphone } from './microphone.js';

// Visual settings for the preview
const PIXEL_SIZE = 20;
const PIXEL_GAP = 2;
const PREVIEW_WIDTH = LIGHTBOARD_WIDTH * (PIXEL_SIZE + PIXEL_GAP) + PIXEL_GAP;
const PREVIEW_HEIGHT = LIGHTBOARD_HEIGHT * (PIXEL_SIZE + PIXEL_GAP) + PIXEL_GAP;
const BACKGROUND_COLOR = '#1a1a2e';

/**
 * Draw a rounded rectangle (polyfill for older browsers)
 */
function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * PixelKitOutputViewProvider renders the LED matrix and streams to the device
 */
export class PixelKitOutputViewProvider implements IOutputProvider {
    public root: HTMLElement;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D | null = null;
    private output: Output | undefined;
    private lightboardModule: LightboardModule | undefined;
    private device: PixelKitDevice;
    private audioContext: AudioContext | undefined;
    private microphone: Microphone | undefined;
    private _onDidResize = new EventEmitter<void>();
    private subscriptions: IDisposable[] = [];

    // Connection UI
    private connectButton: HTMLButtonElement | undefined;
    private statusIndicator: HTMLElement | undefined;

    constructor() {
        this.root = document.createElement('div');
        this.root.className = 'pixelkit-output';
        this.root.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            background: ${BACKGROUND_COLOR};
            gap: 16px;
        `;

        // Create canvas for preview
        this.canvas = document.createElement('canvas');
        this.canvas.width = PREVIEW_WIDTH;
        this.canvas.height = PREVIEW_HEIGHT;
        this.canvas.style.cssText = `
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;
        this.ctx = this.canvas.getContext('2d');

        // Create connection controls
        const controls = document.createElement('div');
        controls.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
        `;

        this.statusIndicator = document.createElement('div');
        this.statusIndicator.style.cssText = `
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #666;
        `;

        this.connectButton = document.createElement('button');
        this.connectButton.textContent = 'Connect Pixel Kit';
        this.connectButton.style.cssText = `
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            background: #E91E63;
            color: white;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
        `;
        const btn = this.connectButton;
        this.connectButton.onmouseover = () => {
            btn.style.background = '#C2185B';
        };
        this.connectButton.onmouseout = () => {
            btn.style.background = '#E91E63';
        };

        controls.appendChild(this.statusIndicator);
        controls.appendChild(this.connectButton);

        this.root.appendChild(this.canvas);
        this.root.appendChild(controls);

        // Initialize device
        this.device = new PixelKitDevice();

        // Setup event handlers
        this.connectButton.onclick = () => this.toggleConnection();
        this.subscriptions.push(
            this.device.onConnectionStateChange((state) => this.updateConnectionUI(state))
        );

        // Initial render
        this.renderBlankFrame();
    }

    private async toggleConnection(): Promise<void> {
        if (this.device.isConnected) {
            await this.device.disconnect();
        } else {
            await this.device.connect();
        }
    }

    private updateConnectionUI(state: PixelKitConnectionState): void {
        if (!this.statusIndicator || !this.connectButton) return;

        switch (state) {
            case PixelKitConnectionState.Connected:
                this.statusIndicator.style.background = '#4CAF50';
                this.connectButton.textContent = 'Disconnect';
                break;
            case PixelKitConnectionState.Connecting:
                this.statusIndicator.style.background = '#FFC107';
                this.connectButton.textContent = 'Connecting...';
                break;
            case PixelKitConnectionState.Error:
                this.statusIndicator.style.background = '#F44336';
                this.connectButton.textContent = 'Retry Connection';
                break;
            default:
                this.statusIndicator.style.background = '#666';
                this.connectButton.textContent = 'Connect Pixel Kit';
        }
    }

    onInstall(output: Output): void {
        this.output = output;
    }

    onInject(): void {
        // Find the lightboard module after injection
        if (this.output) {
            const runner = this.output.runner as any;
            const appModules = runner.appModules;
            if (appModules) {
                const modules = appModules.modules;
                if (modules && modules.lightboard) {
                    this.lightboardModule = modules.lightboard as LightboardModule;
                    // Register frame callback
                    this.lightboardModule.onFrame((frame: ILightboardFrame) => this.onFrameUpdate(frame));
                }
            }
        }
    }

    start(): void {
        this.renderBlankFrame();
    }

    stop(): void {
        this.renderBlankFrame();
    }

    private renderBlankFrame(): void {
        if (!this.ctx) return;

        this.ctx.fillStyle = BACKGROUND_COLOR;
        this.ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

        // Draw grid of "off" pixels
        for (let y = 0; y < LIGHTBOARD_HEIGHT; y++) {
            for (let x = 0; x < LIGHTBOARD_WIDTH; x++) {
                const px = PIXEL_GAP + x * (PIXEL_SIZE + PIXEL_GAP);
                const py = PIXEL_GAP + y * (PIXEL_SIZE + PIXEL_GAP);

                this.ctx.fillStyle = '#333';
                drawRoundedRect(this.ctx, px, py, PIXEL_SIZE, PIXEL_SIZE, 3);
                this.ctx.fill();
            }
        }
    }

    private onFrameUpdate(frame: ILightboardFrame): void {
        // Render to canvas
        this.renderFrame(frame);

        // Stream to device if connected
        if (this.device.isConnected) {
            this.device.streamFrame(frame).catch((err: Error) => {
                console.error('Failed to stream frame:', err);
            });
        }
    }

    private renderFrame(frame: ILightboardFrame): void {
        if (!this.ctx) return;

        this.ctx.fillStyle = BACKGROUND_COLOR;
        this.ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

        for (let y = 0; y < LIGHTBOARD_HEIGHT; y++) {
            for (let x = 0; x < LIGHTBOARD_WIDTH; x++) {
                const px = PIXEL_GAP + x * (PIXEL_SIZE + PIXEL_GAP);
                const py = PIXEL_GAP + y * (PIXEL_SIZE + PIXEL_GAP);
                const row = frame.pixels[y];
                const color = (row && row[x]) ? row[x] : '#000000';

                // Draw pixel with glow effect for lit pixels
                if (color !== '#000000') {
                    this.ctx.shadowColor = color;
                    this.ctx.shadowBlur = 8;
                }

                this.ctx.fillStyle = color === '#000000' ? '#333' : color;
                drawRoundedRect(this.ctx, px, py, PIXEL_SIZE, PIXEL_SIZE, 3);
                this.ctx.fill();

                this.ctx.shadowBlur = 0;
            }
        }
    }

    onImport(): void {}

    onExport(data: any): any {
        return data;
    }

    onCreationImport(data: any): any {
        return data;
    }

    onCreationExport(data: any): any {
        return data;
    }

    render(): void {
        // Get current frame from lightboard module and render
        if (this.lightboardModule) {
            const frame = this.lightboardModule.getFrame();
            this.renderFrame(frame);
        }
    }

    getRestrictElement(): HTMLElement {
        return this.root;
    }

    getVisuals(): IVisualsContext {
        return {
            canvas: this.canvas,
            width: PREVIEW_WIDTH,
            height: PREVIEW_HEIGHT,
        };
    }

    getAudio(): IAudioContext {
        if (!this.audioContext) {
            this.audioContext = new AudioContext();
        }
        if (!this.microphone) {
            this.microphone = new Microphone(this.audioContext);
        }
        return {
            context: this.audioContext,
            destination: this.audioContext.destination,
            microphone: this.microphone,
        };
    }

    getDOM(): IDOMContext {
        return {
            root: this.root,
            onDidResize: this._onDidResize.event,
        };
    }

    resize(): void {
        this._onDidResize.fire();
    }

    updateProgress(value: number): void {
        // Could show loading progress
    }

    onDispose(): void {
        this.device.dispose();
        this.subscriptions.forEach((s) => s.dispose());
    }

    /**
     * Get the device instance for external access
     */
    getDevice(): PixelKitDevice {
        return this.device;
    }
}

/**
 * PixelKitOutputProfile configures the editor for Pixel Kit usage
 */
export class PixelKitOutputProfile extends OutputProfile {
    id = 'pixelkit';
    outputViewProvider: PixelKitOutputViewProvider | undefined;
    plugins: any[] = [];
    modules: any[] = [];
    parts: any[] = [];

    onInstall(output: Output): void {
        // Add the lightboard module
        this.modules = [LightboardModule];

        // Create the output view provider
        this.outputViewProvider = new PixelKitOutputViewProvider();
    }

    onInject(): void {
        if (this.outputViewProvider) {
            this.outputViewProvider.onInject();
        }
    }

    /**
     * Get the device for external access (e.g., for connection UI)
     */
    getDevice(): PixelKitDevice | undefined {
        if (this.outputViewProvider) {
            return this.outputViewProvider.getDevice();
        }
        return undefined;
    }
}

export default PixelKitOutputProfile;
