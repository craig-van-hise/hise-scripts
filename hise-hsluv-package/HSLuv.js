
/* -----------------------------------------------------------------------------
   HSLuv Colour Space Conversion

   Ported to HISE Script from the original JavaScript implementation:
   https://github.com/hsluv/hsluv-javascript

   HSLuv is an alternative to HSL, designed to be perceptually uniform.

   Original work:
   Copyright (c) 2015 Alexei Boronine and contributors
   Released under the MIT License
   https://github.com/hsluv/hsluv
   
   Port author:
   Craig Van Hise
   https://github.com/craig-van-hise
   https://www.virtualvirgin.net

   This port preserves the functionality of the JavaScript version,
   adapted for use in HISE Script.
----------------------------------------------------------------------------- */

/* -----------------------------------------------------------------------------
   The MIT License (MIT)

   Copyright (c) 2015 Alexei Boronine and contributors

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in
   all copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   THE SOFTWARE.
----------------------------------------------------------------------------- */


//--------------------------------------------------------------------------------
// HSLuv
//--------------------------------------------------------------------------------
namespace HSLuv {

	// ---------------------------
	// Constants (D65 / transforms)
	// ---------------------------
	const REF_X = 0.95047;
	const REF_Y = 1.0;
	const REF_Z = 1.08883;

	// ---------------------------
	// Constants (D65 / matrix)
	// ---------------------------

	const M00 = 3.2404542;
	const M01 = -1.5371385;
	const M02 = -0.4985314;

	const M10 = -0.9692660;
	const M11 = 1.8760108;
	const M12 = 0.0415560;

	const M20 = 0.0556434;
	const M21 = -0.2040259;
	const M22 = 1.0572252;


	// other constants
	const PI = 3.141592653589793;
	const EPS = 1e-10;
	const K = 903.2962962;
	const E = 0.0088564516;

	// ===========================
	// added helpers (specific to HISE implementation)
	// ===========================

	// ---------------------------
	// sanitize: replace NaN/Inf with 0.0
	// ---------------------------
	inline function sanitize(v) {
		if (Math.isnan(v)) return 0.0;
		if (Math.isinf(v)) return 0.0;
		return v;
	}

	// ---------------------------
	// clamp01
	// ---------------------------
	inline function clamp01(v) {
		if (v < 0.0) return 0.0;
		if (v > 1.0) return 1.0;
		return v;
	}

	// ---------------------------
	// atan2
	// ---------------------------
	inline function myAtan2(y_in, x_in) {
		local y = sanitize(y_in);
		local x = sanitize(x_in);

		if (x > 0.0)
			return Math.atan(y / x);

		if (x < 0.0 && y >= 0.0)
			return Math.atan(y / x) + PI;

		if (x < 0.0 && y < 0.0)
			return Math.atan(y / x) - PI;

		if (x == 0.0 && y > 0.0)
			return PI / 2.0;

		if (x == 0.0 && y < 0.0)
			return -PI / 2.0;

		return 0.0;
	}

	// ===========================
	// original helpers
	// ===========================

	// ---------------------------
	// sRGB companding (linear -> sRGB)
	// ---------------------------
	inline function srgbCompanding(c) {
		local c_sanitized = sanitize(c);
		// do NOT force negative linear values to zero here;
		// the linear branch covers small and negative values correctly.
		if (c_sanitized <= 0.0031308) return 12.92 * c_sanitized;
		return 1.055 * Math.pow(c_sanitized, 1.0 / 2.4) - 0.055;
	}


	// ---------------------------
	// inverse companding (sRGB -> linear)
	// ---------------------------
	inline function srgbInverseCompanding(c) {
		local c_sanitized = sanitize(c);
		c_sanitized = Math.range(c_sanitized, 0.0, 1.0);

		if (c_sanitized <= 0.04045) return c_sanitized / 12.92;
		return Math.pow((c_sanitized + 0.055) / 1.055, 2.4);
	}

