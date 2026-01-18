/*
 * Copyright (C) 2016-2020 Kano Computing Ltd.
 * License: http://www.gnu.org/licenses/gpl-2.0.txt GNU General Public License v2
 */

import { AppModule } from '../../app-modules/app-module.js';
import Output from '../../output/output.js';

// Pixel Kit has a 16x8 LED matrix (128 LEDs total)
export const LIGHTBOARD_WIDTH = 16;
export const LIGHTBOARD_HEIGHT = 8;

export interface ILightboardFrame {
    pixels: string[][];
}

/**
 * Converts an RGB hex color to RGB565 format used by Pixel Kit
 */
export function rgbToRgb565(hex: string): number {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse RGB values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Convert to RGB565: RRRRR GGGGGG BBBBB
    const r5 = (r >> 3) & 0x1F;
    const g6 = (g >> 2) & 0x3F;
    const b5 = (b >> 3) & 0x1F;

    return (r5 << 11) | (g6 << 5) | b5;
}

/**
 * LightboardModule provides the runtime API for controlling the Pixel Kit LED matrix
 */
export class LightboardModule extends AppModule {
    private pixels: string[][] = [];
    private frameCallback?: (frame: ILightboardFrame) => void;

    constructor(output: Output) {
        super(output);
        this.addLifecycleStep('start', '_start');
        this.addLifecycleStep('stop', '_stop');
    }

    static get id() {
        return 'lightboard';
    }

    _start() {
        // Initialize pixel buffer with black (off)
        this.pixels = [];
        for (let y = 0; y < LIGHTBOARD_HEIGHT; y++) {
            this.pixels[y] = [];
            for (let x = 0; x < LIGHTBOARD_WIDTH; x++) {
                this.pixels[y][x] = '#000000';
            }
        }

        // Expose methods to user code
        this.methods = {
            turnOn: this.turnOn.bind(this),
            turnOff: this.turnOff.bind(this),
            setPixel: this.setPixel.bind(this),
            setAll: this.setAll.bind(this),
            clear: this.clear.bind(this),
            getPixel: this.getPixel.bind(this),
            scrollText: this.scrollText.bind(this),
        };
    }

    _stop() {
        this.clear();
    }

    /**
     * Register a callback to receive frame updates
     */
    onFrame(callback: (frame: ILightboardFrame) => void) {
        this.frameCallback = callback;
    }

    /**
     * Notify listeners of a frame update
     */
    private notifyFrame() {
        if (this.frameCallback) {
            this.frameCallback({ pixels: this.pixels });
        }
        // Also trigger a render so the visual preview updates
        this.output.render();
    }

    /**
     * Turn on all LEDs with the specified color
     */
    turnOn(color: string = '#FFFFFF') {
        for (let y = 0; y < LIGHTBOARD_HEIGHT; y++) {
            for (let x = 0; x < LIGHTBOARD_WIDTH; x++) {
                this.pixels[y][x] = color;
            }
        }
        this.notifyFrame();
    }

    /**
     * Turn off all LEDs
     */
    turnOff() {
        this.clear();
    }

    /**
     * Set a specific pixel to a color
     */
    setPixel(x: number, y: number, color: string = '#FFFFFF') {
        // Clamp coordinates to valid range
        x = Math.floor(x);
        y = Math.floor(y);
        if (x >= 0 && x < LIGHTBOARD_WIDTH && y >= 0 && y < LIGHTBOARD_HEIGHT) {
            this.pixels[y][x] = color;
            this.notifyFrame();
        }
    }

    /**
     * Set all pixels to a single color
     */
    setAll(color: string) {
        this.turnOn(color);
    }

    /**
     * Clear the display (turn off all LEDs)
     */
    clear() {
        for (let y = 0; y < LIGHTBOARD_HEIGHT; y++) {
            for (let x = 0; x < LIGHTBOARD_WIDTH; x++) {
                this.pixels[y][x] = '#000000';
            }
        }
        this.notifyFrame();
    }

    /**
     * Get the color of a specific pixel
     */
    getPixel(x: number, y: number): string {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x >= 0 && x < LIGHTBOARD_WIDTH && y >= 0 && y < LIGHTBOARD_HEIGHT) {
            return this.pixels[y][x];
        }
        return '#000000';
    }

    /**
     * Get the current frame buffer
     */
    getFrame(): ILightboardFrame {
        return { pixels: this.pixels };
    }

    /**
     * Scroll text across the display (placeholder - needs font implementation)
     */
    scrollText(text: string, color: string = '#FFFFFF', speed: number = 100) {
        // This is a simplified placeholder
        // Full implementation would need a pixel font
        console.log(`Scrolling: ${text}`);
    }
}

export default LightboardModule;
