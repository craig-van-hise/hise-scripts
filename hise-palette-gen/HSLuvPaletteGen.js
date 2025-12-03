
/**
 * HSLuv Programmatic Palette Generator
 * ==============================================================================
 * A system for deriving a complete, accessible, and perceptually uniform 
 * UI palette algorithmically from a single base color.
 *
 * KEY FEATURES:
 * ------------------------------------------------------------------------------
 * 1. Perceptually Uniform: 
 * Uses HSLuv to ensure that changing Hue doesn't wildly shift the visual 
 * weight or "muddy" the tone of your UI.
 *
 * 2. Smart Focus Ring: 
 * Uses "Complementary Hue + Lightness Inversion". It guarantees WCAG-friendly 
 * visibility on ANY background (Dark or Light) by forcing the ring to be 
 * Deep or Pastel based on the button's luminance.
 *
 * 3. Smart Disabled State: 
 * Uses "Lightness Compression" to tint the disabled state with the original 
 * hue (so Red disabled looks different than Blue disabled) while ensuring 
 * it looks strictly inactive.
 *
 * DEPENDENCIES & INSTALLATION:
 * ------------------------------------------------------------------------------
 * This script relies on the "HSLuv.js" library.
 * * 1. Download "HSLuv.js" from the repository:
 * https://github.com/craig-van-hise/hise-scripts/tree/main/hise-hsluv
 * * 2. Place the file inside your HISE Project's "Scripts" folder 
 * (e.g., "{PROJECT_FOLDER}/Scripts/utils/colour/HSLuv.js")
 *
 * Usage:
 * // The include path is relative to your project's "Scripts" folder
 * include("utils/colour/HSLuv.js"); 
 * ==============================================================================
 */

// --- IMPORT DEPENDENCY HERE ---
// Change this path to match where you saved HSLuv.js inside your Scripts folder
include("utils/colour/HSLuv.js");


// ==========================================================================
// 1. HELPER FUNCTIONS
// ==========================================================================

/**
 * Helper to determine text color using HSLuv tools.
 */
inline function getTextCol(bgHsluv)
{
    // chooseHighContrastBW is provided by the external HSLuv.js library
    local bwArray = chooseHighContrastBW(bgHsluv); 
    return HSLuv.toColour(bwArray);
}

/**
 * Generates a full palette using Smart Focus & Smart Disabled logic.
 */
inline function generateButtonPalette(baseColour)
{
    local palette = {};
    
    // 1. Convert base uint32 to HSLuv [H, S, L]
    local primary = HSLuv.fromColour(baseColour);
    
    // Clone arrays
    local hover = primary.clone();
    local clicked = primary.clone();
    local disabled = primary.clone();
    local focus = primary.clone();
    local focusOutline = primary.clone();
    
    // -- Hover --
    if (hover[2] > 80.0) hover[2] -= 10.0; 
    else hover[2] += 10.0;
    
    // -- Clicked --
    if (clicked[2] < 20.0) clicked[2] += 15.0; 
    else clicked[2] -= 15.0;
    
    // -- Disabled --
    disabled[0] = primary[0]; 
    disabled[1] = 20.0; 
    disabled[2] = (primary[2] * 0.5) + 25.0;
    
    // Low Saturation Fix: Boost contrast if disabled L is too close to primary L
    if (primary[1] < 35.0) {
        if (Math.abs(disabled[2] - primary[2]) < 15.0) disabled[2] += 20.0;
    }
    
    // -- Focus Background --
    focus[0] = hover[0];
    focus[1] = hover[1];
    focus[2] = hover[2];
    
    // -- Focus Outline --
    // 1. Rotate Hue 180 degrees
    focusOutline[0] = Math.fmod(focus[0] + 180.0, 360.0);
    // 2. Maximize Saturation
    focusOutline[1] = 100.0; 
    // 3. Invert Lightness (Threshold at 60.0 to prevent flicker)
    if (primary[2] > 60.0) focusOutline[2] = 20.0; 
    else focusOutline[2] = 90.0; 

    // 3. Build Palette
    palette.normal   = { background: baseColour,              text: getTextCol(primary) };
    palette.hover    = { background: HSLuv.toColour(hover),   text: getTextCol(hover) };
    palette.clicked  = { background: HSLuv.toColour(clicked), text: getTextCol(clicked) };
    palette.disabled = { background: HSLuv.toColour(disabled),text: getTextCol(disabled) }; 
    palette.focus    = { background: HSLuv.toColour(focus),   text: getTextCol(focus), outline: HSLuv.toColour(focusOutline) }; 

    return palette;
}

