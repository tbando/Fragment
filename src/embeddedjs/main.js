import Poco from "commodetto/Poco";
import parseBMF from "commodetto/parseBMF";
import parseRLE from "commodetto/parseRLE";
// import Location from "embedded:sensor/Location";
// import Health from "embedded:sensor/Health";
import Message from "pebble/message";

const render = new Poco(screen);

// Load a custom font from BMF resources
function getFont(name, size) {
    const font = parseBMF(new Resource(`${name}-${size}.fnt`));
    font.bitmap = parseRLE(new Resource(`${name}-${size}-alpha.bm4`));
    return font;
}

// Fonts
const timeFont = getFont("artemis_inter", 56);
const dateFont = getFont("artemis_inter", 24);
const smallFont = new render.Font("Gothic-Regular", 18);

// Default settings
const DEFAULT_SETTINGS = {
    backgroundColor: { r: 0, g: 0, b: 0 },
    textColor: { r: 255, g: 255, b: 255 },
    useFahrenheit: false,
    showDate: true,
    use24Hour: true
};

// Load settings from persistent storage
function loadSettings() {
    const stored = localStorage.getItem("settings");
    if (stored) {
        try {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        } catch (e) {
            console.log("Failed to parse settings");
        }
    }
    return { ...DEFAULT_SETTINGS };
}

// Save settings to persistent storage
function saveSettings() {
    localStorage.setItem("settings", JSON.stringify(settings));
}

let settings = loadSettings();

// Create colors from settings
let bgColor = render.makeColor(settings.backgroundColor.r,
    settings.backgroundColor.g, settings.backgroundColor.b);
let textColor = render.makeColor(settings.textColor.r,
    settings.textColor.g, settings.textColor.b);

function updateColors() {
    bgColor = render.makeColor(settings.backgroundColor.r,
        settings.backgroundColor.g, settings.backgroundColor.b);
    textColor = render.makeColor(settings.textColor.r,
        settings.textColor.g, settings.textColor.b);
}

// Day and month names
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Store latest time for redraws triggered by other events
let lastDate = new Date();

// Steps data
let steps = 0;
// const health = new Health();

function updateSteps() {
    console.log("Updating steps (logic disabled for now)");
    /*
    health.read((sample) => {
        if (sample && sample.steps !== undefined) {
            steps = sample.steps;
            console.log("Steps: " + steps);
            drawScreen();
        }
    }, { metric: "steps", period: "day" });
    */
}

function drawScreen(event) {
    const now = event?.date ?? lastDate;
    if (event?.date) lastDate = event.date;

    // Log date to console
    const dayName = DAYS[now.getDay()];
    const monthName = MONTHS[now.getMonth()];
    const dateStr = `${dayName} ${monthName} ${String(now.getDate()).padStart(2, "0")}`;
    console.log("Date: " + dateStr);

    render.begin();
    render.fillRectangle(bgColor, 0, 0, render.width, render.height);

    // Get individual digits
    let hours = now.getHours();
    if (!settings.use24Hour) {
        hours = hours % 12 || 12;
    }
    const hStr = String(hours).padStart(2, "0");
    const mStr = String(now.getMinutes()).padStart(2, "0");
    
    const h1 = hStr[0];
    const h2 = hStr[1];
    const m1 = mStr[0];
    const m2 = mStr[1];

    // Layout settings based on layout.png
    // Staggered: HH (Top-Left area), MM (Bottom-Right area)
    const slotWidth = 40; // Fixed width for each digit slot to prevent shifting
    const slotHeight = timeFont.height;
    
    // HH Position (Top-Left quadrant)
    const hhX = (render.unobstructed.width * 0.1) | 0;
    const hhY = (render.unobstructed.height * 0.1) | 0;
    
    // MM Position (Bottom-Right quadrant)
    const mmX = (render.unobstructed.width * 0.4) | 0;
    const mmY = (render.unobstructed.height * 0.35) | 0;

    // Helper to draw centered in slot
    const drawDigit = (digit, x, y) => {
        const dWidth = render.getTextWidth(digit, timeFont);
        render.drawText(digit, timeFont, textColor, x + (slotWidth - dWidth) / 2, y);
    };

    // Draw HH
    drawDigit(h1, hhX, hhY);
    drawDigit(h2, hhX + slotWidth - 5, hhY); // Slightly overlapping/close

    // Draw MM
    drawDigit(m1, mmX, mmY);
    drawDigit(m2, mmX + slotWidth - 5, mmY);

    render.end();
}

// Update every minute (fires immediately when registered)
watch.addEventListener("minutechange", (event) => {
    updateSteps();
    drawScreen(event);
});

// Redraw when Timeline Quick View changes the unobstructed area
watch.addEventListener("resize", drawScreen);

// Receive settings from Clay configuration page
const message = new Message({
    keys: ["BackgroundColor", "TextColor", "TemperatureUnit", "ShowDate", "HourFormat"],
    onReadable() {
        const msg = this.read();

        const bg = msg.get("BackgroundColor");
        if (bg !== undefined) {
            settings.backgroundColor = { r: (bg >> 16) & 0xFF, g: (bg >> 8) & 0xFF, b: bg & 0xFF };
        }
        const tc = msg.get("TextColor");
        if (tc !== undefined) {
            settings.textColor = { r: (tc >> 16) & 0xFF, g: (tc >> 8) & 0xFF, b: tc & 0xFF };
        }
        const tu = msg.get("TemperatureUnit");
        if (tu !== undefined) {
            settings.useFahrenheit = tu === 1;
        }
        const sd = msg.get("ShowDate");
        if (sd !== undefined) {
            settings.showDate = sd === 1;
        }
        const hf = msg.get("HourFormat");
        if (hf !== undefined) {
            settings.use24Hour = hf === 1;
        }

        saveSettings();
        updateColors();
        drawScreen();
    }
});
