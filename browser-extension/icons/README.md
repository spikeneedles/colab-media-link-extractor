# Browser Extension Icons - Rabbit Scanner Theme 🐰

This folder contains the cute rabbit-themed extension icons in the following sizes:

- `icon16.png` - 16x16 pixels (toolbar icon, small)
- `icon32.png` - 32x32 pixels (toolbar icon, retina)
- `icon48.png` - 48x48 pixels (extension management)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## 🚀 Quick Start - Generate Icons NOW!

**Super Easy Method (Recommended):**

1. Open `generate-all-rabbit-icons.html` in your browser
2. Click the big "Download All Icons" button
3. Done! Four PNG files will be downloaded automatically
4. Place them in this folder

That's it! Your extension now has adorable rabbit icons! 🎉

## Individual Icon Generators

If you want to generate icons one at a time:
- `rabbit-icon-16.html` - Generates icon16.png
- `rabbit-icon-32.html` - Generates icon32.png
- `rabbit-icon-48.html` - Generates icon48.png
- `rabbit-icon-128.html` - Generates icon128.png

## About The Rabbit Design 🐰

The rabbit mascot represents the scanning capabilities of the Media Link Scanner:
- 🐰 **Cute & Friendly** - Makes the extension approachable and fun
- 📡 **Alert Ears** - Long rabbit ears symbolize detection and scanning
- 💫 **Scanner Waves** - Circular waves emanating from the rabbit show active scanning
- 🎬 **Media Symbols** - Small play button and link dots on the rabbit's chest
- 🎨 **Blue Theme** - Matches the app's color scheme with gradient backgrounds
- 😊 **Happy Face** - Cute teeth and whiskers make it memorable

## Design Features by Size

**16x16 (Tiny Toolbar Icon):**
- Simplified rabbit silhouette
- Basic ears, eyes, nose, teeth
- Maximum clarity at small size

**32x32 (Retina Toolbar):**
- Full rabbit face with inner ear details
- Eye highlights for depth
- Whiskers for character
- Scanner wave effect

**48x48 (Extension Panel):**
- Complete rabbit design
- Full whiskers (3 per side)
- Smile/mouth detail
- Media icon badge on chest
- Double scanner waves

**128x128 (Store Listing):**
- Maximum detail and polish
- Triple scanner waves
- All features fully rendered
- Print-quality artwork

## Alternative Generation Methods

### Option 2: Convert from SVG

The `icon.svg` file contains the animated rabbit design. Convert to PNG using:

**Online Tools:**
- [Convertio](https://convertio.co/svg-png/)
- [CloudConvert](https://cloudconvert.com/svg-to-png)

**Command Line (ImageMagick):**
```bash
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 32x32 icon32.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

**Command Line (Inkscape):**
```bash
inkscape icon.svg -w 16 -h 16 -o icon16.png
inkscape icon.svg -w 32 -h 32 -o icon32.png
inkscape icon.svg -w 48 -h 48 -o icon48.png
inkscape icon.svg -w 128 -h 128 -o icon128.png
```

### Option 3: Legacy Icon Generator

The `generate-icons.html` file contains the full rabbit drawing code in JavaScript and can generate all sizes with one click.

## Color Scheme

The rabbit uses the app's theme colors:
- **Primary Blue**: #60A5FA (rabbit body)
- **Light Blue**: #93C5FD (ears, outer scanner waves)
- **Pale Blue**: #DBEAFE (inner ears, highlights, media icon)
- **Pink Nose**: #EC4899 (cute detail)
- **White Teeth**: #F8FAFC (friendly smile)
- **Dark Background**: #0F172A → #1E293B (gradient)
- **Dark Details**: #1E293B (eyes, whiskers, mouth)

## Browser Guidelines

### Chrome/Edge
- Icons use rounded corners (24px radius at 128px size)
- Clear contrast on both light and dark backgrounds
- PNG format with transparency
- Follow [Chrome Web Store icon guidelines](https://developer.chrome.com/docs/webstore/images/)

### Firefox
- Similar to Chrome requirements
- Rabbit is recognizable even at 16x16
- Follow [Firefox extension icon guidelines](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/)

## Customization Ideas

Want to customize the rabbit? Here are some ideas:

**Colors:**
- Change the rabbit body color to match your brand
- Try different ear colors for variety
- Adjust the nose color (pink, black, or brand color)

**Accessories:**
- Add headphones for a media theme
- Include a magnifying glass for scanning emphasis
- Put on cool sunglasses for a fun look

**Expression:**
- Change eye size/position for different moods
- Adjust whisker angles
- Modify tooth size

## Why a Rabbit? 🐰

Rabbits are perfect for this extension because they:
- **Have Big Ears** - Like the extension "listening" for media links
- **Are Fast** - Representing quick scanning capabilities
- **Are Alert** - Always aware, like the extension monitoring pages
- **Are Friendly** - Making technical features approachable
- **Are Memorable** - Stands out from generic scanner/antenna icons
- **Are Cute** - Who doesn't love a cute rabbit?

## Technical Details

**File Format:** PNG with transparency
**Color Mode:** RGB + Alpha channel
**Bit Depth:** 32-bit (8-bit per channel + alpha)
**Compression:** PNG lossless
**Background:** Transparent (except for gradient fill)

## Troubleshooting

**Icons not showing in extension?**
- Make sure PNG files are in this exact folder
- Verify file names are exactly: icon16.png, icon32.png, icon48.png, icon128.png
- Check that manifest.json has correct icon paths
- Try reloading the extension after adding icons

**Icons look blurry?**
- Use the HTML generators (they create crisp pixels)
- Don't upscale small icons - generate each size separately
- Make sure image smoothing is enabled in generation code

**Want different colors?**
- Edit the hex color codes in the HTML generator files
- Or edit icon.svg in an SVG editor
- Regenerate the PNGs after making changes

## Credits

Rabbit icon design created for the Media Link Scanner browser extension.
Design philosophy: Cute, friendly, and functional! 🐰✨