// ==========================================================================
// 2. NAMESPACES (InfiniteKnob)
// ==========================================================================

namespace InfiniteKnob
{
    inline function create(name, x, y, labelText, isInfinite, defaultValue)
    {
        local p = Content.addPanel(name, x, y);

        Content.setPropertiesFromJSON(name, {
            "width": 60, "height": 75,
            "saveInPreset": false, 
            "allowCallbacks": "Clicks, Hover & Dragging", "opaque": false
        });

        p.data.sensitivity = 0.005; 
        p.data.startVal = 0.0;
        p.data.label = labelText;
        p.data.isInfinite = isInfinite;

        p.setValue(defaultValue);

        p.setPaintRoutine(function(g)
        {
            var w = this.getWidth(); var h = 60; 
            
            g.setColour(Colours.darkgrey); g.fillEllipse([2, 2, w-4, h-4]);
            g.setColour(Colours.white); g.drawEllipse([2, 2, w-4, h-4], 2.0);

            var angle = (this.getValue() * 6.2832) + 3.1416;
            var radius = (w / 2) * 0.7;
            var cx = w / 2; var cy = h / 2;
            
            g.setColour(Colours.white);
            g.fillEllipse([cx + radius * Math.sin(angle) - 3, cy - radius * Math.cos(angle) - 3, 6, 6]);

            g.setFont("default", 15.0);
            g.drawAlignedText(this.data.label, [0, 60, w, 15], "centred");
        });

        p.setMouseCallback(function(event)
        {
            if (event.clicked) this.data.startVal = this.getValue();
            else if (event.drag) {
                var delta = -(event.dragY * this.data.sensitivity);
                var newVal = this.data.startVal + delta;
                
                if (this.data.isInfinite) newVal = newVal - Math.floor(newVal);
                else {
                    if (newVal < 0.0) newVal = 0.0;
                    if (newVal > 1.0) newVal = 1.0;
                }
                
                this.setValue(newVal);
                this.changed(); this.repaintImmediately();
            }
        });
        return p;
    };
}

// ==========================================================================
// 3. UI LAYOUT & INITIALIZATION
// ==========================================================================

// --- CONFIGURATION CONSTANTS ---
const var INIT_HUE = 0.0;   // 0 - 360
const var INIT_SAT = 75.0;  // 0 - 100
const var INIT_LIG = 50.0;  // 0 - 100

// Initialize Global State
var currentHSLuv = [INIT_HUE, INIT_SAT, INIT_LIG];
var baseColour = HSLuv.toColour(currentHSLuv);

// --- Background Stage ---
const var BackgroundPanel = Content.addPanel("BackgroundPanel", 0, 0);
BackgroundPanel.set("width", 200);
BackgroundPanel.set("height", 120);
BackgroundPanel.set("saveInPreset", false);
BackgroundPanel.setPaintRoutine(function(g) {
    g.fillAll(0xFF555555); 
});

// --- Test Button ---
const var TestColourPanel = Content.addPanel("TestColourPanel", 30, 35); 
TestColourPanel.set("width", 140);
TestColourPanel.set("height", 50);
TestColourPanel.set("allowCallbacks", "All Callbacks");
TestColourPanel.setConsumedKeyPresses([{"keyCode": 32}, {"keyCode": 13}]);

TestColourPanel.data.palette = generateButtonPalette(baseColour);
TestColourPanel.data.stateFlags = {
    "disabled": false, "clicked": false, "hover": false, "focus": false, "forceFocus": false 
};

// --- Controls ---

const var DisableSwitch = Content.addButton("DisableSwitch", 210, 10);
DisableSwitch.set("text", "Disable");
inline function onDisableControl(component, value)
{
    TestColourPanel.data.stateFlags.disabled = value;
    if (value) TestColourPanel.loseFocus();
    TestColourPanel.repaint();
};
DisableSwitch.setControlCallback(onDisableControl);

const var FocusDemoBtn = Content.addButton("FocusDemoBtn", 210, 40);
FocusDemoBtn.set("text", "Simulate Focus");
inline function onFocusDemoControl(component, value)
{
    TestColourPanel.data.stateFlags.forceFocus = value;
    TestColourPanel.repaint();
};
FocusDemoBtn.setControlCallback(onFocusDemoControl);

