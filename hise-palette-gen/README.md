
# HSLuv Programmatic Palette Generator for HISE

A script for programmatically deriving complete, accessible, and perceptually uniform UI palettes from a single base color using the **HSLuv** color space. [https://www.hsluv.org/](https://www.hsluv.org/)

## Overview

Standard HSL is mathematically simple but perceptually inconsistent (e.g., Yellow at 50% lightness looks much brighter than Blue at 50% lightness). This makes it difficult to programmatically generate "lighter" or "darker" UI states that work consistently across all hues.

This system uses **HSLuv** to solve that problem, allowing you to generate `Hover`, `Clicked`, `Disabled`, and `Focus` states that maintain consistent visual weight and legibility, regardless of whether your base color is a pastel yellow or a deep violet.

## Features

### 1\. Smart Focus Ring

The focus state uses a **Complementary Hue + Lightness Inversion** strategy.

  * It rotates the hue 180 degrees for color contrast.
  * It calculates the button's luminance and forces the ring to be either **Deep** (for light buttons) or **Pastel** (for dark buttons).
  * **Result:** Guaranteed WCAG-friendly visibility on any background color.

### 2\. Smart Disabled State

Instead of a flat grey, this uses **Lightness Compression**.

  * It preserves a faint tint of the original hue (Saturation \~20).
  * It compresses the lightness towards neutral grey.
  * **Low Saturation Fix:** If the base color is already desaturated, the logic boosts the lightness contrast to ensure the "Disabled" state looks distinct from the "Normal" state.

### 3\. Perceptual Uniformity

All state changes (lightening for hover, darkening for click) are done in the HSLuv space, ensuring that color shifts do not "muddy" the tone or accidentally disappear against the background.

## Dependencies

This script requires the **HSLuv.js** library ported for HISE.

1.  Download `HSLuv.js` from the repository:
    [https://github.com/craig-van-hise/hise-scripts/tree/main/hise-hsluv](https://github.com/craig-van-hise/hise-scripts/tree/main/hise-hsluv)

## Installation

1.  Place the `HSLuv.js` file into your HISE Project's Scripts folder (e.g., `Scripts/utils/colour/HSLuv.js`).
2.  Place the `HSLuvPaletteGen.js` (this script) into your Scripts folder.

## Usage

```javascript
// 1. Include the HSLuv Dependency
include("utils/colour/HSLuv.js");

// 2. Include this Palette Generator
include("HSLuvPaletteGen.js");

// 3. Define your Base Color (e.g., Blue)
const myBaseColor = 0xFF2196F3; 

// 4. Generate the Palette Object
const palette = generateButtonPalette(myBaseColor);

/*
 Returns:
 palette.normal   { background, text }
 palette.hover    { background, text }
 palette.clicked  { background, text }
 palette.disabled { background, text }
 palette.focus    { background, text, outline }
*/

// 5. Create a ScriptPanel (Buttons do not support paint routines)
const MyPanel = Content.addPanel("MyPanel", 0, 0);
MyPanel.set("allowCallbacks", "Clicks & Hover");
MyPanel.set("width", 150);
MyPanel.set("height", 50);

// 6. Apply to Paint Routine
MyPanel.setPaintRoutine(function(g)
{
    // Default to normal state
    var state = palette.normal;
    
    // Check flags (set in mouse callback) to determine state
    if (this.data.hover) state = palette.hover;
    if (this.data.clicked) state = palette.clicked;

    // Draw Background
    g.setColour(state.background);
    g.fillRoundedRectangle(this.getLocalBounds(0), 6.0);

    // Draw Text (High contrast is auto-calculated)
    g.setColour(state.text);
    g.setFont("default", 16.0);
    g.drawAlignedText("Hello!", this.getLocalBounds(0), "centred");
    
    // Optional: Draw Focus Ring
    // (You would typically handle focus logic in a key callback or separate flag)
});

// 7. Handle Interaction
MyPanel.setMouseCallback(function(event)
{
    this.data.hover = event.hover;
    this.data.clicked = event.clicked;
    this.repaint();
});
```