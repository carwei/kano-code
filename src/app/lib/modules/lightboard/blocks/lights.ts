/*
 * Copyright (C) 2016-2020 Kano Computing Ltd.
 * License: http://www.gnu.org/licenses/gpl-2.0.txt GNU General Public License v2
 */

import { Block, Blockly } from '@kano/kwc-blockly/blockly.js';

/**
 * Block definitions for the Lightboard (Pixel Kit) module
 */
export const lights = [
    // Turn on all lights with a color
    {
        block: (part: any) => ({
            id: 'turn_on',
            message0: `${part.name}: turn on %1`,
            args0: [{
                type: 'input_value',
                name: 'COLOR',
                check: 'Colour',
            }],
            previousStatement: null,
            nextStatement: null,
        }),
        javascript: () => function(block: Block) {
            const color = Blockly.JavaScript.valueToCode(block, 'COLOR', Blockly.JavaScript.ORDER_COMMA) || "'#FFFFFF'";
            return `lightboard.turnOn(${color});\n`;
        },
    },
    // Turn off all lights
    {
        block: (part: any) => ({
            id: 'turn_off',
            message0: `${part.name}: turn off`,
            previousStatement: null,
            nextStatement: null,
        }),
        javascript: () => function(block: Block) {
            return `lightboard.turnOff();\n`;
        },
    },
    // Light a specific pixel at x, y with a color
    {
        block: (part: any) => ({
            id: 'light_x_y',
            message0: `${part.name}: light x %1 y %2 color %3`,
            args0: [
                {
                    type: 'input_value',
                    name: 'X',
                    check: 'Number',
                },
                {
                    type: 'input_value',
                    name: 'Y',
                    check: 'Number',
                },
                {
                    type: 'input_value',
                    name: 'COLOR',
                    check: 'Colour',
                },
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
        }),
        javascript: () => function(block: Block) {
            const x = Blockly.JavaScript.valueToCode(block, 'X', Blockly.JavaScript.ORDER_COMMA) || '0';
            const y = Blockly.JavaScript.valueToCode(block, 'Y', Blockly.JavaScript.ORDER_COMMA) || '0';
            const color = Blockly.JavaScript.valueToCode(block, 'COLOR', Blockly.JavaScript.ORDER_COMMA) || "'#FFFFFF'";
            return `lightboard.setPixel(${x}, ${y}, ${color});\n`;
        },
    },
    // Set all pixels to a color
    {
        block: (part: any) => ({
            id: 'set_all',
            message0: `${part.name}: set all to %1`,
            args0: [{
                type: 'input_value',
                name: 'COLOR',
                check: 'Colour',
            }],
            previousStatement: null,
            nextStatement: null,
        }),
        javascript: () => function(block: Block) {
            const color = Blockly.JavaScript.valueToCode(block, 'COLOR', Blockly.JavaScript.ORDER_COMMA) || "'#FFFFFF'";
            return `lightboard.setAll(${color});\n`;
        },
    },
    // Clear the display
    {
        block: (part: any) => ({
            id: 'clear',
            message0: `${part.name}: clear`,
            previousStatement: null,
            nextStatement: null,
        }),
        javascript: () => function(block: Block) {
            return `lightboard.clear();\n`;
        },
    },
    // Scroll text across display
    {
        block: (part: any) => ({
            id: 'scroll_text',
            message0: `${part.name}: scroll text %1 color %2 speed %3`,
            args0: [
                {
                    type: 'input_value',
                    name: 'TEXT',
                    check: 'String',
                },
                {
                    type: 'input_value',
                    name: 'COLOR',
                    check: 'Colour',
                },
                {
                    type: 'input_value',
                    name: 'SPEED',
                    check: 'Number',
                },
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
        }),
        javascript: () => function(block: Block) {
            const text = Blockly.JavaScript.valueToCode(block, 'TEXT', Blockly.JavaScript.ORDER_COMMA) || "''";
            const color = Blockly.JavaScript.valueToCode(block, 'COLOR', Blockly.JavaScript.ORDER_COMMA) || "'#FFFFFF'";
            const speed = Blockly.JavaScript.valueToCode(block, 'SPEED', Blockly.JavaScript.ORDER_COMMA) || '100';
            return `lightboard.scrollText(${text}, ${color}, ${speed});\n`;
        },
    },
];

export default lights;