	// ---------------------------
	// pushLine_safe: returns [m,b] or null
	// ---------------------------
	inline function pushLine_safe(mc0, mc1, mc2, L, t) {
		local mc0_s = sanitize(mc0);
		local mc1_s = sanitize(mc1);
		local mc2_s = sanitize(mc2);
		local L_s = sanitize(L);
		local t_s = sanitize(t);

		local sub1 = Math.pow((L_s + 16.0) / 116.0, 3.0);
		local sub2 = (sub1 > E) ? sub1 : (L_s / K);
		sub2 = sanitize(sub2);

		if (Math.abs(sub2) < EPS) return null;

		// Corrected formula: last term uses L_s, not sub2
		local top1 = (284517.0 * mc0_s - 94839.0 * mc2_s) * sub2;
		local top2 = (838422.0 * mc2_s + 769860.0 * mc1_s + 731718.0 * mc0_s) * sub2 * L_s - 769860.0 * t_s * L_s;
		local bottom = (632260.0 * mc2_s - 126452.0 * mc1_s) * sub2 + 126452.0 * t_s;

		bottom = sanitize(bottom);

		if (Math.abs(bottom) < EPS) return null;

		local m = top1 / bottom;
		local b = top2 / bottom;

		if (Math.isnan(m) || Math.isinf(m) || Math.isnan(b) || Math.isinf(b)) return null;

		m = sanitize(m);
		b = sanitize(b);

		return [m, b];
	}


	// ---------------------------
	// Function: getBounds
	// Returns 6 lines [m,b] representing sRGB gamut for a given L
	// ---------------------------
	inline function getBounds(L) {
		local result = [];

		local sub1 = Math.pow((L + 16.0) / 116.0, 3.0);
		local sub2 = (sub1 > E) ? sub1 : (L / K);

		// Each row corresponds to [m0,m1,m2]
		local m =
			[
				[3.240969941904521, -1.537383177570093, -0.498610760293],
				[-0.96924363628087, 1.87596750150772, 0.041555057407175],
				[0.055630079696993, -0.20397695888897, 1.056971514242878]
			];

		for (c = 0; c < 3; c = c + 1) {
			local mc0 = m[c][0];
			local mc1 = m[c][1];
			local mc2 = m[c][2];

			// lower bound (t=0)
			local line0 = pushLine_safe(mc0, mc1, mc2, L, 0);
			if (line0 != null) result.push(line0);

			// upper bound (t=1)
			local line1 = pushLine_safe(mc0, mc1, mc2, L, 1);
			if (line1 != null) result.push(line1);
		}

		return result;
	}


	// ---------------------------
	// Function: maxChromaForLH
	// Returns maximum chroma for given L and H (degrees)
	// ---------------------------
	inline function maxChromaForLH(L, H) {
		local hRad = Math.toRadians(H);
		local bounds = getBounds(L);
		local minLength = 1e10;

		for (i = 0; i < bounds.length; i = i + 1) {
			local slope = bounds[i][0];
			local intercept = bounds[i][1];

			// intersection with ray from origin at angle hRad
			local length = intercept / (Math.sin(hRad) - slope * Math.cos(hRad));

			if (length >= 0 && length < minLength) minLength = length;
		}

		return minLength;
	}


	// ===========================
	// conversion chain forward (HSLuv -> RGB) 
	// ===========================


	// ---------------------------
	// hsluvToLch
	// ---------------------------
	inline function hsluvToLch(HSL) {
		local H = sanitize(HSL[0]);
		local S = sanitize(HSL[1]);
		local L = sanitize(HSL[2]);

		if (L < EPS || L > 99.99999) {
			return [L, 0.0, H];
		}

		local maxC = maxChromaForLH(L, H);

		if (maxC <= EPS) {
			return [L, 0.0, H];
		}

		local Sat = Math.range(S, 0.0, 100.0);
		local C = maxC * (Sat / 100.0);

		C = sanitize(C);

		return [L, C, H];
	}

	// ---------------------------
	// lchToLuv
	// ---------------------------
	inline function lchToLuv(LCH) {
		local L = sanitize(LCH[0]);
		local C = sanitize(LCH[1]);
		local H = sanitize(LCH[2]);

		local Hrad = Math.toRadians(H);

		local u = C * Math.cos(Hrad);
		local v = C * Math.sin(Hrad);

		u = sanitize(u);
		v = sanitize(v);

		return [L, u, v];
	}

