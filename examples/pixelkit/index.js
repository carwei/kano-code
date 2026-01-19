/*
 * Copyright (C) 2016-2020 Kano Computing Ltd.
 * License: http://www.gnu.org/licenses/gpl-2.0.txt GNU General Public License v2
 */

import * as code from '../../index.js';
import * as i18n from '../../i18n.js';
import * as APIs from '../../toolbox.js';
import { LocalStoragePlugin } from '../../dist/app/lib/storage/local-storage.js';
import { Player } from '../../dist/app/lib/index.js';
import { LightboardAPI } from '../../dist/app/lib/modules/lightboard/api.js';
import { PixelKitOutputViewProvider } from '../../dist/app/lib/output/pixelkit.js';

// Check for Web Serial support
if (!('serial' in navigator)) {
    document.getElementById('browser-warning').classList.add('show');
}

/**
 * Custom output profile for Pixel Kit - extends default and uses Pixel Kit view
 */
class PixelKitOutputProfile extends code.DefaultOutputProfile {
    onInstall(output) {
        super.onInstall(output);
        // LightboardModule is already included via default modules
        // Replace output view with Pixel Kit view
        this.outputViewProvider = new PixelKitOutputViewProvider();
    }
}

/**
 * Custom editor profile for Pixel Kit
 */
class PixelKitEditorProfile extends code.DefaultEditorProfile {
    onInstall(editor) {
        super.onInstall(editor);

        // Use local storage for saving projects
        this.storage = new LocalStoragePlugin('pixelkit');
        this.plugins.push(this.storage);

        // Configure toolbox with Pixel Kit blocks
        this.toolbox = [
            LightboardAPI(editor),  // Pixel Kit LED control
            APIs.AppAPI,            // App lifecycle (on start, every X seconds)
            APIs.ControlAPI,        // Control flow (loops, conditions)
            APIs.LogicAPI,          // Boolean logic
            APIs.MathAPI,           // Math operations
            APIs.VariablesAPI,      // Variables
            APIs.ColorAPI,          // Color picker
        ];

        // Use Pixel Kit output profile
        this.outputProfile = new PixelKitOutputProfile();
        Player.registerProfile(this.outputProfile);
    }
}

// Load localization and start editor
const lang = i18n.getLang();

i18n.load(lang, { blockly: true, kanoCodePath: '/' })
    .then(() => {
        const editor = new code.Editor();

        editor.registerProfile(new PixelKitEditorProfile());

        editor.onDidInject(() => {
            // Load saved project
            editor.profile.storage.load();

            // Log welcome message
            console.log('%c Kano Pixel Kit Editor ', 'background: #E91E63; color: white; font-size: 16px; padding: 4px 8px; border-radius: 4px;');
            console.log('Click "Connect Pixel Kit" to connect your device via USB.');
        });

        editor.inject(document.body);
    });
