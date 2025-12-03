# HSLuv for HISE

A [HISE Script](https://hise.audio/) port of the [HSLuv](https://www.hsluv.org/) color space library. HSLuv is a human-friendly alternative to HSL, designed to be perceptually uniform.

## Why use HSLuv?

HSLuv is particularly useful for **programmatic palette generation**. Unlike standard HSL, where "50% Lightness" can look vastly different depending on the Hue (e.g., yellow vs. blue), HSLuv guarantees that colors with the same Lightness value share the same perceived brightness. 

This makes it easy to generate consistent, accessible, and aesthetically pleasing color schemes dynamically in your scripts without worrying about some colors disappearing or popping out more than others.

Additionally, **text legibility** becomes trivial to manage. Because of the uniform contrast, you can programmatically decide whether to use black or white text based solely on the Lightness value (e.g., if `L > 50` use black text, otherwise use white), ensuring your UI is always readable regardless of the background hue.

This library allows you to convert between HSLuv and HISE's native colour formats seamlessly.

## Installation

1. Download `HSLuv.js`.
2. Place it in your HISE project's `Scripts` folder (e.g., `Scripts/utils/colour/`).
3. Include it in your script using `include`.

## Usage

```javascript
include("utils/colour/HSLuv.js");

// Convert HSLuv to HISE Colour (uint32)
// H: 0-360, S: 0-100, L: 0-100
const myColour = HSLuv.toColour([200, 100, 75]);

// Use it in your UI
const Panel = Content.addPanel("Panel", 0, 0);
Panel.setPaintRoutine(function(g)
{
	g.fillAll(myColour);
});

// Convert back from HISE Colour to HSLuv
const hsluvValues = HSLuv.fromColour(myColour);
Console.print("Hue: " + hsluvValues[0]); 
Console.print("Saturation: " + hsluvValues[1]); 
Console.print("Lightness: " + hsluvValues[2]); 
```

## Features

- **Perceptual Uniformity**: Colors look consistent across the spectrum.
- **Full Conversion Chain**: Supports conversions between HSLuv, LCh, Luv, XYZ, and RGB.
- **HISE Helpers**: `toColour()`, `toVec4()`, `fromColour()` for easy integration with HISE's API.

## Credits

- **Original Library**: [hsluv-javascript](https://github.com/hsluv/hsluv-javascript) by Alexei Boronine.
- **HISE Port**: Craig Van Hise ([Virtual Virgin](https://www.virtualvirgin.net)).

## License

Released under the MIT License. See `LICENSE` for details.