	// ---------------------------
	// luvToXyz
	// ---------------------------
	inline function luvToXyz(Luv) {
		local L = sanitize(Luv[0]);
		local u = sanitize(Luv[1]);
		local v = sanitize(Luv[2]);

		// Step 1: Y
		local Y;
		if (L <= 8) Y = L * REF_Y / 903.3;
		else Y = Math.pow((L + 16) / 116, 3) * REF_Y;

		// Step 2: Uref / Vref
		local Uref = 4.0 * REF_X / (REF_X + 15.0 * REF_Y + 3.0 * REF_Z);
		local Vref = 9.0 * REF_Y / (REF_X + 15.0 * REF_Y + 3.0 * REF_Z);

		// Step 3: Compute U/V
		local U;
		local V;
		if (L < EPS) // tiny L -> avoid division by zero
		{
			U = Uref;
			V = Vref;
		}
		else {
			U = u / (13.0 * L) + Uref;
			V = v / (13.0 * L) + Vref;
		}

		// Step 4: X/Z
		local denom = 4.0 * V;
		if (Math.abs(denom) < EPS) denom = EPS; // avoid divide by zero

		local X = Y * 9.0 * U / denom;
		local Z = Y * (12.0 - 3.0 * U - 20.0 * V) / denom;

		return [X, Y, Z];
	}

	// ---------------------------
	// xyzToRgb
	// ---------------------------
	inline function xyzToRgb(XYZ) {
		local x = sanitize(XYZ[0]);
		local y = sanitize(XYZ[1]);
		local z = sanitize(XYZ[2]);

		local r_lin = x * M00 + y * M01 + z * M02;
		local g_lin = x * M10 + y * M11 + z * M12;
		local b_lin = x * M20 + y * M21 + z * M22;

		local r = srgbCompanding(r_lin);
		local g = srgbCompanding(g_lin);
		local b = srgbCompanding(b_lin);

		r = clamp01(sanitize(r));
		g = clamp01(sanitize(g));
		b = clamp01(sanitize(b));

		return [r, g, b];
	}


	// ===========================
	// conversion chain backward (RGB -> HSLuv)
	// ===========================

	// ---------------------------
	// rgbToXyz: inverse compand then matrix
	// ---------------------------
	inline function rgbToXyz(RGB) {
		local r = sanitize(RGB[0]);
		local g = sanitize(RGB[1]);
		local b = sanitize(RGB[2]);

		local R_lin = srgbInverseCompanding(r);
		local G_lin = srgbInverseCompanding(g);
		local B_lin = srgbInverseCompanding(b);

		local x = R_lin * 0.4124564 + G_lin * 0.3575761 + B_lin * 0.1804375;
		local y_out = R_lin * 0.2126729 + G_lin * 0.7151522 + B_lin * 0.0721750;
		local z = R_lin * 0.0193339 + G_lin * 0.1191920 + B_lin * 0.9503041;

		x = sanitize(x);
		y_out = sanitize(y_out);
		z = sanitize(z);

		return [x, y_out, z];
	}


	// ---------------------------
	// xyzToLuv
	// ---------------------------
	inline function xyzToLuv(XYZ) {
		local x = sanitize(XYZ[0]);
		local y = sanitize(XYZ[1]);
		local z = sanitize(XYZ[2]);

		local denom = x + 15.0 * y + 3.0 * z;

		if (Math.abs(denom) < EPS) {
			return [0.0, 0.0, 0.0];
		}

		local Yr = y / REF_Y;

		local L;
		if (Yr > E) {
			L = 116.0 * Math.pow(Yr, 1.0 / 3.0) - 16.0;
		}
		else {
			L = K * Yr;
		}

		local U_ = 4.0 * x / denom;
		local V_ = 9.0 * y / denom;

		local Uref = 4.0 * REF_X / (REF_X + 15.0 * REF_Y + 3.0 * REF_Z);
		local Vref = 9.0 * REF_Y / (REF_X + 15.0 * REF_Y + 3.0 * REF_Z);

		local u = 13.0 * L * (U_ - Uref);
		local v = 13.0 * L * (V_ - Vref);

		u = sanitize(u);
		v = sanitize(v);
		L = sanitize(L);

		return [L, u, v];
	}