inline function updateAll() {
    baseColour = HSLuv.toColour(currentHSLuv);
    TestColourPanel.data.palette = generateButtonPalette(baseColour);
    TestColourPanel.repaint();
}

// --- Knobs ---

const var HueKnob = InfiniteKnob.create("HueKnob", 0, 130, "Hue", true, INIT_HUE / 360.0);
inline function onHueControl(component, value) { currentHSLuv[0] = value * 360.0; updateAll(); };
HueKnob.setControlCallback(onHueControl);

const var SatKnob = InfiniteKnob.create("SatKnob", 70, 130, "Sat", false, INIT_SAT / 100.0);
inline function onSatControl(component, value) { currentHSLuv[1] = value * 100.0; updateAll(); };
SatKnob.setControlCallback(onSatControl);

const var LightKnob = InfiniteKnob.create("LightKnob", 140, 130, "Light", false, INIT_LIG / 100.0);
inline function onLightControl(component, value) { currentHSLuv[2] = value * 100.0; updateAll(); };
LightKnob.setControlCallback(onLightControl);

// Visual Init
SatKnob.changed(); SatKnob.repaint();
LightKnob.changed(); LightKnob.repaint();
HueKnob.changed(); HueKnob.repaint();

// --- BUTTON LOGIC ---

TestColourPanel.setKeyPressCallback(function(event)
{
    if (event.isFocusChange) {
        this.data.stateFlags.focus = event.hasFocus;
        this.repaint();
        return;
    }
    if (!this.data.stateFlags.disabled && (event.keyCode == 32 || event.keyCode == 13)) {
        this.data.stateFlags.clicked = true;
        this.repaint();
        this.startTimer(150); 
    }
});

TestColourPanel.setTimerCallback(function() {
    this.stopTimer();
    this.data.stateFlags.clicked = false;
    this.repaint();
});

TestColourPanel.setMouseCallback(function(event)
{
    if (this.data.stateFlags.disabled) return;
    if (event.clicked) {
        this.data.stateFlags.clicked = true;
        this.grabFocus(); 
    }
    if (event.mouseUp) this.data.stateFlags.clicked = false;
    if (event.hover == 1) this.data.stateFlags.hover = true;
    if (event.hover == 0) this.data.stateFlags.hover = false;
    this.repaint();
});

inline function resolveButtonState(panel)
{
    local flags = panel.data.stateFlags;
    if (flags.disabled) return "disabled";
    if (flags.forceFocus) return "focus";
    if (flags.clicked) return "clicked";
    if (flags.hover) return "hover";
    if (flags.focus) return "focus";
    return "normal";
}

TestColourPanel.setPaintRoutine(function(g)
{
    if (this.data.palette == undefined) this.data.palette = generateButtonPalette(baseColour);

    var currentState = resolveButtonState(this);
    var buttonColors = this.data.palette;
    
    var w = this.getWidth();
    var h = this.getHeight();
    var cornerRadius = 8.0;
    var area = [2, 2, w-4, h-4]; 

    g.setFont("default", 22.0);

    switch (currentState)
    {
        case "normal":
            g.setColour(buttonColors.normal.background);
            g.fillRoundedRectangle(area, cornerRadius);
            g.setColour(buttonColors.normal.text);
            g.drawAlignedText("Normal", area, "centred");
            break;
        case "hover":
            g.setColour(buttonColors.hover.background);
            g.fillRoundedRectangle(area, cornerRadius);
            g.setColour(buttonColors.hover.text);
            g.drawAlignedText("Hover", area, "centred");
            break;
        case "clicked":
            g.setColour(buttonColors.clicked.background);
            g.fillRoundedRectangle(area, cornerRadius);
            g.setColour(buttonColors.clicked.text);
            g.drawAlignedText("Clicked", area, "centred");
            break;
        case "disabled":
            g.setColour(buttonColors.disabled.background);
            g.fillRoundedRectangle(area, cornerRadius);
            g.setColour(buttonColors.disabled.text);
            g.drawAlignedText("Disabled", area, "centred");
            break;
        case "focus":
            g.setColour(buttonColors.focus.background);
            g.fillRoundedRectangle(area, cornerRadius);
            
            g.setColour(buttonColors.focus.outline);
            g.drawRoundedRectangle(area, cornerRadius, 3.0);
            
            g.setColour(buttonColors.focus.text);
            g.drawAlignedText("Focus", area, "centred");
            break;
    }
});

