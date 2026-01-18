/*
 * Copyright (C) 2016-2020 Kano Computing Ltd.
 * License: http://www.gnu.org/licenses/gpl-2.0.txt GNU General Public License v2
 */

import { lights } from './blocks/lights.js';
import { LightboardModule } from './lightboard.js';
import { _ } from '../../i18n/index.js';
import Editor from '../../editor/editor.js';

const COLOR = '#E91E63'; // Pink color for lightboard blocks

let blocks: any[] = [];
blocks = blocks.concat(lights);

const categoryBlocks = blocks.map((definition) => {
    if (typeof definition === 'string') {
        return {
            id: `lightboard_${definition}`,
            colour: COLOR,
        };
    }
    const block = definition.block({
        id: 'lightboard',
        name: _('MODULE_LIGHTBOARD_NAME', 'Lightboard'),
    });
    block.colour = COLOR;
    return {
        id: `lightboard_${block.id}`,
        colour: block.colour,
        shadow: block.shadow,
    };
});

const category = {
    name: _('MODULE_LIGHTBOARD_NAME', 'Lightboard'),
    id: 'lightboard',
    colour: COLOR,
    blocks: categoryBlocks,
};

export function LightboardAPI(editor: Editor) {
    return {
        type: 'blockly',
        id: LightboardModule.id,
        name: LightboardModule.id,
        typeScriptDefinition: `
            declare namespace lightboard {
                function turnOn(color?: string): void;
                function turnOff(): void;
                function setPixel(x: number, y: number, color?: string): void;
                function setAll(color: string): void;
                function clear(): void;
                function scrollText(text: string, color?: string, speed?: number): void;
            }
        `,
        register(Blockly: any) {
            const definitions: any[] = [];
            blocks.forEach((definition) => {
                if (typeof definition === 'object') {
                    definitions.push(definition);
                }
            });
            definitions.forEach((definition) => {
                const block = definition.block(category);
                block.colour = COLOR;
                const id = `lightboard_${block.id}`;
                if (!block.doNotRegister) {
                    Blockly.Blocks[id] = {
                        init() {
                            this.jsonInit(block);
                        },
                    };
                    Blockly.Blocks[id].customColor = block.colour;
                }
                Blockly.JavaScript[id] = definition.javascript(category);
            });
        },
        category,
        defaults: {
            lightboard_turn_on: {
                COLOR: '#FFFFFF',
            },
            lightboard_light_x_y: {
                X: 0,
                Y: 0,
                COLOR: '#FFFFFF',
            },
            lightboard_set_all: {
                COLOR: '#FF0000',
            },
            lightboard_scroll_text: {
                TEXT: 'Hello',
                COLOR: '#00FF00',
                SPEED: 100,
            },
        },
    };
}

export default LightboardAPI;