	// ---------------------------
	// luvToLch
	// ---------------------------
	inline function luvToLch(Luv) {
		local L = sanitize(Luv[0]);
		local u = sanitize(Luv[1]);
		local v = sanitize(Luv[2]);

		local C = Math.sqrt(u * u + v * v);
		local Hrad = myAtan2(v, u);
		local Hdeg = Math.toDegrees(Hrad);

		if (Hdeg < 0.0) {
			Hdeg = Hdeg + 360.0;
		}

		C = sanitize(C);
		Hdeg = sanitize(Hdeg);

		return [L, C, Hdeg];
	}

	// ---------------------------
	// lchToHsluv
	// ---------------------------
	inline function lchToHsluv(LCH) {
		local H = LCH[2];
		local L = LCH[0];

		if (L < EPS || L > 99.99999) {
			return [H, 0.0, L];
		}
	
		local maxC = maxChromaForLH(L, H);

		if (maxC <= EPS) {
			return [H, 0.0, L];
		}
	
		local S = (LCH[1] / maxC) * 100.0;
		S = Math.range(sanitize(S), 0.0, 100.0);

		return [H, S, L];
	}


	// ===========================
	// Main functions --- main conversions from original package
	// ===========================

	// Forward ------>
	// ---------------------------
	// hsluvToRgb
	// ---------------------------
	inline function hsluvToRgb(HSL) {
		// Step 1: HSLuv -> LCh
		local lch = HSLuv.hsluvToLch(HSL);

		// Step 2: LCh -> Luv
		local luv = HSLuv.lchToLuv(lch);

		// Step 3: Luv -> XYZ
		local xyz = HSLuv.luvToXyz(luv);

		// Step 4: XYZ -> RGB
		local rgb = HSLuv.xyzToRgb(xyz);

		return rgb;
	}

	// Backward <------
	// ---------------------------
	// rgbToHsluv
	// ---------------------------
	inline function rgbToHsluv(RGB) {
		// Step 1: RGB -> XYZ
		local xyz = HSLuv.rgbToXyz(RGB);

		// Step 2: XYZ -> Luv
		local luv = HSLuv.xyzToLuv(xyz);

		// Step 3: Luv -> LCH
		local lch = HSLuv.luvToLch(luv);

		// Step 4: LCH -> HSLuv
		local hsluv = HSLuv.lchToHsluv(lch);

		return hsluv;
	}


	// ===========================
	// HISE functions Forward (converting HSLuv to HISE usable formats)---
	// ===========================

	// ---------------------------
	// toVec4
	// Call to HSLuv.toVec4(var HSL) returns [R,G,B A]
	// ---------------------------
	inline function toVec4(HSL) {
		// Step 1: HSLuv -> RGB
		local rgb = HSLuv.hsluvToRgb(HSL);

		return [rgb[0], rgb[1], rgb[2], 1.0];
	}

	// ---------------------------
	// toColour Main Function for HISE Implementation
	// Call to HSLuv.toColour(var HSL) returns uint32 value for HISE "Colours" format
	// Alpha channel is assumed to be 1.0 here
	// ---------------------------
	inline function toColour(HSL) {
		local vec4 = HSLuv.toVec4(HSL);

		// clamp all values to [0,1] to avoid issues
		for (i = 0; i < 4; i++) {
			if (Math.isnan(vec4[i]) || Math.isinf(vec4[i])) {
				vec4[i] = 0.0;
			}
			else {
				vec4[i] = Math.range(vec4[i], 0.0, 1.0);
			}
		}

		return Colours.fromVec4(vec4);
	}

	// ---------------------------
	// toColourWithAlpha
	// Call to HSLuv.toColourWithAlpha(var HSLA) returns uint32 value for HISE "Colours" format
	// ---------------------------
	inline function toColourWithAlpha(HSLA) {
		local hslArray = [HSLA[0], HSLA[1], HSLA[2]];
		local alpha = HSLA[3];

		local vec4 = HSLuv.toVec4(hslArray);

		// override alpha with provided value
		vec4[3] = alpha;

		// clamp all values to [0,1] to avoid issues
		for (i = 0; i < 4; i++) {
			if (Math.isnan(vec4[i]) || Math.isinf(vec4[i])) {
				vec4[i] = 0.0;
			}
			else {
				vec4[i] = Math.range(vec4[i], 0.0, 1.0);
			}
		}

		return Colours.fromVec4(vec4);
	}

	// ===========================
	// HISE functions Backward ---
	// ===========================


	// ---------------------------
	// fromVec4: [R,G,B,A] -> [H,S,L]
	// ---------------------------
	inline function fromVec4(vec4) {
		local RGB = [sanitize(vec4[0]), sanitize(vec4[1]), sanitize(vec4[2])];

		local hsluv = HSLuv.rgbToHsluv(RGB);

		return hsluv;
	}


	// ---------------------------
	// fromColour MAIN FUNCTION INVERSE
	// ---------------------------
	inline function fromColour(colour) {
		// Convert Colour/uint32 to vec4 [r,g,b,a]
		local vec4 = Colours.toVec4(colour);

		// Convert vec4 -> HSLuv
		local hsluv = fromVec4(vec4);

		// Sanitize outputs
		for (i = 0; i < 3; i++) {
			if (Math.isnan(hsluv[i]) || Math.isinf(hsluv[i])) {
				hsluv[i] = 0.0;
			}
		}

		// Clamp S and L to [0,100] and H to [0,360]
		hsluv[0] = Math.range(hsluv[0], 0.0, 360.0);   // H
		hsluv[1] = Math.range(hsluv[1], 0.0, 100.0);   // S
		hsluv[2] = Math.range(hsluv[2], 0.0, 100.0);   // L

		return hsluv; // returns [H, S, L]
	}

	// ---------------------------
	// fromColourWithAlpha
	// ---------------------------
	inline function fromColourWithAlpha(colour) {
		// Convert Colour/uint32 to vec4 [r,g,b,a]
		local vec4 = Colours.toVec4(colour);

		// Extract alpha
		local alpha = vec4[3];

		// Convert vec4 -> HSLuv
		local hsluv = fromVec4(vec4);

		// Sanitize outputs
		for (i = 0; i < 3; i++) {
			if (Math.isnan(hsluv[i]) || Math.isinf(hsluv[i])) {
				hsluv[i] = 0.0;
			}
		}

		// Clamp S and L to [0,100] and H to [0,360]
		hsluv[0] = Math.range(hsluv[0], 0.0, 360.0);   // H
		hsluv[1] = Math.range(hsluv[1], 0.0, 100.0);   // S
		hsluv[2] = Math.range(hsluv[2], 0.0, 100.0);   // L

		// Append alpha
		hsluv.push(alpha);

		return hsluv; // returns [H, S, L, A]
	}

} // end namespace HSLuv






// ************* HSLuv Tools **************** //
// HSLuv = [H, S, L];

// --- Utility: sRGB to linear
inline function toLinear(c) {
	return (c <= 0.04045) ? (c / 12.92) : Math.pow((c + 0.055) / 1.055, 2.4);
}

// --- Compute relative luminance (Lv) from HSLuv input
inline function getLuminance(hsluv) {
    local vec4 = HSLuv.toVec4(hsluv); // vec4 = [r,g,b,a] 
    local r = toLinear(vec4[0]);
    local g = toLinear(vec4[1]);
    local b = toLinear(vec4[2]);

    // Rec. 709 luminance weights
    local Lv = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	return Lv; // 0-1
}

// --- Contrast ratio between two HSLuv colours
inline function getContrast(hsluv1, hsluv2) {
    local Lv1 = getLuminance(hsluv1);
    local Lv2 = getLuminance(hsluv2);

    local L1 = Math.max(Lv1, Lv2);
    local L2 = Math.min(Lv1, Lv2);

	return (L1 + 0.05) / (L2 + 0.05); // WCAG contrast ratio
}

// --- Choose black or white (as HSLuv arrays) for high contrast
inline function chooseHighContrastBW(hsluv) {
    local Lv = getLuminance(hsluv);

	// Return black or white in HSLuv
	return (Lv > 0.5) ? [0, 0, 0] : [0, 0, 100];
}


// =====================
// HSL transforms
// =====================

inline function invertHue(HSL) {
	local H = HSL[0];
	local S = HSL[1];
	local L = HSL[2];

	local newH = H + 180;

	if (newH > 360) {
		newH -= 360;
	}

	local newHSL = [newH, S, L];
	return newHSL;
}

inline function invertLightness(HSL) {
	local H = HSL[0];
	local S = HSL[1];
	local L = HSL[2];
	
	local newL = 1.0 - L;

	local newHSL = [H, S, newL];

	return newHSL;
}






